from typing import List, Dict, Any, Optional
from app.db.store import UnifiedStore

class OpenSearchClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OpenSearchClient, cls).__new__(cls)
            cls._instance.store = UnifiedStore()
        return cls._instance

    async def search_plates(self, query: str, district: Optional[str] = None) -> List[Dict[str, Any]]:
        # OpenSearch Full-Text Fuzzy Plate Search
        results = []
        q_clean = query.upper().strip()
        for evt in self.store.anpr_events:
            plate = evt.get("plateNumber", "").upper()
            if q_clean in plate:
                if district and district != "ALL" and evt.get("district") != district:
                    continue
                results.append(evt)
        return results

opensearch_client = OpenSearchClient()
