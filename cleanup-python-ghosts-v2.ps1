# =====================================================================
# Cleanup v2 - direct registry removal of Python 3.13.3 + 3.9.0 ghosts.
# Run in PowerShell AS ADMINISTRATOR.
#
# Cleans (without msiexec - it fails with 1612 because source MSI missing):
#   - HKLM Uninstall entries (7 for 3.13.3 + 2 for 3.9.0)
#   - HKLM Classes\Installer\Products (7 packed GUIDs for 3.13.3)
#   - HKLM ...\Installer\UserData\S-1-5-18\Products (7 for 3.13.3)
#   - HKLM Classes\Installer\UpgradeCodes (7 values, key removed if empty)
#   - HKLM\SOFTWARE\Python\PythonCore\3.12 (stub from failed install)
#
# All targets are ghosts - exe files do not exist on disk.
# =====================================================================

$ErrorActionPreference = "Continue"

# Admin check
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Run this script in PowerShell AS ADMINISTRATOR."
    exit 1
}

# --- 1. Uninstall entries (key name = GUID with braces) ---
$uninstallGuids = @(
    "{0E707547-3C9A-44CE-B7DE-12D5816BD5A5}",
    "{64F73D42-8FE9-479F-85BE-50D5345D23C7}",
    "{AA6AB119-75B4-4D0B-9854-F338CC7EF8A8}",
    "{B7776C12-43C7-41A6-92C3-82208E0E9357}",
    "{B9BD620A-192D-4190-BDF0-13096138323F}",
    "{E714459A-0199-454E-943A-2B8386AC2593}",
    "{FE4D3CAA-0217-4263-8FCB-92ABD893823B}"
)
$uninstallGuidsWow = @(
    "{03A7843C-3566-407B-A685-C6EEBFC8F441}",
    "{88B36ACC-1653-4198-9C73-57B2808C920A}"
)

Write-Host "=== 1. HKLM Uninstall entries ===" -ForegroundColor Cyan
foreach ($g in $uninstallGuids) {
    $k = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$g"
    if (Test-Path $k) {
        Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $k) { Write-Host "  FAIL: $g" -ForegroundColor Red } else { Write-Host "  OK:   $g" -ForegroundColor Green }
    } else {
        Write-Host "  skip: $g" -ForegroundColor DarkGray
    }
}
foreach ($g in $uninstallGuidsWow) {
    $k = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\$g"
    if (Test-Path $k) {
        Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $k) { Write-Host "  FAIL: $g (WOW)" -ForegroundColor Red } else { Write-Host "  OK:   $g (WOW)" -ForegroundColor Green }
    } else {
        Write-Host "  skip: $g (WOW)" -ForegroundColor DarkGray
    }
}

# --- 2. Classes\Installer\Products (packed GUIDs, no dashes, no braces) ---
$productPacked = @(
    "21C6777B7C346A14293C2802E8E03975",
    "24D37F469EF8F97458EB055D43D5327C",
    "745707E0A9C3EC447BED215D18B65D5A",
    "911BA6AA4B57B0D489453F83CCE78F8A",
    "A026DB9BD2910914DB0F3190168323F3",
    "A954417E9910E45449A3B23868CA5239",
    "AAC3D4EF71203624F8BC29BA8D3928B3"
)

Write-Host ""
Write-Host "=== 2. Classes\Installer\Products ===" -ForegroundColor Cyan
foreach ($p in $productPacked) {
    $k = "HKLM:\SOFTWARE\Classes\Installer\Products\$p"
    if (Test-Path $k) {
        Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $k) { Write-Host "  FAIL: $p" -ForegroundColor Red } else { Write-Host "  OK:   $p" -ForegroundColor Green }
    } else {
        Write-Host "  skip: $p" -ForegroundColor DarkGray
    }
}

# --- 3. UserData per-machine products ---
Write-Host ""
Write-Host "=== 3. Installer\UserData\S-1-5-18\Products ===" -ForegroundColor Cyan
foreach ($p in $productPacked) {
    $k = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData\S-1-5-18\Products\$p"
    if (Test-Path $k) {
        Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $k) { Write-Host "  FAIL: $p" -ForegroundColor Red } else { Write-Host "  OK:   $p" -ForegroundColor Green }
    } else {
        Write-Host "  skip: $p" -ForegroundColor DarkGray
    }
}

# --- 4. UpgradeCodes (remove value, then remove empty key) ---
$upgradeMap = @(
    @{ Upgrade = "01C33C0EB800AF25CA12A88F1D1AD763"; Product = "AAC3D4EF71203624F8BC29BA8D3928B3" },
    @{ Upgrade = "2A7E2911514417B508EA8015B8C29CA9"; Product = "A026DB9BD2910914DB0F3190168323F3" },
    @{ Upgrade = "3B88752761BC5A9548720F4EE709F937"; Product = "A954417E9910E45449A3B23868CA5239" },
    @{ Upgrade = "510BFA353C85D1D5BABA784520006B30"; Product = "21C6777B7C346A14293C2802E8E03975" },
    @{ Upgrade = "840310FE4AC3F7256941E54550E6DAA1"; Product = "911BA6AA4B57B0D489453F83CCE78F8A" },
    @{ Upgrade = "93542F304CEC56E56BF3B3DCE26635FC"; Product = "24D37F469EF8F97458EB055D43D5327C" },
    @{ Upgrade = "CBF4007CE70F8CA5F8F4CD333ED5C508"; Product = "745707E0A9C3EC447BED215D18B65D5A" }
)

Write-Host ""
Write-Host "=== 4. Classes\Installer\UpgradeCodes ===" -ForegroundColor Cyan
foreach ($u in $upgradeMap) {
    $k = "HKLM:\SOFTWARE\Classes\Installer\UpgradeCodes\$($u.Upgrade)"
    if (Test-Path $k) {
        Remove-ItemProperty -Path $k -Name $u.Product -ErrorAction SilentlyContinue
        $remaining = (Get-Item $k -ErrorAction SilentlyContinue).Property
        if (-not $remaining -or $remaining.Count -eq 0) {
            Remove-Item -Path $k -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $k)) {
                Write-Host "  OK + removed empty: $($u.Upgrade)" -ForegroundColor Green
            } else {
                Write-Host "  value-only OK: $($u.Upgrade)" -ForegroundColor Green
            }
        } else {
            Write-Host "  value removed, key still has [$($remaining -join ',')] : $($u.Upgrade)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  skip: $($u.Upgrade)" -ForegroundColor DarkGray
    }
}

# --- 5. PythonCore 3.12 stub ---
Write-Host ""
Write-Host "=== 5. HKLM PythonCore stub ===" -ForegroundColor Cyan
foreach ($k in @("HKLM:\SOFTWARE\Python\PythonCore\3.12", "HKLM:\SOFTWARE\WOW6432Node\Python\PythonCore\3.12")) {
    if (Test-Path $k) {
        Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $k) { Write-Host "  FAIL: $k" -ForegroundColor Red } else { Write-Host "  OK:   $k" -ForegroundColor Green }
    } else {
        Write-Host "  skip: $k" -ForegroundColor DarkGray
    }
}
foreach ($parent in @(
    "HKLM:\SOFTWARE\Python\PythonCore",
    "HKLM:\SOFTWARE\Python",
    "HKLM:\SOFTWARE\WOW6432Node\Python\PythonCore",
    "HKLM:\SOFTWARE\WOW6432Node\Python")) {
    if (Test-Path $parent) {
        $sub = Get-ChildItem $parent -ErrorAction SilentlyContinue
        if (-not $sub) {
            Remove-Item $parent -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $parent)) {
                Write-Host "  Removed empty $parent" -ForegroundColor Green
            }
        }
    }
}

Write-Host ""
Write-Host "=== Final state check ===" -ForegroundColor Cyan
$cnt = 0
@("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall") | ForEach-Object {
    if (Test-Path $_) {
        Get-ChildItem $_ -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if ($p.DisplayName -match "Python 3\.(9|13)" -and $p.DisplayName -notmatch "Miniconda") {
                    $cnt++
                    Write-Host "  STILL THERE: $($p.DisplayName)" -ForegroundColor Red
                }
            } catch {}
        }
    }
}
Write-Host ""
if ($cnt -eq 0) {
    Write-Host "Registry clean. Now install 3.12:" -ForegroundColor Green
    Write-Host ""
    Write-Host "  winget install --exact --id Python.Python.3.12 --scope machine --source winget" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "Still $cnt ghost(s) - show me this script output." -ForegroundColor Yellow
}
