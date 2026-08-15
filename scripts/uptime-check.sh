#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LeadBridge — Uptime Monitor (Phase 0.6)
#
# Checks the production health endpoint every run and alerts when the API is
# down, degraded, or slow. The /health endpoint already verifies database,
# Redis and BullMQ queues, so a non-"healthy" status here means real trouble.
#
# Usage:
#   HEALTH_URL="https://your-server.up.railway.app/health" \
#   ALERT_WEBHOOK_URL="https://hooks.slack.com/..." \
#   ./scripts/uptime-check.sh
#
#   # One-shot cron (Railway Cron Job, every 5 min):
#   HEALTH_URL="..." ALERT_WEBHOOK_URL="..." node scripts/uptime-check.sh
#
# Alerting: POSTs a JSON body to ALERT_WEBHOOK_URL. Works out of the box with
# Slack / Discord / Telegram bot webhooks; for WhatsApp/email, point it at a
# small forwarder or use the Sentry/email alerting once configured.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HEALTH_URL="${HEALTH_URL:?HEALTH_URL is required, e.g. https://<server>.up.railway.app/health}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"   # optional — silent if unset
TIMEOUT="${TIMEOUT:-10}"

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATE_FILE="${STATE_FILE:-/tmp/leadbridge-uptime.state}"

# curl with timeout + follow redirects; capture HTTP code and body
RESPONSE="$(curl -sS -m "${TIMEOUT}" -w $'\n%{http_code}' "${HEALTH_URL}" 2>/dev/null || true)"
BODY="$(printf '%s' "${RESPONSE}" | head -n -1)"
CODE="$(printf '%s' "${RESPONSE}" | tail -n 1)"

# Overall status: healthy requires HTTP 200 AND body status "healthy"
STATUS="$(printf '%s' "${BODY}" | grep -o '"status":"[a-z]*"' | head -1 | cut -d'"' -f4)"
if [ "${CODE}" = "200" ] && [ "${STATUS}" = "healthy" ]; then
  echo "[${STAMP}] OK — ${CODE}, status=${STATUS}"
  # Clear any previous DOWN state so we only alert on state transitions
  rm -f "${STATE_FILE}"
  exit 0
fi

echo "[${STAMP}] ⚠️  PROBLEM — HTTP ${CODE}, status=${STATUS:-unknown}"
echo "    Body: ${BODY:0:300}"

# Alert on the FIRST failure only (state-transition), to avoid alert spam every
# 5 minutes during an outage. The file persists until health recovers.
if [ -f "${STATE_FILE}" ]; then
  echo "    Already alerting (state file exists) — skipping duplicate alert."
  exit 1
fi
touch "${STATE_FILE}"

if [ -n "${ALERT_WEBHOOK_URL}" ]; then
  PAYLOAD="{\"text\":\"🚨 *LeadBridge DOWN* — HTTP ${CODE}, status=${STATUS:-unknown}\\n${HEALTH_URL}\\nTime: ${STAMP}\"}"
  curl -sS -m 10 -X POST -H 'Content-Type: application/json' -d "${PAYLOAD}" "${ALERT_WEBHOOK_URL}" >/dev/null 2>&1 \
    && echo "    ✅ Alert sent." || echo "    ❌ Alert webhook failed."
else
  echo "    No ALERT_WEBHOOK_URL set — add one (Slack/Discord/Telegram) to get paged."
fi

exit 1
