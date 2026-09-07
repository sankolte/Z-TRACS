import os
import sys
import asyncio
import json
import csv

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
sys.path.insert(0, backend_dir)

from app.core.config import settings

async def export_cameras():
    print("=" * 70)
    print("  EXPORTING ALL CAMERA DATA FROM AWS RDS POSTGRESQL DATABASE")
    print("=" * 70)
    print(f"Target RDS Database: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
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
        
        # 1. Inspect columns
        columns = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cameras' 
            ORDER BY ordinal_position;
        """)
        
        col_names = [c["column_name"] for c in columns]
        print(f"Columns in 'cameras' table: {col_names}")
        
        # 2. Fetch all 12,000 records
        print("\nFetching all camera rows from AWS RDS...")
        query = f"SELECT {', '.join(col_names)} FROM cameras ORDER BY camera_code;"
        rows = await conn.fetch(query)
        print(f"Successfully retrieved {len(rows)} camera records from AWS RDS!")
        
        cameras_list = []
        for r in rows:
            record = {}
            for col in col_names:
                val = r[col]
                if hasattr(val, '__str__') and not isinstance(val, (int, float, bool, type(None), str)):
                    val = str(val)
                record[col] = val
            cameras_list.append(record)
            
        await conn.close()
        
        # 3. Save to JSON file
        json_path = os.path.join(current_dir, "aws_cameras_export.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(cameras_list, f, indent=2, ensure_ascii=False)
        print(f"Exported JSON file: {json_path} ({os.path.getsize(json_path) / (1024*1024):.2f} MB)")
        
        # 4. Save to CSV file
        csv_path = os.path.join(current_dir, "aws_cameras_export.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=col_names)
            writer.writeheader()
            writer.writerows(cameras_list)
        print(f"Exported CSV file : {csv_path} ({os.path.getsize(csv_path) / (1024*1024):.2f} MB)")

        print("=" * 70)
        print("EXPORT SUCCESSFUL!")
        print("=" * 70)

    except Exception as e:
        print(f"[Export Error] {e}")

if __name__ == "__main__":
    asyncio.run(export_cameras())
