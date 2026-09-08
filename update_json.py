"""
Z-TRACS Buddy SDK & Edge Client + Active Camera Listener Daemon (Production Ready)
-----------------------------------------------------------------------------------
Designed for DeepStream / TAO / YOLO / LPR Edge Nodes (Nvidia Jetson / Linux GPU Servers)

Features:
 1. ACTIVE CAMERA LISTENER with REAL-TIME CHANGE-DETECTION:
    - Automatically syncs whenever camera ROIs, AI model configs, or RTSP streams change
    - Fast lightweight batch polling via /cameras/export-feeds, /cameras/roi/all, /cameras/ai-config/all
 2. Multi-Server Failover Hierarchy:
    - Primary:   AWS EC2 Direct (http://43.204.235.231:8000/api/v1)
    - Secondary: Vercel Proxy HTTPS (https://z-tracs.vercel.app/api/v1)
    - Tertiary:  Localhost (http://localhost:8000/api/v1 - local development only)
 3. Atomic File Writes: Writes to .tmp and renames to prevent inference worker race conditions
 4. Multi-Usecase ROI Resolution (ANPR, Face Recognition, PPE, Footfall)
"""

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

def get_code_aliases(code: str) -> List[str]:
    if not code:
        return []
    code = str(code).strip()
    canonical = normalize_camera_code(code)
    aliases = [code, canonical]
    m = re.search(r'(\d+)$', code)
    if m:
        num = int(m.group(1))
        aliases.extend([f"CAM-{num:03d}", f"CAM-{num}"])
        if "SNTL" in code:
            aliases.append(f"CAM-GJ-AHM-SNTL-{num:06d}")
        elif "TRF" in code:
            aliases.append(f"CAM-GJ-AHM-TRF-{num:06d}")
        elif "MNC" in code:
            aliases.append(f"CAM-GJ-AHM-MNC-{num:06d}")
    return list(dict.fromkeys(aliases))

STANDARD_USECASES = ["ANPR", "FACE_RECOGNITION", "PPE", "FOOTFALL"]

DEFAULT_ROIS = [
    # 1. ANPR Lane Polygon
    [[100, 200], [800, 200], [900, 900], [50, 900]],
    # 2. Face Recognition Entry Zone
    [[200, 150], [600, 150], [600, 750], [200, 750]],
    # 3. PPE Safety Zone
    [[50, 100], [950, 100], [950, 950], [50, 950]],
    # 4. Footfall Counting Corridor
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
        timeout: float = 3.0,
        enable_background_queue: bool = True
    ):
        """
        Production Grade Z-TRACS Edge AI Client.
        """
        self.endpoints = [
            primary_url.rstrip('/'),
            secondary_url.rstrip('/'),
            tertiary_url.rstrip('/')
        ]
        self.timeout = timeout
        
        # Setup Connection Pooling & Auto Retry Session
        self.session = requests.Session()
        retry_strategy = Retry(
            total=1,
            backoff_factor=0.2,
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Fast in-memory cache to prevent redundant network queries
        self._roi_cache: Dict[str, Any] = {}
        self._ai_cache: Dict[str, Any] = {}

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

    # 1. Fetch Export Camera Feeds Catalog
    def get_export_feeds(self) -> List[Dict[str, Any]]:
        """Fetch list of all live cameras with RTSP URLs and metadata."""
        res = self._request_with_failover("GET", "/cameras/export-feeds")
        if res and res.status_code == 200:
            try:
                data = res.json()
                return data.get("cameras", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            except Exception:
                pass
        return []

    # 2. Batch fetch all custom ROIs
    def get_all_rois(self) -> Dict[str, Any]:
        """Batch fetch all stored camera ROIs directly from backend."""
        roi_map: Dict[str, Any] = {}
        
        # 1. Try /cameras/roi/all
        res = self._request_with_failover("GET", "/cameras/roi/all")
        if res and res.status_code == 200:
            try:
                data = res.json()
                rois_list = data.get("rois", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                for item in rois_list:
                    if isinstance(item, dict):
                        code = item.get("camera_code")
                        if code:
                            roi_map[code] = item
            except Exception:
                pass

        # 2. Try /anpr/all-rois
        res2 = self._request_with_failover("GET", "/anpr/all-rois")
        if res2 and res2.status_code == 200:
            try:
                data = res2.json()
                rois_dict = data.get("data", {}) if isinstance(data, dict) and "data" in data else data
                if isinstance(rois_dict, dict):
                    for code, roi in rois_dict.items():
                        if isinstance(roi, dict):
                            roi_map[code] = roi
            except Exception:
                pass

        return roi_map

    # 3. Batch fetch all custom AI Vision Model configs
    def get_all_ai_configs(self) -> Dict[str, Any]:
        """Batch fetch all stored camera AI Model configs directly from backend."""
        ai_map: Dict[str, Any] = {}
        
        # 1. Try /cameras/ai-config/all
        res = self._request_with_failover("GET", "/cameras/ai-config/all")
        if res and res.status_code == 200:
            try:
                data = res.json()
                configs_list = data.get("ai_configs", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                for item in configs_list:
                    if isinstance(item, dict):
                        code = item.get("camera_code")
                        if code:
                            ai_map[code] = item
            except Exception:
                pass

        # 2. Try /anpr/all-ai-configs
        res2 = self._request_with_failover("GET", "/anpr/all-ai-configs")
        if res2 and res2.status_code == 200:
            try:
                data = res2.json()
                configs_dict = data.get("data", {}) if isinstance(data, dict) and "data" in data else data
                if isinstance(configs_dict, dict):
                    for code, cfg in configs_dict.items():
                        if isinstance(cfg, dict):
                            ai_map[code] = cfg
            except Exception:
                pass

        return ai_map

    # 4. Fetch Structured ROI for single Camera Node (fallback with fast in-memory cache)
    def get_camera_roi(self, camera_code: str) -> Optional[Dict[str, Any]]:
        if camera_code in self._roi_cache:
            return self._roi_cache[camera_code]

        # Try fast lookup from session
        aliases = get_code_aliases(camera_code)
        for code in aliases:
            for ep in [f"/anpr/roi/{code}", f"/cameras/{code}/roi"]:
                try:
                    res = self._request_with_failover("GET", ep, timeout=1.0)
                    if res and res.status_code == 200:
                        data = res.json()
                        d = data.get("data") if isinstance(data, dict) and "data" in data else (data.get("roi") if isinstance(data, dict) and "roi" in data else data)
                        if d and isinstance(d, dict) and (d.get("points") or d.get("zones") or d.get("usecase_rois") or d.get("coordinates") or d.get("roi")):
                            for a in aliases:
                                self._roi_cache[a] = d
                            self._roi_cache[camera_code] = d
                            return d
                except Exception:
                    pass
        self._roi_cache[camera_code] = None
        return None

    # 5. Fetch Assigned AI Vision Models & Config for single camera (fallback with fast in-memory cache)
    def get_camera_ai_config(self, camera_code: str) -> Optional[Dict[str, Any]]:
        if camera_code in self._ai_cache:
            return self._ai_cache[camera_code]

        aliases = get_code_aliases(camera_code)
        for code in aliases:
            for ep in [f"/cameras/{code}/ai-config", f"/anpr/ai-config/{code}"]:
                try:
                    res = self._request_with_failover("GET", ep, timeout=1.0)
                    if res and res.status_code == 200:
                        data = res.json()
                        d = data.get("data") if isinstance(data, dict) and "data" in data else (data.get("ai_config") if isinstance(data, dict) and "ai_config" in data else data)
                        if d and isinstance(d, dict) and ("enable" in d or "models" in d or "ai_models" in d):
                            for a in aliases:
                                self._ai_cache[a] = d
                            self._ai_cache[camera_code] = d
                            return d
                except Exception:
                    pass
        self._ai_cache[camera_code] = None
        return None

    # 6. Build and Export Multi-Usecase Location Grouped Catalog
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
            
            # Resolve AI vision model config
            ai_cfg = None
            if all_ai_map:
                for alias in aliases:
                    if alias in all_ai_map:
                        ai_cfg = all_ai_map[alias]
                        break
            elif not all_ai_map:
                ai_cfg = self.get_camera_ai_config(code)

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

            # Resolve custom ROI
            roi_info = None
            if all_rois_map:
                for alias in aliases:
                    if alias in all_rois_map:
                        roi_info = all_rois_map[alias]
                        break
            elif not all_rois_map:
                roi_info = self.get_camera_roi(code)

            # Build standardized ROIs array (1 polygon per usecase)
            usecase_polygons: Dict[int, List[List[int]]] = {}

            if roi_info and isinstance(roi_info, dict):
                # 0. Check structured usecase_rois map
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

                # 1. Check direct usecase-keyed dictionary
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

                # 2. Check multi-zone array
                zones = roi_info.get("zones") or roi_info.get("rois") or roi_info.get("polygons")
                if zones and isinstance(zones, list):
                    for z_idx, z in enumerate(zones):
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
                        elif "PPE" in u_tag or "SAFETY" in u_tag:
                            usecase_polygons[2] = parsed_pts
                        elif "FOOTFALL" in u_tag or "CROWD" in u_tag or "CORRIDOR" in u_tag:
                            usecase_polygons[3] = parsed_pts
                        elif z_idx < len(STANDARD_USECASES) and z_idx not in usecase_polygons:
                            usecase_polygons[z_idx] = parsed_pts

                # 3. Check flat points list
                flat_pts = roi_info.get("points")
                if flat_pts and isinstance(flat_pts, list) and len(flat_pts) >= 3 and isinstance(flat_pts[0], dict):
                    grouped_by_tag: Dict[str, List[List[int]]] = {}
                    for p in flat_pts:
                        tag = str(p.get("usecase") or p.get("zone_id") or p.get("label") or "").upper()
                        x, y = int(p.get("x", 0)), int(p.get("y", 0))
                        if tag:
                            grouped_by_tag.setdefault(tag, []).append([x, y])

                    for tag, pts_list in grouped_by_tag.items():
                        if len(pts_list) >= 3:
                            if "ANPR" in tag or "LANE" in tag or "Z1" in tag:
                                usecase_polygons.setdefault(0, pts_list)
                            elif "FACE" in tag or "FRS" in tag or "ENTRY" in tag or "Z2" in tag:
                                usecase_polygons.setdefault(1, pts_list)
                            elif "PPE" in tag or "SAFETY" in tag or "Z3" in tag:
                                usecase_polygons.setdefault(2, pts_list)
                            elif "FOOTFALL" in tag or "CROWD" in tag or "CORRIDOR" in tag or "Z4" in tag:
                                usecase_polygons.setdefault(3, pts_list)

                # 4. Single polygon fallback
                if not usecase_polygons:
                    pts = roi_info.get("points") or roi_info.get("coordinates") or roi_info.get("roi", {}).get("coordinates") or roi_info.get("roi", {}).get("points")
                    if pts and isinstance(pts, list) and len(pts) >= 3:
                        if isinstance(pts[0], dict):
                            coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts if isinstance(p, dict)]
                        else:
                            coords = pts
                        first_active = 0
                        for idx, en in enumerate(enable_vector):
                            if en:
                                first_active = idx
                                break
                        usecase_polygons[first_active] = coords

            camera_rois = []
            for roi_idx in range(len(STANDARD_USECASES)):
                if roi_idx in usecase_polygons:
                    camera_rois.append(usecase_polygons[roi_idx])
                else:
                    camera_rois.append(DEFAULT_ROIS[roi_idx])

            rtsp_link = cam.get("rtsp_url") or cam.get("rtsp") or cam.get("endpointReference") or cam.get("rtspUrl") or ""
            if "103.250.160.189:8554" in rtsp_link and "@" not in rtsp_link:
                rtsp_link = rtsp_link.replace("103.250.160.189:8554", "admin%40zeexai.com:RCVN-BJ7U-UCA4@103.250.160.189:8554")
            elif not rtsp_link:
                m_idx = re.search(r'(\d+)$', code)
                cam_num = int(m_idx.group(1)) if m_idx else index + 1
                rtsp_link = f"rtsp://admin%40zeexai.com:RCVN-BJ7U-UCA4@103.250.160.189:8554/stream/cam{cam_num:02d}"

            locations_map[loc_id]["cameras"].append({
                "camera_code": code,
                "camera_name": cam.get("name") or f"Camera {code}",
                "enable": enable_vector,
                "usecases": STANDARD_USECASES,
                "rtsp": rtsp_link,
                "latitude": float(cam.get("latitude", 23.0612)),
                "longitude": float(cam.get("longitude", 72.5804)),
                "rois": camera_rois
            })

        loc_list = list(locations_map.values())
        return {
            "status": "success",
            "total_locations": len(loc_list),
            "total_cameras": len(feeds),
            "export_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "locations": loc_list
        }

    def _send_alert_sync(self, payload: Dict[str, Any]) -> bool:
        res = self._request_with_failover("POST", "/anpr/ingest", json=payload)
        return bool(res and res.status_code in [200, 201])

    def _background_alert_worker(self):
        while True:
            try:
                payload = self.alert_queue.get()
                self._send_alert_sync(payload)
                self.alert_queue.task_done()
            except Exception:
                pass


# ──────────────────────────────────────────────
# ACTIVE CAMERA LISTENER CLASS
# ──────────────────────────────────────────────
class ZTracsActiveCameraListener:
    def __init__(
        self,
        client: Optional[ZTracsBuddyClient] = None,
        poll_interval: float = 3.0,
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

        # Callback Handlers
        self.on_added_cb: Optional[Callable[[Dict[str, Any]], None]] = None
        self.on_deleted_cb: Optional[Callable[[str], None]] = None
        self.on_updated_cb: Optional[Callable[[Dict[str, Any]], None]] = None

    def _write_atomic_json(self, data: Dict[str, Any]):
        """Write JSON safely using a temporary file and atomic replace."""
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
        print(f"[Z-TRACS LISTENER] Active Listener Started! Polling changes every {self.poll_interval}s...")

        if blocking:
            self._listen_loop()
        else:
            t = threading.Thread(target=self._listen_loop, daemon=True)
            t.start()

    def stop(self):
        self.is_running = False

    def sync_cameras_json(self, force: bool = False):
        try:
            catalog = self.client.get_grouped_location_catalog()
            self._write_atomic_json(catalog)
            print(f"[Z-TRACS LISTENER] Synchronized '{self.json_filename}' to disk ({catalog.get('total_cameras', 0)} cameras)")
            return True
        except Exception as e:
            print(f"[Z-TRACS LISTENER] Error writing '{self.json_filename}': {e}")
            return False

    def _listen_loop(self):
        last_catalog_hash = None
        last_cache_clear = time.time()
        while self.is_running:
            try:
                if time.time() - last_cache_clear > 1.5:
                    self.client._roi_cache.clear()
                    self.client._ai_cache.clear()
                    last_cache_clear = time.time()

                # 1. Fetch export feeds, ROIs, and AI configs in 3 lightweight requests
                feeds = self.client.get_export_feeds()
                all_rois = self.client.get_all_rois()
                all_ai = self.client.get_all_ai_configs()

                current_codes = set()
                for cam in feeds:
                    code = cam.get("camera_code") or cam.get("id")
                    if not code:
                        continue
                    current_codes.add(code)
                    self.missing_counts[code] = 0

                    if code not in self.active_cameras:
                        self.active_cameras[code] = cam
                        if last_catalog_hash is not None:
                            print(f"\n[EVENT] [NEW CAMERA ADDED] '{code}' | RTSP: {cam.get('rtsp_url')}")
                            if self.on_added_cb:
                                self.on_added_cb(cam)
                    else:
                        old_cam = self.active_cameras[code]
                        if old_cam.get("rtsp_url") != cam.get("rtsp_url"):
                            print(f"\n[EVENT] [RTSP URL UPDATED] '{code}': {old_cam.get('rtsp_url')} -> {cam.get('rtsp_url')}")
                            self.active_cameras[code] = cam
                            if self.on_updated_cb:
                                self.on_updated_cb(cam)

                if last_catalog_hash is not None:
                    candidate_deleted = set(self.active_cameras.keys()) - current_codes
                    for dcode in candidate_deleted:
                        self.missing_counts[dcode] = self.missing_counts.get(dcode, 0) + 1
                        if self.missing_counts[dcode] >= self.max_missing_polls:
                            print(f"\n[EVENT] [CAMERA DELETED] '{dcode}'")
                            del self.active_cameras[dcode]
                            del self.missing_counts[dcode]

                # 2. Build current complete catalog
                catalog = self.client.get_grouped_location_catalog(all_rois_map=all_rois, all_ai_map=all_ai)
                
                # Checksum based on cameras core (excluding changing timestamp)
                catalog_core = {
                    "locations": catalog.get("locations", []),
                    "total_cameras": catalog.get("total_cameras", 0)
                }
                catalog_str = json.dumps(catalog_core, sort_keys=True)
                catalog_hash = hash(catalog_str)
                file_missing = not os.path.exists(self.json_filename)

                if catalog_hash != last_catalog_hash or file_missing:
                    self._write_atomic_json(catalog)
                    if last_catalog_hash is not None:
                        print(f"\n[EVENT] [EDGE SYNC] Detected modification from Dashboard/RDS -> Synchronized '{self.json_filename}'! ({catalog.get('total_cameras', 0)} cameras)")
                    else:
                        print(f"[Z-TRACS LISTENER] Initialized '{self.json_filename}' ({catalog.get('total_cameras', 0)} cameras). Ready for live changes.")
                    last_catalog_hash = catalog_hash

            except Exception as e:
                print(f"[Z-TRACS LISTENER] Polling error: {e}")

            time.sleep(self.poll_interval)


# ──────────────────────────────────────────────
# DEMO EXECUTION OF ACTIVE LISTENER
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 65)
    print("Z-TRACS ACTIVE CAMERA LISTENER DAEMON (PRODUCTION)")
    print("=================================================================")
    print("Starting continuous active listener with RDS change-detection...")
    print("Synchronizing 'cameras.json' automatically...")
    print("Press Ctrl+C to stop.")
    print("=================================================================\n")

    poll_time = 0.5
    if len(sys.argv) > 1:
        try:
            poll_time = float(sys.argv[1])
        except ValueError:
            pass

    client = ZTracsBuddyClient()
    listener = ZTracsActiveCameraListener(client=client, poll_interval=poll_time)

    # Initial sync
    listener.sync_cameras_json(force=True)

    @listener.on_camera_added
    def handle_camera_add(cam):
        print(f" -> [ENGINE COMMAND] STARTING RTSP STREAM PIPELINE for {cam.get('camera_code')} ({cam.get('rtsp_url')})")

    @listener.on_camera_deleted
    def handle_camera_delete(cam_code):
        print(f" -> [ENGINE COMMAND] TERMINATING RTSP STREAM PIPELINE for {cam_code}")

    @listener.on_camera_updated
    def handle_camera_update(cam):
        print(f" -> [ENGINE COMMAND] RESTARTING RTSP STREAM PIPELINE for {cam.get('camera_code')} WITH NEW RTSP: {cam.get('rtsp_url')}")

    try:
        listener.start(blocking=True)
    except KeyboardInterrupt:
        print("\nStopping Z-TRACS Active Listener...")
