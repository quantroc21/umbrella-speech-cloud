
import urllib.request
import os

print("Downloading codec...")
try:
    urllib.request.urlretrieve("https://huggingface.co/fishaudio/fish-speech-1.5/resolve/main/firefly-gan-vq-fsq-8x1024-21hz-generator.pth", "checkpoints/fish-speech-1.5/codec.pth")
    print("Codec Downloaded.")
except Exception as e:
    print(f"Codec Download Failed: {e}")
