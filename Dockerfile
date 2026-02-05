# Base Image with Newer PyTorch for compatibility
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

# Set working directory
WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (ffmpeg is required for audio)
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    ffmpeg \
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
RUN uv pip install --system -e .[cu124] pydub boto3 "vector-quantize-pytorch==1.14.24"

# --- v12.0 SKELETON IMAGE ---
# Use .dockerignore to exclude 'checkpoints/' and 'references/'
# RUN python tools/docker_download.py (REMOVED)

# Define the entrypoint
# -u means unbuffered output (so you see logs immediately)
CMD [ "python", "-u", "handler.py" ]
