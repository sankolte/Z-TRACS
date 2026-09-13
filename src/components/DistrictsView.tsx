import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  Filter, 
  Download, 
  LayoutGrid, 
  Table as TableIcon, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Phone, 
  TrendingUp, 
  Radar, 
  Shield,
  Video,
  X,
  Camera as CameraIcon,
  ArrowRight,
  Car,
  UserCheck,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Building2,
  ExternalLink
} from 'lucide-react';
import { District, Camera, HealthEvent, Language } from '../types';
import { ApiClient } from '../services/apiClient';

interface DistrictsViewProps {
  districts: District[];
  cameras?: Camera[];
  healthEvents?: HealthEvent[];
  currentLang?: Language;
  onSelectDistrict: (district: District) => void;
  onSelectCamera?: (camera: Camera) => void;
  onNavigateTab?: (tab: string) => void;
}

export const DistrictsView: React.FC<DistrictsViewProps> = ({
  districts = [],
  cameras = [],
  healthEvents = [],
  onSelectDistrict,
  onSelectCamera,
  onNavigateTab,
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [filterZone, setFilterZone] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE_ONLY' | 'ANPR' | 'FRS'>('ALL');
  const [selectedInspectDistrict, setSelectedInspectDistrict] = useState<any | null>(null);

  // Live AI Configuration state from backend / edge engine
  const [aiConfigs, setAiConfigs] = useState<Record<string, any>>({});
  const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(false);

  // Fetch real-time AI model configs from EC2 backend
  const fetchAllConfigs = async () => {
    try {
      setIsLoadingConfigs(true);
      const data = await ApiClient.getAllAiConfigs();
      if (data && typeof data === 'object') {
        setAiConfigs(data);
      }
    } catch (err) {
      console.warn('[DistrictsView] Live AI Config fetch notice:', err);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  useEffect(() => {
    fetchAllConfigs();
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

  // Build resolved camera list with active health status & AI models
  const criticalEventCamCodes = useMemo(() => new Set(
    healthEvents.filter(e => !e.resolved && e.severity === 'critical').map(e => e.cameraCode)
  ), [healthEvents]);

  const warningEventCamCodes = useMemo(() => new Set(
    healthEvents.filter(e => !e.resolved && e.severity === 'warning').map(e => e.cameraCode)
  ), [healthEvents]);

  const enrichedCameras = useMemo(() => {
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

  // Aggregate cameras by district dynamically
  const districtsWithTelemetry = useMemo(() => {
    return districts.map(d => {
      const distName = d.name.trim().toLowerCase();
      // Match cameras whose district or city matches this district name
      const matchedCameras = enrichedCameras.filter(c => {
        const cDist = (c.district || '').trim().toLowerCase();
        const cCity = (c.city || '').trim().toLowerCase();
        const cAddr = (c.address || '').trim().toLowerCase();
        return cDist === distName || cCity === distName || cAddr.includes(distName);
      });

      const totalCams = matchedCameras.length;
      const onlineCams = matchedCameras.filter(c => c.resolvedStatus === 'ONLINE').length;
      const degradedCams = matchedCameras.filter(c => c.resolvedStatus === 'DEGRADED').length;
      const offlineCams = matchedCameras.filter(c => c.resolvedStatus === 'OFFLINE').length;
      const anprCams = matchedCameras.filter(c => c.models.some(m => m.id === 'anpr')).length;
      const frsCams = matchedCameras.filter(c => c.models.some(m => m.id === 'frs')).length;
      const activeAiCams = matchedCameras.filter(c => c.models.length > 0).length;

      const onlinePercentage = totalCams > 0 ? Math.round((onlineCams / totalCams) * 100) : 100;

      return {
        ...d,
        cameras: matchedCameras,
        totalCameras: totalCams,
        onlineCount: onlineCams,
        degradedCount: degradedCams,
        offlineCount: offlineCams,
        anprCount: anprCams,
        frsCount: frsCams,
        activeAiCount: activeAiCams,
        onlinePercentage,
        hasActiveStreams: totalCams > 0
      };
    });
  }, [districts, enrichedCameras]);

  // Filter districts based on search, zone, and status filter
  const zones = ['All', 'Central Gujarat', 'South Gujarat', 'Saurashtra', 'North Gujarat', 'Kutch'];

  const filteredDistricts = useMemo(() => {
    return districtsWithTelemetry.filter(d => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q || 
        d.name.toLowerCase().includes(q) ||
        (d.gujaratiName && d.gujaratiName.includes(q)) ||
        (d.headquarters && d.headquarters.toLowerCase().includes(q)) ||
        (d.zone && d.zone.toLowerCase().includes(q)) ||
        (d.nodalSp && d.nodalSp.toLowerCase().includes(q));

      const matchZone = filterZone === 'All' || d.zone === filterZone;

      let matchStatus = true;
      if (filterStatus === 'ACTIVE_ONLY') {
        matchStatus = d.totalCameras > 0;
      } else if (filterStatus === 'ANPR') {
        matchStatus = d.anprCount > 0;
      } else if (filterStatus === 'FRS') {
        matchStatus = d.frsCount > 0;
      }

      return matchSearch && matchZone && matchStatus;
    });
  }, [districtsWithTelemetry, search, filterZone, filterStatus]);

  // Aggregate statewide KPIs
  const totalStatewideCameras = enrichedCameras.length;
  const totalLiveDistricts = districtsWithTelemetry.filter(d => d.totalCameras > 0).length;
  const totalOnlineStatewide = enrichedCameras.filter(c => c.resolvedStatus === 'ONLINE').length;
  const statewideOnlineRate = totalStatewideCameras > 0 
    ? ((totalOnlineStatewide / totalStatewideCameras) * 100).toFixed(1) 
    : '100.0';
  const totalStatewideAnpr = enrichedCameras.filter(c => c.models.some(m => m.id === 'anpr')).length;
  const totalStatewideFrs = enrichedCameras.filter(c => c.models.some(m => m.id === 'frs')).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        
        {/* Total Assets & Live Districts */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Gujarat CCTV Assets
          </span>
          <div className="text-2xl font-black text-[#0052CC] font-mono mt-1">
            {totalStatewideCameras} Live Feeds
          </div>
          <span className="text-xs text-slate-600 font-medium mt-1 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            Across <strong className="text-slate-900 mx-1">{totalLiveDistricts}</strong> of 33 Districts
          </span>
        </div>

        {/* Operational Health Index */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Statewide Health Index
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">
            {statewideOnlineRate}% Online
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {totalOnlineStatewide} of {totalStatewideCameras} nodes transmitting
          </span>
        </div>

        {/* 🚗 ANPR Deployed */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              🚗 ANPR Deployed
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Vehicle Vision
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {totalStatewideAnpr} Cameras
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Automatic number plate recognition active
          </span>
        </div>

        {/* 👤 FRS Deployed */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              👤 FRS Deployed
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
              Biometrics
            </span>
          </div>
          <div className="text-2xl font-black text-sky-700 font-mono mt-1">
            {totalStatewideFrs} Cameras
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Facial recognition search active
          </span>
        </div>

      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        
        {/* Search & Zone Dropdown */}
        <div className="flex items-center space-x-3 flex-1 min-w-[280px] max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by district name, headquarters, zone, or nodal SP..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0052CC]"
            />
          </div>

          {/* Zone Selector */}
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#0052CC]"
          >
            {zones.map(z => (
              <option key={z} value={z}>{z === 'All' ? 'All 33 Zones' : z}</option>
            ))}
          </select>
        </div>

        {/* Quick Filter Tabs (Status & Models) */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 rounded transition whitespace-nowrap cursor-pointer ${filterStatus === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All 33
            </button>
            <button
              onClick={() => setFilterStatus('ACTIVE_ONLY')}
              className={`px-3 py-1 rounded transition whitespace-nowrap cursor-pointer ${filterStatus === 'ACTIVE_ONLY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Live Streams ({totalLiveDistricts})
            </button>
            <button
              onClick={() => setFilterStatus('ANPR')}
              className={`px-3 py-1 rounded transition whitespace-nowrap cursor-pointer ${filterStatus === 'ANPR' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🚗 ANPR Active
            </button>
            <button
              onClick={() => setFilterStatus('FRS')}
              className={`px-3 py-1 rounded transition whitespace-nowrap cursor-pointer ${filterStatus === 'FRS' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              👤 FRS Active
            </button>
          </div>

          {/* Sync Edge Models Button */}
          <button
            onClick={fetchAllConfigs}
            disabled={isLoadingConfigs}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
            title="Refresh Real-Time Edge AI Configurations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingConfigs ? 'animate-spin text-[#0052CC]' : ''}`} />
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition cursor-pointer ${viewMode === 'table' ? 'bg-white text-[#0052CC] shadow-2xs' : 'text-slate-500'}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition cursor-pointer ${viewMode === 'grid' ? 'bg-white text-[#0052CC] shadow-2xs' : 'text-slate-500'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* 3. Table View */}
      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-[#002038] text-white text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">District Jurisdiction</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4">Headquarters</th>
                  <th className="py-3 px-4">Live CCTV Assets</th>
                  <th className="py-3 px-4">Stream Health</th>
                  <th className="py-3 px-4">Active AI Models</th>
                  <th className="py-3 px-4">Nodal Command Officer</th>
                  <th className="py-3 px-4 text-right">District Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredDistricts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No districts match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDistricts.map((d: any) => {
                    return (
                      <tr key={d.id} className="hover:bg-blue-50/50 transition">
                        
                        {/* District Name & Gujarati Name */}
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-sm text-slate-900">{d.name}</span>
                            {d.gujaratiName && (
                              <span className="text-[11px] font-normal text-slate-400 font-sans">
                                ({d.gujaratiName})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{d.id}</div>
                        </td>

                        {/* Zone */}
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {d.zone}
                          </span>
                        </td>

                        {/* Headquarters */}
                        <td className="py-3 px-4 text-slate-600">
                          {d.headquarters}
                        </td>

                        {/* Live Feed Cameras */}
                        <td className="py-3 px-4">
                          {d.totalCameras > 0 ? (
                            <div>
                              <span className="font-mono font-bold text-[#0052CC] text-sm">
                                {d.totalCameras}
                              </span>
                              <span className="text-slate-500 text-[11px] ml-1">Live Feeds</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">
                              Expansion Planned
                            </span>
                          )}
                        </td>

                        {/* Health Rate */}
                        <td className="py-3 px-4">
                          {d.totalCameras > 0 ? (
                            <div className="space-y-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                d.offlineCount > 0 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : d.degradedCount > 0
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
                                {d.onlineCount} / {d.totalCameras} Online
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Nominal (0 Feeds)</span>
                          )}
                        </td>

                        {/* Active AI Models (Strictly ANPR & FRS only) */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {d.anprCount > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Car className="w-3 h-3 mr-1 text-emerald-600" />
                                <span>{d.anprCount} ANPR</span>
                              </span>
                            )}
                            {d.frsCount > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                <UserCheck className="w-3 h-3 mr-1 text-sky-600" />
                                <span>{d.frsCount} FRS</span>
                              </span>
                            )}
                            {d.anprCount === 0 && d.frsCount === 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium text-slate-400 bg-slate-100 border border-slate-200">
                                ⚪ Idle (No AI)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SP / CP Contact */}
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          <div className="font-sans font-bold text-slate-800 truncate max-w-[200px]">
                            {d.nodalSp}
                          </div>
                          <div className="text-slate-400 text-[10px] flex items-center mt-0.5">
                            <Phone className="w-2.5 h-2.5 mr-1 text-[#0052CC]" />
                            <span>{d.controlRoomContact}</span>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedInspectDistrict(d)}
                            className="px-3 py-1.5 bg-[#0052CC] hover:bg-[#0043a8] text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer inline-flex items-center space-x-1"
                          >
                            <span>Inspect ({d.totalCameras})</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        
        /* 4. Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDistricts.map((d: any) => {
            return (
              <div
                key={d.id}
                className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-[#0052CC] transition flex flex-col justify-between space-y-4"
              >
                <div>
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">{d.name}</h3>
                        {d.gujaratiName && (
                          <span className="text-xs text-slate-400 font-normal">({d.gujaratiName})</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{d.headquarters} • {d.zone}</p>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0052CC] border border-blue-200">
                      {d.zone}
                    </span>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Live CCTV Nodes</span>
                      <span className="font-mono font-black text-[#0052CC] text-base mt-0.5 block">
                        {d.totalCameras} Feeds
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Online Telemetry</span>
                      <span className="font-mono font-bold text-emerald-600 text-xs mt-1 block flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                        {d.onlineCount} Online
                      </span>
                    </div>
                  </div>

                  {/* District AI Deployment Badges */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1.5">
                      District AI Vision Deployment
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.anprCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Car className="w-3 h-3 mr-1 text-emerald-600" />
                          <span>{d.anprCount} ANPR Active</span>
                        </span>
                      )}
                      {d.frsCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          <UserCheck className="w-3 h-3 mr-1 text-sky-600" />
                          <span>{d.frsCount} FRS Active</span>
                        </span>
                      )}
                      {d.anprCount === 0 && d.frsCount === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium text-slate-400 bg-slate-100 border border-slate-200">
                          ⚪ Idle (No AI Model Deployed)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SP Command Contact */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                    <p className="font-semibold text-slate-800 truncate">{d.nodalSp}</p>
                    <p className="text-slate-400 font-mono text-[10.5px] flex items-center mt-0.5">
                      <Phone className="w-2.5 h-2.5 mr-1 text-[#0052CC]" />
                      <span>{d.controlRoomContact}</span>
                    </p>
                  </div>

                </div>

                {/* Inspect Button */}
                <button
                  onClick={() => setSelectedInspectDistrict(d)}
                  className="w-full py-2 bg-[#0052CC] hover:bg-[#0043a8] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center space-x-1"
                >
                  <span>Inspect District ({d.totalCameras} Nodes)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Detailed District Inspection Modal / Drawer */}
      {selectedInspectDistrict && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedInspectDistrict(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="bg-[#002038] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center space-x-2">
                    <span>{selectedInspectDistrict.name} District Jurisdiction</span>
                    {selectedInspectDistrict.gujaratiName && (
                      <span className="text-xs text-slate-300 font-normal">({selectedInspectDistrict.gujaratiName})</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">
                    {selectedInspectDistrict.zone} • HQ: {selectedInspectDistrict.headquarters}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInspectDistrict(null)}
                className="p-2 rounded-lg bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              
              {/* Command & Control Overview */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                    SP / CP Command Incharge
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {selectedInspectDistrict.nodalSp}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                    Control Room Emergency Line
                  </span>
                  <span className="font-mono font-bold text-[#0052CC] text-sm mt-0.5 block flex items-center">
                    <Phone className="w-3 h-3 mr-1 text-[#0052CC]" />
                    <span>{selectedInspectDistrict.controlRoomContact}</span>
                  </span>
                </div>
              </div>

              {/* District Real-Time Telemetry Breakdown */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Cams</span>
                  <span className="font-mono font-black text-[#0052CC] text-base mt-0.5 block">
                    {selectedInspectDistrict.totalCameras}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Online</span>
                  <span className="font-mono font-black text-emerald-700 text-base mt-0.5 block">
                    {selectedInspectDistrict.onlineCount}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">🚗 ANPR Active</span>
                  <span className="font-mono font-black text-emerald-700 text-base mt-0.5 block">
                    {selectedInspectDistrict.anprCount}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-sky-50/60 border border-sky-200">
                  <span className="text-[10px] font-bold text-sky-800 block uppercase">👤 FRS Active</span>
                  <span className="font-mono font-black text-sky-700 text-base mt-0.5 block">
                    {selectedInspectDistrict.frsCount}
                  </span>
                </div>
              </div>

              {/* Cameras List in this District */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Registered CCTV Nodes in {selectedInspectDistrict.name}
                  </h4>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-[#0052CC] text-[10px] font-bold rounded-full border border-blue-200">
                    {selectedInspectDistrict.cameras.length} Nodes Mapped
                  </span>
                </div>

                {selectedInspectDistrict.cameras.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6">
                    <CameraIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-700">No CCTV Nodes Registered Yet</div>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Coverage expansion for {selectedInspectDistrict.name} is scheduled under the next state surveillance rollout phase.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {selectedInspectDistrict.cameras.map((cam: any) => (
                      <div 
                        key={cam.cameraCode} 
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 transition shadow-2xs"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-[#002038] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            <CameraIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#0052CC] text-xs">
                                {cam.cameraCode}
                              </span>
                              
                              {/* Live Status Badge */}
                              <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[9.5px] font-bold ${
                                cam.resolvedStatus === 'ONLINE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : cam.resolvedStatus === 'DEGRADED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
                                {cam.resolvedStatus}
                              </span>
                            </div>

                            <div className="font-semibold text-xs text-slate-900 mt-0.5">
                              {cam.name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                              📍 {cam.address}
                            </div>
                          </div>
                        </div>

                        {/* Active AI Models on this camera */}
                        <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                          {cam.models.length === 0 ? (
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                              ⚪ Idle (No AI)
                            </span>
                          ) : (
                            cam.models.map((m: any) => (
                              <span
                                key={m.id}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  m.id === 'anpr'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-sky-50 text-sky-800 border-sky-200'
                                }`}
                              >
                                {m.id === 'anpr' ? '🚗 ANPR' : '👤 FRS'}
                              </span>
                            ))
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedInspectDistrict(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={() => {
                  const d = selectedInspectDistrict;
                  setSelectedInspectDistrict(null);
                  onSelectDistrict(d);
                }}
                className="px-4 py-2 bg-[#0052CC] hover:bg-[#0043a8] text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Filter Registry for {selectedInspectDistrict.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
