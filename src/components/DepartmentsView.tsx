import React, { useState } from 'react';
import { 
  Building2, 
  Video, 
  MapPin, 
  Layers, 
  Phone, 
  Mail, 
  ExternalLink, 
  Plus, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  TrendingUp, 
  X, 
  Shield 
} from 'lucide-react';
import { Department, Language } from '../types';
import { translations } from '../data/translations';

interface DepartmentsViewProps {
  departments: Department[];
  currentLang?: Language;
  onSelectDepartment: (dept: Department) => void;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({
  departments = [],
  onSelectDepartment,
}) => {
  const t = translations.en;
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalCameras = departments.reduce((acc, d) => acc + (d.totalCameras || 0), 0);
  const totalOnline = departments.reduce((acc, d) => acc + (d.onlineCameras || 0), 0);
  const onlinePct = Math.round((totalOnline / (totalCameras || 1)) * 100) || 94;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Department KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Integrated Departments & Agencies
            </span>
            <div className="p-2 rounded-lg bg-[#e8f2fe] text-[#0072ce]">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">{departments.length} Agencies</div>
          <p className="text-xs text-emerald-600 mt-1 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            +3 new departments onboarded
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Managed Camera Assets
            </span>
            <div className="p-2 rounded-lg bg-[#e8f2fe] text-[#0072ce]">
              <Video className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-[#0072ce] font-mono">{totalCameras} Live Sentinel Feeds</div>
          <div className="mt-2 flex items-center space-x-2 text-xs">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div style={{ width: `${onlinePct}%` }} className="h-full bg-emerald-500 rounded-full"></div>
            </div>
            <span className="font-mono text-emerald-600 font-bold">{onlinePct}% Nominal</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Statewide District Footprint
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 font-mono">33 / 33 Districts</div>
          <p className="text-xs text-slate-500 mt-1">
            100% jurisdiction network reach
          </p>
        </div>
      </div>

      {/* Action & Search Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agency, code, or category..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0072ce]"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg bg-[#0072ce] hover:bg-[#005bb5] text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepts.map((dept) => {
          const deptOnlinePct = Math.round((dept.onlineCameras / (dept.totalCameras || 1)) * 100) || 92;
          return (
            <div
              key={dept.id}
              className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-[#0072ce] transition flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                      {dept.code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{dept.name}</h3>
                    <p className="text-xs text-slate-500">{dept.category}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    deptOnlinePct >= 95 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {deptOnlinePct}% Nominal
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Total Cameras</span>
                    <span className="font-mono font-bold text-[#0072ce] text-base">{dept.totalCameras.toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Active Online</span>
                    <span className="font-mono font-bold text-emerald-600 text-base">{dept.onlineCameras.toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">{dept.nodalOfficer.name} ({dept.nodalOfficer.designation || dept.nodalOfficer.rank})</p>
                  <p className="text-slate-500 font-mono">{dept.nodalOfficer.phone} • {dept.nodalOfficer.email}</p>
                </div>
              </div>

              <button
                onClick={() => onSelectDepartment(dept)}
                className="w-full py-2 bg-[#0072ce] hover:bg-[#005bb5] text-white rounded-lg text-xs font-bold transition shadow-2xs"
              >
                View Agency Assets →
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">
                Register New Government Agency
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Ports & Coastal Surveillance Directorate"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Agency Code
                </label>
                <input
                  type="text"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  placeholder="e.g. GUJ-COASTAL"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
              >
                {t.actions.cancel}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-1.5 bg-[#0072ce] hover:bg-[#005bb5] text-white rounded-lg text-xs font-bold"
              >
                {t.actions.save}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
