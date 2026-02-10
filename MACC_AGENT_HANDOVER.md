# Mac Agent Handover Guide

> [!NOTE]
> This guide is intended for the Antigravity agent on your MacBook to quickly understand the current project state and progress.

## Project Overview
This project is **Fish Speech V1.5**, a high-quality text-to-speech system. 
- **Frontend**: React + Vite + Tailwind CSS (located in `eloquent-voice-studio-main`).
- **Backend API**: FastAPI (`deployment_v15/hostinger_api.py`) handling credits, RunPod dispatch, and payments (SePay).
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

## Current Focus
- Moving development to MacBook.
- Deploying the UI and API to Hostinger.

## Key Files
- `deployment_v15/hostinger_api.py`: Main backend for Hostinger.
- `eloquent-voice-studio-main/`: Frontend source code.
- `deploy_production.bat`: Current deployment script for Windows.
