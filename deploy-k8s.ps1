
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("all", "setup", "build", "deploy", "status", "port-forward", "stop-forward", "clean")]
    [string]$Action = "all",
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false
)
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$K8sPath = Join-Path $ProjectRoot "k8s"
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
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    Write-Info "Checking Docker..."
    try {
        $dockerVersion = docker --version
        Write-Success "Docker installed: $dockerVersion"
    } catch {
        Write-Err "Docker not found! Install Docker Desktop."
        exit 1
    }
    Write-Info "Checking kubectl..."
    try {
        kubectl version --client | Out-Null
        Write-Success "kubectl installed"
    } catch {
        Write-Err "kubectl not found! Install kubectl."
        exit 1
    }
    Write-Info "Checking Minikube..."
    $status = minikube status --format='{{.Host}}' 2>$null
    if ($status -ne "Running") {
        Write-Err "Minikube is not running!"
        Write-Warn "Start manually: minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker"
        exit 1
    }
    Write-Success "Minikube is running"
    Write-Info "Switching docker-context to Minikube..."
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression
    Write-Success "Docker daemon switched to Minikube"
    Write-Success "All prerequisites met"
}
function Setup-ClusterNodes {
    Write-Header "Configuring Cluster Nodes"
    Write-Info "Getting nodes list..."
    $nodes = kubectl get nodes -o json | ConvertFrom-Json
    if ($nodes.items.Count -lt 1) {
        Write-Err "No nodes found in cluster!"
        exit 1
    }
    Write-Info "Found nodes: $($nodes.items.Count)"
    Write-Info "Setting labels on nodes for pod placement..."
    foreach ($node in $nodes.items) {
        $nodeName = $node.metadata.name
        Write-Info "Configuring node: $nodeName"
        kubectl label node $nodeName node-role.storage=true        --overwrite | Out-Null
        kubectl label node $nodeName node-role.backend=true        --overwrite | Out-Null
        kubectl label node $nodeName node-role.frontend=true       --overwrite | Out-Null
        kubectl label node $nodeName node-role.infrastructure=true --overwrite | Out-Null
        Write-Success "Labels set on node: $nodeName"
    }
    Write-Info "`nCluster Architecture (logical separation):"
    Write-Info "  - Storage Node:        PostgreSQL (4 instances) + Redis"
    Write-Info "  - Backend Node:        Spring Boot Microservices"
    Write-Info "  - Frontend Node:       React App"
    Write-Info "  - Infrastructure Node: RabbitMQ, MinIO, Prometheus, Grafana"
    Write-Success "Node configuration complete"
}
function Build-DockerImages {
    Write-Header "Building Docker Images"
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
        Write-Info "[$i/$total] Building image: $($s.Name)"
        $contextPath = Join-Path $ProjectRoot $s.Path
        $imageName = "$($s.Name):latest"
        try {
            docker build -t $imageName $contextPath
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Image built: $imageName"
            } else {
                Write-Err "Error building image: $imageName"
                exit 1
            }
        } catch {
            Write-Err "Exception building $($s.Name): $_"
            exit 1
        }
    }
    Write-Success "All Docker images built successfully"
}
function Deploy-ToKubernetes {
    Write-Header "Deploying to Kubernetes"
    $kustomizationPath = Join-Path $K8sPath "kustomization.yaml"
    if (-not (Test-Path $kustomizationPath)) {
        Write-Err "Missing kustomization file: $kustomizationPath"
        exit 1
    }
    Write-Info "Applying Kubernetes manifests with kustomize..."
    kubectl apply -k $K8sPath
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Error applying Kubernetes manifests"
        exit 1
    }
    Write-Success "Kubernetes manifests applied"
    Write-Info "`nWaiting for pods to be created..."
    Start-Sleep -Seconds 20

    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    Start-Sleep -Seconds 10
    kubectl wait --for=condition=ready pod -l tier=database -n wms --timeout=30s 2>$null
    kubectl wait --for=condition=ready pod -l tier=database -n wms --timeout=300s 2>$null
    kubectl wait --for=condition=ready pod -l app=eureka-server -n wms --timeout=30s 2>$null
    kubectl wait --for=condition=ready pod -l app=eureka-server -n wms --timeout=300s 2>$null
    Start-Sleep -Seconds 10
    Write-Info "Waiting for all pods to be ready..."

    $ErrorActionPreference = $oldPref

    kubectl wait --for=condition=ready pod --all -n wms --timeout=300s 2>$null
    Write-Success "Deployment complete"
}
function Show-Status {
    Write-Header "Deployment Status"
    Write-Info "Pods in namespace wms:"
    kubectl get pods -n wms -o wide
    Write-Info "`nServices:"
    kubectl get services -n wms
    Write-Info "`nDeployments:"
    kubectl get deployments -n wms
    Write-Info "`nStatefulSets:"
    kubectl get statefulsets -n wms 2>$null
    Write-Info "`nPersistentVolumes:"
    kubectl get pv 2>$null
    Write-Info "`nPod health check:"
    $pods = kubectl get pods -n wms -o json | ConvertFrom-Json
    $readyCount = 0
    $totalCount = $pods.items.Count
    foreach ($pod in $pods.items) {
        $status = $pod.status.phase
        $ready = $false
        if ($pod.status.containerStatuses) {
            $ready = $pod.status.containerStatuses[0].ready
        }
        if ($ready -and $status -eq "Running") { $readyCount++ }
    }
    Write-Info "`nReadiness: $readyCount/$totalCount pods"
    Write-Header "Access the Application (via port-forward)"
    Write-Info "Start port forwarding:"
    Write-Info "  .\deploy-k8s.ps1 -Action port-forward"
    Write-Info ""
    Write-Info "After forwarding, these will be available:"
    Write-Info "  Frontend:      http://localhost:3000"
    Write-Info "  API Gateway:   http://localhost:8765"
    Write-Info "  Eureka:        http://localhost:8761"
    Write-Info "  RabbitMQ UI:   http://localhost:15672"
    Write-Info "  Grafana:       http://localhost:3001 (admin/admin)"
    Write-Info "  Prometheus:    http://localhost:9090"
}
function Start-PortForwards {
    Write-Header "Starting Port Forwards"
    $forwards = @(
        @{ Service = "frontend";      Local = 3000;  Remote = 80    },
        @{ Service = "api-gateway";   Local = 8765;  Remote = 8765  },
        @{ Service = "eureka-server"; Local = 8761;  Remote = 8761  },
        @{ Service = "rabbitmq";      Local = 15672; Remote = 15672 },
        @{ Service = "grafana";       Local = 3001;  Remote = 3000  },
        @{ Service = "prometheus";    Local = 9090;  Remote = 9090  }
    )
    foreach ($f in $forwards) {
        $svc = $f.Service
        $local = $f.Local
        $remote = $f.Remote
        Write-Info "Forwarding $svc -> http://localhost:$local"
        Start-Job -Name "pf-$svc" -ScriptBlock {
            param($s, $l, $r)
            kubectl port-forward -n wms "svc/$s" "${l}:${r}"
        } -ArgumentList $svc, $local, $remote | Out-Null
    }
    Start-Sleep -Seconds 3
    Write-Header "Port Forwarding Active"
    foreach ($f in $forwards) {
        Write-Output "  $($f.Service.PadRight(16)) -> http://localhost:$($f.Local)"
    }
    Write-Output ""
    Write-Info "Background jobs:"
    Get-Job | Where-Object { $_.Name -like "pf-*" } | Format-Table Id, Name, State -AutoSize
    Write-Info "Stop forwarding: .\deploy-k8s.ps1 -Action stop-forward"
}
function Stop-PortForwards {
    Write-Header "Stopping Port Forwards"
    $jobs = Get-Job | Where-Object { $_.Name -like "pf-*" }
    if ($jobs.Count -eq 0) {
        Write-Warn "No active port-forward jobs found."
    } else {
        foreach ($j in $jobs) {
            Write-Info "Stopping $($j.Name)..."
            Stop-Job -Job $j -ErrorAction SilentlyContinue
            Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Info "Killing remaining kubectl port-forward processes..."
    Get-Process -Name "kubectl" -ErrorAction SilentlyContinue | ForEach-Object {
        try { $_ | Stop-Process -Force } catch { }
    }
    Write-Success "Port Forwarding stopped"
}
function Clean-Resources {
    Write-Header "Cleaning Resources"
    Write-Warn "You are about to delete all WMS Project resources from Kubernetes"
    $confirmation = Read-Host "Continue? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Info "Cancelled by user"
        return
    }
    Write-Info "Stopping port-forward jobs..."
    Stop-PortForwards
    Write-Info "`nDeleting namespace wms..."
    kubectl delete namespace wms --ignore-not-found=true --wait=false
    $timeout = 60
    $elapsed = 0
    while ((kubectl get namespace wms 2>$null) -and ($elapsed -lt $timeout)) {
        Write-Info "  Waiting for namespace deletion... ($elapsed/$timeout sec)"
        Start-Sleep -Seconds 5
        $elapsed += 5
    }
    if (kubectl get namespace wms 2>$null) {
        Write-Warn "Namespace still exists, forcing deletion..."
        kubectl delete namespace wms --force --grace-period=0 2>$null
    }
    Write-Info "`nDeleting PersistentVolumes..."
    kubectl delete pv --all --ignore-not-found=true
    Write-Info "`nRemoving labels from nodes..."
    kubectl label nodes --all node-role.storage-        2>$null
    kubectl label nodes --all node-role.backend-        2>$null
    kubectl label nodes --all node-role.frontend-       2>$null
    kubectl label nodes --all node-role.infrastructure- 2>$null
    Write-Info "`nClean Docker images? (yes/no)"
    $cleanImages = Read-Host
    if ($cleanImages -eq "yes") {
        $imagesToRemove = @("eureka-server", "api-gateway", "sso-service",
                            "organization-service", "warehouse-service",
                            "product-service", "document-service", "frontend")
        foreach ($img in $imagesToRemove) {
            docker rmi -f "$($img):latest" 2>$null
        }
        Write-Success "Docker images removed"
    }
    Write-Success "Clean complete"
}
function Main {
    switch ($Action) {
        "setup" {
            Test-Prerequisites
            Setup-ClusterNodes
        }
        "build" {
            Test-Prerequisites
            Build-DockerImages
        }
        "deploy" {
            Test-Prerequisites
            if (-not $SkipBuild) { Build-DockerImages }
            Deploy-ToKubernetes
            Start-Sleep -Seconds 5
            Show-Status
        }
        "status" {
            Show-Status
        }
        "port-forward" {
            Start-PortForwards
        }
        "stop-forward" {
            Stop-PortForwards
        }
        "clean" {
            Clean-Resources
        }
        "all" {
            Test-Prerequisites
            Setup-ClusterNodes
            if (-not $SkipBuild) { Build-DockerImages }
            Deploy-ToKubernetes
            Start-Sleep -Seconds 5
            Show-Status
        }
    }
    Write-Header "Done!"
}
try {
    Main
} catch {
    Write-Err "Critical Error: $_"
    exit 1
}
