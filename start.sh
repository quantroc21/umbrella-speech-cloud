#!/bin/bash
set -e

# Define mount point
MOUNT_POINT="/runpod-volume"
mkdir -p "$MOUNT_POINT"

# Check if S3 credentials are provided
if [[ -n "$S3_ACCESS_KEY_ID" && -n "$S3_SECRET_ACCESS_KEY" && -n "$S3_ENDPOINT_URL" && -n "$S3_BUCKET_NAME" ]]; then
    echo "Mounting S3 Volume: $S3_BUCKET_NAME..."
    
    # Write credentials to a file for s3fs
    echo "$S3_ACCESS_KEY_ID:$S3_SECRET_ACCESS_KEY" > /etc/passwd-s3fs
    chmod 600 /etc/passwd-s3fs

    # Mount using s3fs
    s3fs "$S3_BUCKET_NAME" "$MOUNT_POINT" \
        -o url="$S3_ENDPOINT_URL" \
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
