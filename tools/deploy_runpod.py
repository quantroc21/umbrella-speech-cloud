
import os
import time
import runpod
import boto3
import json
from botocore.exceptions import NoCredentialsError, ClientError

# Configuration
RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY")
HF_TOKEN = os.environ.get("HF_TOKEN")

# Existing Volume Support (from user screenshot)
EXISTING_VOLUME_ID = os.environ.get("S3_BUCKET_NAME_NETWORK")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY_ID_NETWORK") or os.environ.get("RUNPOD_S3_ACCESS_KEY")
S3_SECRET_KEY = os.environ.get("S3_SECRET_ACCESS_KEY_NETWORK") or os.environ.get("RUNPOD_S3_SECRET_KEY")
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL_NETWORK", "https://s3api-eu-ro-1.runpod.io") 

# Fallbacks for creation
VOLUME_NAME = "fish-speech-volume"
VOLUME_SIZE = 100 # GB
GPU_TYPE_ID = "NVIDIA GeForce RTX 4090"
DATA_CENTER_ID = "EU-RO-1" # Default if not detecting from endpoint
IMAGE_NAME = "hoaitroc2212/fish-speech:v16.00"

if not RUNPOD_API_KEY:
    raise ValueError("Please set RUNPOD_API_KEY environment variable.")

runpod.api_key = RUNPOD_API_KEY

def log(msg):
    print(f"[Orchestrator] {msg}")

def get_gpu_location():
    """
    Phase 1: Find location.
    If S3_ENDPOINT_URL is present, try to deduce DC from it (e.g., s3api-eu-ro-1.runpod.io -> EU-RO-1).
    """
    if S3_ENDPOINT_URL:
        try:
            clean_url = S3_ENDPOINT_URL.replace("https://", "").replace("http://", "")
            parts = clean_url.split(".")
            if parts[0].startswith("s3api-"):
                dc = parts[0].replace("s3api-", "").upper()
                log(f"Detected Data Center from S3 URL: {dc}")
                return dc
        except Exception:
            pass
            
    log(f"Targeting Default Data Center: {DATA_CENTER_ID}")
    return DATA_CENTER_ID

def create_volume(dc_id):
    """
    Phase 1: Create Network Volume (Skipped if EXISTING_VOLUME_ID is set).
    """
    if EXISTING_VOLUME_ID:
        log(f"Using Existing Volume ID: {EXISTING_VOLUME_ID} (Skipping Creation)")
        return EXISTING_VOLUME_ID

    log(f"Creating Network Volume '{VOLUME_NAME}' in {dc_id}...")
    
    query = """
    mutation createNetworkVolume($name: String!, $size: Int!, $dataCenterId: String!) {
        createNetworkVolume(input: {
            name: $name,
            size: $size,
            dataCenterId: $dataCenterId
        }) {
            id
            name
        }
    }
    """
    
    variables = {
        "name": VOLUME_NAME,
        "size": VOLUME_SIZE,
        "dataCenterId": dc_id
    }

    try:
        result = execute_graphql(query, variables)
        volume_id = result['data']['createNetworkVolume']['id']
        log(f"Volume Created: {volume_id}")
        return volume_id
    except Exception as e:
        log(f"Volume creation failed: {e}")
        return None

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

def sync_s3_data(volume_id, dc_id):
    """
    Phase 2: Connect S3 and Sync.
    """
    # Use provided endpoint or construct default
    endpoint = S3_ENDPOINT_URL or f"https://s3api-{dc_id.lower()}.runpod.io"
    
    log(f"Connecting to S3: {endpoint} (Bucket: {volume_id}, Region: {dc_id})")
    
    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        log("WARNING: S3 Credentials not set. Skipping content check.")
        return

    s3 = boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=dc_id # Explicitly set region
    )

    try:
        s3.list_objects_v2(Bucket=volume_id, MaxKeys=1)
        log("S3 Connection Verified.")
    except Exception as e:
        log(f"S3 Connection Failed: {e}")
        return

    # Upload ready marker
    try:
        log("Uploading 'ready.txt' marker...")
        s3.put_object(Bucket=volume_id, Key="ready.txt", Body=b"Volume Ready")
        
        # Check if 'huggingface-cache' exists (simple list)
        objs = s3.list_objects_v2(Bucket=volume_id, Prefix="huggingface-cache/", MaxKeys=1)
        if 'Contents' not in objs:
            log("Note: 'huggingface-cache/' not found. Endpoint will download models on first run.")
        else:
            log("Found existing model cache.")

    except Exception as e:
        log(f"S3 Operation failed: {e}")
    
    log("Waiting 5s for consistency...")
    time.sleep(5)

def create_template():
    """
    Phase 3a: Create Serverless Template using SDK.
    """
    log("Creating Serverless Template via SDK...")
    
    env_dict = {
        "HF_TOKEN": HF_TOKEN or "",
        "BETA_MODE": "true"
    }
    
    try:
        template = runpod.create_template(
            name=f"fish-speech-v15.57-{int(time.time())}",
            image_name=IMAGE_NAME,
            container_disk_in_gb=10,
            volume_mount_path="/runpod-volume",
            env=env_dict,
            is_serverless=True
        )
        template_id = template['id']
        log(f"Template Created: {template_id}")
        return template_id
    except Exception as e:
        log(f"Template Creation Failed: {e}")
        return None

def deploy_endpoint(volume_id, dc_id):
    """
    Phase 3b: Deploy Serverless Endpoint using SDK.
    """
    template_id = create_template()
    if not template_id:
        return None

    log(f"Deploying Endpoint via SDK (Template: {template_id}, Volume: {volume_id})...")
    
    try:
        endpoint = runpod.create_endpoint(
            name="fish-speech-serverless",
            template_id=template_id,
            gpu_ids=GPU_TYPE_ID, # SDK expects string
            network_volume_id=volume_id,
            locations=dc_id,
            workers_min=0,
            workers_max=1,
            idle_timeout=60
        )
        endpoint_id = endpoint['id']
        log(f"Endpoint Created: {endpoint_id}")
        return {'id': endpoint_id}
    except Exception as e:
        log(f"Deployment Failed: {e}")
        return None

def warm_up(endpoint_id):
    """
    Phase 3: Warm-up and Health Check.
    """
    log(f"Warming up endpoint {endpoint_id}...")
    endpoint = runpod.Endpoint(endpoint_id)
    
    for attempt in range(1, 4):
        try:
            log(f"Warm-up Attempt {attempt}/3...")
            # Use a short text and reference for health check
            input_data = {
                "input": {
                    "text": "ping",
                    "reference_id": "c7aa0039-38b9-4796-9041-9a76579b69b2", # Just a placeholder
                    "normalize": True
                }
            }
            run_request = endpoint.run_sync(input_data, timeout=120) 
            
            log(f"Success: {run_request}")
            return True
        except Exception as e:
            log(f"Attempt {attempt} failed: {e}")
            if attempt < 3:
                time.sleep(30)
    
    log("Warm-up failed.")
    return False

def main():
    log("Starting Deployment Orchestration...")
    
    # Phase 1: Infrastructure
    dc_id = get_gpu_location()
    volume_id = create_volume(dc_id)
    
    if not volume_id:
        log("Aborting: Could not identify or create volume.")
        return

    # Phase 2: Data
    sync_s3_data(volume_id, dc_id)
    
    # Phase 3: Execution
    endpoint = deploy_endpoint(volume_id, dc_id)
    if endpoint:
        endpoint_id = endpoint['id'] if isinstance(endpoint, dict) else endpoint.id
        warm_up(endpoint_id)
        log("Deployment Complete.")
    else:
        log("Deployment Failed.")

if __name__ == "__main__":
    main()

