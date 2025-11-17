Write-Host "=== WMS Project - Docker Compose Cleanup ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping and removing containers..." -ForegroundColor Yellow
docker-compose down -v

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Green

