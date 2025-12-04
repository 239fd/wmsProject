#!/usr/bin/env pwsh
# WMS Project - Docker Compose Deployment Script

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        WMS Project - Docker Compose Deployment             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Building and starting infrastructure services..." -ForegroundColor Yellow
docker-compose up -d postgres-sso postgres-org postgres-warehouse postgres-product redis rabbitmq

Write-Host ""
Write-Host "[2/3] Waiting for databases to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "[3/3] Building and starting application services..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host ""
Write-Host "Waiting for all services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Deployment Status:" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "Access Information:" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Application:" -ForegroundColor Yellow
Write-Host "    Frontend:      http://localhost:3000" -ForegroundColor White
Write-Host "    API Gateway:   http://localhost:8765" -ForegroundColor White
Write-Host "    Eureka Server: http://localhost:8761" -ForegroundColor White
Write-Host ""
Write-Host "  Microservices:" -ForegroundColor Yellow
Write-Host "    SSO Service:          http://localhost:8000" -ForegroundColor White
Write-Host "    Organization Service: http://localhost:8010" -ForegroundColor White
Write-Host "    Warehouse Service:    http://localhost:8020" -ForegroundColor White
Write-Host "    Product Service:      http://localhost:8030" -ForegroundColor White
Write-Host "    Document Service:     http://localhost:8040" -ForegroundColor White
Write-Host ""
Write-Host "  Databases:" -ForegroundColor Yellow
Write-Host "    PostgreSQL (SSO):          localhost:5432 / user_db" -ForegroundColor White
Write-Host "    PostgreSQL (Organization): localhost:5433 / organization_db" -ForegroundColor White
Write-Host "    PostgreSQL (Warehouse):    localhost:5434 / warehouse_db" -ForegroundColor White
Write-Host "    PostgreSQL (Product):      localhost:5435 / product_db" -ForegroundColor White
Write-Host ""
Write-Host "  Infrastructure:" -ForegroundColor Yellow
Write-Host "    Redis:              localhost:6379" -ForegroundColor White
Write-Host "    RabbitMQ:           localhost:5672" -ForegroundColor White
Write-Host "    RabbitMQ Management: http://localhost:15672 (guest/guest)" -ForegroundColor White
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  View logs:      docker-compose logs -f [service-name]" -ForegroundColor White
Write-Host "  Stop services:  docker-compose down" -ForegroundColor White
Write-Host "  Clean up:       docker-compose down -v --rmi local" -ForegroundColor White
Write-Host ""
Write-Host "Deployment Complete!" -ForegroundColor Green

