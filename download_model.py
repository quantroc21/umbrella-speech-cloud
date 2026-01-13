
from huggingface_hub import snapshot_download
print("Downloading FishSpeech 1.5 checkpoints...")
try:
    snapshot_download(repo_id="fishaudio/fish-speech-1.5", local_dir="checkpoints/fish-speech-1.5")
    print("Download Complete.")
except Exception as e:
    print(f"Download Failed: {e}")
