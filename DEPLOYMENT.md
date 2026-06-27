# LeadBridge — Production Deployment Guide

> **From dev laptop to live SaaS in one afternoon.**

## Prerequisites

| Resource | Required | Cost |
|:---------|:--------:|:----:|
| **VPS or Cloud VM** (Ubuntu 22.04+) | ✅ | ~$10-20/mo |
| **Domain name** (e.g., leadbridge.com) | ✅ | ~$10/yr |
| **PostgreSQL 16** (managed — Supabase, RDS, or self-hosted) | ✅ | ~$0-15/mo |
| **Redis 7** (managed — Upstash, Redis Cloud, or self-hosted) | ✅ | ~$0-10/mo |
| **SMTP** (Resend, SendGrid, or AWS SES) | ✅ | ~$0-5/mo |

## 1. Provision Infrastructure

### Option A: Single VPS (simplest, ~$20/mo)

```bash
# Deploy on any Ubuntu 22.04+ server
ssh root@your-server-ip

# Install Docker & Compose
apt update && apt install -y docker.io docker-compose-plugin
systemctl enable --now docker

# Clone the repo
git clone https://github.com/your-org/leadbridge.git /opt/leadbridge
cd /opt/leadbridge

# Copy and fill in environment variables
cp .env.example .env
nano .env
```

### Option B: Managed Services (more scalable)

| Service | Provider | Link |
|:--------|:---------|:-----|
| PostgreSQL | Supabase (free tier) | [supabase.com](https://supabase.com) |
| Redis | Upstash (free tier) | [upstash.com](https://upstash.com) |
| File Storage | Supabase Storage | [supabase.com](https://supabase.com) |
| Email | Resend (free tier) | [resend.com](https://resend.com) |
| Hosting | Railway or Fly.io | [railway.app](https://railway.app) |

## 2. Environment Variables

```bash
# Required (set these before starting)
JWT_SECRET=<random-64-chars>
JWT_REFRESH_SECRET=<random-64-chars>
OMNIDIM_API_KEY=<your-omnidimension-api-key>
DATABASE_URL=postgresql://user:pass@host:5432/leadbridge
DATABASE_URL_PRISMA=postgresql://user:pass@host:5432/leadbridge
REDIS_URL=redis://:password@host:6379

# Optional — add as you configure each service
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
MESSAGEBIRD_API_KEY=...
ENCRYPTION_KEY=...
RAZORPAY_KEY_ID=...
RESEND_API_KEY=...
```

## 3. Deploy with Docker Compose

```bash
# Build and start all services
docker compose -f docker/docker-compose.yml up -d --build

# Verify
curl http://localhost/health
# → {"status":"healthy","app":"LeadBridge","version":"1.0.0"}
```

The compose file starts:
- **Nginx** (port 80/443) — reverse proxy with SSL
- **Frontend** (internal) — Next.js SSR
- **TypeScript Server** (port 3000) — Fastify API + WebSocket
- **BullMQ Workers** (5 workers) — call dispatch, notifications, follow-ups, reminders, extraction, webhook retry
- **PostgreSQL** — primary database
- **Redis** — queue + cache
- **Prometheus + Grafana** — monitoring

## 4. SSL Certificate

```bash
# Install certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d leadbridge.com -d www.leadbridge.com

# Auto-renew
systemctl enable --now certbot.timer
```

## 5. External Services Setup

### 5.1 Omnidimension (AI Voice Agent — Primary Telephony)
1. Sign up at [omnidimension.ai](https://omnidimension.ai)
2. Get API key from dashboard
3. Set `OMNIDIM_API_KEY` in `.env`
4. Configure webhook URL: `https://leadbridge.com/api/v1/webhooks/omnidimension`

### 5.2 WhatsApp Cloud API
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create WhatsApp Business App
3. Set up webhook: `https://leadbridge.com/api/v1/webhooks/whatsapp`
4. Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`

### 5.3 MessageBird (SMS Fallback)
1. Sign up at [messagebird.com](https://messagebird.com)
2. Get API key
3. Set `MESSAGEBIRD_API_KEY` in `.env`

### 5.4 Razorpay (Payments)
1. Sign up at [razorpay.com](https://razorpay.com)
2. Create plans for STARTER, GROWTH, PRO
3. Set webhook: `https://leadbridge.com/api/v1/webhooks/razorpay`

## 6. First-Run Checklist

```bash
# 1. Run database migrations
cd server && npx prisma db push

# 2. Start the server (auto-creates admin account)
npm run dev
# → Look for: "FIRST-RUN: No admin existed — created one."
# → Save the generated admin password!

# 3. Verify health
curl http://localhost:3000/health

# 4. Log in as admin
#    Email: admin@leadbridge.com
#    Password: <from server logs>

# 5. Create territories in admin panel
# 6. Create a test client
# 7. Test lead ingestion webhook
```

## 7. Monitoring

### Grafana Dashboards
Access at `https://leadbridge.com:3001` (default credentials: admin/admin)

Pre-configured dashboards:
- **LeadBridge Overview** — leads, calls, bookings, conversions
- **System Health** — CPU, memory, disk, network
- **Database** — query performance, connection count
- **Queue Workers** — BullMQ job throughput, failure rates

### Alerts to Configure
- Error rate > 1% in last 5 minutes
- Queue backlog > 100 jobs
- PostgreSQL connection count > 80%
- SSL certificate expires in < 30 days

## 8. Backup Strategy

```bash
# Daily database backup (add to crontab)
0 3 * * * pg_dump -Fc leadbridge > /backups/leadbridge_$(date +\%Y\%m\%d).dump

# Keep last 30 days
0 4 * * * find /backups -name "*.dump" -mtime +30 -delete
```

## 9. Scaling

| Bottleneck | Solution |
|:-----------|:---------|
| High API traffic | Add more Fastify replicas behind Nginx |
| Slow AI calls | Increase Celery worker count |
| Database load | Add PgBouncer for connection pooling |
| Queue backlog | Scale Redis to larger tier |
| File storage | Add CDN for call recordings |

## 10. Rollback

```bash
# Rollback to previous Docker image
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml up -d --build

# Database rollback (if needed)
pg_restore -d leadbridge /backups/leadbridge_20240101.dump
```
