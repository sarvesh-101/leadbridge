@echo off
REM ============================================================
REM  start-ngrok.bat - Start the public ngrok tunnel (pinned)
REM ============================================================
REM  LeadBridge's webhooks depend on a STABLE public URL
REM  (WEBHOOK_URL in server/.env). This tunnel is pinned to the
REM  account's PERMANENT static ngrok domain, so the URL never
REM  changes across restarts.
REM
REM  IMPORTANT: Do NOT start ngrok manually with a bare
REM  `ngrok http 8080` - that creates a NEW random URL every time
REM  and silently breaks the Omnidimension webhook + cost tracking.
REM  Always use this script (or the exact command below).
REM
REM  Requirements:
REM    1. The reverse proxy must be running first:
REM         node scripts/proxy.js   (listens on port 8080)
REM    2. ngrok installed + logged in (ngrok config check)
REM
REM  If you ever change the domain in the ngrok dashboard, update
REM  NGROK_URL here AND WEBHOOK_URL in server/.env to match.
REM
REM  NOTE: if the tunnel is ALREADY running, this script prints
REM  ERR_NGROK_334 ("endpoint is already online") - that is the
REM  expected signal that the existing tunnel is fine, not a mistake.
REM ============================================================

set NGROK_URL=https://casino-bunkbed-bronze.ngrok-free.dev

echo.
echo  Starting ngrok tunnel pinned to: %NGROK_URL%
echo  Forwarding: http://localhost:8080 (reverse proxy)
echo  Press Ctrl+C to stop.
echo.
ngrok http --url=%NGROK_URL% 8080

REM Keep the window open if ngrok exits immediately (e.g. not logged in)
pause
