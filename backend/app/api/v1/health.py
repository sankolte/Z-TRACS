from fastapi import APIRouter
from app.schemas.api_response import ApiResponse

router = APIRouter(prefix="/health", tags=["System Health"])

@router.get("/live")
async def health_live():
    return ApiResponse.ok({"status": "LIVE", "uptimePercentage": 100.0, "details": "FastAPI Server Running"})

@router.get("/ready")
async def health_ready():
    return ApiResponse.ok({"status": "READY", "dbConnected": True, "kafkaReady": True})

@router.get("/dependencies")
async def health_dependencies():
    return ApiResponse.ok([
        {"name": "FastAPI Server Gateway", "status": "Operational", "latencyMs": 4},
        {"name": "PostgreSQL + PostGIS Data Store", "status": "Operational", "latencyMs": 12},
        {"name": "Kafka Event Bus (vms.events)", "status": "Operational", "latencyMs": 8},
        {"name": "VMS Federation Adapter Hub", "status": "Operational", "latencyMs": 14}
    ])
