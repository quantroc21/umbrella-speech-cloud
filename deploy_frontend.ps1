$frontendDir = "eloquent-voice-studio-main"
$zipPath = "dist.zip"
$remotePath = "/root/dist.zip"
$remoteHost = "root@209.74.82.54"
$remotePort = "22022"

Write-Host ">>> Starting Frontend Deployment <<<" -ForegroundColor Green

# 1. Build
Set-Location $frontendDir
Write-Host "Building React App..."
npm install
npm run build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Build Failed!" -ForegroundColor Red
    exit 1 
}

# 2. Zip
Write-Host "Zipping dist folder..."
$distPath = "dist"
if (Test-Path "..\$zipPath") { Remove-Item "..\$zipPath" }
Compress-Archive -Path $distPath -DestinationPath "..\$zipPath" -Force
Set-Location ..

# 3. Upload
Write-Host "Uploading to VPS (Port $remotePort)..."
Write-Host "You may be asked for the VPS password." -ForegroundColor Yellow
scp -P $remotePort $zipPath "${remoteHost}:${remotePath}"

Write-Host "Upload Complete!" -ForegroundColor Green
Write-Host "Now Run Step 2 on the server." -ForegroundColor Cyan
