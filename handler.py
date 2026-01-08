import sys
import traceback
import os

# Force unbuffered output for RunPod
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

print("--- [DEBUG] Starting handler script (V2-Safe)... ---", file=sys.stderr, flush=True)

try:
    print("--- [DEBUG] Checking Checkpoints... ---", file=sys.stderr, flush=True)
    
    # v8 Module 2: Network Volume Optimization
    # Prioritize Network Volume if available
    NETWORK_VOLUME_PATH = "/runpod-volume/checkpoints/openaudio-s1-mini"
    LOCAL_CHECKPOINT_PATH = "checkpoints/openaudio-s1-mini"
    
    if os.path.exists(NETWORK_VOLUME_PATH):
        checkpoint_dir = NETWORK_VOLUME_PATH
        print(f"--- [v8 OPTIMIZATION] Using Network Volume: {checkpoint_dir} ---", file=sys.stderr, flush=True)
    else:
        checkpoint_dir = LOCAL_CHECKPOINT_PATH
        print(f"--- [v8 INFO] Using Local Checkpoints: {checkpoint_dir} ---", file=sys.stderr, flush=True)

    if not os.path.exists(checkpoint_dir):
        print(f"--- [CRITICAL] Checkpoint dir {checkpoint_dir} MISSING! ---", file=sys.stderr, flush=True)
        print(f"--- [DEBUG] Files in /app: {os.listdir('.')} ---", file=sys.stderr, flush=True)
    else:
        # v8 Module 2: Pre-warming
        # specific file touching to trigger page cache impact from network volume
        print(f"--- [v8 PRE-WARM] Touching model files in {checkpoint_dir}... ---", file=sys.stderr, flush=True)
        try:
            for fname in os.listdir(checkpoint_dir):
                fpath = os.path.join(checkpoint_dir, fname)
                if os.path.isfile(fpath):
                    with open(fpath, 'rb') as f:
                        f.read(1024) # Read first 1KB to trigger OS cache
        except Exception as e:
            print(f"--- [v8 WARNING] Pre-warm failed: {e} ---", file=sys.stderr, flush=True)

    print("--- [DEBUG] Importing Core Libraries... ---", file=sys.stderr, flush=True)
    import base64
    import io
    import torch
    import numpy as np
    import runpod
    import boto3
    from botocore.exceptions import ClientError

    
    print("--- [DEBUG] Importing Fish Speech Engines... ---", file=sys.stderr, flush=True)
    from tools.server.model_manager import ModelManager
    from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio

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
        compile=True,       
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
            task = job_input.get("task", "tts") # Default to TTS

            # --- v10: Presigned URL Generation ---
            if task == "generate_presigned_url":
                filename = job_input.get("filename")
                if not filename:
                    return {"error": "Filename required", "status": "failed"}

                print(f"--- [v10 UPLOAD] Generating URL for: {filename} ---", file=sys.stderr, flush=True)

                s3_access_key = os.environ.get("S3_ACCESS_KEY")
                s3_secret_key = os.environ.get("S3_SECRET_KEY")
                s3_bucket_name = os.environ.get("S3_BUCKET_NAME")
                s3_endpoint_url = os.environ.get("S3_ENDPOINT_URL")

                if not (s3_access_key and s3_secret_key and s3_bucket_name):
                    return {"error": "S3 Not Configured", "status": "failed"}

                try:
                    s3_kwargs = {
                        'aws_access_key_id': s3_access_key,
                        'aws_secret_access_key': s3_secret_key,
                    }
                    if s3_endpoint_url:
                        s3_kwargs['endpoint_url'] = s3_endpoint_url

                    s3_client = boto3.client('s3', **s3_kwargs)
                    
                    # Sanitize filename
                    safe_filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '_', '-', '.')]).strip()
                    
                    # Generate Presigned URL for PUT
                    presigned_url = s3_client.generate_presigned_url(
                        'put_object',
                        Params={'Bucket': s3_bucket_name, 'Key': safe_filename},
                        ExpiresIn=300 # 5 minutes
                    )
                    
                    return {
                        "upload_url": presigned_url,
                        "file_key": safe_filename, # The ID the frontend should save
                        "status": "COMPLETED"
                    }
                except Exception as e:
                     print(f"--- [v10 ERROR] Failed to generate URL: {e} ---", file=sys.stderr, flush=True)
                     return {"error": str(e), "status": "failed"}

            # --- v10: List Voices from S3 ---
            if task == "list_voices":
                print(f"--- [v10 LIST] Fetching voices from S3... ---", file=sys.stderr, flush=True)
                s3_access_key = os.environ.get("S3_ACCESS_KEY")
                s3_secret_key = os.environ.get("S3_SECRET_KEY")
                s3_bucket_name = os.environ.get("S3_BUCKET_NAME")
                s3_endpoint_url = os.environ.get("S3_ENDPOINT_URL")

                if not (s3_access_key and s3_secret_key and s3_bucket_name):
                    return {"voices": [], "status": "COMPLETED", "warning": "S3 Not Configured"}

                try:
                    s3_kwargs = {
                        'aws_access_key_id': s3_access_key,
                        'aws_secret_access_key': s3_secret_key,
                    }
                    if s3_endpoint_url:
                        s3_kwargs['endpoint_url'] = s3_endpoint_url

                    s3_client = boto3.client('s3', **s3_kwargs)
                    response = s3_client.list_objects_v2(Bucket=s3_bucket_name)
                    
                    voices = []
                    if 'Contents' in response:
                        for obj in response['Contents']:
                            key = obj['Key']
                            if key.endswith(('.wav', '.mp3', '.flac')):
                                # Remove extension for display name
                                name = os.path.splitext(key)[0]
                                voices.append({"id": key, "name": name})
                    
                    return {
                        "voices": voices,
                        "status": "COMPLETED"
                    }
                except Exception as e:
                    print(f"--- [v10 ERROR] Failed to list voices: {e} ---", file=sys.stderr, flush=True)
                    return {"error": str(e), "status": "failed"}
            
            # --- Standard TTS Task ---
            if not text:
                return {"error": "No text provided"}

            # v8 Module 3: 1200 Character Threshold
            if len(text) < 1200:
                print(f"--- [v8 GUARD] Request rejected. Length: {len(text)} < 1200 ---", file=sys.stderr, flush=True)
                return {
                    "error": f"Input must be at least 1200 characters. (Current: {len(text)})",
                    "status": "failed"
                }

            # v8 Module 1: Voice-Lock Protocol Logging
            voice_id = job_input.get("reference_id")
            print(f"--- [v8 VOICE-LOCK] Target Voice ID: {voice_id} ---", file=sys.stderr, flush=True)

            # Prepare references
            references = []
            
            # v9: S3 Voice Storage Logic
            voice_id = job_input.get("reference_id")
            print(f"--- [v8 VOICE-LOCK] Target Voice ID: {voice_id} ---", file=sys.stderr, flush=True)

            references = []

            # 1. Check for S3 Configuration
            s3_access_key = os.environ.get("S3_ACCESS_KEY")
            s3_secret_key = os.environ.get("S3_SECRET_KEY")
            s3_bucket_name = os.environ.get("S3_BUCKET_NAME")
            s3_endpoint_url = os.environ.get("S3_ENDPOINT_URL") # Optional

            if voice_id and s3_access_key and s3_secret_key and s3_bucket_name:
                print(f"--- [v9 S3] Attempting to fetch '{voice_id}' from S3... ---", file=sys.stderr, flush=True)
                
                # Setup S3 Client
                s3_kwargs = {
                    'aws_access_key_id': s3_access_key,
                    'aws_secret_access_key': s3_secret_key,
                }
                if s3_endpoint_url:
                    s3_kwargs['endpoint_url'] = s3_endpoint_url
                
                s3_client = boto3.client('s3', **s3_kwargs)

                # Local Cache Path
                # Sanitize voice_id to prevent path traversal
                safe_voice_id = "".join([c for c in voice_id if c.isalpha() or c.isdigit() or c in (' ', '_', '-')]).strip()
                local_voice_path = f"/tmp/{safe_voice_id}.wav"

                # Check Cache First
                if os.path.exists(local_voice_path):
                     print(f"--- [v9 S3] Cache HIT for {safe_voice_id} ---", file=sys.stderr, flush=True)
                else:
                    print(f"--- [v9 S3] Cache MISS. Downloading... ---", file=sys.stderr, flush=True)
                    try:
                        # Try exact match first, then with extensions
                        keys_to_try = [voice_id, f"{voice_id}.wav", f"voices/{voice_id}", f"voices/{voice_id}.wav"]
                        downloaded = False
                        
                        for key in keys_to_try:
                            try:
                                s3_client.download_file(s3_bucket_name, key, local_voice_path)
                                print(f"--- [v9 S3] Successfully downloaded: {key} ---", file=sys.stderr, flush=True)
                                downloaded = True
                                break
                            except ClientError:
                                continue
                        
                        if not downloaded:
                             print(f"--- [v9 ERROR] File not found in S3 bucket for ID: {voice_id} ---", file=sys.stderr, flush=True)
                    except Exception as e:
                         print(f"--- [v9 ERROR] S3 Download Failed: {e} ---", file=sys.stderr, flush=True)

                # Load into Reference
                if os.path.exists(local_voice_path):
                    try:
                        with open(local_voice_path, "rb") as f:
                            audio_bytes = f.read()
                        references.append(ServeReferenceAudio(
                            audio=audio_bytes,
                            text="" 
                        ))
                        print(f"--- [v9 S3] Loaded reference audio from cache. ---", file=sys.stderr, flush=True)
                    except Exception as e:
                        print(f"--- [v9 ERROR] Failed to read cached audio: {e} ---", file=sys.stderr, flush=True)
                else:
                    print(f"--- [v10 INFO] Voice '{voice_id}' not in S3. Falling back to Local Disk... ---", file=sys.stderr, flush=True)

            # 2. Local Disk Fallback (Always run if references is still empty)
            if voice_id and not references:
                preset_path = os.path.join("/app/references", voice_id)
                if os.path.exists(preset_path) and os.path.isdir(preset_path):
                     # ... existing finding logic ...
                    print(f"--- [v8 VOICE-LOCK] Found Preset Folder: {preset_path} ---", file=sys.stderr, flush=True)
                    # Find first audio file
                    audio_file = None
                    for f in os.listdir(preset_path):
                        if f.endswith(('.wav', '.mp3', '.flac')):
                            audio_file = os.path.join(preset_path, f)
                            break
                    
                    if audio_file:
                        print(f"--- [v8 VOICE-LOCK] Loading Audio: {audio_file} ---", file=sys.stderr, flush=True)
                        try:
                            with open(audio_file, "rb") as f:
                                audio_bytes = f.read()
                            references.append(ServeReferenceAudio(
                                audio=audio_bytes,
                                text="" 
                            ))
                        except Exception as e:
                            print(f"--- [v8 ERROR] Failed to load preset audio: {e} ---", file=sys.stderr, flush=True)
                    else:
                         print(f"--- [v8 WARNING] No audio file found in preset folder {preset_path} ---", file=sys.stderr, flush=True)

            # Add explicit references from input if any (merging strategy)
            for ref in job_input.get("references", []):
                references.append(ServeReferenceAudio(
                    audio=ref.get("audio"),
                    text=ref.get("text")
                ))

            req = ServeTTSRequest(
                text=text,
                chunk_length=job_input.get("chunk_length", 200),
                format=job_input.get("format", "wav"),
                references=references,
                reference_id=job_input.get("reference_id"),
                seed=job_input.get("seed"),
                use_memory_cache=job_input.get("use_memory_cache", "off"),
                normalize=job_input.get("normalize", True),
                streaming=job_input.get("streaming", False),
                max_new_tokens=job_input.get("max_new_tokens", 1024),
                top_p=job_input.get("top_p", 0.7),
                repetition_penalty=job_input.get("repetition_penalty", 1.2),
                temperature=job_input.get("temperature", 0.7),
                pause_amount=job_input.get("pause_amount", 0.0),
                speed=job_input.get("speed", 1.0),
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
            
            # v10.1: Memory Cleanup
            del audio_data, data, audio_buffer, req
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                print(f"--- [v10.1 MEMORY] Cleanup complete. Max VRAM: {torch.cuda.max_memory_allocated() / 1024**2:.2f} MiB ---", file=sys.stderr, flush=True)

            return {
                "audio_base64": audio_base64,
                "format": "wav",
                "status": "COMPLETED"
            }
        except Exception as e:
            print(f"--- [ERROR] Inference failed: {str(e)} ---", file=sys.stderr, flush=True)
            traceback.print_exc()
            return {"error": str(e), "status": "failed"}
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    # Start the worker
    if __name__ == "__main__":
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
