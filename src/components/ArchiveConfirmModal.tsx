import React, { useState } from 'react';
import { Archive, RotateCcw, AlertTriangle, X } from 'lucide-react';
import { Camera } from '../types';

interface ArchiveConfirmModalProps {
  camera: Camera;
  mode: 'archive' | 'restore';
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const ArchiveConfirmModal: React.FC<ArchiveConfirmModalProps> = ({
  camera,
  mode,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState(
    mode === 'archive' ? 'Decommissioned by State Administrator' : 'Re-activated into Active Master Registry'
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg ${mode === 'archive' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {mode === 'archive' ? <Archive className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {mode === 'archive' ? 'Archive Camera Asset' : 'Restore Camera Asset'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1 text-amber-900">
          <span className="font-bold flex items-center">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Governance Action Notice
          </span>
          <p>
            {mode === 'archive'
              ? 'Archiving removes the asset from active GIS layers and online monitoring. The master record is preserved immutably.'
              : 'Restoring reinstates this asset into active GIS vector layers and telemetry heartbeat tracking.'}
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono space-y-1">
          <div><span className="text-slate-500">Asset Code:</span> <span className="font-bold text-[#0052CC]">{camera.cameraCode}</span></div>
          <div><span className="text-slate-500">Name:</span> <span className="text-slate-900">{camera.name}</span></div>
          <div><span className="text-slate-500">District:</span> <span>{camera.district} ({camera.departmentName})</span></div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            {mode === 'archive' ? 'Decommission / Archive Reason (Mandatory):' : 'Re-activation Justification:'}
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
            placeholder="Specify regulatory or technical justification..."
          ></textarea>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 text-xs font-semibold">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(reason)}
            className={`px-4 py-2 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 font-bold ${
              mode === 'archive' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <span>{mode === 'archive' ? 'Confirm Archive' : 'Confirm Restore'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
