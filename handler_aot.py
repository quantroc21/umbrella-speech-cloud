
import os
import io
import base64
import torch
import runpod
import time
import boto3
from botocore.config import Config
from tools.server.model_manager import ModelManager
from tools.server.inference import inference_wrapper as inference
from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio
from huggingface_hub import snapshot_download

# --- PERFORMANCE CONFIGURATION (NO NETWORK VOLUME) ---
# We are prioritizing maximum inference speed with max-autotune.
# Compilation will happen on cold start.
os.environ["TORCHINDUCTOR_FX_GRAPH_CACHE"] = "1"
os.environ["TORCHINDUCTOR_AUTOTUNE_REMOTE_CACHE"] = "0"

# Configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
REPO_ID = "fishaudio/fish-speech-1.5"
HF_TOKEN = os.getenv("HF_TOKEN") 

# Determine Checkpoint Directory
if os.getenv("CHECKPOINT_DIR"):
    CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR")
else:
    # Use local cache or default path
    CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"

# S3 / R2 Configuration
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )

def ensure_models():
    """Download models if they are missing."""
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

def ensure_references(voice_id):
    """Download reference wav and txt from S3 if missing."""
    if not voice_id or voice_id in ["default", "none"]:
        return
    
    ref_dir = os.path.join("references", voice_id)
    os.makedirs(ref_dir, exist_ok=True)
    
    wav_path = os.path.join(ref_dir, f"{voice_id}.wav")
    lab_path = os.path.join(ref_dir, f"{voice_id}.lab")
    
    if os.path.exists(wav_path) and os.path.exists(lab_path):
        return

    print(f"Downloading references for {voice_id} from R2...")
    try:
        s3 = get_s3_client()
        s3.download_file(S3_BUCKET_NAME, f"references/{voice_id}/{voice_id}.wav", wav_path)
        try:
            s3.download_file(S3_BUCKET_NAME, f"references/{voice_id}/{voice_id}.lab", lab_path)
        except:
            print(f"No .lab found for {voice_id}, trying .txt...")
            s3.download_file(S3_BUCKET_NAME, f"references/{voice_id}/{voice_id}.txt", lab_path)
        print(f"References for {voice_id} synced.")
    except Exception as e:
        print(f"Failed to sync references for {voice_id}: {e}")

# Step 2: Define paths for ModelManager
DECODER_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
DECODER_CONFIG = "firefly_gan_vq"

import threading

READY_EVENT = threading.Event()
manager = None

def init_manager_background():
    global manager
    try:
        start_init = time.time()
        ensure_models()
        
        manager = ModelManager(
            mode="tts",
            device=DEVICE,
            half=True, 
            compile=True,
            asr_enabled=False,
            llama_checkpoint_path=CHECKPOINT_DIR,
            decoder_config_name=DECODER_CONFIG,
            decoder_checkpoint_path=DECODER_CHECKPOINT
        )
        print(f"ModelManager Initialized ({time.time() - start_init:.2f}s).")
        
        # Step 3: Warmup (English-Only, Fixed Text)
        print("Starting English-only warmup (max-autotune compilation)...")
        # Text for warmup must be simple and constant
        # manager.warm_up uses "Hello world, this is a test voice." by default
        manager.warm_up(manager.tts_inference_engine)
        print("Warmup complete. signaling READY.")
        
        READY_EVENT.set()
    except Exception as e:
        print(f"CRITICAL: Failed to initialize ModelManager in background: {e}")

print(f"--- INITIALIZING FISHSPEECH AOT HANDLER (v18.20-precision) ---")
print(f"Device: {DEVICE}")

# Start background initialization immediately
threading.Thread(target=init_manager_background, daemon=True).start()
print("Background initialization started. Pod reporting READY to RunPod...")

def preprocess_text(text):
    if not text:
        return text
    if "[laughing]" in text.lower():
        text = text.replace("[laughing]", "hahaha! ").replace("[Laughing]", "hahaha! ")
    if "[excited]" in text.lower():
        text = text.replace("[excited]", "").replace("[Excited]", "")
        if not text.strip().endswith("!"): text = text.strip() + "!!!"
    if "[whisper]" in text.lower() or "[whispering]" in text.lower():
        text = text.replace("[whispering]", "").replace("[whisper]", "")
        text = "... " + text.strip()
    
    import re
    text = re.sub(r"\[.*?\]", "", text)
    text = text.replace("...", "... ...").replace(", ", ", ... ")
    return text.strip()

def handler(job):
    # WAIT for background initialization (Increased timeout for max-autotune)
    if not READY_EVENT.is_set():
        print("Job received but ModelManager not ready. Waiting for background initialization (max-autotune)...")
        if not READY_EVENT.wait(timeout=240): # 4 minutes for max-autotune
            return {"status": "error", "error": "Model initialization timed out (240s limit for max-autotune)."}
        print("ModelManager ready. Proceeding with job.")

    job_input = job['input']
    task = job_input.get('task', 'tts')

    if task == "list_voices":
        try:
            s3 = get_s3_client()
            response = s3.list_objects_v2(Bucket=S3_BUCKET_NAME, Prefix="references/", Delimiter="/")
            voices = []
            if 'CommonPrefixes' in response:
                for prefix in response['CommonPrefixes']:
                    voice_name = prefix['Prefix'].split('/')[-2]
                    voices.append({"id": voice_name, "name": voice_name, "description": "Cloud Voice (R2)"})
            return voices
        except Exception as e:
            return [{"id": "Donal Trump", "name": "Donald Trump", "description": "Cloud Voice (Local)"}]
    
    text = job_input.get('text', '')
    reference_id = job_input.get('reference_id', None)
    
    processed_text = preprocess_text(text)
    if reference_id: ensure_references(reference_id)

    print(f"Processing TTS: Text='{processed_text[:20]}...', Voice='{reference_id}'")

    request = ServeTTSRequest(
        text=processed_text,
        references=[], 
        reference_id=reference_id,
        max_new_tokens=job_input.get('max_new_tokens', 1024),
        chunk_length=job_input.get('chunk_length', 200),
        top_p=job_input.get('top_p', 0.7),
        repetition_penalty=job_input.get('repetition_penalty', 1.2),
        temperature=job_input.get('temperature', 0.7),
        seed=job_input.get('seed', None),
        format="wav",
        streaming=False
    )

    try:
        engine = manager.tts_inference_engine
        fake_audios = next(inference(request, engine))
        buffer = io.BytesIO()
        import soundfile as sf
        sf.write(buffer, fake_audios, 44100, format='wav')
        return {"status": "success", "audio_base64": base64.b64encode(buffer.getvalue()).decode('utf-8')}
    except Exception as e:
        print(f"Inference Error: {e}")
        return {"status": "error", "error": str(e)}

runpod.serverless.start({"handler": handler})
