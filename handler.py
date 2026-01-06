import sys
import traceback

print("--- [DEBUG] Starting handler script... ---", file=sys.stderr, flush=True)

try:
    print("--- [DEBUG] Importing base64/io... ---", file=sys.stderr, flush=True)
    import base64
    import io
    
    print("--- [DEBUG] Importing torch... ---", file=sys.stderr, flush=True)
    import torch
    
    print("--- [DEBUG] Importing runpod... ---", file=sys.stderr, flush=True)
    import runpod
    
    print("--- [DEBUG] Importing tools... ---", file=sys.stderr, flush=True)
    from tools.server.model_manager import ModelManager
    from fish_speech.utils.schema import ServeTTSRequest

    # --- Configuration ---
    LLAMA_CHECKPOINT_PATH = "checkpoints/openaudio-s1-mini"
    DECODER_CHECKPOINT_PATH = "checkpoints/openaudio-s1-mini/codec.pth"
    DECODER_CONFIG_NAME = "modded_dac_vq"
    DEVICE = "cuda"

    # --- Initialization (Cold Start) ---
    print("--- [COLD START] Loading Models... ---", file=sys.stderr, flush=True)
    model_manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True,           
        compile=False,       
        llama_checkpoint_path=LLAMA_CHECKPOINT_PATH,
        decoder_checkpoint_path=DECODER_CHECKPOINT_PATH,
        decoder_config_name=DECODER_CONFIG_NAME
    )
    engine = model_manager.tts_inference_engine
    print("--- [COLD START] Models Loaded! ---", file=sys.stderr, flush=True)

    def handler(job):
        """
        RunPod Serverless Handler
        """
        print(f"--- [DEBUG] Handling Request: {job['id']} ---", file=sys.stderr, flush=True)
        job_input = job["input"]
        
        # 1. Parse Input
        text = job_input.get("text")
        if not text:
            return {"error": "No text provided"}

        # Default settings
        req = ServeTTSRequest(
            text=text,
            reference_id=job_input.get("reference_id"),
            chunk_length=job_input.get("chunk_length", 200),
            format="wav",
            max_new_tokens=job_input.get("max_new_tokens", 0), 
            top_p=job_input.get("top_p", 0.7),
            repetition_penalty=job_input.get("repetition_penalty", 1.2),
            temperature=job_input.get("temperature", 0.7),
        )

        # 2. Run Inference
        audio_buffer = io.BytesIO()
        from tools.server.inference import inference_wrapper
        
        # Iterate and collect audio chunks
        for chunk in inference_wrapper(req, engine):
            if isinstance(chunk, bytes):
                audio_buffer.write(chunk)
                
        # 3. Return Base64 Audio
        audio_buffer.seek(0)
        audio_base64 = base64.b64encode(audio_buffer.read()).decode("utf-8")
        
        return {
            "audio_base64": audio_base64,
            "format": "wav",
            "status": "success"
        }

    # Start the worker
    print("--- [DEBUG] Starting RunPod Serverless Listener... ---", file=sys.stderr, flush=True)
    runpod.serverless.start({"handler": handler})

except Exception:
    print("--- [CRITICAL ERROR] HANDLER CRASHED ---", file=sys.stderr, flush=True)
    traceback.print_exc()
    sys.exit(1)
