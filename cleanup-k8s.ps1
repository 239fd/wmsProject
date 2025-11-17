Write-Host "=== WMS Project - Kubernetes Cleanup ===" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

Write-Host "[1/4] Deleting all resources in wms namespace..." -ForegroundColor Yellow
kubectl delete namespace wms --ignore-not-found=true --wait=false

Write-Host ""
Write-Host "[2/4] Waiting for namespace deletion..." -ForegroundColor Yellow
$timeout = 60
$elapsed = 0
while ((kubectl get namespace wms 2>$null) -and ($elapsed -lt $timeout)) {
    Write-Host "  Waiting... ($elapsed/$timeout seconds)" -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $elapsed += 5
}

if (kubectl get namespace wms 2>$null) {
    Write-Host "  [WARNING] Namespace still exists, force deleting..." -ForegroundColor Yellow
    kubectl delete namespace wms --force --grace-period=0 2>$null
}

Write-Host ""
Write-Host "[3/4] Deleting PersistentVolumes..." -ForegroundColor Yellow
kubectl delete pv --all --ignore-not-found=true

Write-Host ""
Write-Host "[4/4] Removing node labels..." -ForegroundColor Yellow
kubectl label nodes --all node-role.data-storage- 2>$null
kubectl label nodes --all node-role.storage- 2>$null
kubectl label nodes --all node-role.backend- 2>$null
kubectl label nodes --all node-role.frontend- 2>$null
kubectl label nodes --all node-role.infrastructure- 2>$null
kubectl label nodes --all node-role- 2>$null

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run .\deploy-k8s.ps1 to redeploy" -ForegroundColor Cyan

