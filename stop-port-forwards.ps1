Write-Host "=== Stopping All Port-Forwards ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Finding and stopping kubectl port-forward processes..." -ForegroundColor Yellow

$processes = Get-Process -Name "kubectl" -ErrorAction SilentlyContinue

if ($processes) {
    foreach ($proc in $processes) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            if ($cmdLine -like "*port-forward*") {
                Stop-Process -Id $proc.Id -Force
                Write-Host "[OK] Stopped port-forward process (PID: $($proc.Id))" -ForegroundColor Green
            }
        } catch {
            Write-Host "[WARNING] Could not stop process PID: $($proc.Id)" -ForegroundColor Yellow
        }
    }
    Write-Host ""
    Write-Host "All port-forwards stopped." -ForegroundColor Green
} else {
    Write-Host "No active port-forward processes found." -ForegroundColor Yellow
}

Write-Host ""

