import boto3
from botocore.client import Config
import os

# Configuration
R2_AccountId = os.getenv("R2_ACCOUNT_ID")
R2_AccessKeyId = os.getenv("R2_ACCESS_KEY_ID")
R2_SecretAccessKey = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BucketName = os.getenv("R2_BUCKET_NAME")

# Initialize S3 Client (Cloudflare R2 compatible)
s3_client = boto3.client(
    's3',
    endpoint_url=f'https://{R2_AccountId}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_AccessKeyId,
    aws_secret_access_key=R2_SecretAccessKey,
    config=Config(signature_version='s3v4')
)

def generate_presigned_url(object_key, expiration=300):
    """
    Generate a presigned URL to share an S3 object (Reference Audio)
    with the RunPod worker securely.
    
    :param object_key: The path to the file in R2 (e.g., 'u-123/ref.wav')
    :param expiration: Time in seconds for the URL to remain valid (default 300s)
    :return: Presigned URL as string
    """
    try:
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': R2_BucketName,
                                                            'Key': object_key},
                                                    ExpiresIn=expiration)
        return response
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return None

def generate_upload_url(object_key, expiration=300):
    """
    Generate a presigned URL for the Client to upload their Reference Audio directly.
    """
    try:
        response = s3_client.generate_presigned_url('put_object',
                                                    Params={'Bucket': R2_BucketName,
                                                            'Key': object_key},
                                                    ExpiresIn=expiration)
        return response
    except Exception as e:
        print(f"Error generating upload URL: {e}")
        return None

# --- R2 CORS POLICY (Apply this in Cloudflare Dashboard) ---
"""
[
  {
    "AllowedOrigins": [
      "https://your-hostinger-domain.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
"""
