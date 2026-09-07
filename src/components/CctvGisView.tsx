import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, Department, CameraHealthStatus } from '../types';
import { 
  Layers, 
  Search, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  ZoomIn, 
  ZoomOut, 
  List,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  Globe,
  Camera as CameraIcon,
  Building2,
  ShieldCheck,
  PieChart,
  Navigation,
  X
} from 'lucide-react';

interface CctvGisViewProps {
  cameras: Camera[];
  departments: Department[];
  currentLang?: string;
  onSelectCamera: (camera: Camera) => void;
  selectedDistrictFilter?: string;
  selectedDeptFilter?: string;
  selectedStatusFilter?: string;
}

interface DistrictHubCard {
  name: string;
  districtKey: string;
  onlinePct: string;
  camerasCount: string;
  rawCount: number;
  hubName: string;
  lat: number;
  lng: number;
  zoom: number;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  subBifurcation: Array<{ sector: string; count: number; lat: number; lng: number; type: string }>;
}

// Complete 33 Districts of Gujarat with Sector Sub-Bifurcation
const GUJARAT_33_DISTRICTS: DistrictHubCard[] = [
  {
    name: 'Kutch (Bhuj)',
    districtKey: 'Kutch',
    onlinePct: '95.9% ONLINE',
    camerasCount: '690',
    rawCount: 690,
    hubName: 'Hub: Kutch Border Range CCC',
    lat: 23.2420,
    lng: 69.6669,
    zoom: 10,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Bhuj City Central Command', count: 240, lat: 23.2420, lng: 69.6669, type: 'Urban Command' },
      { sector: 'Kandla Port & Marine Sector', count: 140, lat: 23.0006, lng: 70.2185, type: 'Port Security' },
      { sector: 'Mundra Port Industrial Complex', count: 120, lat: 22.8394, lng: 69.7042, type: 'Industrial' },
      { sector: 'Gandhidham Transit Junction', count: 80, lat: 23.0753, lng: 70.1337, type: 'Highway Transit' },
      { sector: 'Anjar Expressway Corridor', count: 50, lat: 23.1136, lng: 70.0269, type: 'Highway ANPR' },
      { sector: 'Rapar Border Checkpoint', count: 35, lat: 23.5700, lng: 70.6400, type: 'Border Post' },
      { sector: 'Naliya Coastal Outpost', count: 25, lat: 23.2620, lng: 68.8310, type: 'Coastal Surveillance' }
    ]
  },
  {
    name: 'Ahmedabad',
    districtKey: 'Ahmedabad',
    onlinePct: '100% ONLINE',
    camerasCount: '2,840',
    rawCount: 2840,
    hubName: 'Hub: Ahmedabad City Command',
    lat: 23.0225,
    lng: 72.5714,
    zoom: 11,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'SG Highway & Iscon Command', count: 980, lat: 23.0280, lng: 72.5074, type: 'AI Traffic Grid' },
      { sector: 'Maninagar East Sector', count: 620, lat: 22.9972, lng: 72.6012, type: 'Urban Surveillance' },
      { sector: 'Naroda Industrial Corridor', count: 450, lat: 23.0762, lng: 72.6598, type: 'Industrial Security' },
      { sector: 'Satellite & Vastrapur Zone', count: 490, lat: 23.0375, lng: 72.5280, type: 'High Density' },
      { sector: 'SP Ring Road Toll Gates', count: 300, lat: 23.1105, lng: 72.5401, type: 'Perimeter Check' }
    ]
  },
  {
    name: 'Surat',
    districtKey: 'Surat',
    onlinePct: '98.9% ONLINE',
    camerasCount: '2,150',
    rawCount: 2150,
    hubName: 'Hub: Surat Smart City CCC',
    lat: 21.1702,
    lng: 72.8311,
    zoom: 11,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Ring Road & Textile Market Zone', count: 820, lat: 21.1890, lng: 72.8420, type: 'Commercial Grid' },
      { sector: 'Hazira Port Industrial Complex', count: 540, lat: 21.1167, lng: 72.6500, type: 'Marine & Heavy Industry' },
      { sector: 'Adajan & Rander Bridge Corridor', count: 460, lat: 21.2050, lng: 72.7950, type: 'River Transit' },
      { sector: 'Udhna Junction ANPR Posts', count: 330, lat: 21.1520, lng: 72.8490, type: 'Highway Gate' }
    ]
  },
  {
    name: 'Vadodara',
    districtKey: 'Vadodara',
    onlinePct: '99.2% ONLINE',
    camerasCount: '1,620',
    rawCount: 1620,
    hubName: 'Hub: Vadodara Urban CCC',
    lat: 22.3072,
    lng: 73.1812,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Alkapuri Central Command', count: 680, lat: 22.3100, lng: 73.1700, type: 'Urban Command' },
      { sector: 'Makarpura GIDC Sector', count: 490, lat: 22.2400, lng: 73.1900, type: 'Industrial GIDC' },
      { sector: 'Expressway Toll Checkpoint', count: 450, lat: 22.3500, lng: 73.2200, type: 'Highway Toll' }
    ]
  },
  {
    name: 'Rajkot',
    districtKey: 'Rajkot',
    onlinePct: '97.5% ONLINE',
    camerasCount: '1,280',
    rawCount: 1280,
    hubName: 'Hub: Rajkot Range Police HQ',
    lat: 22.3039,
    lng: 70.8022,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Race Course Central Circle', count: 560, lat: 22.3000, lng: 70.7900, type: 'City Core' },
      { sector: 'Metoda GIDC Industrial Post', count: 420, lat: 22.2500, lng: 70.6900, type: 'Manufacturing' },
      { sector: 'Bhakti Nagar Transit Hub', count: 300, lat: 22.2800, lng: 70.8100, type: 'Rail Transit' }
    ]
  },
  {
    name: 'Gandhinagar',
    districtKey: 'Gandhinagar',
    onlinePct: '100% ONLINE',
    camerasCount: '950',
    rawCount: 950,
    hubName: 'Hub: State Command Center (HQ)',
    lat: 23.2156,
    lng: 72.6369,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Sachivalaya & Secretariat VIP Grid', count: 450, lat: 23.2200, lng: 72.6500, type: 'High Security VIP' },
      { sector: 'GIFT City Financial Tower Grid', count: 320, lat: 23.1600, lng: 72.6800, type: 'Smart Financial City' },
      { sector: 'Chiloda Toll Highway Post', count: 180, lat: 23.2800, lng: 72.6900, type: 'State Highway Gate' }
    ]
  },
  {
    name: 'Bhavnagar',
    districtKey: 'Bhavnagar',
    onlinePct: '96.8% ONLINE',
    camerasCount: '740',
    rawCount: 740,
    hubName: 'Hub: Bhavnagar District Control',
    lat: 21.7645,
    lng: 72.1519,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Alang Ship Recycling Yard', count: 380, lat: 21.4100, lng: 72.1800, type: 'Coastal Maritime' },
      { sector: 'Bhavnagar City Command', count: 360, lat: 21.7600, lng: 72.1500, type: 'Urban Command' }
    ]
  },
  {
    name: 'Jamnagar',
    districtKey: 'Jamnagar',
    onlinePct: '98.1% ONLINE',
    camerasCount: '620',
    rawCount: 620,
    hubName: 'Hub: Jamnagar Police HQ',
    lat: 22.4707,
    lng: 70.0577,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Moti Khavdi Refinery Complex', count: 350, lat: 22.4200, lng: 69.8500, type: 'Energy Refinery' },
      { sector: 'Jamnagar Municipal Grid', count: 270, lat: 22.4700, lng: 70.0500, type: 'Urban Grid' }
    ]
  },
  {
    name: 'Junagadh',
    districtKey: 'Junagadh',
    onlinePct: '97.0% ONLINE',
    camerasCount: '540',
    rawCount: 540,
    hubName: 'Hub: Junagadh Range CCC',
    lat: 21.5222,
    lng: 70.4579,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Girnar Ropeway & Temple Grid', count: 280, lat: 21.5300, lng: 70.5000, type: 'Pilgrim Security' },
      { sector: 'Timbavadi Gate Checkpoint', count: 260, lat: 21.5200, lng: 70.4400, type: 'Transit Gate' }
    ]
  },
  {
    name: 'Surendranagar',
    districtKey: 'Surendranagar',
    onlinePct: '99.0% ONLINE',
    camerasCount: '480',
    rawCount: 480,
    hubName: 'Hub: Surendranagar SP Office',
    lat: 22.7224,
    lng: 71.6370,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Wadhwan Industrial Corridor', count: 280, lat: 22.7000, lng: 71.6700, type: 'Industrial GIDC' },
      { sector: 'Surendranagar SP Command', count: 200, lat: 22.7200, lng: 71.6300, type: 'Urban Command' }
    ]
  },
  {
    name: 'Mehsana',
    districtKey: 'Mehsana',
    onlinePct: '98.4% ONLINE',
    camerasCount: '410',
    rawCount: 410,
    hubName: 'Hub: Mehsana District Control',
    lat: 23.5880,
    lng: 72.3693,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Modhera Road Junction', count: 230, lat: 23.5900, lng: 72.3600, type: 'Highway ANPR' },
      { sector: 'Mehsana GIDC Sector', count: 180, lat: 23.5600, lng: 72.3800, type: 'Industrial' }
    ]
  },
  {
    name: 'Navsari',
    districtKey: 'Navsari',
    onlinePct: '99.1% ONLINE',
    camerasCount: '380',
    rawCount: 380,
    hubName: 'Hub: Navsari Police Control',
    lat: 20.9467,
    lng: 72.9520,
    zoom: 12,
    status: 'ONLINE',
    subBifurcation: [
      { sector: 'Bilimora Coastal Harbor', count: 210, lat: 20.7600, lng: 72.9500, type: 'Coastal Security' },
      { sector: 'Navsari City Grid', count: 170, lat: 20.9500, lng: 72.9300, type: 'Urban Command' }
    ]
  },
  { name: 'Anand', districtKey: 'Anand', onlinePct: '98.6% ONLINE', camerasCount: '520', rawCount: 520, hubName: 'Hub: Anand District Command', lat: 22.5645, lng: 72.9289, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Amul Dairy Sector', count: 320, lat: 22.5600, lng: 72.9200, type: 'Industrial' }, { sector: 'Anand Highway Gate', count: 200, lat: 22.5800, lng: 72.9400, type: 'ANPR' }] },
  { name: 'Bharuch', districtKey: 'Bharuch', onlinePct: '97.8% ONLINE', camerasCount: '610', rawCount: 610, hubName: 'Hub: Bharuch Industrial CCC', lat: 21.7051, lng: 72.9959, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Ankleshwar GIDC Grid', count: 380, lat: 21.6200, lng: 73.0000, type: 'Chemical GIDC' }, { sector: 'Narmada Bridge Checkpoint', count: 230, lat: 21.7100, lng: 72.9800, type: 'Bridge ANPR' }] },
  { name: 'Banaskantha', districtKey: 'Banaskantha', onlinePct: '96.2% ONLINE', camerasCount: '490', rawCount: 490, hubName: 'Hub: Palanpur SP Office', lat: 24.1724, lng: 72.4382, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Palanpur North Bypass', count: 290, lat: 24.1800, lng: 72.4400, type: 'Border Highway' }, { sector: 'Deesa Market Post', count: 200, lat: 24.2500, lng: 72.1800, type: 'Urban Post' }] },
  { name: 'Sabarkantha', districtKey: 'Sabarkantha', onlinePct: '97.4% ONLINE', camerasCount: '360', rawCount: 360, hubName: 'Hub: Himmatnagar Control', lat: 23.5979, lng: 72.9698, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Himmatnagar NH-8 Grid', count: 220, lat: 23.6000, lng: 72.9700, type: 'National Highway' }, { sector: 'Idar Fort Checkpoint', count: 140, lat: 23.8300, lng: 73.0000, type: 'Heritage Security' }] },
  { name: 'Patan', districtKey: 'Patan', onlinePct: '98.0% ONLINE', camerasCount: '320', rawCount: 320, hubName: 'Hub: Patan District Control', lat: 23.8493, lng: 72.1266, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Rani ki Vav Heritage Grid', count: 180, lat: 23.8500, lng: 72.1100, type: 'Heritage Tourism' }, { sector: 'Patan Cross Road ANPR', count: 140, lat: 23.8400, lng: 72.1300, type: 'Traffic ANPR' }] },
  { name: 'Amreli', districtKey: 'Amreli', onlinePct: '96.5% ONLINE', camerasCount: '290', rawCount: 290, hubName: 'Hub: Amreli SP Office', lat: 21.6032, lng: 71.2221, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Amreli Central Station', count: 170, lat: 21.6000, lng: 71.2200, type: 'Station Command' }, { sector: 'Pipavav Port Gate', count: 120, lat: 20.9100, lng: 71.5000, type: 'Marine Port' }] },
  { name: 'Porbandar', districtKey: 'Porbandar', onlinePct: '98.2% ONLINE', camerasCount: '310', rawCount: 310, hubName: 'Hub: Porbandar Coastal Command', lat: 21.6417, lng: 69.6293, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Coast Guard Jetee Gate', count: 190, lat: 21.6300, lng: 69.6100, type: 'Coast Guard' }, { sector: 'Kirti Mandir Zone', count: 120, lat: 21.6400, lng: 69.6300, type: 'Urban Zone' }] },
  { name: 'Gir Somnath', districtKey: 'Gir Somnath', onlinePct: '97.9% ONLINE', camerasCount: '420', rawCount: 420, hubName: 'Hub: Veraval Coastal HQ', lat: 20.9042, lng: 70.3649, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Somnath Temple Security Grid', count: 260, lat: 20.8880, lng: 70.4010, type: 'Pilgrim VIP' }, { sector: 'Veraval Fishing Harbor', count: 160, lat: 20.9000, lng: 70.3600, type: 'Marine Harbor' }] },
  { name: 'Botad', districtKey: 'Botad', onlinePct: '98.5% ONLINE', camerasCount: '230', rawCount: 230, hubName: 'Hub: Botad SP Office', lat: 22.1704, lng: 71.6687, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Salangpur Temple Corridor', count: 140, lat: 22.1400, lng: 71.7700, type: 'Pilgrim Grid' }, { sector: 'Botad Town Circle', count: 90, lat: 22.1700, lng: 71.6600, type: 'Town Circle' }] },
  { name: 'Morbi', districtKey: 'Morbi', onlinePct: '97.1% ONLINE', camerasCount: '450', rawCount: 450, hubName: 'Hub: Morbi Ceramic Grid CCC', lat: 22.8173, lng: 70.8370, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Ceramic Industrial Zone', count: 280, lat: 22.8200, lng: 70.8500, type: 'Industrial GIDC' }, { sector: 'Morbi Bypass Bridge', count: 170, lat: 22.8000, lng: 70.8200, type: 'Bridge ANPR' }] },
  { name: 'Devbhumi Dwarka', districtKey: 'Devbhumi Dwarka', onlinePct: '98.8% ONLINE', camerasCount: '280', rawCount: 280, hubName: 'Hub: Dwarka Pilgrim Security', lat: 22.2394, lng: 68.9678, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Dwarkadhish Temple Security', count: 180, lat: 22.2380, lng: 68.9680, type: 'Pilgrim Command' }, { sector: 'Okha Jetty Marine Gate', count: 100, lat: 22.4600, lng: 69.0700, type: 'Marine Gate' }] },
  { name: 'Panchmahal', districtKey: 'Panchmahal', onlinePct: '96.9% ONLINE', camerasCount: '340', rawCount: 340, hubName: 'Hub: Godhra Control Room', lat: 22.7780, lng: 73.6143, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Godhra Junction Checkpoint', count: 200, lat: 22.7800, lng: 73.6100, type: 'Junction Post' }, { sector: 'Champaner Heritage Gate', count: 140, lat: 22.4800, lng: 73.5300, type: 'UNESCO Gate' }] },
  { name: 'Dahod', districtKey: 'Dahod', onlinePct: '95.8% ONLINE', camerasCount: '310', rawCount: 310, hubName: 'Hub: Dahod Tribal Border HQ', lat: 22.8347, lng: 74.2565, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'MP Interstate Border Gate', count: 190, lat: 22.8400, lng: 74.3000, type: 'Interstate Border' }, { sector: 'Dahod City Station', count: 120, lat: 22.8300, lng: 74.2500, type: 'Station Grid' }] },
  { name: 'Mahisagar', districtKey: 'Mahisagar', onlinePct: '97.2% ONLINE', camerasCount: '250', rawCount: 250, hubName: 'Hub: Lunawada Control', lat: 23.1319, lng: 73.6143, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Lunawada Town Circle', count: 150, lat: 23.1300, lng: 73.6100, type: 'Town Circle' }, { sector: 'Kadana Dam Perimeter', count: 100, lat: 23.3000, lng: 73.8300, type: 'Dam Perimeter' }] },
  { name: 'Chhota Udepur', districtKey: 'Chhota Udepur', onlinePct: '96.0% ONLINE', camerasCount: '210', rawCount: 210, hubName: 'Hub: Chhota Udepur SP Office', lat: 22.3080, lng: 74.0150, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Bodeli Market Corridor', count: 130, lat: 22.2600, lng: 73.7200, type: 'Market Corridor' }, { sector: 'Interstate Border Post', count: 80, lat: 22.3100, lng: 74.0500, type: 'Border Checkpoint' }] },
  { name: 'Narmada', districtKey: 'Narmada', onlinePct: '99.4% ONLINE', camerasCount: '260', rawCount: 260, hubName: 'Hub: Rajpipla SOU CCC', lat: 21.8704, lng: 73.5026, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Statue of Unity VIP Campus', count: 180, lat: 21.8380, lng: 73.7190, type: 'VIP Tourism' }, { sector: 'Rajpipla Town Control', count: 80, lat: 21.8700, lng: 73.5000, type: 'Town Control' }] },
  { name: 'Tapi', districtKey: 'Tapi', onlinePct: '96.6% ONLINE', camerasCount: '240', rawCount: 240, hubName: 'Hub: Vyara SP Office', lat: 21.1147, lng: 73.3934, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Songadh Highway Border Post', count: 150, lat: 21.1600, lng: 73.6000, type: 'Highway Border' }, { sector: 'Vyara Municipal Circle', count: 90, lat: 21.1100, lng: 73.3900, type: 'Urban Circle' }] },
  { name: 'Dang', districtKey: 'Dang', onlinePct: '95.2% ONLINE', camerasCount: '180', rawCount: 180, hubName: 'Hub: Ahwa Forest Post', lat: 20.7534, lng: 73.6853, zoom: 12, status: 'DEGRADED', subBifurcation: [{ sector: 'Saputara Hill Station Gate', count: 110, lat: 20.5800, lng: 73.7500, type: 'Hill Station' }, { sector: 'Ahwa Headquarters Corridor', count: 70, lat: 20.7500, lng: 73.6800, type: 'Forest Command' }] },
  { name: 'Valsad', districtKey: 'Valsad', onlinePct: '98.7% ONLINE', camerasCount: '390', rawCount: 390, hubName: 'Hub: Valsad Coastal Control', lat: 20.5992, lng: 72.9342, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Vapi Industrial GIDC', count: 240, lat: 20.3700, lng: 72.9000, type: 'Heavy GIDC' }, { sector: 'Valsad Highway Toll', count: 150, lat: 20.6000, lng: 72.9300, type: 'Toll Checkpoint' }] },
  { name: 'Aravalli', districtKey: 'Aravalli', onlinePct: '97.3% ONLINE', camerasCount: '220', rawCount: 220, hubName: 'Hub: Modasa Control Room', lat: 23.4647, lng: 73.3005, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Shamlaji Border Checkpoint', count: 140, lat: 23.6800, lng: 73.4300, type: 'Pilgrim Border' }, { sector: 'Modasa Town Grid', count: 80, lat: 23.4600, lng: 73.3000, type: 'Town Grid' }] },
  { name: 'Kheda', districtKey: 'Kheda', onlinePct: '98.3% ONLINE', camerasCount: '430', rawCount: 430, hubName: 'Hub: Nadiad SP Office', lat: 22.6916, lng: 72.8634, zoom: 12, status: 'ONLINE', subBifurcation: [{ sector: 'Nadiad National Highway Grid', count: 260, lat: 22.6900, lng: 72.8600, type: 'NH-8 Grid' }, { sector: 'Dakora Temple Security', count: 170, lat: 22.7500, lng: 73.1500, type: 'Pilgrim Security' }] },
];

// Basemap Provider URLs
const TILE_LAYERS = {
  googleHybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite + Road Overlay | Gujarat Police GIS',
    name: 'Google Maps Satellite Hybrid 🛰️',
  },
  googleSat: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite Imagery | Gujarat Police GIS',
    name: 'Google Maps Satellite (Pure)',
  },
  googleStreets: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Vector | Gujarat Police GIS',
    name: 'Google Maps Vector Streets',
  },
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Gujarat Police GIS',
    name: 'OpenStreetMap Standard',
  },
  esriDark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | Gujarat Police GIS',
    name: 'Esri Dark Vector',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS | Gujarat GIS',
    name: 'Esri World Satellite',
  },
};

export const CctvGisView: React.FC<CctvGisViewProps> = ({
  cameras,
  departments,
  onSelectCamera,
  selectedDistrictFilter = 'ALL',
  selectedDeptFilter = 'ALL',
  selectedStatusFilter = 'ALL',
}) => {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(cameras[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(selectedDeptFilter);
  const [selectedDistrict, setSelectedDistrict] = useState(selectedDistrictFilter);
  const [selectedStatus, setSelectedStatus] = useState(selectedStatusFilter);
  const [activeTileLayerKey, setActiveTileLayerKey] = useState<keyof typeof TILE_LAYERS>('googleHybrid');
  const [isLayerDrawerOpen, setIsLayerDrawerOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Dynamic search navigation effect: Auto-flyTo on search query & reset when cleared
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!searchQuery.trim()) {
      // When search query is cleared, automatically reset district to 'ALL' and fly back to Statewide Gujarat View!
      setSelectedDistrict('ALL');
      mapInstanceRef.current.flyTo([22.45, 71.85], 8, { duration: 1.2 });
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const matchedDist = GUJARAT_33_DISTRICTS.find(d => 
      d.name.toLowerCase().includes(q) || 
      d.districtKey.toLowerCase().includes(q)
    );

    if (matchedDist) {
      setSelectedDistrict(matchedDist.districtKey);
      mapInstanceRef.current.flyTo([matchedDist.lat, matchedDist.lng], matchedDist.zoom, { duration: 1.2 });
    }
  }, [searchQuery]);

  // Active district selected object
  const activeDistrictObj = React.useMemo(() => {
    return GUJARAT_33_DISTRICTS.map(dist => {
      const distCams = cameras.filter(c => 
        (c.district && c.district.toLowerCase() === dist.districtKey.toLowerCase()) ||
        (c.city && c.city.toLowerCase() === dist.districtKey.toLowerCase()) ||
        (c.district && c.district.toLowerCase() === dist.name.toLowerCase()) ||
        (c.city && c.city.toLowerCase() === dist.name.toLowerCase())
      );

      const realCount = distCams.length;
      const onlineCams = distCams.filter(c => c.healthStatus === 'ONLINE').length;
      const onlinePctStr = realCount > 0 ? `${Math.round((onlineCams / realCount) * 100)}% ONLINE` : '100% ONLINE';

      const subBifurcation = realCount > 0
        ? distCams.map((cam, idx) => ({
            sector: cam.name || cam.address || `${dist.name} Node #${idx + 1}`,
            count: 1,
            lat: cam.latitude,
            lng: cam.longitude,
            type: cam.type || 'ANPR Stream'
          }))
        : dist.subBifurcation.map(s => ({ ...s, count: 0 }));

      return {
        ...dist,
        rawCount: realCount,
        camerasCount: realCount.toLocaleString(),
        onlinePct: onlinePctStr,
        status: (realCount > 0 && onlineCams === 0 ? 'OFFLINE' : 'ONLINE') as 'ONLINE' | 'DEGRADED' | 'OFFLINE',
        subBifurcation
      };
    }).find(d => d.districtKey === selectedDistrict);
  }, [cameras, selectedDistrict]);

  const processedDistricts = React.useMemo(() => {
    return GUJARAT_33_DISTRICTS.map(dist => {
      const distCams = cameras.filter(c => 
        (c.district && c.district.toLowerCase() === dist.districtKey.toLowerCase()) ||
        (c.city && c.city.toLowerCase() === dist.districtKey.toLowerCase()) ||
        (c.district && c.district.toLowerCase() === dist.name.toLowerCase()) ||
        (c.city && c.city.toLowerCase() === dist.name.toLowerCase())
      );

      const realCount = distCams.length;
      const onlineCams = distCams.filter(c => c.healthStatus === 'ONLINE').length;
      const onlinePctStr = realCount > 0 ? `${Math.round((onlineCams / realCount) * 100)}% ONLINE` : '100% ONLINE';

      const subBifurcation = realCount > 0
        ? distCams.map((cam, idx) => ({
            sector: cam.name || cam.address || `${dist.name} Node #${idx + 1}`,
            count: 1,
            lat: cam.latitude,
            lng: cam.longitude,
            type: cam.type || 'ANPR Stream'
          }))
        : dist.subBifurcation.map(s => ({ ...s, count: 0 }));

      return {
        ...dist,
        rawCount: realCount,
        camerasCount: realCount.toLocaleString(),
        onlinePct: onlinePctStr,
        status: (realCount > 0 && onlineCams === 0 ? 'OFFLINE' : 'ONLINE') as 'ONLINE' | 'DEGRADED' | 'OFFLINE',
        subBifurcation
      };
    });
  }, [cameras]);

  // Only districts with > 0 cameras
  const activeDistrictCards = React.useMemo(() => {
    return processedDistricts.filter(d => d.rawCount > 0);
  }, [processedDistricts]);

  // Filtered cameras dataset
  const activeCameras = React.useMemo(() => {
    return cameras.filter(cam => {
      if (cam.lifecycle === 'ARCHIVED') return false;
      if (selectedDept !== 'ALL' && cam.departmentId !== selectedDept) return false;
      if (selectedDistrict !== 'ALL' && cam.district !== selectedDistrict && cam.city !== selectedDistrict) return false;
      if (selectedStatus !== 'ALL' && cam.healthStatus !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          cam.cameraCode.toLowerCase().includes(q) ||
          cam.name.toLowerCase().includes(q) ||
          (cam.district && cam.district.toLowerCase().includes(q)) ||
          (cam.city && cam.city.toLowerCase().includes(q)) ||
          (cam.departmentName && cam.departmentName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [cameras, selectedDept, selectedDistrict, selectedStatus, searchQuery]);

  // Helper for rendering dynamic District Main Pill Marker
  const createDistrictPillIcon = (dist: DistrictHubCard, isSelected: boolean) => {
    const colorHex = dist.status === 'ONLINE' ? '#10B981' : dist.status === 'DEGRADED' ? '#F59E0B' : '#EF4444';
    const border = isSelected ? '2.5px solid #0052CC' : '1.5px solid rgba(255,255,255,0.9)';
    const bg = isSelected ? '#0052CC' : 'rgba(15, 23, 42, 0.94)';

    const htmlStr = `
      <div style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: ${bg};
        color: #FFFFFF;
        padding: 4px 9px;
        border-radius: 9999px;
        border: ${border};
        box-shadow: 0 4px 12px rgba(0,0,0,0.45);
        font-family: 'Plus Jakarta Sans', Inter, sans-serif;
        white-space: nowrap;
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${colorHex}; display: inline-block;"></span>
        <span style="font-weight: 800; font-size: 11px; tracking: -0.01em;">${dist.name}</span>
        <span style="background: rgba(255,255,255,0.22); font-weight: 800; font-size: 10px; padding: 1px 6px; border-radius: 4px; font-family: monospace;">${dist.camerasCount} Cams</span>
      </div>
    `;

    return L.divIcon({
      html: htmlStr,
      className: 'custom-district-pill-marker',
      iconSize: [130, 28],
      iconAnchor: [65, 14],
    });
  };

  // Helper for rendering Sub-Hub Bifurcation Sector Markers
  const createSectorBifurcationIcon = (sub: { sector: string; count: number; type: string }) => {
    const htmlStr = `
      <div style="
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(0, 82, 204, 0.92);
        color: #FFFFFF;
        padding: 3px 7px;
        border-radius: 6px;
        border: 1.5px solid #60A5FA;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        font-family: 'Plus Jakarta Sans', Inter, sans-serif;
        white-space: nowrap;
        cursor: pointer;
      ">
        <span style="font-weight: 700; font-size: 10px; color: #E0F2FE;">📍 ${sub.sector}</span>
        <span style="background: #1E40AF; font-weight: 900; font-size: 9.5px; padding: 1px 4px; border-radius: 3px; font-family: monospace; color: #60A5FA;">${sub.count} Cams</span>
      </div>
    `;

    return L.divIcon({
      html: htmlStr,
      className: 'custom-subsector-pill-marker',
      iconSize: [140, 24],
      iconAnchor: [70, 12],
    });
  };

  // Helper for camera node marker icon
  const createCustomMarkerIcon = (status: CameraHealthStatus, isSelected: boolean) => {
    let colorHex = '#10B981';
    if (status === 'DEGRADED') colorHex = '#F59E0B';
    if (status === 'OFFLINE') colorHex = '#EF4444';
    if (status === 'UNKNOWN') colorHex = '#6B7280';

    const size = isSelected ? 28 : 22;
    const border = isSelected ? '3px solid #0052CC' : '2px solid #FFFFFF';
    const shadow = isSelected ? 'box-shadow: 0 0 12px rgba(0, 82, 204, 0.8); z-index: 1000;' : 'box-shadow: 0 2px 5px rgba(0,0,0,0.4);';

    const htmlStr = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background-color: ${colorHex};
        border: ${border};
        ${shadow}
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
        transition: transform 0.2s ease;
      ">
        ●
      </div>
    `;

    return L.divIcon({
      html: htmlStr,
      className: 'custom-gis-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.45, 71.85],
      zoom: 8,
      zoomControl: false,
    });

    const activeConfig = TILE_LAYERS[activeTileLayerKey];
    const initialTileLayer = L.tileLayer(activeConfig.url, {
      attribution: activeConfig.attribution,
      maxZoom: 20,
    }).addTo(map);

    tileLayerRef.current = initialTileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when key changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const config = TILE_LAYERS[activeTileLayerKey];
    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 20,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [activeTileLayerKey]);

  // Render Map Markers (District Hub Markers + Sub-Hub Bifurcations + Camera Node Markers)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const renderMapMarkers = () => {
      if (!mapInstanceRef.current || !markersGroupRef.current) return;
      markersGroupRef.current.clearLayers();

      // Render Active District Main Pill Markers (rawCount > 0)
      activeDistrictCards.forEach(dist => {
        if (selectedDistrict !== 'ALL' && dist.districtKey !== selectedDistrict) return;

        const isSelected = selectedDistrict === dist.districtKey;
        const icon = createDistrictPillIcon(dist, isSelected);
        const marker = L.marker([dist.lat, dist.lng], { icon });

        const popupContent = `
          <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:12px;padding:4px 2px;min-width:220px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="font-weight:800;color:#0F172A;font-size:13px;">${dist.name} District</div>
              <span style="background:#DCFCE7;color:#166534;font-weight:800;font-size:9px;padding:2px 6px;border-radius:9999px;">
                ${dist.onlinePct}
              </span>
            </div>
            <div style="color:#0052CC;font-weight:800;font-size:13px;margin-top:3px;">${dist.camerasCount} Active CCTV Cameras</div>
            <div style="color:#64748B;font-size:10.5px;margin-top:2px;">${dist.hubName}</div>
          </div>
        `;

        marker.bindPopup(L.popup({ closeButton: false, offset: [0, -10] }).setContent(popupContent));
        marker.on('mouseover', () => marker.openPopup());
        marker.on('mouseout', () => marker.closePopup());
        marker.on('click', () => {
          setSelectedDistrict(dist.districtKey);
          mapInstanceRef.current?.flyTo([dist.lat, dist.lng], dist.zoom, { duration: 1.2 });
        });

        markersGroupRef.current?.addLayer(marker);

        // If this district is selected OR single district filter active, render all Sector Sub-Bifurcation markers!
        if (selectedDistrict === dist.districtKey && dist.subBifurcation) {
          dist.subBifurcation.forEach(sub => {
            const subIcon = createSectorBifurcationIcon(sub);
            const subMarker = L.marker([sub.lat, sub.lng], { icon: subIcon });

            const subPopupContent = `
              <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:12px;padding:4px 2px;min-width:210px;">
                <div style="font-weight:800;color:#0052CC;font-size:12.5px;">📍 ${sub.sector}</div>
                <div style="color:#64748B;font-size:10px;font-weight:600;margin-top:1px;">Category: ${sub.type} (${dist.name})</div>
                <hr style="border:none;border-top:1px solid #E2E8F0;margin:5px 0;"/>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="color:#334155;font-weight:600;">Sector Camera Count:</span>
                  <strong style="color:#0052CC;font-size:12px;font-family:monospace;">${sub.count} Cameras</strong>
                </div>
              </div>
            `;

            subMarker.bindPopup(L.popup({ closeButton: false, offset: [0, -10] }).setContent(subPopupContent));
            subMarker.on('mouseover', () => subMarker.openPopup());
            subMarker.on('mouseout', () => subMarker.closePopup());
            subMarker.on('click', () => {
              mapInstanceRef.current?.flyTo([sub.lat, sub.lng], 13, { duration: 1.0 });
            });

            markersGroupRef.current?.addLayer(subMarker);
          });
        }
      });

      // Also render granular individual camera node markers
      const bounds = mapInstanceRef.current.getBounds();
      const visibleCameras = activeCameras.filter(cam =>
        bounds.contains([cam.latitude, cam.longitude])
      ).slice(0, 500);

      visibleCameras.forEach(cam => {
        const isSelected = selectedCamera?.cameraUuid === cam.cameraUuid;
        const icon = createCustomMarkerIcon(cam.healthStatus, isSelected);

        const marker = L.marker([cam.latitude, cam.longitude], { icon });

        const statusBg = cam.healthStatus === 'ONLINE' ? '#DCFCE7' : cam.healthStatus === 'DEGRADED' ? '#FEF3C7' : '#FEE2E2';
        const statusColor = cam.healthStatus === 'ONLINE' ? '#166534' : cam.healthStatus === 'DEGRADED' ? '#92400E' : '#991B1B';

        const popupContent = `
          <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:12px;padding:4px 2px;min-width:210px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="font-weight:800;color:#0F172A;font-size:12.5px;">${cam.cameraCode}</div>
              <span style="background:${statusBg};color:${statusColor};font-weight:800;font-size:9px;padding:2px 6px;border-radius:9999px;">
                ● ${cam.healthStatus}
              </span>
            </div>
            <div style="color:#334155;font-weight:600;margin-top:2px;">${cam.name}</div>
            <div style="color:#64748B;font-size:10.5px;margin-top:1px;">${cam.address}</div>
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:6px 0;"/>
            <div style="color:#64748B;font-size:10px;">
              <span style="font-weight:600;">Dept:</span> ${cam.departmentName}
            </div>
            <div style="margin-top:3px;color:#64748B;font-size:10px;">
              <span style="font-weight:600;">VMS:</span> ${cam.vmsPlatformName}
            </div>
          </div>
        `;

        marker.bindPopup(L.popup({ closeButton: false, offset: [0, -10] }).setContent(popupContent));
        marker.on('mouseover', () => marker.openPopup());
        marker.on('mouseout', () => marker.closePopup());
        marker.on('click', () => setSelectedCamera(cam));

        markersGroupRef.current?.addLayer(marker);
      });
    };

    renderMapMarkers();

    mapInstanceRef.current.on('moveend', renderMapMarkers);
    mapInstanceRef.current.on('zoomend', renderMapMarkers);

    return () => {
      mapInstanceRef.current?.off('moveend', renderMapMarkers);
      mapInstanceRef.current?.off('zoomend', renderMapMarkers);
    };
  }, [activeCameras, selectedCamera, selectedDistrict, activeDistrictCards]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleSelectDistrictHub = (card: DistrictHubCard) => {
    const targetDist = card.districtKey;
    setSelectedDistrict(prev => prev === targetDist ? 'ALL' : targetDist);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([card.lat, card.lng], card.zoom, { duration: 1.2 });
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedDistrict('ALL');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([22.45, 71.85], 8, { duration: 1.2 });
    }
  };

  const totalStatewideCamerasCount = cameras.length.toLocaleString();
  const onlineCount = cameras.filter(c => c.healthStatus === 'ONLINE').length.toLocaleString();
  const degradedCount = cameras.filter(c => c.healthStatus === 'DEGRADED').length.toLocaleString();
  const offlineCount = cameras.filter(c => c.healthStatus === 'OFFLINE').length.toLocaleString();

  return (
    <div className="space-y-4 animate-in fade-in duration-150 select-none">
      
      {/* Top GIS Title & Operational Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#0052CC] border border-blue-200 flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>Google Maps Satellite & Hybrid Tiles Active</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">PostGIS Spatial Vector Layer • {activeDistrictCards.length} Active Districts</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Statewide CCTV GIS Viewport — {totalStatewideCamerasCount} Active Cameras
          </h1>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-medium text-slate-600 bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
            <span>{activeDistrictCards.length} Active District Hubs</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Online ({onlineCount})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Degraded ({degradedCount})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Offline ({offlineCount})</span>
          </div>
        </div>
      </div>

      {/* Active District Command Hub Cards Grid (Zero camera cards removed) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#0052CC]" />
            <span>Active Gujarat District Command Hubs ({activeDistrictCards.length} Hubs • {totalStatewideCamerasCount} Total Cameras)</span>
          </h2>
          {selectedDistrict !== 'ALL' && (
            <button
              onClick={handleClearSearch}
              className="text-xs font-bold text-[#0052CC] hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Show All Active Districts</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {activeDistrictCards.map(card => {
            const isSelected = selectedDistrict === card.districtKey;

            return (
              <div
                key={card.name}
                onClick={() => handleSelectDistrictHub(card)}
                className={`bg-white rounded-xl p-3 border transition-all duration-150 cursor-pointer shadow-2xs flex flex-col justify-between group ${
                  isSelected ? 'border-[#0052CC] ring-2 ring-blue-100 shadow-md bg-blue-50/30' : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight group-hover:text-[#0052CC] transition truncate pr-1">
                    {card.name}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {card.onlinePct}
                  </span>
                </div>

                <div className="mt-2 space-y-0.5">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center">
                    <CameraIcon className="w-3 h-3 text-[#0052CC] mr-1" />
                    <strong className="text-slate-900 font-extrabold mr-1">{card.camerasCount}</strong>
                    <span>Cameras</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {card.hubName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* District Camera Bifurcation Breakdown Drawer (Active when a district is selected, e.g. Kutch) */}
      {activeDistrictObj && activeDistrictObj.subBifurcation && selectedDistrict !== 'ALL' && (
        <div className="bg-[#0B1E3B] text-white p-4 rounded-xl border border-blue-900 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-blue-800/70 pb-2.5">
            <div className="flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-extrabold tracking-tight">
                {activeDistrictObj.name} District — Camera Sector Bifurcation ({activeDistrictObj.camerasCount} Total Cameras)
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-[11px] font-mono bg-blue-900/80 text-blue-200 px-2.5 py-0.5 rounded border border-blue-700 font-bold">
                {activeDistrictObj.subBifurcation.length} Sub-Sectors Mapped
              </span>
              <button
                onClick={handleClearSearch}
                className="text-xs font-bold text-slate-300 hover:text-white bg-blue-950 px-2 py-0.5 rounded border border-blue-800 transition cursor-pointer flex items-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Filter</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeDistrictObj.subBifurcation.map(sub => (
              <div
                key={sub.sector}
                onClick={() => mapInstanceRef.current?.flyTo([sub.lat, sub.lng], 13, { duration: 1.0 })}
                className="bg-[#122A4E] hover:bg-[#1A3865] p-3 rounded-lg border border-blue-800/80 transition cursor-pointer flex flex-col justify-between group shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-blue-300 uppercase tracking-wider">{sub.type}</span>
                    <Navigation className="w-3 h-3 text-blue-400 group-hover:text-white transition" />
                  </div>
                  <h4 className="text-xs font-bold text-white mt-1 group-hover:text-blue-200 transition">{sub.sector}</h4>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-blue-900/60 pt-2">
                  <span className="text-[10.5px] text-slate-300">Camera Deployment:</span>
                  <span className="text-sm font-black font-mono text-emerald-400">{sub.count} Cams</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Interactive Leaflet Map & Inspector Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left 2 Cols: Leaflet Satellite Map Container */}
        <div className="lg:col-span-2 relative bg-slate-100 rounded-xl border border-slate-300 h-[600px] overflow-hidden shadow-inner flex flex-col">
          
          {/* Map Controls Floating Overlay */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
            <div className="bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-200 shadow-md flex items-center space-x-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 ml-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search district, e.g. kutch..."
                className="px-2 py-1 text-xs bg-transparent border-none focus:outline-hidden w-40 sm:w-52 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition mr-1"
                  title="Clear Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-white/95 backdrop-blur-xs px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 shadow-md text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white/95 backdrop-blur-xs px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 shadow-md text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">Health: All</option>
              <option value="ONLINE">Online Only</option>
              <option value="DEGRADED">Degraded Only</option>
              <option value="OFFLINE">Offline Only</option>
            </select>
          </div>

          {/* Right Floating Map Controls */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end space-y-1.5">
            <div className="bg-white/95 backdrop-blur-xs rounded-md border border-slate-200 shadow-md p-0.5 flex flex-col space-y-0.5 items-center w-7">
              <button
                title="Zoom In"
                onClick={handleZoomIn}
                className="p-1 rounded hover:bg-slate-100 text-slate-700 transition flex items-center justify-center cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <div className="w-4 h-px bg-slate-200" />
              <button
                title="Zoom Out"
                onClick={handleZoomOut}
                className="p-1 rounded hover:bg-slate-100 text-slate-700 transition flex items-center justify-center cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5 text-slate-700" />
              </button>
            </div>

            <button
              onClick={() => setIsLayerDrawerOpen(p => !p)}
              className="bg-white/95 backdrop-blur-xs px-2 py-1 rounded-md border border-slate-200 shadow-md text-[#0052CC] hover:bg-blue-50 transition flex items-center space-x-1.5 text-[11px] font-semibold cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#0052CC]" />
              <span>Satellite & Layers</span>
            </button>
          </div>

          {/* Tile Layer Selector Drawer */}
          {isLayerDrawerOpen && (
            <div className="absolute top-16 right-3 z-[1001] bg-white rounded-xl border border-slate-200 shadow-2xl p-3.5 w-64 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900">Basemap Layer Provider</span>
                <span className="text-[10px] bg-blue-100 text-[#0052CC] px-2 py-0.5 rounded font-bold">HD Satellite</span>
              </div>
              <div className="space-y-1.5">
                {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map(k => (
                  <button
                    key={k}
                    onClick={() => {
                      setActiveTileLayerKey(k);
                      setIsLayerDrawerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-semibold transition flex items-center justify-between ${
                      activeTileLayerKey === k ? 'bg-[#0052CC] text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{TILE_LAYERS[k].name}</span>
                    {activeTileLayerKey === k && <span className="text-[10px]">✓ Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leaflet Map Div */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Scale & EPSG Bar */}
          <div className="absolute bottom-2 left-3 z-[1000] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded text-[10px] font-mono text-slate-700 border border-slate-300 shadow-xs flex items-center space-x-2">
            <span>EPSG:4326</span>
            <span>•</span>
            <span className="font-bold text-[#0052CC]">{TILE_LAYERS[activeTileLayerKey].name}</span>
            <span>•</span>
            <span className="font-bold text-emerald-700">All 33 Districts Bifurcated</span>
          </div>

        </div>

        {/* Right Col: Selected Camera Node Specification Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
          {selectedCamera ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-[#0052CC] border border-blue-200">
                    Selected Node Inspector
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedCamera.healthStatus === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' :
                    selectedCamera.healthStatus === 'DEGRADED' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    ● {selectedCamera.healthStatus}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2 tracking-tight">{selectedCamera.cameraCode}</h3>
                <p className="text-xs text-slate-600 font-medium">{selectedCamera.name}</p>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">District / City:</span>
                  <span className="font-bold text-slate-900">{selectedCamera.district}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-bold text-slate-900">{selectedCamera.departmentName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">VMS Platform:</span>
                  <span className="font-bold text-[#0052CC]">{selectedCamera.vmsPlatformName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Manufacturer & Model:</span>
                  <span className="font-mono text-slate-800">{selectedCamera.manufacturer} {selectedCamera.model}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Coordinates:</span>
                  <span className="font-mono text-slate-900">{selectedCamera.latitude.toFixed(5)}, {selectedCamera.longitude.toFixed(5)}</span>
                </div>
              </div>

              <button
                onClick={() => onSelectCamera(selectedCamera)}
                className="w-full py-2.5 bg-[#0052CC] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Open Full Node Dossier & Live Stream</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Select a camera node on the satellite map to view details
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
