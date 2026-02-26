import boto3
from botocore.client import Config
import os

R2_AccountId = os.getenv("R2_ACCOUNT_ID")
R2_AccessKeyId = os.getenv("R2_ACCESS_KEY_ID")
R2_SecretAccessKey = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BucketName = os.getenv("R2_BUCKET_NAME")

s3_client = boto3.client(
    's3',
    endpoint_url=f'https://{R2_AccountId}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_AccessKeyId,
    aws_secret_access_key=R2_SecretAccessKey,
    config=Config(signature_version='s3v4')
)

def generate_presigned_url(object_key, expiration=300):
    try:
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': R2_BucketName,
                                                            'Key': object_key},
                                                    ExpiresIn=expiration)
        return response
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return None
