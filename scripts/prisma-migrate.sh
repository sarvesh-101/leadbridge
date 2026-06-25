#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# LeadBridge — Production Database Migration Script
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./scripts/prisma-migrate.sh           # Dry-run (preview changes)
#   ./scripts/prisma-migrate.sh --apply   # Apply migrations
#   ./scripts/prisma-migrate.sh --fresh   # Drop + recreate (dev only!)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"

echo "🔷 LeadBridge — Database Migration"
echo ""

# Check for .env
if [ ! -f "$SERVER_DIR/.env" ]; then
  echo "❌ No .env file found in server/.env"
  echo "   Copy .env.example to server/.env and configure your database URL."
  exit 1
fi

cd "$SERVER_DIR"

case "${1:-}" in
  --apply)
    echo "▶️  Generating and applying Prisma migrations..."
    npx prisma generate
    npx prisma migrate deploy
    echo "✅ Migrations applied successfully!"
    ;;

  --fresh)
    if [ "${NODE_ENV:-development}" = "production" ]; then
      echo "❌ Cannot use --fresh in production!"
      exit 1
    fi
    echo "⚠️  Dropping and recreating database (development only)..."
    npx prisma migrate reset --force
    npx prisma db seed
    echo "✅ Database reset complete"
    ;;

  --create)
    MIGRATION_NAME="${2:-auto_migration}"
    echo "▶️  Creating new migration: $MIGRATION_NAME"
    npx prisma generate
    npx prisma migrate dev --name "$MIGRATION_NAME"
    echo "✅ Migration created. Commit the new migration files."
    ;;

  --studio)
    echo "▶️  Opening Prisma Studio..."
    npx prisma studio
    ;;

  *)
    echo "▶️  Checking migration status (dry-run)..."
    npx prisma generate
    npx prisma migrate status
    echo ""
    echo "Usage:"
    echo "  $0               Check status (dry-run)"
    echo "  $0 --apply       Apply pending migrations"
    echo "  $0 --create <name>  Create a new migration"
    echo "  $0 --fresh       Reset database (dev only!)"
    echo "  $0 --studio      Open Prisma Studio"
    ;;
esac
