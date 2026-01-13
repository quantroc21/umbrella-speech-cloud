
import os
import io
import base64
import torch
import runpod
from tools.server.model_manager import ModelManager
from tools.server.inference import inference_wrapper as inference
from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio
from huggingface_hub import snapshot_download

# Configuration (Securely Load from RunPod Env)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"
REPO_ID = "fishaudio/fish-speech-1.5"
HF_TOKEN = os.getenv("HF_TOKEN") 

def ensure_models():
    """Download models if they are missing from the volume."""
    if not os.path.exists(os.path.join(CHECKPOINT_DIR, "model.pth")):
        print(f"Models missing in {CHECKPOINT_DIR}. Downloading from {REPO_ID}...")
        snapshot_download(
            repo_id=REPO_ID,
            local_dir=CHECKPOINT_DIR,
            token=HF_TOKEN,
            local_dir_use_symlinks=False
        )
        print("Download complete.")
    else:
        print(f"Models found in {CHECKPOINT_DIR}. Skipping download.")

print(f"--- INITIALIZING FISHSPEECH 1.5 SERVERLESS HANDLER ---")
print(f"Device: {DEVICE}")

# Step 1: Ensure models are present on the volume
try:
    ensure_models()
except Exception as e:
    print(f"FAILED to download/verify models: {e}")
    # We continue to let ModelManager try, in case of partial success

# Step 2: Define paths for ModelManager
DECODER_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
DECODER_CONFIG = "firefly_gan_vq"

# Initialize Model Manager Globally (Warm Start)
try:
    manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True, 
        compile=False, 
        asr_enabled=False,
        llama_checkpoint_path=CHECKPOINT_DIR,
        decoder_config_name=DECODER_CONFIG,
        decoder_checkpoint_path=DECODER_CHECKPOINT
    )
    print("ModelManager Initialized Successfully.")
except Exception as e:
    print(f"CRITICAL: Failed to initialize ModelManager: {e}")
    raise e

def handler(job):
    """
    RunPod Handler for FishSpeech 1.5
    Supports: task="tts" and task="list_voices"
    """
    job_input = job['input']
    task = job_input.get('task', 'tts')

    if task == "list_voices":
        print("Handling list_voices task...")
        # Return the same preset list the frontend uses + any dynamic ones
        return [
            { "id": "Donal Trump", "name": "Donald Trump", "description": "Cloud Voice" },
            { "id": "Brian", "name": "Brian", "description": "Cloud Voice" },
            { "id": "Mark", "name": "Mark", "description": "Cloud Voice" },
            { "id": "Adame", "name": "Adam", "description": "Cloud Voice" },
            { "id": "andreas", "name": "Andreas", "description": "Cloud Voice" },
            { "id": "trump", "name": "Trump (Alt)", "description": "Cloud Voice" },
        ]
    
    # Default TTS Task
    text = job_input.get('text', '')
    reference_id = job_input.get('reference_id', None)
    chunk_length = job_input.get('chunk_length', 200) 
    max_new_tokens = job_input.get('max_new_tokens', 1024)
    top_p = job_input.get('top_p', 0.7)
    repetition_penalty = job_input.get('repetition_penalty', 1.2)
    temperature = job_input.get('temperature', 0.7)
    seed = job_input.get('seed', None)
    
    print(f"Processing TTS: Text='{text[:20]}...', Voice='{reference_id}'")

    request = ServeTTSRequest(
        text=text,
        references=[], 
        reference_id=reference_id,
        max_new_tokens=max_new_tokens,
        chunk_length=chunk_length,
        top_p=top_p,
        repetition_penalty=repetition_penalty,
        temperature=temperature,
        seed=seed,
        format="wav",
        streaming=False
    )

    try:
        engine = manager.tts_inference_engine
        fake_audios = next(inference(request, engine))
        
        buffer = io.BytesIO()
        import soundfile as sf
        sf.write(buffer, fake_audios, 44100, format='wav')
        wav_bytes = buffer.getvalue()
        
        audio_base64 = base64.b64encode(wav_bytes).decode('utf-8')
        
        # Flatter response for RunPod: RunPod wraps this in its own 'output' field
        return {
            "status": "success",
            "audio_base64": audio_base64
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        return {"error": str(e)}

runpod.serverless.start({"handler": handler})
