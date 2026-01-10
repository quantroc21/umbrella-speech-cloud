import requests
import json
import sys

# Constants provided by user and restored code
ENDPOINT_ID = "vliov4h1a58iwu"
API_KEY = "rpa_PLACEHOLDER_FOR_GITHUB"
URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}/runsync"

print(f"--- [TEST] Verifying RunPod Connection ---")
print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
print(f"URL: {URL}")

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

payload = {"input": {"task": "list_voices"}}

try:
    print("Sending request...")
    response = requests.post(URL, headers=headers, json=payload, timeout=10)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 200:
        print("✅ SUCCESS: Credentials are valid and Endpoint is reachable.")
    elif response.status_code == 401:
        print("❌ FAILURE: 401 Unauthorized. The API Key is likely WRONG or Revoked.")
    else:
        print(f"⚠️ UNEXPECTED: Status {response.status_code}")

except Exception as e:
    print(f"❌ CRITICAL ERROR: {e}")
