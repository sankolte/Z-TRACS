import React, { useState } from 'react';
import { Camera, HealthEvent, CameraHealthStatus } from '../types';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Radio, 
  Server, 
  Wrench, 
  Eye, 
  Filter,
  ArrowUpRight,
  Clock,
  HardDrive
} from 'lucide-react';

interface HealthMonitoringViewProps {
  events: HealthEvent[];
  cameras: Camera[];
  currentLang?: string;
  onSelectCamera: (camera: Camera) => void;
  onMarkMaintenance: (cameraId: string) => void;
}

export const HealthMonitoringView: React.FC<HealthMonitoringViewProps> = ({
  events,
  cameras,
  onSelectCamera,
  onMarkMaintenance,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  const filteredEvents = events.filter(e => {
    if (selectedSeverity !== 'ALL' && e.severity !== selectedSeverity) return false;
    return true;
  });

  const onlineCount = cameras.filter(c => c.healthStatus === 'ONLINE').length;
  const degradedCount = cameras.filter(c => c.healthStatus === 'DEGRADED').length;
  const offlineCount = cameras.filter(c => c.healthStatus === 'OFFLINE').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      
      {/* Top Health Statistics Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Infrastructure Telemetry
            </span>
            <span className="text-xs text-slate-500 font-medium">Read-Only Health Visibility</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Camera Health & Telemetry Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time heartbeat monitoring, FPS stream metrics, and infrastructure availability indexes
          </p>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Average Availability</span>
          <span className="text-2xl font-bold text-slate-900 font-mono mt-1 block">99.2%</span>
          <span className="text-[11px] text-emerald-600 font-medium">Statewide 30-day index</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nominal (Online)</span>
          <span className="text-2xl font-bold text-emerald-600 font-mono mt-1 block">{onlineCount}</span>
          <span className="text-[11px] text-slate-500 font-medium">Transmitting heartbeats</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Degraded Telemetry</span>
          <span className="text-2xl font-bold text-amber-600 font-mono mt-1 block">{degradedCount}</span>
          <span className="text-[11px] text-slate-500 font-medium">Low FPS / High latency</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Offline Nodes</span>
          <span className="text-2xl font-bold text-rose-600 font-mono mt-1 block">{offlineCount}</span>
          <span className="text-[11px] text-slate-500 font-medium">Heartbeat timeout &gt; 60s</span>
        </div>
      </div>

      {/* Live Incident Stream */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#EDF3FA] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#0052CC]" />
            <span className="text-xs font-bold text-slate-800">Active Telemetry Incidents & Health Log</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-white px-2 py-1 border border-slate-300 rounded text-xs text-slate-700"
            >
              <option value="ALL">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredEvents.map(evt => {
            const cam = cameras.find(c => c.cameraUuid === evt.cameraId || c.cameraCode === evt.cameraCode);
            return (
              <div key={evt.id} className="p-4 hover:bg-blue-50/40 transition flex items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    evt.severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {evt.severity === 'critical' ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-[#0052CC]">{evt.cameraCode}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-semibold text-slate-900">{evt.cameraName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                        {evt.district}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-1 flex items-center space-x-3">
                      <span className="font-semibold text-slate-800">{evt.type}</span>
                      <span>Duration: {evt.duration}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{evt.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {cam && (
                    <button
                      onClick={() => onSelectCamera(cam)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition shadow-2xs"
                    >
                      Inspect Specs
                    </button>
                  )}
                  {cam && cam.lifecycle !== 'MAINTENANCE' && (
                    <button
                      onClick={() => onMarkMaintenance(cam.cameraUuid)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Dispatch Maintenance</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
