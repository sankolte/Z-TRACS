import asyncio
import asyncpg
import json

async def check_rds():
    try:
        conn = await asyncpg.connect(
            user='postgresgjtracs',
            password='PostgresGjtracs',
            database='ztracs',
            host='z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com',
            port=5432,
            ssl='require',
            timeout=10.0
        )
    except Exception as e:
        print(f"Could not connect to RDS: {e}")
        return

    print("===============================================================")
    print("        AWS RDS POSTGRESQL LIVE DATABASE AUDIT REPORT          ")
    print("===============================================================\n")

    # 1. Check anpr_alerts table
    alerts_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_alerts;")
    print(f"1. [TABLE: anpr_alerts] Total Records: {alerts_count}")
    
    rows = await conn.fetch("SELECT id, severity, category, number_plate, camera_code, camera_name, district, watchlist_hit, received_at FROM anpr_alerts ORDER BY id DESC LIMIT 5;")
    if rows:
        print("   Recent Live Ingested Alerts in RDS:")
        for r in rows:
            print(f"   * ID #{r['id']} | Plate: {r['number_plate']} | Cam: {r['camera_code']} ({r['camera_name']}) | Watchlist: {r['watchlist_hit']} | Severity: {r['severity']} | Time: {r['received_at']}")
    else:
        print("   (Table empty or no alerts yet)")

    print("\n---------------------------------------------------------------\n")

    # 2. Check anpr_camera_rois table
    rois_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_camera_rois;")
    print(f"2. [TABLE: anpr_camera_rois] Total Saved Camera Polygons: {rois_count}")
    
    roi_rows = await conn.fetch("SELECT camera_code, camera_name, resolution, zone_name, points_json, updated_at FROM anpr_camera_rois ORDER BY updated_at DESC LIMIT 5;")
    if roi_rows:
        print("   Saved Detection Area ROIs in RDS:")
        for r in roi_rows:
            pts_preview = (r['points_json'] or '')[:65]
            print(f"   * Camera: {r['camera_code']} ({r['camera_name']}) | Zone: {r['zone_name']} | Points: {pts_preview}... | Last Updated: {r['updated_at']}")
    else:
        print("   (No camera ROIs saved yet in RDS)")

    print("\n===============================================================")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(check_rds())
