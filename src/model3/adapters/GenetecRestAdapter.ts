// Source B: Vendor REST API & Webhook Adapter (Model 3)
import { BaseVMSAdapter } from './BaseVMSAdapter';
import { CanonicalCapability, CanonicalEvent } from '../schemas/canonical';
import { CameraMasterRecord } from '../../types';

export class GenetecRestAdapter extends BaseVMSAdapter {
  readonly vmsId = 'VMS-GEN-02';
  readonly vendor = 'Genetec Inc.';
  readonly protocol = 'REST API / Webhook JSON';
  readonly adapterVersion = 'v2.1.0-certified';

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
    // Simulates REST Bearer OAuth2 token handshake
    return true;
  }

  async discoverCameras(): Promise<Partial<CameraMasterRecord>[]> {
    // Simulates GET /api/v2/entities/cameras JSON response
    return [
      {
        cameraCode: 'CAM-GJ-AHM-MNC-000042',
        name: 'Sabarmati Riverfront Walkway West (Genetec REST Discovered)',
        type: 'Dome',
        manufacturer: 'Axis Communications (Genetec Integration)',
        model: 'Q3517-LV',
        protocol: 'Proprietary VMS Link',
        endpointReference: 'genetec://amc-server-cluster/cam_0042',
      },
    ];
  }

  async getCameraCapabilities(cameraCode: string): Promise<CanonicalCapability> {
    return {
      liveStream: true,
      playback: true,
      snapshot: true,
      ptz: false,
      audio: false,
      twoWayAudio: false,
      anpr: true,
      events: true,
      recording: true,
    };
  }

  async getStreamEndpoint(cameraCode: string): Promise<{ url: string; protocol: string }> {
    return {
      url: `https://genetec-gateway.sdc.gujarat.gov.in/hls/${cameraCode}/playlist.m3u8`,
      protocol: 'HLS/REST-Proxy',
    };
  }

  async getSnapshot(cameraCode: string): Promise<string> {
    return 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80';
  }

  subscribeEvents(callback: (event: CanonicalEvent) => void): void {
    this.eventCallback = callback;
    if (this.timerRef) clearInterval(this.timerRef);

    // Simulate incoming HTTP Webhook JSON payload from Genetec Security Center
    this.timerRef = setInterval(() => {
      if (this.eventCallback && this.isConnected) {
        const canonicalEvt: CanonicalEvent = {
          eventId: `evt-genetec-${Date.now()}`,
          eventType: 'ANPR_DETECTED',
          schemaVersion: '1.0',
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
          source: {
            departmentId: 'DEPT-MNC-02',
            vmsId: this.vmsId,
            cameraId: 'uuid-0002-cctv-ahm',
            cameraCode: 'CAM-GJ-AHM-MNC-000042',
            connectorId: 'conn-genetec-rest-v2',
          },
          location: {
            latitude: 23.0372,
            longitude: 72.5721,
            district: 'Ahmedabad',
            locationDescription: 'Sabarmati Riverfront Promenade West',
          },
          detection: {
            objectType: 'license_plate',
            confidence: 0.97,
          },
          vehicle: {
            plateNumber: 'GJ01AB1234',
            plateConfidence: 98.6,
            vehicleType: 'Car',
            color: 'White',
            speedKmh: 72,
            direction: 'Eastbound',
            watchlistFlag: true,
            watchlistReason: 'Crime Branch Flagged Vehicle #8821',
            imageCropUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80',
            vehicleImageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80',
          },
          rawPayload: {
            genetecEventType: 'LicensePlateRead',
            genetecGuid: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
          },
        };
        this.eventCallback(canonicalEvt);
      }
    }, 15000);
  }

  unsubscribeEvents(): void {
    if (this.timerRef) clearInterval(this.timerRef);
    this.eventCallback = null;
  }

  async healthCheck(): Promise<{ status: 'Operational' | 'Degraded' | 'Offline'; latencyMs: number; lastHeartbeat: string; details: string }> {
    return {
      status: 'Operational',
      latencyMs: 22,
      lastHeartbeat: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      details: 'REST API GET /api/v2/system/health returning HTTP 200 OK (OAuth token valid)',
    };
  }
}
