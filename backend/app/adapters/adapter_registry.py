from typing import Dict, Optional, List
from app.adapters.base_adapter import BaseVMSAdapter
from app.adapters.onvif_adapter import OnvifRtspAdapter
from app.adapters.genetec_adapter import GenetecRestAdapter

class AdapterRegistry:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AdapterRegistry, cls).__new__(cls)
            cls._instance._init_registry()
        return cls._instance

    def _init_registry(self):
        self._adapters: Dict[str, BaseVMSAdapter] = {}
        
        onvif = OnvifRtspAdapter()
        genetec = GenetecRestAdapter()
        
        self._adapters[onvif.vms_id] = onvif
        self._adapters[genetec.vms_id] = genetec

    def get_adapter(self, vms_id: str) -> Optional[BaseVMSAdapter]:
        return self._adapters.get(vms_id)

    def get_all_adapters(self) -> List[BaseVMSAdapter]:
        return list(self._adapters.values())
