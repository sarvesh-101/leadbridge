# 🚨 DEPRECATED — Python FastAPI Backend

> **Status:** Deprecated (June 2026)
> **Replaced by:** `server/` — TypeScript Fastify server

## Why?

The codebase had **two complete API backends** — a Python FastAPI server (`backend/`) and a TypeScript Fastify server (`server/`). This caused:

- Route duplication (`/auth`, `/leads`, `/calls`, etc.)
- Docker + CI/CD confusion (which one to build?)
- Nginx routing ambiguity
- Double the maintenance burden

The TypeScript Fastify server was chosen as the canonical backend because:
- 27 route files vs 10 in Python
- BullMQ workers for background jobs
- Better integration with Prisma ORM
- WebSocket support built-in
- Shared types with the frontend

## Migration

All Python backend routes have TypeScript equivalents. If you find something missing:

1. Check `server/src/routes/` for the equivalent TypeScript route
2. If it doesn't exist yet, port it from `backend/app/api/routes/`
3. Update this file to note the migration

## What remains here

This directory is kept for reference only. Do NOT run the Python server in production.
It will be removed in a future cleanup cycle.

## Files to migrate if needed (none critical)

- `backend/app/workers/scheduled.py` — Cron tasks → already in `server/src/cron/`
- `backend/app/models/` — SQLAlchemy models → already in `server/prisma/schema.prisma`
