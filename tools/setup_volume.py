
import os
import sys
import shutil
from huggingface_hub import snapshot_download

# --- CONFIGURATION ---
# The Target Volume Path on RunPod (Must match what you mount)
VOLUME_ROOT = "/runpod-volume" 
MODEL_DIR = os.path.join(VOLUME_ROOT, "checkpoints", "fish-speech-1.5")
HF_REPO_ID = "fishaudio/fish-speech-1.5"
# SECURE: Read from Environment Variable
HF_TOKEN = os.environ.get("HF_TOKEN")

# NOTE: This script is only for MANUAL Network Volume setup.
# If you are using RunPod's "Model Caching" feature (setting 'Model' in config),
# this script is NOT REQUIRED. runpod.io handles the download automatically.

def setup_volume():
    print(f"--- [SETUP] Starting Volume Setup for Fish Speech 1.5 ---")
    print(f"--- [SETUP] Target Directory: {MODEL_DIR} ---")

    if not HF_TOKEN:
        print("--- [CRITICAL ERROR] HF_TOKEN environment variable is missing! ---")
        print("    -> Please set HF_TOKEN in your RunPod Environment Variables.")
        sys.exit(1)

    # 1. Check if Volume is Mounted
    if not os.path.exists(VOLUME_ROOT):
        print(f"--- [CRITICAL ERROR] Network Volume not found at {VOLUME_ROOT} ---")
        print("    -> Did you add the Volume to the Pod?")
        print("    -> Did you set the Mount Path to /runpod-volume ?")
        sys.exit(1)

    try:
        print(f"--- [SETUP] Downloading Model Weights from {HF_REPO_ID}... ---")
        # specific allow_patterns to get only the needed files, avoiding bloat
        path = snapshot_download(
            repo_id=HF_REPO_ID,
            local_dir=MODEL_DIR,
            token=HF_TOKEN,
            local_dir_use_symlinks=False, # Important for Volume: Real files, not symlinks
            resume_download=True
        )
        print(f"--- [SETUP] Download Complete! ---")
        print(f"    -> Files saved to: {path}")

    except Exception as e:
        print(f"\n--- [CRITICAL ERROR] Download Failed ---")
        print(f"    Error: {e}")
        sys.exit(1)

    # 3. Verification
    print("--- [SETUP] Verifying Files... ---")
    if os.path.exists(MODEL_DIR):
        files = os.listdir(MODEL_DIR)
        print(f"    -> Found files: {files}")
        if not files:
             print(f"--- [CRITICAL ERROR] Directory is empty after download! ---")
             sys.exit(1)
    else:
        print(f"--- [CRITICAL ERROR] Model directory does not exist! ---")
        sys.exit(1)

    print("\n" + "="*50)
    print("✅  SUCCESS! Network Volume is Ready.")
    print(f"    You can now deploy the v12.0 Skeleton Container.")
    print("="*50 + "\n")

if __name__ == "__main__":
    setup_volume()
