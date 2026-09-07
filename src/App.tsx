import React, { useState, useEffect } from 'react';
import { 
  INITIAL_CAMERAS, 
  INITIAL_DEPARTMENTS, 
  INITIAL_DISTRICTS, 
  INITIAL_HEALTH_EVENTS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_GAP_AREAS,
  INITIAL_VMS_REFERENCES,
  INITIAL_ANPR_EVENTS,
  INITIAL_ALERTS,
  INITIAL_INVESTIGATIONS,
  INITIAL_VMS_LIST,
  INITIAL_CONNECTORS,
  INITIAL_CANONICAL_EVENTS
} from './data/mockData';
import { 
  Camera, 
  Department, 
  District, 
  HealthEvent, 
  AuditLog, 
  Language, 
  User, 
  AnprEvent, 
  SystemAlert, 
  InvestigationCase,
  CanonicalVms,
  CanonicalConnector,
  CanonicalEvent
} from './types';
import { RBACProvider, useRBAC } from './context/RBACContext';
import { ApiClient } from './services/apiClient';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OverviewView } from './components/OverviewView';
import { CctvGisView } from './components/CctvGisView';
import { CameraRegistryView } from './components/CameraRegistryView';
import { OnboardingView } from './components/OnboardingView';
import { HealthMonitoringView } from './components/HealthMonitoringView';
import { DetectionAreaView } from './components/DetectionAreaView';
import { DepartmentsView } from './components/DepartmentsView';
import { DistrictsView } from './components/DistrictsView';
import { GapAnalysisView } from './components/GapAnalysisView';
import { ReportsView } from './components/ReportsView';
import { AuditLogsView } from './components/AuditLogsView';
import { AdministrationView } from './components/AdministrationView';
import { CameraDetailModal } from './components/CameraDetailModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { SystemStatusOverlay } from './components/SystemStatusOverlay';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { LoginView } from './components/LoginView';
import { LandingPage } from './components/LandingPage';

// Model 2 Feature Views
import { CommandCenterView } from './components/CommandCenterView';
import { AnprSearchView } from './components/AnprSearchView';
import { VehicleJourneyView } from './components/VehicleJourneyView';
import { AlertCenterView } from './components/AlertCenterView';
import { InvestigationView } from './components/InvestigationView';

// Sentinel Gujarat Live Wall
import { SentinelLiveWallView } from './components/SentinelLiveWallView';
import { AiModelsView } from './components/AiModelsView';
import { FaceRecognitionView } from './components/FaceRecognitionView';
import { ForensicAnalysisView } from './components/ForensicAnalysisView';

// Model 3 Feature Views
import { FederationOverviewView } from './components/model3/FederationOverviewView';
import { VmsManagementView } from './components/model3/VmsManagementView';
import { ConnectorRegistryView } from './components/model3/ConnectorRegistryView';
import { EventPipelineView } from './components/model3/EventPipelineView';

function MainApp() {
  const { currentUser, currentRole } = useRBAC();

  // Helper to parse state from URL hash or localStorage
  const parseNavState = () => {
    const hash = window.location.hash.replace('#', '');
    let screen: 'landing' | 'login' | 'dashboard' = 'landing';
    let tab = 'overview';

    if (hash) {
      const parts = hash.split('/');
      if (parts[0] === 'dashboard') {
        screen = 'dashboard';
        if (parts[1]) tab = parts[1];
      } else if (parts[0] === 'login') {
        screen = 'login';
      } else if (parts[0] === 'landing') {
        screen = 'landing';
      }
    } else {
      try {
        const savedScreen = localStorage.getItem('ztracs_screen') as any;
        const savedTab = localStorage.getItem('ztracs_tab');
        if (savedScreen && ['landing', 'login', 'dashboard'].includes(savedScreen)) {
          screen = savedScreen;
        }
        if (savedTab) tab = savedTab;
      } catch (_) {}
    }
    return { screen, tab };
  };

  const initialNav = parseNavState();
  const [appScreen, setAppScreenState] = useState<'landing' | 'login' | 'dashboard'>(initialNav.screen);
  const [activeTab, setActiveTabState] = useState<string>(initialNav.tab);
  const [loginRoleHint, setLoginRoleHint] = useState<string | undefined>(undefined);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sync state changes with localStorage and URL Hash
  const setAppScreen = (screen: 'landing' | 'login' | 'dashboard') => {
    setAppScreenState(screen);
    try {
      localStorage.setItem('ztracs_screen', screen);
      window.location.hash = screen === 'dashboard' ? `dashboard/${activeTab}` : screen;
    } catch (_) {}
  };

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('ztracs_tab', tab);
      if (appScreen === 'dashboard') {
        window.location.hash = `dashboard/${tab}`;
      }
    } catch (_) {}
  };

  // Sync state on hash change / browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const nav = parseNavState();
      setAppScreenState(nav.screen);
      setActiveTabState(nav.tab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global Application State
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Cross-module filter & vehicle journey state
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('ALL');
  const [selectedPlateForJourney, setSelectedPlateForJourney] = useState<string>('GJ01AB1234');
  const [selectedConfigCamCode, setSelectedConfigCamCode] = useState<string>('CAM-001');

  // Master State Store (Model 1 + Model 2 + Model 3)
  const [cameras, setCameras] = useState<Camera[]>(INITIAL_CAMERAS);
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [districts, setDistricts] = useState<District[]>(INITIAL_DISTRICTS);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>(INITIAL_HEALTH_EVENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [anprEvents, setAnprEvents] = useState<AnprEvent[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [cases, setCases] = useState<InvestigationCase[]>(INITIAL_INVESTIGATIONS);

  // Model 3 Federation State
  const [vmsList, setVmsList] = useState<CanonicalVms[]>(INITIAL_VMS_LIST);
  const [connectors, setConnectors] = useState<CanonicalConnector[]>(INITIAL_CONNECTORS);
  const [canonicalEvents, setCanonicalEvents] = useState<CanonicalEvent[]>(INITIAL_CANONICAL_EVENTS);

  // Modals & Drawers State
  const [selectedCameraForDetail, setSelectedCameraForDetail] = useState<Camera | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSystemStatusOpen, setIsSystemStatusOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Live Dynamic AWS Backend Integration
  useEffect(() => {
    let isMounted = true;
    const fetchLiveBackendData = async () => {
      try {
        const liveCams = await ApiClient.getCameras({ lat: 23.0225, lng: 72.5714, radius: 50000 });
        if (isMounted && liveCams && liveCams.length > 0) {
          setCameras(prev => {
            const existingCodes = new Set(prev.map(c => c.cameraCode));
            const newCams = liveCams.filter(c => !existingCodes.has(c.cameraCode));
            return [...newCams, ...prev];
          });
        }
      } catch (err) {
        console.warn('[App] Live backend fetch error, retaining initial dataset:', err);
      }
    };
    fetchLiveBackendData();
    return () => { isMounted = false; };
  }, []);

  // ─── Real-Time ANPR Alert Integration ───────────────────────────────────
  useEffect(() => {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    // On HTTPS (Vercel), poll using relative /api/v1/anpr/alerts/live to avoid Mixed Content errors.
    // On HTTP (Local dev), use http://43.204.235.231:8000
    const API_POLL_URL = isHttps 
      ? '/api/v1/anpr/alerts/live?limit=6000' 
      : 'http://43.204.235.231:8000/api/v1/anpr/alerts/live?limit=6000';

    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const injectAlert = (a: any) => {
      if (!isMounted) return;
      setAlerts(prev => {
        if (prev.find(x => x.id === a.id)) return prev;
        const newAlert: SystemAlert = {
          id: a.id,
          title: a.title || `ANPR Alert: ${a.plateNumber || a.number_plate || ''}`,
          severity: (a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'HIGH' ? 'HIGH' : 'MEDIUM') as any,
          category: a.category || 'ANPR_DETECTION',
          status: a.status || 'NEW',
          timestamp: a.timestamp || a.receivedAt || new Date().toISOString(),
          cameraUuid: a.cameraUuid || '',
          cameraCode: a.cameraCode || '',
          cameraName: a.cameraName || '',
          district: a.district || 'Unknown',
          plateNumber: a.plateNumber || a.number_plate || undefined,
          notes: a.notes || '',
          snapshot: a.snapshot || a.imageCropUrl || undefined,
        };
        return [newAlert, ...prev];
      });
    };

    // 1. WebSocket — connect only on plain HTTP to avoid HTTPS Mixed Content block
    if (!isHttps) {
      const connectWs = () => {
        try {
          ws = new WebSocket('ws://43.204.235.231:8000/ws/alerts');
          ws.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data);
              if (msg.type === 'ANPR_ALERT' && msg.payload) injectAlert(msg.payload);
            } catch (_) {}
          };
          ws.onerror = () => { try { ws?.close(); } catch (_) {} };
          ws.onclose = () => { if (isMounted) setTimeout(connectWs, 4000); };
        } catch (_) {}
      };
      connectWs();
    }

    // 2. Polling /alerts/live every 3s — returns ALL alerts (test + real ANPR from RDS)
    const pollAlerts = async () => {
      try {
        const res = await fetch(API_POLL_URL);
        if (!res.ok) return;
        const json = await res.json();
        const items: any[] = Array.isArray(json.data) ? json.data : [];
        if (items.length === 0) return;

        const fetchedAlerts: SystemAlert[] = items.map((a: any) => ({
          id: String(a.id),
          title: a.title || `ANPR Alert: ${a.plateNumber || a.number_plate || a.plate || ''}`,
          severity: (a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'HIGH' ? 'HIGH' : 'MEDIUM') as any,
          category: a.category || 'ANPR_DETECTION',
          status: a.status || 'NEW',
          timestamp: a.timestamp || a.receivedAt || new Date().toISOString(),
          cameraUuid: a.cameraUuid || '',
          cameraCode: a.cameraCode || '',
          cameraName: a.cameraName || '',
          district: a.district || 'Unknown',
          plateNumber: a.plateNumber || a.number_plate || a.plate || undefined,
          notes: a.notes || '',
          snapshot: a.snapshot || a.imageCropUrl || undefined,
        }));

        setAlerts(prev => {
          const apiIds = new Set(fetchedAlerts.map(x => x.id));
          const localExtra = prev.filter(x => !apiIds.has(x.id));
          return [...fetchedAlerts, ...localExtra];
        });
      } catch (err) {
        console.warn('[App] pollAlerts error:', err);
      }
    };
    pollAlerts();
    pollTimer = setInterval(pollAlerts, 3000);

    return () => {
      isMounted = false;
      if (ws) { try { ws.close(); } catch (_) {} }
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  // Cross-Module Action Handlers
  const handleAddCamera = (newCam: Camera) => {
    setCameras(prev => [newCam, ...prev]);
    const newLog: AuditLog = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: {
        name: currentUser.name,
        badge: currentUser.badge,
        role: currentRole,
        avatar: currentUser.avatar,
      },
      action: 'CREATE_CAMERA',
      resource: `${newCam.cameraCode} (${newCam.name})`,
      district: newCam.district,
      result: 'Success',
      ip: '10.142.1.25 (State WAN)',
      diffPayload: [
        { field: 'camera_code', before: 'null', after: newCam.cameraCode },
        { field: 'lifecycle', before: 'null', after: newCam.lifecycle },
        { field: 'department', before: 'null', after: newCam.departmentName },
      ],
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleMarkMaintenance = (cameraUuid: string) => {
    setCameras(prev => prev.map(c => {
      if (c.cameraUuid === cameraUuid) {
        return {
          ...c,
          lifecycle: 'MAINTENANCE',
          healthStatus: 'OFFLINE',
          deviceHealth: 'Signal Lost',
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updatedBy: `${currentUser.name}`,
        };
      }
      return c;
    }));

    const targetCam = cameras.find(c => c.cameraUuid === cameraUuid);
    const newLog: AuditLog = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: {
        name: currentUser.name,
        badge: currentUser.badge,
        role: currentRole,
        avatar: currentUser.avatar,
      },
      action: 'MARK_MAINTENANCE',
      resource: targetCam ? targetCam.cameraCode : cameraUuid,
      district: targetCam?.district || 'Statewide',
      result: 'Success',
      ip: '10.142.1.25 (State WAN)',
      diffPayload: [
        { field: 'lifecycle', before: targetCam?.lifecycle || 'ACTIVE', after: 'MAINTENANCE' },
        { field: 'health_status', before: targetCam?.healthStatus || 'ONLINE', after: 'OFFLINE' },
      ],
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleArchiveCamera = (cameraUuid: string) => {
    setCameras(prev => prev.map(c => {
      if (c.cameraUuid === cameraUuid) {
        return {
          ...c,
          lifecycle: 'ARCHIVED',
          archivedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          archiveReason: 'Decommissioned by State Administrator',
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updatedBy: currentUser.name,
        };
      }
      return c;
    }));

    const targetCam = cameras.find(c => c.cameraUuid === cameraUuid);
    const newLog: AuditLog = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: {
        name: currentUser.name,
        badge: currentUser.badge,
        role: currentRole,
        avatar: currentUser.avatar,
      },
      action: 'ARCHIVE_CAMERA',
      resource: targetCam ? targetCam.cameraCode : cameraUuid,
      district: targetCam?.district || 'Statewide',
      result: 'Success',
      ip: '10.142.1.25 (State WAN)',
      diffPayload: [
        { field: 'lifecycle', before: targetCam?.lifecycle || 'ACTIVE', after: 'ARCHIVED' },
      ],
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleRestoreCamera = (cameraUuid: string) => {
    setCameras(prev => prev.map(c => {
      if (c.cameraUuid === cameraUuid) {
        return {
          ...c,
          lifecycle: 'ACTIVE',
          healthStatus: 'ONLINE',
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updatedBy: currentUser.name,
        };
      }
      return c;
    }));

    const targetCam = cameras.find(c => c.cameraUuid === cameraUuid);
    const newLog: AuditLog = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: {
        name: currentUser.name,
        badge: currentUser.badge,
        role: currentRole,
        avatar: currentUser.avatar,
      },
      action: 'RESTORE_CAMERA',
      resource: targetCam ? targetCam.cameraCode : cameraUuid,
      district: targetCam?.district || 'Statewide',
      result: 'Success',
      ip: '10.142.1.25 (State WAN)',
      diffPayload: [
        { field: 'lifecycle', before: 'ARCHIVED', after: 'ACTIVE' },
      ],
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'ACKNOWLEDGED', acknowledgedBy: currentUser.name } : a));
  };

  const handleResolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'RESOLVED' } : a));
  };

  const handleDeleteAlert = async (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const API_DELETE_URL = isHttps 
        ? `/api/v1/anpr/alerts/${alertId}` 
        : `http://43.204.235.231:8000/api/v1/anpr/alerts/${alertId}`;
      await fetch(API_DELETE_URL, { method: 'DELETE' });
    } catch (err) {
      console.warn('[App] Delete alert error:', err);
    }
  };

  if (appScreen === 'landing') {
    return (
      <LandingPage
        onNavigateToLogin={(hint) => {
          setLoginRoleHint(hint);
          setAppScreen('login');
        }}
      />
    );
  }

  if (appScreen === 'login') {
    return (
      <LoginView
        defaultRoleHint={loginRoleHint}
        onBack={() => setAppScreen('landing')}
        onLoginSuccess={(loggedInUser) => {
          setAppScreen('dashboard');
          if (loggedInUser.role === 'CONTROL_ROOM_OPERATOR') {
            setActiveTab('command-center');
          } else if (loggedInUser.role === 'POLICE_OFFICER') {
            setActiveTab('anpr-search');
          } else {
            setActiveTab('overview');
          }
        }}
      />
    );
  }

  return (
    <div className="h-screen bg-[#F4F6F9] text-slate-900 flex flex-row font-sans selection:bg-[#0052CC] selection:text-white overflow-hidden">

      {/* LEFT: Vertical Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentLang={currentLang}
        healthAlertsCount={healthEvents.filter(e => !e.resolved).length}
        activeAlertsCount={alerts.filter(a => a.status === 'NEW' && (a.category === 'WATCHLIST_MATCH' || a.category === 'WATCHLIST_HIT' || a.severity === 'CRITICAL' || a.title.toLowerCase().includes('watchlist'))).length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* RIGHT: Top Header + Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Slim Header Bar */}
        <Header
          currentLang={currentLang}
          onLanguageChange={setCurrentLang}
          unreadAlertsCount={alerts.filter(a => a.status === 'NEW' && (a.category === 'WATCHLIST_MATCH' || a.category === 'WATCHLIST_HIT' || a.severity === 'CRITICAL' || a.title.toLowerCase().includes('watchlist'))).length}
          onToggleNotifications={() => setIsNotificationsOpen(prev => !prev)}
          onOpenSystemStatus={() => setIsSystemStatusOpen(true)}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeTab={activeTab}
          onNavigateTab={setActiveTab}
          onLogout={() => setAppScreen('landing')}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(prev => !prev)}
        />

        {/* Main Content Area Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        
        {/* MODEL 1: Overview */}
        {activeTab === 'overview' && (
          <OverviewView
            cameras={cameras}
            departments={departments}
            districts={districts}
            healthEvents={healthEvents}
            auditLogs={auditLogs}
            currentLang={currentLang}
            onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* MODEL 2: Command Center & Video Wall */}
        {activeTab === 'command-center' && (
          <CommandCenterView
            cameras={cameras}
            anprEvents={anprEvents}
            alerts={alerts}
            departments={departments}
            onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
            onNavigateTab={setActiveTab}
            onSelectAnprEvent={(evt) => {
              setSelectedPlateForJourney(evt.plateNumber);
              setActiveTab('vehicle-journey');
            }}
          />
        )}

        {/* SENTINEL GUJARAT: Unified Live CCTV Feed Wall (31 cameras) */}
        {(activeTab === 'sentinel-live-wall' || activeTab === 'live-view') && (
          <SentinelLiveWallView />
        )}

        {/* MODEL 2: ANPR Search Engine */}
        {activeTab === 'anpr-search' && (
          <AnprSearchView
            anprEvents={anprEvents}
            alerts={alerts}
            departments={departments}
            districts={districts}
            onSelectPlateForJourney={(plate) => {
              setSelectedPlateForJourney(plate);
              setActiveTab('vehicle-journey');
            }}
          />
        )}

        {/* MODEL 2: Vehicle Intelligence & Journey Tracking */}
        {activeTab === 'vehicle-journey' && (
          <VehicleJourneyView
            initialPlate={selectedPlateForJourney}
            anprEvents={anprEvents}
            alerts={alerts}
            cameras={cameras}
            onCreateInvestigationCase={(plate) => {
              setActiveTab('investigations');
            }}
          />
        )}

        {/* MODEL 2: Alert Management Center */}
        {activeTab === 'alerts' && (
          <AlertCenterView
            alerts={alerts}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
            onDeleteAlert={handleDeleteAlert}
            onNavigateToJourney={(plate) => {
              setSelectedPlateForJourney(plate);
              setActiveTab('vehicle-journey');
            }}
          />
        )}

        {/* MODEL 2: Investigations Workspace */}
        {activeTab === 'investigations' && (
          <InvestigationView
            cases={cases}
            onNavigateToJourney={(plate) => {
              setSelectedPlateForJourney(plate);
              setActiveTab('vehicle-journey');
            }}
          />
        )}

        {/* MODEL 2: Forensic Video Analysis & Offline CCTV Footage AI Ingest */}
        {activeTab === 'forensic-analysis' && (
          <ForensicAnalysisView />
        )}

        {/* MODEL 3: Federation Overview */}
        {activeTab === 'federation-overview' && (
          <FederationOverviewView
            vmsList={vmsList}
            connectors={connectors}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* MODEL 3: VMS Management */}
        {activeTab === 'vms-management' && (
          <VmsManagementView
            vmsList={vmsList}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* MODEL 3: Connector Registry */}
        {activeTab === 'connectors' && (
          <ConnectorRegistryView
            connectors={connectors}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* MODEL 3: Event Pipeline & DLQ */}
        {activeTab === 'event-flow' && (
          <EventPipelineView
            canonicalEvents={canonicalEvents}
            onNavigateToJourney={(plate) => {
              setSelectedPlateForJourney(plate);
              setActiveTab('vehicle-journey');
            }}
          />
        )}

        {/* MODEL 1: CCTV GIS Viewport */}
        {activeTab === 'gis' && (
          <CctvGisView
            cameras={cameras}
            departments={departments}
            currentLang={currentLang}
            onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
            selectedDistrictFilter={selectedDistrictFilter}
            selectedDeptFilter={selectedDeptFilter}
          />
        )}

        {/* MODEL 1: Camera Registry */}
        {activeTab === 'registry' && (
          <CameraRegistryView
            cameras={cameras}
            currentLang={currentLang}
            onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
            onNavigateToGis={(cam) => {
              setActiveTab('gis');
            }}
            onConfigureRoi={(cam) => {
              setSelectedConfigCamCode(cam.cameraCode);
              setActiveTab('detection-area');
            }}
            onConfigureAi={(cam) => {
              setSelectedConfigCamCode(cam.cameraCode);
              setActiveTab('ai-models');
            }}
            onMarkMaintenance={handleMarkMaintenance}
            onArchiveCamera={handleArchiveCamera}
            onRestoreCamera={handleRestoreCamera}
            onOpenOnboarding={() => setActiveTab('onboarding')}
            initialDeptFilter={selectedDeptFilter}
            initialDistrictFilter={selectedDistrictFilter}
          />
        )}

        {/* MODEL 1: Onboarding Wizard */}
        {activeTab === 'onboarding' && (
          <OnboardingView
            departments={departments}
            districts={districts}
            currentLang={currentLang}
            onAddCamera={handleAddCamera}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* MODEL 1: Health Monitoring */}
        {activeTab === 'health' && (
          <HealthMonitoringView
            events={healthEvents}
            cameras={cameras}
            currentLang={currentLang}
            onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
            onMarkMaintenance={handleMarkMaintenance}
          />
        )}

        {/* MODEL 1: Detection Area ROI Setup */}
        {activeTab === 'detection-area' && (
          <DetectionAreaView
            cameras={cameras}
            currentLang={currentLang}
            initialCameraCode={selectedConfigCamCode}
            onSelectCameraCode={(code) => setSelectedConfigCamCode(code)}
            onNavigateToAiModels={(code) => {
              if (code) setSelectedConfigCamCode(code);
              setActiveTab('ai-models');
            }}
          />
        )}

        {/* MODEL 1 & 2: AI Inferencing Models */}
        {activeTab === 'ai-models' && (
          <AiModelsView
            cameras={cameras}
            currentLang={currentLang}
            initialCameraCode={selectedConfigCamCode}
            onSelectCameraCode={(code) => setSelectedConfigCamCode(code)}
            onNavigateToDetectionArea={(code) => {
              if (code) setSelectedConfigCamCode(code);
              setActiveTab('detection-area');
            }}
          />
        )}

        {/* MODEL 2: Face Recognition & Suspect Search (FRS) Standalone Section */}
        {activeTab === 'face-recognition' && (
          <FaceRecognitionView
            cameras={cameras}
            onNavigateToAiModels={() => setActiveTab('ai-models')}
          />
        )}

        {/* MODEL 1: Departments */}
        {activeTab === 'departments' && (
          <DepartmentsView
            departments={departments}
            currentLang={currentLang}
            onSelectDepartment={(dept) => {
              setSelectedDeptFilter(dept.id);
              setActiveTab('registry');
            }}
          />
        )}

        {/* MODEL 1: Districts */}
        {activeTab === 'districts' && (
          <DistrictsView
            districts={districts}
            currentLang={currentLang}
            onSelectDistrict={(dist) => {
              setSelectedDistrictFilter(dist.name);
              setActiveTab('registry');
            }}
          />
        )}

        {/* MODEL 1: Gap Analysis */}
        {activeTab === 'gap-analysis' && (
          <GapAnalysisView
            gapAreas={INITIAL_GAP_AREAS}
            currentLang={currentLang}
          />
        )}

        {/* MODEL 1: Reports */}
        {activeTab === 'reports' && (
          <ReportsView
            cameras={cameras}
            departments={departments}
            districts={districts}
            alerts={alerts}
            currentLang={currentLang}
          />
        )}

        {/* MODEL 1: Immutable Audit Ledger */}
        {(activeTab === 'audit' || activeTab === 'audit-logs') && (
          <AuditLogsView
            logs={auditLogs}
            currentLang={currentLang}
          />
        )}

        {/* MODEL 1: System Administration & User Management */}
        {activeTab === 'administration' && (
          <AdministrationView
            departments={departments}
            districts={districts}
            onAddUser={(newUser) => {
              const newLog: AuditLog = {
                id: `aud-${Date.now().toString().slice(-4)}`,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                user: {
                  name: currentUser.name,
                  badge: currentUser.badge,
                  role: currentRole,
                  avatar: currentUser.avatar,
                },
                action: 'CREATE_CAMERA',
                resource: `USER: ${newUser.badge} (${newUser.name})`,
                district: newUser.district || 'Statewide',
                result: 'Success',
                ip: '10.142.1.25 (State WAN)',
                diffPayload: [
                  { field: 'role', before: 'null', after: newUser.role },
                  { field: 'email', before: 'null', after: newUser.email },
                ],
              };
              setAuditLogs(prev => [newLog, ...prev]);
            }}
          />
        )}

      </main>

      {/* Official Government Footer */}
        <footer className="bg-[#00253E] border-t border-[#00385C] text-slate-300 py-3.5 px-4 sm:px-6 select-none flex-shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Left: Official Government Department Branding */}
          <div className="flex items-center space-x-3 text-center md:text-left">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-slate-700 p-1 flex items-center justify-center shrink-0">
              <span className="text-[#0072CE] font-black text-xs">GJ</span>
            </div>
            <div>
              <div className="font-bold text-white tracking-wide">
                GUJARAT POLICE DEPARTMENT <span className="text-slate-500 font-normal">|</span> GOVERNMENT OF GUJARAT
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Centralised CCTV Infrastructure & Video Intelligence Command Center
              </div>
            </div>
          </div>

          {/* Right: Copyright */}
          <div className="text-center md:text-right text-[11px] text-slate-400">
            <div>© 2026 Government of Gujarat. All Rights Reserved.</div>
          </div>

        </div>
        </footer>

      </div> {/* end right column */}

      {/* Master Camera Detail Modal */}
      {selectedCameraForDetail && (
        <CameraDetailModal
          camera={selectedCameraForDetail}
          isOpen={true}
          onClose={() => setSelectedCameraForDetail(null)}
          onNavigateToGis={() => {
            setActiveTab('gis');
          }}
          onMarkMaintenance={handleMarkMaintenance}
          onArchiveCamera={handleArchiveCamera}
        />
      )}

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        events={healthEvents}
        onSelectEvent={(evt) => {
          setIsNotificationsOpen(false);
          const cam = cameras.find(c => c.cameraUuid === evt.cameraId || c.cameraCode === evt.cameraCode);
          if (cam) setSelectedCameraForDetail(cam);
        }}
      />

      {/* System Subsystem Status Overlay */}
      <SystemStatusOverlay
        isOpen={isSystemStatusOpen}
        onClose={() => setIsSystemStatusOpen(false)}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        cameras={cameras}
        departments={departments}
        districts={districts}
        onSelectCamera={(cam) => setSelectedCameraForDetail(cam)}
        onNavigateTab={setActiveTab}
      />

    </div>
  );
}

export default function App() {
  return (
    <RBACProvider>
      <MainApp />
    </RBACProvider>
  );
}
