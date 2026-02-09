import os
import runpod
import time

# Task 1: Baseline Deployment Config
# NO Volumes. NO Caching.
API_KEY = os.environ.get("RUNPOD_API_KEY")
if not API_KEY:
    raise ValueError("Set RUNPOD_API_KEY env var.")

runpod.api_key = API_KEY

IMAGE_NAME = "hoaitroc2212/fish-speech:v17.00-baseline"
GPU_TYPE = "NVIDIA GeForce RTX 4090"

def deploy():
    print(f"Deploying Baseline Image: {IMAGE_NAME}")
    
    # 1. Create Template (No Volume)
    try:
        template = runpod.create_template(
            name=f"baseline-v17-{int(time.time())}",
            image_name=IMAGE_NAME,
            container_disk_in_gb=20, # Increased for baked model
            is_serverless=True
        )
        template_id = template['id']
        print(f"Template Created: {template_id}")
    except Exception as e:
        print(f"Template Failed: {e}")
        return

    # 2. Create Endpoint
    try:
        endpoint = runpod.create_endpoint(
            name="fish-speech-baseline",
            template_id=template_id,
            gpu_ids=GPU_TYPE,
            workers_min=0,
            workers_max=1,
            idle_timeout=60
        )
        print(f"Endpoint Created: {endpoint['id']}")
        print("Wait for initialization (cold start ~60s).")
    except Exception as e:
        print(f"Endpoint Failed: {e}")

if __name__ == "__main__":
    deploy()
