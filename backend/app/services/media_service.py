from typing import Dict, Any
from datetime import datetime
from app.adapters.adapter_registry import AdapterRegistry

class MediaService:
    async def create_stream_session(self, vms_id: str, camera_code: str) -> Dict[str, Any]:
        adapter = AdapterRegistry().get_adapter(vms_id)
        endpoint_url = f"https://mediagateway.sdc.gujarat.gov.in/hls/{camera_code}/playlist.m3u8"
        protocol = "HLS/WebRTC"

        if adapter:
            ep = await adapter.get_stream_endpoint(camera_code)
            endpoint_url = ep.get("url", endpoint_url)
            protocol = ep.get("protocol", protocol)

        return {
            "streamProxyUrl": endpoint_url,
            "protocol": protocol,
            "fps": 25,
            "resolution": "1920x1080",
            "sessionToken": f"sess_{int(datetime.now().timestamp())}",
            "expiresInSeconds": 3600
        }
