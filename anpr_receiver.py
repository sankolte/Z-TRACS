"""
Z-TRACS ANPR Receiver Script
==============================
Handles BOTH alert types:

  TYPE 1 — General Detection:
    Any plate seen on any camera.
    watchlist = False (plate is not in the watchlist)

  TYPE 2 — Watchlist Search Hit:
    A plate that matches the watchlist is detected.
    watchlist = True (plate IS in the watchlist)

Both types use the SAME payload format and the SAME POST endpoint.
The only difference is the `watchlist` field = True or False.

The receiver also polls GET /api/v1/anpr/watchlist every 60 seconds
and saves it to watchlist.json — so your ANPR engine always has the
latest list to compare against.

Install: pip install requests schedule
Run:     python anpr_receiver.py
"""

import json
import time
import datetime
import threading
import requests
import schedule
import base64
import os
from pathlib import Path

# ─────────────────────────────────────────────────────────
# CONFIG  — EDIT THESE
# ─────────────────────────────────────────────────────────

BASE_URL       = "http://43.204.235.231:8000"   # Z-TRACS backend (your AWS EC2)
WATCHLIST_FILE = "watchlist.json"               # Local file where watchlist is saved

# Map YOUR camera IDs to lat/lng
# Replace with your actual camera IDs and locations
CAMERA_ID_MAP = {
    6:  {"lat": 23.001926, "lng": 72.599521, "name": "Ahmedabad Junction-14"},
    7:  {"lat": 23.030379, "lng": 72.611273, "name": "Ahmedabad Junction-15"},
    12: {"lat": 23.090177, "lng": 72.643397, "name": "Ahmedabad Junction-29"},
}

# Auth token — leave None for dev mode (no auth required)
# To use auth: JWT_TOKEN = "your_jwt_token_here"
JWT_TOKEN = None

# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────

def get_headers():
    headers = {"Content-Type": "application/json"}
    if JWT_TOKEN:
        headers["Authorization"] = f"Bearer {JWT_TOKEN}"
    return headers


def load_local_watchlist():
    """Load watchlist plates from local watchlist.json file."""
    if Path(WATCHLIST_FILE).exists():
        with open(WATCHLIST_FILE, "r") as f:
            data = json.load(f)
            return [p.upper() for p in data.get("watchlist", [])]
    return []


def encode_snapshot(snapshot_path: str) -> str:
    """Convert an image file to base64 string. Returns filename if file not found."""
    if snapshot_path and Path(snapshot_path).exists():
        with open(snapshot_path, "rb") as img:
            return base64.b64encode(img.read()).decode("utf-8")
    return snapshot_path or "no_snapshot"


# ─────────────────────────────────────────────────────────
# WATCHLIST SYNC — Polls Z-TRACS every 60 seconds
# ─────────────────────────────────────────────────────────

def fetch_and_save_watchlist():
    """
    Fetches the latest watchlist from Z-TRACS server.
    Saves it to watchlist.json on your local machine.
    Run every 60 seconds so your ANPR engine always has fresh plates.
    """
    try:
        resp = requests.get(f"{BASE_URL}/api/v1/anpr/watchlist", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            with open(WATCHLIST_FILE, "w") as f:
                json.dump(data, f, indent=2)
            plates = data.get("watchlist", [])
            count  = data.get("count", 0)
            print(f"[WATCHLIST] ✅ Synced — {count} plates: {plates}")
        else:
            print(f"[WATCHLIST] ❌ HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[WATCHLIST] ❌ Connection error: {e}")


# ─────────────────────────────────────────────────────────
# TYPE 1 — GENERAL DETECTION ALERT
# Call this whenever ANY plate is detected on a camera
# ─────────────────────────────────────────────────────────

def send_detection_alert(camera_id: int, plate: str, snapshot_path: str = None):
    """
    TYPE 1 — General Detection.
    Called by your ANPR engine whenever it reads ANY number plate.

    Args:
        camera_id:     Your camera's ID number (e.g. 6, 7, 12)
        plate:         Detected plate text (e.g. "GJ01AB1234")
        snapshot_path: Path to the snapshot image file (optional)
    """
    cam_info  = CAMERA_ID_MAP.get(camera_id, {"lat": 0.0, "lng": 0.0, "name": "Unknown Camera"})
    now       = datetime.datetime.now()
    plate_up  = plate.upper().strip()
    watchlist = load_local_watchlist()

    # Check if this plate is in the local watchlist
    is_hit = plate_up in watchlist

    payload = {
        "date":         now.strftime("%d-%m-%Y"),
        "time":         now.strftime("%H:%M"),
        "camera_id":    camera_id,
        "number_plate": plate_up,
        "location": {
            "lat": cam_info["lat"],
            "lng": cam_info["lng"],
        },
        "snapshot":  encode_snapshot(snapshot_path),
        "PlateCrop": encode_snapshot(snapshot_path),
        "plate_crop": encode_snapshot(snapshot_path),
        "watchlist": is_hit,   # True if plate matched watchlist, False otherwise
    }

    tag = "🚨 WATCHLIST HIT" if is_hit else "📷 DETECTION"
    print(f"\n[ALERT → TYPE 1] {tag} | Cam #{camera_id} ({cam_info['name']}) | Plate: {plate_up}")
    _post_alert(payload)


# ─────────────────────────────────────────────────────────
# TYPE 2 — WATCHLIST SEARCH ALERT
# Call this when an officer searches for a specific plate
# and it gets spotted on camera
# ─────────────────────────────────────────────────────────

def send_watchlist_search_alert(camera_id: int, plate: str, snapshot_path: str = None):
    """
    TYPE 2 — Watchlist Search Hit.
    Called when a plate that was specifically added to the watchlist
    (from the Z-TRACS frontend by an officer) is detected on camera.

    This always sets watchlist = True.

    Args:
        camera_id:     Your camera's ID number (e.g. 6, 7, 12)
        plate:         The matched watchlist plate (e.g. "GJ01AB1234")
        snapshot_path: Path to the snapshot image file (optional)
    """
    cam_info  = CAMERA_ID_MAP.get(camera_id, {"lat": 0.0, "lng": 0.0, "name": "Unknown Camera"})
    now       = datetime.datetime.now()
    plate_up  = plate.upper().strip()

    payload = {
        "date":         now.strftime("%d-%m-%Y"),
        "time":         now.strftime("%H:%M"),
        "camera_id":    camera_id,
        "number_plate": plate_up,
        "location": {
            "lat": cam_info["lat"],
            "lng": cam_info["lng"],
        },
        "snapshot":  encode_snapshot(snapshot_path),
        "PlateCrop": encode_snapshot(snapshot_path),
        "plate_crop": encode_snapshot(snapshot_path),
        "watchlist": True,   # ALWAYS True for watchlist search hits
    }

    print(f"\n[ALERT → TYPE 2] 🚨 WATCHLIST SEARCH HIT | Cam #{camera_id} ({cam_info['name']}) | Plate: {plate_up}")
    _post_alert(payload)


# ─────────────────────────────────────────────────────────
# INTERNAL — POST alert to Z-TRACS server
# ─────────────────────────────────────────────────────────

def _post_alert(payload: dict):
    """Internal: sends the alert payload to Z-TRACS."""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/anpr/ingest",
            json=payload,
            headers=get_headers(),
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data     = resp.json()
            alert_id = data.get("data", {}).get("alertId", "N/A")
            hit      = data.get("data", {}).get("watchlistHit", False)
            print(f"           ✅ Sent — Alert ID: {alert_id} | Watchlist Hit: {hit}")
        else:
            print(f"           ❌ HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"           ❌ Connection error: {e}")


# ─────────────────────────────────────────────────────────
# DEMO — Simulates both alert types (REMOVE IN PRODUCTION)
# Replace with your real ANPR SDK callbacks
# ─────────────────────────────────────────────────────────

def demo_simulate_alerts():
    """
    DEMO ONLY — Remove this in production.

    In production, your ANPR SDK fires a callback when a plate is detected.
    You call:
        send_detection_alert(camera_id, plate, snapshot_path)   ← for every detection
        send_watchlist_search_alert(camera_id, plate, snapshot_path)  ← when watchlist match
    """
    import random

    all_plates       = ["GJ01AB1234", "MH12CD5678", "GJ05EF9012", "RJ14GH3456", "DL01XY9999"]
    watchlist        = load_local_watchlist()
    watchlist_plates = watchlist if watchlist else ["GJ01AB1234"]  # fallback for demo
    demo_cameras     = list(CAMERA_ID_MAP.keys())

    # Randomly simulate Type 1 or Type 2
    choice    = random.choice(["type1", "type2"])
    camera_id = random.choice(demo_cameras)

    if choice == "type1":
        # Type 1 — random plate (may or may not be in watchlist)
        plate = random.choice(all_plates)
        send_detection_alert(camera_id=camera_id, plate=plate)
    else:
        # Type 2 — forced watchlist plate
        plate = random.choice(watchlist_plates)
        send_watchlist_search_alert(camera_id=camera_id, plate=plate)


# ─────────────────────────────────────────────────────────
# PRODUCTION USAGE EXAMPLE
# ─────────────────────────────────────────────────────────
#
# Your ANPR engine detects a plate → call send_detection_alert()
#
#   def my_anpr_callback(cam_id, detected_plate, image_path):
#       send_detection_alert(
#           camera_id     = cam_id,
#           plate         = detected_plate,
#           snapshot_path = image_path
#       )
#
# The function automatically checks the local watchlist.json
# and sets watchlist=True if the plate matches.
# No need to call send_watchlist_search_alert() separately unless
# you want to force a Type 2 alert for a specific plate.
#
# ─────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────
# SCHEDULER — Runs everything in background
# ─────────────────────────────────────────────────────────

def run_scheduler():
    schedule.every(60).seconds.do(fetch_and_save_watchlist)   # Sync watchlist every 1 min
    schedule.every(20).seconds.do(demo_simulate_alerts)        # DEMO: remove in production

    while True:
        schedule.run_pending()
        time.sleep(1)


# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Z-TRACS ANPR Receiver — Starting Up")
    print(f"  Backend  : {BASE_URL}")
    print(f"  Watchlist: {WATCHLIST_FILE}")
    print("=" * 60)
    print()
    print("  Alert Types:")
    print("  TYPE 1 → send_detection_alert()        — any plate detected")
    print("  TYPE 2 → send_watchlist_search_alert() — watchlist match")
    print()

    # Fetch watchlist immediately on startup
    fetch_and_save_watchlist()

    # Run scheduler in background thread
    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start()

    print("\n[RECEIVER] ✅ Running 24/7. Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n[RECEIVER] Stopped.")
