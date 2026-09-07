import React from 'react';
import { CanonicalConnector } from '../../model3/schemas/canonical';
import { 
  Cpu, 
  ShieldCheck, 
  CheckCircle2, 
  Activity, 
  Server, 
  Radio, 
  Layers,
  ArrowRight
} from 'lucide-react';

interface ConnectorRegistryViewProps {
  connectors: CanonicalConnector[];
  onNavigateTab: (tab: string) => void;
}

export const ConnectorRegistryView: React.FC<ConnectorRegistryViewProps> = ({
  connectors,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Model 3 Connector Framework
            </span>
            <span className="text-xs text-slate-500 font-medium">Adapter Driver Registry & Certification Catalog</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Connector Drivers & Protocol Adapters</h1>
        </div>

        <button 
          onClick={() => onNavigateTab('event-flow')}
          className="px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs flex items-center space-x-1.5"
        >
          <span>Open Real-Time Event Pipeline →</span>
        </button>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map(conn => (
          <div key={conn.connectorId} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-bold text-[#0052CC] text-xs">{conn.connectorId}</span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{conn.vendor}</h3>
                </div>

                <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono ${
                  conn.certificationStatus === 'CERTIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {conn.certificationStatus} DRIVER
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">PROTOCOL</span>
                  <span className="font-bold text-slate-800">{conn.protocol}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ADAPTER VERSION</span>
                  <span className="font-bold text-slate-800">{conn.adapterVersion}</span>
                </div>
              </div>

              {/* Supported Capabilities Tags */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Supported Capability Flags</span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  {conn.supportedCapabilities.map(cap => (
                    <span key={cap} className="px-2 py-0.5 rounded bg-blue-50 text-[#0052CC] border border-blue-200 font-bold">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-mono text-slate-600">
              <span>Latency: <strong className="text-emerald-600">{conn.latencyMs}ms</strong></span>
              <span>Active Sessions: <strong>{conn.activeSessions.toLocaleString()}</strong></span>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
