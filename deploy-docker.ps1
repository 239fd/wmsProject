Write-Host "=== WMS Project - Docker Compose Deployment ===" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

Write-Host "[1/2] Building and starting services..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host ""
Write-Host "[2/2] Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "=== Deployment Status ===" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "=== Access Information ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "API Gateway: http://localhost:8765" -ForegroundColor White
Write-Host "Eureka Server: http://localhost:8761" -ForegroundColor White
Write-Host ""
Write-Host "PostgreSQL Databases:" -ForegroundColor Yellow
Write-Host "  SSO Service: localhost:5432" -ForegroundColor White
Write-Host "  Organization: localhost:5433" -ForegroundColor White
Write-Host "  Warehouse: localhost:5434" -ForegroundColor White
Write-Host "  Product: localhost:5435" -ForegroundColor White
Write-Host "Redis: localhost:6379" -ForegroundColor White

Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "docker-compose logs -f [service-name]" -ForegroundColor White

Write-Host ""
Write-Host "To stop services:" -ForegroundColor Yellow
Write-Host "docker-compose down" -ForegroundColor White

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green

