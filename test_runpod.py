
import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

RUNPOD_API_KEY_A = os.getenv("RUNPOD_API_KEY_A", "rpa_placeholder_A")
RUNPOD_API_KEY_B = os.getenv("RUNPOD_API_KEY_B", "rpa_placeholder_B")
ENDPOINT_ID = os.getenv("RUNPOD_ENDPOINT_ID", "vliov4h1a58iwu")

async def test_status_endpoint(key, job_id):
    print(f"\nChecking Status for Job: {job_id}...")
    url = f"https://api.runpod.ai/v2/{ENDPOINT_ID}/status/{job_id}"
    headers = {"Authorization": f"Bearer {key}"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
        except Exception as e:
            print(f"  Request Failed: {e}")

async def test_runpod():
    # Replace with a job ID from your recent generation attempt
    recent_job_id = "7c6c667a-b002-4d89-8f95-58ffa21582ce-e2" 
    await test_status_endpoint(RUNPOD_API_KEY_B, recent_job_id)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_runpod())
