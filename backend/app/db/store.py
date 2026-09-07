import math
from typing import List, Dict, Any, Optional

class UnifiedStore:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(UnifiedStore, cls).__new__(cls)
            cls._instance._init_store()
        return cls._instance

    def _init_store(self):
        # Initial Datasets (Model 1, Model 2, Model 3)
        self.cameras: List[Dict[str, Any]] = [
            {
                "cameraUuid": "uuid-0001-cctv-ahm",
                "cameraCode": "CAM-GJ-AHM-TRF-000001",
                "name": "SG Highway - Iscon Junction North",
                "type": "PTZ",
                "lifecycle": "ACTIVE",
                "healthStatus": "ONLINE",
                "latitude": 23.0298,
                "longitude": 72.5074,
                "address": "Iscon Cross Road, SG Highway, Satellite",
                "city": "Ahmedabad",
                "district": "Ahmedabad",
                "departmentId": "DEPT-POL-01",
                "departmentName": "Gujarat Police (Traffic Division)",
                "owner": "Gujarat Police",
                "responsibleOfficer": {
                    "name": "Insp. Vikram V. Solanki",
                    "designation": "Traffic Inspector",
                    "phone": "+91 98250 12345",
                    "email": "vikram.solanki@gujarat.gov.in"
                },
                "manufacturer": "Hikvision ONVIF",
                "model": "DS-2DF8442IXS",
                "firmwareVersion": "v5.6.5",
                "resolution": "1920x1080",
                "ptzSupport": True,
                "installationDate": "2024-03-15",
                "networkType": "Fiber WAN",
                "vmsPlatformId": "VMS-MIL-01",
                "vmsPlatformName": "XProtect Corporate Traffic Hub",
                "protocol": "ONVIF Profile S",
                "endpointReference": "onvif://ahm-traffic-cluster/device_service",
                "storageType": "Department SAN",
                "retentionDays": 30,
                "capabilities": {
                    "anpr": True,
                    "vehicleDetection": True,
                    "personDetection": True,
                    "edgeAI": True,
                    "otherAnalytics": ["Speed Radar"]
                },
                "lastHeartbeat": "2026-08-20 10:48:00 IST",
                "fps": 25,
                "bitrate": 4096,
                "availability": 99.8,
                "deviceHealth": "Nominal",
                "createdAt": "2024-03-15",
                "createdBy": "System Admin",
                "updatedAt": "2026-08-20",
                "updatedBy": "System Admin"
            },
            {
                "cameraUuid": "uuid-0002-cctv-ahm",
                "cameraCode": "CAM-GJ-AHM-MNC-000042",
                "name": "Sabarmati Riverfront Walkway West",
                "type": "Dome",
                "lifecycle": "ACTIVE",
                "healthStatus": "ONLINE",
                "latitude": 23.0372,
                "longitude": 72.5721,
                "address": "Gandhi Ashram Plaza, Riverfront Promenade",
                "city": "Ahmedabad",
                "district": "Ahmedabad",
                "departmentId": "DEPT-MNC-02",
                "departmentName": "Ahmedabad Municipal Corporation",
                "owner": "AMC Smart City",
                "responsibleOfficer": {
                    "name": "Sanjay Patel",
                    "designation": "Executive Engineer",
                    "phone": "+91 98251 67890",
                    "email": "sanjay.patel@amc.gov.in"
                },
                "manufacturer": "Axis Communications",
                "model": "Q3517-LV",
                "firmwareVersion": "v9.80",
                "resolution": "2560x1440",
                "ptzSupport": False,
                "installationDate": "2024-06-10",
                "networkType": "Municipal LAN",
                "vmsPlatformId": "VMS-GEN-02",
                "vmsPlatformName": "Security Center Omnicast AMC",
                "protocol": "Genetec REST API",
                "endpointReference": "https://amc-vms-gateway.sdc.gujarat.gov.in/api/v2",
                "storageType": "District Command NAS",
                "retentionDays": 45,
                "capabilities": {
                    "anpr": True,
                    "vehicleDetection": True,
                    "personDetection": True,
                    "edgeAI": True,
                    "otherAnalytics": ["Crowd Density"]
                },
                "lastHeartbeat": "2026-08-20 10:48:00 IST",
                "fps": 30,
                "bitrate": 6144,
                "availability": 99.9,
                "deviceHealth": "Nominal",
                "createdAt": "2024-06-10",
                "createdBy": "AMC Operator",
                "updatedAt": "2026-08-20",
                "updatedBy": "AMC Operator"
            }
        ]

        self.departments: List[Dict[str, Any]] = [
            {
                "id": "DEPT-POL-01",
                "name": "Gujarat Police (Traffic & Crime Branch)",
                "code": "POLICE",
                "category": "Law Enforcement",
                "totalCameras": 14890,
                "onlineCameras": 14210,
                "degradedCameras": 420,
                "offlineCameras": 260,
                "maintenanceCameras": 0,
                "districtCoverage": 33,
                "vmsPlatforms": ["Milestone XProtect", "Genetec Security Center"],
                "nodalOfficer": {
                    "name": "Rajesh K. Sharma, IPS",
                    "rank": "Addl. Director General of Police (Traffic)",
                    "phone": "+91 79 2325 0000",
                    "email": "adgp-traffic@gujarat.gov.in",
                    "office": "Police Bhavan, Sector 18, Gandhinagar"
                },
                "lastSync": "2 mins ago"
            },
            {
                "id": "DEPT-MNC-02",
                "name": "Ahmedabad Municipal Corporation (AMC)",
                "code": "AMC",
                "category": "Municipal",
                "totalCameras": 5210,
                "onlineCameras": 4980,
                "degradedCameras": 150,
                "offlineCameras": 80,
                "maintenanceCameras": 0,
                "districtCoverage": 1,
                "vmsPlatforms": ["Genetec Omnicast"],
                "nodalOfficer": {
                    "name": "M. K. Patel, IAS",
                    "rank": "Municipal Commissioner",
                    "phone": "+91 79 2539 1811",
                    "email": "mc@ahmedabadcity.gov.in",
                    "office": "Danapith, Ahmedabad"
                },
                "lastSync": "5 mins ago"
            }
        ]

        self.vms_list: List[Dict[str, Any]] = [
            {
                "zeexVmsId": "VMS-MIL-01",
                "vendorVmsId": "milestone-corp-ahm-01",
                "vendor": "Milestone Systems (ONVIF Source A)",
                "systemName": "XProtect Corporate Traffic Hub",
                "version": "2025 R2",
                "departmentId": "DEPT-POL-01",
                "departmentName": "Gujarat Police (Traffic Division)",
                "district": "Ahmedabad",
                "endpoint": "onvif://ahm-traffic-cluster/device_service",
                "protocol": "ONVIF Profile S",
                "connectorId": "conn-onvif-v1",
                "status": "Operational",
                "capabilities": {
                    "liveStream": True,
                    "playback": True,
                    "snapshot": True,
                    "ptz": True,
                    "audio": True,
                    "twoWayAudio": False,
                    "anpr": True,
                    "events": True,
                    "recording": True
                },
                "cameraCount": 14890,
                "lastSyncTimestamp": "2026-08-20 10:45:00 IST",
                "healthScore": 98,
                "createdTimestamp": "2026-01-10",
                "updatedTimestamp": "2026-08-20"
            },
            {
                "zeexVmsId": "VMS-GEN-02",
                "vendorVmsId": "genetec-sec-center-surat-02",
                "vendor": "Genetec Inc. (REST Source B)",
                "systemName": "Security Center Omnicast AMC",
                "version": "v5.12",
                "departmentId": "DEPT-MNC-02",
                "departmentName": "Ahmedabad Municipal Corporation",
                "district": "Ahmedabad",
                "endpoint": "https://amc-vms-gateway.sdc.gujarat.gov.in/api/v2",
                "protocol": "Genetec REST API",
                "connectorId": "conn-genetec-rest-v2",
                "status": "Operational",
                "capabilities": {
                    "liveStream": True,
                    "playback": True,
                    "snapshot": True,
                    "ptz": False,
                    "audio": False,
                    "twoWayAudio": False,
                    "anpr": True,
                    "events": True,
                    "recording": True
                },
                "cameraCount": 5210,
                "lastSyncTimestamp": "2026-08-20 10:42:00 IST",
                "healthScore": 96,
                "createdTimestamp": "2026-02-14",
                "updatedTimestamp": "2026-08-20"
            }
        ]

        self.connectors: List[Dict[str, Any]] = [
            {
                "connectorId": "conn-onvif-v1",
                "vendor": "Milestone / ONVIF Org",
                "protocol": "ONVIF Profile S / T XML SOAP",
                "adapterVersion": "v1.4.2-certified",
                "status": "ACTIVE",
                "certificationStatus": "CERTIFIED",
                "supportedCapabilities": ["LIVE_STREAM", "PLAYBACK", "SNAPSHOT", "PTZ", "ANPR", "EVENTS"],
                "lastHeartbeat": "2026-08-20 10:48:12 IST",
                "latencyMs": 14,
                "errorCount": 0,
                "reconnectCount": 0,
                "activeSessions": 14890
            },
            {
                "connectorId": "conn-genetec-rest-v2",
                "vendor": "Genetec Inc.",
                "protocol": "REST API / Webhook JSON",
                "adapterVersion": "v2.1.0-certified",
                "status": "ACTIVE",
                "certificationStatus": "CERTIFIED",
                "supportedCapabilities": ["LIVE_STREAM", "PLAYBACK", "SNAPSHOT", "ANPR", "EVENTS"],
                "lastHeartbeat": "2026-08-20 10:48:10 IST",
                "latencyMs": 22,
                "errorCount": 0,
                "reconnectCount": 0,
                "activeSessions": 5210
            }
        ]

        self.anpr_events: List[Dict[str, Any]] = [
            {
                "id": "evt-anpr-1001",
                "plateNumber": "GJ01AB1234",
                "vehicleType": "Car",
                "color": "White",
                "speedKmh": 68,
                "confidence": 96.4,
                "plateConfidence": 98.1,
                "cameraUuid": "uuid-0001-cctv-ahm",
                "cameraCode": "CAM-GJ-AHM-TRF-000001",
                "cameraName": "SG Highway - Iscon Junction North",
                "district": "Ahmedabad",
                "departmentId": "DEPT-POL-01",
                "departmentName": "Gujarat Police (Traffic Division)",
                "locationDescription": "Iscon Cross Road, SG Highway, Satellite",
                "latitude": 23.0298,
                "longitude": 72.5074,
                "timestamp": "2026-08-20 10:32:41 IST",
                "direction": "Southbound",
                "watchlistFlag": True,
                "watchlistReason": "Flagged in Crime Branch Stolen Vehicle Register #8821",
                "imageCropUrl": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80",
                "vehicleImageUrl": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80"
            }
        ]

        self.alerts: List[Dict[str, Any]] = []
        self.anpr_watchlist: List[str] = []

        self.cases: List[Dict[str, Any]] = [
            {
                "id": "CASE-2026-000928",
                "title": "Inter-District Stolen Vehicle Corridor Tracking (GJ01AB1234)",
                "plateNumber": "GJ01AB1234",
                "status": "ACTIVE",
                "priority": "HIGH",
                "leadOfficer": "Rajesh K. Sharma, IPS",
                "badge": "GJ-POL-2018-09",
                "department": "Gujarat Police (Traffic & Crime Branch)",
                "createdDate": "2026-08-20",
                "evidenceCount": 1,
                "timelineEvents": [],
                "evidenceItems": [
                    {
                        "id": "EVD-92821",
                        "caseId": "CASE-2026-000928",
                        "cameraUuid": "uuid-0001-cctv-ahm",
                        "cameraCode": "CAM-GJ-AHM-TRF-000001",
                        "timestamp": "2026-08-20 10:32:41 IST",
                        "eventType": "ANPR Watchlist Detection",
                        "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        "fileSize": "4.2 MB",
                        "verifiedBy": "State SDC Integrity Verification Engine",
                        "createdDate": "2026-08-20"
                    }
                ],
                "caseNotes": ["Vehicle identified entering SG Highway corridor at 10:32 IST."]
            }
        ]

        self.audit_logs: List[Dict[str, Any]] = []
        self.dlq_records: List[Dict[str, Any]] = []

    def calculate_haversine_distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 2)

    def find_cameras_near(self, lat: float, lng: float, radius_km: float = 5.0) -> List[Dict[str, Any]]:
        result = []
        for cam in self.cameras:
            dist = self.calculate_haversine_distance_km(lat, lng, cam["latitude"], cam["longitude"])
            if dist <= radius_km:
                result.append(cam)
        return result
