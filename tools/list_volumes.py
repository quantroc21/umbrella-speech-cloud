import os
import requests
import json

RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY")
if not RUNPOD_API_KEY:
    print("Please set RUNPOD_API_KEY")
    exit(1)

def list_volumes():
    query = """
    query networkVolumes {
      networkVolumes {
        id
        name
        size
        dataCenterId
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

        print(f"{'ID':<30} | {'Name':<20} | {'DC':<10}")
        print("-" * 60)
        for vol in data['data']['myNetworkVolumes']:
            print(f"{vol['id']:<30} | {vol['name']:<20} | {vol['dataCenterId']}")

    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    list_volumes()
