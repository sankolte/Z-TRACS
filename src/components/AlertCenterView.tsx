import React, { useState } from 'react';
import { SystemAlert } from '../types';
import { ApiClient } from '../services/apiClient';
import { 
  Bell, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  ArrowRight, 
  Search, 
  Filter, 
  Check, 
  X,
  FileCheck,
  Trash2,
  Camera,
  Maximize2,
  Calendar,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  CheckSquare,
  Square
} from 'lucide-react';

interface AlertCenterViewProps {
  alerts: SystemAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onDeleteAlert?: (alertId: string) => void;
  onNavigateToJourney: (plateNumber: string) => void;
}

export const AlertCenterView: React.FC<AlertCenterViewProps> = ({
  alerts,
  onAcknowledgeAlert,
  onResolveAlert,
  onDeleteAlert,
  onNavigateToJourney,
}) => {
  // Watchlist quick add state
  const [watchlistAddedMap, setWatchlistAddedMap] = useState<Record<string, boolean>>({});

  const handleAddToWatchlist = async (plate: string) => {
    const clean = plate.trim().toUpperCase();
    if (!clean) return;
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
      await fetch(`${base}/anpr/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: clean }),
      });
      setWatchlistAddedMap(prev => ({ ...prev, [clean]: true }));
    } catch (err) {
      setWatchlistAddedMap(prev => ({ ...prev, [clean]: true }));
    }
  };
  const [activeSeverityTab, setActiveSeverityTab] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [testFiring, setTestFiring] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Sorting & Filtering State
  const [sortOrder, setSortOrder] = useState<'NEWEST_FIRST' | 'OLDEST_FIRST'>('NEWEST_FIRST');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Bulk Selection State
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);

  // Snapshot Lightbox Modal State
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    url: string;
    title: string;
    plate?: string;
    cam?: string;
    district?: string;
    time?: string;
  } | null>(null);

  const [modalImgError, setModalImgError] = useState(false);
  const [failedSnapshotIds, setFailedSnapshotIds] = useState<Record<string, boolean>>({});

  const formatSnapshotUrl = (snapshot?: string) => {
    if (!snapshot || snapshot.trim() === '') {
      return null;
    }
    let s = snapshot.trim();

    // Defensive: if a data: prefix was accidentally prepended to an /api/ path, strip it
    if (s.includes('/api/v1/anpr/alerts/')) {
      s = s.substring(s.indexOf('/api/v1/anpr/alerts/'));
    }

    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('data:image')) return s;

    // FIX: For relative /api/ paths, use window.location.origin
    if (s.startsWith('/api/')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      if (isHttps) {
        return `${window.location.origin}${s}`;
      }
      return `http://43.204.235.231:8000${s}`;
    }

    if (s.length < 100 || s.endsWith('.jpg') || s.endsWith('.png') || s.endsWith('.jpeg')) {
      return null;
    }

    return `data:image/jpeg;base64,${s}`;
  };

  const fireTestAlerts = async () => {
    setTestFiring(true);
    setTestResult(null);
    try {
      const res = await fetch(`${ApiClient.getApiBase()}/anpr/ingest/test`, { method: 'POST' });
      if (res.ok) {
        setTestResult('✅ 2 test alerts broadcast! Check the list below.');
      } else {
        setTestResult(`❌ Server error: ${res.status}`);
      }
    } catch (e: any) {
      setTestResult(`❌ Network error: ${e.message}`);
    } finally {
      setTestFiring(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handlePurgeAllAlerts = async () => {
    if (!confirm('Are you sure you want to purge all watchlist alerts from the database and dashboard?')) return;
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const base = isHttps ? '/api/v1' : 'http://43.204.235.231:8000/api/v1';
      await fetch(`${base}/anpr/alerts/purge`, { method: 'POST' });
      if (onDeleteAlert && alerts.length > 0) {
        alerts.forEach(a => onDeleteAlert(a.id));
      }
      setSelectedAlertIds([]);
      setTestResult('✅ All mock watchlist alerts purged successfully!');
      setTimeout(() => setTestResult(null), 4000);
    } catch (err: any) {
      setTestResult(`❌ Purge error: ${err.message}`);
    }
  };


  const parseAlertDate = (timestampStr: string): Date | null => {
    if (!timestampStr) return null;
    const d = new Date(timestampStr);
    if (!isNaN(d.getTime())) return d;

    const isoMatch = timestampStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const timeMatch = timestampStr.match(/(\d{2}):(\d{2})/);
      const h = timeMatch ? parseInt(timeMatch[1]) : 0;
      const m = timeMatch ? parseInt(timeMatch[2]) : 0;
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), h, m);
    }

    const indMatch = timestampStr.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (indMatch) {
      const timeMatch = timestampStr.match(/(\d{2}):(\d{2})/);
      const h = timeMatch ? parseInt(timeMatch[1]) : 0;
      const m = timeMatch ? parseInt(timeMatch[2]) : 0;
      return new Date(parseInt(indMatch[3]), parseInt(indMatch[2]) - 1, parseInt(indMatch[1]), h, m);
    }

    return null;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSortOrder('NEWEST_FIRST');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setActiveSeverityTab('ALL');
    setSelectedAlertIds([]);
  };

  const hasActiveFilters = 
    searchQuery !== '' || 
    sortOrder !== 'NEWEST_FIRST' || 
    datePreset !== 'ALL' || 
    startDate !== '' || 
    endDate !== '' || 
    startTime !== '' || 
    endTime !== '' || 
    activeSeverityTab !== 'ALL';

  const filteredAlerts = alerts
    .filter(alt => {
      // 0. Watchlist-Only Rule: Only display Watchlist Match / Type 2 Critical alerts in Real-Time Alert Center
      const isWatchlist = 
        alt.category === 'WATCHLIST_MATCH' || 
        alt.category === 'WATCHLIST_HIT' || 
        alt.severity === 'CRITICAL' || 
        alt.title.toLowerCase().includes('watchlist');
      if (!isWatchlist) return false;

      // 1. Severity Tab Filter
      if (activeSeverityTab === 'CRITICAL' && alt.severity !== 'CRITICAL') return false;
      if (activeSeverityTab === 'HIGH' && alt.severity !== 'HIGH') return false;
      if (activeSeverityTab === 'MEDIUM' && alt.severity !== 'MEDIUM' && (alt.severity as string) !== 'INFO') return false;
      if (activeSeverityTab === 'RESOLVED' && alt.status !== 'RESOLVED') return false;

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          alt.title.toLowerCase().includes(q) ||
          alt.cameraCode.toLowerCase().includes(q) ||
          alt.district.toLowerCase().includes(q) ||
          (alt.plateNumber && alt.plateNumber.toLowerCase().includes(q));
        if (!match) return false;
      }

      const alertDate = parseAlertDate(alt.timestamp);

      // 3. Date Preset & Range Filter
      if (alertDate) {
        const now = new Date();
        if (datePreset === 'TODAY') {
          const todayStr = now.toISOString().split('T')[0];
          const altStr = alertDate.toISOString().split('T')[0];
          if (todayStr !== altStr) return false;
        } else if (datePreset === 'YESTERDAY') {
          const yest = new Date(now);
          yest.setDate(yest.getDate() - 1);
          const yestStr = yest.toISOString().split('T')[0];
          const altStr = alertDate.toISOString().split('T')[0];
          if (yestStr !== altStr) return false;
        } else if (datePreset === 'LAST_7_DAYS') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (alertDate < sevenDaysAgo) return false;
        } else if (datePreset === 'CUSTOM') {
          if (startDate) {
            const sDate = new Date(startDate + 'T00:00:00');
            if (alertDate < sDate) return false;
          }
          if (endDate) {
            const eDate = new Date(endDate + 'T23:59:59');
            if (alertDate > eDate) return false;
          }
        }
      }

      // 4. Time Range Filter (HH:MM)
      if (alertDate && (startTime || endTime)) {
        const alertTimeMinutes = alertDate.getHours() * 60 + alertDate.getMinutes();

        if (startTime) {
          const [sh, sm] = startTime.split(':').map(Number);
          const startMinutes = sh * 60 + sm;
          if (alertTimeMinutes < startMinutes) return false;
        }

        if (endTime) {
          const [eh, em] = endTime.split(':').map(Number);
          const endMinutes = eh * 60 + em;
          if (alertTimeMinutes > endMinutes) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // 5. Sort Order (Recent First vs Oldest First)
      const dA = parseAlertDate(a.timestamp)?.getTime() || 0;
      const dB = parseAlertDate(b.timestamp)?.getTime() || 0;

      if (sortOrder === 'NEWEST_FIRST') {
        return dB - dA;
      } else {
        return dA - dB;
      }
    });

  // Selection Helpers
  const isAllSelected = filteredAlerts.length > 0 && selectedAlertIds.length === filteredAlerts.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAlertIds([]);
    } else {
      setSelectedAlertIds(filteredAlerts.map(a => a.id));
    }
  };

  const toggleSelectAlert = (id: string) => {
    setSelectedAlertIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedAlertIds.length === 0) return;
    if (confirm(`Permanently delete ${selectedAlertIds.length} selected alert(s) from AWS RDS PostgreSQL database?`)) {
      if (onDeleteAlert) {
        selectedAlertIds.forEach(id => onDeleteAlert(id));
      }
      setSelectedAlertIds([]);
    }
  };

  const handleBulkAck = () => {
    if (selectedAlertIds.length === 0) return;
    selectedAlertIds.forEach(id => onAcknowledgeAlert(id));
    setSelectedAlertIds([]);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 select-none">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              Model 2 Alert Desk
            </span>
            <span className="text-xs text-slate-500 font-medium">Statewide Security & Telemetry Incident Operations</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">Surveillance Alert Management Center</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <button
              onClick={fireTestAlerts}
              disabled={testFiring}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              {testFiring ? (
                <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Firing…</>
              ) : (
                <>🔔 Fire Test Alerts (2 types)</>
              )}
            </button>
            <button
              onClick={handlePurgeAllAlerts}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow flex items-center gap-1.5 cursor-pointer"
              title="Purge mock watchlist alerts from database and dashboard"
            >
              🗑️ Clear Watchlist & Mock Alerts
            </button>
            {testResult && (
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">{testResult}</span>
            )}
          </div>
        </div>

        {/* Severity Tabs */}
        <div className="flex items-center bg-[#EDF3FA] p-1 rounded-lg border border-slate-200 text-xs font-bold overflow-x-auto">
          {[
            { id: 'ALL', label: `All (${alerts.length})` },
            { id: 'CRITICAL', label: 'Critical' },
            { id: 'HIGH', label: 'High' },
            { id: 'MEDIUM', label: 'Medium / Info' },
            { id: 'RESOLVED', label: 'Resolved' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSeverityTab(tab.id as any)}
              className={`px-3 py-1 rounded-md transition whitespace-nowrap ${
                activeSeverityTab === tab.id 
                  ? 'bg-[#0052CC] text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Search & Filter Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Text Search Input */}
          <div className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center space-x-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, camera code, district, or plate number..."
              className="w-full bg-transparent border-none text-xs text-slate-900 focus:outline-hidden"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1">
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort Order Control */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setSortOrder('NEWEST_FIRST')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  sortOrder === 'NEWEST_FIRST' ? 'bg-white text-[#0052CC] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Show latest alerts at the top"
              >
                <span>⬇️ Recent First</span>
              </button>
              <button
                onClick={() => setSortOrder('OLDEST_FIRST')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  sortOrder === 'OLDEST_FIRST' ? 'bg-white text-[#0052CC] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Show oldest alerts at the top"
              >
                <span>⬆️ Oldest First</span>
              </button>
            </div>

            {/* Date Preset Selector */}
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">📅 All Dates</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="CUSTOM">Custom Date Range...</option>
            </select>

            {/* Advanced Filters Toggle Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                showAdvancedFilters || (startTime || endTime || startDate || endDate)
                  ? 'bg-blue-50 border-blue-300 text-[#0052CC]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Time & Custom Range</span>
            </button>

            {/* Reset All Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-2 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Reset all active search, sort, date, and time filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Expanded Date & Time Range Panel */}
        {(showAdvancedFilters || datePreset === 'CUSTOM') && (
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg animate-in fade-in duration-150">
            {/* Custom Start Date */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">START DATE</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="w-full px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-hidden"
              />
            </div>

            {/* Custom End Date */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">END DATE</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="w-full px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-hidden"
              />
            </div>

            {/* Custom Start Time */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">START TIME (HH:MM)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-hidden"
              />
            </div>

            {/* Custom End Time */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">END TIME (HH:MM)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Selection & Results Counter Sub-bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs pt-1 border-t border-slate-100 gap-2">
          {/* Left: Select All Checkbox & Count */}
          <div className="flex items-center gap-3 font-semibold text-slate-700">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 hover:text-[#0052CC] transition cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-[#0052CC]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{isAllSelected ? 'Deselect All' : `Select All (${filteredAlerts.length})`}</span>
            </button>

            {selectedAlertIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#0052CC] font-bold text-[11px]">
                {selectedAlertIds.length} Selected
              </span>
            )}
          </div>

          {/* Right: Bulk Actions (Delete Selected & Ack Selected) */}
          <div className="flex items-center gap-2">
            {selectedAlertIds.length > 0 ? (
              <>
                <button
                  onClick={handleBulkAck}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow flex items-center gap-1 cursor-pointer"
                  title="Acknowledge all selected alerts"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Ack Selected ({selectedAlertIds.length})</span>
                </button>

                <button
                  onClick={handleBulkDelete}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow flex items-center gap-1 cursor-pointer"
                  title="Delete all selected alerts permanently from AWS RDS database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedAlertIds.length})</span>
                </button>
              </>
            ) : (
              <span className="text-[11px] font-mono text-slate-500">
                Showing <strong>{filteredAlerts.length}</strong> alerts | Sorted: <strong>{sortOrder === 'NEWEST_FIRST' ? 'Recent First' : 'Oldest First'}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alert Cards Compact Grid (3 Columns on Large Screens) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredAlerts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
            No incidents found matching active filter criteria.
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const rawSnapshotUrl = formatSnapshotUrl(alert.snapshot);
            const snapshotUrl = (rawSnapshotUrl && !failedSnapshotIds[alert.id]) ? rawSnapshotUrl : null;
            const isCritical = alert.severity === 'CRITICAL';
            const isHigh = alert.severity === 'HIGH';
            const isSelected = selectedAlertIds.includes(alert.id);

            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border shadow-2xs flex flex-col justify-between transition hover:shadow-md ${
                  isSelected
                    ? 'ring-2 ring-[#0052CC] bg-blue-50/40 border-blue-300'
                    : isCritical
                    ? 'bg-rose-50/50 border-rose-200' 
                    : isHigh 
                    ? 'bg-amber-50/50 border-amber-200' 
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  {/* Top Header: Checkbox + Badge + Timestamp */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSelectAlert(alert.id)}
                        className="text-slate-400 hover:text-[#0052CC] transition cursor-pointer"
                        title={isSelected ? 'Deselect alert' : 'Select alert for bulk action'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#0052CC]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                        )}
                      </button>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                        isCritical ? 'bg-rose-600 text-white' :
                        isHigh ? 'bg-amber-600 text-white' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {alert.severity} • {alert.category}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono truncate">{alert.timestamp}</span>
                  </div>

                  {/* Card Content Row (Snapshot + Main Details) */}
                  <div className="flex items-start gap-2.5 my-2">
                    {/* Snapshot Thumbnail */}
                    {snapshotUrl ? (
                      <div 
                        onClick={() => {
                          setModalImgError(false);
                          setSelectedSnapshot({
                            url: snapshotUrl,
                            title: alert.title,
                            plate: alert.plateNumber,
                            cam: alert.cameraCode,
                            district: alert.district,
                            time: alert.timestamp
                          });
                        }}
                        className="relative group flex-shrink-0 cursor-pointer overflow-hidden rounded border border-slate-300 shadow-2xs bg-slate-900"
                        title="Click to view full ANPR camera snapshot"
                      >
                        <img 
                          src={snapshotUrl} 
                          alt="ANPR Camera Snapshot" 
                          className="w-20 h-16 object-cover group-hover:scale-110 transition duration-200"
                          onError={() => {
                            setFailedSnapshotIds(prev => ({ ...prev, [alert.id]: true }));
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                        </div>
                        <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[8px] px-1 py-0.2 rounded-tl font-mono">
                          CAM SNAP
                        </span>
                      </div>
                    ) : (
                      <div className="w-16 h-14 bg-slate-100 rounded border border-slate-200 flex flex-col items-center justify-center text-slate-400 flex-shrink-0">
                        <Camera className="w-4 h-4 opacity-40" />
                        <span className="text-[8px] mt-0.5 font-mono">NO IMAGE</span>
                      </div>
                    )}

                    {/* Details Box */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-xs line-clamp-1" title={alert.title}>
                        {alert.title}
                      </h3>
                      
                      {alert.notes && (
                        <p className="text-[10.5px] text-slate-600 line-clamp-1 mt-0.5">{alert.notes}</p>
                      )}

                      <div className="mt-1.5 pt-1 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono gap-1">
                        <span className="text-slate-500 truncate">{alert.cameraCode || 'CAM-N/A'}</span>
                        <span className="text-slate-700 font-semibold truncate">{alert.district}</span>
                      </div>
                    </div>
                  </div>

                  {/* Plate Badge if available */}
                  {alert.plateNumber && (
                    <div className="mb-2 flex items-center justify-between bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-mono">
                      <span className="text-slate-500">PLATE REG:</span>
                      <span className="font-bold text-[#0052CC] bg-blue-50 px-1 rounded">{alert.plateNumber}</span>
                    </div>
                  )}
                </div>

                {/* Compact Action Toolbar */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-1">
                    {alert.plateNumber && (
                      <button
                        onClick={() => onNavigateToJourney(alert.plateNumber!)}
                        className="px-2 py-1 bg-[#0052CC] text-white rounded text-[10px] font-bold hover:bg-[#0041A8] transition cursor-pointer"
                      >
                        Journey →
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    {alert.status === 'NEW' ? (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Ack</span>
                      </button>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                        ACK
                      </span>
                    )}

                    {onDeleteAlert && (
                      <button
                        onClick={() => {
                          if (confirm(`Permanently delete alert ${alert.id} from RDS database?`)) {
                            onDeleteAlert(alert.id);
                          }
                        }}
                        className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded text-[10px] font-bold transition flex items-center space-x-0.5 cursor-pointer"
                        title="Delete permanently from AWS RDS PostgreSQL database"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Snapshot Full Lightbox Modal */}
      {selectedSnapshot && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div 
            className="bg-white rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>ANPR Camera Snapshot Evidence</span>
                </h3>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">{selectedSnapshot.title}</p>
              </div>
              <button 
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-Res Snapshot Image Display */}
            <div className="bg-slate-950 p-2 flex items-center justify-center min-h-[250px] max-h-[450px]">
              {modalImgError ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-mono">
                  <Camera className="w-10 h-10 opacity-30 mb-2" />
                  <span className="text-xs">NO SNAPSHOT IMAGE RECEIVED FOR THIS INCIDENT</span>
                </div>
              ) : (
                <img 
                  src={selectedSnapshot.url} 
                  alt="ANPR High Resolution Snapshot" 
                  className="max-h-[420px] w-auto object-contain rounded border border-slate-800 shadow"
                  onError={() => setModalImgError(true)}
                />
              )}
            </div>

            {/* Modal Footer Specs */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">PLATE NUMBER</span>
                <span className="font-bold text-[#0052CC]">{selectedSnapshot.plate || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">CAMERA CODE</span>
                <span className="font-bold text-slate-800">{selectedSnapshot.cam || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">DISTRICT</span>
                <span className="font-bold text-slate-800">{selectedSnapshot.district || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">CAPTURE TIME</span>
                <span className="font-bold text-slate-700">{selectedSnapshot.time || 'N/A'}</span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
