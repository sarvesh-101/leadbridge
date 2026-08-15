# 🚂 LeadBridge — Railway Deploy Guide (Phase 0.1)

> **Goal:** get the backend off the laptop + ngrok onto Railway with production
> Postgres + Redis. The site currently dies when the PC is off. This fixes that.
>
> Created: 2026-08-10 · Prep: `railway.json`, `Procfile`, `server/Dockerfile`,
> `scripts/deploy-railway.sh`, `DEPLOYMENT.md` already exist and are CI-tested.

---

## 1. Prerequisites (you, ~5 min)

1. Create a **Railway account**: https://railway.app → Sign up (GitHub OAuth is fastest).
2. Optional but handy: install the CLI — `npm install -g @railway/cli`, then `railway login`.
3. The repo is already pushed to GitHub (`github.com/sarvesh-101/leadbridge.git`).

## 2. Create the project + infrastructure (~10 min, dashboard)

1. **railway.app/dashboard** → **New Project** → **Deploy from GitHub repo** → select `leadbridge`.
   - Railway reads `railway.json` at the repo root → builds `server/Dockerfile` → deploys the **API server** (`node dist/index.js`).
2. **New → Database → PostgreSQL** (add to the same project).
   - Copy the connection string shown (this is `DATABASE_URL`; it's also auto-injected as `DATABASE_URL` for services in the project).
3. **New → Database → Redis** (add to the same project).
   - It auto-injects `REDIS_URL` for services in the project.

> ⚠️ Railway auto-injects `DATABASE_URL`/`REDIS_URL` only into services created
> AFTER the plugin. If your server service was created first, re-deploy it or set
> the vars manually (see env table).

## 3. Env vars for the SERVER service (Variables tab)

| Variable | Value |
|:--|:--|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (or paste the copied string) |
| `DATABASE_URL_PRISMA` | **same as `DATABASE_URL`** — required, the Prisma schema reads this env directly |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | existing value from `server/.env` (min 32 chars) |
| `JWT_REFRESH_SECRET` | existing value from `server/.env` |
| `OMNIDIM_API_KEY` | existing value from `server/.env` |
| `FRONTEND_URL` | `https://leadbridge-seven.vercel.app` (⚠️ must stay this — CORS allowlist is this exact origin) |
| `WEBHOOK_URL` | `https://<your-server-domain>.up.railway.app` — set AFTER generating a domain (step 5); Omnidimension agent webhooks need it |
| `ENCRYPTION_KEY` | existing value from `server/.env` (**back it up — rotating breaks encrypted credentials**) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | existing values |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` / `RAZORPAY_PLAN_*` | existing values |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `FROM_EMAIL` | existing values (Gmail app password works) |
| `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` | existing values |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` / `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_BUSINESS_ACCOUNT_ID` | existing values |
| `MESSAGEBIRD_API_KEY` | set once the key exists (Phase 0.4) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | set once keys exist (Phase 0.5) |
| `SENTRY_DSN` | set once DSN exists (Phase 2.10) |
| Cost vars (optional, defaults fine) | `OMNIDIM_COST_PER_MINUTE=4.6` `PHONE_NUMBER_MONTHLY_COST=200` `BROKER_CALL_PRICE=70` `PRO_MONTHLY_CALL_CAP=2000` |

> **Never set `DEMO_MODE=true`** — the server refuses to boot in production with it.

## 4. Workers (7 additional services, ~5 min)

Railway runs **one process per service**. The Docker image contains all the code,
so each worker is just a service with an overridden **Start Command**:

For each of these, **New → GitHub repo → same `leadbridge` repo** → Settings → Deploy →
set **Custom Start Command**:

| Service | Start command |
|:--|:--|
| worker-call | `node dist/workers/call.worker.js` |
| worker-notification | `node dist/workers/notification.worker.js` |
| worker-extraction | `node dist/workers/extraction.worker.js` |
| worker-followup | `node dist/workers/followup.worker.js` |
| worker-reminder | `node dist/workers/reminder.worker.js` |
| worker-webhook-retry | `node dist/workers/webhook-retry.worker.js` |
| worker-campaign | `node dist/workers/campaign.worker.js` |

Give them the **same env vars as the server** (Variables tab — copy-paste).
They connect to the same Postgres/Redis via `DATABASE_URL`/`REDIS_URL`.
No domains needed for workers (they only consume the queue).

> The repo-root `Procfile` is kept for the docker-compose deployment path; Railway
> deploys from `railway.json` + per-service start commands instead.

## 5. Generate a domain + run migrations

1. Server service → **Settings → Networking → Generate Domain** → copy `https://<name>.up.railway.app`.
2. Set `WEBHOOK_URL` to that domain (step 3) and re-deploy (or trigger a redeploy).
3. **Run migrations** — the built image excludes devDeps (no `prisma` CLI), so run
   them from your laptop against the Railway DB:
   ```bash
   cd server
   DATABASE_URL_PRISMA="${{Postgres.DATABASE_URL}}" npx prisma migrate deploy
   ```
   (Or use the exact connection string Railway shows for the Postgres plugin.)
4. **Seed territories + admin** (first boot also auto-creates admin per `DEPLOYMENT.md`):
   ```bash
   cd server
   DATABASE_URL_PRISMA="${{Postgres.DATABASE_URL}}" npx prisma db seed
   ```
5. **Verify:**
   ```bash
   curl https://<your-server-domain>.up.railway.app/health
   # → {"status":"healthy","app":"LeadBridge","version":"1.0.0"}
   curl https://<your-server-domain>.up.railway.app/api/v1/public/landing
   ```
6. Check server **logs** for the auto-created admin credentials (first boot only).

## 6. Switch the frontend over (after backend is confirmed live)

1. **Vercel dashboard → leadbridge → Settings → Environment Variables → Production:**
   - `NEXT_PUBLIC_API_URL` → `https://<your-server-domain>.up.railway.app/api/v1`
   - `NEXT_PUBLIC_WS_URL` → `wss://<your-server-domain>.up.railway.app`
   - `NEXT_PUBLIC_APP_URL` stays `https://leadbridge-seven.vercel.app`
2. **Update the CSP** in `frontend/next.config.js`: replace the ngrok host
   (`casino-bunkbed-bronze.ngrok-free.dev`) in `connect-src` with
   `https://<your-server-domain>.up.railway.app` (and `wss://`). There is a TODO
   comment there pointing at exactly this change.
3. **Redeploy Vercel** (push to `main` only auto-redeploys if Git integration is
   connected — otherwise use the staging-folder CLI flow from the 2026-08-07 work log).
4. Optional: point the static ngrok domain at nothing / stop ngrok. Keep ngrok as
   fallback only.

## 7. Post-deploy checklist

- [ ] `https://<server>.up.railway.app/health` → 200
- [ ] Register a fresh account on `leadbridge-seven.vercel.app` → verification email arrives
- [ ] Login + dashboard loads data from the Railway backend (DevTools → no CORS errors)
- [ ] Razorpay webhook URL → `https://<server>.up.railway.app/api/v1/webhooks/razorpay`
- [ ] Omnidimension webhook URL → `https://<server>.up.railway.app/api/v1/webhooks/omnidimension` (via `WEBHOOK_URL`)
- [ ] WhatsApp webhook URL → `https://<server>.up.railway.app/api/v1/webhooks/whatsapp`
- [ ] Schedule DB backups (Phase 0.6) — Railway Postgres supports automated backups

## Cost

Railway bills by usage (memory/CPU/egress). A single web + 7 idle workers +
Postgres + Redis typically lands around **$5–20/mo** for this workload. The free
trial (~$5 credit) is usually enough to validate the whole flow first.
