import React from 'react';
import { CanonicalVms, CanonicalConnector } from '../../model3/schemas/canonical';
import { 
  Network, 
  Cpu, 
  Activity, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Server, 
  Layers, 
  ArrowRight,
  RefreshCw,
  Zap
} from 'lucide-react';

interface FederationOverviewViewProps {
  vmsList: CanonicalVms[];
  connectors: CanonicalConnector[];
  onNavigateTab: (tab: string) => void;
}

export const FederationOverviewView: React.FC<FederationOverviewViewProps> = ({
  vmsList,
  connectors,
  onNavigateTab,
}) => {
  const totalCameras = vmsList.reduce((acc, v) => acc + v.cameraCount, 0);
  const activeConnectorsCount = connectors.filter(c => c.status === 'ACTIVE').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none">
      
      {/* Top Banner Header */}
      <div className="bg-[#06152B] text-white p-5 rounded-xl border border-slate-800 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#08281D] text-[#22C55E] border border-[#14533C] uppercase tracking-wider">
              ● Model 3 Middleware Control Plane
            </span>
            <span className="text-xs text-slate-400 font-mono">VMS Federation Engine v3.4</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight mt-1">Statewide VMS Federation & Adapter Hub</h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigateTab('vms-management')}
            className="px-3.5 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-2xs flex items-center space-x-1.5"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Manage VMS Platforms →</span>
          </button>
        </div>
      </div>

      {/* Control Plane Operational Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        
        <div 
          onClick={() => onNavigateTab('vms-management')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0052CC] cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Federated VMS Platforms</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{vmsList.length}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">100% Department Mesh</span>
        </div>

        <div 
          onClick={() => onNavigateTab('connectors')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-500 cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Connectors</span>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">{activeConnectorsCount} / {connectors.length}</div>
          <span className="text-[10px] text-slate-500">Certified Adapter Drivers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Federated Cameras</span>
          <div className="text-2xl font-black text-[#0052CC] font-mono mt-1">{totalCameras.toLocaleString()}</div>
          <span className="text-[10px] text-blue-600 font-semibold">Model 1 Synchronized</span>
        </div>

        <div 
          onClick={() => onNavigateTab('event-flow')}
          className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Event Throughput</span>
          <div className="text-2xl font-black text-purple-700 font-mono mt-1">1,284 <span className="text-xs font-sans text-slate-500">evt/s</span></div>
          <span className="text-[10px] text-slate-500 font-mono">Kafka Backbone Bus</span>
        </div>

        <div 
          onClick={() => onNavigateTab('event-flow')}
          className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Dead Letter Queue (DLQ)</span>
          <div className="text-2xl font-black text-rose-600 font-mono mt-1">2 <span className="text-xs font-sans text-slate-500">failed</span></div>
          <span className="text-[10px] text-rose-700 font-semibold">Retry Engine Active</span>
        </div>

      </div>

      {/* VMS Federation Status Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#EDF3FA] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#0052CC]" />
            <h3 className="text-xs font-bold text-slate-900 uppercase">Departmental VMS Federation Health Matrix</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Auto-Heartbeat Polling Every 10s</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
              <tr>
                <th className="p-3.5">Zeex VMS ID</th>
                <th className="p-3.5">System Name & Vendor</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Protocol & Adapter</th>
                <th className="p-3.5">Cameras</th>
                <th className="p-3.5">Health Score</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {vmsList.map(vms => (
                <tr key={vms.zeexVmsId} className="hover:bg-blue-50/30 transition">
                  <td className="p-3.5 font-mono font-bold text-[#0052CC]">{vms.zeexVmsId}</td>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{vms.systemName}</div>
                    <div className="text-[11px] text-slate-500">{vms.vendor} ({vms.version})</div>
                  </td>
                  <td className="p-3.5">
                    <span className="font-medium text-slate-800">{vms.departmentName}</span>
                    <div className="text-[10px] text-slate-400 font-mono">{vms.district}</div>
                  </td>
                  <td className="p-3.5 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200">
                      {vms.protocol}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-slate-900">{vms.cameraCount.toLocaleString()}</td>
                  <td className="p-3.5 font-mono font-bold text-emerald-600">{vms.healthScore}%</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      vms.status === 'Operational' ? 'bg-emerald-100 text-emerald-800' :
                      vms.status === 'Degraded' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      ● {vms.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => onNavigateTab('vms-management')}
                      className="px-3 py-1 bg-[#0052CC] hover:bg-[#0041A8] text-white rounded text-[11px] font-bold shadow-2xs"
                    >
                      Inspect VMS →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
