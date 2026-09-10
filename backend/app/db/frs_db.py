import os
import asyncpg
from typing import Optional
from app.core.config import settings

async def get_db_connection():
    """Obtain a direct asyncpg connection to AWS RDS PostgreSQL."""
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
        print(f"[RDS FRS CONNECT WARN] Could not connect to PostgreSQL database: {e}")
        return None

async def ensure_frs_targets_table() -> bool:
    """
    Ensures 'frs_targets' table exists in AWS RDS PostgreSQL.
    Stores enrolled suspects, FIR IDs, categories, and S3 reference media.
    """
    conn = await get_db_connection()
    if not conn:
        print("[RDS WARN] Could not connect to RDS to verify 'frs_targets' table.")
        return False

    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS frs_targets (
                id SERIAL PRIMARY KEY,
                person_id VARCHAR(64) UNIQUE NOT NULL,
                person_name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL,
                case_id VARCHAR(128) NOT NULL,
                category VARCHAR(64) DEFAULT 'CRITICAL_SUSPECT',
                alert_priority VARCHAR(32) DEFAULT 'HIGH',
                photo_url TEXT,
                clip_url TEXT,
                s3_key TEXT,
                s3_clip_key TEXT,
                photo_version VARCHAR(64),
                clip_version VARCHAR(64),
                similarity_threshold REAL DEFAULT 0.78,
                target_cameras TEXT DEFAULT 'ALL',
                enabled SMALLINT DEFAULT 1,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_frs_targets_person_id ON frs_targets(person_id);
            CREATE INDEX IF NOT EXISTS idx_frs_targets_enabled ON frs_targets(enabled);
        """)
        print("[RDS SUCCESS] frs_targets table verified/created.")
        return True
    except Exception as e:
        print(f"[RDS ERROR] Failed to create 'frs_targets' table: {e}")
        return False
    finally:
        try:
            await conn.close()
        except Exception:
            pass

async def ensure_frs_matches_table() -> bool:
    """
    Ensures 'frs_matches' table exists in AWS RDS PostgreSQL.
    Stores real-time face recognition match hits from edge AI (OpenCV/InsightFace).
    """
    conn = await get_db_connection()
    if not conn:
        print("[RDS WARN] Could not connect to RDS to verify 'frs_matches' table.")
        return False

    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS frs_matches (
                id VARCHAR(64) PRIMARY KEY,
                person_id VARCHAR(64) NOT NULL,
                person_name VARCHAR(255) NOT NULL,
                case_id VARCHAR(128),
                category VARCHAR(64) DEFAULT 'CRITICAL_SUSPECT',
                severity VARCHAR(32) DEFAULT 'CRITICAL',
                camera_id VARCHAR(64),
                camera_code VARCHAR(64) NOT NULL,
                camera_name VARCHAR(255) NOT NULL,
                district VARCHAR(128) DEFAULT 'Ahmedabad',
                similarity REAL NOT NULL,
                reference_photo_url TEXT,
                snapshot_url TEXT,
                bounding_box JSONB,
                status VARCHAR(32) DEFAULT 'NEW',
                notes TEXT,
                matched_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_frs_matches_person_id ON frs_matches(person_id);
            CREATE INDEX IF NOT EXISTS idx_frs_matches_camera_code ON frs_matches(camera_code);
            CREATE INDEX IF NOT EXISTS idx_frs_matches_matched_at ON frs_matches(matched_at DESC);
        """)
        print("[RDS SUCCESS] frs_matches table verified/created.")
        return True
    except Exception as e:
        print(f"[RDS ERROR] Failed to create 'frs_matches' table: {e}")
        return False
    finally:
        try:
            await conn.close()
        except Exception:
            pass

async def ensure_all_frs_tables():
    """Initialize all FRS tables on server startup."""
    await ensure_frs_targets_table()
    await ensure_frs_matches_table()
