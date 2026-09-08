"""
Z-TRACS Forensic Video Analysis & Offline Footage AI Ingestion Service
----------------------------------------------------------------------
Enables police officers to upload long-duration CCTV video footage (e.g. 4-hour DVR files),
distribute batch jobs to OpenCV / GPU AI workers, and perform interactive timeline investigations.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from fastapi.responses import FileResponse
from app.schemas.api_response import ApiResponse
from app.websockets.manager import ws_manager
from app.storage.s3 import s3_storage
import json
import os
import re
import time
import base64
import random
import shutil

router = APIRouter(prefix="/forensics", tags=["Model 2 — Forensic Video Analysis & Offline CCTV Ingestion"])

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
FORENSICS_DIR = os.path.join(BASE_DIR, "forensics")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
FORENSICS_MEDIA_DIR = os.path.join(DATA_DIR, "forensics_media")

os.makedirs(FORENSICS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(FORENSICS_MEDIA_DIR, exist_ok=True)

FORENSIC_TASKS_FILE = os.path.join(DATA_DIR, "saved_forensic_tasks.json")

def sanitize_slug(name: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9_]+', '_', name.lower()).strip('_')
    return cleaned if cleaned else f"task_{int(time.time())}"

def format_seconds(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"



def load_forensic_tasks() -> Dict[str, Dict[str, Any]]:
    if os.path.exists(FORENSIC_TASKS_FILE):
        try:
            with open(FORENSIC_TASKS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_forensic_tasks(tasks: Dict[str, Dict[str, Any]]):
    try:
        with open(FORENSIC_TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(tasks, f, indent=2)
    except Exception as e:
        print(f"[FORENSICS STORAGE ERROR] {e}")

SAVED_FORENSIC_TASKS: Dict[str, Dict[str, Any]] = load_forensic_tasks()


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tasks")
async def get_all_forensic_tasks():
    """Retrieve all offline forensic video analysis jobs."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    return ApiResponse.ok(list(SAVED_FORENSIC_TASKS.values()))

@router.get("/tasks/{task_id}")
async def get_forensic_task_by_id(task_id: str):
    """Retrieve detailed detections and timeline markers for a specific video job."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    if task_id in SAVED_FORENSIC_TASKS:
        return ApiResponse.ok(SAVED_FORENSIC_TASKS[task_id])
    raise HTTPException(status_code=404, detail="Forensic task not found")

@router.get("/export-tasks")
async def export_tasks_for_edge():
    """High-speed batch manifest endpoint for update_forensics.py edge daemon."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    
    tasks_list = list(SAVED_FORENSIC_TASKS.values())
    return {
        "status": "success",
        "total_tasks": len(tasks_list),
        "active_processing": len([t for t in tasks_list if t.get("status") in ["QUEUED", "PROCESSING"]]),
        "export_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tasks": tasks_list
    }

@router.post("/upload-url")
async def get_forensic_upload_url(payload: Dict[str, Any] = Body(...)):
    """
    Generate a direct-to-S3 Pre-Signed PUT URL for uploading large forensic video footage.
    EC2 disk/memory never touches the video bytes.
    """
    case_id = str(payload.get("case_id") or f"FIR-FOR-{int(time.time())}").strip()
    filename = str(payload.get("filename") or payload.get("footage_name") or "footage.mp4").strip()
    content_type = str(payload.get("content_type") or "video/mp4").strip()
    
    task_id = f"TSK-FOR-{int(time.time()) % 100000:05d}"
    s3_key = f"forensics/tasks/{task_id}/footage.mp4"

    presigned_put_url = s3_storage.generate_upload_presigned_url(
        s3_key=s3_key,
        content_type=content_type,
        expires_in=3600  # 1 hour upload window
    )

    return ApiResponse.ok({
        "task_id": task_id,
        "s3_key": s3_key,
        "case_id": case_id,
        "upload_url": presigned_put_url or f"http://43.204.235.231:8000/api/v1/forensics/tasks/{task_id}/upload-direct"
    })

@router.post("/tasks/upload")
async def upload_forensic_task_video(
    file: UploadFile = File(...),
    case_id: str = Form("FIR-FOR-001"),
    footage_name: str = Form(""),
    location_name: str = Form("Gujarat Police CCTV Node"),
    models_requested: str = Form('["ANPR", "VEHICLE_CLASSIFICATION"]'),
    duration_minutes: float = Form(60.0),
):
    """
    Direct-to-Disk Chunked Streaming Video Ingestion (FRS Architecture).
    Streams multi-gigabyte video directly to server disk in 4MB chunks with minimal RAM (< 10MB).
    """
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()

    task_id = f"TSK-FOR-{int(time.time()) % 100000:05d}"
    orig_name = footage_name or file.filename or "footage.mp4"
    clean_filename = sanitize_slug(orig_name)
    if not clean_filename.endswith((".mp4", ".avi", ".mkv", ".mov")):
        ext = os.path.splitext(orig_name)[1] or ".mp4"
        clean_filename += ext

    task_dir = os.path.join(FORENSICS_MEDIA_DIR, task_id)
    os.makedirs(task_dir, exist_ok=True)
    video_dest_path = os.path.join(task_dir, clean_filename)

    # 4MB buffer streaming: Zero RAM bloat even for 5GB CCTV files
    with open(video_dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer, length=4 * 1024 * 1024)

    file_size = os.path.getsize(video_dest_path)

    try:
        models = json.loads(models_requested) if isinstance(models_requested, str) else models_requested
    except Exception:
        models = ["ANPR"]
    if not isinstance(models, list):
        models = [str(models)]

    models_upper = [str(m).upper() for m in models]
    enable_vector = [
        1 if any(k in m for m in models_upper for k in ["ANPR", "VEHICLE", "PLATE"]) else 0,
        1 if any(k in m for m in models_upper for k in ["FACE", "FRS", "PERSON"]) else 0,
        1 if any(k in m for m in models_upper for k in ["PPE", "SAFETY", "HELMET"]) else 0,
        1 if any(k in m for m in models_upper for k in ["FOOTFALL", "CROWD", "COUNT"]) else 0,
    ]
    if sum(enable_vector) == 0:
        enable_vector = [1, 0, 0, 0]

    try:
        dur_mins = float(duration_minutes)
    except Exception:
        dur_mins = 60.0
    total_seconds = max(1, int(dur_mins * 60))

    slug = f"{task_id.lower()}_{sanitize_slug(case_id)}"
    # Strictly empty detections: Real detections will be posted when offline GPU worker runs
    detections = []

    download_url = f"/api/v1/forensics/tasks/{task_id}/video"
    task_obj = {
        "task_id": task_id,
        "case_id": case_id,
        "slug": slug,
        "footage_name": orig_name,
        "filename": clean_filename,
        "location_name": location_name,
        "video_path": f"forensics/{task_id}/{clean_filename}",
        "file_size_bytes": file_size,
        "download_url": download_url,
        "direct_video_url": f"http://43.204.235.231:8000{download_url}",
        "media_source": {
            "local_video_path": f"forensics/{task_id}/{clean_filename}",
            "direct_download_url": f"http://43.204.235.231:8000{download_url}",
            "file_size_bytes": file_size
        },
        "enable": enable_vector,
        "usecases": ["ANPR", "FACE_RECOGNITION", "PPE", "FOOTFALL"],
        "models_requested": models,
        "status": "QUEUED",
        "progress_percent": 0.0,
        "duration_seconds": total_seconds,
        "duration_formatted": format_seconds(total_seconds),
        "total_frames": total_seconds * 25,
        "processed_frames": 0,
        "processing_fps": 0.0,
        "total_detections": len(detections),
        "watchlist_hits": len([d for d in detections if d.get("watchlist_hit")]),
        "detections": detections,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    SAVED_FORENSIC_TASKS[task_id] = task_obj
    save_forensic_tasks(SAVED_FORENSIC_TASKS)

    print("\n" + "=" * 65)
    print(f"[FORENSICS] DIRECT FOOTAGE UPLOAD RECEIVED (CHUNKED STREAM)")
    print(f" -> Task ID       : {task_id}")
    print(f" -> Case ID       : {case_id}")
    print(f" -> File          : {clean_filename} ({file_size / (1024*1024):.2f} MB)")
    print(f" -> Saved to Disk : {video_dest_path}")
    print(f" -> Download URL  : {download_url}")
    print(f" -> Status        : QUEUED FOR EDGE LISTENER")
    print("=" * 65 + "\n")

    try:
        await ws_manager.broadcast_json({
            "event": "NEW_FORENSIC_TASK_DEPLOYED",
            "data": task_obj
        })
    except Exception:
        pass

    return ApiResponse.ok(task_obj)

@router.get("/tasks/{task_id}/video")
async def get_forensic_task_video(task_id: str):
    """Direct HTTP stream & download endpoint for edge listener daemon."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    task = SAVED_FORENSIC_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Forensic task not found")

    filename = task.get("filename") or "footage.mp4"
    file_path = os.path.join(FORENSICS_MEDIA_DIR, task_id, filename)

    if not os.path.exists(file_path):
        task_dir = os.path.join(FORENSICS_MEDIA_DIR, task_id)
        if os.path.exists(task_dir):
            files = [f for f in os.listdir(task_dir) if not f.startswith(".")]
            if files:
                file_path = os.path.join(task_dir, files[0])
                filename = files[0]

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Footage file not found on disk")

    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=filename,
        headers={"Accept-Ranges": "bytes"}
    )

@router.post("/tasks")
async def create_forensic_task(payload: Dict[str, Any] = Body(...)):
    """Create a new forensic video analysis task with S3 key & requested AI models."""
    case_id = str(payload.get("case_id") or f"FIR-FOR-{int(time.time())}").strip()
    footage_name = str(payload.get("footage_name") or payload.get("filename") or "CCTV_Footage.mp4").strip()
    location_name = str(payload.get("location_name") or "Gujarat Police CCTV Node").strip()
    models_requested = payload.get("models_requested") or ["ANPR", "VEHICLE_CLASSIFICATION"]
    search_filters = payload.get("search_filters") or {}
    duration_minutes = float(payload.get("estimated_duration_minutes") or 60.0)

    task_id = str(payload.get("task_id") or f"TSK-FOR-{int(time.time()) % 100000:05d}").strip()
    slug = f"{task_id.lower()}_{sanitize_slug(case_id)}"

    s3_key = str(payload.get("s3_key") or f"forensics/tasks/{task_id}/footage.mp4")
    
    # Generate 24-hour streaming URL for GPU worker
    streaming_url = s3_storage.generate_streaming_presigned_url(s3_key, expires_in=86400)
    video_rel_path = f"forensics/{slug}/footage.mp4"

    # Strictly empty detections: Real detections will be posted when offline GPU worker runs
    detections = []

    models_upper = [str(m).upper() for m in (models_requested if isinstance(models_requested, list) else [str(models_requested)])]
    enable_vector = [
        1 if any(k in m for m in models_upper for k in ["ANPR", "VEHICLE", "PLATE"]) else 0,
        1 if any(k in m for m in models_upper for k in ["FACE", "FRS", "PERSON"]) else 0,
        1 if any(k in m for m in models_upper for k in ["PPE", "SAFETY", "HELMET"]) else 0,
        1 if any(k in m for m in models_upper for k in ["FOOTFALL", "CROWD", "COUNT"]) else 0,
    ]
    if sum(enable_vector) == 0:
        enable_vector = [1, 0, 0, 0]

    total_seconds = max(1, int(duration_minutes * 60))

    task_obj = {
        "task_id": task_id,
        "case_id": case_id,
        "slug": slug,
        "footage_name": footage_name,
        "location_name": location_name,
        "video_path": video_rel_path,
        "s3_key": s3_key,
        "media_source": {
            "local_video_path": video_rel_path,
            "s3_key": s3_key,
            "s3_streaming_url": streaming_url or f"https://z-tracs-media.s3.amazonaws.com/{s3_key}"
        },
        "enable": enable_vector,
        "usecases": ["ANPR", "FACE_RECOGNITION", "PPE", "FOOTFALL"],
        "models_requested": models_requested,
        "search_filters": search_filters,
        "status": "QUEUED",
        "progress_percent": 0.0,
        "duration_seconds": total_seconds,
        "duration_formatted": format_seconds(total_seconds),
        "total_frames": total_seconds * 25,
        "processed_frames": 0,
        "processing_fps": 0.0,
        "total_detections": len(detections),
        "watchlist_hits": len([d for d in detections if d.get("watchlist_hit")]),
        "detections": detections,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    SAVED_FORENSIC_TASKS[task_id] = task_obj
    save_forensic_tasks(SAVED_FORENSIC_TASKS)

    # Clean ASCII Terminal Proof Output
    print("\n" + "=" * 65)
    print(f"[LIVE DEMO] FORENSIC VIDEO ANALYSIS TASK QUEUED (DIRECT S3)")
    print(f" -> Task ID         : {task_id}")
    print(f" -> Case / FIR ID   : {case_id}")
    print(f" -> Footage File    : {footage_name}")
    print(f" -> S3 Storage Key  : s3://{s3_storage.bucket_name}/{s3_key}")
    print(f" -> Streaming URL   : (Pre-Signed 24h Active)")
    print(f" -> Incident Loc    : {location_name}")
    print(f" -> AI Models       : {models_requested}")
    print(f" -> Search Filters  : {search_filters}")
    print(f" -> Status          : QUEUED FOR GPU STREAM WORKER")
    print("=" * 65 + "\n")

    try:
        await ws_manager.broadcast_json({
            "event": "NEW_FORENSIC_TASK_DEPLOYED",
            "data": task_obj
        })
    except Exception:
        pass

    return ApiResponse.ok(task_obj)

@router.post("/tasks/{task_id}/progress")
async def report_task_progress(task_id: str, payload: Dict[str, Any] = Body(...)):
    """Endpoint for GPU Edge Worker to report interim progress during batch streaming."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    if task_id in SAVED_FORENSIC_TASKS:
        task = SAVED_FORENSIC_TASKS[task_id]
        task["status"] = "PROCESSING"
        task["progress_percent"] = float(payload.get("progress_percent", task.get("progress_percent", 0.0)))
        task["processed_frames"] = int(payload.get("processed_frames", task.get("processed_frames", 0)))
        task["processing_fps"] = float(payload.get("processing_fps", task.get("processing_fps", 0.0)))
        task["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        save_forensic_tasks(SAVED_FORENSIC_TASKS)

        try:
            await ws_manager.broadcast_json({
                "event": "FORENSIC_TASK_PROGRESS",
                "data": {
                    "task_id": task_id,
                    "progress_percent": task["progress_percent"],
                    "processed_frames": task["processed_frames"],
                    "processing_fps": task["processing_fps"]
                }
            })
        except Exception:
            pass

        return ApiResponse.ok({"task_id": task_id, "status": "PROCESSING", "progress_percent": task["progress_percent"]})
    raise HTTPException(status_code=404, detail="Task not found")

@router.post("/tasks/{task_id}/results")
async def submit_task_results(task_id: str, payload: Dict[str, Any] = Body(...)):
    """Endpoint for GPU Edge Worker to submit final batch inference results."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    if task_id in SAVED_FORENSIC_TASKS:
        task = SAVED_FORENSIC_TASKS[task_id]
        task["status"] = "COMPLETED"
        task["progress_percent"] = 100.0
        task["total_frames_processed"] = payload.get("total_frames_processed", task.get("total_frames", 0))
        task["processed_frames"] = task["total_frames_processed"]
        
        new_detections = payload.get("detections")
        if new_detections is not None:
            task["detections"] = new_detections
            task["total_detections"] = len(new_detections)
            task["watchlist_hits"] = len([d for d in new_detections if d.get("watchlist_hit")])

        task["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        save_forensic_tasks(SAVED_FORENSIC_TASKS)

        print("\n" + "=" * 65)
        print(f"[LIVE DEMO] FORENSIC TASK COMPLETED BY GPU INFERENCE WORKER")
        print(f" -> Task ID         : {task_id}")
        print(f" -> Total Frames    : {task['total_frames_processed']}")
        print(f" -> Total Detections: {task['total_detections']} ({task['watchlist_hits']} Watchlist Hits)")
        print("=" * 65 + "\n")

        try:
            await ws_manager.broadcast_json({
                "event": "FORENSIC_TASK_COMPLETED",
                "data": task
            })
        except Exception:
            pass

        return ApiResponse.ok(task)
    raise HTTPException(status_code=404, detail="Task not found")

@router.delete("/tasks/{task_id}")
async def delete_forensic_task(task_id: str):
    """Delete a forensic video analysis job and remove media on disk."""
    global SAVED_FORENSIC_TASKS
    SAVED_FORENSIC_TASKS = load_forensic_tasks()
    if task_id in SAVED_FORENSIC_TASKS:
        deleted = SAVED_FORENSIC_TASKS.pop(task_id)
        save_forensic_tasks(SAVED_FORENSIC_TASKS)

        task_dir = os.path.join(FORENSICS_MEDIA_DIR, task_id)
        if os.path.exists(task_dir):
            shutil.rmtree(task_dir, ignore_errors=True)

        print("\n" + "=" * 65)
        print(f"[LIVE DEMO] FORENSIC TASK REMOVED: {deleted.get('case_id')} ({task_id})")
        print("=" * 65 + "\n")

        return ApiResponse.ok({"message": f"Task {task_id} deleted successfully", "task_id": task_id})
    raise HTTPException(status_code=404, detail="Task not found")

