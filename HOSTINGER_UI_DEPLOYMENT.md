# Hostinger UI & Backend Deployment Guide

This document describes how to deploy the **Eloquent Voice Studio** frontend and backend to the Hostinger VPS.

## Target Server Info
- **IP**: `76.13.19.133`
- **User**: `root`
- **Nginx Config**: `deployment_v15/nginx_elephantfat`

## 1. Frontend Deployment (UI)
The frontend is built with Vite.

### Build Steps:
1. Navigate to the frontend directory:
   ```bash
   cd eloquent-voice-studio-main
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Create a zip of the `dist` folder:
   ```bash
   tar -a -c -f dist.zip dist
   ```

### Upload:
Transfer the `dist.zip` to the server:
```bash
scp eloquent-voice-studio-main/dist.zip root@76.13.19.133:/root/
```

## 2. Backend Deployment (API)
The backend is a FastAPI server.

### Pack Steps:
1. Create a zip of the backend files (from `deployment_v15`):
   - `hostinger_api.py`
   - `r2_utils.py`
   - `momo_utils.py`
   - `zalopay_utils.py`
   - `requirements.txt`
   - `.env` (Important!)

### Upload:
```bash
scp deployment_v15/backend.zip root@76.13.19.133:/root/
```

## 3. Server-Side Setup
Once files are uploaded:
1. SSH into the server: `ssh root@76.13.19.133`.
2. Unzip `dist.zip` into your web root (e.g., `/var/www/html`).
3. Unzip `backend.zip` and run the FastAPI server (using `uvicorn` and `pm2` or `systemd`).
4. Apply the Nginx config from `nginx_elephantfat` to route traffic to the UI and API.
