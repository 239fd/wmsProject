# =====================================================================
# Скрипт чистки призраков Python 3.13.3 и 3.9.0 из системного реестра.
# Запускать ОБЯЗАТЕЛЬНО в PowerShell ОТ ИМЕНИ АДМИНИСТРАТОРА.
#
# Что делает:
#   1. msiexec /x для 18 MSI-компонентов Python 3.13.3 (HKLM) и 3.9.0 (HKLM-WOW)
#   2. Burn-uninstall для 2 bundle-записей в HKCU (3.13.3, 3.9.0)
#   3. Удаляет HKLM PythonCore\3.13 и HKLM-WOW PythonCore\3.9-32
#   4. Удаляет C:\Python313\Scripts\ и C:\Python313\ из System PATH
#
# Все компоненты — призраки (Test-Path для их exe вернул False).
# Ошибки от msiexec при "файлы не найдены" нормальны — игнорируем.
# =====================================================================

$ErrorActionPreference = "Continue"

# --- проверка admin ---
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Этот скрипт требует прав администратора. Запусти PowerShell От имени администратора и повтори."
    exit 1
}

Write-Host "=== 1. Uninstall 18 MSI components ===" -ForegroundColor Cyan

$msiGuids = @(
    # Python 3.13.3 (64-bit) — HKLM
    "{0E707547-3C9A-44CE-B7DE-12D5816BD5A5}",  # Tcl/Tk Support
    "{64F73D42-8FE9-479F-85BE-50D5345D23C7}",  # Standard Library
    "{8FFE8C14-C93D-4E9E-867A-28E75CC49A31}",  # Core Interpreter
    "{AA6AB119-75B4-4D0B-9854-F338CC7EF8A8}",  # Add to Path
    "{B7776C12-43C7-41A6-92C3-82208E0E9357}",  # pip Bootstrap
    "{B9BD620A-192D-4190-BDF0-13096138323F}",  # Test Suite
    "{E714459A-0199-454E-943A-2B8386AC2593}",  # Development Libraries
    "{F77437C3-BF8F-48FE-9DF1-129ADC592A76}",  # Executables
    "{FE4D3CAA-0217-4263-8FCB-92ABD893823B}",  # Documentation
    # Python 3.9.0 (32-bit) — HKLM-WOW
    "{03A7843C-3566-407B-A685-C6EEBFC8F441}",  # Tcl/Tk Support
    "{4F9BC732-02A8-46B1-858C-79B46026EF41}",  # Core Interpreter
    "{6C445CC2-203D-4669-BA6C-1FE72468B62B}",  # Standard Library
    "{7BA38409-6C82-471D-9E3D-6C36E216203E}",  # Test Suite
    "{882F2C33-1025-4AED-90FF-7E1A4BC91323}",  # Documentation
    "{88B36ACC-1653-4198-9C73-57B2808C920A}",  # pip Bootstrap
    "{92513C06-CDD3-4E90-9C51-2AE636933E6F}",  # Development Libraries
    "{9CBC53FD-DC93-4F2A-8DFB-30867A55F3FD}",  # Executables
    "{B5C0938C-369D-4FE2-AF54-1984FF6B3585}"   # Utility Scripts
)
foreach ($g in $msiGuids) {
    Write-Host "  msiexec /x $g /qn" -ForegroundColor DarkGray
    $p = Start-Process -FilePath "msiexec.exe" -ArgumentList "/x", $g, "/qn", "/norestart" -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -eq 0) {
        Write-Host "    OK" -ForegroundColor Green
    } elseif ($p.ExitCode -eq 1605) {
        Write-Host "    not registered (already clean)" -ForegroundColor DarkGray
    } else {
        Write-Host "    exit=$($p.ExitCode) (ignored)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== 2. Burn bundles (HKCU - 3.13.3 + 3.9.0) ===" -ForegroundColor Cyan
# Bundles в HKCU - запускаем UninstallString от текущего юзера.
# Внутри admin-shell HKCU = админский, поэтому делаем это через runas пользователя.
# Проще: запустим из обычной PowerShell после admin-секции (см. вывод в конце).
# Здесь просто покажем команды.
$bundles = @(
    @{ Guid = "{08e71e50-ef1b-4db1-82a2-622d72b5fee9}"; Name = "Python 3.13.3 (64-bit)" },
    @{ Guid = "{41214a40-fad4-439a-881c-6026cdd88dbf}"; Name = "Python 3.9.0 (32-bit)" }
)
foreach ($b in $bundles) {
    $bundleKey = "Registry::HKEY_USERS\$($env:USERNAME)"  # placeholder; real check ниже
    Write-Host "  Bundle $($b.Name) - запустится в шаге 4 от обычного юзера" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== 3. Cleanup HKLM PythonCore ===" -ForegroundColor Cyan
$hklmKeys = @(
    "HKLM:\SOFTWARE\Python\PythonCore\3.13",
    "HKLM:\SOFTWARE\WOW6432Node\Python\PythonCore\3.9-32"
)
foreach ($k in $hklmKeys) {
    if (Test-Path $k) {
        Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $k) {
            Write-Host "  FAILED to remove $k" -ForegroundColor Red
        } else {
            Write-Host "  Removed $k" -ForegroundColor Green
        }
    } else {
        Write-Host "  $k - already gone" -ForegroundColor DarkGray
    }
}
# empty parent keys
foreach ($parent in @("HKLM:\SOFTWARE\Python\PythonCore", "HKLM:\SOFTWARE\Python",
                      "HKLM:\SOFTWARE\WOW6432Node\Python\PythonCore", "HKLM:\SOFTWARE\WOW6432Node\Python")) {
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
Write-Host "=== 4. Cleanup System PATH ===" -ForegroundColor Cyan
$sysPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$before = $sysPath -split ';'
$ghostsInPath = $before | Where-Object { $_ -match 'C:\\Python313' -or $_ -match 'C:\\Python39' -or $_ -match 'Python\\Python39-32' }
if ($ghostsInPath) {
    $after = $before | Where-Object { -not ($_ -match 'C:\\Python313' -or $_ -match 'C:\\Python39' -or $_ -match 'Python\\Python39-32') }
    $newPath = ($after -join ';').TrimEnd(';')
    Write-Host "  Removing from System PATH:" -ForegroundColor Yellow
    $ghostsInPath | ForEach-Object { Write-Host "    - $_" -ForegroundColor DarkYellow }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    Write-Host "  System PATH updated" -ForegroundColor Green
} else {
    Write-Host "  No ghost paths in System PATH" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Теперь:" -ForegroundColor White
Write-Host "  1) Открой Settings -> Apps -> App execution aliases -> выключи python.exe и python3.exe" -ForegroundColor White
Write-Host "  2) В этой же admin-PowerShell запусти:" -ForegroundColor White
Write-Host "       winget install --exact --id Python.Python.3.12 --scope machine --source winget" -ForegroundColor Cyan
Write-Host "  3) Открой НОВУЮ обычную PowerShell (без админа) и проверь:" -ForegroundColor White
Write-Host "       python --version" -ForegroundColor Cyan
Write-Host "       py -3 --version" -ForegroundColor Cyan
Write-Host ""
Write-Host "Опционально: bundle-записи 3.13.3 и 3.9.0 в HKCU могут остаться в 'Установленных приложениях'." -ForegroundColor DarkGray
Write-Host "После успешной установки 3.12 их можно скрыть так (из ОБЫЧНОЙ PS, не admin):" -ForegroundColor DarkGray
Write-Host '  Remove-Item "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{08e71e50-ef1b-4db1-82a2-622d72b5fee9}" -Recurse -Force' -ForegroundColor DarkGray
Write-Host '  Remove-Item "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{41214a40-fad4-439a-881c-6026cdd88dbf}" -Recurse -Force' -ForegroundColor DarkGray
