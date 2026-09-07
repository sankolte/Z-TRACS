import React, { useState, useEffect } from 'react';
import {
  Shield, Lock, UserCheck, KeyRound, ArrowRight,
  ShieldCheck, UserCog, Radio, BadgeCheck, Eye, EyeOff,
  AlertTriangle, Clock, Globe, ChevronRight, ArrowLeft,
  CheckCircle2, Monitor, Users, Building2, FileText
} from 'lucide-react';
import { UserRole, User } from '../types';
import { useRBAC } from '../context/RBACContext';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  onBack: () => void;
  defaultRoleHint?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onBack, defaultRoleHint }) => {
  const { switchUser } = useRBAC();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const rbacRolesList: {
    role: UserRole;
    title: string;
    designation: string;
    description: string;
    accessLevel: string;
    accessColor: string;
    icon: React.ElementType;
    user: User;
  }[] = [
    {
      role: 'STATE_ADMIN',
      title: 'State Administrator',
      designation: 'IPS / IAS — State Level',
      description: 'Full statewide governance, all districts, departments, system configuration, and reporting.',
      accessLevel: 'LEVEL 5 — MOST PRIVILEGED',
      accessColor: '#7B0000',
      icon: ShieldCheck,
      user: {
        id: 'usr-001', name: 'Rajesh K. Sharma, IPS', badge: 'GJ-POL-2018-09',
        email: 'adgp.telecom@gujaratpolice.gov.in', role: 'STATE_ADMIN',
        departmentId: 'DEPT-POL-01', departmentName: 'Gujarat Police (Traffic & Law Enforcement)',
        district: 'Gandhinagar',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        status: 'ACTIVE', lastLogin: '2026-08-20 10:35:12 IST',
      }
    },
    {
      role: 'DISTRICT_ADMIN',
      title: 'District Administrator',
      designation: 'IAS / District Collector',
      description: 'District-scoped admin, cameras, gap analysis, municipal assets, onboarding.',
      accessLevel: 'LEVEL 4 — RESTRICTED',
      accessColor: '#0a4a2a',
      icon: UserCog,
      user: {
        id: 'usr-002', name: 'Smt. Mona Khandhar, IAS', badge: 'GJ-IAS-2012-04',
        email: 'securb@gujarat.gov.in', role: 'DISTRICT_ADMIN',
        departmentId: 'DEPT-MNC-02', departmentName: 'Urban & Municipal Corporations',
        district: 'Ahmedabad',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        status: 'ACTIVE', lastLogin: '2026-08-20 09:12:44 IST',
      }
    },
    {
      role: 'CONTROL_ROOM_OPERATOR',
      title: 'Control Room Operator',
      designation: 'Inspector / Sub-Inspector',
      description: 'Live 24×7 video wall monitoring, real-time alert triage, camera telemetry.',
      accessLevel: 'LEVEL 3 — CONFIDENTIAL',
      accessColor: '#1a3a6b',
      icon: Radio,
      user: {
        id: 'usr-004', name: 'Insp. Vikram V. Solanki', badge: 'GJ-POL-2020-108',
        email: 'operator.controlroom@gujarat.gov.in', role: 'CONTROL_ROOM_OPERATOR',
        departmentId: 'DEPT-POL-01', departmentName: 'Gujarat Police',
        district: 'Surat',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        status: 'ACTIVE', lastLogin: '2026-08-20 10:30:15 IST',
      }
    },
    {
      role: 'POLICE_OFFICER',
      title: 'Police Field Officer',
      designation: 'ASI / Constable / HC',
      description: 'ANPR vehicle search, cross-camera journey tracking, SHA-256 evidence vault.',
      accessLevel: 'LEVEL 3 — CONFIDENTIAL',
      accessColor: '#2a1a50',
      icon: BadgeCheck,
      user: {
        id: 'usr-003', name: 'G. S. Malik, IPS', badge: 'GJ-POL-2015-22',
        email: 'cp.ahmedabad@gujaratpolice.gov.in', role: 'POLICE_OFFICER',
        departmentId: 'DEPT-POL-01', departmentName: 'Gujarat Police',
        district: 'Ahmedabad',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        status: 'ACTIVE', lastLogin: '2026-08-20 10:01:00 IST',
      }
    }
  ];

  const defaultIdx = rbacRolesList.findIndex(r => r.role === defaultRoleHint);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number>(defaultIdx >= 0 ? defaultIdx : 0);
  const selectedPersona = rbacRolesList[selectedRoleIndex];
  const [badgeInput, setBadgeInput] = useState(selectedPersona.user.badge);
  const [passwordInput, setPasswordInput] = useState('');

  const handleRoleSelect = (index: number) => {
    setSelectedRoleIndex(index);
    setBadgeInput(rbacRolesList[index].user.badge);
    setLoginError('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!badgeInput.trim()) { setLoginError('Employee / Badge ID is required.'); return; }
    if (!agreedToTerms) { setLoginError('Please acknowledge the terms of access to continue.'); return; }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      switchUser(selectedPersona.user);
      onLoginSuccess(selectedPersona.user);
    }, 1200);
  };

  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour12: false });
  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 select-none">

      {/* ── GOI Tricolor Top Bar ── */}
      <div className="flex h-1.5 flex-shrink-0">
        <div className="flex-1" style={{ background: '#FF9933' }}></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1" style={{ background: '#138808' }}></div>
      </div>

      {/* ── Accessibility Bar ── */}
      <div className="bg-[#1a2744] border-b border-[#243560] py-1.5 px-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 font-semibold">
              <Globe className="w-3 h-3" />
              <span>Government of Gujarat — Official Portal</span>
            </span>
            <span className="text-slate-600">|</span>
            <a href="#" className="text-slate-400 hover:text-white">Skip to Main Content</a>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{timeStr} IST</span>
            <span className="text-slate-600">|</span>
            <span className="text-[10px] hidden sm:inline">{dateStr}</span>
          </div>
        </div>
      </div>

      {/* ── Portal Header ── */}
      <div className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Back to Home */}
            <button
              onClick={onBack}
              className="flex items-center space-x-1.5 text-[#0052CC] text-xs font-semibold hover:underline transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Portal</span>
            </button>

            <div className="w-px h-8 bg-slate-200"></div>

            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#0052CC] flex items-center justify-center shadow">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-base font-black text-[#0052CC] leading-tight">Z-TRACS</div>
                <div className="text-[9px] text-slate-500">Gujarat Police • Govt. of Gujarat</div>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-[11px] text-slate-500">
            <Building2 className="w-3.5 h-3.5" />
            <span>NIC Hosted • ISO 27001:2022</span>
            <span className="ml-3 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded text-[10px]">● SYSTEM ONLINE</span>
          </div>
        </div>

        {/* Blue classification banner */}
        <div className="bg-[#0052CC] py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-3 text-white text-[11px] font-bold">
            <Shield className="w-3.5 h-3.5 text-white/70" />
            <span className="uppercase tracking-widest">Secure Authentication — For Authorised Government Personnel Only</span>
            <Shield className="w-3.5 h-3.5 text-white/70" />
          </div>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="bg-[#f0f4f8] border-b border-slate-200 py-2 px-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center space-x-1.5 text-[11px] text-slate-500">
          <button onClick={onBack} className="hover:text-[#0052CC] transition">Home</button>
          <ChevronRight className="w-3 h-3" />
          <span>Secure Login</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#0052CC] font-semibold">RBAC Authentication Portal</span>
        </div>
      </div>

      {/* ── MAIN LOGIN CONTENT ── */}
      <main className="flex-1 py-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── LEFT INFO PANEL ── */}
          <div className="lg:col-span-4 space-y-5">

            {/* Authorised Access Warning */}
            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 font-black text-xs uppercase tracking-wider">Authorised Access Only</p>
                <p className="text-amber-700/80 text-[11px] mt-1 leading-relaxed">
                  This system is for authorised Government employees only. All access is logged and subject to IT Act 2000, Section 66.
                </p>
              </div>
            </div>

            {/* Login instructions */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">How to Login</h3>
              <ol className="space-y-3">
                {[
                  { n: 1, text: 'Select your official role from the 4 available roles' },
                  { n: 2, text: 'Enter your Government-issued Employee / Badge ID' },
                  { n: 3, text: 'Enter your Passphrase or Smart Card PIN' },
                  { n: 4, text: 'Acknowledge the Terms of Access and click Login' },
                ].map(s => (
                  <li key={s.n} className="flex items-start space-x-3">
                    <div className="w-5 h-5 rounded-full bg-[#0052CC] text-white text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</div>
                    <span className="text-[11px] text-slate-600 leading-relaxed">{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Security Features */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Security Standards</h3>
              <div className="space-y-2">
                {[
                  'TLS 1.3 End-to-End Encryption',
                  'Multi-Factor Authentication Ready',
                  'ISO 27001:2022 Certified Infra',
                  'Full Audit Trail Maintained',
                  'NIC Data Centre Hosted',
                ].map(f => (
                  <div key={f} className="flex items-center space-x-2 text-[11px] text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Help */}
            <div className="bg-[#EEF4FF] border border-blue-200 rounded-xl p-4 text-xs text-[#0052CC]">
              <div className="font-bold mb-1">Need Help?</div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Contact NIC Help Desk:<br/>
                📞 1800-233-5500 (Toll Free)<br/>
                📧 helpdesk@nic.in
              </p>
            </div>
          </div>

          {/* ── RIGHT: LOGIN FORM CARD ── */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">

              {/* Card Header */}
              <div className="bg-[#0d1f3c] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0052CC] flex items-center justify-center shadow-md">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-black text-sm">Official Operator Authentication</div>
                    <div className="text-slate-400 text-[11px]">Z-TRACS Secure Login • Role-Based Access Control</div>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Connection</span>
                  <span className="font-mono text-[11px] text-emerald-400 font-bold">🔒 SECURED</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-6">

                {/* STEP 1: ROLE SELECTION */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Step 1 — Select Your Official Role
                      </label>
                      <p className="text-[10px] text-slate-500 mt-0.5">Choose the role that matches your official designation</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#0052CC] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">4 Roles</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rbacRolesList.map((item, index) => {
                      const isSelected = index === selectedRoleIndex;
                      const IconComp = item.icon;
                      return (
                        <button
                          type="button"
                          key={item.role}
                          onClick={() => handleRoleSelect(index)}
                          className={`text-left rounded-xl border-2 overflow-hidden transition-all duration-150 ${
                            isSelected ? 'border-[#0052CC] shadow-md ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          {/* Role Title Bar */}
                          <div className={`px-4 py-2.5 flex items-center justify-between transition ${isSelected ? 'bg-[#0052CC]' : 'bg-slate-100'}`}>
                            <div className="flex items-center space-x-2">
                              <IconComp className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-600'}`} />
                              <span className={`text-[11px] font-black uppercase tracking-wide ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                {item.title}
                              </span>
                            </div>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-300"></span>}
                          </div>
                          {/* Role Body */}
                          <div className={`px-4 py-3 ${isSelected ? 'bg-blue-50' : 'bg-white'} transition`}>
                            <div className="text-[10px] text-slate-500 mb-1">{item.designation}</div>
                            <div className="text-[10px] font-mono font-bold text-slate-800 mb-1.5">{item.user.name}</div>
                            <div className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: item.accessColor + '18', color: item.accessColor, border: `1px solid ${item.accessColor}40` }}>
                              {item.accessLevel}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1.5 leading-tight line-clamp-2">{item.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DIVIDER */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Step 2 — Enter Credentials</span>
                  </div>
                </div>

                {/* CREDENTIALS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Badge ID */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Employee ID / Badge Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        id="badge-input"
                        value={badgeInput}
                        onChange={e => { setBadgeInput(e.target.value); setLoginError(''); }}
                        placeholder="e.g. GJ-POL-2018-09"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 transition"
                        autoComplete="username"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Format: GJ-{'{'}DEPT{'}'}-YYYY-NN</p>
                  </div>

                  {/* Passphrase */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Passphrase / Smart Card PIN <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password-input"
                        value={passwordInput}
                        onChange={e => { setPasswordInput(e.target.value); setLoginError(''); }}
                        placeholder="Enter secure passphrase"
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 transition"
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition" tabIndex={-1}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Min. 8 characters • Case sensitive</p>
                  </div>
                </div>

                {/* SELECTED USER PREVIEW */}
                <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <img
                    src={selectedPersona.user.avatar}
                    alt={selectedPersona.user.name}
                    className="w-10 h-10 rounded-full border-2 border-[#0052CC] object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{selectedPersona.user.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{selectedPersona.user.email}</div>
                    <div className="text-[10px] font-mono text-[#0052CC] font-bold">{selectedPersona.user.badge} · {selectedPersona.user.district}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[9px] text-slate-400">Last Login</div>
                    <div className="text-[10px] font-mono text-slate-600">{selectedPersona.user.lastLogin?.slice(11, 19)}</div>
                  </div>
                </div>

                {/* ERROR */}
                {loginError && (
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* TERMS ACKNOWLEDGEMENT */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={e => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 flex-shrink-0 accent-[#0052CC] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] text-amber-800 leading-relaxed">
                      I am an authorised Government employee. I acknowledge that this system is monitored, all access is logged, and unauthorised use is punishable under the <strong>Information Technology Act, 2000 (Section 66)</strong> and applicable Government policies.
                    </span>
                  </label>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={isLoading}
                  id="login-submit-btn"
                  className="w-full py-3.5 rounded-xl text-sm font-black text-white flex items-center justify-center space-x-3 transition-all duration-200 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ background: isLoading ? '#6b7280' : 'linear-gradient(90deg, #003399 0%, #0052CC 60%, #0066FF 100%)' }}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span>Authenticating Credentials — Please wait…</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Login as {selectedPersona.title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* HELP LINKS */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <a href="#" className="hover:text-[#0052CC] transition hover:underline">Forgot Badge ID?</a>
                  <a href="#" className="hover:text-[#0052CC] transition hover:underline">Reset Password</a>
                  <a href="#" className="hover:text-[#0052CC] transition hover:underline">NIC Help Desk</a>
                  <a href="#" className="hover:text-[#0052CC] transition hover:underline">IT Grievance</a>
                </div>

              </form>

              {/* Card Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>TLS 1.3 Encrypted • Compliant with CERT-In Guidelines</span>
                </div>
                <div className="text-[10px] text-slate-400">v3.4.1 • NIC MeitY Hosted</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0d1f3c] border-t border-[#1a2f55] mt-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[11px] text-slate-400 text-center sm:text-left">
            © 2026 Gujarat Police Department & Government of Gujarat. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {['Privacy Policy', 'Terms of Use', 'Accessibility', 'Sitemap', 'Contact'].map((l, i) => (
              <React.Fragment key={l}>
                {i > 0 && <span className="text-slate-700">|</span>}
                <a href="#" className="hover:text-slate-300 transition">{l}</a>
              </React.Fragment>
            ))}
          </div>
        </div>
        {/* Bottom tricolor */}
        <div className="flex h-1">
          <div className="flex-1" style={{ background: '#FF9933' }}></div>
          <div className="flex-1 bg-white"></div>
          <div className="flex-1" style={{ background: '#138808' }}></div>
        </div>
      </footer>

    </div>
  );
};
