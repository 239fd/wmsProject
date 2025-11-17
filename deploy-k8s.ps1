Write-Host "=== WMS Project - Kubernetes Deployment ===" -ForegroundColor Cyan
Write-Host "=== For 4-node cluster: Data Storage | Backend | Frontend | Infrastructure ===" -ForegroundColor Cyan
Write-Host "=== NOTE: Storage Node (DB+Redis) separate from Infrastructure Node (RabbitMQ+Monitoring) ===" -ForegroundColor Yellow
Write-Host "=== For 4-node cluster: Storage | Backend | Frontend | Infrastructure ===" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

Write-Host "[1/10] Detecting cluster configuration..." -ForegroundColor Yellow
$nodeCount = (kubectl get nodes --no-headers 2>$null | Measure-Object).Count

if ($nodeCount -eq 0) {
    Write-Host "WARNING: No Kubernetes cluster detected. Starting Minikube..." -ForegroundColor Yellow
    minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker
    $singleNode = $true
} elseif ($nodeCount -eq 1) {
    Write-Host "Single-node cluster (Minikube) detected" -ForegroundColor Yellow
    $singleNode = $true
} else {
    Write-Host "Multi-node cluster detected ($nodeCount nodes)" -ForegroundColor Green
    $singleNode = $false
}

Write-Host ""
Write-Host "[2/10] Configuring Docker environment..." -ForegroundColor Yellow
if ($singleNode) {
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression
}

Write-Host ""
Write-Host "[3/10] Building Docker images..." -ForegroundColor Yellow

$services = @(
    @{Name="eureka-server"; Path="backend/eureka-server"},
    @{Name="api-gateway"; Path="backend/api-gateway"},
    @{Name="sso-service"; Path="backend/SSOService"},
    @{Name="organization-service"; Path="backend/organization-service"},
    @{Name="product-service"; Path="backend/product-service"},
    @{Name="warehouse-service"; Path="backend/warehouse-service"},
    @{Name="document-service"; Path="backend/document-service"},
    @{Name="wms-frontend"; Path="client"}
)

foreach ($service in $services) {
    Write-Host "  Building $($service.Name)..." -ForegroundColor Cyan
    docker build -t "$($service.Name):latest" $service.Path
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Failed to build $($service.Name)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] $($service.Name) built successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/10] Configuring node labels..." -ForegroundColor Yellow
if ($singleNode) {
    Write-Host "  Single-node: applying all role labels..." -ForegroundColor Yellow
    kubectl label nodes --all node-role.storage=true --overwrite
    kubectl label nodes --all node-role.data-storage=true --overwrite
    kubectl label nodes --all node-role.backend=true --overwrite
    kubectl label nodes --all node-role.frontend=true --overwrite
    kubectl label nodes --all node-role.infrastructure=true --overwrite
} else {
    Write-Host "  Multi-node cluster detected." -ForegroundColor Green
    Write-Host "  Please ensure nodes are labeled with appropriate roles:" -ForegroundColor Yellow
    Write-Host "    kubectl label nodes [node-name] node-role.storage=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [node-name] node-role.backend=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [node-name] node-role.frontend=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [node-name] node-role.infrastructure=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [storage-node] node-role.data-storage=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [backend-node] node-role.backend=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [frontend-node] node-role.frontend=true" -ForegroundColor White
    Write-Host "    kubectl label nodes [infrastructure-node] node-role.infrastructure=true" -ForegroundColor White
    Write-Host ""
    Write-Host "  NOTE: Storage Node (DB + Redis) is separate from Infrastructure Node (RabbitMQ, Prometheus, Grafana)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[5/10] Creating namespace..." -ForegroundColor Yellow
kubectl apply -f k8s/00-namespace.yaml

Write-Host ""
Write-Host "[6/10] Deploying storage (PersistentVolumes)..." -ForegroundColor Yellow
kubectl apply -f k8s/01-storage.yaml

Write-Host ""
Write-Host "[7/10] Deploying secrets..." -ForegroundColor Yellow
kubectl apply -f k8s/02-secrets.yaml

Write-Host ""
Write-Host "[8/10] Deploying databases..." -ForegroundColor Yellow
kubectl apply -f k8s/03-databases.yaml

Write-Host "  Waiting for database pods to start (30s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "[9/10] Initializing database schemas..." -ForegroundColor Yellow

Write-Host "  Waiting for postgres-sso to be ready..." -ForegroundColor Cyan
$ready = $false
$attempts = 0
$maxAttempts = 12

while (-not $ready -and $attempts -lt $maxAttempts) {
    $ssoPod = kubectl get pods -n wms -l app=postgres-sso -o jsonpath='{.items[0].metadata.name}' 2>$null
    if ($ssoPod) {
        $podStatus = kubectl get pod -n wms $ssoPod -o jsonpath='{.status.phase}' 2>$null
        if ($podStatus -eq "Running") {
            $dbCheck = kubectl exec -n wms $ssoPod -- pg_isready -U postgres 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] postgres-sso is ready" -ForegroundColor Green
                $ready = $true
            }
        }
    }

    if (-not $ready) {
        $attempts++
        Write-Host "  Waiting for postgres-sso... (attempt $attempts/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if ($ready -and (Test-Path ".\sql-scripts\userDB.sql")) {
    Write-Host "  Initializing SSO database schema..." -ForegroundColor Cyan
    Get-Content ".\sql-scripts\userDB.sql" | kubectl exec -i -n wms $ssoPod -- psql -U postgres -d sso_db 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] SSO database initialized" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Failed to initialize SSO database, continuing anyway" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [WARNING] Skipping SSO database initialization" -ForegroundColor Yellow
}

Write-Host "  Waiting for all databases to be fully ready (15s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "[10/10] Deploying application services..." -ForegroundColor Yellow
Write-Host "  Deploying backend microservices..." -ForegroundColor Cyan
kubectl apply -f k8s/04-backend.yaml

Write-Host "  Deploying infrastructure..." -ForegroundColor Cyan
kubectl apply -f k8s/05-infrastructure.yaml

Write-Host "  Deploying frontend..." -ForegroundColor Cyan
kubectl apply -f k8s/09-frontend.yaml

Write-Host ""
Write-Host "Waiting for services to start (20s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""

Write-Host "=== Pod Status ===" -ForegroundColor Cyan
kubectl get pods -n wms -o wide

Write-Host ""
Write-Host "=== Service Access Information ===" -ForegroundColor Green

if ($singleNode) {
    $minikubeIP = minikube ip 2>$null
    Write-Host ""
    Write-Host "API Gateway (NodePort):  http://$minikubeIP:30765" -ForegroundColor White
    Write-Host ""
    Write-Host "Other services (use port-forward):" -ForegroundColor Yellow
    Write-Host "  Eureka:     kubectl port-forward -n wms svc/eureka-server 8761:8761" -ForegroundColor White
    Write-Host "  Frontend:   kubectl port-forward -n wms svc/frontend 3000:80" -ForegroundColor White
    Write-Host "  Grafana:    kubectl port-forward -n wms svc/grafana 3001:3001" -ForegroundColor White
    Write-Host "  Prometheus: kubectl port-forward -n wms svc/prometheus 9090:9090" -ForegroundColor White
    Write-Host "  RabbitMQ:   kubectl port-forward -n wms svc/rabbitmq 15672:15672" -ForegroundColor White
} else {
    Write-Host "Services are configured with ClusterIP/NodePort" -ForegroundColor White
    Write-Host "Check ingress configuration or use port-forward for access" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Useful Commands ===" -ForegroundColor Cyan
Write-Host "Monitor pods:        kubectl get pods -n wms -w" -ForegroundColor White
Write-Host "Check logs:          kubectl logs -n wms [pod-name]" -ForegroundColor White
Write-Host "Describe pod:        kubectl describe pod -n wms [pod-name]" -ForegroundColor White
Write-Host "Get all resources:   kubectl get all -n wms" -ForegroundColor White
Write-Host ""
Write-Host "Cleanup:             .\cleanup-k8s.ps1" -ForegroundColor White

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host ""

Write-Host "Do you want to start port-forwarding for all services? [Y/N]" -ForegroundColor Yellow
$startPortForward = Read-Host

if ($startPortForward -eq 'Y' -or $startPortForward -eq 'y') {
    Write-Host ""
    Write-Host "Starting port-forwards..." -ForegroundColor Cyan

    $services = @(
        @{Name="RabbitMQ"; Service="rabbitmq"; Port="15672:15672"},
        @{Name="Grafana"; Service="grafana"; Port="3001:3001"},
        @{Name="Prometheus"; Service="prometheus"; Port="9090:9090"},
        @{Name="Eureka"; Service="eureka-server"; Port="8761:8761"},
        @{Name="Frontend"; Service="frontend"; Port="3000:80"}
    )

    foreach ($svc in $services) {
        $command = "kubectl port-forward -n wms svc/$($svc.Service) $($svc.Port)"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $command
        Write-Host "[OK] Started $($svc.Name) on port $($svc.Port.Split(':')[0])" -ForegroundColor Green
        Start-Sleep -Milliseconds 500
    }

    Write-Host ""
    Write-Host "Port-forwards started in separate windows!" -ForegroundColor Green
    Write-Host "To stop all: .\stop-port-forwards.ps1" -ForegroundColor Yellow
}

