Write-Host "=== Starting Port-Forward for All Services ===" -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{Name="RabbitMQ Management"; Service="rabbitmq"; Port="15672:15672"},
    @{Name="Grafana"; Service="grafana"; Port="3001:3001"},
    @{Name="Prometheus"; Service="prometheus"; Port="9090:9090"},
    @{Name="Eureka Server"; Service="eureka-server"; Port="8761:8761"},
    @{Name="Frontend"; Service="frontend"; Port="3000:80"},
    @{Name="Loki"; Service="loki"; Port="3100:3100"}
)

Write-Host "Starting port-forwarding for services..." -ForegroundColor Yellow
Write-Host ""

foreach ($svc in $services) {
    $command = "kubectl port-forward -n wms svc/$($svc.Service) $($svc.Port)"

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $command
    Write-Host "[OK] Started port-forward for $($svc.Name) on port $($svc.Port.Split(':')[0])" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "=== All Port-Forwards Started ===" -ForegroundColor Green
Write-Host ""

$minikubeIP = minikube ip 2>$null

Write-Host "Available Services:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API Gateway:        http://$minikubeIP:30765" -ForegroundColor White
Write-Host "  Frontend:           http://localhost:3000" -ForegroundColor White
Write-Host "  RabbitMQ:           http://localhost:15672 (guest/guest)" -ForegroundColor White
Write-Host "  Grafana:            http://localhost:3001 (admin/admin)" -ForegroundColor White
Write-Host "  Prometheus:         http://localhost:9090" -ForegroundColor White
Write-Host "  Eureka Server:      http://localhost:8761" -ForegroundColor White
Write-Host "  Loki:               http://localhost:3100" -ForegroundColor White
Write-Host ""
Write-Host "Port-forwards are running in separate PowerShell windows." -ForegroundColor Yellow
Write-Host "To stop all port-forwards, run: .\stop-port-forwards.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to open services menu..." -ForegroundColor Cyan
Read-Host

Write-Host ""
Write-Host "Open in browser:" -ForegroundColor Yellow
Write-Host "  [1] Frontend" -ForegroundColor White
Write-Host "  [2] RabbitMQ Management" -ForegroundColor White
Write-Host "  [3] Grafana" -ForegroundColor White
Write-Host "  [4] Prometheus" -ForegroundColor White
Write-Host "  [5] Eureka Server" -ForegroundColor White
Write-Host "  [6] API Gateway" -ForegroundColor White
Write-Host "  [A] Open All" -ForegroundColor Green
Write-Host "  [Q] Exit" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Select service"

switch ($choice) {
    '1' { Start-Process "http://localhost:3000" }
    '2' { Start-Process "http://localhost:15672" }
    '3' { Start-Process "http://localhost:3001" }
    '4' { Start-Process "http://localhost:9090" }
    '5' { Start-Process "http://localhost:8761" }
    '6' { Start-Process "http://${minikubeIP}:30765" }
    'A' {
        Start-Process "http://localhost:3000"
        Start-Process "http://localhost:15672"
        Start-Process "http://localhost:3001"
        Start-Process "http://localhost:9090"
        Start-Process "http://localhost:8761"
        Start-Process "http://${minikubeIP}:30765"
    }
    'Q' { exit 0 }
}

