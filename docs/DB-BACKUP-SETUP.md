# 🗄️ Converza — DB Backup Setup (Render Cron Job or GitHub Actions)

> **Problem this solves:** production (Supabase Postgres) currently has **no backups**.
> The script `scripts/backup-db.sh` exists and now also uploads every dump **off-site**
> to Supabase Storage — a backup that lives only where the dump ran is useless if that
> host dies.
>
> **Pick ONE scheduler below.** Option A (Render Cron Job) is recommended: creds stay in
> your own dashboard. Option B (GitHub Actions) is free but stores the DB URL + service
> key in GitHub secrets and auto-disables after 60 days of repo inactivity.

---

## 0️⃣ One-time (both options): create the off-site bucket

- [ ] Supabase dashboard → project `oavzflfdjluxvdlymbug` → **Storage** → **New bucket**
- [ ] Name: `db-backups` · **leave "Public bucket" OFF** (dumps contain customer PII)
- [ ] Done. The script uploads to `db-backups/converza_<timestamp>.sql.gz` and fails loudly (non-zero exit) if the upload errors.

> Note: the script does NOT auto-prune in the bucket — with the recommended schedule the
> free 1 GB storage holds ~2 weeks of dumps for the current DB size. If the DB grows past
> ~35 MB, either lower the frequency or add a lifecycle rule (Supabase: Storage → bucket
> → no native lifecycle yet — then prune manually or move to S3, see script footer).

---

## 🅰️ Option A — Render Cron Job (recommended)

1. **Get the dump connection URL.** In Supabase → **Connect** → choose the
   **Session pooler** URI (port `5432`, user `postgres.<project-ref>`).
   ⚠️ Use **session** mode, NOT transaction mode — `pg_dump` breaks on pgbouncer transaction pooling.
   ⚠️ Do NOT use the direct `db.<ref>.supabase.co:5432` URL — it is IPv6-only, Render jobs connect over IPv4.
2. **Render dashboard → New → Cron Job**
   - Repo: `sarvesh-101/leadbridge` · Branch: `main`
   - **Schedule:** `0 */6 * * *` (every 6 hours)
   - **Command:** `bash scripts/backup-db.sh`
   - Plan: the cheapest instance is fine (runs ~seconds); add a 1 GB **Disk** mounted at
     `/opt/backups` if you want local retention in addition to the bucket (optional).
3. **Environment** (add to the Cron Job service, not the web service):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the session-pooler URL from step 1 |
   | `SUPABASE_URL` | `https://oavzflfdjluxvdlymbug.supabase.co` (already known) |
   | `SUPABASE_SERVICE_KEY` | same value as the web service's |
   | `SUPABASE_BACKUP_BUCKET` | `db-backups` |
   | `BACKUP_KEEP` | `14` |
   | `BACKUP_DIR` | `/opt/backups` (only if you attached the disk; otherwise leave default) |
4. **Verify:** Cron Job → **"Trigger Run"** → logs should show
   `✓ Backup complete: converza_….sql.gz` then `✓ Off-site copy uploaded` →
   check the `db-backups` bucket contains the file.
5. **Restore drill (do once now, not during an outage):**
   `gunzip -c converza_….sql.gz | psql "$DATABASE_URL"` into a scratch DB and confirm tables exist.

**✅ Done when:** a triggered run shows both ✓ lines and the bucket has the dump.

---

## 🅱️ Option B — GitHub Actions (free)

The workflow file already exists: `.github/workflows/db-backup.yml`.
It runs every 6 hours + manual dispatch, installs `pg_dump`, runs the same script, and
keeps the dump as a 14-day artifact **in addition to** the Supabase bucket upload.

Secrets to add (**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `PROD_DATABASE_URL` | same session-pooler URL as Option A step 1 |
| `PROD_SUPABASE_URL` | `https://oavzflfdjluxvdlymbug.supabase.co` |
| `PROD_SUPABASE_SERVICE_KEY` | service key |

Caveats:
- ⚠️ Works only while the repo stays **private** (it is today) — the secrets are scoped but the repo being public would leak nothing, still: keep it private.
- ⚠️ GitHub **disables scheduled workflows after 60 days of no repo activity** — you'll get an email; re-enable from the Actions tab.
- ⚠️ Anyone with admin on the GitHub repo can read the secrets via a workflow — Render (Option A) has a smaller blast radius.

Verify: **Actions → DB Backup → Run workflow** → green run + bucket upload logged.

---

## 🔔 Alerting on silent failure

A cron that fails quietly is worse than no cron. Either:
- **Render:** check the Cron Job's "Last run" weekly (it emails failures to the account owner by default), or
- **Both options:** after the first verified runs, add a UptimeRobot **Heartbeat** monitor
  and append a `curl <heartbeat-url>` line at the end of the scheduler command — you get
  paged when a run misses its window.

## 📎 What was changed for this

- `scripts/backup-db.sh` — Supabase Storage off-site upload added (opt-in via
  `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, bucket `db-backups`, exit non-zero on failure),
  header updated from Railway → Render.
- `.github/workflows/db-backup.yml` — new scheduled backup workflow (Option B).
- `docs/DB-BACKUP-SETUP.md` — this file.
- Deprecation note on `infrastructure/monitoring/railway-monitoring.md` already points here.
