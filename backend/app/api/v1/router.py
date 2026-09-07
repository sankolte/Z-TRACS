from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.gis import router as gis_router
from app.api.v1.vms import router as vms_router
from app.api.v1.vehicle import router as vehicle_router
from app.api.v1.cases import router as cases_router
from app.api.v1.federation import router as federation_router
from app.api.v1.events import router as events_router
from app.api.v1.audit import router as audit_router
from app.api.v1.health import router as health_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.anpr import router as anpr_router
from app.api.v1.frs import router as frs_router
from app.api.v1.forensics import router as forensics_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(cameras_router)
api_v1_router.include_router(gis_router)
api_v1_router.include_router(vms_router)
api_v1_router.include_router(vehicle_router)
api_v1_router.include_router(cases_router)
api_v1_router.include_router(federation_router)
api_v1_router.include_router(events_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(health_router)
api_v1_router.include_router(evidence_router)
api_v1_router.include_router(anpr_router)
api_v1_router.include_router(frs_router)
api_v1_router.include_router(forensics_router)
