"""
Z-TRACS AWS RDS PostgreSQL Alerts Viewer & Exporter
Run this script anytime to inspect and export all ANPR alerts saved in the AWS RDS Database.
Command: python view_rds_alerts.py
"""
import asyncio
import asyncpg
import csv

# AWS RDS Connection Details
HOST = "z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com"
PORT = 5432
USER = "postgresgjtracs"
PASSWORD = "PostgresGjtracs"
DB_NAME = "ztracs"

async def view_alerts():
    print("=" * 100)
    print(" CONNECTING TO AWS RDS POSTGRESQL DATABASE...")
    print(f"    Host: {HOST}")
    print(f"    Database: {DB_NAME}")
    print("=" * 100)

    try:
        conn = await asyncpg.connect(
            user=USER,
            password=PASSWORD,
            database=DB_NAME,
            host=HOST,
            port=PORT,
        )

        total_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_alerts")
        print(f"\nTOTAL ALERTS STORED IN DATABASE: {total_count}\n")

        # Fetch ALL alerts ordered by most recent first
        rows = await conn.fetch("""
            SELECT 
                id, 
                severity, 
                category, 
                number_plate, 
                camera_id,
                camera_code,
                camera_name,
                district, 
                watchlist_hit, 
                status,
                title,
                notes,
                received_at 
            FROM anpr_alerts 
            ORDER BY received_at DESC
        """)

        if not rows:
            print("No alerts found in table 'anpr_alerts'.")
        else:
            header = f"{'#':<4} | {'SEVERITY':<10} | {'PLATE':<14} | {'CAM ID':<7} | {'WATCHLIST':<10} | {'CATEGORY':<18} | {'RECEIVED AT'}"
            print(header)
            print("-" * len(header))
            for idx, r in enumerate(rows, 1):
                sev = r['severity'] or 'INFO'
                plate = r['number_plate'] or 'N/A'
                cam = str(r['camera_id'] or 'N/A')
                wl = "YES [HIT]" if r['watchlist_hit'] else "NO"
                cat = r['category'] or 'ANPR_DETECTION'
                rec = str(r['received_at'])[:19]
                print(f"{idx:<4} | {sev:<10} | {plate:<14} | {cam:<7} | {wl:<10} | {cat:<18} | {rec}")

            # Export to CSV
            csv_filename = "rds_alerts_export.csv"
            with open(csv_filename, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "ID", "Received At", "Severity", "Category", "Plate Number",
                    "Camera ID", "Camera Code", "Camera Name", "District", "Watchlist Hit", "Status", "Title", "Notes"
                ])
                for r in rows:
                    writer.writerow([
                        r['id'], str(r['received_at']), r['severity'], r['category'],
                        r['number_plate'], r['camera_id'], r['camera_code'], r['camera_name'],
                        r['district'], r['watchlist_hit'], r['status'], r['title'], r['notes']
                    ])
            print(f"\n[SUCCESS] All {len(rows)} alerts exported successfully to '{csv_filename}'!")

        print("\n" + "=" * 100)
        await conn.close()
    except Exception as e:
        print(f"Error connecting to RDS: {e}")

if __name__ == "__main__":
    asyncio.run(view_alerts())
