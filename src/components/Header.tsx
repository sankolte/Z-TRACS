import React, { useState } from 'react';
import {
  Bell,
  Search,
  LogOut,
  UserCheck,
  Building,
  MapPin,
  ShieldCheck,
  User,
  ChevronDown,
  Activity,
  Menu,
} from 'lucide-react';
import { Language } from '../types';
import { useRBAC, ROLE_PERMISSIONS_MAP } from '../context/RBACContext';

interface HeaderProps {
  currentLang?: Language;
  onLanguageChange?: (lang: Language) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onOpenNotifications?: () => void;
  onToggleNotifications?: () => void;
  onOpenSystemStatus?: () => void;
  onOpenSearch?: () => void;
  unreadAlertCount?: number;
  unreadAlertsCount?: number;
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  onToggleNotifications,
  onOpenSystemStatus,
  onOpenSearch,
  unreadAlertCount = 0,
  unreadAlertsCount = 0,
  onLogout,
  onToggleMobileMenu,
}) => {
  const effectiveAlertCount = unreadAlertCount || unreadAlertsCount;
  const handleNotifyClick = onToggleNotifications || onOpenNotifications || (() => {});
  const { currentUser, currentRole } = useRBAC();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const userRoleLabel = ROLE_PERMISSIONS_MAP[currentRole]?.label || currentRole;

  // Generate initials from name
  const initials = currentUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  // Role colour for the avatar ring
  const roleColors: Record<string, string> = {
    STATE_ADMIN: '#CC2200',
    DISTRICT_ADMIN: '#138808',
    CONTROL_ROOM_OPERATOR: '#0052CC',
    POLICE_OFFICER: '#7B2D8B',
    DEPARTMENT_ADMIN: '#CC6600',
    DISTRICT_OFFICER: '#006633',
    STATE_AUDITOR: '#555555',
  };
  const roleColor = roleColors[currentRole] || '#0052CC';

  return (
    <header className="w-full bg-[#00253E] text-white border-b border-[#00385C] select-none flex-shrink-0 z-40" style={{ height: 52 }}>
      <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-3">

        {/* LEFT: Mobile Menu Button & System Status */}
        <div className="flex items-center space-x-2.5">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-1.5 rounded-lg bg-[#00385C] text-slate-200 hover:text-white hover:bg-[#004B7A] transition"
              title="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onOpenSystemStatus}
            className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded bg-[#00385C] hover:bg-[#004B7A] border border-[#004B7A] text-xs font-bold transition cursor-pointer"
            title="System Status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
            <span className="text-emerald-300 uppercase tracking-wide text-[11px]">SYSTEM OPERATIONAL</span>
          </button>

          {/* Mobile dot indicator */}
          <div className="sm:hidden w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" title="System Operational" />
        </div>

        {/* CENTER: Global Search */}
        <div className="flex-1 max-w-sm hidden md:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center space-x-2 px-3 py-1.5 bg-[#00385C] hover:bg-[#004B7A] border border-[#004B7A] text-slate-300 text-xs rounded transition"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-400 flex-1 text-left">Global Search...</span>
            <kbd className="px-1.5 py-0.5 bg-[#001f38] text-[10px] font-mono rounded text-slate-400">⌘K</kbd>
          </button>
        </div>

        {/* RIGHT: Bell + Profile */}
        <div className="flex items-center space-x-2">

          {/* Mobile Search Icon */}
          <button
            onClick={onOpenSearch}
            className="md:hidden p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 transition"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <button
            onClick={handleNotifyClick}
            className="relative p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 transition"
            title="Alerts & Notifications"
          >
            <Bell className="w-4 h-4" />
            {effectiveAlertCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#00253E]"></span>
            )}
          </button>

          {/* Profile — User Icon */}
          <div className="relative border-l border-slate-700 pl-2">
            <button
              onClick={() => setIsProfileDropdownOpen(p => !p)}
              className="flex items-center space-x-2 py-1 px-1.5 rounded hover:bg-slate-800 transition cursor-pointer"
            >
              {/* Icon Avatar — initials in coloured circle */}
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-white text-[11px] flex-shrink-0 shadow border-2 border-white/20"
                style={{ background: roleColor }}
              >
                {initials || <User className="w-4 h-4" />}
              </div>

              {/* Name & Role (desktop only) */}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-white leading-tight truncate max-w-[130px]">
                  {currentUser.name}
                </div>
                <div className="text-[9px] font-semibold text-blue-300 uppercase tracking-wider truncate">
                  {userRoleLabel}
                </div>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 hidden sm:block transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown */}
            {isProfileDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileDropdownOpen(false)}
                />

                <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-64 sm:w-72 text-xs text-slate-800 overflow-hidden">

                  {/* Profile Header */}
                  <div className="bg-[#0d1f3c] px-4 py-4 flex items-center space-x-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-lg border-2 border-white/30"
                      style={{ background: roleColor }}
                    >
                      {initials || <User className="w-6 h-6" />}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                      <div className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 font-bold text-[9px] uppercase tracking-wider border border-blue-700/50">
                        {userRoleLabel}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-4 py-3 space-y-2.5 text-[11px] text-slate-600 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono font-bold text-slate-800">{currentUser.badge}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{currentUser.departmentName || 'Gujarat Police'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{currentUser.district || 'Statewide'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-[10px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Authenticated Session Active</span>
                    </div>
                    {currentUser.lastLogin && (
                      <div className="flex items-center space-x-2 text-slate-400 text-[10px]">
                        <Activity className="w-3.5 h-3.5 shrink-0" />
                        <span>Last login: {currentUser.lastLogin}</span>
                      </div>
                    )}
                  </div>

                  {/* Sign Out */}
                  {onLogout && (
                    <div className="p-3">
                      <button
                        onClick={() => { setIsProfileDropdownOpen(false); onLogout(); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer border border-rose-100 hover:border-rose-200"
                      >
                        <span className="flex items-center space-x-2">
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out / Log Out</span>
                        </span>
                        <span className="text-[10px] text-rose-400 font-mono">Exit</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
