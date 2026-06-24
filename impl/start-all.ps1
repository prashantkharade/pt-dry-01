<#
.SYNOPSIS
    Launch every PT Kharade backend service (and optionally the admin portal),
    each in its own PowerShell window, in the correct startup order.

.DESCRIPTION
    Startup order matters: catalog-pricing / orders / notifications seeders call
    identity-service to discover the seeded tenant, so identity-service must be
    healthy first. This script:
      1. (optional) verifies Postgres is reachable on the configured port,
      2. starts identity-service and waits for /health-check,
      3. starts the other four services in parallel,
      4. waits for all of them to report healthy,
      5. starts the admin portal (unless -NoAdmin).

    The Flutter customer app is NOT started here (run it manually, see RUNNING.md).

.PARAMETER NoAdmin
    Skip launching the SvelteKit admin portal.

.PARAMETER SkipDbCheck
    Skip the Postgres reachability pre-check.

.EXAMPLE
    .\start-all.ps1
    .\start-all.ps1 -NoAdmin
#>
[CmdletBinding()]
param(
    [switch]$NoAdmin,
    [switch]$SkipDbCheck
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# name -> @{ dir; port }
$services = [ordered]@{
    'identity-service'        = 4001
    'catalog-pricing-service' = 4002
    'orders-service'          = 4003
    'payments-service'        = 4004
    'notifications-service'   = 4005
}

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

function Start-Svc($name) {
    $dir = Join-Path $root $name
    if (-not (Test-Path $dir)) { throw "Service directory not found: $dir" }
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoExit', '-Command',
        "`$Host.UI.RawUI.WindowTitle = '$name'; Set-Location '$dir'; npm run dev"
    ) | Out-Null
    Write-Host "    launched $name (own window)" -ForegroundColor DarkGray
}

function Wait-Health($name, $port, $timeoutSec = 90) {
    $url = "http://localhost:$port/health-check"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) {
                Write-Host "    OK  $name healthy ($url)" -ForegroundColor Green
                return $true
            }
        } catch { Start-Sleep -Seconds 2 }
    }
    Write-Host "    !!  $name did NOT become healthy within ${timeoutSec}s ($url)" -ForegroundColor Yellow
    return $false
}

# --- 0. Postgres pre-check ----------------------------------------------------
if (-not $SkipDbCheck) {
    Write-Step 'Checking Postgres on 127.0.0.1:5432'
    $tcp = Test-NetConnection -ComputerName '127.0.0.1' -Port 5432 -WarningAction SilentlyContinue
    if (-not $tcp.TcpTestSucceeded) {
        Write-Host '    !!  Nothing is listening on 127.0.0.1:5432.' -ForegroundColor Yellow
        Write-Host '        Start Postgres (or pass -SkipDbCheck). See RUNNING.md.' -ForegroundColor Yellow
        return
    }
    Write-Host '    OK  Postgres port is open' -ForegroundColor Green
}

# --- 1. identity-service first ------------------------------------------------
Write-Step 'Starting identity-service (must seed before the rest)'
Start-Svc 'identity-service'
if (-not (Wait-Health 'identity-service' 4001)) {
    Write-Host 'Aborting: identity-service never came up. Check its window for errors.' -ForegroundColor Red
    return
}

# --- 2. the remaining four in parallel ---------------------------------------
Write-Step 'Starting catalog-pricing / orders / payments / notifications'
foreach ($name in $services.Keys) {
    if ($name -eq 'identity-service') { continue }
    Start-Svc $name
}

Write-Step 'Waiting for all services to report healthy'
foreach ($name in $services.Keys) {
    if ($name -eq 'identity-service') { continue }
    Wait-Health $name $services[$name] | Out-Null
}

# --- 3. admin portal ----------------------------------------------------------
if (-not $NoAdmin) {
    Write-Step 'Starting admin-portal (http://localhost:5173)'
    $dir = Join-Path $root 'admin-portal'
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoExit', '-Command',
        "`$Host.UI.RawUI.WindowTitle = 'admin-portal'; Set-Location '$dir'; npm run dev"
    ) | Out-Null
    Write-Host '    launched admin-portal (own window)' -ForegroundColor DarkGray
}

Write-Host ''
Write-Step 'All processes launched. Endpoints:'
Write-Host '    identity        http://localhost:4001/health-check'
Write-Host '    catalog-pricing http://localhost:4002/health-check'
Write-Host '    orders          http://localhost:4003/health-check'
Write-Host '    payments        http://localhost:4004/health-check'
Write-Host '    notifications   http://localhost:4005/health-check'
if (-not $NoAdmin) { Write-Host '    admin-portal    http://localhost:5173' }
Write-Host ''
Write-Host '    Customer app (Flutter) is separate:' -ForegroundColor DarkGray
Write-Host '      cd customer-app; flutter run -d chrome --dart-define=IDENTITY_BASE=http://localhost:4001 ...' -ForegroundColor DarkGray
Write-Host '    See RUNNING.md for the full customer-app command.' -ForegroundColor DarkGray
