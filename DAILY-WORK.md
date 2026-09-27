# 📌 DAILY WORK — Converza (persistent memory file)

> **PURPOSE:** This file is the single source of truth across sessions. When a new session starts,
> READ THIS FILE FIRST — terminal memory dies when the terminal closes, this file doesn't.
> **RULE:** After every work session, update the "Completed" and "Remaining" sections. Keep it honest.
> **Owner:** Sarvesh · **Agent:** Codebuff/Freebuff · **Last updated:** 2026-09-28

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
| Redis (queues) | Upstash — free tier quota is a known risk |
| Competitor to beat | **Vyora AI** (vyora.ai) — ₹799/₹3,449 plans, CSV-upload flow, 8 languages |
| Our positioning | *"Vyora calls the leads you upload. Converza calls the leads you haven't seen yet."* |

**Key docs:** `docs/GO-LIVE-RUNBOOK.md` (master checklist) · `work-log/launch-plan.md` · `sales/payment-loop-test.md` · `outreach/demo-hitlist.md`

---

## ✅ COMPLETED (reverse-chronological)

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

### P0 — now
- [ ] **Fix Redis (P0!)** — Render env `REDIS_URL` missing-or-Upstash-quota-exhausted. Free tier 500K cmds/mo; if exhausted → upgrade (~$10/mo). Then `/health` must show `redis: healthy`, `status: ok`. *Owner: Sarvesh*
- [ ] **Forward Omnidim's reply** (140 vs 1600 series + voicemail access) → Codebuff finishes DND/DLT campaign wiring based on it. *Owner: Sarvesh → Codebuff*
- [ ] **Confirm transfer actually rang the phone** in the 2026-09-28 test call (AI disclosure heard ✅?). *Owner: Sarvesh*

### P1 — this week (money loop)
- [ ] **Payment loop test** — `sales/payment-loop-test.md`: trial → GROWTH upgrade → real pay → webhook → invoice PDF shows GSTIN + GS TECHNO → cancel → refund → erase test account. *Owner: Sarvesh (Codebuff on-call)*
- [ ] **MessageBird SMS number** (runbook Step 4): buy number → callback to `/api/v1/webhooks/sms/incoming-messagebird` → `FORWARDING_SMS_NUMBER` env → test lead. *Owner: Sarvesh*
- [ ] **IMAP email forwarding** (Step 5): Gmail app-password mailbox → IMAP_* envs → test lead. *Owner: Sarvesh*
- [ ] **Rebrand renames** (Step 3): rename Render service + Vercel project → give new frontend URL to Codebuff → Codebuff applies staged URL switch (`docs/REBRAND-URL-SWITCH.md`). *Owner: Sarvesh → Codebuff*
- [ ] **DB backups**: create `db-backups` Supabase bucket + wire `scripts/backup-db.sh` cron (launch-plan 0.6). *Owner: Sarvesh + Codebuff*

### P2 — next week (sales weapons)
- [ ] **Record demo call** → side-by-side asset vs Vyora (download recording + transcript). *Owner: Sarvesh*
- [ ] **Entry-tier pricing decision** — draft ₹2,499 credits-style plan w/ margin math to counter Vyora ₹799 (Codebuff drafts on request). *Owner: Sarvesh decides*
- [ ] **TRAI compliance guide page** — Codebuff builds after Omnidim reply (must be accurate, beat Vyora's generic page). *Owner: Codebuff*
- [ ] **WhatsApp leftovers**: display name + daily limits in WhatsApp Manager; SIM-side registration of +91 72088 55916. *Owner: Sarvesh*

### P3 — soft launch (the real launch)
- [ ] **Onboard 2–3 brokers** from `outreach/demo-hitlist.md` — watch every call/WhatsApp/invoice 2–4 weeks. *Owner: Sarvesh*
- [ ] **1 real testimonial** → replace "onboarding" framing on landing.
- [ ] **Lawyer review** of `sales/territory-exclusivity-agreement.md`.

### Backlog / known risks
- DLT registration + DND scrubbing for PROMOTIONAL campaigns (needs Omnidim RTM/DLT answer) — **the one open TRAI item**
- Upstash free-tier quota = recurring outage risk (P0 above)
- Gmail SMTP for invoices → move to proper transactional email (Loops/SES researched, not wired)
- PRO plan margin: re-tune `PRO_MONTHLY_CALL_CAP` after real call-duration data (Phase 4.2)

---

## 🧭 CONVENTIONS FOR EVERY NEW SESSION
1. Read this file first. Don't re-derive state from scratch.
2. Update Completed/Remaining at session end — including "user tasks done today".
3. Commit + push doc updates so the file survives everywhere.
4. Never put secrets in this file (env values, tokens, passwords). Facts + URLs only.
