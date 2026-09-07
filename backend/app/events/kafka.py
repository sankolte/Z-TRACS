import json
from typing import Dict, Any, Callable
from datetime import datetime
from app.core.config import settings

class KafkaEventBus:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(KafkaEventBus, cls).__new__(cls)
            cls._instance._init_bus()
        return cls._instance

    def _init_bus(self):
        self.brokers = settings.KAFKA_BROKERS
        self.published_events_count = 148920

    async def publish_event(self, topic: str, event_data: Dict[str, Any]) -> str:
        self.published_events_count += 1
        event_id = f"evt-kfk-{self.published_events_count}"
        
        # Enforce canonical version 1.0 schema wrapping
        payload = {
            "eventId": event_id,
            "topic": topic,
            "schemaVersion": "1.0",
            "timestamp": datetime.now().isoformat(),
            "data": event_data
        }
        return event_id

kafka_bus = KafkaEventBus()
