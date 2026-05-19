# =====================================================================
# Smoke test for Python rpa-service end-to-end via WMS gateway.
# Prereq:
#   - rpa-service running on :8060 (run backend/rpa-service/run.ps1)
#   - eureka :8761, gateway :8765, document-service :8040 up
#   - For step (c): product-service :8030, postgres-product :5435,
#     1C UT 11.2 open on "Заказы поставщикам" journal
#   - You have a DIRECTOR JWT (login via UI or /api/auth/login)
#
# Usage:
#   .\smoke-rpa.ps1                      # only (a) + (b), no jwt needed for (a)
#   .\smoke-rpa.ps1 -Jwt "eyJ..."        # (a) + (b)
#   .\smoke-rpa.ps1 -Jwt "eyJ..." -OneC  # (a) + (b) + (c)
# =====================================================================
Param(
    [string]$Jwt = "",
    [switch]$OneC,
    [string]$RpaUrl = "http://localhost:8060",
    [string]$Gateway = "http://localhost:8765"
)

$ErrorActionPreference = "Continue"

function Step($n, $title) {
    Write-Host ""
    Write-Host "=== ($n) $title ===" -ForegroundColor Cyan
}

# --- (a) Python /health ---
Step "a" "Python /health"
try {
    $health = Invoke-RestMethod -Uri "$RpaUrl/health" -Method GET -TimeoutSec 5
    Write-Host "  status: $($health.status)" -ForegroundColor Green
    Write-Host "  templates_count: $($health.templates_count)"
    Write-Host "  supported_doc_types: $($health.supported_doc_types -join ', ')"
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Make sure: cd backend\rpa-service && .\run.ps1" -ForegroundColor Yellow
    exit 1
}

# --- (b) Generate invoice through document-service via gateway ---
Step "b" "POST /api/documents/invoice with X-Generation-Mode: rpa"
$body = @{
    documentNumber = "SMOKE-INV-$(Get-Date -Format 'yyMMddHHmmss')"
    documentDate = (Get-Date -Format 'yyyy-MM-dd')
    sellerName = "ООО Тест Продавец"
    sellerInn = "100123456"
    buyerName = "ООО Тест Покупатель"
    buyerInn = "100654321"
    items = @(
        @{ productName = "Тестовый товар"; quantity = 2; unitPrice = 100.5; totalPrice = 201 }
    )
    totalAmount = 201
    currency = "BYN"
} | ConvertTo-Json -Depth 5

$headers = @{
    "Content-Type" = "application/json"
    "X-Generation-Mode" = "rpa"
}
if ($Jwt) {
    $headers["Authorization"] = "Bearer $Jwt"
}

$out = "$env:TEMP\smoke-invoice.docx"
$headersDump = "$env:TEMP\smoke-invoice-headers.txt"

try {
    $resp = Invoke-WebRequest -Uri "$Gateway/api/documents/invoice" `
                              -Method POST `
                              -Headers $headers `
                              -Body $body `
                              -OutFile $out `
                              -PassThru `
                              -TimeoutSec 120
    Write-Host "  HTTP $($resp.StatusCode)" -ForegroundColor Green
    $channel = $resp.Headers["X-Generation-Channel"]
    Write-Host "  X-Generation-Channel: $channel" -ForegroundColor $(if ($channel -eq "rpa") {'Green'} elseif ($channel -like "rpa-fallback*") {'Yellow'} else {'Red'})
    $size = (Get-Item $out).Length
    Write-Host "  Saved: $out  ($size bytes)"

    # Verify it's a real Office document
    $bytes = [System.IO.File]::ReadAllBytes($out)
    if ($bytes.Length -ge 4 -and $bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B -and $bytes[2] -eq 0x03 -and $bytes[3] -eq 0x04) {
        Write-Host "  magic: PK (valid OOXML zip)" -ForegroundColor Green
    } elseif ($bytes.Length -ge 5 -and ($bytes[0..4] -join ',') -eq '37,80,68,70,45') {
        Write-Host "  magic: %PDF (Apache POI fallback)" -ForegroundColor Yellow
    } else {
        $hex = ($bytes[0..3] | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
        Write-Host "  magic: unknown ($hex) - may be plaintext error" -ForegroundColor Yellow
        if ($bytes.Length -lt 500) {
            Write-Host "  Body preview: $([Text.Encoding]::UTF8.GetString($bytes))"
        }
    }

    if ($channel -eq "rpa-fallback-error") {
        Write-Host ""
        Write-Host "  CHANNEL=rpa-fallback-error means document-service couldn't reach Python." -ForegroundColor Yellow
        Write-Host "  Check document-service logs for the actual error." -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  HTTP $statusCode FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($statusCode -eq 401) {
        Write-Host "  No/invalid JWT. Get one via UI login or POST /api/auth/login, then pass -Jwt '<token>'." -ForegroundColor Yellow
    } elseif ($statusCode -eq 502 -or $statusCode -eq 503) {
        Write-Host "  Gateway can't reach document-service. Is it up? Eureka registered?" -ForegroundColor Yellow
    }
}

# --- (c) Trigger 1C parse through product-service ---
if ($OneC) {
    Step "c" "POST /api/erp-extractor/run?mode=onec"
    if (-not $Jwt) {
        Write-Host "  -Jwt is required for (c). Skipping." -ForegroundColor Yellow
    } else {
        try {
            $headersC = @{
                "Authorization" = "Bearer $Jwt"
                "Content-Type" = "application/json"
            }
            $resp = Invoke-RestMethod -Uri "$Gateway/api/erp-extractor/run?mode=onec" `
                                     -Method POST `
                                     -Headers $headersC `
                                     -TimeoutSec 180
            Write-Host "  source: $($resp.source)" -ForegroundColor Green
            Write-Host "  found:  $($resp.found)"
            Write-Host "  new:    $($resp.new)"
            Write-Host "  success: $($resp.success)" -ForegroundColor $(if ($resp.success) {'Green'} else {'Red'})
            if ($resp.error) {
                Write-Host "  error:  $($resp.error)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  Required: product-service up + 1C running on 'Заказы поставщикам'" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "If (b) X-Generation-Channel=rpa - Python integration works end-to-end."
