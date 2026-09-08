from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from app.schemas.api_response import ApiResponse
from app.services.camera_service import CameraService
import json
import urllib.request
import urllib.error
import asyncio
from datetime import datetime

router = APIRouter(prefix="/cameras", tags=["Model 1 — Camera Master Registry"])
camera_service = CameraService()

# Global webhook configuration for Buddy Server integration
BUDDY_WEBHOOK_CONFIG = {
    "url": "",
    "enabled": False,
    "last_sync": None
}

def _send_webhook_sync(url: str, payload: dict, timeout: float = 8.0):
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "Z-TRACS-Sentinel/1.0"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8")
    except Exception as e:
        return 500, str(e)

@router.get("")
async def get_cameras(
    department_id: Optional[str] = Query(None, alias="departmentId"),
    district: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    lat: Optional[float] = Query(None, description="Center latitude for PostGIS radius search"),
    lng: Optional[float] = Query(None, description="Center longitude for PostGIS radius search"),
    radius: Optional[float] = Query(5000.0, description="Spatial search radius in meters (Default: 5000m)"),
    min_lat: Optional[float] = Query(None, alias="minLat", description="Viewport Bounding Box South-West Lat"),
    max_lat: Optional[float] = Query(None, alias="maxLat", description="Viewport Bounding Box North-East Lat"),
    min_lng: Optional[float] = Query(None, alias="minLng", description="Viewport Bounding Box South-West Lng"),
    max_lng: Optional[float] = Query(None, alias="maxLng", description="Viewport Bounding Box North-East Lng"),
    limit: int = Query(250, description="Max cameras returned per viewport query")
):
    """
    Paginated Camera Query with PostGIS Spatial Radius & Map Viewport Bounding Box Filtering
    Utilizes idx_cameras_location_geog_gist Index for sub-millisecond 12,000+ camera retrieval.
    """
    if min_lat is not None and max_lat is not None and min_lng is not None and max_lng is not None:
        cameras = await camera_service.get_cameras_in_bbox_postgis(min_lat, max_lat, min_lng, max_lng, district, limit)
    elif lat is not None and lng is not None:
        cameras = await camera_service.get_cameras_near_postgis(lat, lng, radius, district, status, limit)
    else:
        cameras = camera_service.get_all_cameras(department_id, district, status)
        
    return ApiResponse.ok(cameras, page=1, page_size=len(cameras), total_records=len(cameras))

import os

CAMERA_OVERRIDES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "camera_overrides.json")
CAMERA_OVERRIDES: Dict[str, Dict[str, Any]] = {}

def _load_camera_overrides():
    global CAMERA_OVERRIDES
    if os.path.exists(CAMERA_OVERRIDES_FILE):
        try:
            with open(CAMERA_OVERRIDES_FILE, "r", encoding="utf-8") as f:
                CAMERA_OVERRIDES = json.load(f)
        except Exception:
            CAMERA_OVERRIDES = {}

def _save_camera_overrides():
    try:
        os.makedirs(os.path.dirname(CAMERA_OVERRIDES_FILE), exist_ok=True)
        with open(CAMERA_OVERRIDES_FILE, "w", encoding="utf-8") as f:
            json.dump(CAMERA_OVERRIDES, f, indent=2)
    except Exception:
        pass

_load_camera_overrides()

def _get_sentinel_catalog_feeds() -> List[Dict[str, Any]]:
    sentinel_locations = [
        ("Chiman Bhai Bridge", 23.0612, 72.5804, "Ahmedabad"),
        ("Janpath Road", 23.0315, 72.5621, "Ahmedabad"),
        ("C.G. Road Axis", 23.0254, 72.5562, "Ahmedabad"),
        ("Paldi Junction", 23.0112, 72.5610, "Ahmedabad"),
        ("Narol Circle South", 22.9754, 72.6001, "Ahmedabad"),
        ("Asarwa Civil Corridor", 23.0489, 72.6021, "Ahmedabad"),
        ("Bapu Nagar Toll Gate", 23.0341, 72.6289, "Ahmedabad"),
        ("Memnagar Bus Shelter", 23.0512, 72.5412, "Ahmedabad"),
        ("Maninagar Station Square", 22.9989, 72.6012, "Ahmedabad"),
        ("Vastrapur Lake East", 23.0381, 72.5298, "Ahmedabad"),
        ("Drive-In Cinema Cross", 23.0471, 72.5210, "Ahmedabad"),
        ("Gota Highway Flyover", 23.0912, 72.5310, "Ahmedabad"),
        ("Sarkhej Rotary Junction", 22.9812, 72.4989, "Ahmedabad"),
        ("Iscon Cross Road", 23.0298, 72.5074, "Ahmedabad"),
        ("Pakwan Junction West", 23.0389, 72.5112, "Ahmedabad"),
        ("Thaltej Underpass", 23.0501, 72.5089, "Ahmedabad"),
        ("Science City Boulevard", 23.0765, 72.4921, "Ahmedabad"),
        ("Bhadra Plaza Heritage Zone", 23.0241, 72.5810, "Ahmedabad"),
        ("Ellis Bridge West End", 23.0210, 72.5710, "Ahmedabad"),
        ("Nehrunagar Circle", 23.0189, 72.5432, "Ahmedabad"),
        ("Law Garden Perimeter", 23.0212, 72.5589, "Ahmedabad"),
        ("S.P. Ring Road Boman", 23.1121, 72.5510, "Ahmedabad"),
        ("Kalupur Railway Terminal", 23.0289, 72.5998, "Ahmedabad"),
        ("Geeta Mandir Bus Hub", 23.0121, 72.5889, "Ahmedabad"),
        ("Subhash Bridge North", 23.0645, 72.5889, "Ahmedabad"),
        ("Sabarmati Ashram Gate", 23.0610, 72.5812, "Ahmedabad"),
        ("Ranip Cross Road", 23.0789, 72.5710, "Ahmedabad"),
        ("Chandkheda Highway Corner", 23.1112, 72.5821, "Ahmedabad"),
        ("Sola Civil Hospital Front", 23.0712, 72.5210, "Ahmedabad"),
        ("Bodakdev High Street", 23.0398, 72.5189, "Ahmedabad"),
        ("Prahladnagar Corporate Corridor", 23.0112, 72.5089, "Ahmedabad"),
        ("SG Highway - Iskcon Flyover South", 23.0289, 72.5065, "Ahmedabad"),
        ("SG Highway - Vaishnodevi Circle", 23.1345, 72.5389, "Ahmedabad"),
    ]
    catalog = []
    for i, loc in enumerate(sentinel_locations, 1):
        cam_id = f"cam{i:02d}"
        code = f"CAM-GJ-AHM-SNTL-{i:06d}"
        alias_short = f"CAM-{i:03d}"
        
        # Check overrides
        override = CAMERA_OVERRIDES.get(code) or CAMERA_OVERRIDES.get(alias_short) or CAMERA_OVERRIDES.get(cam_id) or {}
        custom_rtsp = override.get("rtsp_url") or override.get("rtspUrl") or override.get("endpointReference") or override.get("rtsp")
        default_rtsp = f"rtsp://admin%40zeexai.com:RCVN-BJ7U-UCA4@103.250.160.189:8554/stream/{cam_id}"

        catalog.append({
            "id": cam_id,
            "number": i,
            "name": override.get("name") or f"Camera {i} ({loc[0]})",
            "camera_code": code,
            "rtsp_url": custom_rtsp or default_rtsp,
            "webrtc_url": override.get("webrtc_url") or f"http://103.250.160.189:8889/stream/{cam_id}/whep",
            "hls_live_url": override.get("hls_live_url") or f"/api/v1/streams/corp8-proxy/{cam_id}/index.m3u8",
            "hls_cdn_url": override.get("hls_cdn_url") or f"https://cctv.corp8.cloud/{cam_id}/index.m3u8",
            "latitude": float(override.get("latitude", loc[1])),
            "longitude": float(override.get("longitude", loc[2])),
            "city": override.get("city") or loc[3],
            "district": override.get("district") or "Ahmedabad",
            "location": override.get("location") or loc[0],
            "codec": "h264",
            "health_status": override.get("health_status") or override.get("healthStatus") or "ONLINE",
            "fps": 25,
            "width": 1920,
            "height": 1080,
        })
    return catalog

@router.get("/export-feeds")
async def export_camera_feeds(
    format: str = Query("json", description="Export format: 'json' or 'csv'")
):
    """
    Dynamic Camera Feeds Export for Buddy System Integration.
    Exposes RTSP URLs, names, coordinates, and metadata for ONLY the 33 live feed cameras.
    """
    # 1. Base catalog of 33 Sentinel live feeds
    feed_list = _get_sentinel_catalog_feeds()
    existing_ids = {f["id"] for f in feed_list}
    existing_codes = {f["camera_code"] for f in feed_list}

    # 2. Merge dynamically onboarded live cameras (from streams module in-memory store + camera service)
    try:
        from app.api.v1.streams import DYNAMIC_ONBOARDED_CAMERAS
        dynamic_sources = DYNAMIC_ONBOARDED_CAMERAS + camera_service.get_all_cameras()
    except Exception:
        dynamic_sources = camera_service.get_all_cameras()

    for c in dynamic_sources:
        cam_id = str(c.get("cameraUuid") or c.get("id") or c.get("cameraCode"))
        cam_code = str(c.get("cameraCode") or c.get("code") or cam_id)
        if cam_id not in existing_ids and cam_code not in existing_codes:
            rtsp_url = c.get("endpointReference") or c.get("rtsp_url") or c.get("streamUrl") or f"rtsp://103.250.160.189:8554/stream/{cam_id}"
            feed_list.append({
                "id": cam_id,
                "number": c.get("number", len(feed_list) + 1),
                "name": c.get("name", "Surveillance Camera"),
                "camera_code": cam_code,
                "rtsp_url": rtsp_url,
                "webrtc_url": c.get("webrtc_url") or f"http://103.250.160.189:8889/stream/{cam_id}/whep",
                "hls_live_url": c.get("hls_live_url") or f"/api/v1/streams/corp8-proxy/{cam_id}/index.m3u8",
                "hls_cdn_url": c.get("hls_cdn_url") or f"https://cctv.corp8.cloud/{cam_id}/index.m3u8",
                "latitude": float(c.get("latitude", 0.0)),
                "longitude": float(c.get("longitude", 0.0)),
                "city": c.get("city") or c.get("district") or "Ahmedabad",
                "district": c.get("district") or "Ahmedabad",
                "location": c.get("address") or c.get("location") or c.get("name") or "Statewide CCTV Corridor",
                "codec": str(c.get("codec", "h264")).lower(),
                "health_status": c.get("healthStatus") or c.get("health_status") or "ONLINE",
                "fps": int(c.get("fps", 25)),
                "width": int(c.get("width", 1920)),
                "height": int(c.get("height", 1080)),
            })
            existing_ids.add(cam_id)
            existing_codes.add(cam_code)

    if format.lower() == "csv":
        header = "id,number,name,camera_code,rtsp_url,webrtc_url,hls_live_url,latitude,longitude,city,district,location,codec,health_status\n"
        rows = []
        for f in feed_list:
            clean_name = str(f['name']).replace(',', ' ')
            clean_loc = str(f['location']).replace(',', ' ')
            rows.append(f"{f['id']},{f['number']},{clean_name},{f['camera_code']},{f['rtsp_url']},{f['webrtc_url']},{f['hls_live_url']},{f['latitude']},{f['longitude']},{f['city']},{f['district']},{clean_loc},{f['codec']},{f['health_status']}")
        csv_content = header + "\n".join(rows)
        return Response(content=csv_content, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=sentinel_cameras_export.csv"})

    return {
        "status": "success",
        "total_cameras": len(feed_list),
        "export_timestamp": datetime.now().isoformat(),
        "buddy_api_url": "http://43.204.235.231:8000/api/v1/cameras/export-feeds",
        "cameras": feed_list
    }

@router.post("/sync-webhook")
async def configure_and_trigger_webhook(payload: Dict[str, Any]):
    """
    Push camera registry (or configure webhook URL) to buddy server.
    Payload: {"webhook_url": "http://buddy-server/api/cameras"}
    """
    global BUDDY_WEBHOOK_CONFIG
    webhook_url = payload.get("webhook_url")
    if webhook_url:
        BUDDY_WEBHOOK_CONFIG["url"] = webhook_url
        BUDDY_WEBHOOK_CONFIG["enabled"] = True
    
    target_url = webhook_url or BUDDY_WEBHOOK_CONFIG.get("url")
    if not target_url:
        raise HTTPException(status_code=400, detail="No webhook_url provided or configured.")

    cameras = camera_service.get_all_cameras()
    feed_list = [
        {
            "id": c.get("cameraUuid"),
            "name": c.get("name"),
            "camera_code": c.get("cameraCode"),
            "rtsp_url": c.get("endpointReference") or c.get("rtsp_url") or "",
            "latitude": c.get("latitude"),
            "longitude": c.get("longitude"),
            "city": c.get("city"),
            "district": c.get("district"),
            "location": c.get("address"),
            "codec": c.get("codec", "h264"),
            "health_status": c.get("healthStatus")
        }
        for c in cameras
    ]

    status_code, resp_text = await asyncio.to_thread(
        _send_webhook_sync,
        target_url,
        {"event": "CAMERA_REGISTRY_SYNC", "total_cameras": len(feed_list), "cameras": feed_list}
    )

    BUDDY_WEBHOOK_CONFIG["last_sync"] = datetime.now().isoformat()
    return {
        "status": "success" if status_code == 200 else "warning",
        "message": f"Webhook push to {target_url} returned HTTP {status_code}",
        "buddy_response_status": status_code,
        "detail": resp_text
    }

@router.get("/{code}")
async def get_camera_by_code(code: str):
    camera = camera_service.get_camera_by_code(code)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera with code/uuid '{code}' not found")
    return ApiResponse.ok(camera)

@router.post("")
async def create_camera(cam_data: Dict[str, Any]):
    new_cam = await camera_service.create_camera_async(cam_data)

    # If buddy webhook is configured, forward new camera automatically
    if BUDDY_WEBHOOK_CONFIG.get("enabled") and BUDDY_WEBHOOK_CONFIG.get("url"):
        payload = {
            "event": "NEW_CAMERA_ONBOARDED",
            "camera": {
                "id": new_cam.get("cameraUuid"),
                "name": new_cam.get("name"),
                "camera_code": new_cam.get("cameraCode"),
                "rtsp_url": new_cam.get("endpointReference"),
                "latitude": new_cam.get("latitude"),
                "longitude": new_cam.get("longitude"),
                "city": new_cam.get("city"),
                "district": new_cam.get("district")
            }
        }
        asyncio.create_task(asyncio.to_thread(_send_webhook_sync, BUDDY_WEBHOOK_CONFIG["url"], payload))

    return ApiResponse.ok(new_cam)

@router.put("/{code}")
@router.patch("/{code}")
@router.post("/{code}/update")
@router.post("/update")
async def update_camera(code: Optional[str] = None, payload: Dict[str, Any] = Body(...)):
    """
    Update camera RTSP stream URL, name, coordinates, district, or health status.
    Overrides are saved persistently and broadcasted to edge daemons via /cameras/export-feeds.
    """
    cam_code = str(code or payload.get("camera_code") or payload.get("cameraCode") or "").strip()
    if not cam_code:
        raise HTTPException(status_code=400, detail="camera_code is required")

    aliases = [cam_code, cam_code.upper(), cam_code.lower()]
    import re
    m = re.search(r'(\d+)$', cam_code)
    if m:
        num = int(m.group(1))
        aliases.extend([
            f"CAM-{num:03d}",
            f"CAM-{num}",
            f"CAM-GJ-AHM-SNTL-{num:06d}",
            f"cam{num:02d}",
            str(num)
        ])

    for a in set(aliases):
        if a not in CAMERA_OVERRIDES:
            CAMERA_OVERRIDES[a] = {}
        CAMERA_OVERRIDES[a].update(payload)

    _save_camera_overrides()

    # Update in camera_service if exists
    try:
        camera_service.update_camera(cam_code, payload)
    except Exception:
        pass

    print(f"✅ [CAMERA UPDATED] '{cam_code}' -> RTSP: {payload.get('rtsp_url') or payload.get('endpointReference')}")
    return ApiResponse.ok({
        "status": "success",
        "message": f"Camera {cam_code} updated successfully",
        "camera_code": cam_code,
        "data": CAMERA_OVERRIDES.get(cam_code) or payload
    })
