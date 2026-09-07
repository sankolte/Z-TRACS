from fastapi import APIRouter
from pydantic import BaseModel
from app.schemas.api_response import ApiResponse
from app.db.store import UnifiedStore
from app.services.evidence_service import EvidenceService

router = APIRouter(prefix="/cases", tags=["Model 2 — Investigations & SHA-256 Evidence"])
evidence_service = EvidenceService()

class EvidenceCreateRequest(BaseModel):
    caseId: str = "CASE-2026-000928"
    cameraCode: str = "CAM-GJ-AHM-TRF-000001"
    rawData: str = "ANPR_SNAPSHOT_FRAME_DATA_GJ01AB1234_TIMESTAMP_103241"

@router.get("")
async def get_cases():
    store = UnifiedStore()
    return ApiResponse.ok(store.cases, total_records=len(store.cases))

@router.post("/evidence")
async def create_evidence(req: EvidenceCreateRequest):
    item = evidence_service.create_evidence_item(req.caseId, req.cameraCode, req.rawData)
    return ApiResponse.ok(item)
