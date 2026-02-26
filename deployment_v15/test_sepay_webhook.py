import os
import httpx
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SEPAY_API_KEY = "test_key_123" # Mock key for local test

# 1. Update .env mock for test
os.environ["SEPAY_API_KEY"] = SEPAY_API_KEY

async def test_webhook():
    print("🚀 Starting SePay Webhook Test...")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 2. Get a test user
    profiles = supabase.table("profiles").select("id, credit_balance, email").limit(1).execute()
    if not profiles.data:
        print("❌ No users found in database.")
        return
    
    test_user = profiles.data[0]
    user_id = test_user['id']
    initial_credits = test_user['credit_balance']
    print(f"👤 Testing with User: {user_id} (Credits: {initial_credits})")

    # 3. Prepare Mock SePay Payload
    txn_id = f"TEST_TXN_{os.urandom(4).hex()}"
    payload = {
        "id": txn_id,
        "amount": 150000,
        "content": f"EF{user_id}",
        "transfer_type": "in",
        "transfer_time": "2024-01-01 10:00:00"
    }
    
    headers = {
        "x-api-key": SEPAY_API_KEY,
        "Content-Type": "application/json"
    }

    # 4. Trigger Webhook (Assuming server is running on localhost:8000)
    print(f"📡 Sending Mock Webhook (UUID) to localhost:8000...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8000/api/payment/sepay-webhook", json=payload, headers=headers)
            print(f"📥 Response (UUID): {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"⚠️ Server not reachable for UUID test.")

    # 4b. Test Email-based Fulfillment
    test_email = test_user.get('email')
    if test_email:
        print(f"📡 Testing Email-based memo with: {test_email}")
        email_txn_id = f"TEST_EMAIL_{os.urandom(4).hex()}"
        email_payload = payload.copy()
        email_payload["id"] = email_txn_id
        email_payload["content"] = f"Payment from {test_email}"
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post("http://localhost:8000/api/payment/sepay-webhook", json=email_payload, headers=headers)
                print(f"📥 Response (Email): {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"⚠️ Server not reachable for Email test.")
    else:
        print("⏭️ Skipping Email test: test user has no email in profiles.")

    # 5. Verify Database Changes
    await asyncio.sleep(2) # Wait for processing
    updated_profiles = supabase.table("profiles").select("credit_balance").eq("id", user_id).execute()
    new_credits = updated_profiles.data[0]['credit_balance']
    
    print(f"📊 Initial Credits: {initial_credits}")
    print(f"📊 Final Credits: {new_credits}")
    
    if new_credits == initial_credits + 200000:
        print("✅ SUCCESS: Credits added correctly!")
    else:
        print("❌ FAILURE: Credits not added. Check backend logs.")

    # 6. Check Transaction Log
    txn_log = supabase.table("sepay_transactions").select("*").eq("id", txn_id).execute()
    if txn_log.data:
        print(f"✅ SUCCESS: Transaction {txn_id} logged in sepay_transactions table.")
    else:
        print(f"❌ FAILURE: Transaction not found in log.")

if __name__ == "__main__":
    asyncio.run(test_webhook())
