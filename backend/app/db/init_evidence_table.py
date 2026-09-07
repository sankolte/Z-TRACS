"""
AWS RDS 'evidence' Table Initialization Script for Z-TRACS S3 Evidence Vault
"""
import os
import sys
import asyncio

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings

async def init_evidence_table():
    print(f"[AWS RDS] Initializing 'evidence' Table on database '{settings.POSTGRES_DB}'...")
    try:
        import asyncpg
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )

        await conn.execute('''
            CREATE TABLE IF NOT EXISTS evidence (
                evidence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                incident_id VARCHAR(100),
                camera_uuid VARCHAR(100),
                s3_bucket VARCHAR(255) NOT NULL,
                s3_key TEXT NOT NULL UNIQUE,
                original_filename VARCHAR(255) NOT NULL,
                content_type VARCHAR(100) NOT NULL,
                file_size BIGINT DEFAULT 0,
                sha256_hash VARCHAR(64),
                uploaded_by VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence (incident_id);')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_evidence_camera ON evidence (camera_uuid);')
        await conn.execute('CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence (status);')

        print("[SUCCESS] 'evidence' table and indexes created on AWS RDS PostgreSQL!")
        await conn.close()
    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    asyncio.run(init_evidence_table())
