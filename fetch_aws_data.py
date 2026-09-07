import os
import sys
import asyncio
import json

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
sys.path.insert(0, backend_dir)

from app.core.config import settings

async def main():
    print("=" * 70)
    print("  AWS RDS POSTGRESQL & S3 BUCKET DATA RETRIEVAL")
    print("=" * 70)
    print(f"RDS Endpoint : {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print(f"S3 Bucket    : {settings.AWS_S3_BUCKET_NAME} (Region: {settings.AWS_REGION})")
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
        
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        print("\nTABLES IN AWS RDS POSTGRESQL DATABASE:")
        for t in tables:
            tname = t["table_name"]
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {tname};")
            print(f"  - {tname:<25} : {count} total records")
            
        print("\nRECENT CAMERA RECORDS (FROM RDS 'cameras' TABLE):")
        cams = await conn.fetch("""
            SELECT camera_uuid, camera_code, name, district, health_status, stream_url 
            FROM cameras 
            LIMIT 15;
        """)
        
        for idx, c in enumerate(cams, 1):
            print(f"  [{idx}] Code: {c['camera_code']} | Name: {c['name']}")
            print(f"      District : {c['district']} | Health: {c['health_status']}")
            print(f"      RTSP URL : {c['stream_url']}")
            print("  " + "-" * 55)

        print("\nRECENT AUDIT LOGS (FROM RDS 'audit_logs' TABLE):")
        logs = await conn.fetch("""
            SELECT id, operator_id, operator_name, action, ip_address, timestamp 
            FROM audit_logs 
            ORDER BY timestamp DESC 
            LIMIT 5;
        """)
        for idx, l in enumerate(logs, 1):
            print(f"  [{idx}] Timestamp: {l['timestamp']} | Action: {l['action']}")
            print(f"      Operator: {l['operator_name']} ({l['operator_id']}) | IP: {l['ip_address']}")

        await conn.close()
        
    except Exception as e:
        print(f"[RDS Error] {e}")

    # Check S3 Bucket connection
    print("\n" + "=" * 70)
    print("  AWS S3 EVIDENCE VAULT BUCKET INSPECTION")
    print("=" * 70)
    try:
        import boto3
        s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None
        )
        res = s3.list_objects_v2(Bucket=settings.AWS_S3_BUCKET_NAME, MaxKeys=20)
        contents = res.get("Contents", [])
        print(f"Bucket '{settings.AWS_S3_BUCKET_NAME}' contains {len(contents)} objects (showing top 20):")
        for obj in contents:
            print(f"  • Key: {obj['Key']:<40} | Size: {obj['Size']:<10} bytes | LastModified: {obj['LastModified']}")
        if not contents:
            print(f"  • Bucket '{settings.AWS_S3_BUCKET_NAME}' is active and ready (0 files currently stored).")
    except Exception as s3_err:
        print(f"[S3 Warning / Info] {s3_err}")

    print("\n" + "=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
