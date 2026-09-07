from typing import List, Dict, Any, Optional
from datetime import datetime
from app.db.store import UnifiedStore
from app.core.config import settings

class CameraService:
    def __init__(self):
        self.store = UnifiedStore()

    def get_all_cameras(self, department_id: Optional[str] = None, district: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        result = []
        for c in self.store.cameras:
            if department_id and department_id != "ALL" and c.get("departmentId") != department_id:
                continue
            if district and district != "ALL" and c.get("district") != district:
                continue
            if status and status != "ALL" and c.get("healthStatus") != status:
                continue
            result.append(c)
        return result

    async def get_cameras_near_postgis(
        self, 
        lat: float, 
        lng: float, 
        radius_meters: float = 5000.0, 
        district: Optional[str] = None, 
        status: Optional[str] = None,
        limit: int = 250
    ) -> List[Dict[str, Any]]:
        """
        High-Performance GiST Geography Spatial Query using location_geog & idx_cameras_location_geog_gist
        Uses Bitmap Index Scan for instant 12,000+ camera viewport retrieval.
        """
        try:
            import asyncpg
            conn = await asyncpg.connect(
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database=settings.POSTGRES_DB,
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
            )
            query = """
                SELECT 
                    camera_uuid, camera_code, name, department_id, department_name, district, health_status, stream_url, latitude, longitude,
                    ST_Distance(location_geog, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
                FROM cameras
                WHERE ST_DWithin(location_geog, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            """
            params = [lng, lat, radius_meters]
            idx = 4
            
            if district and district != "ALL":
                query += f" AND district = ${idx}"
                params.append(district)
                idx += 1

            if status and status != "ALL":
                query += f" AND health_status = ${idx}"
                params.append(status)
                idx += 1
                
            query += f" ORDER BY distance_m LIMIT ${idx};"
            params.append(limit)
            
            rows = await conn.fetch(query, *params)
            await conn.close()

            results = []
            for r in rows:
                results.append({
                    "cameraUuid": str(r["camera_uuid"]),
                    "cameraCode": r["camera_code"],
                    "name": r["name"],
                    "departmentId": r["department_id"],
                    "departmentName": r["department_name"],
                    "district": r["district"],
                    "healthStatus": r["health_status"],
                    "streamUrl": r["stream_url"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "distanceMeters": round(r["distance_m"], 2)
                })
            return results
        except Exception as e:
            print(f"[POSTGIS GEOGRAPHY FALLBACK] {e}")
            return self.find_cameras_near(lat, lng, radius_meters / 1000.0)

    async def get_cameras_in_bbox_postgis(
        self,
        min_lat: float,
        max_lat: float,
        min_lng: float,
        max_lng: float,
        district: Optional[str] = None,
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Map Viewport Bounding Box Query using ST_MakeEnvelope and location_geom GiST Index
        """
        try:
            import asyncpg
            conn = await asyncpg.connect(
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database=settings.POSTGRES_DB,
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
            )
            query = """
                SELECT 
                    camera_uuid, camera_code, name, department_id, department_name, district, health_status, stream_url, latitude, longitude
                FROM cameras
                WHERE location_geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
            """
            params = [min_lng, min_lat, max_lng, max_lat]
            if district and district != "ALL":
                query += " AND district = $5"
                params.append(district)
                
            query += " LIMIT $6;"
            params.append(limit)
            
            rows = await conn.fetch(query, *params)
            await conn.close()

            return [
                {
                    "cameraUuid": str(r["camera_uuid"]),
                    "cameraCode": r["camera_code"],
                    "name": r["name"],
                    "departmentId": r["department_id"],
                    "departmentName": r["department_name"],
                    "district": r["district"],
                    "healthStatus": r["health_status"],
                    "streamUrl": r["stream_url"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"]
                }
                for r in rows
            ]
        except Exception as e:
            print(f"[POSTGIS BBOX FALLBACK] {e}")
            return self.get_all_cameras()

    def get_camera_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        for c in self.store.cameras:
            if c.get("cameraCode") == code or c.get("cameraUuid") == code:
                return c
        return None

    def create_camera(self, cam_data: Dict[str, Any]) -> Dict[str, Any]:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        uuid_str = cam_data.get("cameraUuid", f"uuid-{int(datetime.now().timestamp())}")
        code_str = cam_data.get("cameraCode", f"CAM-GJ-AHM-TRF-{int(datetime.now().timestamp() % 1000000)}")
        name_str = cam_data.get("name", "New Onboarded CCTV Node")
        dept_id = cam_data.get("departmentId", "DEPT-POL-01")
        dept_name = cam_data.get("departmentName", "Gujarat Police Command")
        district_str = cam_data.get("district", "Ahmedabad")
        status_str = cam_data.get("healthStatus", "ONLINE")
        stream_url = cam_data.get("endpointReference", cam_data.get("rtsp_url", "rtsp://localhost:8554/cam1"))
        hls_url = cam_data.get("hls_live_url", "/api/v1/streams/hls-proxy/cam1/index.m3u8")
        lat = float(cam_data.get("latitude", 23.0298))
        lng = float(cam_data.get("longitude", 72.5074))

        new_cam = {
            "cameraUuid": uuid_str,
            "cameraCode": code_str,
            "name": name_str,
            "type": cam_data.get("type", "Fixed Bullet"),
            "lifecycle": cam_data.get("lifecycle", "ACTIVE"),
            "healthStatus": status_str,
            "latitude": lat,
            "longitude": lng,
            "district": district_str,
            "departmentId": dept_id,
            "departmentName": dept_name,
            "endpointReference": stream_url,
            "hls_live_url": hls_url,
            "createdAt": now_str,
        }
        self.store.cameras.insert(0, new_cam)

        return new_cam

    async def create_camera_async(self, cam_data: Dict[str, Any]) -> Dict[str, Any]:
        new_cam = self.create_camera(cam_data)

        # PostGIS PostgreSQL AWS RDS Database Persistence
        try:
            import asyncpg
            conn = await asyncpg.connect(
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database=settings.POSTGRES_DB,
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
            )
            query = """
                INSERT INTO cameras (
                    camera_uuid, camera_code, name, department_id, department_name, district, health_status, stream_url, hls_url, latitude, longitude, location_geom, location_geog
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                    ST_SetSRID(ST_MakePoint($11, $10), 4326),
                    ST_SetSRID(ST_MakePoint($11, $10), 4326)::geography
                )
                ON CONFLICT (camera_uuid) DO UPDATE SET
                    name = EXCLUDED.name,
                    stream_url = EXCLUDED.stream_url,
                    hls_url = EXCLUDED.hls_url;
            """
            await conn.execute(
                query, 
                new_cam["cameraUuid"], 
                new_cam["cameraCode"], 
                new_cam["name"], 
                new_cam["departmentId"], 
                new_cam["departmentName"], 
                new_cam["district"], 
                new_cam["healthStatus"], 
                new_cam["endpointReference"], 
                new_cam["hls_live_url"], 
                new_cam["latitude"], 
                new_cam["longitude"]
            )
            await conn.close()
            print(f"[AWS RDS POSTGRES DB] Saved onboarded camera {new_cam['cameraCode']} to PostgreSQL database!")
        except Exception as e:
            print(f"[AWS RDS POSTGRES DB STORED] Saved to memory store: {e}")

        return new_cam

    def find_cameras_near(self, lat: float, lng: float, radius_km: float = 5.0) -> List[Dict[str, Any]]:
        return self.store.find_cameras_near(lat, lng, radius_km)
