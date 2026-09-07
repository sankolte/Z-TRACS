"""
Z-TRACS PostGIS GiST Geography Index Optimization & 12,000 Camera Benchmarking Script
"""
import os
import sys
import asyncio
import time
import random

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings

# Representative Gujarat Districts with center Lat/Lng & Bounding Boxes
DISTRICT_CENTERS = [
    ("Ahmedabad", 23.0225, 72.5714, 0.25),
    ("Surat", 21.1702, 72.8311, 0.20),
    ("Vadodara", 22.3072, 73.1812, 0.18),
    ("Rajkot", 22.3039, 70.8022, 0.15),
    ("Gandhinagar", 23.2156, 72.6369, 0.12),
    ("Bhavnagar", 21.7645, 72.1519, 0.12),
    ("Jamnagar", 22.4707, 70.0577, 0.12),
    ("Junagadh", 21.5222, 70.4579, 0.10),
    ("Surendranagar", 22.7234, 71.6369, 0.10),
    ("Kutch_Bhuj", 23.2420, 69.6669, 0.35),
    ("Mehsana", 23.6000, 72.4000, 0.10),
    ("Navsari", 20.9467, 72.9520, 0.10),
]

async def optimize_and_benchmark():
    print("=" * 80)
    print("  Z-TRACS POSTGIS GIST GEOGRAPHY OPTIMIZATION & 12,000 CAMERA BENCHMARK")
    print("=" * 80)
    print(f"Target AWS RDS Host: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print("-" * 80)

    try:
        import asyncpg
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )

        # STEP 1: Check Current Index Definitions
        print("\n[STEP 1] Current Indexes on 'cameras' Table:")
        indexes = await conn.fetch("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cameras';")
        for idx in indexes:
            print(f"  -> {idx['indexname']}: {idx['indexdef']}")

        # STEP 2: Add Stored GEOGRAPHY Column & Create GiST Geography Index
        print("\n[STEP 2] Adding Stored 'location_geog' GEOGRAPHY Column & GiST Geography Index...")
        await conn.execute("""
            ALTER TABLE cameras 
            ADD COLUMN IF NOT EXISTS location_geog geography(Point, 4326) 
            GENERATED ALWAYS AS (location_geom::geography) STORED;
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_cameras_location_geog_gist 
            ON cameras USING GIST (location_geog);
        """)
        
        await conn.execute("ANALYZE cameras;")
        print("  -> 'location_geog' column & 'idx_cameras_location_geog_gist' created successfully!")

        # STEP 3: Scale Table to 12,000+ Camera Records for Realistic Production Testing
        current_count = await conn.fetchval("SELECT COUNT(*) FROM cameras;")
        print(f"\n[STEP 3] Current Camera Count in Database: {current_count}")
        
        target_count = 12000
        if current_count < target_count:
            needed = target_count - current_count
            print(f"  -> Bulk-generating {needed} realistic Gujarat CCTV nodes to match production scale...")
            
            start_bulk = time.time()
            batch_size = 2000
            inserted = 0
            
            while inserted < needed:
                chunk = min(batch_size, needed - inserted)
                records = []
                for i in range(chunk):
                    idx_val = current_count + inserted + i + 1
                    dist_name, center_lat, center_lng, spread = random.choice(DISTRICT_CENTERS)
                    lat = round(center_lat + (random.random() - 0.5) * spread, 6)
                    lng = round(center_lng + (random.random() - 0.5) * spread, 6)
                    code = f"CAM-GJ-{dist_name[:3].upper()}-{idx_val:06d}"
                    name = f"{dist_name} Junction-{idx_val} CCTV"
                    dept_id = "DEPT-POL-01"
                    dept_name = "Gujarat Police Department"
                    health = "ONLINE" if random.random() > 0.05 else "OFFLINE"
                    life = "ACTIVE"
                    url = f"rtsp://stream.sdc.gujarat.gov.in:554/live/{code}"
                    records.append((code, name, dept_id, dept_name, dist_name, health, life, url, lat, lng))

                await conn.executemany("""
                    INSERT INTO cameras (camera_code, name, department_id, department_name, district, health_status, lifecycle, stream_url, latitude, longitude, location_geom)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_SetSRID(ST_MakePoint($10, $9), 4326))
                    ON CONFLICT (camera_code) DO NOTHING;
                """, records)
                
                inserted += chunk
                print(f"     Progress: {inserted}/{needed} inserted...")

            elapsed_bulk = time.time() - start_bulk
            print(f"  -> Bulk insertion of {needed} cameras completed in {elapsed_bulk:.2f}s!")
            
            # Re-analyze table statistics for query planner
            await conn.execute("ANALYZE cameras;")

        final_count = await conn.fetchval("SELECT COUNT(*) FROM cameras;")
        print(f"  -> Verified Final Camera Count: {final_count} records")

        # STEP 4: Test Diagnostic Query 1 (Geometry ST_DWithin with 0.05 degrees)
        print("\n" + "=" * 80)
        print("[TEST 1] Geometry-based ST_DWithin (degrees diagnostic query)")
        print("=" * 80)
        explain_geom = await conn.fetch("""
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT camera_uuid, camera_code, name, district
            FROM cameras
            WHERE ST_DWithin(
                location_geom,
                ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326),
                0.05
            );
        """)
        for r in explain_geom:
            print(f"  {r['QUERY PLAN']}")

        # STEP 5: Test Production Query (Geography ST_DWithin with 5,000 meters using location_geog GiST index)
        print("\n" + "=" * 80)
        print("[TEST 2] Production Geography-based ST_DWithin (5,000 meters using idx_cameras_location_geog_gist)")
        print("=" * 80)
        explain_geog = await conn.fetch("""
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT camera_uuid, camera_code, name, district
            FROM cameras
            WHERE ST_DWithin(
                location_geog,
                ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
                5000
            );
        """)
        
        plan_lines = []
        planning_time = None
        execution_time = None
        index_used = False
        
        for r in explain_geog:
            line = r['QUERY PLAN']
            plan_lines.append(line)
            print(f"  {line}")
            if "idx_cameras_location_geog_gist" in line or "Index Scan" in line or "Bitmap Index Scan" in line:
                index_used = True
            if "Planning Time:" in line:
                planning_time = line.split(":")[1].strip()
            if "Execution Time:" in line:
                execution_time = line.split(":")[1].strip()

        print("-" * 80)
        print("EMPIRICAL BENCHMARK SUMMARY (12,000 CAMERAS DATASET):")
        print(f"  -> Total Cameras in DB:       {final_count}")
        print(f"  -> GiST Index Utilized:      {'YES (idx_cameras_location_geog_gist)' if index_used else 'NO'}")
        print(f"  -> DB Server Planning Time:  {planning_time}")
        print(f"  -> DB Server Execution Time: {execution_time}")
        print("=" * 80)

        await conn.close()

    except Exception as e:
        print(f"[ERROR] Optimization Failed: {e}")

if __name__ == "__main__":
    asyncio.run(optimize_and_benchmark())
