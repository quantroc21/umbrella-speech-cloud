
import os
import torch
import soundfile as sf
import platform
from loguru import logger
from tools.server.model_manager import ModelManager
from fish_speech.utils.schema import ServeTTSRequest

# --- CONFIGURATION (STRICT) ---
CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"
# Ensure the folder exists or update path
if not os.path.exists(CHECKPOINT_DIR):
    # Fallback to current default if specific 1.5 path not found, but warn user
    CHECKPOINT_DIR = "checkpoints/openaudio-s1-mini" 
    print(f"WARNING: Using fallback path {CHECKPOINT_DIR}. Ensure this is really FishSpeech 1.5 weights!")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PRECISION = torch.float16 if DEVICE == "cuda" else torch.float32

# Verify Dependencies
try:
    import vector_quantize_pytorch
    from importlib.metadata import version
    v = version("vector-quantize-pytorch")
    print(f"Checked: vector-quantize-pytorch version = {v}")
    if "1.14.24" not in v:
        print("CRITICAL WARNING: vector-quantize-pytorch CHECK FAILED. EXPECTED 1.14.24")
except Exception as e:
    print(f"WARNING: Could not verify vector-quantize-pytorch version: {e}")

def run_test():
    print(f"--- STARTING SANITY CHECK ---")
    print(f"Device: {DEVICE}")
    print(f"Precision: {PRECISION} (Should be float16/half for CUDA)")
    
    # 1. Initialize Model Manager with STRICT flags
    print("Initializing ModelManager...")
    manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=os.environ.get("HALF", "True").lower() == "true", # FORCE FP16
        compile=os.environ.get("COMPILE", "False").lower() == "true", # DISABLE COMPILE
        asr_enabled=False,
        llama_checkpoint_path=CHECKPOINT_DIR,
        decoder_config_name="firefly_gan_vq", # Dual-AR config
        decoder_checkpoint_path=f"{CHECKPOINT_DIR}/codec.pth"
    )
    
    # 2. Prepare Request
    print("Generating Audio...")
    request = ServeTTSRequest(
        text="This is a sanity check for Fish Speech 1.5.",
        references=[],
        reference_id=None,
        max_new_tokens=1024,
        chunk_length=200,
        top_p=0.7,
        repetition_penalty=1.2,
        temperature=0.7,
        format="wav",    # Request WAV headers
        streaming=False
    )
    
    # 3. Inference
    tts_engine = manager.tts_inference_engine
    
    full_audio = []
    
    inference_gen = tts_engine.inference(request)
    
    sample_rate = 44100
    
    for result in inference_gen:
        if result.code == "header":
            sr, _ = result.audio
            sample_rate = sr
            print(f"Header received. Sample Rate: {sample_rate}")
        elif result.code == "segment":
            _, segment = result.audio
            full_audio.append(segment)
        elif result.code == "final":
            _, final_audio = result.audio
            full_audio.append(final_audio)
        elif result.code == "error":
            print(f"ERROR: {result.error}")
            return
            
    # 4. Save Output
    if not full_audio:
        print("No audio generated!")
        return
        
    import numpy as np
    try:
        valid_audio = [x for x in full_audio if x is not None]
        if not valid_audio:
             print("Valid audio data is empty.")
             return
             
        # Concatenate depending on what we got. 
        # For non-streaming, 'final' usually contains the full buffer
        if len(valid_audio) == 1:
            final_data = valid_audio[0]
        else:
             final_data = np.concatenate(valid_audio)
             
        print(f"Audio Shape: {final_data.shape}")
        
        output_path = "sanity_check_output.wav"
        # Always output absolute path for clarity
        abs_output_path = os.path.abspath(output_path)
        sf.write(abs_output_path, final_data, sample_rate)
        print(f"SUCCESS: Audio saved to {abs_output_path}")
        print("Please verify: Is it buzzing? (Should be clear speech)")
    except Exception as e:
        print(f"Error saving audio: {e}")

if __name__ == "__main__":
    run_test()
