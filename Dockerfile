
# v13.9: Highly Robust Build using UV and standardized dependencies
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

# Set working directory
WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

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
    && rm -rf /var/lib/apt/lists/*

# Install UV for faster and more reliable python package management
RUN pip install --no-cache-dir uv

# Copy the entire project code
COPY . .

# Install Python dependencies using UV
# 1. Install build-time requirements first
# 2. Install the project in non-editable mode
# 3. Explicitly include runpod and the vq-pytorch fix
RUN uv pip install --system --no-cache setuptools setuptools-scm wheel \
    && uv pip install --system --no-cache .[stable] \
    && uv pip install --system --no-cache runpod "vector-quantize-pytorch==1.14.24" soundfile huggingface-hub

# Final check for permissions (optional but safe)
RUN chmod +x entrypoint.sh || true

# Define the entrypoint
CMD [ "python", "-u", "handler.py" ]
