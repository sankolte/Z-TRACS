import React, { useState } from 'react';
import { AnprEvent, Department, District, SystemAlert } from '../types';
import { 
  Search, 
  Filter, 
  Calendar, 
  Car, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ShieldAlert, 
  Eye, 
  FileText, 
  Download,
  RotateCcw,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  Camera,
  X,
  Maximize2,
  Printer,
  FileSpreadsheet
} from 'lucide-react';

interface AnprSearchViewProps {
  anprEvents: AnprEvent[];
  alerts?: SystemAlert[];
  departments: Department[];
  districts: District[];
  onSelectPlateForJourney: (plateNumber: string) => void;
  onSelectCameraByCode?: (cameraCode: string) => void;
}

const DEFAULT_PLATE_CROP = '';

export const AnprSearchView: React.FC<AnprSearchViewProps> = ({
  anprEvents,
  alerts = [],
  departments,
  districts,
  onSelectPlateForJourney,
  onSelectCameraByCode,
}) => {
  const [searchPlate, setSearchPlate] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedVehicleType, setSelectedVehicleType] = useState('ALL');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [filterRepeats30m, setFilterRepeats30m] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [liveDetections, setLiveDetections] = useState<any[]>([]);

  // Snapshot Lightbox Modal State
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    url: string;
    title: string;
    plate: string;
    cam: string;
    camName?: string;
    district: string;
    location?: string;
    time: string;
    vehicleType?: string;
    color?: string;
    speed?: number;
    confidence?: number;
    plateConfidence?: number;
    watchlist?: boolean;
  } | null>(null);

  const [modalImgError, setModalImgError] = useState(false);

  // Watchlist Management State (Type 2 Alert Trigger)
  const [activeWatchlist, setActiveWatchlist] = useState<string[]>([]);
  const [newPlateInput, setNewPlateInput] = useState('');
  const [watchlistMsg, setWatchlistMsg] = useState('');

  const resetFilters = () => {
    setSearchPlate('');
    setSelectedDept('ALL');
    setSelectedDistrict('ALL');
    setSelectedVehicleType('ALL');
    setWatchlistOnly(false);
  };

  // Fetch live detections & active watchlist from backend
  React.useEffect(() => {
    let isMounted = true;

    const fetchWatchlist = async () => {
      try {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
        const res = await fetch(`${base}/anpr/watchlist`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.watchlist && Array.isArray(json.watchlist)) {
            setActiveWatchlist(json.watchlist);
          }
        }
      } catch (err) {
        console.warn('[Watchlist UI] Initial fetch error:', err);
      }
    };

    const fetchLiveDetections = async () => {
      try {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
        const res = await fetch(`${base}/anpr/search?limit=1000`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            setLiveDetections(json.data);
          }
        }
      } catch (err) {
        console.warn('[AnprSearchView] Live detections fetch error:', err);
      }
    };

    fetchWatchlist();
    fetchLiveDetections();
    const timer = setInterval(fetchLiveDetections, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleAddPlateToWatchlist = async () => {
    const clean = newPlateInput.trim().toUpperCase();
    if (!clean) return;
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
      await fetch(`${base}/anpr/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: clean }),
      });
      if (!activeWatchlist.includes(clean)) {
        setActiveWatchlist(prev => [clean, ...prev]);
      }
      setWatchlistMsg(`✅ Plate ${clean} added to Watchlist! Cameras will now flag this plate as Type 2 CRITICAL Alert.`);
      setNewPlateInput('');
      setTimeout(() => setWatchlistMsg(''), 4000);
    } catch (err) {
      setWatchlistMsg(`⚠️ Added locally: ${clean}`);
      if (!activeWatchlist.includes(clean)) setActiveWatchlist(prev => [clean, ...prev]);
      setNewPlateInput('');
      setTimeout(() => setWatchlistMsg(''), 3000);
    }
  };

  const handleRemovePlate = async (plate: string) => {
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
      await fetch(`${base}/anpr/watchlist/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate }),
      });
    } catch (err) {
      // non-fatal
    }
    setActiveWatchlist(prev => prev.filter(p => p !== plate));
  };

  const formatSnapshotUrl = (snapshot?: string) => {
    if (!snapshot || snapshot.trim() === '') return undefined;
    let s = snapshot.trim();
    if (s.includes('/api/v1/anpr/alerts/')) {
      s = s.substring(s.indexOf('/api/v1/anpr/alerts/'));
    }
    if (s.startsWith('http://') || s.startsWith('https://')) {
      if (s.includes('unsplash.com')) return undefined; // Filter out mock stock photos
      return s;
    }
    if (s.startsWith('data:image')) return s;
    if (s.startsWith('/api/')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      return isHttps ? `${window.location.origin}${s}` : `http://43.204.235.231:8000${s}`;
    }
    if (s.length > 200) {
      return `data:image/jpeg;base64,${s}`;
    }
    return undefined;
  };

  // 1. Map system alerts passed from App state (real-time alerts stream)
  const alertsMapped: AnprEvent[] = alerts
    .map(a => {
      const p = (a.plateNumber || a.title?.replace(/.*:\s*/, '') || 'UNKNOWN').trim().toUpperCase();
      if (!p || p === 'UNKNOWN') return null;
      const camCode = a.cameraCode || 'CAM-001';
      const camName = a.cameraName || `Camera ${camCode}`;
      const dist = a.district || 'Ahmedabad';
      const snapUrl = formatSnapshotUrl((a as any).plateCrop || (a as any).plate_crop || a.snapshot);
      const isWatchlist = a.category === 'WATCHLIST_MATCH' || a.category === 'WATCHLIST_HIT' || a.severity === 'CRITICAL' || a.title?.toLowerCase().includes('watchlist');

      // Real speed (undefined if not detected)
      const rawSp = (a as any).speedKmh ?? (a as any).speed ?? (a as any).speed_kmh;
      const speedKmh = (rawSp !== undefined && rawSp !== null && !isNaN(Number(rawSp)) && Number(rawSp) > 0) ? Number(rawSp) : undefined;

      // Real confidence (undefined if not detected)
      const rawC = (a as any).confidence ?? (a as any).score ?? (a as any).ai_confidence;
      let confidence: number | undefined = undefined;
      if (rawC !== undefined && rawC !== null && !isNaN(Number(rawC)) && Number(rawC) > 0) {
        const numC = Number(rawC);
        confidence = numC <= 1.0 ? Number((numC * 100).toFixed(1)) : Number(numC.toFixed(1));
      }

      // Real plate confidence (undefined if not detected)
      const rawPc = (a as any).plateConfidence ?? (a as any).plate_confidence;
      let plateConfidence: number | undefined = undefined;
      if (rawPc !== undefined && rawPc !== null && !isNaN(Number(rawPc)) && Number(rawPc) > 0) {
        const numPc = Number(rawPc);
        plateConfidence = numPc <= 1.0 ? Number((numPc * 100).toFixed(1)) : Number(numPc.toFixed(1));
      }

      return {
        id: String(a.id || `alert-${p}-${a.timestamp || Date.now()}`),
        plateNumber: p,
        vehicleType: (a as any).vehicleType || (a as any).vehicle_type || 'VEHICLE',
        color: '',
        speedKmh: speedKmh as any,
        confidence: confidence as any,
        plateConfidence: plateConfidence as any,
        cameraUuid: a.cameraUuid || camCode,
        cameraCode: camCode,
        cameraName: camName,
        district: dist,
        departmentId: a.departmentId || 'DEPT-POL-01',
        departmentName: a.departmentName || 'Gujarat Police Traffic Division',
        locationDescription: a.locationDescription || a.location || a.notes || `🚨 Real-time Watchlist Hit at ${camName} (${dist})`,
        latitude: a.latitude || 23.0225,
        longitude: a.longitude || 72.5714,
        timestamp: a.timestamp || new Date().toISOString(),
        direction: a.direction || 'Northbound',
        watchlistFlag: isWatchlist,
        watchlistReason: isWatchlist ? (a.watchlistReason || 'CRIME BRANCH WATCHLIST MATCH') : undefined,
        imageCropUrl: snapUrl,
        vehicleImageUrl: snapUrl,
      };
    })
    .filter(Boolean) as AnprEvent[];

  // 2. Map live detections fetched directly from backend
  const liveEventsMapped: AnprEvent[] = liveDetections
    .map(a => {
      const p = (a.plateNumber || a.number_plate || a.plate || a.title?.replace(/.*:\s*/, '') || 'UNKNOWN').trim().toUpperCase();
      if (!p || p === 'UNKNOWN') return null;
      const camCode = a.cameraCode || (a.camera_id ? `CAM-${String(a.camera_id).padStart(3, '0')}` : 'CAM-011');
      const camName = a.cameraName || (a.camera_id ? `Camera ${a.camera_id} (${a.district || 'Gujarat'})` : 'Gujarat Surveillance Node');
      const dist = a.district || 'Ahmedabad';
      const snapUrl = formatSnapshotUrl(a.plateCrop || a.plate_crop || a.PlateCrop || a.snapshot || a.imageCropUrl);
      const isWatchlist = a.category === 'WATCHLIST_MATCH' || a.category === 'WATCHLIST_HIT' || a.severity === 'CRITICAL' || Boolean(a.watchlist) || String(a.title || '').toLowerCase().includes('watchlist');
      const ts = a.timestamp || a.receivedAt || a.created_at || a.detected_at || new Date().toISOString();

      // Real speed (undefined if not detected)
      const rawSp = a.speedKmh ?? a.speed ?? a.speed_kmh;
      const speedKmh = (rawSp !== undefined && rawSp !== null && !isNaN(Number(rawSp)) && Number(rawSp) > 0) ? Number(rawSp) : undefined;

      // Real confidence (undefined if not detected)
      const rawC = a.confidence ?? a.score ?? a.ai_confidence;
      let confidence: number | undefined = undefined;
      if (rawC !== undefined && rawC !== null && !isNaN(Number(rawC)) && Number(rawC) > 0) {
        const numC = Number(rawC);
        confidence = numC <= 1.0 ? Number((numC * 100).toFixed(1)) : Number(numC.toFixed(1));
      }

      // Real plate confidence (undefined if not detected)
      const rawPc = a.plateConfidence ?? a.plate_confidence;
      let plateConfidence: number | undefined = undefined;
      if (rawPc !== undefined && rawPc !== null && !isNaN(Number(rawPc)) && Number(rawPc) > 0) {
        const numPc = Number(rawPc);
        plateConfidence = numPc <= 1.0 ? Number((numPc * 100).toFixed(1)) : Number(numPc.toFixed(1));
      }

      return {
        id: String(a.id || `evt-${Math.random()}`),
        plateNumber: p,
        vehicleType: a.vehicleType || a.vehicle_type || 'VEHICLE',
        color: '',
        speedKmh: speedKmh as any,
        confidence: confidence as any,
        plateConfidence: plateConfidence as any,
        cameraUuid: a.cameraUuid || camCode,
        cameraCode: camCode,
        cameraName: camName,
        district: dist,
        departmentId: a.departmentId || 'DEPT-POL-01',
        departmentName: a.departmentName || 'Gujarat Police Traffic Division',
        locationDescription: a.locationDescription || a.location || a.notes || `Detected at ${camName} (${dist})`,
        latitude: a.latitude || 23.0225,
        longitude: a.longitude || 72.5714,
        timestamp: ts,
        direction: a.direction || 'Northbound',
        watchlistFlag: isWatchlist,
        watchlistReason: isWatchlist ? (a.watchlistReason || 'CRIME BRANCH WATCHLIST MATCH') : undefined,
        imageCropUrl: snapUrl,
        vehicleImageUrl: snapUrl,
      };
    })
    .filter(Boolean) as AnprEvent[];

  // Real events only (no fake mock data merged)
  const combinedEvents = [...alertsMapped, ...liveEventsMapped];
  const uniqueEventsMap = new Map<string, AnprEvent>();
  combinedEvents.forEach(e => {
    const key = e.id || `${e.plateNumber}_${e.cameraCode}_${e.timestamp}`;
    if (!uniqueEventsMap.has(key)) {
      uniqueEventsMap.set(key, e);
    }
  });

  // Sort descending by timestamp so real-time alerts appear at the very top (Row 1)
  const allEventsList = Array.from(uniqueEventsMap.values()).sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });

  // Filter out development test / debug seed plates so UI only shows authentic camera events
  const isDebugDummyPlate = (plateStr: string) => {
    const p = (plateStr || '').toUpperCase().replace(/[\s-]+/g, '');
    const dummyExact = [
      'GJ01TEST555',
      'GJ01LIVE999',
      'GJ01SPEED777',
      'GJ01REAL888',
      'GJ01PASS227',
      'GJ01E2E711',
      'GJ01CRIME2734',
      'GJ03CD0111',
      'GJ01AB1234',
      'GJ01ZZ4321',
      'MH12AB1234',
    ];
    if (dummyExact.includes(p)) return true;
    if (p.includes('TEST') || p.includes('SPEED7') || p.includes('E2E7') || p.includes('PASS227')) return true;
    return false;
  };

  // Filtered ANPR records
  const filteredEvents = allEventsList.filter(evt => {
    // Hide test / debug dummy records from UI display (keeps RDS completely untouched)
    if (isDebugDummyPlate(evt.plateNumber)) return false;

    if (searchPlate.trim()) {
      if (!evt.plateNumber.toLowerCase().includes(searchPlate.trim().toLowerCase())) return false;
    }
    if (selectedDept !== 'ALL') {
      if (evt.departmentId !== selectedDept && selectedDept !== 'DEPT-POL-01') return false;
    }
    if (selectedDistrict !== 'ALL') {
      if (evt.district.toLowerCase() !== selectedDistrict.toLowerCase()) return false;
    }
    if (selectedVehicleType !== 'ALL' && evt.vehicleType !== selectedVehicleType) return false;
    if (watchlistOnly && !evt.watchlistFlag) return false;
    return true;
  });

  // 30-Minute Sighting Debounce / Repeat Filter (Eliminates identical plate spam within 30 mins)
  const displayEvents = React.useMemo(() => {
    if (!filterRepeats30m) return filteredEvents;

    const debounced: AnprEvent[] = [];
    const lastSeenMap = new Map<string, number>();
    const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

    for (const evt of filteredEvents) {
      // Critical Watchlist alerts are ALWAYS preserved & shown without suppression
      if (evt.watchlistFlag) {
        debounced.push(evt);
        continue;
      }

      const cleanPlate = (evt.plateNumber || '').toUpperCase().replace(/[\s-]+/g, '');
      const key = `${cleanPlate}_${evt.cameraCode || 'CAM'}`;
      const evtTime = new Date(evt.timestamp).getTime() || 0;

      const lastSeen = lastSeenMap.get(key);
      if (lastSeen === undefined || Math.abs(lastSeen - evtTime) >= COOLDOWN_MS) {
        lastSeenMap.set(key, evtTime);
        debounced.push(evt);
      }
    }

    return debounced;
  }, [filteredEvents, filterRepeats30m]);

  // Unique list of active districts from props & events
  const activeDistrictNames = Array.from(
    new Set([
      ...districts.map(d => d.name),
      ...allEventsList.map(e => e.district).filter(Boolean)
    ])
  ).sort();

  const handleExportExcel = () => {
    const headers = [
      'Plate Number',
      'Camera Code',
      'Camera Name',
      'District',
      'Location & Details',
      'Timestamp',
      'Vehicle Type',
      'Color',
      'Speed (km/h)',
      'AI Confidence (%)',
      'Plate Confidence (%)',
      'Watchlist Match'
    ];

    const rows = displayEvents.map(evt => [
      `"${evt.plateNumber}"`,
      `"${evt.cameraCode}"`,
      `"${evt.cameraName || ''}"`,
      `"${evt.district}"`,
      `"${(evt.locationDescription || '').replace(/"/g, '""')}"`,
      `"${evt.timestamp}"`,
      `"${evt.vehicleType}"`,
      `"${evt.color}"`,
      evt.speedKmh,
      evt.confidence,
      evt.plateConfidence,
      evt.watchlistFlag ? 'YES (CRIME BRANCH WATCHLIST)' : 'NO'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ANPR_Detection_Report_Gujarat_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print ANPR Detection Report');
      return;
    }

    const rowsHtml = displayEvents.map((evt, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-family: monospace; font-size: 11px;">
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${evt.plateNumber}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0052cc;">${evt.cameraCode}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${evt.district}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${evt.locationDescription}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${evt.timestamp}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #059669;">${evt.confidence}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
          ${evt.watchlistFlag ? '<span style="color: #dc2626; font-weight: bold;">CRIME BRANCH WATCHLIST</span>' : '<span style="color: #64748b;">STANDARD</span>'}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statewide ANPR Detection Audit Report - Gujarat Police</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
            .header { border-bottom: 2px solid #0052cc; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 18px; font-weight: bold; color: #00253e; }
            .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
            .meta { font-size: 11px; color: #334155; margin-bottom: 16px; background: #f1f5f9; padding: 10px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #00253e; color: white; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
            .footer { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">GUJARAT POLICE — STATEWIDE ANPR SURVEILLANCE AUDIT REPORT</div>
              <div class="subtitle">Command & Control Center • Automatic Number Plate Recognition Engine</div>
            </div>
            <div style="text-align: right; font-size: 11px; font-family: monospace;">
              <strong>Generated:</strong> ${new Date().toLocaleString()}<br/>
              <strong>Total Detected Plates:</strong> ${filteredEvents.length} Records
            </div>
          </div>

          <div class="meta">
            <strong>Active Query Parameters:</strong> Plate Filter: "${searchPlate || 'ALL'}" | District Jurisdiction: "${selectedDistrict}" | Vehicle Type: "${selectedVehicleType}" | Watchlist Hits Only: ${watchlistOnly ? 'YES' : 'NO'}
          </div>

          <table>
            <thead>
              <tr>
                <th>Plate Number</th>
                <th>Camera Code</th>
                <th>District</th>
                <th>Location Description</th>
                <th>Timestamp</th>
                <th>Confidence</th>
                <th>Watchlist Flag</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <span>Z-TRACS Law Enforcement Audit Trail • Cryptographic Telemetry Sealed</span>
            <span>State Data Center • Gandhinagar</span>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Model 2 Video Intelligence
            </span>
            <span className="text-xs text-slate-500 font-medium">Automatic Number Plate Recognition (ANPR) Query</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Statewide ANPR Search Engine</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            title="Export filtered ANPR detection results to CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (CSV)</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            title="Print clean law enforcement ANPR audit report"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Print Report</span>
          </button>

          {searchPlate.trim() && (
            <button
              onClick={() => onSelectPlateForJourney(searchPlate.trim().toUpperCase())}
              className="px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Analyze {searchPlate.trim().toUpperCase()} Journey →</span>
            </button>
          )}
        </div>
      </div>

      {/* Watchlist Management & Target Plate Search Panel (Type 2 Alert Trigger) */}
      <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold text-rose-900">Watchlist Target Flagging (Type 2 Alert Search)</h2>
              <p className="text-[11px] text-rose-700">Add a license plate to watch. Any camera detecting this plate across Gujarat will trigger a Type 2 Watchlist Match alert!</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Car className="w-4 h-4 text-rose-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={newPlateInput}
              onChange={(e) => setNewPlateInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPlateToWatchlist()}
              placeholder="Enter Plate Number to Flag (e.g. GJ01STOLEN9)..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-mono font-bold text-rose-900 placeholder:text-rose-300 focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <button
            onClick={handleAddPlateToWatchlist}
            className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center justify-center space-x-1 whitespace-nowrap"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>+ Flag Plate for Watchlist</span>
          </button>
        </div>

        {watchlistMsg && (
          <div className="text-xs font-bold text-emerald-800 bg-emerald-100 p-2 rounded-lg border border-emerald-300 animate-in fade-in">
            {watchlistMsg}
          </div>
        )}

        {/* Active Watched Plate Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Active Watched Plates ({activeWatchlist.length}):</span>
          {activeWatchlist.map(plate => (
            <span key={plate} className="px-2 py-0.5 bg-white border border-rose-300 text-rose-900 rounded-md font-mono font-bold text-[11px] flex items-center space-x-1 shadow-2xs">
              <span>🚨 {plate}</span>
              <button
                onClick={() => handleRemovePlate(plate)}
                className="text-rose-400 hover:text-rose-700 ml-1 font-bold"
                title="Remove from Watchlist"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ANPR Search Form Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Plate Number Input */}
          <div className="lg:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">License Plate Number:</label>
            <div className="relative">
              <Car className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                placeholder="e.g. GJ01AB1234 or GJ05"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Department Scope:</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">District Jurisdiction:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 font-bold focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">All Districts ({activeDistrictNames.length} Active Jurisdictions)</option>
              {activeDistrictNames.map(distName => (
                <option key={distName} value={distName}>{distName}</option>
              ))}
            </select>
          </div>

          {/* Vehicle Type Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Vehicle Classification:</label>
            <select
              value={selectedVehicleType}
              onChange={(e) => setSelectedVehicleType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">All Types</option>
              <option value="Car">Car / Sedan</option>
              <option value="SUV">SUV / MUV</option>
              <option value="Truck">Commercial Truck</option>
              <option value="Motorcycle">Motorcycle / Two-Wheeler</option>
              <option value="Bus">GSRTC Bus</option>
            </select>
          </div>

        </div>

        {/* Sub-toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center space-x-1.5 font-bold text-rose-700 cursor-pointer">
              <input
                type="checkbox"
                checked={watchlistOnly}
                onChange={(e) => setWatchlistOnly(e.target.checked)}
                className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
              />
              <span>Flagged Watchlist Matches Only</span>
            </label>

            <label className="flex items-center space-x-1.5 font-bold text-indigo-700 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 transition" title="Filter consecutive duplicate detections of the same vehicle at the same camera within 30 minutes">
              <input
                type="checkbox"
                checked={filterRepeats30m}
                onChange={(e) => setFilterRepeats30m(e.target.checked)}
                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Debounce Repeats (30m Window)</span>
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white text-[#0052CC] shadow-2xs' : 'text-slate-500'}`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white text-[#0052CC] shadow-2xs' : 'text-slate-500'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={resetFilters}
              className="text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

      </div>

      {/* ANPR Results Listing */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-[#EDF3FA] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-slate-800">
                Found {displayEvents.length} ANPR Detections {filterRepeats30m && filteredEvents.length !== displayEvents.length ? `(30m Window Debounced from ${filteredEvents.length} frames)` : 'Matching Query'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                title="Download CSV / Excel File"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handlePrintReport}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] rounded transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                title="Print Audit Report"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Plate Crop</th>
                  <th className="p-3">Plate Number</th>
                  <th className="p-3">Camera Node</th>
                  <th className="p-3">Location & District</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {displayEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No ANPR events found for plate query "{searchPlate}"
                    </td>
                  </tr>
                ) : (
                  displayEvents.map(evt => (
                    <tr key={evt.id} className="hover:bg-blue-50/40 transition">
                      <td className="p-3">
                        {evt.imageCropUrl ? (
                          <button
                            onClick={() => {
                              setModalImgError(false);
                              setSelectedSnapshot({
                                url: evt.imageCropUrl || evt.vehicleImageUrl,
                                title: `ANPR Evidence: ${evt.plateNumber} • ${evt.cameraCode}`,
                                plate: evt.plateNumber,
                                cam: evt.cameraCode,
                                camName: evt.cameraName,
                                district: evt.district,
                                location: evt.locationDescription,
                                time: evt.timestamp,
                                vehicleType: evt.vehicleType,
                                color: evt.color,
                                speed: evt.speedKmh,
                                confidence: evt.confidence,
                                plateConfidence: evt.plateConfidence,
                                watchlist: evt.watchlistFlag,
                              });
                            }}
                            className="relative group cursor-pointer overflow-hidden rounded border border-slate-300 shadow-2xs hover:border-[#0052CC] transition block bg-slate-900"
                            title="Click to view full image snapshot & details"
                          >
                            <img src={evt.imageCropUrl} alt={evt.plateNumber} className="w-16 h-10 object-cover group-hover:scale-110 transition duration-200" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-16 h-10 rounded border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none">
                            <Camera className="w-3.5 h-3.5 text-slate-300 mb-0.5" />
                            <span className="text-[8px] font-mono leading-none text-slate-400">NO CROP</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            setModalImgError(false);
                            setSelectedSnapshot({
                              url: evt.imageCropUrl || evt.vehicleImageUrl,
                              title: `ANPR Evidence: ${evt.plateNumber} • ${evt.cameraCode}`,
                              plate: evt.plateNumber,
                              cam: evt.cameraCode,
                              camName: evt.cameraName,
                              district: evt.district,
                              location: evt.locationDescription,
                              time: evt.timestamp,
                              vehicleType: evt.vehicleType,
                              color: evt.color,
                              speed: evt.speedKmh,
                              confidence: evt.confidence,
                              plateConfidence: evt.plateConfidence,
                              watchlist: evt.watchlistFlag,
                            });
                          }}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-mono font-black text-slate-900 text-sm group-hover:text-[#0052CC] transition">{evt.plateNumber}</div>
                          {evt.watchlistFlag && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono font-bold text-[9px] block w-fit mt-0.5">
                              CRIME BRANCH WATCHLIST
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-3 font-mono font-bold text-[#0052CC]">{evt.cameraCode}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{evt.district}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{evt.locationDescription}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">{evt.timestamp}</td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setModalImgError(false);
                            setSelectedSnapshot({
                              url: evt.imageCropUrl || evt.vehicleImageUrl,
                              title: `ANPR Evidence: ${evt.plateNumber} • ${evt.cameraCode}`,
                              plate: evt.plateNumber,
                              cam: evt.cameraCode,
                              camName: evt.cameraName,
                              district: evt.district,
                              location: evt.locationDescription,
                              time: evt.timestamp,
                              vehicleType: evt.vehicleType,
                              color: evt.color,
                              speed: evt.speedKmh,
                              confidence: evt.confidence,
                              plateConfidence: evt.plateConfidence,
                              watchlist: evt.watchlistFlag,
                            });
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition"
                          title="View Snapshot Details"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          View
                        </button>
                        <button
                          onClick={() => onSelectPlateForJourney(evt.plateNumber)}
                          className="px-3 py-1 bg-[#0052CC] hover:bg-[#0041A8] text-white rounded text-[11px] font-bold shadow-2xs"
                        >
                          Vehicle Journey →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayEvents.map(evt => (
            <div key={evt.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div 
                onClick={() => {
                  setModalImgError(false);
                  setSelectedSnapshot({
                    url: evt.vehicleImageUrl || evt.imageCropUrl,
                    title: `ANPR Evidence: ${evt.plateNumber} • ${evt.cameraCode}`,
                    plate: evt.plateNumber,
                    cam: evt.cameraCode,
                    camName: evt.cameraName,
                    district: evt.district,
                    location: evt.locationDescription,
                    time: evt.timestamp,
                    vehicleType: evt.vehicleType,
                    color: evt.color,
                    speed: evt.speedKmh,
                    confidence: evt.confidence,
                    plateConfidence: evt.plateConfidence,
                    watchlist: evt.watchlistFlag,
                  });
                }}
                className="relative h-36 rounded-lg overflow-hidden bg-slate-900 group cursor-pointer border border-slate-800"
              >
                <img src={evt.vehicleImageUrl} alt={evt.plateNumber} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <span className="px-2.5 py-1 bg-black/75 text-white font-bold text-xs rounded-full flex items-center space-x-1">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>View Image & Details</span>
                  </span>
                </div>
                <div className="absolute top-2 left-2 bg-slate-900/90 px-2 py-0.5 rounded text-white font-mono font-bold text-xs border border-slate-700">
                  {evt.plateNumber}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Camera:</span>
                  <span className="font-bold text-[#0052CC]">{evt.cameraCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-semibold text-slate-800">{evt.district}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-500">Time:</span>
                  <span>{evt.timestamp}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    setModalImgError(false);
                    setSelectedSnapshot({
                      url: evt.vehicleImageUrl || evt.imageCropUrl,
                      title: `ANPR Evidence: ${evt.plateNumber} • ${evt.cameraCode}`,
                      plate: evt.plateNumber,
                      cam: evt.cameraCode,
                      camName: evt.cameraName,
                      district: evt.district,
                      location: evt.locationDescription,
                      time: evt.timestamp,
                      vehicleType: evt.vehicleType,
                      color: evt.color,
                      speed: evt.speedKmh,
                      confidence: evt.confidence,
                      plateConfidence: evt.plateConfidence,
                      watchlist: evt.watchlistFlag,
                    });
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSelectPlateForJourney(evt.plateNumber)}
                  className="flex-1 py-2 bg-[#0052CC] text-white font-bold text-xs rounded-lg hover:bg-[#0041A8] transition shadow-xs"
                >
                  Analyze Journey →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snapshot Lightbox Modal overlay with detailed specs */}
      {selectedSnapshot && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div 
            className="bg-white rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>ANPR High-Resolution Detection Evidence</span>
                </h3>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">{selectedSnapshot.title}</p>
              </div>
              <button 
                onClick={() => setSelectedSnapshot(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Snapshot Image Display */}
            <div className="bg-slate-950 p-3 flex items-center justify-center min-h-[260px] max-h-[460px] relative">
              {!selectedSnapshot.url || modalImgError ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-mono">
                  <Camera className="w-10 h-10 opacity-30 mb-2" />
                  <span className="text-xs">NO PLATE CROP OR IMAGE SNAPSHOT STORED FOR THIS EVENT</span>
                </div>
              ) : (
                <img 
                  src={selectedSnapshot.url} 
                  alt="ANPR High Resolution Snapshot" 
                  className="max-h-[430px] w-auto object-contain rounded border border-slate-800 shadow"
                  onError={() => setModalImgError(true)}
                />
              )}
              {selectedSnapshot.watchlist && (
                <div className="absolute top-4 left-4 bg-rose-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded shadow-md flex items-center space-x-1 animate-pulse">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>CRIME BRANCH WATCHLIST HIT</span>
                </div>
              )}
            </div>

            {/* Specs & Metadata Details */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">LICENSE PLATE</span>
                <span className="font-mono font-black text-[#0052CC] text-sm">{selectedSnapshot.plate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">CAMERA CODE</span>
                <span className="font-mono font-bold text-slate-800">{selectedSnapshot.cam}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">DISTRICT</span>
                <span className="font-bold text-slate-800">{selectedSnapshot.district}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">TIMESTAMP</span>
                <span className="font-mono text-slate-700 text-[11px]">{selectedSnapshot.time}</span>
              </div>

              {selectedSnapshot.location && (
                <div className="col-span-2 sm:col-span-4 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-sans">
                  <span className="font-bold text-slate-900 block mb-0.5">Location / Telemetry Details:</span>
                  {selectedSnapshot.location}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const p = selectedSnapshot.plate;
                  setSelectedSnapshot(null);
                  onSelectPlateForJourney(p);
                }}
                className="px-4 py-1.5 bg-[#0052CC] hover:bg-[#0041A8] text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center space-x-1.5 font-bold"
              >
                <span>Analyze Vehicle Journey →</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
