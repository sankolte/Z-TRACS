"""
Z-TRACS Active Forensic Video Analysis & Batch Footage Listener Daemon (Production Ready)
-----------------------------------------------------------------------------------------
Designed for DeepStream / YOLOv8 / Faster-RCNN Offline Footage Processing GPU Nodes

Features:
 1. ACTIVE FORENSIC BATCH TASK LISTENER (Continuous Event Daemon Loop):
    - Detects when a NEW forensic footage job is SUBMITTED -> prepares forensics/{slug}/ directory
    - Synchronizes batch task definitions and requested models (ANPR, FRS, Vehicle Type)
    - Detects when a task finishes or is deleted
    - Generates & updates standardized 'forensics.json' configuration on disk in ~0.05s
 2. Multi-Server Failover (Localhost -> AWS EC2 Direct -> Vercel Proxy HTTPS)
 3. Connection Pooling & Auto-Retries via urllib3 HTTPAdapter
 4. Clean ASCII Terminal Output (No Emojis, Control Room Grade)
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
import os
import sys
import shutil
from typing import Dict, Any, List, Optional

DEFAULT_FORENSICS_FILE = "forensics.json"
FORENSICS_BASE_DIR = "forensics"

class ZTracsForensicsClient:
    def __init__(
        self,
        primary_url: str = "http://43.204.235.231:8000/api/v1",
        secondary_url: str = "https://z-tracs.vercel.app/api/v1",
        tertiary_url: str = "http://localhost:8000/api/v1",
        timeout: int = 5
    ):
        self.endpoints = [
            primary_url.rstrip('/'),
            secondary_url.rstrip('/'),
            tertiary_url.rstrip('/')
        ]
        self.timeout = timeout
        
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

    def _request_with_failover(self, method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
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

    def get_export_tasks(self) -> Dict[str, Any]:
        """Fetch active forensic analysis batch tasks from cloud/local backend."""
        res = self._request_with_failover("GET", "/forensics/export-tasks")
        if res and res.status_code == 200:
            try:
                return res.json()
            except Exception:
                pass
        return {"status": "success", "total_tasks": 0, "active_processing": 0, "tasks": []}

    def stream_download_footage(self, task_id: str, dest_path: str, direct_url: Optional[str] = None) -> bool:
        """Stream download large CCTV footage directly to disk in 1MB chunks with progress bar."""
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        tmp_dest = f"{dest_path}.tmp"

        # 1. Try direct URL if provided
        if direct_url and direct_url.startswith("http"):
            try:
                with self.session.get(direct_url, timeout=60, stream=True) as res:
                    if res.status_code == 200:
                        total_bytes = int(res.headers.get("content-length", 0))
                        dl_bytes = 0
                        start_t = time.time()
                        print(f"[FORENSICS] Streaming footage from cloud for task {task_id}...")
                        with open(tmp_dest, "wb") as f:
                            for chunk in res.iter_content(chunk_size=1024 * 1024):
                                if chunk:
                                    f.write(chunk)
                                    dl_bytes += len(chunk)
                                    if total_bytes > 0:
                                        pct = (dl_bytes / total_bytes) * 100
                                        sys.stdout.write(f"\r -> Progress: [{pct:5.1f}%] {dl_bytes / (1024*1024):.1f} / {total_bytes / (1024*1024):.1f} MB")
                                        sys.stdout.flush()
                        sys.stdout.write("\n")
                        os.replace(tmp_dest, dest_path)
                        dur = max(0.1, time.time() - start_t)
                        size_mb = os.path.getsize(dest_path) / (1024 * 1024)
                        print(f" -> Download Complete: {size_mb:.2f} MB in {dur:.2f}s ({size_mb/dur:.2f} MB/s)")
                        return True
            except Exception as e:
                print(f"[FORENSICS DOWNLOAD ERROR] Direct URL failed: {e}")

        # 2. Try failover API endpoints /forensics/tasks/{task_id}/video
        for base_url in self.endpoints:
            try:
                url = f"{base_url}/forensics/tasks/{task_id}/video"
                with self.session.get(url, timeout=60, stream=True) as res:
                    if res.status_code == 200:
                        total_bytes = int(res.headers.get("content-length", 0))
                        dl_bytes = 0
                        start_t = time.time()
                        print(f"[FORENSICS] Streaming footage from {base_url}...")
                        with open(tmp_dest, "wb") as f:
                            for chunk in res.iter_content(chunk_size=1024 * 1024):
                                if chunk:
                                    f.write(chunk)
                                    dl_bytes += len(chunk)
                                    if total_bytes > 0:
                                        pct = (dl_bytes / total_bytes) * 100
                                        sys.stdout.write(f"\r -> Progress: [{pct:5.1f}%] {dl_bytes / (1024*1024):.1f} / {total_bytes / (1024*1024):.1f} MB")
                                        sys.stdout.flush()
                        sys.stdout.write("\n")
                        os.replace(tmp_dest, dest_path)
                        dur = max(0.1, time.time() - start_t)
                        size_mb = os.path.getsize(dest_path) / (1024 * 1024)
                        print(f" -> Download Complete: {size_mb:.2f} MB in {dur:.2f}s ({size_mb/dur:.2f} MB/s)")
                        return True
            except Exception:
                continue

        if os.path.exists(tmp_dest):
            try:
                os.remove(tmp_dest)
            except Exception:
                pass
        return False


class ZTracsForensicsListener:
    def __init__(
        self,
        client: Optional[ZTracsForensicsClient] = None,
        poll_interval: float = 5.0,
        forensics_filename: str = DEFAULT_FORENSICS_FILE,
        base_dir: str = FORENSICS_BASE_DIR
    ):
        self.client = client or ZTracsForensicsClient()
        self.poll_interval = poll_interval
        self.forensics_filename = forensics_filename
        self.base_dir = base_dir
        self.is_running = False
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self._last_catalog_str = None

        os.makedirs(self.base_dir, exist_ok=True)

    def sync_forensics_json(self, export_data: Optional[Dict[str, Any]] = None):
        """Generates and writes standardized forensics.json atomically to disk."""
        try:
            t0 = time.time()
            if export_data is None:
                export_data = self.client.get_export_tasks()
            tmp_file = f"{self.forensics_filename}.tmp"
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2)
            os.replace(tmp_file, self.forensics_filename)
            elapsed = time.time() - t0
            total = export_data.get("total_tasks", len(export_data.get("tasks", [])))
            return elapsed, total
        except Exception as e:
            print(f"[FORENSICS LISTENER ERROR] Error writing '{self.forensics_filename}': {e}")
            return 0.0, 0


    def start(self, blocking: bool = True):
        self.is_running = True
        print("=" * 65)
        print("Z-TRACS ACTIVE FORENSIC FOOTAGE ANALYSIS LISTENER DAEMON")
        print("=" * 65)
        print(f"Active Forensic Listener Started! Polling every {self.poll_interval}s...")
        print(f"Footage Base Directory  : '{self.base_dir}/'")
        print(f"Output Manifest File    : '{self.forensics_filename}'")
        print("Press Ctrl+C to stop.")
        print("=" * 65 + "\n")

        if blocking:
            self._listen_loop()

    def _listen_loop(self):
        initial_load = True
        while self.is_running:
            try:
                export_data = self.client.get_export_tasks()
                tasks_list = export_data.get("tasks", [])
                current_task_ids = set()

                for task in tasks_list:
                    tid = task.get("task_id")
                    if not tid:
                        continue
                    current_task_ids.add(tid)

                    clean_fn = task.get("filename") or f"{tid.lower()}.mp4"
                    task_dir = os.path.join(self.base_dir, tid)
                    local_dest = os.path.join(task_dir, clean_fn)
                    direct_url = (
                        task.get("direct_video_url")
                        or task.get("download_url")
                        or task.get("streaming_url")
                        or task.get("media_source", {}).get("s3_streaming_url")
                    )
                    expected_size = task.get("file_size_bytes")

                    # Download video if missing or incomplete
                    needs_download = not os.path.exists(local_dest) or (expected_size and os.path.getsize(local_dest) != expected_size)
                    if needs_download:
                        print(f"\n[FORENSICS] Syncing footage file for task: {tid} ({task.get('case_id')})")
                        ok = self.client.stream_download_footage(tid, local_dest, direct_url)
                        if ok:
                            print(f"[FORENSICS] Successfully stored local footage: '{local_dest}'")

                    # Update task paths for local GPU inference workers
                    task["video_path"] = f"{self.base_dir}/{tid}/{clean_fn}".replace("\\", "/")
                    task["absolute_video_path"] = os.path.abspath(local_dest)

                    # Compute standardized 4-element enable vector: [ANPR, FRS, PPE, FOOTFALL]
                    models_req = [str(m).upper() for m in (task.get("models_requested") or [])]
                    enable_vector = [
                        1 if any(k in m for m in models_req for k in ["ANPR", "VEHICLE", "PLATE"]) else 0,
                        1 if any(k in m for m in models_req for k in ["FACE", "FRS", "PERSON"]) else 0,
                        1 if any(k in m for m in models_req for k in ["PPE", "SAFETY", "HELMET"]) else 0,
                        1 if any(k in m for m in models_req for k in ["FOOTFALL", "CROWD", "COUNT"]) else 0,
                    ]
                    if sum(enable_vector) == 0:
                        enable_vector = [1, 0, 0, 0]

                    task["enable"] = enable_vector
                    task["usecases"] = ["ANPR", "FACE_RECOGNITION", "PPE", "FOOTFALL"]

                catalog_str = json.dumps(export_data, indent=2, sort_keys=True)

                if self._last_catalog_str != catalog_str:
                    self._last_catalog_str = catalog_str
                    elapsed, total_tasks = self.sync_forensics_json(export_data)

                    for task in tasks_list:
                        tid = task.get("task_id")
                        if tid and tid not in self.active_tasks:
                            self.active_tasks[tid] = task
                            if not initial_load:
                                print("\n" + "=" * 65)
                                print(f"[LIVE FORENSIC SYNC EVENT DETECTED]")
                                print("=" * 65)
                                print(f" -> Event Type       : NEW FORENSIC VIDEO INGEST JOB")
                                print(f" -> Task ID          : {tid}")
                                print(f" -> Case / FIR ID    : {task.get('case_id')}")
                                print(f" -> Footage File     : {task.get('footage_name')}")
                                print(f" -> Local Video File : {task.get('video_path')}")
                                print(f" -> Stream Mode      : Local Direct cv2.VideoCapture('{task.get('video_path')}')")
                                print(f" -> AI Models        : {task.get('models_requested')}")
                                print(f" -> Enable Vector    : {task.get('enable')} [ANPR, FRS, PPE, FOOTFALL]")
                                print(f" -> Duration         : {task.get('duration_formatted')} ({task.get('total_frames')} frames)")
                                print(f" -> Forensics File   : '{self.forensics_filename}' ({total_tasks} jobs in {elapsed:.4f}s)")
                                print(f" -> Engine Status    : READY FOR LOCAL GPU INFERENCE")
                                print("=" * 65 + "\n")
                        elif tid:
                            self.active_tasks[tid] = task

                    # Cleanup deleted tasks
                    if not initial_load:
                        deleted_ids = set(self.active_tasks.keys()) - current_task_ids
                        for d_tid in deleted_ids:
                            old = self.active_tasks.pop(d_tid, {})
                            del_dir = os.path.join(self.base_dir, d_tid)
                            if os.path.exists(del_dir):
                                shutil.rmtree(del_dir, ignore_errors=True)
                                print(f"[FORENSICS CLEANUP] Purged deleted task directory: '{del_dir}/'")

                            print("\n" + "=" * 65)
                            print(f"[LIVE FORENSIC SYNC EVENT DETECTED]")
                            print("=" * 65)
                            print(f" -> Event Type       : FORENSIC TASK ARCHIVED / DELETED")
                            print(f" -> Task ID          : {d_tid}")
                            print(f" -> Case ID          : {old.get('case_id')}")
                            print(f" -> Forensics File   : '{self.forensics_filename}' ({total_tasks} jobs in {elapsed:.4f}s)")
                            print("=" * 65 + "\n")

                    if initial_load:
                        print(f"[FORENSICS LISTENER] Initialized '{self.forensics_filename}' with {total_tasks} forensic job(s).")

                initial_load = False

            except Exception as e:
                print(f"[FORENSICS LISTENER] Polling error: {e}")

            time.sleep(self.poll_interval)


if __name__ == "__main__":
    listener = ZTracsForensicsListener(poll_interval=5.0)
    try:
        listener.start(blocking=True)
    except KeyboardInterrupt:
        print("\nStopping Z-TRACS Forensic Video Active Listener...")
        sys.exit(0)
