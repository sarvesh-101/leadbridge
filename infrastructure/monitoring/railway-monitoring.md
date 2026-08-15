# LeadBridge — Backups & Uptime Monitoring on Railway (Phase 0.6)

> **Why:** before the first paying broker, two things must exist: (1) recoverable
> database backups, (2) an alert that pages you before a broker notices an outage.
> This guide sets both up on Railway (the Phase 0.1 production path). The existing
> `prometheus.yml` + Grafana dashboard in this folder remain for the VPS path.

---

## 1. Database backups (~15 min)

Railway Postgres has built-in automated backups, but they are host-scoped —
we also want our own dumps we control.

### Option A — Railway Postgres built-in backups (do this first, 2 min)
1. Railway → your **Postgres** service → **Backups** tab.
2. Enable **Automated backups** (frequency: daily) + set a **retention** (e.g. 7–14 days).
3. Done — this covers "the DB server crashed" recovery.

### Option B — own dumps to a cron service (do this second, ~10 min)
Own dumps protect against "someone dropped a table" (point-in-time) and are portable.

1. Railway → **New → Cron Job** service, same project.
2. Deploy from the same `leadbridge` repo (or a small image with `pg_dump` + bash).
   The built `server/Dockerfile` image may not include `pg_dump`, so use Railway's
   **Postgres image** or run the script from your laptop on a schedule.
3. Add variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `BACKUP_DIR=/app/backups`, `BACKUP_KEEP=10`.
4. Start command:
   ```bash
   /bin/bash scripts/backup-db.sh
   ```
5. Schedule: **every 6 hours** (Railway Cron supports `0 */6 * * *`).
6. Verify: check the cron service **logs** — you should see `✓ Backup complete: leadbridge_<stamp>.sql.gz`.
7. **Off-site copy (strongly recommended):** uncomment the S3 block in
   `backup-db.sh` and point it at Supabase storage / any S3 bucket once Phase 0.5
   storage credentials are in place. A backup living on the same host as the DB
   is not a real backup.

> Local quick test:
> ```bash
> cd scripts && DATABASE_URL="postgres://..." bash backup-db.sh
> gzip -t backups/leadbridge_*.sql.gz && echo "dump OK"
> ```

---

## 2. Uptime monitoring + alerting (~10 min)

### Option A — free external uptime monitor (recommended, 2 min)
Sign up for a free uptime service (UptimeRobot / HetrixTools / Better Stack):
1. Add a monitor: **HTTP(S)** → `https://<server>.up.railway.app/health`
2. Interval: 5 min. Alert contacts: your email + WhatsApp (via a group / bot).
3. Optional alert keyword: expect the body to contain `"status":"healthy"`.

### Option B — self-hosted cron check (no external account)
1. Railway → **New → Cron Job** service, same repo.
2. Variables: `HEALTH_URL=https://<server>.up.railway.app/health`,
   `ALERT_WEBHOOK_URL=<your slack/discord/telegram webhook>`.
3. Start command:
   ```bash
   /bin/bash scripts/uptime-check.sh
   ```
4. Schedule: every 5 minutes (`*/5 * * * *`).
5. The script only alerts on the **first** failure of an outage (state transition),
   and auto-clears when health returns — no alert spam.
   - Slack / Discord / Telegram: works directly via the webhook URL.
   - WhatsApp / email alerting: point `ALERT_WEBHOOK_URL` at the MessageBird /
     SMTP forwarder once Phase 0.4 keys are set, or use a service like
     healthchecks.io / ntfy.sh with an email-to-WhatsApp bridge.

> Local quick test:
> ```bash
> HEALTH_URL="https://<server>.up.railway.app/health" ALERT_WEBHOOK_URL="" bash scripts/uptime-check.sh
> # → "[…] OK — 200, status=healthy"
> ```

---

## 3. Launch-day verification checklist (Phase 5.1)

- [ ] `curl https://<server>.up.railway.app/health` → `{"status":"healthy",…}`
- [ ] A fresh backup file exists in the cron service logs / backup dir
- [ ] Kill-check: temporarily stop the web service → the uptime alert fires within 5 min → restart → alert clears
- [ ] Restore drill (do once before launch): restore the latest dump into a scratch DB and confirm row counts
- [ ] Alert channel actually reaches you (test message sent + received)

---

## 4. Weekly ops review (Phase 6.1 hook)

With the above in place, the weekly review already has what it needs:
- `/metrics` endpoint (server + queue health), backup logs, and uptime history.
- Per-broker cost/ROI analysis lives in the admin dashboard
  (`getBrokerCostAnalysis`) — pair it with backup + uptime checks each week.
