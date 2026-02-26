$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entry = "209.74.82.54 elephantfat.com"

# Check if entry already exists to avoid duplicates
$content = Get-Content $hostsPath -ErrorAction SilentlyContinue
if ($content -notcontains $entry) {
    Add-Content -Path $hostsPath -Value "`r`n$entry" -Force
    Write-Host "Added $entry to hosts file." -ForegroundColor Green
} else {
    Write-Host "Entry already exists." -ForegroundColor Yellow
}

ipconfig /flushdns
Write-Host "DNS Flushed! You can now access the site." -ForegroundColor Cyan
Write-Host "Press Enter to close..."
Read-Host
