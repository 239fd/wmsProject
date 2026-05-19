# =====================================================================
# Cleanup v3 - HKCU + Package Cache cleanup after aborted 3.12 install.
# Run in PowerShell AS ADMINISTRATOR.
# =====================================================================

$ErrorActionPreference = "Continue"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Run AS ADMINISTRATOR."
    exit 1
}

Write-Host "=== 1. HKCU PythonCore (any version) ===" -ForegroundColor Cyan
if (Test-Path "HKCU:\SOFTWARE\Python\PythonCore") {
    Get-ChildItem "HKCU:\SOFTWARE\Python\PythonCore" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  removing $($_.PSPath)"
        Remove-Item -Path $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    Remove-Item "HKCU:\SOFTWARE\Python\PythonCore" -Force -ErrorAction SilentlyContinue
    Remove-Item "HKCU:\SOFTWARE\Python" -Force -ErrorAction SilentlyContinue
    Write-Host "  done" -ForegroundColor Green
} else {
    Write-Host "  not present" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== 2. HKCU Uninstall entries for Python 3.x ===" -ForegroundColor Cyan
$hkcuU = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
if (Test-Path $hkcuU) {
    Get-ChildItem $hkcuU -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($p.DisplayName -match "^Python 3\." -and $p.DisplayName -notmatch "Miniconda") {
                Write-Host "  removing $($p.DisplayName)  [$($_.PSChildName)]"
                Remove-Item -Path $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
} else {
    Write-Host "  HKCU Uninstall key not present" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== 3. HKCU per-user Installer products (S-1-5-21-* SIDs) ===" -ForegroundColor Cyan
$userDataRoot = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData"
if (Test-Path $userDataRoot) {
    Get-ChildItem $userDataRoot -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "S-1-5-21-*" } | ForEach-Object {
        $prodKey = Join-Path $_.PSPath "Products"
        if (Test-Path $prodKey) {
            Get-ChildItem $prodKey -ErrorAction SilentlyContinue | ForEach-Object {
                $iprops = Get-ItemProperty (Join-Path $_.PSPath "InstallProperties") -ErrorAction SilentlyContinue
                if ($iprops.DisplayName -match "^Python 3\." -and $iprops.DisplayName -notmatch "Miniconda") {
                    Write-Host "  removing $($iprops.DisplayName)  [$($_.PSChildName)]"
                    Remove-Item -Path $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
} else {
    Write-Host "  UserData root not present" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== 4. Package Cache cleanup (orphan Python bundle dirs) ===" -ForegroundColor Cyan
$cacheRoots = @(
    "$env:LOCALAPPDATA\Package Cache",
    "C:\ProgramData\Package Cache"
)
foreach ($root in $cacheRoots) {
    if (-not (Test-Path $root)) { continue }
    Write-Host "  Scanning $root"
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $dir = $_
        $hasPython = $false
        try {
            $exes = Get-ChildItem $dir.FullName -Filter "python-*.exe" -ErrorAction SilentlyContinue
            if ($exes) { $hasPython = $true }
            if (-not $hasPython) {
                $msis = Get-ChildItem $dir.FullName -Filter "*.msi" -ErrorAction SilentlyContinue
                foreach ($m in $msis) {
                    if ($m.Name -match "^(core|exe|dev|lib|test|doc|tcltk|launcher|pip|path|appendpath|compileall)\.msi$") {
                        $hasPython = $true; break
                    }
                }
            }
        } catch {}
        if ($hasPython) {
            Write-Host "    removing $($dir.FullName)" -ForegroundColor Yellow
            Remove-Item -Path $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""
Write-Host "=== 5. Final state ===" -ForegroundColor Cyan
$cnt = 0
@("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall") | ForEach-Object {
    if (Test-Path $_) {
        Get-ChildItem $_ -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if ($p.DisplayName -match "^Python 3\." -and $p.DisplayName -notmatch "Miniconda") {
                    $cnt++
                    Write-Host "  STILL THERE: $($p.DisplayName)" -ForegroundColor Red
                }
            } catch {}
        }
    }
}
Write-Host ""
if ($cnt -eq 0) {
    Write-Host "ALL CLEAR. Now install 3.12:" -ForegroundColor Green
    Write-Host ""
    Write-Host "  winget install --exact --id Python.Python.3.12 --scope machine --source winget" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "Still $cnt ghost(s) remain." -ForegroundColor Yellow
}
