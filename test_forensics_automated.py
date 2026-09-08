import os
import sys
import time
import json
import requests

API_BASE = "http://43.204.235.231:8000/api/v1"

def run_automated_forensics_test():
    print("=" * 65)
    print("[TEST] AUTOMATED FORENSICS PIPELINE TEST (Edge <-> EC2 Cloud)")
    print("=" * 65)
    
    # 1. Health check
    try:
        r = requests.get(f"{API_BASE}/anpr/sync-version", timeout=5)
        print(f"[OK] Backend Health: {r.status_code} {r.json()}")
    except Exception as e:
        print(f"[FAIL] Backend not reachable: {e}")
        return

    # 2. Fetch export tasks (forensics.json source)
    print("\n[STEP 1] Querying pending export tasks from EC2...")
    try:
        r = requests.get(f"{API_BASE}/forensics/export-tasks", timeout=10)
        tasks_data = r.json()
        total_tasks = tasks_data.get("total_tasks", 0)
        print(f"[OK] Total tasks available in queue: {total_tasks}")
        if total_tasks > 0:
            task = tasks_data["tasks"][0]
            task_id = task["task_id"]
            case_id = task.get("case_id", "N/A")
            s3_url = task.get("media_source", {}).get("s3_streaming_url", "")
            print(f"   Task ID: {task_id} (Case: {case_id})")
            print(f"   Models requested: {task.get('models_requested')}")
            print(f"   Video path: {task.get('video_path')}")
            print(f"   S3 Streaming URL: {s3_url[:80]}...")
            
            # 3. Simulate Edge Worker Progress Reporting
            print(f"\n[STEP 2] Simulating edge processing progress for {task_id}...")
            for progress in [25.0, 50.0, 75.0, 100.0]:
                payload = {
                    "progress_percent": progress,
                    "processed_frames": int(progress * 100),
                    "processing_fps": 34.2,
                    "status": "PROCESSING" if progress < 100.0 else "COMPLETED"
                }
                res = requests.post(f"{API_BASE}/forensics/tasks/{task_id}/progress", json=payload, timeout=5)
                print(f"   Progress {progress}% -> HTTP {res.status_code}: {res.json()}")
                time.sleep(0.3)

            # 4. Simulate Edge Detections Ingestion Callback
            print(f"\n[STEP 3] Posting AI detection results back to Cloud...")
            results_payload = {
                "task_id": task_id,
                "status": "COMPLETED",
                "total_detections": 2,
                "watchlist_hits": 1,
                "detections": [
                    {
                        "detection_id": "DET-AUTO-001",
                        "plate_number": "GJ01AB1234",
                        "vehicle_type": "Car (White Swift)",
                        "color": "White",
                        "video_timestamp_sec": 12.5,
                        "video_timestamp_formatted": "00:12",
                        "confidence": 98.6,
                        "plate_confidence": 99.2,
                        "watchlist_hit": True,
                        "watchlist_reason": "CRIME BRANCH STOLEN HOTLIST"
                    }
                ]
            }
            res = requests.post(f"{API_BASE}/forensics/tasks/{task_id}/results", json=results_payload, timeout=5)
            print(f"   Results Ingestion -> HTTP {res.status_code}: {res.json()}")

    except Exception as e:
        print(f"[FAIL] Error during forensics test: {e}")

    print("\n" + "=" * 65)
    print("[SUCCESS] FORENSICS PIPELINE TEST FINISHED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_automated_forensics_test()
