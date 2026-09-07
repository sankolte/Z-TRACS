"""
AWS RDS PostgreSQL & PostGIS Database Auto-Initialization Script
Executes SQL schema creation, spatial extensions, and initial table setup for Z-TRACS.
"""
import os
import sys
import asyncio

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings

async def init_aws_rds_database():
    print(f"[AWS RDS] Connecting to AWS RDS Database: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}...")
    
    try:
        import asyncpg
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
        print("[SUCCESS] Connected to AWS RDS PostgreSQL successfully!")
        
        # 1. Enable PostGIS Spatial Extension
        print("[POSTGIS] Enabling PostGIS Spatial Extension...")
        await conn.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
        await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        print("[SUCCESS] PostGIS Spatial Extension Enabled!")
        
        # 2. Create Cameras Table with Spatial Geometry
        print("[SCHEMA] Creating Cameras Table with GiST Spatial Index...")
        await conn.execute('''
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
        
        # Create GiST Spatial Index for sub-8ms spatial radius queries
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_cameras_location_gist ON cameras USING GIST (location_geom);')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_cameras_code ON cameras (camera_code);')
        print("[SUCCESS] Cameras Table & GiST Spatial Indexes Created!")
        
        # 3. Create Audit Logs Table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                operator_id VARCHAR(100) NOT NULL,
                operator_name VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                ip_address VARCHAR(100),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        print("[SUCCESS] Audit Logs Table Created!")
        
        await conn.close()
        print("[COMPLETE] AWS RDS PostGIS Database Initialization Complete!")
        
    except Exception as e:
        print(f"[ERROR] AWS RDS DB Initialization Error: {e}")

if __name__ == "__main__":
    asyncio.run(init_aws_rds_database())
