# 🏗️ LeadBridge — AI-Powered Real Estate Lead Conversion Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5%2B-blue)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-brightgreen)](https://fastify.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5.19-purple)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D)](https://redis.io)

> **One broker per city. AI calls every lead in 60 seconds.**
> LeadBridge automates real estate lead qualification, calling, follow-ups, and conversion tracking — from inquiry to site visit.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Lead Lifecycle](#-lead-lifecycle)
- [Quick Start (Local)](#-quick-start-local)
- [API Key Checklist](#-api-key-checklist)
- [Deploy to Railway](#-deploy-to-railway)
- [Deploy with Docker Compose](#-deploy-with-docker-compose)
- [Project Structure](#-project-structure)
- [Testing](#-testing)

---

## 🎯 Overview

LeadBridge automates the entire real estate lead follow-up process:

1. **Lead Ingestion** — Captures leads from 99acres, MagicBricks, Housing.com, JustDial, Facebook, Google, WhatsApp, and manual entry via webhooks
2. **Instant AI Call** — Within 60 seconds, an Omnidimension AI agent calls every new lead in Hinglish for qualification
3. **Smart Lead Scoring** — Predictive engine scores leads (0-100) based on source quality, budget, timeline, sentiment, territory match, and response latency
4. **Automated Workflows** — Follow-up sequences D1/D2/D3 via calls + WhatsApp messages, no-show recovery, booking reminders
5. **Multi-Channel Notifications** — WhatsApp primary → SMS fallback (MessageBird) → Email fallback (SMTP / Nodemailer) chain
6. **Visit Tracking** — End-to-end booking management with WhatsApp reminders and conversion funnel analytics
7. **Territory Exclusivity** — One broker per city/zone with tiered subscription model

### Key Metrics (Industry Benchmarks)

| Metric | Industry Avg | LeadBridge |
|--------|:-----------:|:----------:|
| Response Time | 24-48 hours | < 60 seconds |
| Lead Response Rate | 10-15% | 60-80% |
| Call Answer Rate | 35-45% | 55-70% |
| Site Visit Conversion | 15-20% | 25-40% |
| Follow-up Persistence | 1-2 attempts | Up to 7 attempts |

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         🌐 INTERNET                             │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐     │
│  │  Broker   │    │  Lead Portal │    │  WhatsApp / SMS   │     │
│  │ (Browser) │    │   (Webhook)  │    │  (Customer)       │     │
│  └────┬─────┘    └──────┬───────┘    └────────┬──────────┘     │
│       │                 │                     │                 │
└───────┼─────────────────┼─────────────────────┼─────────────────┘
        │                 │                     │
   ┌────┴─────────────────┴─────────────────────┴──────────────┐
   │                   NGINX (Reverse Proxy)                    │
   │                 Port 80 → 443 (SSL)                        │
   └─────────────────────────┬──────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴─────┐        ┌────┴─────┐         ┌────┴──────────┐
   │  Next.js │        │ Fastify  │         │   External    │
   │ Frontend │        │  Server  │         │   Services    │
   │  :3001   │        │  :3000   │         │               │
   └──────────┘        └──┬───┬───┘         │  ┌──────────┐ │
                          │   │             │  │Omnidimen-│ │
                          │   │             │  │sion AI   │ │
                    ┌─────┘   └──────┐      │  └──────────┘ │
                    │                │      │               │
              ┌─────┴─────┐   ┌──────┴───┐  │  ┌──────────┐ │
              │  BullMQ   │   │ Prisma   │  │  │ WhatsApp │ │
              │  Workers  │   │   ORM    │  │  │ Cloud API│ │
              │           │   │          │  │  └──────────┘ │
              │ • Call    │   └────┬─────┘  │               │
              │ • Notify  │        │        │  ┌──────────┐ │
              │ • Extract │        │        │  │ Razorpay │ │
              │ • Followup│   ┌────┴─────┐  │  └──────────┘ │
              │ • Reminder│   │PostgreSQL│  │               │
              │ • Webhook │   │ (Primary)│  │  ┌──────────┐ │
              │  Retry    │   └──────────┘  │  │ SMTP    │ │
              └───────────┘                 │  └──────────┘ │
                                            │               │
                                       ┌────┴────┐          │
                                       │  Redis  │          │
                                       │(Queue + │          │
                                       │ Cache)  │          │
                                       └─────────┘          │
                                            │               │
                                       ┌────┴────┐          │
                                       │  SMS    │          │
                                       │Message- │          │
                                       │ Bird)   │          │
                                       └─────────┘          │
                                            │               │
                                       ┌────┴──────────┐    │
                                       │Supabase       │    │
                                       │(Recording     │    │
                                       │  Storage)     │    │
                                       └───────────────┘    │
                                                            │
                                       ┌──────────────┐     │
                                       │  Prometheus  │     │
                                       │  + Grafana   │     │
                                       └──────────────┘     │
                               └──────────────────────────────┘
```

### Data Flow — A Lead's Journey

```
1. LEAD ARRIVES  → Fastify /webhooks/ingest → PostgreSQL
2. CALL QUEUED   → BullMQ (via Redis) → Call Worker picks up
3. AI CALL MADE  → Omnidimension API → calls lead's phone
4. CALL ENDS     → Omnidimension webhook → extraction worker
5. QUALIFIED?    → Booking created → Lead status updated
6. NOTIFICATIONS → WhatsApp (primary) → SMS fallback → SMTP Email fallback
7. BROKER SEES   → Next.js dashboard + WebSocket real-time updates
8. FOLLOW-UPS    → Cron → BullMQ followup worker D1→D2→D3→COLD
```

### Tech Stack

```
Frontend:    Next.js 15 (App Router) + TypeScript + Tailwind + Framer Motion + GSAP
Backend:     Fastify + TypeScript + Prisma ORM + Zod validation
Queue:       BullMQ (backed by Redis)
Database:    PostgreSQL 16
Cache:       Redis 7
Voice AI:    Omnidimension (primary) | Exotel (legacy fallback)
Messaging:   WhatsApp Cloud API → fallback MessageBird SMS → fallback SMTP Email (Nodemailer)
Payments:    Razorpay (subscriptions)
Storage:     Supabase (call recordings)
Monitoring:  Prometheus + Grafana
Deploy:      Railway / Docker Compose (VPS)
```

---

## 🔄 Lead Lifecycle

### Status Flow

```
                    ┌──────────┐
                    │  PENDING │  (New lead received)
                    └────┬─────┘
                         │ AI call initiated within 60s
                    ┌────▼─────┐
                    │  CALLING │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌─────────┐ ┌────────┐ ┌────────┐
        │NO_ANSWER│ │FAQ_ONLY│ │ BOOKED │
        └────┬────┘ └───┬────┘ └───┬────┘
             │          │          │ WhatsApp reminder sent 24h before
             ▼          ▼          ▼
       ┌──────────┐ ┌────────┐ ┌─────────┐
       │CALL_FAIL │ │  COLD  │ │ REMINDED│
       └────┬─────┘ └────────┘ └────┬────┘
            │ Retry (3x)            │
            ▼                 ┌─────┴──────┐
     ┌──────────────┐         ▼            ▼
     │FOLLOWUP_D1/  │   ┌────────┐   ┌──────────┐
     │D2/D3/REBOOKED│   │VISITED │   │ NO_SHOW  │  (no-show detected by cron)
     └──────┬───────┘   └───┬────┘   └────┬─────┘
            │               │             │
            └────────► ┌──────────┐ ┌──────────┐
                       │CONVERTED │ │FOLLOWUP_ │
                       └──────────┘ │D1/D2/D3  │
                                    └──────────┘
                                         │
                                    ┌────▼─────┐
                                    │  COLD    │  (after 3 follow-ups)
                                    └──────────┘
```

### Auto-Transitions

| From | To | Trigger | Timing |
|------|:--:|:-------:|:------:|
| PENDING | CALLING | New lead created | < 60s |
| NO_ANSWER | Retry (3x max) | Exponential backoff (2hr, 4hr, 8hr) | Configurable |
| CALL_FAILED | Retry (3x max) | Same as NO_ANSWER | Configurable |
| BOOKED | REMINDED | 24h before visit | Cron job |
| REMINDED | VISITED | Broker confirms | Manual |
| REMINDED | NO_SHOW | No-show detected | Cron (24h after visit) |
| NO_SHOW | FOLLOWUP_D1 | No-show recovery | Smart-scheduled |
| FOLLOWUP_D1 | FOLLOWUP_D2 | D1 call completed | +24h |
| FOLLOWUP_D2 | FOLLOWUP_D3 | D2 WhatsApp sent | +48h |
| FOLLOWUP_D3 | COLD | No response after D3 | +72h |
| VISITED | CONVERTED | Broker confirms deal | Manual |

---

## 🚀 Quick Start (Local)

### Prerequisites

- **Node.js** 18+ (22 recommended)
- **Docker** & **Docker Compose** (for PostgreSQL + Redis)
- **Git**

### 1. Clone & Install

```bash
git clone <repository-url>
cd leadbridge

# Server dependencies
cd server
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 2. Start Infrastructure (PostgreSQL + Redis)

```bash
cd ..
docker compose -f docker/docker-compose.yml up -d postgres redis
```

### 3. Environment Variables

```bash
cp server/.env.example server/.env
# Edit server/.env — at minimum set:
#   JWT_SECRET, JWT_REFRESH_SECRET, OMNIDIM_API_KEY
#   DATABASE_URL, REDIS_URL

cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your backend URL
```

### 4. Database Setup

```bash
cd server
npx prisma generate
npx prisma db push     # Creates tables

# First run auto-creates:
#   Admin email: admin@leadbridge.com
#   Admin password: <random> — check server logs!
```

### 5. Launch

```bash
# Terminal 1 — Server (API + WebSocket)
cd server
npm run dev
# → http://localhost:3000

# Terminal 2 — Frontend (Next.js)
cd frontend
npm run dev
# → http://localhost:3001
```

### 6. Verify

```bash
curl http://localhost:3000/health
# → {"status":"healthy","app":"LeadBridge","version":"1.0.0"}
```

### 7. Run Full Stack with Docker Compose

```bash
# Start everything (server, workers, frontend, monitoring)
docker compose -f docker/docker-compose.yml up -d

# Check logs
docker compose -f docker/docker-compose.yml logs -f server

# Verify health
curl http://localhost:3000/health
```

---

## 🔐 API Key Checklist

| # | Service | What For | Pricing | Signup | Keys Needed |
|:-|:--------|:---------|:--------|:-------|:------------|
| 1 | **Omnidimension** | AI voice calls (core) | Free to start, pay-as-you-go | [omnidim.io](https://omnidim.io) | `OMNIDIM_API_KEY` |
| 2 | **PostgreSQL** | Database | Supabase: **free 500MB** | [supabase.com](https://supabase.com) | `DATABASE_URL` |
| 3 | **Redis** | Queue + cache | Upstash: **free 256MB** | [upstash.com](https://upstash.com) | `REDIS_URL` |
| 4 | **WhatsApp Cloud** | Notifications | **Free** (message costs only) | [developers.facebook.com](https://developers.facebook.com) | `WHATSAPP_TOKEN`, `PHONE_ID`, `VERIFY_TOKEN` |
| 5 | **MessageBird** | SMS fallback | Pay-as-you-go (~₹0.5/SMS) | [messagebird.com](https://messagebird.com) | `MESSAGEBIRD_API_KEY` |
| 6 | **Razorpay** | Payments (subscriptions) | **Free** (2% per tx) | [razorpay.com](https://razorpay.com) | `RAZORPAY_KEY_ID`, `KEY_SECRET`, plans |
| 7 | **SMTP (Nodemailer)** | Email notifications | **Free** (AWS SES: 62K/mo, Brevo: 300/day) | [nodemailer.com](https://nodemailer.com) | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| 8 | **Supabase** | Recording storage (not the database — we use our own Postgres) | **Free** (1GB storage) | [supabase.com](https://supabase.com) | `SUPABASE_URL`, `SERVICE_KEY` |

### 🔴 Required (server won't start without these)

```
JWT_SECRET              — generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET      — generate same way
OMNIDIM_API_KEY         — from omnidim.io dashboard
DATABASE_URL            — from Supabase or Railway
REDIS_URL               — from Upstash or Railway
```

### 🟢 Optional (add as you configure each feature)

```
WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN
MESSAGEBIRD_API_KEY
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
SMTP_HOST, SMTP_USER, SMTP_PASS    — for any SMTP provider (AWS SES, Mailgun, Brevo, etc.)
ENCRYPTION_KEY          — optional, defaults to JWT_SECRET derivation
```

---

## ☁️ Deploy to Railway

### Prerequisites
- GitHub repo with the code pushed
- [Railway account](https://railway.app) ($5/mo Hobby plan)

### Step 1: Create Project
1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `leadbridge` repo
4. Railway auto-detects Node.js → runs build automatically

### Step 2: Add Databases
Click **New** → **Database** → add both:
- **PostgreSQL** — copy the `DATABASE_URL`
- **Redis** — copy the `REDIS_URL`

### Step 3: Set Environment Variables
In the server service's **Variables** tab:

| Variable | Value |
|:---------|:------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_SECRET` | *(random 64-char hex)* |
| `JWT_REFRESH_SECRET` | *(random 64-char hex)* |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `DATABASE_URL_PRISMA` | `${{Postgres.DATABASE_URL}}` |
| `DIRECT_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `OMNIDIM_API_KEY` | *(from omnidim.io)* |
| `FRONTEND_URL` | *(your Railway domain)* |

### Step 4: Add Frontend Service
Click **New** → **GitHub Repo** → same repo → in service **Settings**, set **Root Directory** to `frontend`

Railway will use the `frontend/package.json` and run `npm run build` automatically. Add a `frontend/railway.json` for custom build control if needed.

Variables for frontend:
```
NEXT_PUBLIC_API_URL = https://server-domain.railway.app/api/v1
NEXT_PUBLIC_WS_URL  = wss://server-domain.railway.app
NEXT_PUBLIC_APP_URL = https://frontend-domain.railway.app
```

### Step 5: Generate Domains
- Server: **Networking** → **Generate Domain**
- Frontend: **Networking** → **Generate Domain**

### Step 6: Run Migrations
```bash
# In Railway dashboard → server service → Shell
npx prisma db push
```

### Step 7: Verify
```bash
curl https://your-server-domain.railway.app/health
# → {"status":"healthy","app":"LeadBridge","version":"1.0.0"}
```

**Total time: ~20 minutes.**

---

## 📁 Project Structure

```
leadbridge/
├── server/                          # Fastify TypeScript Server
│   ├── prisma/
│   │   └── schema.prisma           # 18 models: Lead, Call, Booking, Client, etc.
│   ├── src/
│   │   ├── config.ts               # Zod-validated environment config
│   │   ├── index.ts                # Server entry point + graceful shutdown
│   │   ├── plugins/                # Fastify plugins (auth, prisma, redis, ws, rate-limit)
│   │   ├── routes/
│   │   │   ├── admin/              # Admin routes (dashboard, clients, analytics, etc.)
│   │   │   ├── client/             # Client routes (leads, calls, bookings, etc.)
│   │   │   └── webhooks/           # Webhook handlers (ingest, omnidimension, razorpay, etc.)
│   │   ├── services/               # Business logic (scoring, omnidimension, whatsapp, etc.)
│   │   ├── utils/                  # Utilities (encryption, phone, lifecycle, templates)
│   │   ├── workers/                # BullMQ workers (call, notification, extraction, etc.)
│   │   └── cron/                   # Cron jobs (cleanup, no-show, reports)
│   ├── Dockerfile
│   ├── vitest.config.ts
│   └── package.json
│
├── frontend/                        # Next.js 15 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Marketing landing page (8 sections)
│   │   │   ├── auth/               # Login, register, forgot/reset password
│   │   │   ├── dashboard/          # 11 dashboard pages
│   │   │   ├── admin/              # 6 admin pages
│   │   │   ├── setup/              # Onboarding wizard
│   │   │   └── legal/              # Privacy, terms
│   │   ├── components/
│   │   │   ├── marketing/          # Landing page sections
│   │   │   ├── leads/              # Lead table, filters, detail panel
│   │   │   ├── dashboard/          # Charts, activity feed, stats
│   │   │   ├── calls/              # Call cards, recording player
│   │   │   ├── canvas/             # Three.js globe
│   │   │   ├── admin/              # Onboarding wizard
│   │   │   └── shared/             # Sidebar, TopBar, badges, pagination
│   │   ├── lib/                    # API client, WebSocket, CSV export
│   │   ├── stores/                 # Zustand stores (auth, UI)
│   │   └── types/                  # TypeScript types
│   └── package.json
│
├── docker/                          # Docker Compose (12 services)
├── infrastructure/                  # Nginx, Prometheus, Grafana configs
├── .github/workflows/               # GitHub Actions CI/CD
└── DEPLOYMENT.md                    # Full deployment guide
```

### Server Routes

| Area | Routes | Description |
|:-----|:-------|:------------|
| **Auth** | `/auth/login`, `/register`, `/google`, `/forgot-password`, `/reset-password` | Authentication |
| **Client** | `/leads`, `/calls`, `/bookings`, `/dashboard`, `/messages`, `/campaigns`, `/territories`, `/integrations`, `/settings`, `/billing`, `/voice` | Broker APIs |
| **Admin** | `/admin/dashboard`, `/clients`, `/analytics`, `/territories`, `/queues`, `/webhooks`, `/audit-logs` | Platform admin |
| **Webhooks** | `/webhooks/ingest`, `/omnidimension`, `/exotel`, `/razorpay`, `/whatsapp` | External integrations |

### BullMQ Workers

| Worker | Queue | Purpose | Concurrency |
|:-------|:------|:--------|:-----------:|
| `call.worker.ts` | `call` | Dispatch outbound AI calls | 5 |
| `notification.worker.ts` | `notification` | Send WhatsApp/SMS/Email | 5 |
| `extraction.worker.ts` | `extraction` | Extract lead data from transcripts | 5 |
| `followup.worker.ts` | `followup` | D1/D2/D3 follow-up sequences | 5 |
| `reminder.worker.ts` | `reminder` | Booking day reminders | 5 |
| `webhook-retry.worker.ts` | `webhook-retry` | Retry failed webhook deliveries | 5 |
| `campaign.worker.ts` | `email-campaign` | Send email campaigns | 10 |

---

## 🧪 Testing

```bash
# Server — 96 tests, 0 failing
cd server
npm test                    # Vitest unit tests
npm run typecheck           # TypeScript checks (0 errors)

# Frontend
cd frontend
npx tsc --noEmit            # TypeScript checks (0 errors)
```

Test breakdown:
| Suite | Tests | Description |
|:------|:-----:|:------------|
| `lifecycle.test.ts` | 27 | Lead status state machine transitions |
| `phone.test.ts` | 13 | Indian phone number normalization |
| `lead-parser.test.ts` | 11 | Portal webhook payload parsing |
| `encryption.test.ts` | 18 | Credential encryption/decryption |
| `analytics.test.ts` | 7 | Dashboard analytics computations |
| `scoring.test.ts` | 5 | Predictive lead scoring engine |
| `smart-scheduler.test.ts` | 4 | Smart follow-up scheduling |
| `territory.test.ts` | 11 | Territory assignment + waitlist logic |
| `e2e-lead-lifecycle.test.ts` | 8 (skipped) | End-to-end lifecycle (needs DB) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- **TypeScript**: Strict mode, Zod for validation, prefer typed access over `as any`
- **Database**: Prisma migrations for schema changes; run `npx prisma db push` after changes
- **API**: RESTful conventions, consistent error responses with `{ error: string }`
- **Frontend**: Tailwind CSS, Framer Motion animations, dark theme (#0A0A0F base)

---

## 📄 License

Copyright © 2024-2026 LeadBridge. All rights reserved.

This project contains proprietary software. Unauthorized copying, distribution, or use is prohibited.

---

## 🙏 Acknowledgments

- **Omnidimension** — AI voice agent platform for outbound calls
- **BullMQ** — Redis-backed job queues for reliable background processing
- **Prisma** — TypeScript ORM with excellent developer experience
- **Fastify** — High-performance Node.js HTTP server
- **Next.js** — React framework with SSR
- **Tailwind CSS** — Utility-first styling
- **Framer Motion** — Animation library
- **GSAP** — Professional-grade scroll animations
- **Three.js** — 3D WebGL globe visualization
- **Recharts** — Composable charting library
