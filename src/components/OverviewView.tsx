import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, Department, District, HealthEvent, AuditLog } from '../types';
import { ApiClient } from '../services/apiClient';
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
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Cpu
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

  // Live AI Configuration state from backend / edge engine
  const [aiConfigs, setAiConfigs] = useState<Record<string, any>>({});
  const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(false);

  // Filter for Camera Health & AI Model Deployment Matrix
  const [modelFilter, setModelFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'ANPR' | 'FRS' | 'NO_AI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCamCode, setSelectedCamCode] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Fetch real-time AI model configs from EC2 / FastAPI backend
  const fetchAllConfigs = async () => {
    try {
      setIsLoadingConfigs(true);
      const data = await ApiClient.getAllAiConfigs();
      if (data && typeof data === 'object') {
        setAiConfigs(data);
      }
    } catch (err) {
      console.warn('[OverviewView] Live AI Config fetch notice:', err);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  useEffect(() => {
    fetchAllConfigs();
    // Live poll every 8 seconds to seamlessly reflect changes made in "AI Inference Model" view
    const interval = setInterval(fetchAllConfigs, 8000);
    const handleFocus = () => fetchAllConfigs();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Helper to normalize any camera code alias to standard format (e.g. CAM001 -> CAM-001)
  const toCanonicalCode = (raw: string): string => {
    if (!raw) return 'CAM-001';
    const clean = raw.trim().toUpperCase();
    const match = clean.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num >= 1 && num <= 35) {
        return `CAM-${num.toString().padStart(3, '0')}`;
      }
    }
    return clean;
  };

  // Helper to determine ACTUAL live AI models applied to a camera (strictly ANPR and FRS only)
  // 100% genuine: Returns models ONLY if explicitly enabled in backend AI config
  const getCameraModels = (cam: Camera): Array<{ id: 'anpr' | 'frs'; name: string; tag: string }> => {
    const canonical = toCanonicalCode(cam.cameraCode);
    const cfg = aiConfigs[canonical] || aiConfigs[cam.cameraCode];
    if (!cfg) return [];

    let hasAnpr = false;
    let hasFrs = false;

    if (cfg.models && typeof cfg.models === 'object') {
      hasAnpr = Boolean(cfg.models.anpr);
      hasFrs = Boolean(cfg.models.frs);
    } else if (Array.isArray(cfg.ai_models) || Array.isArray(cfg.usecases)) {
      const list: string[] = (cfg.ai_models || cfg.usecases).map((m: any) => String(m).toUpperCase());
      hasAnpr = list.some(m => m.includes('ANPR') || m.includes('VEHICLE') || m.includes('PLATE'));
      hasFrs = list.some(m => m.includes('FACE') || m.includes('FRS') || m.includes('BIOMETRIC'));
    } else if (Array.isArray(cfg.enable)) {
      hasAnpr = Boolean(cfg.enable[0]);
      hasFrs = Boolean(cfg.enable[1]);
    }

    const models: Array<{ id: 'anpr' | 'frs'; name: string; tag: string }> = [];
    if (hasAnpr) {
      models.push({ id: 'anpr', name: 'ANPR', tag: 'Vehicle Surveillance' });
    }
    if (hasFrs) {
      models.push({ id: 'frs', name: 'FRS', tag: 'Facial Recognition' });
    }

    return models;
  };

  // Reset pagination to 10 when filters or search term change
  useEffect(() => {
    setVisibleCount(10);
  }, [modelFilter, searchQuery]);

  // Derive real-time health counts
  const totalRegistered = cameras.length || 35;
  const criticalEventCamCodes = new Set(
    healthEvents.filter(e => !e.resolved && e.severity === 'critical').map(e => e.cameraCode)
  );
  const warningEventCamCodes = new Set(
    healthEvents.filter(e => !e.resolved && e.severity === 'warning').map(e => e.cameraCode)
  );

  // Compute camera statuses dynamically with real attached AI models
  const camerasWithResolvedStatus = useMemo(() => {
    return cameras.map(cam => {
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
  }, [cameras, criticalEventCamCodes, warningEventCamCodes, aiConfigs]);

  const onlineCount = camerasWithResolvedStatus.filter(c => c.resolvedStatus === 'ONLINE').length;
  const degradedCount = camerasWithResolvedStatus.filter(c => c.resolvedStatus === 'DEGRADED').length;
  const offlineCount = camerasWithResolvedStatus.filter(c => c.resolvedStatus === 'OFFLINE').length;
  const healthPct = totalRegistered > 0 ? ((onlineCount / totalRegistered) * 100).toFixed(1) : '100.0';

  const anprDeployCount = camerasWithResolvedStatus.filter(c => c.models.some(m => m.id === 'anpr')).length;
  const frsDeployCount = camerasWithResolvedStatus.filter(c => c.models.some(m => m.id === 'frs')).length;
  const activeAiDeployCount = camerasWithResolvedStatus.filter(c => c.models.length > 0).length;
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

  // Update map markers when cameras or AI configurations change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    camerasWithResolvedStatus.forEach(cam => {
      const lat = cam.latitude || 23.0225;
      const lng = cam.longitude || 72.5714;

      // Real status dot styling
      let statusBg = '#10b981'; // Green (Online)
      let statusBorder = '#047857';
      let ringColor = 'rgba(16, 185, 129, 0.4)';

      if (cam.resolvedStatus === 'DEGRADED') {
        statusBg = '#f59e0b'; // Amber
        statusBorder = '#b45309';
        ringColor = 'rgba(245, 158, 11, 0.4)';
      } else if (cam.resolvedStatus === 'OFFLINE') {
        statusBg = '#ef4444'; // Red
        statusBorder = '#b91c1c';
        ringColor = 'rgba(239, 68, 68, 0.4)';
      }

      const activeModels = cam.models;
      const customIcon = L.divIcon({
        className: 'custom-leaflet-camera-pin',
        html: `
          <div style="
            position: relative;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background-color: ${statusBg};
            border: 2px solid #ffffff;
            box-shadow: 0 0 0 3px ${ringColor}, 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.2s ease;
          " title="${cam.name} (${cam.resolvedStatus})">
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Clean interactive popup with camera info and active AI models
      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; color: #1e293b; min-width: 200px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="font-size: 13px; color: #0052cc;">${cam.cameraCode}</strong>
            <span style="
              font-size: 9px;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 9999px;
              background-color: ${cam.resolvedStatus === 'ONLINE' ? '#dcfce7' : cam.resolvedStatus === 'DEGRADED' ? '#fef3c7' : '#fee2e2'};
              color: ${cam.resolvedStatus === 'ONLINE' ? '#166534' : cam.resolvedStatus === 'DEGRADED' ? '#92400e' : '#991b1b'};
            ">
              ${cam.resolvedStatus}
            </span>
          </div>
          <div style="font-weight: 600; color: #334155; margin-bottom: 3px;">${cam.name}</div>
          <div style="color: #64748b; font-size: 11px;">📍 ${cam.district || 'Gujarat'} | ${cam.address || ''}</div>
          <div style="font-size: 11px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <strong style="color: #475569;">Active AI Models: </strong>
            ${
              activeModels.length === 0 
                ? '<span style="color: #94a3b8; font-style: italic;">⚪ Idle (No AI Model)</span>'
                : activeModels.map(m => `
                  <span style="display:inline-block; margin-right:4px; margin-top:2px; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; background: ${m.id === 'anpr' ? '#ecfdf5' : '#f0f9ff'}; color: ${m.id === 'anpr' ? '#065f46' : '#0369a1'}; border: 1px solid ${m.id === 'anpr' ? '#a7f3d0' : '#bae6fd'};">
                    ${m.id === 'anpr' ? '🚗 ANPR' : '👤 FRS'}
                  </span>
                `).join('')
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        setSelectedCamCode(cam.cameraCode);
        if (onSelectCamera) onSelectCamera(cam);
      });

      markersGroup.addLayer(marker);
    });
  }, [camerasWithResolvedStatus, onSelectCamera]);

  // Handle locating a camera directly on the statewide map
  const handleFlyToCamera = (cam: Camera) => {
    setSelectedCamCode(cam.cameraCode);
    if (mapInstanceRef.current) {
      const lat = cam.latitude || 23.0225;
      const lng = cam.longitude || 72.5714;
      mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.2 });
    }
    const mapElement = mapContainerRef.current;
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Filtered cameras for the Health & AI Model Matrix
  const filteredMatrixCameras = useMemo(() => {
    return camerasWithResolvedStatus.filter(cam => {
      if (modelFilter === 'ONLINE' && cam.resolvedStatus !== 'ONLINE') return false;
      if (modelFilter === 'OFFLINE' && cam.resolvedStatus === 'ONLINE') return false;
      if (modelFilter === 'ANPR' && !cam.models.some(m => m.id === 'anpr')) return false;
      if (modelFilter === 'FRS' && !cam.models.some(m => m.id === 'frs')) return false;
      if (modelFilter === 'NO_AI' && cam.models.length > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = cam.cameraCode.toLowerCase().includes(q);
        const matchName = cam.name.toLowerCase().includes(q);
        const matchDist = (cam.district || '').toLowerCase().includes(q);
        const matchAddr = (cam.address || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchDist && !matchAddr) return false;
      }
      return true;
    });
  }, [camerasWithResolvedStatus, modelFilter, searchQuery]);

  // Progressive disclosure: Show top 10 first, then expand on demand
  const displayedCameras = filteredMatrixCameras.slice(0, visibleCount);
  const hasMore = filteredMatrixCameras.length > visibleCount;
  const canCollapse = visibleCount > 10;

  return (
    <div className="space-y-6">

      {/* 1. Dashboard Header */}
      <div className="bg-white border-b border-slate-200 -mt-6 -mx-6 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Statewide Command & Control
            </span>
            <span className="text-xs text-slate-500 font-medium">Gujarat Police & Municipal Surveillance GIS</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1 flex items-center space-x-2">
            <span>Central Management Suite</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
              LIVE REAL-TIME
            </span>
          </h1>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAllConfigs}
            disabled={isLoadingConfigs}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Sync live AI configs from edge daemon"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingConfigs ? 'animate-spin text-[#0052CC]' : ''}`} />
            <span>{isLoadingConfigs ? 'Syncing...' : 'Sync Edge Models'}</span>
          </button>

          <button
            onClick={() => onNavigateTab ? onNavigateTab('districts') : null}
            className="px-4 py-2 bg-[#0052CC] hover:bg-[#0043a8] text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
          >
            <span>View All 33 Districts</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Dynamic Real-Time KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        
        {/* TOTAL REGISTERED */}
        <div className="bg-[#EDF3FA] border border-[#D5E3F5] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
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
              <span>31 Live Sentinel Feeds</span>
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
          <span>Districts Covered: </span>
          <strong className="text-slate-900 font-bold ml-1">{uniqueDistricts.length || 9} Live Districts</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Server className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>VMS Clusters Linked: </span>
          <strong className="text-slate-900 font-bold ml-1">3 Live Clusters</strong>
        </div>

        <div className="px-4 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs text-slate-600 shadow-2xs flex items-center">
          <Cpu className="w-3.5 h-3.5 text-[#0052CC] mr-1.5" />
          <span>Cameras with AI Applied: </span>
          <strong className="text-slate-900 font-bold ml-1">{activeAiDeployCount} Deployed</strong>
        </div>
      </div>

      {/* 4. Statewide Map & District Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Statewide Gujarat Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Gujarat Statewide CCTV Surveillance GIS</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Displaying {cameras.length} registered CCTV nodes across Gujarat state districts
              </p>
            </div>
            
            {/* Map Legend */}
            <div className="flex items-center space-x-3 text-[11px] font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Online ({onlineCount})
              </span>
              {degradedCount > 0 && (
                <span className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1" />
                  Degraded ({degradedCount})
                </span>
              )}
              {offlineCount > 0 && (
                <span className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1" />
                  Offline ({offlineCount})
                </span>
              )}
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0" 
          />

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Click any node on map to view camera details, status & deployed AI models</span>
            <span className="font-mono">Sentinel GIS Gateway v2.4</span>
          </div>
        </div>

        {/* District Distribution Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">District Distribution</h3>
                <p className="text-xs text-slate-500 mt-0.5">Live video streams mapped by administrative district</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0052CC] border border-blue-200">
                {uniqueDistricts.length} Districts
              </span>
            </div>

            <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
              {districtDistribution.map((item) => (
                <div key={item.district} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.district}</span>
                    <span className="font-mono text-slate-500 font-bold">{item.count} Feeds</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0052CC] h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onNavigateTab ? onNavigateTab('districts') : null}
              className="w-full py-2 bg-slate-50 hover:bg-[#EDF3FA] hover:text-[#0052CC] text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition cursor-pointer flex items-center justify-center space-x-1"
            >
              <span>Explore District Surveillance Matrix</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* 5. Live Camera Health & AI Model Deployment Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
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

          {/* Quick Model Badges Summary (Strictly ANPR & FRS only) */}
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
              { id: 'ANPR', label: `🚗 ANPR (${anprDeployCount})` },
              { id: 'FRS', label: `👤 FRS (${frsDeployCount})` },
              { id: 'NO_AI', label: `⚪ No AI (${totalRegistered - activeAiDeployCount})` },
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10.5px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Camera Identifier</th>
                <th className="py-3 px-4">District & Sector</th>
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4">Active AI Models</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {displayedCameras.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No cameras matching current filter "{modelFilter}".
                  </td>
                </tr>
              ) : (
                displayedCameras.map((cam) => {
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

                      {/* Active AI Models (Real: Strictly ANPR & FRS only, or Idle if none) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {cam.models.length === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium text-slate-400 bg-slate-100 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5" />
                              ⚪ Idle (No AI Model)
                            </span>
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

        {/* Progressive Disclosure Pagination Bar (Top 10 -> Show More) */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{displayedCameras.length}</strong> of <strong className="text-slate-900">{filteredMatrixCameras.length}</strong> cameras ({totalRegistered} total registered)
          </span>

          <div className="flex items-center space-x-2">
            {hasMore && (
              <button
                onClick={() => setVisibleCount(prev => prev + 10)}
                className="px-3.5 py-1.5 bg-[#0052CC] hover:bg-[#0043a8] text-white font-bold rounded-lg transition shadow-2xs cursor-pointer flex items-center space-x-1"
              >
                <span>Show More (+10)</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
            
            {hasMore && (
              <button
                onClick={() => setVisibleCount(filteredMatrixCameras.length)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
              >
                Show All ({filteredMatrixCameras.length})
              </button>
            )}

            {canCollapse && (
              <button
                onClick={() => setVisibleCount(10)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1"
              >
                <span>Show Top 10</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
