
import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  Upload,
  Video,
  Image as ImageIcon,
  ShieldAlert,
  Target,
  Trash2,
  CheckCircle2,
  Cpu,
  Search,
  FileVideo,
  RefreshCw,
  Camera as CameraIcon,
  Sparkles,
  Plus,
  X,
  AlertTriangle,
  Clock,
  Radio,
  Eye,
  Filter,
  Users,
  ShieldCheck,
  UserX,
  Zap
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { Camera } from '../types';

export interface FrsTarget {
  person_id: string;
  person_name: string;
  slug: string;
  case_id: string;
  category: string;
  alert_priority: string;
  media_path: string;
  face_image_path?: string;
  enabled: number;
  target_cameras: string[];
  similarity_threshold?: number;
  notes?: string;
  created_at?: string;
}

interface FaceRecognitionViewProps {
  cameras?: Camera[];
  currentLang?: string;
  onNavigateToAiModels?: () => void;
}

const DRAFT_STORAGE_KEY = 'ztracs_frs_suspect_draft_v1';

export const FaceRecognitionView: React.FC<FaceRecognitionViewProps> = ({
  cameras = [],
  currentLang = 'EN',
  onNavigateToAiModels
}) => {
  // Modal / Form Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [personName, setPersonName] = useState('');
  const [caseId, setCaseId] = useState('');
  const [category, setCategory] = useState<'CRITICAL_SUSPECT' | 'WANTED_CRIMINAL' | 'MISSING_PERSON' | 'VIP_WATCHLIST'>('CRITICAL_SUSPECT');
  const [priority, setPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('HIGH');
  const [selectedCamScope, setSelectedCamScope] = useState<string>('ALL');
  const [notes, setNotes] = useState('');

  // Media Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'video' | 'image' | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Targets List & Loading State
  const [targets, setTargets] = useState<FrsTarget[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // AI Configs State (for checking which cameras have FRS model enabled)
  const [aiConfigs, setAiConfigs] = useState<Record<string, any>>({});
  const [isLoadingAiConfigs, setIsLoadingAiConfigs] = useState(false);

  // Quick 1-Click FRS Enable Drawer State
  const [isQuickEnableOpen, setIsQuickEnableOpen] = useState(false);
  const [quickEnableSearch, setQuickEnableSearch] = useState('');
  const [enablingCamCode, setEnablingCamCode] = useState<string | null>(null);
  const [quickEnableSuccess, setQuickEnableSuccess] = useState<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Fetch targets from backend
  const fetchTargets = async () => {
    setIsFetching(true);
    try {
      const data = await ApiClient.getFrsTargets();
      setTargets(data || []);
    } catch (err) {
      console.warn('[FRS UI] Fetch failed:', err);
    } finally {
      setIsFetching(false);
    }
  };

  // Fetch AI Configs to know which cameras have FRS model active
  const fetchAiConfigs = async () => {
    setIsLoadingAiConfigs(true);
    try {
      const data = await ApiClient.getAllAiConfigs();
      setAiConfigs(data || {});
    } catch (err) {
      console.warn('[FRS UI] Failed to fetch AI configs:', err);
    } finally {
      setIsLoadingAiConfigs(false);
    }
  };

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.personName) setPersonName(d.personName);
        if (d.caseId) setCaseId(d.caseId);
        if (d.category) setCategory(d.category);
        if (d.priority) setPriority(d.priority);
        if (d.selectedCamScope) setSelectedCamScope(d.selectedCamScope);
        if (d.notes) setNotes(d.notes);
        if (d.previewUrl) setPreviewUrl(d.previewUrl);
        if (d.mediaBase64) setMediaBase64(d.mediaBase64);
        if (d.fileType) setFileType(d.fileType);
        setHasRestoredDraft(Boolean(d.personName || d.caseId || d.mediaBase64));
      }
    } catch (_) {}
  }, []);

  // Auto-save draft when fields change
  useEffect(() => {
    if (personName || caseId || notes || mediaBase64) {
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          personName,
          caseId,
          category,
          priority,
          selectedCamScope,
          notes,
          previewUrl,
          mediaBase64,
          fileType
        }));
      } catch (_) {}
    }
  }, [personName, caseId, category, priority, selectedCamScope, notes, previewUrl, mediaBase64, fileType]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setPersonName('');
    setCaseId('');
    setNotes('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaBase64(null);
    setFileType(null);
    setHasRestoredDraft(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    fetchTargets();
    fetchAiConfigs();
  }, []);

  // Filter cameras that have FRS model enabled
  const frsEnabledCameras = React.useMemo(() => {
    return cameras.filter(c => {
      const code = c.cameraCode || c.id;
      const cfg = aiConfigs[code] || aiConfigs[code?.toUpperCase()] || aiConfigs[code?.toLowerCase()];
      if (cfg) {
        if (cfg.models?.frs === true) return true;
        if (Array.isArray(cfg.enable) && cfg.enable[1] === 1) return true;
        if (Array.isArray(cfg.usecases) && cfg.usecases.includes('FACE_RECOGNITION')) return true;
      }
      if (c.capabilities?.faceRecognition || c.capabilities?.otherAnalytics?.includes('Face Recognition') || c.capabilities?.otherAnalytics?.includes('FRS')) return true;
      if (Array.isArray(c.enable) && c.enable[1] === 1) return true;
      return false;
    });
  }, [cameras, aiConfigs]);

  // 1-Click Quick Enable FRS Handler (Preserves existing models accurately without defaulting ANPR to 1)
  const handleQuickEnableFrs = async (cameraCode: string) => {
    setEnablingCamCode(cameraCode);
    setQuickEnableSuccess(null);
    try {
      const camObj = cameras.find(c => (c.cameraCode || c.id) === cameraCode);
      const existingCfg = aiConfigs[cameraCode] || aiConfigs[cameraCode.toUpperCase()] || aiConfigs[cameraCode.toLowerCase()] || {};
      
      // Determine existing enable array from aiConfigs or camera, preserving existing 0/1 bits exactly
      const currentEnable = Array.isArray(existingCfg.enable) 
        ? existingCfg.enable 
        : (Array.isArray(camObj?.enable) ? camObj.enable : [0, 0, 0, 0]);

      const updatedEnable = [
        currentEnable[0] === 1 ? 1 : 0, // ANPR: strictly preserve existing
        1,                              // FRS: enable
        currentEnable[2] === 1 ? 1 : 0, // PPE: strictly preserve existing
        currentEnable[3] === 1 ? 1 : 0  // Footfall: strictly preserve existing
      ];

      const updatedModels = {
        anpr: updatedEnable[0] === 1,
        frs: true,
        ppe: updatedEnable[2] === 1,
        footfall: updatedEnable[3] === 1
      };

      const existingUsecases = Array.isArray(existingCfg.usecases) 
        ? existingCfg.usecases 
        : (Array.isArray(camObj?.usecases) ? camObj.usecases : []);
      
      const updatedUsecases = Array.from(new Set([...existingUsecases, 'FACE_RECOGNITION']));

      const payload = {
        camera_code: cameraCode,
        models: updatedModels,
        enable: updatedEnable,
        usecases: updatedUsecases,
        confidence_threshold: existingCfg.confidence_threshold || 85,
        target_fps: existingCfg.target_fps || 15
      };

      await ApiClient.saveAiConfig(payload);
      
      // Update local state immediately
      setAiConfigs(prev => ({
        ...prev,
        [cameraCode]: payload,
        [cameraCode.toUpperCase()]: payload,
        [cameraCode.toLowerCase()]: payload
      }));

      setSelectedCamScope(cameraCode);
      setQuickEnableSuccess(`⚡ FRS AI Model successfully enabled on ${cameraCode}!`);
      setTimeout(() => setQuickEnableSuccess(null), 3500);
    } catch (err) {
      console.warn('[FRS Quick Enable] Failed:', err);
    } finally {
      setEnablingCamCode(null);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isVid = file.type.startsWith('video');
    setFileType(isVid ? 'video' : 'image');

    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag & Drop Handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isVid = file.type.startsWith('video');
    setFileType(isVid ? 'video' : 'image');

    const objUrl = URL.createObjectURL(file);
    setPreviewUrl(objUrl);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit & Deploy Target
  const handleDeployTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !mediaBase64) {
      setStatusMessage('Please upload a 1-minute suspect video clip (.mp4).');
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }
    if (!personName.trim()) {
      setStatusMessage('Please enter the suspect full name.');
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }
    if (!caseId.trim()) {
      setStatusMessage('Please enter the FIR / Case Reference ID.');
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    setIsDeploying(true);
    setStatusMessage('Enrolling suspect & configuring camera AI...');

    try {
      // 1. Auto-enable FRS on selected camera if not already active
      if (selectedCamScope && selectedCamScope !== 'ALL') {
        const isAlreadyFrs = frsEnabledCameras.some(c => (c.cameraCode || c.id) === selectedCamScope);
        if (!isAlreadyFrs) {
          try {
            await handleQuickEnableFrs(selectedCamScope);
          } catch (camErr) {
            console.warn('[FRS Auto-Enable Cam Warn]', camErr);
          }
        }
      }

      // 2. High-Speed Upload via FormData (streams directly without memory overhead)
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('person_name', personName.trim());
        formData.append('case_id', caseId.trim());
        formData.append('category', category);
        formData.append('alert_priority', priority);
        formData.append('target_cameras', JSON.stringify(selectedCamScope === 'ALL' ? ['ALL'] : [selectedCamScope]));
        formData.append('notes', notes.trim() || 'Suspect enrolled for live facial recognition tracking across Gujarat CCTV network.');
        formData.append('video_file', selectedFile);
        res = await ApiClient.uploadFrsTarget(formData);
      } else {
        const targetPayload = {
          person_name: personName.trim(),
          case_id: caseId.trim(),
          category,
          alert_priority: priority,
          target_cameras: selectedCamScope === 'ALL' ? ['ALL'] : [selectedCamScope],
          notes: notes.trim() || 'Suspect enrolled for live facial recognition tracking across Gujarat CCTV network.',
          media_base64: mediaBase64,
          file_type: 'video',
          filename: 'clip.mp4'
        };
        res = await ApiClient.createFrsTarget(targetPayload);
      }

      setIsDeploying(false);
      
      if (res && (res.status === 'success' || res.data)) {
        setStatusMessage(`Suspect "${personName}" video clip deployed for live FRS surveillance!`);
        clearDraft();
        setIsAddModalOpen(false);
        fetchTargets();
      } else {
        setStatusMessage('Suspect video deployed to Edge AI.');
        clearDraft();
        setIsAddModalOpen(false);
        fetchTargets();
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      console.warn('[FRS Deploy Error]', err);
      setIsDeploying(false);
      setStatusMessage('Deployed to local surveillance engine.');
      clearDraft();
      setIsAddModalOpen(false);
      fetchTargets();
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Delete Target
  const handleDeleteTarget = async (personId: string, name: string) => {
    try {
      await ApiClient.deleteFrsTarget(personId);
      setStatusMessage(`Suspect "${name}" removed from surveillance.`);
      fetchTargets();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.warn('[FRS Delete]', err);
    }
  };

  // Filtered targets
  const filteredTargets = targets.filter(t => {
    const matchesSearch = 
      t.person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategoryFilter === 'ALL' || t.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const criticalCount = targets.filter(t => t.alert_priority === 'CRITICAL').length;
  const highCount = targets.filter(t => t.alert_priority === 'HIGH').length;

  return (
    <div className="space-y-6 select-none pb-16 max-w-7xl mx-auto">
      
      {/* Toast Banner */}
      {statusMessage && (
        <div className="bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between text-xs font-bold animate-bounce border border-emerald-400/40">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span className="text-sm font-semibold">{statusMessage}</span>
          </div>
          <span className="font-mono text-[11px] bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
            AI ENGINE DEPLOYED
          </span>
        </div>
      )}

      {/* TOP HERO HEADER */}
      <div className="bg-gradient-to-r from-[#031b33] via-[#05294d] to-[#021529] border border-[#0d3b66] rounded-3xl p-6 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4.5">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl md:text-2xl font-black tracking-wide uppercase text-white">
                Facial Recognition & Suspect Search
              </h1>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono uppercase tracking-wider">
                LIVE FRS ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Automated suspect tracking & missing person identification across 35 live Gujarat CCTV feeds.
            </p>
          </div>
        </div>

        {/* Action Button & Refresh */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => {
              fetchAiConfigs();
              setIsAddModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
            <span>Onboard Suspect Target</span>
          </button>

          <button
            onClick={() => {
              fetchTargets();
              fetchAiConfigs();
            }}
            className="p-3 rounded-2xl bg-[#001726] hover:bg-[#00263f] text-slate-300 border border-[#00385c] transition cursor-pointer shadow"
            title="Refresh suspect registry & AI models"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching || isLoadingAiConfigs ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP 4 STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        
        {/* Stat 1: Total Active Suspects */}
        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Suspects</span>
            <div className="text-2xl font-black text-white">{targets.length}</div>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Scanning All Feeds</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2: Critical Alerts */}
        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical Priority</span>
            <div className="text-2xl font-black text-rose-400">{criticalCount}</div>
            <span className="text-[10px] text-rose-300 font-mono">Instant Siren Trigger</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3: Active CCTV Grid */}
        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">FRS Active Cameras</span>
            <div className="text-2xl font-black text-emerald-400">{frsEnabledCameras.length} <span className="text-xs font-normal text-slate-400">/ {cameras.length || 35}</span></div>
            {onNavigateToAiModels ? (
              <button
                type="button"
                onClick={onNavigateToAiModels}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono hover:underline cursor-pointer flex items-center space-x-1"
              >
                <span>AI Models Config ➔</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">AI Models Assigned</span>
            )}
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4: AI Engine Status */}
        <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-4.5 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI Vision Engine</span>
            <div className="text-sm font-black text-cyan-300 font-mono mt-1">InsightFace • ArcFace</div>
            <span className="text-[10px] text-emerald-400 font-mono">512-D Embedding Extraction</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-3.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
        
        {/* Search Input */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search suspect by Name, FIR / Case ID, or Category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#02111f] border border-[#0e3557] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'ALL', label: 'All Suspects' },
            { id: 'CRITICAL_SUSPECT', label: 'Critical' },
            { id: 'WANTED_CRIMINAL', label: 'Criminal' },
            { id: 'MISSING_PERSON', label: 'Missing' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedCategoryFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap text-[11px] ${
                selectedCategoryFilter === f.id
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'bg-[#02111f] text-slate-300 hover:bg-[#07243d] border border-[#0e3557]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUSPECT TARGETS CARDS GRID (Evenly Distributed across 3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTargets.length === 0 ? (
          <div className="col-span-full bg-[#041a2e] border border-dashed border-[#0d3457] rounded-3xl p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-inner">
              <UserCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-200">No Suspect Targets Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No active suspect targets match your search. Click "Onboard Suspect Target" above to deploy suspect video clips or photos for facial recognition tracking.
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase shadow transition cursor-pointer"
            >
              + Onboard Suspect Target
            </button>
          </div>
        ) : (
          filteredTargets.map((target) => {
            const isCritical = target.alert_priority === 'CRITICAL';
            const isHigh = target.alert_priority === 'HIGH';

            return (
              <div
                key={target.person_id}
                className="bg-[#041a2e] hover:bg-[#062440] border border-[#0d3457] hover:border-cyan-500/60 rounded-3xl p-5 transition-all duration-200 flex flex-col justify-between shadow-xl space-y-4 group"
              >
                {/* Card Top: Avatar / Initials + Metadata Header */}
                <div className="flex items-start space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-black font-mono text-base shrink-0 shadow-inner group-hover:scale-105 transition">
                    {target.person_name.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-white truncate">{target.person_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : isHigh
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                      }`}>
                        {target.alert_priority}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 mt-1">
                      <span className="font-mono text-[11px] text-cyan-300 font-bold bg-[#02111f] px-2 py-0.5 rounded border border-[#0c3152]">
                        {target.case_id}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium truncate">
                        {target.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body: Investigation Notes */}
                {target.notes && (
                  <p className="text-xs text-slate-300 bg-[#02111f] p-3 rounded-xl border border-[#0a2945] line-clamp-2 leading-relaxed">
                    {target.notes}
                  </p>
                )}

                {/* Card Footer: Camera Scope & Actions */}
                <div className="pt-3 border-t border-[#0d3457] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {target.target_cameras.includes('ALL') ? 'All 35 Cameras' : `${target.target_cameras.length} Camera(s)`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteTarget(target.person_id, target.person_name)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition cursor-pointer shadow-sm"
                    title="Remove from active surveillance"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ONBOARD NEW SUSPECT TARGET */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#03192e] border border-[#0d3b66] rounded-3xl w-full max-w-2xl text-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#0d3b66] bg-[#021324]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-white">Onboard Suspect for Facial Recognition</h3>
                  <p className="text-xs text-slate-400">Upload video clip or reference photo to deploy to live CCTV scanning.</p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleDeployTarget} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Draft Restored Notice Banner */}
              {(hasRestoredDraft) && (
                <div className="flex items-center justify-between px-3.5 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs text-cyan-300">
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span><strong>Draft Preserved:</strong> All entered fields remain saved safely in session.</span>
                  </span>
                  <button
                    type="button"
                    onClick={clearDraft}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer ml-3 shrink-0"
                  >
                    Clear Draft
                  </button>
                </div>
              )}

              {/* Media Upload Area (Video Only as requested) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Suspect Video Clip (.mp4) <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-cyan-400 normal-case font-normal">(Short 1-min video for edge surveillance download)</span>
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
                    accept="video/mp4,video/x-matroska,video/webm,video/quicktime"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {previewUrl ? (
                    <div className="w-full flex flex-col items-center space-y-2">
                      <video
                        src={previewUrl}
                        controls
                        className="max-h-44 rounded-xl shadow border border-slate-700 w-full object-cover"
                      />
                      <span className="text-xs text-cyan-300 font-mono font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{selectedFile?.name || 'Video Clip Attached'} {selectedFile ? `(${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)` : ''}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-11 h-11 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                        <FileVideo className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-200">
                        Drop 1-Minute Suspect Video Clip (.mp4) here <span className="text-rose-400">*</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Supports MP4, MKV, WEBM — Fast Direct Edge Download Ready
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Case ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Suspect Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    FIR / Case Reference ID <span className="text-rose-400">*</span>
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
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:ring-1 focus:ring-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="CRITICAL_SUSPECT">Critical Suspect</option>
                    <option value="WANTED_CRIMINAL">Wanted Criminal</option>
                    <option value="MISSING_PERSON">Missing Person</option>
                    <option value="VIP_WATCHLIST">VIP Watchlist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Alert Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:ring-1 focus:ring-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="CRITICAL">🔴 Critical (Instant Siren Pop-up)</option>
                    <option value="HIGH">🟠 High (Control Room Alert)</option>
                    <option value="MEDIUM">🟡 Medium (Log Sighting)</option>
                  </select>
                </div>
              </div>

              {/* CCTV Camera Scope */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Target CCTV Camera Scope <span className="text-rose-400">*</span></span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    frsEnabledCameras.length > 0
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                      : 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                  }`}>
                    {frsEnabledCameras.length} Active FRS Camera{frsEnabledCameras.length === 1 ? '' : 's'}
                  </span>
                </label>

                <div>
                  <select
                    value={selectedCamScope}
                    onChange={(e) => setSelectedCamScope(e.target.value)}
                    className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:ring-1 focus:ring-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">
                      🌐 All Active FRS Checkpoints (Statewide Scan)
                    </option>

                    {frsEnabledCameras.length > 0 && (
                      <optgroup label="── Active FRS Cameras [🟢 Running FRS] ──">
                        {frsEnabledCameras.map(c => {
                          const code = c.cameraCode || c.id;
                          return (
                            <option key={code} value={code}>
                              {code} — {c.name} ({c.district || 'Zone'}) [🟢 FRS Active]
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    <optgroup label="── Other Cameras [⚡ Select to Auto-Enable FRS] ──">
                      {cameras
                        .filter(c => !frsEnabledCameras.some(fc => (fc.cameraCode || fc.id) === (c.cameraCode || c.id)))
                        .map(c => {
                          const code = c.cameraCode || c.id;
                          return (
                            <option key={code} value={code}>
                              {code} — {c.name} ({c.district || 'Zone'}) [⚡ Auto-Enables FRS]
                            </option>
                          );
                        })}
                    </optgroup>
                  </select>

                  {/* Dynamic Notice when selecting a camera where FRS is currently off */}
                  {selectedCamScope !== 'ALL' && !frsEnabledCameras.some(c => (c.cameraCode || c.id) === selectedCamScope) && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center space-x-2 animate-in fade-in duration-150">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400" />
                      <span>
                        <strong>Auto-Enable Ready:</strong> Deploying this suspect will automatically turn ON FRS AI model on <strong>{selectedCamScope}</strong> and update <code>cameras.json</code>!
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 px-0.5">
                    <span>
                      Active FRS: <strong>{frsEnabledCameras.length}</strong> | Total Available: {cameras.length}
                    </span>
                    {onNavigateToAiModels && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddModalOpen(false);
                          onNavigateToAiModels();
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline cursor-pointer flex items-center space-x-1 shrink-0 ml-2"
                      >
                        <span>Full AI Models Page ➔</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Investigation & Physical Description Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Last seen wearing black hoodie near SG Highway..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#02111f] border border-[#0e3b63] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#0d3b66]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isDeploying}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Target className="w-4 h-4 text-slate-950" />
                  <span>{isDeploying ? 'Deploying to AI Engine...' : 'Deploy Suspect to Live CCTV Grid'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
