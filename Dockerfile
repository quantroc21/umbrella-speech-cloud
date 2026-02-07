
# v13.9: Highly Robust Build using UV and standardized dependencies
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-devel

# Set working directory
WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
# Persist compilation cache to the network volume
ENV TORCHINDUCTOR_CACHE_DIR=/runpod-volume/.cache/torch
ENV TRITON_CACHE_DIR=/runpod-volume/.cache/triton
ENV TORCHINDUCTOR_FX_GRAPH_CACHE=1
RUN mkdir -p /runpod-volume/.cache/torch /runpod-volume/.cache/triton

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    ca-certificates \
    git \
    build-essential \
    python3-dev \
    portaudio19-dev \
    libasound2-dev \
    cmake \
    pkg-config \
    ninja-build \
    s3fs \
    && rm -rf /var/lib/apt/lists/*

# Install UV for faster and more reliable python package management
RUN pip install --no-cache-dir uv

# Copy the entire project code
COPY . .

# Install Python dependencies using UV
# 1. Install build-time requirements first
# 2. Install the project WITHOUT the [stable] extra to preserve base image Torch
# 3. Explicitly include runpod and the vq-pytorch fix
# Limit compilation threads to prevent OOM on GitHub Runners
ENV MAX_JOBS=2

# Install Python build dependencies
RUN uv pip install --system --no-cache setuptools setuptools-scm wheel ninja packaging

# Install Project
RUN uv pip install --system --no-cache .

# Install Runtime Deps
RUN uv pip install --system --no-cache runpod "vector-quantize-pytorch==1.14.24" soundfile huggingface-hub boto3

# Install Flash Attention (Separate step, using standard pip for safety)
RUN pip install --no-cache-dir flash-attn --no-build-isolation

# Pre-download models to bake them into the image (Fast Cold Start)
# RUN python tools/download_models.py -> Removed for v15.9 (Network Based / Cached)

# Final check for permissions (optional but safe)
RUN chmod +x entrypoint.sh || true

# Define the entrypoint
# Run the startup script (Handles S3 mounting + Inference)
CMD [ "bash", "start.sh" ]
