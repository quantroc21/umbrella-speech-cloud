@echo off
echo ===================================================
echo     FishSpeech Production Deployer (Hostinger)
echo ===================================================
echo.
echo Target IP: 76.13.19.133
echo User: root
echo.
echo "[1/3] Building and Packing Frontend Website..."
cd c:\Users\PC\fish-speech\eloquent-voice-studio-main
call npm run build
tar -a -c -f dist.zip dist
cd ..
scp c:\Users\PC\fish-speech\eloquent-voice-studio-main\dist.zip root@76.13.19.133:/root/
echo.
echo "[2/3] Pack and Upload Backend API (backend.zip)..."
cd c:\Users\PC\fish-speech\deployment_v15
copy ..\.env .env
tar -a -c -f backend.zip hostinger_api.py r2_utils.py momo_utils.py zalopay_utils.py requirements.txt supabase_fintech_schema.sql .env
cd ..
scp c:\Users\PC\fish-speech\deployment_v15\backend.zip root@76.13.19.133:/root/
echo.
echo [3/3] Uploading Nginx Config...
scp c:\Users\PC\fish-speech\deployment_v15\nginx_elephantfat root@76.13.19.133:/root/
echo.
echo ===================================================
echo UPLOAD COMPLETE!
echo.
echo Next Steps:
echo 1. SSH into the server: ssh root@76.13.19.133
echo 2. Run the setup commands we will provide next.
echo ===================================================
pause
