# 🏗️ LeadBridge — AI-Powered Real Estate Lead Conversion Platform

[![Status](https://img.shields.io/badge/Status-Active-success)](https://leadbridge.com)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5%2B-blue)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.19-purple)](https://prisma.io)

> **One broker per city. AI calls every lead in 60 seconds.**
> LeadBridge automates real estate lead qualification, calling, follow-ups, and conversion tracking — from inquiry to site visit.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Services & Integrations](#-services--integrations)
- [Lead Lifecycle](#-lead-lifecycle)
- [API Reference](#-api-reference)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

LeadBridge automates the entire real estate lead follow-up process:

1. **Lead Ingestion** — Captures leads from IndiaMart, MagicBricks, 99Acres, JustDial, Housing.com, Facebook Lead Ads, Google Forms, WhatsApp, and CSV imports
2. **Instant AI Call** — Within 60 seconds, an AI agent (powered by DeepSeek + Deepgram + Cartesia) calls every new lead for qualification
3. **Smart Lead Scoring** — Predictive engine scores leads (0-100) based on source, budget, timeline, sentiment, territory match, and response time
4. **Automated Workflows** — Follow-up sequences via WhatsApp messages, reminder calls, and no-show recovery campaigns
5. **Visit Tracking** — End-to-end booking management with WhatsApp reminders, Google Sheets sync, and conversion funnel analytics
6. **Territory Exclusivity** — One agent per geographic territory with monthly subscription model

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
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                     │
│            Marketing Site + Dashboard + Admin Panel           │
└──────────────────┬──────────────────────────────────────────┘
                   │ REST + WebSocket
         ┌─────────┴────────────┬──────────────┐
         ▼                     ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  FastAPI Server  │  │  Fastify Server  │  │   Pipecat Agent  │
│  (Python)        │  │  (TypeScript)    │  │   (Python)       │
│  [/api/v1]      │  │  [/api/v1]      │  │   AI Voice Calls │
│  Auth / Leads   │  │  Calls / Webhooks│  │   DeepSeek + STT │
│  Campaigns      │  │  Queue / Workers │  │   + TTS Pipeline │
│  Analytics      │  │  Real-time WS    │  │                  │
└────────┬────────┘  └────────┬─────────┘  └──────────────────┘
         │                    │
         └────────┬───────────┘
                  ▼
    ┌─────────────────────────┐
    │     PostgreSQL 16       │
    │  (Primary Data Store)   │
    └────────────┬────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
   ┌──────────┐   ┌──────────┐
   │  Redis   │   │    S3    │
   │ Queue +  │   │Recording│
   │  Cache   │   │ Storage │
   └──────────┘   └──────────┘

External Services:
  📞 Exotel (Telephony)
  💬 WhatsApp Cloud API
  💳 Razorpay (Subscriptions)
  📧 Resend (Email)
  🤖 DeepSeek (LLM)
  🎤 Deepgram (STT)
  🗣️ Cartesia (TTS)
```

---

## ✨ Features

### 🤖 AI Calling Engine
- Outbound AI calls to leads within 60 seconds of ingestion
- Multi-language support (Hindi, English, Hinglish)
- Sentiment analysis & real-time qualification
- Automatic appointment booking via natural conversation
- Smart follow-up scheduling based on lead behavior

### 📊 Predictive Lead Scoring
8-factor scoring model (0-100):
| Factor | Weight | Description |
|--------|:------:|-------------|
| Source Quality | 20% | 99Acres > MagicBricks > JustDial > Manual |
| Time-to-Call | 15% | Faster response = higher score |
| Budget Range | 15% | Within 20% of average deal |
| Timeline Urgency | 20% | Immediate > 1-3 months > browsing |
| Property Type | 10% | Most common type = bonus |
| Call Hour | 10% | Business hours preferred |
| Territory Match | 10% | Broker's area = bonus |
| Sentiment | ±10 | Positive = +10, Negative = -15 |

### 🔄 Lead Lifecycle Automation
```
PENDING → CALLING → FAQ_ONLY ──→ COLD
                   → BOOKED ──→ REMINDED ──→ VISITED ──→ CONVERTED
                                  → NO_SHOW ──→ FOLLOWUP_D1 → D2 → D3 → REBOOKED
```

### 🗺️ Territory Exclusivity System
- City/zone-based territory assignments
- Tiered pricing (Metro, Tier-2, Tier-3)
- Automatic waitlist for occupied territories
- Monthly subscription per territory
- One broker per territory exclusivity

### 💬 Multi-Channel Communication
- WhatsApp notifications (appointment confirmations, reminders, follow-ups)
- AI call summaries delivered to broker's WhatsApp
- WhatsApp chatbot for lead interaction
- Email notifications via Resend

---

## 🚀 Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (for PostgreSQL, Redis, and services)
- **Node.js** 18+ & **npm** / **pnpm**
- **Python** 3.11+ & **pip**
- **Git**

### 1. Clone & Install

```bash
git clone <repository-url>
cd leadbridge

# Copy environment file
cp .env.example .env

# Install server dependencies
cd server
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install Python backend dependencies
cd ../backend
pip install -r requirements.txt
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose -f docker/docker-compose.yml up -d postgres redis
```

### 3. Database Setup

```bash
# TypeScript/Prisma server
cd server
cp ../.env .env          # Edit with your DB credentials
npx prisma generate
npx prisma db push        # Creates tables from schema

# Seed default admin (auto-created on first run):
# Email: admin@leadbridge.com
# Password: random (check server logs on first start)
```

### 4. Launch Services

```bash
# Terminal 1 — TypeScript Server (API + WebSocket)
cd server
npm run dev
# → http://localhost:3000

# Terminal 2 — Python Backend (FastAPI)
cd backend
cp ../.env .env
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs

# Terminal 3 — Frontend (Next.js)
cd frontend
npm run dev
# → http://localhost:3001
```

### 5. Verify Installation

```bash
curl http://localhost:3000/health
# {"status":"healthy","app":"LeadBridge","version":"1.0.0"}
```

---

## 📁 Project Structure

```
leadbridge/
├── backend/                    # Python FastAPI Backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/         # API route handlers
│   │   │   │   ├── admin.py        # Admin panel endpoints
│   │   │   │   ├── analytics.py    # Analytics & reporting
│   │   │   │   ├── appointments.py # Booking management
│   │   │   │   ├── auth.py         # Authentication
│   │   │   │   ├── calls.py        # Call management
│   │   │   │   ├── campaigns.py    # Campaign workflows
│   │   │   │   ├── integrations.py # Third-party integrations
│   │   │   │   ├── leads.py        # Lead CRUD & analytics
│   │   │   │   ├── subscriptions.py# Plan & billing
│   │   │   │   └── territories.py  # Territory exclusivity
│   │   │   └── v1/             # API v1 router aggregator
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic settings
│   │   │   ├── database.py     # SQLAlchemy async engine
│   │   │   └── security.py     # JWT, RBAC, encryption
│   │   ├── middleware/
│   │   │   └── auth.py         # Auth middleware & rate limiter
│   │   ├── models/            # SQLAlchemy ORM models
│   │   │   ├── ai_config.py   # AI agent configuration
│   │   │   ├── appointment.py # Appointment/booking model
│   │   │   ├── audit.py       # Audit logging
│   │   │   ├── call.py        # Call & recording models
│   │   │   ├── campaign.py    # Campaign & task models
│   │   │   ├── integration.py # Integration & webhook models
│   │   │   ├── lead.py        # Lead, status, activity models
│   │   │   ├── message.py     # WhatsApp message logs
│   │   │   ├── notification.py# In-app notification model
│   │   │   ├── subscription.py# Subscription, invoice, payment
│   │   │   ├── tenant.py      # Multi-tenant organization
│   │   │   ├── territory.py   # Territory exclusivity model
│   │   │   └── user.py        # User & role models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── workers/           # Celery async tasks
│   │   ├── main.py            # FastAPI application entry point
│   └── requirements.txt
│
├── server/                     # TypeScript Fastify Server
│   ├── prisma/
│   │   └── schema.prisma      # Database schema (11 models)
│   ├── src/
│   │   ├── config.ts          # Zod-validated env config
│   │   ├── index.ts           # Server entry point
│   │   ├── create-admin.ts    # First-run admin seeder
│   │   ├── plugins/           # Fastify plugins
│   │   ├── routes/            # Route handlers
│   │   │   ├── admin/         # Admin routes
│   │   │   ├── client/        # Client/broker routes
│   │   │   └── webhooks/      # External webhook handlers
│   │   ├── services/          # Business logic services
│   │   ├── utils/             # Utilities & helpers
│   │   ├── workers/           # BullMQ queue workers
│   │   └── cron/              # Scheduled job handlers
│   └── package.json
│
├── frontend/                   # Next.js 15 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/          # Login, register, reset password
│   │   │   ├── dashboard/     # All dashboard pages
│   │   │   ├── admin/         # Admin portal
│   │   │   ├── legal/         # Terms, Privacy
│   │   │   └── page.tsx       # Landing/marketing page
│   │   ├── components/        # Reusable React components
│   │   │   ├── admin/         # Admin components
│   │   │   ├── calls/         # Call cards, recording player
│   │   │   ├── canvas/        # Three.js globe
│   │   │   ├── dashboard/     # Charts, activity feed
│   │   │   ├── leads/         # Lead table, filters, detail panel
│   │   │   ├── marketing/     # Landing page sections
│   │   │   └── shared/        # Sidebar, TopBar, badges, etc.
│   │   ├── lib/               # API client, utilities, WebSocket
│   │   ├── stores/            # Zustand state management
│   │   └── types/             # TypeScript type definitions
│   └── package.json
│
├── pipecat-agent/              # Python AI Voice Agent
│   ├── config.py
│   ├── main.py                 # Pipecat pipeline (DeepSeek + Deepgram + Cartesia)
│   └── requirements.txt
│
├── docker/                     # Docker Compose & Dockerfiles
│   ├── docker-compose.yml      # Full stack (10 services)
│   └── Dockerfile
│
├── infrastructure/             # Infrastructure as Code
│   └── nginx/
│       └── leadflow.conf       # Nginx with SSL, rate limiting, WS
│
├── .env.example                # All environment variables documented
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # GitHub Actions pipeline
└── README.md                   # This file
```

---

## 🔌 Services & Integrations

| Service | Purpose | Status | Docs |
|---------|---------|:------:|------|
| **PostgreSQL 16** | Primary database | ✅ Required | — |
| **Redis 7** | Queue & cache | ✅ Required | — |
| **Exotel** | Telephony (outbound calls) | ⚪ Optional | [API Docs](https://developer.exotel.com/) |
| **Pipecat** | AI voice agent pipeline | ⚪ Optional | [GitHub](https://github.com/pipecat-ai/pipecat) |
| **DeepSeek** | LLM for call reasoning | ⚪ Optional | [Platform](https://platform.deepseek.com/) |
| **Deepgram** | Speech-to-text (Nova-2) | ⚪ Optional | [Console](https://console.deepgram.com/) |
| **Cartesia** | Text-to-speech voices | ⚪ Optional | [Website](https://cartesia.ai/) |
| **WhatsApp Cloud API** | WhatsApp messaging | ⚪ Optional | [Dev Center](https://developers.facebook.com/) |
| **Razorpay** | Subscription payments | ⚪ Optional | [Dashboard](https://razorpay.com) |
| **Resend** | Email delivery | ⚪ Optional | [Website](https://resend.com) |
| **Supabase** | File storage (recordings) | ⚪ Optional | [Dashboard](https://supabase.com) |

> **Note**: The platform runs in development mode with only PostgreSQL and Redis.
> External services can be added later by configuring their environment variables.

---

## 🔄 Lead Lifecycle

### Status Flow Diagram

```
                    ┌──────────┐
                    │  PENDING │ (New lead received)
                    └────┬─────┘
                         │ AI call initiated
                    ┌────▼─────┐
                    │  CALLING │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌─────────┐ ┌────────┐ ┌────────┐
        │NO_ANSWER│ │FAQ_ONLY│ │ BOOKED │
        └────┬────┘ └───┬────┘ └───┬────┘
             │          │          │ WhatsApp reminder
             ▼          ▼          ▼
       ┌──────────┐ ┌────────┐ ┌─────────┐
       │CALL_     │ │  COLD  │ │ REMINDED│
       │FAILED    │ └────────┘ └────┬────┘
       └────┬─────┘                 │
            │ Retry           ┌─────┴──────┐
            ▼                  ▼            ▼
     ┌──────────────┐   ┌────────┐   ┌──────────┐
     │FOLLOWUP_D1/  │   │VISITED │   │ NO_SHOW  │
     │D2/D3/REBOOKED│   └───┬────┘   └────┬─────┘
     └──────┬───────┘       │             │
            │               ▼             ▼
            └────────► ┌──────────┐ ┌──────────┐
                       │CONVERTED │ │FOLLOWUP_ │
                       └──────────┘ │D1/D2/D3  │
                                    └──────────┘
```

### Auto-Transitions

| From | To | Trigger | Delay |
|------|:--:|:-------:|:-----:|
| PENDING | CALLING | New lead created | < 60s |
| NO_ANSWER | CALL_FAILED | Retry exhausted | 30 min × 3 attempts |
| NO_SHOW | FOLLOWUP_D1 | No-show detected | Smart optimal time |
| BOOKED | REMINDED | 24h before visit | 24h before |
| REMINDED | VISITED | Broker confirms | Manual |
| VISITED | CONVERTED | Broker confirms | Manual |
| FOLLOWUP_D3 | COLD | No response | 7 days |

---

## 📖 API Reference

### FastAPI Backend (`/api/v1`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/register` | Register new tenant & admin |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user profile |
| GET | `/auth/tenant` | Current tenant info |
| POST | `/auth/change-password` | Change password |
| GET | `/leads/` | List leads (paginated, filterable) |
| POST | `/leads/` | Create lead |
| GET | `/leads/{id}` | Get lead details |
| PUT | `/leads/{id}` | Update lead |
| DELETE | `/leads/{id}` | Soft delete lead |
| POST | `/leads/{id}/assign` | Assign to user |
| POST | `/leads/{id}/score` | Update AI score |
| POST | `/leads/import/csv` | Bulk CSV import |
| POST | `/leads/bulk` | Bulk actions |
| GET | `/leads/analytics/summary` | Lead analytics |
| GET | `/calls/` | List calls |
| POST | `/calls/initiate` | Initiate AI call |
| GET | `/calls/{id}` | Get call details |
| GET | `/appointments/` | List appointments |
| POST | `/appointments/` | Create appointment |
| GET | `/campaigns/` | List campaigns |
| POST | `/campaigns/` | Create campaign |
| POST | `/campaigns/{id}/activate` | Activate campaign |
| POST | `/campaigns/{id}/pause` | Pause campaign |
| GET | `/territories/` | List territories |
| GET | `/territories/available` | Available territories |
| POST | `/territories/purchase` | Purchase territory |
| GET | `/integrations/providers` | Available providers |
| GET | `/integrations/` | User integrations |
| POST | `/integrations/` | Create integration |
| POST | `/integrations/{id}/test` | Test connection |
| POST | `/integrations/{id}/sync` | Trigger sync |
| GET | `/admin/clients` | List clients (super admin) |
| PATCH | `/admin/clients/{id}/status` | Update tenant status |
| GET | `/admin/analytics/dashboard` | Platform analytics |
| GET | `/admin/audit-logs` | Browse audit logs |
| GET | `/analytics/dashboard` | Dashboard stats |
| GET | `/analytics/conversion-funnel` | Funnel data |
| GET | `/subscriptions/current` | Current subscription |
| POST | `/subscriptions/create` | Create subscription |

### Fastify Server (`/api/v1` — Alternative API)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/login` | Login |
| POST | `/auth/register` | Register |
| GET | `/leads` | List leads |
| POST | `/leads` | Create lead |
| GET | `/leads/{id}` | Get lead |
| GET | `/calls` | List calls |
| GET | `/dashboard` | Dashboard data |
| POST | `/webhooks/ingest` | Lead ingestion webhook |
| POST | `/webhooks/exotel` | Exotel call events |
| POST | `/webhooks/razorpay` | Payment events |
| POST | `/webhooks/whatsapp` | WhatsApp messages |

---

## 🔐 Environment Variables

See [`.env.example`](.env.example) for the complete list of all 70+ configuration variables.

**Minimum Required (Development):**
```
JWT_SECRET=<random-32-chars>
JWT_REFRESH_SECRET=<random-32-chars>
ENCRYPTION_KEY=<random-16-chars>
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/leadflow_ai
REDIS_URL=redis://:redispass@localhost:6379/0
```

---

## 🐳 Deployment

### Docker Compose (Full Stack)

```bash
# Start all services
docker compose -f docker/docker-compose.yml up -d

# Check status
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs -f backend frontend
```

### Services Started

| Service | Port | Description |
|---------|:----:|-------------|
| Nginx | 80/443 | Reverse proxy with SSL |
| Frontend | 3000 | Next.js dashboard |
| Backend | 8000 | FastAPI API |
| Celery Worker | — | Async task processing |
| Celery Beat | — | Scheduled tasks |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & queue |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Dashboards |

### Production Checklist

- [ ] Set strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`
- [ ] Configure SSL certificates in `infrastructure/nginx/`
- [ ] Set `ENVIRONMENT=production` and `NODE_ENV=production`
- [ ] Use managed PostgreSQL (AWS RDS, Supabase, etc.)
- [ ] Use managed Redis (Upstash, Redis Cloud, etc.)
- [ ] Set up Sentry for error tracking
- [ ] Configure external service credentials
- [ ] Run database migrations with Alembic/Prisma
- [ ] Set up monitoring alerts (Grafana)
- [ ] Enable rate limiting
- [ ] Regular database backups

---

## 🧪 Testing

```bash
# TypeScript server tests
cd server
npm test              # Vitest unit tests
npm run typecheck     # TypeScript type checking

# Frontend type checking
cd frontend
npm run type-check    # TypeScript checking
npm run lint          # ESLint

# Python backend tests
cd backend
pytest               # Pytest unit tests
pytest --cov         # With coverage report
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- **Python**: Follow PEP 8, use type hints, async/await for I/O
- **TypeScript**: Use strict mode, Zod for validation, proper types
- **Database**: Always use migrations (Alembic for FastAPI, Prisma for Fastify)
- **API**: RESTful conventions, consistent error responses
- **Frontend**: Tailwind CSS, Framer Motion animations, dark theme

---

## 📄 License

Copyright © 2024 LeadBridge. All rights reserved.

This project contains proprietary software. Unauthorized copying, distribution, or use is prohibited.

---

## 🙏 Acknowledgments

- **Pipecat AI** — Voice agent pipeline framework
- **DeepSeek** — Primary LLM for AI call reasoning
- **Deepgram** — Nova-2 speech-to-text model
- **Cartesia** — Sonic text-to-speech voices
- **Exotel** — Indian telephony infrastructure
- **BullMQ** — Redis-backed job queues
- **Prisma** — TypeScript ORM with excellent DX
- **FastAPI** — High-performance Python async framework
- **Next.js** — React framework with SSR
- **Tailwind CSS** — Utility-first styling
- **Framer Motion** — Animation library
- **Three.js** — 3D WebGL graphics
- **GSAP** — Professional-grade animations
- **TanStack Table** — Headless table with virtual scrolling
