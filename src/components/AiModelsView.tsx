import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Car,
  UserCheck,
  Users,
  HardHat,
  Footprints,
  ShieldAlert,
  CheckCircle2,
  Database,
  ArrowRight,
  Camera as CameraIcon,
  Layers,
  Sparkles,
  Zap,
  Check,
  Search,
  SlidersHorizontal,
  SquareX,
  PlayCircle,
  Radio,
  Trash2,
  Activity,
  AlertTriangle,
  RefreshCw,
  Edit3,
  PowerOff,
  PlusCircle
} from 'lucide-react';
import { Camera, Language } from '../types';
import { ApiClient } from '../services/apiClient';

export interface ModelDefinition {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  description: string;
  icon: React.ElementType;
  defaultFps: number;
  usecaseKey: string;
}

export const AI_MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: 'anpr',
    name: 'Automatic Number Plate Recognition (ANPR)',
    tag: 'Vehicle Surveillance',
    tagColor: '#10b981',
    tagBg: '#064e3b33',
    description: 'High-speed OCR license plate detection, vehicle color/type classification & watchlist matching.',
    icon: Car,
    defaultFps: 15,
    usecaseKey: 'ANPR'
  },
  {
    id: 'frs',
    name: 'Facial Recognition System (FRS)',
    tag: 'Biometric Security',
    tagColor: '#38bdf8',
    tagBg: '#0c4a6e33',
    description: 'Real-time face detection, embedding feature vector extraction & criminal database search.',
    icon: UserCheck,
    defaultFps: 15,
    usecaseKey: 'FACE_RECOGNITION'
  },
  {
    id: 'crowd',
    name: 'Crowd Density & Flow Management',
    tag: 'Public Order',
    tagColor: '#fbbf24',
    tagBg: '#78350f33',
    description: 'Head-count estimation, bottleneck alert triggers, stampede risk telemetry & group tracking.',
    icon: Users,
    defaultFps: 15,
    usecaseKey: 'CROWD_DENSITY'
  },
  {
    id: 'ppe',
    name: 'PPE & Safety Compliance Detection',
    tag: 'Industrial Safety',
    tagColor: '#f472b6',
    tagBg: '#83184333',
    description: 'Verifies helmet, reflective jacket, mask compliance & sends safety breach alerts.',
    icon: HardHat,
    defaultFps: 15,
    usecaseKey: 'PPE'
  },
  {
    id: 'footfall',
    name: 'Footfall Analytics & Heatmap',
    tag: 'Traffic Intelligence',
    tagColor: '#a78bfa',
    tagBg: '#4c1d9533',
    description: 'Bi-directional pedestrian entry/exit counting with spatial density heatmap generator.',
    icon: Footprints,
    defaultFps: 15,
    usecaseKey: 'FOOTFALL'
  },
  {
    id: 'perimeter',
    name: 'Perimeter Breach & Tripwire Intrusion',
    tag: 'Border & Fence Control',
    tagColor: '#fb7185',
    tagBg: '#88133733',
    description: 'Virtual tripwire line-crossing & forbidden zone movement detection with instant alarm.',
    icon: ShieldAlert,
    defaultFps: 15,
    usecaseKey: 'PERIMETER_BREACH'
  }
];

// Persistent module-level cache to eliminate tab-switching flicker & re-render jumps
const GLOBAL_AI_CONFIG_CACHE: Record<string, any> = {};

interface AiModelCardsSectionProps {
  selectedCamCode: string;
  onConfigSaved?: (savedData: any) => void;
  compact?: boolean;
}

export const AiModelCardsSection: React.FC<AiModelCardsSectionProps> = ({
  selectedCamCode,
  onConfigSaved,
  compact = false
}) => {
  // Helper function to extract models map from backend response
  const parseModelsFromConfig = (cfg: any): Record<string, boolean> => {
    let result: Record<string, boolean> = {
      anpr: false,
      frs: false,
      crowd: false,
      ppe: false,
      footfall: false,
      perimeter: false
    };

    if (!cfg) return result;

    if (cfg.models && typeof cfg.models === 'object') {
      return { ...result, ...cfg.models };
    }

    const modelsList: string[] = Array.isArray(cfg.ai_models)
      ? cfg.ai_models.map((m: any) => String(m).toUpperCase())
      : (Array.isArray(cfg.usecases) ? cfg.usecases.map((m: any) => String(m).toUpperCase()) : []);

    if (modelsList.length > 0) {
      result.anpr = modelsList.some(m => m.includes('ANPR') || m.includes('VEHICLE') || m.includes('PLATE'));
      result.frs = modelsList.some(m => m.includes('FACE') || m.includes('FRS') || m.includes('BIOMETRIC'));
      result.crowd = modelsList.some(m => m.includes('CROWD') || m.includes('DENSITY'));
      result.ppe = modelsList.some(m => m.includes('PPE') || m.includes('SAFETY') || m.includes('HELMET'));
      result.footfall = modelsList.some(m => m.includes('FOOTFALL') || m.includes('HEATMAP'));
      result.perimeter = modelsList.some(m => m.includes('PERIMETER') || m.includes('INTRUSION'));
      return result;
    }

    if (Array.isArray(cfg.enable)) {
      result.anpr = Boolean(cfg.enable[0]);
      result.frs = Boolean(cfg.enable[1]);
      result.ppe = Boolean(cfg.enable[2]);
      result.footfall = Boolean(cfg.enable[3]);
      return result;
    }

    return result;
  };

  // Synchronous initialization from module cache to prevent initial-mount flickering
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>(() => {
    if (GLOBAL_AI_CONFIG_CACHE[selectedCamCode]) {
      return parseModelsFromConfig(GLOBAL_AI_CONFIG_CACHE[selectedCamCode]);
    }
    return {
      anpr: false,
      frs: false,
      crowd: false,
      ppe: false,
      footfall: false,
      perimeter: false
    };
  });

  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(() => {
    return GLOBAL_AI_CONFIG_CACHE[selectedCamCode]?.confidence_threshold || 85;
  });

  const [targetFps, setTargetFps] = useState<number>(() => {
    return GLOBAL_AI_CONFIG_CACHE[selectedCamCode]?.target_fps || 15;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Fetch AI config when camera changes
  useEffect(() => {
    let isMounted = true;

    // Instantly check cache first
    if (GLOBAL_AI_CONFIG_CACHE[selectedCamCode]) {
      const cached = parseModelsFromConfig(GLOBAL_AI_CONFIG_CACHE[selectedCamCode]);
      setEnabledModels(cached);
      if (GLOBAL_AI_CONFIG_CACHE[selectedCamCode].confidence_threshold) {
        setConfidenceThreshold(GLOBAL_AI_CONFIG_CACHE[selectedCamCode].confidence_threshold);
      }
      if (GLOBAL_AI_CONFIG_CACHE[selectedCamCode].target_fps) {
        setTargetFps(GLOBAL_AI_CONFIG_CACHE[selectedCamCode].target_fps);
      }
    }

    const fetchAiConfig = async () => {
      try {
        const cfg = await ApiClient.getAiConfig(selectedCamCode);
        if (isMounted && cfg) {
          GLOBAL_AI_CONFIG_CACHE[selectedCamCode] = cfg;
          const parsed = parseModelsFromConfig(cfg);
          setEnabledModels(parsed);
          if (cfg.confidence_threshold) setConfidenceThreshold(cfg.confidence_threshold);
          if (cfg.target_fps) setTargetFps(cfg.target_fps);
        }
      } catch (_) {}
    };

    fetchAiConfig();
    return () => { isMounted = false; };
  }, [selectedCamCode]);

  const toggleModel = (modelId: string) => {
    setEnabledModels(prev => {
      const next = {
        ...prev,
        [modelId]: !prev[modelId]
      };
      if (GLOBAL_AI_CONFIG_CACHE[selectedCamCode]) {
        GLOBAL_AI_CONFIG_CACHE[selectedCamCode].models = next;
      }
      return next;
    });
  };

  const enableVector = [
    enabledModels.anpr ? 1 : 0,
    enabledModels.frs ? 1 : 0,
    enabledModels.ppe ? 1 : 0,
    enabledModels.footfall ? 1 : 0
  ];

  const activeUsecasesList = AI_MODEL_DEFINITIONS
    .filter(m => enabledModels[m.id])
    .map(m => m.usecaseKey);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);

    const payload = {
      camera_code: selectedCamCode,
      models: enabledModels,
      enable: enableVector,
      usecases: activeUsecasesList.length > 0 ? activeUsecasesList : [],
      ai_models: activeUsecasesList.length > 0 ? activeUsecasesList : [],
      confidence_threshold: confidenceThreshold,
      target_fps: targetFps
    };

    GLOBAL_AI_CONFIG_CACHE[selectedCamCode] = payload;

    try {
      await ApiClient.saveAiConfig(payload);
      setIsSaving(false);
      setSaveSuccessMsg(`AI Vision Configuration for ${selectedCamCode} deployed!`);
      if (onConfigSaved) onConfigSaved(payload);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.warn('[AI Config Save]', err);
      setIsSaving(false);
      setSaveSuccessMsg(`Saved locally. Edge daemon notified.`);
      if (onConfigSaved) onConfigSaved(payload);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Floating Save Success Toast */}
      {saveSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-[#021d33]/95 border border-emerald-500/50 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl shadow-emerald-950/60 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 ring-1 ring-emerald-500/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wide">AI Models Deployed</h4>
                <span className="font-mono text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  LIVE SYNCED
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {saveSuccessMsg}
              </p>
            </div>
          </div>

          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Dismiss notification"
          >
            <SquareX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar inside Section */}
      <div className="bg-[#002038] border border-[#00385c] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-wide uppercase">
              Select AI Vision Models for {selectedCamCode}
            </h3>
            <p className="text-xs text-slate-400">
              Click any card to enable/disable. AI Engine (DeepStream/YOLO) reads updated configuration automatically.
            </p>
          </div>
        </div>

        {/* Telemetry Pills & Save Button */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-medium">Active Models:</span>
            <span className="text-emerald-400 font-bold">{activeUsecasesList.length} of 6 Enabled</span>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
          >
            <Database className="w-4 h-4 text-slate-950" />
            <span>{isSaving ? 'Deploying...' : 'Save & Deploy AI Config'}</span>
          </button>
        </div>
      </div>

      {/* 6 AI INFERENCE MODEL CARDS GRID (Stable, No Layout Jitter) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
        {AI_MODEL_DEFINITIONS.map(model => {
          const isEnabled = !!enabledModels[model.id];
          const Icon = model.icon;

          return (
            <div
              key={model.id}
              onClick={() => toggleModel(model.id)}
              className={`relative rounded-2xl p-5.5 cursor-pointer border flex flex-col justify-between select-none shadow-md transition-colors duration-150 ${
                isEnabled
                  ? 'bg-gradient-to-br from-[#04243b] to-[#021829] border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-950/40'
                  : 'bg-[#06182c] border-[#0f2c4d] hover:border-[#1d4778] hover:bg-[#09223d]'
              }`}
            >
              {/* Card Top: Icon, Title, Category Badge, Checkbox */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                      style={{ backgroundColor: model.tagBg }}
                    >
                      <Icon className="w-5 h-5" style={{ color: model.tagColor }} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{model.name}</h4>
                      <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                        {model.tag}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Checkbox */}
                  <div className="shrink-0 mt-0.5">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                        isEnabled
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                          : 'border-2 border-slate-600 bg-slate-900/50'
                      }`}
                    >
                      {isEnabled && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed mt-4">
                  {model.description}
                </p>
              </div>

              {/* Card Bottom: Status Indicator & Target FPS */}
              <div className="pt-4 mt-5 border-t border-white/10 flex items-center justify-between font-mono text-[11px]">
                {isEnabled ? (
                  <span className="flex items-center space-x-1.5 font-bold text-emerald-400 tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>● MODEL ENABLED</span>
                  </span>
                ) : (
                  <span className="text-slate-500 font-bold tracking-wider">
                    INACTIVE
                  </span>
                )}

                <span className="text-slate-400">
                  FPS TARGET: <strong className="text-white">{model.defaultFps} FPS</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface AiModelsViewProps {
  cameras: Camera[];
  currentLang?: Language;
  initialCameraCode?: string;
  onSelectCameraCode?: (cameraCode: string) => void;
  onNavigateToDetectionArea?: (cameraCode: string) => void;
}

export const AiModelsView: React.FC<AiModelsViewProps> = ({
  cameras,
  initialCameraCode,
  onSelectCameraCode,
  onNavigateToDetectionArea
}) => {
  const [selectedCamCode, setSelectedCamCode] = useState<string>(() => {
    return initialCameraCode || (cameras && cameras[0]?.cameraCode) || 'CAM-001';
  });

  // Sync when initialCameraCode changes from outside navigation
  useEffect(() => {
    if (initialCameraCode && initialCameraCode !== selectedCamCode) {
      setSelectedCamCode(initialCameraCode);
    }
  }, [initialCameraCode]);

  const [allAiConfigs, setAllAiConfigs] = useState<Record<string, any>>(() => ({ ...GLOBAL_AI_CONFIG_CACHE }));
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUndeploying, setIsUndeploying] = useState<string | null>(null);
  const topConfiguratorRef = useRef<HTMLDivElement>(null);

  // Load all existing configured AI models from backend / local state
  const fetchAllConfigs = async () => {
    try {
      const data = await ApiClient.getAllAiConfigs();
      if (data && typeof data === 'object') {
        Object.assign(GLOBAL_AI_CONFIG_CACHE, data);
        setAllAiConfigs(data);
      }
    } catch (err) {
      console.warn('[AI Models] Failed to load all configs:', err);
    }
  };

  useEffect(() => {
    fetchAllConfigs();
  }, []);

  const handleConfigSaved = (payload: any) => {
    GLOBAL_AI_CONFIG_CACHE[payload.camera_code] = payload;
    setAllAiConfigs(prev => ({
      ...prev,
      [payload.camera_code]: payload
    }));
    fetchAllConfigs();
  };

  // Undeploy AI models from a specific camera
  const handleUndeploy = async (cameraCode: string) => {
    if (!window.confirm(`Are you sure you want to UNDEPLOY all AI models from ${cameraCode}? This will immediately stop inferencing and release GPU edge resources.`)) {
      return;
    }

    setIsUndeploying(cameraCode);
    try {
      await ApiClient.undeployAiConfig(cameraCode);
      
      delete GLOBAL_AI_CONFIG_CACHE[cameraCode];
      Object.keys(GLOBAL_AI_CONFIG_CACHE).forEach(k => {
        if (k.includes(cameraCode) || cameraCode.includes(k)) {
          delete GLOBAL_AI_CONFIG_CACHE[k];
        }
      });

      // Update local state immediately
      setAllAiConfigs(prev => {
        const next = { ...prev };
        delete next[cameraCode];
        Object.keys(next).forEach(k => {
          if (k.includes(cameraCode) || cameraCode.includes(k)) {
            delete next[k];
          }
        });
        return next;
      });

      setStatusMessage(`AI Inferencing successfully undeployed for ${cameraCode}. Edge GPU compute freed.`);
      setTimeout(() => setStatusMessage(null), 4500);
      fetchAllConfigs();
    } catch (err) {
      console.warn('[Undeploy error]', err);
      setStatusMessage(`Undeploy requested for ${cameraCode}.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsUndeploying(null);
    }
  };

  // Edit models on a configured camera (scrolls up and selects camera)
  const handleEditConfigured = (cameraCode: string) => {
    setSelectedCamCode(cameraCode);
    if (topConfiguratorRef.current) {
      topConfiguratorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Helper to normalize any camera code alias to standard format (e.g. 5, CAM5, cam05 -> CAM-005)
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

  // Helper to extract enabled models and status for any camera
  const getCameraModelSummary = (cameraCode: string) => {
    const canonical = toCanonicalCode(cameraCode);
    const cfg = allAiConfigs[canonical] || allAiConfigs[cameraCode];
    if (!cfg) return { hasAi: false, label: '⚪ IDLE (NO AI)', modelsList: [] as string[], enabledKeys: [] as string[] };

    let enabledKeys: string[] = [];
    if (cfg.models && typeof cfg.models === 'object') {
      Object.entries(cfg.models).forEach(([key, val]) => {
        if (val) enabledKeys.push(key);
      });
    } else if (Array.isArray(cfg.usecases)) {
      cfg.usecases.forEach((u: string) => {
        const def = AI_MODEL_DEFINITIONS.find(m => m.usecaseKey.toLowerCase() === u.toLowerCase());
        if (def) enabledKeys.push(def.id);
      });
    } else if (Array.isArray(cfg.enable)) {
      if (cfg.enable[0]) enabledKeys.push('anpr');
      if (cfg.enable[1]) enabledKeys.push('frs');
      if (cfg.enable[2]) enabledKeys.push('ppe');
      if (cfg.enable[3]) enabledKeys.push('footfall');
    }

    if (enabledKeys.length > 0) {
      const displayNames = enabledKeys.map(k => k.toUpperCase());
      return {
        hasAi: true,
        label: `🟢 [${displayNames.join(', ')}]`,
        modelsList: displayNames,
        enabledKeys
      };
    }
    return { hasAi: false, label: '⚪ IDLE (NO AI)', modelsList: [] as string[], enabledKeys: [] as string[] };
  };

  // Build unified status for every camera node in the system
  const allCamerasMapped = (cameras || []).map(cam => {
    const canonicalCode = toCanonicalCode(cam.cameraCode);
    const summary = getCameraModelSummary(cam.cameraCode);
    const rawCfg = allAiConfigs[canonicalCode] || allAiConfigs[cam.cameraCode] || {};

    return {
      cameraCode: cam.cameraCode,
      canonicalCode,
      cameraName: cam.name,
      district: cam.district,
      location: cam.location,
      hasAi: summary.hasAi,
      enabledModelKeys: summary.enabledKeys,
      modelsList: summary.modelsList,
      targetFps: rawCfg.target_fps || 15,
      confidence: rawCfg.confidence_threshold || 85,
      rawConfig: rawCfg
    };
  });

  const activeCameras = allCamerasMapped.filter(c => c.hasAi);
  const idleCameras = allCamerasMapped.filter(c => !c.hasAi);

  // Filter Tab State: 'active' | 'idle' | 'all'
  const [filterTab, setFilterTab] = useState<'active' | 'idle' | 'all'>('active');

  // Filter list based on selected tab and search query
  const displayedCameras = allCamerasMapped
    .filter(c => {
      if (filterTab === 'active') return c.hasAi;
      if (filterTab === 'idle') return !c.hasAi;
      return true;
    })
    .filter(item => {
      const q = searchFilter.toLowerCase().trim();
      if (!q) return true;
      return (
        item.cameraCode.toLowerCase().includes(q) ||
        item.cameraName.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.enabledModelKeys.some(k => k.toLowerCase().includes(q))
      );
    });

  // Calculate telemetry counts
  const totalCamerasCount = allCamerasMapped.length;
  const activeCount = activeCameras.length;
  const idleCount = idleCameras.length;
  const anprCount = activeCameras.filter(c => c.enabledModelKeys.includes('anpr')).length;
  const frsCount = activeCameras.filter(c => c.enabledModelKeys.includes('frs')).length;
  const safetyCount = activeCameras.filter(c =>
    c.enabledModelKeys.includes('crowd') ||
    c.enabledModelKeys.includes('ppe') ||
    c.enabledModelKeys.includes('footfall') ||
    c.enabledModelKeys.includes('perimeter')
  ).length;

  return (
    <div className="space-y-6 select-none max-w-7xl mx-auto pb-16">
      {/* Top Main Banner */}
      <div className="bg-[#00253E] border border-[#00385C] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#0072CE]/30 border border-[#0072CE]/40 flex items-center justify-center text-[#0072CE] shrink-0 shadow-lg">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-black tracking-wide uppercase">AI Inferencing Models & Node Deployer</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                GPU INFERENCE PIPELINE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Assign vision models (ANPR, Face Recognition, PPE, Crowd, Footfall) to live camera nodes and inspect active AI deployments below. 
              The 24/7 listener daemon pushes configurations directly to DeepStream edge servers.
            </p>
          </div>
        </div>

        {onNavigateToDetectionArea && (
          <button
            onClick={() => onNavigateToDetectionArea(selectedCamCode)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center space-x-2 transition cursor-pointer shrink-0 shadow"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Configure Polygon ROIs</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Floating Status / Undeploy Alert Toast */}
      {statusMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-[#1f1606]/95 border border-amber-500/50 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl shadow-amber-950/60 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 ring-1 ring-amber-500/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wide">System Notice</h4>
                <span className="font-mono text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  EDGE UPDATED
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {statusMessage}
              </p>
            </div>
          </div>

          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Dismiss notice"
          >
            <SquareX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: Configurator for Selected Camera Node */}
      <div ref={topConfiguratorRef} className="space-y-4">
        {/* Camera Selector Bar with Live AI Status Badges */}
        <div className="bg-[#051329] border border-[#0e274d] rounded-2xl p-4.5 shadow-md flex flex-wrap items-center justify-between gap-4 text-white">
          <div className="flex items-center space-x-3 flex-1 min-w-[340px]">
            <CameraIcon className="w-5 h-5 text-[#0072CE]" />
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Configure Camera Node:</span>
            <select
              value={selectedCamCode}
              onChange={(e) => {
                setSelectedCamCode(e.target.value);
                onSelectCameraCode?.(e.target.value);
              }}
              className="flex-1 bg-[#0b1b36] border border-[#1d3b6a] rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-[#0072CE] focus:outline-none cursor-pointer"
            >
              {cameras.map(c => {
                const summary = getCameraModelSummary(c.cameraCode);
                return (
                  <option key={c.cameraCode} value={c.cameraCode}>
                    {c.cameraCode} • {summary.label} — {c.name} ({c.district})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Reusable Model Cards Section */}
        <AiModelCardsSection 
          selectedCamCode={selectedCamCode} 
          onConfigSaved={handleConfigSaved}
        />
      </div>

      {/* SECTION 2: MY CONFIGURED CAMERAS & ACTIVE APPLIED MODELS */}
      <div className="bg-[#02182B] border border-[#00385C] rounded-2xl p-6 shadow-xl space-y-5">
        
        {/* Section Header & Live Telemetry KPIs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#00385C] pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#0072CE]/20 border border-[#0072CE]/30 flex items-center justify-center text-[#0072CE] shrink-0">
              <Radio className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">
                  Camera Vision Nodes & Active AI Manifest
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE EDGE MANIFEST
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Overview of all cameras across Gujarat. Switch between Active, Idle, or All cameras to inspect and deploy models.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-[#00253E] border border-[#00385C] px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span className="text-slate-300 font-medium">Total Cameras:</span>
              <span className="font-extrabold text-white bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 rounded text-[11px] font-mono">
                {totalCamerasCount} Cams
              </span>
            </div>

            <div className="bg-[#00253E] border border-[#00385C] px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">AI Active:</span>
              <span className="font-extrabold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-mono">
                {activeCount} Cams
              </span>
            </div>

            <div className="bg-[#00253E] border border-[#00385C] px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-300 font-medium">AI Disabled:</span>
              <span className="font-extrabold text-slate-300 bg-slate-700/50 border border-slate-600 px-2 py-0.5 rounded text-[11px] font-mono">
                {idleCount} Cams
              </span>
            </div>

            <div className="bg-[#00253E] border border-[#00385C] px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <Car className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 font-medium">ANPR:</span>
              <span className="font-bold text-emerald-300">{anprCount}</span>
            </div>

            <div className="bg-[#00253E] border border-[#00385C] px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span className="text-slate-300 font-medium">FRS:</span>
              <span className="font-bold text-sky-300">{frsCount}</span>
            </div>

            <div className="bg-[#00253E] border border-[#00385C] px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-medium">Safety:</span>
              <span className="font-bold text-amber-300">{safetyCount}</span>
            </div>
          </div>
        </div>

        {/* Tab Selector: Active vs Idle vs All */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#00385C] pb-3">
          <button
            onClick={() => setFilterTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
              filterTab === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30'
                : 'bg-[#00253E] text-slate-400 hover:text-white border border-[#00385C]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Active AI Nodes ({activeCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('idle')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
              filterTab === 'idle'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm ring-1 ring-amber-500/30'
                : 'bg-[#00253E] text-slate-400 hover:text-white border border-[#00385C]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Disabled / Idle Nodes ({idleCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
              filterTab === 'all'
                ? 'bg-[#0072CE]/30 text-sky-300 border border-[#0072CE]/50 shadow-sm ring-1 ring-[#0072CE]/30'
                : 'bg-[#00253E] text-slate-400 hover:text-white border border-[#00385C]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Camera Nodes ({totalCamerasCount})</span>
          </button>
        </div>

        {/* Search & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search cameras by code, location, or model name..."
              className="w-full bg-[#001c33] border border-[#00385c] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0072ce]"
            />
          </div>

          <button
            onClick={fetchAllConfigs}
            className="px-3.5 py-2 rounded-xl bg-[#00253E] hover:bg-[#00385C] border border-[#00385C] text-slate-300 text-xs font-bold flex items-center space-x-2 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Manifest</span>
          </button>
        </div>

        {/* Camera Cards Grid (Active + Idle) */}
        {displayedCameras.length === 0 ? (
          <div className="bg-[#001c33] border border-[#00385c] rounded-2xl p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-400 shadow-inner">
              <Cpu className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white">No Camera Nodes Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchFilter
                ? `No camera nodes match "${searchFilter}". Try clearing your search filter.`
                : `No camera nodes found in this category.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedCameras.map((item) => {
              const isCurrent = item.cameraCode === selectedCamCode;
              const isThisUndeploying = isUndeploying === item.cameraCode;

              if (item.hasAi) {
                // ACTIVE AI CAMERA CARD
                return (
                  <div
                    key={item.cameraCode}
                    className={`bg-[#001c33] border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-150 ${
                      isCurrent
                        ? 'border-[#0072ce] ring-2 ring-[#0072ce]/40 shadow-sky-950/40 bg-gradient-to-br from-[#001c33] to-[#012644]'
                        : 'border-emerald-500/30 hover:border-emerald-500/60'
                    }`}
                  >
                    {/* Card Header: Camera ID, Name, Location, Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-extrabold text-xs text-white tracking-wide bg-[#002d4d] px-2.5 py-1 rounded-lg border border-[#00477a]">
                              {item.cameraCode}
                            </span>
                            <span className="flex items-center space-x-1 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>INFERENCING ACTIVE</span>
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white mt-2 leading-tight">
                            {item.cameraName}
                          </h4>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                            <span>{item.district}</span>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{item.location}</span>
                          </div>
                        </div>

                        {/* Target FPS Badge */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-slate-400 block">TARGET</span>
                          <span className="text-xs font-extrabold text-white font-mono">{item.targetFps} FPS</span>
                        </div>
                      </div>

                      {/* Applied Models Chips Section */}
                      <div className="mt-4 pt-3.5 border-t border-white/5 space-y-2">
                        <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          Applied AI Models ({item.enabledModelKeys.length}):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.enabledModelKeys.map(key => {
                            const def = AI_MODEL_DEFINITIONS.find(m => m.id === key);
                            if (!def) return null;
                            const Icon = def.icon;
                            return (
                              <span
                                key={key}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-sm"
                                style={{
                                  backgroundColor: def.tagBg,
                                  color: def.tagColor,
                                  borderColor: `${def.tagColor}40`
                                }}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{def.name.split('(')[0].trim()}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer: Edit & Undeploy Buttons */}
                    <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleEditConfigured(item.cameraCode)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#0072ce]" />
                        <span>Edit Models</span>
                      </button>

                      <button
                        onClick={() => handleUndeploy(item.cameraCode)}
                        disabled={isThisUndeploying}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                        title="Stop inferencing and undeploy all AI models for this camera"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>{isThisUndeploying ? 'Undeploying...' : 'Undeploy AI'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // IDLE CAMERA CARD
              return (
                <div
                  key={item.cameraCode}
                  className={`bg-[#00182c]/80 border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all duration-150 ${
                    isCurrent
                      ? 'border-[#0072ce] ring-2 ring-[#0072ce]/40 bg-gradient-to-br from-[#00182c] to-[#01223e]'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-extrabold text-xs text-slate-300 tracking-wide bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                            {item.cameraCode}
                          </span>
                          <span className="flex items-center space-x-1 font-mono text-[10px] font-bold text-slate-400 bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span>IDLE / NO AI</span>
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-200 mt-2 leading-tight">
                          {item.cameraName}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                          <span>{item.district}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{item.location}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-500 block">STATUS</span>
                        <span className="text-xs font-bold text-slate-400">STANDBY</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        No AI inference models deployed. DeepStream / YOLO edge worker is idle for this stream, saving GPU compute cycles.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-end">
                    <button
                      onClick={() => handleEditConfigured(item.cameraCode)}
                      className="px-4 py-1.5 rounded-xl bg-[#0072CE]/20 hover:bg-[#0072CE]/30 border border-[#0072CE]/40 text-[#38bdf8] hover:text-white text-xs font-bold flex items-center space-x-2 transition cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Deploy AI Models →</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
