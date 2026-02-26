# FishSpeech 1.5 SaaS: Production Deployment Blueprint (v15)

## 🗺️ System Architecture (The "Ironclad" Stack)

```mermaid
graph TD
    User[End User] -->|HTTPS| CF[Cloudflare WAF]
    CF -->|Requests| Hostinger[Hostinger VPS (FastAPI)]
    
    subgraph "Core Infrastructure"
        Hostinger -->|1. Auth & Credits| Supabase[(Supabase DB)]
        Hostinger -->|2. Get Ref Data| R2[(Cloudflare R2)]
        Hostinger -->|3. Dispatch Job| RunPod[RunPod Serverless]
    end
    
    subgraph "Secure Data Flow"
        R2 -->|Presigned Download| RunPod
        RunPod -->|Upload Result| R2
    end
    
    RunPod -->|4. Return Result URL| Hostinger
    Hostinger -->|5. Deliver Audio| User
```

---

## 📂 Deployment Files
All necessary files have been generated in the `deployment_v15/` directory:

| Component | File | Purpose |
| :--- | :--- | :--- |
| **Database** | `supabase_schema.sql` | Users, Credits, Security Policies (RLS), and Atomic Deduction RPC. |
| **Storage** | `r2_utils.py` | Generate secure 300s presigned URLs for RunPod workers. |
| **Compute** | `handler_production.py` | RunPod worker with FP16 forcing & direct R2 upload logic. |
| **API** | `hostinger_api.py` | FastAPI dispatcher that ties everything together. |

---

## 🚀 Phase 1: Identity & Credits (Supabase)
1.  Go to your **Supabase Dashboard** -> **SQL Editor**.
2.  Copy/Paste the contents of `supabase_schema.sql`.
3.  **Run** the script. It will create:
    *   `profiles` (linked to Auth)
    *   `cloned_voices`
    *   `transactions`
    *   `process_audio_request` (Secure Function)

## 🚀 Phase 2: Secure Data Pipeline (R2)
1.  Create a bucket named `fish-speech-production` in Cloudflare R2.
2.  Go to **Settings** -> **CORS Policy**.
3.  Paste the JSON policy found in the comments of `r2_utils.py`.
4.  Ensure you have your **Hostinger Domain** in the `AllowedOrigins` list.

## 🚀 Phase 3: Scaling Compute (RunPod)
1.  Update your `Dockerfile` to include `vector-quantize-pytorch==1.14.24`.
2.  Replace your `handler.py` with the contents of `handler_production.py`.
3.  **Rebuild & Push** your Docker image (`v15.0-prod`).
4.  Update your RunPod Template to use this new image.
5.  **Critical:** Add these ENV Variables to your RunPod Template:
    *   `R2_ACCESS_KEY_ID`
    *   `R2_SECRET_ACCESS_KEY`
    *   `R2_ENDPOINT`
    *   `R2_BUCKET_NAME`

## 🚀 Phase 4: Production Hardening Checklist (Go-Live)

- [ ] **1. Cloudflare Turnstile:** Add the `<Turnstile />` widget to your React `Login.tsx` to prevent bot spam.
- [ ] **2. Environment Variables:**
    *   **Hostinger:** `SUPABASE_KEY` (Service Role), `RUNPOD_API_KEY`, `R2_KEYS`.
    *   **RunPod:** `R2_KEYS` (Worker needs to upload).
- [ ] **3. Webhook (Optional):** If the job takes >60s, switch from `runsync` to `run` and use a Webhook URL on Hostinger (`/api/webhook/runpod`) to update the DB when done.
- [ ] **4. Rate Limiting:** Install `fastapi-limiter` on `hostinger_api.py` (e.g., 10 req/min per user).
- [ ] **5. Backup:** Enable Point-in-Time Recovery (PITR) on Supabase.
- [ ] **6. Monitoring:** Set up Sentry.io in `hostinger_api.py` to track 500 errors.
- [ ] **7. Billing:** Ensure `process_audio_request` logic matches your Stripe/Payment plan.
- [ ] **8. Domain:** Ensure `api.yourdomain.com` (Hostinger) and `app.yourdomain.com` (Frontend) are proxied via Cloudflare.

---

**Ready to Deploy?**
Start by running the SQL script in Supabase, then deploy the API to Hostinger! 
