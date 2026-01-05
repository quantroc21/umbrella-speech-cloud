# Base Image with PyTorch and CUDA
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Set working directory
WORKDIR /app

# Install system dependencies (ffmpeg is required for audio)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements or setup.py first to cache dependencies
COPY pyproject.toml .
# (If you had a requirements.txt, copy it here)

# Install Python dependencies
# We install 'runpod' specifically for the handler
RUN pip install --no-cache-dir runpod

# Copy the rest of the application
COPY . .

# Install the package in editable mode
RUN pip install -e .

# --- CRITICAL: Download Models at Build Time ---
# This ensures the models are inside the image, so "Cold Start" doesn't have to download them.
# We call the existing script to fetch them.
RUN python tools/download_models.py

# Define the entrypoint
# -u means unbuffered output (so you see logs immediately)
CMD [ "python", "-u", "handler.py" ]
