import hashlib
from datetime import datetime
from typing import Dict, Any, Optional
from app.db.store import UnifiedStore

class EvidenceService:
    def __init__(self):
        self.store = UnifiedStore()

    def create_evidence_item(self, case_id: str, camera_code: str, raw_data: str) -> Dict[str, Any]:
        sha256_hash = hashlib.sha256(raw_data.encode('utf-8')).hexdigest()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
        today_str = datetime.now().strftime("%Y-%m-%d")

        item = {
            "id": f"EVD-{int(datetime.now().timestamp() % 100000)}",
            "caseId": case_id,
            "cameraUuid": f"uuid-{camera_code}",
            "cameraCode": camera_code,
            "timestamp": now_str,
            "eventType": "ANPR Watchlist Frame Snap",
            "sha256Hash": sha256_hash,
            "fileSize": "3.8 MB",
            "verifiedBy": "State SDC Digital Integrity Engine",
            "createdDate": today_str
        }

        for c in self.store.cases:
            if c.get("id") == case_id:
                if "evidenceItems" not in c or c["evidenceItems"] is None:
                    c["evidenceItems"] = []
                c["evidenceItems"].insert(0, item)
                c["evidenceCount"] = len(c["evidenceItems"])
                break

        return item
