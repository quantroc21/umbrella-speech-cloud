from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Optional
import os
import uuid
import httpx
import logging
import json
import shutil
import re
import traceback
from io import BytesIO
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv
from r2_utils import upload_file_object
import subprocess
import tempfile

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
security = HTTPBearer()

# --- Configuration (Loaded from .env) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
RUNPOD_ENDPOINT_ID = os.getenv("RUNPOD_ENDPOINT_ID", "").strip()
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "").strip()

# --- SePay Config ---
SEPAY_API_KEY = os.getenv("SEPAY_API_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Sync def for auth because supabase.auth.get_user is sync and blocks
def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)):
    try:
        user = supabase.auth.get_user(token.credentials)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except Exception as e:
        logger.error(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

class AudioRequest(BaseModel):
    text: str
    voice_id: str
    top_p: float = 0.7
    repetition_penalty: float = 1.2
    temperature: float = 0.7

@app.get("/health")
async def health_test():
    try:
        # Sync call inside async is okay for a simple health check
        supabase.table("profiles").select("count", count="exact").limit(1).execute()
        return {"status": "ok", "database": "connected", "endpoint": RUNPOD_ENDPOINT_ID}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str, user=Depends(get_current_user)):
    url = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/status/{job_id}"
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=20.0)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except Exception as e:
            logger.error(f"Status check failed: {traceback.format_exc()}")
            raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/generate")
async def generate_audio(request: AudioRequest, user=Depends(get_current_user)):
    user_id = user.id
    estimated_cost = len(request.text)

    # 1. ATOMIC CREDIT DEDUCTION (Sync call, slightly blocking but safer here)
    try:
        rpc_response = supabase.rpc("validate_and_subtract_credits", {
            "p_user_id": user_id,
            "p_char_count": estimated_cost
        }).execute()

        if not rpc_response.data:
            raise HTTPException(status_code=402, detail="Insufficient Credits")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

    # 2. DISPATCH TO RUNPOD
    runpod_payload = {
        "input": {
            "text": request.text,
            "reference_id": request.voice_id,
            "user_id": user_id,
            "top_p": request.top_p,
            "repetition_penalty": request.repetition_penalty,
            "temperature": request.temperature
        }
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run",
                headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
                json=runpod_payload,
                timeout=40.0
            )
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Inference Dispatch Error")
            return response.json()
        except Exception as e:
            logger.error(f"Generation failed: {traceback.format_exc()}")
            raise HTTPException(status_code=502, detail=str(e))

@app.get("/api/voices")
def list_voices(user=Depends(get_current_user)):
    try:
        response = supabase.table("cloned_voices").select("*").eq("user_id", user.id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload_reference")
def upload_reference(
    file: UploadFile = File(...),
    text: str = Form(...),
    name: str = Form(...),
    user=Depends(get_current_user)
):
    try:
        existing_voices = supabase.table("cloned_voices").select("id", count="exact").eq("user_id", user.id).execute()
        if existing_voices.count >= 5:
             raise HTTPException(status_code=403, detail="Slot Limit Reached")

        file_ext = os.path.splitext(file.filename)[1]
        voice_uuid = str(uuid.uuid4())
        unique_filename = f"{user.id}/{voice_uuid}/{voice_uuid}{file_ext}"
        text_filename = f"{user.id}/{voice_uuid}/{voice_uuid}.lab"

        audio_url = upload_file_object(file.file, unique_filename, content_type=file.content_type)
        if not audio_url:
             raise HTTPException(status_code=500, detail="Storage Upload Failed")

        text_file_obj = BytesIO(text.encode('utf-8'))
        upload_file_object(text_file_obj, text_filename, content_type="text/plain")

        db_record = {
            "user_id": user.id,
            "name": name,
            "r2_uuid_path": unique_filename
        }
        supabase.table("cloned_voices").insert(db_record).execute()

        return {"status": "success", "voice_uuid": voice_uuid}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/audio/cut-silence")
async def cut_silence(
    file: UploadFile = File(...),
    threshold: float = Form(-40.0),
    duration: float = Form(0.3),
    user=Depends(get_current_user)
):
    """
    Local silence removal using pydub & ffmpeg.
    Returns the processed file directly (no R2 upload needed).
    """
    from fastapi.responses import FileResponse
    
    try:
        import psutil
        from pydub import AudioSegment
        from pydub.silence import split_on_silence
    except ImportError as e:
        logger.error(f"Missing dependency: {e}")
        return {"status": "error", "error": f"Missing dependency: {e}"}

    process_info = psutil.Process(os.getpid())
    start_ram = process_info.memory_info().rss / 1024 / 1024
    
    # Use a persistent output directory (not tempfile, so FileResponse can serve it)
    output_dir = "/tmp/silence_cutter"
    os.makedirs(output_dir, exist_ok=True)
    
    unique_id = str(uuid.uuid4())
    input_path = os.path.join(output_dir, f"{unique_id}_input.wav")
    output_path = os.path.join(output_dir, f"{unique_id}_output.wav")

    try:
        logger.info(f"Cutting silence [pydub]: {file.filename} (Thresh: {threshold}dB, Dur: {duration}s)")

        # 1. Save uploaded file
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Check size (safety for 2GiB RAM)
        file_size = os.path.getsize(input_path)
        logger.info(f"Input file size: {file_size / 1024:.1f} KB")
        if file_size > 50 * 1024 * 1024:
            return {"status": "error", "error": "Audio file too large (>50MB)"}

        # 3. Load with pydub
        audio = AudioSegment.from_file(input_path)
        logger.info(f"Audio loaded: {audio.duration_seconds:.1f}s, {audio.frame_rate}Hz, {audio.channels}ch")
        
        # Safeguard: Limit to 5 minutes
        if audio.duration_seconds > 300:
            return {"status": "error", "error": "Audio duration exceeds 5 minute limit"}

        # 4. Remove silence
        chunks = split_on_silence(
            audio,
            min_silence_len=int(duration * 1000),
            silence_thresh=int(threshold),
            keep_silence=200
        )
        logger.info(f"Found {len(chunks)} non-silent chunks")

        if not chunks:
            logger.info("No non-silent chunks found, returning original.")
            # Cleanup input
            try: os.remove(input_path)
            except: pass
            return {"status": "success", "duration_changed": False, "message": "No silence removed."}

        # 5. Combine chunks & export
        combined = chunks[0]
        for chunk in chunks[1:]:
            combined += chunk

        combined.export(output_path, format="wav")

        # 6. Monitor usage
        end_ram = process_info.memory_info().rss / 1024 / 1024
        cpu_usage = process_info.cpu_percent(interval=0.1)
        logger.info(f"Stats: RAM Δ{end_ram - start_ram:.1f}MB, CPU {cpu_usage}%, "
                     f"Duration: {audio.duration_seconds:.1f}s → {combined.duration_seconds:.1f}s")

        # 7. Cleanup input file
        try: os.remove(input_path)
        except: pass

        # 8. Return the processed file directly
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename=f"cleaned_{unique_id}.wav",
            headers={
                "X-Original-Duration": str(round(audio.duration_seconds, 2)),
                "X-New-Duration": str(round(combined.duration_seconds, 2)),
                "X-RAM-Usage-MB": str(round(end_ram, 2)),
            }
        )

    except Exception as e:
        logger.error(f"Pydub processing failed: {traceback.format_exc()}")
        # Cleanup
        for p in [input_path, output_path]:
            try: os.remove(p)
            except: pass
        return {"status": "error", "error": f"Silence removal failed: {str(e)}"}

# --- B-roll Search (Multi-Source Video API Proxy) ---
import time as _time

PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "").strip()
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "").strip()
COVERR_API_KEY = os.getenv("COVERR_API_KEY", "").strip()
_broll_cache: dict = {}
BROLL_CACHE_TTL = 1800  # 30 minutes


async def _search_pixabay(client: httpx.AsyncClient, query: str, per_page: int):
    """Search Pixabay Videos API. Returns normalized results."""
    if not PIXABAY_API_KEY:
        return []
    try:
        resp = await client.get(
            "https://pixabay.com/api/videos/",
            params={"key": PIXABAY_API_KEY, "q": query, "per_page": min(per_page, 20)},
        )
        if resp.status_code != 200:
            logger.warning(f"Pixabay API: {resp.status_code}")
            return []
        data = resp.json()
        results = []
        for hit in data.get("hits", []):
            vids = hit.get("videos", {})
            # Pick best quality available
            best = vids.get("large") or vids.get("medium") or vids.get("small", {})
            preview = vids.get("medium") or vids.get("small") or vids.get("tiny", {})
            results.append({
                "id": f"pixabay_{hit['id']}",
                "source": "pixabay",
                "url": hit.get("pageURL", ""),
                "image": f"https://i.vimeocdn.com/video/{hit['id']}_640x360.jpg" if not hit.get("userImageURL") else hit.get("userImageURL", ""),
                "thumbnail": preview.get("thumbnail", ""),
                "duration": int(float(hit.get("duration", 0) or 0)),
                "width": int(float(best.get("width", 0) or 0)),
                "height": int(float(best.get("height", 0) or 0)),
                "video_url": best.get("url", ""),
                "preview_url": preview.get("url", ""),
                "download_url": best.get("url", ""),
                "user_name": hit.get("user", "Pixabay"),
                "user_url": f"https://pixabay.com/users/{hit.get('user', '')}-{hit.get('user_id', '')}/",
                "tags": hit.get("tags", ""),
            })
        logger.info(f"Pixabay: '{query}' → {len(results)} results")
        return results
    except Exception as e:
        logger.warning(f"Pixabay search failed: {e}")
        return []


async def _search_coverr(client: httpx.AsyncClient, query: str, per_page: int):
    """Search Coverr Videos API. Returns normalized results."""
    if not COVERR_API_KEY:
        return []
    try:
        resp = await client.get(
            "https://api.coverr.co/videos",
            params={"query": query, "page_size": min(per_page, 25), "urls": "true"},
            headers={"Authorization": f"Bearer {COVERR_API_KEY}"},
        )
        if resp.status_code != 200:
            logger.warning(f"Coverr API: {resp.status_code}")
            return []
        data = resp.json()
        hits = data.get("hits", data.get("videos", []))
        if isinstance(data, list):
            hits = data
        results = []
        for hit in hits:
            urls = hit.get("urls", {})
            results.append({
                "id": f"coverr_{hit.get('id', '')}",
                "source": "coverr",
                "url": hit.get("url", f"https://coverr.co/videos/{hit.get('id', '')}"),
                "image": hit.get("thumbnail", hit.get("poster", "")),
                "thumbnail": hit.get("thumbnail", ""),
                "duration": hit.get("duration", 0),
                "width": hit.get("width", 1920),
                "height": hit.get("height", 1080),
                "video_url": urls.get("mp4_download", urls.get("mp4", "")),
                "preview_url": urls.get("mp4_preview", urls.get("mp4", "")),
                "download_url": urls.get("mp4_download", urls.get("mp4", "")),
                "user_name": hit.get("creator", {}).get("name", "Coverr"),
                "user_url": "https://coverr.co",
                "tags": hit.get("tags", ""),
            })
        logger.info(f"Coverr: '{query}' → {len(results)} results")
        return results
    except Exception as e:
        logger.warning(f"Coverr search failed: {e}")
        return []


async def _search_pexels(client: httpx.AsyncClient, query: str, per_page: int):
    """Search Pexels Videos API. Returns normalized results."""
    if not PEXELS_API_KEY:
        return []
    try:
        resp = await client.get(
            "https://api.pexels.com/videos/search",
            params={"query": query, "per_page": min(per_page, 15)},
            headers={"Authorization": PEXELS_API_KEY},
        )
        if resp.status_code != 200:
            logger.warning(f"Pexels API: {resp.status_code}")
            return []
        data = resp.json()
        results = []
        for vid in data.get("videos", []):
            # Pick best HD file
            files = vid.get("video_files", [])
            mp4s = [f for f in files if f.get("file_type") == "video/mp4"]
            hd = sorted(mp4s, key=lambda f: int(float(f.get("width", 0) or 0)), reverse=True)
            best = next((f for f in hd if 720 <= int(float(f.get("width", 0) or 0)) <= 1920), hd[0] if hd else {})
            preview = next((f for f in hd if int(float(f.get("width", 0) or 0)) <= 960), best)
            results.append({
                "id": f"pexels_{vid['id']}",
                "source": "pexels",
                "url": vid.get("url", ""),
                "image": vid.get("image", ""),
                "thumbnail": vid.get("image", ""),
                "duration": int(float(vid.get("duration", 0) or 0)),
                "width": int(float(best.get("width", 0) or 0)),
                "height": int(float(best.get("height", 0) or 0)),
                "video_url": best.get("link", ""),
                "preview_url": preview.get("link", best.get("link", "")),
                "download_url": best.get("link", ""),
                "user_name": vid.get("user", {}).get("name", "Pexels"),
                "user_url": vid.get("user", {}).get("url", "https://pexels.com"),
                "tags": "",
            })
        logger.info(f"Pexels: '{query}' → {len(results)} results")
        return results
    except Exception as e:
        logger.warning(f"Pexels search failed: {e}")
        return []


@app.get("/api/broll/search")
async def broll_search(
    query: str = "",
    per_page: int = 24,
    page: int = 1,
    source: str = "all",
    user=Depends(get_current_user)
):
    """Multi-source B-roll search: Pixabay → Coverr → Pexels."""
    if not query.strip():
        return {"videos": [], "total_results": 0}

    # Check cache
    cache_key = f"{query.lower().strip()}|{per_page}|{page}|{source}"
    cached = _broll_cache.get(cache_key)
    if cached and (_time.time() - cached["ts"]) < BROLL_CACHE_TTL:
        logger.info(f"B-roll cache hit: '{query}' source={source}")
        return cached["data"]

    try:
        import asyncio
        each = per_page // 2  # Split across sources

        async with httpx.AsyncClient(timeout=15.0) as client:
            if source == "pixabay":
                all_results = await _search_pixabay(client, query, per_page)
            elif source == "coverr":
                all_results = await _search_coverr(client, query, per_page)
            elif source == "pexels":
                all_results = await _search_pexels(client, query, per_page)
            else:
                # Parallel fetch from all sources
                pixabay_task = _search_pixabay(client, query, each)
                coverr_task = _search_coverr(client, query, each)
                pexels_task = _search_pexels(client, query, each)
                pixabay_r, coverr_r, pexels_r = await asyncio.gather(
                    pixabay_task, coverr_task, pexels_task
                )
                # Interleave: prioritize Pixabay and Coverr
                all_results = []
                sources = [pixabay_r, coverr_r, pexels_r]
                max_len = max(len(s) for s in sources) if sources else 0
                for i in range(max_len):
                    for src in sources:
                        if i < len(src):
                            all_results.append(src[i])

        # Sort by resolution (higher = more cinematic), then duration (longer = better)
        all_results.sort(key=lambda v: (int(float(v.get("width", 0) or 0)) * int(float(v.get("height", 0) or 0)), int(float(v.get("duration", 0) or 0))), reverse=True)

        result = {
            "videos": all_results[:per_page],
            "total_results": len(all_results),
            "page": page,
            "per_page": per_page,
            "sources": {
                "pixabay": bool(PIXABAY_API_KEY),
                "coverr": bool(COVERR_API_KEY),
                "pexels": bool(PEXELS_API_KEY),
            }
        }

        # Cache result
        _broll_cache[cache_key] = {"data": result, "ts": _time.time()}
        if len(_broll_cache) > 200:
            oldest_key = min(_broll_cache, key=lambda k: _broll_cache[k]["ts"])
            del _broll_cache[oldest_key]

        logger.info(f"B-roll multi-search: '{query}' → {len(result['videos'])} total results")
        return result

    except Exception as e:
        logger.error(f"B-roll search failed: {traceback.format_exc()}")
        return {"error": f"B-roll search failed: {str(e)}"}

class ScriptRequest(BaseModel):
    script: str
    genre: str = "general"  # documentary, youtube_faceless, marketing, educational, general

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()

# Genre-specific visual style guidance (NO hard segment caps)
GENRE_GUIDE = {
    "documentary": {
        "label": "Documentary",
        "style": "Cinematic, slow, contemplative. Wide establishing shots, detailed close-ups, natural lighting. Warm color grading."
    },
    "youtube_faceless": {
        "label": "YouTube Faceless",
        "style": "Fast-paced, punchy, high-energy. Dynamic transitions, bold visuals, trending aesthetic. Vibrant saturated colors."
    },
    "marketing": {
        "label": "Marketing / Ad",
        "style": "Premium, polished, aspirational. Clean compositions, professional lighting, brand-safe. Sleek modern aesthetic."
    },
    "educational": {
        "label": "Educational",
        "style": "Clear, informative, illustrative. Diagrams, demonstrations, step-by-step visuals. Bright even lighting."
    },
    "general": {
        "label": "General Cinematic",
        "style": "Professional, versatile, visually rich. Balanced pacing, high production value. Cinematic color grading."
    },
}

@app.post("/api/ai-keywords")
async def generate_ai_keywords(request: ScriptRequest, user=Depends(get_current_user)):
    """Analyze a TTS script and return optimized B-roll visual keywords using DeepSeek.
    Automatic time-based segmentation: 10-15 seconds per scene, no hard caps."""
    
    # === MASTER TRY/EXCEPT — endpoint will NEVER return 500 ===
    try:
        # === HEAVY LOGGING ===
        logger.info("="*50)
        logger.info(f"AI KEYWORDS REQUEST INITIATED BY USER: {user.id}")
        logger.info(f"SCRIPT LENGTH: {len(request.script)} characters")
        logger.info(f"SELECTED GENRE: {request.genre}")
        logger.info(f"SCRIPT PREVIEW (First 300 chars): {request.script[:300]}...")
        logger.info("="*50)

        # Validate script
        script_text = request.script.strip()
        if not script_text:
            return _fallback_response("Script is empty.")
        if len(script_text) < 10:
            return _fallback_response("Script is too short (minimum 10 characters).")

        # Check API key
        if not DEEPSEEK_API_KEY:
            logger.error("CRITICAL ERROR: DEEPSEEK_API_KEY is missing from .env!")
            return _fallback_response("DeepSeek API key is not configured on the server.")

        logger.info(f"DeepSeek API key present: {DEEPSEEK_API_KEY[:8]}...")

        # === 4-BLOCK KEYWORD CLUSTER METHOD ===
        import re
        import time
        
        # 1. Smart Segmentation (max 12 segments)
        sentences = re.split(r'(?<=[.!?])\s+', script_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Calculate words-per-segment to stay within 12 segments max
        total_words = len(script_text.split())
        target_segments = min(12, max(3, round(total_words / 37.5)))  # ~37.5 words = ~15s at 150wpm
        words_per_segment = max(30, total_words // target_segments)
        
        segments_text = []
        current_chunk = []
        current_count = 0
        
        for sent in sentences:
            words = sent.split()
            if current_count + len(words) > words_per_segment and current_chunk:
                segments_text.append(" ".join(current_chunk))
                current_chunk = [sent]
                current_count = len(words)
            else:
                current_chunk.append(sent)
                current_count += len(words)
        if current_chunk:
            segments_text.append(" ".join(current_chunk))
        
        # Merge if over 12 segments
        while len(segments_text) > 12 and len(segments_text) >= 2:
            # Merge the two shortest adjacent segments
            min_len = float('inf')
            min_idx = 0
            for i in range(len(segments_text) - 1):
                combined = len(segments_text[i].split()) + len(segments_text[i+1].split())
                if combined < min_len:
                    min_len = combined
                    min_idx = i
            segments_text[min_idx] = segments_text[min_idx] + " " + segments_text[min_idx + 1]
            segments_text.pop(min_idx + 1)
            
        num_segments = len(segments_text)
        logger.info(f"SEGMENTATION: {num_segments} scenes (target was {target_segments}, total words: {total_words})")

        # Get genre config
        genre_key = request.genre.lower().strip()
        genre = GENRE_GUIDE.get(genre_key, GENRE_GUIDE["general"])

        # 2. AI Prompt — 4-Block Keyword Cluster Method
        system_prompt = f"""Analyze the script and break it into logical visual scenes of 10-15 seconds each. For each scene, extract a clean keyword cluster optimized for stock footage search engines. Use only concrete nouns, verbs, and technical terms. Follow the 4-Block Method:

1. Subject (main object/person with details)
2. Action (physical movement)
3. Setting (location + time of day + lighting)
4. Technical (camera angle, shot type, color palette, movement style)

Output only pure, searchable keyword clusters. Never use emotional adjectives like dramatic, cinematic, emotional, beautiful. Never output full sentences or questions.

I will give you {num_segments} numbered text segments. For EACH, write exactly ONE tag-style keyword cluster (10-18 words).

=== VIDEO GENRE: {genre["label"]} ===

=== EXAMPLES OF CORRECT OUTPUT ===
- "commercial airplane flying through clouds sunset golden hour aerial wide shot warm tones"
- "passengers walking airport security checkpoint night overhead tracking shot blue light"
- "pilot hands adjusting cockpit instruments close-up shallow depth of field warm amber"
- "highway traffic flowing city skyline dusk timelapse wide angle cool blue tones"
- "woman typing laptop home office natural window light medium shot soft focus warm"

=== EXAMPLES OF WRONG OUTPUT (BANNED) ===
- "dramatic airplane soaring majestically through beautiful clouds" (emotional adjectives)
- "How do airplanes fly through clouds?" (question)
- "cinematic visual scene" (generic)

=== JSON SCHEMA ===
Output ONLY valid JSON. No markdown.
{{
  "overall_theme": "short factual topic description",
  "queries": [
    "tag-style keyword cluster for segment 1",
    "tag-style keyword cluster for segment 2"
  ]
}}"""

        user_prompt = "Script segments:\n"
        for i, seg in enumerate(segments_text):
            user_prompt += f"[{i+1}] {seg[:400]}\n"

        # === PYTHON FALLBACK: Tag-style keyword extractor ===
        STOP_WORDS = {"the","a","an","is","are","was","were","be","been","being","have","has","had",
            "do","does","did","will","would","could","should","may","might","shall","can",
            "this","that","these","those","it","its","i","you","he","she","we","they","my",
            "your","his","her","our","their","me","him","us","them","what","which","who",
            "when","where","how","why","if","but","or","and","not","no","so","too","very",
            "just","about","above","after","again","all","also","am","any","as","at","back",
            "because","before","below","between","both","by","come","day","each","even",
            "first","for","from","get","give","go","good","great","here","high",
            "in","into","know","like","long","look","make","many","more","most","new",
            "now","of","off","old","on","one","only","other","out","over","own","part",
            "people","place","put","right","same","say","see","show","side","since",
            "small","some","something","still","such","take","tell","than","then","there",
            "thing","think","time","to","try","turn","two","under","up","us","use","want",
            "way","well","with","work","world","year","much","need","must","let","through",
            "also","really","already","every","never","always"},
        
        BANNED_ADJECTIVES = {"dramatic","cinematic","emotional","beautiful","stunning","amazing",
            "incredible","breathtaking","magnificent","gorgeous","spectacular","majestic",
            "wonderful","fantastic","extraordinary","remarkable","splendid"}
        
        SHOT_TYPES = [
            "wide shot", "medium shot", "close-up", "aerial shot",
            "tracking shot", "overhead shot", "low angle", "timelapse",
            "slow motion", "handheld", "dolly shot", "pan shot"
        ]
        
        def _extract_tag_query(text_segment: str, segment_index: int) -> str:
            """Extract concrete nouns/verbs from text and add technical shot type."""
            words = re.findall(r'[a-zA-Z]+', text_segment.lower())
            keywords = []
            seen = set()
            for w in words:
                if w not in STOP_WORDS and w not in BANNED_ADJECTIVES and len(w) >= 3 and w not in seen:
                    keywords.append(w)
                    seen.add(w)
                    if len(keywords) >= 8:
                        break
            if not keywords:
                keywords = ["professional", "footage"]
            shot = SHOT_TYPES[segment_index % len(SHOT_TYPES)]
            return f"{' '.join(keywords)} {shot} natural light"

        # 3. Call DeepSeek API (50s timeout)
        parsed = None
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=50.0) as client:
                logger.info(f"Sending 4-Block request to DeepSeek ({num_segments} queries)...")
                response = await client.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3,
                        "max_tokens": 1024
                    }
                )
                elapsed = time.time() - start_time
                logger.info(f"DeepSeek status: {response.status_code} in {elapsed:.1f}s")
                
                if response.status_code == 200:
                    content = response.json()["choices"][0]["message"]["content"]
                    logger.info(f"DeepSeek content: {len(content)} chars")
                    try:
                        parsed = json.loads(content)
                    except json.JSONDecodeError:
                        start_idx = content.find('{')
                        end_idx = content.rfind('}')
                        if start_idx != -1 and end_idx != -1:
                            try: parsed = json.loads(content[start_idx:end_idx+1])
                            except: pass
                else:
                    logger.error(f"DeepSeek error {response.status_code}: {response.text[:300]}")
        except Exception as e:
            logger.error(f"DeepSeek failed/timed out: {e} ({time.time() - start_time:.1f}s)")

        # 4. Assemble Final Output
        overall_theme = "Professional Video Production"
        queries = []
        if parsed and "queries" in parsed and isinstance(parsed["queries"], list):
            queries = parsed["queries"]
            overall_theme = parsed.get("overall_theme", overall_theme)
            logger.info(f"AI returned {len(queries)} queries.")
        else:
            logger.warning("AI unavailable. Using Python keyword extraction.")
            
        final_segments = []
        question_starters = ("how ","why ","what ","when ","where ","who ","do ","does ","is ","are ","can ","will ","should ")
        
        for idx, text in enumerate(segments_text):
            # Use AI query if available
            if idx < len(queries) and queries[idx] and str(queries[idx]).strip():
                safe_query = str(queries[idx]).strip()
            else:
                safe_query = _extract_tag_query(text, idx)
                logger.info(f"Seg {idx+1}: Python fallback: {safe_query}")
            
            # Strip banned adjectives from AI output too
            for adj in BANNED_ADJECTIVES:
                safe_query = re.sub(r'\b' + adj + r'\b', '', safe_query, flags=re.IGNORECASE)
            safe_query = re.sub(r'\s+', ' ', safe_query).strip()
            
            # Reject questions
            if safe_query.lower().startswith(question_starters) or safe_query.endswith("?"):
                safe_query = _extract_tag_query(text, idx)
            
            # Reject generic/empty
            if not safe_query or safe_query.lower() in ("cinematic visual scene","n/a","cinematic scene"):
                safe_query = _extract_tag_query(text, idx)
            
            # Enforce max 18 words
            query_words = safe_query.split()
            if len(query_words) > 18:
                safe_query = " ".join(query_words[:18])
                
            word_count = len(text.split())
            est_seconds = max(10, min(15, round(word_count / 150.0 * 60))) if word_count > 0 else 12
            
            final_segments.append({
                "segment_id": idx + 1,
                "text": text,
                "estimated_seconds": est_seconds,
                "keywords": {
                    "subject": "Main Subject",
                    "action": "Moving through scene",
                    "setting": "Professional environment",
                    "mood_style": genre.get("style", "Professional"),
                    "search_query": safe_query.rstrip("?").strip()
                }
            })

        logger.info(f"AI Keywords done: {len(final_segments)} segments. AI: {len(queries)}/{num_segments}.")
        return {
            "overall_theme": overall_theme,
            "segments": final_segments
        }
        
    except Exception as master_error:
        # === MASTER CATCH — guarantees no 500 error EVER ===
        logger.error(f"MASTER CATCH in /api/ai-keywords: {traceback.format_exc()}")
        return _fallback_response(f"Unexpected server error. Please try again.")

def _fallback_response(message: str):
    """Returns a valid but generic JSON structure when the AI fails."""
    logger.error(f"Returning fallback response: {message}")
    return {
        "overall_theme": "Generic Video Scene",
        "segments": [
            {
                "segment_id": 1,
                "text": f"Fallback: {message}",
                "estimated_seconds": 12,
                "keywords": {
                    "subject": "Error",
                    "action": "Processing",
                    "setting": "System",
                    "mood_style": "Neutral",
                    "search_query": "professional stock footage wide shot natural light"
                }
            }
        ]
    }

@app.post("/api/payment/sepay-webhook")
async def sepay_webhook(request: Request):
    try:
        data = await request.json()
        txn_id = data.get("id")
        raw_amount = data.get("amount") or 0
        amount = int(raw_amount)
        content = data.get("content", "")

        if amount < 150000:
            return {"status": "success", "message": "Ignored"}

        user_id = None
        match_uuid = re.search(r"EF([a-fA-F0-9\-]{32,})", content)
        if match_uuid:
            user_id = match_uuid.group(1)

        if not user_id:
            return {"status": "success", "message": "Manual review needed"}

        supabase.table("sepay_transactions").insert({"id": str(txn_id), "user_id": user_id, "amount": amount}).execute()
        supabase.rpc("add_credits", {"p_user_id": user_id, "p_amount": 200000}).execute()

        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
