// Media Gateway Proxy Service (Model 3)
import { AdapterRegistry } from '../adapters/AdapterRegistry';

export class MediaGatewayService {
  static async getMediaSession(vmsId: string, cameraCode: string): Promise<{
    streamProxyUrl: string;
    protocol: 'WebRTC' | 'HLS' | 'RTSP-Proxy';
    fps: number;
    resolution: string;
    authenticatedToken: string;
  }> {
    const adapter = AdapterRegistry.getInstance().getAdapter(vmsId);
    if (!adapter) {
      throw new Error(`VMS Adapter ${vmsId} not found in AdapterRegistry`);
    }

    const endpoint = await adapter.getStreamEndpoint(cameraCode);
    return {
      streamProxyUrl: `https://mediagateway.sdc.gujarat.gov.in/live/${cameraCode}/stream.m3u8?token=sess_token_${Date.now()}`,
      protocol: endpoint.protocol.includes('RTSP') ? 'RTSP-Proxy' : 'HLS',
      fps: 25,
      resolution: '1920x1080',
      authenticatedToken: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Date.now()}`,
    };
  }
}
