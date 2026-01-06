# Base Image with PyTorch and CUDA
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Set working directory
WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (ffmpeg is required for audio)
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    ffmpeg \
    git \
    libsndfile1 \
    portaudio19-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements or setup.py first to cache dependencies
COPY pyproject.toml .
# (If you had a requirements.txt, copy it here)

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the rest of the application
COPY . .

# Install dependencies using uv
RUN uv pip install --system -e .

# --- CRITICAL: Download Models at Build Time ---
# This ensures the models are inside the image, so "Cold Start" doesn't have to download them.
# We call the NEW linux-specific script to fetch them (skipping windows .exes).
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}
RUN python tools/docker_download.py

# Define the entrypoint
# -u means unbuffered output (so you see logs immediately)
CMD [ "python", "-u", "handler.py" ]
