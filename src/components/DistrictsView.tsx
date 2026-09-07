import React, { useState } from 'react';
import { 
  MapPin, 
  Search, 
  Filter, 
  Download, 
  LayoutGrid, 
  Table as TableIcon, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Phone, 
  TrendingUp, 
  Radar, 
  Shield,
  Video,
  X,
  Camera,
  ArrowRight
} from 'lucide-react';
import { District, Language } from '../types';

interface DistrictsViewProps {
  districts: District[];
  currentLang?: Language;
  onSelectDistrict: (district: District) => void;
}

// Map of the 31 Live Feed Camera Nodes to their Districts
const LIVE_FEED_CAMERAS: Record<string, { num: number; name: string; location: string }[]> = {
  'Ahmedabad': [
    { num: 1, name: 'Camera 1', location: 'Chiman Bhai Bridge' },
    { num: 2, name: 'Camera 2', location: 'Janpath Road' },
    { num: 3, name: 'Camera 3', location: 'O.N.G.C. Office Complex' },
    { num: 4, name: 'Camera 4', location: 'Paldi Circle Junction' },
    { num: 13, name: 'Camera 13', location: 'CN Vidhyalaya Campus' },
  ],
  'Navsari': [
    { num: 19, name: 'Camera 19', location: 'Khaparia Gram Panchayat' },
    { num: 20, name: 'Camera 20', location: 'Mohanpura Chowk' },
    { num: 25, name: 'Camera 25', location: 'Dhanori Main Road' },
    { num: 26, name: 'Camera 26', location: 'Tankal Highway Entry' },
    { num: 27, name: 'Camera 27', location: 'Bilimora Coastal — Site A' },
    { num: 28, name: 'Camera 28', location: 'Bilimora Coastal — Site B' },
    { num: 29, name: 'Camera 29', location: 'Bilimora Harbor — Site C' },
  ],
  'Junagadh': [
    { num: 6, name: 'Camera 6', location: 'Timbavadi Gate' },
    { num: 8, name: 'Camera 8', location: 'Majewadi Gate' },
    { num: 9, name: 'Camera 9', location: 'New Bypass Circle' },
    { num: 10, name: 'Camera 10', location: 'Char Chowk Road' },
    { num: 11, name: 'Camera 11', location: 'Dolatpara Junction' },
  ],
  'Gandhinagar': [
    { num: 5, name: 'Camera 5', location: 'Visat Teen Rasta' },
    { num: 12, name: 'Camera 12', location: 'Tri Mandir Adalaj Tollnaka' },
    { num: 16, name: 'Camera 16', location: 'Visat P2 Checkpoint' },
    { num: 24, name: 'Camera 24', location: 'Dehgam Circle' },
  ],
  'Patan': [
    { num: 21, name: 'Camera 21', location: 'Patan Dethali Char Rasta' },
    { num: 22, name: 'Camera 22', location: 'BK Mervada Tran Rasta' },
    { num: 23, name: 'Camera 23', location: 'Kheram Junction' },
  ],
  'Surat': [
    { num: 14, name: 'Camera 14', location: 'Delight Cross Road' },
    { num: 15, name: 'Camera 15', location: 'Suvidha Park Circle' },
  ],
  'Rajkot': [
    { num: 17, name: 'Camera 17', location: 'Rajkot Bus Port Terminal' },
    { num: 18, name: 'Camera 18', location: 'Rajkot Central Square' },
  ],
  'Kutch': [
    { num: 30, name: 'Camera 30', location: 'Gandhidham Rambaugh P2' },
    { num: 31, name: 'Camera 31', location: 'Gandhidham Complex Outer Gate' },
  ],
  'Gir Somnath': [
    { num: 7, name: 'Camera 7', location: 'Hero Showroom Highway' },
  ],
};

export const DistrictsView: React.FC<DistrictsViewProps> = ({
  districts = [],
  onSelectDistrict,
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [filterZone, setFilterZone] = useState('All');
  const [selectedInspectDistrict, setSelectedInspectDistrict] = useState<any | null>(null);

  const zones = ['All', 'Central Gujarat', 'South Gujarat', 'Saurashtra', 'North Gujarat', 'Kutch'];

  const filteredDistricts = districts.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.headquarters && d.headquarters.toLowerCase().includes(search.toLowerCase())) ||
      (d.zone && d.zone.toLowerCase().includes(search.toLowerCase()));
    const matchZone = filterZone === 'All' || d.zone === filterZone;
    return matchSearch && matchZone;
  });

  const totalRegisteredCameras = districts.reduce((acc, d) => acc + (d.totalCameras || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Active Live District Assets
          </span>
          <div className="text-2xl font-black text-[#0072ce] font-mono mt-1">{totalRegisteredCameras} Live Nodes</div>
          <span className="text-xs text-emerald-600 font-medium mt-1 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            Across {districts.length} Live Feed Districts
          </span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Nominal Health Index
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">100.0% Operational</div>
          <span className="text-xs text-slate-500 mt-1">
            Real-Time Live Streaming Active
          </span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Priority Coverage Gaps
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">0 Critical Gaps</div>
          <span className="text-xs text-slate-500 mt-1">
            All 31 Corridor Feeds Verified Online
          </span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px] max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search live district, HQ, or zone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0072ce]"
            />
          </div>

          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#0072ce]"
          >
            {zones.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white text-[#0072ce] shadow-2xs' : 'text-slate-500'}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white text-[#0072ce] shadow-2xs' : 'text-slate-500'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#00253e] text-white text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">District</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Headquarters</th>
                  <th className="p-3">Live Feed Cameras</th>
                  <th className="p-3">Online Rate</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">SP / CP Contact</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredDistricts.map((d: any) => {
                  const onlineVal = d.onlinePercentage ?? 100;
                  const officerName = d.nodalSp ?? 'SP Control Room';
                  const officerPhone = d.controlRoomContact ?? '079-23250000';
                  const camNodes = LIVE_FEED_CAMERAS[d.name] || [];

                  return (
                    <tr key={d.id} className="hover:bg-blue-50/40 transition">
                      <td className="p-3 font-bold text-slate-900">
                        <div className="text-sm text-slate-900">{d.name}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{d.headquarters}, {d.zone}</div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">{d.zone}</td>
                      <td className="p-3 text-slate-600">{d.headquarters}</td>
                      <td className="p-3 font-mono font-bold text-[#0072ce]">
                        <span className="text-sm">{d.totalCameras}</span> Live Feeds
                        <div className="text-[10px] text-slate-400 font-sans font-normal truncate max-w-[180px]">
                          {camNodes.map(c => c.location).join(', ')}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {onlineVal}% Online
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-emerald-600 flex items-center space-x-1 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          <span>Active Stream</span>
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">
                        <div className="font-sans font-bold text-slate-800">{officerName}</div>
                        <div className="text-slate-400">{officerPhone}</div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedInspectDistrict(d)}
                          className="px-3 py-1 bg-[#0072ce] hover:bg-[#005bb5] text-white rounded text-[11px] font-bold shadow-2xs cursor-pointer"
                        >
                          Inspect District
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDistricts.map((d: any) => {
            const onlineVal = d.onlinePercentage ?? 100;
            const officerName = d.nodalSp ?? 'SP Control Room';
            const officerPhone = d.controlRoomContact ?? '079-23250000';
            const camNodes = LIVE_FEED_CAMERAS[d.name] || [];

            return (
              <div
                key={d.id}
                className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#0072ce] transition flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{d.name}</h3>
                      <p className="text-xs text-slate-500">{d.headquarters} • {d.zone}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {onlineVal}% Live
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Live Feed Nodes</span>
                      <span className="font-mono font-bold text-[#0072ce] text-base">{d.totalCameras}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Health Status</span>
                      <span className="font-mono font-bold text-emerald-600 text-xs mt-1 block">Nominal</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 text-[11px]">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Live Camera Locations</span>
                    <div className="space-y-0.5 text-slate-600 font-mono text-[10px]">
                      {camNodes.map(c => (
                        <div key={c.num} className="truncate">
                          • CAM {c.num}: <span className="text-slate-800 font-bold">{c.location}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                    <p className="font-semibold text-slate-800">{officerName}</p>
                    <p className="text-slate-500 font-mono">{officerPhone}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedInspectDistrict(d)}
                  className="w-full py-2 bg-[#0072ce] hover:bg-[#005bb5] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  View District Nodes →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect District Modal */}
      {selectedInspectDistrict && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedInspectDistrict(null)}
        >
          <div 
            className="bg-white rounded-xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">{selectedInspectDistrict.name} District Jurisdiction</h3>
                  <p className="text-[10px] text-slate-300 font-mono">{selectedInspectDistrict.zone} • HQ: {selectedInspectDistrict.headquarters}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInspectDistrict(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">SP / CP COMMAND OFFICER</span>
                  <span className="font-bold text-slate-900">{selectedInspectDistrict.nodalSp}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">CONTROL ROOM CONTACT</span>
                  <span className="font-mono font-bold text-[#0072ce]">{selectedInspectDistrict.controlRoomContact}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase mb-2 flex items-center justify-between">
                  <span>Live Feed Camera Nodes in {selectedInspectDistrict.name}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                    {LIVE_FEED_CAMERAS[selectedInspectDistrict.name]?.length || selectedInspectDistrict.totalCameras} Active
                  </span>
                </h4>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {(LIVE_FEED_CAMERAS[selectedInspectDistrict.name] || []).map((c) => (
                    <div key={c.num} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:border-blue-300 transition">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                          {c.num}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.location}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>HLS LIVE</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedInspectDistrict(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const d = selectedInspectDistrict;
                  setSelectedInspectDistrict(null);
                  onSelectDistrict(d);
                }}
                className="px-4 py-1.5 bg-[#0072ce] hover:bg-[#005bb5] text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center space-x-1.5"
              >
                <span>Filter Camera Registry →</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
