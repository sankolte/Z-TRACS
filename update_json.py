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
 4. Shared Canonical Camera Aliasing via camera_utils.py
 5. Connection Pooling & Auto-Retries via urllib3 HTTPAdapter
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

# Import canonical camera utilities
try:
    from camera_utils import get_code_aliases, normalize_camera_code, get_sentinel_code
except ImportError:
    def normalize_camera_code(c: str) -> str:
        return c
    def get_sentinel_code(c: str) -> str:
        return c
    def get_code_aliases(c: str) -> List[str]:
        return [c, c.upper(), c.lower()]

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
        timeout: int = 5,
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

    # Check sync version (cheap MAX updated_at call)
    def get_sync_version(self) -> Dict[str, Any]:
        """Fetch lightweight modification timestamps for change-detection."""
        res = self._request_with_failover("GET", "/anpr/sync-version")
        if res and res.status_code == 200:
            try:
                return res.json()
            except Exception:
                pass
        return {}

    # 1. Fetch Active Watchlist (Poll every 60 seconds in Edge Loop)
    def get_watchlist(self) -> List[str]:
        """Fetch list of stolen/hotlisted license plates for real-time edge matching."""
        res = self._request_with_failover("GET", "/anpr/watchlist")
        if res and res.status_code == 200:
            try:
                return res.json().get("watchlist", [])
            except Exception:
                pass
        return []

    # 2. Fetch Export Camera Feeds Catalog (For Active Stream Sync)
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

    # Batch fetch all custom ROIs
    def get_all_rois(self) -> Dict[str, Any]:
        """Batch fetch all stored camera ROIs directly from RDS PostgreSQL."""
        res = self._request_with_failover("GET", "/anpr/all-rois")
        if res and res.status_code == 200:
            try:
                data = res.json()
                return data.get("data", {}) if isinstance(data, dict) and "data" in data else data
            except Exception:
                pass
        return {}

    # Batch fetch all custom AI configs
    def get_all_ai_configs(self) -> Dict[str, Any]:
        """Batch fetch all stored camera AI configs directly from RDS PostgreSQL."""
        res = self._request_with_failover("GET", "/anpr/all-ai-configs")
        if res and res.status_code == 200:
            try:
                data = res.json()
                return data.get("data", {}) if isinstance(data, dict) and "data" in data else data
            except Exception:
                pass
        return {}

    # 2b. Fetch Grouped Location & Multi-Usecase Multi-ROI Master Catalog
    def get_grouped_location_catalog(
        self,
        all_rois_map: Optional[Dict[str, Any]] = None,
        all_ai_map: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Builds and returns location-grouped camera catalog where each camera contains:
         - usecases: ["ANPR", "FACE_RECOGNITION", "PPE", "FOOTFALL"]
         - enable: [0, 0, 0, 0] (Vector array indicating enabled status for each usecase)
         - rois: List of polygon coordinates for each usecase
        """
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
            
            # Resolve AI vision model config from batch map or fallback
            ai_cfg = None
            for alias in aliases:
                if alias in all_ai_map:
                    ai_cfg = all_ai_map[alias]
                    break

            if ai_cfg and "enable" in ai_cfg and isinstance(ai_cfg["enable"], list):
                enable_vector = [int(bool(x)) for x in ai_cfg["enable"]][:4]
                while len(enable_vector) < 4:
                    enable_vector.append(0)
            elif isinstance(raw_enable, list) and len(raw_enable) == 4:
                enable_vector = [int(bool(x)) for x in raw_enable]
            elif isinstance(raw_enable, (int, bool)) and raw_enable:
                enable_vector = [1, 0, 0, 0]
            elif cam.get("health_status") == "ONLINE" and index in [5, 6]:
                # Sample active ANPR cameras (Camera 6 and 7)
                enable_vector = [1, 0, 0, 0]
            else:
                enable_vector = [0, 0, 0, 0]

            # Resolve custom ROI from batch map or fallback
            roi_info = None
            for alias in aliases:
                if alias in all_rois_map:
                    roi_info = all_rois_map[alias]
                    break

            custom_coords = []
            if roi_info:
                pts = roi_info.get("points") or roi_info.get("coordinates") or roi_info.get("roi", {}).get("coordinates")
                if pts and isinstance(pts, list) and len(pts) >= 3:
                    custom_coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts if isinstance(p, dict)]

            # Build standardized ROIs array (1 polygon per usecase)
            camera_rois = []
            for roi_idx in range(len(STANDARD_USECASES)):
                if roi_idx == 0 and custom_coords:
                    camera_rois.append(custom_coords)
                else:
                    camera_rois.append(DEFAULT_ROIS[roi_idx])

            locations_map[loc_id]["cameras"].append({
                "camera_code": code,
                "camera_name": cam.get("name") or f"Camera {code}",
                "enable": enable_vector,
                "usecases": STANDARD_USECASES,
                "rtsp": cam.get("rtsp_url") or "",
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

    # 3. Fetch Structured ROI for a Camera Node
    def get_camera_roi(self, camera_code: str) -> Optional[Dict[str, Any]]:
        """Fetch ROI polygon vertices for a camera with code alias fallback."""
        for code in get_code_aliases(camera_code):
            res = self._request_with_failover("GET", f"/anpr/roi/{code}")
            if not res or res.status_code != 200:
                res = self._request_with_failover("GET", f"/cameras/{code}/roi")
            if res and res.status_code == 200:
                try:
                    data = res.json()
                    res_data = data.get("data") if isinstance(data, dict) and "data" in data else data
                    if res_data and (res_data.get("points") or res_data.get("zones")):
                        return res_data
                except Exception:
                    pass
        return None

    # 3b. Fetch Assigned AI Vision Models & Config
    def get_camera_ai_config(self, camera_code: str) -> Optional[Dict[str, Any]]:
        """Fetch active AI vision models configuration for a camera with code alias fallback."""
        for code in get_code_aliases(camera_code):
            res = self._request_with_failover("GET", f"/anpr/ai-config/{code}")
            if not res or res.status_code != 200:
                res = self._request_with_failover("GET", f"/cameras/{code}/ai-config")
            if res and res.status_code == 200:
                try:
                    data = res.json()
                    res_data = data.get("data") if isinstance(data, dict) and "data" in data else data
                    if res_data and ("enable" in res_data or "models" in res_data):
                        return res_data
                except Exception:
                    pass
        return None

    # 4. Push Live ANPR Alert / Detection Event
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
        """Stream detection event directly to live dashboard."""
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
        if res and res.status_code in [200, 201]:
            return True
        return False

    def _background_alert_worker(self):
        """Worker thread processing queued alert ingest requests."""
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
    """
    Continuous Event Listener for DeepStream / GPU Inference Engines.
    Monitors camera additions, deletions, RTSP updates, and ROI/AI changes with change-detection,
    and maintains an atomically updated 'cameras.json' on local disk.
    """
    def __init__(
        self,
        client: Optional[ZTracsBuddyClient] = None,
        poll_interval: float = 5.0,
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

        # Local cache of timestamps and datasets
        self.last_sync_state = self._load_sync_state()
        self.cached_rois: Dict[str, Any] = {}
        self.cached_ai_configs: Dict[str, Any] = {}

        # Callback Handlers
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
        print(f"[Z-TRACS LISTENER] Active Listener Started! Polling change-detection every {self.poll_interval}s...")

        if blocking:
            self._listen_loop()
        else:
            t = threading.Thread(target=self._listen_loop, daemon=True)
            t.start()

    def stop(self):
        self.is_running = False

    def sync_cameras_json(self, force: bool = False):
        """Generates and writes location-grouped multi-usecase multi-ROI JSON to disk."""
        try:
            # Check if file exists or if forced
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
            print(f"[Z-TRACS LISTENER] Successfully synchronized '{self.json_filename}' to disk! ({catalog.get('total_cameras', 0)} cameras)")
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

                    if code not in self.active_cameras:
                        self.active_cameras[code] = cam
                        streams_changed = True
                        if not initial_load:
                            print(f"\n[EVENT] [NEW CAMERA ADDED] '{code}' | RTSP: {cam.get('rtsp_url')}")
                            if self.on_added_cb:
                                self.on_added_cb(cam)
                    else:
                        old_cam = self.active_cameras[code]
                        if old_cam.get("rtsp_url") != cam.get("rtsp_url"):
                            print(f"\n[EVENT] [RTSP URL UPDATED] '{code}': {old_cam.get('rtsp_url')} -> {cam.get('rtsp_url')}")
                            self.active_cameras[code] = cam
                            streams_changed = True
                            if self.on_updated_cb:
                                self.on_updated_cb(cam)

                if not initial_load:
                    candidate_deleted = set(self.active_cameras.keys()) - current_codes
                    for dcode in candidate_deleted:
                        self.missing_counts[dcode] = self.missing_counts.get(dcode, 0) + 1
                        if self.missing_counts[dcode] >= self.max_missing_polls:
                            print(f"\n[EVENT] [CAMERA DELETED] '{dcode}'")
                            del self.active_cameras[dcode]
                            del self.missing_counts[dcode]
                            streams_changed = True

                # 3. Only perform heavy JSON rebuild if AI configs, ROIs, streams changed or file is missing
                if initial_load or file_missing or ai_changed or roi_changed or streams_changed:
                    if ai_changed or not self.cached_ai_configs:
                        self.cached_ai_configs = self.client.get_all_ai_configs()
                    if roi_changed or not self.cached_rois:
                        self.cached_rois = self.client.get_all_rois()

                    catalog = self.client.get_grouped_location_catalog(
                        all_rois_map=self.cached_rois,
                        all_ai_map=self.cached_ai_configs
                    )
                    self._write_atomic_json(catalog)

                    # Update saved sync state
                    self._save_sync_state({
                        "ai_configs_updated_at": ai_ver,
                        "rois_updated_at": roi_ver
                    })
                    
                    if not initial_load:
                        print(f"\n[EVENT] [EDGE SYNC] Rebuilt '{self.json_filename}' with latest RDS state! ({catalog.get('total_cameras', 0)} cameras)")

                initial_load = False

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

    client = ZTracsBuddyClient()
    listener = ZTracsActiveCameraListener(client=client, poll_interval=5.0)

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

