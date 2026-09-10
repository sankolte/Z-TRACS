import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)

for path in [root_dir, backend_dir, current_dir]:
    if path not in sys.path:
        sys.path.insert(0, path)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from app.core.config import settings
from app.api.v1.router import api_v1_router
from app.api.v1.health import router as health_router
from app.websockets.manager import ws_manager
from app.core.telemetry import telemetry
from app.search.opensearch import opensearch_client
from app.storage.minio import minio_client
from app.schemas.api_response import ApiResponse
from app.db.anpr_db import ensure_all_anpr_tables
from app.db.frs_db import ensure_all_frs_tables

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Unified Production Backend Platform for Z-TRACS Model 1 (Registry/GIS), Model 2 (Viewing/Analytics), and Model 3 (VMS Federation)",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Frontend React/Vite client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    """Create RDS tables on server start if they don't exist."""
    await ensure_all_anpr_tables()
    await ensure_all_frs_tables()


# Mount Routers
app.include_router(api_v1_router)
app.include_router(health_router)

# Real-Time WebSocket Endpoint
@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "PONG", "message": "Z-TRACS Real-Time WebSockets Active", "received": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# Prometheus Observability Metrics Endpoint
@app.get("/metrics", response_class=PlainTextResponse, tags=["Observability & Metrics"])
async def metrics():
    return telemetry.export_metrics_text()

# OpenSearch High-Throughput Search Endpoint
@app.get("/api/v1/search/plates", tags=["OpenSearch Full-Text Search"])
async def search_plates(q: str = Query(...), district: str = Query(None)):
    results = await opensearch_client.search_plates(q, district)
    return ApiResponse.ok(results, total_records=len(results))

# MinIO / S3 Evidence Storage Upload Endpoint
@app.post("/api/v1/storage/evidence", tags=["MinIO Object Storage Vault"])
async def upload_evidence(case_id: str = Query(...), camera_code: str = Query(...), file: UploadFile = File(...)):
    content = await file.read()
    res = await minio_client.upload_evidence_snapshot(case_id, camera_code, content)
    return ApiResponse.ok(res)

@app.get("/")
async def root():
    return {
        "status": "OPERATIONAL",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "swaggerDocs": "/docs",
        "healthEndpoint": "/health/live",
        "prometheusMetrics": "/metrics",
        "webSocketAlerts": "/ws/alerts"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
