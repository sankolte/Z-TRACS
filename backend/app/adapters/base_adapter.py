from abc import ABC, abstractmethod
from typing import List, Dict, Any, Callable

class BaseVMSAdapter(ABC):
    @property
    @abstractmethod
    def vms_id(self) -> str:
        pass

    @property
    @abstractmethod
    def vendor(self) -> str:
        pass

    @property
    @abstractmethod
    def protocol(self) -> str:
        pass

    @property
    @abstractmethod
    def adapter_version(self) -> str:
        pass

    @abstractmethod
    async def connect(self) -> bool:
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        pass

    @abstractmethod
    async def discover_cameras(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_stream_endpoint(self, camera_code: str) -> Dict[str, str]:
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        pass
