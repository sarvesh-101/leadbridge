# update-secrets.ps1 — one-shot helper to rotate the Razorpay keys and the
# Supabase DB password in server/.env (LOCAL FILE ONLY — nothing is sent anywhere).
#
# Run it from a PowerShell window opened in the project root:
#   powershell -ExecutionPolicy Bypass -File scripts\update-secrets.ps1
#
# It will:
#   1. Ask for the new Razorpay Key ID + Key Secret (paste, Enter)
#   2. Ask for the new Supabase DB password (hidden input — paste + Enter)
#   3. Update RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in server/.env
#   4. Rewrite the password inside BOTH DATABASE_URL and DATABASE_URL_PRISMA
#   5. Print only masked confirmation (first 6 chars of values)
#
# NOTE: after this, you MUST also update the same values in the Render dashboard
# (Environment tab) — this script only touches the LOCAL file.

$ErrorActionPreference = "Stop"

$envPath = Join-Path $PSScriptRoot "..\server\.env"
if (-not (Test-Path $envPath)) {
  Write-Host "ERROR: could not find server/.env at $envPath" -ForegroundColor Red
  exit 1
}

Write-Host "=== Converza secret rotation helper (local file only) ===" -ForegroundColor Cyan
Write-Host "File: $envPath"
Write-Host ""

# ── 1. Collect new values ──────────────────────────────────────────────
$keyId = Read-Host "Paste new Razorpay Key ID (rzp_live_...)"
if ($keyId -notmatch "^rzp_live_") {
  Write-Host "WARNING: key ID does not start with rzp_live_ — make sure you are using LIVE keys, not test keys." -ForegroundColor Yellow
  $confirm = Read-Host "Continue anyway? (y/N)"
  if ($confirm -ne "y") { exit 1 }
}
$keySecret = Read-Host "Paste new Razorpay Key Secret (input hidden)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecret)
$keySecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$dbPassSecure = Read-Host "Paste new Supabase DB password (input hidden)" -AsSecureString
$bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassSecure)
$dbPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr2)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)

if (-not $keyId -or -not $keySecretPlain -or -not $dbPass) {
  Write-Host "ERROR: one of the values was empty — aborting, nothing written." -ForegroundColor Red
  exit 1
}

# URL-encode the password for safe use inside the postgres:// URL
Add-Type -AssemblyName System.Web | Out-Null
$dbPassEncoded = [System.Web.HttpUtility]::UrlEncode($dbPass)

# ── 2. Load and rewrite .env ───────────────────────────────────────────
$lines = Get-Content $envPath
$out = @()
$updated = @{ KeyId = $false; KeySecret = $false; DbUrl = $false; DbUrlPrisma = $false }

foreach ($line in $lines) {
  if ($line -match "^RAZORPAY_KEY_ID=") {
    $out += "RAZORPAY_KEY_ID=$keyId"; $updated.KeyId = $true
  }
  elseif ($line -match "^RAZORPAY_KEY_SECRET=") {
    $out += "RAZORPAY_KEY_SECRET=$keySecretPlain"; $updated.KeySecret = $true
  }
  elseif ($line -match "^(DATABASE_URL|DATABASE_URL_PRISMA)=postgresql://postgres\.oavzflfdjluxvdlymbug:[^@]+@") {
    $prefix = $Matches[1]
    $rest = ($line -replace "^$prefix=postgresql://postgres\.oavzflfdjluxvdlymbug:[^@]+@", "")
    $out += "$prefix=postgresql://postgres.oavzflfdjluxvdlymbug:$dbPassEncoded@$rest"
    if ($prefix -eq "DATABASE_URL") { $updated.DbUrl = $true } else { $updated.DbUrlPrisma = $true }
  }
  else {
    $out += $line
  }
}

# Append any var that was missing entirely
if (-not $updated.KeyId)       { $out += "RAZORPAY_KEY_ID=$keyId" }
if (-not $updated.KeySecret)   { $out += "RAZORPAY_KEY_SECRET=$keySecretPlain" }

Set-Content -Path $envPath -Value $out -Encoding UTF8

Write-Host ""
Write-Host "✅ server/.env updated:" -ForegroundColor Green
if ($updated.KeyId)     { Write-Host ("  RAZORPAY_KEY_ID        -> " + $keyId.Substring(0, [Math]::Min(12, $keyId.Length)) + "…") }
if ($updated.KeySecret) { Write-Host ("  RAZORPAY_KEY_SECRET    -> set (" + $keySecretPlain.Length + " chars, not shown)") }
if ($updated.DbUrl)     { Write-Host "  DATABASE_URL           -> password replaced (encoded)" }
if ($updated.DbUrlPrisma) { Write-Host "  DATABASE_URL_PRISMA    -> password replaced (encoded)" }

Write-Host ""
Write-Host "NEXT (manual):" -ForegroundColor Cyan
Write-Host "  1. Render dashboard -> your API service -> Environment"
Write-Host "  2. Update DATABASE_URL and DATABASE_URL_PRISMA with the SAME new password"
Write-Host "  3. Save -> wait for redeploy -> then test https://leadbridge-zy4o.onrender.com/health"
Write-Host "  4. Tell Codebuff 'file updated' to verify everything."
