import React, { useState } from 'react';
import { Camera, CameraLifecycle, CameraHealthStatus } from '../types';
import { 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  MapPin, 
  Eye, 
  Wrench, 
  Archive,
  Download,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Layers,
  Cpu,
  Pencil,
  X,
  Save
} from 'lucide-react';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';

interface CameraRegistryViewProps {
  cameras: Camera[];
  currentLang?: string;
  onSelectCamera: (camera: Camera) => void;
  onNavigateToGis: (camera: Camera) => void;
  onConfigureRoi?: (camera: Camera) => void;
  onConfigureAi?: (camera: Camera) => void;
  onEditCamera?: (camera: Camera) => void;
  onOpenOnboarding: () => void;
  onMarkMaintenance: (cameraId: string) => void;
  onArchiveCamera: (cameraId: string) => void;
  onRestoreCamera?: (cameraId: string) => void;
  initialDeptFilter?: string;
  initialDistrictFilter?: string;
}

export const CameraRegistryView: React.FC<CameraRegistryViewProps> = ({
  cameras,
  onSelectCamera,
  onNavigateToGis,
  onConfigureRoi,
  onConfigureAi,
  onEditCamera,
  onOpenOnboarding,
  onMarkMaintenance,
  onArchiveCamera,
  onRestoreCamera,
  initialDeptFilter = 'ALL',
  initialDistrictFilter = 'ALL',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(initialDeptFilter);
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrictFilter);
  const [selectedHealth, setSelectedHealth] = useState<string>('ALL');
  const [selectedLifecycle, setSelectedLifecycle] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [modalTargetCamera, setModalTargetCamera] = useState<Camera | null>(null);
  const [modalMode, setModalMode] = useState<'archive' | 'restore'>('archive');
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Camera>>({});

  // Filtered dataset memoized for 80,000 node scale
  const filteredCameras = React.useMemo(() => {
    return cameras.filter(cam => {
      // Exclude archived by default unless filtering for it
      if (selectedLifecycle === 'ALL' && cam.lifecycle === 'ARCHIVED') return false;
      if (selectedLifecycle !== 'ALL' && cam.lifecycle !== selectedLifecycle) return false;

      if (selectedDept !== 'ALL' && cam.departmentId !== selectedDept) return false;
      if (selectedDistrict !== 'ALL' && cam.district !== selectedDistrict) return false;
      if (selectedHealth !== 'ALL' && cam.healthStatus !== selectedHealth) return false;
      if (selectedType !== 'ALL' && cam.type !== selectedType) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          cam.cameraCode.toLowerCase().includes(q) ||
          cam.name.toLowerCase().includes(q) ||
          cam.district.toLowerCase().includes(q) ||
          cam.manufacturer.toLowerCase().includes(q) ||
          cam.departmentName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cameras, selectedLifecycle, selectedDept, selectedDistrict, selectedHealth, selectedType, searchQuery]);

  // Calculate pages
  const totalPages = Math.ceil(filteredCameras.length / itemsPerPage) || 1;
  const paginatedCameras = filteredCameras.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getHealthBadge = (status: CameraHealthStatus) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Online
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
            Degraded
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            Offline
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Info className="w-3 h-3 mr-1 text-slate-500" />
            Unknown
          </span>
        );
    }
  };

  const getLifecycleBadge = (lifecycle: CameraLifecycle) => {
    switch (lifecycle) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-[#0052CC] border border-blue-200">Active</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-50 text-amber-700 border border-amber-200">Maintenance</span>;
      case 'ARCHIVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 border border-slate-300">Archived</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 border border-slate-300">{lifecycle}</span>;
    }
  };

  const handleExportCsv = () => {
    const headers = ['Camera Code', 'Name', 'Department', 'District', 'Type', 'Lifecycle', 'Health Status', 'Latitude', 'Longitude', 'Resolution', 'VMS Platform'];
    const rows = filteredCameras.map(c => [
      c.cameraCode,
      `"${c.name}"`,
      `"${c.departmentName}"`,
      c.district,
      c.type,
      c.lifecycle,
      c.healthStatus,
      c.latitude,
      c.longitude,
      c.resolution,
      `"${c.vmsPlatformName}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `z_tracs_camera_registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedDept('ALL');
    setSelectedDistrict('ALL');
    setSelectedHealth('ALL');
    setSelectedLifecycle('ALL');
    setSelectedType('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150 select-none">
      
      {/* Top Action & Statistics Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Master CCTV Registry
            </span>
            <span className="text-xs text-slate-500 font-medium">Model 1 Metadata Directory</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Statewide Camera Registry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Displaying <span className="font-bold text-slate-800">{filteredCameras.length}</span> of {cameras.length} registered institutional CCTV assets
          </p>
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenOnboarding}
            className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-[#0052CC] text-white rounded-lg text-xs font-semibold hover:bg-[#0041A8] transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Camera</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search code, location, landmark..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-[#0052CC] focus:border-[#0052CC]"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">All Departments</option>
              <option value="DEPT-POL-01">Gujarat Police</option>
              <option value="DEPT-MNC-02">Municipal Corps (AMC/SMC)</option>
              <option value="DEPT-TRN-03">GSRTC Transport</option>
              <option value="DEPT-RND-04">Roads & Buildings</option>
              <option value="DEPT-FOR-05">Forest Department</option>
            </select>
          </div>

          {/* District Filter */}
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">All Districts</option>
              <option value="Ahmedabad">Ahmedabad</option>
              <option value="Surat">Surat</option>
              <option value="Vadodara">Vadodara</option>
              <option value="Rajkot">Rajkot</option>
              <option value="Surendranagar">Surendranagar</option>
              <option value="Junagadh">Junagadh</option>
              <option value="Gandhinagar">Gandhinagar</option>
            </select>
          </div>

          {/* Health Status Filter */}
          <div>
            <select
              value={selectedHealth}
              onChange={(e) => {
                setSelectedHealth(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">Health: All</option>
              <option value="ONLINE">Online (Nominal)</option>
              <option value="DEGRADED">Degraded Telemetry</option>
              <option value="OFFLINE">Offline</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>

          {/* Lifecycle Filter */}
          <div>
            <select
              value={selectedLifecycle}
              onChange={(e) => {
                setSelectedLifecycle(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-[#0052CC]"
            >
              <option value="ALL">Lifecycle: Active</option>
              <option value="ACTIVE">Active Only</option>
              <option value="MAINTENANCE">Under Maintenance</option>
              <option value="ARCHIVED">Archived Records</option>
            </select>
          </div>

        </div>

        {/* Filter State Tags */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>Active Facets:</span>
            <span className="font-semibold text-slate-700">
              {selectedDept !== 'ALL' && `[Dept: ${selectedDept}] `}
              {selectedDistrict !== 'ALL' && `[Dist: ${selectedDistrict}] `}
              {selectedHealth !== 'ALL' && `[Health: ${selectedHealth}] `}
              {selectedLifecycle !== 'ALL' && `[Lifecycle: ${selectedLifecycle}] `}
              {selectedDept === 'ALL' && selectedDistrict === 'ALL' && selectedHealth === 'ALL' && selectedLifecycle === 'ALL' && 'Statewide (Default)'}
            </span>
          </div>

          <button
            onClick={resetFilters}
            className="flex items-center space-x-1 text-[#0052CC] hover:underline font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Main Registry Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#EDF3FA] text-slate-800 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Asset Code</th>
                <th className="py-3 px-4">Location Name</th>
                <th className="py-3 px-4">Department & Owner</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Hardware & Specs</th>
                <th className="py-3 px-4">Health Telemetry</th>
                <th className="py-3 px-4">Lifecycle</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-normal">
              {paginatedCameras.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold text-slate-600">No cameras found matching active filter criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try broadening your search or resetting the filter facets</p>
                    <button
                      onClick={resetFilters}
                      className="mt-3 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedCameras.map((camera) => (
                  <tr 
                    key={camera.cameraUuid}
                    className="hover:bg-blue-50/40 transition cursor-pointer group"
                    onClick={() => onSelectCamera(camera)}
                  >
                    {/* Camera Code */}
                    <td className="py-3 px-4 font-mono font-bold text-[#0052CC] group-hover:underline">
                      {camera.cameraCode}
                    </td>

                    {/* Landmark & Type */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{camera.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{camera.address}</div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{camera.departmentName}</div>
                      <div className="text-[11px] text-slate-500">{camera.owner}</div>
                    </td>

                    {/* District */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                        {camera.district}
                      </span>
                    </td>

                    {/* Specs */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{camera.manufacturer} • {camera.type}</div>
                      <div className="text-[11px] text-slate-500">{camera.resolution}</div>
                    </td>

                    {/* Health Telemetry */}
                    <td className="py-3 px-4">
                      {getHealthBadge(camera.healthStatus)}
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        {camera.fps} FPS • {camera.availability}% Uptime
                      </div>
                    </td>

                    {/* Lifecycle */}
                    <td className="py-3 px-4">
                      {getLifecycleBadge(camera.lifecycle)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        {onConfigureRoi && (
                          <button
                            title="Configure Detection Area & Polygon ROIs"
                            onClick={() => onConfigureRoi(camera)}
                            className="p-1.5 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          >
                            <Layers className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                        {onConfigureAi && (
                          <button
                            title="Configure AI Vision Models (ANPR, FRS, PPE, Footfall)"
                            onClick={() => onConfigureAi(camera)}
                            className="p-1.5 rounded text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition"
                          >
                            <Cpu className="w-4 h-4 text-indigo-600" />
                          </button>
                        )}
                        <button
                          title="Edit Camera Configuration & RTSP Streams"
                          onClick={() => {
                            setEditingCamera(camera);
                            setEditFormData({ ...camera });
                          }}
                          className="p-1.5 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          title="View on GIS Viewport"
                          onClick={() => onNavigateToGis(camera)}
                          className="p-1.5 rounded text-slate-500 hover:text-[#0052CC] hover:bg-blue-50 transition"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <button
                          title="View Master Specifications"
                          onClick={() => onSelectCamera(camera)}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {camera.lifecycle !== 'MAINTENANCE' && camera.lifecycle !== 'ARCHIVED' && (
                          <button
                            title="Mark for Maintenance"
                            onClick={() => onMarkMaintenance(camera.cameraUuid)}
                            className="p-1.5 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                        )}
                        {camera.lifecycle !== 'ARCHIVED' ? (
                          <button
                            title="Archive Camera Asset"
                            onClick={() => {
                              setModalTargetCamera(camera);
                              setModalMode('archive');
                            }}
                            className="p-1.5 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            title="Restore Camera Asset"
                            onClick={() => {
                              setModalTargetCamera(camera);
                              setModalMode('restore');
                            }}
                            className="p-1.5 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="bg-[#EDF3FA] px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>Showing {paginatedCameras.length} of {filteredCameras.length} matching records (Page {currentPage} of {totalPages})</span>
          
          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              className="p-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-bold text-slate-800">Page {currentPage} / {totalPages}</span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              className="p-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Camera Configuration Modal */}
      {editingCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 bg-gradient-to-r from-[#003366] to-[#0052CC] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Edit Camera Configurations</h3>
                  <p className="text-xs text-blue-100 font-mono">{editingCamera.cameraCode} • {editingCamera.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingCamera(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (onEditCamera && editingCamera) {
                  const updated: Camera = {
                    ...editingCamera,
                    ...editFormData,
                    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
                  };
                  onEditCamera(updated);
                }
                setEditingCamera(null);
              }}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Camera Code (Asset Tag)</label>
                  <input
                    type="text"
                    disabled
                    value={editFormData.cameraCode || ''}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Camera Display Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                    placeholder="e.g. Camera 1 (Chiman Bhai Bridge)"
                  />
                </div>
              </div>

              {/* RTSP Stream URL */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-[#003366] flex items-center justify-between">
                  <span>RTSP Stream Endpoint (AI Ingestion)</span>
                  <span className="text-[10px] text-blue-600 font-normal">Port 8554 / TCP</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.endpointReference || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, endpointReference: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                  placeholder="rtsp://103.250.160.189:8554/stream/cam01"
                />
              </div>

              {/* HLS Stream URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">HLS Live Stream URL (Browser & CDN)</label>
                <input
                  type="text"
                  value={editFormData.hls_live_url || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, hls_live_url: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                  placeholder="https://cctv.corp8.cloud/cam01/index.m3u8"
                />
              </div>

              {/* Location & District */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Landmark / Address</label>
                  <input
                    type="text"
                    value={editFormData.address || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                    placeholder="e.g. 01 Chiman bhai Bridge, Ahmedabad"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
                  <select
                    value={editFormData.district || 'Ahmedabad'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                  >
                    <option value="Ahmedabad">Ahmedabad</option>
                    <option value="Rajkot">Rajkot</option>
                    <option value="Junagadh">Junagadh</option>
                    <option value="Surat">Surat</option>
                    <option value="Gandhinagar">Gandhinagar</option>
                    <option value="Navsari">Navsari</option>
                    <option value="Patan">Patan</option>
                    <option value="Vadodara">Vadodara</option>
                    <option value="Banaskantha">Banaskantha</option>
                    <option value="Gir-Somnath">Gir-Somnath</option>
                    <option value="Kutch">Kutch / Gandhidham</option>
                  </select>
                </div>
              </div>

              {/* Resolution & FPS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Resolution</label>
                  <select
                    value={editFormData.resolution || '1920x1080'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, resolution: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                  >
                    <option value="1920x1080">1920x1080 (1080p FHD)</option>
                    <option value="2560x1440">2560x1440 (2K QHD)</option>
                    <option value="1280x720">1280x720 (720p HD)</option>
                    <option value="3840x2160">3840x2160 (4K UHD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lifecycle Status</label>
                  <select
                    value={editFormData.lifecycle || 'ACTIVE'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, lifecycle: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                  >
                    <option value="ACTIVE">Active (Online Operational)</option>
                    <option value="MAINTENANCE">Maintenance Mode</option>
                    <option value="ARCHIVED">Archived / Decommissioned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Health Status</label>
                  <select
                    value={editFormData.healthStatus || 'ONLINE'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, healthStatus: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-[#0052CC] focus:outline-none"
                  >
                    <option value="ONLINE">Online (Nominal)</option>
                    <option value="DEGRADED">Degraded Telemetry</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingCamera(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0052CC] hover:bg-[#003d99] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configurations</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive / Restore Modal */}
      {modalTargetCamera && (
        <ArchiveConfirmModal
          camera={modalTargetCamera}
          mode={modalMode}
          isOpen={true}
          onClose={() => setModalTargetCamera(null)}
          onConfirm={(reason) => {
            if (modalMode === 'archive') {
              onArchiveCamera(modalTargetCamera.cameraUuid);
            } else if (onRestoreCamera) {
              onRestoreCamera(modalTargetCamera.cameraUuid);
            }
            setModalTargetCamera(null);
          }}
        />
      )}

    </div>
  );
};
