
import runpod
import time
import os

# --- CONFIGURATION (v18.0 AOT) ---
VOLUME_SIZE = 100 # GB
GPU_TYPE_ID = "NVIDIA GeForce RTX 4090"
DATA_CENTER_ID = "EU-RO-1" # Default if not detecting from endpoint
IMAGE_NAME = "hoaitroc2212/fish-speech:v18.22-startup"

if not RUNPOD_API_KEY:
    raise ValueError("Please set RUNPOD_API_KEY environment variable.")

runpod.api_key = RUNPOD_API_KEY

def log(msg):
    print(f"[RunPod Deploy] {msg}")

def execute_graphql(query, variables):
    import requests
    # Try Query Parameter ONLY (No Auth Header)
    url = f"https://api.runpod.io/graphql?api_key={RUNPOD_API_KEY}"
    headers = {
        "Content-Type": "application/json"
    }
    
    log(f"Debug: Using API Key starting with {RUNPOD_API_KEY[:8]}...")
    
    response = requests.post(url, json={'query': query, 'variables': variables}, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"GraphQL HTTP Error {response.status_code}: {response.text}")
    
    res_json = response.json()
    if 'errors' in res_json:
        # Check for auth errors specifically
        if "Unauthorized" in str(res_json['errors']):
             raise Exception("GraphQL Unauthorized. Key invalid?")
        
        log(f"FULL GRAPHQL ERROR: {res_json}") # Add this line
        raise Exception(f"GraphQL Errors: {res_json['errors']}")
    return res_json

def create_template():
    """
    Phase 3a: Create Serverless Template using SDK.
    """
    log("Creating Serverless Template via SDK...")
    
    # Standard env vars for the container
    env_dict = {
        "HF_TOKEN": os.getenv("HF_TOKEN", ""),
        # AOT Env Vars are baked into Dockerfile, but can be overridden here if needed
        # "TORCHINDUCTOR_FX_GRAPH_CACHE": "1" 
    }
    
    # Add S3/R2 credentials if available
    for key in ["S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET_NAME", "S3_ENDPOINT_URL"]:
        if os.getenv(key):
            env_dict[key] = os.getenv(key)

    try:
        template = runpod.create_template(
            name=f"fish-speech-v18.22-startup-{int(time.time())}",
            image_name=IMAGE_NAME,
            container_disk_in_gb=10,
            # volume_mount_path="/runpod-volume", # REMOVED for local cache only
            env=env_dict,
            is_serverless=True
        )
        template_id = template['id']
        log(f"Template Created: {template_id}")
        return template_id
    except Exception as e:
        log(f"Template Creation Failed: {e}")
        return None

def main():
    log(f"Autodeploying {IMAGE_NAME}...")
    
    # 1. Create Template
    template_id = create_template()
    if not template_id:
        return

    log("Deployment Success! (Template Created)")
    log(f"Next Step: Update your existing Endpoint to use Template ID: {template_id}")
    log(f"Or create a new one manually.")

if __name__ == "__main__":
    main()
