from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form, Response, Query
from fastapi.responses import Response, RedirectResponse
from app.schemas.api_response import ApiResponse
from app.websockets.manager import ws_manager
from app.storage.s3 import s3_storage
from app.db.frs_db import get_db_connection
import json
import os
import re
import time
import base64
import hashlib

router = APIRouter(prefix="/frs", tags=["Model 2 — Face Recognition & Suspect Search Services"])

# Directories for metadata storage
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

FRS_TARGETS_FILE = os.path.join(DATA_DIR, "saved_frs_targets.json")

# In-memory transient buffer for fast edge delivery
_PHOTO_MEMORY_CACHE: Dict[str, bytes] = {}
_CLIP_MEMORY_CACHE: Dict[str, bytes] = {}

def sanitize_slug(name: str) -> str:
    """Generate clean directory slug from suspect name (e.g. 'Rahul Sharma' -> 'usr_rahul_sharma')."""
    cleaned = re.sub(r'[^a-zA-Z0-9_]+', '_', name.lower()).strip('_')
    return cleaned if cleaned else f"usr_{int(time.time())}"

def load_frs_targets() -> Dict[str, Dict[str, Any]]:
    if os.path.exists(FRS_TARGETS_FILE):
        try:
            with open(FRS_TARGETS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Initial sample suspect for immediate testing
    initial_sample = {
        "TGT-GJ-001": {
            "person_id": "TGT-GJ-001",
            "person_name": "Rahul Sharma",
            "slug": "usr1",
            "case_id": "FIR-AHM-9021",
            "category": "CRITICAL_SUSPECT",
            "alert_priority": "HIGH",
            "s3_key": "frs/targets/TGT-GJ-001/face_reference.jpg",
            "photo_version": "v_1725700000_sample",
            "s3_clip_key": "frs/targets/TGT-GJ-001/clip.mp4",
            "clip_version": "v_1725700000_clip",
            "media_path": "clips/usr1/clip.mp4",
            "face_image_path": "clips/usr1/face_reference.jpg",
            "enabled": 1,
            "target_cameras": ["ALL"],
            "similarity_threshold": 0.78,
            "notes": "Suspect in Ahmedabad vehicle theft series",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    }
    return initial_sample

def save_frs_targets(targets: Dict[str, Dict[str, Any]]):
    try:
        with open(FRS_TARGETS_FILE, "w", encoding="utf-8") as f:
            json.dump(targets, f, indent=2)
    except Exception as e:
        print(f"[FRS STORAGE ERROR] {e}")

SAVED_FRS_TARGETS: Dict[str, Dict[str, Any]] = load_frs_targets()

# ─────────────────────────────────────────────────────────────────────────────
# FRS TARGET MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/targets")
async def get_all_targets():
    """Retrieve all active face recognition suspect targets."""
    global SAVED_FRS_TARGETS
    SAVED_FRS_TARGETS = load_frs_targets()
    return ApiResponse.ok(list(SAVED_FRS_TARGETS.values()))

@router.get("/targets/{person_id}/photo")
async def get_target_photo(person_id: str):
    """
    Direct photo download endpoint for Edge Listener Daemon (update_frs.py).
    Fetches binary directly from S3 or transient memory buffer.
    """
    if person_id in _PHOTO_MEMORY_CACHE:
        return Response(content=_PHOTO_MEMORY_CACHE[person_id], media_type="image/jpeg")

    target = SAVED_FRS_TARGETS.get(person_id)
    if target:
        s3_key = target.get("s3_key") or f"frs/targets/{person_id}/face_reference.jpg"
        photo_bytes = s3_storage.download_photo(s3_key)
        if photo_bytes:
            _PHOTO_MEMORY_CACHE[person_id] = photo_bytes
            return Response(content=photo_bytes, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail=f"Reference photo for target {person_id} not found.")

@router.get("/targets/{person_id}/clip")
async def get_target_clip(person_id: str):
    """
    Direct video clip download endpoint for Edge Listener Daemon (update_frs.py).
    Streams or returns full 1-minute video clip binary from memory cache, local disk, or S3.
    """
    if person_id in _CLIP_MEMORY_CACHE:
        return Response(content=_CLIP_MEMORY_CACHE[person_id], media_type="video/mp4")

    # Check local server disk persistence
    local_clip_file = os.path.join(DATA_DIR, "media", person_id, "clip.mp4")
    if os.path.exists(local_clip_file):
        try:
            with open(local_clip_file, "rb") as cf:
                clip_bytes = cf.read()
            _CLIP_MEMORY_CACHE[person_id] = clip_bytes
            return Response(content=clip_bytes, media_type="video/mp4")
        except Exception as e:
            print(f"[FRS LOCAL CLIP READ ERROR] {e}")

    target = SAVED_FRS_TARGETS.get(person_id)
    if target:
        s3_clip_key = target.get("s3_clip_key") or f"frs/targets/{person_id}/clip.mp4"
        clip_bytes = s3_storage.download_photo(s3_clip_key)
        if clip_bytes:
            _CLIP_MEMORY_CACHE[person_id] = clip_bytes
            return Response(content=clip_bytes, media_type="video/mp4")

    raise HTTPException(status_code=404, detail=f"Video clip for target {person_id} not found.")

@router.get("/export-targets")
async def export_targets_for_edge():
    """High-speed batch endpoint for update_frs.py edge daemon listener."""
    global SAVED_FRS_TARGETS
    SAVED_FRS_TARGETS = load_frs_targets()
    targets_list = []
    for t in SAVED_FRS_TARGETS.values():
        if t.get("enabled", 1) == 1:
            pid = t.get("person_id")
            slug = t.get("slug") or pid.lower().replace("-", "_")
            clip_p = t.get("media_path") or f"clips/{slug}/clip.mp4"
            face_p = t.get("face_image_path") or f"clips/{slug}/face_reference.jpg"
            emb_p = f"clips/{slug}/embeddings.npy"
            s3_k = t.get("s3_key") or f"frs/targets/{pid}/face_reference.jpg"
            version_m = t.get("photo_version") or t.get("updated_at") or "v1"

            targets_list.append({
                "person_id": pid,
                "person_name": t.get("person_name"),
                "slug": slug,
                "case_id": t.get("case_id"),
                "category": t.get("category", "CRITICAL_SUSPECT"),
                "alert_priority": t.get("alert_priority", "HIGH"),
                "enabled": int(t.get("enabled", 1)),
                "s3_key": s3_k,
                "photo_version": version_m,
                "photo_download_url": f"/frs/targets/{pid}/photo",
                "clip_download_url": f"/frs/targets/{pid}/clip",
                "clip_version": t.get("clip_version") or version_m,
                "clip_url": t.get("clip_url") or f"/api/v1/frs/targets/{pid}/clip",
                "media_source": {
                    "clip_path": clip_p,
                    "face_image_path": face_p,
                    "embeddings_path": emb_p,
                    "s3_key": s3_k,
                    "s3_clip_key": t.get("s3_clip_key") or f"frs/targets/{pid}/clip.mp4",
                    "photo_version": version_m,
                    "clip_version": t.get("clip_version") or version_m
                },
                "inference_rules": {
                    "similarity_threshold": float(t.get("similarity_threshold", 0.78)),
                    "target_cameras": t.get("target_cameras", ["ALL"]),
                    "trigger_cooldown_seconds": 30
                },
                # Backward compatibility flat fields
                "media_path": clip_p,
                "face_image_path": face_p,
                "target_cameras": t.get("target_cameras", ["ALL"]),
                "similarity_threshold": float(t.get("similarity_threshold", 0.78)),
                "notes": t.get("notes", "")
            })

    return {
        "status": "success",
        "total_targets": len(targets_list),
        "export_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "global_config": {
            "face_detector": "yolov8n-face",
            "feature_extractor": "arcface_r100",
            "embedding_dimension": 512,
            "default_threshold": 0.78,
            "min_face_size_pixels": [40, 40]
        },
        "targets": targets_list
    }

@router.post("/targets")
async def create_or_update_target(payload: Dict[str, Any] = Body(...)):
    """
    Create or update a suspect target.
    Decodes base64 photo and full video clip, uploading directly to AWS S3.
    """
    raw_name = payload.get("person_name") or payload.get("name")
    if not raw_name or not str(raw_name).strip():
        raise HTTPException(status_code=400, detail="Suspect Full Name ('person_name') is compulsory.")

    raw_case = payload.get("case_id")
    if not raw_case or not str(raw_case).strip():
        raise HTTPException(status_code=400, detail="FIR / Case Reference ID ('case_id') is compulsory.")

    person_name = str(raw_name).strip()
    slug = sanitize_slug(person_name)
    person_id = str(payload.get("person_id") or f"TGT-GJ-{len(SAVED_FRS_TARGETS)+1:03d}").strip()
    case_id = str(raw_case).strip()

    clip_filename = "clip.mp4"
    face_filename = "face_reference.jpg"
    embeddings_filename = "embeddings.npy"

    media_rel_path = f"clips/{slug}/{clip_filename}"
    face_rel_path = f"clips/{slug}/{face_filename}"
    embeddings_rel_path = f"clips/{slug}/{embeddings_filename}"

    # Default S3 key using person_id (stable unique key)
    s3_key = f"frs/targets/{person_id}/{face_filename}"
    s3_clip_key = f"frs/targets/{person_id}/{clip_filename}"
    version_marker = f"v_{int(time.time())}"
    clip_version_marker = f"v_clip_{int(time.time())}"
    presigned_url = None
    clip_presigned_url = None
    uploaded_media_type = "NONE"

    # 1. Detect if media_base64 is actually a video file
    file_type = str(payload.get("file_type", "")).lower()
    filename_hint = str(payload.get("filename", "")).lower()
    base64_media = payload.get("media_base64") or payload.get("photo_base64") or payload.get("face_image")
    base64_clip = payload.get("clip_base64") or payload.get("video_base64") or payload.get("media_clip")

    if (file_type == "video" or filename_hint.endswith(".mp4")) and base64_media and not base64_clip:
        base64_clip = base64_media
        base64_media = None

    if base64_media:
        try:
            clean_base64 = base64_media.split(",")[1] if "," in base64_media else base64_media
            raw_bytes = base64.b64decode(clean_base64)
            
            s3_key, version_marker, presigned_url = s3_storage.upload_photo(
                person_id=person_id,
                photo_bytes=raw_bytes,
                filename=face_filename
            )
            _PHOTO_MEMORY_CACHE[person_id] = raw_bytes
            media_dir = os.path.join(DATA_DIR, "media", person_id)
            os.makedirs(media_dir, exist_ok=True)
            with open(os.path.join(media_dir, face_filename), "wb") as pf:
                pf.write(raw_bytes)
            uploaded_media_type = "PHOTO"
        except Exception as e:
            print(f"[FRS MEDIA PROCESS WARN] {e}")

    # 2. Handle base64 full 1-minute video clip upload
    if base64_clip:
        try:
            clean_clip_b64 = base64_clip.split(",")[1] if "," in base64_clip else base64_clip
            clip_bytes = base64.b64decode(clean_clip_b64)

            _CLIP_MEMORY_CACHE[person_id] = clip_bytes
            # Persist directly on server disk
            media_dir = os.path.join(DATA_DIR, "media", person_id)
            os.makedirs(media_dir, exist_ok=True)
            with open(os.path.join(media_dir, clip_filename), "wb") as cf:
                cf.write(clip_bytes)

            s3_clip_key, clip_version_marker, clip_presigned_url = s3_storage.upload_photo(
                person_id=person_id,
                photo_bytes=clip_bytes,
                filename=clip_filename
            )
            uploaded_media_type = "1-MIN VIDEO CLIP"
        except Exception as e:
            print(f"[FRS CLIP PROCESS WARN] {e}")

    # Build target object with S3 metadata and version marker
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    target_obj = {
        "person_id": person_id,
        "person_name": person_name,
        "slug": slug,
        "case_id": case_id,
        "category": payload.get("category", "CRITICAL_SUSPECT"),
        "alert_priority": payload.get("alert_priority", "HIGH"),
        "enabled": int(payload.get("enabled", 1)),
        "s3_key": s3_key,
        "photo_version": version_marker,
        "photo_url": presigned_url,
        "s3_clip_key": s3_clip_key,
        "clip_version": clip_version_marker,
        "clip_url": clip_presigned_url,
        "media_source": {
            "clip_path": media_rel_path,
            "face_image_path": face_rel_path,
            "embeddings_path": embeddings_rel_path,
            "s3_key": s3_key,
            "s3_clip_key": s3_clip_key,
            "photo_version": version_marker,
            "clip_version": clip_version_marker
        },
        "inference_rules": {
            "similarity_threshold": float(payload.get("similarity_threshold", 0.78)),
            "target_cameras": payload.get("target_cameras", ["ALL"]),
            "trigger_cooldown_seconds": 30
        },
        # Flat fields for direct frontend/legacy access
        "media_path": media_rel_path,
        "face_image_path": face_rel_path,
        "target_cameras": payload.get("target_cameras", ["ALL"]),
        "similarity_threshold": float(payload.get("similarity_threshold", 0.78)),
        "notes": payload.get("notes", "Suspect marked for live camera monitoring"),
        "created_at": SAVED_FRS_TARGETS.get(person_id, {}).get("created_at", now_iso),
        "updated_at": now_iso
    }

    SAVED_FRS_TARGETS[person_id] = target_obj
    save_frs_targets(SAVED_FRS_TARGETS)

    # Clean ASCII Terminal Proof Output
    print("\n" + "=" * 65)
    print(f"[LIVE DEMO] FRS SUSPECT TARGET DEPLOYED: {person_name}")
    print(f" -> Person ID       : {person_id}")
    print(f" -> Case / FIR ID   : {case_id}")
    print(f" -> Priority        : {target_obj['alert_priority']}")
    print(f" -> Media Type      : {uploaded_media_type}")
    print(f" -> S3 Key          : s3://{s3_storage.bucket_name}/{s3_key}")
    print(f" -> Photo Version   : {version_marker}")
    print(f" -> Edge Path       : {face_rel_path}")
    print(f" -> Active Cameras  : {target_obj['target_cameras']}")
    print(f" -> Threshold       : {target_obj['similarity_threshold'] * 100}%")
    print(f" -> Total Suspects  : {len(SAVED_FRS_TARGETS)} Active in Registry")
    print("=" * 65 + "\n")

    # Broadcast notification to all connected dashboard websockets
    try:
        await ws_manager.broadcast_json({
            "event": "NEW_FRS_TARGET_DEPLOYED",
            "data": target_obj
        })
    except Exception:
        pass

    return ApiResponse.ok(target_obj)

@router.post("/targets/upload")
async def upload_target_with_video(
    person_name: str = Form(...),
    case_id: str = Form(...),
    category: str = Form("CRITICAL_SUSPECT"),
    alert_priority: str = Form("HIGH"),
    target_cameras: str = Form("ALL"),
    notes: str = Form("Suspect enrolled for live facial recognition tracking across Gujarat CCTV network."),
    video_file: Optional[UploadFile] = File(None)
):
    """
    High-Speed Multipart Form Upload for 1-Minute Suspect Video Clip.
    Directly streams video binary to local server disk and S3 without client-side base64 memory overhead.
    """
    if not person_name or not person_name.strip():
        raise HTTPException(status_code=400, detail="Suspect Full Name ('person_name') is compulsory.")
    if not case_id or not case_id.strip():
        raise HTTPException(status_code=400, detail="FIR / Case Reference ID ('case_id') is compulsory.")

    clean_name = person_name.strip()
    slug = sanitize_slug(clean_name)
    person_id = f"TGT-GJ-{len(SAVED_FRS_TARGETS)+1:03d}"
    clip_filename = "clip.mp4"
    face_filename = "face_reference.jpg"
    media_rel_path = f"clips/{slug}/{clip_filename}"
    face_rel_path = f"clips/{slug}/{face_filename}"

    # Parse target cameras
    cams = ["ALL"]
    try:
        if target_cameras.startswith("["):
            cams = json.loads(target_cameras)
        elif target_cameras != "ALL":
            cams = [target_cameras]
    except Exception:
        cams = [target_cameras]

    s3_clip_key = f"frs/targets/{person_id}/{clip_filename}"
    s3_key = f"frs/targets/{person_id}/{face_filename}"
    clip_version_marker = f"v_clip_{int(time.time())}"
    version_marker = f"v_{int(time.time())}"
    clip_presigned_url = None

    if video_file:
        clip_bytes = await video_file.read()
        if clip_bytes:
            _CLIP_MEMORY_CACHE[person_id] = clip_bytes
            media_dir = os.path.join(DATA_DIR, "media", person_id)
            os.makedirs(media_dir, exist_ok=True)
            with open(os.path.join(media_dir, clip_filename), "wb") as cf:
                cf.write(clip_bytes)
            
            s3_clip_key, clip_version_marker, clip_presigned_url = s3_storage.upload_photo(
                person_id=person_id,
                photo_bytes=clip_bytes,
                filename=clip_filename
            )

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    target_obj = {
        "person_id": person_id,
        "person_name": clean_name,
        "slug": slug,
        "case_id": case_id.strip(),
        "category": category,
        "alert_priority": alert_priority,
        "enabled": 1,
        "s3_key": s3_key,
        "photo_version": version_marker,
        "photo_url": None,
        "s3_clip_key": s3_clip_key,
        "clip_version": clip_version_marker,
        "clip_url": clip_presigned_url,
        "media_source": {
            "clip_path": media_rel_path,
            "face_image_path": face_rel_path,
            "embeddings_path": f"clips/{slug}/embeddings.npy",
            "s3_key": s3_key,
            "s3_clip_key": s3_clip_key,
            "photo_version": version_marker,
            "clip_version": clip_version_marker
        },
        "inference_rules": {
            "similarity_threshold": 0.78,
            "target_cameras": cams,
            "trigger_cooldown_seconds": 30
        },
        "media_path": media_rel_path,
        "face_image_path": face_rel_path,
        "target_cameras": cams,
        "similarity_threshold": 0.78,
        "notes": notes,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    SAVED_FRS_TARGETS[person_id] = target_obj
    save_frs_targets(SAVED_FRS_TARGETS)

    print("\n" + "=" * 65)
    print(f"[FAST MULTIPART UPLOAD] FRS SUSPECT ONBOARDED: {clean_name}")
    print(f" -> Person ID       : {person_id}")
    print(f" -> Case / FIR ID   : {case_id.strip()}")
    print(f" -> Local Disk File : clips/{slug}/clip.mp4")
    print(f" -> Active Cameras  : {cams}")
    print("=" * 65 + "\n")

    try:
        await ws_manager.broadcast_json({
            "event": "NEW_FRS_TARGET_DEPLOYED",
            "data": target_obj
        })
    except Exception:
        pass

    return ApiResponse.ok(target_obj)

@router.delete("/targets/{person_id}")
async def delete_target(person_id: str):
    """Delete or deactivate a suspect target."""
    if person_id in SAVED_FRS_TARGETS:
        deleted = SAVED_FRS_TARGETS.pop(person_id)
        _PHOTO_MEMORY_CACHE.pop(person_id, None)
        save_frs_targets(SAVED_FRS_TARGETS)
        
        print("\n" + "=" * 65)
        print(f"[LIVE DEMO] FRS SUSPECT TARGET REMOVED: {deleted.get('person_name')}")
        print(f" -> Person ID      : {person_id}")
        print(f" -> Total Suspects : {len(SAVED_FRS_TARGETS)} Remaining in Registry")
        print("=" * 65 + "\n")

        return ApiResponse.ok({"message": f"Target {person_id} deleted successfully", "person_id": person_id})
    raise HTTPException(status_code=404, detail="Target not found")

# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY MATCHES BUFFER & S3 HELPER
# ─────────────────────────────────────────────────────────────────────────────

IN_MEMORY_FRS_MATCHES: List[Dict[str, Any]] = []

def _process_and_upload_frs_snapshot(raw_snapshot: Optional[str], person_id: str, match_id: str) -> Optional[str]:
    """
    Decodes base64 CCTV face crop from Edge OpenCV/InsightFace node and uploads directly to AWS S3.
    """
    if not raw_snapshot or not isinstance(raw_snapshot, str):
        return None
    if raw_snapshot.startswith("http://") or raw_snapshot.startswith("https://"):
        return raw_snapshot

    try:
        clean_b64 = raw_snapshot.split(",")[1] if "," in raw_snapshot else raw_snapshot
        img_bytes = base64.b64decode(clean_b64)
        s3_url = s3_storage.upload_frs_match_snapshot(
            photo_bytes=img_bytes,
            person_id=person_id,
            match_id=match_id
        )
        return s3_url or raw_snapshot
    except Exception as e:
        print(f"[FRS SNAPSHOT PROCESS ERROR] {e}")
        return raw_snapshot

# ─────────────────────────────────────────────────────────────────────────────
# REAL-TIME FRS MATCH INGESTION & ALERTS (FOR OPENCV / INSIGHTFACE / TAO NODES)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/match")
@router.post("/ingest")
async def ingest_frs_match(payload: Dict[str, Any] = Body(...)):
    """
    Real-time FRS Match Ingestion endpoint for Edge OpenCV / InsightFace / DeepStream nodes.
    - Matches detected face against enrolled police suspects.
    - Uploads CCTV face crop to S3.
    - Persists match sighting to AWS RDS PostgreSQL 'frs_matches' table.
    - Broadcasts high-priority 'NEW_FRS_MATCH' WebSocket event with side-by-side comparison images.
    """
    global SAVED_FRS_TARGETS, IN_MEMORY_FRS_MATCHES
    pid = str(payload.get("person_id") or payload.get("target_id") or payload.get("id") or "").strip().upper()
    if not pid:
        raise HTTPException(status_code=400, detail="person_id is required")

    # Look up target metadata
    target = SAVED_FRS_TARGETS.get(pid)
    person_name = target.get("person_name") if target else str(payload.get("person_name") or payload.get("name") or pid)
    case_id = target.get("case_id") if target else str(payload.get("case_id") or "FIR-UNKNOWN")
    category = target.get("category") if target else str(payload.get("category") or "CRITICAL_SUSPECT")
    alert_priority = target.get("alert_priority") if target else str(payload.get("priority") or "CRITICAL")
    ref_photo_url = target.get("photo_url") or target.get("photo_download_url") or f"/api/v1/frs/targets/{pid}/photo" if target else None

    cam_code = str(payload.get("camera_code") or payload.get("cameraCode") or "CAM-001").strip()
    cam_name = str(payload.get("camera_name") or payload.get("cameraName") or f"Camera {cam_code}").strip()
    cam_id = str(payload.get("camera_id") or "1").strip()
    district = str(payload.get("district") or "Ahmedabad").strip()
    similarity = float(payload.get("similarity") or payload.get("confidence") or 0.85)
    bbox = payload.get("bounding_box") or payload.get("bbox")
    notes = str(payload.get("notes") or f"Facial recognition match detected at {cam_name} with {similarity*100:.1f}% confidence.").strip()

    match_id = f"FRS-ALT-{int(time.time() * 1000)}"

    # Upload CCTV detection face crop to S3
    raw_snap = payload.get("snapshot") or payload.get("imageCropUrl") or payload.get("face_crop")
    cctv_snapshot_url = _process_and_upload_frs_snapshot(raw_snap, pid, match_id)

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ")

    match_obj = {
        "id": match_id,
        "person_id": pid,
        "person_name": person_name,
        "case_id": case_id,
        "category": category,
        "severity": alert_priority,
        "camera_id": cam_id,
        "camera_code": cam_code,
        "cameraCode": cam_code,
        "camera_name": cam_name,
        "cameraName": cam_name,
        "district": district,
        "similarity": round(similarity, 4),
        "similarity_pct": f"{similarity * 100:.1f}%",
        "reference_photo_url": ref_photo_url,
        "snapshot_url": cctv_snapshot_url,
        "snapshot": cctv_snapshot_url,
        "bounding_box": bbox,
        "status": "NEW",
        "notes": notes,
        "matched_at": now_iso,
        "timestamp": now_iso
    }

    # 1. Persist to AWS RDS PostgreSQL
    conn = await get_db_connection()
    if conn:
        try:
            bbox_json = json.dumps(bbox) if bbox else None
            await conn.execute("""
                INSERT INTO frs_matches (
                    id, person_id, person_name, case_id, category, severity,
                    camera_id, camera_code, camera_name, district, similarity,
                    reference_photo_url, snapshot_url, bounding_box, status, notes, matched_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
                ON CONFLICT (id) DO NOTHING;
            """,
                match_id, pid, person_name, case_id, category, alert_priority,
                cam_id, cam_code, cam_name, district, similarity,
                ref_photo_url, cctv_snapshot_url, bbox_json, "NEW", notes
            )
        except Exception as e:
            print(f"[RDS FRS MATCH INSERT ERROR] {e}")
        finally:
            try:
                await conn.close()
            except Exception:
                pass

    # 2. Add to in-memory buffer (kept to last 200 matches)
    IN_MEMORY_FRS_MATCHES.insert(0, match_obj)
    if len(IN_MEMORY_FRS_MATCHES) > 200:
        IN_MEMORY_FRS_MATCHES.pop()

    # 3. Broadcast Real-time WebSocket Alert to Command Center & Alert Desk
    try:
        await ws_manager.broadcast_json({
            "type": "FRS_MATCH",
            "event": "NEW_FRS_MATCH",
            "payload": match_obj,
            "data": match_obj
        })
    except Exception:
        pass

    print("\n" + "=" * 65)
    print(f"[CRITICAL FRS MATCH HIT] {person_name} ({pid})")
    print(f" -> Camera    : {cam_name} ({cam_code})")
    print(f" -> Similarity: {similarity * 100:.1f}%")
    print(f" -> S3 Snapshot: {cctv_snapshot_url}")
    print("=" * 65 + "\n")

    return ApiResponse.ok(match_obj)

# ─────────────────────────────────────────────────────────────────────────────
# HISTORICAL FRS MATCHES SEARCH & SIGHTINGS AUDIT TRAIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/matches")
async def get_frs_matches(
    person_id: Optional[str] = Query(None, description="Suspect Person ID filter"),
    camera_code: Optional[str] = Query(None, description="Camera Code filter"),
    district: Optional[str] = Query(None, description="District filter"),
    limit: int = Query(100, description="Max matches to return"),
    offset: int = Query(0, description="Pagination offset")
):
    """
    Retrieve real-time and historical face recognition match hits from AWS RDS PostgreSQL.
    Powers the FRS Live Sightings feed and Side-by-Side Match Review in FaceRecognitionView.
    """
    conn = await get_db_connection()
    pid_str = str(person_id).strip().upper() if (person_id and not hasattr(person_id, "default")) else None
    cam_str = str(camera_code).strip().upper() if (camera_code and not hasattr(camera_code, "default")) else None
    dist_str = str(district).strip().upper() if (district and not hasattr(district, "default")) else None
    lim = int(limit) if (isinstance(limit, (int, str)) and str(limit).isdigit()) else 100
    off = int(offset) if (isinstance(offset, (int, str)) and str(offset).isdigit()) else 0

    if conn:
        try:
            conditions = ["1=1"]
            params = []
            p_idx = 1

            if pid_str:
                conditions.append(f"UPPER(person_id) = ${p_idx}")
                params.append(pid_str)
                p_idx += 1

            if cam_str and cam_str != "ALL":
                conditions.append(f"UPPER(camera_code) = ${p_idx}")
                params.append(cam_str)
                p_idx += 1

            if dist_str and dist_str != "ALL":
                conditions.append(f"UPPER(district) = ${p_idx}")
                params.append(dist_str)
                p_idx += 1

            where_clause = " AND ".join(conditions)

            total = await conn.fetchval(f"SELECT COUNT(*) FROM frs_matches WHERE {where_clause};", *params)

            params.append(lim)
            params.append(off)
            data_query = f"""
                SELECT 
                    id, person_id, person_name, case_id, category, severity,
                    camera_id, camera_code, camera_name, district, similarity,
                    reference_photo_url, snapshot_url, bounding_box, status, notes,
                    matched_at::text as matched_at,
                    matched_at::text as timestamp
                FROM frs_matches
                WHERE {where_clause}
                ORDER BY matched_at DESC
                LIMIT ${p_idx} OFFSET ${p_idx + 1};
            """
            rows = await conn.fetch(data_query, *params)
            await conn.close()

            results = []
            for r in rows:
                item = dict(r)
                sim = float(item.get("similarity") or 0.0)
                item["similarity_pct"] = f"{sim * 100:.1f}%"
                item["snapshot"] = item.get("snapshot_url")
                results.append(item)

            return ApiResponse.ok(results, total_records=total, page=(off // lim) + 1, page_size=lim)
        except Exception as e:
            print(f"[RDS FRS MATCHES SEARCH ERROR] {e}")

    # Fallback to in-memory buffer
    filtered = list(IN_MEMORY_FRS_MATCHES)
    if pid_str:
        filtered = [m for m in filtered if m.get("person_id") == pid_str]
    if cam_str and cam_str != "ALL":
        filtered = [m for m in filtered if m.get("camera_code") == cam_str]
    return ApiResponse.ok(filtered[off:off+lim], total_records=len(filtered))

# ─────────────────────────────────────────────────────────────────────────────
# SUSPECT SIGHTING JOURNEY (ACROSS GUJARAT SURVEILLANCE GRID)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/journey/{person_id}")
async def get_suspect_journey(person_id: str):
    """
    Returns ordered checkpoints of cameras where the suspect was sighted by FRS.
    """
    clean_id = str(person_id).strip().upper()
    conn = await get_db_connection()
    if conn:
        try:
            rows = await conn.fetch("""
                SELECT 
                    camera_id, 
                    camera_code, 
                    camera_name, 
                    district, 
                    similarity, 
                    snapshot_url, 
                    matched_at::text as timestamp
                FROM frs_matches
                WHERE UPPER(person_id) = $1
                ORDER BY matched_at ASC;
            """, clean_id)
            await conn.close()
            journey = [dict(r) for r in rows]
            return ApiResponse.ok({
                "person_id": clean_id,
                "total_sightings": len(journey),
                "journey": journey
            })
        except Exception as e:
            print(f"[RDS FRS JOURNEY ERROR] {e}")

    # In-memory fallback
    matches = [m for m in IN_MEMORY_FRS_MATCHES if m.get("person_id") == clean_id]
    matches.sort(key=lambda x: x.get("matched_at", ""))
    return ApiResponse.ok({
        "person_id": clean_id,
        "total_sightings": len(matches),
        "journey": matches
    })

