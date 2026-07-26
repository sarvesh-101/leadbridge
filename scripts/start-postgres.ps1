Write-Output "=== Starting PostgreSQL ==="

$pgBin = "C:\Program Files\PostgreSQL\15\bin"

# Check for PostgreSQL service
$svc = Get-Service postgresql* -ErrorAction SilentlyContinue
if ($svc) {
    Write-Output "Found service: $($svc.Name) - Status: $($svc.Status)"
    if ($svc.Status -eq 'Stopped') {
        Write-Output "Starting service..."
        Start-Service $svc.Name
        Start-Sleep -Seconds 3
        Write-Output "Service started"
    }
} else {
    Write-Output "No service found, trying pg_ctl directly..."
    $pgData = "C:\Program Files\PostgreSQL\15\data"
    if (Test-Path $pgData) {
        Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList "start -D `"$pgData`" -w" -NoNewWindow
        Write-Output "pg_ctl started"
    } else {
        Write-Output "Data directory not found at $pgData"
        exit 1
    }
}

# Wait for PostgreSQL to be ready
Write-Output "Waiting for PostgreSQL to accept connections..."
$timeout = 0
do {
    Start-Sleep -Seconds 2
    $timeout += 2
    $env:PGPASSWORD = "postgres"
    $result = & "$pgBin\pg_isready.exe" -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output "PostgreSQL is ready after ${timeout}s!"
        break
    }
} while ($timeout -lt 30)

if ($timeout -ge 30) {
    Write-Output "ERROR: PostgreSQL not ready after 30s"
    exit 1
}

# Create leadbridge database if it doesn't exist
Write-Output "Creating leadbridge database if needed..."
$env:PGPASSWORD = "postgres"
$check = & "$pgBin\psql.exe" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='leadbridge'" 2>&1
if ($check -ne "1") {
    & "$pgBin\psql.exe" -U postgres -c "CREATE DATABASE leadbridge;" 2>&1
    Write-Output "Database 'leadbridge' created"
} else {
    Write-Output "Database 'leadbridge' already exists"
}

Write-Output "=== PostgreSQL is running ==="
