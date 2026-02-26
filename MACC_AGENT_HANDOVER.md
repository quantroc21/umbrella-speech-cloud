# Mac Agent Handover Guide

> [!NOTE]
> This guide is intended for the Antigravity agent on your MacBook to quickly understand the current project state and progress.

## Project Overview
<!-- Workflow Sync Test: Mac Agent (CD44) - 2026-02-26 -->
This project is **Fish Speech V1.5**, a high-quality text-to-speech system. 
- **Frontend**: React + Vite + Tailwind CSS (located in `eloquent-voice-studio-main`).
- **Backend API**: FastAPI (`hostinger_api_fixed.py`) handling credits, RunPod dispatch, and payments (SePay) on **Spaceship VM**.
- **Inference**: Fish Speech core engine with custom integrations for RunPod.

## Critical Resolved Issues
The following issues have been successfully resolved. **Do not modify these core implementations unless specifically asked.**

### 1. Buzzing Audio Output
- **Problem**: Persistent buzzing or low-quality audio in long generations.
- **Fix**: Replaced standard audio backends with **FFmpeg** in `torchaudio`. 
- **Reference**: See `fish_speech/inference_engine/reference_loader.py` lines 34-47. The code now explicitly checks for and uses the `ffmpeg` backend.

### 2. RunPod Docker Build
- **Problem**: Failures during Docker image builds or incorrect tagging.
- **Fix**: Updated GitHub Actions (`.github/workflows/build.yml`) to properly handle tag extraction and push to `hoaitroc2212/fish-speech`.
- **Status**: The build is now stable.

### 3. DNS Resolution (ElephantFat.com)
- **Problem**: Global access failure (`NXDOMAIN` error).
- **Fix**: Migrated DNS management to **Cloudflare** and updated nameservers in Spaceship. Verified global propagation.
- **Reference**: Conversation IDs `22fd4f72` and `474e77d1`.

### 4. AI Keywords Backend Robustness
- **Problem**: 500 Internal Server Errors due to invalid JSON or missing script inputs.
- **Fix**: Implemented strict error handling, regex-based keyword extraction failsafes, and detailed logging in the backend. Restarted `fish-api` service on production.
- **Reference**: Conversation IDs `74983956` and `f0c0b619`.

### 5. DeepSeek API Integration
- **Status**: **Fully Working**.
- **Context**: Successfully integrated DeepSeek for intelligent processing. After updating credits and refining the API logic in `hostinger_api_fixed.py`, the feature is now stable and error-free on the **Spaceship VM**.

## Current Focus
- **Frontend V3 UI**: Updating the Studio page and TTF fonts (Be Vietnam Pro).
- **Mac Transition**: Seamlessly resuming work on the MacBook using the `.agent` sync.
- **yt-dlp-ui Integration**: Planning the integration of the video downloader feature on the **Spaceship VM** setup.

## Key Files
- `hostinger_api_fixed.py`: Main backend for the Spaceship VM (most important API file).
- `eloquent-voice-studio-main/`: Frontend source code.
- `deploy_frontend.ps1`: Primary deployment script (PowerShell) for the frontend.
