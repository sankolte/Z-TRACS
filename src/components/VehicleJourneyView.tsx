import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CameraMasterRecord, SystemAlert, AnprEvent } from '../types';
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
  Maximize2
} from 'lucide-react';

interface VehicleJourneyViewProps {
  initialPlate?: string;
  anprEvents: AnprEvent[];
  alerts?: SystemAlert[];
  cameras?: CameraMasterRecord[];
  onSelectCameraByCode?: (code: string) => void;
  onCreateInvestigationCase?: (plateNumber: string) => void;
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
  const [searchPlate, setSearchPlate] = useState(initialPlate);
  const [selectedSightingId, setSelectedSightingId] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);

  // Sync prop changes
  useEffect(() => {
    if (initialPlate) setSearchPlate(initialPlate);
  }, [initialPlate]);

  // Fetch real-time detections & journey sightings directly from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchDetections = async () => {
      try {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
        
        // 1. Fetch specific journey sightings if plate entered
        if (cleanPlate) {
          try {
            const jRes = await fetch(`${base}/anpr/journey/${encodeURIComponent(cleanPlate)}`);
            if (jRes.ok && isMounted) {
              const jJson = await jRes.json();
              if (jJson.data?.sightings && Array.isArray(jJson.data.sightings) && jJson.data.sightings.length > 0) {
                setLiveAlerts(jJson.data.sightings);
                return;
              }
            }
          } catch (_) {}
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
      }
    };

    fetchDetections();
    const timer = setInterval(fetchDetections, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const cleanPlate = searchPlate.trim().toUpperCase();

  // Helper to resolve coordinates & camera details
  const resolveCoords = (districtName?: string, camCode?: string) => {
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
      const isWatchlist = a.category === 'WATCHLIST_MATCH' || a.severity === 'CRITICAL' || Boolean(a.watchlist);
      const ts = a.timestamp || a.receivedAt || new Date().toISOString();

      return {
        id: String(a.id || `alt-${Math.random()}`),
        plateNumber: (a.plateNumber || a.number_plate || a.plate || cleanPlate).toUpperCase(),
        vehicleType: 'Car',
        color: 'Silver',
        speedKmh: 45,
        confidence: 96.5,
        plateConfidence: 98.0,
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
        direction: 'Northbound',
        watchlistFlag: isWatchlist,
        watchlistReason: isWatchlist ? 'CRIME BRANCH WATCHLIST MATCH' : 'Standard Ingest',
        imageCropUrl: snapUrl || '',
        vehicleImageUrl: snapUrl || '',
      };
    });

  // Include matching mock events
  const mockSightings = (anprEvents || []).filter(e => e.plateNumber.toUpperCase() === cleanPlate);

  // Deduplicate sightings by ID & cameraCode+timestamp
  const sightingMap = new Map<string, AnprEvent>();
  [...mockSightings, ...alertSightings].forEach(s => {
    const key = `${s.cameraCode}_${s.timestamp}`;
    if (!sightingMap.has(s.id) && !sightingMap.has(key)) {
      sightingMap.set(key, s);
    }
  });

  const sightings = Array.from(sightingMap.values())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const firstSighting = sightings[0];
  const lastSighting = sightings[sightings.length - 1];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize Leaflet Journey Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.45, 72.2],
      zoom: 8,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap | Gujarat Police Vehicle Intelligence',
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
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (sightings.length === 0) return;

    const latLngs: L.LatLngTuple[] = [];

    sightings.forEach((s, index) => {
      const isSelected = selectedSightingId === s.id;
      const numLabel = index + 1;
      latLngs.push([s.latitude, s.longitude]);

      const htmlStr = `
        <div style="
          width: ${isSelected ? '32px' : '26px'};
          height: ${isSelected ? '32px' : '26px'};
          border-radius: 50%;
          background-color: ${s.watchlistFlag ? '#DC2626' : '#0052CC'};
          border: 3px solid #FFFFFF;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: 12px;
          font-family: monospace;
        ">
          ${numLabel}
        </div>
      `;

      const icon = L.divIcon({
        html: htmlStr,
        className: 'custom-journey-marker',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([s.latitude, s.longitude], { icon });

      const popupHtml = `
        <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:11px;min-width:200px;padding:2px;">
          <div style="font-weight:900;color:#0052CC;font-family:monospace;font-size:12px;">SIGHTING #${numLabel} &bull; ${s.plateNumber}</div>
          <div style="font-weight:700;color:#0F172A;margin-top:3px;">${s.cameraName}</div>
          <div style="color:#64748B;font-size:10px;margin-top:1px;font-family:monospace;">${s.cameraCode}</div>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:5px 0;"/>
          <div style="color:#475569;font-size:10px;">
            <span style="font-weight:600;">Time:</span> ${s.timestamp}
          </div>
          <div style="color:#475569;font-size:10px;margin-top:2px;">
            <span style="font-weight:600;">District:</span> ${s.district} &nbsp;|&nbsp;
            <span style="font-weight:600;">Dir:</span> ${s.direction}
          </div>
          <div style="margin-top:3px;display:flex;align-items:center;gap:5px;">
            <span style="background:${s.watchlistFlag ? '#FEE2E2' : '#DCFCE7'};color:${s.watchlistFlag ? '#991B1B' : '#166534'};font-size:9px;font-weight:700;padding:1px 6px;border-radius:9999px;">
              ${s.watchlistFlag ? '⚠ WATCHLIST' : '✔ CLEAR'}
            </span>
            <span style="color:#64748B;font-size:10px;">ANPR: ${s.confidence}%</span>
          </div>
        </div>
      `;

      const popup = L.popup({ closeButton: false, offset: [0, -10], className: 'ztrac-hover-popup' }).setContent(popupHtml);
      marker.bindPopup(popup);

      // Show popup on hover, close on mouse-out
      marker.on('mouseover', function() { marker.openPopup(); });
      marker.on('mouseout',  function() { marker.closePopup(); });
      // Click still selects the sighting in the timeline
      marker.on('click', () => setSelectedSightingId(s.id));

      markersGroupRef.current?.addLayer(marker);
    });

    // Draw Vector Polyline sequence line
    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: '#0052CC',
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.85,
      }).addTo(mapInstanceRef.current);

      polylineRef.current = polyline;
      mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } else if (latLngs.length === 1) {
      mapInstanceRef.current.setView(latLngs[0], 12);
    }
  }, [sightings, selectedSightingId]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Vehicle Intelligence Module
            </span>
            <span className="text-xs text-slate-500 font-medium">Multi-Camera Sightings Sequence Analysis</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Vehicle Journey Visualization</h1>
        </div>

        {/* Search Plate Input */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Car className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              placeholder="Search plate (e.g. GJ01AB1234)..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
            />
          </div>

          {onCreateInvestigationCase && (
            <button
              onClick={() => onCreateInvestigationCase(searchPlate)}
              className="px-3.5 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs whitespace-nowrap"
            >
              + Create Case File
            </button>
          )}
        </div>
      </div>

      {/* Vehicle Profile Summary Strip */}
      {firstSighting && (
        <div className="bg-[#06152B] text-white p-5 rounded-xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-900/60 border border-blue-700/60 flex items-center justify-center font-mono font-black text-lg text-white">
              <Car className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xl font-black text-white">{firstSighting.plateNumber}</span>
                {firstSighting.watchlistFlag && (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px] uppercase">
                    CRIME BRANCH WATCHLIST
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {firstSighting.vehicleType} • {firstSighting.color} | Flagged: {firstSighting.watchlistReason || 'Standard Surveillance'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL SIGHTINGS</span>
              <span className="font-bold text-emerald-400 text-base">{sightings.length} Nodes</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">FIRST SEEN</span>
              <span className="font-bold text-white text-xs">{firstSighting.timestamp.slice(11, 19)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">LAST SEEN</span>
              <span className="font-bold text-white text-xs">{lastSighting.timestamp.slice(11, 19)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Section: Timeline on Left, Journey Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Col: Sequential Sightings Timeline (Col 5) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Observed Camera Sequence</h3>
            <span className="text-[11px] text-slate-500 font-mono">Chronological Order (① → ④)</span>
          </div>

          {sightings.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              No recorded sightings found for plate "{searchPlate}"
            </div>
          ) : (
            <div className="relative space-y-4 pl-4 border-l-2 border-blue-200">
              {sightings.map((sighting, idx) => {
                const isSelected = selectedSightingId === sighting.id;
                return (
                  <div
                    key={sighting.id}
                    onClick={() => setSelectedSightingId(sighting.id)}
                    className={`relative p-3 rounded-xl border transition cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50/80 border-[#0052CC] ring-2 ring-blue-500/20' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {/* Circle Sequence Badge */}
                    <div className={`absolute -left-[25px] top-3.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black text-white border-2 border-white shadow-2xs ${
                      sighting.watchlistFlag ? 'bg-rose-600' : 'bg-[#0052CC]'
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs font-bold text-[#0052CC]">{sighting.cameraCode}</div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5">{sighting.cameraName}</div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-600">{sighting.timestamp.slice(11, 19)}</span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span>{sighting.district} • {sighting.direction}</span>
                      <span className="font-bold text-emerald-600">{sighting.confidence}% ANPR</span>
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
            <span className="text-[10px] text-slate-500 font-mono">Leaflet.js Vector Layer</span>
          </div>

          {/* Leaflet Map Div */}
          <div className="relative w-full h-[460px] rounded-xl overflow-hidden border border-slate-300">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
            
            {/* Disclaimer Disclaimer */}
            <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-xs p-2 rounded text-[10px] text-slate-600 font-mono border border-slate-200 max-w-sm">
              ℹ️ Observed camera sightings sequence. Dotted line vectors represent chronological observation order, not exact GPS telematics track.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
