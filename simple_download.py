
import urllib.request
import os

os.makedirs("checkpoints/fish-speech-1.5", exist_ok=True)
print("Downloading model.pth...")
urllib.request.urlretrieve("https://huggingface.co/fishaudio/fish-speech-1.5/resolve/main/model.pth", "checkpoints/fish-speech-1.5/model.pth")
print("Downloading codec.pth...")
# Note: verifying if codec exists in 1.5 repo. If not, we use S1's codec? 
# Usually FireflyGAN comes with its own. 
# Repos usually have 'firefly-gan-vq-fsq-8x1024-21hz-generator.pth' or similar?
# I will try to download 'model.pth' first.
print("Done.")
