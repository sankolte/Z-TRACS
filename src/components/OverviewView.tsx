import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera } from '../types';
import { 
  Video, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  MapPin, 
  Activity, 
  TrendingUp, 
  Radio, 
  ArrowUpRight,
  Zap,
  Server
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateTab?: (tab: string) => void;
  onOpenLiveStream?: (camera: Camera) => void;
}

interface OverviewMapNode {
  id: string;
  name: string;
  category: string;
  district: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  totalCameras: number;
  aiCameras: number;
  vms: string;
  resolution: string;
  fps: number;
  lat: number;
  lng: number;
}

const OVERVIEW_MAP_NODES: OverviewMapNode[] = [
  { id: 'n-1', name: 'Surendranagar Hub', category: 'State Command Hub', district: 'Surendranagar', status: 'ONLINE', totalCameras: 1240, aiCameras: 840, vms: 'Sentinel Cloud Edge', resolution: '4K UHD', fps: 25, lat: 22.722, lng: 71.637 },
  { id: 'n-2', name: 'Wadhwan Sector', category: 'East Municipal Sector', district: 'Surendranagar', status: 'ONLINE', totalCameras: 480, aiCameras: 210, vms: 'Honeywell MAXPRO', resolution: '1080p FHD', fps: 30, lat: 22.701, lng: 71.678 },
  { id: 'n-3', name: 'Ratanpar Substation', category: 'North Substation Junction', district: 'Surendranagar', status: 'ONLINE', totalCameras: 320, aiCameras: 140, vms: 'Milestone XProtect', resolution: '1080p FHD', fps: 25, lat: 22.748, lng: 71.642 },
  { id: 'n-4', name: 'Godavari Checkpoint', category: 'Highway Checkpoint 17', district: 'Surendranagar', status: 'DEGRADED', totalCameras: 210, aiCameras: 95, vms: 'Dahua SmartVMS', resolution: '1080p FHD', fps: 15, lat: 22.730, lng: 71.550 },
  { id: 'n-5', name: 'Shekhpar Division', category: 'West Rural Division', district: 'Surendranagar', status: 'ONLINE', totalCameras: 180, aiCameras: 80, vms: 'Hikvision iVMS-4200', resolution: '1080p FHD', fps: 25, lat: 22.740, lng: 71.580 },
  { id: 'n-6', name: 'Gautamgadh Border', category: 'State Border Post 01', district: 'Surendranagar', status: 'OFFLINE', totalCameras: 150, aiCameras: 60, vms: 'Bosch BVMS', resolution: '720p HD', fps: 0, lat: 22.700, lng: 71.490 },
  { id: 'n-7', name: 'Kukda Toll Node', category: 'River Bridge Toll Node', district: 'Surendranagar', status: 'ONLINE', totalCameras: 290, aiCameras: 180, vms: 'Axis Camera Station', resolution: '4K UHD', fps: 30, lat: 22.670, lng: 71.540 },
  { id: 'n-8', name: 'Limali Transit Hub', category: 'Central Transit Hub', district: 'Surendranagar', status: 'DEGRADED', totalCameras: 160, aiCameras: 70, vms: 'Sentinel Cloud Edge', resolution: '1080p FHD', fps: 18, lat: 22.670, lng: 71.600 },
  { id: 'n-9', name: 'Malod Grid', category: 'Mid-District Surveillance', district: 'Surendranagar', status: 'ONLINE', totalCameras: 310, aiCameras: 190, vms: 'Honeywell MAXPRO', resolution: '4K UHD', fps: 25, lat: 22.660, lng: 71.635 },
  { id: 'n-10', name: 'Vaghela Corridor', category: 'South East Industrial Grid', district: 'Surendranagar', status: 'ONLINE', totalCameras: 240, aiCameras: 120, vms: 'Milestone XProtect', resolution: '1080p FHD', fps: 30, lat: 22.640, lng: 71.670 },
  { id: 'n-11', name: 'Munjpar Junction', category: 'South Junction Post', district: 'Surendranagar', status: 'OFFLINE', totalCameras: 190, aiCameras: 90, vms: 'Dahua SmartVMS', resolution: '1080p FHD', fps: 0, lat: 22.630, lng: 71.560 },
  { id: 'n-12', name: 'Jasapar Post', category: 'District Patrol Checkpoint', district: 'Surendranagar', status: 'ONLINE', totalCameras: 140, aiCameras: 65, vms: 'Hikvision iVMS-4200', resolution: '1080p FHD', fps: 25, lat: 22.605, lng: 71.535 },
  { id: 'n-13', name: 'Timba Toll Node', category: 'State Highway Toll Node 51', district: 'Surendranagar', status: 'ONLINE', totalCameras: 380, aiCameras: 260, vms: 'Sentinel Cloud Edge', resolution: '4K UHD', fps: 30, lat: 22.595, lng: 71.650 },
  { id: 'n-14', name: 'Gundiyala Station', category: 'South West Substation', district: 'Surendranagar', status: 'DEGRADED', totalCameras: 110, aiCameras: 40, vms: 'Bosch BVMS', resolution: '720p HD', fps: 12, lat: 22.585, lng: 71.625 }
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateTab,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Initialize Leaflet map centered on Surendranagar district region
    const map = L.map(mapContainerRef.current, {
      center: [22.670, 71.600],
      zoom: 11,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | Gujarat Police GIS',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);

    // Add nodes to Leaflet map with native hover popups (Zero buffering / zero flickering)
    OVERVIEW_MAP_NODES.forEach(node => {
      let colorHex = '#22C55E'; // Online
      if (node.status === 'DEGRADED') colorHex = '#F59E0B';
      if (node.status === 'OFFLINE') colorHex = '#EF4444';

      const iconHtml = `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        ">
          <div style="
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: ${colorHex}30;
            animation: pulse 2s infinite;
          "></div>
          <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: ${colorHex};
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 10;
          "></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-overview-node-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([node.lat, node.lng], { icon: customIcon });

      const statusBg = node.status === 'ONLINE' ? '#DCFCE7' : node.status === 'DEGRADED' ? '#FEF3C7' : '#FEE2E2';
      const statusColor = node.status === 'ONLINE' ? '#166534' : node.status === 'DEGRADED' ? '#92400E' : '#991B1B';

      const popupContent = `
        <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:12px;padding:4px 2px;min-width:220px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-weight:800;color:#0F172A;font-size:13px;">${node.name}</div>
              <div style="color:#64748B;font-size:10px;font-weight:500;">${node.category}</div>
            </div>
            <span style="background:${statusBg};color:${statusColor};font-weight:800;font-size:9.5px;padding:2px 7px;border-radius:9999px;border:1px solid ${statusColor}40;">
              ● ${node.status}
            </span>
          </div>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:6px 0;"/>
          <div style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:#334155;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748B;">CCTV Cameras:</span>
              <strong style="color:#0F172A;">${node.totalCameras} Units</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748B;">AI Analytics:</span>
              <strong style="color:#0052CC;">${node.aiCameras} Enabled</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748B;">VMS Platform:</span>
              <span style="font-weight:600;color:#1E293B;">${node.vms}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:2px;padding-top:4px;border-top:1px stroke #F1F5F9;font-size:10px;color:#64748B;">
              <span>Telemetry:</span>
              <span style="font-family:monospace;font-weight:700;">${node.fps} FPS &bull; ${node.resolution}</span>
            </div>
          </div>
        </div>
      `;

      const popup = L.popup({ closeButton: false, offset: [0, -10], className: 'ztrac-hover-popup' }).setContent(popupContent);
      marker.bindPopup(popup);

      // Open popup on hover, close on mouse-out (Native Leaflet - Zero Lag / Zero Buffering)
      marker.on('mouseover', function() { marker.openPopup(); });
      marker.on('mouseout',  function() { marker.closePopup(); });

      markersGroup.addLayer(marker);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      
      {/* 1. Breadcrumb & Page Heading */}
      <div>
        <div className="text-xs text-slate-500 font-medium">
          <span>Gujarat Police</span>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="text-slate-600">Z-TRACS</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Central Management Suite
        </h1>
      </div>

      {/* 2. Top 5 KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* TOTAL REGISTERED */}
        <div className="bg-[#EBF3FE] border border-[#D5E5FA] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">
              TOTAL REGISTERED
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#DDE9FA] flex items-center justify-center text-[#0052CC]">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              31 Live Feeds
            </div>
            <div className="text-[11px] font-semibold text-[#16A34A] mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              <span>100% Sentinel Stream Verified</span>
            </div>
          </div>
        </div>

        {/* ONLINE */}
        <div className="bg-[#EEF5FE] border border-[#DCE8F8] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">
              ONLINE
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              31 Feeds
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#22C55E] h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        {/* DEGRADED */}
        <div className="bg-[#F8F6FA] border border-[#E9E4F0] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">
              DEGRADED
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              0
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#F59E0B] h-full rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>

        {/* OFFLINE */}
        <div className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">
              OFFLINE
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
              0
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-[#EF4444] h-full rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>

        {/* SYSTEM HEALTH */}
        <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">
              SYSTEM HEALTH
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#15803D] font-sans tracking-tight">
              100.0%
            </div>
            <div className="text-[11px] font-semibold text-[#15803D] mt-1">
              <span>Nominal Live Telemetry</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Filter Pills Bar */}
      <div className="flex flex-wrap items-center gap-2.5 py-1">
        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Building2 className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>Departments: </span>
          <strong className="text-slate-900 font-bold ml-1">5 Active</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <MapPin className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>Districts Covered: </span>
          <strong className="text-slate-900 font-bold ml-1">9 Live Feed Districts</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Server className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>VMS Systems Linked: </span>
          <strong className="text-slate-900 font-bold ml-1">3 Live VMS Clusters</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Zap className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>Cameras with AI: </span>
          <strong className="text-slate-900 font-bold ml-1">31 Live Sentinel Feeds</strong>
        </div>
      </div>

      {/* 4. Middle Section: Two Columns (Leaflet Map & Distribution Overview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Interactive Leaflet Statewide Coverage Map (Col-8) */}
        <div className="lg:col-span-8 relative h-[380px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs group">
          
          {/* Leaflet Map Div Container */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Legend Box (Top Left) */}
          <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl p-3 border border-slate-200/90 shadow-md">
            <div className="text-xs font-bold text-slate-900 mb-2">
              Statewide Coverage
            </div>
            <div className="space-y-1.5 text-[11px] font-medium text-slate-700">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
                <span>Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
                <span>Offline</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                <span>Degraded</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right: Distribution Overview Card (Col-4) */}
        <div className="lg:col-span-4 bg-[#EDF3F9] border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  DISTRICT DISTRIBUTION
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Live Feed Camera Distribution</p>
              </div>
              <span className="text-[10px] font-bold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                31 Live Nodes
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { name: 'Navsari Coastal & Highway', count: '7 Live Feeds', pct: 100, color: '#0052CC' },
                { name: 'Ahmedabad Urban Corridor', count: '5 Live Feeds', pct: 72, color: '#0052CC' },
                { name: 'Junagadh Municipal Sector', count: '5 Live Feeds', pct: 72, color: '#0052CC' },
                { name: 'Gandhinagar Capital Grid', count: '4 Live Feeds', pct: 57, color: '#0052CC' },
                { name: 'Patan Dethali Corridor', count: '3 Live Feeds', pct: 43, color: '#0052CC' },
              ].map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{item.name}</span>
                    <span className="text-slate-900 font-bold">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/70 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Model 3 Federation Active</span>
            <button 
              onClick={() => onNavigateTab && onNavigateTab('districts')}
              className="text-xs font-bold text-[#0052CC] hover:underline flex items-center"
            >
              <span>View All 33 Districts</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
