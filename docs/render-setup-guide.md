# Converza — Render Setup Guide

> Post-deployment checklist for Render. Covers backups, monitoring, and env vars.

---

## 1. Database Backups

### Option A: Render Built-in (Paid Plans)
If you're on Render's **Standard** or **Pro** plan, Postgres backups are automatic:
- Go to your **PostgreSQL service** → **Backups** tab
- Enable **Point-in-Time Recovery** (paid add-on)
- Daily snapshots are kept for 7 days (free) or 30 days (paid)

### Option B: Manual Backup Script (Free Tier)
For free tier, run the backup script manually or via an external cron:

```bash
# From your local machine (requires DATABASE_URL from Render)
DATABASE_URL="postgresql://user:pass@host:5432/converza" ./scripts/backup-db.sh
```

The script dumps to `./backups/converza_YYYYMMDD_HHMMSS.sql.gz` and keeps the last 10.

### Option C: Supabase Off-site Backup
Your Supabase storage is already configured. Upload backups there:

```bash
# Uncomment the S3 section in backup-db.sh and set:
AWS_ACCESS_KEY_ID=<your-supabase-key>
AWS_SECRET_ACCESS_KEY=<your-supabase-secret>
AWS_BUCKET=call-recordings
AWS_ENDPOINT=https://oavzflfdjluxvdlymbug.supabase.co/storage/v1/s3
```

---

## 2. Uptime Monitoring

### Free: UptimeRobot (Recommended)
1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free tier: 50 monitors)
2. Add a new **HTTP(s) Monitor**:
   - **URL:** `https://your-render-domain.onrender.com/health`
   - **Monitoring Interval:** 5 minutes
3. Configure alert:
   - **Alert contacts:** Add your email or WhatsApp webhook
   - **Alert when:** Down for 2 consecutive checks

### Free: Cronitor (Alternative)
1. Sign up at [cronitor.io](https://cronitor.io)
2. Add a heartbeat monitor pointing to `/health`

### Paid: Sentry (Recommended for errors)
Already partially configured (`SENTRY_DSN` env var). Add:
1. Sign up at [sentry.io](https://sentry.io)
2. Create a Node.js project
3. Copy the DSN → add `SENTRY_DSN` to Render env vars
4. Server already reports errors via `error-reporting.ts`

---

## 3. Environment Variables Checklist

### Required (Server won't start without these)

| Variable | Source |
|:---------|:-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | Render PostgreSQL plugin (auto-injected) |
| `DATABASE_URL_PRISMA` | Same as DATABASE_URL |
| `REDIS_URL` | Render Redis plugin (auto-injected) |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Same generation |
| `OMNIDIM_API_KEY` | From omnidim.io dashboard |
| `FRONTEND_URL` | Your Vercel frontend URL |
| `ENCRYPTION_KEY` | Same generation as JWT_SECRET |

### SMS (Phase 0.4)

| Variable | Source |
|:---------|:-------|
| `MESSAGEBIRD_API_KEY` | From MessageBird dashboard |
| `SMS_SENDER_ID` | `CONVERZ` (register in MessageBird SMS → Senders) |

### Notifications

| Variable | Source |
|:---------|:-------|
| `WHATSAPP_TOKEN` | From Meta developers dashboard |
| `WHATSAPP_PHONE_ID` | `1226070940590994` |
| `WHATSAPP_VERIFY_TOKEN` | Your chosen verify token |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | From Meta dashboard |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail app password |

### Payments

| Variable | Source |
|:---------|:-------|
| `RAZORPAY_KEY_ID` | From Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | From Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay webhook settings |
| `RAZORPAY_PLAN_STARTER` | Plan ID from Razorpay |
| `RAZORPAY_PLAN_GROWTH` | Plan ID from Razorpay |
| `RAZORPAY_PLAN_PRO` | Plan ID from Razorpay |

### Storage

| Variable | Source |
|:---------|:-------|
| `SUPABASE_URL` | `https://oavzflfdjluxvdlymbug.supabase.co` |
| `SUPABASE_SERVICE_KEY` | From Supabase dashboard |
| `SUPABASE_RECORDINGS_BUCKET` | `call-recordings` |

### Email Forwarding

| Variable | Source |
|:---------|:-------|
| `FORWARDING_EMAIL` | `forward@converza.tech` |

### Optional but Recommended

| Variable | Source |
|:---------|:-------|
| `SENTRY_DSN` | From Sentry dashboard |
| `DEEPSEEK_API_KEY` | From DeepSeek dashboard |
| `OPENROUTER_API_KEY` | From OpenRouter dashboard |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

---

## 4. Post-Deploy Checklist

After deploying to Render:

- [ ] `https://your-domain.onrender.com/health` → 200 with `{"status":"healthy"}`
- [ ] Register a test account → verification email arrives
- [ ] Login + dashboard loads data (no CORS errors)
- [ ] Razorpay webhook URL → `https://your-domain.onrender.com/api/v1/webhooks/razorpay`
- [ ] Omnidimension webhook URL → set `WEBHOOK_URL` to your Render domain
- [ ] WhatsApp webhook URL → `https://your-domain.onrender.com/api/v1/webhooks/whatsapp`
- [ ] SMS works → send test via MessageBird dashboard
- [ ] UptimeRobot monitor is green

---

## 5. Render-Specific Notes

### Free Tier Limitations
- Services **sleep after 15 minutes** of inactivity
- First request after sleep takes ~30s (cold start)
- Background workers **not available** on free tier
- PostgreSQL: **90 days** of data, then deleted

### Recommended: Upgrade to Standard ($7/mo)
- Always-on services (no sleeping)
- PostgreSQL backups included
- Custom domains
- More RAM/CPU

### Worker Services
On Render free tier, BullMQ workers run in the **same process** as the web server (via `index.ts` which starts both). This works but is less reliable than separate worker services.

For production, consider upgrading to Standard plan and splitting workers into separate Render services.
