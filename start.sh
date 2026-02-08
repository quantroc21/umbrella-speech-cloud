#!/bin/bash
set -e

# Define mount point
MOUNT_POINT="/runpod-volume"
# mkdir -p "$MOUNT_POINT" -> Removed to prevent fake volume creation -> Removed to prevent fake volume creation

# Check if S3 credentials are provided (Using _NETWORK suffix)
if [[ -n "$S3_ACCESS_KEY_ID_NETWORK" && -n "$S3_SECRET_ACCESS_KEY_NETWORK" ]]; then
    echo "Starting Python Cache Sync..."
    
    # 1. Restore Cache (Blocking - wait for it before starting inference)
    python -u tools/cache_sync.py restore
    
    # 2. Background Monitor is now handled inside handler.py to avoid race conditions
    
else
    echo "WARNING: S3 Network Credentials not found. Cache will NOT persist."
fi

# Ensure cache directories exist (local or mounted)
mkdir -p "$MOUNT_POINT/.cache/torch"
mkdir -p "$MOUNT_POINT/.cache/triton"

# Launch the handler
exec python -u handler.py
