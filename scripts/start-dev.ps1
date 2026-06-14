# LeadBridge — Full Dev Stack Startup Script
# Run this from the project root:  powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       LeadBridge — Starting Dev Stack          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ─── 1. Start Garnet (Redis-compatible server) ──────────────
Write-Host "`n[1/4] Starting Garnet (Redis-compatible cache-store)..." -ForegroundColor Yellow
$garnetPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Microsoft.Garnet.DN8_Microsoft.Winget.Source_8wekyb3d8bbwe\net8.0\GarnetServer.exe"
if (Test-Path $garnetPath) {
    $garnet = Get-Process -Name "GarnetServer" -ErrorAction SilentlyContinue
    if (-not $garnet) {
        Start-Process -FilePath $garnetPath -ArgumentList "--port 6379" -WindowStyle Hidden
        Write-Host "  ✔ Garnet started on port 6379" -ForegroundColor Green
    } else {
        Write-Host "  ✔ Garnet already running on port 6379" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠ Garnet not found at: $garnetPath" -ForegroundColor Red
    Write-Host "  Install: winget install --id Microsoft.Garnet.DN8"
}

# ─── 2. Start PostgreSQL (if not running as service) ────────
Write-Host "`n[2/4] Checking PostgreSQL..." -ForegroundColor Yellow
$pg = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pg -and $pg.Status -eq "Running") {
    Write-Host "  ✔ PostgreSQL already running" -ForegroundColor Green
} else {
    Write-Host "  ⚠ PostgreSQL not running. Start manually or run Docker:" -ForegroundColor Red
    Write-Host "     docker compose -f docker/docker-compose.yml up -d postgres"
}

# ─── 3. Start Backend Server ────────────────────────────────
Write-Host "`n[3/4] Starting backend server (port 3000)..." -ForegroundColor Yellow
$serverDir = Join-Path $PSScriptRoot "..\server" -Resolve
$serverProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "tsx.*index.ts" }
if (-not $serverProcess) {
    Start-Process -FilePath "npx" -ArgumentList "tsx src/index.ts" -WorkingDirectory $serverDir -WindowStyle Hidden
    Write-Host "  ✔ Backend server starting on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "  ✔ Backend server already running" -ForegroundColor Green
}

# ─── 4. Start Frontend ─────────────────────────────────────
Write-Host "`n[4/4] Starting frontend (port 3001)..." -ForegroundColor Yellow
$frontendDir = Join-Path $PSScriptRoot "..\frontend" -Resolve
$frontendProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "next.*dev" }
if (-not $frontendProcess) {
    Start-Process -FilePath "npx" -ArgumentList "next dev --port 3001" -WorkingDirectory $frontendDir -WindowStyle Hidden
    Write-Host "  ✔ Frontend starting on http://localhost:3001" -ForegroundColor Green
} else {
    Write-Host "  ✔ Frontend already running" -ForegroundColor Green
}

# ─── Summary ────────────────────────────────────────────────
Write-Host "`n╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            Dev Stack Summary                     ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Garnet (Redis)    →  http://localhost:6379      ║" -ForegroundColor White
Write-Host "║  PostgreSQL        →  localhost:5432             ║" -ForegroundColor White
Write-Host "║  Backend API       →  http://localhost:3000      ║" -ForegroundColor White
Write-Host "║  Health Check      →  http://localhost:3000/health║" -ForegroundColor White
Write-Host "║  Frontend          →  http://localhost:3001      ║" -ForegroundColor White
Write-Host "║  Swagger Docs      →  http://localhost:8000/docs ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`nRun this to verify: curl http://localhost:3000/health" -ForegroundColor Gray
