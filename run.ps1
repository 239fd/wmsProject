param([Parameter(ValueFromRemainingArguments=$true)] [string[]] $GradleArgs)

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Warning "Файл .env не найден по пути $envFile — секреты НЕ загружены."
} else {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2].Trim('"').Trim("'")
            Set-Item -Path "Env:$name" -Value $value
        }
    }
    Write-Host "Загружены env-vars из $envFile" -ForegroundColor Green
}

$backendDir = Join-Path $PSScriptRoot "backend"
$gradlew = Join-Path $backendDir "gradlew.bat"

if (-not (Test-Path $gradlew)) {
    Write-Error "gradlew.bat не найден в $backendDir"
    exit 1
}

Push-Location $backendDir
try {
    & $gradlew @GradleArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
