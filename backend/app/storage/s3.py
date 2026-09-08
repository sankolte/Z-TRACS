import os
import hashlib
import time
from typing import Optional, Dict, Any, Tuple
from app.core.config import settings

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False
    ClientError = Exception
    NoCredentialsError = Exception

S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME", "ztracs-evidence-vault-dev")
AWS_REGION = os.getenv("AWS_S3_REGION", os.getenv("AWS_REGION", "ap-south-1"))

class S3StorageManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(S3StorageManager, cls).__new__(cls)
            cls._instance.bucket_name = S3_BUCKET_NAME
            cls._instance.region = AWS_REGION
            cls._instance.s3_client = None
            cls._instance._init_client()
        return cls._instance

    def _init_client(self):
        if not HAS_BOTO3:
            print("[S3 INIT WARN] boto3 not installed in python environment. Running in offline/API direct mode.")
            return
        try:

            ak = os.getenv("AWS_ACCESS_KEY_ID")
            sk = os.getenv("AWS_SECRET_ACCESS_KEY")
            if ak and sk:
                self.s3_client = boto3.client(
                    "s3",
                    region_name=self.region,
                    aws_access_key_id=ak,
                    aws_secret_access_key=sk
                )
            else:
                # Use EC2 IAM Role or default environment credentials
                self.s3_client = boto3.client("s3", region_name=self.region)
        except Exception as e:
            print(f"[S3 INIT WARN] Boto3 client init deferred: {e}")
            self.s3_client = None

    def upload_photo(self, person_id: str, photo_bytes: bytes, filename: str = "face_reference.jpg") -> Tuple[str, str, Optional[str]]:
        """
        Uploads reference photo directly to S3 under key:
        frs/targets/{person_id}/face_reference.jpg
        
        Returns:
            s3_key: 'frs/targets/{person_id}/face_reference.jpg'
            version_marker: MD5/ETag or timestamp string
            presigned_url: Pre-signed GET URL (valid for 24 hours) or None
        """
        s3_key = f"frs/targets/{person_id}/{filename}"
        md5_hash = hashlib.md5(photo_bytes).hexdigest()
        version_marker = f"v_{int(time.time())}_{md5_hash[:8]}"
        presigned_url = None

        if self.s3_client:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=photo_bytes,
                    ContentType="image/jpeg",
                    Metadata={
                        "person_id": person_id,
                        "version": version_marker
                    }
                )
                try:
                    presigned_url = self.s3_client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": self.bucket_name, "Key": s3_key},
                        ExpiresIn=86400  # 24 hours
                    )
                except Exception:
                    pass
                print(f"[S3 UPLOAD SUCCESS] Uploaded {len(photo_bytes)} bytes to s3://{self.bucket_name}/{s3_key} (Version: {version_marker})")
                return s3_key, version_marker, presigned_url
            except (ClientError, NoCredentialsError) as e:
                print(f"[S3 UPLOAD ERROR] Falling back to direct API delivery: {e}")

        # Fallback if S3 direct upload is not reachable
        return s3_key, version_marker, None

    def generate_upload_presigned_url(self, s3_key: str, content_type: str = "video/mp4", expires_in: int = 3600) -> Optional[str]:
        """
        Generate a pre-signed S3 PUT URL for direct browser-to-S3 video upload.
        Expires in 1 hour (3600s).
        """
        if self.s3_client:
            try:
                url = self.s3_client.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": self.bucket_name,
                        "Key": s3_key,
                        "ContentType": content_type
                    },
                    ExpiresIn=expires_in
                )
                return url
            except Exception as e:
                print(f"[S3 PRESIGNED UPLOAD WARN] {e}")
        return None

    def generate_streaming_presigned_url(self, s3_key: str, expires_in: int = 86400) -> Optional[str]:
        """
        Generate a long-lived pre-signed S3 GET URL for OpenCV streaming on GPU workers.
        Default expiry: 24 hours (86400s) to support long multi-hour batch video processing.
        """
        if self.s3_client:
            try:
                url = self.s3_client.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": self.bucket_name,
                        "Key": s3_key
                    },
                    ExpiresIn=expires_in
                )
                return url
            except Exception as e:
                print(f"[S3 PRESIGNED STREAM WARN] {e}")
        return None

    def download_photo(self, s3_key: str) -> Optional[bytes]:
        """Fetch raw photo bytes from S3 key."""
        if self.s3_client:
            try:
                res = self.s3_client.get_object(Bucket=self.bucket_name, Key=s3_key)
                return res["Body"].read()
            except Exception as e:
                print(f"[S3 DOWNLOAD ERROR] Failed reading s3://{self.bucket_name}/{s3_key}: {e}")
        return None

s3_storage = S3StorageManager()

