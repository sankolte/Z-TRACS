import React, { useState } from 'react';
import { Search, X, Video, Building2, MapPin, Server, ArrowRight } from 'lucide-react';
import { Camera, Department, District } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: Camera[];
  departments: Department[];
  districts: District[];
  onSelectCamera: (cam: Camera) => void;
  onNavigateTab: (tab: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  cameras,
  departments,
  districts,
  onSelectCamera,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const matchedCameras = q ? cameras.filter(c => 
    c.cameraCode.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q) ||
    c.district.toLowerCase().includes(q) ||
    c.manufacturer.toLowerCase().includes(q)
  ).slice(0, 5) : [];

  const matchedDepts = q ? departments.filter(d => 
    d.name.toLowerCase().includes(q) ||
    d.code.toLowerCase().includes(q)
  ).slice(0, 3) : [];

  const matchedDistricts = q ? districts.filter(d => 
    d.name.toLowerCase().includes(q) ||
    d.headquarters.toLowerCase().includes(q)
  ).slice(0, 3) : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in zoom-in-95">
        
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center space-x-3 bg-slate-50">
          <Search className="w-5 h-5 text-[#0052CC] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search camera code, district, department, hardware..."
            className="w-full bg-transparent border-none text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden font-medium"
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 text-xs">
          {!q ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Type anything to search across Z-TRACS Model 1</p>
              <p className="text-[11px] text-slate-400 mt-1">Try "SG Highway", "CAM-GJ", "Surat", or "Police"</p>
            </div>
          ) : (
            <>
              {/* Matched Cameras */}
              {matchedCameras.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Cameras ({matchedCameras.length})
                  </span>
                  {matchedCameras.map(cam => (
                    <div
                      key={cam.cameraUuid}
                      onClick={() => {
                        onClose();
                        onSelectCamera(cam);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer flex items-center justify-between transition group"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Video className="w-4 h-4 text-[#0052CC]" />
                        <div>
                          <div className="font-mono font-bold text-[#0052CC]">{cam.cameraCode}</div>
                          <div className="font-medium text-slate-900">{cam.name}</div>
                        </div>
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">{cam.district} • {cam.healthStatus}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Matched Departments */}
              {matchedDepts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Departments ({matchedDepts.length})
                  </span>
                  {matchedDepts.map(dept => (
                    <div
                      key={dept.id}
                      onClick={() => {
                        onClose();
                        onNavigateTab('departments');
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer flex items-center justify-between transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Building2 className="w-4 h-4 text-[#0052CC]" />
                        <div>
                          <div className="font-bold text-slate-900">{dept.name}</div>
                          <div className="text-[11px] text-slate-500">{dept.code} • {dept.totalCameras} Nodes</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}

              {/* Matched Districts */}
              {matchedDistricts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Districts ({matchedDistricts.length})
                  </span>
                  {matchedDistricts.map(dist => (
                    <div
                      key={dist.id}
                      onClick={() => {
                        onClose();
                        onNavigateTab('districts');
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer flex items-center justify-between transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <div>
                          <div className="font-bold text-slate-900">{dist.name} District</div>
                          <div className="text-[11px] text-slate-500">{dist.headquarters} • {dist.totalCameras} Nodes</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}

              {matchedCameras.length === 0 && matchedDepts.length === 0 && matchedDistricts.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  No matching records found for "{query}"
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
