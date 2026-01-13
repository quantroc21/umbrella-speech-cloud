
import os
import io
import base64
import torch
import runpod
from tools.server.model_manager import ModelManager
from tools.server.inference import inference_wrapper as inference
from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio

# --- CONFIGURATION (Must match Localhost Success) ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"
DECODER_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "codec.pth") # User's downloaded file
DECODER_CONFIG = "firefly_gan_vq" # 1.5 Confirmed Config

print(f"--- INITIALIZING FISHSPEECH 1.5 SERVERLESS HANDLER ---")
print(f"Device: {DEVICE}")
print(f"Checkpoints: {CHECKPOINT_DIR}")

# Initialize Model Manager Globally (Warm Start)
try:
    manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True, # Force FP16 as verified
        compile=False, # Disable Compile to avoid buzzing
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
    Input: { "input": { "text": "...", "reference_id": "...", ... } }
    Output: { "audio_base64": "..." }
    """
    job_input = job['input']
    
    # Extract Parameters
    text = job_input.get('text', '')
    reference_id = job_input.get('reference_id', None)
    # Backend mapping: Frontend 'iterativeLength' -> 'chunk_length'
    chunk_length = job_input.get('chunk_length', 200) 
    max_new_tokens = job_input.get('max_new_tokens', 1024)
    top_p = job_input.get('top_p', 0.7)
    repetition_penalty = job_input.get('repetition_penalty', 1.2)
    temperature = job_input.get('temperature', 0.7)
    seed = job_input.get('seed', None)
    
    # Advanced: References logic (Optional, default to ID load inside engine if supported, 
    # but ModelManager/Engine usually needs 'references' list or 'reference_id' passed in request)
    # The ServeTTSRequest schema supports 'reference_id'.
    
    print(f"Processing Request: Text='{text[:20]}...', Voice='{reference_id}'")

    request = ServeTTSRequest(
        text=text,
        references=[], # Loaded by ID internally if reference_id is set
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

    # Inference
    try:
        engine = manager.tts_inference_engine
        fake_audios = next(inference(request, engine))
        
        # Convert to WAV Bytes
        buffer = io.BytesIO()
        import soundfile as sf
        sf.write(buffer, fake_audios, 44100, format='wav')
        wav_bytes = buffer.getvalue()
        
        # Encode Base64
        audio_base64 = base64.b64encode(wav_bytes).decode('utf-8')
        
        return {
            "audio_base64": audio_base64
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        return {"error": str(e)}

runpod.serverless.start({"handler": handler})
