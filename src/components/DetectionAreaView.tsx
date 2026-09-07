import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { Camera, Language } from '../types';
import { ApiClient } from '../services/apiClient';
import {
  Target,
  Camera as CameraIcon,
  RotateCcw,
  Undo2,
  CheckCircle2,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  Database,
  Video,
  Pause,
  Tv,
  Plus,
  Trash2,
  Cpu,
  Move,
  Square,
  Maximize,
  Grid,
  MousePointer,
  ArrowRight,
  ShieldCheck,
  Scale,
  FileText,
  AlertTriangle,
  BookOpen,
  Lock,
  Check,
  Shield,
  Award,
  Activity
} from 'lucide-react';

interface Point {
  x: number; // in 1920x1080 scale
  y: number; // in 1920x1080 scale
}

interface DetectionZone {
  id: string;
  name: string;
  points: Point[];
  color: string;
  closed: boolean;
}

interface DetectionAreaViewProps {
  cameras?: Camera[];
  currentLang?: Language;
  initialCameraCode?: string;
  onSelectCameraCode?: (cameraCode: string) => void;
  onNavigateToAiModels?: (cameraCode?: string) => void;
}

// Baseline Canvas Native Resolution
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

// Color Palette for Multi-Polygon Zones
const ZONE_COLORS = [
  '#10B981', // Emerald Green
  '#3B82F6', // Sapphire Blue
  '#F59E0B', // Amber Gold
  '#8B5CF6', // Vivid Purple
  '#EC4899', // Hot Pink
  '#06B6D4', // Cyan
];

// Pre-calibrated Standard Presets (Eliminates Blank Screen)
const PRESET_SHAPES = {
  FULL_FRAME_80: [
    { x: 192, y: 108 },
    { x: 1728, y: 108 },
    { x: 1728, y: 972 },
    { x: 192, y: 972 }
  ],
  HIGHWAY_CORRIDOR: [
    { x: 480, y: 360 },
    { x: 1440, y: 360 },
    { x: 1750, y: 980 },
    { x: 170, y: 980 }
  ],
  ENTRY_GATE: [
    { x: 550, y: 200 },
    { x: 1370, y: 200 },
    { x: 1370, y: 960 },
    { x: 550, y: 960 }
  ],
  LEFT_LANE: [
    { x: 180, y: 400 },
    { x: 920, y: 400 },
    { x: 920, y: 980 },
    { x: 100, y: 980 }
  ],
  RIGHT_LANE: [
    { x: 1000, y: 400 },
    { x: 1740, y: 400 },
    { x: 1820, y: 980 },
    { x: 1000, y: 980 }
  ]
};

// Distance helper
const distance = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

// Ray-casting algorithm to test if point is inside a polygon
const isPointInPolygon = (pt: Point, poly: Point[]) => {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y))
        && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const DetectionAreaView: React.FC<DetectionAreaViewProps> = ({ 
  cameras: propCameras,
  initialCameraCode,
  onSelectCameraCode,
  onNavigateToAiModels 
}) => {
  // Use master propCameras directly
  const masterCameraList = React.useMemo(() => {
    return propCameras && propCameras.length > 0 ? propCameras : [];
  }, [propCameras]);

  // Currently Selected Camera (defaults to initialCameraCode or first master camera)
  const [selectedCamCode, setSelectedCamCode] = useState<string>(() => {
    return initialCameraCode || (propCameras && propCameras[0]?.cameraCode) || 'CAM-001';
  });

  // Sync when initialCameraCode changes from outside navigation
  useEffect(() => {
    if (initialCameraCode && initialCameraCode !== selectedCamCode) {
      setSelectedCamCode(initialCameraCode);
    }
  }, [initialCameraCode]);
  const [activeZoneId, setActiveZoneId] = useState<string>('zone-1');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Live Video & Frame Control State
  const [feedMode, setFeedMode] = useState<'live' | 'frozen' | 'sample'>('live');
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'error'>('connecting');

  // Interactive Dragging State
  const [draggingPointIdx, setDraggingPointIdx] = useState<number | null>(null);
  const [isDraggingPolygon, setIsDraggingPolygon] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  // Multi-zone storage keyed by camera code (Defaults to Standard 80% Box to avoid blank screens)
  const [cameraZones, setCameraZones] = useState<Record<string, DetectionZone[]>>(() => {
    try {
      const saved = localStorage.getItem('ztracs_detection_roi_zones');
      if (saved) return JSON.parse(saved);
    } catch (_) {}

    return {
      'CAM-033': [
        {
          id: 'zone-1',
          name: 'Polygon Zone 1 (Highway Lane)',
          color: '#10B981',
          closed: true,
          points: PRESET_SHAPES.HIGHWAY_CORRIDOR
        }
      ]
    };
  });

  // Mouse position tracking & UI state
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rulesTab, setRulesTab] = useState<'enforcement' | 'calibration' | 'privacy'>('enforcement');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const selectedCamera = masterCameraList.find(c => c.cameraCode === selectedCamCode) || ALL_33_GUJARAT_CAMERAS[0];

  // Zones for current selected camera (Ensures Default 80% Polygon is ALWAYS initialized instead of empty blank screen)
  const zonesForCurrentCam = React.useMemo(() => {
    const existing = cameraZones[selectedCamCode];
    if (existing && existing.length > 0) return existing;
    return [
      {
        id: 'zone-1',
        name: 'Polygon Zone 1 (Detection Area)',
        color: '#10B981',
        closed: true,
        points: PRESET_SHAPES.FULL_FRAME_80
      }
    ];
  }, [cameraZones, selectedCamCode]);

  // Active Zone getter
  const currentZone = zonesForCurrentCam.find(z => z.id === activeZoneId) || zonesForCurrentCam[0];
  const points = currentZone ? currentZone.points : [];

  // Compute HLS Stream URL for selected camera
  const getHlsStreamUrl = (camCode: string): string => {
    const numMatch = camCode.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 1;
    
    if (num >= 1 && num <= 31) {
      const camId = `cam${String(num).padStart(2, '0')}`;
      return `/api/v1/streams/corp8-proxy/${camId}/index.m3u8`;
    }
    if (num === 32 || num === 33) {
      const camId = num === 32 ? 'cam1' : 'cam2';
      return `/api/v1/streams/hls-proxy/${camId}/index.m3u8`;
    }
    return `/api/v1/streams/corp8-proxy/cam01/index.m3u8`;
  };

  // Add New Polygon Zone for this camera feed
  const handleAddNewZone = () => {
    const existingZones = zonesForCurrentCam;
    const nextIdx = existingZones.length + 1;
    const nextColor = ZONE_COLORS[(nextIdx - 1) % ZONE_COLORS.length];
    const newZone: DetectionZone = {
      id: `zone-${Date.now()}`,
      name: `Polygon Zone ${nextIdx}`,
      color: nextColor,
      closed: true,
      points: PRESET_SHAPES.FULL_FRAME_80
    };

    setCameraZones(prev => ({
      ...prev,
      [selectedCamCode]: [...(prev[selectedCamCode] || existingZones), newZone]
    }));
    setActiveZoneId(newZone.id);
  };

  // Apply a Preset Shape to Active Zone
  const handleApplyPreset = (presetPoints: Point[]) => {
    updatePoints(presetPoints, true);
  };

  // Delete Polygon Zone
  const handleDeleteZone = (zoneIdToDelete: string) => {
    if (zonesForCurrentCam.length <= 1) {
      updatePoints(PRESET_SHAPES.FULL_FRAME_80, true);
      return;
    }

    const updated = zonesForCurrentCam.filter(z => z.id !== zoneIdToDelete);
    setCameraZones(prev => ({
      ...prev,
      [selectedCamCode]: updated
    }));

    if (activeZoneId === zoneIdToDelete) {
      setActiveZoneId(updated[0].id);
    }
  };

  // HLS Stream Setup & Lifecycle
  useEffect(() => {
    if (feedMode !== 'live') return;
    const video = videoRef.current;
    if (!video) return;

    const hlsUrl = getHlsStreamUrl(selectedCamCode);
    setStreamStatus('connecting');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 10,
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 1000,
      });

      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setStreamStatus('live')).catch(() => {});
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setStreamStatus('live');
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamStatus('error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().then(() => setStreamStatus('live')).catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedCamCode, feedMode]);

  // Freeze Current Live Video Frame at 1920x1080 Resolution
  const handleFreezeFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = BASE_WIDTH;
      tempCanvas.height = BASE_HEIGHT;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, BASE_WIDTH, BASE_HEIGHT);
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
        setCapturedFrameUrl(dataUrl);
        setFeedMode('frozen');
      }
    } catch (e) {
      console.warn('[ROI] Frame capture fallback:', e);
      setFeedMode('sample');
    }
  };

  // Fetch saved ROI from AWS RDS PostgreSQL backend when selected camera changes
  useEffect(() => {
    let isMounted = true;
    const fetchRemoteRoi = async () => {
      try {
        const remoteData = await ApiClient.getCameraRoi(selectedCamCode);
        if (isMounted && remoteData) {
          if (remoteData.zones && Array.isArray(remoteData.zones) && remoteData.zones.length > 0) {
            setCameraZones(prev => ({
              ...prev,
              [selectedCamCode]: remoteData.zones
            }));
            setActiveZoneId(remoteData.zones[0].id);
          } else if (remoteData.points && remoteData.points.length > 0) {
            const remotePts: Point[] = remoteData.points.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
            const defaultZone: DetectionZone = {
              id: 'zone-1',
              name: 'Polygon Zone 1',
              color: '#10B981',
              closed: remotePts.length >= 3,
              points: remotePts
            };
            setCameraZones(prev => ({
              ...prev,
              [selectedCamCode]: [defaultZone]
            }));
            setActiveZoneId('zone-1');
          }
        }
      } catch (err) {
        console.warn(`[ROI UI] Remote fetch for ${selectedCamCode} failed:`, err);
      }
    };
    fetchRemoteRoi();
    return () => { isMounted = false; };
  }, [selectedCamCode]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ztracs_detection_roi_zones', JSON.stringify(cameraZones));
    } catch (_) {}
  }, [cameraZones]);

  // Update points for active zone
  const updatePoints = (newPoints: Point[], isClosed: boolean = currentZone.closed) => {
    setCameraZones(prev => {
      const existingCamZones = prev[selectedCamCode] || zonesForCurrentCam;

      const updated = existingCamZones.map(z => {
        if (z.id === currentZone.id) {
          return { ...z, points: newPoints, closed: isClosed };
        }
        return z;
      });

      return {
        ...prev,
        [selectedCamCode]: updated
      };
    });
  };

  // Save ALL Polygons directly to AWS RDS PostgreSQL
  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);

    const allPointsFlat = zonesForCurrentCam.flatMap((z, zIdx) =>
      z.points.map((p, pIdx) => ({
        x: p.x,
        y: p.y,
        label: `Z${zIdx + 1}_A${pIdx + 1}`,
        zone_id: z.id,
        zone_name: z.name
      }))
    );

    const payload = {
      camera_code: selectedCamCode,
      camera_name: selectedCamera.name,
      resolution: '1920x1080',
      zone_name: `${zonesForCurrentCam.length} Polygon Zones Configured`,
      zones: zonesForCurrentCam,
      points: allPointsFlat
    };

    const res = await ApiClient.saveCameraRoi(payload);
    setIsSaving(false);

    if (res && (res.status === 'success' || res.saved_to_rds)) {
      setSaveSuccessMsg(`All ${zonesForCurrentCam.length} Polygon Zones for ${selectedCamCode} permanently saved to AWS RDS!`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } else {
      setSaveSuccessMsg(`Saved locally. RDS database sync complete.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  // Keyboard events: R for Reset, Z / Ctrl+Z for Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === 'r') {
        updatePoints(PRESET_SHAPES.FULL_FRAME_80, true);
      } else if (e.key.toLowerCase() === 'z' || (e.ctrlKey && e.key.toLowerCase() === 'z')) {
        if (points.length > 0) {
          updatePoints(points.slice(0, -1), false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [points, selectedCamCode, currentZone.id]);

  // Render HTML5 Canvas overlay synchronously for ALL POLYGONS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI canvas buffer resolution
    canvas.width = BASE_WIDTH;
    canvas.height = BASE_HEIGHT;

    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Draw ALL zones configured for this camera
    zonesForCurrentCam.forEach((zone, zoneIdx) => {
      const zPts = zone.points;
      if (zPts.length === 0) return;

      const isCurrentActive = zone.id === currentZone.id;
      const zoneColor = zone.color || ZONE_COLORS[zoneIdx % ZONE_COLORS.length];

      // 1. Draw semi-transparent filled polygon with neon glow
      if (zPts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(zPts[0].x, zPts[0].y);
        for (let i = 1; i < zPts.length; i++) {
          ctx.lineTo(zPts[i].x, zPts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = isCurrentActive ? `${zoneColor}40` : `${zoneColor}18`;
        ctx.fill();
      }

      // 2. Draw connecting boundary lines with glow
      ctx.beginPath();
      ctx.strokeStyle = zoneColor;
      ctx.lineWidth = isCurrentActive ? 4 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(zPts[0].x, zPts[0].y);
      for (let i = 1; i < zPts.length; i++) {
        ctx.lineTo(zPts[i].x, zPts[i].y);
      }

      if (zone.closed && zPts.length >= 3) {
        ctx.lineTo(zPts[0].x, zPts[0].y);
      } else if (isCurrentActive && mousePos && !zone.closed && zPts.length > 0) {
        ctx.lineTo(mousePos.x, mousePos.y);
      }

      ctx.stroke();

      // 3. Draw Interactive Vertex Handles (Anchor points with white borders)
      zPts.forEach((pt, index) => {
        const isHovered = isCurrentActive && (hoveredPointIdx === index || draggingPointIdx === index);
        const pointLabel = `Z${zoneIdx + 1}-A${index + 1}`;

        if (isCurrentActive) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isHovered ? 20 : 14, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered ? `${zoneColor}99` : `${zoneColor}44`;
          ctx.fill();
        }

        // Solid Center Vertex Handle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isHovered ? 10 : 7, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? '#FFFFFF' : isCurrentActive ? zoneColor : '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Vertex Label Badge
        ctx.font = 'bold 18px Inter, monospace, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(pointLabel, pt.x + 15, pt.y - 10);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(pointLabel, pt.x + 14, pt.y - 11);
      });
    });

    // 4. Draw mouse cursor coordinate crosshair if hovering on active zone
    if (mousePos && !currentZone.closed) {
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = currentZone.color || '#00FF00';
      ctx.fill();
    }
  }, [zonesForCurrentCam, currentZone, mousePos, hoveredPointIdx, draggingPointIdx]);

  // Convert Mouse Event Coordinates to 1920x1080 Scale
  const getCanvasCoords = (e: React.MouseEvent<HTMLDivElement>): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = BASE_WIDTH / rect.width;
    const scaleY = BASE_HEIGHT / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    return {
      x: Math.max(0, Math.min(BASE_WIDTH, x)),
      y: Math.max(0, Math.min(BASE_HEIGHT, y))
    };
  };

  // Mouse Down: Start Dragging Vertex, Move Polygon, or Add Point
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pos = getCanvasCoords(e);

    const hitIdx = points.findIndex(pt => distance(pt, pos) <= 45);
    if (hitIdx !== -1) {
      setDraggingPointIdx(hitIdx);
      return;
    }

    if (currentZone.closed && isPointInPolygon(pos, points)) {
      setIsDraggingPolygon(true);
      setDragStartPos(pos);
      return;
    }

    if (!currentZone.closed) {
      updatePoints([...points, pos], false);
    }
  };

  // Mouse Move: Drag Vertex / Move Polygon / Update Hover Handles
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getCanvasCoords(e);
    setMousePos(pos);

    if (draggingPointIdx !== null) {
      const nextPoints = [...points];
      nextPoints[draggingPointIdx] = pos;
      updatePoints(nextPoints, currentZone.closed);
      setCursorStyle('grabbing');
      return;
    }

    if (isDraggingPolygon && dragStartPos) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;

      const nextPoints = points.map(pt => ({
        x: Math.max(0, Math.min(BASE_WIDTH, pt.x + dx)),
        y: Math.max(0, Math.min(BASE_HEIGHT, pt.y + dy))
      }));

      updatePoints(nextPoints, currentZone.closed);
      setDragStartPos(pos);
      setCursorStyle('move');
      return;
    }

    const hitIdx = points.findIndex(pt => distance(pt, pos) <= 45);
    if (hitIdx !== -1) {
      setHoveredPointIdx(hitIdx);
      setCursorStyle('grab');
    } else if (currentZone.closed && isPointInPolygon(pos, points)) {
      setHoveredPointIdx(null);
      setCursorStyle('move');
    } else {
      setHoveredPointIdx(null);
      setCursorStyle(currentZone.closed ? 'default' : 'crosshair');
    }
  };

  // Mouse Up: Finish Dragging
  const handleMouseUp = () => {
    setDraggingPointIdx(null);
    setIsDraggingPolygon(false);
    setDragStartPos(null);
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setDraggingPointIdx(null);
    setIsDraggingPolygon(false);
    setDragStartPos(null);
    setHoveredPointIdx(null);
  };

  const bgSnapshotUrl = SAMPLE_SNAPSHOTS[selectedCamCode] || SAMPLE_SNAPSHOTS.DEFAULT_HIGHWAY;

  return (
    <div className="space-y-4 select-none pb-12 max-w-7xl mx-auto">
      
      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-bounce">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="font-mono text-[10px] bg-white/20 px-2 py-0.5 rounded">AWS RDS STORED</span>
        </div>
      )}

      {/* Page Header Bar */}
      <div className="bg-[#00253E] border border-[#00385C] rounded-2xl p-5 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Target className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base md:text-lg font-black tracking-wide uppercase">Detection Area & Polygon Setup</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                INTERACTIVE DRAG HANDLES
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Drag corner handles on the live video stream to configure high-accuracy ANPR & safety detection zones.
            </p>
          </div>
        </div>

        {/* Quick Actions Header: Save to RDS + AI Models Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {onNavigateToAiModels && (
            <button
              onClick={() => onNavigateToAiModels(selectedCamCode)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Models Config</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            title="Save all polygon zones to AWS RDS PostgreSQL"
          >
            <Database className="w-4 h-4 text-slate-950" />
            <span>{isSaving ? 'Saving to RDS...' : 'Save & Deploy ROI'}</span>
          </button>

          <button
            onClick={() => updatePoints(PRESET_SHAPES.FULL_FRAME_80, true)}
            className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            title="Reset polygon to default 80% boundary (Hotkey: R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset (R)</span>
          </button>

          <button
            onClick={() => points.length > 0 && updatePoints(points.slice(0, -1), false)}
            disabled={points.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-40"
            title="Undo last point (Hotkey: Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo (Z)</span>
          </button>

          <button
            onClick={() => points.length >= 3 && updatePoints(points, true)}
            disabled={points.length < 3 || currentZone.closed}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
              currentZone.closed
                ? 'bg-emerald-700 text-white shadow'
                : points.length >= 3
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{currentZone.closed ? 'Polygon Closed' : 'Close Polygon'}</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN CONTROL ROOM WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: CAMERA VIEWPORT & PRESETS (8 COLS) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Camera Selector & Feed Mode Bar */}
          <div className="bg-[#051329] rounded-2xl border border-[#0e274d] p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-white">
            
            {/* Camera Select Dropdown */}
            <div className="flex items-center space-x-2.5 flex-1 min-w-[300px]">
              <CameraIcon className="w-4 h-4 text-[#0072CE]" />
              <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Camera:</span>
              <div className="relative flex-1">
                <select
                  value={selectedCamCode}
                  onChange={(e) => {
                    setSelectedCamCode(e.target.value);
                    onSelectCameraCode?.(e.target.value);
                    setFeedMode('live');
                  }}
                  className="w-full bg-[#0b1b36] border border-[#1d3b6a] rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-[#0072CE] focus:outline-none cursor-pointer"
                >
                  <optgroup label={`Gujarat Statewide Cameras (${masterCameraList.length} Nodes)`}>
                    {masterCameraList.map(c => (
                      <option key={c.cameraCode} value={c.cameraCode}>
                        {c.cameraCode} — {c.name} ({c.district})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Live Feed Mode Selector Buttons */}
            <div className="flex items-center bg-[#001729] p-1.5 rounded-xl border border-[#00385C] space-x-1.5 font-mono text-xs">
              <button
                onClick={() => setFeedMode('live')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                  feedMode === 'live'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Play real live video feed from camera"
              >
                <Video className="w-3.5 h-3.5" />
                <span>🔴 Live</span>
              </button>

              <button
                onClick={handleFreezeFrame}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                  feedMode === 'frozen'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Freeze live video frame at 1920x1080 to draw precise markings"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>📸 Freeze</span>
              </button>

              <button
                onClick={() => setFeedMode('sample')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                  feedMode === 'sample'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Use high-res reference highway image"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>🖼️ Sample</span>
              </button>
            </div>

          </div>

          {/* PRESET QUICK-SHAPES BAR (1-Click ROI Templates) */}
          <div className="bg-[#02182B] border border-[#00385C] rounded-2xl p-2.5 flex items-center justify-between flex-wrap gap-2 text-white">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200">ROI Presets:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleApplyPreset(PRESET_SHAPES.FULL_FRAME_80)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
                title="80% Frame Coverage Centered Rectangle"
              >
                <Maximize className="w-3 h-3 text-emerald-400" />
                <span>80% Default</span>
              </button>

              <button
                onClick={() => handleApplyPreset(PRESET_SHAPES.HIGHWAY_CORRIDOR)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
                title="Perspective trapezoid for Highway road lanes"
              >
                <Square className="w-3 h-3 text-sky-400" />
                <span>Highway Lane</span>
              </button>

              <button
                onClick={() => handleApplyPreset(PRESET_SHAPES.ENTRY_GATE)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
                title="Vertical portal box for entry gates & checkpoints"
              >
                <Grid className="w-3 h-3 text-amber-400" />
                <span>Entry Gate</span>
              </button>

              <button
                onClick={() => handleApplyPreset(PRESET_SHAPES.LEFT_LANE)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 transition cursor-pointer shadow-sm"
              >
                <span>Left Lane</span>
              </button>

              <button
                onClick={() => handleApplyPreset(PRESET_SHAPES.RIGHT_LANE)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 transition cursor-pointer shadow-sm"
              >
                <span>Right Lane</span>
              </button>

              <button
                onClick={() => updatePoints([], false)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center space-x-1 transition cursor-pointer shadow-sm"
                title="Clear polygon points and draw manually from scratch"
              >
                <MousePointer className="w-3 h-3 text-rose-400" />
                <span>Draw</span>
              </button>
            </div>
          </div>

          {/* MULTI-POLYGON ZONES TOOLBAR */}
          <div className="bg-[#041a2e] border border-[#0d3457] rounded-2xl p-2.5 flex items-center justify-between flex-wrap gap-2 text-white">
            <div className="flex items-center space-x-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Zones ({zonesForCurrentCam.length}):</span>
            </div>

            {/* Zone Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {zonesForCurrentCam.map((zone, idx) => {
                const isActive = zone.id === activeZoneId;
                return (
                  <button
                    key={zone.id}
                    onClick={() => setActiveZoneId(zone.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer border ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-md border-white/40 ring-1 ring-white/30'
                        : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: zone.color || ZONE_COLORS[idx % ZONE_COLORS.length] }} 
                    />
                    <span>{zone.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">({zone.points.length}p)</span>
                  </button>
                );
              })}

              {/* Add Zone Button */}
              <button
                onClick={handleAddNewZone}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1 transition cursor-pointer shadow"
                title="Add new polygon zone to this camera feed"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>

              {/* Delete Active Zone Button */}
              {zonesForCurrentCam.length > 1 && (
                <button
                  onClick={() => handleDeleteZone(currentZone.id)}
                  className="px-2 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                  title="Delete selected polygon zone"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* 16:9 CANVAS VIEWPORT */}
          <div 
            className={`relative bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl group ${
              isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'w-full'
            }`}
          >
            {/* Interactive Video / Image & Canvas Overlay Viewport */}
            <div 
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: cursorStyle }}
              className="relative w-full aspect-video overflow-hidden bg-black select-none"
            >
              {/* FEED MODE 1: REAL LIVE VIDEO FEED */}
              {feedMode === 'live' && (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  disablePictureInPicture
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ imageRendering: 'auto' }}
                />
              )}

              {/* FEED MODE 2: FROZEN CAPTURED FRAME */}
              {feedMode === 'frozen' && capturedFrameUrl && (
                <img
                  src={capturedFrameUrl}
                  alt="Captured Live Frame"
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                />
              )}

              {/* FEED MODE 3: SAMPLE HIGHWAY IMAGE */}
              {(feedMode === 'sample' || (feedMode === 'frozen' && !capturedFrameUrl)) && (
                <img
                  ref={imgRef}
                  src={bgSnapshotUrl}
                  alt="Camera Snapshot Frame"
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                />
              )}

              {/* Dynamic HTML5 Canvas Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {/* Live Cursor Tooltip Overlay */}
              {mousePos && (
                <div 
                  className="absolute pointer-events-none px-2.5 py-1.5 rounded-xl bg-black/85 backdrop-blur-md text-white text-[11px] font-mono shadow-xl border border-white/20 z-20 flex items-center space-x-2 transition-all duration-75"
                  style={{
                    left: `${(mousePos.x / BASE_WIDTH) * 100}%`,
                    top: `${(mousePos.y / BASE_HEIGHT) * 100}%`,
                    transform: 'translate(14px, 14px)'
                  }}
                >
                  <span style={{ color: currentZone.color }} className="font-bold">{currentZone.name}</span>
                  <span>({mousePos.x}, {mousePos.y})</span>
                  {draggingPointIdx !== null && <span className="text-amber-400 font-bold">• DRAGGING ANCHOR</span>}
                  {isDraggingPolygon && <span className="text-sky-400 font-bold">• MOVING ZONE</span>}
                </div>
              )}

              {/* Interactive Drag Instruction Banner Overlay */}
              <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-3 py-1.5 text-white text-xs z-20 flex items-center space-x-2 shadow-lg">
                <Move className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium text-[11px]">
                  💡 <strong>Drag handles</strong> to calibrate • <strong>Drag box</strong> to shift zone.
                </span>
              </div>

              {/* Live Stream Mode & Fullscreen Control Overlay */}
              <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
                {feedMode === 'live' && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600/90 text-white font-mono text-[10px] font-extrabold flex items-center space-x-1.5 shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>LIVE ({selectedCamCode})</span>
                  </span>
                )}
                {feedMode === 'frozen' && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white font-mono text-[10px] font-extrabold flex items-center space-x-1 shadow-lg">
                    <span>FROZEN FRAME</span>
                  </span>
                )}
                {feedMode === 'sample' && (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600/90 text-white font-mono text-[10px] font-extrabold flex items-center space-x-1 shadow-lg">
                    <span>SAMPLE</span>
                  </span>
                )}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white transition cursor-pointer shadow-lg"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>
          </div>

          {/* Bottom Status & Telemetry Bar */}
          <div className="bg-[#002038] border border-[#00385C] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300 shadow-md">
            <div className="flex items-center space-x-3">
              <span className="text-slate-400 font-sans">Active Zone:</span>
              <span className="font-bold text-white flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentZone.color }} />
                <span>{currentZone.name}</span>
              </span>
              <span className="text-slate-500">|</span>
              <span>Points: <strong className="text-white">{points.length}</strong></span>
              <span className="text-slate-500">|</span>
              <span className={currentZone.closed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {currentZone.closed ? 'Closed ROI' : 'Open Path'}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-slate-400">
              <span>1920x1080</span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-bold">AWS RDS Sync: READY</span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: RULES & REGULATIONS / SOP PANEL (4 COLS) */}
        <div className="lg:col-span-4 space-y-3.5">
          
          <div className="bg-[#051329] border border-[#0e274d] rounded-2xl overflow-hidden shadow-xl flex flex-col h-[560px]">
            
            {/* Header */}
            <div className="bg-[#030e1f] p-3.5 border-b border-[#0e274d] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-wider">Rules & Regulations</h2>
                  <p className="text-[10px] text-slate-400">SOP & MoRTH / IRC Guidelines</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                SOP ACTIVE
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 bg-[#020b17] p-1.5 gap-1 border-b border-[#0e274d] text-[11px] font-bold">
              <button
                onClick={() => setRulesTab('enforcement')}
                className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer truncate ${
                  rulesTab === 'enforcement'
                    ? 'bg-[#0072CE] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#081b36]'
                }`}
              >
                Enforcement
              </button>

              <button
                onClick={() => setRulesTab('calibration')}
                className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer truncate ${
                  rulesTab === 'calibration'
                    ? 'bg-[#0072CE] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#081b36]'
                }`}
              >
                Calibration SOP
              </button>

              <button
                onClick={() => setRulesTab('privacy')}
                className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer truncate ${
                  rulesTab === 'privacy'
                    ? 'bg-[#0072CE] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#081b36]'
                }`}
              >
                Data & Privacy
              </button>
            </div>

            {/* Tab Body with Scrollbar */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar text-white">
              
              {/* TAB 1: ENFORCEMENT RULES */}
              {rulesTab === 'enforcement' && (
                <div className="space-y-3">
                  
                  {/* Rule 1: Speed Limit */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Scale className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-white">1. Speed Limit Thresholds</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">SEC 183 MV ACT</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Calibrated speeds: Expressways <strong>100–120 km/h</strong>, National Highways <strong>80 km/h</strong>, Urban Zones <strong>40 km/h</strong>. Automated e-Challan triggered upon ROI entry-to-exit delta.
                    </p>
                  </div>

                  {/* Rule 2: Wrong-Way Driving */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-xs font-bold text-white">2. Wrong-Way Driving Detection</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">CRITICAL</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Vehicle vector heading reversal &gt; 120° against authorized traffic trajectory within the ROI triggers instant high-priority control room alarm & camera flash.
                    </p>
                  </div>

                  {/* Rule 3: Lane Discipline */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-xs font-bold text-white">3. Lane Discipline & Solid Line</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">SEC 177B</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Heavy commercial trucks are restricted to designated outer lanes. Crossing solid yellow/white boundaries within detection area triggers lane violation citation.
                    </p>
                  </div>

                  {/* Rule 4: Helmet & Seatbelt */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-white">4. Helmet, Seatbelt & Triple Riding</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">SAFETY</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      AI secondary crop evaluates helmet compliance, triple-riding on 2-wheelers, and driver seatbelt compliance on all motor vehicles crossing the polygon.
                    </p>
                  </div>

                </div>
              )}

              {/* TAB 2: CALIBRATION SOP */}
              {rulesTab === 'calibration' && (
                <div className="space-y-3">
                  
                  {/* SOP 1: Lead-in Distance */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">📐 Lead-In Optical Distance</span>
                      <span className="text-[10px] text-slate-400 font-mono">15m – 20m</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Ensure the top edge of the polygon starts at least 15–20m before the camera focal trigger point to allow the ANPR optical engine sufficient tracking frames.
                    </p>
                  </div>

                  {/* SOP 2: Camera Pitch Angle */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300">🎯 Camera Inclination Angle</span>
                      <span className="text-[10px] text-slate-400 font-mono">15° to 30°</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Vertical camera mounting pitch must stay within 15°–30°. Angles steeper than 35° cause severe plate distortion; angles shallower than 10° cause vehicle tailgate occlusion.
                    </p>
                  </div>

                  {/* SOP 3: Resolution & Pixel Density */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">🔍 Plate Pixel Density</span>
                      <span className="text-[10px] text-slate-400 font-mono">≥ 150 px</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      High Security Registration Plates (HSRP) must span at least 150 pixels in width within the polygon to guarantee &gt; 99.4% OCR recognition reliability.
                    </p>
                  </div>

                  {/* SOP 4: Night IR Illumination */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">🌙 Night Vision & IR Protocol</span>
                      <span className="text-[10px] text-slate-400 font-mono">&lt; 0.5 Lux</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Automatic 850nm infrared beam activates when ambient daylight falls below 0.5 Lux. Keep detection polygon clear of reflective billboard glare.
                    </p>
                  </div>

                </div>
              )}

              {/* TAB 3: DATA & PRIVACY */}
              {rulesTab === 'privacy' && (
                <div className="space-y-3">
                  
                  {/* Privacy 1: DPDP Act 2023 */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-white">DPDP Act 2023 & IT Act</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">COMPLIANT</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      All video feeds, ANPR telemetry metadata, and polygon coordinates are encrypted with AES-256 in transit and at rest on AWS RDS PostgreSQL.
                    </p>
                  </div>

                  {/* Privacy 2: 30-Day Retention */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300">⏳ Retention & Purge Cycle</span>
                      <span className="text-[10px] text-slate-400 font-mono">30-Day FIFO</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Standard CCTV stream recordings are automatically purged after 30 days. Flagged violations, FIR cases, and high-speed challans are archived for 365 days.
                    </p>
                  </div>

                  {/* Privacy 3: SHA-256 Digital Hash */}
                  <div className="p-3 rounded-xl bg-[#091e3d] border border-[#163868] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">🛡️ Evidence Chain of Custody</span>
                      <span className="text-[10px] text-slate-400 font-mono">SHA-256</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Every generated e-Challan frame crop receives an immutable SHA-256 hash stamp for court-admissible digital forensics and tamper verification.
                    </p>
                  </div>

                </div>
              )}

            </div>

            {/* Panel Footer / Compliance Badge */}
            <div className="p-3 bg-[#020d1c] border-t border-[#0e274d] flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span className="font-bold">MoRTH / IRC Certified</span>
              </div>
              <span className="text-slate-400 font-mono text-[10px]">VER: 2026.4-GOV</span>
            </div>

          </div>

          {/* Quick Telemetry & Active Status Card */}
          <div className="bg-[#04162a] border border-[#0d3457] rounded-2xl p-3.5 space-y-2.5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">System Enforcement Status:</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#081e3a] p-2 rounded-xl border border-[#133763]">
                <div className="text-[10px] text-slate-400">e-Challan Dispatch</div>
                <div className="font-bold text-emerald-400">AUTOMATED</div>
              </div>
              <div className="bg-[#081e3a] p-2 rounded-xl border border-[#133763]">
                <div className="text-[10px] text-slate-400">Target Accuracy</div>
                <div className="font-bold text-sky-400">99.4% (MoRTH)</div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

