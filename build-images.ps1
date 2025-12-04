#!/usr/bin/env pwsh
# Script to build all Docker images for WMS Project

param(
    [string]$Registry = "wms",
    [string]$Tag = "latest",
    [switch]$Push = $false,
    [switch]$NoBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           WMS Project - Docker Image Builder               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Define services to build
$services = @(
    @{ Name = "eureka-server";        Path = "backend/eureka-server";        Port = 8761 },
    @{ Name = "api-gateway";          Path = "backend/api-gateway";          Port = 8765 },
    @{ Name = "sso-service";          Path = "backend/SSOService";           Port = 8000 },
    @{ Name = "organization-service"; Path = "backend/organization-service"; Port = 8010 },
    @{ Name = "warehouse-service";    Path = "backend/warehouse-service";    Port = 8020 },
    @{ Name = "product-service";      Path = "backend/product-service";      Port = 8030 },
    @{ Name = "document-service";     Path = "backend/document-service";     Port = 8040 },
    @{ Name = "frontend";             Path = "client";                       Port = 80 }
)

$totalServices = $services.Count
$currentService = 0
$successCount = 0
$failedServices = @()

foreach ($service in $services) {
    $currentService++
    $imageName = "$Registry/$($service.Name):$Tag"
    $contextPath = $service.Path

    Write-Host ""
    Write-Host "[$currentService/$totalServices] Building: $imageName" -ForegroundColor Yellow
    Write-Host "  Context: $contextPath" -ForegroundColor Gray
    Write-Host "  Port: $($service.Port)" -ForegroundColor Gray

    if (-not $NoBuild) {
        try {
            # Check if Dockerfile exists
            $dockerfilePath = Join-Path $contextPath "Dockerfile"
            if (-not (Test-Path $dockerfilePath)) {
                throw "Dockerfile not found at $dockerfilePath"
            }

            # Build the image
            docker build -t $imageName $contextPath

            if ($LASTEXITCODE -ne 0) {
                throw "Docker build failed with exit code $LASTEXITCODE"
            }

            Write-Host "  ✓ Build successful" -ForegroundColor Green
            $successCount++

            # Push if requested
            if ($Push) {
                Write-Host "  Pushing to registry..." -ForegroundColor Gray
                docker push $imageName
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  ✓ Push successful" -ForegroundColor Green
                } else {
                    Write-Host "  ✗ Push failed" -ForegroundColor Red
                }
            }
        }
        catch {
            Write-Host "  ✗ Build failed: $_" -ForegroundColor Red
            $failedServices += $service.Name
        }
    }
    else {
        Write-Host "  Skipped (--NoBuild)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Build Summary:" -ForegroundColor Cyan
Write-Host "  Total: $totalServices" -ForegroundColor White
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $($failedServices.Count)" -ForegroundColor $(if ($failedServices.Count -gt 0) { "Red" } else { "Green" })

if ($failedServices.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed services:" -ForegroundColor Red
    foreach ($failed in $failedServices) {
        Write-Host "  - $failed" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "All images built successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To run with Docker Compose:" -ForegroundColor Yellow
Write-Host "  docker-compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "To deploy to Kubernetes:" -ForegroundColor Yellow
Write-Host "  kubectl apply -f k8s/" -ForegroundColor White

