# Celery Application Configuration
class CeleryStubApp:
    def __init__(self):
        self.name = "ztracs_celery_queue"
        self.broker = "redis://localhost:6379/0"
        self.backend = "redis://localhost:6379/1"

celery_app = CeleryStubApp()
