// Adapter Registry & Connector Manager (Model 3)
import { BaseVMSAdapter } from './BaseVMSAdapter';
import { OnvifRtspAdapter } from './OnvifRtspAdapter';
import { GenetecRestAdapter } from './GenetecRestAdapter';
import { CanonicalConnector } from '../schemas/canonical';

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: Map<string, BaseVMSAdapter> = new Map();
  private connectors: Map<string, CanonicalConnector> = new Map();

  private constructor() {
    // Register Source A: ONVIF Profile S/T Adapter
    const onvifAdapter = new OnvifRtspAdapter();
    this.adapters.set(onvifAdapter.vmsId, onvifAdapter);
    this.connectors.set('conn-onvif-v1', {
      connectorId: 'conn-onvif-v1',
      vendor: 'Milestone / ONVIF Org',
      protocol: 'ONVIF Profile S / T XML SOAP',
      adapterVersion: 'v1.4.2-certified',
      status: 'ACTIVE',
      certificationStatus: 'CERTIFIED',
      supportedCapabilities: ['LIVE_STREAM', 'PLAYBACK', 'SNAPSHOT', 'PTZ', 'ANPR', 'EVENTS'],
      lastHeartbeat: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      latencyMs: 14,
      errorCount: 0,
      reconnectCount: 0,
      activeSessions: 14890,
    });

    // Register Source B: Genetec REST API Adapter
    const genetecAdapter = new GenetecRestAdapter();
    this.adapters.set(genetecAdapter.vmsId, genetecAdapter);
    this.connectors.set('conn-genetec-rest-v2', {
      connectorId: 'conn-genetec-rest-v2',
      vendor: 'Genetec Inc.',
      protocol: 'REST API / Webhook JSON',
      adapterVersion: 'v2.1.0-certified',
      status: 'ACTIVE',
      certificationStatus: 'CERTIFIED',
      supportedCapabilities: ['LIVE_STREAM', 'PLAYBACK', 'SNAPSHOT', 'ANPR', 'EVENTS'],
      lastHeartbeat: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      latencyMs: 22,
      errorCount: 0,
      reconnectCount: 0,
      activeSessions: 5210,
    });
  }

  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  getAdapter(vmsId: string): BaseVMSAdapter | undefined {
    return this.adapters.get(vmsId);
  }

  getAllAdapters(): BaseVMSAdapter[] {
    return Array.from(this.adapters.values());
  }

  getAllConnectors(): CanonicalConnector[] {
    return Array.from(this.connectors.values());
  }
}
