from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body, Query, Response
from app.schemas.api_response import ApiResponse
from app.websockets.manager import ws_manager
from app.core.config import settings
from app.storage.s3 import s3_storage
import json
import asyncpg
import asyncio
import os
import time
import base64
import re
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

# In-memory detections buffer (All Traffic Telemetry, last 1000)
IN_MEMORY_DETECTIONS: List[Dict[str, Any]] = []

# In-memory alerts buffer (keeps last 500 in memory + persistent RDS storage)
IN_MEMORY_ALERTS: List[Dict[str, Any]] = []

def _process_and_upload_snapshot(raw_snapshot: Optional[str], plate: str, identifier: str) -> Optional[str]:
    """Uploads base64 snapshot to S3 and returns S3 URL, or retains clean URL/base64."""
    if not raw_snapshot or not str(raw_snapshot).strip():
        return None
    
    s = str(raw_snapshot).strip()
    if s.startswith("http://") or s.startswith("https://"):
        if "unsplash.com" in s:
            return None
        return s
    
    b64_data = s
    if "," in b64_data and ("data:image" in b64_data or ";base64" in b64_data):
        b64_data = b64_data.split(",", 1)[1]
    
    try:
        img_bytes = base64.b64decode(b64_data)
        if len(img_bytes) > 50:
            s3_url = s3_storage.upload_anpr_snapshot(img_bytes, plate, identifier)
            if s3_url:
                return s3_url
    except Exception as e:
        print(f"[ANPR SNAPSHOT S3 UPLOAD WARN] {e}")
    
    if not s.startswith("data:image"):
        return f"data:image/jpeg;base64,{s}"
    return s

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
                    snapshot,
                    speed_kmh,
                    plate_crop,
                    plate_confidence,
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
                    rec["snapshot"] = rec.get("plate_crop") or rec.get("snapshot")
                    rec["imageCropUrl"] = rec.get("plate_crop") or rec.get("snapshot")
                    rec["speedKmh"] = rec.get("speed_kmh")
                    rec["speed"] = rec.get("speed_kmh")
                    rec["plateConfidence"] = rec.get("plate_confidence")
                    db_alerts.append(rec)
                
                # Merge DB alerts with any fresh in-memory events
                in_mem_ids = {a.get("id") for a in IN_MEMORY_ALERTS if a.get("id")}
                combined = list(IN_MEMORY_ALERTS) + [d for d in db_alerts if d.get("id") not in in_mem_ids]
                return ApiResponse.ok(combined[:limit], total_records=len(combined))
        except Exception as e:
            print(f"[RDS ALERT FETCH ERROR] {e}")

    # Fallback to in-memory buffer
    return ApiResponse.ok(IN_MEMORY_ALERTS[:limit], total_records=len(IN_MEMORY_ALERTS))

@router.post("/ingest")
@router.post("/ingest/public")
async def ingest_anpr_alert(payload: Dict[str, Any] = Body(...)):
    """
    Real-time ANPR Ingestion endpoint for Edge YOLO / DeepStream / OpenCV nodes.
    - Accepts all OpenCV/YOLO key variants: PlateCrop, plate_crop, plate, number_plate, speed, confidence.
    - Tier 1: Persists 100% of detected passing vehicles into 'anpr_detections' with S3/base64 plate crop.
    - Tier 2: If plate matches Watchlist, creates a Critical Alert in 'anpr_alerts' & triggers WebSocket alarm.
    """
    plate = str(
        payload.get("number_plate") or 
        payload.get("plateNumber") or 
        payload.get("plate") or 
        payload.get("plate_number") or 
        payload.get("Plate") or 
        payload.get("license_plate") or 
        payload.get("PlateNumber") or 
        ""
    ).upper().strip()
    if not plate:
        raise HTTPException(status_code=400, detail="Plate number is required (number_plate, plate, or Plate)")

    # Watchlist flag
    if "watchlist" in payload:
        is_hit = bool(payload.get("watchlist"))
    elif "watchlist_hit" in payload:
        is_hit = bool(payload.get("watchlist_hit"))
    else:
        is_hit = plate in ANPR_WATCHLIST

    # Camera Code & Safe integer ID resolution
    raw_cam_code = payload.get("camera_code") or payload.get("cameraCode") or payload.get("cam_code")
    raw_cam_id = payload.get("camera_id") or payload.get("cameraId") or "1"
    
    m_num = re.search(r'\d+', str(raw_cam_id))
    safe_cam_int = int(m_num.group(0)) if m_num else 1

    if raw_cam_code:
        cam_code = str(raw_cam_code).strip()
    elif safe_cam_int:
        cam_code = f"CAM-{safe_cam_int:03d}"
    else:
        cam_code = "CAM-001"

    cam_name = str(payload.get("camera_name") or payload.get("cameraName") or f"Camera {cam_code}").strip()
    district = str(payload.get("district") or "Ahmedabad").strip()
    
    v_type = payload.get("vehicle_type") or payload.get("vehicleType") or payload.get("class") or payload.get("vehicleClass")
    vehicle_type = str(v_type).upper().strip() if v_type else None
    
    # Real speed (NULL if not instrumented)
    raw_speed = payload.get("speed") or payload.get("speed_kmh") or payload.get("speedKmh") or payload.get("vehicle_speed")
    speed_val = None
    if raw_speed is not None:
        try:
            speed_val = float(raw_speed)
        except (ValueError, TypeError):
            speed_val = None

    # Real AI detection confidence (NULL if not sent)
    raw_conf = payload.get("confidence") or payload.get("score") or payload.get("ai_confidence")
    confidence_val = None
    if raw_conf is not None:
        try:
            confidence_val = float(raw_conf)
        except (ValueError, TypeError):
            confidence_val = None

    # Real Plate OCR confidence (NULL if not sent)
    raw_p_conf = payload.get("plate_confidence") or payload.get("plateConfidence")
    plate_conf_val = None
    if raw_p_conf is not None:
        try:
            plate_conf_val = float(raw_p_conf)
        except (ValueError, TypeError):
            plate_conf_val = None

    severity = str(payload.get("severity") or ("CRITICAL" if is_hit else "INFO")).upper()
    category = str(payload.get("category") or ("HOTLIST_STOLEN" if is_hit else "ANPR_DETECTION")).upper()
    notes = str(payload.get("notes") or ("Stolen vehicle watchlist hit" if is_hit else "Plate scanned at checkpoint")).strip()
    title = str(payload.get("title") or (f"WATCHLIST HIT: {plate}" if is_hit else f"ANPR: {plate}")).strip()

    alert_id = f"ALT-{int(time.time() * 1000)}"

    # Process & Upload PlateCrop / Snapshot (if base64 or S3)
    raw_crop = (
        payload.get("PlateCrop") or 
        payload.get("plate_crop") or 
        payload.get("plateCrop") or 
        payload.get("crop") or 
        payload.get("plate_image") or 
        payload.get("snapshot") or 
        payload.get("imageCropUrl") or 
        None
    )
    clean_crop = _process_and_upload_snapshot(raw_crop, plate, alert_id)

    # TIER 1 TELEMETRY: Always record every detected vehicle in anpr_detections
    det_obj = {
        "id": alert_id,
        "number_plate": plate,
        "plateNumber": plate,
        "camera_id": str(safe_cam_int),
        "camera_code": cam_code,
        "cameraCode": cam_code,
        "camera_name": cam_name,
        "cameraName": cam_name,
        "district": district,
        "vehicle_type": vehicle_type,
        "confidence": confidence_val,
        "plate_confidence": plate_conf_val,
        "plateConfidence": plate_conf_val,
        "speed_kmh": speed_val,
        "speedKmh": speed_val,
        "speed": speed_val,
        "snapshot": clean_crop,
        "plate_crop": clean_crop,
        "plateCrop": clean_crop,
        "imageCropUrl": clean_crop,
        "watchlist_hit": is_hit,
        "detected_at": datetime.now().isoformat(),
        "timestamp": datetime.now().isoformat()
    }
    IN_MEMORY_DETECTIONS.insert(0, det_obj)
    if len(IN_MEMORY_DETECTIONS) > 1000:
        IN_MEMORY_DETECTIONS.pop()

    conn = await get_db_connection()
    if conn:
        try:
            await conn.execute("""
                INSERT INTO anpr_detections (
                    number_plate, camera_id, camera_code, camera_name, district, 
                    vehicle_type, confidence, snapshot, watchlist_hit, detected_at,
                    speed_kmh, plate_crop, plate_confidence
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, $11, $12);
            """, plate, str(safe_cam_int), cam_code, cam_name, district, vehicle_type, confidence_val, clean_crop, is_hit, speed_val, clean_crop, plate_conf_val)
            print(f"[OK] [RDS ANPR DETECTION STORED] Plate: {plate} | Cam: {cam_code} | Speed: {speed_val} | Crop: {bool(clean_crop)} | Watchlist: {is_hit}")
        except Exception as e:
            print(f"[WARN] [RDS DETECTION INSERT WARN] {e}")

    # TIER 2 WATCHLIST ALERT: Only generate critical alarm if plate is in watchlist
    alert_obj = None
    if is_hit:
        alert_obj = {
            "id": alert_id,
            "title": title,
            "severity": severity,
            "category": category,
            "number_plate": plate,
            "plateNumber": plate,
            "camera_id": safe_cam_int,
            "camera_code": cam_code,
            "cameraCode": cam_code,
            "camera_name": cam_name,
            "cameraName": cam_name,
            "district": district,
            "watchlist_hit": True,
            "status": "NEW",
            "notes": notes,
            "speed_kmh": speed_val,
            "speedKmh": speed_val,
            "speed": speed_val,
            "plate_confidence": plate_conf_val,
            "plateConfidence": plate_conf_val,
            "plate_crop": clean_crop,
            "plateCrop": clean_crop,
            "imageCropUrl": clean_crop,
            "timestamp": datetime.now().isoformat(),
            "received_at": datetime.now().isoformat(),
            "snapshot": clean_crop
        }
        IN_MEMORY_ALERTS.insert(0, alert_obj)
        if len(IN_MEMORY_ALERTS) > 500:
            IN_MEMORY_ALERTS.pop()

        if conn:
            try:
                await conn.execute("""
                    INSERT INTO anpr_alerts (
                        id, severity, category, number_plate, camera_id, camera_code, 
                        camera_name, district, watchlist_hit, status, title, notes, snapshot, received_at,
                        speed_kmh, plate_crop, plate_confidence
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, $14, $15, $16);
                """, alert_id, severity, category, plate, safe_cam_int, cam_code, cam_name, district, True, "NEW", title, notes, clean_crop, speed_val, clean_crop, plate_conf_val)
                print(f"[ALERT] [RDS WATCHLIST ALERT STORED] ID: {alert_id} | Plate: {plate} | Camera: {cam_code}")
            except Exception as e:
                print(f"[WARN] [RDS ALERT INSERT WARN] {e}")

        # Broadcast critical alert to Real-Time Alert Center with loud alarm
        try:
            await ws_manager.broadcast_json({
                "type": "ANPR_ALERT",
                "event": "NEW_ANPR_ALERT",
                "payload": alert_obj,
                "data": alert_obj
            })
        except Exception:
            pass

    if conn:
        try:
            await conn.close()
        except Exception:
            pass

    # Broadcast live detection event (telemetry feed for search tables)
    try:
        await ws_manager.broadcast_json({
            "type": "ANPR_DETECTION",
            "event": "NEW_ANPR_DETECTION",
            "payload": det_obj,
            "data": det_obj
        })
    except Exception:
        pass

    resp_payload = {
        "alertId": alert_id,
        "alert_id": alert_id,
        "watchlistHit": is_hit,
        "watchlist_hit": is_hit,
        **(alert_obj or det_obj)
    }
    return ApiResponse.ok(resp_payload)

# ─────────────────────────────────────────────────────────────────────────────
# SEARCH & VEHICLE JOURNEY APIS (POWERING ANPR VEHICLE SEARCH & TRACKING)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/search")
async def search_anpr_detections(
    plate: Optional[str] = Query(None, description="Number plate substring or exact match"),
    camera_code: Optional[str] = Query(None, description="Camera Code filter"),
    district: Optional[str] = Query(None, description="District filter"),
    vehicle_type: Optional[str] = Query(None, description="Vehicle type filter"),
    watchlist_only: bool = Query(False, description="Filter only watchlist hits"),
    limit: int = Query(200, description="Max records to return"),
    offset: int = Query(0, description="Pagination offset")
):
    """
    Search historical vehicle passages and sightings across all ANPR cameras.
    Queries AWS RDS PostgreSQL 'anpr_detections' table with in-memory buffer fallback.
    """
    plate_str = str(plate).strip() if (plate and isinstance(plate, str)) else None
    cam_str = str(camera_code).strip() if (camera_code and isinstance(camera_code, str)) else None
    dist_str = str(district).strip() if (district and isinstance(district, str)) else None
    v_type_str = str(vehicle_type).strip() if (vehicle_type and isinstance(vehicle_type, str)) else None
    wl_only = bool(watchlist_only) if not hasattr(watchlist_only, "default") else False
    lim = int(limit) if (isinstance(limit, (int, str)) and str(limit).isdigit()) else 200
    off = int(offset) if (isinstance(offset, (int, str)) and str(offset).isdigit()) else 0

    conn = await get_db_connection()
    if conn:
        try:
            conditions = ["1=1"]
            params: List[Any] = []
            param_idx = 1

            if plate_str:
                clean_plate = plate_str.upper().replace(" ", "")
                conditions.append(f"UPPER(REPLACE(number_plate, ' ', '')) LIKE ${param_idx}")
                params.append(f"%{clean_plate}%")
                param_idx += 1

            if cam_str and cam_str.upper() != "ALL":
                conditions.append(f"UPPER(camera_code) = ${param_idx}")
                params.append(cam_str.upper())
                param_idx += 1

            if dist_str and dist_str.upper() != "ALL":
                conditions.append(f"UPPER(district) = ${param_idx}")
                params.append(dist_str.upper())
                param_idx += 1

            if v_type_str and v_type_str.upper() != "ALL":
                conditions.append(f"UPPER(vehicle_type) = ${param_idx}")
                params.append(vehicle_type.strip().upper())
                param_idx += 1

            if wl_only:
                conditions.append(f"watchlist_hit = TRUE")

            where_clause = " AND ".join(conditions)
            
            # Fetch count
            count_query = f"SELECT COUNT(*) FROM anpr_detections WHERE {where_clause};"
            total_count = await conn.fetchval(count_query, *params)

            # Fetch rows
            params.append(lim)
            params.append(off)
            data_query = f"""
                SELECT 
                    id::text, 
                    number_plate, 
                    camera_id, 
                    camera_code, 
                    camera_name, 
                    district, 
                    vehicle_type, 
                    confidence, 
                    snapshot, 
                    watchlist_hit, 
                    detected_at::text as timestamp,
                    speed_kmh,
                    plate_crop,
                    plate_confidence
                FROM anpr_detections
                WHERE {where_clause}
                ORDER BY detected_at DESC
                LIMIT ${param_idx} OFFSET ${param_idx + 1};
            """
            rows = await conn.fetch(data_query, *params)
            await conn.close()

            results = []
            for r in rows:
                item = dict(r)
                item["plateNumber"] = item.get("number_plate")
                item["cameraCode"] = item.get("camera_code")
                item["cameraName"] = item.get("camera_name")
                item["speedKmh"] = item.get("speed_kmh")
                item["speed"] = item.get("speed_kmh")
                item["plateCrop"] = item.get("plate_crop") or item.get("snapshot")
                item["imageCropUrl"] = item.get("plate_crop") or item.get("snapshot")
                item["plateConfidence"] = item.get("plate_confidence")
                results.append(item)

            return ApiResponse.ok(results, total_records=total_count, page=(off // lim) + 1, page_size=lim)
        except Exception as e:
            print(f"[RDS ANPR SEARCH ERROR] {e}")

    # In-memory fallback
    filtered = list(IN_MEMORY_DETECTIONS)
    if plate_str:
        clean_p = plate_str.upper().replace(" ", "")
        filtered = [d for d in filtered if clean_p in d.get("number_plate", "").replace(" ", "").upper()]
    if cam_str and cam_str.upper() != "ALL":
        filtered = [d for d in filtered if d.get("camera_code", "").upper() == cam_str.upper()]
    if dist_str and dist_str.upper() != "ALL":
        filtered = [d for d in filtered if d.get("district", "").upper() == dist_str.upper()]
    if v_type_str and v_type_str.upper() != "ALL":
        filtered = [d for d in filtered if d.get("vehicle_type", "").upper() == v_type_str.upper()]
    if wl_only:
        filtered = [d for d in filtered if d.get("watchlist_hit")]

    total = len(filtered)
    paginated = filtered[off : off + lim]
    return ApiResponse.ok(paginated, total_records=total)

@router.get("/journey/{plate}")
async def get_vehicle_journey(plate: str):
    """
    Get chronologically ordered camera sightings of a vehicle for route journey tracking.
    """
    clean_plate = plate.strip().upper().replace(" ", "")
    conn = await get_db_connection()
    if conn:
        try:
            rows = await conn.fetch("""
                SELECT 
                    id::text, 
                    number_plate, 
                    camera_id, 
                    camera_code, 
                    camera_name, 
                    district, 
                    vehicle_type, 
                    confidence, 
                    snapshot, 
                    watchlist_hit, 
                    detected_at::text as timestamp
                FROM anpr_detections
                WHERE UPPER(REPLACE(number_plate, ' ', '')) = $1
                ORDER BY detected_at ASC;
            """, clean_plate)
            await conn.close()
            sightings = [dict(r) for r in rows]
            return ApiResponse.ok({
                "plateNumber": clean_plate,
                "totalSightings": len(sightings),
                "sightings": sightings
            })
        except Exception as e:
            print(f"[RDS JOURNEY ERROR] {e}")

    # Fallback to in-memory
    sightings = [
        d for d in IN_MEMORY_DETECTIONS 
        if clean_plate in d.get("number_plate", "").replace(" ", "").upper()
    ]
    sightings.sort(key=lambda x: x.get("timestamp") or x.get("detected_at") or "")
    return ApiResponse.ok({
        "plateNumber": clean_plate,
        "totalSightings": len(sightings),
        "sightings": sightings
    })

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
            await conn.execute("DELETE FROM anpr_alerts WHERE id::text = $1;", str(alert_id))
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
                    raw_pts = json.loads(r["points_json"]) if r["points_json"] else []
                    rec = {
                        "camera_code": r["camera_code"],
                        "camera_name": r["camera_name"],
                        "resolution": r["resolution"],
                        "zone_name": r["zone_name"],
                        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None
                    }
                    if isinstance(raw_pts, dict):
                        rec.update(raw_pts)
                    elif isinstance(raw_pts, list):
                        coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in raw_pts if isinstance(p, dict)]
                        rec["points"] = raw_pts
                        rec["coordinates"] = coords

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
    """Save camera ROI polygon coordinates and usecase mappings to RDS and memory."""
    cam_code = str(camera_code or payload.get("camera_code") or payload.get("cameraCode") or "").strip()
    if not cam_code:
        raise HTTPException(status_code=400, detail="camera_code is required")

    canonical_code = normalize_camera_code(cam_code)
    aliases = get_code_aliases(cam_code)

    points = payload.get("points") or []
    if points and isinstance(points, list) and len(points) > 0 and isinstance(points[0], dict):
        coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in points]
    else:
        coords = points

    zones = payload.get("zones") or []
    usecase_rois = payload.get("usecase_rois") or {}
    anpr_roi = payload.get("anpr") or usecase_rois.get("anpr")
    frs_roi = payload.get("frs") or usecase_rois.get("frs")
    ppe_roi = payload.get("ppe") or usecase_rois.get("ppe")
    footfall_roi = payload.get("footfall") or usecase_rois.get("footfall")

    structured_data = {
        "points": points,
        "coordinates": coords,
        "zones": zones,
        "usecase_rois": usecase_rois,
        "anpr": anpr_roi,
        "frs": frs_roi,
        "ppe": ppe_roi,
        "footfall": footfall_roi
    }

    roi_record = {
        "camera_code": canonical_code,
        "camera_name": payload.get("camera_name") or f"Camera {canonical_code}",
        "resolution": payload.get("resolution", "1920x1080"),
        "zone_name": payload.get("zone_name", "Detection Zone 1"),
        "points": points,
        "coordinates": coords,
        "zones": zones,
        "usecase_rois": usecase_rois,
        "anpr": anpr_roi,
        "frs": frs_roi,
        "ppe": ppe_roi,
        "footfall": footfall_roi,
        "saved_to_rds": False
    }

    for code in aliases:
        SAVED_ROIS[code] = roi_record
    save_json_file(ROI_FILE, SAVED_ROIS)

    # Persist to AWS RDS PostgreSQL asynchronously
    async def _persist_roi_rds():
        try:
            conn = await get_db_connection()
            if conn:
                pts_json = json.dumps(structured_data)
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

    asyncio.create_task(_persist_roi_rds())
    return {"status": "success", "message": f"ROI saved for {canonical_code}", "saved_to_rds": True, "data": roi_record}

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
                raw_pts = json.loads(row["points_json"]) if row["points_json"] else []
                rec = {
                    "camera_code": row["camera_code"],
                    "camera_name": row["camera_name"],
                    "resolution": row["resolution"],
                    "zone_name": row["zone_name"],
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
                }
                if isinstance(raw_pts, dict):
                    rec.update(raw_pts)
                elif isinstance(raw_pts, list):
                    coords = [[int(p.get("x", 0)), int(p.get("y", 0))] for p in raw_pts if isinstance(p, dict)]
                    rec["points"] = raw_pts
                    rec["coordinates"] = coords

                for alias in get_code_aliases(row["camera_code"]):
                    SAVED_ROIS[alias] = rec
                await conn.close()
                return ApiResponse.ok(rec)
            await conn.close()
        except Exception:
            pass

    return ApiResponse.ok({"camera_code": cam_code, "points": [], "coordinates": [], "zones": [], "usecase_rois": {}})

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
                        "camera_code": normalize_camera_code(r["camera_code"]),
                        "camera_name": r["camera_name"],
                        "enable": vec,
                        "usecases": usecases,
                        "models": models,
                        "confidence_threshold": conf,
                        "target_fps": r["target_fps"] or 15,
                        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None
                    }
                    canonical_key = normalize_camera_code(r["camera_code"])
                    db_configs[canonical_key] = rec
                    # Also keep internal alias cache for edge listeners
                    for alias in get_code_aliases(r["camera_code"]):
                        AI_CONFIGS[alias] = rec
                return ApiResponse.ok(db_configs)
        except Exception as e:
            print(f"[RDS ALL AI CONFIGS FETCH WARN] {e}")

    # Return canonical filtered AI_CONFIGS
    canonical_configs = {}
    for k, v in AI_CONFIGS.items():
        can = normalize_camera_code(k)
        if can not in canonical_configs:
            canonical_configs[can] = v
    return ApiResponse.ok(canonical_configs)


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

    async def _persist_ai_config_rds():
        try:
            conn = await get_db_connection()
            if conn:
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

    asyncio.create_task(_persist_ai_config_rds())
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

