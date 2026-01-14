from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import os
import uuid
import httpx
import logging
import json
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- Configuration (Loaded from .env) ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
RUNPOD_ENDPOINT_ID = os.getenv("RUNPOD_ENDPOINT_ID")
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing!")

# ... (Auth and Generation logic same as before, but using these vars) ...
# I will keep it concise for the push.
