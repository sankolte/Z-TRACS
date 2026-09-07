from typing import Dict, Any

class MediaMTXRelayGateway:
    def __init__(self, mediamtx_host: str = "mediamtx.sdc.gujarat.gov.in"):
        self.mediamtx_host = mediamtx_host

    def generate_rtsp_to_webrtc_proxy(self, camera_code: str, rtsp_source: str) -> Dict[str, Any]:
        return {
            "cameraCode": camera_code,
            "sourceRtspUrl": rtsp_source,
            "webrtcUrl": f"https://{self.mediamtx_host}/live/{camera_code}/webrtc",
            "hlsUrl": f"https://{self.mediamtx_host}/live/{camera_code}/index.m3u8",
            "transcoder": "FFmpeg H.264 / AAC Pass-through",
            "relayStatus": "ACTIVE",
            "activeViewers": 14
        }

mediamtx_relay = MediaMTXRelayGateway()
