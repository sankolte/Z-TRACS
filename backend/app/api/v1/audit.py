from fastapi import APIRouter
from app.schemas.api_response import ApiResponse
from app.db.store import UnifiedStore

router = APIRouter(prefix="/audit", tags=["Model 1 — Statewide Audit Ledger"])

@router.get("/logs")
async def get_audit_logs():
    store = UnifiedStore()
    return ApiResponse.ok(store.audit_logs, total_records=len(store.audit_logs))
