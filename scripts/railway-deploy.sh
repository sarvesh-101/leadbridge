#!/bin/bash
# ─── Railway Backend Deploy Script ────────────────────────────────
# Run this AFTER:
#   1. Railway plan is active (trial expired → need paid plan)
#   2. `railway link --project leadbridge` has been run
#
# This script:
#   1. Links to the correct services (Postgres, Redis)
#   2. Sets all env vars from server/.env with real keys
#   3. Adds a new server service from the repo
#   4. Deploys it
#   5. Exposes a public domain
#   6. Updates FRONTEND_URL + WEBHOOK_URL with the Railway domain
# ──────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="server/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found"
  exit 1
fi

# Helper: read env var value from .env file
get_env() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-
}

echo "═══════════════════════════════════════════════"
echo "🚂 Railway Deploy for LeadBridge"
echo "═══════════════════════════════════════════════"

# Step 1: Link to Postgres and Redis
echo ""
echo "Step 1/7 — Linking to database services..."
railway service link Postgres 2>&1 || true
railway service link Redis 2>&1 || true

# Get DATABASE_URL from Railway Postgres (auto-injected)
RAILWAY_DB_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")
RAILWAY_REDIS_URL=$(railway variables get REDIS_URL 2>/dev/null || echo "")

echo "  DATABASE_URL: ${RAILWAY_DB_URL:0:30}..."
echo "  REDIS_URL: ${RAILWAY_REDIS_URL:0:30}..."

# Step 2: Set all env vars on the Postgres service (which will auto-inject to server)
echo ""
echo "Step 2/7 — Setting environment variables..."

# These go on the Postgres service so they're visible to all services in the project
railway variables set \
  NODE_ENV=production \
  PORT=3000 \
  JWT_SECRET="$(get_env JWT_SECRET)" \
  JWT_REFRESH_SECRET="$(get_env JWT_REFRESH_SECRET)" \
  OMNIDIM_API_KEY="$(get_env OMNIDIM_API_KEY)" \
  OMNIDIM_BASE_URL="$(get_env OMNIDIM_BASE_URL)" \
  PHONE_PROVIDER=omnidimension \
  VOICE_AI_PROVIDER=omnidimension \
  DEEPSEEK_API_KEY="$(get_env DEEPSEEK_API_KEY)" \
  DEEPSEEK_BASE_URL="$(get_env DEEPSEEK_BASE_URL)" \
  DEEPSEEK_MODEL="$(get_env DEEPSEEK_MODEL)" \
  OPENROUTER_API_KEY="$(get_env OPENROUTER_API_KEY)" \
  WHATSAPP_TOKEN="$(get_env WHATSAPP_TOKEN)" \
  WHATSAPP_PHONE_ID="$(get_env WHATSAPP_PHONE_ID)" \
  WHATSAPP_VERIFY_TOKEN="$(get_env WHATSAPP_VERIFY_TOKEN)" \
  WHATSAPP_BUSINESS_ACCOUNT_ID="$(get_env WHATSAPP_BUSINESS_ACCOUNT_ID)" \
  RAZORPAY_KEY_ID="$(get_env RAZORPAY_KEY_ID)" \
  RAZORPAY_KEY_SECRET="$(get_env RAZORPAY_KEY_SECRET)" \
  RAZORPAY_WEBHOOK_SECRET="$(get_env RAZORPAY_WEBHOOK_SECRET)" \
  RAZORPAY_PLAN_STARTER="$(get_env RAZORPAY_PLAN_STARTER)" \
  RAZORPAY_PLAN_GROWTH="$(get_env RAZORPAY_PLAN_GROWTH)" \
  RAZORPAY_PLAN_PRO="$(get_env RAZORPAY_PLAN_PRO)" \
  SMTP_HOST="$(get_env SMTP_HOST)" \
  SMTP_PORT="$(get_env SMTP_PORT)" \
  SMTP_USER="$(get_env SMTP_USER)" \
  SMTP_PASS="$(get_env SMTP_PASS)" \
  FROM_EMAIL="$(get_env FROM_EMAIL)" \
  FROM_NAME="$(get_env FROM_NAME)" \
  GOOGLE_CLIENT_ID="$(get_env GOOGLE_CLIENT_ID)" \
  GOOGLE_CLIENT_SECRET="$(get_env GOOGLE_CLIENT_SECRET)" \
  MESSAGEBIRD_API_KEY="$(get_env MESSAGEBIRD_API_KEY)" \
  SMS_SENDER_ID="$(get_env SMS_SENDER_ID)" \
  ENCRYPTION_KEY="$(get_env ENCRYPTION_KEY)" \
  CRON_SECRET="$(get_env CRON_SECRET)" \
  SUPABASE_URL="$(get_env SUPABASE_URL)" \
  SUPABASE_SERVICE_KEY="$(get_env SUPABASE_SERVICE_KEY)" \
  SUPABASE_RECORDINGS_BUCKET="$(get_env SUPABASE_RECORDINGS_BUCKET)" \
  FORWARDING_EMAIL="forward@converza.tech" \
  OMNIDIM_COST_PER_MINUTE="$(get_env OMNIDIM_COST_PER_MINUTE)" \
  PHONE_NUMBER_MONTHLY_COST="$(get_env PHONE_NUMBER_MONTHLY_COST)" \
  BROKER_CALL_PRICE="$(get_env BROKER_CALL_PRICE)" \
  PRO_MONTHLY_CALL_CAP="$(get_env PRO_MONTHLY_CALL_CAP)" \
  DEMO_MODE=false \
  2>&1

echo "  ✅ Env vars set"

# Step 3: Add server service from GitHub repo
echo ""
echo "Step 3/7 — Adding server service..."
railway service source connect --repo sarvesh-101/leadbridge --service leadbridge 2>&1 || \
  echo "  ⚠️ Source may already be connected, continuing..."

# Step 4: Deploy
echo ""
echo "Step 4/7 — Deploying server..."
railway up --service leadbridge 2>&1

# Step 5: Wait for deploy, then add public domain
echo ""
echo "Step 5/7 — Waiting for deployment..."
railway service status 2>&1

echo ""
echo "Step 6/7 — Adding public domain..."
RAILWAY_DOMAIN=$(railway domain 2>&1 | grep -oE 'https://[a-z0-9-]+\.up\.railway\.app' || echo "")
if [ -z "$RAILWAY_DOMAIN" ]; then
  echo "  ⚠️ Could not auto-detect domain. Check: railway domain"
  RAILWAY_DOMAIN="https://leadbridge-production.up.railway.app"
fi
echo "  Railway domain: $RAILWAY_DOMAIN"

# Update FRONTEND_URL + WEBHOOK_URL on Railway to point to its own domain
railway variables set \
  FRONTEND_URL="https://leadbridge-seven.vercel.app" \
  WEBHOOK_URL="$RAILWAY_DOMAIN" \
  2>&1

# Step 7: Summary
echo ""
echo "═══════════════════════════════════════════════"
echo "✅ DEPLOY COMPLETE"
echo "═══════════════════════════════════════════════"
echo ""
echo "Backend URL:  $RAILWAY_DOMAIN"
echo "Frontend URL: https://leadbridge-seven.vercel.app"
echo ""
echo "Next steps:"
echo "  1. Update Vercel env vars to point at $RAILWAY_DOMAIN"
echo "  2. Update CSP in next.config.js to include $RAILWAY_DOMAIN"
echo "  3. Run: cd frontend && vercel deploy --prod --yes"
echo "  4. Verify: curl $RAILWAY_DOMAIN/health"
echo ""
