import React, { useState, useEffect } from 'react';
import { Camera, AnprEvent, SystemAlert, Department } from '../types';
import { 
  Video, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Maximize2, 
  Volume2, 
  VolumeX, 
  Camera as CameraIcon, 
  Cpu, 
  SlidersHorizontal, 
  Grid, 
  Layers, 
  Bell, 
  Search, 
  Eye, 
  ShieldAlert, 
  Radio, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin
} from 'lucide-react';

interface CommandCenterViewProps {
  cameras: Camera[];
  anprEvents: AnprEvent[];
  alerts: SystemAlert[];
  departments: Department[];
  onSelectCamera: (cam: Camera) => void;
  onNavigateTab: (tab: string) => void;
  onSelectAnprEvent?: (event: AnprEvent) => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  cameras,
  anprEvents,
  alerts,
  departments,
  onSelectCamera,
  onNavigateTab,
  onSelectAnprEvent,
}) => {
  // Layout mode: 1x1, 2x2, 3x3, 4x4
  const [gridCount, setGridCount] = useState<1 | 2 | 3 | 4>(2);
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [activeMutedMap, setActiveMutedMap] = useState<Record<string, boolean>>({});
  const [activeLiveEvents, setActiveLiveEvents] = useState<AnprEvent[]>(anprEvents);

  // Active cameras in video wall grid
  const wallCameras = cameras
    .filter(c => c.lifecycle === 'ACTIVE' && (selectedDeptFilter === 'ALL' || c.departmentId === selectedDeptFilter))
    .slice(0, gridCount * gridCount);

  // Live timestamp ticker
  const [currentTimeStr, setCurrentTimeStr] = useState(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleMute = (uuid: string) => {
    setActiveMutedMap(prev => ({ ...prev, [uuid]: !prev[uuid] }));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 select-none">
      
      {/* 1. Command Center Top Operational Header Strip */}
      <div className="bg-[#06152B] text-white p-4 rounded-xl border border-slate-800 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#08281D] text-[#22C55E] border border-[#14533C] uppercase tracking-wider">
              ● Multi-Department Command Mesh Active
            </span>
            <span className="text-xs text-slate-400 font-mono">VMS Federation Engine v3.4</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight mt-1 flex items-center space-x-2">
            <span>Statewide CCTV Command Center</span>
            <span className="text-xs font-mono font-bold text-slate-400">({currentTimeStr})</span>
          </h1>
        </div>

        {/* Top Controls & Grid Selectors */}
        <div className="flex items-center space-x-3">
          
          {/* Department Filter Selector */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-hidden"
          >
            <option value="ALL">All Department VMS Feeds</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* AI Overlay Toggle */}
          <button
            onClick={() => setShowAiOverlay(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border ${
              showAiOverlay 
                ? 'bg-[#0052CC] text-white border-blue-400 shadow-2xs' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Overlays {showAiOverlay ? 'ON' : 'OFF'}</span>
          </button>

          {/* Grid Layout Switcher */}
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex items-center space-x-1">
            {([1, 2, 3, 4] as const).map(n => (
              <button
                key={n}
                onClick={() => setGridCount(n)}
                className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                  gridCount === n ? 'bg-[#0052CC] text-white' : 'text-slate-400 hover:text-white'
                }`}
                title={`${n}x${n} Grid View (${n * n} Streams)`}
              >
                {n}×{n}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 2. Compact Operational KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div 
          onClick={() => onNavigateTab('registry')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0052CC] cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Cameras</span>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">12,482</div>
          <span className="text-[10px] text-emerald-600 font-semibold">100% Federation</span>
        </div>

        <div 
          onClick={() => onNavigateTab('health')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-500 cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Online Feeds</span>
          <div className="text-xl font-black text-emerald-600 font-mono mt-0.5">11,938</div>
          <span className="text-[10px] text-slate-500">95.6% Nominal</span>
        </div>

        <div 
          onClick={() => onNavigateTab('live-view')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-500 cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Streams</span>
          <div className="text-xl font-black text-[#0052CC] font-mono mt-0.5">347</div>
          <span className="text-[10px] text-blue-600 font-semibold">Live Video Wall</span>
        </div>

        <div 
          onClick={() => onNavigateTab('alerts')}
          className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs hover:border-rose-500 cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Active Alerts</span>
          <div className="text-xl font-black text-rose-600 font-mono mt-0.5">{alerts.length}</div>
          <span className="text-[10px] text-rose-700 font-semibold">Action Required</span>
        </div>

        <div 
          onClick={() => onNavigateTab('anpr-search')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-500 cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">ANPR Captures Today</span>
          <div className="text-xl font-black text-purple-700 font-mono mt-0.5">8,492</div>
          <span className="text-[10px] text-slate-500">AI Edge Processing</span>
        </div>

        <div 
          onClick={() => onNavigateTab('vehicle-journey')}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-500 cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Vehicles Detected</span>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">1,284</div>
          <span className="text-[10px] text-amber-700 font-semibold">Multi-Corridor Track</span>
        </div>

      </div>

      {/* 3. Main Command Center Grid & Real-time Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Video Wall Container (Col 8 or 9 depending on screen) */}
        <div className="lg:col-span-8 bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-xl space-y-3">
          
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span className="font-mono font-semibold">DISPLAY MATRIX: {gridCount}x{gridCount} ({wallCameras.length} Active Video Tiles)</span>
            <span className="text-emerald-400 font-mono">LIVE WEBRTC / HLS STREAM ACTIVE</span>
          </div>

          {/* Dynamic Grid Layout */}
          <div className={`grid gap-2.5 ${
            gridCount === 1 ? 'grid-cols-1 h-[560px]' :
            gridCount === 2 ? 'grid-cols-1 sm:grid-cols-2 h-[560px]' :
            gridCount === 3 ? 'grid-cols-2 sm:grid-cols-3 h-[560px]' :
            'grid-cols-2 sm:grid-cols-4 h-[560px]'
          }`}>
            {wallCameras.map((camera, idx) => {
              const isMuted = !!activeMutedMap[camera.cameraUuid];
              const linkedAnpr = anprEvents.find(e => e.cameraUuid === camera.cameraUuid) || anprEvents[idx % anprEvents.length];

              return (
                <div 
                  key={camera.cameraUuid}
                  className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800 group flex flex-col justify-between shadow-md"
                >
                  {/* Simulated Camera Video Stream Canvas */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black flex items-center justify-center">
                    
                    {/* Background Grid Pattern & Optical Glare Simulation */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20"></div>
                    <img 
                      src={linkedAnpr ? linkedAnpr.vehicleImageUrl : 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80'} 
                      alt="Surveillance Feed" 
                      className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition duration-300"
                    />

                    {/* AI Bounding Box Overlays */}
                    {showAiOverlay && (
                      <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-center items-center">
                        {/* Vehicle Box */}
                        <div className="w-48 h-28 border-2 border-blue-500 bg-blue-500/10 rounded relative">
                          <span className="absolute -top-5 left-0 bg-emerald-500 text-slate-950 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded">
                            CAR • 96.4%
                          </span>

                          {/* ANPR Sub-Box */}
                          <div className="absolute bottom-2 right-2 border-2 border-amber-400 bg-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300">
                            {linkedAnpr ? linkedAnpr.plateNumber : 'GJ01AB1234'} (98.1%)
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scanning Line Effect */}
                    <div className="absolute inset-x-0 h-0.5 bg-cyan-400/50 shadow-[0_0_8px_#22d3ee] top-1/4 animate-bounce"></div>
                  </div>

                  {/* Top Feed Overlay Bar */}
                  <div className="relative z-10 p-2 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent text-[11px]">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      <span className="font-mono font-bold text-white tracking-wider">REC • {camera.cameraCode}</span>
                    </div>

                    <div className="flex items-center space-x-1 font-mono text-[10px]">
                      <span className="px-1.5 py-0.2 rounded bg-blue-900/80 text-blue-300 font-bold border border-blue-700">
                        {camera.departmentName.split('(')[0].trim()}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Feed Overlay Bar */}
                  <div className="relative z-10 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-end justify-between">
                    <div>
                      <div className="text-white font-bold text-xs truncate max-w-[180px]">{camera.name}</div>
                      <div className="text-[10px] text-slate-300 font-mono">{camera.district} • {camera.fps} FPS • {camera.resolution}</div>
                    </div>

                    {/* Floating Controls */}
                    <div className="flex items-center space-x-1 opacity-90 group-hover:opacity-100 transition">
                      <button
                        onClick={() => toggleMute(camera.cameraUuid)}
                        className="p-1 rounded bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
                        title={isMuted ? 'Unmute Stream' : 'Mute Stream'}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => onSelectCamera(camera)}
                        className="p-1 rounded bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
                        title="Camera Master Inspector"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Right: Real-time Live Event & Alert Stream Panel (Col 4) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-4">
          
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-rose-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Live AI Event Stream</h3>
              </div>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold font-mono rounded-full">
                REALTIME
              </span>
            </div>

            {/* Event List */}
            <div className="mt-3 space-y-2.5 max-h-[460px] overflow-y-auto">
              {activeLiveEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => onSelectAnprEvent && onSelectAnprEvent(event)}
                  className={`p-3 rounded-lg border text-xs transition cursor-pointer flex items-start space-x-3 ${
                    event.watchlistFlag 
                      ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/80' 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <img src={event.imageCropUrl} alt={event.plateNumber} className="w-12 h-9 rounded object-cover border border-slate-300 shrink-0 mt-0.5" />
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-black text-slate-900 text-xs">{event.plateNumber}</span>
                      <span className="text-[10px] font-mono text-slate-500">{event.timestamp.slice(11, 19)}</span>
                    </div>

                    <div className="text-[11px] text-slate-600 font-medium">
                      {event.cameraName} ({event.district})
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[#0052CC]">{event.confidence}% Confidence</span>
                      {event.watchlistFlag && (
                        <span className="px-1.5 py-0.2 bg-rose-600 text-white font-bold rounded text-[9px]">
                          WATCHLIST
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('anpr-search')}
            className="w-full py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-2xs flex items-center justify-center space-x-1.5"
          >
            <Search className="w-4 h-4" />
            <span>Open Advanced ANPR Search Engine</span>
          </button>

        </div>

      </div>

    </div>
  );
};
