from fastapi import APIRouter, Query
from app.schemas.api_response import ApiResponse
from app.services.camera_service import CameraService

router = APIRouter(prefix="/gis", tags=["Model 1 — PostGIS Spatial Services"])
camera_service = CameraService()

@router.get("/spatial-query")
async def spatial_query(
    lat: float = Query(23.0298),
    lng: float = Query(72.5074),
    radius_km: float = Query(5.0, alias="radiusKm")
):
    nearby_cameras = camera_service.find_cameras_near(lat, lng, radius_km)
    return ApiResponse.ok(nearby_cameras, total_records=len(nearby_cameras))

@router.get("/gaps")
async def gap_analysis():
    return ApiResponse.ok([
        {
            "id": "gap-101",
            "district": "Ahmedabad",
            "locationDescription": "SP Ring Road South Outer Toll Plaza Corridor",
            "reason": "High-Speed Commercial Bypass without ANPR Coverage",
            "suggestedHardware": "ANPR PTZ Radar Combo",
            "estimatedTrafficPerDay": "45,000 Vehicles",
            "priority": "High Priority",
            "status": "Tender Issued",
            "lat": 22.9812,
            "lng": 72.5123,
            "suggestedDepartment": "Gujarat Police (Traffic Division)"
        }
    ])
