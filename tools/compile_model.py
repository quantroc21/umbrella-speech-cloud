import os
import sys
import time
import torch
from loguru import logger

# Add project root to path
sys.path.append(os.getcwd())

from tools.server.model_manager import ModelManager

def main():
    # 1. Setup AOT Cache Directory
    # We use a local directory that can be zipped/copied later
    CACHE_DIR = os.path.join(os.getcwd(), "aot_cache")
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    # Set PyTorch Inductor Cache
    os.environ["TORCHINDUCTOR_CACHE_DIR"] = CACHE_DIR
    # Set Triton Cache (often separate)
    os.environ["TRITON_CACHE_DIR"] = os.path.join(CACHE_DIR, "triton")
    
    # Enable FX Graph Cache (Persistence)
    os.environ["TORCHINDUCTOR_FX_GRAPH_CACHE"] = "1"
    
    logger.info(f"--- AOT Compilation Script ---")
    logger.info(f"Cache Directory: {CACHE_DIR}")
    logger.info(f"Device: {torch.cuda.get_device_name() if torch.cuda.is_available() else 'CPU'}")

    if not torch.cuda.is_available():
        logger.warning("CUDA not available! Compilation will likely fail or produce CPU kernels.")

    # 2. Configuration (Matches handler.py)
    DEVICE = "cuda"
    CHECKPOINT_DIR = "checkpoints/fish-speech-1.5"
    
    # Verify Checkpoints
    if not os.path.exists(CHECKPOINT_DIR):
        logger.error(f"Checkpoint directory {CHECKPOINT_DIR} not found.")
        logger.error("Please run: python tools/download_models.py")
        return

    # 3. Initialize ModelManager
    # This loads the model and prepares the graph
    logger.info("Initializing ModelManager...")
    try:
        manager = ModelManager(
            mode="tts",
            device=DEVICE,
            half=True,       # Consistent with handler.py
            compile=True,    # FORCE Compilation
            asr_enabled=False,
            llama_checkpoint_path=CHECKPOINT_DIR,
            decoder_config_name="firefly_gan_vq",
            decoder_checkpoint_path=os.path.join(CHECKPOINT_DIR, "firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
        )
    except Exception as e:
        logger.error(f"Initialization Failed: {e}")
        raise e

    # 4. Trigger Compilation (Warmup)
    logger.info("Starting Warmup (Triggering Compilation)...")
    start_time = time.time()
    
    # The warm_up method runs a dummy generation
    manager.warm_up(manager.tts_inference_engine)
    
    duration = time.time() - start_time
    logger.success(f"Compilation Complete! Took {duration:.2f}s")
    logger.info(f"Kernels should be cached in {CACHE_DIR}")
    
    # 5. Verify Cache Content
    if os.path.exists(CACHE_DIR):
        files = sum([len(files) for r, d, files in os.walk(CACHE_DIR)])
        logger.info(f"Cache Statistics: {files} files generated.")
    else:
        logger.error("Cache directory is empty! Compilation might have failed or used default path.")

if __name__ == "__main__":
    main()
