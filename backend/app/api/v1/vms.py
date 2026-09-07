from fastapi import APIRouter, HTTPException
from app.schemas.api_response import ApiResponse
from app.services.vms_service import VmsService

router = APIRouter(prefix="/vms", tags=["Model 3 — VMS Control Plane"])
vms_service = VmsService()

@router.get("")
async def get_all_vms():
    vms_list = vms_service.get_all_vms()
    return ApiResponse.ok(vms_list, total_records=len(vms_list))

@router.get("/{vms_id}")
async def get_vms_by_id(vms_id: str):
    vms = vms_service.get_vms_by_id(vms_id)
    if not vms:
        raise HTTPException(status_code=404, detail=f"VMS platform '{vms_id}' not found")
    return ApiResponse.ok(vms)

@router.post("/{vms_id}/test")
async def test_vms_connection(vms_id: str):
    res = await vms_service.test_vms_connection(vms_id)
    return ApiResponse.ok(res)

@router.post("/{vms_id}/discover")
async def discover_cameras(vms_id: str):
    cams = await vms_service.discover_cameras(vms_id)
    return ApiResponse.ok(cams, total_records=len(cams))
