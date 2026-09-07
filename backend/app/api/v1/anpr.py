from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, Query, Response
from app.schemas.api_response import ApiResponse
from app.websockets.manager import ws_manager
from app.core.config import settings
import json
import asyncpg
import asyncio
import os
import time
from datetime import datetime

router = APIRouter(prefix="/anpr", tags=["Model 2 — ANPR & ROI Services"])

# File-backed in-memory storage fallback for ROIs and AI configs
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
ROI_FILE = os.path.join(DATA_DIR, "saved_rois.json")
AI_CONFIG_FILE = os.path.join(DATA_DIR, "saved_ai_configs.json")
ALERTS_CACHE_FILE = os.path.join(DATA_DIR, "saved_alerts.json")

def load_json_file(filepath: str) -> Dict[str, Any]:
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_json_file(filepath: str, data: Dict[str, Any]):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

SAVED_ROIS: Dict[str, Dict[str, Any]] = load_json_file(ROI_FILE)
AI_CONFIGS: Dict[str, Dict[str, Any]] = load_json_file(AI_CONFIG_FILE)

# In-memory alerts buffer (keeps last 500 in memory + persistent RDS storage)
IN_MEMORY_ALERTS: List[Dict[str, Any]] = [
    {
        "id": "ALT-LIVE-001",
        "title": "STOLEN VEHICLE DETECTED: GJ01AB1234",
        "severity": "CRITICAL",
        "category": "HOTLIST_STOLEN",
        "number_plate": "GJ01AB1234",
        "plateNumber": "GJ01AB1234",
        "camera_code": "CAM-033",
        "cameraCode": "CAM-033",
        "camera_name": "SG Highway - Junction 33",
        "cameraName": "SG Highway - Junction 33",
        "district": "Ahmedabad",
        "watchlist_hit": True,
        "status": "NEW",
        "notes": "Stolen vehicle matched against Gujarat Police national hotlist",
        "timestamp": datetime.now().isoformat(),
        "received_at": datetime.now().isoformat(),
        "snapshot": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop"
    },
    {
        "id": "ALT-LIVE-002",
        "title": "SPEED VIOLATION: GJ05CD5678 (112 km/h in 80 km/h Zone)",
        "severity": "HIGH",
        "category": "SPEED_VIOLATION",
        "number_plate": "GJ05CD5678",
        "plateNumber": "GJ05CD5678",
        "camera_code": "CAM-005",
        "cameraCode": "CAM-005",
        "camera_name": "Visat Teen Rasta Highway",
        "cameraName": "Visat Teen Rasta Highway",
        "district": "Gandhinagar",
        "watchlist_hit": False,
        "status": "ACTIVE",
        "notes": "Vehicle speed 112 km/h exceeded segment limit 80 km/h",
        "timestamp": datetime.now().isoformat(),
        "received_at": datetime.now().isoformat(),
        "snapshot": "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop"
    }
]

ANPR_WATCHLIST: List[str] = [
    "GJ01AB1234",
    "GJ05CD5678",
    "GJ27XY9999",
    "GJ03EF4321",
    "MH02CB8899"
]

# Cache DB connection
_LAST_DB_CHECK_TIME = 0
_DB_AVAILABLE = False

async def get_db_connection():
    global _LAST_DB_CHECK_TIME, _DB_AVAILABLE
    now = time.time()
    if not _DB_AVAILABLE and (now - _LAST_DB_CHECK_TIME < 30):
        return None
        
    try:
        _LAST_DB_CHECK_TIME = now
        conn = await asyncio.wait_for(
            asyncpg.connect(
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database=settings.POSTGRES_DB,
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
                timeout=2.0
            ),
            timeout=2.5
        )
        _DB_AVAILABLE = True
        return conn
    except Exception as e:
        _DB_AVAILABLE = False
        return None

# ─────────────────────────────────────────────────────────────────────────────
# REAL-TIME ANPR ALERTS & INGESTION (CONNECTED DIRECTLY TO AWS RDS)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/alerts/live")
@router.get("/events")
async def get_live_alerts(limit: int = Query(6000, description="Max alerts to retrieve")):
    """
    Fetch live ANPR detection alerts from AWS RDS PostgreSQL with instant in-memory fallback.
    Powers the ANPR Search Table, Alert Center Desk, and Vehicle Journey Engine.
    """
    conn = await get_db_connection()
    if conn:
        try:
            rows = await conn.fetch("""
                SELECT 
                    id::text, 
                    severity, 
                    category, 
                    number_plate, 
                    camera_id, 
                    camera_code, 
                    camera_name, 
                    district, 
                    watchlist_hit, 
                    status, 
                    title, 
                    notes, 
                    received_at::text as timestamp
                FROM anpr_alerts 
                ORDER BY received_at DESC 
                LIMIT $1;
            """, limit)
            await conn.close()

            if rows:
                db_alerts = []
                for r in rows:
                    rec = dict(r)
                    rec["plateNumber"] = rec.get("number_plate")
                    rec["cameraCode"] = rec.get("camera_code")
                    rec["cameraName"] = rec.get("camera_name")
                    rec["receivedAt"] = rec.get("timestamp")
                    db_alerts.append(rec)
                
                # Merge DB alerts with any fresh in-memory events
                return ApiResponse.ok(db_alerts, total_records=len(db_alerts))
        except Exception as e:
            print(f"[RDS ALERT FETCH ERROR] {e}")

    # Fallback to in-memory buffer
    return ApiResponse.ok(IN_MEMORY_ALERTS[:limit], total_records=len(IN_MEMORY_ALERTS))

@router.post("/ingest")
@router.post("/ingest/public")
async def ingest_anpr_alert(payload: Dict[str, Any] = Body(...)):
    """
    Real-time ANPR Ingestion endpoint for Edge YOLO / DeepStream / OpenCV nodes.
    Saves to AWS RDS PostgreSQL 'anpr_alerts' table and broadcasts via WebSockets.
    """
    plate = str(payload.get("number_plate") or payload.get("plateNumber") or payload.get("plate") or "").upper().strip()
    is_hit = bool(payload.get("watchlist_hit", plate in ANPR_WATCHLIST))
    cam_code = str(payload.get("camera_code") or payload.get("cameraCode") or "CAM-033").strip()
    cam_name = str(payload.get("camera_name") or payload.get("cameraName") or f"Camera {cam_code}").strip()
    district = str(payload.get("district") or "Ahmedabad").strip()
    severity = str(payload.get("severity") or ("CRITICAL" if is_hit else "INFO")).upper()
    category = str(payload.get("category") or ("HOTLIST_STOLEN" if is_hit else "ANPR_DETECTION")).upper()
    notes = str(payload.get("notes") or ("Stolen vehicle watchlist hit" if is_hit else "Plate scanned at checkpoint")).strip()
    title = str(payload.get("title") or (f"WATCHLIST HIT: {plate}" if is_hit else f"ANPR: {plate}")).strip()

    alert_id = f"ALT-{int(time.time() * 1000)}"

    alert_obj = {
        "id": alert_id,
        "title": title,
        "severity": severity,
        "category": category,
        "number_plate": plate,
        "plateNumber": plate,
        "camera_id": payload.get("camera_id", 1),
        "camera_code": cam_code,
        "cameraCode": cam_code,
        "camera_name": cam_name,
        "cameraName": cam_name,
        "district": district,
        "watchlist_hit": is_hit,
        "status": "NEW",
        "notes": notes,
        "timestamp": datetime.now().isoformat(),
        "received_at": datetime.now().isoformat(),
        "snapshot": payload.get("snapshot") or payload.get("imageCropUrl") or "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop"
    }

    # 1. Store in memory buffer
    IN_MEMORY_ALERTS.insert(0, alert_obj)
    if len(IN_MEMORY_ALERTS) > 500:
        IN_MEMORY_ALERTS.pop()

    # 2. Persist to AWS RDS PostgreSQL
    conn = await get_db_connection()
    if conn:
        try:
            await conn.execute("""
                INSERT INTO anpr_alerts (
                    severity, category, number_plate, camera_id, camera_code, 
                    camera_name, district, watchlist_hit, status, title, notes, received_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP);
            """, severity, category, plate, str(payload.get("camera_id", "1")), cam_code, cam_name, district, is_hit, "NEW", title, notes)
            await conn.close()
            print(f"✅ [RDS ANPR ALERT STORED] Plate: {plate} | Camera: {cam_code} | Watchlist Hit: {is_hit}")
        except Exception as e:
            print(f"⚠️ [RDS INSERT WARN] {e}")

    # 3. Broadcast real-time event via WebSocket to all connected React Dashboards
    try:
        await ws_manager.broadcast_json({
            "type": "ANPR_ALERT",
            "event": "NEW_ANPR_ALERT",
            "payload": alert_obj,
            "data": alert_obj
        })
    except Exception:
        pass

    return ApiResponse.ok(alert_obj)

@router.post("/ingest/test")
async def fire_test_alerts():
    """Fire mock real-time ANPR alerts for instant live demo testing."""
    test_plates = [
        ("GJ01AB1234", "CAM-033", "SG Highway - Junction 33", "Ahmedabad", "CRITICAL", "HOTLIST_STOLEN", True),
        ("GJ05CD5678", "CAM-014", "Iscon Cross Road", "Ahmedabad", "HIGH", "SPEED_VIOLATION", True),
        ("GJ27XY9999", "CAM-005", "Visat Teen Rasta Highway", "Gandhinagar", "CRITICAL", "WANTED_SUSPECT", True)
    ]

    results = []
    for plate, cam, name, dist, sev, cat, hit in test_plates:
        res = await ingest_anpr_alert({
            "number_plate": plate,
            "camera_code": cam,
            "camera_name": name,
            "district": dist,
            "severity": sev,
            "category": cat,
            "watchlist_hit": hit,
            "notes": f"Live test detection on {name} ({dist})"
        })
        results.append(res)

    return ApiResponse.ok({"message": "Test alerts ingested and broadcasted successfully", "total": len(results)})

@router.post("/alerts/purge")
@router.delete("/alerts/purge")
async def purge_all_alerts():
    """Purge all ANPR alerts from RDS and memory."""
    global IN_MEMORY_ALERTS
    IN_MEMORY_ALERTS = []
    
    conn = await get_db_connection()
    if conn:
        try:
            await conn.execute("TRUNCATE TABLE anpr_alerts;")
            await conn.close()
            print("🗑️ [RDS PURGE] anpr_alerts table truncated.")
        except Exception as e:
            print(f"[RDS PURGE WARN] {e}")

    return ApiResponse.ok({"status": "success", "message": "All alerts purged successfully"})

@router.delete("/alerts/{alert_id}")
@router.delete("/alerts/public/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete a single alert by ID."""
    global IN_MEMORY_ALERTS
    IN_MEMORY_ALERTS = [a for a in IN_MEMORY_ALERTS if str(a.get("id")) != str(alert_id)]

    conn = await get_db_connection()
    if conn:
        try:
            if alert_id.isdigit():
                await conn.execute("DELETE FROM anpr_alerts WHERE id = $1;", int(alert_id))
            await conn.close()
        except Exception:
            pass

    return ApiResponse.ok({"status": "success", "deleted_id": alert_id})

# ─────────────────────────────────────────────────────────────────────────────
# WATCHLIST MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/watchlist")
async def get_watchlist():
    """Fetch active ANPR stolen/wanted watchlist."""
    return {"status": "success", "watchlist": ANPR_WATCHLIST}

@router.post("/watchlist")
@router.post("/watchlist/add")
async def add_watchlist_plate(payload: Dict[str, Any] = Body(...)):
    """Add a plate to the active watchlist."""
    plate = str(payload.get("plate") or payload.get("number_plate") or "").upper().strip()
    if plate and plate not in ANPR_WATCHLIST:
        ANPR_WATCHLIST.append(plate)
        print(f"📋 [WATCHLIST ADDED] Plate: {plate} | Total: {len(ANPR_WATCHLIST)}")
    return ApiResponse.ok({"status": "success", "watchlist": ANPR_WATCHLIST})

@router.post("/watchlist/remove")
@router.delete("/watchlist/{plate}")
async def remove_watchlist_plate(plate: str):
    """Remove a plate from the active watchlist."""
    clean = plate.upper().strip()
    if clean in ANPR_WATCHLIST:
        ANPR_WATCHLIST.remove(clean)
    return ApiResponse.ok({"status": "success", "watchlist": ANPR_WATCHLIST})

from app.core.camera_utils import get_code_aliases, normalize_camera_code, get_sentinel_code

# ─────────────────────────────────────────────────────────────────────────────
# SYNC VERSION FOR EDGE DAEMON CHANGE-DETECTION (FAST MAX UPDATED_AT)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sync-version")
async def get_sync_version():
    """
    Ultra-lightweight endpoint for edge listener daemons.
    Returns the latest ISO timestamps of modifications to AI configs and ROIs.
    """
    ai_updated_at = None
    rois_updated_at = None

    conn = await get_db_connection()
    if conn:
        try:
            row_ai = await conn.fetchrow("SELECT MAX(updated_at) as max_updated FROM anpr_camera_ai_configs;")
            if row_ai and row_ai["max_updated"]:
                ai_updated_at = row_ai["max_updated"].isoformat()

            row_roi = await conn.fetchrow("SELECT MAX(updated_at) as max_updated FROM anpr_camera_rois;")
            if row_roi and row_roi["max_updated"]:
                rois_updated_at = row_roi["max_updated"].isoformat()
            await conn.close()
        except Exception as e:
            print(f"[SYNC VERSION RDS WARN] {e}")

    # Fallback to local memory / file modification times if DB offline
    if not ai_updated_at and os.path.exists(AI_CONFIG_FILE):
        ai_updated_at = datetime.fromtimestamp(os.path.getmtime(AI_CONFIG_FILE)).isoformat()
    if not rois_updated_at and os.path.exists(ROI_FILE):
        rois_updated_at = datetime.fromtimestamp(os.path.getmtime(ROI_FILE)).isoformat()

    return {
        "status": "success",
        "ai_configs_updated_at": ai_updated_at,
        "rois_updated_at": rois_updated_at
    }

# ─────────────────────────────────────────────────────────────────────────────
# DETECTION AREA & ROI POLYGON MANAGEMENT (AWS RDS BACKED)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/all-rois")
async def get_all_rois():
    """Batch fetch all stored camera ROIs directly from RDS PostgreSQL."""
    conn = await get_db_connection()
    if conn:
        try:
            rows = await conn.fetch("SELECT camera_code, camera_name, resolution, zone_name, points_json, updated_at FROM anpr_camera_rois;")
            await conn.close()
            if rows:
                db_rois = {}
                for r in rows:
                    pts = json.loads(r["points_json"]) if r["points_json"] else []
                    coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts if isinstance(p, dict)]
                    rec = {
                        "camera_code": r["camera_code"],
                        "camera_name": r["camera_name"],
                        "resolution": r["resolution"],
                        "zone_name": r["zone_name"],
                        "points": pts,
                        "coordinates": coords,
                        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None
                    }
                    for alias in get_code_aliases(r["camera_code"]):
                        db_rois[alias] = rec
                # Update cache
                SAVED_ROIS.update(db_rois)
                return ApiResponse.ok(db_rois)
        except Exception as e:
            print(f"[RDS ALL-ROIS FETCH WARN] {e}")

    return ApiResponse.ok(SAVED_ROIS)

@router.post("/roi")
@router.post("/roi/save")
@router.post("/roi/{camera_code}")
async def save_camera_roi(camera_code: Optional[str] = None, payload: Dict[str, Any] = Body(...)):
    """Save camera ROI polygon coordinates to RDS and memory."""
    cam_code = str(camera_code or payload.get("camera_code") or payload.get("cameraCode") or "").strip()
    if not cam_code:
        raise HTTPException(status_code=400, detail="camera_code is required")

    canonical_code = normalize_camera_code(cam_code)
    aliases = get_code_aliases(cam_code)

    points = payload.get("points") or []
    if points and isinstance(points, list) and isinstance(points[0], dict):
        coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in points]
    else:
        coords = points

    roi_record = {
        "camera_code": canonical_code,
        "camera_name": payload.get("camera_name") or f"Camera {canonical_code}",
        "resolution": payload.get("resolution", "1920x1080"),
        "zone_name": payload.get("zone_name", "Detection Zone 1"),
        "points": points,
        "coordinates": coords,
        "saved_to_rds": False
    }

    for code in aliases:
        SAVED_ROIS[code] = roi_record
    save_json_file(ROI_FILE, SAVED_ROIS)

    # Persist to AWS RDS PostgreSQL
    conn = await get_db_connection()
    if conn:
        try:
            pts_json = json.dumps(points)
            await conn.execute("""
                INSERT INTO anpr_camera_rois (camera_code, camera_name, resolution, zone_name, points_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT (camera_code) 
                DO UPDATE SET camera_name = $2, resolution = $3, zone_name = $4, points_json = $5, updated_at = CURRENT_TIMESTAMP;
            """, canonical_code, payload.get("camera_name", ""), payload.get("resolution", "1920x1080"), payload.get("zone_name", ""), pts_json)
            roi_record["saved_to_rds"] = True
            await conn.close()
        except Exception as e:
            print(f"[RDS ROI SAVE WARN] {e}")

    return {"status": "success", "message": f"ROI saved for {canonical_code}", "saved_to_rds": roi_record["saved_to_rds"], "data": roi_record}

@router.get("/roi/{camera_code}")
async def get_camera_roi(camera_code: str):
    """Retrieve saved ROI polygon coordinates for a camera."""
    cam_code = camera_code.strip()
    for alias in get_code_aliases(cam_code):
        if alias in SAVED_ROIS:
            return ApiResponse.ok(SAVED_ROIS[alias])

    conn = await get_db_connection()
    if conn:
        try:
            row = await conn.fetchrow("""
                SELECT camera_code, camera_name, resolution, zone_name, points_json, updated_at 
                FROM anpr_camera_rois 
                WHERE camera_code = $1 OR camera_code = $2;
            """, normalize_camera_code(cam_code), get_sentinel_code(cam_code))
            if row:
                pts = json.loads(row["points_json"]) if row["points_json"] else []
                coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in pts if isinstance(p, dict)]
                rec = {
                    "camera_code": row["camera_code"],
                    "camera_name": row["camera_name"],
                    "resolution": row["resolution"],
                    "zone_name": row["zone_name"],
                    "points": pts,
                    "coordinates": coords,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
                }
                for alias in get_code_aliases(row["camera_code"]):
                    SAVED_ROIS[alias] = rec
                await conn.close()
                return ApiResponse.ok(rec)
            await conn.close()
        except Exception:
            pass

    return ApiResponse.ok({"camera_code": cam_code, "points": [], "coordinates": []})

# ─────────────────────────────────────────────────────────────────────────────
# AI VISION MODEL CONFIGURATIONS (AWS RDS BACKED)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/all-ai-configs")
async def get_all_ai_configs():
    """Batch fetch all active AI vision model configurations from AWS RDS."""
    conn = await get_db_connection()
    if conn:
        try:
            rows = await conn.fetch("""
                SELECT camera_code, camera_name, enable_vector, usecases_json, models_json, 
                       confidence_threshold, target_fps, updated_at 
                FROM anpr_camera_ai_configs;
            """)
            await conn.close()
            if rows:
                db_configs = {}
                for r in rows:
                    raw_vec = r["enable_vector"] or "[0,0,0,0]"
                    try:
                        vec = json.loads(raw_vec) if isinstance(raw_vec, str) else list(raw_vec)
                    except Exception:
                        vec = [0, 0, 0, 0]

                    models = json.loads(r["models_json"]) if isinstance(r["models_json"], str) else (r["models_json"] or {})
                    usecases = json.loads(r["usecases_json"]) if isinstance(r["usecases_json"], str) else (r["usecases_json"] or [])
                    conf = float(r["confidence_threshold"]) if r["confidence_threshold"] is not None else 0.500

                    rec = {
                        "camera_code": r["camera_code"],
                        "camera_name": r["camera_name"],
                        "enable": vec,
                        "usecases": usecases,
                        "models": models,
                        "confidence_threshold": conf,
                        "target_fps": r["target_fps"] or 15,
                        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None
                    }
                    for alias in get_code_aliases(r["camera_code"]):
                        db_configs[alias] = rec
                AI_CONFIGS.update(db_configs)
                return ApiResponse.ok(db_configs)
        except Exception as e:
            print(f"[RDS ALL AI CONFIGS FETCH WARN] {e}")

    return ApiResponse.ok(AI_CONFIGS)

@router.post("/ai-config")
async def save_ai_config(payload: Dict[str, Any] = Body(...)):
    """Save active AI vision model configuration, enable vector, and usecases to RDS."""
    cam_code = str(payload.get("camera_code") or payload.get("cameraCode") or "").strip()
    if not cam_code:
        raise HTTPException(status_code=400, detail="camera_code is required")
        
    canonical_code = normalize_camera_code(cam_code)
    aliases = get_code_aliases(cam_code)

    for code in aliases:
        AI_CONFIGS[code] = payload
    save_json_file(AI_CONFIG_FILE, AI_CONFIGS)

    # Format data for PostgreSQL
    enable_vec = payload.get("enable") or [0, 0, 0, 0]
    enable_str = json.dumps(enable_vec)
    usecases_json = json.dumps(payload.get("usecases") or [])
    models_json = json.dumps(payload.get("models") or {})
    raw_thresh = payload.get("confidence_threshold", 0.5)
    # If user provided percentage 85 -> convert to 0.85
    thresh = float(raw_thresh) / 100.0 if float(raw_thresh) > 1.0 else float(raw_thresh)
    target_fps = int(payload.get("target_fps", 15))

    conn = await get_db_connection()
    if conn:
        try:
            await conn.execute("""
                INSERT INTO anpr_camera_ai_configs (
                    camera_code, camera_name, enable_vector, usecases_json, models_json, 
                    confidence_threshold, target_fps, updated_at
                ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (camera_code)
                DO UPDATE SET 
                    camera_name = $2,
                    enable_vector = $3,
                    usecases_json = $4::jsonb,
                    models_json = $5::jsonb,
                    confidence_threshold = $6,
                    target_fps = $7,
                    updated_at = CURRENT_TIMESTAMP;
            """, canonical_code, payload.get("camera_name", f"Camera {canonical_code}"), enable_str, usecases_json, models_json, thresh, target_fps)
            await conn.close()
            print(f"✅ [RDS AI CONFIG STORED] Camera: {canonical_code} | Enable: {enable_str}")
        except Exception as e:
            print(f"[RDS AI CONFIG SAVE WARN] {e}")

    return ApiResponse.ok({"status": "success", "camera_code": canonical_code, "data": payload})

@router.get("/ai-config/{camera_code}")
async def get_ai_config(camera_code: str):
    """Fetch active AI vision models configuration for a camera."""
    cam_code = camera_code.strip()
    for alias in get_code_aliases(cam_code):
        if alias in AI_CONFIGS:
            return ApiResponse.ok(AI_CONFIGS[alias])

    conn = await get_db_connection()
    if conn:
        try:
            row = await conn.fetchrow("""
                SELECT camera_code, camera_name, enable_vector, usecases_json, models_json, 
                       confidence_threshold, target_fps, updated_at 
                FROM anpr_camera_ai_configs 
                WHERE camera_code = $1 OR camera_code = $2;
            """, normalize_camera_code(cam_code), get_sentinel_code(cam_code))
            if row:
                raw_vec = row["enable_vector"] or "[0,0,0,0]"
                try:
                    vec = json.loads(raw_vec) if isinstance(raw_vec, str) else list(raw_vec)
                except Exception:
                    vec = [0, 0, 0, 0]

                models = json.loads(row["models_json"]) if isinstance(row["models_json"], str) else (row["models_json"] or {})
                usecases = json.loads(row["usecases_json"]) if isinstance(row["usecases_json"], str) else (row["usecases_json"] or [])
                conf = float(row["confidence_threshold"]) if row["confidence_threshold"] is not None else 0.500

                rec = {
                    "camera_code": row["camera_code"],
                    "camera_name": row["camera_name"],
                    "enable": vec,
                    "usecases": usecases,
                    "models": models,
                    "confidence_threshold": conf,
                    "target_fps": row["target_fps"] or 15,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
                }
                for alias in get_code_aliases(row["camera_code"]):
                    AI_CONFIGS[alias] = rec
                await conn.close()
                return ApiResponse.ok(rec)
            await conn.close()
        except Exception:
            pass

    return ApiResponse.ok({
        "camera_code": cam_code,
        "models": {"anpr": False, "frs": False, "crowd": False, "ppe": False, "footfall": False, "perimeter": False},
        "enable": [0, 0, 0, 0],
        "usecases": [],
        "confidence_threshold": 0.500,
        "target_fps": 15
    })

@router.delete("/ai-config/{camera_code}")
@router.post("/ai-config/{camera_code}/undeploy")
async def undeploy_ai_config(camera_code: str):
    """Undeploy / unassign all AI vision models from a camera node."""
    cam_code = camera_code.strip()
    canonical_code = normalize_camera_code(cam_code)
    aliases = get_code_aliases(cam_code)

    for code in aliases:
        AI_CONFIGS.pop(code, None)
    save_json_file(AI_CONFIG_FILE, AI_CONFIGS)

    conn = await get_db_connection()
    if conn:
        try:
            await conn.execute("""
                DELETE FROM anpr_camera_ai_configs 
                WHERE camera_code = $1 OR camera_code = $2;
            """, canonical_code, get_sentinel_code(cam_code))
            await conn.close()
        except Exception as e:
            print(f"[RDS AI CONFIG DELETE WARN] {e}")

    return ApiResponse.ok({
        "status": "success",
        "message": f"AI models undeployed successfully for {canonical_code}",
        "camera_code": canonical_code
    })

