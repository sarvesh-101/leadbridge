# Restart Docker Desktop
Write-Output "Stopping Docker Desktop..."
taskkill /f /im "Docker Desktop.exe" 2>$null
Start-Sleep -Seconds 5

Write-Output "Starting Docker Desktop..."
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

Write-Output "Waiting for Docker daemon (up to 90s)..."
$timeout = 90
$elapsed = 0
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 3
    $elapsed += 3
    try {
        $info = docker info 2>$null
        if ($info -match "Server Version") {
            Write-Output "Docker ready after ${elapsed}s!"
            exit 0
        }
    } catch {}
    Write-Output "  ... ${elapsed}s elapsed"
}
Write-Output "ERROR: Docker not ready after 90s"
exit 1
