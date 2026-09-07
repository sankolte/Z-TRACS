import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Upload,
  Video,
  Play,
  Pause,
  RotateCcw,
  Target,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Search,
  FileVideo,
  RefreshCw,
  Plus,
  X,
  AlertTriangle,
  Clock,
  Radio,
  Eye,
  Filter,
  FileText,
  Download,
  Trash2,
  SlidersHorizontal,
  ChevronRight,
  Zap,
  Car,
  UserCheck
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';

export interface ForensicDetection {
  detection_id: string;
  plate_number: string;
  vehicle_type: string;
  color: string;
  video_timestamp_sec: number;
  video_timestamp_formatted: string;
  confidence: number;
  plate_confidence?: number;
  watchlist_hit: boolean;
  watchlist_reason?: string;
  snapshot_crop?: string;
  frame_number?: number;
}

export interface ForensicTask {
  task_id: string;
  case_id: string;
  footage_name: string;
  location_name: string;
  video_path: string;
  models_requested: string[];
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress_percent: number;
  duration_seconds: number;
  duration_formatted: string;
  total_frames: number;
  processed_frames: number;
  processing_fps: number;
  total_detections: number;
  watchlist_hits: number;
  detections: ForensicDetection[];
  created_at: string;
}

const DEFAULT_SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export const ForensicAnalysisView: React.FC = () => {
  const [tasks, setTasks] = useState<ForensicTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ForensicTask | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State for Onboarding
  const [caseId, setCaseId] = useState('');
  const [footageName, setFootageName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedModels, setSelectedModels] = useState<string[]>(['ANPR', 'VEHICLE_CLASSIFICATION']);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Studio / Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [activeDetection, setActiveDetection] = useState<ForensicDetection | null>(null);
  const [searchPlateQuery, setSearchPlateQuery] = useState('');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Tasks
  const fetchTasks = async () => {
    setIsFetching(true);
    try {
      const data = await ApiClient.getForensicTasks();
      setTasks(data || []);
      if (data && data.length > 0 && !selectedTask) {
        setSelectedTask(data[0]);
      }
    } catch (err) {
      console.warn('[Forensics UI] Fetch error:', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Update selectedTask reference when tasks refresh
  useEffect(() => {
    if (selectedTask && tasks.length > 0) {
      const updated = tasks.find(t => t.task_id === selectedTask.task_id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFootageName(file.name);
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFootageName(file.name);
    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleModel = (model: string) => {
    setSelectedModels(prev => 
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  // Submit Footage Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId.trim()) {
      setStatusMessage('Please enter FIR / Case Reference ID.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    if (!footageName.trim() && !selectedFile) {
      setStatusMessage('Please provide or upload video footage.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setIsSubmitting(true);
    const payload = {
      case_id: caseId.trim(),
      footage_name: footageName.trim() || selectedFile?.name || 'Evidence_CCTV_Footage.mp4',
      location_name: locationName.trim() || 'Gujarat Highway Junction Node',
      models_requested: selectedModels.length > 0 ? selectedModels : ['ANPR'],
      estimated_duration_minutes: durationMinutes,
      media_base64: mediaBase64
    };

    try {
      const res = await ApiClient.createForensicTask(payload);
      setIsSubmitting(false);
      if (res && (res.status === 'success' || res.data)) {
        setStatusMessage(`Forensic Job "${caseId}" deployed to GPU Batch Engine!`);
        setIsModalOpen(false);
        setCaseId('');
        setFootageName('');
        setLocationName('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setMediaBase64(null);
        fetchTasks();
        if (res.data) setSelectedTask(res.data);
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('[Forensics Submit Error]', err);
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string, caseName: string) => {
    try {
      await ApiClient.deleteForensicTask(taskId);
      setStatusMessage(`Task "${caseName}" removed.`);
      fetchTasks();
      if (selectedTask?.task_id === taskId) {
        setSelectedTask(null);
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.warn('[Forensics Delete Error]', err);
    }
  };

  // Video Seeking to Timestamp Marker
  const handleSeekToDetection = (det: ForensicDetection) => {
    setActiveDetection(det);
    if (videoRef.current) {
      // Scale timestamp if short sample video is used, otherwise seek exact second
      const targetSec = videoRef.current.duration > 0 
        ? Math.min(videoRef.current.duration - 0.5, det.video_timestamp_sec % (videoRef.current.duration || 60))
        : det.video_timestamp_sec;
      
      videoRef.current.currentTime = targetSec;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setVideoDuration(videoRef.current.duration || 0);
    }
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Telemetry Aggregates
  const totalExtractedPlates = tasks.reduce((sum, t) => sum + (t.total_detections || 0), 0);
  const totalWatchlistHits = tasks.reduce((sum, t) => sum + (t.watchlist_hits || 0), 0);

  // Filtered Detections in Selected Task
  const detectionsList = (selectedTask?.detections || []).filter(d => {
    if (watchlistOnly && !d.watchlist_hit) return false;
    if (searchPlateQuery.trim()) {
      const q = searchPlateQuery.trim().toLowerCase();
      return (
        d.plate_number.toLowerCase().includes(q) ||
        d.vehicle_type.toLowerCase().includes(q) ||
        d.video_timestamp_formatted.includes(q)
      );
    }
    return true;
  });

  // Export CSV
  const handleExportCSV = () => {
    if (!selectedTask || !selectedTask.detections) return;
    const headers = ['Detection ID', 'License Plate', 'Vehicle Type', 'Color', 'Video Timestamp', 'Confidence (%)', 'Watchlist Match'];
    const rows = selectedTask.detections.map(d => [
      `"${d.detection_id}"`,
      `"${d.plate_number}"`,
      `"${d.vehicle_type}"`,
      `"${d.color}"`,
      `"${d.video_timestamp_formatted}"`,
      d.confidence,
      d.watchlist_hit ? 'YES (CRITICAL)' : 'NO'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Forensic_Report_${selectedTask.case_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-sans">
      
      {/* STATUS TOAST */}
      {statusMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#001f3f] border-2 border-cyan-400 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-cyan-400 animate-bounce" />
          <span className="text-xs font-black tracking-wide font-mono uppercase text-cyan-200">
            {statusMessage}
          </span>
        </div>
      )}

      {/* TOP HERO HEADER */}
      <div className="bg-gradient-to-r from-[#031b33] via-[#05294d] to-[#021529] border border-[#0d3b66] rounded-3xl p-6 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4.5">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <Film className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl md:text-2xl font-black tracking-wide uppercase text-white">
                Forensic Video Analysis & CCTV Footage AI Ingest
              </h1>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono uppercase tracking-wider">
                GPU BATCH ENGINE (265 FPS)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Upload long-duration CCTV video footage (1–4 hrs) to perform high-speed offline ANPR OCR, suspect search, and interactive timeline seeking.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
            <span>Ingest Pre-Recorded Footage</span>
          </button>

          <button
            onClick={fetchTasks}
            className="p-3 rounded-2xl bg-[#001726] hover:bg-[#00263f] text-slate-300 border border-[#00385c] transition cursor-pointer shadow"
            title="Refresh forensic tasks"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP 4 STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        
        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Forensic Video Jobs</span>
            <div className="text-2xl font-black text-white">{tasks.length}</div>
            <span className="text-[10px] text-cyan-400 font-mono">Offline Batch Processing</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
            <FileVideo className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Extracted Plates</span>
            <div className="text-2xl font-black text-emerald-400">{totalExtractedPlates}</div>
            <span className="text-[10px] text-emerald-400 font-mono">ANPR OCR Indexed</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Watchlist Hotlist Hits</span>
            <div className="text-2xl font-black text-rose-400">{totalWatchlistHits}</div>
            <span className="text-[10px] text-rose-300 font-mono">Stolen / FIR Matched</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">GPU Ingest Speed</span>
            <div className="text-xl font-black text-cyan-300 font-mono">265.4 FPS</div>
            <span className="text-[10px] text-emerald-400 font-mono">4-Hr Video in ~12 Mins</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* JOBS SELECTOR BAR */}
      <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-3.5 shadow-md flex items-center space-x-3 overflow-x-auto">
        <span className="text-xs font-black uppercase text-slate-400 tracking-wider shrink-0 flex items-center space-x-1.5">
          <Film className="w-4 h-4 text-cyan-400" />
          <span>Active Case Jobs:</span>
        </span>

        {tasks.length === 0 ? (
          <span className="text-xs text-slate-500 italic">No forensic video jobs uploaded yet. Click "+ Ingest Pre-Recorded Footage" to begin.</span>
        ) : (
          tasks.map(t => {
            const isSelected = selectedTask?.task_id === t.task_id;
            return (
              <button
                key={t.task_id}
                onClick={() => setSelectedTask(t)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-lg scale-105'
                    : 'bg-[#02111f] hover:bg-[#031d36] text-slate-300 border border-[#0e3b63]'
                }`}
              >
                <span>{t.case_id}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  isSelected ? 'bg-slate-950 text-cyan-300' : 'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {t.total_detections} Hits
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* MAIN INTERACTIVE FORENSIC STUDIO LAYOUT */}
      {selectedTask ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 7 COLUMNS: VIDEO PLAYER & METADATA */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#041a2e] border border-[#0d3457] rounded-3xl p-5 shadow-2xl space-y-4">
              
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-[#0d3457] pb-3.5">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center space-x-2">
                    <span>{selectedTask.case_id}</span>
                    <span className="text-xs text-slate-400 font-normal normal-case">({selectedTask.footage_name})</span>
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-3">
                    <span>📍 {selectedTask.location_name}</span>
                    <span>⏱ {selectedTask.duration_formatted}</span>
                    <span className="text-emerald-400 font-mono font-bold">⚡ 265 FPS Accelerated</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-3.5 py-1.5 rounded-xl bg-[#02111f] hover:bg-[#031d36] text-cyan-300 border border-[#0e3b63] text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>

                  <button
                    onClick={() => handleDeleteTask(selectedTask.task_id, selectedTask.case_id)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                    title="Delete forensic job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Video Player */}
              <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-[#0d3457] shadow-inner group">
                <video
                  ref={videoRef}
                  src={previewUrl || DEFAULT_SAMPLE_VIDEO}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                  controls={false}
                />

                {/* Overlay Bounding Box on Detected Hit */}
                {activeDetection && (
                  <div className="absolute top-4 left-4 z-20 bg-black/80 backdrop-blur-md border border-cyan-400 px-3 py-2 rounded-xl text-white shadow-2xl animate-in fade-in duration-200">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Timestamp: {activeDetection.video_timestamp_formatted}</div>
                    <div className="text-sm font-black text-cyan-300 font-mono tracking-wider">{activeDetection.plate_number}</div>
                    <div className="text-xs text-slate-200">{activeDetection.vehicle_type}</div>
                    {activeDetection.watchlist_hit && (
                      <span className="mt-1 inline-block px-2 py-0.5 rounded bg-rose-500 text-[10px] font-black uppercase text-white animate-pulse">
                        CRITICAL WATCHLIST HIT
                      </span>
                    )}
                  </div>
                )}

                {/* Controls Bar Overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex items-center justify-between text-white opacity-90 group-hover:opacity-100 transition">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          if (isPlaying) videoRef.current.pause();
                          else videoRef.current.play();
                          setIsPlaying(!isPlaying);
                        }
                      }}
                      className="w-9 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-black transition cursor-pointer shadow"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>

                    <span className="font-mono text-xs font-bold text-slate-300">
                      {formatSec(currentTime)} / {formatSec(videoDuration || selectedTask.duration_seconds)}
                    </span>
                  </div>

                  <div className="text-xs text-cyan-400 font-mono font-bold">
                    {selectedTask.models_requested.join(' • ')}
                  </div>
                </div>
              </div>

              {/* Video Timeline Scrubber & Marker Jump Strip */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Detection Timeline Markers (Click to Jump):</span>
                  <span>{selectedTask.detections.length} Total Vehicles</span>
                </div>

                <div className="relative h-7 bg-[#02111f] rounded-xl border border-[#0d3457] overflow-hidden flex items-center px-2">
                  {selectedTask.detections.map((det) => {
                    const pct = Math.min(98, Math.max(2, (det.video_timestamp_sec / selectedTask.duration_seconds) * 100));
                    return (
                      <button
                        key={det.detection_id}
                        onClick={() => handleSeekToDetection(det)}
                        style={{ left: `${pct}%` }}
                        className={`absolute w-2.5 h-4.5 rounded-sm transition transform -translate-x-1/2 cursor-pointer ${
                          det.watchlist_hit
                            ? 'bg-rose-500 hover:scale-150 z-20 shadow-rose-500/50 shadow-md animate-pulse'
                            : 'bg-cyan-400 hover:bg-cyan-300 hover:scale-125 z-10'
                        }`}
                        title={`${det.plate_number} at ${det.video_timestamp_formatted}`}
                      />
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT 5 COLUMNS: DETECTED PLATES GALLERY & TIMELINE */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#041a2e] border border-[#0d3457] rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col h-full max-h-[640px]">
              
              {/* Header & Filters */}
              <div className="space-y-3 border-b border-[#0d3457] pb-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                    <span>Scanned License Plates</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                      {detectionsList.length} Found
                    </span>
                  </h3>

                  <button
                    onClick={() => setWatchlistOnly(!watchlistOnly)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                      watchlistOnly
                        ? 'bg-rose-500 text-white shadow-lg'
                        : 'bg-[#02111f] text-slate-400 border border-[#0e3b63] hover:text-white'
                    }`}
                  >
                    🚨 Watchlist Hits ({selectedTask.watchlist_hits})
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search plate number or timestamp..."
                    value={searchPlateQuery}
                    onChange={(e) => setSearchPlateQuery(e.target.value)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>

              {/* Detections Scroll List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {detectionsList.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">
                    No detections match your filter.
                  </div>
                ) : (
                  detectionsList.map((det) => {
                    const isSelected = activeDetection?.detection_id === det.detection_id;
                    return (
                      <div
                        key={det.detection_id}
                        onClick={() => handleSeekToDetection(det)}
                        className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#062c4e] border-cyan-400 shadow-lg scale-[1.02]'
                            : det.watchlist_hit
                            ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20'
                            : 'bg-[#02111f] border-[#0c2f4e] hover:border-cyan-500/40 hover:bg-[#03182b]'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm font-black text-white tracking-wider">
                              {det.plate_number}
                            </span>
                            {det.watchlist_hit && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500 text-white tracking-wider animate-pulse">
                                STOLEN HIT
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-300 truncate">
                            {det.vehicle_type}
                          </div>

                          <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                            <span className="text-cyan-300 font-bold">⏱ {det.video_timestamp_formatted}</span>
                            <span>Confidence: {det.confidence}%</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-xs transition flex items-center space-x-1 shrink-0 cursor-pointer"
                        >
                          <span>🎯 Seek</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

        </div>
      ) : null}

      {/* MODAL: ONBOARD PRE-RECORDED CCTV FOOTAGE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#03192e] border border-[#0d3b66] rounded-3xl w-full max-w-2xl text-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#0d3b66] bg-[#021324]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Film className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-white">Ingest Pre-Recorded CCTV Footage</h3>
                  <p className="text-xs text-slate-400">Submit DVR / USB video file (1–4 hrs) to offline GPU batch AI analyzer.</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTask} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Drag & Drop Area */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Video Footage File (.mp4, .avi, .mkv) <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-cyan-400 normal-case font-normal">Supports Direct High-Speed Chunked Ingest</span>
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] relative ${
                    previewUrl
                      ? 'border-cyan-500/60 bg-[#02111f]'
                      : 'border-[#0e3b63] hover:border-cyan-400 bg-[#021324] hover:bg-[#031b33]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/x-matroska,video/avi,video/quicktime"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {previewUrl ? (
                    <div className="w-full flex flex-col items-center space-y-2">
                      <video src={previewUrl} className="max-h-32 rounded-xl shadow border border-slate-700 w-full object-cover" />
                      <span className="text-xs text-cyan-300 font-mono font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{selectedFile?.name || 'Footage Loaded'}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-11 h-11 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                        <FileVideo className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-200">
                        Drop CCTV Video File (1–4 hrs) here
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Supports MP4, AVI, MKV, MOV (Direct GPU accelerated decode)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Case ID & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Case / FIR Reference ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FIR-AHM-9021"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Footage Source / Junction Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SG Highway Gota Flyover Junction"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration Slider */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  <span>Footage Duration:</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {durationMinutes >= 60 ? `${(durationMinutes / 60).toFixed(1)} Hours` : `${durationMinutes} Minutes`}
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="240"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                  <span>15 Mins</span>
                  <span>1 Hour</span>
                  <span>2 Hours</span>
                  <span>4 Hours</span>
                </div>
              </div>

              {/* AI Models Checklist */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Select AI Models to Run on Footage:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'ANPR', label: 'ANPR License Plates', icon: Car },
                    { id: 'VEHICLE_CLASSIFICATION', label: 'Vehicle Type / Color', icon: SlidersHorizontal },
                    { id: 'FACE_RECOGNITION', label: 'Facial Search (FRS)', icon: UserCheck }
                  ].map((m) => {
                    const isChecked = selectedModels.includes(m.id);
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleModel(m.id)}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center space-x-2 transition cursor-pointer text-left ${
                          isChecked
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                            : 'bg-[#02111f] border-[#0e3b63] text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-[11px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#0d3b66]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Deploying Batch Task...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-slate-950 fill-current" />
                      <span>Start Forensic Analysis</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
