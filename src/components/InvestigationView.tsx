import React, { useState, useEffect } from 'react';
import { InvestigationCase, EvidenceItem, AnprEvent } from '../types';
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
  Key,
  FolderPlus,
  X,
  MessageSquare,
  Send,
  Calendar,
  AlertTriangle
} from 'lucide-react';

interface InvestigationViewProps {
  cases: InvestigationCase[];
  onNavigateToJourney: (plateNumber: string) => void;
  selectedCaseId?: string;
  onSelectCaseId?: (caseId: string) => void;
  onCreateCase?: (newCase: InvestigationCase) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  cases,
  onNavigateToJourney,
  selectedCaseId: propSelectedCaseId,
  onSelectCaseId,
  onCreateCase,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string>(
    propSelectedCaseId || cases[0]?.id || 'CASE-2026-000928'
  );
  const [activeCaseTab, setActiveCaseTab] = useState<'overview' | 'evidence' | 'timeline' | 'notes'>('overview');

  // New Case Modal State
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [newCasePlate, setNewCasePlate] = useState('');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCasePriority, setNewCasePriority] = useState<'HIGH' | 'MEDIUM' | 'CRITICAL'>('HIGH');
  const [newCaseOfficer, setNewCaseOfficer] = useState('DySP V. R. Rathod, IPS');
  const [newCaseBadge, setNewCaseBadge] = useState('GJ-POL-2024-88');
  const [newCaseDept, setNewCaseDept] = useState('Gujarat Police (Traffic & Crime Branch)');

  // Local Notes State
  const [newNoteText, setNewNoteText] = useState('');

  // Sync prop changes
  useEffect(() => {
    if (propSelectedCaseId) {
      setInternalSelectedId(propSelectedCaseId);
    }
  }, [propSelectedCaseId]);

  const activeId = propSelectedCaseId || internalSelectedId;
  const currentCase = cases.find(c => c.id === activeId) || cases[0];

  const handleSelectCase = (id: string) => {
    setInternalSelectedId(id);
    if (onSelectCaseId) onSelectCaseId(id);
  };

  const handleAddNote = () => {
    if (!newNoteText.trim() || !currentCase) return;
    currentCase.caseNotes.push(
      `[${new Date().toLocaleTimeString()}] ${newCaseOfficer}: ${newNoteText.trim()}`
    );
    setNewNoteText('');
  };

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateCase) return;

    const cleanPlate = (newCasePlate || 'GJ01AB1234').trim().toUpperCase();
    const caseId = `CASE-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const newCase: InvestigationCase = {
      id: caseId,
      title: newCaseTitle.trim() || `Inter-District Corridor Tracking (${cleanPlate})`,
      plateNumber: cleanPlate,
      status: 'ACTIVE',
      priority: newCasePriority,
      leadOfficer: newCaseOfficer.trim() || 'DySP V. R. Rathod, IPS',
      badge: newCaseBadge.trim() || 'GJ-POL-2024-88',
      department: newCaseDept.trim() || 'Gujarat Police (Traffic & Crime Branch)',
      createdDate: new Date().toISOString().slice(0, 10),
      evidenceCount: 1,
      timelineEvents: [],
      evidenceItems: [
        {
          id: `EVD-${Math.floor(10000 + Math.random() * 90000)}`,
          caseId: caseId,
          cameraUuid: 'uuid-0001-cctv-ahm',
          cameraCode: 'CAM-GJ-AHM-TRF-000001',
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
          eventType: 'Initial Law Enforcement Docket Initiation',
          sha256Hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
          fileSize: '1.8 MB',
          verifiedBy: 'State SDC Integrity Verification Engine',
          createdDate: new Date().toISOString().slice(0, 10),
        }
      ],
      caseNotes: [
        `Case docket created manually by ${newCaseOfficer} for plate ${cleanPlate}.`,
        `Corridor surveillance monitoring active across all Gujarat highway checkpoints.`
      ]
    };

    onCreateCase(newCase);
    setIsNewCaseModalOpen(false);
    setNewCasePlate('');
    setNewCaseTitle('');
  };

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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Multi-Agency Crime & Traffic Case Files
          </h1>
        </div>

        <button 
          onClick={() => setIsNewCaseModalOpen(true)}
          className="px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Investigation Case File</span>
        </button>
      </div>

      {/* Main Grid: Cases List Left, Case Dossier Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Col: Case Cases Selector (Col 4) */}
        <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Investigation Files</h3>
            <span className="text-xs font-mono font-bold text-slate-500">{cases.length} Total</span>
          </div>
          
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {cases.map(c => {
              const isSelected = c.id === currentCase?.id;
              let priorityColor = 'bg-blue-100 text-blue-800';
              if (c.priority === 'CRITICAL') priorityColor = 'bg-rose-100 text-rose-800';
              else if (c.priority === 'HIGH') priorityColor = 'bg-amber-100 text-amber-800';

              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCase(c.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                    isSelected ? 'bg-blue-50/90 border-[#0052CC] ring-2 ring-blue-500/20 shadow-xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-[#0052CC] text-xs">{c.id}</span>
                    <div className="flex items-center space-x-1">
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${priorityColor}`}>
                        {c.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                        {c.status}
                      </span>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs">{c.title}</h4>

                  <div className="pt-2 border-t border-slate-200/80 flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Plate: <strong className="text-slate-900">{c.plateNumber}</strong></span>
                    <span>Evidence: <strong className="text-[#0052CC]">{c.evidenceItems?.length || c.evidenceCount || 0} Files</strong></span>
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
              <div className="bg-[#06152B] text-white p-4 rounded-xl border border-slate-800 space-y-2 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs text-blue-300 font-bold">{currentCase.id}</span>
                    <h2 className="text-base font-bold text-white mt-0.5">{currentCase.title}</h2>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono border ${
                    currentCase.priority === 'CRITICAL' 
                      ? 'bg-rose-900/80 text-rose-200 border-rose-700' 
                      : 'bg-blue-900/80 text-blue-200 border-blue-700'
                  }`}>
                    PRIORITY: {currentCase.priority}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-wrap justify-between gap-2 text-xs text-slate-300 font-mono">
                  <span>Lead Officer: <strong className="text-white">{currentCase.leadOfficer} ({currentCase.badge})</strong></span>
                  <span>Target Plate: <strong className="text-emerald-400 font-black">{currentCase.plateNumber}</strong></span>
                </div>
              </div>

              {/* Dossier Sub-tabs */}
              <div className="flex bg-[#EDF3FA] p-1 rounded-lg border border-slate-200 text-xs font-bold">
                {[
                  { id: 'overview', label: 'Dossier Overview' },
                  { id: 'evidence', label: `Evidence Vault (${currentCase.evidenceItems?.length || 0})` },
                  { id: 'timeline', label: `Corridor Timeline (${currentCase.timelineEvents?.length || 0})` },
                  { id: 'notes', label: `Investigator Notes (${currentCase.caseNotes?.length || 0})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCaseTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                      activeCaseTab === tab.id ? 'bg-[#0052CC] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
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

                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
                    <span className="font-bold text-emerald-900 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                      SHA-256 Digital Verification Active
                    </span>
                    <p className="text-slate-700 leading-relaxed text-[11px]">
                      All video snapshot frames, speed logs, and ANPR telemetry attached to this dossier are sealed with SHA-256 cryptographic hashes compliant with court evidence admissibility rules.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span className="font-bold text-slate-900 block">Latest Case Briefing:</span>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {currentCase.caseNotes?.[0] || 'No preliminary notes recorded for this active case docket.'}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: EVIDENCE VAULT */}
              {activeCaseTab === 'evidence' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {(!currentCase.evidenceItems || currentCase.evidenceItems.length === 0) ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No sealed evidence items attached to this dossier yet.
                    </div>
                  ) : (
                    currentCase.evidenceItems.map(evd => (
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
                          <span>Source Camera: <strong>{evd.cameraCode}</strong></span>
                          <span>Timestamp: {evd.timestamp}</span>
                          <span>File Size: {evd.fileSize}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: CORRIDOR TIMELINE */}
              {activeCaseTab === 'timeline' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {(!currentCase.timelineEvents || currentCase.timelineEvents.length === 0) ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No recorded corridor timeline sightings attached.
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-blue-200 pl-4 space-y-3">
                      {currentCase.timelineEvents.map((evt, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-[#0052CC]">{evt.cameraCode}</span>
                            <span className="font-mono text-slate-600 font-bold text-[11px]">{evt.timestamp.slice(11, 19)} IST</span>
                          </div>
                          <div className="font-semibold text-slate-900">{evt.cameraName}</div>
                          <div className="flex justify-between text-slate-500 text-[11px] font-mono pt-1">
                            <span>District: {evt.district}</span>
                            <span>Speed: {evt.speedKmh} km/h</span>
                            <span>Confidence: {evt.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: INVESTIGATOR NOTES */}
              {activeCaseTab === 'notes' && (
                <div className="space-y-3">
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {currentCase.caseNotes?.map((note, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed">
                        {note}
                      </div>
                    ))}
                  </div>

                  {/* Add Note Input */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add an investigator log / progress note..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddNote();
                      }}
                    />
                    <button
                      onClick={handleAddNote}
                      className="px-3 py-2 bg-[#0052CC] text-white rounded-lg text-xs font-bold hover:bg-[#0041A8] transition flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Dossier Bottom Actions */}
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-mono text-[11px]">
              Case Docket Status: <strong className="text-emerald-600">{currentCase?.status || 'ACTIVE'}</strong>
            </span>
            <button
              onClick={() => onNavigateToJourney(currentCase.plateNumber)}
              className="px-4 py-2 bg-[#0052CC] text-white rounded-lg font-bold hover:bg-[#0041A8] transition shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Track {currentCase.plateNumber} in 3D Journey →</span>
            </button>
          </div>

        </div>

      </div>

      {/* MODAL: CREATE NEW CASE FILE */}
      {isNewCaseModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateCaseSubmit} className="bg-white rounded-2xl max-w-lg w-full border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#06152B] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FolderPlus className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold">New Investigation Dossier</h3>
                  <p className="text-[10px] text-slate-300">Law Enforcement Case Registration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCaseModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Number Plate *</label>
                <input
                  type="text"
                  required
                  value={newCasePlate}
                  onChange={(e) => setNewCasePlate(e.target.value.toUpperCase())}
                  placeholder="e.g. GJ01AB1234"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Case Title</label>
                <input
                  type="text"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="e.g. Inter-District Corridor Vehicle Tracking"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority</label>
                  <select
                    value={newCasePriority}
                    onChange={(e) => setNewCasePriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Lead Officer</label>
                  <input
                    type="text"
                    value={newCaseOfficer}
                    onChange={(e) => setNewCaseOfficer(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Badge ID</label>
                  <input
                    type="text"
                    value={newCaseBadge}
                    onChange={(e) => setNewCaseBadge(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Department</label>
                  <input
                    type="text"
                    value={newCaseDept}
                    onChange={(e) => setNewCaseDept(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsNewCaseModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0052CC] hover:bg-[#0041A8] text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
              >
                Create Case File
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
