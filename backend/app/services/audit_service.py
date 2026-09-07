from datetime import datetime
from typing import List, Dict, Any, Optional
from app.db.store import UnifiedStore

class AuditService:
    def __init__(self):
        self.store = UnifiedStore()

    def log_action(
        self,
        user_name: str,
        badge: str,
        role: str,
        avatar: str,
        action: str,
        resource: str,
        district: str,
        diff_payload: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        log_entry = {
            "id": f"aud-{int(datetime.now().timestamp() % 10000)}",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "user": {
                "name": user_name,
                "badge": badge,
                "role": role,
                "avatar": avatar
            },
            "action": action,
            "resource": resource,
            "district": district,
            "result": "Success",
            "ip": "10.142.1.25 (State WAN)",
            "diffPayload": diff_payload or []
        }
        self.store.audit_logs.insert(0, log_entry)
        return log_entry

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        return self.store.audit_logs
