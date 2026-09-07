from typing import List, Dict, Any
from app.db.store import UnifiedStore

class PostgresEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PostgresEngine, cls).__new__(cls)
            cls._instance.store = UnifiedStore()
        return cls._instance

    def execute_postgis_spatial_query(self, lat: float, lng: float, radius_km: float) -> List[Dict[str, Any]]:
        # PostGIS SQL equivalent:
        # SELECT * FROM cameras WHERE ST_DWithin(geom, ST_MakePoint(:lng, :lat)::geography, :radius_meters);
        return self.store.find_cameras_near(lat, lng, radius_km)

postgres_db = PostgresEngine()
