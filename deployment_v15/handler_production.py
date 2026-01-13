import os
import torch
import runpod
import soundfile as sf
import boto3
import uuid
import time
from io import BytesIO

# --- 1. Environment & Imports ---
# Ensuring vector-quantize-pytorch is fixed (Documentation check)
# RUN pip install vector-quantize-pytorch==1.14.24

from fish_speech.models.text2semantic.inference import (
    Text2Semantic, 
    load_checkpoint as load_llama_checkpoint
)
from fish_speech.models.vqgan.inference import (
    VQGAN, 
    load_checkpoint as load_decoder_checkpoint
)

# --- 2. Configuration & Initialization ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# FORCE FP16 for Production Stability & Speed
DTYPE = torch.float16 

# Initialize R2 Client (for Upload-on-Finish)
R2_CLIENT = boto3.client(
    's3',
    endpoint_url=os.environ.get("R2_ENDPOINT"),
    aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY")
)
R2_BUCKET = os.environ.get("R2_BUCKET_NAME")

print("--- LOADING PRODUCTION MODELS (FP16) ---")

# Load Llama (Text -> Semantic)
llama_model = load_llama_checkpoint(
    "checkpoints/fish-speech-1.5", 
    device=DEVICE, 
    precision=DTYPE # Explicit FP16
)

# Load VQGAN (Semantic -> Audio)
decoder_model = load_decoder_checkpoint(
    "checkpoints/fish-speech-1.5/codec.pth",
    "firefly_gan_vq",
    device=DEVICE
)

print("--- MODELS LOADED SUCCESSFULLY ---")

def upload_to_r2(audio_data, user_id, request_id, sample_rate=44100):
    """
    Uploads the generated audio directly to R2 and returns the URL.
    Path format: secure/u-{user_id}/{request_id}.wav
    """
    file_key = f"secure/u-{user_id}/{request_id}.wav"
    
    # Save to buffer
    buffer = BytesIO()
    sf.write(buffer, audio_data, sample_rate, format='WAV')
    buffer.seek(0)
    
    try:
        R2_CLIENT.upload_fileobj(
            buffer, 
            R2_BUCKET, 
            file_key,
            ExtraArgs={'ContentType': 'audio/wav'}
        )
        return file_key
    except Exception as e:
        print(f"R2 Upload Failed: {e}")
        return None

def handler(job):
    """
    Production Handler for FishSpeech 1.5
    Input: { "text": "str", "reference_id": "str", "user_id": "str" }
    """
    job_input = job["input"]
    user_id = job_input.get("user_id", "anonymous")
    text = job_input.get("text")
    reference_id = job_input.get("reference_id") # Path to ref in R2 or local
    request_id = str(uuid.uuid4())

    if not text:
        return {"error": "No text provided"}

    print(f"Processing Request {request_id} for User {user_id}")

    try:
        # 1. Inference Logic (Simplified for Blueprint)
        # In a real scenario, this calls the actual generate() function
        # forcing top_p=0.7 and temperature=0.7 for stability
        
        # Mocking the generation for the blueprint structure
        # (Replace with actual calls to llama_model.generate and decoder_model.decode)
        # audio_tokens = llama_model.generate(text, reference_audio=...)
        # audio_wav = decoder_model.decode(audio_tokens)
        
        # Placeholder: Generate 1 second of silence
        import numpy as np
        audio_wav = np.zeros(44100, dtype=np.float32) 
        
        # 2. Upload Logic (Upload-on-Finish)
        file_key = upload_to_r2(audio_wav, user_id, request_id)
        
        if file_key:
            return {
                "status": "success",
                "request_id": request_id,
                "audio_url": f"https://{os.environ.get('R2_PUBLIC_DOMAIN')}/{file_key}",
                "duration_seconds": len(audio_wav) / 44100,
                "credits_used": len(text) # Or based on duration
            }
        else:
            return {"status": "error", "message": "Failed to upload audio"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

runpod.serverless.start({"handler": handler})
