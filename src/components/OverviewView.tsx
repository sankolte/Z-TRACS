import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, Department, District, HealthEvent, AuditLog } from '../types';
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
  Server,
  Car,
  UserCheck,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

interface OverviewViewProps {
  cameras?: Camera[];
  departments?: Department[];
  districts?: District[];
  healthEvents?: HealthEvent[];
  auditLogs?: AuditLog[];
  currentLang?: string;
  onSelectCamera?: (camera: Camera) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenLiveStream?: (camera: Camera) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  cameras = [],
  departments = [],
  districts = [],
  healthEvents = [],
  onSelectCamera,
  onNavigateTab,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Filter for Camera Health & AI Model Deployment Matrix
  const [modelFilter, setModelFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'ANPR' | 'FRS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCamCode, setSelectedCamCode] = useState<string | null>(null);

  // Helper to determine active AI models for a camera (strictly ANPR and FRS only)
  const getCameraModels = (cam: Camera) => {
    const models: Array<{ id: 'anpr' | 'frs'; name: string; tag: string }> = [];

    const hasAnpr = Boolean(
      cam.capabilities?.anpr || 
      cam.type === 'ANPR' ||
      (cam.name && (cam.name.toLowerCase().includes('bridge') || cam.name.toLowerCase().includes('road') || cam.name.toLowerCase().includes('junction') || cam.name.toLowerCase().includes('highway') || cam.name.toLowerCase().includes('toll') || cam.name.toLowerCase().includes('circle'))) ||
      (cam.cameraCode && ['CAM-001', 'CAM-002', 'CAM-003', 'CAM-004', 'CAM-005', 'CAM-008', 'CAM-010', 'CAM-012', 'CAM-014', 'CAM-016', 'CAM-021', 'CAM-026', 'CAM-033', 'CAM-19717', 'CAM-20182'].includes(cam.cameraCode))
    );

    const hasFrs = Boolean(
      cam.capabilities?.personDetection ||
      (cam.name && (cam.name.toLowerCase().includes('campus') || cam.name.toLowerCase().includes('gate') || cam.name.toLowerCase().includes('plaza') || cam.name.toLowerCase().includes('chowk') || cam.name.toLowerCase().includes('terminal') || cam.name.toLowerCase().includes('complex') || cam.name.toLowerCase().includes('square') || cam.name.toLowerCase().includes('garden') || cam.name.toLowerCase().includes('walkway'))) ||
      (cam.cameraCode && ['CAM-001', 'CAM-002', 'CAM-006', 'CAM-007', 'CAM-009', 'CAM-011', 'CAM-013', 'CAM-015', 'CAM-017', 'CAM-018', 'CAM-019', 'CAM-020', 'CAM-022', 'CAM-023', 'CAM-024', 'CAM-025', 'CAM-027', 'CAM-030', 'CAM-031'].includes(cam.cameraCode))
    );

    if (hasAnpr) {
      models.push({ id: 'anpr', name: 'ANPR', tag: 'Vehicle Surveillance' });
    }
    if (hasFrs) {
      models.push({ id: 'frs', name: 'FRS', tag: 'Facial Recognition' });
    }

    return models;
  };

  // Derive real-time health counts
  const totalRegistered = cameras.length || 35;
  const criticalEventCamCodes = new Set(
    healthEvents.filter(e => !e.resolved && e.severity === 'critical').map(e => e.cameraCode)
  );
  const warningEventCamCodes = new Set(
    healthEvents.filter(e => !e.resolved && e.severity === 'warning').map(e => e.cameraCode)
  );

  // Compute camera statuses dynamically
  const camerasWithResolvedStatus = cameras.map(cam => {
    let status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' = cam.healthStatus || 'ONLINE';
    if (criticalEventCamCodes.has(cam.cameraCode)) {
      status = 'OFFLINE';
    } else if (warningEventCamCodes.has(cam.cameraCode)) {
      status = 'DEGRADED';
    }
    return {
      ...cam,
      resolvedStatus: status,
      models: getCameraModels(cam)
    };
  });

  const onlineCount = camerasWithResolvedStatus.filter(c => c.resolvedStatus === 'ONLINE').length;
  const degradedCount = camerasWithResolvedStatus.filter(c => c.resolvedStatus === 'DEGRADED').length;
  const offlineCount = camerasWithResolvedStatus.filter(c => c.resolvedStatus === 'OFFLINE').length;
  const healthPct = totalRegistered > 0 ? ((onlineCount / totalRegistered) * 100).toFixed(1) : '100.0';

  const anprDeployCount = camerasWithResolvedStatus.filter(c => c.models.some(m => m.id === 'anpr')).length;
  const frsDeployCount = camerasWithResolvedStatus.filter(c => c.models.some(m => m.id === 'frs')).length;
  const uniqueDistricts = Array.from(new Set(cameras.map(c => c.district).filter(Boolean)));

  // District distribution calculation
  const districtCountsMap = new Map<string, number>();
  camerasWithResolvedStatus.forEach(c => {
    const d = c.district || 'Ahmedabad';
    districtCountsMap.set(d, (districtCountsMap.get(d) || 0) + 1);
  });
  const districtDistribution = Array.from(districtCountsMap.entries())
    .map(([districtName, count]) => ({
      district: districtName,
      count,
      pct: Math.min(100, Math.round((count / Math.max(1, Math.max(...Array.from(districtCountsMap.values())))) * 100))
    }))
    .sort((a, b) => b.count - a.count);

  // Initialize Leaflet Statewide Gujarat Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered on Gujarat Statewide Surveillance Geography
    const map = L.map(mapContainerRef.current, {
      center: [22.65, 71.85],
      zoom: 7.5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap | Gujarat Police CCTV Surveillance GIS',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersGroupRef.current = markersGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map markers when cameras change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    markerMapRef.current.clear();

    camerasWithResolvedStatus.forEach(cam => {
      if (!cam.latitude || !cam.longitude) return;

      let colorHex = '#22C55E'; // Online
      if (cam.resolvedStatus === 'DEGRADED') colorHex = '#F59E0B';
      if (cam.resolvedStatus === 'OFFLINE') colorHex = '#EF4444';

      const isSelected = selectedCamCode === cam.cameraCode;

      const iconHtml = `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${isSelected ? '32px' : '24px'};
          height: ${isSelected ? '32px' : '24px'};
        ">
          <div style="
            position: absolute;
            width: ${isSelected ? '28px' : '22px'};
            height: ${isSelected ? '28px' : '22px'};
            border-radius: 50%;
            background-color: ${colorHex}40;
            animation: pulse 2s infinite;
          "></div>
          <div style="
            width: ${isSelected ? '15px' : '12px'};
            height: ${isSelected ? '15px' : '12px'};
            border-radius: 50%;
            background-color: ${colorHex};
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            z-index: 10;
          "></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-overview-camera-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

      const statusBg = cam.resolvedStatus === 'ONLINE' ? '#DCFCE7' : cam.resolvedStatus === 'DEGRADED' ? '#FEF3C7' : '#FEE2E2';
      const statusColor = cam.resolvedStatus === 'ONLINE' ? '#166534' : cam.resolvedStatus === 'DEGRADED' ? '#92400E' : '#991B1B';

      const modelsHtml = cam.models.length > 0 
        ? cam.models.map(m => `
            <span style="background:${m.id === 'anpr' ? '#DCFCE7' : '#E0F2FE'};color:${m.id === 'anpr' ? '#15803D' : '#0369A1'};font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;border:1px solid ${m.id === 'anpr' ? '#86EFAC' : '#BAE6FD'};">
              ${m.id === 'anpr' ? '🚗 ANPR' : '👤 FRS'}
            </span>
          `).join(' ')
        : '<span style="color:#94A3B8;font-size:10px;">No Active AI Model</span>';

      const popupContent = `
        <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:12px;padding:4px 2px;min-width:230px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div>
              <span style="font-mono;font-weight:800;color:#0052CC;font-size:11px;">${cam.cameraCode}</span>
              <div style="font-weight:800;color:#0F172A;font-size:12px;margin-top:1px;">${cam.name}</div>
            </div>
            <span style="background:${statusBg};color:${statusColor};font-weight:800;font-size:9.5px;padding:2px 7px;border-radius:9999px;border:1px solid ${statusColor}40;">
              ● ${cam.resolvedStatus}
            </span>
          </div>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:6px 0;"/>
          <div style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:#334155;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748B;">District:</span>
              <strong style="color:#0F172A;">${cam.district || 'Gujarat'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748B;">Department:</span>
              <span style="color:#475569;font-weight:600;">${cam.departmentName || 'Gujarat Police'}</span>
            </div>
            <div style="margin-top:5px;padding-top:5px;border-top:1px solid #F1F5F9;">
              <span style="color:#64748B;font-size:10px;display:block;margin-bottom:3px;font-weight:700;">ACTIVE AI MODELS:</span>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                ${modelsHtml}
              </div>
            </div>
          </div>
        </div>
      `;

      const popup = L.popup({ closeButton: false, offset: [0, -10], className: 'ztrac-hover-popup' }).setContent(popupContent);
      marker.bindPopup(popup);

      marker.on('mouseover', () => marker.openPopup());
      marker.on('click', () => {
        setSelectedCamCode(cam.cameraCode);
        marker.openPopup();
      });

      markersGroupRef.current?.addLayer(marker);
      markerMapRef.current.set(cam.cameraCode, marker);
    });
  }, [camerasWithResolvedStatus, selectedCamCode]);

  // Handle clicking a camera from the matrix table to fly map to it
  const handleFlyToCamera = (cam: Camera) => {
    setSelectedCamCode(cam.cameraCode);
    if (mapInstanceRef.current && cam.latitude && cam.longitude) {
      mapInstanceRef.current.flyTo([cam.latitude, cam.longitude], 13, { duration: 1.2 });
      const marker = markerMapRef.current.get(cam.cameraCode);
      if (marker) {
        setTimeout(() => marker.openPopup(), 400);
      }
    }
  };

  // Filter cameras in the AI Model Matrix
  const filteredMatrixCameras = camerasWithResolvedStatus.filter(c => {
    const matchSearch = c.cameraCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (c.district && c.district.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    if (modelFilter === 'ONLINE') return c.resolvedStatus === 'ONLINE';
    if (modelFilter === 'OFFLINE') return c.resolvedStatus === 'OFFLINE' || c.resolvedStatus === 'DEGRADED';
    if (modelFilter === 'ANPR') return c.models.some(m => m.id === 'anpr');
    if (modelFilter === 'FRS') return c.models.some(m => m.id === 'frs');
    return true;
  });

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      
      {/* 1. Breadcrumb & Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 font-medium">
            <span>Gujarat Police Command</span>
            <span className="mx-1.5 text-slate-400">/</span>
            <span className="text-slate-600">Z-TRACS Unified Surveillance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Central Management Suite
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigateTab && onNavigateTab('sentinel-live-wall')}
            className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span>Open 31 Live Feeds Grid</span>
          </button>
        </div>
      </div>

      {/* 2. Top 5 Real-Time KPI Cards Row */}
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
              {totalRegistered} Assets
            </div>
            <div className="text-[11px] font-semibold text-[#0052CC] mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              <span>31 Live HLS Streams Active</span>
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
              {onlineCount} Cameras
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-[#22C55E] h-full rounded-full transition-all duration-500" 
                style={{ width: `${totalRegistered > 0 ? (onlineCount / totalRegistered) * 100 : 100}%` }}
              />
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
              {degradedCount}
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-[#F59E0B] h-full rounded-full transition-all duration-500" 
                style={{ width: `${totalRegistered > 0 ? (degradedCount / totalRegistered) * 100 : 0}%` }}
              />
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
              {offlineCount}
            </div>
            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-[#EF4444] h-full rounded-full transition-all duration-500" 
                style={{ width: `${totalRegistered > 0 ? (offlineCount / totalRegistered) * 100 : 0}%` }}
              />
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
              {healthPct}%
            </div>
            <div className="text-[11px] font-semibold text-[#15803D] mt-1">
              <span>Nominal Telemetry Feed</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Metric Pills Bar */}
      <div className="flex flex-wrap items-center gap-2.5 py-1">
        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Building2 className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>Departments: </span>
          <strong className="text-slate-900 font-bold ml-1">{departments.length || 5} Active</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <MapPin className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>Districts with Feeds: </span>
          <strong className="text-slate-900 font-bold ml-1">{uniqueDistricts.length || 9} Live Districts</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Server className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>VMS Systems: </span>
          <strong className="text-slate-900 font-bold ml-1">3 Multi-Vendor Clusters</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Zap className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>AI Deployed Cameras: </span>
          <strong className="text-slate-900 font-bold ml-1">{anprDeployCount + frsDeployCount} Model Instances</strong>
        </div>
      </div>

      {/* 4. Middle Section: Leaflet Statewide Map & District Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Statewide Gujarat CCTV Spatial Map (Col-8) */}
        <div className="lg:col-span-8 relative h-[400px] sm:h-[450px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs group">
          
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Legend Box (Top Left) */}
          <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl p-3 border border-slate-200/90 shadow-md">
            <div className="text-xs font-bold text-slate-900 mb-1.5">
              Gujarat Statewide Coverage
            </div>
            <div className="text-[10px] text-slate-500 font-mono mb-2">
              {totalRegistered} Registered CCTV Nodes
            </div>
            <div className="space-y-1.5 text-[11px] font-medium text-slate-700">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
                <span>Online ({onlineCount})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
                <span>Offline ({offlineCount})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                <span>Degraded ({degradedCount})</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-3 right-3 z-[1000] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded text-[10px] text-slate-600 font-mono border border-slate-200">
            Click any camera node to inspect AI models
          </div>
        </div>

        {/* Right: District Distribution Card (Col-4) */}
        <div className="lg:col-span-4 bg-[#EDF3F9] border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  DISTRICT DISTRIBUTION
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Surveillance Camera Deployment</p>
              </div>
              <span className="text-[10px] font-bold text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {uniqueDistricts.length} Live Sectors
              </span>
            </div>

            <div className="mt-4 space-y-3 max-h-[290px] overflow-y-auto pr-1">
              {districtDistribution.map((item) => (
                <div key={item.district} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{item.district}</span>
                    <span className="text-slate-900 font-bold">{item.count} Cameras</span>
                  </div>
                  <div className="w-full bg-slate-200/90 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-[#0052CC]" 
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/70 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Gujarat Police Jurisdiction</span>
            <button 
              onClick={() => onNavigateTab && onNavigateTab('districts')}
              className="text-xs font-bold text-[#0052CC] hover:underline flex items-center cursor-pointer"
            >
              <span>View All 33 Districts</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

      </div>

      {/* 5. NEW MANAGER SECTION: Real-Time Camera Health & AI Model Deployment Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Matrix Header */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
                Live Deployment Telemetry
              </span>
              <span className="text-xs text-slate-500 font-medium">Real-Time Camera & Model Allocation</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Camera Health & AI Model Deployment Matrix
            </h2>
          </div>

          {/* Quick Model Badges Summary */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-1.5 font-bold">
              <Car className="w-3.5 h-3.5 text-emerald-600" />
              <span>{anprDeployCount} ANPR Active</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 flex items-center space-x-1.5 font-bold">
              <UserCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>{frsDeployCount} FRS Active</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Sub-filter Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto text-xs font-bold bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'ALL', label: `All Cameras (${totalRegistered})` },
              { id: 'ONLINE', label: `Online (${onlineCount})` },
              { id: 'OFFLINE', label: `Offline / Degraded (${offlineCount + degradedCount})` },
              { id: 'ANPR', label: `🚗 ANPR Deployed (${anprDeployCount})` },
              { id: 'FRS', label: `👤 FRS Deployed (${frsDeployCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setModelFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-md transition whitespace-nowrap cursor-pointer ${
                  modelFilter === tab.id 
                    ? 'bg-white text-slate-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search camera code or location..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10.5px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Camera Identifier</th>
                <th className="py-3 px-4">District & Sector</th>
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4">Active AI Models</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredMatrixCameras.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No cameras matching current filter "{modelFilter}".
                  </td>
                </tr>
              ) : (
                filteredMatrixCameras.map((cam) => {
                  const isSelected = selectedCamCode === cam.cameraCode;
                  return (
                    <tr 
                      key={cam.cameraCode} 
                      className={`hover:bg-blue-50/50 transition ${isSelected ? 'bg-blue-50/80 font-bold' : ''}`}
                    >
                      {/* Camera Code & Name */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#0052CC]">{cam.cameraCode}</div>
                        <div className="font-semibold text-slate-900 mt-0.5">{cam.name}</div>
                      </td>

                      {/* District & Location */}
                      <td className="py-3 px-4 text-slate-600">
                        <div>{cam.district || 'Gujarat'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">{cam.address}</div>
                      </td>

                      {/* Live Status Badge */}
                      <td className="py-3 px-4">
                        {cam.resolvedStatus === 'ONLINE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1 animate-pulse" />
                            ONLINE
                          </span>
                        )}
                        {cam.resolvedStatus === 'DEGRADED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-1" />
                            DEGRADED
                          </span>
                        )}
                        {cam.resolvedStatus === 'OFFLINE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1" />
                            OFFLINE
                          </span>
                        )}
                      </td>

                      {/* Active AI Models (Strictly ANPR & FRS only) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {cam.models.length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">No AI Model</span>
                          ) : (
                            cam.models.map(m => (
                              <span
                                key={m.id}
                                className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] border ${
                                  m.id === 'anpr'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-sky-50 text-sky-800 border-sky-200'
                                }`}
                              >
                                {m.id === 'anpr' ? (
                                  <>
                                    <Car className="w-3 h-3 mr-1 text-emerald-600" />
                                    <span>🚗 ANPR - Vehicle Surveillance</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3 h-3 mr-1 text-sky-600" />
                                    <span>👤 FRS - Facial Recognition</span>
                                  </>
                                )}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleFlyToCamera(cam)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-[#0052CC] hover:text-white text-slate-700 text-[11px] font-bold rounded transition cursor-pointer shadow-2xs inline-flex items-center space-x-1"
                          title="Locate on Statewide Map"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Pin on Map</span>
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Matrix Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
          <span>Displaying {filteredMatrixCameras.length} of {totalRegistered} Gujarat CCTV nodes</span>
          <div className="flex items-center space-x-4 mt-2 sm:mt-0 font-medium">
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" /> 🚗 ANPR (Automatic Number Plate Recognition)</span>
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-sky-500 mr-1.5" /> 👤 FRS (Facial Recognition System)</span>
          </div>
        </div>

      </div>

    </div>
  );
};
