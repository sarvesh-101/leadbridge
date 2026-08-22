#!/bin/bash
# ─── Render.com Backend Deploy Script ──────────────────────────────
# Prerequisites:
#   1. Install Render CLI: npm i -g @anthropic-ai/render
#   2. Sign up at render.com (GitHub OAuth)
#   3. Have the Supabase DB password ready
#
# Usage:
#   ./scripts/render-deploy.sh <SUPABASE_DB_PASSWORD>
# ────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

DB_PASSWORD="${1:-}"

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Usage: ./scripts/render-deploy.sh <SUPABASE_DB_PASSWORD>"
  echo ""
  echo "Get the password from: Supabase Dashboard → Settings → Database → Password"
  exit 1
fi

PROJECT_REF="oavzflfdjluxvdlymbug"
SUPABASE_REGION="aws-0-ap-south-1"  # Mumbai — closest to India

# Construct Supabase Postgres connection string
# Format: postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres
DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@${SUPABASE_REGION}.pooler.supabase.com:6543/postgres"

echo "═══════════════════════════════════════════════"
echo "🚀 Render.com Deploy for LeadBridge"
echo "═══════════════════════════════════════════════"

# Step 1: Test DB connection
echo ""
echo "Step 1/4 — Testing Supabase DB connection..."
if command -v psql &> /dev/null; then
  psql "$DB_URL" -c "SELECT 1 as connected;" 2>&1 || echo "  ⚠️ psql test failed, but will retry via Prisma"
else
  echo "  ⚠️ psql not installed — skipping direct test"
fi

# Step 2: Push schema to Supabase
echo ""
echo "Step 2/4 — Pushing Prisma schema to Supabase..."
cd server
DATABASE_URL="$DB_URL" npx prisma db push 2>&1
echo "  ✅ Schema pushed"

# Step 3: Seed data (optional — run if DB is empty)
echo ""
echo "Step 3/4 — Seeding database..."
DATABASE_URL="$DB_URL" npx prisma db seed 2>&1 || echo "  ⚠️ Seed skipped (may already have data)"

cd ..

echo ""
echo "Step 4/4 — Manual deploy instructions:"
echo ""
echo "═══════════════════════════════════════════════"
echo "📋 NEXT STEPS (do on render.com dashboard):"
echo "═══════════════════════════════════════════════"
echo ""
echo "1. Go to https://dashboard.render.com"
echo "2. New → Web Service → Connect GitHub repo: sarvesh-101/leadbridge"
echo "3. Settings:"
echo "   - Name: leadbridge-api"
echo "   - Region: Mumbai (ap-south-1)"  
echo "   - Branch: main"
echo "   - Root Directory: server"
echo "   - Runtime: Node"
echo "   - Build Command: npm ci && npx prisma generate && npm run build"
echo "   - Start Command: node dist/index.js"
echo ""
echo "4. Environment Variables — paste these:"
echo "   DATABASE_URL=$DB_URL"
echo "   DATABASE_URL_PRISMA=$DB_URL"
echo ""
# Read and print all non-empty env vars
while IFS='=' read -r key value; do
  case "$key" in
    \#*|"") continue ;;
    DATABASE_URL*|REDIS_URL*) continue ;;  # Already handled
    *_SECRET|*_KEY|*_TOKEN|*_PASS) 
      echo "   $key=<from server/.env — paste manually>" ;;
    *)
      if [ -n "$value" ]; then
        echo "   $key=$value"
      fi ;;
  esac
done < server/.env

echo ""
echo "5. Deploy and wait for build to complete"
echo "6. Copy the public URL (e.g. https://leadbridge-api.onrender.com)"
echo ""
echo "═══════════════════════════════════════════════"
echo "✅ After deploy: tell me the Render URL and I'll:"
echo "   - Update Vercel env vars (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL)"
echo "   - Update CSP in next.config.js"
echo "   - Redeploy frontend"
echo "═══════════════════════════════════════════════"
