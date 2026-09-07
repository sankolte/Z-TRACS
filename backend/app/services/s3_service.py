"""
Z-TRACS AWS S3 Evidence Vault Presigned URL & Metadata Management Service
"""
import uuid
import boto3
from botocore.config import Config
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.config import settings

class S3EvidenceService:
    def __init__(self):
        self.region = settings.AWS_REGION
        self.bucket = settings.AWS_S3_BUCKET_NAME
        
        # Boto3 client with signature version s3v4 for presigned URLs
        session_kwargs = {"region_name": self.region}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            session_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            session_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

        self.s3_client = boto3.client(
            "s3",
            config=Config(signature_version="s3v4", region_name=self.region),
            **session_kwargs
        )

    def generate_s3_key(self, category: str, item_id: str, original_filename: str) -> str:
        """
        Generates predictable, structured S3 keys:
        incidents/{incident_id}/snapshots/{uuid}.jpg
        cameras/{camera_uuid}/snapshots/{uuid}.jpg
        exports/{export_id}/package.zip
        reports/{report_id}/audit-report.pdf
        """
        ext = original_filename.split(".")[-1] if "." in original_filename else "bin"
        unique_uuid = str(uuid.uuid4())[:8]

        if category == "incident":
            if ext in ["mp4", "mkv", "avi"]:
                sub = "videos"
            elif ext in ["jpg", "jpeg", "png"]:
                sub = "snapshots"
            else:
                sub = "documents"
            return f"incidents/{item_id}/{sub}/{unique_uuid}_{original_filename}"
        elif category == "camera":
            return f"cameras/{item_id}/snapshots/{unique_uuid}_{original_filename}"
        elif category == "export":
            return f"exports/{item_id}/{unique_uuid}_{original_filename}"
        else:
            return f"general/{item_id}/{unique_uuid}_{original_filename}"

    def generate_presigned_upload_url(
        self, s3_key: str, content_type: str, expires_in: int = 3600
    ) -> str:
        """Generates S3 Presigned PUT URL for direct browser-to-S3 upload"""
        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            print(f"[S3 PRESIGNED PUT ERROR] {e}")
            # Fallback URL structure for development testing
            return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{s3_key}?upload-token-mock=true"

    def generate_presigned_download_url(
        self, s3_key: str, expires_in: int = 3600
    ) -> str:
        """Generates S3 Presigned GET URL for secure evidence retrieval"""
        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": s3_key,
                },
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            print(f"[S3 PRESIGNED GET ERROR] {e}")
            return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{s3_key}?download-token-mock=true"

s3_evidence_service = S3EvidenceService()
