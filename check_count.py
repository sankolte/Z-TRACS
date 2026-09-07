"""
Z-TRACS ANPR Alert Counter
Run this command in terminal anytime to get the exact alert count from AWS RDS PostgreSQL:
python check_count.py
"""
import asyncio
import asyncpg

HOST = "z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com"
PORT = 5432
USER = "postgresgjtracs"
PASSWORD = "PostgresGjtracs"
DB_NAME = "ztracs"

async def check_count():
    try:
        conn = await asyncpg.connect(
            user=USER,
            password=PASSWORD,
            database=DB_NAME,
            host=HOST,
            port=PORT,
        )
        total_count = await conn.fetchval("SELECT COUNT(*) FROM anpr_alerts")
        watchlist_hits = await conn.fetchval("SELECT COUNT(*) FROM anpr_alerts WHERE watchlist_hit = true")
        latest = await conn.fetchrow("SELECT number_plate, camera_id, received_at FROM anpr_alerts ORDER BY received_at DESC LIMIT 1")
        
        print("\n" + "="*60)
        print(" Z-TRACS AWS RDS POSTGRESQL ALERT STATS")
        print("="*60)
        print(f" TOTAL ALERTS STORED IN DATABASE : {total_count}")
        print(f" WATCHLIST HIT ALERTS            : {watchlist_hits}")
        if latest:
            print(f" LATEST ALERT RECEIVED           : {latest['number_plate']} (Cam #{latest['camera_id']}) at {str(latest['received_at'])[:19]} UTC")
        print("="*60 + "\n")
        await conn.close()
    except Exception as e:
        print(f"[ERROR] Could not connect to AWS RDS: {e}")

if __name__ == "__main__":
    asyncio.run(check_count())
