import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Search, ChevronDown, Globe, Accessibility, Monitor,
  Phone, HelpCircle, FileText, Video, MapPin, Bell, ChevronRight,
  X, Menu, ExternalLink, ZoomIn, ZoomOut, AlertCircle,
  Eye, Wifi, Camera, Lock, Users, BookOpen, MessageSquare,
  ArrowRight, CheckCircle, Play, Server, Cpu, Database, Award,
  BarChart3, FileSpreadsheet, Activity, Layers, SlidersHorizontal
} from 'lucide-react';

interface LandingPageProps {
  onNavigateToLogin: (roleHint?: string) => void;
}

const TICKER_ITEMS = [
  '📢 Z-TRACS Phase-III statewide rollout covering 180 talukas from 01 Sept 2026.',
  '🔔 All field officers must complete ANPR module training by 31 Aug 2026.',
  '📡 New camera federation integrations: Vadodara Smart City & Rajkot Municipal Cameras added.',
  '⚠️ Scheduled maintenance on GIS layer Sunday 24 Aug 2026 02:00–04:00 IST.',
  '✅ 12,482 cameras now active statewide — 95.6% uptime achieved.',
];

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About Z-TRACS' },
  { id: 'camera-network', label: 'Camera Network' },
  { id: 'districts', label: 'Districts & Coverage' },
  { id: 'anpr-analytics', label: 'ANPR Analytics' },
  { id: 'reports-data', label: 'Reports & Data' },
  { id: 'help-support', label: 'Help & Support' },
];

const ROLE_CARDS = [
  {
    id: 'STATE_ADMIN',
    title: 'State Administrator',
    titleGu: 'State Administrator',
    count: '4 Roles',
    img: 'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=600&auto=format&fit=crop&q=80',
    desc: 'Full statewide system access & governance',
    color: '#1a3a6b',
  },
  {
    id: 'DISTRICT_ADMIN',
    title: 'District Administrator',
    titleGu: 'District Administrator',
    count: '33 Districts',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&auto=format&fit=crop&q=80',
    desc: 'District-level camera & operator management',
    color: '#1a4a3a',
  },
  {
    id: 'CONTROL_ROOM_OPERATOR',
    title: 'Control Room Operator',
    titleGu: 'Control Room Operator',
    count: 'Live 24×7',
    img: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=600&auto=format&fit=crop&q=80',
    desc: 'Live video wall & real-time alert monitoring',
    color: '#3a2a1a',
  },
  {
    id: 'POLICE_OFFICER',
    title: 'Police Field Officer',
    titleGu: 'Police Field Officer',
    count: '8,492 ANPR/day',
    img: 'https://images.unsplash.com/photo-1570126618953-d437176e8c79?w=600&auto=format&fit=crop&q=80',
    desc: 'ANPR vehicle search & 3D journey tracking',
    color: '#2a1a3a',
  },
];

const STATS = [
  { label: 'Active Cameras', value: '12,482', icon: Camera, color: '#0072CE' },
  { label: 'Districts Covered', value: '33 / 33', icon: MapPin, color: '#10B981' },
  { label: 'ANPR Captures Today', value: '8,492', icon: Eye, color: '#8B5CF6' },
  { label: 'Live RTSP Feeds', value: '347', icon: Wifi, color: '#F59E0B' },
];

const DISTRICT_LIST = [
  { name: 'Ahmedabad', cameras: '2,840', status: '100% ONLINE', hub: 'Ahmedabad City Command' },
  { name: 'Surat', cameras: '2,150', status: '98.9% ONLINE', hub: 'Surat Smart City CCC' },
  { name: 'Vadodara', cameras: '1,620', status: '99.2% ONLINE', hub: 'Vadodara Urban CCC' },
  { name: 'Rajkot', cameras: '1,280', status: '97.5% ONLINE', hub: 'Rajkot Range Police HQ' },
  { name: 'Gandhinagar', cameras: '950', status: '100% ONLINE', hub: 'State Command Center (HQ)' },
  { name: 'Bhavnagar', cameras: '740', status: '96.8% ONLINE', hub: 'Bhavnagar District Control' },
  { name: 'Jamnagar', cameras: '620', status: '98.1% ONLINE', hub: 'Jamnagar Police HQ' },
  { name: 'Junagadh', cameras: '540', status: '97.0% ONLINE', hub: 'Junagadh Range CCC' },
  { name: 'Surendranagar', cameras: '480', status: '99.0% ONLINE', hub: 'Surendranagar SP Office' },
  { name: 'Kutch (Bhuj)', cameras: '690', status: '95.9% ONLINE', hub: 'Kutch Border Range CCC' },
  { name: 'Mehsana', cameras: '410', status: '98.4% ONLINE', hub: 'Mehsana District Control' },
  { name: 'Navsari', cameras: '380', status: '99.1% ONLINE', hub: 'Navsari Police Control' }
];

const FAQ_ITEMS = [
  { q: 'What is Z-TRACS?', a: 'Z-TRACS (Zonal Traffic & Road Asset Command System) is the Government of Gujarat\'s centralised CCTV surveillance and intelligent traffic monitoring platform, providing real-time video intelligence across all 33 districts.' },
  { q: 'Who can access the Z-TRACS portal?', a: 'Access is restricted to authorised Government employees with valid Badge IDs: State Administrators (IPS/IAS), District Administrators, Control Room Operators, and Police Field Officers.' },
  { q: 'How does ANPR vehicle tracking work?', a: 'Z-TRACS uses AI-powered Automatic Number Plate Recognition at over 3,200 checkpoints. Plates are read in real-time and cross-referenced against the National Vehicle Registry and Watchlist databases.' },
  { q: 'Is the data stored securely?', a: 'All footage is encrypted with AES-256, stored in NIC-certified data centres, and access is audited with full chain of custody for court-admissible evidence under SHA-256 hash verification.' },
];

const USER_MANUALS = [
  { title: 'Help file for Online Login Process', icon: BookOpen },
  { title: 'ANPR Search & Vehicle Journey Guide', icon: Search },
  { title: 'Camera Onboarding User Manual', icon: Camera },
  { title: 'Control Room Operator Manual', icon: Monitor },
];

const QUICK_LINKS = [
  { icon: AlertCircle, label: 'Grievance Desk', color: '#F59E0B', sub: 'Submit portal inquiry' },
  { icon: Phone, label: 'Police Helpline', color: '#0072CE', sub: '1800-233-5500' },
  { icon: HelpCircle, label: 'Command Center Help', color: '#10B981', sub: '24×7 Technical Desk' },
  { icon: FileText, label: 'Citizen Charter', color: '#8B5CF6', sub: 'Surveillance Guidelines' },
];

const PARTNER_LOGOS = [
  { name: 'Government of Gujarat', abbr: 'GoG' },
  { name: 'Digital India', abbr: 'DI' },
  { name: 'NIC', abbr: 'NIC' },
  { name: 'india.gov.in', abbr: 'NPI' },
  { name: 'MeitY', abbr: 'MeT' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState('home');
  const [fontSize, setFontSize] = useState(14);
  const loginRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTickerIndex(i => (i + 1) % TICKER_ITEMS.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
        setLoginMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveNavSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      const headerOffset = 110;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden select-none" style={{ fontSize }}>

      {/* ══ 1. GOI TOP ACCESSIBILITY BAR ══ */}
      <div className="bg-[#001D31] border-b border-[#00385C] py-1.5 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 text-[10px] sm:text-[11px] text-slate-300">
            <a href="https://gujaratindia.gov.in" target="_blank" rel="noreferrer" className="flex items-center space-x-1 hover:text-white transition">
              <Globe className="w-3 h-3 text-[#0072CE]" />
              <span className="font-semibold text-white">Government of Gujarat</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60 hidden xs:inline" />
            </a>
            <span className="text-slate-600">|</span>
            <button onClick={() => scrollToSection('home')} className="hover:text-white transition hidden xs:inline">Skip to Main Content</button>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 text-[10px] sm:text-[11px] text-slate-300">
            {/* Font Size Controls */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 hidden sm:inline text-[10px]">Font:</span>
              <button onClick={() => setFontSize(f => Math.max(12, f - 1))} className="w-5 h-5 border border-slate-600 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-[9px] font-bold rounded-sm">A-</button>
              <button onClick={() => setFontSize(14)} className="w-5 h-5 border border-slate-600 bg-[#0072CE] text-white flex items-center justify-center text-[9px] font-bold rounded-sm">A</button>
              <button onClick={() => setFontSize(f => Math.min(18, f + 1))} className="w-6 h-5 border border-slate-600 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-[10px] font-bold rounded-sm">A+</button>
            </div>
            <span className="text-slate-600">|</span>
            <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>State WAN Active</span>
            </span>
          </div>
        </div>
      </div>

      {/* ══ 2. MAIN HEADER ══ */}
      <div className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0 cursor-pointer" onClick={() => scrollToSection('home')}>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#00253E] border border-[#00385C] flex items-center justify-center shadow-md flex-shrink-0">
              <Shield className="w-5 h-5 text-[#0072CE]" />
            </div>
            <div>
              <div className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">Gujarat Police & Department of Home</div>
              <div className="text-base sm:text-lg font-black text-[#00253E] leading-tight tracking-tight">
                Z-TRACS GRID
              </div>
              <div className="text-[8px] sm:text-[9px] text-slate-500 font-semibold hidden xs:block">Zonal Traffic & Road Asset Command System</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search cameras, 33 districts, ANPR plates, reports..."
                className="w-full pl-9 pr-4 py-1.5 sm:py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 bg-slate-50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Official Portal Login Dropdown */}
            <div className="relative" ref={loginRef}>
              <button
                onClick={() => setLoginMenuOpen(o => !o)}
                className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#00253E] text-white rounded-lg text-xs font-extrabold hover:bg-[#00385C] transition shadow-sm border border-[#004B7A]"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Official Login</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${loginMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {loginMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="bg-[#00253E] px-3.5 py-2.5 border-b border-[#00385C]">
                    <p className="text-white text-[10px] font-bold uppercase tracking-wider">Select Official Persona</p>
                  </div>
                  {[
                    { label: 'State Administrator (IPS/IAS)', hint: 'STATE_ADMIN', icon: Shield },
                    { label: 'District Administrator', hint: 'DISTRICT_ADMIN', icon: Globe },
                    { label: 'Control Room Operator', hint: 'CONTROL_ROOM_OPERATOR', icon: Monitor },
                    { label: 'Police Field Officer', hint: 'POLICE_OFFICER', icon: Users },
                  ].map(opt => (
                    <button
                      key={opt.hint}
                      onClick={() => { setLoginMenuOpen(false); onNavigateToLogin(opt.hint); }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-0"
                    >
                      <opt.icon className="w-4 h-4 text-[#0072CE] shrink-0" />
                      <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Register Button */}
            <button
              onClick={() => onNavigateToLogin()}
              className="hidden sm:inline-flex px-3.5 py-1.5 sm:py-2 border-2 border-[#0072CE] text-[#0072CE] rounded-lg text-xs font-bold hover:bg-blue-50 transition"
            >
              Provision Account
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              title="Toggle Mobile Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* ── 3. OFFICIAL NAVY BLUE NAVBAR ── */}
        <div className="bg-[#00253E] border-t border-[#00385C] shadow-md hidden md:block">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNavSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition border-b-2 cursor-pointer ${
                      isActive
                        ? 'text-white border-amber-400 bg-[#00385C]'
                        : 'text-slate-300 border-transparent hover:text-white hover:bg-[#00385C] hover:border-[#0072CE]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ── Mobile Navigation Drawer Menu ── */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#00253E] border-t border-[#00385C] text-white p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* Mobile Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search cameras, districts..."
                className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 rounded-lg text-xs focus:outline-none"
              />
            </div>

            {/* Nav Links */}
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold border-t border-[#00385C] pt-3">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    scrollToSection(item.id);
                  }}
                  className={`p-2.5 rounded-lg text-left transition ${
                    activeNavSection === item.id
                      ? 'bg-[#0072CE] font-bold text-white'
                      : 'bg-[#00385C] text-slate-200 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ 4. NEWS TICKER ══ */}
      <div className="bg-[#D9222A] text-white text-[10px] sm:text-[11px] flex items-center overflow-hidden">
        <div className="bg-[#B91C1C] px-3 sm:px-4 py-2 font-black uppercase tracking-wider whitespace-nowrap flex-shrink-0 flex items-center space-x-1.5">
          <Bell className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden xs:inline">Official Alert Ticker</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div
            key={tickerIndex}
            className="py-2 px-3 sm:px-6 font-semibold animate-pulse truncate"
          >
            {TICKER_ITEMS[tickerIndex]}
          </div>
        </div>
      </div>

      <main id="main">
        
        {/* ══ SECTION 1: HOME (HERO) ══ */}
        <section id="home" className="scroll-mt-28">
          <div className="max-w-7xl mx-auto px-4 py-8">

            {/* Hero Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] sm:text-[11px] text-[#0072CE] font-extrabold uppercase tracking-wider mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>STATEWIDE GRID ACTIVE — 31 LIVE CAMERAS STREAMING</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mb-2 leading-tight">
                Centralised CCTV Surveillance & Command Grid
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto">
                Official portal for Gujarat Police, Home Department & 33 District Collectorates.
              </p>
            </div>

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-2xl overflow-hidden shadow-xl mb-8 border border-slate-200">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onNavigateToLogin(card.id)}
                  className="relative group overflow-hidden text-left border border-slate-200 bg-slate-900 transition-all duration-300"
                  style={{ minHeight: 250 }}
                >
                  {/* Background Image */}
                  <div className="absolute inset-0">
                    <img
                      src={card.img}
                      alt={card.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/30"></div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-between p-5">
                    <div>
                      <div className="inline-block px-2.5 py-1 bg-[#0072CE] text-white text-[9px] font-extrabold uppercase tracking-wider rounded-md mb-2 shadow">
                        {card.count}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white font-black text-base sm:text-lg leading-tight mb-1">{card.title.toUpperCase()}</h3>
                      <p className="text-slate-300 text-[11px] mb-2">{card.desc}</p>
                      <div className="flex items-center space-x-1.5 text-amber-400 text-[11px] font-bold group-hover:text-white transition">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Secure Official Login</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Live Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {STATS.map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.color + '15' }}>
                    <s.icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{s.value}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ══ SECTION 2: ABOUT Z-TRACS ══ */}
        <section id="about" className="scroll-mt-28 bg-slate-50 border-y border-slate-200 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-xs font-black text-[#0072CE] uppercase tracking-widest mb-1">GOVERNMENT OF GUJARAT MANDATE</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">About Z-TRACS Surveillance Platform</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Z-TRACS (Zonal Traffic & Road Asset Command System) integrates thousands of municipal, highway, and police cameras into a single, real-time command dashboard with AI-driven ANPR and court-admissible evidence hash chains.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-[#0072CE] flex items-center justify-center mb-4">
                  <Layers className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-slate-900 mb-2">Centralised VMS Federation</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Connects disparate city VMS installations (Milestone, Hikvision, Dahua, Honeywell) across 33 districts into a unified state-wide telemetry grid.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-slate-900 mb-2">SHA-256 Chain of Custody</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Every video export and camera log is cryptographically signed with Merkle Tree hash verification ensuring strict court admissibility for investigations.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mb-4">
                  <Cpu className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-slate-900 mb-2">Real-Time ANPR Intelligence</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Processes 8,000+ daily vehicle detections with instant hotlist alert matching against stolen, suspect, and wanted vehicle databases.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECTION 3: CAMERA NETWORK ══ */}
        <section id="camera-network" className="scroll-mt-28 py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <h2 className="text-xs font-black text-[#0072CE] uppercase tracking-widest mb-1">CCTV ARCHITECTURE</h2>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900">Statewide Camera Network</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full text-xs font-extrabold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>12,482 Active Nodes</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="inline-block px-2.5 py-1 bg-[#0072CE] text-white text-[10px] font-black uppercase tracking-wider rounded mb-3">MODEL 1</div>
                  <h4 className="text-lg font-black mb-2">Live CCTV Stream Wall</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mb-4">
                    High-definition RTSP / H.265 ingestion with multi-camera layout grids, PTZ joystick controls, and district filter scopes.
                  </p>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 font-mono">
                  Ingestion: RTSP / WebRTC (60 FPS)
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="inline-block px-2.5 py-1 bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider rounded mb-3">MODEL 2</div>
                  <h4 className="text-lg font-black mb-2">ANPR & 3D Journey Engine</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mb-4">
                    Automatic license plate recognition with spatial 3D path plotting across highway toll gates and city entry checkpoints.
                  </p>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 font-mono">
                  OCR Engine: 99.4% Recognition Rate
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="inline-block px-2.5 py-1 bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded mb-3">MODEL 3</div>
                  <h4 className="text-lg font-black mb-2">VMS Edge Federation</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mb-4">
                    Decentralized edge servers handling local buffering, failover playback, and automated heartbeat health telemetry.
                  </p>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 font-mono">
                  Edge Uptime: 99.98% SLA
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECTION 4: DISTRICTS & COVERAGE ══ */}
        <section id="districts" className="scroll-mt-28 py-12 bg-slate-50 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-xs font-black text-[#0072CE] uppercase tracking-widest mb-1">STATEWIDE JURISDICTION</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">33 Districts Coverage Directory</h3>
              <p className="text-slate-600 text-xs sm:text-sm">
                All 33 Collectorates & District Police Headquarters integrated into the central Z-TRACS WAN.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {DISTRICT_LIST.map((d) => (
                <div key={d.name} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-[#0072CE] transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-slate-900 text-sm">{d.name}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black">{d.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-1 flex items-center space-x-1">
                    <Camera className="w-3.5 h-3.5 text-[#0072CE]" />
                    <span><strong className="text-slate-800">{d.cameras}</strong> Active Cameras</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Hub: {d.hub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ SECTION 5: ANPR ANALYTICS ══ */}
        <section id="anpr-analytics" className="scroll-mt-28 py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-extrabold uppercase tracking-wider mb-3 inline-block">
                  AI INTELLIGENCE MODULE
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4">
                  Automatic Number Plate Recognition (ANPR) & Hotlist Alerts
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                  Z-TRACS ANPR Engine processes live high-speed vehicle captures across all state highways and city toll gates. Instant cross-matching against police hotlists triggers audio-visual alarms in control rooms.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-slate-900">Instant Stolen Vehicle Match</div>
                      <div className="text-[11px] text-slate-500">Triggers alert notifications within 400 milliseconds of capture.</div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-slate-900">3D Vehicle Journey Plotting</div>
                      <div className="text-[11px] text-slate-500">Maps chronological camera hit locations with speed estimates across time checkpoints.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-purple-400" />
                    <span className="font-mono text-xs font-bold">LIVE ANPR STREAM DEMO</span>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded text-[10px] font-bold animate-pulse">
                    HOTLIST DETECTED
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 bg-slate-800/90 rounded-lg border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-amber-400 font-bold">GJ-01-AB-1234</div>
                      <div className="text-[10px] text-slate-400">Location: SG Highway, Ahmedabad</div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">Stolen Hotlist</span>
                  </div>

                  <div className="p-3 bg-slate-800/90 rounded-lg border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-emerald-400 font-bold">GJ-05-XY-9876</div>
                      <div className="text-[10px] text-slate-400">Location: Ring Road, Surat</div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">Verified Clean</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECTION 6: REPORTS & DATA ══ */}
        <section id="reports-data" className="scroll-mt-28 py-12 bg-slate-50 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-xs font-black text-[#0072CE] uppercase tracking-widest mb-1">AUDIT & COMPLIANCE</h2>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Official Reports & Evidence Audit</h3>
              <p className="text-slate-600 text-xs sm:text-sm">
                Cryptographically audited reports, DPR gap analysis, and camera uptime ledgers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <FileSpreadsheet className="w-8 h-8 text-[#0072CE] mb-3" />
                <h4 className="font-black text-slate-900 text-base mb-1">DPR Gap Analysis Report</h4>
                <p className="text-slate-500 text-xs mb-3">Detailed project report breaking down junction coverage gaps across 33 districts.</p>
                <span className="text-[11px] font-bold text-[#0072CE] hover:underline cursor-pointer flex items-center space-x-1" onClick={() => onNavigateToLogin('STATE_ADMIN')}>
                  <span>View Full DPR</span> <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <Shield className="w-8 h-8 text-emerald-600 mb-3" />
                <h4 className="font-black text-slate-900 text-base mb-1">Immutable Audit Ledger</h4>
                <p className="text-slate-500 text-xs mb-3">SHA-256 Merkle chain recording every user query, export, and config modification.</p>
                <span className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center space-x-1" onClick={() => onNavigateToLogin('STATE_ADMIN')}>
                  <span>Verify Ledger Hash</span> <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <BarChart3 className="w-8 h-8 text-purple-600 mb-3" />
                <h4 className="font-black text-slate-900 text-base mb-1">Uptime & Health SLA</h4>
                <p className="text-slate-500 text-xs mb-3">Real-time telemetry reports tracking camera video loss, network dropouts, and maintenance tickets.</p>
                <span className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer flex items-center space-x-1" onClick={() => onNavigateToLogin('STATE_ADMIN')}>
                  <span>View SLA Analytics</span> <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECTION 7: HELP & SUPPORT ══ */}
        <section id="help-support" className="scroll-mt-28 py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-10">

            {/* FAQ */}
            <div>
              <h2 className="text-xs font-black text-[#0072CE] uppercase tracking-widest mb-1">HELP & SUPPORT DESK</h2>
              <h3 className="text-2xl font-black text-slate-900 mb-4">Frequently Asked Questions</h3>
              <div className="space-y-2">
                {FAQ_ITEMS.map((f, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${openFaq === i ? 'bg-[#00253E] text-white' : 'hover:bg-slate-50 text-slate-800'}`}
                    >
                      <span className="text-xs font-semibold pr-2">{f.q}</span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                    </button>
                    {openFaq === i && (
                      <div className="px-4 py-3 text-xs text-slate-600 leading-relaxed bg-blue-50 border-t border-blue-100">
                        {f.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Helpline & Manuals */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Nodal Officer Helplines</h3>
                <div className="grid grid-cols-2 gap-3">
                  {QUICK_LINKS.map(ql => (
                    <div key={ql.label} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: ql.color + '15', color: ql.color }}>
                        <ql.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{ql.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{ql.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Official User Manual Downloads</h3>
                <div className="space-y-2">
                  {USER_MANUALS.map(m => (
                    <div
                      key={m.title}
                      className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-[#0072CE] transition cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#00253E] text-white flex items-center justify-center shrink-0">
                        <m.icon className="w-4 h-4 text-[#0072CE]" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 flex-1">{m.title}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* PARTNER LOGOS */}
        <div className="bg-slate-50 border-y border-slate-200 py-6">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-center flex-wrap gap-4 sm:gap-8">
              {PARTNER_LOGOS.map(p => (
                <div key={p.name} className="flex flex-col items-center space-y-1 group cursor-pointer">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-xs group-hover:border-[#0072CE] transition">
                    <span className="text-[10px] font-black text-slate-600 group-hover:text-[#0072CE] transition text-center leading-tight">{p.abbr}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 text-center max-w-[60px] leading-tight">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>

      {/* ══ FOOTER ══ */}
      <footer className="bg-[#001D31] text-slate-300">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00253E] border border-[#00385C] p-2 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#0072CE]" />
              </div>
              <div>
                <div className="text-white font-black text-base">Z-TRACS GRID</div>
                <div className="text-slate-400 text-[10px]">Govt. of Gujarat</div>
              </div>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Official Centralised CCTV Surveillance & ANPR Intelligence Grid for Gujarat Police & Department of Home.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Portal Navigation</h4>
            <ul className="space-y-2">
              {NAV_ITEMS.slice(0, 4).map(item => (
                <li key={item.id}>
                  <button onClick={() => scrollToSection(item.id)} className="text-slate-400 hover:text-white text-[11px] transition">
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Intelligence & Audits</h4>
            <ul className="space-y-2">
              {NAV_ITEMS.slice(4).map(item => (
                <li key={item.id}>
                  <button onClick={() => scrollToSection(item.id)} className="text-slate-400 hover:text-white text-[11px] transition">
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Contact & Support</h4>
            <ul className="space-y-2 text-[11px] text-slate-400">
              <li>📍 Police HQ, Sector 18, Gandhinagar</li>
              <li>📞 Helpline: 1800-233-5500</li>
              <li>📧 support@ztracsgujarat.gov.in</li>
              <li className="pt-1">
                <span className="px-2 py-0.5 bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 rounded text-[10px] font-bold">STATE WAN CONNECTED</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#00385C] bg-[#001524] py-3">
          <div className="flex h-1 w-full mb-3">
            <div className="flex-1" style={{ background: '#FF9933' }}></div>
            <div className="flex-1 bg-white"></div>
            <div className="flex-1" style={{ background: '#138808' }}></div>
          </div>
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500 text-center sm:text-left">
            <span>© 2026 Gujarat Police Department & Government of Gujarat. All rights reserved.</span>
            <div className="flex items-center justify-center space-x-3">
              <span>Privacy Policy</span> | <span>Terms of Use</span> | <span>Accessibility</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
