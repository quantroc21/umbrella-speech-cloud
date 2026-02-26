@echo off
echo Starting FishSpeech Backend...
start "FishSpeech API" cmd /k "python tools/api_server.py --llama-checkpoint-path checkpoints/fish-speech-1.5 --decoder-checkpoint-path checkpoints/fish-speech-1.5/codec.pth --decoder-config-name firefly_gan_vq --device cuda --half"

echo Starting Frontend...
cd eloquent-voice-studio-main
npm run dev
