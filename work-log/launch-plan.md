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
- [x] **0.2 Fix CSP** in `frontend/next.config.js` `connect-src` ✅ DONE 2026-08-08 (commit `b82f3ab`)
  - Was: allowed `https://*.ngrok-free.app` but tunnel is `.ngrok-free.dev` → live landing page API calls BLOCKED.
  - Fix: pinned exact static tunnel host `casino-bunkbed-bronze.ngrok-free.dev` for `connect-src` (https + wss).
  - Verified live: backend `/api/v1/public/landing` returns HTTP 200, zero CSP console errors in browser (2026-08-08).
  - ⚠️ When 0.1 is done: replace ngrok entries with the production domain (TODO comment already in next.config.js).
- [ ] **0.3 WhatsApp approval → switch `.env` to real number**
  - Real number **+91 72088 55916** still "In review / Unverified" at Meta. `.env` points at Meta TEST number (phone ID `1174238042447407`).
  - After approval: update `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`.
- [ ] **0.4 SMS provider key** — `MESSAGEBIRD_API_KEY` empty in `server/.env` → SMS campaigns silently fail
- [ ] **0.5 Supabase storage keys** — `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` empty → call recordings fall back to local disk
- [ ] **0.6 DB backups + uptime monitoring**
  - Grafana/Prometheus configs exist in `infrastructure/`. Schedule DB backups + alert before first paying broker.

---

## 🟨 PHASE 1 — Compliance & paperwork (parallel with Phase 0)

- [ ] **1.1 Decide GST path**
  - SaaS = 18% (SAC 9983). Registration mandatory only above ₹20L/yr turnover.
  - Either register now (charge 18% — pricing page already says "18% GST applies") or stay under threshold and remove that line. Ask a CA.
- [ ] **1.2 Confirm Razorpay KYC matches legal entity**
  - Individual: PAN + Aadhaar/address + bank proof. Company: CoI, MoA/AoA, board resolution, director/UBO proofs.
  - Mismatch → payout holds. Live keys already set: `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET/PLAN_*`.
- [ ] **1.3 DPDP Act compliance**
  - No size exemption. We collect phone numbers → Data Fiduciary.
  - Need: privacy notice on registration form, easy consent withdrawal/erasure. `ENCRYPTION_KEY` already set.
- [ ] **1.4 WhatsApp business verification docs**
  - Business name on Meta must match GST/CoI/MSME exactly + website with same legal name + number not on consumer WhatsApp app.
- [ ] **1.5 Fix legal contact emails**
  - ToS/Privacy pages reference `support@leadbridge.com` / `privacy@leadbridge.com` — **verify these inboxes exist or replace with real ones**.

---

## 🟩 PHASE 2 — Trust & money verification

- [ ] **2.1 Audit landing claims**
  - TestimonialsSection is already honest ("onboarding our first brokers") ✓
  - Add "results vary by broker" disclaimers to ComparisonSection ("500+ leads/month", "100% consistent") and ROISection (400 leads/month assumption → label as calculator).
- [ ] **2.2 Verify per-plan margins**
  - `OMNIDIM_COST_PER_MINUTE=4.6`, `PHONE_NUMBER_MONTHLY_COST=200`, `BROKER_CALL_PRICE=70`.
  - Compute: is STARTER (100 calls) profitable per broker after number cost + AI tokens?
- [ ] **2.3 Full payment loop test on production**
  - trial → checkout → Razorpay charge → webhook → invoice → cancel/refund. Do AFTER 0.1.

---

## 🟦 PHASE 3 — Sales & onboarding readiness

- [ ] **3.1 1-page onboarding guide (Hinglish)** — how to add number/forwarding, what happens when a lead arrives
- [ ] **3.2 Territory exclusivity agreement** — city, term, fee ("one broker per city" is the core promise)
- [ ] **3.3 Demo script + 1 recorded real call** (calls already verified working with real agent)
- [ ] **3.4 Support channel** — real WhatsApp/email checked daily + response-time promise

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
