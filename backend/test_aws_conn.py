import asyncio
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def test_s3():
    print("=" * 60)
    print("1. TESTING AWS S3 CONNECTION...")
    print("=" * 60)
    try:
        s3 = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION', 'ap-south-1'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        buckets = s3.list_buckets()
        bucket_names = [b['Name'] for b in buckets.get('Buckets', [])]
        print(f"[SUCCESS] S3 Authenticated Successfully!")
        print(f"Available S3 Buckets ({len(bucket_names)}): {bucket_names}")
        target = os.getenv('AWS_S3_BUCKET_NAME', 'ztracs-evidence-vault-dev')
        if target in bucket_names:
            print(f"[SUCCESS] Target Evidence Bucket '{target}' FOUND and accessible!")
        else:
            print(f"[NOTE] Target '{target}' not in bucket list, checking bucket permissions...")
    except Exception as e:
        print(f"[S3 ERROR] {e}")

async def test_rds():
    print("\n" + "=" * 60)
    print("2. TESTING AWS RDS (POSTGRESQL) CONNECTION...")
    print("=" * 60)
    import asyncpg
    db_url = os.getenv('DATABASE_URL')
    print(f"Connecting to: {os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}...")
    try:
        conn = await asyncio.wait_for(asyncpg.connect(db_url), timeout=5.0)
        res = await conn.fetchval("SELECT version();")
        print(f"[SUCCESS] RDS Connected Successfully!")
        print(f"PostgreSQL Version: {res[:50]}...")
        
        # Check tables
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        t_names = [t['table_name'] for t in tables]
        print(f"Tables in 'ztracs' database: {t_names}")
        await conn.close()
    except asyncio.TimeoutError:
        print("[RDS TIMEOUT] Connection timed out after 5s.")
        print("Reason: RDS Security Group is blocking your IP, or Public Access is disabled.")
    except Exception as e:
        print(f"[RDS ERROR] {e}")

if __name__ == "__main__":
    test_s3()
    asyncio.run(test_rds())
