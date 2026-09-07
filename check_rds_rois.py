import asyncio
import asyncpg
import json
import sys

# Force UTF-8 output for Windows console
sys.stdout.reconfigure(encoding='utf-8')

DB_URL = "postgresql://postgresgjtracs:PostgresGjtracs@z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com:5432/ztracs"

async def check_rois():
    print("=" * 75)
    print(" CONNECTING TO AWS RDS POSTGRESQL (DB: ztracs) ...")
    print("=" * 75)
    
    try:
        conn = await asyncpg.connect(DB_URL)
    except Exception as e:
        print(f"FAILED TO CONNECT TO RDS: {e}")
        return

    try:
        rows = await conn.fetch("""
            SELECT camera_code, camera_name, resolution, zone_name, points_json, updated_at 
            FROM anpr_camera_rois 
            ORDER BY updated_at DESC
        """)
        
        print(f"SUCCESS: Connected to AWS RDS PostgreSQL Database!")
        print(f"TOTAL CAMERA ROIs STORED IN RDS DATABASE: {len(rows)}\n")
        print("=" * 75)

        if not rows:
            print("No ROI polygons stored in AWS RDS table 'anpr_camera_rois' yet.")
        else:
            for idx, r in enumerate(rows, 1):
                pts = json.loads(r['points_json']) if r['points_json'] else []
                pts_str = ", ".join([f"({p['x']}, {p['y']})" for p in pts])
                print(f"[{idx}] CAMERA CODE : {r['camera_code']}")
                print(f"    NAME        : {r['camera_name']}")
                print(f"    RESOLUTION  : {r['resolution']}")
                print(f"    ZONE NAME   : {r['zone_name']}")
                print(f"    UPDATED AT  : {r['updated_at']}")
                print(f"    POINTS ({len(pts)}) : [{pts_str}]")
                print("-" * 75)

    except Exception as e:
        print(f"Table query error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_rois())
