
# v13.4: Restore User's Optimized "Skeleton" Dockerfile
# Base Image with Newer PyTorch for compatibility and pre-installed CUDA
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

# Set working directory
WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (ffmpeg is required for audio)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project code
COPY . .

# Install Python dependencies
# 1. Install fish-speech package in editable mode
# 2. Force pinning of vector-quantize-pytorch as verified locally
# 3. Install RunPod for serverless support
RUN pip install --no-cache-dir -e .[stable] \
    && pip install --no-cache-dir runpod "vector-quantize-pytorch==1.14.24"

# --- v12.0 SKELETON UPDATE: Skip Model Download ---
# Models are loaded from the Network Volume (mounted to /app/checkpoints) at Runtime.
# This prevents 127 errors and huge image sizes.

# Define the entrypoint
# -u means unbuffered output (so you see logs immediately)
CMD [ "python", "-u", "handler.py" ]
