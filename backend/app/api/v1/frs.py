from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form, Response
from fastapi.responses import Response, RedirectResponse
from app.schemas.api_response import ApiResponse
from app.websockets.manager import ws_manager
from app.storage.s3 import s3_storage
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
    Streams or returns full 1-minute video clip binary from S3 or memory cache.
    """
    if person_id in _CLIP_MEMORY_CACHE:
        return Response(content=_CLIP_MEMORY_CACHE[person_id], media_type="video/mp4")

    target = SAVED_FRS_TARGETS.get(person_id)
    if target:
        s3_clip_key = target.get("s3_clip_key") or f"frs/targets/{person_id}/clip.mp4"
        clip_bytes = s3_storage.download_photo(s3_clip_key)
        if clip_bytes:
            _CLIP_MEMORY_CACHE[person_id] = clip_bytes
            return Response(content=clip_bytes, media_type="video/mp4")

    # If dummy or not found, return empty or 404
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

    # 1. Handle base64 photo upload directly to S3
    base64_media = payload.get("media_base64") or payload.get("photo_base64") or payload.get("face_image")
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
            uploaded_media_type = "PHOTO (Uploaded directly to S3)"
        except Exception as e:
            print(f"[FRS MEDIA PROCESS WARN] {e}")

    # 2. Handle base64 full 1-minute video clip upload directly to S3
    base64_clip = payload.get("clip_base64") or payload.get("video_base64") or payload.get("media_clip")
    if base64_clip:
        try:
            clean_clip_b64 = base64_clip.split(",")[1] if "," in base64_clip else base64_clip
            clip_bytes = base64.b64decode(clean_clip_b64)

            s3_clip_key, clip_version_marker, clip_presigned_url = s3_storage.upload_photo(
                person_id=person_id,
                photo_bytes=clip_bytes,
                filename=clip_filename
            )
            _CLIP_MEMORY_CACHE[person_id] = clip_bytes
            uploaded_media_type += " + 1-MIN VIDEO CLIP"
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

