from fastapi import APIRouter
from app.schemas.api_response import ApiResponse
from app.services.vms_service import VmsService

router = APIRouter(prefix="/federation", tags=["Model 3 — Federation Mesh"])
vms_service = VmsService()

@router.get("/overview")
async def federation_overview():
    vms_list = vms_service.get_all_vms()
    connectors = vms_service.get_all_connectors()
    total_cameras = sum(v.get("cameraCount", 0) for v in vms_list)

    return ApiResponse.ok({
        "totalVmsPlatforms": len(vms_list),
        "totalConnectors": len(connectors),
        "activeConnectors": len([c for c in connectors if c.get("status") == "ACTIVE"]),
        "totalFederatedCameras": total_cameras,
        "eventThroughputEvtSec": 1284,
        "dlqFailedEvents": 2,
        "vmsList": vms_list,
        "connectors": connectors
    })

@router.get("/connectors")
async def get_connectors():
    connectors = vms_service.get_all_connectors()
    return ApiResponse.ok(connectors, total_records=len(connectors))
