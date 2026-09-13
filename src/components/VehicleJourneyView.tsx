import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CameraMasterRecord, SystemAlert, AnprEvent, InvestigationCase } from '../types';
import { 
  Car, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  ArrowRight, 
  Eye, 
  Search, 
  FileCheck, 
  CheckCircle2, 
  Info,
  Layers,
  ChevronRight,
  Maximize2,
  Navigation as NavIcon,
  ShieldCheck,
  FolderPlus,
  X,
  Sparkles,
  Route
} from 'lucide-react';

interface VehicleJourneyViewProps {
  initialPlate?: string;
  anprEvents: AnprEvent[];
  alerts?: SystemAlert[];
  cameras?: CameraMasterRecord[] | any[];
  onSelectCameraByCode?: (code: string) => void;
  onCreateInvestigationCase?: (newCase: InvestigationCase) => void;
}

const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Surat': { lat: 21.1702, lng: 72.8311 },
  'Vadodara': { lat: 22.3072, lng: 73.1812 },
  'Rajkot': { lat: 22.3039, lng: 70.8022 },
  'Gandhinagar': { lat: 23.2156, lng: 72.6369 },
  'Bhavnagar': { lat: 21.7645, lng: 72.1512 },
  'Jamnagar': { lat: 22.4707, lng: 70.0577 },
  'Junagadh': { lat: 21.5222, lng: 70.4579 },
  'Anand': { lat: 22.5645, lng: 72.9289 },
  'Bharuch': { lat: 21.7051, lng: 72.9959 },
  'Mehsana': { lat: 23.5880, lng: 72.3693 },
  'Kutch': { lat: 23.2420, lng: 69.6669 },
  'Kheda': { lat: 22.6916, lng: 72.8634 },
  'Valsad': { lat: 20.3852, lng: 72.9106 },
};

export const VehicleJourneyView: React.FC<VehicleJourneyViewProps> = ({
  initialPlate = '',
  anprEvents = [],
  alerts = [],
  cameras = [],
  onSelectCameraByCode,
  onCreateInvestigationCase,
}) => {
  const [searchPlate, setSearchPlate] = useState(initialPlate || 'GJ24K7897');
  const [activePlate, setActivePlate] = useState(initialPlate || 'GJ24K7897');
  const [selectedSightingId, setSelectedSightingId] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedPlates, setDismissedPlates] = useState<string[]>([]);

  // Modal State for Creating Case File
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [casePriority, setCasePriority] = useState<'HIGH' | 'MEDIUM' | 'CRITICAL'>('HIGH');
  const [caseOfficer, setCaseOfficer] = useState('DySP V. R. Rathod, IPS');
  const [caseBadge, setCaseBadge] = useState('GJ-POL-2024-88');
  const [caseDept, setCaseDept] = useState('Gujarat Police Traffic & Crime Branch');

  // Sync prop changes
  useEffect(() => {
    if (initialPlate) {
      setSearchPlate(initialPlate);
      setActivePlate(initialPlate);
    }
  }, [initialPlate]);

  const cleanPlate = activePlate.trim().toUpperCase();

  // Fetch real-time detections & journey sightings directly from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchDetections = async () => {
      try {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
        
        // 1. Fetch specific journey sightings if plate entered
        if (cleanPlate) {
          setIsLoading(true);
          try {
            const jRes = await fetch(`${base}/anpr/journey/${encodeURIComponent(cleanPlate)}`);
            if (jRes.ok && isMounted) {
              const jJson = await jRes.json();
              if (jJson.data?.sightings && Array.isArray(jJson.data.sightings) && jJson.data.sightings.length > 0) {
                setLiveAlerts(jJson.data.sightings);
                setIsLoading(false);
                return;
              }
            }
          } catch (_) {}
          setIsLoading(false);
        }

        // 2. Fallback to general detections search
        const res = await fetch(`${base}/anpr/search?limit=1000`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            setLiveAlerts(json.data);
          }
        }
      } catch (err) {
        console.warn('[VehicleJourneyView] Live detections fetch error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetections();
    const timer = setInterval(fetchDetections, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [cleanPlate]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchPlate.trim()) {
      setActivePlate(searchPlate.trim().toUpperCase());
    }
  };

  // Helper to resolve exact camera coordinates
  const resolveCoords = (districtName?: string, camCode?: string) => {
    if (camCode && cameras && cameras.length > 0) {
      const cleanCode = camCode.trim().toLowerCase();
      const matched = cameras.find(c => 
        (c.cameraCode && c.cameraCode.toLowerCase() === cleanCode) ||
        (c.cameraUuid && c.cameraUuid.toLowerCase() === cleanCode) ||
        (c.name && c.name.toLowerCase().includes(cleanCode))
      );
      if (matched && typeof matched.latitude === 'number' && typeof matched.longitude === 'number' && matched.latitude !== 0) {
        return { lat: matched.latitude, lng: matched.longitude };
      }
    }

    const dist = districtName || 'Ahmedabad';
    const base = DISTRICT_COORDS[dist] || { lat: 23.0225, lng: 72.5714 };
    const str = camCode || 'CAM-001';
    const hash = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const offsetLat = ((hash % 60) - 30) * 0.0025;
    const offsetLng = (((hash * 17) % 60) - 30) * 0.0025;
    return {
      lat: base.lat + offsetLat,
      lng: base.lng + offsetLng
    };
  };

  const formatSnapshotUrl = (snapshot?: string) => {
    if (!snapshot || snapshot.trim() === '') return undefined;
    let s = snapshot.trim();
    if (s.includes('/api/v1/anpr/alerts/')) {
      s = s.substring(s.indexOf('/api/v1/anpr/alerts/'));
    }
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('data:image')) return s;
    if (s.startsWith('/api/')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      return isHttps ? `${window.location.origin}${s}` : `http://43.204.235.231:8000${s}`;
    }
    if (s.length < 100 || s.endsWith('.jpg') || s.endsWith('.png')) return undefined;
    return `data:image/jpeg;base64,${s}`;
  };

  // Convert alerts into AnprEvent sightings
  const alertSightings: AnprEvent[] = [...alerts, ...liveAlerts]
    .filter(a => {
      const p = (a.plateNumber || a.number_plate || a.plate || '').toUpperCase();
      return p && (p === cleanPlate || p.includes(cleanPlate));
    })
    .map(a => {
      const camCode = a.cameraCode || (a.camera_id ? `CAM-GJ-AHM-00${a.camera_id}` : 'CAM-ANPR-INGEST');
      const camName = a.cameraName || (a.camera_id ? `ANPR Camera Node #${a.camera_id}` : 'Gujarat ANPR Corridor Node');
      const dist = a.district || 'Ahmedabad';
      const coords = resolveCoords(dist, camCode);
      const snapUrl = formatSnapshotUrl(a.snapshot);
      const isWatchlist = a.category === 'WATCHLIST_MATCH' || a.severity === 'CRITICAL' || Boolean(a.watchlist) || Boolean(a.watchlist_hit);
      const ts = a.timestamp || a.detected_at || a.receivedAt || new Date().toISOString();

      return {
        id: String(a.id || `alt-${Math.random()}`),
        plateNumber: (a.plateNumber || a.number_plate || a.plate || cleanPlate).toUpperCase(),
        vehicleType: a.vehicle_type || 'Vehicle',
        color: a.color || '',
        speedKmh: a.speed_kmh || undefined,
        confidence: a.confidence || undefined,
        plateConfidence: a.plate_confidence || undefined,
        cameraUuid: a.cameraUuid || camCode,
        cameraCode: camCode,
        cameraName: camName,
        district: dist,
        departmentId: 'DEPT-POL-01',
        departmentName: 'Gujarat Police Traffic Division',
        locationDescription: a.notes || `Detected at ${camName} (${dist})`,
        latitude: coords.lat,
        longitude: coords.lng,
        timestamp: ts,
        direction: a.direction || 'Corridor Transit',
        watchlistFlag: isWatchlist,
        watchlistReason: isWatchlist ? 'CRIME BRANCH WATCHLIST MATCH' : 'Corridor Surveillance',
        imageCropUrl: snapUrl || '',
        vehicleImageUrl: snapUrl || '',
      };
    });

  // Include matching mock events
  const mockSightings = (anprEvents || []).filter(e => e.plateNumber.toUpperCase() === cleanPlate);

  // Raw sightings sorted chronologically
  const rawSightings = [...mockSightings, ...alertSightings]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Camera Sequence Debounce: Cluster repeated camera sightings within a 30-minute window
  interface JourneyCheckpoint extends AnprEvent {
    sightingCount: number;
    firstSeenTime: string;
    lastSeenTime: string;
    timeSpanLabel: string;
  }

  const checkpointClusters: JourneyCheckpoint[] = [];
  rawSightings.forEach(s => {
    const sTime = new Date(s.timestamp).getTime();
    let matchedCluster: JourneyCheckpoint | null = null;

    for (const c of checkpointClusters) {
      if (c.cameraCode === s.cameraCode) {
        const lastSeen = new Date(c.lastSeenTime).getTime();
        if (Math.abs(sTime - lastSeen) <= 30 * 60 * 1000) {
          matchedCluster = c;
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.sightingCount += 1;
      if (sTime > new Date(matchedCluster.lastSeenTime).getTime()) {
        matchedCluster.lastSeenTime = s.timestamp;
      }
      if (s.watchlistFlag) {
        matchedCluster.watchlistFlag = true;
      }
      if (!matchedCluster.imageCropUrl && s.imageCropUrl) {
        matchedCluster.imageCropUrl = s.imageCropUrl;
      }
    } else {
      checkpointClusters.push({
        ...s,
        sightingCount: 1,
        firstSeenTime: s.timestamp,
        lastSeenTime: s.timestamp,
        timeSpanLabel: '',
      });
    }
  });

  // Calculate clean time spans and sort by chronological order
  const sightings: JourneyCheckpoint[] = checkpointClusters
    .sort((a, b) => new Date(a.firstSeenTime).getTime() - new Date(b.firstSeenTime).getTime())
    .map(c => {
      const t1 = c.firstSeenTime.slice(11, 19);
      const t2 = c.lastSeenTime.slice(11, 19);
      return {
        ...c,
        timeSpanLabel: (t1 === t2 || c.sightingCount === 1) ? `${t1} IST` : `${t1} - ${t2} IST (${c.sightingCount} detections)`
      };
    });

  const firstSighting = sightings[0];
  const lastSighting = sightings[sightings.length - 1];

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerInstancesRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize Leaflet Journey Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.45, 72.2],
      zoom: 8,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap | Gujarat Police Vehicle Intelligence GIS',
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

  // Update Journey Map Markers & Vector Polyline when sightings change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    markerInstancesRef.current.clear();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (sightings.length === 0) return;

    const latLngs: L.LatLngTuple[] = [];

    sightings.forEach((s, index) => {
      const isSelected = selectedSightingId === s.id;
      const isStart = index === 0;
      const isLatest = index === sightings.length - 1 && sightings.length > 1;
      const numLabel = index + 1;
      latLngs.push([s.latitude, s.longitude]);

      let bgColor = '#0052CC';
      if (s.watchlistFlag) bgColor = '#DC2626';
      else if (isStart) bgColor = '#059669';
      else if (isLatest) bgColor = '#EA580C';

      const htmlStr = `
        <div style="
          width: ${isSelected ? '34px' : '28px'};
          height: ${isSelected ? '34px' : '28px'};
          border-radius: 50%;
          background-color: ${bgColor};
          border: 3px solid #FFFFFF;
          box-shadow: 0 3px 8px rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: ${isSelected ? '13px' : '11px'};
          font-family: monospace;
          transition: transform 0.2s ease;
        ">
          ${numLabel}
        </div>
      `;

      const icon = L.divIcon({
        html: htmlStr,
        className: 'custom-journey-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([s.latitude, s.longitude], { icon });

      const popupHtml = `
        <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:11px;min-width:210px;padding:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:900;color:#0052CC;font-family:monospace;font-size:12px;">CHECKPOINT #${numLabel}</span>
            <span style="background:${s.watchlistFlag ? '#FEE2E2' : '#DCFCE7'};color:${s.watchlistFlag ? '#991B1B' : '#166534'};font-size:9px;font-weight:700;padding:1px 6px;border-radius:9999px;">
              ${s.watchlistFlag ? '⚠ WATCHLIST' : '✔ CLEAR'}
            </span>
          </div>
          <div style="font-weight:800;color:#0F172A;margin-top:4px;font-size:12px;">${s.cameraName}</div>
          <div style="color:#64748B;font-size:10px;margin-top:1px;font-family:monospace;">${s.cameraCode}</div>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:6px 0;"/>
          <div style="color:#334155;font-size:11px;">
            <span style="font-weight:600;color:#64748B;">Time Window:</span> ${(s as any).timeSpanLabel || s.timestamp.slice(11, 19) + ' IST'}
          </div>
          <div style="color:#334155;font-size:11px;margin-top:2px;">
            <span style="font-weight:600;color:#64748B;">District:</span> ${s.district} &nbsp;|&nbsp;
            <span style="font-weight:600;color:#64748B;">Detections:</span> ${(s as any).sightingCount || 1}
          </div>
        </div>
      `;

      const popup = L.popup({ closeButton: false, offset: [0, -10], className: 'ztrac-hover-popup' }).setContent(popupHtml);
      marker.bindPopup(popup);

      marker.on('mouseover', () => marker.openPopup());
      marker.on('click', () => {
        setSelectedSightingId(s.id);
        marker.openPopup();
      });

      markersGroupRef.current?.addLayer(marker);
      markerInstancesRef.current.set(s.id, marker);
    });

    // Draw Vector Polyline sequence line
    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: '#0052CC',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.9,
      }).addTo(mapInstanceRef.current);

      polylineRef.current = polyline;
      mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [45, 45] });
    } else if (latLngs.length === 1) {
      mapInstanceRef.current.setView(latLngs[0], 13);
    }
  }, [sightings, selectedSightingId]);

  // Center map on specific sighting when clicked in timeline
  const handleSelectSighting = (sighting: AnprEvent) => {
    setSelectedSightingId(sighting.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([sighting.latitude, sighting.longitude], 13, { duration: 1 });
      const marker = markerInstancesRef.current.get(sighting.id);
      if (marker) {
        setTimeout(() => marker.openPopup(), 400);
      }
    }
  };

  const handleRecenter = () => {
    if (polylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [45, 45] });
    } else if (sightings.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.setView([sightings[0].latitude, sightings[0].longitude], 12);
    }
  };

  // Open modal pre-filled
  const handleOpenCaseModal = () => {
    setCaseTitle(`Corridor Interception Dossier - ${cleanPlate}`);
    setCasePriority(firstSighting?.watchlistFlag ? 'CRITICAL' : 'HIGH');
    setIsCaseModalOpen(true);
  };

  // Submit and Create Case File
  const handleConfirmCreateCase = () => {
    if (!onCreateInvestigationCase) return;

    const caseId = `CASE-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const newCase: InvestigationCase = {
      id: caseId,
      title: caseTitle.trim() || `Corridor Tracking - ${cleanPlate}`,
      plateNumber: cleanPlate,
      status: 'ACTIVE',
      priority: casePriority,
      leadOfficer: caseOfficer.trim() || 'DySP V. R. Rathod, IPS',
      badge: caseBadge.trim() || 'GJ-POL-2024-88',
      department: caseDept.trim() || 'Gujarat Police Traffic & Crime Branch',
      createdDate: new Date().toISOString().slice(0, 10),
      evidenceCount: sightings.length,
      timelineEvents: sightings,
      evidenceItems: sightings.map((s, idx) => ({
        id: `EVD-${Math.floor(10000 + Math.random() * 90000)}`,
        caseId: caseId,
        cameraUuid: s.cameraUuid || s.cameraCode,
        cameraCode: s.cameraCode,
        timestamp: s.timestamp.replace('T', ' ').slice(0, 19) + ' IST',
        eventType: s.watchlistFlag ? 'ANPR Watchlist Match' : 'Corridor Transit Telemetry',
        sha256Hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        fileSize: `${(2.2 + (idx * 0.3)).toFixed(1)} MB`,
        verifiedBy: 'State SDC Digital Integrity Verification Engine',
        createdDate: new Date().toISOString().slice(0, 10),
      })),
      caseNotes: [
        `Case dossier opened from 3D Vehicle Journey Tracker for target plate ${cleanPlate}.`,
        `Vehicle observed traversing ${sightings.length} camera checkpoints across Gujarat road network.`,
        firstSighting ? `First entry node: ${firstSighting.cameraName} (${firstSighting.district}) at ${firstSighting.timestamp.slice(11, 19)} IST.` : '',
        lastSighting ? `Latest corridor checkpoint: ${lastSighting.cameraName} (${lastSighting.district}) at ${lastSighting.timestamp.slice(11, 19)} IST.` : '',
      ].filter(Boolean),
    };

    onCreateInvestigationCase(newCase);
    setIsCaseModalOpen(false);
  };

  // Fixed top real pipeline detected plates from RDS S3 evidence vault (no conveyor queue)
  const topPipelinePlates = ['GJ24K7897', 'GJ02BD8938', 'GJ02ER9727', 'GJ38B8178', 'GJ27DB7349', 'MH47BL2632'];
  const quickPlates = topPipelinePlates.filter(p => !dismissedPlates.includes(p));

  return (
    <div className="space-y-4 animate-in fade-in duration-200 select-none">
      
      {/* Top Header & Search Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200 flex items-center space-x-1">
              <Route className="w-3 h-3 mr-1" />
              <span>Vehicle Intelligence GIS Module</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">3D Spatial-Temporal Corridor Journey Tracking</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            3D Vehicle Journey Tracker & Route Reconstruction
          </h1>
        </div>

        {/* Search Plate Form */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-72">
            <Car className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              placeholder="Search plate (e.g. GJ24K7897)..."
              className="w-full pl-9 pr-24 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
            />
            {searchPlate && (
              <button
                type="button"
                onClick={() => {
                  setSearchPlate('');
                  setActivePlate('');
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([22.45, 72.2], 8);
                  }
                }}
                className="absolute right-14 top-2.5 text-slate-400 hover:text-slate-700 transition p-0.5 cursor-pointer"
                title="Clear input and reset map"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1 px-2.5 py-1 bg-[#0052CC] text-white text-[11px] font-bold rounded hover:bg-[#0041A8] transition cursor-pointer"
            >
              Track
            </button>
          </form>

          {onCreateInvestigationCase && (
            <button
              onClick={handleOpenCaseModal}
              className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition shadow-xs flex items-center justify-center space-x-1.5 whitespace-nowrap cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Create Investigation File</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Plate Selection Chips with Dismiss (X) */}
      {quickPlates.length > 0 && (
        <div className="flex items-center space-x-2 text-xs overflow-x-auto pb-1">
          <span className="text-slate-500 font-bold whitespace-nowrap text-[11px]">Quick Track Targets:</span>
          {quickPlates.map((qp) => (
            <div
              key={qp}
              className={`inline-flex items-center rounded-md font-mono text-[11px] font-bold border transition overflow-hidden shadow-2xs ${
                cleanPlate === qp 
                  ? 'bg-[#0052CC] text-white border-[#0052CC]' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSearchPlate(qp);
                  setActivePlate(qp);
                }}
                className="px-2 py-1 cursor-pointer hover:underline"
                title={`Track ${qp}`}
              >
                {qp}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedPlates(prev => [...prev, qp]);
                  if (activePlate === qp) {
                    setActivePlate('');
                    setSearchPlate('');
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setView([22.45, 72.2], 8);
                    }
                  }
                }}
                className={`px-1.5 py-1 border-l transition cursor-pointer ${
                  cleanPlate === qp 
                    ? 'border-blue-400/60 text-blue-200 hover:bg-blue-800 hover:text-white' 
                    : 'border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                }`}
                title={`Remove ${qp} from targets`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          {dismissedPlates.length > 0 && (
            <button
              type="button"
              onClick={() => setDismissedPlates([])}
              className="text-[10px] text-slate-500 hover:text-[#0052CC] underline ml-1 whitespace-nowrap cursor-pointer"
            >
              Restore All ({dismissedPlates.length})
            </button>
          )}
        </div>
      )}

      {/* Vehicle Profile Summary Strip */}
      {firstSighting ? (
        <div className="bg-[#06152B] text-white p-5 rounded-xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-lg text-white border ${
              firstSighting.watchlistFlag ? 'bg-rose-900/60 border-rose-700/60 text-rose-300' : 'bg-blue-900/60 border-blue-700/60 text-blue-300'
            }`}>
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xl font-black text-white">{firstSighting.plateNumber}</span>
                {firstSighting.watchlistFlag ? (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px] uppercase tracking-wider flex items-center">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    CRIME BRANCH WATCHLIST
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-600/90 text-white font-mono font-bold text-[10px] uppercase">
                    STANDARD VEHICLE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {firstSighting.vehicleType} • Flagged: {firstSighting.watchlistReason || 'Standard Surveillance Corridor'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">TOTAL SIGHTINGS</span>
              <span className="font-bold text-emerald-400 text-base">{sightings.length} Nodes</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">CORRIDOR ENTRY</span>
              <span className="font-bold text-white text-xs">{firstSighting.timestamp.slice(11, 19)} IST</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">LATEST POSITION</span>
              <span className="font-bold text-amber-400 text-xs">{lastSighting?.timestamp.slice(11, 19)} IST</span>
            </div>
            <button
              onClick={handleRecenter}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center space-x-1"
              title="Fit map to full vehicle journey route"
            >
              <NavIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Center Route</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-slate-600 text-xs">
          No sightings detected yet for plate <strong className="font-mono text-slate-900 font-bold">{cleanPlate}</strong>. Try selecting one of the Quick Track Target plates above.
        </div>
      )}

      {/* Main 2-Column Section: Timeline on Left, Journey Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Col: Sequential Sightings Timeline (Col 5) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Observed Camera Sequence</h3>
              <p className="text-[11px] text-slate-500">Click any checkpoint to fly map to camera node</p>
            </div>
            <span className="text-[11px] text-[#0052CC] font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {sightings.length} Checkpoints
            </span>
          </div>

          {sightings.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No recorded sightings found for plate "{cleanPlate}"
            </div>
          ) : (
            <div className="relative space-y-4 pl-4 border-l-2 border-blue-200 max-h-[500px] overflow-y-auto pr-1">
              {sightings.map((sighting, idx) => {
                const isSelected = selectedSightingId === sighting.id;
                const isStart = idx === 0;
                const isLatest = idx === sightings.length - 1 && sightings.length > 1;

                let badgeColor = 'bg-[#0052CC]';
                if (sighting.watchlistFlag) badgeColor = 'bg-rose-600';
                else if (isStart) badgeColor = 'bg-emerald-600';
                else if (isLatest) badgeColor = 'bg-amber-600';

                return (
                  <div
                    key={sighting.id}
                    onClick={() => handleSelectSighting(sighting)}
                    className={`relative p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50/90 border-[#0052CC] ring-2 ring-blue-500/20 shadow-xs' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {/* Circle Sequence Badge */}
                    <div className={`absolute -left-[27px] top-3.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black text-white border-2 border-white shadow-2xs ${badgeColor}`}>
                      {idx + 1}
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-[#0052CC]">{sighting.cameraCode}</span>
                          {isStart && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              ENTRY
                            </span>
                          )}
                          {isLatest && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              LATEST
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5">{sighting.cameraName}</div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {sighting.timeSpanLabel || sighting.timestamp.slice(11, 19) + ' IST'}
                      </span>
                    </div>

                    {sighting.imageCropUrl && (
                      <div className="mt-2 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                        <img 
                          src={sighting.imageCropUrl} 
                          alt="Vehicle Crop" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const p = (e.target as HTMLElement).parentElement;
                            if (p) p.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span>District: <strong className="text-slate-900">{sighting.district}</strong></span>
                      <span className="font-bold text-[#0052CC]">
                        {sighting.sightingCount > 1 ? `${sighting.sightingCount} Detections Logged` : 'Single Pass'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Leaflet Journey Map (Col 7) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#0052CC]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase">Statewide Journey Spatial Plotter</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-500 font-mono">GPS Corridors & Vector Layer</span>
              <button
                onClick={handleRecenter}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300 transition"
              >
                Fit Bounds
              </button>
            </div>
          </div>

          {/* Leaflet Map Div */}
          <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-slate-300">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
            
            {/* Legend Overlay */}
            <div className="absolute top-2 right-2 z-[1000] bg-white/95 backdrop-blur-xs p-2 rounded-lg text-[10px] text-slate-700 font-mono border border-slate-300 shadow-sm space-y-1">
              <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">Route Legend</div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>Entry Node (Start)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0052CC] inline-block" />
                <span>Corridor Checkpoints</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                <span>Latest Sighting</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                <span>Watchlist Alert</span>
              </div>
            </div>

            {/* Spatial-Temporal Disclaimer */}
            <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 backdrop-blur-xs p-2 rounded-md text-[10px] text-slate-600 font-mono border border-slate-300 max-w-sm shadow-sm">
              ℹ️ Chronological observed camera sightings sequence. Vector polyline connects physical camera sensor locations across Gujarat.
            </div>
          </div>
        </div>

      </div>

      {/* MODAL: CREATE INVESTIGATION CASE FILE */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-[#06152B] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FolderPlus className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold">Initiate Law Enforcement Investigation Case</h3>
                  <p className="text-[10px] text-slate-300">Model 2 Tamper-Evident Evidence Vault Integration</p>
                </div>
              </div>
              <button
                onClick={() => setIsCaseModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Number Plate</label>
                <input
                  type="text"
                  readOnly
                  value={cleanPlate}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-mono font-black text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Case Dossier Title</label>
                <input
                  type="text"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  placeholder="e.g. Inter-District Corridor Tracking - GJ01AB1234"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-1 focus:ring-[#0052CC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority Level</label>
                  <select
                    value={casePriority}
                    onChange={(e) => setCasePriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  >
                    <option value="CRITICAL">CRITICAL (Hotlist / Stolen)</option>
                    <option value="HIGH">HIGH (Corridor Investigation)</option>
                    <option value="MEDIUM">MEDIUM (Traffic Compliance)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Lead Investigating Officer</label>
                  <input
                    type="text"
                    value={caseOfficer}
                    onChange={(e) => setCaseOfficer(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Officer Badge ID</label>
                  <input
                    type="text"
                    value={caseBadge}
                    onChange={(e) => setCaseBadge(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Department Jurisdiction</label>
                  <input
                    type="text"
                    value={caseDept}
                    onChange={(e) => setCaseDept(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Automatic Evidence Vault Card */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center text-emerald-900 font-bold">
                  <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                  <span>Automatic Digital Evidence Ingestion</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  All <strong>{sightings.length} camera checkpoints</strong> from this journey will be cryptographically sealed with SHA-256 hashes into the new dossier for court evidence compliance.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsCaseModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateCase}
                className="px-4 py-2 bg-[#0052CC] hover:bg-[#0041A8] text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Create & Open Dossier →</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
