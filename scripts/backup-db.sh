#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LeadBridge — PostgreSQL Backup Script (Phase 0.6)
#
# Dumps the production database (Railway Postgres, or any DATABASE_URL) to a
# timestamped file, keeps N recent backups, and optionally uploads to S3/Supabase
# storage for off-site safety.
#
# Usage:
#   DATABASE_URL="postgres://..." ./scripts/backup-db.sh            # local dump
#   DATABASE_URL="..." BACKUP_KEEP=14 ./scripts/backup-db.sh         # keep 14
#   DATABASE_URL="..." S3_ENDPOINT=... S3_BUCKET=... aws s3 cp ...  # off-site (see below)
#
# Recommended schedule (Railway): a Cron Job service that runs this every 6h.
# See infrastructure/monitoring/railway-monitoring.md for the full setup.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required (Railway auto-injects it)}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"          # how many backups to retain locally
STAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="leadbridge_${STAMP}.sql.gz"
OUTFILE="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "→ Backing up database to ${OUTFILE}"

# pg_dump to stdout, gzip on the fly. Uses the full connection string from the
# DATABASE_URL env var Railway injects (works for local Postgres too).
pg_dump "${DATABASE_URL}" --no-owner --no-privileges | gzip > "${OUTFILE}"

# Sanity check: a real dump is at least 10 KB. Empty DB or failed auth = small file.
SIZE="$(stat -c%s "${OUTFILE}" 2>/dev/null || stat -f%z "${OUTFILE}")"
if [ "${SIZE}" -lt 10240 ]; then
  echo "⚠️  Backup file suspiciously small (${SIZE} bytes) — removing it."
  rm -f "${OUTFILE}"
  exit 1
fi

echo "✓ Backup complete: ${FILENAME} (${SIZE} bytes)"

# ─── Retention: keep the newest $BACKUP_KEEP, delete the rest ───────────────
ls -1t "${BACKUP_DIR}"/leadbridge_*.sql.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | while read -r old; do
  echo "→ Pruning old backup: $(basename "${old}")"
  rm -f "${old}"
done

echo "✓ Done. Backups kept: ${BACKUP_KEEP}"
echo "  Local dir: ${BACKUP_DIR}"

# ─── Optional off-site copy (RECOMMENDED — a backup in the same DB host is
#     useless if the host dies). Uncomment + configure after Supabase/object
#     storage is confirmed, or push to any S3-compatible bucket:
# ─────────────────────────────────────────────────────────────────────────────
# if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_BUCKET:-}" ]; then
#   aws s3 cp "${OUTFILE}" "s3://${AWS_BUCKET}/leadbridge/backups/${FILENAME}" \
#     --endpoint-url "${AWS_ENDPOINT:-https://s3.amazonaws.com}"
#   echo "✓ Off-site copy uploaded."
# fi
