"""
ANPR Database Table Management & Auto-Initialization for AWS RDS
"""
import asyncpg
from app.core.config import settings

async def get_db_connection():
    try:
        return await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            timeout=5.0
        )
    except Exception as e:
        print(f"[RDS WARNING] Could not connect to PostgreSQL database: {e}")
        return None

async def ensure_anpr_alerts_table():
    """Create anpr_alerts table in RDS if it does not exist."""
    conn = await get_db_connection()
    if not conn:
        print("[RDS NOTE] Skipping anpr_alerts table check (DB offline or local mode)")
        return
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS anpr_alerts (
                id SERIAL PRIMARY KEY,
                severity VARCHAR(50) DEFAULT 'INFO',
                category VARCHAR(100) DEFAULT 'ANPR_DETECTION',
                number_plate VARCHAR(50),
                camera_id VARCHAR(100),
                camera_code VARCHAR(100),
                camera_name VARCHAR(255),
                district VARCHAR(100),
                watchlist_hit BOOLEAN DEFAULT FALSE,
                status VARCHAR(50) DEFAULT 'ACTIVE',
                title VARCHAR(255),
                notes TEXT,
                received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("[RDS SUCCESS] anpr_alerts table verified/created.")
    except Exception as e:
        print(f"[RDS ERROR] Failed to ensure anpr_alerts table: {e}")
    finally:
        await conn.close()

async def ensure_anpr_rois_table():
    """Create anpr_camera_rois table in RDS if it does not exist."""
    conn = await get_db_connection()
    if not conn:
        print("[RDS NOTE] Skipping anpr_camera_rois table check (DB offline or local mode)")
        return
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS anpr_camera_rois (
                id SERIAL PRIMARY KEY,
                camera_code VARCHAR(100) UNIQUE NOT NULL,
                camera_name VARCHAR(255),
                resolution VARCHAR(50) DEFAULT '1920x1080',
                zone_name VARCHAR(100) DEFAULT 'Detection Zone 1',
                points_json TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_anpr_camera_rois_updated_at ON anpr_camera_rois (updated_at);
        """)
        print("[RDS SUCCESS] anpr_camera_rois table verified/created.")
    except Exception as e:
        print(f"[RDS ERROR] Failed to ensure anpr_camera_rois table: {e}")
    finally:
        await conn.close()

async def ensure_anpr_ai_configs_table():
    """Create anpr_camera_ai_configs table in RDS if it does not exist."""
    conn = await get_db_connection()
    if not conn:
        print("[RDS NOTE] Skipping anpr_camera_ai_configs table check (DB offline or local mode)")
        return
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS anpr_camera_ai_configs (
                camera_code VARCHAR(100) PRIMARY KEY,
                camera_name VARCHAR(255),
                enable_vector VARCHAR(50) DEFAULT '[0,0,0,0]',
                usecases_json JSONB DEFAULT '[]'::jsonb,
                models_json JSONB DEFAULT '[]'::jsonb,
                confidence_threshold NUMERIC(4,3) DEFAULT 0.500,
                target_fps INT DEFAULT 15,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_anpr_ai_configs_updated_at ON anpr_camera_ai_configs (updated_at);
        """)
        print("[RDS SUCCESS] anpr_camera_ai_configs table verified/created.")
    except Exception as e:
        print(f"[RDS ERROR] Failed to ensure anpr_camera_ai_configs table: {e}")
    finally:
        await conn.close()

async def ensure_anpr_detections_table():
    """Create anpr_detections table in RDS for 24x7 all-traffic telemetry and vehicle search."""
    conn = await get_db_connection()
    if not conn:
        print("[RDS NOTE] Skipping anpr_detections table check (DB offline or local mode)")
        return
    try:
        # Ensure columns exist in anpr_alerts
        for col_def in [
            "ALTER TABLE anpr_alerts ADD COLUMN IF NOT EXISTS snapshot TEXT;",
            "ALTER TABLE anpr_alerts ADD COLUMN IF NOT EXISTS speed_kmh FLOAT DEFAULT NULL;",
            "ALTER TABLE anpr_alerts ADD COLUMN IF NOT EXISTS plate_crop TEXT DEFAULT NULL;",
            "ALTER TABLE anpr_alerts ADD COLUMN IF NOT EXISTS plate_confidence FLOAT DEFAULT NULL;"
        ]:
            try:
                await conn.execute(col_def)
            except Exception:
                pass

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS anpr_detections (
                id SERIAL PRIMARY KEY,
                number_plate VARCHAR(50) NOT NULL,
                camera_id VARCHAR(100),
                camera_code VARCHAR(100),
                camera_name VARCHAR(255),
                district VARCHAR(100),
                vehicle_type VARCHAR(50) DEFAULT 'CAR',
                confidence FLOAT DEFAULT NULL,
                snapshot TEXT,
                watchlist_hit BOOLEAN DEFAULT FALSE,
                detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                speed_kmh FLOAT DEFAULT NULL,
                plate_crop TEXT DEFAULT NULL,
                plate_confidence FLOAT DEFAULT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_anpr_detections_plate ON anpr_detections (number_plate);
            CREATE INDEX IF NOT EXISTS idx_anpr_detections_time ON anpr_detections (detected_at DESC);
            CREATE INDEX IF NOT EXISTS idx_anpr_detections_cam ON anpr_detections (camera_code);
        """)
        # Also ensure columns exist if anpr_detections was created earlier
        for col_def in [
            "ALTER TABLE anpr_detections ADD COLUMN IF NOT EXISTS speed_kmh FLOAT DEFAULT NULL;",
            "ALTER TABLE anpr_detections ADD COLUMN IF NOT EXISTS plate_crop TEXT DEFAULT NULL;",
            "ALTER TABLE anpr_detections ADD COLUMN IF NOT EXISTS plate_confidence FLOAT DEFAULT NULL;"
        ]:
            try:
                await conn.execute(col_def)
            except Exception:
                pass

        print("[RDS SUCCESS] anpr_detections table verified/created.")
    except Exception as e:
        print(f"[RDS ERROR] Failed to ensure anpr_detections table: {e}")
    finally:
        await conn.close()

async def ensure_all_anpr_tables():
    """Verify and auto-initialize all ANPR tables in AWS RDS."""
    await ensure_anpr_alerts_table()
    await ensure_anpr_rois_table()
    await ensure_anpr_ai_configs_table()
    await ensure_anpr_detections_table()

