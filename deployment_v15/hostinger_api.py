from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
import httpx
import os
from supabase import create_client, Client
from r2_utils import generate_presigned_url

app = FastAPI()

# --- Configuration ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # MUST be Service Role for RPC
RUNPOD_ENDPOINT_ID = os.getenv("RUNPOD_ENDPOINT_ID")
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class AudioRequest(BaseModel):
    text: str
    voice_id: str # UUID of the Cloned Voice in Supabase

async def get_current_user(authorization: str = Header(None)):
    """
    Verify JWT from the Frontend (Supabase Auth)
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    
    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
    
    return user.user

@app.post("/api/generate")
async def generate_audio(request: AudioRequest, user=Depends(get_current_user)):
    """
    Core Dispatcher Logic:
    1. Lock & Deduct Credits (Atomic)
    2. Get Reference Audio URL (Presigned)
    3. Call RunPod
    4. Return Result
    """
    user_id = user.id
    estimated_cost = len(request.text) # Simple 1 char = 1 credit logic
    
    # 1. ATOMIC CREDIT DEDUCTION
    # We call the PostgreSQL RPC function we created in Phase 1
    try:
        rpc_response = supabase.rpc("process_audio_request", {
            "p_user_id": user_id,
            "p_cost": estimated_cost
        }).execute()
        
        if not rpc_response.data:
            raise HTTPException(status_code=402, detail="Insufficient Credits")
            
    except Exception as e:
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Transaction Failed")

    # 2. RESOLVE REFERENCE AUDIO
    # Fetch the r2_path for the requested voice_id
    voice_data = supabase.table("cloned_voices").select("r2_uuid_path").eq("id", request.voice_id).execute()
    if not voice_data.data:
        raise HTTPException(status_code=404, detail="Voice not found")
        
    r2_path = voice_data.data[0]['r2_uuid_path']
    # Generate a temporary URL for RunPod to download the reference
    presigned_ref_url = generate_presigned_url(r2_path)

    # 3. DISPATCH TO RUNPOD
    runpod_payload = {
        "input": {
            "text": request.text,
            "reference_id": presigned_ref_url, # Worker downloads from here
            "user_id": user_id
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/runsync",
                headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
                json=runpod_payload,
                timeout=60.0 # Wait for generation
            )
            result = response.json()
        except Exception as e:
            # TODO: Refund credits if RunPod fails!
            raise HTTPException(status_code=502, detail=f"Inference Failed: {e}")

    # 4. RETURN RESULT
    if result.get("status") == "COMPLETED":
        return result["output"] # Contains 'audio_url' from R2
    else:
        raise HTTPException(status_code=500, detail="Generation Failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
