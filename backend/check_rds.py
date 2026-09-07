import asyncio
import asyncpg
import os

DB_URL = "postgresql://postgresgjtracs:PostgresGjtracs@z-tracs-gj.c5u8ogweeig9.ap-south-1.rds.amazonaws.com:5432/ztracs"

test_ids = [
    'anpr-ingest-1441e45b', 
    'anpr-ingest-a1e43a25', 
    'anpr-ingest-d51d89b5', 
    'anpr-ingest-6b09ea3d', 
    'anpr-ingest-462358e4', 
    'anpr-ingest-200a4340',
    'anpr-ingest-ce08c364', 
    'anpr-ingest-795ac4d1', 
    'anpr-ingest-5bfeb24f',
    'anpr-ingest-844b7dc4',
    'anpr-ingest-5abaa65e',
    'anpr-ingest-09802505'
]

async def check():
    conn = await asyncpg.connect(DB_URL)
    
    # Get column names
    cols = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'anpr_alerts'")
    col_names = [c['column_name'] for c in cols]
    print(f"Columns in anpr_alerts: {col_names}")

    print("\n=== CHECKING SPECIFIC ALERT IDS IN RDS DATABASE ===")
    for tid in test_ids:
        row = await conn.fetchrow("SELECT id, snapshot, length(snapshot) as snap_len FROM anpr_alerts WHERE id = $1", tid)
        if row:
            snap_val = row['snapshot']
            snap_preview = str(snap_val)[:50] if snap_val else "NULL"
            print(f"ID: {tid} | Exists: YES | Length: {row['snap_len']} | Value: {snap_preview}")
        else:
            print(f"ID: {tid} | Exists: NO")

    print("\n=== LATEST 30 INGESTED ALERTS IN RDS ===")
    rows = await conn.fetch("""
        SELECT id, snapshot, length(snapshot) as snap_len, created_at 
        FROM anpr_alerts 
        ORDER BY created_at DESC 
        LIMIT 30
    """)
    valid_count = 0
    dummy_count = 0
    null_count = 0
    for r in rows:
        s = r['snapshot']
        if not s or len(s.strip()) == 0:
            null_count += 1
            status = "NULL/EMPTY"
        elif len(s) < 200 or s.endswith('.jpg') or s.endswith('.png'):
            dummy_count += 1
            status = f"DUMMY FILENAME ({s})"
        else:
            valid_count += 1
            status = f"VALID BASE64 ({len(s)} chars)"
        print(f"[{r['created_at']}] ID: {r['id']} | Status: {status}")

    print("\n=== SUMMARY OF LATEST 30 INGESTIONS ===")
    print(f"Valid Base64 Images : {valid_count}")
    print(f"Dummy Filenames     : {dummy_count}")
    print(f"Null / Empty        : {null_count}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(check())
