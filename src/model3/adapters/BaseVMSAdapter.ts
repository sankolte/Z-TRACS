// Base VMS Adapter Contract (Model 3)
import { CanonicalVms, CanonicalCapability, CanonicalEvent } from '../schemas/canonical';
import { CameraMasterRecord } from '../../types';

export abstract class BaseVMSAdapter {
  abstract readonly vmsId: string;
  abstract readonly vendor: string;
  abstract readonly protocol: string;
  abstract readonly adapterVersion: string;

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<boolean>;
  abstract authenticate(): Promise<boolean>;

  abstract discoverCameras(): Promise<Partial<CameraMasterRecord>[]>;
  abstract getCameraCapabilities(cameraCode: string): Promise<CanonicalCapability>;

  abstract getStreamEndpoint(cameraCode: string): Promise<{ url: string; protocol: string }>;
  abstract getSnapshot(cameraCode: string): Promise<string>;

  abstract subscribeEvents(callback: (event: CanonicalEvent) => void): void;
  abstract unsubscribeEvents(): void;

  abstract healthCheck(): Promise<{
    status: 'Operational' | 'Degraded' | 'Offline';
    latencyMs: number;
    lastHeartbeat: string;
    details: string;
  }>;
}
