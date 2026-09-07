import React from 'react';
import { X, AlertTriangle, Activity, Bell, CheckCircle2, ShieldAlert, Video } from 'lucide-react';
import { HealthEvent, Camera } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: HealthEvent[];
  onSelectCameraById?: (cameraId: string) => void;
  onSelectEvent?: (event: HealthEvent) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onSelectCameraById,
  onSelectEvent,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
      <div className="bg-white border-l border-slate-200 w-full max-w-md h-full shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-red-100 text-red-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Incident & Health Alerts</h3>
              <p className="text-[11px] text-slate-500">Real-time CCTV WAN Telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {events.map((evt) => {
            const isCritical = evt.severity === 'critical';
            const isWarning = evt.severity === 'warning';
            return (
              <div
                key={evt.id}
                onClick={() => {
                  if (onSelectEvent) {
                    onSelectEvent(evt);
                  } else if (onSelectCameraById) {
                    onSelectCameraById(evt.cameraId);
                  }
                  onClose();
                }}
                className={`p-3.5 rounded-xl border transition cursor-pointer hover:shadow-sm ${
                  isCritical
                    ? 'bg-red-50/70 border-red-200 hover:bg-red-50'
                    : isWarning
                    ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                    : 'bg-slate-50 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-1.5">
                    {isCritical ? (
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#0072ce] shrink-0" />
                    )}
                    <span className="font-mono text-xs font-bold text-slate-900">{evt.cameraId}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{evt.timestamp.split(' ')[1] || evt.timestamp}</span>
                </div>

                <p className="text-xs font-semibold text-slate-800 mt-1">{evt.cameraName}</p>
                <div className="text-[11px] text-slate-500 mt-0.5">{evt.department} • {evt.district}</div>

                <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isCritical ? 'bg-red-100 text-red-800' : isWarning ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {evt.type}
                  </span>
                  <span className="text-slate-500 text-[10px] font-mono">{evt.duration}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
          {events.length} active alerts • Surveillance Command Center
        </div>

      </div>
    </div>
  );
};
