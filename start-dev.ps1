#Requires -Version 5.1
<#
.SYNOPSIS
    AI Peer Review System — 一键启动脚本
.DESCRIPTION
    支持两种模式：

    【本地开发模式】（默认）
      1. 检查前置依赖 (Node.js, Docker, Python)
      2. 启动 PostgreSQL 容器并等待 healthy
      3. 生成 .env（如不存在）
      4. 安装后端 + 前端依赖
      5. 启动后端 (Express :8080)
      6. 启动前端 (Vite :5173)
      7. (可选) 启动 AI 服务 (Flask :5001)

    【Docker 全容器模式】（-Docker）
      一键 docker compose up 启动全部 4 个服务：
        db + backend + ai-service + frontend (nginx + HTTPS)
      访问地址：https://www.peer.review.uconn.edu

.NOTES
    用法：  .\start-dev.ps1              # 本地开发模式（数据库 + 后端 + 前端）
            .\start-dev.ps1 -WithAI      # 本地模式 + AI 服务
            .\start-dev.ps1 -Docker      # Docker 全容器模式（含 HTTPS）
            .\start-dev.ps1 -Docker -Build  # 全容器模式 + 强制重新构建镜像
            .\start-dev.ps1 -SkipInstall # 跳过 npm install（加速重启）
            .\start-dev.ps1 -StopAll     # 停止所有服务并清理
#>

param(
    [switch]$WithAI,
    [switch]$SkipInstall,
    [switch]$StopAll,
    [switch]$Docker,
    [switch]$Build
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 路径 ──────────────────────────────────────────────────
$ProjectRoot = $PSScriptRoot
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$AIServiceDir = Join-Path $ProjectRoot "ai-service"

# ── 颜色辅助 ──────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

# ── Docker 全容器模式 ────────────────────────────────────
if ($Docker) {
    Write-Step "检查 Docker 环境..."
    try {
        docker info 2>$null | Out-Null
        Write-Ok "Docker 守护进程运行中"
    } catch {
        Write-Err "Docker 守护进程未运行，请启动 Docker Desktop"
        exit 1
    }

    Write-Step "启动全部 Docker 容器 (db + backend + ai-service + frontend)..."
    Push-Location $ProjectRoot
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    if ($Build) {
        Write-Host "  强制重新构建镜像..." -ForegroundColor Gray
        docker compose up -d --build 2>&1 | Out-Host
    } else {
        docker compose up -d 2>&1 | Out-Host
    }
    $dcExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    Pop-Location
    if ($dcExit -ne 0) {
        Write-Err "docker compose up 失败 (exit code $dcExit)"
        exit 1
    }

    # 等待各服务就绪
    Write-Host "  等待服务就绪" -NoNewline
    $maxWait = 90
    $waited = 0
    $allReady = $false
    while ($waited -lt $maxWait) {
        try {
            $dbHealth = (docker inspect --format '{{.State.Health.Status}}' sdp-team-61-integrated-db-1 2>$null) | Out-String
            $beHealth = (docker inspect --format '{{.State.Health.Status}}' sdp-team-61-integrated-backend-1 2>$null) | Out-String
            $aiHealth = (docker inspect --format '{{.State.Health.Status}}' sdp-team-61-integrated-ai-service-1 2>$null) | Out-String
            if ($dbHealth.Trim() -eq 'healthy' -and $beHealth.Trim() -eq 'healthy' -and $aiHealth.Trim() -eq 'healthy') {
                $allReady = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "." -NoNewline
    }
    Write-Host ""

    if ($allReady) {
        Write-Ok "所有服务已就绪 (healthy)"
    } else {
        Write-Warn "部分服务可能尚未完全就绪，请运行 docker compose ps 检查"
    }

    # 显示容器状态
    Write-Step "容器状态"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>$null | Out-Host

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  AI Peer Review System 已启动（Docker 全容器模式）" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  HTTPS 地址： " -NoNewline; Write-Host "https://www.peer.review.uconn.edu" -ForegroundColor Cyan
    Write-Host "  HTTP  地址： " -NoNewline; Write-Host "http://www.peer.review.uconn.edu  (自动跳转 HTTPS)" -ForegroundColor Gray
    Write-Host "  后端 API：   " -NoNewline; Write-Host "http://localhost:8080  (通过 nginx 代理)" -ForegroundColor Gray
    Write-Host "  AI 服务：    " -NoNewline; Write-Host "http://localhost:5001" -ForegroundColor Gray
    Write-Host "  数据库：     " -NoNewline; Write-Host "localhost:5432" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  测试账号：" -ForegroundColor White
    Write-Host "    instructor@example.com / password123  (Instructor)"
    Write-Host "    alice@example.com      / password123  (Student)"
    Write-Host "    bob@example.com        / password123  (Student)"
    Write-Host "    carol@example.com      / password123  (Student)"
    Write-Host ""
    Write-Host "  查看日志：" -ForegroundColor White
    Write-Host "    docker compose logs -f              # 全部日志"
    Write-Host "    docker compose logs backend -f      # 后端日志"
    Write-Host "    docker compose logs frontend -f     # 前端日志"
    Write-Host "    docker compose logs ai-service -f   # AI 服务日志"
    Write-Host ""
    Write-Host "  停止所有：" -ForegroundColor White
    Write-Host "    .\start-dev.ps1 -StopAll"
    Write-Host "    docker compose down                 # 保留数据"
    Write-Host "    docker compose down -v              # 清除数据"
    Write-Host ""
    Write-Host "  注意：首次访问 HTTPS 时浏览器会提示「不安全」（自签名证书），" -ForegroundColor Yellow
    Write-Host "  点击「高级」→「继续前往」即可。" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# ── 停止模式 ──────────────────────────────────────────────
if ($StopAll) {
    Write-Step "停止所有服务..."
    Push-Location $ProjectRoot
    try {
        docker compose down 2>$null
        Write-Ok "Docker 容器已停止"
    } catch {
        Write-Warn "Docker compose down 失败（可能未在运行）"
    }
    Pop-Location

    # 尝试杀掉开发进程
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -match "app\.py"
    } -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Ok "开发进程已清理"
    Write-Host "`n全部服务已停止。`n" -ForegroundColor Green
    exit 0
}

# ── 子进程收集（用于退出时清理）────────────────────────
$script:ChildJobs = @()

function Cleanup {
    Write-Host "`n`n正在清理子进程..." -ForegroundColor Yellow
    foreach ($job in $script:ChildJobs) {
        try {
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        } catch { }
    }
    # 也停止以 npx/tsx/vite/python 启动的子进程
    Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq "" } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "已清理。按 Ctrl+C 或关闭窗口退出。" -ForegroundColor Yellow
}

# 注册退出钩子
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup } -ErrorAction SilentlyContinue | Out-Null

# ══════════════════════════════════════════════════════════
# STEP 1 — 前置依赖检查
# ══════════════════════════════════════════════════════════
Write-Step "检查前置依赖..."

# Node.js
$nodeVer = $null
try { $nodeVer = (node --version 2>$null) } catch { }
if (-not $nodeVer) {
    Write-Err "未检测到 Node.js，请先安装：https://nodejs.org/"
    exit 1
}
$nodeMajor = [int]($nodeVer -replace '^v','').Split('.')[0]
if ($nodeMajor -lt 18) {
    Write-Err "Node.js 版本 $nodeVer 过低，需要 >= 18"
    exit 1
}
Write-Ok "Node.js $nodeVer"

# Docker
$dockerOk = $false
try {
    $dockerVer = docker --version 2>$null
    if ($dockerVer) { $dockerOk = $true }
} catch { }
if (-not $dockerOk) {
    Write-Err "未检测到 Docker，请先安装 Docker Desktop：https://www.docker.com/products/docker-desktop/"
    exit 1
}
Write-Ok $dockerVer

# Docker daemon 是否在运行
try {
    docker info 2>$null | Out-Null
} catch {
    Write-Err "Docker 守护进程未运行，请启动 Docker Desktop"
    exit 1
}
Write-Ok "Docker 守护进程运行中"

# Python (可选)
if ($WithAI) {
    $pyVer = $null
    try { $pyVer = (python --version 2>$null) } catch { }
    if (-not $pyVer) {
        Write-Err "启用了 -WithAI 但未检测到 Python，请先安装：https://www.python.org/"
        exit 1
    }
    Write-Ok $pyVer
}

# ══════════════════════════════════════════════════════════
# STEP 2 — 启动 PostgreSQL
# ══════════════════════════════════════════════════════════
Write-Step "启动 PostgreSQL 数据库容器..."

Push-Location $ProjectRoot
try {
    docker compose up db -d 2>&1 | Out-Host
} catch {
    Write-Err "docker compose up db 失败：$_"
    Pop-Location
    exit 1
}
Pop-Location

# 等待 healthy
Write-Host "  等待数据库就绪" -NoNewline
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    $status = $null
    try {
        $status = (docker inspect --format '{{.State.Health.Status}}' sdp-team-61-integrated-db-1 2>$null) | Out-String
        $status = $status.Trim()
    } catch { }
    if ($status -eq "healthy") { break }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""
if ($waited -ge $maxWait) {
    Write-Err "数据库在 ${maxWait}s 内未就绪，请检查 Docker 日志：docker compose logs db"
    exit 1
}
Write-Ok "PostgreSQL 已就绪 (healthy)"

# ══════════════════════════════════════════════════════════
# STEP 3 — 生成 .env 文件
# ══════════════════════════════════════════════════════════
Write-Step "检查 .env 配置文件..."

$backendEnv = Join-Path $BackendDir ".env"
if (-not (Test-Path $backendEnv)) {
    Copy-Item (Join-Path $BackendDir ".env.example") $backendEnv
    Write-Ok "已从 .env.example 创建 backend/.env"
} else {
    Write-Ok "backend/.env 已存在，跳过"
}

if ($WithAI) {
    $aiEnv = Join-Path $AIServiceDir ".env"
    if (-not (Test-Path $aiEnv)) {
        Copy-Item (Join-Path $AIServiceDir ".env.example") $aiEnv
        Write-Warn "已创建 ai-service/.env — 请编辑并填入 OPENAI_API_KEY"
    } else {
        Write-Ok "ai-service/.env 已存在"
    }
}

# ══════════════════════════════════════════════════════════
# STEP 4 — 安装依赖
# ══════════════════════════════════════════════════════════
if (-not $SkipInstall) {
    Write-Step "安装后端依赖..."
    Push-Location $BackendDir
    npm install 2>&1 | Select-Object -Last 3 | Out-Host
    Pop-Location
    Write-Ok "后端依赖已安装"

    Write-Step "安装前端依赖..."
    Push-Location $FrontendDir
    npm install 2>&1 | Select-Object -Last 3 | Out-Host
    Pop-Location
    Write-Ok "前端依赖已安装"

    if ($WithAI) {
        Write-Step "安装 AI 服务依赖..."
        Push-Location $AIServiceDir
        if (-not (Test-Path "venv")) {
            python -m venv venv
            Write-Ok "已创建 Python 虚拟环境"
        }
        & ".\venv\Scripts\pip.exe" install -q -r requirements.txt 2>&1 | Select-Object -Last 3 | Out-Host
        Pop-Location
        Write-Ok "AI 服务依赖已安装"
    }
} else {
    Write-Warn "跳过依赖安装 (-SkipInstall)"
}

# ══════════════════════════════════════════════════════════
# STEP 5 — 启动后端
# ══════════════════════════════════════════════════════════
Write-Step "启动后端服务 (Express :8080)..."

$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & npx tsx watch src/server.ts 2>&1
} -ArgumentList $BackendDir

$script:ChildJobs += $backendJob
Write-Ok "后端已在后台启动 (Job ID: $($backendJob.Id))"

# 等待后端可达
Write-Host "  等待后端响应" -NoNewline
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $result = curl.exe -s -o NUL -w '%{http_code}' http://localhost:8080/healthz 2>$null
        if ($result -eq "200") { break }
    } catch { }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""
if ($waited -ge $maxWait) {
    Write-Warn "后端在 ${maxWait}s 内未响应，继续启动其他服务..."
    Write-Host "  后端日志：" -ForegroundColor Gray
    Receive-Job $backendJob 2>$null | Select-Object -Last 10 | Out-Host
} else {
    Write-Ok "后端已就绪：http://localhost:8080"
}

# ══════════════════════════════════════════════════════════
# STEP 6 — 启动前端
# ══════════════════════════════════════════════════════════
Write-Step "启动前端服务 (Vite :5173)..."

$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & npx vite --host 2>&1
} -ArgumentList $FrontendDir

$script:ChildJobs += $frontendJob
Write-Ok "前端已在后台启动 (Job ID: $($frontendJob.Id))"

# 等待前端可达
Write-Host "  等待前端响应" -NoNewline
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $result = curl.exe -s -o NUL -w '%{http_code}' http://localhost:5173/ 2>$null
        if ($result -eq "200") { break }
    } catch { }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}
Write-Host ""
if ($waited -ge $maxWait) {
    Write-Warn "前端在 ${maxWait}s 内未响应"
} else {
    Write-Ok "前端已就绪：http://localhost:5173"
}

# ══════════════════════════════════════════════════════════
# STEP 7 — 启动 AI 服务（可选）
# ══════════════════════════════════════════════════════════
if ($WithAI) {
    Write-Step "启动 AI 服务 (Flask :5001)..."

    $aiJob = Start-Job -ScriptBlock {
        param($dir)
        Set-Location $dir
        & ".\venv\Scripts\python.exe" app.py 2>&1
    } -ArgumentList $AIServiceDir

    $script:ChildJobs += $aiJob
    Write-Ok "AI 服务已在后台启动 (Job ID: $($aiJob.Id))"

    Start-Sleep -Seconds 5
    try {
        $result = curl.exe -s -o NUL -w '%{http_code}' http://localhost:5001/healthz 2>$null
        if ($result -eq "200") {
            Write-Ok "AI 服务已就绪：http://localhost:5001"
        } else {
            Write-Warn "AI 服务可能尚未就绪，请稍后检查"
        }
    } catch {
        Write-Warn "AI 服务可能尚未就绪，请稍后检查"
    }
}

# ══════════════════════════════════════════════════════════
# 完成！
# ══════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  AI Peer Review System 已启动！" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  前端界面：  " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "  后端 API：  " -NoNewline; Write-Host "http://localhost:8080" -ForegroundColor Cyan
if ($WithAI) {
    Write-Host "  AI 服务：   " -NoNewline; Write-Host "http://localhost:5001" -ForegroundColor Cyan
}
Write-Host "  数据库：    " -NoNewline; Write-Host "localhost:5432" -ForegroundColor Cyan
Write-Host ""
Write-Host "  测试账号：" -ForegroundColor White
Write-Host "    instructor@example.com / password123  (Instructor)"
Write-Host "    alice@example.com      / password123  (Student)"
Write-Host "    bob@example.com        / password123  (Student)"
Write-Host "    carol@example.com      / password123  (Student)"
Write-Host ""
Write-Host "  查看日志：" -ForegroundColor White
Write-Host "    Receive-Job $($backendJob.Id)      # 后端日志"
Write-Host "    Receive-Job $($frontendJob.Id)      # 前端日志"
if ($WithAI -and $aiJob) {
    Write-Host "    Receive-Job $($aiJob.Id)      # AI 服务日志"
}
Write-Host "    docker compose logs db     # 数据库日志"
Write-Host ""
Write-Host "  停止所有：" -ForegroundColor White
Write-Host "    .\start-dev.ps1 -StopAll"
Write-Host ""
Write-Host "  按 Ctrl+C 退出（子进程将自动清理）" -ForegroundColor Yellow
Write-Host ""

# 保持脚本运行，监控子进程
try {
    while ($true) {
        $allFailed = $true
        foreach ($job in $script:ChildJobs) {
            if ($job.State -ne "Failed" -and $job.State -ne "Completed") {
                $allFailed = $false
            }
            if ($job.State -eq "Failed") {
                $jobName = "未知服务"
                if ($backendJob -and $job.Id -eq $backendJob.Id)   { $jobName = "后端" }
                if ($frontendJob -and $job.Id -eq $frontendJob.Id) { $jobName = "前端" }
                if ($WithAI -and $aiJob -and $job.Id -eq $aiJob.Id) { $jobName = "AI 服务" }
                Write-Err "$jobName 进程异常退出！最近日志："
                Receive-Job $job 2>$null | Select-Object -Last 15 | Out-Host
                # 从列表中移除已处理的失败任务，避免重复输出
                $script:ChildJobs = $script:ChildJobs | Where-Object { $_.Id -ne $job.Id }
            }
        }
        if ($allFailed -and $script:ChildJobs.Count -gt 0) {
            Write-Err "所有服务进程已退出"
            break
        }
        Start-Sleep -Seconds 3
    }
} finally {
    Cleanup
}
