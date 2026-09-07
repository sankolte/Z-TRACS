from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from app.schemas.api_response import ApiResponse
from app.websockets.manager import ws_manager
import json
import os
import re
import time
import base64

router = APIRouter(prefix="/frs", tags=["Model 2 — Face Recognition & Suspect Search Services"])

# Directories for clips and metadata storage
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
CLIPS_DIR = os.path.join(BASE_DIR, "clips")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
os.makedirs(CLIPS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

FRS_TARGETS_FILE = os.path.join(DATA_DIR, "saved_frs_targets.json")

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
            "media_path": "clips/usr1/clip.mp4",
            "face_image_path": "clips/usr1/face_reference.jpg",
            "enabled": 1,
            "target_cameras": ["ALL"],
            "similarity_threshold": 0.78,
            "notes": "Suspect in Ahmedabad vehicle theft series",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    }
    # Create sample folder
    sample_dir = os.path.join(CLIPS_DIR, "usr1")
    os.makedirs(sample_dir, exist_ok=True)
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

@router.get("/export-targets")
async def export_targets_for_edge():
    """High-speed batch endpoint for update_frs.py edge daemon listener."""
    global SAVED_FRS_TARGETS
    SAVED_FRS_TARGETS = load_frs_targets()
    targets_list = []
    for t in SAVED_FRS_TARGETS.values():
        if t.get("enabled", 1) == 1:
            slug = t.get("slug") or t.get("person_id", "usr").lower().replace("-", "_")
            clip_p = t.get("media_path") or f"clips/{slug}/clip.mp4"
            face_p = t.get("face_image_path") or f"clips/{slug}/face_reference.jpg"
            emb_p = f"clips/{slug}/embeddings.npy"

            targets_list.append({
                "person_id": t.get("person_id"),
                "person_name": t.get("person_name"),
                "case_id": t.get("case_id"),
                "category": t.get("category", "CRITICAL_SUSPECT"),
                "alert_priority": t.get("alert_priority", "HIGH"),
                "enabled": int(t.get("enabled", 1)),
                "media_source": {
                    "clip_path": clip_p,
                    "face_image_path": face_p,
                    "embeddings_path": emb_p
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
    """Create or update a suspect target via JSON (supports base64 media or file references)."""
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

    # Target folder: clips/{slug}/
    target_folder = os.path.join(CLIPS_DIR, slug)
    os.makedirs(target_folder, exist_ok=True)

    clip_filename = "clip.mp4"
    face_filename = "face_reference.jpg"
    embeddings_filename = "embeddings.npy"

    media_rel_path = f"clips/{slug}/{clip_filename}"
    face_rel_path = f"clips/{slug}/{face_filename}"
    embeddings_rel_path = f"clips/{slug}/{embeddings_filename}"

    uploaded_media_type = "NONE"

    # Handle base64 media upload if provided (supports both photos and video clips)
    base64_media = payload.get("media_base64")
    raw_file_type = str(payload.get("file_type") or "").lower()
    raw_filename = str(payload.get("filename") or "").lower()

    if base64_media:
        try:
            is_image = "image" in raw_file_type or any(raw_filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp"])
            is_video = "video" in raw_file_type or any(raw_filename.endswith(ext) for ext in [".mp4", ".mkv", ".avi", ".mov"])

            # Check data URI scheme (e.g. data:image/png;base64,...)
            if "data:image" in str(base64_media)[:40]:
                is_image = True
            elif "data:video" in str(base64_media)[:40]:
                is_video = True

            clean_base64 = base64_media.split(",")[1] if "," in base64_media else base64_media
            raw_bytes = base64.b64decode(clean_base64)

            # Auto-detect via Magic Bytes if still unknown
            if not is_image and not is_video and len(raw_bytes) >= 8:
                if raw_bytes.startswith(b'\xff\xd8\xff') or raw_bytes.startswith(b'\x89PNG') or raw_bytes.startswith(b'GIF8'):
                    is_image = True
                elif b'ftyp' in raw_bytes[:16] or raw_bytes.startswith(b'\x1a\x45\xdf\xa3'):
                    is_video = True
                else:
                    is_image = True  # Default fallback for single face snapshots

            if is_image:
                uploaded_media_type = "PHOTO (Reference Image)"
                dest_file = os.path.join(target_folder, face_filename)
                with open(dest_file, "wb") as f:
                    f.write(raw_bytes)
            else:
                uploaded_media_type = "VIDEO (Clip)"
                dest_file = os.path.join(target_folder, clip_filename)
                with open(dest_file, "wb") as f:
                    f.write(raw_bytes)

        except Exception as e:
            print(f"[FRS BASE64 WRITE WARN] {e}")

    # Build target object with rich YOLO structure
    target_obj = {
        "person_id": person_id,
        "person_name": person_name,
        "slug": slug,
        "case_id": case_id,
        "category": payload.get("category", "CRITICAL_SUSPECT"),
        "alert_priority": payload.get("alert_priority", "HIGH"),
        "enabled": int(payload.get("enabled", 1)),
        "media_source": {
            "clip_path": media_rel_path,
            "face_image_path": face_rel_path,
            "embeddings_path": embeddings_rel_path
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
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
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
    print(f" -> Target Folder   : clips/{slug}/")
    print(f" -> Reference Image : {face_rel_path}")
    print(f" -> Video Clip Path : {media_rel_path}")
    print(f" -> Active Cameras  : {target_obj['target_cameras']}")
    print(f" -> Threshold       : {target_obj['similarity_threshold'] * 100}%")
    print(f" -> Total Suspects  : {len(SAVED_FRS_TARGETS)} Active in Edge Database")
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
        save_frs_targets(SAVED_FRS_TARGETS)
        
        print("\n" + "=" * 65)
        print(f"[LIVE DEMO] FRS SUSPECT TARGET REMOVED: {deleted.get('person_name')}")
        print(f" -> Person ID      : {person_id}")
        print(f" -> Total Suspects : {len(SAVED_FRS_TARGETS)} Remaining in Edge Database")
        print("=" * 65 + "\n")

        return ApiResponse.ok({"message": f"Target {person_id} deleted successfully", "person_id": person_id})
    raise HTTPException(status_code=404, detail="Target not found")
