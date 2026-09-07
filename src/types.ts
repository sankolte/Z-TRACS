export type Language = 'en';

export type UserRole = 
  | 'STATE_ADMIN'
  | 'DISTRICT_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'DISTRICT_OFFICER'
  | 'CONTROL_ROOM_OPERATOR'
  | 'POLICE_OFFICER'
  | 'STATE_AUDITOR';

export type CameraLifecycle = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'ACTIVE' 
  | 'MAINTENANCE' 
  | 'RETIRED' 
  | 'ARCHIVED';

export type CameraHealthStatus = 
  | 'ONLINE' 
  | 'DEGRADED' 
  | 'OFFLINE' 
  | 'UNKNOWN';

export type CameraType = 
  | 'PTZ' 
  | 'Fixed Bullet' 
  | 'Dome' 
  | 'ANPR' 
  | 'Thermal' 
  | '360 Panoramic';

export interface CameraMasterRecord {
  // Identity
  cameraUuid: string;
  cameraCode: string;
  name: string;
  type: CameraType;
  lifecycle: CameraLifecycle;
  healthStatus: CameraHealthStatus;

  // Location
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  district: string;
  taluka?: string;

  // Ownership & Governance
  departmentId: string;
  departmentName: string;
  owner: string;
  responsibleOfficer: {
    name: string;
    designation: string;
    phone: string;
    email: string;
  };

  // Technical Specifications
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  resolution: string;
  ptzSupport: boolean;
  installationDate: string;

  // Connectivity & VMS Reference (No plain rtspUrl exposed; restricted endpoint reference)
  networkType: 'Fiber WAN' | 'SWAN Leased Line' | '4G/5G Wireless' | 'Municipal LAN';
  vmsPlatformId: string;
  vmsPlatformName: string;
  protocol: 'ONVIF Profile S' | 'ONVIF Profile T' | 'Proprietary VMS Link';
  endpointReference: string;
  hls_live_url?: string;

  // Storage & Retention
  storageType: 'Local NVR' | 'Department SAN' | 'District Command NAS' | 'Edge SD';
  retentionDays: number;

  // Capability Attributes (Registry flags only — NOT functional video analytics modules)
  capabilities: {
    anpr: boolean;
    vehicleDetection: boolean;
    personDetection: boolean;
    edgeAI: boolean;
    otherAnalytics: string[];
  };

  // Health Visibility (Telemetry snapshot only — NO remote device control)
  lastHeartbeat: string;
  fps: number;
  bitrate: number;
  availability: number;
  deviceHealth: 'Nominal' | 'Jitter Detected' | 'High Latency' | 'Signal Lost';

  // Audit & Governance History
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string;
  archiveReason?: string;
}

// Backwards-compatible alias for existing views
export type Camera = CameraMasterRecord;

export interface Department {
  id: string;
  name: string;
  code: string;
  category: 'Law Enforcement' | 'Municipal' | 'Transport' | 'Urban & Infrastructure' | 'Forest & Wildlife' | 'Emergency Services';
  totalCameras: number;
  onlineCameras: number;
  degradedCameras: number;
  offlineCameras: number;
  maintenanceCameras: number;
  districtCoverage: number;
  vmsPlatforms: string[];
  nodalOfficer: {
    name: string;
    rank: string;
    phone: string;
    email: string;
    office: string;
  };
  lastSync: string;
}

export interface District {
  id: string;
  name: string;
  gujaratiName?: string;
  zone: 'North Gujarat' | 'Central Gujarat' | 'Saurashtra' | 'South Gujarat' | 'Kutch';
  headquarters: string;
  totalCameras: number;
  onlinePercentage: number;
  status: 'Nominal' | 'Warning' | 'Critical';
  coverageDensity: 'High Density' | 'Medium Density' | 'Low Coverage' | 'Critical Gap';
  healthScore: number;
  trend7d: number[];
  nodalSp: string;
  controlRoomContact: string;
  criticalGapsCount: number;
}

export interface HealthEvent {
  id: string;
  cameraId: string;
  cameraCode: string;
  cameraName: string;
  district: string;
  department: string;
  timestamp: string;
  type: 'Heartbeat Timeout' | 'Packet Loss' | 'Low FPS' | 'High Latency' | 'Firmware Jitter' | 'Stream Jitter';
  severity: 'critical' | 'warning' | 'info';
  duration: string;
  resolved: boolean;
  maintenanceFlagged?: boolean;
}

export interface User {
  id: string;
  name: string;
  badge: string;
  email: string;
  mobile?: string;
  passphrase?: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  district?: string;
  avatar: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLogin: string;
  allowedModules?: string[];
}

export type AuditActionType =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE_CAMERA'
  | 'DELETE_CAMERA'
  | 'UPDATE_METADATA'
  | 'MARK_MAINTENANCE'
  | 'BULK_IMPORT'
  | 'ARCHIVE_CAMERA'
  | 'RESTORE_CAMERA'
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'ROLE_CHANGED'
  | 'PERMISSION_CHANGED'
  | 'ROI_ZONE_SAVED'
  | 'ANPR_WATCHLIST_UPDATE'
  | 'EXPORT_REPORT'
  | 'API_SYNC'
  | 'INTEGRATION_UPDATED'
  | 'HEALTH_EVENT_ACKNOWLEDGED'
  | 'SYSTEM_CONFIG_UPDATED';

export interface AuditLog {
  id: string;
  timestamp: string;
  user: {
    name: string;
    badge: string;
    role: string;
    avatar: string;
  };
  action: AuditActionType;
  resource: string;
  district: string;
  result: 'Success' | 'Failed';
  ip: string;
  diffPayload?: {
    field: string;
    before: string | number | boolean;
    after: string | number | boolean;
  }[];
}

export interface GapArea {
  id: string;
  district: string;
  locationDescription: string;
  reason: string;
  suggestedHardware: string;
  estimatedTrafficPerDay: string;
  priority: 'High Priority' | 'Medium Priority' | 'Low Priority';
  status: 'Proposed' | 'Budget Approved' | 'Tender Issued' | 'In Progress';
  lat: number;
  lng: number;
  suggestedDepartment: string;
}

export interface VmsReference {
  id: string;
  vendor: string;
  systemName: string;
  department: string;
  cameraCount: number;
  protocol: string;
  status: 'Operational' | 'Degraded' | 'Offline';
  lastSync: string;
  integrationType: 'Registry Metadata Sync' | 'Scheduled Polling' | 'Department Webhook';
}

export interface SubsystemStatus {
  name: string;
  category: 'API' | 'Database' | 'GIS' | 'Health' | 'Import' | 'Event Bus' | 'Cache' | 'Storage';
  status: 'Operational' | 'Degraded' | 'Unavailable';
  latencyMs: number;
  uptimePercentage: number;
  lastChecked: string;
  details: string;
}

// Model 2 - Video Intelligence & ANPR Extensions
export interface AnprEvent {
  id: string;
  plateNumber: string;
  vehicleType: 'Car' | 'SUV' | 'Truck' | 'Motorcycle' | 'Bus' | 'Auto';
  color: string;
  speedKmh: number;
  confidence: number;
  plateConfidence: number;
  cameraUuid: string;
  cameraCode: string;
  cameraName: string;
  district: string;
  departmentId: string;
  departmentName: string;
  locationDescription: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  direction: 'Northbound' | 'Southbound' | 'Eastbound' | 'Westbound';
  watchlistFlag: boolean;
  watchlistReason?: string;
  imageCropUrl: string;
  vehicleImageUrl: string;
}

export interface SystemAlert {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'WATCHLIST_MATCH' | 'UNREGISTERED_PLATE' | 'SPEED_VIOLATION' | 'PERIMETER_BREACH' | 'CAMERA_OFFLINE' | 'CROWD_FORMATION' | 'ANPR_DETECTION';
  status: 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED';
  timestamp: string;
  cameraUuid: string;
  cameraCode: string;
  cameraName: string;
  district: string;
  plateNumber?: string;
  assignedTo?: string;
  acknowledgedBy?: string;
  notes?: string;
  snapshot?: string;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  cameraUuid: string;
  cameraCode: string;
  timestamp: string;
  eventType: string;
  sha256Hash: string;
  fileSize: string;
  verifiedBy: string;
  createdDate: string;
}

export interface InvestigationCase {
  id: string;
  title: string;
  plateNumber: string;
  status: 'ACTIVE' | 'PENDING_REVIEW' | 'CLOSED' | 'ARCHIVED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  leadOfficer: string;
  badge: string;
  department: string;
  createdDate: string;
  evidenceCount: number;
  timelineEvents: AnprEvent[];
  evidenceItems: EvidenceItem[];
  caseNotes: string[];
}

// Model 3 Canonical Exports
export * from './model3/schemas/canonical';



