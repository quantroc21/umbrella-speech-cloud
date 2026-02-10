
import os
from supabase import create_client

URL_A = "https://qka7zdtyhqeguftyy7g5.supabase.co"
URL_B = "https://gihymgzbqfkiymybufdi.supabase.co"

TEST_KEYS = [
    # Project B (User provided)
    {"url": URL_B, "key": os.getenv("SUPABASE_KEY_B", "sb_placeholder_B"), "desc": "User's Secret B"},
    {"url": URL_B, "key": os.getenv("SUPABASE_PUB_B", "sb_placeholder_pub_B"), "desc": "User's Pub B"},
    # Project A (From logs)
    {"url": URL_A, "key": os.getenv("SUPABASE_KEY_A", "sb_placeholder_A"), "desc": "Historical Secret A"},
    {"url": URL_A, "key": os.getenv("SUPABASE_PUB_A", "sb_placeholder_pub_A"), "desc": "Historical Pub A"},
]

for item in TEST_KEYS:
    print(f"Testing {item['desc']}...")
    try:
        client = create_client(item['url'], item['key'])
        # Try to list tables or something simple
        res = client.table("profiles").select("count", count="exact").limit(1).execute()
        print(f"  SUCCESS: {res.count} rows in profiles")
    except Exception as e:
        print(f"  FAILED: {str(e)[:100]}")
