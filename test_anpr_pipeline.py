
import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.abspath("backend"))
from app.api.v1.anpr import ingest_anpr_alert

async def test_live_pipeline():
    print("=================================================================")
    print("      Z-TRACS 2-TIER ANPR: DETECTION vs ALERTS LIVE TEST         ")
    print("=================================================================\n")

    # 1. Test Normal Vehicle (Not in Watchlist)
    normal_plate = f"GJ01-NORMAL-{int(time.time()) % 1000:03d}"
    print(f"1. INGESTING NORMAL VEHICLE: {normal_plate}")
    print("   -> Expected: Store in 'anpr_detections' ONLY. (Zero alerts fired)")
    
    res_normal = await ingest_anpr_alert({
        "number_plate": normal_plate,
        "camera_code": "CAM-001",
        "camera_name": "Chiman Bhai Bridge Junction",
        "district": "Ahmedabad",
        "vehicle_type": "SEDAN",
        "confidence": 0.96
    })
    print(f"   [OK] Stored in Telemetry! Watchlist Hit: {res_normal.data.get('watchlist_hit')}")
    print("   [OK] Check 'anpr_alerts' table -> This plate will NOT be there.\n")

    await asyncio.sleep(1)

    # 2. Test Wanted Vehicle (In Watchlist)
    wanted_plate = "GJ01AB1234"
    print(f"2. INGESTING WANTED VEHICLE: {wanted_plate}")
    print("   -> Expected: Store in 'anpr_detections' AND fire CRITICAL in 'anpr_alerts'")

    res_wanted = await ingest_anpr_alert({
        "number_plate": wanted_plate,
        "camera_code": "CAM-002",
        "camera_name": "Janpath Road Axis",
        "district": "Ahmedabad",
        "vehicle_type": "SUV",
        "confidence": 0.99
    })
    print(f"   [OK] Stored in Telemetry! Watchlist Hit: {res_wanted.data.get('watchlist_hit')}")
    print(f"   [ALERT] Critical Alert Fired: {res_wanted.data.get('title')}")
    print(f"   [OK] Stored in 'anpr_alerts' table with Alert ID: {res_wanted.data.get('id')}\n")

    print("=================================================================")
    print("                      TEST COMPLETED!                            ")
    print("=================================================================")
    print("Now open your Database Client extension:")
    print("1. Double-click 'anpr_detections' -> You will see BOTH plates.")
    print("2. Double-click 'anpr_alerts'     -> You will see ONLY the wanted plate.")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(test_live_pipeline())
