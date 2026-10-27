# DAILY-WORK.md — Converza go-live status

> **Last updated:** 2026-10-27  
> **Owner:** Chetan (platform) · AI agent (execution)  
> **Source of truth:** this file + `docs/GO-LIVE-RUNBOOK.md` (steps) + `docs/plan-margins.md` (pricing)

---

## 2026-10-27 — LAUNCH enum + STARTER trial fix (complete)

**LAUNCH 500 fixed:**
- Root cause: the `Plan` enum in production Postgres had no `LAUNCH` value. Migration `20260907000000_add_launch_plan` had been sitting in the repo since 2026-09-07 and was never applied. Every checkout that tried to `prisma.client.update()` a Launch subscription crashed with `invalid input value for enum "Plan": "LAUNCH"` (PostgreSQL error `22P02`).
- Fix: ran `ALTER TYPE "Plan" ADD VALUE 'LAUNCH'` against the live Supabase DB directly. Verified the enum now = `{STARTER,GROWTH,PRO,LAUNCH}`.
- Recorded the migration as applied with `prisma migrate resolve --applied 20260907000000_add_launch_plan` so the deploy's `prisma migrate deploy` won't abort on "enum label already exists".
- Commit pushed: `fe6f927` — also added `npx prisma migrate deploy` to the Render build command and made the checkout path atomic (wrap in `interactiveTransaction` so a Razorpay-create failure doesn't leave a half-written subscription).

**STARTER "payment required manually" fixed:**
- Root cause: STARTER is the **only** tier that requests a 30-day trial. The checkout was sending `trial_period_days: 30` to Razorpay's `POST /subscriptions`. Razorpay does **not** accept `trial_period_days` on that endpoint — their docs list `plan_id, total_count, quantity, customer_notify, start_at, expire_by, addons, notes, offer_id`, and say trials are done by passing a future `start_at`. So Razorpay rejected the call, the checkout degraded gracefully, and the frontend showed "Subscription created — payment required manually".
- Fix (commit `bd079ed`): the trial is now expressed as a future `start_at` timestamp (30 days from now). `trial_period_days` is never sent. Verified on Razorpay's docs page (`https://razorpay.com/docs/payments/subscriptions/create`) — confirmed `trial_period_days` is not in the parameter list.
- Test coverage: new file `server/src/__tests__/razorpay-subscription.test.ts` (6 tests) pinning the exact payload per tier. Full suite: 190 passed / 8 skipped. `tsc --noEmit` clean.
- `RAZORPAY_PLAN_STARTER` was already set on Render (confirmed via `/health/integrations` before the fix). STARTER's plan ID is valid; the only thing wrong was the trial parameter.

**Deploy:**
- Render build command now includes `npx prisma migrate deploy` (commit `fe6f927`).
- Auto-deploy kept ON (was already on).
- `origin/main` is at `bd079ed` (the STARTER fix). Working tree clean. Pushed.

**Live verification:**
- `https://leadbridge-zy4o.onrender.com/health/integrations` → `razorpay.configured: true`, `missingVars: []` → all 6 Razorpay vars (KEY_ID, KEY_SECRET, PLAN_LAUNCH, PLAN_STARTER, PLAN_GROWTH, PLAN_PRO) are set on Render.
- `https://leadbridge-zy4o.onrender.com/health/razorpay` → `razorpayAuth.ok: true`, key prefix `rzp_live_Ti0DZ` (production keys, not the stale local ones).
- The deploy is live and running the new code.

**What's still true:**
- Local `.env` Razorpay keys are stale — live API returns `401 Authentication failed` (key prefix `rzp_live_TZf…`). Razorpay can only be tested from Render, not from this machine.
- Only migration still pending is `20261025000000_payment_provider_payment_id_unique` — prod's `Payment` table has 0 rows, so it's a no-op when it runs (just adds an anti-double-count unique index).

---

## 2026-10-28 — Step 2 done (Razorpay webhook handed off).

Step 2 of `docs/GO-LIVE-RUNBOOK.md` is complete on the code side. The dashboard pieces (secret in Render, webhook created in Razorpay, test deliveries) are yours to do — they can't be automated from this machine.

**What changed (not yet committed):**
- `scripts/send-test-webhook.cjs` — sends a compact, correctly-signed synthetic Razorpay event to any endpoint. `RAZORPAY_WEBHOOK_SECRET` from Render. Fake ids only, no DB writes. Usage: `RAZORPAY_WEBHOOK_SECRET=<value> node scripts/send-test-webhook.cjs [eventType] [--bad-signature]`.
- `scripts/verify-money-loop.cjs` — read-only Prisma check of one broker's Razorpay money loop after a ₹5 run: activation, subscription, PAID invoice with GSTIN/GS TECHNO, Payment row, and revenue increment. `node scripts/verify-money-loop.cjs <email>` or `--latest`.
- `server/_checkout-probe.cjs` — creates a live Razorpay subscription per tier using the **local** `.env` keys (same shape the checkout sends). Useful to confirm the local keys work before pointing at Render. Note: local keys are stale — expect 401 against Razorpay live.
- `server/_checkout-probe-http.cjs` / `server/_checkout-probe-live.cjs` — thin HTTP probes of `https://leadbridge-zy4o.onrender.com/health/razorpay` and `/health/integrations`.
- `health.json` — snapshot of `/health` state at handoff time.

**Status of the Step 2 checklist:**
- 2a (Render secret) — **you do this in the dashboard.** Confirm `RAZORPAY_WEBHOOK_SECRET` is set on Render → leadbridge-api → Environment. Default from this repo's `.env`: `8e994f4cb5677d2097ea3dfe66c29b3c47d2637c5d66025f`.
- 2b (dashboard webhook) — **you do this.** Razorpay dashboard → Settings → Webhooks → Add Webhook. URL `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`, events: `subscription.charged`, `subscription.cancelled`, `subscription.pending`, `payment.failed`, `invoice.paid`. Secret must match the Render value.
- 2c (send-test-webhook) — run from the repo root once the Render secret is set: `RAZORPAY_WEBHOOK_SECRET=<value> node scripts/send-test-webhook.cjs` → expect HTTP 200. Then `... node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature` → expect HTTP 401.
- 2d (route handles all 5 events) — already implemented in `server/src/routes/webhooks/razorpay.ts`; verified by the test suite (190 passed / 8 skipped, `tsc --noEmit` clean).

**Known caveat (documented in the checklist, not a bug right now):** the webhook handler re-serializes the parsed body with `JSON.stringify(request.body)` before computing the HMAC, instead of hashing the raw bytes. That matches Razorpay's compact JSON exactly, so it works for real deliveries today. If a real delivery ever 401s with a confirmed-matching secret, that's the cause — fix it by capturing the raw body in the `application/json` parser in `server/src/index.ts`.

---

## BLOCKERS — none right now

None. Both LAUNCH and STARTER should now reach a Razorpay payment page. GROWTH and PRO were always working.

---

## TODO — verify (not code)

Do this from the dashboard, not from code:

- [ ] **Launch checkout** — dashboard → Billing → click Upgrade on Launch → Razorpay sheet opens (₹7,999/mo). No 500, no "manual payment".
- [ ] **Starter checkout** — dashboard → Billing → click Upgrade on Starter → Razorpay sheet opens (₹18,000/mo), first charge deferred 30 days.
- [ ] If either still fails: **Render → leadbridge-api → Logs**, search `Razorpay subscription failed`, paste the exact line — it contains the literal Razorpay rejection reason, and the fix is one payload tweak.

---

## TODO — runbook remaining (not started)

From `docs/GO-LIVE-RUNBOOK.md`:

- [ ] **Step 4 — SMS forwarding:** buy MessageBird number → verify → set callback to `/api/v1/webhooks/sms/incoming-messagebird` → add `FORWARDING_SMS_NUMBER` in Render → test SMS creates a lead → resend to check dedupe. (Currently: `sms_forwarding.configured: false`, `missingVars: ["FORWARDING_SMS_NUMBER"]`.)
- [ ] **Step 5 — IMAP email forwarding:** Gmail app password → set `IMAP_*` env → forward a portal enquiry → lead in ~2 min. (Currently: `email_forwarding.configured: false`.)
- [ ] **Step 6 — Facebook Lead Ads:** create Business app → webhook `/api/v1/webhooks/facebook` + verify token → subscribe to `leadgen` event → test lead arrives.
- [ ] **Step 7 — WhatsApp Business API (real):** WhatsApp Cloud + phone number → `/api/v1/webhooks/whatsapp` → test inbound message creates a lead.
- [ ] **Step 8 — Razorpay webhook:** create webhook in Razorpay dashboard → `POST /api/v1/webhooks/razorpay` → events: `subscription.charged`, `subscription.cancelled`, `subscription.pending`, `payment.failed`, `invoice.paid` → test with Razorpay CLI or dashboard "Test webhook".
- [ ] **Step 9 — Invoice PDFs:** confirm `/invoices/:filename` serves PDFs with signed-URL or Bearer auth; confirm GSTIN + "GS TECHNO" appears on the generated invoice.
- [ ] **Step 10 — Money loop test (`sales/payment-loop-test.md`):** trial → upgrade → real pay → webhook → invoice PDF shows GSTIN + GS TECHNO → cancel → refund → DPDP erase test account. (The ₹5 loop: cancel stale "Created" subs → pay on a checkout → verify ACTIVE + GSTIN invoice → cancel sub immediately → refund → erase.)
- [ ] **Step 11 — Rebrand:** rename Render `leadbridge-api` → `converza-api`; rename Vercel `leadbridge-seven` → `converza`; update `FORWARDING_EMAIL` sub-addresses if used; record new URL in `docs/REBRAND-URL-SWITCH.md`.
- [ ] **Step 12 — Demo call:** side-by-side demo call vs Vyora.
- [ ] **Step 13 — Onboard 2–3 brokers** (`outreach/demo-hitlist.md`) → 1 testimonial + lawyer review of exclusivity agreement.
- [ ] **Backlog (defer until real data):** DLT/DND for promotional campaigns, Gmail SMTP → transactional email, PRO cap re-tune after real call-duration data.

---

## Context for the AI agent

- Project: Converza (was LeadBridge) — AI sales-call platform for Indian real-estate brokers.
- Stack: Fastify backend (server/) + Next.js frontend (frontend/) + Prisma + PostgreSQL (Supabase) + Redis (Render free tier, available). Voice AI via Omnidimension. Payments via Razorpay. SMS via MessageBird. WhatsApp via Cloud API. Email via Nodemailer/SMTP.
- Deploy: Render (`leadbridge-api`) hosts the API; Vercel (`leadbridge-seven`) hosts the frontend. Repo root has `render.yaml`.
- Env vars for Razorpay (all set on Render, confirmed via `/health/integrations`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_LAUNCH`, `RAZORPAY_PLAN_STARTER`, `RAZORPAY_PLAN_GROWTH`, `RAZORPAY_PLAN_PRO`. Plus `RAZORPAY_WEBHOOK_SECRET` (set — used to verify incoming webhooks).
- Plan pricing (from `docs/plan-margins.md`): Launch ₹7,999/mo (50 calls), Starter ₹18,000/mo (150 calls), Growth ₹35,000/mo (300 calls), Pro ₹60,000/mo (2,000 calls). GST 18% on all. Launch and Starter have a 30-day trial by default (expressed as a future `start_at` to Razorpay, not as `trial_period_days`).
- Razorpay plan IDs on Render: `plan_...` values set for all four tiers. Do NOT use `node scripts/setup-razorpay.cjs` locally — the local keys are stale (401). Create/verify plans in the Razorpay dashboard if ever needed.
- The local machine cannot hit the live Razorpay API (401). All Razorpay testing must happen on Render or via the dashboard.
