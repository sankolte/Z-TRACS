import React, { useState } from 'react';
import { Camera, CameraLifecycle, CameraHealthStatus } from '../types';
import { 
  X, 
  MapPin, 
  ShieldCheck, 
  Cpu, 
  Activity, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Calendar, 
  Server, 
  User, 
  HardDrive, 
  Radio,
  Wrench,
  Archive,
  ExternalLink,
  Info
} from 'lucide-react';

interface CameraDetailModalProps {
  camera: Camera;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToGis?: (camera: Camera) => void;
  onMarkMaintenance?: (cameraId: string) => void;
  onArchiveCamera?: (cameraId: string) => void;
}

export const CameraDetailModal: React.FC<CameraDetailModalProps> = ({
  camera,
  isOpen,
  onClose,
  onNavigateToGis,
  onMarkMaintenance,
  onArchiveCamera,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'location' | 'technical' | 'health' | 'audit'>('overview');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  if (!isOpen) return null;

  const getHealthBadge = (status: CameraHealthStatus) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Online (Nominal)
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Degraded Telemetry
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Offline (No Heartbeat)
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Info className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Unknown Status
          </span>
        );
    }
  };

  const getLifecycleBadge = (lifecycle: CameraLifecycle) => {
    switch (lifecycle) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#0052CC] border border-blue-200">Active Registry</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Under Maintenance</span>;
      case 'PENDING_APPROVAL':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Pending Approval</span>;
      case 'ARCHIVED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">Archived Record</span>;
      case 'RETIRED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Retired (End-of-Life)</span>;
      case 'DRAFT':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">Draft</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-[#06152B] text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-blue-300 border border-white/10">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-blue-300 font-semibold">{camera.cameraCode}</span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs text-slate-300 font-medium">{camera.type}</span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">{camera.name}</h2>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {getLifecycleBadge(camera.lifecycle)}
              {getHealthBadge(camera.healthStatus)}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#EDF3FA] border-b border-slate-200 px-6 flex items-center space-x-1">
          {[
            { id: 'overview', label: 'Master Overview', icon: FileText },
            { id: 'location', label: 'Location & GIS', icon: MapPin },
            { id: 'technical', label: 'Technical & VMS', icon: Server },
            { id: 'health', label: 'Health Visibility', icon: Activity },
            { id: 'audit', label: 'Governance & Audit', icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
                  isActive 
                    ? 'border-[#0052CC] text-[#0052CC] bg-white rounded-t-md shadow-2xs' 
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#0052CC]' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Primary Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-[#0052CC]" />
                    <span>Administrative Ownership</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Department Name:</span>
                      <span className="font-semibold text-slate-900">{camera.departmentName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Asset Owner:</span>
                      <span className="font-medium text-slate-800">{camera.owner}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Nodal Officer in Charge:</span>
                      <span className="font-medium text-slate-800">{camera.responsibleOfficer.name} ({camera.responsibleOfficer.designation})</span>
                      <span className="text-slate-500 block font-mono text-[11px] mt-0.5">{camera.responsibleOfficer.phone} | {camera.responsibleOfficer.email}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0052CC]" />
                    <span>Jurisdiction & Geospatial</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">District & Municipality:</span>
                      <span className="font-semibold text-slate-900">{camera.district} • {camera.city}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Physical Location:</span>
                      <span className="font-medium text-slate-800">{camera.address}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">WGS84 Coordinates:</span>
                      <span className="font-mono text-slate-800 font-semibold">{camera.latitude.toFixed(6)}° N, {camera.longitude.toFixed(6)}° E</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Capability Matrix */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registered Capability Flags</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-lg border text-center ${camera.capabilities.anpr ? 'bg-blue-50/60 border-blue-200 text-[#0052CC]' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="text-xs font-bold block">ANPR</span>
                    <span className="text-[10px] font-medium">{camera.capabilities.anpr ? 'Registered Flag' : 'Not Configured'}</span>
                  </div>
                  <div className={`p-3 rounded-lg border text-center ${camera.capabilities.vehicleDetection ? 'bg-blue-50/60 border-blue-200 text-[#0052CC]' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="text-xs font-bold block">Vehicle Detection</span>
                    <span className="text-[10px] font-medium">{camera.capabilities.vehicleDetection ? 'Registered Flag' : 'Not Configured'}</span>
                  </div>
                  <div className={`p-3 rounded-lg border text-center ${camera.capabilities.personDetection ? 'bg-blue-50/60 border-blue-200 text-[#0052CC]' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="text-xs font-bold block">Person Detection</span>
                    <span className="text-[10px] font-medium">{camera.capabilities.personDetection ? 'Registered Flag' : 'Not Configured'}</span>
                  </div>
                  <div className={`p-3 rounded-lg border text-center ${camera.capabilities.edgeAI ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="text-xs font-bold block">Edge AI On-Chip</span>
                    <span className="text-[10px] font-medium">{camera.capabilities.edgeAI ? 'Hardware Capable' : 'Standard Optical'}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LOCATION & GIS */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Geospatial Registry Coordinates</h4>
                  <p className="text-xs text-slate-600 mt-0.5">PostGIS Point Record (EPSG:4326 WGS84)</p>
                </div>
                {onNavigateToGis && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToGis(camera);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded-lg hover:bg-[#0041A8] transition shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View on CCTV GIS Viewport</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Latitude</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{camera.latitude}</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Longitude</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{camera.longitude}</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">District Jurisdiction</span>
                  <span className="font-semibold text-slate-900">{camera.district}</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Taluka / Sub-Division</span>
                  <span className="font-semibold text-slate-900">{camera.taluka || 'City Central'}</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-slate-700">
                <span className="font-semibold text-[#0052CC] block mb-1">Registered Address:</span>
                {camera.address}, {camera.city}, Gujarat, India
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICAL & VMS */}
          {activeTab === 'technical' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Manufacturer</span>
                  <span className="font-bold text-slate-900">{camera.manufacturer}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Hardware Model</span>
                  <span className="font-mono font-bold text-slate-900">{camera.model}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Firmware Version</span>
                  <span className="font-mono font-semibold text-slate-800">{camera.firmwareVersion}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Optical Resolution</span>
                  <span className="font-semibold text-slate-900">{camera.resolution}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">PTZ Capability</span>
                  <span className="font-semibold text-slate-900">{camera.ptzSupport ? 'Yes (Pan-Tilt-Zoom)' : 'Fixed Lens'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Installation Date</span>
                  <span className="font-mono font-semibold text-slate-800">{camera.installationDate}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Server className="w-3.5 h-3.5 text-[#0052CC]" />
                  <span>VMS Reference & Connectivity Metadata</span>
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Linked VMS Platform:</span>
                    <span className="font-semibold text-slate-900">{camera.vmsPlatformName} ({camera.vmsPlatformId})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Network Transmission Type:</span>
                    <span className="font-semibold text-slate-900">{camera.networkType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Interoperability Protocol:</span>
                    <span className="font-mono text-slate-800">{camera.protocol}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Restricted Endpoint Reference:</span>
                    <span className="font-mono text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">{camera.endpointReference}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#0052CC]" />
                  <span>Storage & Retention Policy</span>
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Storage Architecture:</span>
                    <span className="font-semibold text-slate-900">{camera.storageType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Statutory Retention:</span>
                    <span className="font-bold text-slate-900">{camera.retentionDays} Days Continuous</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HEALTH VISIBILITY */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 block">30-Day Availability</span>
                  <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">{camera.availability}%</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 block">Telemetry FPS</span>
                  <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">{camera.fps}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 block">Bitrate (Kbps)</span>
                  <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">{camera.bitrate}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 block">Device Health</span>
                  <span className={`text-sm font-bold mt-2 block ${camera.deviceHealth === 'Nominal' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {camera.deviceHealth}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <span className="text-slate-500 block font-medium">Last Received Heartbeat Timestamp:</span>
                <div className="flex items-center space-x-2">
                  <Radio className={`w-4 h-4 ${camera.healthStatus === 'ONLINE' ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                  <span className="font-mono font-bold text-slate-900">{camera.lastHeartbeat}</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-900 block">Maintenance Dispatch</span>
                  <span className="text-slate-600">Mark this camera for physical field maintenance inspection.</span>
                </div>
                {onMarkMaintenance && camera.lifecycle !== 'MAINTENANCE' && (
                  <button
                    onClick={() => {
                      onMarkMaintenance(camera.cameraUuid);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Mark for Maintenance</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT & GOVERNANCE */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">Registry Lifecycle History</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block">Registered Timestamp:</span>
                    <span className="font-mono text-slate-800 font-semibold">{camera.createdAt}</span>
                    <span className="text-slate-500 text-[11px] block">By {camera.createdBy}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Metadata Modification:</span>
                    <span className="font-mono text-slate-800 font-semibold">{camera.updatedAt}</span>
                    <span className="text-slate-500 text-[11px] block">By {camera.updatedBy}</span>
                  </div>
                </div>
              </div>

              {/* Archive Action Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Decommission & Archival</h4>
                    <p className="text-xs text-slate-600">Soft-delete asset from active operational registry while retaining immutable audit logs.</p>
                  </div>
                  {!showArchiveConfirm ? (
                    <button
                      onClick={() => setShowArchiveConfirm(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive Camera</span>
                    </button>
                  ) : null}
                </div>

                {showArchiveConfirm && (
                  <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg space-y-2 text-xs">
                    <label className="font-bold text-rose-900 block">Mandatory Archival Reason:</label>
                    <input
                      type="text"
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="e.g., Road expansion project decommissioned pole #44"
                      className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded text-xs focus:ring-1 focus:ring-rose-500"
                    />
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setShowArchiveConfirm(false)}
                        className="px-3 py-1 bg-white text-slate-700 border border-slate-300 rounded text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!archiveReason.trim()}
                        onClick={() => {
                          if (onArchiveCamera) {
                            onArchiveCamera(camera.cameraUuid);
                            onClose();
                          }
                        }}
                        className="px-3 py-1 bg-rose-600 text-white font-semibold rounded text-xs disabled:opacity-50"
                      >
                        Confirm Decommission
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-[#EDF3FA] px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="font-mono text-[11px]">System UUID: {camera.cameraUuid}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition shadow-2xs"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
