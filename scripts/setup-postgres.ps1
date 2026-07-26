Write-Output "=== PostgreSQL Setup ==="

# Check if PostgreSQL is already installed
$pgPaths = @(
    "C:\Program Files\PostgreSQL\*\bin\pg_isready.exe",
    "C:\Program Files\PostgreSQL\*\bin\psql.exe",
    "${env:ProgramFiles}\PostgreSQL\*\bin\psql.exe",
    "${env:ProgramFiles(x86)}\PostgreSQL\*\bin\psql.exe"
)

foreach ($pattern in $pgPaths) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    if ($found) {
        Write-Output "PostgreSQL already installed at: $($found[0].DirectoryName)"
        exit 0
    }
}

# Try winget install
Write-Output "Attempting winget install..."
try {
    $result = winget install -e --id "PostgreSQL.PostgreSQL.16" --silent --accept-source-agreements 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output "PostgreSQL installed successfully via winget!"
        exit 0
    }
} catch {}

Write-Output "Winget failed. Downloading installer directly..."

# Download PostgreSQL 16.4 installer
$url = "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe"
$installer = "$env:TEMP\postgresql-16.4-installer.exe"

Write-Output "Downloading from: $url"
try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $installer)
    Write-Output "Downloaded to: $installer"
    
    # Check file size
    $file = Get-Item $installer
    $sizeMB = [math]::Round($file.Length / 1MB, 1)
    Write-Output "File size: ${sizeMB}MB"
    exit 0
} catch {
    Write-Output "Download failed: $_"
    
    # Try alternative URL
    $url2 = "https://sbp.enterprisedb.com/getfile.jsp?fileid=postgresql-16.4-1-windows-x64"
    Write-Output "Trying alternative URL..."
    try {
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($url2, $installer)
        Write-Output "Downloaded to: $installer"
        exit 0
    } catch {
        Write-Output "Alternative download also failed: $_"
        exit 1
    }
}
