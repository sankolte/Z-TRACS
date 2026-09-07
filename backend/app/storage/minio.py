import hashlib
from datetime import datetime
from typing import Dict, Any

class MinIOStorageClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MinIOStorageClient, cls).__new__(cls)
            cls._instance.bucket_name = "ztracs-evidence-vault"
        return cls._instance

    async def upload_evidence_snapshot(self, case_id: str, camera_code: str, file_bytes: bytes) -> Dict[str, Any]:
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        file_key = f"cases/{case_id}/{camera_code}_{int(datetime.now().timestamp())}.jpg"
        object_url = f"https://s3.sdc.gujarat.gov.in/{self.bucket_name}/{file_key}"

        return {
            "bucket": self.bucket_name,
            "objectKey": file_key,
            "objectUrl": object_url,
            "sha256Hash": sha256_hash,
            "fileSizeBytes": len(file_bytes),
            "uploadedAt": datetime.now().isoformat()
        }

minio_client = MinIOStorageClient()
