from fastapi import APIRouter
from app.schemas.api_response import ApiResponse
from app.db.store import UnifiedStore

router = APIRouter(prefix="/events", tags=["Model 3 — Event Backbone"])

@router.get("/pipeline")
async def event_pipeline():
    store = UnifiedStore()
    return ApiResponse.ok(store.canonical_events, total_records=len(store.canonical_events))

@router.get("/dlq")
async def get_dlq_records():
    return ApiResponse.ok([
        {
            "dlqId": "dlq-1001",
            "eventId": "evt-failed-9912",
            "failedTimestamp": "2026-08-20 10:12:00 IST",
            "retryCount": 3,
            "lastErrorReason": "HTTP 504 Gateway Timeout during enrichment webhook query",
            "sourceVmsId": "VMS-GEN-02",
            "connectorId": "conn-genetec-rest-v2",
            "rawPayload": {"plate": "GJ01AB1234", "rawTime": "10:12:00"},
            "status": "FAILED"
        }
    ])

@router.post("/dlq/{dlq_id}/replay")
async def replay_dlq_event(dlq_id: str):
    return ApiResponse.ok({"message": f"Event {dlq_id} successfully reprocessed into Kafka topic 'vms.events'", "status": "REPLAYED"})
