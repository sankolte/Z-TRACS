import React, { useState, useEffect } from 'react';
import { 
  X, 
  Video, 
  Maximize2, 
  Volume2, 
  VolumeX, 
  Camera as CameraIcon, 
  Cpu, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Minus,
  Sparkles,
  Shield,
  Radio,
  CheckCircle2
} from 'lucide-react';
import { Camera } from '../types';

interface LiveStreamModalProps {
  camera: Camera | null;
  onClose: () => void;
  onInspectSpecs: (camera: Camera) => void;
}

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({
  camera,
  onClose,
  onInspectSpecs,
}) => {
  const [isMuted, setIsMuted] = useState(true);
  const [showAiBoxes, setShowAiBoxes] = useState(true);
  const [timestamp, setTimestamp] = useState('');
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [ptzMessage, setPtzMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + ' IST');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!camera) return null;

  const handlePtzAction = (action: string) => {
    setPtzMessage(`PTZ Command: ${action} sent to ${camera.id}`);
    setTimeout(() => setPtzMessage(null), 2000);
  };

  const handleSnapshot = () => {
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 2500);
  };

  // Select video / image simulation based on camera type / location
  const streamPosterUrl = camera.type === 'Thermal'
    ? 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=1200&auto=format&fit=crop&q=80'
    : camera.type === 'ANPR'
    ? 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=1200&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200&auto=format&fit=crop&q=80';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-500/40 text-red-400 flex items-center space-x-1.5">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="text-[11px] font-black tracking-wider uppercase">LIVE FEED</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-white text-sm">{camera.id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  camera.status === 'online' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  camera.status === 'degraded' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {camera.status}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold">
                  {camera.type}
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate max-w-md">{camera.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onInspectSpecs(camera)}
              className="px-3 py-1.5 rounded-lg bg-[#0072ce] hover:bg-[#005bb5] text-xs text-white font-semibold transition"
            >
              Full Specs & Telemetry
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player Canvas View */}
        <div className="relative bg-[#050914] flex-1 min-h-[380px] sm:min-h-[460px] overflow-hidden group select-none">
          {/* Simulated Video Background */}
          <img
            src={streamPosterUrl}
            alt="CCTV Stream Feed"
            className="w-full h-full object-cover opacity-90 filter contrast-110"
          />

          {/* Scanline CRT overlay effect */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40"></div>

          {/* Live Watermark & Stream Meta Header */}
          <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
            <div className="bg-slate-950/90 backdrop-blur-xs border border-slate-700 px-3.5 py-2 rounded text-white font-mono text-xs shadow-lg space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="text-red-500 font-bold">● REC</span>
                <span className="text-[#0072ce] font-bold">{camera.id}</span>
                <span className="text-slate-300">[{camera.district}]</span>
              </div>
              <div className="text-[11px] text-slate-300">{timestamp || '2026-03-29 14:32:00 IST'}</div>
              <div className="text-[10px] text-slate-400">
                {camera.resolution} | {camera.fps} FPS | {camera.bitrateKbps} Kbps | Ping: {camera.latencyMs}ms
              </div>
            </div>

            <div className="bg-slate-950/90 backdrop-blur-xs border border-slate-700 px-3.5 py-2 rounded text-white font-mono text-xs shadow-lg text-right">
              <div className="text-white font-bold">{camera.vmsSystem}</div>
              <div className="text-[10px] text-slate-300">{camera.ipAddress} (ONVIF Profile S)</div>
            </div>
          </div>

          {/* AI Detection Bounding Boxes Overlay */}
          {showAiBoxes && camera.status !== 'offline' && (
            <>
              {/* Simulated Vehicle Bounding Box */}
              <div className="absolute top-[32%] left-[24%] w-[26%] h-[28%] border-2 border-blue-500 bg-blue-500/10 rounded-sm pointer-events-none">
                <div className="absolute -top-5 left-0 bg-emerald-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shadow">
                  VEHICLE (GJ01-ER-4092) 98.4%
                </div>
              </div>

              {/* Simulated Person Bounding Box */}
              <div className="absolute top-[48%] left-[68%] w-[12%] h-[34%] border-2 border-[#0072ce] bg-[#0072ce]/10 rounded-sm pointer-events-none">
                <div className="absolute -top-5 left-0 bg-[#0072ce] text-white text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shadow">
                  PEDESTRIAN 96.1%
                </div>
              </div>

              {/* Speed or Helmet Tag */}
              <div className="absolute top-[28%] left-[54%] border border-[#0072ce] bg-slate-900/90 px-2 py-0.5 rounded text-white text-[10px] font-mono pointer-events-none">
                AI SPEED: 44 KM/H [NOMINAL]
              </div>
            </>
          )}

          {/* Snapshot Confirmation Alert */}
          {snapshotTaken && (
            <div className="absolute inset-0 bg-white/20 flex items-center justify-center pointer-events-none transition-all">
              <div className="bg-slate-950/95 border border-slate-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-white">Snapshot Captured & Tagged</p>
                  <p className="text-[10px] text-slate-300 font-mono">Saved to Secure Evidence Vault</p>
                </div>
              </div>
            </div>
          )}

          {/* PTZ Trigger feedback toast */}
          {ptzMessage && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-800 border border-[#0072ce] text-white text-xs px-4 py-1.5 rounded-full shadow-lg font-mono font-bold">
              {ptzMessage}
            </div>
          )}

          {/* Bottom Floating Video Controls Toolbar */}
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between shadow-xl">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                title={isMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={() => setShowAiBoxes(!showAiBoxes)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  showAiBoxes
                    ? 'bg-[#0072ce] text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle AI Detection Bounding Boxes"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Overlay</span>
              </button>

              <button
                onClick={handleSnapshot}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
                title="Capture Frame to Evidence Archive"
              >
                <CameraIcon className="w-3.5 h-3.5 text-[#0072ce]" />
                <span className="hidden sm:inline">Evidence Snapshot</span>
              </button>
            </div>

            {/* PTZ Mini Joystick if Camera is PTZ */}
            {camera.type === 'PTZ' ? (
              <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-[#0072ce] uppercase tracking-wider mr-1">PTZ</span>
                <button
                  onClick={() => handlePtzAction('PAN LEFT')}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePtzAction('TILT UP')}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePtzAction('TILT DOWN')}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePtzAction('PAN RIGHT')}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-800 mx-1"></div>
                <button
                  onClick={() => handlePtzAction('ZOOM IN +')}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePtzAction('ZOOM OUT -')}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-mono hidden md:block">
                Fixed Angle Stream ({camera.resolution})
              </div>
            )}

            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>30 FPS</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer Details Bar */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-slate-300 font-medium">Department:</span> {camera.department}
            </div>
            <div>
              <span className="text-slate-300 font-medium">Location:</span> {camera.location}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-slate-300">GPS: {camera.coordinates.lat.toFixed(4)}° N, {camera.coordinates.lng.toFixed(4)}° E</span>
          </div>
        </div>

      </div>
    </div>
  );
};
