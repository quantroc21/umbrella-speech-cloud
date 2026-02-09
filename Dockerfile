
# Task 1: Baseline Restoration (v17.01) - Performance Fix
# Using same base, but ensuring Flash Attention is correctly built
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-devel

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV MAX_JOBS=4

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Install UV
RUN pip install --no-cache-dir uv

COPY . .

# Install dependencies
RUN uv pip install --system --no-cache setuptools wheel ninja packaging
RUN uv pip install --system --no-cache .
RUN uv pip install --system --no-cache runpod soundfile huggingface-hub boto3

# FORCE Flash Attention with proper flags for Ada Lovelace (sm_89)
# This is critical for the 260t/s speed on RTX 4090
ENV TORCH_CUDA_ARCH_LIST="8.9"
RUN pip install --no-cache-dir flash-attn --no-build-isolation

# Bake models
RUN python tools/download_models.py

ENV CHECKPOINT_DIR=/app/checkpoints/fish-speech-1.5

CMD [ "python", "-u", "handler.py" ]
