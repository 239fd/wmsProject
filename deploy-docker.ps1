param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("up", "down", "restart", "status", "logs", "build", "clean")]
    [string]$Action = "up"
)
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) { Write-Output $args }
    $host.UI.RawUI.ForegroundColor = $fc
}
function Write-Header  { param([string]$m) Write-ColorOutput Green "`n=========================================`n$m`n=========================================`n" }
function Write-Info    { param([string]$m) Write-ColorOutput Cyan   "INFO: $m" }
function Write-Success { param([string]$m) Write-ColorOutput Green  "SUCCESS: $m" }
function Write-Warn    { param([string]$m) Write-ColorOutput Yellow "WARNING: $m" }
function Write-Err     { param([string]$m) Write-ColorOutput Red    "ERROR: $m" }
function Test-Docker {
    Write-Info "Checking Docker..."
    try {
        docker --version | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker is not running" }
        Write-Success "Docker is available"
    } catch {
        Write-Err "Docker not found or not running!"
        Write-Err "Please install and start Docker Desktop"
        exit 1
    }
}
function Show-ServiceStatus {
    Write-Header "Service Status"
    docker-compose -f "$ProjectRoot\docker-compose.yml" ps
}
function Show-AccessInfo {
    Write-Header "Access Information"
    Write-Info "Web Services:"
    Write-Output "  Frontend:        http://localhost:3000"
    Write-Output "  API Gateway:     http://localhost:8765"
    Write-Output "  Eureka Server:   http://localhost:8761"
    Write-Output ""
    Write-Info "Microservices:"
    Write-Output "  SSO Service:           http://localhost:8000"
    Write-Output "  Organization Service:  http://localhost:8010"
    Write-Output "  Warehouse Service:     http://localhost:8020"
    Write-Output "  Product Service:       http://localhost:8030"
    Write-Output "  Document Service:      http://localhost:8040"
    Write-Output ""
    Write-Info "Databases (PostgreSQL):"
    Write-Output "  User DB:          localhost:5432"
    Write-Output "  Organization DB:  localhost:5433"
    Write-Output "  Warehouse DB:     localhost:5434"
    Write-Output "  Product DB:       localhost:5435"
    Write-Output ""
    Write-Info "Infrastructure:"
    Write-Output "  Redis:          localhost:6379"
    Write-Output "  RabbitMQ:       http://localhost:15672 (guest/guest)"
    Write-Output "  MinIO Console:  http://localhost:9001 (wmsadmin/wmsadmin12345)"
    Write-Output ""
    Write-Info "Monitoring:"
    Write-Output "  Prometheus:  http://localhost:9090"
    Write-Output "  Grafana:     http://localhost:3001 (admin/admin)"
    Write-Output "  Zipkin:      http://localhost:9411"
    Write-Output "  Loki:        http://localhost:3100"
    Write-Output ""
    Write-Info "Helpful commands:"
    Write-Output "  View logs:    .\deploy-docker.ps1 -Action logs"
    Write-Output "  Status:       .\deploy-docker.ps1 -Action status"
    Write-Output "  Stop:         .\deploy-docker.ps1 -Action down"
    Write-Output "  Clean:        .\deploy-docker.ps1 -Action clean"
}
function Start-Services {
    Write-Header "Starting WMS Project (Docker Compose)"
    Test-Docker
    Write-Info "Starting all services..."
    Write-Warn "This may take a few minutes on first run..."
    docker-compose -f "$ProjectRoot\docker-compose.yml" up -d --build
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All services started!"
        Start-Sleep -Seconds 30
        Show-ServiceStatus
        Show-AccessInfo
    } else {
        Write-Err "Error starting services"
        exit 1
    }
}
function Stop-Services {
    Write-Header "Stopping WMS Project"
    Write-Info "Stopping all services..."
    docker-compose -f "$ProjectRoot\docker-compose.yml" down
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All services stopped"
    } else {
        Write-Err "Error stopping services"
        exit 1
    }
}
function Restart-Services {
    Write-Header "Restarting WMS Project"
    Stop-Services
    Start-Sleep -Seconds 5
    Start-Services
}
function Show-ServiceLogs {
    Write-Header "Service Logs"
    Write-Info "Showing latest logs (Ctrl+C to exit)..."
    docker-compose -f "$ProjectRoot\docker-compose.yml" logs -f --tail=100
}
function Build-Services {
    Write-Header "Building Docker Images"
    Test-Docker
    $services = @(
        @{ Name = "eureka-server";        Path = "backend\eureka-server" },
        @{ Name = "api-gateway";          Path = "backend\api-gateway" },
        @{ Name = "sso-service";          Path = "backend\SSOService" },
        @{ Name = "organization-service"; Path = "backend\organization-service" },
        @{ Name = "warehouse-service";    Path = "backend\warehouse-service" },
        @{ Name = "product-service";      Path = "backend\product-service" },
        @{ Name = "document-service";     Path = "backend\document-service" },
        @{ Name = "frontend";             Path = "client" }
    )
    $total = $services.Count
    $i = 0
    foreach ($s in $services) {
        $i++
        Write-Info "[$i/$total] Building $($s.Name)..."
        $contextPath = Join-Path $ProjectRoot $s.Path
        docker build -t "$($s.Name):latest" $contextPath
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Error building image: $($s.Name)"
            exit 1
        }
        Write-Success "$($s.Name):latest"
    }
    Write-Success "All Docker images built successfully"
}
function Clean-All {
    Write-Header "Full Clean"
    Write-Warn "This will remove all containers, volumes, and images for WMS Project!"
    $confirmation = Read-Host "Continue? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Info "Cancelled by user"
        return
    }
    Write-Info "Stopping and removing containers..."
    docker-compose -f "$ProjectRoot\docker-compose.yml" down -v
    Write-Info "Removing dangling images..."
    docker image prune -f
    Write-Info "Cleaning unused networks..."
    docker network prune -f
    Write-Success "Clean complete"
    Write-Info "For a deep clean (remove ALL unused images): docker system prune -a --volumes"
}
function Main {
    switch ($Action) {
        "up"      { Start-Services }
        "down"    { Stop-Services }
        "restart" { Restart-Services }
        "status"  { Show-ServiceStatus }
        "logs"    { Show-ServiceLogs }
        "build"   { Build-Services }
        "clean"   { Clean-All }
    }
}
try {
    Main
} catch {
    Write-Err "An error occurred: $_"
    exit 1
}
