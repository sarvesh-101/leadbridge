# 🚀 Launch Plan — LeadBridge (Tracked Checklist)

> **Created:** 2026-08-08 · **Source:** live audit of env/configs + India compliance research
> **Rule:** Phase 0 → 2 are **non-negotiable before anyone pays**. Phase 4 (soft launch) is the real launch. Phase 5 marketing only after real brokers have real results.
> Tick items `[ ]` → `[x]` as they complete. Keep the "Notes" lines updated.

---

## 🟥 PHASE 0 — Must-do technical (no launch without these)

- [ ] **0.1 Deploy backend + production Postgres** (Railway/VPS + real domain)
  - Currently everything runs on local laptop + ngrok (`casino-bunkbed-bronze.ngrok-free.dev`). Dies when PC is off.
  - `railway.json` + `Procfile` already exist. CI `deploy` job gated on `vars.DEPLOY_ENABLED == 'true'` (unset → skipped).
  - Need: DEPLOY_ENABLED=true + host secrets, or manual Railway deploy.
  - 📋 Step-by-step guide written: **`RAILWAY-DEPLOY.md`** (2026-08-10) — env table, 7 worker services, migrations, frontend switchover. Needs Sarvesh to create the Railway account + run it.
  - 🧭 **DECISION (2026-08-10): deploy intentionally DEFERRED until product-ready.** Everything stays on laptop+ngrok meanwhile. Site is dead whenever PC is off — acceptable while nobody is being sent to it.
  - ⚡ **TRIGGER to deploy:** the moment the link is shared with a prospect OR a real broker signs up → run `RAILWAY-DEPLOY.md` BEFORE that happens. Deploys are automatic on every push after setup — no ongoing maintenance burden.
- [x] **0.2 Fix CSP** in `frontend/next.config.js` `connect-src` ✅ DONE 2026-08-08 (commit `b82f3ab`)
  - Was: allowed `https://*.ngrok-free.app` but tunnel is `.ngrok-free.dev` → live landing page API calls BLOCKED.
  - Fix: pinned exact static tunnel host `casino-bunkbed-bronze.ngrok-free.dev` for `connect-src` (https + wss).
  - Verified live: backend `/api/v1/public/landing` returns HTTP 200, zero CSP console errors in browser (2026-08-08).
  - ⚠️ When 0.1 is done: replace ngrok entries with the production domain (TODO comment already in next.config.js).
- [x] **0.3 WhatsApp approval → switch `.env` to real number** ✅ MOSTLY DONE 2026-08-12 — LIVE VERIFIED
  - Real number **+91 72088 55916** now on the WABA: **VERIFIED**, display name `LeadBridge` (name status PENDING_REVIEW — normal, doesn't block sends).
  - `.env` updated: permanent **SYSTEM_USER token** (expires: never ✅) + real **WHATSAPP_PHONE_ID `1226070940590994`** (was Meta TEST number `1174238042447407`).
  - ✅ **LIVE END-TO-END TEST PASSED 2026-08-12** — real message sent from +91 72088 55916 to +91 7045525531 via `sendTextMessage` (message id `wamid.HBgM...`).
  - ⚠️ Remaining: (1) `WHATSAPP_BUSINESS_ACCOUNT_ID` still points at the OLD test WABA (`1008711545369398`) — new number lives on a different business account (app "LeadConverter"); affects only the admin status panel, not sends. (2) Webhook URL points at Vercel frontend domain — incoming webhooks need Phase 0.1 deploy. (3) **PENDING: register +91 72088 55916 on the WhatsApp app** — number is new; app shows "temporarily unavailable" cooldown (~1h–24h). Must create the WhatsApp account on that SIM to receive test messages. Do NOT spam retries (extends cooldown). Try SMS → if blocked, "call me" option → wait between attempts.
- [ ] **0.4 SMS provider key** — `MESSAGEBIRD_API_KEY` empty in `server/.env` → SMS campaigns silently fail
  - 🔗 Setup link provided 2026-08-10 (Bird dashboard). Paste the key back to finish.
- [x] **0.5 Supabase storage keys** ✅ DONE + LIVE-VERIFIED 2026-08-10
  - `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set in `server/.env`.
  - Bucket `call-recordings` created + made **public** (upload → public URL → read 200 verified).
  - Fixed `storage.service.ts` delete to the current Supabase bulk API (`DELETE /object/{bucket}` + `prefixes`) — old endpoint 400s on new projects.
- [ ] **0.6 DB backups + uptime monitoring** (tooling ready; scheduling needs the Railway deploy)
  - ✅ `scripts/backup-db.sh` (pg_dump → gzip, retention, optional S3) + `scripts/uptime-check.sh` (state-transition alerting on `/health`) + `infrastructure/monitoring/railway-monitoring.md` guide (2026-08-10).
  - Remaining: Railway Postgres built-in backups ON + a Cron Job service running both scripts. Blocked until 0.1 deploy.

---

## 🟨 PHASE 1 — Compliance & paperwork (parallel with Phase 0)

- [ ] **1.1 Decide GST path**
  - SaaS = 18% (SAC 9983). Registration mandatory only above ₹20L/yr turnover.
  - Either register now (charge 18% — pricing page already says "18% GST applies") or stay under threshold and remove that line. Ask a CA.
- [ ] **1.2 Confirm Razorpay KYC matches legal entity**
  - Individual: PAN + Aadhaar/address + bank proof. Company: CoI, MoA/AoA, board resolution, director/UBO proofs.
  - Mismatch → payout holds. Live keys already set: `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET/PLAN_*`.
- [x] **1.3 DPDP Act compliance** ✅ CODE DONE 2026-08-10 (legal review still advised)
  - No size exemption. We collect phone numbers → Data Fiduciary.
  - ✅ Consent checkbox (required) on registration + stored (`consentGivenAt`/`consentVersion` v1.0).
  - ✅ Settings → Privacy & Data tab: consent status + one-click "Request data erasure" (atomic, notifies admin, 30-day SLA).
  - ✅ Admin: `?erasureRequested=true` filter + `dataErasureProcessedAt` to close the loop.
  - ✅ Privacy Policy updated (Aug 10, 2026) with DPDP erasure path. `ENCRYPTION_KEY` already set.
- [x] **1.4 WhatsApp business verification checklist** ✅ DRAFTED `sales/whatsapp-business-verification.md` (2026-08-15)
  - Full step-by-step: decide legal entity (blocked on 1.1) → Meta BM setup → submit verification → post-check → rejection fixes.
  - Rule: one name everywhere (Meta = GST/CoI/MSME = website = bank account).
  - Submission itself is a Sarvesh action (needs the real entity name + docs).
- [x] **1.5 Fix legal contact emails** ✅ DONE 2026-08-10 — real mailbox `support@converza.tech` purchased + wired
  - Footer Contact, FAQ, ToS, and Privacy Policy pages now `mailto:support@converza.tech` (was dead `@leadbridge.com`).
  - Outbound `FROM_EMAIL` stays the real Gmail SMTP user (verified in .env) — sends from a live inbox.
  - ⚠️ ~~Remaining dead-domain default: `forward@leadbridge.com` shown in the Lead Forwarding setup page~~ ✅ SWAPPED to `forward@converza.tech` (2026-08-15).

---

## 🟩 PHASE 2 — Trust & money verification

- [x] **2.1 Audit landing claims** ✅ DONE 2026-08-10
  - TestimonialsSection is already honest ("onboarding our first brokers") ✓
  - ✅ ComparisonSection: "500+ per month" + "100% consistent" now carry a `*` footnote — "Platform capability, not a guarantee. Results vary by broker and market."
  - ✅ ROISection: explicit "Illustrative calculator — assumptions" box (400 leads/month, 2 × ₹25K telecallers, 12 vs 36 bookings) + "in this scenario" labels.
- [x] **2.2 Verify per-plan margins** ✅ DONE 2026-08-15 — analysis in `docs/plan-margins.md`
  - `OMNIDIM_COST_PER_MINUTE=4.6`, `PHONE_NUMBER_MONTHLY_COST=200`, `BROKER_CALL_PRICE=70`.
  - STARTER (94% margin) + GROWTH (86%) are safely profitable at every realistic call duration. PRO was the only risk: at the old 5,000-call cap with 4-min avg calls the platform LOSES money (−₹32K/mo). **✅ APPLIED 2026-08-15: `PRO_MONTHLY_CALL_CAP` lowered 5,000 → 2,000** (env + code default). Worst case (6-min calls at 2,000) still ~8% margin. Re-tune after Phase 4.2 real call-duration data.
- [ ] **2.3 Full payment loop test on production** ✅ SPEC READY `sales/payment-loop-test.md` (2026-08-15) — run AFTER 0.1
  - Full 8-step runbook: trial → GROWTH checkout → real charge → webhook asserts (activation, invoice PAID, GST PDF, Payment row, revenue) → renewal sim (FIX #9 invoice + cycle reset) → cancel/refund → failure paths → teardown (dogfoods DPDP erasure).

---

## 🟦 PHASE 3 — Sales & onboarding readiness

- [ ] **3.1 1-page onboarding guide (Hinglish)** ✅ DRAFTED `sales/onboarding-guide.md` (2026-08-10) — territory → agent → number → test call → 4 lead routes → what happens when a lead lands.
- [ ] **3.2 Territory exclusivity agreement** ✅ DRAFTED `sales/territory-exclusivity-agreement.md` (2026-08-10) — written as a **business commitment** (the code uses a soft territory model, so the doc is accurate; needs lawyer review + entity name).
- [ ] **3.3 Demo script + 1 recorded real call** — ✅ script drafted `sales/demo-script.md` (2026-08-10). ⏳ Still need: record 1 real AI call to attach.
- [ ] **3.4 Support channel** ✅ PLAN `sales/support-channel.md` (2026-08-10) — WhatsApp +91 7045525531 ready now, response promises defined, email blocked on 1.5 mailbox.

---

## 🟧 PHASE 4 — SOFT LAUNCH (real launch day)

- [ ] **4.1 Onboard 2–3 brokers manually** (no marketing yet)
- [ ] **4.2 Run real leads through 1 broker for 2–4 weeks** — watch every call, WhatsApp, invoice
- [ ] **4.3 Collect feedback, fix breakages, get 1 real testimonial**

---

## 🟪 PHASE 5 — FULL LAUNCH (only after Phase 4 clean)

- [ ] **5.1 Re-verify launch-day checklist** (backend health, backups, payment loop, real WhatsApp number live)
- [ ] **5.2 Turn on outreach** — the personalized mail/WhatsApp/DM playbook (Gupta & Sen etc., frontend link: https://leadbridge-seven.vercel.app)

---

## 🟫 PHASE 6 — AFTER LAUNCH (ongoing, weekly)

- [ ] **6.1 Weekly ops review** — cost per call, margin per broker, failed calls, missed leads
- [ ] **6.2 Uptime alerts** — get paged before brokers notice an outage
- [ ] **6.3 Collect real testimonials** as brokers get results → replace "onboarding" framing
- [ ] **6.4 Scale city-by-city** — new territory + broker each week, never faster than support capacity

---

## ✅ Already done (verified 2026-08-08)

- Razorpay **live** keys + plan IDs + webhook secret configured
- Email via Gmail SMTP tested working
- DeepSeek + OpenRouter keys set
- Google OAuth client ID/secret set
- Phone calls verified end-to-end with real agent (Omnidimension)
- CI fully green (139 unit tests, 8/8 E2E, lint, typecheck, Docker builds)
- Static ngrok domain (never breaks on restart): `casino-bunkbed-bronze.ngrok-free.dev`
- Landing page: How-It-Works scroll-trap fixed + scroll-reveal animations live
