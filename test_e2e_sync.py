"""
End-to-End Verification of AWS RDS Persistence & Edge Daemon Synchronization
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import json
import os
import sys

RDS_CONFIG = {
    "dbname": "ztracs",
    "user": "postgresgjtracs",
    "password": "PostgresGjtracs",
    "host": "z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com",
    "port": 5432,
    "connect_timeout": 10
}

def run_test():
    print("[STEP 1] Connecting to AWS RDS PostgreSQL...")
    conn = psycopg2.connect(**RDS_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Insert test AI configuration for CAM-001 (ANPR + FRS enabled = [1, 1, 0, 0])
    print("[STEP 2] Inserting/Updating AI configuration for CAM-001 into RDS...")
    test_enable_vec = json.dumps([1, 1, 0, 0])
    test_models = json.dumps({"anpr": True, "frs": True, "crowd": False, "ppe": False, "footfall": False})
    test_usecases = json.dumps(["ANPR", "FACE_RECOGNITION"])
    
    cur.execute("""
        INSERT INTO anpr_camera_ai_configs (
            camera_code, camera_name, enable_vector, usecases_json, models_json, confidence_threshold, target_fps, updated_at
        ) VALUES ('CAM-001', 'Camera 1 (Chiman Bhai Bridge)', %s, %s::jsonb, %s::jsonb, 0.850, 15, CURRENT_TIMESTAMP)
        ON CONFLICT (camera_code)
        DO UPDATE SET 
            camera_name = EXCLUDED.camera_name,
            enable_vector = EXCLUDED.enable_vector,
            usecases_json = EXCLUDED.usecases_json,
            models_json = EXCLUDED.models_json,
            confidence_threshold = EXCLUDED.confidence_threshold,
            target_fps = EXCLUDED.target_fps,
            updated_at = CURRENT_TIMESTAMP;
    """, (test_enable_vec, test_usecases, test_models))

    # 2. Insert custom ROI coordinates for CAM-001
    print("[STEP 3] Inserting/Updating custom ROI polygon for CAM-001 into RDS...")
    test_roi_pts = json.dumps([{"x": 120, "y": 240}, {"x": 820, "y": 240}, {"x": 920, "y": 920}, {"x": 60, "y": 920}])
    cur.execute("""
        INSERT INTO anpr_camera_rois (
            camera_code, camera_name, resolution, zone_name, points_json, updated_at
        ) VALUES ('CAM-001', 'Camera 1 (Chiman Bhai Bridge)', '1920x1080', 'Detection Zone 1', %s, CURRENT_TIMESTAMP)
        ON CONFLICT (camera_code)
        DO UPDATE SET 
            camera_name = EXCLUDED.camera_name,
            points_json = EXCLUDED.points_json,
            updated_at = CURRENT_TIMESTAMP;
    """, (test_roi_pts,))

    conn.commit()
    cur.close()
    conn.close()
    print("[STEP 4] Successfully committed AI config & ROI to AWS RDS!")

    # 3. Trigger edge client sync
    print("[STEP 5] Running ZTracsBuddyClient & ZTracsActiveCameraListener sync...")
    from update_json import ZTracsBuddyClient, ZTracsActiveCameraListener
    client = ZTracsBuddyClient()
    listener = ZTracsActiveCameraListener(client=client)
    listener.sync_cameras_json(force=True)

    # 4. Verify cameras.json
    print("[STEP 6] Validating generated cameras.json...")
    with open("cameras.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    cameras = []
    for loc in data.get("locations", []):
        cameras.extend(loc.get("cameras", []))

    cam1 = next((c for c in cameras if "CAM-001" in c.get("camera_code", "") or "Camera 1" in c.get("camera_name", "")), None)
    
    if not cam1:
        print("[ERROR] CAM-001 not found in cameras.json!")
        sys.exit(1)

    print(f" -> Found CAM-001: '{cam1.get('camera_name')}'")
    print(f" -> Enable Vector : {cam1.get('enable')}")
    print(f" -> Custom ROI [0]: {cam1.get('rois', [])[0] if cam1.get('rois') else 'None'}")

    assert cam1.get("enable") == [1, 1, 0, 0], f"Expected [1, 1, 0, 0] but got {cam1.get('enable')}"
    print("[ALL CHECKS PASSED] End-to-end synchronization verified successfully!")

if __name__ == "__main__":
    run_test()
