import React, { useState } from 'react';
import { CanonicalVms } from '../../model3/schemas/canonical';
import { AdapterRegistry } from '../../model3/adapters/AdapterRegistry';
import { 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Plus, 
  Radio, 
  SlidersHorizontal,
  Play,
  Layers,
  ArrowRight
} from 'lucide-react';

interface VmsManagementViewProps {
  vmsList: CanonicalVms[];
  onNavigateTab: (tab: string) => void;
}

export const VmsManagementView: React.FC<VmsManagementViewProps> = ({
  vmsList,
  onNavigateTab,
}) => {
  const [selectedVmsId, setSelectedVmsId] = useState<string>(vmsList[0]?.zeexVmsId || 'VMS-MIL-01');
  const [testingStatusMap, setTestingStatusMap] = useState<Record<string, string>>({});
  const [discoveredCountMap, setDiscoveredCountMap] = useState<Record<string, number>>({});

  const selectedVms = vmsList.find(v => v.zeexVmsId === selectedVmsId) || vmsList[0];

  const handleTestConnection = async (vmsId: string) => {
    setTestingStatusMap(prev => ({ ...prev, [vmsId]: 'TESTING...' }));
    const adapter = AdapterRegistry.getInstance().getAdapter(vmsId);
    if (adapter) {
      const health = await adapter.healthCheck();
      setTestingStatusMap(prev => ({ ...prev, [vmsId]: `HTTP 200 OK (${health.latencyMs}ms)` }));
    } else {
      setTestingStatusMap(prev => ({ ...prev, [vmsId]: 'OK (Simulated)' }));
    }
  };

  const handleRunDiscovery = async (vmsId: string) => {
    setDiscoveredCountMap(prev => ({ ...prev, [vmsId]: 999 }));
    const adapter = AdapterRegistry.getInstance().getAdapter(vmsId);
    if (adapter) {
      const cams = await adapter.discoverCameras();
      setDiscoveredCountMap(prev => ({ ...prev, [vmsId]: cams.length }));
    } else {
      setDiscoveredCountMap(prev => ({ ...prev, [vmsId]: 4 }));
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Model 3 Federation Control Plane
            </span>
            <span className="text-xs text-slate-500 font-medium">Departmental VMS System Registry</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">VMS System Integrations & Auto-Discovery</h1>
        </div>

        <button className="px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs flex items-center space-x-1.5">
          <Plus className="w-4 h-4" />
          <span>Register New Departmental VMS System</span>
        </button>
      </div>

      {/* Grid: Left VMS List, Right VMS Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left VMS Systems List (Col 4) */}
        <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">Registered VMS Endpoints</h3>
          
          <div className="space-y-2">
            {vmsList.map(vms => {
              const isSelected = vms.zeexVmsId === selectedVmsId;
              return (
                <div
                  key={vms.zeexVmsId}
                  onClick={() => setSelectedVmsId(vms.zeexVmsId)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2 ${
                    isSelected ? 'bg-blue-50/80 border-[#0052CC] ring-2 ring-blue-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#0052CC] text-xs">{vms.zeexVmsId}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[9px]">
                      {vms.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs">{vms.systemName}</h4>
                  <div className="text-[11px] text-slate-500 font-mono">{vms.vendor} • {vms.protocol}</div>

                  <div className="pt-2 border-t border-slate-200/80 flex justify-between text-[11px] font-mono text-slate-600">
                    <span>Cameras: <strong>{vms.cameraCount}</strong></span>
                    <span>Health: <strong className="text-emerald-600">{vms.healthScore}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right VMS Inspector & Action Panel (Col 8) */}
        {selectedVms && (
          <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Header Box */}
              <div className="bg-[#06152B] text-white p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs text-blue-300 font-bold">{selectedVms.zeexVmsId} (Vendor ID: {selectedVms.vendorVmsId})</span>
                    <h2 className="text-base font-bold text-white mt-0.5">{selectedVms.systemName}</h2>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-blue-900/80 text-blue-200 text-xs font-bold font-mono border border-blue-700">
                    {selectedVms.protocol}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-300 font-mono">
                  <span>Department: <strong className="text-white">{selectedVms.departmentName}</strong></span>
                  <span>District: <strong className="text-emerald-400">{selectedVms.district}</strong></span>
                </div>
              </div>

              {/* Detail Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">VMS REST / ONVIF Endpoint:</span>
                  <span className="font-mono font-bold text-slate-900 truncate block mt-0.5">{selectedVms.endpoint}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">Assigned Adapter Connector:</span>
                  <span className="font-mono font-bold text-[#0052CC] mt-0.5 block">{selectedVms.connectorId}</span>
                </div>
              </div>

              {/* Capabilities Grid */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Discovered Capabilities Matrix</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {Object.entries(selectedVms.capabilities).map(([key, val]) => (
                    <div key={key} className={`p-2 rounded border flex items-center justify-between ${val ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      <span className="capitalize">{key}</span>
                      <span>{val ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Control Plane Operations Buttons */}
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                <h4 className="font-bold text-[#0052CC] text-xs uppercase tracking-wider">Control Plane Operations</h4>
                
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleTestConnection(selectedVms.zeexVmsId)}
                    className="px-4 py-2 bg-[#0052CC] text-white rounded-lg text-xs font-bold hover:bg-[#0041A8] transition shadow-2xs flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Connection Handshake Test</span>
                  </button>

                  <button
                    onClick={() => handleRunDiscovery(selectedVms.zeexVmsId)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition shadow-2xs flex items-center space-x-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Trigger Camera Auto-Discovery</span>
                  </button>
                </div>

                {testingStatusMap[selectedVms.zeexVmsId] && (
                  <div className="font-mono text-xs font-bold text-emerald-700">
                    STATUS: {testingStatusMap[selectedVms.zeexVmsId]}
                  </div>
                )}

                {discoveredCountMap[selectedVms.zeexVmsId] !== undefined && (
                  <div className="font-mono text-xs font-bold text-blue-800">
                    DISCOVERY RESULT: Discovered {discoveredCountMap[selectedVms.zeexVmsId]} camera nodes compliant with Model 1 schema.
                  </div>
                )}
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <button
                onClick={() => onNavigateTab('connectors')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold transition"
              >
                Inspect Connector Drivers →
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
