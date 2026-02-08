import os
import requests
import json

RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY")
if not RUNPOD_API_KEY:
    print("Please set RUNPOD_API_KEY")
    exit(1)

def list_gpus():
    query = """
    query gpuTypes {
      gpuTypes {
        id
        displayName
        memoryInGb
        communityPrice
        securePrice
      }
    }
    """
    
    url = f"https://api.runpod.io/graphql?api_key={RUNPOD_API_KEY}"
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json={'query': query}, headers=headers)
        if response.status_code != 200:
            print(f"Error: {response.text}")
            return

        data = response.json()
        if 'errors' in data:
            print(f"GraphQL Errors: {data['errors']}")
            return

        for gpu in data['data']['gpuTypes']:
            if "4090" in gpu['displayName']:
                print(json.dumps(gpu, indent=2))
        
        # print(f"{'ID':<20} | {'Name':<30} | {'VRAM':<5}")
        # print("-" * 60)
        # for gpu in data['data']['gpuTypes']:
        #     print(f"{gpu['id']:<20} | {gpu['displayName']:<30} | {gpu['memoryInGb']} GB")

    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    list_gpus()
