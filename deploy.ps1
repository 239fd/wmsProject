param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('docker', 'k8s', 'kubernetes')]
    [string]$Mode = 'docker'
)

$ErrorActionPreference = "Stop"

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "Выберите режим развертывания:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [1] Docker Compose (локальная разработка)" -ForegroundColor White
    Write-Host "  [2] Kubernetes/Minikube (продакшн-подобное окружение)" -ForegroundColor White
    Write-Host "  [Q] Выход" -ForegroundColor Gray
    Write-Host ""
}

function Deploy-Docker {
    Write-Host ""
    Write-Host "=== Docker Compose Deployment ===" -ForegroundColor Cyan
    Write-Host ""

    if (Test-Path ".\deploy-docker.ps1") {
        & ".\deploy-docker.ps1"
    } else {
        Write-Host "Файл deploy-docker.ps1 не найден!" -ForegroundColor Red
        exit 1
    }
}

function Deploy-Kubernetes {
    Write-Host ""
    Write-Host "=== Kubernetes Deployment ===" -ForegroundColor Cyan
    Write-Host ""

    try {
        $null = kubectl version --client 2>$null
    } catch {
        Write-Host "kubectl не установлен! Установите kubectl для работы с Kubernetes." -ForegroundColor Red
        exit 1
    }

    try {
        $null = minikube version 2>$null
    } catch {
        Write-Host "minikube не установлен! Установите minikube для работы с Kubernetes." -ForegroundColor Red
        exit 1
    }

    if (Test-Path ".\deploy-k8s.ps1") {
        & ".\deploy-k8s.ps1"
    } else {
        Write-Host "Файл deploy-k8s.ps1 не найден!" -ForegroundColor Red
        exit 1
    }
}

if ($Mode -eq 'docker') {
    Deploy-Docker
    exit 0
} elseif ($Mode -eq 'k8s' -or $Mode -eq 'kubernetes') {
    Deploy-Kubernetes
    exit 0
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Ваш выбор"

    switch ($choice) {
        '1' {
            Deploy-Docker
            break
        }
        '2' {
            Deploy-Kubernetes
            break
        }
        'Q' {
            Write-Host "Выход..." -ForegroundColor Gray
            exit 0
        }
        default {
            Write-Host "Неверный выбор. Попробуйте снова." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}

