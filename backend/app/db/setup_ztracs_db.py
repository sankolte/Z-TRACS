"""
AWS RDS Dedicated 'ztracs' Database Provisioning & EXPLAIN (ANALYZE, BUFFERS) Performance Measurement Script
"""
import os
import sys
import asyncio

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings

async def setup_ztracs_database_and_measure():
    print("=" * 70)
    print("  AWS RDS DEDICATED 'ztracs' DATABASE CREATION & EXPLAIN ANALYZE")
    print("=" * 70)
    print(f"Target AWS RDS Host: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}")
    print(f"Target User:         {settings.POSTGRES_USER}")
    print("-" * 70)

    try:
        import asyncpg

        # Step 1: Connect to default postgres DB to create dedicated ztracs DB if needed
        print("[STEP 1] Checking if dedicated 'ztracs' database exists...")
        sys_conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database="postgres",
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
        
        db_exists = await sys_conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'ztracs';")
        if not db_exists:
            print("  -> 'ztracs' database does not exist. Creating DATABASE ztracs...")
            await sys_conn.execute("CREATE DATABASE ztracs;")
            print("  -> Dedicated 'ztracs' database created successfully!")
        else:
            print("  -> Dedicated 'ztracs' database already exists!")
            
        await sys_conn.close()

        # Step 2: Connect directly to 'ztracs' DB
        print("\n[STEP 2] Connecting to dedicated 'ztracs' database...")
        z_conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database="ztracs",
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )

        curr_db = await z_conn.fetchval("SELECT current_database();")
        curr_schema = await z_conn.fetchval("SELECT current_schema();")
        curr_user = await z_conn.fetchval("SELECT current_user;")

        print(f"  -> current_database() : {curr_db}")
        print(f"  -> current_schema()   : {curr_schema}")
        print(f"  -> current_user       : {curr_user}")

        # Enable Extensions on ztracs
        print("\n[STEP 3] Enabling PostGIS & UUID Extensions on 'ztracs' DB...")
        await z_conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        await z_conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        
        exts = await z_conn.fetch("SELECT extname, extversion FROM pg_extension ORDER BY extname;")
        print("  -> Extensions in 'ztracs':")
        for e in exts:
            print(f"      - {e['extname']} (v{e['extversion']})")

        # Create Schema & GiST Index on ztracs
        print("\n[STEP 4] Creating 'cameras' Table and GiST Spatial Index on 'ztracs' DB...")
        await z_conn.execute('''
            CREATE TABLE IF NOT EXISTS cameras (
                camera_uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                camera_code VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                department_id VARCHAR(100) NOT NULL,
                department_name VARCHAR(255) NOT NULL,
                district VARCHAR(100) NOT NULL,
                health_status VARCHAR(50) DEFAULT 'ONLINE',
                lifecycle VARCHAR(50) DEFAULT 'ACTIVE',
                stream_url TEXT,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                location_geom GEOMETRY(Point, 4326),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        await z_conn.execute('CREATE INDEX IF NOT EXISTS idx_cameras_location_gist ON cameras USING GIST (location_geom);')
        await z_conn.execute('CREATE INDEX IF NOT EXISTS idx_cameras_code ON cameras (camera_code);')

        await z_conn.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                operator_id VARCHAR(100) NOT NULL,
                operator_name VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                ip_address VARCHAR(100),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        # Seed sample camera records
        seed_data = [
            ('CAM-GJ-AHM-01', 'SG Highway Iskcon CCTV', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Ahmedabad', 'ONLINE', 'ACTIVE', 'rtsp://ahmedabad.cctv/stream1', 23.0225, 72.5714),
            ('CAM-GJ-AHM-02', 'Nehrunagar Junction Dome', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Ahmedabad', 'ONLINE', 'ACTIVE', 'rtsp://ahmedabad.cctv/stream2', 23.0250, 72.5400),
            ('CAM-GJ-SUR-01', 'Ring Road Surat Checkpoint', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Surat', 'ONLINE', 'ACTIVE', 'rtsp://surat.cctv/stream1', 21.1702, 72.8311),
            ('CAM-GJ-VAD-01', 'Alkapuri Circle CCTV', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Vadodara', 'ONLINE', 'ACTIVE', 'rtsp://vadodara.cctv/stream1', 22.3072, 73.1812),
            ('CAM-GJ-GAN-01', 'Sector 18 HQ Gate Cam', 'DEPT-POL-01', 'Gujarat Police Traffic', 'Gandhinagar', 'ONLINE', 'ACTIVE', 'rtsp://gandhinagar.cctv/stream1', 23.2156, 72.6369),
        ]
        for code, name, dept_id, dept_name, dist, health, life, url, lat, lng in seed_data:
            await z_conn.execute("""
                INSERT INTO cameras (camera_code, name, department_id, department_name, district, health_status, lifecycle, stream_url, latitude, longitude, location_geom)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_SetSRID(ST_MakePoint($10, $9), 4326))
                ON CONFLICT (camera_code) DO NOTHING;
            """, code, name, dept_id, dept_name, dist, health, life, url, lat, lng)

        # Step 5: Execute EXPLAIN (ANALYZE, BUFFERS) to measure exact Planning & Execution Time
        print("\n[STEP 5] EXPLAIN (ANALYZE, BUFFERS) Spatial Query Measurement:")
        explain_query = """
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT
                camera_uuid,
                camera_code,
                name,
                district
            FROM cameras
            WHERE ST_DWithin(
                location_geom::geography,
                ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
                5000
            );
        """
        explain_rows = await z_conn.fetch(explain_query)
        
        print("-" * 70)
        print("EXPLAIN (ANALYZE, BUFFERS) OUTPUT:")
        print("-" * 70)
        planning_time = None
        execution_time = None
        for row in explain_rows:
            line = row['QUERY PLAN']
            print(f"  {line}")
            if "Planning Time:" in line:
                planning_time = line.split(":")[1].strip()
            if "Execution Time:" in line:
                execution_time = line.split(":")[1].strip()

        print("-" * 70)
        print("EMPIRICAL TIMING RESULTS:")
        print(f"  -> Measured Planning Time:  {planning_time}")
        print(f"  -> Measured Execution Time: {execution_time}")
        print("=" * 70)

        await z_conn.close()

    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    asyncio.run(setup_ztracs_database_and_measure())
