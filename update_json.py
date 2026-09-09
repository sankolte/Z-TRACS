"""
Z-TRACS Buddy SDK & Edge Client + Active Camera Listener Daemon (Production Ready)
-----------------------------------------------------------------------------------
Designed for DeepStream / TAO / YOLO / LPR Edge Nodes (Nvidia Jetson / Linux GPU Servers)

Features:
 1. ACTIVE CAMERA LISTENER with CHANGE-DETECTION:
    - Queries /anpr/sync-version to detect real-time changes
    - Only rebuilds 'cameras.json' when camera AI config or ROI modifications occur
 2. Multi-Server Failover Hierarchy:
    - Primary:   AWS EC2 Direct (http://43.204.235.231:8000/api/v1)
    - Secondary: Vercel Proxy HTTPS (https://z-tracs.vercel.app/api/v1)
    - Tertiary:  Localhost (http://localhost:8000/api/v1 - local development only)
 3. Atomic File Writes: Writes to .tmp and renames to prevent inference worker race conditions
 4. Zero Network Calls in Camera Loop: Fast, sub-second generation using in-memory batch mapping
 5. Multi-Usecase 4-ROI Architecture:
    - rois[0]: ANPR Lane Polygon
    - rois[1]: Face Recognition Entry Zone
    - rois[2]: PPE Safety Inspection Zone
    - rois[3]: Footfall & Crowd Counting Corridor
"""

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    import subprocess
    print("[Z-TRACS SETUP] Installing required lightweight 'requests' library...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "urllib3"])
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
import time
import json
import queue
import threading
import os
import sys
from typing import Dict, Any, List, Optional, Callable
import re

def normalize_camera_code(code: str) -> str:
    if not code:
        return "CAM-001"
    code = str(code).strip()
    m = re.search(r'(\d+)$', code)
    if m:
        return f"CAM-{int(m.group(1)):03d}"
    return code.upper()

def get_sentinel_code(code: str) -> str:
    m = re.search(r'(\d+)$', str(code).strip())
    num = int(m.group(1)) if m else 1
    return f"CAM-GJ-AHM-SNTL-{num:06d}"

def get_code_aliases(code: str) -> List[str]:
    if not code:
        return []
    code = str(code).strip()
    canonical = normalize_camera_code(code)
    m = re.search(r'(\d+)$', code)
    num = int(m.group(1)) if m else 1
    return list(dict.fromkeys([
        canonical,                     # CAM-001
        f"CAM-{num}",                  # CAM-1
        f"CAM-{num:02d}",              # CAM-01
        f"CAM-{num:03d}",              # CAM-001
        f"CAM-GJ-AHM-SNTL-{num:06d}",  # CAM-GJ-AHM-SNTL-000001
        str(num),                      # 1
        f"{num:02d}",                  # 01
        f"{num:03d}",                  # 001
        code,
        code.upper(),
        code.lower()
    ]))

STANDARD_USECASES = ["ANPR", "FACE_RECOGNITION", "PPE", "FOOTFALL"]

ZEEX_RTSP_AUTH = "admin%40zeexai.com:RCVN-BJ7U-UCA4@"

def format_rtsp_url(raw_url: str) -> str:
    """
    Formats RTSP stream URLs for Nvidia Jetson / DeepStream edge workers.
    Injects required media credentials if pointing to zeex server (103.250.160.189)
    and preserves custom user-specified RTSP links intact.
    """
    if not raw_url:
        return ""
    url = str(raw_url).strip()
    if "103.250.160.189" in url and "@" not in url:
        return url.replace("rtsp://", f"rtsp://{ZEEX_RTSP_AUTH}")
    return url

DEFAULT_ROIS = [
    # 0. ANPR Lane Polygon
    [[100, 200], [800, 200], [900, 900], [50, 900]],
    # 1. Face Recognition Entry Zone
    [[200, 150], [600, 150], [600, 750], [200, 750]],
    # 2. PPE Safety Zone
    [[50, 100], [950, 100], [950, 950], [50, 950]],
    # 3. Footfall Counting Corridor
    [[300, 400], [700, 400], [700, 800], [300, 800]]
]

STATE_FILE = ".sync_state.json"
CAMERAS_JSON_FILE = "cameras.json"


class ZTracsBuddyClient:
    def __init__(
        self,
        primary_url: str = "http://43.204.235.231:8000/api/v1",
        secondary_url: str = "https://z-tracs.vercel.app/api/v1",
        tertiary_url: str = "http://localhost:8000/api/v1",
        timeout: int = 5,
        enable_background_queue: bool = True
    ):
        self.endpoints = [
            primary_url.rstrip('/'),
            secondary_url.rstrip('/'),
            tertiary_url.rstrip('/')
        ]
        self.timeout = timeout
        
        # Connection Pooling & Auto Retry Session
        self.session = requests.Session()
        retry_strategy = Retry(
            total=2,
            backoff_factor=0.3,
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Background Queue Worker for Non-blocking Alerts
        self.enable_background_queue = enable_background_queue
        if self.enable_background_queue:
            self.alert_queue = queue.Queue(maxsize=1000)
            self.worker_thread = threading.Thread(target=self._background_alert_worker, daemon=True)
            self.worker_thread.start()

    def _request_with_failover(self, method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
        """Executes HTTP request trying EC2 Direct first, then Vercel Proxy, then Localhost."""
        kwargs.setdefault('timeout', self.timeout)
        
        for base_url in self.endpoints:
            try:
                url = f"{base_url}{endpoint}"
                res = self.session.request(method, url, **kwargs)
                if res.status_code < 500:
                    return res
            except Exception:
                continue
        return None

    # Check sync version (lightweight timestamp call)
    def get_sync_version(self) -> Dict[str, Any]:
        """Fetch modification timestamps for change-detection."""
        # 1. Try /anpr/sync-version
        res = self._request_with_failover("GET", "/anpr/sync-version")
        if res and res.status_code == 200:
            try:
                d = res.json()
                if d.get("ai_configs_updated_at") or d.get("rois_updated_at"):
                    return d
            except Exception:
                pass

        # 2. Resilient Direct Timestamps Fallback (Detects changes regardless of EC2 version)
        ai_ver = None
        roi_ver = None
        try:
            r_ai = self._request_with_failover("GET", "/cameras/CAM-GJ-AHM-SNTL-000001/ai-config", timeout=0.8)
            if r_ai and r_ai.status_code == 200:
                d_ai = r_ai.json()
                ai_ver = d_ai.get("updatedAt") or d_ai.get("updated_at")
        except Exception:
            pass

        try:
            r_roi = self._request_with_failover("GET", "/anpr/roi/CAM-GJ-AHM-SNTL-000001", timeout=0.8)
            if r_roi and r_roi.status_code == 200:
                d_roi = r_roi.json().get("data", {})
                roi_ver = d_roi.get("updated_at") or d_roi.get("updatedAt")
        except Exception:
            pass

        return {
            "status": "success",
            "ai_configs_updated_at": str(ai_ver) if ai_ver else None,
            "rois_updated_at": str(roi_ver) if roi_ver else None
        }

    # 1. Fetch Active Watchlist
    def get_watchlist(self) -> List[str]:
        res = self._request_with_failover("GET", "/anpr/watchlist")
        if res and res.status_code == 200:
            try:
                return res.json().get("watchlist", [])
            except Exception:
                pass
        return []

    # 2. Fetch Export Camera Feeds Catalog
    def get_export_feeds(self) -> List[Dict[str, Any]]:
        res = self._request_with_failover("GET", "/cameras/export-feeds")
        if res and res.status_code == 200:
            try:
                data = res.json()
                return data.get("cameras", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            except Exception:
                pass
        return []

    # 3. Batch fetch all custom ROIs from RDS / memory store
    def get_all_rois(self) -> Dict[str, Any]:
        """Batch fetch all stored camera ROIs directly in 1 call."""
        roi_map: Dict[str, Any] = {}
        
        # 1. Try /anpr/all-rois
        res = self._request_with_failover("GET", "/anpr/all-rois")
        if res and res.status_code == 200:
            try:
                data = res.json()
                d = data.get("data", {}) if isinstance(data, dict) and "data" in data else data
                if isinstance(d, dict):
                    roi_map.update(d)
            except Exception:
                pass

        # 2. Try /cameras/roi/all
        res2 = self._request_with_failover("GET", "/cameras/roi/all")
        if res2 and res2.status_code == 200:
            try:
                data = res2.json()
                rois_list = data.get("rois", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                for item in rois_list:
                    if isinstance(item, dict) and item.get("camera_code"):
                        roi_map[item["camera_code"]] = item
            except Exception:
                pass

        # 3. Fast prefetch active Sentinel Camera 1 if not in bulk response
        if "CAM-GJ-AHM-SNTL-000001" not in roi_map and "CAM-001" not in roi_map:
            res_cam1 = self._request_with_failover("GET", "/anpr/roi/CAM-GJ-AHM-SNTL-000001", timeout=1.0)
            if res_cam1 and res_cam1.status_code == 200:
                try:
                    data = res_cam1.json()
                    d = data.get("data") if isinstance(data, dict) and "data" in data else data
                    if d:
                        roi_map["CAM-GJ-AHM-SNTL-000001"] = d
                        roi_map["CAM-001"] = d
                except Exception:
                    pass

        return roi_map

    # 4. Batch fetch all custom AI configs in 1 call
    def get_all_ai_configs(self) -> Dict[str, Any]:
        """Batch fetch all camera AI Model configs directly in 1 call."""
        ai_map: Dict[str, Any] = {}

        # 1. Try /anpr/all-ai-configs
        res = self._request_with_failover("GET", "/anpr/all-ai-configs")
        if res and res.status_code == 200:
            try:
                data = res.json()
                d = data.get("data", {}) if isinstance(data, dict) and "data" in data else data
                if isinstance(d, dict):
                    ai_map.update(d)
            except Exception:
                pass

        # 2. Try /cameras/ai-config/all
        res2 = self._request_with_failover("GET", "/cameras/ai-config/all")
        if res2 and res2.status_code == 200:
            try:
                data = res2.json()
                configs_list = data.get("ai_configs", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                for item in configs_list:
                    if isinstance(item, dict) and item.get("camera_code"):
                        ai_map[item["camera_code"]] = item
            except Exception:
                pass

        # 3. Fast prefetch active Sentinel Camera 1 if not in bulk response
        if "CAM-GJ-AHM-SNTL-000001" not in ai_map and "CAM-001" not in ai_map:
            res_cam1 = self._request_with_failover("GET", "/cameras/CAM-GJ-AHM-SNTL-000001/ai-config", timeout=1.0)
            if res_cam1 and res_cam1.status_code == 200:
                try:
                    cfg = res_cam1.json()
                    if cfg:
                        ai_map["CAM-GJ-AHM-SNTL-000001"] = cfg
                        ai_map["CAM-001"] = cfg
                except Exception:
                    pass

        return ai_map

    # 5. Build and Export Multi-Usecase Location Grouped Catalog
    # ZERO HTTP CALLS INSIDE THE LOOP: Pure in-memory resolution from pre-fetched batch maps
    def get_grouped_location_catalog(
        self,
        all_rois_map: Optional[Dict[str, Any]] = None,
        all_ai_map: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        feeds = self.get_export_feeds()
        locations_map: Dict[str, Dict[str, Any]] = {}

        if all_rois_map is None:
            all_rois_map = self.get_all_rois()
        if all_ai_map is None:
            all_ai_map = self.get_all_ai_configs()

        for index, cam in enumerate(feeds):
            district = cam.get("district") or cam.get("city") or "Ahmedabad"
            loc_id = f"LOC-{district.upper().replace(' ', '-')}"

            if loc_id not in locations_map:
                locations_map[loc_id] = {
                    "location_id": loc_id,
                    "location_name": f"{district} Junction Grid",
                    "latitude": float(cam.get("latitude", 23.0612)),
                    "longitude": float(cam.get("longitude", 72.5804)),
                    "cameras": []
                }

            code = cam.get("camera_code") or f"CAM-{index+1:03d}"
            raw_enable = cam.get("enable")
            aliases = get_code_aliases(code)
            
            # Resolve AI vision model config strictly from batch map
            ai_cfg = None
            if all_ai_map:
                for alias in aliases:
                    if alias in all_ai_map:
                        ai_cfg = all_ai_map[alias]
                        break

            # Build 4-element enable vector: [ANPR, FRS, PPE, Footfall]
            if ai_cfg and "enable" in ai_cfg and isinstance(ai_cfg["enable"], list):
                enable_vector = [int(bool(x)) for x in ai_cfg["enable"]][:4]
                while len(enable_vector) < 4:
                    enable_vector.append(0)
            elif ai_cfg and "ai_models" in ai_cfg and isinstance(ai_cfg["ai_models"], list):
                models_list = [str(x).upper() for x in ai_cfg["ai_models"]]
                enable_vector = [
                    1 if any("ANPR" in m or "VEHICLE" in m or "PLATE" in m for m in models_list) else 0,
                    1 if any("FACE" in m or "FRS" in m or "PERSON" in m for m in models_list) else 0,
                    1 if any("PPE" in m or "SAFETY" in m or "HELMET" in m for m in models_list) else 0,
                    1 if any("FOOTFALL" in m or "CROWD" in m or "COUNT" in m for m in models_list) else 0
                ]
            elif ai_cfg and "models" in ai_cfg and isinstance(ai_cfg["models"], dict):
                m = ai_cfg["models"]
                enable_vector = [
                    1 if m.get("anpr") else 0,
                    1 if m.get("frs") else 0,
                    1 if m.get("ppe") else 0,
                    1 if m.get("footfall") else 0
                ]
            elif isinstance(raw_enable, list) and len(raw_enable) == 4:
                enable_vector = [int(bool(x)) for x in raw_enable]
            elif isinstance(raw_enable, (int, bool)) and raw_enable:
                enable_vector = [1, 0, 0, 0]
            else:
                enable_vector = [0, 0, 0, 0]

            # Resolve custom ROI strictly from batch map
            roi_info = None
            if all_rois_map:
                for alias in aliases:
                    if alias in all_rois_map:
                        roi_info = all_rois_map[alias]
                        break

            # Build standardized 4-ROI array:
            # rois[0] = ANPR, rois[1] = FRS, rois[2] = PPE, rois[3] = Footfall
            usecase_polygons: Dict[int, List[List[int]]] = {}

            if roi_info and isinstance(roi_info, dict):
                # 1. Structured usecase_rois object: {"anpr": [...], "frs": [...], "ppe": [...], "footfall": [...]}
                u_rois = roi_info.get("usecase_rois")
                if u_rois and isinstance(u_rois, dict):
                    if u_rois.get("anpr") and isinstance(u_rois["anpr"], list) and len(u_rois["anpr"]) >= 3:
                        usecase_polygons[0] = u_rois["anpr"]
                    if u_rois.get("frs") and isinstance(u_rois["frs"], list) and len(u_rois["frs"]) >= 3:
                        usecase_polygons[1] = u_rois["frs"]
                    if u_rois.get("ppe") and isinstance(u_rois["ppe"], list) and len(u_rois["ppe"]) >= 3:
                        usecase_polygons[2] = u_rois["ppe"]
                    if u_rois.get("footfall") and isinstance(u_rois["footfall"], list) and len(u_rois["footfall"]) >= 3:
                        usecase_polygons[3] = u_rois["footfall"]

                # 2. Direct usecase keys on root
                usecase_keys = [
                    ["anpr", "anpr_roi", "lane", "zone_1", "zone1"],
                    ["face_recognition", "frs", "entry", "zone_2", "zone2"],
                    ["ppe", "safety", "zone_3", "zone3"],
                    ["footfall", "crowd", "corridor", "zone_4", "zone4"]
                ]
                for u_idx, keys in enumerate(usecase_keys):
                    if u_idx in usecase_polygons:
                        continue
                    for k in keys:
                        if k in roi_info and roi_info[k]:
                            val = roi_info[k]
                            if isinstance(val, list) and len(val) >= 3 and isinstance(val[0], list):
                                usecase_polygons[u_idx] = val
                                break
                            elif isinstance(val, dict) and "points" in val and isinstance(val["points"], list):
                                usecase_polygons[u_idx] = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in val["points"] if isinstance(p, dict)]
                                break

                # 3. Multi-zone list
                zones = roi_info.get("zones") or roi_info.get("rois") or roi_info.get("polygons")
                if zones and isinstance(zones, list):
                    for z in zones:
                        if not isinstance(z, dict):
                            continue
                        u_tag = str(z.get("usecase") or "").upper()
                        pts = z.get("points") or z.get("coordinates")
                        if not pts or not isinstance(pts, list) or len(pts) < 3:
                            continue
                        parsed_pts = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts if isinstance(p, dict)] if isinstance(pts[0], dict) else pts

                        if "ANPR" in u_tag or "LANE" in u_tag:
                            usecase_polygons[0] = parsed_pts
                        elif "FACE" in u_tag or "FRS" in u_tag or "ENTRY" in u_tag:
                            usecase_polygons[1] = parsed_pts
                        elif "PPE" in u_tag or "SAFETY" in u_tag or "HELMET" in u_tag:
                            usecase_polygons[2] = parsed_pts
                        elif "FOOTFALL" in u_tag or "CROWD" in u_tag or "CORRIDOR" in u_tag:
                            usecase_polygons[3] = parsed_pts

                # 3b. Group points by usecase / label if points array is present
                raw_pts = roi_info.get("points")
                if not raw_pts and roi_info.get("points_json"):
                    try:
                        raw_pts = json.loads(roi_info["points_json"])
                    except Exception:
                        pass
                if raw_pts and isinstance(raw_pts, list):
                    uc_buckets: Dict[str, List[List[int]]] = {}
                    for pt in raw_pts:
                        if isinstance(pt, dict) and "x" in pt and "y" in pt:
                            uc = str(pt.get("usecase") or pt.get("label") or "").upper()
                            coord = [int(pt["x"]), int(pt["y"])]
                            for key_str in ["FOOTFALL", "ANPR", "FACE", "FRS", "PPE"]:
                                if key_str in uc:
                                    uc_buckets.setdefault(key_str, []).append(coord)
                                    break
                    if "ANPR" in uc_buckets and len(uc_buckets["ANPR"]) >= 3 and 0 not in usecase_polygons:
                        usecase_polygons[0] = uc_buckets["ANPR"]
                    if ("FACE" in uc_buckets or "FRS" in uc_buckets) and 1 not in usecase_polygons:
                        usecase_polygons[1] = uc_buckets.get("FACE") or uc_buckets.get("FRS")
                    if "PPE" in uc_buckets and len(uc_buckets["PPE"]) >= 3 and 2 not in usecase_polygons:
                        usecase_polygons[2] = uc_buckets["PPE"]
                    if "FOOTFALL" in uc_buckets and len(uc_buckets["FOOTFALL"]) >= 3 and 3 not in usecase_polygons:
                        usecase_polygons[3] = uc_buckets["FOOTFALL"]

                # 4. Single polygon fallback to ANPR or active usecase
                if not usecase_polygons:
                    pts = roi_info.get("points") or roi_info.get("coordinates") or roi_info.get("roi", {}).get("coordinates")
                    if pts and isinstance(pts, list) and len(pts) >= 3:
                        coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts if isinstance(p, dict)] if isinstance(pts[0], dict) else pts
                        first_active = 0
                        for idx, en in enumerate(enable_vector):
                            if en:
                                first_active = idx
                                break
                        usecase_polygons[first_active] = coords

            # Build final 4-element ROIs array
            camera_rois = []
            for roi_idx in range(len(STANDARD_USECASES)):
                if roi_idx in usecase_polygons:
                    camera_rois.append(usecase_polygons[roi_idx])
                else:
                    camera_rois.append(DEFAULT_ROIS[roi_idx])

            locations_map[loc_id]["cameras"].append({
                "camera_code": code,
                "camera_name": cam.get("name") or f"Camera {code}",
                "enable": enable_vector,
                "usecases": STANDARD_USECASES,
                "rtsp": format_rtsp_url(cam.get("rtsp_url") or cam.get("endpointReference") or ""),
                "latitude": float(cam.get("latitude", 23.0612)),
                "longitude": float(cam.get("longitude", 72.5804)),
                "roi": camera_rois[0],
                "rois": camera_rois
            })

        loc_list = list(locations_map.values())

        # Append offline FRS clips and Forensic videos as virtual camera feeds for DeepStream / OpenCV
        try:
            offline_cams = self.get_offline_media_cameras()
            if offline_cams and loc_list:
                loc_list[0]["cameras"].extend(offline_cams)
        except Exception as e:
            print(f"[OFFLINE MEDIA MERGE WARN] {e}")

        total_cameras = sum(len(loc["cameras"]) for loc in loc_list)
        return {
            "status": "success",
            "total_locations": len(loc_list),
            "total_cameras": total_cameras,
            "export_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "locations": loc_list
        }

    def get_offline_media_cameras(self) -> List[Dict[str, Any]]:
        """
        Dynamically merges offline FRS 1-minute suspect clips and Forensic video footage
        as virtual camera entries in cameras.json for DeepStream / OpenCV offline ingestion.
        """
        offline_cameras: List[Dict[str, Any]] = []

        # 1. Ingest FRS Suspect Clips (from local faces.json or cloud endpoint)
        frs_targets = []
        if os.path.exists("faces.json"):
            try:
                with open("faces.json", "r", encoding="utf-8") as f:
                    frs_data = json.load(f)
                    frs_targets = frs_data.get("targets", [])
            except Exception:
                pass

        if not frs_targets:
            res_frs = self._request_with_failover("GET", "/frs/export-targets", timeout=1.5)
            if res_frs and res_frs.status_code == 200:
                try:
                    frs_targets = res_frs.json().get("targets", [])
                except Exception:
                    pass

        for tgt in frs_targets:
            pid = tgt.get("person_id") or tgt.get("id") or "TGT"
            slug = tgt.get("slug") or pid.lower().replace("-", "_")
            pname = tgt.get("person_name") or slug
            cid = tgt.get("case_id") or "N/A"
            clip_p = tgt.get("media_path") or f"clips/{slug}/clip.mp4"

            offline_cameras.append({
                "camera_code": f"CAM-FRS-{slug.upper()}",
                "camera_name": f"[FRS Offline Clip] {pname} (Case: {cid})",
                "source_type": "OFFLINE_CLIP",
                "enable": [0, 1, 0, 0],
                "usecases": STANDARD_USECASES,
                "rtsp": f"file://$PWD/{clip_p}",
                "local_path": clip_p,
                "latitude": 23.0612,
                "longitude": 72.5804,
                "roi": [],
                "rois": []
            })

        # 2. Ingest Forensic Analysis Videos (from local forensics.json or cloud endpoint)
        forensic_tasks = []
        if os.path.exists("forensics.json"):
            try:
                with open("forensics.json", "r", encoding="utf-8") as f:
                    for_data = json.load(f)
                    forensic_tasks = for_data.get("tasks", [])
            except Exception:
                pass

        if not forensic_tasks:
            res_for = self._request_with_failover("GET", "/forensics/export-tasks", timeout=1.5)
            if res_for and res_for.status_code == 200:
                try:
                    forensic_tasks = res_for.json().get("tasks", [])
                except Exception:
                    pass

        for tsk in forensic_tasks:
            tid = tsk.get("task_id") or "TSK"
            cid = tsk.get("case_id") or "N/A"
            fn = tsk.get("filename") or tsk.get("footage_name") or f"{tid.lower()}.mp4"
            vid_p = tsk.get("video_path") or f"forensics/{tid}/{fn}"
            
            task_enable = tsk.get("enable") or [1, 0, 0, 0]

            offline_cameras.append({
                "camera_code": f"CAM-FOR-{tid}",
                "camera_name": f"[Forensic Offline Video] {fn} (Case: {cid})",
                "source_type": "OFFLINE_FORENSIC_VIDEO",
                "enable": task_enable,
                "usecases": STANDARD_USECASES,
                "rtsp": f"file://$PWD/{vid_p}",
                "local_path": vid_p,
                "latitude": 23.0612,
                "longitude": 72.5804,
                "roi": [],
                "rois": []
            })

        return offline_cameras

    # Alert Ingest
    def send_anpr_alert(
        self,
        number_plate: str,
        camera_code: str = "CAM-001",
        camera_id: int = 1,
        watchlist_hit: bool = False,
        severity: str = "CRITICAL",
        notes: str = "ANPR Detection Hit",
        snapshot_base64: Optional[str] = None,
        async_send: bool = True
    ) -> bool:
        payload = {
            "camera_id": camera_id,
            "camera_code": camera_code,
            "number_plate": number_plate.upper(),
            "watchlist_hit": watchlist_hit,
            "severity": severity if watchlist_hit else "INFO",
            "notes": notes,
            "date": time.strftime("%Y-%m-%d"),
            "time": time.strftime("%H:%M:%S")
        }
        if snapshot_base64:
            payload["snapshot"] = snapshot_base64

        if async_send and self.enable_background_queue:
            try:
                self.alert_queue.put_nowait(payload)
                return True
            except queue.Full:
                pass

        return self._send_alert_sync(payload)

    def _send_alert_sync(self, payload: Dict[str, Any]) -> bool:
        res = self._request_with_failover("POST", "/anpr/ingest", json=payload)
        return bool(res and res.status_code in [200, 201])

    def _background_alert_worker(self):
        while True:
            try:
                payload = self.alert_queue.get()
                if payload is None:
                    break
                self._send_alert_sync(payload)
                self.alert_queue.task_done()
            except Exception:
                pass


# ──────────────────────────────────────────────
# ACTIVE CAMERA LISTENER (DAEMON LOOP)
# ──────────────────────────────────────────────

class ZTracsActiveCameraListener:
    def __init__(
        self,
        client: Optional[ZTracsBuddyClient] = None,
        poll_interval: float = 2.0,
        json_filename: str = CAMERAS_JSON_FILE,
        state_filename: str = STATE_FILE,
        max_missing_polls: int = 2
    ):
        self.client = client or ZTracsBuddyClient()
        self.poll_interval = poll_interval
        self.json_filename = json_filename
        self.state_filename = state_filename
        self.max_missing_polls = max_missing_polls
        self.active_cameras: Dict[str, Dict[str, Any]] = {}
        self.missing_counts: Dict[str, int] = {}
        self.is_running = False

        self.last_sync_state = self._load_sync_state()
        self.cached_rois: Dict[str, Any] = {}
        self.cached_ai_configs: Dict[str, Any] = {}

        self.on_added_cb: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_deleted_cb: Optional[Callable[[str], None]] = None
        self.on_updated_cb: Optional[Callable[[Dict[str, Any]], None]] = None

    def _load_sync_state(self) -> Dict[str, Any]:
        if os.path.exists(self.state_filename):
            try:
                with open(self.state_filename, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"ai_configs_updated_at": None, "rois_updated_at": None}

    def _save_sync_state(self, state: Dict[str, Any]):
        try:
            with open(self.state_filename, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
            self.last_sync_state = state
        except Exception:
            pass

    def _write_atomic_json(self, data: Dict[str, Any]):
        tmp_file = f"{self.json_filename}.tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_file, self.json_filename)

    def on_camera_added(self, fn: Callable[[Dict[str, Any]], None]):
        self.on_added_cb = fn
        return fn

    def on_camera_deleted(self, fn: Callable[[str], None]):
        self.on_deleted_cb = fn
        return fn

    def on_camera_updated(self, fn: Callable[[Dict[str, Any]], None]):
        self.on_updated_cb = fn
        return fn

    def start(self, blocking: bool = True):
        self.is_running = True
        print(f"[Z-TRACS LISTENER] Active Listener Started! Polling change-detection every {self.poll_interval}s...")

        if blocking:
            self._listen_loop()
        else:
            t = threading.Thread(target=self._listen_loop, daemon=True)
            t.start()

    def stop(self):
        self.is_running = False

    def sync_cameras_json(self, force: bool = False):
        try:
            need_rois_fetch = force or not self.cached_rois
            need_ai_fetch = force or not self.cached_ai_configs

            if need_rois_fetch:
                self.cached_rois = self.client.get_all_rois()
            if need_ai_fetch:
                self.cached_ai_configs = self.client.get_all_ai_configs()

            catalog = self.client.get_grouped_location_catalog(
                all_rois_map=self.cached_rois,
                all_ai_map=self.cached_ai_configs
            )
            self._write_atomic_json(catalog)
            print(f"[Z-TRACS LISTENER] Synchronized '{self.json_filename}' to disk ({catalog.get('total_cameras', 0)} cameras)")
        except Exception as e:
            print(f"[Z-TRACS LISTENER] Error writing '{self.json_filename}': {e}")

    def _listen_loop(self):
        initial_load = True
        while self.is_running:
            try:
                # 1. Quick Change-Detection via /anpr/sync-version
                sync_ver = self.client.get_sync_version()
                ai_ver = sync_ver.get("ai_configs_updated_at")
                roi_ver = sync_ver.get("rois_updated_at")

                ai_changed = (ai_ver != self.last_sync_state.get("ai_configs_updated_at"))
                roi_changed = (roi_ver != self.last_sync_state.get("rois_updated_at"))
                file_missing = not os.path.exists(self.json_filename)

                # 2. Fetch feeds for stream changes
                feeds = self.client.get_export_feeds()
                current_codes = set()
                streams_changed = False

                for cam in feeds:
                    code = cam.get("camera_code") or cam.get("id")
                    if not code:
                        continue
                    current_codes.add(code)
                    self.missing_counts[code] = 0

                    rtsp_clean = format_rtsp_url(cam.get("rtsp_url") or cam.get("endpointReference") or "")
                    cam_clean = {**cam, "rtsp_url": rtsp_clean}

                    if code not in self.active_cameras:
                        self.active_cameras[code] = cam_clean
                        streams_changed = True
                        if not initial_load:
                            print(f"\n[EVENT] [NEW CAMERA ADDED] '{code}' | RTSP: {rtsp_clean}")
                            if self.on_added_cb:
                                self.on_added_cb(cam_clean)
                    else:
                        old_cam = self.active_cameras[code]
                        if old_cam.get("rtsp_url") != rtsp_clean:
                            print(f"\n[EVENT] [RTSP URL UPDATED] '{code}': {old_cam.get('rtsp_url')} -> {rtsp_clean}")
                            self.active_cameras[code] = cam_clean
                            streams_changed = True
                            if self.on_updated_cb:
                                self.on_updated_cb(cam_clean)

                if not initial_load:
                    candidate_deleted = set(self.active_cameras.keys()) - current_codes
                    for dcode in candidate_deleted:
                        self.missing_counts[dcode] = self.missing_counts.get(dcode, 0) + 1
                        if self.missing_counts[dcode] >= self.max_missing_polls:
                            print(f"\n[EVENT] [CAMERA DELETED] '{dcode}'")
                            del self.active_cameras[dcode]
                            del self.missing_counts[dcode]
                            streams_changed = True

                # 3. Check for offline media changes (faces.json & forensics.json)
                faces_m = os.path.getmtime("faces.json") if os.path.exists("faces.json") else 0
                forensics_m = os.path.getmtime("forensics.json") if os.path.exists("forensics.json") else 0
                offline_changed = (faces_m != getattr(self, "_last_faces_mtime", 0)) or (forensics_m != getattr(self, "_last_forensics_mtime", 0))
                self._last_faces_mtime = faces_m
                self._last_forensics_mtime = forensics_m

                # 4. Only rebuild JSON when AI configs, ROIs, streams, offline media changed or file is missing
                if initial_load or file_missing or ai_changed or roi_changed or streams_changed or offline_changed:
                    self.cached_ai_configs = self.client.get_all_ai_configs()
                    self.cached_rois = self.client.get_all_rois()

                    catalog = self.client.get_grouped_location_catalog(
                        all_rois_map=self.cached_rois,
                        all_ai_map=self.cached_ai_configs
                    )
                    self._write_atomic_json(catalog)

                    self._save_sync_state({
                        "ai_configs_updated_at": ai_ver,
                        "rois_updated_at": roi_ver
                    })
                    
                    if not initial_load:
                        reason = "Offline Media (FRS/Forensics)" if offline_changed else "Camera Config/Streams"
                        print(f"\n[EVENT] [EDGE SYNC: {reason}] Rebuilt '{self.json_filename}' with latest state ({catalog.get('total_cameras', 0)} cameras)")

                initial_load = False

            except Exception as e:
                print(f"[Z-TRACS LISTENER] Polling error: {e}")

            time.sleep(self.poll_interval)


# ──────────────────────────────────────────────
# DEMO EXECUTION OF ACTIVE LISTENER
# ──────────────────────────────────────────────
if __name__ == "__main__":
    poll_sec = 2.0
    if len(sys.argv) > 1:
        try:
            poll_sec = float(sys.argv[1])
        except ValueError:
            pass

    print("=" * 65)
    print("Z-TRACS ACTIVE CAMERA LISTENER DAEMON (PRODUCTION)")
    print("=================================================================")
    print(f"Starting continuous active listener (polling every {poll_sec}s)...")
    print("Synchronizing 'cameras.json' automatically...")
    print("Press Ctrl+C to stop.")
    print("=================================================================\n")

    client = ZTracsBuddyClient()
    listener = ZTracsActiveCameraListener(client=client, poll_interval=poll_sec)

    listener.sync_cameras_json(force=True)

    @listener.on_camera_added
    def handle_camera_add(cam):
        print(f" -> [ENGINE COMMAND] STARTING RTSP STREAM PIPELINE for {cam.get('camera_code')}")

    @listener.on_camera_deleted
    def handle_camera_delete(cam_code):
        print(f" -> [ENGINE COMMAND] TERMINATING RTSP STREAM PIPELINE for {cam_code}")

    @listener.on_camera_updated
    def handle_camera_update(cam):
        print(f" -> [ENGINE COMMAND] RESTARTING RTSP STREAM PIPELINE for {cam.get('camera_code')}")

    try:
        listener.start(blocking=True)
    except KeyboardInterrupt:
        print("\nStopping Z-TRACS Active Listener...")
