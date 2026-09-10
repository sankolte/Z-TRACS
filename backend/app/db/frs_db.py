import os
import json
import asyncpg
from typing import Optional, List, Dict, Any
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

async def fetch_all_frs_targets() -> Optional[List[Dict[str, Any]]]:
    """Fetch all active suspect targets from AWS RDS PostgreSQL."""
    conn = await get_db_connection()
    if not conn:
        return None
    try:
        rows = await conn.fetch("""
            SELECT person_id, person_name, slug, case_id, category, alert_priority,
                   photo_url, clip_url, s3_key, s3_clip_key, photo_version, clip_version,
                   similarity_threshold, target_cameras, enabled, notes, created_at, updated_at
            FROM frs_targets
            WHERE enabled = 1
            ORDER BY created_at DESC;
        """)
        results = []
        for r in rows:
            d = dict(r)
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            if d.get("updated_at"):
                d["updated_at"] = d["updated_at"].isoformat()
            if isinstance(d.get("target_cameras"), str):
                try:
                    if d["target_cameras"].startswith("["):
                        d["target_cameras"] = json.loads(d["target_cameras"])
                    else:
                        d["target_cameras"] = [d["target_cameras"]]
                except Exception:
                    d["target_cameras"] = ["ALL"]
            results.append(d)
        return results
    except Exception as e:
        print(f"[RDS FRS TARGETS FETCH ERROR] {e}")
        return None
    finally:
        try:
            await conn.close()
        except Exception:
            pass

async def upsert_frs_target(target: Dict[str, Any]) -> bool:
    """Insert or update target in AWS RDS PostgreSQL."""
    conn = await get_db_connection()
    if not conn:
        return False
    try:
        await conn.execute("""
            INSERT INTO frs_targets (
                person_id, person_name, slug, case_id, category, alert_priority,
                photo_url, clip_url, s3_key, s3_clip_key, photo_version, clip_version,
                similarity_threshold, target_cameras, enabled, notes, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
            )
            ON CONFLICT (person_id) DO UPDATE SET
                person_name = EXCLUDED.person_name,
                slug = EXCLUDED.slug,
                case_id = EXCLUDED.case_id,
                category = EXCLUDED.category,
                alert_priority = EXCLUDED.alert_priority,
                photo_url = COALESCE(EXCLUDED.photo_url, frs_targets.photo_url),
                clip_url = COALESCE(EXCLUDED.clip_url, frs_targets.clip_url),
                s3_key = COALESCE(EXCLUDED.s3_key, frs_targets.s3_key),
                s3_clip_key = COALESCE(EXCLUDED.s3_clip_key, frs_targets.s3_clip_key),
                photo_version = EXCLUDED.photo_version,
                clip_version = EXCLUDED.clip_version,
                similarity_threshold = EXCLUDED.similarity_threshold,
                target_cameras = EXCLUDED.target_cameras,
                enabled = EXCLUDED.enabled,
                notes = EXCLUDED.notes,
                updated_at = NOW();
        """,
            target.get("person_id"),
            target.get("person_name"),
            target.get("slug") or "usr1",
            target.get("case_id") or "UNKNOWN",
            target.get("category") or "CRITICAL_SUSPECT",
            target.get("alert_priority") or "HIGH",
            target.get("photo_url"),
            target.get("clip_url"),
            target.get("s3_key"),
            target.get("s3_clip_key"),
            target.get("photo_version") or "v1",
            target.get("clip_version") or "v1",
            float(target.get("similarity_threshold") or 0.78),
            json.dumps(target.get("target_cameras")) if isinstance(target.get("target_cameras"), list) else str(target.get("target_cameras") or "ALL"),
            int(target.get("enabled", 1)),
            target.get("notes") or ""
        )
        return True
    except Exception as e:
        print(f"[RDS FRS TARGET UPSERT ERROR] {e}")
        return False
    finally:
        try:
            await conn.close()
        except Exception:
            pass

async def deactivate_frs_target(person_id: str) -> bool:
    """Deactivate suspect target in AWS RDS PostgreSQL."""
    conn = await get_db_connection()
    if not conn:
        return False
    try:
        await conn.execute("UPDATE frs_targets SET enabled = 0, updated_at = NOW() WHERE person_id = $1;", person_id)
        return True
    except Exception as e:
        print(f"[RDS FRS DEACTIVATE ERROR] {e}")
        return False
    finally:
        try:
            await conn.close()
        except Exception:
            pass

async def delete_frs_matches_by_target(person_id: str) -> bool:
    """Delete all sighting match records for a given suspect from AWS RDS PostgreSQL."""
    conn = await get_db_connection()
    if not conn:
        return False
    try:
        await conn.execute("DELETE FROM frs_matches WHERE person_id = $1;", person_id)
        print(f"[RDS SUCCESS] Purged all sighting matches for suspect {person_id}.")
        return True
    except Exception as e:
        print(f"[RDS FRS MATCHES PURGE ERROR] {e}")
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
