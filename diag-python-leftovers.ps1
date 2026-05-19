# Deep scan for ANY Python registry leftover. Read-only, prints findings.
$ErrorActionPreference = "Continue"

function Scan-Key {
    Param([string]$Root, [string]$Label)
    if (-not (Test-Path $Root)) { return }
    Get-ChildItem $Root -ErrorAction SilentlyContinue -Recurse -Depth 3 | ForEach-Object {
        $kPath = $_.PSPath
        $name = $_.PSChildName
        try {
            $props = Get-ItemProperty $kPath -ErrorAction SilentlyContinue
            $vNames = $props | Get-Member -MemberType NoteProperty -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike "PS*" } | Select-Object -ExpandProperty Name
            foreach ($vn in $vNames) {
                $val = $props.$vn
                if ($val -is [string]) {
                    if ($val -match "Python 3\.(9|12|13)" -or $val -match "C:\\Python(312|313|39)" -or $val -match "CPython-3\.(9|12|13)") {
                        Write-Host "[$Label] $kPath" -ForegroundColor Yellow
                        Write-Host "    $vn = $val" -ForegroundColor DarkYellow
                        return
                    }
                }
            }
        } catch {}
    }
}

Write-Host "=== HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer ==="
Scan-Key "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer" "HKLM-Installer"

Write-Host ""
Write-Host "=== HKLM\SOFTWARE\Classes\Installer ==="
Scan-Key "HKLM:\SOFTWARE\Classes\Installer" "HKLM-Classes-Installer"

Write-Host ""
Write-Host "=== HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Installer ==="
Scan-Key "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Installer" "HKLM-WOW-Installer"

Write-Host ""
Write-Host "=== HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall ==="
Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    if ($p.DisplayName -match "Python" -and $p.DisplayName -notmatch "Miniconda") {
        Write-Host "  [HKLM-Uninstall] $($_.PSChildName) = $($p.DisplayName)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall ==="
Get-ChildItem "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    if ($p.DisplayName -match "Python" -and $p.DisplayName -notmatch "Miniconda") {
        Write-Host "  [HKLM-WOW-Uninstall] $($_.PSChildName) = $($p.DisplayName)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall ==="
Get-ChildItem "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    if ($p.DisplayName -match "Python" -and $p.DisplayName -notmatch "Miniconda") {
        Write-Host "  [HKCU-Uninstall] $($_.PSChildName) = $($p.DisplayName)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData (all SIDs) ==="
$udRoot = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData"
if (Test-Path $udRoot) {
    Get-ChildItem $udRoot -ErrorAction SilentlyContinue | ForEach-Object {
        $sid = $_.PSChildName
        $prodKey = Join-Path $_.PSPath "Products"
        if (Test-Path $prodKey) {
            Get-ChildItem $prodKey -ErrorAction SilentlyContinue | ForEach-Object {
                $ip = Get-ItemProperty (Join-Path $_.PSPath "InstallProperties") -ErrorAction SilentlyContinue
                if ($ip.DisplayName -match "Python" -and $ip.DisplayName -notmatch "Miniconda") {
                    Write-Host "  [UserData-$sid] $($_.PSChildName) = $($ip.DisplayName)" -ForegroundColor Red
                    Write-Host "    InstallSource = $($ip.InstallSource)" -ForegroundColor DarkGray
                    Write-Host "    LocalPackage  = $($ip.LocalPackage)" -ForegroundColor DarkGray
                }
            }
        }
    }
}

Write-Host ""
Write-Host "=== HKLM\SOFTWARE\Classes\Installer\Products ==="
$prodKey = "HKLM:\SOFTWARE\Classes\Installer\Products"
if (Test-Path $prodKey) {
    Get-ChildItem $prodKey -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($p.ProductName -match "Python") {
            Write-Host "  [Classes-Products] $($_.PSChildName) = $($p.ProductName)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=== Package Cache directories ==="
@("$env:LOCALAPPDATA\Package Cache", "C:\ProgramData\Package Cache") | ForEach-Object {
    if (Test-Path $_) {
        Write-Host "  $_ :" -ForegroundColor Cyan
        Get-ChildItem $_ -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $hasPy = $false
            try {
                if ((Get-ChildItem $_.FullName -Filter "python*.exe" -ErrorAction SilentlyContinue) -or
                    (Get-ChildItem $_.FullName -Filter "*.msi" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^(core|exe|dev|lib|test|doc|tcltk|launcher|pip|path|compileall)\.msi$" })) {
                    $hasPy = $true
                }
            } catch {}
            if ($hasPy) {
                Write-Host "    $($_.Name)" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host ""
Write-Host "=== Dependency providers (Burn bundles) ==="
$depPaths = @(
    "HKLM:\SOFTWARE\Classes\Installer\Dependencies",
    "HKLM:\SOFTWARE\WOW6432Node\Classes\Installer\Dependencies"
)
foreach ($dp in $depPaths) {
    if (Test-Path $dp) {
        Get-ChildItem $dp -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.PSChildName -match "CPython|Python") {
                Write-Host "  [$dp] $($_.PSChildName)" -ForegroundColor Red
                $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if ($p.DisplayName) { Write-Host "    DisplayName = $($p.DisplayName)" -ForegroundColor DarkGray }
                if ($p.Version) { Write-Host "    Version = $($p.Version)" -ForegroundColor DarkGray }
            }
        }
    }
}

Write-Host ""
Write-Host "=== Scan complete ==="
