import React, { useState } from 'react';
import { CanonicalEvent, DlqEventRecord } from '../../model3/schemas/canonical';
import { RetryEngine } from '../../model3/eventbus/RetryEngine';
import { 
  ArrowRight, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Layers, 
  Terminal, 
  Radio, 
  Cpu, 
  Database,
  ShieldCheck,
  Server
} from 'lucide-react';

interface EventPipelineViewProps {
  canonicalEvents: CanonicalEvent[];
  onNavigateToJourney: (plateNumber: string) => void;
}

export const EventPipelineView: React.FC<EventPipelineViewProps> = ({
  canonicalEvents,
  onNavigateToJourney,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(canonicalEvents[0]?.eventId || '');
  const [dlqRecords, setDlqRecords] = useState<DlqEventRecord[]>(RetryEngine.getInstance().getDlqRecords());
  const [activeTab, setActiveTab] = useState<'pipeline' | 'dlq'>('pipeline');

  const selectedEvent = canonicalEvents.find(e => e.eventId === selectedEventId) || canonicalEvents[0];

  const handleReplayDlq = (dlqId: string) => {
    RetryEngine.getInstance().replayDlqRecord(dlqId);
    setDlqRecords([...RetryEngine.getInstance().getDlqRecords()]);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Model 3 Event Backbone
            </span>
            <span className="text-xs text-slate-500 font-medium">Kafka Topic Stream & Canonical Normalization Pipeline</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Real-Time Event Pipeline & DLQ Replay Desk</h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#EDF3FA] p-1 rounded-lg border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'pipeline' ? 'bg-[#0052CC] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Live Canonical Pipeline
          </button>
          <button
            onClick={() => setActiveTab('dlq')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'dlq' ? 'bg-[#0052CC] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Dead Letter Queue (DLQ) ({dlqRecords.filter(r => r.status === 'FAILED').length})
          </button>
        </div>
      </div>

      {/* Visual Pipeline Flow Chart */}
      <div className="bg-[#06152B] text-white p-5 rounded-xl border border-slate-800 shadow-lg space-y-4">
        <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">End-to-End Architectural Pipeline Flow</h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
          
          <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-lg space-y-1">
            <Server className="w-5 h-5 text-blue-400 mx-auto" />
            <div className="font-bold text-white">1. VMS Source</div>
            <div className="text-[10px] text-slate-400">ONVIF / REST APIs</div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-blue-600/60 rounded-lg space-y-1">
            <Cpu className="w-5 h-5 text-cyan-400 mx-auto" />
            <div className="font-bold text-cyan-300">2. Adapter Boundary</div>
            <div className="text-[10px] text-slate-400">Protocol Translation</div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-emerald-600/60 rounded-lg space-y-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto" />
            <div className="font-bold text-emerald-300">3. Schema Normalizer</div>
            <div className="text-[10px] text-slate-400">v1.0 Canonical Spec</div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-purple-600/60 rounded-lg space-y-1">
            <Database className="w-5 h-5 text-purple-400 mx-auto" />
            <div className="font-bold text-purple-300">4. Kafka Event Bus</div>
            <div className="text-[10px] text-slate-400">vms.events topic</div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-amber-600/60 rounded-lg space-y-1">
            <Activity className="w-5 h-5 text-amber-400 mx-auto" />
            <div className="font-bold text-amber-300">5. AI & Model 2</div>
            <div className="text-[10px] text-slate-400">Correlation & Viewing</div>
          </div>

        </div>
      </div>

      {activeTab === 'pipeline' ? (
        /* Live Pipeline Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left Events Stream (Col 5) */}
          <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">Normalized Event Stream</h3>

            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {canonicalEvents.map(evt => {
                const isSelected = evt.eventId === selectedEventId;
                return (
                  <div
                    key={evt.eventId}
                    onClick={() => setSelectedEventId(evt.eventId)}
                    className={`p-3 rounded-xl border transition cursor-pointer space-y-1 ${
                      isSelected ? 'bg-blue-50/80 border-[#0052CC] ring-2 ring-blue-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-[#0052CC] text-xs">{evt.eventId}</span>
                      <span className="px-2 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[9px]">
                        v{evt.schemaVersion} CANONICAL
                      </span>
                    </div>

                    <div className="font-mono text-xs font-bold text-slate-900">
                      {evt.vehicle ? evt.vehicle.plateNumber : evt.eventType}
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>VMS: {evt.source.vmsId}</span>
                      <span>{evt.timestamp.slice(11, 19)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Canonical Payload Inspector (Col 7) */}
          {selectedEvent && (
            <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-[#0052CC]" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Canonical Payload Inspector</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                  JSON Schema v1.0 Validated
                </span>
              </div>

              <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[380px] border border-slate-800">
                <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
              </div>

              {selectedEvent.vehicle && (
                <button
                  onClick={() => onNavigateToJourney(selectedEvent.vehicle!.plateNumber)}
                  className="w-full py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-2xs"
                >
                  Analyze Vehicle {selectedEvent.vehicle.plateNumber} Journey →
                </button>
              )}
            </div>
          )}

        </div>
      ) : (
        /* Dead Letter Queue (DLQ) Inspector */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-[#EDF3FA] border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase">Dead Letter Queue (DLQ) Failed Event Records</span>
            <span className="text-[11px] font-mono text-slate-500">Exponential Backoff Max Retries Reached (3/3)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3.5">DLQ Record ID</th>
                  <th className="p-3.5">Event ID</th>
                  <th className="p-3.5">Source VMS</th>
                  <th className="p-3.5">Failure Reason</th>
                  <th className="p-3.5">Failed Timestamp</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {dlqRecords.map(rec => (
                  <tr key={rec.dlqId} className="hover:bg-rose-50/20 transition">
                    <td className="p-3.5 font-mono font-bold text-rose-700">{rec.dlqId}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">{rec.eventId}</td>
                    <td className="p-3.5 font-mono text-[#0052CC]">{rec.sourceVmsId}</td>
                    <td className="p-3.5 text-slate-700 font-medium">{rec.lastErrorReason}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-500">{rec.failedTimestamp}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        rec.status === 'REPLAYED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {rec.status === 'FAILED' && (
                        <button
                          onClick={() => handleReplayDlq(rec.dlqId)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs flex items-center space-x-1 ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Replay Event</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
