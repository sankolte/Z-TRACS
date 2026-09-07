from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Model 1 Schemas
class ResponsibleOfficerSchema(BaseModel):
    name: str
    designation: str
    phone: str
    email: str

class CameraCapabilitiesSchema(BaseModel):
    anpr: bool = True
    vehicleDetection: bool = True
    personDetection: bool = True
    edgeAI: bool = True
    otherAnalytics: List[str] = ["Speed Radar"]

class CameraMasterRecordSchema(BaseModel):
    cameraUuid: str
    cameraCode: str
    name: str
    type: str
    lifecycle: str
    healthStatus: str
    latitude: float
    longitude: float
    address: str
    city: str
    district: str
    departmentId: str
    departmentName: str
    owner: str
    responsibleOfficer: ResponsibleOfficerSchema
    manufacturer: str
    model: str
    firmwareVersion: str
    resolution: str
    ptzSupport: bool
    installationDate: str
    networkType: str
    vmsPlatformId: str
    vmsPlatformName: str
    protocol: str
    endpointReference: str
    storageType: str
    retentionDays: int
    capabilities: CameraCapabilitiesSchema
    lastHeartbeat: str
    fps: int = 25
    bitrate: int = 4096
    availability: float = 99.8
    deviceHealth: str = "Nominal"
    createdAt: str
    createdBy: str
    updatedAt: str
    updatedBy: str

# Model 3 Canonical Schemas
class CanonicalCapabilitySchema(BaseModel):
    liveStream: bool = True
    playback: bool = True
    snapshot: bool = True
    ptz: bool = True
    audio: bool = True
    twoWayAudio: bool = False
    anpr: bool = True
    events: bool = True
    recording: bool = True

class CanonicalVmsSchema(BaseModel):
    zeexVmsId: str
    vendorVmsId: str
    vendor: str
    systemName: str
    version: str
    departmentId: str
    departmentName: str
    district: str
    endpoint: str
    protocol: str
    connectorId: str
    status: str
    capabilities: CanonicalCapabilitySchema
    cameraCount: int
    lastSyncTimestamp: str
    healthScore: int
    createdTimestamp: str
    updatedTimestamp: str

class CanonicalConnectorSchema(BaseModel):
    connectorId: str
    vendor: str
    protocol: str
    adapterVersion: str
    status: str
    certificationStatus: str
    supportedCapabilities: List[str]
    lastHeartbeat: str
    latencyMs: int
    errorCount: int
    reconnectCount: int
    activeSessions: int

class CanonicalEventSourceSchema(BaseModel):
    departmentId: str
    vmsId: str
    cameraId: str
    cameraCode: str
    connectorId: str

class CanonicalLocationSchema(BaseModel):
    latitude: float
    longitude: float
    district: str
    locationDescription: str

class CanonicalEventDetectionSchema(BaseModel):
    objectType: str
    confidence: float

class CanonicalVehicleSchema(BaseModel):
    plateNumber: str
    plateConfidence: float
    vehicleType: str
    color: str
    speedKmh: float
    direction: str
    watchlistFlag: bool
    watchlistReason: Optional[str] = None
    imageCropUrl: str
    vehicleImageUrl: str

class CanonicalEventSchema(BaseModel):
    eventId: str
    eventType: str
    schemaVersion: str = "1.0"
    timestamp: str
    source: CanonicalEventSourceSchema
    location: CanonicalLocationSchema
    detection: CanonicalEventDetectionSchema
    vehicle: Optional[CanonicalVehicleSchema] = None
    rawPayload: Optional[Dict[str, Any]] = None
    processedAt: Optional[str] = None

class DlqEventRecordSchema(BaseModel):
    dlqId: str
    eventId: str
    failedTimestamp: str
    retryCount: int
    lastErrorReason: str
    sourceVmsId: str
    connectorId: str
    rawPayload: Dict[str, Any]
    status: str

# Model 2 Schemas
class SystemAlertSchema(BaseModel):
    id: str
    title: str
    severity: str
    category: str
    status: str
    timestamp: str
    cameraUuid: str
    cameraCode: str
    cameraName: str
    district: str
    plateNumber: Optional[str] = None
    assignedTo: Optional[str] = None
    acknowledgedBy: Optional[str] = None
    notes: Optional[str] = None

class EvidenceItemSchema(BaseModel):
    id: str
    caseId: str
    cameraUuid: str
    cameraCode: str
    timestamp: str
    eventType: str
    sha256Hash: str
    fileSize: str
    verifiedBy: str
    createdDate: str

class InvestigationCaseSchema(BaseModel):
    id: str
    title: str
    plateNumber: str
    status: str
    priority: str
    leadOfficer: str
    badge: str
    department: str
    createdDate: str
    evidenceCount: int
    timelineEvents: List[Any] = []
    evidenceItems: List[EvidenceItemSchema] = []
    caseNotes: List[str] = []
