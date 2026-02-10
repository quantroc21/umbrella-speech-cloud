@echo off
echo Starting FishSpeech Credit System Backend (v15.1)...

:: Environment Variables (Loaded from .env automatically if present in hostinger_api.py)

start "Credit Backend" cmd /k "python deployment_v15/hostinger_api.py"

echo Starting Frontend...
cd eloquent-voice-studio-main
start "Frontend" cmd /k "npm run dev"

echo Done. Backend on :8000, Frontend on :5173
