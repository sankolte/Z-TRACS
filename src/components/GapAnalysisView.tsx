import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Radar, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Download, 
  FileSpreadsheet, 
  Cpu, 
  ArrowRight, 
  TrendingUp, 
  Sparkles, 
  ShieldAlert, 
  FileCheck, 
  Shield,
  Layers
} from 'lucide-react';
import { GapArea, Language } from '../types';

interface GapAnalysisViewProps {
  gapAreas: GapArea[];
  currentLang?: Language;
}

const BLINDSPOT_LOCATIONS = [
  { id: 'gap-1', district: 'Surendranagar', name: 'Surendranagar - Wadhwan State Highway Gap 14', priority: 'High', coveragePct: 42, reqNodes: 18, lat: 22.722, lng: 71.637 },
  { id: 'gap-2', district: 'Kutch West', name: 'Naliya Border Checkpoint Blindspot', priority: 'Critical', coveragePct: 28, reqNodes: 35, lat: 23.262, lng: 68.831 },
  { id: 'gap-3', district: 'Tapi', name: 'Songadh Interstate Highway Blindspot', priority: 'High', coveragePct: 35, reqNodes: 24, lat: 21.168, lng: 73.606 },
  { id: 'gap-4', district: 'Dang', name: 'Ahwa Forest Corridor Gap Zone', priority: 'Medium', coveragePct: 48, reqNodes: 14, lat: 20.753, lng: 73.685 },
  { id: 'gap-5', district: 'Bhavnagar', name: 'Coastal Creek Access Blindspot', priority: 'Critical', coveragePct: 31, reqNodes: 28, lat: 21.764, lng: 72.151 },
  { id: 'gap-6', district: 'Banaskantha', name: 'Palanpur North Bypass Reserve Gap', priority: 'High', coveragePct: 39, reqNodes: 22, lat: 24.172, lng: 72.438 }
];

export const GapAnalysisView: React.FC<GapAnalysisViewProps> = ({
  gapAreas = [],
}) => {
  const [filterPriority, setFilterPriority] = useState('All');
  const [proposalGenerated, setProposalGenerated] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Initialize Leaflet Gap Analysis Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.670, 71.600],
      zoom: 8,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | Gujarat Gap Analytics',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);

    BLINDSPOT_LOCATIONS.forEach(spot => {
      const colorHex = spot.priority === 'Critical' ? '#DC2626' : spot.priority === 'High' ? '#D97706' : '#2563EB';

      const iconHtml = `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
        ">
          <div style="
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background-color: ${colorHex}35;
            animation: pulse 2s infinite;
          "></div>
          <div style="
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: ${colorHex};
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            z-index: 10;
          "></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-gap-node-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:12px;padding:4px 2px;min-width:210px;">
          <div style="font-weight:800;color:#0F172A;font-size:13px;">${spot.name}</div>
          <div style="color:#64748B;font-size:10.5px;font-weight:600;margin-top:2px;">District: ${spot.district}</div>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:6px 0;"/>
          <div style="display:flex;justify-between;gap:8px;font-size:11px;">
            <span style="color:#64748B;">Priority:</span>
            <strong style="color:${colorHex};">${spot.priority} Action</strong>
          </div>
          <div style="display:flex;justify-between;gap:8px;font-size:11px;margin-top:3px;">
            <span style="color:#64748B;">Current Density:</span>
            <strong style="color:#0F172A;">${spot.coveragePct}%</strong>
          </div>
          <div style="display:flex;justify-between;gap:8px;font-size:11px;margin-top:3px;">
            <span style="color:#64748B;">Required CCTV Nodes:</span>
            <strong style="color:#0052CC;">+${spot.reqNodes} Units</strong>
          </div>
        </div>
      `;

      marker.bindPopup(L.popup({ closeButton: false, offset: [0, -10] }).setContent(popupContent));
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());

      markersGroup.addLayer(marker);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const filteredGaps = gapAreas.filter(g => {
    if (filterPriority === 'All') return true;
    return g.priority === filterPriority;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 select-none">
      
      {/* Top Banner: Statewide Density & Blindspot Index */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Coverage Index Gauge */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <span className="text-xs font-semibold text-slate-500">
            Statewide Density Index
          </span>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-emerald-600 font-mono">78.4%</span>
            <span className="text-xs font-bold text-[#0052CC]">
              Target: 95.0% (2027)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
            <div style={{ width: '78.4%' }} className="bg-[#0052CC] h-full"></div>
          </div>
          <p className="text-[11px] text-slate-500">
            Urban coverage optimal; arterial expansion underway in border corridors.
          </p>
        </div>

        {/* Critical Gaps Count */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <span className="text-xs font-semibold text-slate-500">
            Identified High-Risk Gaps
          </span>
          <div className="text-3xl font-black text-amber-600 font-mono">42 Locations</div>
          <p className="text-xs text-amber-700 font-medium">
            Interstate border & reserve highway corridors flagged
          </p>
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <span>Low Coverage Districts:</span>
            <span className="text-slate-800 font-bold">Kutch West, Dang, Tapi</span>
          </div>
        </div>

        {/* Proposed Budget Action */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              100-Day Priority Action
            </span>
            <div className="text-lg font-bold text-slate-900 mt-1">₹48.5 Cr Phase-3 DPR</div>
            <p className="text-xs text-slate-500">
              Detailed Project Report submitted for Home Department approval.
            </p>
          </div>
          <button
            onClick={() => setProposalGenerated(true)}
            className="w-full py-2 bg-[#0052CC] hover:bg-[#0041A8] text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-2xs transition"
          >
            <FileCheck className="w-4 h-4" />
            <span>{proposalGenerated ? 'DPR Exported!' : 'Export Gap Analysis DPR'}</span>
          </button>
        </div>

      </div>

      {/* Interactive Leaflet Blindspot & Gap Analysis Map */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radar className="w-4 h-4 text-[#0052CC]" />
            <h3 className="text-sm font-bold text-slate-900">Geospatial Blindspot & High-Risk Corridor Map</h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Leaflet.js • OpenStreetMap Vector Grid
          </span>
        </div>

        <div className="relative h-[360px] rounded-xl overflow-hidden border border-slate-300">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
          
          <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1.5">
            <span className="font-bold text-slate-800 block">Corridor Risk Legend</span>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>Critical Blindspot</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>High Priority Gap</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Medium Expansion</span>
            </div>
          </div>
        </div>
      </div>

      {/* Identified Blindspots Registry Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Identified Coverage Gaps Registry</h3>
            <p className="text-xs text-slate-500">Prioritized infrastructure expansion targets across Gujarat</p>
          </div>
          <div className="flex items-center space-x-2">
            {['All', 'Critical', 'High', 'Medium'].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                  filterPriority === p ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Location Name</th>
                <th className="py-2.5 px-4">District</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Current Density</th>
                <th className="py-2.5 px-4">Required Nodes</th>
                <th className="py-2.5 px-4 text-right">Est. Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BLINDSPOT_LOCATIONS.map(spot => (
                <tr key={spot.id} className="hover:bg-blue-50/40 transition">
                  <td className="py-2.5 px-4 font-bold text-slate-900">{spot.name}</td>
                  <td className="py-2.5 px-4">{spot.district}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      spot.priority === 'Critical' ? 'bg-rose-100 text-rose-800' : spot.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {spot.priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono">{spot.coveragePct}%</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-[#0052CC]">+{spot.reqNodes} Units</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{(spot.reqNodes * 1.2).toFixed(1)} Lakhs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
