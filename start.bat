@echo off
setlocal enabledelayedexpansion

title LeadBridge — One-Click Startup
cd /d "%~dp0"

:: ─── Colors (disable if ANSI not supported) ────────────
set "GREEN="
set "YELLOW="
set "RED="
set "CYAN="
set "WHITE="
set "RESET="
:: Test if terminal supports ANSI
for /f %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"
if defined ESC (
    set "GREEN=%ESC%[92m"
    set "YELLOW=%ESC%[93m"
    set "RED=%ESC%[91m"
    set "CYAN=%ESC%[96m"
    set "WHITE=%ESC%[97m"
    set "RESET=%ESC%[0m"
)

echo %CYAN%╔══════════════════════════════════════════════════╗%RESET%
echo %CYAN%║        LeadBridge — Starting All Services        ║%RESET%
echo %CYAN%╚══════════════════════════════════════════════════╝%RESET%
echo.

:: ─── Read DB and Redis passwords from .env ────────────
set "DB_PASSWORD=postgres"
set "REDIS_PASSWORD=redispass"
if exist "server\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (`findstr /b "DB_PASSWORD=" server\.env`) do set "DB_PASSWORD=%%b"
    for /f "usebackq tokens=1,2 delims==" %%a in (`findstr /b "REDIS_PASSWORD=" server\.env`) do set "REDIS_PASSWORD=%%b"
)

:: ─── PID file for cleanup ─────────────────────────────
set "PID_FILE=%temp%\leadbridge-pids.txt"
if exist "%PID_FILE%" del "%PID_FILE%"

:: ─── Step 1: Check .env exists ──────────────────────────
echo %YELLOW%[1/6] Checking environment configuration...%RESET%
if not exist "server\.env" (
    if exist "server\.env.example" (
        echo %YELLOW%  Creating .env from .env.example...%RESET%
        copy "server\.env.example" "server\.env" >nul
        echo %RED%  ⚠ Edit server\.env with your JWT_SECRET and OMNIDIM_API_KEY before running!%RESET%
        pause
        exit /b 1
    ) else (
        echo %RED%  ✗ No .env or .env.example found!%RESET%
        pause
        exit /b 1
    )
)
echo %GREEN%  ✓ .env file found%RESET%

:: ─── Step 2: Install npm dependencies ──────────────────
echo %YELLOW%[2/6] Installing dependencies...%RESET%
echo %YELLOW%  Installing server dependencies...%RESET%
cd /d "%~dp0server"
call npm install --silent 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ✗ Server npm install failed%RESET%
    pause
    exit /b 1
)
echo %GREEN%  ✓ Server dependencies installed%RESET%

echo %YELLOW%  Installing frontend dependencies...%RESET%
cd /d "%~dp0frontend"
call npm install --silent 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ✗ Frontend npm install failed%RESET%
    pause
    exit /b 1
)
echo %GREEN%  ✓ Frontend dependencies installed%RESET%

:: ─── Step 3: Start Docker Desktop if needed ────────────
echo %YELLOW%[3/6] Checking Docker...%RESET%
cd /d "%~dp0"

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%  Starting Docker Desktop...%RESET%
    
    :: Try multiple installation paths
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
    ) else if exist "%ProgramFiles%\Docker\Docker\Resources\bin\docker.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Resources\bin\docker.exe"
    ) else (
        echo %RED%  ✗ Docker Desktop not found at common paths.%RESET%
        echo %YELLOW%  Please start Docker Desktop manually, then run this script again.%RESET%
        pause
        exit /b 1
    )
    
    echo %YELLOW%  Waiting for Docker to start (this may take up to 60s)...%RESET%
    set /a attempts=0
    :wait_docker
    set /a attempts+=1
    if !attempts! gtr 30 (
        echo %RED%  ✗ Docker failed to start after 60 seconds.%RESET%
        echo %YELLOW%  Try starting Docker Desktop manually, then run this script again.%RESET%
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    docker info >nul 2>&1
    if !errorlevel! neq 0 goto wait_docker
)
echo %GREEN%  ✓ Docker is running%RESET%

:: ─── Step 4: Start PostgreSQL and Redis ───────────────
echo %YELLOW%[4/6] Starting infrastructure (PostgreSQL + Redis)...%RESET%

:: Pull images in parallel
start /b docker pull postgres:16-alpine --quiet >nul 2>&1
start /b docker pull redis:7-alpine --quiet >nul 2>&1

:: Start containers
docker compose -f docker/docker-compose.yml up -d postgres redis 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ✗ Failed to start Docker containers%RESET%
    pause
    exit /b 1
)

:: Wait for PostgreSQL to be healthy (rely on Docker healthcheck)
echo %YELLOW%  Waiting for PostgreSQL and Redis to be ready...%RESET%
set /a attempts=0
:wait_containers
set /a attempts+=1
if !attempts! gtr 30 (
    echo %RED%  ✗ Containers failed to start within 60 seconds%RESET%
    docker compose -f docker/docker-compose.yml ps --filter "status=running" 2>&1
    pause
    exit /b 1
)
docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U postgres >nul 2>&1
if !errorlevel! neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_containers
)
echo %GREEN%  ✓ PostgreSQL is healthy%RESET%
echo %GREEN%  ✓ Redis is healthy (via Docker healthcheck)%RESET%

:: ─── Step 5: Run Prisma migrations ─────────────────────
echo %YELLOW%[5/6] Setting up database...%RESET%
cd /d "%~dp0server"

echo %YELLOW%  Generating Prisma client...%RESET%
call npx prisma generate 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ✗ Prisma generate failed%RESET%
    pause
    exit /b 1
)
echo %GREEN%  ✓ Prisma client generated%RESET%

echo %YELLOW%  Running database migrations...%RESET%
call npx prisma db push 2>&1
if %errorlevel% neq 0 (
    echo %RED%  ✗ Database migration failed%RESET%
    pause
    exit /b 1
)
echo %GREEN%  ✓ Database is ready%RESET%

:: ─── Step 6: Launch Server + Frontend ─────────────────
echo %YELLOW%[6/6] Launching applications...%RESET%

:: Start server in new window (track PID via a marker file)
echo %YELLOW%  Starting API server (port 3000)...%RESET%
start "LeadBridge-Server" cmd /c "cd /d %~dp0server && title LeadBridge API Server && npm run dev"
:: Capture the PID of the cmd process
for /f "tokens=2" %%a in ('tasklist /fi "windowtitle eq LeadBridge API Server" /nh 2^>nul') do echo %%a>>"%PID_FILE%"

:: Wait for server to be ready
echo %YELLOW%  Waiting for server to respond...%RESET%
set /a attempts=0
:wait_server
set /a attempts+=1
if !attempts! gtr 30 (
    echo %YELLOW%  Server still starting... continuing anyway (check server window)%RESET%
    goto server_launched
)
timeout /t 2 /nobreak >nul
:: Use where to find curl.exe, fall back to PowerShell
where curl.exe >nul 2>&1
if !errorlevel! equ 0 (
    curl.exe -s -o nul http://localhost:3000/health
    if !errorlevel! equ 0 goto server_launched
) else (
    powershell -Command "[System.Net.WebRequest]::Create('http://localhost:3000/health').GetResponse().StatusCode -eq 200" >nul 2>&1
    if !errorlevel! equ 0 goto server_launched
)
goto wait_server

:server_launched
echo %GREEN%  ✓ API server running on http://localhost:3000%RESET%

:: Start frontend in new window
echo %YELLOW%  Starting frontend (port 3001)...%RESET%
start "LeadBridge-Frontend" cmd /c "cd /d %~dp0frontend && title LeadBridge Frontend && npm run dev"
for /f "tokens=2" %%a in ('tasklist /fi "windowtitle eq LeadBridge Frontend" /nh 2^>nul') do echo %%a>>"%PID_FILE%"

:: ─── Done ─────────────────────────────────────────────
echo.
echo %GREEN%╔══════════════════════════════════════════════════╗%RESET%
echo %GREEN%║         🚀 All services are starting!            ║%RESET%
echo %GREEN%╚══════════════════════════════════════════════════╝%RESET%
echo.
echo %WHITE%  API Server:    http://localhost:3000%RESET%
echo %WHITE%  Health Check:  http://localhost:3000/health%RESET%
echo %WHITE%  Dashboard UI:  http://localhost:3001%RESET%
echo %WHITE%  PostgreSQL:    localhost:5432 (user: postgres / pass: %DB_PASSWORD%)%RESET%
echo %WHITE%  Redis:         localhost:6379 (pass: %REDIS_PASSWORD%)%RESET%
echo.
echo %YELLOW%  ⚡ Admin credentials auto-created on first run%RESET%
echo %YELLOW%  ⚡ Check the server terminal window for the password%RESET%
echo.
:: Open browser automatically
start http://localhost:3001
echo %GREEN%  ✓ Dashboard opened in your browser%RESET%
echo.
echo %CYAN%  ─────────────────────────────────────────────%RESET%
echo %CYAN%  Press any key to STOP all services%RESET%
echo %CYAN%  ─────────────────────────────────────────────%RESET%
pause >nul

:: ─── Cleanup on close ────────────────────────────────
echo.
echo %YELLOW%  Stopping services...%RESET%

:: Kill only the processes we started (not all Node.js)
if exist "%PID_FILE%" (
    for /f %%p in (%PID_FILE%) do (
        taskkill /f /pid %%p >nul 2>&1
    )
    del "%PID_FILE%"
)
:: Also kill any orphaned server/frontend cmd windows by title
taskkill /fi "windowtitle eq LeadBridge API Server*" /f >nul 2>&1
taskkill /fi "windowtitle eq LeadBridge Frontend*" /f >nul 2>&1

:: Stop Docker containers (leave them for faster restart next time)
cd /d "%~dp0"
docker compose -f docker/docker-compose.yml stop postgres redis 2>&1
echo %GREEN%  ✓ Infrastructure stopped (containers preserved for fast restart)%RESET%
echo %GREEN%  ✓ To fully remove: docker compose -f docker/docker-compose.yml down%RESET%
echo.
echo %GREEN%  ✅ Done! All services stopped.%RESET%
timeout /t 3 >nul
