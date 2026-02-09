# Task 1: Baseline Restoration (Minimal Image, No Volume, Standard PyTorch)
# Base Image: Official PyTorch (contains CUDA/CuDNN)
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-devel

# Set working directory
WORKDIR /app

# Environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV MAX_JOBS=4

# Install system dependencies (Minimal)
# ffmpeg: needed for audio processing (librosa/soundfile)
# git: needed for pip install from git
# build-essential: needed for compiling some python extensions
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install UV for faster pip
RUN pip install --no-cache-dir uv

# Copy only requirements first to leverage caching (if we had a requirements.txt, but we use pyproject.toml usually)
COPY . .

# Install Python dependencies using UV
# - Install project in editable mode or just install deps
RUN uv pip install --system --no-cache setuptools wheel ninja packaging

# Install Project Deps
RUN uv pip install --system --no-cache .

# Install Runtime Deps (RunPod SDK, etc)
RUN uv pip install --system --no-cache runpod soundfile huggingface-hub boto3

# Install Flash Attention (Critical for 260t/s)
RUN pip install --no-cache-dir flash-attn --no-build-isolation

# Task 1 Requirement: Bake models into image (NO network volume)
RUN python tools/download_models.py

# Define Environment Variable for Checkpoint
ENV CHECKPOINT_DIR=/app/checkpoints/fish-speech-1.5

# Runtime Entrypoint
CMD [ "python", "-u", "handler.py" ]
