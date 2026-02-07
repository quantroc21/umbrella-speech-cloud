import os
import time
import boto3
import sys
from pathlib import Path
from botocore.exceptions import NoCredentialsError

# Configuration
MOUNT_POINT = Path("/runpod-volume")
CACHE_DIRS = [MOUNT_POINT / ".cache" / "torch", MOUNT_POINT / ".cache" / "triton"]

# S3 Config (Using _NETWORK suffix as per user setup)
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY_ID_NETWORK")
S3_SECRET_KEY = os.getenv("S3_SECRET_ACCESS_KEY_NETWORK")
S3_ENDPOINT = os.getenv("S3_ENDPOINT_URL_NETWORK")
S3_BUCKET = os.getenv("S3_BUCKET_NAME_NETWORK")

def get_s3_client():
    if not all([S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_BUCKET]):
        print("[Sync] Missing S3 Network Credentials. Sync disabled.")
        return None
    
    return boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        endpoint_url=S3_ENDPOINT,
    )

def download_dir(client, prefix, local_dir):
    """Download s3://bucket/prefix to local_dir"""
    paginator = client.get_paginator('list_objects_v2')
    for result in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        if 'Contents' not in result:
            continue
            
        for obj in result['Contents']:
            key = obj['Key']
            # Skip if directory placeholder
            if key.endswith('/'):
                continue
                
            rel_path = key[len(prefix):].lstrip('/')
            local_path = local_dir / rel_path
            
            # Skip if local file is newer/same size
            if local_path.exists():
                if local_path.stat().st_size == obj['Size']:
                    continue # Simple size check for speed
            
            # Download
            local_path.parent.mkdir(parents=True, exist_ok=True)
            print(f"[Sync] Downloading {key} -> {local_path}")
            try:
                client.download_file(S3_BUCKET, key, str(local_path))
            except Exception as e:
                print(f"[Sync] Error downloading {key}: {e}")

def upload_dir(client, local_dir, prefix):
    """Upload local_dir to s3://bucket/prefix"""
    if not local_dir.exists():
        return

    for root, _, files in os.walk(local_dir):
        for file in files:
            local_path = Path(root) / file
            rel_path = local_path.relative_to(local_dir)
            s3_key = f"{prefix}/{rel_path}".replace("\\", "/") # Ensure forward slashes
            
            # Upload
            # Note: For efficiency in a loop, we might want to check existence, 
            # but blindly uploading small cache files is usually fine for this use case.
            # A more robust solution would check LastModified.
            # print(f"[Sync] Uploading {local_path} -> {s3_key}")
            try:
                client.upload_file(str(local_path), S3_BUCKET, s3_key)
            except Exception as e:
                print(f"[Sync] Error uploading {local_path}: {e}")

def restore():
    client = get_s3_client()
    if not client: return

    print("[Sync] Restoring cache from S3...")
    # Assume S3 structure mirrors local: .cache/torch -> s3://bucket/.cache/torch
    download_dir(client, ".cache/torch", MOUNT_POINT / ".cache" / "torch")
    download_dir(client, ".cache/triton", MOUNT_POINT / ".cache" / "triton")
    print("[Sync] Restore complete.")

def backup():
    client = get_s3_client()
    if not client: return

    # print("[Sync] Backing up cache to S3...") 
    # Use quiet backup to not spam logs
    upload_dir(client, MOUNT_POINT / ".cache" / "torch", ".cache/torch")
    upload_dir(client, MOUNT_POINT / ".cache" / "triton", ".cache/triton")

def monitor():
    print("[Sync] Starting Background Sync Monitor (Every 60s)...")
    while True:
        time.sleep(60)
        try:
            backup()
        except Exception as e:
            print(f"[Sync] Backup failed: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cache_sync.py [restore|monitor]")
        sys.exit(1)
        
    mode = sys.argv[1]
    if mode == "restore":
        restore()
    elif mode == "monitor":
        monitor()
    else:
        print(f"Unknown mode: {mode}")
