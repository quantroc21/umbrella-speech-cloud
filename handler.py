import sys
import traceback
import os

# Force unbuffered output for RunPod
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

print("--- [DEBUG] Starting handler script (V2-Safe)... ---", file=sys.stderr, flush=True)

try:
    print("--- [DEBUG] Checking Checkpoints... ---", file=sys.stderr, flush=True)
    checkpoint_dir = "checkpoints/openaudio-s1-mini"
    if not os.path.exists(checkpoint_dir):
        print(f"--- [CRITICAL] Checkpoint dir {checkpoint_dir} MISSING! ---", file=sys.stderr, flush=True)
        # List current dir to debug
        print(f"--- [DEBUG] Files in /app: {os.listdir('.')} ---", file=sys.stderr, flush=True)
    else:
        print(f"--- [DEBUG] Checkpoints found: {os.listdir(checkpoint_dir)} ---", file=sys.stderr, flush=True)

    print("--- [DEBUG] Importing Core Libraries... ---", file=sys.stderr, flush=True)
    import base64
    import io
    import torch
    import runpod
    
    print("--- [DEBUG] Importing Fish Speech Engines... ---", file=sys.stderr, flush=True)
    from tools.server.model_manager import ModelManager
    from fish_speech.utils.schema import ServeTTSRequest

    # --- Configuration ---
    LLAMA_CHECKPOINT_PATH = checkpoint_dir
    DECODER_CHECKPOINT_PATH = f"{checkpoint_dir}/codec.pth"
    DECODER_CONFIG_NAME = "modded_dac_vq"
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

    # --- Initialization (Cold Start) ---
    print(f"--- [COLD START] Loading Models on {DEVICE}... ---", file=sys.stderr, flush=True)
    model_manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True if DEVICE == "cuda" else False,           
        compile=False,       
        llama_checkpoint_path=LLAMA_CHECKPOINT_PATH,
        decoder_checkpoint_path=DECODER_CHECKPOINT_PATH,
        decoder_config_name=DECODER_CONFIG_NAME
    )
    engine = model_manager.tts_inference_engine
    print("--- [COLD START] Models Loaded Successfully! ---", file=sys.stderr, flush=True)

    def handler(job):
        """
        RunPod Serverless Handler
        """
        job_id = job.get('id', 'unknown')
        print(f"--- [DEBUG] Handling Request: {job_id} ---", file=sys.stderr, flush=True)
        
        try:
            job_input = job["input"]
            text = job_input.get("text")
            if not text:
                return {"error": "No text provided"}

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

            import soundfile as sf
            audio_buffer = io.BytesIO()
            from tools.server.inference import inference_wrapper
            
            # The inference_wrapper yields chunks. 
            # In non-streaming mode, it yields one 'final' chunk as a numpy array.
            # In streaming mode, it yields segments as bytes.
            audio_data = []
            sample_rate = engine.decoder_model.sample_rate

            for chunk in inference_wrapper(req, engine):
                if isinstance(chunk, bytes):
                    audio_buffer.write(chunk)
                elif isinstance(chunk, np.ndarray):
                    audio_data.append(chunk)
            
            # If we collected numpy arrays, write them as a WAV file
            if audio_data:
                full_audio = np.concatenate(audio_data) if len(audio_data) > 1 else audio_data[0]
                sf.write(audio_buffer, full_audio, sample_rate, format='WAV')
                    
            audio_buffer.seek(0)
            data = audio_buffer.read()
            if not data:
                return {"error": "No audio data generated", "status": "failed"}

            audio_base64 = base64.b64encode(data).decode("utf-8")
            
            return {
                "audio_base64": audio_base64,
                "format": "wav",
                "status": "success"
            }
        except Exception as e:
            print(f"--- [ERROR] Inference failed: {str(e)} ---", file=sys.stderr, flush=True)
            traceback.print_exc()
            return {"error": str(e), "status": "failed"}

    # Start the worker
    print("--- [DEBUG] RunPod Worker Starting... ---", file=sys.stderr, flush=True)
    runpod.serverless.start({"handler": handler})

except Exception as e:
    print("\n" + "="*50, file=sys.stderr, flush=True)
    print("--- [CRITICAL ERROR] HANDLER FAILED TO START ---", file=sys.stderr, flush=True)
    print(f"Error Type: {type(e).__name__}", file=sys.stderr, flush=True)
    print(f"Error Message: {str(e)}", file=sys.stderr, flush=True)
    print("="*50 + "\n", file=sys.stderr, flush=True)
    traceback.print_exc()
    sys.exit(1)
