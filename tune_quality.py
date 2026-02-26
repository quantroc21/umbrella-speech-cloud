
import os
import io
import torch
import soundfile as sf
from tools.server.model_manager import ModelManager
from tools.server.inference import inference_wrapper as inference
from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio

# Configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"

def preprocess_text(text):
    """Clean text and inject prosody cues."""
    if not text: return text
    # Standard normalization
    text = text.replace("[laughing]", "hahaha! ")
    text = text.replace("[whisper]", "... ")
    return text.strip()

def tune():
    print(f"--- FISHSPEECH QUALITY TUNER ---")
    
    # Check for references folder
    if not os.path.exists("references"):
        os.makedirs("references")
        print("Created /references folder. Please put your .wav prompts there.")
        return

    # 1. Initialize Model
    print("Loading models (FP16)...")
    manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True, 
        compile=False, 
        llama_checkpoint_path=CHECKPOINT_DIR,
        decoder_config_name="firefly_gan_vq",
        decoder_checkpoint_path=os.path.join(CHECKPOINT_DIR, "firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
    )
    engine = manager.tts_inference_engine

    # 2. Setup Trial
    text_to_gen = input("\nEnter text to generate: ")
    ref_name = input("Enter reference voice ID (folder name in /references): ")
    processed_text = preprocess_text(text_to_gen)

    # Define Parameter Sets
    profiles = {
        "1_Stable_Narration": {
            "temperature": 0.3, 
            "top_p": 0.95, 
            "repetition_penalty": 1.5,
            "desc": "Low variability, high stability. Best for books."
        },
        "2_Dynamic_Natural": {
            "temperature": 0.7, 
            "top_p": 0.8, 
            "repetition_penalty": 1.2,
            "desc": "The 'ElevenLabs' sweet spot. Balanced prosody."
        },
        "3_Expressive_Acting": {
            "temperature": 0.85, 
            "top_p": 0.65, 
            "repetition_penalty": 1.1,
            "desc": "High risk, high reward. Maximum emotion and variety."
        }
    }

    print(f"\nGenerating 3 variations for: '{processed_text[:50]}...'")

    for name, params in profiles.items():
        print(f" > Generating {name}... ({params['desc']})")
        
        request = ServeTTSRequest(
            text=processed_text,
            references=[], 
            reference_id=ref_name,
            max_new_tokens=1024,
            chunk_length=200,
            top_p=params["top_p"],
            repetition_penalty=params["repetition_penalty"],
            temperature=params["temperature"],
            seed=None,
            format="wav"
        )

        try:
            audio_data = next(inference(request, engine))
            output_path = f"tuning_{name}.wav"
            sf.write(output_path, audio_data, 44100, format='wav')
            print(f"   [DONE] Saved to: {output_path}")
        except Exception as e:
            print(f"   [ERROR] Failed {name}: {e}")

    print("\n--- TUNING COMPLETE ---")
    print("Compare the 3 files to find your 'Golden Ratio'.")

if __name__ == "__main__":
    tune()
