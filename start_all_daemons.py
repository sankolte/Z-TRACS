"""
Z-TRACS Master Edge Suite - All-In-One Unified Daemon Runner
-------------------------------------------------------------
Runs all 3 edge listener daemons simultaneously in concurrent threads:
 1. ANPR Camera & ROI Registry Listener (cameras.json)
 2. Face Recognition Target & Clip Listener (faces.json & clips/ folder)
 3. Forensic Offline Video Footage Ingestion Listener (forensics.json & forensics/ folder)

Usage:
  python start_all_daemons.py
"""

import sys
import time
import threading

# Auto-dependency bootstrap
try:
    import requests
    from urllib3.util.retry import Retry
except ImportError:
    import subprocess
    print("[Z-TRACS SETUP] Installing required lightweight 'requests' library...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "urllib3"])
    import requests

from update_json import ZTracsActiveListener
from update_frs import ZTracsFrsListener
from update_forensics import ZTracsForensicsListener

def run_anpr():
    try:
        listener = ZTracsActiveListener(poll_interval=2.0)
        listener.start(blocking=True)
    except Exception as e:
        print(f"[ANPR DAEMON ERROR] {e}")

def run_frs():
    try:
        listener = ZTracsFrsListener(poll_interval=4.0)
        listener.start(blocking=True)
    except Exception as e:
        print(f"[FRS DAEMON ERROR] {e}")

def run_forensics():
    try:
        listener = ZTracsForensicsListener(poll_interval=5.0)
        listener.start(blocking=True)
    except Exception as e:
        print(f"[FORENSICS DAEMON ERROR] {e}")

def main():
    print("\n" + "=" * 72)
    print("      Z-TRACS UNIFIED EDGE DAEMON SUITE (ENTERPRISE MASTERCLASS)")
    print("=" * 72)
    print(" [1] ANPR Camera Registry Daemon   : Active -> cameras.json")
    print(" [2] Face Recognition Daemon       : Active -> faces.json & clips/")
    print(" [3] Forensic Video Stream Daemon  : Active -> forensics.json & forensics/")
    print("=" * 72)
    print(" Cloud Backend Connection : http://43.204.235.231:8000 (EC2 Direct)")
    print(" Failover Proxy           : https://z-tracs.vercel.app")
    print(" Press Ctrl+C anytime to cleanly stop all background edge services.")
    print("=" * 72 + "\n")

    t_anpr = threading.Thread(target=run_anpr, name="ANPR-Daemon", daemon=True)
    t_frs = threading.Thread(target=run_frs, name="FRS-Daemon", daemon=True)
    t_forensics = threading.Thread(target=run_forensics, name="Forensics-Daemon", daemon=True)

    t_anpr.start()
    time.sleep(0.5)
    t_frs.start()
    time.sleep(0.5)
    t_forensics.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Z-TRACS] Stopping all active edge daemon services cleanly...")
        sys.exit(0)

if __name__ == "__main__":
    main()
