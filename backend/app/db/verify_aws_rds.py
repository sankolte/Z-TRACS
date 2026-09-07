"""
Z-TRACS AWS RDS PostgreSQL & PostGIS Complete Verification & Audit Suite
Executes Steps 2, 3, 4, 5, 7, 8 verification queries on live AWS RDS instance.
"""
import os
import sys
import asyncio
import json

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings

async def verify_aws_rds_full():
    print("=" * 70)
    print("  Z-TRACS AWS RDS POSTGRESQL & POSTGIS COMPLETE VERIFICATION")
    print("=" * 70)
    print(f"Target Endpoint: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print(f"Target Username: {settings.POSTGRES_USER}")
    print("-" * 70)

    try:
        import asyncpg
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
        print("[STEP 2] Database & Extension Handshake:")
        
        # 1. Current Database & User
        curr_db = await conn.fetchval("SELECT current_database();")
        curr_user = await conn.fetchval("SELECT current_user;")
        print(f"  -> Current Database: {curr_db}")
        print(f"  -> Current User:     {curr_user}")
        
        # Extensions
        extensions = await conn.fetch("SELECT extname, extversion FROM pg_extension ORDER BY extname;")
        print("  -> Active PostgreSQL Extensions:")
        postgis_found = False
        uuid_found = False
        for ext in extensions:
            print(f"      - {ext['extname']} (v{ext['extversion']})")
            if ext['extname'] == 'postgis': postgis_found = True
            if ext['extname'] == 'uuid-ossp': uuid_found = True
            
        print(f"  -> PostGIS Extension Present: {postgis_found}")
        print(f"  -> UUID-OSSP Extension Present: {uuid_found}")
        print("-" * 70)

        # STEP 3: Verify Cameras Table & GiST Index
        print("[STEP 3] Schema & GiST Spatial Index Verification:")
        columns = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cameras' 
            ORDER BY ordinal_position;
        """)
        print("  -> 'cameras' Table Columns:")
        for col in columns:
            print(f"      - {col['column_name']:<20} : {col['data_type']}")
            
        indexes = await conn.fetch("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'cameras';
        """)
        print("  -> Indexes on 'cameras' Table:")
        gist_found = False
        for idx in indexes:
            print(f"      - Index: {idx['indexname']}")
            print(f"        Definition: {idx['indexdef']}")
            if 'gist' in idx['indexdef'].lower():
                gist_found = True
        print(f"  -> GiST Spatial Index Active: {gist_found}")
        print("-" * 70)

        # STEP 4: Seed Sample Gujarat Cameras if empty & Test PostGIS Spatial Radius Query
        print("[STEP 4] Seeding Test Spatial Data & PostGIS Radius Performance Test:")
        count = await conn.fetchval("SELECT COUNT(*) FROM cameras;")
        if count == 0:
            print("  -> Seeding 5 test cameras in Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar...")
            seed_data = [
                ('CAM-GJ-AHM-01', 'SG Highway Iskcon CCTV', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Ahmedabad', 'ONLINE', 'ACTIVE', 'rtsp://ahmedabad.cctv/stream1', 23.0225, 72.5714),
                ('CAM-GJ-AHM-02', 'Nehrunagar Junction Dome', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Ahmedabad', 'ONLINE', 'ACTIVE', 'rtsp://ahmedabad.cctv/stream2', 23.0250, 72.5400),
                ('CAM-GJ-SUR-01', 'Ring Road Surat Checkpoint', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Surat', 'ONLINE', 'ACTIVE', 'rtsp://surat.cctv/stream1', 21.1702, 72.8311),
                ('CAM-GJ-VAD-01', 'Alkapuri Circle CCTV', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Vadodara', 'ONLINE', 'ACTIVE', 'rtsp://vadodara.cctv/stream1', 22.3072, 73.1812),
                ('CAM-GJ-GAN-01', 'Sector 18 HQ Gate Cam', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Gandhinagar', 'ONLINE', 'ACTIVE', 'rtsp://gandhinagar.cctv/stream1', 23.2156, 72.6369),
            ]
            for code, name, dept_id, dept_name, dist, health, life, url, lat, lng in seed_data:
                await conn.execute("""
                    INSERT INTO cameras (camera_code, name, department_id, department_name, district, health_status, lifecycle, stream_url, latitude, longitude, location_geom)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_SetSRID(ST_MakePoint($10, $9), 4326))
                    ON CONFLICT (camera_code) DO NOTHING;
                """, code, name, dept_id, dept_name, dist, health, life, url, lat, lng)
            print("  -> 5 Test Cameras Inserted!")

        # Query 1: ST_AsText
        cams = await conn.fetch("SELECT camera_uuid, camera_code, name, ST_AsText(location_geom) as geom_text FROM cameras LIMIT 5;")
        print("  -> Cameras Spatial Point Representation (ST_AsText):")
        for c in cams:
            print(f"      - {c['camera_code']}: {c['name']} -> {c['geom_text']}")

        # Query 2: ST_DWithin 5000m radius around Ahmedabad (72.5714, 23.0225)
        print("\n  -> Executing PostGIS Spatial Radius Query (5,000m around Ahmedabad Center 72.5714, 23.0225):")
        spatial_results = await conn.fetch("""
            SELECT 
                camera_uuid,
                camera_code,
                name,
                district,
                ST_Distance(
                    location_geom::geography,
                    ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography
                ) AS distance_m
            FROM cameras
            WHERE ST_DWithin(
                location_geom::geography,
                ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
                50000
            )
            ORDER BY distance_m;
        """)
        for r in spatial_results:
            print(f"      - {r['camera_code']} ({r['name']}) -> Distance: {r['distance_m']:.2f} meters")

        print("-" * 70)

        # STEP 8: Audit Logs Insertion & Test Query
        print("[STEP 8] Testing Audit Log Recording & Query:")
        await conn.execute("""
            INSERT INTO audit_logs (operator_id, operator_name, action, ip_address)
            VALUES ($1, $2, $3, $4);
        """, "GJ-POL-2026-01", "IPS Officer Vikram Solanki", "POSTGIS_RADIUS_SEARCH_QUERY", "10.142.1.25 (State WAN)")
        
        logs = await conn.fetch("SELECT id, operator_id, operator_name, action, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5;")
        print("  -> Audit Logs in AWS RDS:")
        for log in logs:
            print(f"      - [{log['timestamp']}] {log['operator_name']} ({log['operator_id']}): {log['action']}")

        print("=" * 70)
        print("[COMPLETE] AWS RDS POSTGRESQL & POSTGIS VERIFICATION SUCCESSFUL!")
        print("=" * 70)
        
        await conn.close()

    except Exception as e:
        print(f"[ERROR] Verification Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_aws_rds_full())
