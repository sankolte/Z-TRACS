"""
AWS RDS Schema Migration for Z-TRACS
Ensures anpr_camera_ai_configs and anpr_camera_rois tables are properly created and indexed.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import json

RDS_CONFIG = {
    "dbname": "ztracs",
    "user": "postgresgjtracs",
    "password": "PostgresGjtracs",
    "host": "z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com",
    "port": 5432,
    "connect_timeout": 10
}

def migrate():
    print(f"Connecting to AWS RDS at {RDS_CONFIG['host']}...")
    conn = psycopg2.connect(**RDS_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Ensure anpr_camera_rois table
    print("Migrating anpr_camera_rois table...")
    cur.execute("""
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
    conn.commit()
    print("[SUCCESS] anpr_camera_rois table verified.")

    # 2. Ensure anpr_camera_ai_configs table
    print("Migrating anpr_camera_ai_configs table...")
    cur.execute("""
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
    conn.commit()
    print("[SUCCESS] anpr_camera_ai_configs table verified.")

    # 3. Test insert & verify sync-version query
    print("Testing sync-version query...")
    cur.execute("""
        SELECT MAX(updated_at) AS last_ai_updated FROM anpr_camera_ai_configs;
    """)
    res_ai = cur.fetchone()
    cur.execute("""
        SELECT MAX(updated_at) AS last_roi_updated FROM anpr_camera_rois;
    """)
    res_roi = cur.fetchone()
    print(f"[SUCCESS] Sync Version Test: AI Configs Max Updated = {res_ai['last_ai_updated']}, ROIs Max Updated = {res_roi['last_roi_updated']}")


    cur.close()
    conn.close()
    print("Migration finished successfully!")

if __name__ == "__main__":
    migrate()
