#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Converza — PostgreSQL Backup Script (Phase 0.6)
#
# Dumps the production database (any DATABASE_URL — Render/Supabase/local) to a
# timestamped file, keeps N recent backups, and optionally uploads the dump to
# Supabase Storage (off-site) or S3 for safety.
#
# Usage:
#   DATABASE_URL="postgres://..." ./scripts/backup-db.sh            # local dump
#   DATABASE_URL="..." BACKUP_KEEP=14 ./scripts/backup-db.sh         # keep 14
#   DATABASE_URL="..." SUPABASE_URL=... SUPABASE_SERVICE_KEY=...     # + off-site
#
# Recommended schedule: a Render Cron Job running this every 6h.
# See docs/DB-BACKUP-SETUP.md for the full setup.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required (Railway auto-injects it)}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"          # how many backups to retain locally
STAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="converza_${STAMP}.sql.gz"
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
ls -1t "${BACKUP_DIR}"/converza_*.sql.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | while read -r old; do
  echo "→ Pruning old backup: $(basename "${old}")"
  rm -f "${old}"
done

echo "✓ Done. Backups kept: ${BACKUP_KEEP}"
echo "  Local dir: ${BACKUP_DIR}"

# ─── Off-site copy → Supabase Storage (opt-in, RECOMMENDED) ─────────────────
# A backup stored only on the machine that runs the dump is useless if that
# host dies. Set SUPABASE_URL + SUPABASE_SERVICE_KEY (+ optional
# SUPABASE_BACKUP_BUCKET, default "db-backups") and every dump is also pushed
# to a PRIVATE Storage bucket you already pay for. One-time setup:
#   Supabase dashboard → Storage → New bucket → name "db-backups" → PRIVATE
# Exit-codes non-zero on failure so the cron job shows FAILED (never silent).
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  BUCKET="${SUPABASE_BACKUP_BUCKET:-db-backups}"
  RESP_FILE="$(mktemp)"
  echo "→ Uploading off-site copy to Supabase Storage bucket '${BUCKET}'"
  HTTP_CODE="$(curl -sS -o "${RESP_FILE}" -w '%{http_code}' \
    -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILENAME}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/gzip" \
    -H "x-upsert: true" \
    --data-binary @"${OUTFILE}")"
  if [ "${HTTP_CODE}" = "200" ] || [ "${HTTP_CODE}" = "201" ]; then
    echo "✓ Off-site copy uploaded: ${BUCKET}/${FILENAME}"
  else
    echo "❌ Off-site upload FAILED (HTTP ${HTTP_CODE}): $(cat "${RESP_FILE}")"
    rm -f "${RESP_FILE}"
    exit 1
  fi
  rm -f "${RESP_FILE}"
fi

# ─── Optional S3 off-site copy (alternative to Supabase Storage) ────────────
# if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_BUCKET:-}" ]; then
#   aws s3 cp "${OUTFILE}" "s3://${AWS_BUCKET}/converza/backups/${FILENAME}" \
#     --endpoint-url "${AWS_ENDPOINT:-https://s3.amazonaws.com}"
#   echo "✓ Off-site copy uploaded."
# fi
