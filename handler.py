import sys
import traceback
import os
from loguru import logger

# Force unbuffered output for RunPod
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

print("--- [DEBUG] Starting handler script (V2-Safe)... ---", file=sys.stderr, flush=True)

try:
    print("--- [DEBUG] Checking Checkpoints... ---", file=sys.stderr, flush=True)
    
    # v12.10: Dynamic Volume Discovery & Debugging
    # Search common mount points for the 1.5 model
    print("--- [v12.10 DEBUG] Searching for Network Volume... ---", file=sys.stderr, flush=True)
    
    # List root directory to help find where the volume is
    try:
        print(f"--- [v12.10 DEBUG] Root Directory Contents: {os.listdir('/')} ---", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"--- [v12.10 DEBUG] Could not list /: {e} ---", file=sys.stderr, flush=True)

    possible_mounts = [
        "/runpod-volume",
        "/fish-speech-volume", # Name based mount?
        "/workspace",
        "/volume",
        "/data"
    ]
    
    FISH_1_5_VOLUME = None
    for mount in possible_mounts:
        check_path = os.path.join(mount, "checkpoints", "fish-speech-1.5")
        if os.path.exists(check_path):
            FISH_1_5_VOLUME = check_path
            print(f"--- [v12.10 FOUND] Found 1.5 Model at: {FISH_1_5_VOLUME} ---", file=sys.stderr, flush=True)
            break
        else:
             print(f"--- [v12.10 SEARCH] Not found at: {check_path} ---", file=sys.stderr, flush=True)

    if FISH_1_5_VOLUME:
        checkpoint_dir = FISH_1_5_VOLUME
        print(f"--- [v12.10 UPGRADE] Volume Status: READY (v1.5) ---", file=sys.stderr, flush=True)
        # v12: Pre-warm the volume files to RAM
        print(f"--- [v12.10 INIT] Pre-warming 4GB Model Weights (v1.5)... ---", file=sys.stderr, flush=True)
    else:
        # Fallback to local
        checkpoint_dir = "checkpoints/openaudio-s1-mini"
        print(f"--- [v12.10 WARNING] Fish 1.5 NOT Found! Fallback to: {checkpoint_dir} ---", file=sys.stderr, flush=True)
        # We will allow fallback for now to see logs, but warn heavily
        
    # v8 Module 2: Pre-warming
    if os.path.exists(checkpoint_dir):
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
    import re
    import random
    import torch
    import numpy as np
    import runpod
    import boto3
    import soundfile as sf
    from botocore.exceptions import ClientError

    
    print("--- [DEBUG] Importing Fish Speech Engines... ---", file=sys.stderr, flush=True)
    from tools.server.model_manager import ModelManager
    from fish_speech.utils.schema import ServeTTSRequest, ServeReferenceAudio

    # --- Configuration ---
    LLAMA_CHECKPOINT_PATH = checkpoint_dir
    
    # v12.3 Smart Decoder Discovery: 
    # v1.5 uses firefly-gan-vq-fsq-8x1024-21hz-generator.pth
    # Legacy uses codec.pth
    possibilities = [
        "codec.pth",
        "firefly-gan-vq-fsq-8x1024-21hz-generator.pth"
    ]
    decoder_file = "codec.pth" # Default
    for p in possibilities:
        if os.path.exists(os.path.join(checkpoint_dir, p)):
            decoder_file = p
            break
            
    DECODER_CHECKPOINT_PATH = os.path.join(checkpoint_dir, decoder_file)
    DECODER_CONFIG_NAME = "modded_dac_vq"
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"--- [v12.10 CONFIG] Llama: {LLAMA_CHECKPOINT_PATH} ---", file=sys.stderr, flush=True)
    print(f"--- [v12.10 CONFIG] Decoder: {DECODER_CHECKPOINT_PATH} ---", file=sys.stderr, flush=True)

    # --- Initialization (Cold Start) ---
    print(f"--- [COLD START] Loading Models on {DEVICE}... ---", file=sys.stderr, flush=True)
    model_manager = ModelManager(
        mode="tts",
        device=DEVICE,
        half=True if DEVICE == "cuda" else False,           
        compile=True, # v10.7: Re-enable JIT for 186 tokens/s speed (Trade-off: slower startup)       
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

            # --- v11: Proxy Upload (Bypass CORS) ---
            if task == "proxy_upload":
                filename = job_input.get("filename")
                audio_b64 = job_input.get("audio_b64")
                text_content = job_input.get("text", "") # Optional transcript
                
                if not filename or not audio_b64:
                    return {"error": "Filename and audio data required", "status": "failed"}

                print(f"--- [v11 PROXY] Uploading: {filename} ---", file=sys.stderr, flush=True)

                s3_access_key = os.environ.get("S3_ACCESS_KEY")
                s3_secret_key = os.environ.get("S3_SECRET_KEY")
                s3_bucket_name = os.environ.get("S3_BUCKET_NAME")
                s3_endpoint_url = os.environ.get("S3_ENDPOINT_URL")

                if not (s3_access_key and s3_secret_key and s3_bucket_name):
                    return {"error": "S3 Not Configured on Backend", "status": "failed"}

                try:
                    s3_kwargs = {
                        'aws_access_key_id': s3_access_key,
                        'aws_secret_access_key': s3_secret_key,
                    }
                    if s3_endpoint_url:
                        s3_kwargs['endpoint_url'] = s3_endpoint_url

                    s3_client = boto3.client('s3', **s3_kwargs)
                    
                    # Sanitize filename & ID
                    voice_name = os.path.splitext(filename)[0]
                    safe_name = "".join([c for c in voice_name if c.isalpha() or c.isdigit() or c in (' ', '_', '-')]).strip()
                    
                    # Target Paths: voice-clones/references/{id}/{id}.wav
                    audio_key = f"voice-clones/references/{safe_name}/{safe_name}.wav"
                    text_key = f"voice-clones/references/{safe_name}/{safe_name}.txt"

                    # Decode and Upload Audio
                    audio_data = base64.b64decode(audio_b64)
                    s3_client.put_object(
                        Bucket=s3_bucket_name,
                        Key=audio_key,
                        Body=audio_data,
                        ContentType="audio/wav"
                    )

                    # Upload Transcript if provided
                    if text_content:
                        s3_client.put_object(
                            Bucket=s3_bucket_name,
                            Key=text_key,
                            Body=text_content.encode('utf-8'),
                            ContentType="text/plain"
                        )

                    print(f"--- [v11 PROXY] Successfully saved: {safe_name} ---", file=sys.stderr, flush=True)
                    return {
                        "message": f"Voice '{safe_name}' saved successfully",
                        "voice_id": safe_name,
                        "status": "COMPLETED"
                    }
                except Exception as e:
                    print(f"--- [v11 ERROR] Proxy Upload Failed: {e} ---", file=sys.stderr, flush=True)
                    return {"error": str(e), "status": "failed"}

            # --- v10: Presigned URL Generation (LEAVE FOR LEGACY COMPATIBILITY) ---
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

            # v8 Module 3: 500 Character Threshold (Lowered in v10.9)
            if len(text) < 500:
                print(f"--- [v10.9 GUARD] Request rejected. Length: {len(text)} < 500 ---", file=sys.stderr, flush=True)
                return {
                    "error": f"Input must be at least 500 characters. (Current: {len(text)})",
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
                        # User structure: voice-clones/references/{id}/{id}.wav
                        keys_to_try = [
                            f"voice-clones/references/{voice_id}/{voice_id}.wav",
                            f"voice-clones/references/{voice_id}/{voice_id}.mp3",
                            f"references/{voice_id}/{voice_id}.wav",
                            f"voices/{voice_id}/{voice_id}.wav",
                            f"{voice_id}/{voice_id}.wav",
                            f"{voice_id}.wav", 
                            voice_id
                        ]
                        downloaded = False
                        found_key = None
                        
                        for key in keys_to_try:
                            try:
                                s3_client.download_file(s3_bucket_name, key, local_voice_path)
                                print(f"--- [v9 S3] Successfully downloaded: {key} ---", file=sys.stderr, flush=True)
                                downloaded = True
                                found_key = key
                                break
                            except ClientError:
                                continue
                        
                        if not downloaded:
                             print(f"--- [v9 ERROR] File not found in S3 bucket for ID: {voice_id} ---", file=sys.stderr, flush=True)
                        elif found_key:
                             # --- v11: Fetch Pair Transcript ---
                             # Deduce text key: replace .wav/.mp3 with .txt
                             root, ext = os.path.splitext(found_key)
                             text_key = root + ".txt"
                             local_text_path = local_voice_path.replace(os.path.splitext(local_voice_path)[1], ".txt")
                             
                             print(f"--- [v11 S3] Looking for transcript: {text_key} ---", file=sys.stderr, flush=True)
                             try:
                                 s3_client.download_file(s3_bucket_name, text_key, local_text_path)
                                 print(f"--- [v11 S3] Found pair transcript! ---", file=sys.stderr, flush=True)
                             except ClientError:
                                 print(f"--- [v11 S3] No transcript found. Using default. ---", file=sys.stderr, flush=True)

                    except Exception as e:
                         print(f"--- [v9 ERROR] S3 Download Failed: {e} ---", file=sys.stderr, flush=True)

                # Load into Reference
                if os.path.exists(local_voice_path):
                    try:
                        # Read audio
                        with open(local_voice_path, "rb") as f:
                            audio_bytes = f.read()
                        
                        # Read text if exists
                        ref_text = ""
                        local_text_path = local_voice_path.replace(os.path.splitext(local_voice_path)[1], ".txt")
                        if os.path.exists(local_text_path):
                             try:
                                 with open(local_text_path, "r", encoding="utf-8") as ft:
                                     ref_text = ft.read().strip()
                                 print(f"--- [v11 S3] Using Transcript: {ref_text[:30]}... ---", file=sys.stderr, flush=True)
                             except Exception as e:
                                 print(f"--- [v11 ERROR] Failed to read transcript: {e} ---", file=sys.stderr, flush=True)

                        references.append(ServeReferenceAudio(
                            audio=audio_bytes,
                            text=ref_text 
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

            from tools.server.inference import inference_wrapper
            
            # Seed random for reproducibility if seed provided
            if job_input.get("seed"):
                random.seed(job_input.get("seed"))

            sample_rate = engine.decoder_model.sample_rate
            final_audio_segments = []
            
            # Prosody: Split Text logic (Paragraphs -> Sentences -> Phrases)
            paragraphs = [p for p in text.splitlines() if p.strip()]
            
            print(f"--- [v10.5 PROSODY] Processing {len(paragraphs)} paragraphs (Stochastic Mode)... ---", file=sys.stderr, flush=True)
            
            for i, paragraph in enumerate(paragraphs):
                is_last_paragraph = (i == len(paragraphs) - 1)
                
                # regex to capture: ... | . | ! | ? | , | ; | — (em dash) | - (hyphen acting as break)
                # We prioritize ... over . by placing it first
                chunks = re.split(r'(\.\.\.|[.!?;]+|[—,]|\- )', paragraph)
                
                current_chunk_text = ""
                
                for j, token in enumerate(chunks):
                    if not token.strip():
                        continue
                        
                    # Check if it's punctuation delimiter
                    # Matches any of our delimiters
                    if re.match(r'^(\.\.\.|[.!?;]+|[—,]|\- )$', token.strip()):
                        current_chunk_text += token
                        punct = token.strip()
                        
                        # --- STOCHASTIC PAUSE LOGIC (v10.8 Tighter) ---
                        pause_duration = 0.0
                        
                        # 1. Comma / Semicolon (Barely noticeable breath)
                        if punct in [",", ";"]:
                             # v10.8: 0.1s - 0.2s
                             pause_duration = random.uniform(0.1, 0.2)
                        
                        # 2. Period / Exclamation / Question (Natural Flow)
                        elif any(c in punct for c in ".!?") and "..." not in punct:
                             # v10.8: 0.4s - 0.6s
                             pause_duration = random.uniform(0.4, 0.6)
                        
                        # 3. Ellipsis (Hesitation)
                        elif "..." in punct:
                             # v10.8: 1.0s - 1.2s
                             pause_duration = random.uniform(1.0, 1.2)
                        
                        # 4. Dash (Quick Break)
                        elif "—" in punct or "-" in punct:
                             # v10.8: 0.2s - 0.4s
                             pause_duration = random.uniform(0.2, 0.4)
                        
                        # --- VARIABLE SPEED DE-CELERATION (Landing the message) ---
                        # Default Speed: Slightly brisk (0.95 - 1.05)
                        chunk_speed = random.uniform(0.95, 1.05)
                        
                        # Check if it's a sentence end AND it's the last chunk of the paragraph
                        # We check if we are within the last 2 items (Ref accounting for potential trailing empty string)
                        is_sentence_end = any(c in punct for c in ".!?")
                        is_paragraph_end = (j >= len(chunks) - 2)
                        
                        if is_sentence_end and is_paragraph_end:
                            # Slow down ONLY at the very end to "land" the thought
                            chunk_speed = random.uniform(0.80, 0.85)

                        # Generate Audio for this chunk
                        logger.info(f"--- [v12.10 TRACE] Inference Start ---")
                        logger.info(f"Chunk Text: '{current_chunk_text[:50]}...' ({len(current_chunk_text)} chars)")
                        logger.info(f"Speed: {chunk_speed:.2f} | Pause: {pause_duration:.2f}s")
                        logger.info(f"References Count: {len(references)}")
                        if len(references) > 0:
                            for idx, ref in enumerate(references):
                                logger.info(f"  Ref {idx}: text='{ref.text[:30]}...', audio_len={len(ref.audio)}")

                        req = ServeTTSRequest(
                            text=current_chunk_text,
                            chunk_length=job_input.get("chunk_length", 200),
                            format="wav", 
                            references=references, # Passing the loaded [ServeReferenceAudio]
                            reference_id=None, # IMPORTANT: Force use of 'references' list, ignore ID to prevent lookup conflicts
                            seed=job_input.get("seed"),
                            use_memory_cache=job_input.get("use_memory_cache", "off"),
                            normalize=job_input.get("normalize", True),
                            streaming=False,
                            max_new_tokens=job_input.get("max_new_tokens", 1024),
                            top_p=job_input.get("top_p", 0.7),
                            repetition_penalty=job_input.get("repetition_penalty", 1.2),
                            temperature=job_input.get("temperature", 0.7),
                            pause_amount=0.0,
                            speed=chunk_speed,
                        )
                        
                        chunk_audio_data = []
                        for res in inference_wrapper(req, engine):
                            if isinstance(res, np.ndarray):
                                chunk_audio_data.append(res)
                        
                        if chunk_audio_data:
                            final_audio_segments.extend(chunk_audio_data)
                            
                            # Append Silence
                            if pause_duration > 0:
                                silence_samples = int(sample_rate * pause_duration)
                                # Match dtype of audio (usually float32 from model, but let's check)
                                if chunk_audio_data[0].dtype.kind == 'i':
                                     final_audio_segments.append(np.zeros(silence_samples, dtype=chunk_audio_data[0].dtype))
                                else:
                                     final_audio_segments.append(np.zeros(silence_samples, dtype=np.float32))

                        current_chunk_text = "" # Reset
                        
                    else:
                        current_chunk_text += token
                
                # Loose end (End of paragraph without punctuation)
                if current_chunk_text.strip():
                        print(f"--- [PROSODY] Final Chunk (Para): '{current_chunk_text[:15]}...' ---", file=sys.stderr, flush=True)
                        req = ServeTTSRequest(
                            text=current_chunk_text,
                            chunk_length=job_input.get("chunk_length", 200),
                            format="wav", 
                            references=references,
                            reference_id=None, # Fix: Use loaded references
                            seed=job_input.get("seed"),
                            use_memory_cache=job_input.get("use_memory_cache", "off"),
                            normalize=job_input.get("normalize", True),
                            streaming=False,
                            max_new_tokens=job_input.get("max_new_tokens", 1024),
                            top_p=job_input.get("top_p", 0.7),
                            repetition_penalty=job_input.get("repetition_penalty", 1.2),
                            temperature=job_input.get("temperature", 0.7),
                            pause_amount=0.0,
                            speed=0.9,
                        )
                        for res in inference_wrapper(req, engine):
                            if isinstance(res, np.ndarray):
                                final_audio_segments.append(res)
                
                # Paragraph Pause (v10.8: 0.8s - 1.2s)
                if not is_last_paragraph:
                     para_pause = random.uniform(0.8, 1.2)
                     silence_samples = int(sample_rate * para_pause)
                     print(f"--- [PROSODY] Paragraph Break: {para_pause:.2f}s ---", file=sys.stderr, flush=True)
                     final_audio_segments.append(np.zeros(silence_samples, dtype=np.float32))

            # Final Stitching
            audio_buffer = io.BytesIO()
            
            if final_audio_segments:
                if final_audio_segments[0].dtype.kind == 'i':
                    final_audio = np.concatenate(final_audio_segments)
                else:
                    final_audio = np.concatenate(final_audio_segments).astype(np.float32)
                
                # Force PCM_16 for 50% smaller transfer size and better compatibility
                sf.write(audio_buffer, final_audio, sample_rate, format='WAV', subtype='PCM_16')
                
                size_kb = audio_buffer.tell() / 1024
                print(f"--- [v11.2] Final Audio Size: {size_kb:.2f} KB | Duration: {len(final_audio)/sample_rate:.2f}s ---", file=sys.stderr, flush=True)
            else:
                 return {"error": "No audio data generated", "status": "failed"}

            audio_buffer.seek(0)
            data = audio_buffer.read()
            audio_base64 = base64.b64encode(data).decode("utf-8")
            
            # v10.1: Memory Cleanup
            del final_audio_segments, data, audio_buffer
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                print(f"--- [v10.1 MEMORY] Cleanup complete. Max VRAM: {torch.cuda.max_memory_allocated() / 1024**2:.2f} MiB ---", file=sys.stderr, flush=True)

            return {
                "audio_base64": audio_base64,
                "format": "wav",
                "status": "COMPLETED"
            }
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
