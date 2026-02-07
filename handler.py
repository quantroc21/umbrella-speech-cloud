
import os
import io
import base64
import torch
import runpod
import boto3
from botocore.config import Config
from tools.server.model_manager import ModelManager
from tools.server.inference import inference_wrapper as inference
from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio
from huggingface_hub import snapshot_download

# Configuration (Securely Load from RunPod Env)
# --- v15.30: FORCE PERSISTENT COMPILATION CACHE ---
# This ensures that once compiled (25s), the kernels are saved to the Network Volume.
# Subsequent containers will load them instantly (<3s).
os.environ["TORCHINDUCTOR_CACHE_DIR"] = "/runpod-volume/torch_compile_cache"
os.environ["TORCHINDUCTOR_FX_GRAPH_CACHE"] = "1"
os.makedirs("/runpod-volume/torch_compile_cache", exist_ok=True)
# --------------------------------------------------

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
REPO_ID = "fishaudio/fish-speech-1.5"
HF_TOKEN = os.getenv("HF_TOKEN") 

def find_model_path(model_name):
    """
    Find the path to a cached model in RunPod.
    """
    cache_dir = "/runpod-volume/huggingface-cache/hub"
    cache_name = model_name.replace("/", "--")
    snapshots_dir = os.path.join(cache_dir, f"models--{cache_name}", "snapshots")
    
    if os.path.exists(snapshots_dir):
        snapshots = os.listdir(snapshots_dir)
        if snapshots:
            return os.path.join(snapshots_dir, snapshots[0])
    return None

# Determine Checkpoint Directory
# Priority: 1. Env Var, 2. RunPod Cache, 3. Local Fallback
if os.getenv("CHECKPOINT_DIR"):
    CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR")
    print(f"Using Configured Checkpoint: {CHECKPOINT_DIR}")
else:
    cached_path = find_model_path(REPO_ID)
    if cached_path:
        CHECKPOINT_DIR = cached_path
        print(f"Using RunPod Cached Model: {CHECKPOINT_DIR}")
    else:
        CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"
        print(f"Using Local Model Logic: {CHECKPOINT_DIR}")

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

def ensure_references(voice_id):
    """Download reference wav and txt from S3 if missing."""
    if not voice_id or voice_id in ["default", "none"]:
        return
    
    ref_dir = os.path.join("references", voice_id)
    os.makedirs(ref_dir, exist_ok=True)
    
    # Check if files already exist
    wav_path = os.path.join(ref_dir, f"{voice_id}.wav")
    lab_path = os.path.join(ref_dir, f"{voice_id}.lab") # FishSpeech prefers .lab
    
    if os.path.exists(wav_path) and os.path.exists(lab_path):
        return

    print(f"Downloading references for {voice_id} from R2...")
    try:
        s3 = get_s3_client()
        # Download WAV
        s3.download_file(S3_BUCKET_NAME, f"references/{voice_id}/{voice_id}.wav", wav_path)
        
        # Download Text (Try .lab then .txt)
        try:
            s3.download_file(S3_BUCKET_NAME, f"references/{voice_id}/{voice_id}.lab", lab_path)
        except:
            # Fallback to .txt and rename to .lab locally so inference engine finds it
            print(f"No .lab found for {voice_id}, trying .txt...")
            s3.download_file(S3_BUCKET_NAME, f"references/{voice_id}/{voice_id}.txt", lab_path)
            
        print(f"References for {voice_id} synced.")
    except Exception as e:
        print(f"Failed to sync references for {voice_id}: {e}")

print(f"--- INITIALIZING FISHSPEECH 1.5 SERVERLESS HANDLER ---")
print(f"Device: {DEVICE}")

# Step 1: Ensure models are present on the volume
try:
    ensure_models()
except Exception as e:
    print(f"FAILED to download/verify models: {e}")

# Step 2: Define paths for ModelManager
DECODER_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
DECODER_CONFIG = "firefly_gan_vq"

# Initialize Model Manager Globally (Warm Start)
try:
    manager = ModelManager(
        mode="tts",
        device="cuda",
        half=True,
        compile=True,
        asr_enabled=False,
        llama_checkpoint_path=str(CHECKPOINT_DIR),
        decoder_checkpoint_path=str(DECODER_CHECKPOINT),
        decoder_config_name=str(DECODER_CONFIG),
    )
    print("ModelManager Initialized Successfully.")
except Exception as e:
    print(f"CRITICAL: Failed to initialize ModelManager: {e}")
    raise e

def preprocess_text(text):
    """
    Handle emotion tags and text normalization before inference.
    FishSpeech 1.5 picks up cues from punctuation and specific laughter words.
    """
    if not text:
        return text
        
    # Handle [laughing] tag
    if "[laughing]" in text.lower():
        # Inject realistic laughter words
        text = text.replace("[laughing]", "hahaha! ")
        text = text.replace("[Laughing]", "hahaha! ")
        
    # Handle [excited] tag
    if "[excited]" in text.lower():
        text = text.replace("[excited]", "")
        text = text.replace("[Excited]", "")
        # Add exclamation marks to increase model intensity
        if not text.strip().endswith("!"):
            text = text.strip() + "!!!"
            
    # Handle [whispering] tag
    if "[whisper]" in text.lower() or "[whispering]" in text.lower():
        text = text.replace("[whispering]", "")
        text = text.replace("[whisper]", "")
        # Add leading ellipses for a softer onset
        text = "... " + text.strip()
        
    # Remove remaining bracketed tags to prevent model from reading them
    import re
    text = re.sub(r"\[.*?\]", "", text)

    # NEW: Pause Multiplication (Force longer silences)
    # 1. Ellipsis to Extra-Long Pause (Double it)
    text = text.replace("...", "... ...")
    # 2. Comma to Medium Pause (Add a micro-ellipsis)
    text = text.replace(", ", ", ... ")
    
    return text.strip()

def handler(job):
    """
    RunPod Handler for FishSpeech 1.5
    Supports: task="tts" and task="list_voices"
    """
    job_input = job['input']
    task = job_input.get('task', 'tts')

    if task == "list_voices":
        print("Dynamically listing voices from R2...")
        try:
            s3 = get_s3_client()
            response = s3.list_objects_v2(Bucket=S3_BUCKET_NAME, Prefix="references/", Delimiter="/")
            voices = []
            if 'CommonPrefixes' in response:
                for prefix in response['CommonPrefixes']:
                    voice_name = prefix['Prefix'].split('/')[-2]
                    voices.append({
                        "id": voice_name,
                        "name": voice_name,
                        "description": "Cloud Voice (R2)"
                    })
            return voices
        except Exception as e:
            print(f"Error listing voices: {e}")
            return [
                { "id": "Donal Trump", "name": "Donald Trump", "description": "Cloud Voice (Local)" },
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
    
    # NEW: Preprocess text for emotions
    processed_text = preprocess_text(text)
    print(f"Original Text: '{text[:30]}...' -> Processed: '{processed_text[:30]}...'")

    # NEW: Ensure reference audio is available on this worker
    if reference_id:
        ensure_references(reference_id)

    print(f"Processing TTS: Text='{processed_text[:20]}...', Voice='{reference_id}'")

    request = ServeTTSRequest(
        text=processed_text,
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
        
        return {
            "status": "success",
            "audio_base64": audio_base64
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        return {"status": "error", "error": str(e)}

runpod.serverless.start({"handler": handler})
