"""
Z-TRACS Edge AI Integration Client for OpenCV / InsightFace Team
-----------------------------------------------------------------
How to use in your Edge Camera Inference Loop:
1. Run 'python3 update_frs.py' in background (pm2 daemon) -> downloads suspects & maintains 'faces.json'.
2. Use this module to compare detected faces against 'faces.json' suspects.
3. When similarity >= threshold, call 'send_frs_match(...)'.
"""

import cv2
import base64
import requests
import json
import os
import time
from typing import Optional, Dict, Any, List

# Central Z-TRACS Backend API Endpoint
ZTRACS_FRS_MATCH_URL = "http://43.204.235.231:8000/api/v1/frs/match"

def frame_to_base64(image_crop) -> Optional[str]:
    """Encodes OpenCV face crop numpy array to Base64 JPEG string."""
    if image_crop is None or image_crop.size == 0:
        return None
    h, w = image_crop.shape[:2]
    if w > 480:
        image_crop = cv2.resize(image_crop, (480, int(h * 480 / w)))

    success, buffer = cv2.imencode('.jpg', image_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not success:
        return None
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{encoded}"

def send_frs_match(
    person_id: str,
    camera_code: str,
    camera_name: str,
    district: str = "Ahmedabad",
    similarity: float = 0.85,
    crop_frame = None,
    bounding_box: Optional[List[int]] = None,
    notes: Optional[str] = None
) -> bool:
    """
    Call this function whenever OpenCV / InsightFace detects an enrolled suspect.
    - Saves match event in AWS RDS PostgreSQL 'frs_matches'.
    - Uploads CCTV face crop to S3 bucket.
    - Fires immediate high-priority WebSocket siren & visual alarm in Police Dashboard.
    """
    snapshot_b64 = frame_to_base64(crop_frame) if crop_frame is not None else None

    payload = {
        "person_id": person_id.strip().upper(),
        "camera_code": camera_code,
        "camera_name": camera_name,
        "district": district,
        "similarity": round(float(similarity), 4),
        "snapshot": snapshot_b64,
        "bounding_box": bounding_box,
        "notes": notes or f"Suspect {person_id} detected at {camera_name} ({similarity*100:.1f}% match)."
    }

    try:
        res = requests.post(ZTRACS_FRS_MATCH_URL, json=payload, timeout=4.0)
        if res.status_code == 200:
            data = res.json()
            print(f"🚨 [FRS ALERT SENT] Suspect: {person_id} at {camera_name} -> {similarity*100:.1f}% match!")
            return True
        else:
            print(f"⚠️ [FRS API WARN] Server responded {res.status_code}: {res.text}")
            return False
    except Exception as e:
        print(f"❌ [FRS NETWORK ERROR] Could not connect to Z-TRACS server: {e}")
        return False

# =====================================================================
# EXAMPLE USAGE (For OpenCV Developer Team)
# =====================================================================
if __name__ == "__main__":
    import numpy as np

    print("Simulating OpenCV Face Detection & Match...")
    # Create dummy face crop
    dummy_face = np.zeros((160, 160, 3), dtype=np.uint8)
    cv2.putText(dummy_face, "FACE", (40, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

    # Ingest detection
    send_frs_match(
        person_id="TGT-GJ-001",
        camera_code="CAM-001",
        camera_name="Chiman Bhai Bridge Junction",
        district="Ahmedabad",
        similarity=0.915,
        crop_frame=dummy_face,
        bounding_box=[100, 80, 260, 240],
        notes="Suspect matched with 91.5% confidence on camera stream."
    )
