# 📌 DAILY WORK — Converza (persistent memory file)

> **PURPOSE:** This file is the single source of truth across sessions. When a new session starts,
> READ THIS FILE FIRST — terminal memory dies when the terminal closes, this file doesn't.
> **RULE:** After every work session, update the "Completed" and "Remaining" sections. Keep it honest.
> **Owner:** Sarvesh · **Agent:** Codebuff/Freebuff · **Last updated:** 2026-09-29

---

## 🔑 PROJECT FACTS (no secrets — reference only)

| Fact | Value |
|---|---|
| Product | **Converza** — AI voice agent + CRM for Indian real estate brokers |
| Legal entity | **GS TECHNO** (Maharashtra proprietorship — anchor for GST/Meta/Razorpay/bank) |
| GSTIN | `27AEGPH7840P1ZX` (invoices read it from `SELLER_GSTIN` env) |
| API (Render) | `https://leadbridge-zy4o.onrender.com` (service `leadbridge-api`) |
| Frontend (Vercel) | `https://leadbridge-seven.vercel.app` (project `leadbridge-seven`) |
| Repo | `sarvesh-101/leadbridge` (branch `main`) |
| Voice provider | **Omnidimension** (`OMNIDIM_*` env) — 100+ languages, call transfer, webhooks |
| WhatsApp | +91 72088 55916 (WABA verified, entity GS TECHNO) |
| SMS fallback | MessageBird, sender ID `CONVERZ` |
| Payments | Razorpay (KYC ✅, webhook ✅, GST 18%) |
| DB | Supabase Postgres `oavzflfdjluxvdlymbug` |
| Redis (queues) | **Aiven for Valkey** (free Developer tier, `rediss://` TLS) — migrated from Upstash 2026-09-29; no command quota |
| Competitor to beat | **Vyora AI** (vyora.ai) — ₹799/₹3,449 plans, CSV-upload flow, 8 languages |
| Our positioning | *"Vyora calls the leads you upload. Converza calls the leads you haven't seen yet."* |

**Key docs:** `docs/GO-LIVE-RUNBOOK.md` (master checklist) · `work-log/launch-plan.md` · `sales/payment-loop-test.md` · `outreach/demo-hitlist.md`

---

## ✅ COMPLETED (reverse-chronological)

### 2026-09-29 (evening) — PAYMENT LOOP: 95% wired (₹5 charge pending) + embedded checkout shipped
- **Embedded Razorpay Checkout SHIPPED** (`6b45493`): POST /subscriptions returns key+subId+HMAC → billing page opens the Razorpay modal ON-page (QR/UPI/cards) — no more popup tabs or dead-end banner. Hosted-page same-tab fallback kept; activation poller also fires on TRIAL→ACTIVE.
- **Self-diagnosing checkout** (`3f0c7a1`): Razorpay rejection reasons now surface in the banner.
- **/health/razorpay probe** (`9b5dfc4`): live-tests key pair, shows key PREFIX only. Caught the bug: Render held STALE keys `rzp_live_TLZtN…` vs real `rzp_live_Ti0DZ…` → Sarvesh updated keys → probe now `ok:true`.
- **Payload fix** (`9963446`): Razorpay rejects start_at/trial_period_days on plans that carry their own trial — code now GETs the plan and adapts.
- **Plans reality:** 6 old LeadBridge plans (₹5-first-cycle quirk) + 4 NEW Converza plans created (Launch/Starter/Growth/Pro) — Trial field was left non-empty on first attempts (₹5 validation charge on hosted page; recurring ₹35K from day 2 — MANDATE NOT ACTIVATED YET, no money moved).
- **PENDING (Sarvesh, deadline before ~9 AM 30-Sep):** pay ₹5 on the Converza Growth checkout → verify ACTIVE + GSTIN invoice → **CANCEL sub immediately in Razorpay dashboard** (kills tomorrow's ₹35K auto-debit) → refund ₹5 → erase test account. If skipped: cancel pending subs instead.
- **Fix-on-sight later:** dashboard-created plans get a ₹5 first charge — decide whether to delete/recreate clean plans or accept (standard mandate-validation practice).
- DB connection crash pattern during deploys: Supabase pooler EMAXCONNSESSION (15 max, session mode) — workaround = Supabase Restart → Render retry. PERMANENT FIX QUEUED: switch DATABASE_URL to transaction pooler (port 6543) + `?pgbouncer=true&connection_limit=10`.
- **Soft-launch gate verdict (researched vs launch-plan):** after today's 6 tasks (IMAP, backups, rebrand, WEBHOOK_URL, MessageBird number, ₹5 payment test+teardown) → YES for Phase 4 soft launch (2–3 hand-held brokers); public marketing only after 2–4 weeks + 1 testimonial (Phase 5 rule).

### 2026-09-29 (later) — PROD INCIDENT FIXED: "Not Found" on all auth screens
- **Symptom:** signup/login/forgot-password all showed "Not Found" after submit. DB/Redis/SMTP all healthy — NOT a backend outage.
- **Root cause:** Vercel env `NEXT_PUBLIC_API_URL` had lost its `/api/v1` suffix → every frontend API call hit `/auth/login` instead of `/api/v1/auth/login` → 404.
- **Fix:** `frontend/src/lib/api.ts` now normalizes `NEXT_PUBLIC_API_URL` — always appends/keeps `/api/v1` regardless of how the env var is set (tsc clean). Deployed via Vercel auto-deploy.
- **Diag bonus:** created `diagnostic-check-929@converzatest.com` via API (unverified trial account — can be erased later via DPDP flow).
- **Reminder:** email-verification gate is by design (Round-2 #3) — verification emails often land in SPAM; mark "Not Spam" when testing.

### 2026-09-29 — REDIS P0 FIXED (Aiven for Valkey)
- **Migrated `REDIS_URL`** Upstash (quota-exhausted free tier) → **Aiven for Valkey free tier** (`rediss://`, TLS). Zero code changes — every client reads `config.REDIS_URL`.
- **Verified live** `/health`: `status: healthy` · `redis: healthy` · **`queues: healthy`** (BullMQ alive → AI calls dispatch again) · `warnings: []`.
- Cost path decided: $0 free now → ~$5 Developer tier when Mumbai region/1GB needed → HA tier only when paying brokers are live. Provider switch anytime = swap one env var in Render.
- Upstash quota-backoff logic in `redis-health.ts` left in place (harmless with Aiven; still useful if we ever return).
- Old Upstash instance kept (not deleted) = instant rollback via env var.

### 2026-09-28 — Big shipping day (commit `f3bbb28`, deployed + verified live)
- **Omnidim call transfer WIRED**: agent creation sends real `transfer` config; transfers to broker when prospect asks for human or is a hot lead. New `Client.transferToNumber` column.
- **Multilingual agents WIRED**: 23 languages (14 Indian + international) — `server/src/services/voice/supported-languages.ts`; `Client.languages` column; `GET /voice/languages`; dashboard multi-select chips + transfer field.
- **TRAI compliance gate SHIPPED** (`call-compliance.ts`): consent-basis engine (portal enquiry = allowed; promotional campaigns blocked without opt-in), 9AM–9PM IST window, audit-trail stamp on every call. **Mandatory AI disclosure** auto-prepended to every agent prompt.
- **Converza-vs-Vyora comparison page LIVE**: `/compare/vyora` (factual, sourced from their public plans). Linked in landing footer.
- **ToS fixed**: "LeadFlow AI" → Converza (3×) — verified 0 occurrences live.
- **Footer compliance statement** added (TRAI disclosure + 9–9 window under GS TECHNO/GSTIN block).
- **GSTIN on invoice PDFs** (GS TECHNO + address, from env) — deployed.
- All 4 launch-critical user tasks DONE: SQL columns added ✅ · Render deploy `f3bbb28` ✅ · Omnidim support msg sent (140/1600 + voicemail) ✅ · live test call done ✅
- Verified live: `/health` integrations configured ✅ · `/voice/languages` 401 (=exists) ✅ · `/compare/vyora` 200 ✅
- **Redis P0 discovered**: `/health` = `redis: degraded` — "leads ingested but NEVER called". Fix = check `REDIS_URL` in Render + Upstash quota.

### 2026-09-25
- GSTIN supplied + wired: `SELLER_GSTIN`/`SELLER_ADDRESS` in env + Render; format validation in `config.ts`; invoice PDF layout fix. Website footer: GS TECHNO + address + GSTIN.
- Razorpay webhook registered (2026-09-22) → payment loop UNBLOCKED.

### Earlier (summary — details in `docs/GO-LIVE-RUNBOOK.md`)
- Razorpay KYC Verified + payouts ✅ · DB password + JWT + ENCRYPTION_KEY rotated ✅ · Meta business verification (GS TECHNO, Aug 3) ✅ · MessageBird sender `CONVERZ` ✅ · UptimeRobot ✅ · All Phase-8 code gaps (WhatsApp retry, campaign worker, Sheets UI, tests 174 green) ✅ · Portal ingestion built: IndiaMART API, Facebook leadgen, MessageBird SMS, IMAP email ✅ · DPDP compliance (consent, erasure) ✅ · WhatsApp E2E send verified ✅ · Supabase storage (call-recordings) ✅

---

## 🔴 REMAINING — DO IN THIS ORDER

### 2026-09-30 — OMNIDIM REPLY RECEIVED → P0 #2 RESOLVED
- **Their answer:** outbound calls originate from numbers PURCHASED on Omnidim's platform (mobile series or landline series — no 140/1600 series from our side). **Voicemail detection is platform-side, enabled on Early Deployers plan and above** (pricing: omnidim.io/pricing).
- **What it means for us:** (1) transactional calls to inbound leads launch on standard purchased numbers — our consent-basis compliance gate already restricts promotional calling; DLT/140 only needed later for PROMOTIONAL campaigns (backlog stays). (2) Dedicated number per Growth+/Pro client (₹200/mo, already in margin math) = buy from Omnidim at onboarding. (3) Sarvesh: **check current Omnidim plan tier** — if below Early Deployers, upgrade to unlock voicemail detection.
- **Shipped (`see commit`):** voicemail behaviour added to every agent prompt in `omnidimension-agents.service.ts` — on detection, agent leaves ONE brief callback message then ends (platform detects once plan tier allows).
- P0 remaining: transfer-ring confirmation (still unanswered) + Task 6 ₹5 payment test.

### P0 — now (2026-09-29 evening — the 6-task soft-launch sprint, guides delivered in chat)
- [ ] **Task 4:** `WEBHOOK_URL` env (Omnidim call events) — 2 min, codebuff verifies
- [ ] **Task 1:** IMAP Gmail app password + 4 env vars + test lead — codebuff verifies ingestion
- [ ] **Task 2:** Supabase `db-backups` bucket + Render Cron Job `0 */6 * * *` — codebuff verifies first dump
- [ ] **Task 3:** Rename Render→`converza-api` + Vercel→`converza` → paste new URLs to Codebuff → staged URL switch
- [ ] **Task 5:** MessageBird SMS number buy + callback webhook + `FORWARDING_SMS_NUMBER` + SMS lead test + dedupe check
- [ ] **Task 6 (do it fresh, no mandate live yet):** cancel stale "Created" subs in Razorpay → pay ₹5 on Converza Growth checkout → "paid" → verify GSTIN invoice → CANCEL sub immediately in Razorpay (kill next-cycle ₹35K auto-debit) → refund ₹5 → DPDP erase → **money loop CERTIFIED** *Owner: Sarvesh → Codebuff*
- [ ] **Confirm transfer actually rang the phone** in the 2026-09-28 test call (AI disclosure heard ✅?). *Owner: Sarvesh*

### P1 — this week (money loop)
- [ ] **Payment loop test** — `sales/payment-loop-test.md`: trial → GROWTH upgrade → real pay → webhook → invoice PDF shows GSTIN + GS TECHNO → cancel → refund → erase test account. *Owner: Sarvesh (Codebuff on-call)*
- [ ] **MessageBird SMS number** (runbook Step 4): buy number → callback to `/api/v1/webhooks/sms/incoming-messagebird` → `FORWARDING_SMS_NUMBER` env → test lead. *Owner: Sarvesh*
- [ ] **IMAP email forwarding** (Step 5): Gmail app-password mailbox → IMAP_* envs → test lead. *Owner: Sarvesh*
- [ ] **Rebrand renames** (Step 3): rename Render service + Vercel project → give new frontend URL to Codebuff → Codebuff applies staged URL switch (`docs/REBRAND-URL-SWITCH.md`). *Owner: Sarvesh → Codebuff*
- [ ] **DB backups**: create `db-backups` Supabase bucket + wire `scripts/backup-db.sh` cron (launch-plan 0.6). *Owner: Sarvesh + Codebuff*

### P2 — next week (sales weapons)
- [ ] **Record demo call** → side-by-side asset vs Vyora (download recording + transcript). *Owner: Sarvesh*
- [x] **Entry-tier pricing draft DONE** (`sales/entry-tier-pricing.md`, commit `df3b1e2`) — ₹2,499 wallet @ ₹160/call, 87–91% margin. **AWAITING SARVESH GO** → Codebuff builds Razorpay one-time flow + credit expiry + pricing page. *Owner: Sarvesh decides*
- [ ] **TRAI compliance guide page** — Codebuff builds after Omnidim reply (must be accurate, beat Vyora's generic page). *Owner: Codebuff*
- [ ] **WhatsApp leftovers**: display name + daily limits in WhatsApp Manager; SIM-side registration of +91 72088 55916. *Owner: Sarvesh*

### P3 — soft launch (the real launch)
- [ ] **Onboard 2–3 brokers** from `outreach/demo-hitlist.md` — watch every call/WhatsApp/invoice 2–4 weeks. *Owner: Sarvesh*
- [ ] **1 real testimonial** → replace "onboarding" framing on landing.
- [ ] **Lawyer review** of `sales/territory-exclusivity-agreement.md`.

### Backlog / known risks
- DLT registration + DND scrubbing for PROMOTIONAL campaigns (needs Omnidim RTM/DLT answer) — **the one open TRAI item**
- Gmail SMTP for invoices → move to proper transactional email (Loops/SES researched, not wired)
- PRO plan margin: re-tune `PRO_MONTHLY_CALL_CAP` after real call-duration data (Phase 4.2)

---

## 🧭 CONVENTIONS FOR EVERY NEW SESSION
1. Read this file first. Don't re-derive state from scratch.
2. Update Completed/Remaining at session end — including "user tasks done today".
3. Commit + push doc updates so the file survives everywhere.
4. Never put secrets in this file (env values, tokens, passwords). Facts + URLs only.
