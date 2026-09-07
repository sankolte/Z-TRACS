import React, { useState } from 'react';
import { InvestigationCase, EvidenceItem } from '../types';
import { 
  FolderLock, 
  FileCheck, 
  ShieldCheck, 
  Clock, 
  User, 
  Car, 
  CheckCircle2, 
  Download, 
  Plus, 
  ArrowRight,
  Key
} from 'lucide-react';

interface InvestigationViewProps {
  cases: InvestigationCase[];
  onNavigateToJourney: (plateNumber: string) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  cases,
  onNavigateToJourney,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || 'CASE-2026-000928');
  const [activeCaseTab, setActiveCaseTab] = useState<'overview' | 'evidence' | 'timeline' | 'notes'>('overview');

  const currentCase = cases.find(c => c.id === selectedCaseId) || cases[0];

  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Model 2 Investigation Workspace
            </span>
            <span className="text-xs text-slate-500 font-medium">Tamper-Evident Evidence & Dossier Vault</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Multi-Agency Crime & Traffic Case Files</h1>
        </div>

        <button className="px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs flex items-center space-x-1.5">
          <Plus className="w-4 h-4" />
          <span>Create New Investigation Case File</span>
        </button>
      </div>

      {/* Main Grid: Cases List Left, Case Dossier Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Col: Case Cases Selector (Col 4) */}
        <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Active Investigation Files</h3>
          
          <div className="space-y-2">
            {cases.map(c => {
              const isSelected = c.id === selectedCaseId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                    isSelected ? 'bg-blue-50/80 border-[#0052CC] ring-2 ring-blue-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#0052CC] text-xs">{c.id}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                      {c.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs">{c.title}</h4>

                  <div className="pt-2 border-t border-slate-200/80 flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Plate: <strong className="text-slate-900">{c.plateNumber}</strong></span>
                    <span>Evidence: <strong className="text-[#0052CC]">{c.evidenceCount} Files</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Selected Case Dossier (Col 8) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          
          {currentCase && (
            <div className="space-y-5">
              
              {/* Dossier Header */}
              <div className="bg-[#06152B] text-white p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs text-blue-300 font-bold">{currentCase.id}</span>
                    <h2 className="text-base font-bold text-white mt-0.5">{currentCase.title}</h2>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-blue-900/80 text-blue-200 border border-blue-700 text-xs font-bold font-mono">
                    PRIORITY: {currentCase.priority}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-300 font-mono">
                  <span>Lead Officer: <strong className="text-white">{currentCase.leadOfficer} ({currentCase.badge})</strong></span>
                  <span>Target Plate: <strong className="text-emerald-400">{currentCase.plateNumber}</strong></span>
                </div>
              </div>

              {/* Dossier Sub-tabs */}
              <div className="flex bg-[#EDF3FA] p-1 rounded-lg border border-slate-200 text-xs font-bold">
                {[
                  { id: 'overview', label: 'Dossier Overview' },
                  { id: 'evidence', label: `Evidence Vault (${currentCase.evidenceItems.length})` },
                  { id: 'timeline', label: 'ANPR Timeline' },
                  { id: 'notes', label: 'Investigator Notes' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCaseTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-md transition ${activeCaseTab === tab.id ? 'bg-[#0052CC] text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeCaseTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <span className="text-slate-500 block">Department Jurisdiction:</span>
                      <span className="font-semibold text-slate-900">{currentCase.department}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <span className="text-slate-500 block">Date Opened:</span>
                      <span className="font-mono font-semibold text-slate-900">{currentCase.createdDate}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2">
                    <span className="font-bold text-emerald-900 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                      SHA-256 Digital Verification Active
                    </span>
                    <p className="text-slate-700 leading-relaxed">
                      All video snapshot frames, speed logs, and ANPR telemetry attached to this dossier are sealed with SHA-256 cryptographic hashes compliant with court evidence rules.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: EVIDENCE VAULT */}
              {activeCaseTab === 'evidence' && (
                <div className="space-y-3">
                  {currentCase.evidenceItems.map(evd => (
                    <div key={evd.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono font-bold text-[#0052CC]">{evd.id}</span>
                          <h4 className="font-bold text-slate-900 text-xs mt-0.5">{evd.eventType}</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          VERIFIED HASH
                        </span>
                      </div>

                      <div className="bg-slate-900 text-emerald-400 p-2.5 rounded font-mono text-[11px] overflow-x-auto">
                        SHA-256: {evd.sha256Hash}
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-1">
                        <span>Source Camera: {evd.cameraCode}</span>
                        <span>File Size: {evd.fileSize}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <button
              onClick={() => onNavigateToJourney(currentCase.plateNumber)}
              className="px-4 py-2 bg-[#0052CC] text-white rounded-lg font-bold hover:bg-[#0041A8] transition shadow-2xs"
            >
              Analyze Plate {currentCase.plateNumber} Journey →
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
