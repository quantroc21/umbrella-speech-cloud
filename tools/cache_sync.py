import os
import time
import boto3
import sys
import re
from pathlib import Path
from botocore.exceptions import NoCredentialsError
from botocore.config import Config

# Configuration
MOUNT_POINT = Path("/runpod-volume")
CACHE_DIRS = [MOUNT_POINT / ".cache" / "torch", MOUNT_POINT / ".cache" / "triton"]

# S3 Config (Using _NETWORK suffix as per user setup)
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY_ID_NETWORK")
S3_SECRET_KEY = os.getenv("S3_SECRET_ACCESS_KEY_NETWORK")
S3_ENDPOINT = os.getenv("S3_ENDPOINT_URL_NETWORK")
S3_BUCKET = os.getenv("S3_BUCKET_NAME_NETWORK")

def get_region_from_endpoint(endpoint):
    """Extract region from RunPod endpoint like https://s3api-eu-ro-1.runpod.io"""
    if not endpoint:
        return "us-east-1"
    
    match = re.search(r"s3api-([a-z0-9-]+)\.runpod\.io", endpoint)
    if match:
        return match.group(1)
    
    return "us-east-1" 

def get_s3_client():
    if not all([S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_BUCKET]):
        print("[Sync] Missing S3 Network Credentials. Sync disabled.", flush=True)
        return None
    
    region = get_region_from_endpoint(S3_ENDPOINT)
    print(f"[Sync] Connecting to S3 Endpoint: {S3_ENDPOINT} (Region: {region})", flush=True)

    # TIMEOUT & ADDRESSING CONFIG
    # FIX: RunPod S3 often requires PATH style (endpoint/bucket) not VIRTUAL HOST style (bucket.endpoint)
    # The hang was likely DNS failing to resolve bucket.endpoint
    config = Config(
        connect_timeout=10, 
        read_timeout=60,
        retries={'max_attempts': 3},
        s3={'addressing_style': 'path'}
    )

    return boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        endpoint_url=S3_ENDPOINT,
        region_name=region,
        config=config
    )

def download_dir(client, prefix, local_dir):
    paginator = client.get_paginator('list_objects_v2')
    try:
        # Check if bucket is accessible first
        print(f"[Sync] I am about to list objects in bucket '{S3_BUCKET}' with prefix '{prefix}'...", flush=True)
        
        for result in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
            if 'Contents' not in result:
                continue
                
            for obj in result['Contents']:
                key = obj['Key']
                if key.endswith('/'):
                    continue
                    
                rel_path = key[len(prefix):].lstrip('/')
                local_path = local_dir / rel_path
                
                if local_path.exists():
                    if local_path.stat().st_size == obj['Size']:
                        continue 
                
                local_path.parent.mkdir(parents=True, exist_ok=True)
                print(f"[Sync] Downloading {key} -> {local_path}", flush=True)
                try:
                    client.download_file(S3_BUCKET, key, str(local_path))
                except Exception as e:
                    print(f"[Sync] Error downloading {key}: {e}", flush=True)
    except Exception as e:
        print(f"[Sync] Error listing objects (Is bucket empty or access denied?): {e}", flush=True)

def upload_dir(client, local_dir, prefix):
    if not local_dir.exists():
        return

    for root, _, files in os.walk(local_dir):
        for file in files:
            local_path = Path(root) / file
            rel_path = local_path.relative_to(local_dir)
            s3_key = f"{prefix}/{rel_path}".replace("\\", "/") 
            
            try:
                client.upload_file(str(local_path), S3_BUCKET, s3_key)
            except Exception as e:
                print(f"[Sync] Error uploading {local_path}: {e}", flush=True)

def restore():
    client = get_s3_client()
    if not client: return

    print("[Sync] Restoring cache from S3...", flush=True)
    download_dir(client, ".cache/torch", MOUNT_POINT / ".cache" / "torch")
    download_dir(client, ".cache/triton", MOUNT_POINT / ".cache" / "triton")
    print("[Sync] Restore complete.", flush=True)

def backup():
    client = get_s3_client()
    if not client: return

    upload_dir(client, MOUNT_POINT / ".cache" / "torch", ".cache/torch")
    upload_dir(client, MOUNT_POINT / ".cache" / "triton", ".cache/triton")

def monitor():
    print("[Sync] Starting Background Sync Monitor (Every 60s)...", flush=True)
    while True:
        time.sleep(60)
        try:
            backup()
        except Exception as e:
            print(f"[Sync] Backup failed: {e}", flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cache_sync.py [restore|monitor]", flush=True)
        sys.exit(1)
        
    mode = sys.argv[1]
    if mode == "restore":
        restore()
    elif mode == "monitor":
        monitor()
    else:
        print(f"Unknown mode: {mode}", flush=True)
