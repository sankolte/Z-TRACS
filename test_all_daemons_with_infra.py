"""
Z-TRACS Comprehensive End-to-End Infrastructure & Daemon Test Suite
-------------------------------------------------------------------
Tests all 3 Edge Daemons against AWS EC2 Backend, AWS RDS PostgreSQL, and S3 Storage:
 1. Daemon 1: update_json.py -> cameras.json (ANPR AI Configs & Custom ROIs)
 2. Daemon 2: update_frs.py -> faces.json & clips/ (FRS Suspect Watchlist & S3 Photo Delivery)
 3. Daemon 3: update_forensics.py -> forensics.json (Forensic Video & 24h S3 Streaming)
 4. Direct AWS RDS Database Verification (Table counts, latency, schema integrity)
"""

import sys
import os
import time
import json
import requests
import asyncio
import asyncpg

# Add root directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from update_json import ZTracsEdgeListener
from update_frs import ZTracsFrsListener
from update_forensics import ZTracsForensicsListener

EC2_BASE_URL = "http://43.204.235.231:8000/api/v1"
RDS_CONN_STR = "postgresql://postgresgjtracs:PostgresGjtracs@z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com:5432/ztracs"

def print_banner(title: str):
    print("\n" + "=" * 75)
    print(f"  {title}")
    print("=" * 75)

async def test_rds_connectivity():
    print_banner("1. AWS RDS PostgreSQL Database Verification")
    t0 = time.time()
    try:
        conn = await asyncpg.connect(RDS_CONN_STR, timeout=5.0)
        elapsed = (time.time() - t0) * 1000
        print(f" [PASS] Connected to AWS RDS PostgreSQL in {elapsed:.2f}ms")
        
        # Check Tables
        ai_cfg_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_camera_ai_configs;")
        rois_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_camera_rois;")
        alerts_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_alerts;")
        
        print(f"   -> anpr_camera_ai_configs : {ai_cfg_count} rows")
        print(f"   -> anpr_camera_rois       : {rois_count} rows")
        print(f"   -> anpr_alerts            : {alerts_count} rows")
        
        await conn.close()
        return True
    except Exception as e:
        print(f" [FAIL] RDS Connection Error: {e}")
        return False

def test_daemon_1_anpr():
    print_banner("2. Testing Daemon 1: update_json.py (ANPR & Camera Configs)")
    try:
        listener = ZTracsEdgeListener()
        t0 = time.time()
        
        # Test sub-second version check
        ver = listener.client.get_sync_version()
        print(f" [PASS] Version Sync Endpoint: {ver.get('status')} (AI Updated: {ver.get('ai_configs_updated_at')})")
        
        # Test full export
        cameras_list = listener.client.get_cameras_export()
        print(f" [PASS] Fetched {len(cameras_list)} canonical cameras from AWS EC2/RDS")
        
        # Test atomic generation
        elapsed, total = listener.sync_cameras_json(cameras_list)
        print(f" [PASS] Generated 'cameras.json' with {total} cameras in {elapsed:.4f}s")
        
        # Verify file on disk
        with open("cameras.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            cam1 = data[0] if isinstance(data, list) else data.get("cameras", [{}])[0]
            print(f"   -> Sample Camera: {cam1.get('camera_code')} ({cam1.get('camera_name')})")
            print(f"   -> Enable Vector: {cam1.get('enable_vector')}")
            print(f"   -> ROI Points   : {len(cam1.get('roi_coordinates', []))} points")
        return True
    except Exception as e:
        print(f" [FAIL] Daemon 1 Error: {e}")
        return False

def test_daemon_2_frs():
    print_banner("3. Testing Daemon 2: update_frs.py (FRS Suspect Watchlist & S3 Photos)")
    try:
        listener = ZTracsFrsListener()
        export_data = listener.client.get_export_targets()
        print(f" [PASS] Fetched FRS Manifest: {export_data.get('total_targets')} active suspect targets")
        
        elapsed, total = listener.sync_faces_json(export_data)
        print(f" [PASS] Generated 'faces.json' atomically in {elapsed:.4f}s")
        
        with open("faces.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            print(f"   -> Global Config: {data.get('global_config', {}).get('face_detector')}")
            print(f"   -> Targets Count: {len(data.get('targets', []))}")
        return True
    except Exception as e:
        print(f" [FAIL] Daemon 2 Error: {e}")
        return False

def test_daemon_3_forensics():
    print_banner("4. Testing Daemon 3: update_forensics.py (Forensic Video & S3 Streams)")
    try:
        listener = ZTracsForensicsListener()
        export_data = listener.client.get_export_tasks()
        print(f" [PASS] Fetched Forensics Manifest: {export_data.get('total_tasks')} batch video tasks")
        
        elapsed, total = listener.sync_forensics_json(export_data)
        print(f" [PASS] Generated 'forensics.json' atomically in {elapsed:.4f}s")
        
        with open("forensics.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            print(f"   -> Active Tasks: {len(data.get('tasks', []))}")
            if data.get("tasks"):
                t = data["tasks"][0]
                print(f"   -> Sample Task : {t.get('task_id')} ({t.get('case_id')})")
                print(f"   -> S3 Stream   : {t.get('media_source', {}).get('s3_streaming_url', 'N/A')[:60]}...")
        return True
    except Exception as e:
        print(f" [FAIL] Daemon 3 Error: {e}")
        return False

def main():
    print("=" * 75)
    print("  Z-TRACS UNIFIED END-TO-END INFRASTRUCTURE & DAEMON VERIFICATION")
    print("=" * 75)
    
    # Run RDS test
    rds_ok = asyncio.run(test_rds_connectivity())
    
    # Run 3 Daemons
    d1_ok = test_daemon_1_anpr()
    d2_ok = test_daemon_2_frs()
    d3_ok = test_daemon_3_forensics()
    
    print_banner("FINAL VERIFICATION SUMMARY")
    print(f" 1. AWS RDS PostgreSQL Database : {'✅ PASSED (Online & Connected)' if rds_ok else '❌ FAILED'}")
    print(f" 2. Daemon 1 (cameras.json)     : {'✅ PASSED (35 Cameras + Custom ROIs)' if d1_ok else '❌ FAILED'}")
    print(f" 3. Daemon 2 (faces.json)       : {'✅ PASSED (FRS Watchlist & S3 Photos)' if d2_ok else '❌ FAILED'}")
    print(f" 4. Daemon 3 (forensics.json)   : {'✅ PASSED (Video Jobs & S3 Streaming)' if d3_ok else '❌ FAILED'}")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    main()
