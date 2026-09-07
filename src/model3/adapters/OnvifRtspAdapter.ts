// Source A: ONVIF Profile S/T XML SOAP & RTSP Native Adapter (Model 3)
import { BaseVMSAdapter } from './BaseVMSAdapter';
import { CanonicalCapability, CanonicalEvent } from '../schemas/canonical';
import { CameraMasterRecord } from '../../types';

export class OnvifRtspAdapter extends BaseVMSAdapter {
  readonly vmsId = 'VMS-MIL-01';
  readonly vendor = 'Milestone Systems (ONVIF)';
  readonly protocol = 'ONVIF Profile S / T XML SOAP';
  readonly adapterVersion = 'v1.4.2-certified';

  private isConnected = false;
  private eventCallback: ((event: CanonicalEvent) => void) | null = null;
  private timerRef: any = null;

  async connect(): Promise<boolean> {
    this.isConnected = true;
    return true;
  }

  async disconnect(): Promise<boolean> {
    this.isConnected = false;
    if (this.timerRef) clearInterval(this.timerRef);
    return true;
  }

  async authenticate(): Promise<boolean> {
    // Simulates WS-Security UsernameToken Digest authentication
    return true;
  }

  async discoverCameras(): Promise<Partial<CameraMasterRecord>[]> {
    // Simulates WS-Discovery probe response parsing over multicast 239.255.255.250:3702
    return [
      {
        cameraCode: 'CAM-GJ-AHM-TRF-000001',
        name: 'SG Highway - Iscon Junction North (ONVIF Discovered)',
        type: 'PTZ',
        manufacturer: 'Hikvision ONVIF',
        model: 'DS-2DF8442IXS',
        protocol: 'ONVIF Profile S',
        endpointReference: 'onvif://ahm-traffic-cluster/device_service',
      },
      {
        cameraCode: 'CAM-GJ-SUR-TRF-001092',
        name: 'Majura Gate Overbridge North Approach (ONVIF Discovered)',
        type: 'PTZ',
        manufacturer: 'Dahua ONVIF',
        model: 'DH-SD6AL245U-HNI',
        protocol: 'ONVIF Profile T',
        endpointReference: 'onvif://surat-[#001092]/device_service',
      },
    ];
  }

  async getCameraCapabilities(cameraCode: string): Promise<CanonicalCapability> {
    return {
      liveStream: true,
      playback: true,
      snapshot: true,
      ptz: true,
      audio: true,
      twoWayAudio: false,
      anpr: true,
      events: true,
      recording: true,
    };
  }

  async getStreamEndpoint(cameraCode: string): Promise<{ url: string; protocol: string }> {
    return {
      url: `rtsp://gateway.sdc.gujarat.gov.in:554/onvif/${cameraCode}/live_stream`,
      protocol: 'RTSP/ONVIF',
    };
  }

  async getSnapshot(cameraCode: string): Promise<string> {
    return 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80';
  }

  subscribeEvents(callback: (event: CanonicalEvent) => void): void {
    this.eventCallback = callback;
    // Simulate periodic ONVIF PullMessages event notifications over WS-BaseNotification
    if (this.timerRef) clearInterval(this.timerRef);

    this.timerRef = setInterval(() => {
      if (this.eventCallback && this.isConnected) {
        const canonicalEvt: CanonicalEvent = {
          eventId: `evt-onvif-${Date.now()}`,
          eventType: 'ANPR_DETECTED',
          schemaVersion: '1.0',
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
          source: {
            departmentId: 'DEPT-POL-01',
            vmsId: this.vmsId,
            cameraId: 'uuid-0001-cctv-ahm',
            cameraCode: 'CAM-GJ-AHM-TRF-000001',
            connectorId: 'conn-onvif-v1',
          },
          location: {
            latitude: 23.0298,
            longitude: 72.5074,
            district: 'Ahmedabad',
            locationDescription: 'SG Highway - Iscon Cross Road',
          },
          detection: {
            objectType: 'license_plate',
            confidence: 0.98,
          },
          vehicle: {
            plateNumber: 'GJ01AB1234',
            plateConfidence: 98.6,
            vehicleType: 'Car',
            color: 'White',
            speedKmh: 68,
            direction: 'Southbound',
            watchlistFlag: true,
            watchlistReason: 'Crime Branch Flagged Vehicle #8821',
            imageCropUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80',
            vehicleImageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80',
          },
          rawPayload: {
            onvifTopic: 'tns1:RuleEngine/LicensePlateDetector/PlateMatch',
            soapEnvelopeId: `msg-${Date.now()}`,
          },
        };
        this.eventCallback(canonicalEvt);
      }
    }, 12000);
  }

  unsubscribeEvents(): void {
    if (this.timerRef) clearInterval(this.timerRef);
    this.eventCallback = null;
  }

  async healthCheck(): Promise<{ status: 'Operational' | 'Degraded' | 'Offline'; latencyMs: number; lastHeartbeat: string; details: string }> {
    return {
      status: 'Operational',
      latencyMs: 14,
      lastHeartbeat: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      details: 'ONVIF GetSystemDateAndTime SOAP handshake successful (HTTP 200 OK)',
    };
  }
}
