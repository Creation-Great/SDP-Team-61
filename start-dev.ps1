#Requires -Version 5.1
<#
.SYNOPSIS
    SDP Peer Review System — one-click local/Docker dev startup script

.DESCRIPTION
    Two modes:

    [Local dev mode] (default)
      1. Check prerequisites (Node.js >= 18, Docker, optional Python)
      2. Start PostgreSQL container and wait for healthy
      3. Create backend/.env and optional ai-service/.env if missing
      4. Optionally run backend DB migrations (-Migrations)
      5. Install backend + frontend deps (skip with -SkipInstall)
      6. Start backend (Express :8080), auto-run migrations
      7. Start frontend (Vite :5173)
      8. Optionally start AI service (Flask :5001) (-WithAI)

    [Docker full-stack mode] (-Docker)
      docker compose up for db + backend + ai-service + frontend(nginx).
      Access URLs shown in output (HTTPS/HTTP).

.PARAMETER WithAI
    In local mode, also start AI service (Flask :5001). Requires Python installed.

.PARAMETER SkipInstall
    Skip npm install / pip install. Use when deps are already installed and you only need to restart services.

.PARAMETER Migrations
    In local mode, explicitly run backend migrations (npm run migrate) after DB is ready, then start backend.
    Backend also runs migrations on startup; use this to run migrations alone or enforce order.

.PARAMETER StopAll
    Stop Docker containers and attempt to stop local Node/Python dev processes.
    Note: stops node processes in the current user session; do not use if other Node apps are running.

.PARAMETER Docker
    Start in Docker full-stack mode (db + backend + ai-service + frontend).

.PARAMETER Build
    With -Docker, force rebuild images (docker compose up -d --build).

.PARAMETER Help
    Show this help.

.EXAMPLE
    .\start-dev.ps1
    Local dev: start DB + backend + frontend

.EXAMPLE
    .\start-dev.ps1 -WithAI
    Local dev with AI service

.EXAMPLE
    .\start-dev.ps1 -SkipInstall
    Skip install, start services only (faster restart when deps already installed)

.EXAMPLE
    .\start-dev.ps1 -Docker
    Docker full-stack mode

.EXAMPLE
    .\start-dev.ps1 -Docker -Build
    Docker full-stack mode with image rebuild

.EXAMPLE
    .\start-dev.ps1 -StopAll
    Stop all services and clean processes

.EXAMPLE
    .\start-dev.ps1 -Help
    Show help

.NOTES
    See docs/DEPLOYMENT.md and docs/USER_GUIDE.md for deployment and usage.
    Test accounts: instructor@example.com / password123 (instructor); alice@example.com / password123 (student).
#>

param(
    [switch]$WithAI,
    [switch]$SkipInstall,
    [switch]$Migrations,
    [switch]$StopAll,
    [switch]$Docker,
    [switch]$Build,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Paths ─────────────────────────────────────────────────
$ProjectRoot = $PSScriptRoot
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$AIServiceDir = Join-Path $ProjectRoot "ai-service"

# ── Help ───────────────────────────────────────────────────
if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Full
    exit 0
}

# ── Output helpers ────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

# HTTP health check (no curl)
function Test-HttpEndpoint {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

# Get Docker Compose container ID by service name
function Get-ComposeContainerId {
    param([string]$Service)
    Push-Location $ProjectRoot
    try {
        $id = docker compose ps -q $Service 2>$null
        if ($id) { return ($id | Out-String).Trim() }
    } finally { Pop-Location }
    return $null
}

# ── Docker full-stack mode ─────────────────────────────────
if ($Docker) {
    Write-Step "Checking Docker environment..."
    try {
        docker info 2>$null | Out-Null
        Write-Ok "Docker daemon is running"
    } catch {
        Write-Err "Docker daemon is not running; please start Docker Desktop"
        exit 1
    }

    # Root .env (JWT_SECRET, POSTGRES_PASSWORD etc.) for compose
    $rootEnv = Join-Path $ProjectRoot ".env"
    $rootEnvExample = Join-Path $ProjectRoot ".env.example"
    if (-not (Test-Path $rootEnv) -and (Test-Path $rootEnvExample)) {
        Copy-Item $rootEnvExample $rootEnv
        Write-Warn "Created root .env from .env.example"
        Write-Warn "IMPORTANT: Set POSTGRES_PASSWORD and JWT_SECRET in .env before running Docker"
    }
    # Verify POSTGRES_PASSWORD is set (required by docker-compose)
    if (Test-Path $rootEnv) {
        $envContent = Get-Content $rootEnv -Raw
        if ($envContent -notmatch 'POSTGRES_PASSWORD=\S+' -or $envContent -match 'POSTGRES_PASSWORD=change-me') {
            Write-Err "POSTGRES_PASSWORD is not set or still has the default value in .env"
            Write-Err "Please set a strong password: POSTGRES_PASSWORD=<your-secure-password>"
            exit 1
        }
    }

    Write-Step "Starting all Docker containers (db + redis + backend + ai-service + frontend)..."
    Push-Location $ProjectRoot
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    if ($Build) {
        Write-Host "  Forcing image rebuild..." -ForegroundColor Gray
        docker compose up -d --build 2>&1 | Out-Host
    } else {
        docker compose up -d 2>&1 | Out-Host
    }
    $dcExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    Pop-Location
    if ($dcExit -ne 0) {
        Write-Err "docker compose up failed (exit code $dcExit)"
        exit 1
    }

    Write-Host "  Waiting for services to be ready" -NoNewline
    $maxWait = 90
    $waited = 0
    $allReady = $false
    while ($waited -lt $maxWait) {
        $dbId = Get-ComposeContainerId "db"
        $beId = Get-ComposeContainerId "backend"
        $aiId = Get-ComposeContainerId "ai-service"
        $dbOk = $false; $beOk = $false; $aiOk = $false
        if ($dbId) {
            $st = (docker inspect --format '{{.State.Health.Status}}' $dbId 2>$null) | Out-String
            $dbOk = ($st.Trim() -eq 'healthy')
        }
        if ($beId) {
            $st = (docker inspect --format '{{.State.Health.Status}}' $beId 2>$null) | Out-String
            $beOk = ($st.Trim() -eq 'healthy')
        }
        if ($aiId) {
            $st = (docker inspect --format '{{.State.Health.Status}}' $aiId 2>$null) | Out-String
            $aiOk = ($st.Trim() -eq 'healthy')
        }
        if ($dbOk -and $beOk -and $aiOk) {
            $allReady = $true
            break
        }
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "." -NoNewline
    }
    Write-Host ""

    if ($allReady) {
        Write-Ok "All services ready (healthy)"
    } else {
        Write-Warn "Some services may not be ready yet; run: docker compose ps"
    }

    Write-Step "Container status"
    Push-Location $ProjectRoot
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>$null | Out-Host
    Pop-Location

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  SDP Peer Review System started (Docker full-stack mode)" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  HTTPS：     " -NoNewline; Write-Host "https://www.peer.review.uconn.edu" -ForegroundColor Cyan
    Write-Host "  HTTP：      " -NoNewline; Write-Host "http://www.peer.review.uconn.edu (redirects to HTTPS)" -ForegroundColor Gray
    Write-Host "  Backend API: " -NoNewline; Write-Host "http://localhost:8080" -ForegroundColor Gray
    Write-Host "  API docs:    " -NoNewline; Write-Host "http://localhost:8080/api-docs" -ForegroundColor Gray
    Write-Host "  AI service:  " -NoNewline; Write-Host "http://localhost:5001" -ForegroundColor Gray
    Write-Host "  Database:    " -NoNewline; Write-Host "localhost:5432" -ForegroundColor Gray
    Write-Host "  Redis:       " -NoNewline; Write-Host "localhost:6379" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Test accounts:" -ForegroundColor White
    Write-Host "    instructor@example.com / password123  (instructor)"
    Write-Host "    alice@example.com      / password123  (student)"
    Write-Host ""
    Write-Host "  Logs:        " -NoNewline; Write-Host "docker compose logs -f [service]" -ForegroundColor Gray
    Write-Host "  Stop:        " -NoNewline; Write-Host '.\start-dev.ps1 -StopAll' -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# ── Stop mode ──────────────────────────────────────────────
if ($StopAll) {
    Write-Step "Stopping all services..."
    Push-Location $ProjectRoot
    try {
        docker compose down 2>$null
        Write-Ok "Docker containers stopped"
    } catch {
        Write-Warn "docker compose down failed (containers may not be running)"
    }
    Pop-Location

    Write-Host "  Stopping local Node / Python dev processes..." -ForegroundColor Gray
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $pyProcs = Get-Process -Name "python" -ErrorAction SilentlyContinue
    foreach ($p in $pyProcs) {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmd -and $cmd -match "app\.py|flask") {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            }
        } catch { }
    }
    Write-Ok "Dev processes cleaned up"
    Write-Host "`nAll services stopped.`n" -ForegroundColor Green
    exit 0
}

# ── Child process tracking (for cleanup on exit) ──────────
$script:ChildJobs = @()

function Cleanup {
    Write-Host "`n`nCleaning up child processes..." -ForegroundColor Yellow
    foreach ($job in $script:ChildJobs) {
        try {
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        } catch { }
    }
    $script:ChildJobs = @()
    Write-Host "Done. Press Ctrl+C or close the window to exit." -ForegroundColor Yellow
}

$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup } -ErrorAction SilentlyContinue

# ══════════════════════════════════════════════════════════
# STEP 1 — Prerequisites
# ══════════════════════════════════════════════════════════
Write-Step "Checking prerequisites..."

$nodeVer = $null
try { $nodeVer = (node --version 2>$null) } catch { }
if (-not $nodeVer) {
    Write-Err "Node.js not found; please install: https://nodejs.org/"
    exit 1
}
$nodeMajor = [int]($nodeVer -replace '^v','').Split('.')[0]
if ($nodeMajor -lt 18) {
    Write-Err "Node.js version $nodeVer is too old; need >= 18"
    exit 1
}
Write-Ok "Node.js $nodeVer"

$dockerOk = $false
try {
    $dockerVer = docker --version 2>$null
    if ($dockerVer) { $dockerOk = $true }
} catch { }
if (-not $dockerOk) {
    Write-Err "Docker not found; please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}
Write-Ok $dockerVer

try {
    docker info 2>$null | Out-Null
} catch {
    Write-Err "Docker daemon is not running; please start Docker Desktop"
    exit 1
}
Write-Ok "Docker daemon is running"

if ($WithAI) {
    $pyVer = $null
    try { $pyVer = (python --version 2>$null) } catch { }
    if (-not $pyVer) {
        Write-Err "-WithAI was specified but Python was not found; please install: https://www.python.org/"
        exit 1
    }
    Write-Ok $pyVer
}

# ══════════════════════════════════════════════════════════
# STEP 2 — Start PostgreSQL
# ══════════════════════════════════════════════════════════
Write-Step "Starting PostgreSQL container..."

Push-Location $ProjectRoot
try {
    docker compose up db -d 2>&1 | Out-Host
} catch {
    Write-Err "docker compose up db failed: $_"
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "  Waiting for database to be ready" -NoNewline
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    $dbId = Get-ComposeContainerId "db"
    $status = $null
    if ($dbId) {
        $status = (docker inspect --format '{{.State.Health.Status}}' $dbId 2>$null) | Out-String
        $status = $status.Trim()
    }
    if ($status -eq "healthy") { break }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""
if ($waited -ge $maxWait) {
    Write-Err "Database was not ready within ${maxWait}s; check: docker compose logs db"
    exit 1
}
Write-Ok "PostgreSQL ready (healthy)"

Write-Step "Starting Redis container..."
Push-Location $ProjectRoot
try {
    docker compose up redis -d 2>&1 | Out-Host
} catch {
    Write-Warn "Redis startup failed (optional — system works without Redis)"
}
Pop-Location

# ══════════════════════════════════════════════════════════
# STEP 3 — .env config
# ══════════════════════════════════════════════════════════
Write-Step "Checking .env files..."

$backendEnv = Join-Path $BackendDir ".env"
if (-not (Test-Path $backendEnv)) {
    Copy-Item (Join-Path $BackendDir ".env.example") $backendEnv
    Write-Ok "Created backend/.env from .env.example"
    Write-Warn "Review backend/.env — set JWT_SECRET to a strong random value for production"
} else {
    Write-Ok "backend/.env already exists"
}

# Root .env for docker compose (db container needs POSTGRES_PASSWORD)
$rootEnv = Join-Path $ProjectRoot ".env"
$rootEnvExample = Join-Path $ProjectRoot ".env.example"
if (-not (Test-Path $rootEnv) -and (Test-Path $rootEnvExample)) {
    Copy-Item $rootEnvExample $rootEnv
    Write-Warn "Created root .env from .env.example — set POSTGRES_PASSWORD for Docker DB"
}

if ($WithAI) {
    $aiEnv = Join-Path $AIServiceDir ".env"
    if (-not (Test-Path $aiEnv)) {
        Copy-Item (Join-Path $AIServiceDir ".env.example") $aiEnv
        Write-Warn "Created ai-service/.env — please edit and set OPENAI_API_KEY"
    } else {
        Write-Ok "ai-service/.env already exists"
    }
}

# ══════════════════════════════════════════════════════════
# STEP 4 — Optional: run migrations
# ══════════════════════════════════════════════════════════
if ($Migrations) {
    Write-Step "Running backend database migrations..."
    Push-Location $BackendDir
    try {
        npm run migrate 2>&1 | Out-Host
        Write-Ok "Migrations completed"
    } catch {
        Write-Warn "Migrations failed or not configured: $_"
    }
    Pop-Location
}

# ══════════════════════════════════════════════════════════
# STEP 5 — Install dependencies
# ══════════════════════════════════════════════════════════
if (-not $SkipInstall) {
    Write-Step "Installing backend dependencies..."
    Push-Location $BackendDir
    npm install 2>&1 | Select-Object -Last 5 | Out-Host
    Pop-Location
    Write-Ok "Backend dependencies installed"

    Write-Step "Installing frontend dependencies..."
    Push-Location $FrontendDir
    npm install 2>&1 | Select-Object -Last 5 | Out-Host
    Pop-Location
    Write-Ok "Frontend dependencies installed"

    if ($WithAI) {
        Write-Step "Installing AI service dependencies..."
        Push-Location $AIServiceDir
        if (-not (Test-Path "venv")) {
            python -m venv venv
            Write-Ok "Created Python virtual environment"
        }
        & (Join-Path $AIServiceDir "venv\Scripts\pip.exe") install -q -r requirements.txt 2>&1 | Select-Object -Last 3 | Out-Host
        Pop-Location
        Write-Ok "AI service dependencies installed"
    }
} else {
    Write-Warn "Skipped dependency install (-SkipInstall)"
}

# ══════════════════════════════════════════════════════════
# STEP 6 — Start backend
# ══════════════════════════════════════════════════════════
Write-Step "Starting backend (Express :8080)..."

$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & npx tsx watch src/server.ts 2>&1
} -ArgumentList $BackendDir

$script:ChildJobs += $backendJob
Write-Ok "Backend started in background (Job ID: $($backendJob.Id))"

Write-Host "  Waiting for backend to respond" -NoNewline
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    if (Test-HttpEndpoint -Url "http://localhost:8080/healthz") { break }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""
if ($waited -ge $maxWait) {
    Write-Warn "Backend did not respond within ${maxWait}s; continuing to start frontend..."
    Receive-Job $backendJob 2>$null | Select-Object -Last 12 | Out-Host
} else {
    Write-Ok "Backend ready: http://localhost:8080"
}

# ══════════════════════════════════════════════════════════
# STEP 7 — Start frontend
# ══════════════════════════════════════════════════════════
Write-Step "Starting frontend (Vite :5173)..."

$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & npx vite --host 2>&1
} -ArgumentList $FrontendDir

$script:ChildJobs += $frontendJob
Write-Ok "Frontend started in background (Job ID: $($frontendJob.Id))"

Write-Host "  Waiting for frontend to respond" -NoNewline
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    if (Test-HttpEndpoint -Url "http://localhost:5173/") { break }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""
if ($waited -ge $maxWait) {
    Write-Warn "Frontend did not respond within ${maxWait}s"
} else {
    Write-Ok "Frontend ready: http://localhost:5173"
}

# ══════════════════════════════════════════════════════════
# STEP 8 — Start AI service (optional)
# ══════════════════════════════════════════════════════════
$aiJob = $null
if ($WithAI) {
    Write-Step "Starting AI service (Flask :5001)..."

    $aiJob = Start-Job -ScriptBlock {
        param($dir)
        Set-Location $dir
        $py = Join-Path $dir "venv\Scripts\python.exe"
        & $py app.py 2>&1
    } -ArgumentList $AIServiceDir

    $script:ChildJobs += $aiJob
    Write-Ok "AI service started in background (Job ID: $($aiJob.Id))"

    Start-Sleep -Seconds 5
    if (Test-HttpEndpoint -Url "http://localhost:5001/healthz") {
        Write-Ok "AI service ready: http://localhost:5001"
    } else {
        Write-Warn "AI service may not be ready yet; check later"
    }
}

# ══════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  SDP Peer Review System started (local dev mode)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:    " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend API:" -NoNewline; Write-Host "http://localhost:8080" -ForegroundColor Cyan
Write-Host "  API docs:   " -NoNewline; Write-Host "http://localhost:8080/api-docs" -ForegroundColor Cyan
Write-Host "  SSE:        " -NoNewline; Write-Host "http://localhost:8080/instructor/events" -ForegroundColor Gray
if ($WithAI) {
    Write-Host "  AI service:  " -NoNewline; Write-Host "http://localhost:5001" -ForegroundColor Cyan
}
Write-Host "  Database:   " -NoNewline; Write-Host "localhost:5432" -ForegroundColor Gray
Write-Host "  Redis:      " -NoNewline; Write-Host "localhost:6379" -ForegroundColor Gray
Write-Host ""
Write-Host "  Test accounts:" -ForegroundColor White
Write-Host "    instructor@example.com / password123  (instructor)"
Write-Host "    alice@example.com      / password123  (student)"
Write-Host "    bob@example.com       / password123  (student)"
Write-Host "    carol@example.com     / password123  (student)"
Write-Host ""
Write-Host "  View logs:" -ForegroundColor White
Write-Host "    Receive-Job $($backendJob.Id)    # backend"
Write-Host "    Receive-Job $($frontendJob.Id)   # frontend"
if ($WithAI -and $aiJob) {
    Write-Host "    Receive-Job $($aiJob.Id)    # AI service"
}
Write-Host "    docker compose logs db    # database"
Write-Host ""
Write-Host "  E2E tests:   " -NoNewline; Write-Host "cd frontend; npm run e2e" -ForegroundColor Gray
Write-Host "  Stop all:    " -NoNewline; Write-Host '.\start-dev.ps1 -StopAll' -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to exit (child processes will be cleaned up)" -ForegroundColor Yellow
Write-Host ""

# Monitor child processes
try {
    while ($true) {
        $allFailed = $true
        foreach ($job in $script:ChildJobs) {
            if ($job.State -ne "Failed" -and $job.State -ne "Completed") {
                $allFailed = $false
            }
            if ($job.State -eq "Failed") {
                $jobName = "Unknown"
                if ($backendJob -and $job.Id -eq $backendJob.Id)   { $jobName = "Backend" }
                if ($frontendJob -and $job.Id -eq $frontendJob.Id) { $jobName = "Frontend" }
                if ($WithAI -and $aiJob -and $job.Id -eq $aiJob.Id) { $jobName = "AI" }
                Write-Err "$jobName process exited. Recent log:"
                Receive-Job $job 2>$null | Select-Object -Last 15 | Out-Host
                $script:ChildJobs = $script:ChildJobs | Where-Object { $_.Id -ne $job.Id }
            }
        }
        if ($allFailed -and $script:ChildJobs.Count -gt 0) {
            Write-Err "All service processes have exited."
            break
        }
        Start-Sleep -Seconds 3
    }
} catch {
    # Ctrl+C or other termination
} finally {
    Cleanup
}
