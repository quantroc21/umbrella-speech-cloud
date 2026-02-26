from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
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
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv
from r2_utils import upload_file_object

# from momo_utils import MoMoSecurity
# from zalopay_utils import ZaloPaySecurity  # Removed
from fastapi import Request


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
else:
    logger.info(f"SUPABASE_URL: {SUPABASE_URL}")
    logger.info(f"SUPABASE_KEY: {SUPABASE_KEY[:10]}...{SUPABASE_KEY[-5:]}")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)):
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
    voice_id: str # Can be preset name like "Brian" or UUID for cloned
    top_p: float = 0.7
    repetition_penalty: float = 1.2
    temperature: float = 0.7

@app.get("/health")
async def health_test():
    try:
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
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"Status Check Failed: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            data = response.json()
            logger.info(f"RunPod Job {job_id} Status: {data.get('status')} - Output: {data.get('output')}")
            return data
        except Exception as e:
            logger.error(f"Status Check Error: {e}")
            raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/generate")
async def generate_audio(request: AudioRequest, user=Depends(get_current_user)):
    user_id = user.id
    estimated_cost = len(request.text)
    
    logger.info(f"Request: User={user_id}, Chars={estimated_cost}, Voice={request.voice_id}")

    # 1. ATOMIC CREDIT DEDUCTION
    try:
        rpc_response = supabase.rpc("validate_and_subtract_credits", {
            "p_user_id": user_id,
            "p_char_count": estimated_cost
        }).execute()
        
        if not rpc_response.data:
            logger.warning(f"Credit Denied: User {user_id} needs {estimated_cost} credits")
            raise HTTPException(status_code=402, detail="Insufficient Credits")
            
    except Exception as e:
        logger.error(f"Database RPC Error: {e}")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

    # 2. RESOLVE VOICE & DISPATCH TO RUNPOD (ASYNC)
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
    
    logger.info(f"Dispatching Async to RunPod: {RUNPOD_ENDPOINT_ID}")
    async with httpx.AsyncClient() as client:
        try:
            # v15.1: Use /run for asynchronous processing
            response = await client.post(
                f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run",
                headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
                json=runpod_payload,
                timeout=30.0 
            )
            
            if response.status_code != 200:
                logger.error(f"RunPod Error: {response.text}")
                raise HTTPException(status_code=502, detail="Inference Dispatch Error")

            runpod_data = response.json()
            logger.info(f"RunPod Response: {runpod_data}")
            return runpod_data
        except Exception as e:
            logger.error(f"RunPod Exception: {e}")
            raise HTTPException(status_code=502, detail=str(e))

# Import moved to top, removing duplicate here
# from fastapi import BackgroundTasks, UploadFile, File
# import shutil
# from deployment_v15.r2_utils import upload_file_object

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
# ... imports ...

@app.get("/api/voices")
async def list_voices(user=Depends(get_current_user)):
    try:
        # Fetch voices referencing the cloned_voices table
        response = supabase.table("cloned_voices").select("*").eq("user_id", user.id).execute()
        return response.data
    except Exception as e:
        logger.error(f"List Voices Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload_reference")
async def upload_reference(
    file: UploadFile = File(...),
    text: str = Form(...),
    name: str = Form(...),
    user=Depends(get_current_user)
):
    try:
        # 0. CHECK PRESENCE LIMIT (Max 5 Slots)
        existing_voices = supabase.table("cloned_voices").select("id", count="exact").eq("user_id", user.id).execute()
        if existing_voices.count >= 5:
             raise HTTPException(status_code=403, detail="Slot Limit Reached: You can only have 5 active voice clones.")

        # Create a unique base name/folder
        file_ext = os.path.splitext(file.filename)[1]
        voice_uuid = f"{uuid.uuid4()}" # This acts as the folder name
        
        # New Structure: user_id / voice_uuid / voice_uuid.ext
        unique_filename = f"{user.id}/{voice_uuid}/{voice_uuid}{file_ext}"
        text_filename = f"{user.id}/{voice_uuid}/{voice_uuid}.lab"
        
        logger.info(f"Uploading Voice Bundle: {unique_filename} + .lab")

        # 1. Upload Audio to R2
        audio_url = upload_file_object(file.file, unique_filename, content_type=file.content_type)
        
        if not audio_url:
             raise HTTPException(status_code=500, detail="Failed to upload audio to storage")

        # 2. Upload Text (.lab) to R2
        # Create an in-memory file-like object for the text
        from io import BytesIO
        text_bytes = text.encode('utf-8')
        text_file_obj = BytesIO(text_bytes)
        
        text_url = upload_file_object(text_file_obj, text_filename, content_type="text/plain")

        # 3. SAVE METADATA TO DATABASE (Supabase)
        # This allows the frontend to list the voices
        db_record = {
            "user_id": user.id,
            "name": name,
            "r2_uuid_path": f"{user.id}/{voice_uuid}/{voice_uuid}{file_ext}" # Storing the audio path as ID/Ref
        }
        supabase.table("cloned_voices").insert(db_record).execute()

        return {
            "status": "success", 
            "url": audio_url,
            "text_url": text_url,
            "filename": unique_filename,
            "voice_uuid": voice_uuid
        }
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 💸 FINTECH MODULE: SePay Bank Automation
# ==========================================

import re

@app.post("/api/payment/sepay-webhook")
async def sepay_webhook(request: Request):
    """
    SePay Webhook: Automatically processes bank transfers
    """
    try:
        # 1. AUTHENTICATION (Optional for testing)
        api_key = request.headers.get("x-api-key")
        if not SEPAY_API_KEY or api_key != SEPAY_API_KEY:
            logger.warning("SePay Webhook: API Key missing or invalid (Continuing anyway for testing)")
            # raise HTTPException(status_code=401, detail="Unauthorized")

        data = await request.json()
        logger.info(f"SePay Webhook Received: {data}")

        # SePay Fields: id, amount, content, transfer_type, ...
        txn_id = data.get("id")
        
        # Robustly get amount (SePay uses 'amount' or 'transferAmount')
        raw_amount = data.get("amount") or data.get("transferAmount") or 0
        try:
            amount = int(raw_amount)
        except (ValueError, TypeError):
            amount = 0
            
        content = data.get("content", "")

        # 2. VALIDATION
        if amount < 150000:
            logger.warning(f"SePay: Amount {amount} too low (Payload: {raw_amount})")
            return {"status": "success", "message": f"Amount {amount} ignored"}

        # 3. PARSE MEMO (EF{userId} or Email)
        user_id = None
        
        # Strategy A: Check for EF + UUID (Standard)
        match_uuid = re.search(r"EF([a-fA-F0-9\-]{32,})", content)
        if match_uuid:
            user_id = match_uuid.group(1)
            logger.info(f"SePay: Identified User by UUID={user_id}")
        
        # Strategy B: Check for Email in content (Standard or Stripped)
        if not user_id:
            # Look for words that look like emails or stripped emails
            # Standard: something@example.com
            # Stripped: somethinggmailcom
            words = content.split()
            for word in words:
                clean_word = word.lower().strip()
                if not clean_word: continue
                
                # Check 1: Standard Email
                if "@" in clean_word and "." in clean_word:
                    logger.info(f"SePay: Searching for User by Standard Email={clean_word}")
                    prof = supabase.table("profiles").select("id").eq("email", clean_word).limit(1).execute()
                    if prof.data:
                        user_id = prof.data[0]['id']
                        break
                
                # Check 2: Stripped Email (common in VN banks)
                # Matches patterns like usergmailcom, useryahoocom, etc.
                if any(suffix in clean_word for suffix in ["gmailcom", "yahoocom", "outlookcom", "icloudcom", "hotmailcom"]):
                    logger.info(f"SePay: Searching for User by Stripped Email={word}")
                    try:
                        profs = supabase.table("profiles").select("id, email").execute()
                        for p in profs.data:
                            # SAFE CHECK: Skip if email is missing or not a string
                            prof_email = p.get('email')
                            if not prof_email or not isinstance(prof_email, str):
                                continue
                                
                            p_email_clean = prof_email.lower().replace("@", "").replace(".", "").strip()
                            if p_email_clean == clean_word:
                                user_id = p['id']
                                logger.info(f"SePay: Identified User {user_id} via Stripped Email {word}")
                                break
                    except Exception as e:
                        logger.error(f"SePay: Error during profile search: {e}")
                    if user_id: break

        if not user_id:
            logger.error(f"SePay: Could not identify user from memo: {content}")
            return {"status": "success", "message": "Manual review needed"}

        logger.info(f"SePay: Final Identified User ID={user_id}")

        # 4. IDEMPOTENCY check (Prevent duplicate credits)
        try:
            # Check if this transaction was already processed
            check = supabase.table("sepay_transactions").select("id").eq("id", str(txn_id)).execute()
            if check.data:
                logger.info(f"SePay: Duplicate Transaction {txn_id} ignored")
                return {"status": "success", "message": "Already processed"}
        except Exception as e:
            logger.error(f"SePay Idempotency Check Error: {e}")
            # If table doesn't exist, we might need to create it first

        # 5. FULFILLMENT (Atomic)
        try:
            # A. Log Transaction
            supabase.table("sepay_transactions").insert({
                "id": str(txn_id),
                "user_id": user_id,
                "amount": amount,
                "content": content
            }).execute()

            # B. Add Credits (200,000 credits for 150,000 VND)
            supabase.rpc("add_credits", {"p_user_id": user_id, "p_amount": 200000}).execute()
            logger.info(f"SePay: Credits (200k) added for User {user_id}")

            # C. Affiliate Logic (10% = 15,000 VND)
            try:
                ref_log = supabase.table("referral_logs").select("*").eq("referee_id", user_id).limit(1).execute()
                if ref_log.data:
                    log_entry = ref_log.data[0]
                    if log_entry.get('status') == 'registered':
                        supabase.table("referral_logs").update({"status": "converted"}).eq("id", log_entry['id']).execute()
                        
                        referrer_code = log_entry['referrer_code']
                        bonus = 15000 # Fixed commission for 150k payment
                        
                        ptr = supabase.table("affiliate_partners").select("*").eq("code", referrer_code).single().execute()
                        if ptr.data:
                            p_data = ptr.data
                            new_total = p_data['total_conversions'] + 1
                            new_pending = p_data['pending_commission'] + bonus
                            
                            supabase.table("affiliate_partners").update({
                                "total_conversions": new_total,
                                "pending_commission": new_pending
                            }).eq("id", p_data['id']).execute()

                            # Milestone (15 users)
                            if new_total % p_data['payout_milestone'] == 0:
                                supabase.table("payout_queue").insert({
                                    "partner_id": p_data['id'],
                                    "amount": new_pending,
                                    "milestone_hit": new_total,
                                    "status": "pending"
                                }).execute()
            except Exception as aff_err:
                logger.error(f"SePay Affiliate Error: {aff_err}")

        except Exception as fulfill_err:
             logger.error(f"SePay Fulfillment Fatal Error: {fulfill_err}")
             return {"status": "error", "message": "Processing failed"}

        return {"status": "success", "message": "Processed"}

    except Exception as e:
        err_msg = str(e) or type(e).__name__
        logger.error(f"SePay Webhook Exception [{type(e).__name__}]: {e}")
        logger.error(traceback.format_exc())
        return {"status": "error", "message": err_msg}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
