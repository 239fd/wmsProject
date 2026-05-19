# =====================================================================
# Direct Python 3.12.10 install bypassing test/doc/dev/tcltk components.
# Run in PowerShell AS ADMINISTRATOR.
#
# Strategy: download official installer, run /quiet with
#   - InstallAllUsers=1 (per-machine, avoids _JustForMe path)
#   - Include_test=0 (the package that has been breaking everything)
#   - Include_doc=0, Include_dev=0, Include_tcltk=0 (not needed for venv/FastAPI)
#   - Include_pip=1, Include_launcher=1 (required)
#   - TargetDir=C:\Python312 (short, no spaces)
# =====================================================================

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Run AS ADMINISTRATOR."
    exit 1
}

Write-Host "=== 1. Cleanup stale Package Cache from previous attempts ===" -ForegroundColor Cyan
@("$env:LOCALAPPDATA\Package Cache", "C:\ProgramData\Package Cache") | ForEach-Object {
    if (Test-Path $_) {
        Get-ChildItem $_ -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $dir = $_
            $isPy = $false
            try {
                if ((Get-ChildItem $dir.FullName -Filter "python*.exe" -ErrorAction SilentlyContinue) -or
                    (Get-ChildItem $dir.FullName -Filter "*.msi" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^(core|exe|dev|lib|test|doc|tcltk|launcher|pip|path|appendpath|compileall)\.msi$" }) -or
                    $dir.Name -match "v3\.(9|12|13)\." ) {
                    $isPy = $true
                }
            } catch {}
            if ($isPy) {
                Write-Host "  removing $($dir.FullName)" -ForegroundColor Yellow
                Remove-Item $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host ""
Write-Host "=== 2. Download official installer ===" -ForegroundColor Cyan
$url = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"
$exe = "$env:TEMP\python-3.12.10-amd64.exe"
if (Test-Path $exe) {
    Write-Host "  cached: $exe" -ForegroundColor DarkGray
} else {
    Write-Host "  GET $url"
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -Uri $url -OutFile $exe
    Write-Host "  saved: $exe ($((Get-Item $exe).Length) bytes)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 3. Run installer (per-machine, minimal features) ===" -ForegroundColor Cyan
Write-Host "  TargetDir = C:\Python312"
Write-Host "  Components: core, exe, pip, launcher (NO test/doc/dev/tcltk)"
Write-Host ""

$args = @(
    "/quiet",
    "InstallAllUsers=1",
    "PrependPath=1",
    "Include_test=0",
    "Include_doc=0",
    "Include_dev=0",
    "Include_tcltk=0",
    "Include_launcher=1",
    "Include_pip=1",
    "Include_lib=1",
    "AssociateFiles=0",
    "Shortcuts=0",
    "TargetDir=C:\Python312"
)

$proc = Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru -NoNewWindow
Write-Host ""
Write-Host "Installer exit code: $($proc.ExitCode)" -ForegroundColor $(if ($proc.ExitCode -eq 0) {'Green'} else {'Red'})

if ($proc.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "Failed. Latest log:" -ForegroundColor Red
    $log = Get-ChildItem "$env:TEMP" -Filter "Python 3.12.10*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($log) { Write-Host "  $($log.FullName)" -ForegroundColor Yellow }
    exit $proc.ExitCode
}

Write-Host ""
Write-Host "=== 4. Verify ===" -ForegroundColor Cyan
$pyExe = "C:\Python312\python.exe"
if (Test-Path $pyExe) {
    & $pyExe --version
    Write-Host "  $pyExe present" -ForegroundColor Green
} else {
    Write-Host "  $pyExe NOT FOUND (unexpected after exit 0)" -ForegroundColor Red
}

$pyLauncher = "C:\Windows\py.exe"
if (Test-Path $pyLauncher) {
    & $pyLauncher -3 --version
    Write-Host "  py launcher OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Open a NEW PowerShell window (not admin) to pick up PATH, then:" -ForegroundColor White
Write-Host "  python --version" -ForegroundColor Cyan
Write-Host "  cd C:\Users\pavel\IdeaProjects\wmsProject_org\backend\rpa-service" -ForegroundColor Cyan
Write-Host "  .\run.ps1" -ForegroundColor Cyan
