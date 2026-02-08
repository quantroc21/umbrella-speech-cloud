import os
import time
import boto3
import sys
import re
import subprocess
import shutil
from pathlib import Path
from botocore.exceptions import NoCredentialsError, ClientError
from botocore.config import Config

# Configuration
MOUNT_POINT = Path("/runpod-volume")
CACHE_ROOT = MOUNT_POINT / ".cache" # We will archive this directory
ARCHIVE_NAME = "compilation_cache.tar.gz"
LOCAL_ARCHIVE_PATH = Path("/tmp") / ARCHIVE_NAME

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

def restore():
    """Download single tarball and extract it."""
    client = get_s3_client()
    if not client: return

    print("[Sync] Rapid Archive Restore initiated - skipping file-by-file listing.", flush=True)
    
    try:
        # Check if exists (fast check)
        client.head_object(Bucket=S3_BUCKET, Key=ARCHIVE_NAME)
        
        print(f"[Sync] Downloading archive {ARCHIVE_NAME}...", flush=True)
        client.download_file(S3_BUCKET, ARCHIVE_NAME, str(LOCAL_ARCHIVE_PATH))
        
        if not LOCAL_ARCHIVE_PATH.exists():
             print(f"[Sync] Error: Download reported success but file missing at {LOCAL_ARCHIVE_PATH}", flush=True)
             return

        print(f"[Sync] Extracting archive to {MOUNT_POINT}...", flush=True)
        # Extract to MOUNT_POINT. The archive should contain ".cache/..." structure.
        # We assume the archive was created relative to MOUNT_POINT.
        subprocess.run(
            ["tar", "-xzf", str(LOCAL_ARCHIVE_PATH), "-C", str(MOUNT_POINT)], 
            check=True
        )
        print("[Sync] Restore complete.", flush=True)
        
        # Cleanup
        LOCAL_ARCHIVE_PATH.unlink(missing_ok=True)
        
    except ClientError as e:
        if e.response['Error']['Code'] == "404":
            print("[Sync] No archive found (First run?), proceeding with fresh compilation.", flush=True)
        else:
            print(f"[Sync] S3 Error checking/downloading archive: {e}", flush=True)
    except subprocess.CalledProcessError as e:
        print(f"[Sync] Error extracting archive: {e}", flush=True)
    except Exception as e:
        print(f"[Sync] Unexpected error during restore: {e}", flush=True)

def backup():
    """Compress .cache directory and upload as single file."""
    client = get_s3_client()
    if not client: return

    if not CACHE_ROOT.exists():
        # Nothing to back up yet
        return

    print("[Sync] Creating archive for backup...", flush=True)
    try:
        # Create tarball of .cache directory, relative to MOUNT_POINT
        # tar -czf /tmp/archive.tar.gz -C /runpod-volume .cache
        # Added --ignore-failed-read to prevent crash if torch deletes a temp file during read
        subprocess.run(
            ["tar", "--ignore-failed-read", "-czf", str(LOCAL_ARCHIVE_PATH), "-C", str(MOUNT_POINT), ".cache"],
            check=True
        )
        
        print(f"[Sync] Uploading archive {ARCHIVE_NAME} to S3...", flush=True)
        client.upload_file(str(LOCAL_ARCHIVE_PATH), S3_BUCKET, ARCHIVE_NAME)
        print("[Sync] Backup complete.", flush=True)
        
        # Cleanup
        LOCAL_ARCHIVE_PATH.unlink(missing_ok=True)

    except subprocess.CalledProcessError as e:
        print(f"[Sync] Error creating archive: {e}", flush=True)
    except Exception as e:
        print(f"[Sync] Error uploading archive: {e}", flush=True)

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
