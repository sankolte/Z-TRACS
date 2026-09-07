import json
from typing import Optional, Any
from app.core.config import settings

class RedisCacheManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisCacheManager, cls).__new__(cls)
            cls._instance._init_cache()
        return cls._instance

    def _init_cache(self):
        self._memory_cache = {}

    async def get(self, key: str) -> Optional[str]:
        return self._memory_cache.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        if isinstance(value, (dict, list)):
            val_str = json.dumps(value)
        else:
            val_str = str(value)
        self._memory_cache[key] = val_str

    async def delete(self, key: str):
        if key in self._memory_cache:
            del self._memory_cache[key]

redis_client = RedisCacheManager()
