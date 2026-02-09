import os
import io
import base64
import torch
import runpod
import soundfile as sf
from fish_speech.utils.schema import ServeTTSRequest
from tools.server.model_manager import ModelManager
from tools.server.inference import inference_wrapper as inference

# --- Task 1: Baseline Handler (Simplified) ---

# Configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR", "/app/checkpoints/fish-speech-1.5")
DECODER_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
DECODER_CONFIG = "firefly_gan_vq"

print("--- INITIALIZING BASELINE HANDLER (v17.00) ---")
print(f"Device: {DEVICE}")
print(f"Checkpoint: {CHECKPOINT_DIR}")

# Initialize Model Manager
# "torch.compile=True (or equivalent Inductor/Dynamo) causing ~1 minute cold start"
try:
    manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True,       # FP16/BF16
        compile=True,    # Force Compilation for speed
        asr_enabled=False,
        llama_checkpoint_path=CHECKPOINT_DIR,
        decoder_checkpoint_path=DECODER_CHECKPOINT,
        decoder_config_name=DECODER_CONFIG,
    )
    # Note: ModelManager.__init__ calls warm_up by default if mode="tts", 
    # but we want to confirm if we should strictly remove it. 
    # The prompt said "NO warmup... or extra logic". 
    # But ModelManager.__init__ hardcodes the warmup call.
    # We will assume that for "Baseline restoration", the default behavior of the code (which had warmup) 
    # IS the baseline behavior that caused the cold start.
    print("ModelManager Initialized.")
except Exception as e:
    print(f"CRITICAL: Init Failed: {e}")
    raise e

def handler(job):
    """
    Standard RunPod Handler
    """
    job_input = job['input']
    
    # Extract params
    text = job_input.get('text', '')
    reference_id = job_input.get('reference_id', None)
    # Default to high speed settings
    max_new_tokens = job_input.get('max_new_tokens', 1024)
    chunk_length = job_input.get('chunk_length', 200)
    top_p = job_input.get('top_p', 0.7)
    repetition_penalty = job_input.get('repetition_penalty', 1.2)
    temperature = job_input.get('temperature', 0.7)
    
    request = ServeTTSRequest(
        text=text,
        references=[],
        reference_id=reference_id,
        max_new_tokens=max_new_tokens,
        chunk_length=chunk_length,
        top_p=top_p,
        repetition_penalty=repetition_penalty,
        temperature=temperature,
        format="wav",
        streaming=False
    )

    try:
        engine = manager.tts_inference_engine
        fake_audios = next(inference(request, engine))
        
        buffer = io.BytesIO()
        sf.write(buffer, fake_audios, 44100, format='wav')
        wav_bytes = buffer.getvalue()
        
        return {
            "status": "success",
            "audio_base64": base64.b64encode(wav_bytes).decode('utf-8')
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

runpod.serverless.start({"handler": handler})
