// Canonical Schemas for Z-TRACS Model 3 VMS Federation

export interface CanonicalCapability {
  liveStream: boolean;
  playback: boolean;
  snapshot: boolean;
  ptz: boolean;
  audio: boolean;
  twoWayAudio: boolean;
  anpr: boolean;
  events: boolean;
  recording: boolean;
}

export interface CanonicalVms {
  zeexVmsId: string;
  vendorVmsId: string;
  vendor: string;
  systemName: string;
  version: string;
  departmentId: string;
  departmentName: string;
  district: string;
  endpoint: string;
  protocol: 'ONVIF Profile S' | 'ONVIF Profile T' | 'Genetec REST API' | 'Axis Webhook' | 'RTSP Native';
  connectorId: string;
  status: 'Operational' | 'Degraded' | 'Offline';
  capabilities: CanonicalCapability;
  cameraCount: number;
  lastSyncTimestamp: string;
  healthScore: number;
  createdTimestamp: string;
  updatedTimestamp: string;
}

export interface CanonicalConnector {
  connectorId: string;
  vendor: string;
  protocol: string;
  adapterVersion: string;
  status: 'ACTIVE' | 'DEGRADED' | 'OFFLINE';
  certificationStatus: 'CERTIFIED' | 'COMMUNITY' | 'EXPERIMENTAL';
  supportedCapabilities: string[];
  lastHeartbeat: string;
  latencyMs: number;
  errorCount: number;
  reconnectCount: number;
  activeSessions: number;
}

export interface CanonicalEventSource {
  departmentId: string;
  vmsId: string;
  cameraId: string;
  cameraCode: string;
  connectorId: string;
}

export interface CanonicalLocation {
  latitude: number;
  longitude: number;
  district: string;
  locationDescription: string;
}

export interface CanonicalEventDetection {
  objectType: 'vehicle' | 'person' | 'license_plate' | 'perimeter_breach' | 'camera_tamper';
  confidence: number;
}

export interface CanonicalVehicle {
  plateNumber: string;
  plateConfidence: number;
  vehicleType: 'Car' | 'SUV' | 'Truck' | 'Motorcycle' | 'Bus' | 'Auto';
  color: string;
  speedKmh: number;
  direction: 'Northbound' | 'Southbound' | 'Eastbound' | 'Westbound';
  watchlistFlag: boolean;
  watchlistReason?: string;
  imageCropUrl: string;
  vehicleImageUrl: string;
}

export interface CanonicalEvent {
  eventId: string;
  eventType: 'ANPR_DETECTED' | 'VEHICLE_DETECTED' | 'CAMERA_HEALTH_CHANGED' | 'VMS_STATUS_CHANGED' | 'SECURITY_ALERT';
  schemaVersion: '1.0';
  timestamp: string;
  source: CanonicalEventSource;
  location: CanonicalLocation;
  detection: CanonicalEventDetection;
  vehicle?: CanonicalVehicle;
  rawPayload?: Record<string, any>;
  processedAt?: string;
}

export interface DlqEventRecord {
  dlqId: string;
  eventId: string;
  failedTimestamp: string;
  retryCount: number;
  lastErrorReason: string;
  sourceVmsId: string;
  connectorId: string;
  rawPayload: Record<string, any>;
  status: 'FAILED' | 'REPLAY_PENDING' | 'REPLAYED' | 'DISCARDED';
}

export interface TopologyEdge {
  fromCameraCode: string;
  toCameraCode: string;
  distanceKm: number;
  expectedTravelTimeMins: number;
  corridorName: string;
}
