#!/bin/bash
set -e

# Define mount point
MOUNT_POINT="/runpod-volume"
mkdir -p "$MOUNT_POINT"

# Check if S3 credentials are provided (Using _NETWORK suffix to avoid conflict with R2)
if [[ -n "$S3_ACCESS_KEY_ID_NETWORK" && -n "$S3_SECRET_ACCESS_KEY_NETWORK" && -n "$S3_ENDPOINT_URL_NETWORK" && -n "$S3_BUCKET_NAME_NETWORK" ]]; then
    echo "Mounting S3 Volume: $S3_BUCKET_NAME_NETWORK..."
    
    # Write credentials to a file for s3fs
    echo "$S3_ACCESS_KEY_ID_NETWORK:$S3_SECRET_ACCESS_KEY_NETWORK" > /etc/passwd-s3fs
    chmod 600 /etc/passwd-s3fs

    # Mount using s3fs
    s3fs "$S3_BUCKET_NAME_NETWORK" "$MOUNT_POINT" \
        -o url="$S3_ENDPOINT_URL_NETWORK" \
        -o use_path_request_style \
        -o allow_other \
        -o umask=000 \
        -o mp_umask=000

    echo "S3 Volume mounted at $MOUNT_POINT"
else
    echo "WARNING: S3 Credentials not found. Compilation cache will NOT persist."
fi

# Ensure cache directories exist (local or mounted)
mkdir -p "$MOUNT_POINT/.cache/torch"
mkdir -p "$MOUNT_POINT/.cache/triton"

# Launch the handler
exec python -u handler.py
