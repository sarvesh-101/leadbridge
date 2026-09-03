# 🗺️ Converza — Master Runbook: Everything Remaining to Go Live

> **Purpose:** ONE ordered guide to take Converza from "code complete" to "a paying broker
> is onboarded." Do the phases in order — each depends on the one before.
> **Owner:** Sarvesh · **Companion docs:** `docs/portal-ingestion-setup.md` (channel details),
> `docs/YOUR-ACTION-CHECKLIST.md` (Razorpay/WhatsApp/uptime), `docs/STEP-BY-STEP-GUIDE.md` (Render setup)
>
> **Last verified:** current code state — see Phase 0. Local HEAD is AHEAD of the GitHub remote;
> ~20 new files (IndiaMART, Facebook, MessageBird, IMAP, lead-ingestion) are **untracked**.
> Nothing ships until Phase 0 is done.

---

## 🔴 PHASE 0 — Save the work (do FIRST, ~10 min)

**Problem:** 101 changed files are uncommitted. ~20 brand-new files (IndiaMART connector, Facebook
connector, SMS/email ingestion, cron lock, tests) are **untracked** — they would be LOST if anything
happened to this machine, and they are NOT on GitHub or Render.

**Who:** Codebuff (with your OK to commit).

- [ ] `git status` — review the change list
- [ ] `git add -A` + commit everything (message like: `feat: real portal ingestion — IndiaMART API, Facebook leadgen, MessageBird SMS, IMAP email forwarding`)
- [ ] `git push origin main`
- [ ] Verify GitHub shows the new commit

**✅ Done when:** `git status` is clean and GitHub `sarvesh-101/leadbridge` shows the latest commit.

---

## 🔴 PHASE 1 — Deploy the current code (~30 min, you + Render)

**Problem:** the Render service (`leadbridge-zy4o.onrender.com`) is running code from an OLD commit —
before the audit fixes and all the new connectors. CI auto-deploy is gated off (`DEPLOY_ENABLED` unset).

- [ ] 1. Go to **https://render.com/dashboard** → your **leadbridge-api** web service
- [ ] 2. **Manual Deploy** → **Deploy latest commit** (or point the service's repo branch at `main` and enable auto-deploy)
- [ ] 3. Watch the build log until it shows **"Live"** (expect ~3–5 min; first deploy after new deps: `imapflow`, `mailparser` installed — if the build fails on deps, come back to me)
- [ ] 4. Open `https://leadbridge-zy4o.onrender.com/health` — expect `{"status":"ok"}` or similar JSON
- [ ] 5. **Verify the commit is live:** Render deploy log shows the commit hash = what GitHub shows after Phase 0

**✅ Done when:** `/health` returns OK **and** the deploy log's commit hash matches GitHub `main`.

---

## 🔴 PHASE 2 — Rotate the 3 leaked secrets (~15 min, you)

**Problem:** git history (commit `c94c8d0`) contains a `server/.env.bak` with your REAL
`JWT_SECRET`, `JWT_REFRESH_SECRET`, and Supabase database password. Anyone with repo access can
read them. (If the repo is public — anyone on the internet.) Also: Render's `ENCRYPTION_KEY` was
auto-generated and does NOT match your local one, so encrypted broker credentials would be garbled.

### 2a. Supabase database password
- [ ] 1. **https://supabase.com/dashboard** → project `oavzflfdjluxvdlymbug`
- [ ] 2. Project Settings → **Database** → **Reset database password** → set a NEW strong password
- [ ] 3. Update BOTH lines (`DATABASE_URL` + `DATABASE_URL_PRISMA`) in `server/.env` on your machine
      → replace old password between `:` and `@`
- [ ] 4. Update the SAME two env vars in Render (Environment tab) → Save → auto-redeploy
- [ ] 5. Restart any local server using the DB

### 2b. JWT secrets
- [ ] 1. Generate two new values:
      ```bash
      openssl rand -hex 32
      openssl rand -hex 32
      ```
- [ ] 2. Set `JWT_SECRET` + `JWT_REFRESH_SECRET` in BOTH `server/.env` and Render
      (kills all existing sessions — fine, no real users yet)
- [ ] 3. ⚠️ The audit earlier hardcoded these in `docs` too — I already redacted the MessageBird key
      from `docs/YOUR-ACTION-CHECKLIST.md` + `docs/STEP-BY-STEP-GUIDE.md`, and the Razorpay key ID from
      `work-log/2026-08-02.md`. Commit those redactions in Phase 0.

### 2c. Encryption key — make Render match local
- [ ] 1. Open `server/.env` → copy the `ENCRYPTION_KEY` value
- [ ] 2. Render → Environment → find `ENCRYPTION_KEY` (currently auto-generated) → **replace** with the
      value from your local `server/.env` → Save
- [ ] 3. After redeploy: any broker credentials already stored encrypted under the OLD key will not
      decrypt — re-enter them (WhatsApp tokens etc.) in the dashboard

**✅ Done when:** Render has the new DB password + JWT secrets + matching ENCRYPTION_KEY, and `/health` is OK.

---

## 🟠 PHASE 3 — Rebrand leftover infra names (~15 min, you)

**Problem:** the deployed names/URLs still say LeadBridge. Cosmetic for customers (they see the domain),
but confusing for you and looks unfinished if a broker notices.

- [ ] 1. Render → **leadbridge-api** service → Settings → rename service to `converza-api`
      (keeps the same URL — safe rename)
- [ ] 2. Vercel → project `leadbridge-seven` → Settings → rename to `converza` (URL changes —
      update `FRONTEND_URL` in Render afterwards if it did)
- [ ] 3. Tell me the final live URLs → I'll update `render.yaml` (`FRONTEND_URL`, `WEBHOOK_URL`),
      the Razorpay plan display names ("LeadBridge Starter…" → "Converza Starter…" in the Razorpay
      dashboard), and anything else referencing the old domain

**✅ Done when:** you can tell me the two live URLs (frontend + API) and they're rebranded.

---

## 🟠 PHASE 4 — Turn on the lead channels (~1–2 hrs, you)

**Problem:** the connectors are built + tested, but each needs ONE dashboard action + env vars.
Details + exact URLs for each: **`docs/portal-ingestion-setup.md`**.

### 4a. SMS forwarding (JustDial / 99acres / MagicBricks / Housing) — Part 2A
- [ ] 1. MessageBird dashboard → buy an **SMS-enabled number** (~₹ cost)
- [ ] 2. Set `FORWARDING_SMS_NUMBER` = that number (E.164) in Render
- [ ] 3. Point the number's incoming callback to:
      `https://<your-api-domain>/api/v1/webhooks/sms/incoming-messagebird`
- [ ] 4. Test: text the number `JustDial Enquiry - Amit Singh, +91-9876543210, 2BHK rental Andheri West`
      → expect a lead + AI call

### 4b. Email forwarding (backup channel for all portals) — Part 3A
- [ ] 1. Pick a mailbox you own (or `forward@converza.tech`)
- [ ] 2. Set in Render: `IMAP_HOST`, `IMAP_PORT` (993), `IMAP_USER`, `IMAP_PASS`, `IMAP_FOLDER` (INBOX)
- [ ] 3. Test: forward a portal enquiry email to that mailbox → expect a lead within ~2 min

### 4c. Facebook Lead Ads — Part 1b (only if clients run FB ads)
- [ ] 1. Create a Meta Business app → note `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`
- [ ] 2. Configure the Page webhook: callback `https://<your-api-domain>/api/v1/webhooks/facebook`,
      verify token → set `FACEBOOK_VERIFY_TOKEN`
- [ ] 3. Subscribe to the `leadgen` field
- [ ] 4. Set the 3 env vars in Render

### 4d. IndiaMART — per-broker (needs a real client)
- [ ] 1. When you have your first broker: their seller account → Lead Manager → CRM Integration →
      Generate Key (**paid add-on** — if blocked, their IndiaMART account manager enables it)
- [ ] 2. Dashboard → Integrations → IndiaMART → Save & Verify → enable Push API with the webhook URL shown

**✅ Done when:** SMS test lead + email test lead both appear in the dashboard and trigger a call.

---

## 🟠 PHASE 5 — Money: KYC + GST decision (~1 hr + waiting)

**Problem:** Razorpay KYC is NOT done → you cannot receive a single rupee. Longest lead time — start NOW.

- [ ] 1. **Razorpay KYC** — full steps in `docs/YOUR-ACTION-CHECKLIST.md` Priority 1:
      dashboard.razorpay.com → Settings → KYC → pick entity (sole proprietor = simplest) →
      submit PAN/Aadhaar/bank proof → verify bank → wait 3–7 business days
- [ ] 2. **GST decision** — call your CA with the question in Priority 2 → tell me the answer →
      I flip the pricing-page GST line + invoice GSTIN (already a flagged code item)
- [ ] 3. Confirm in Render: `RAZORPAY_WEBHOOK_SECRET` is set and the webhook URL
      `https://<your-api-domain>/api/v1/webhooks/razorpay` is registered in the Razorpay dashboard
      (Settings → Webhooks → events: `subscription.charged`, `subscription.cancelled`,
      `payment.failed`, `invoice.paid`)

**✅ Done when:** Razorpay shows KYC "Verified" and payouts enabled.

---

## 🟡 PHASE 6 — WhatsApp business verification (~30 min + waiting)

**Problem:** display name PENDING_REVIEW → low daily message limits → the bot can't handle volume.

- [ ] 1. Full steps in `docs/YOUR-ACTION-CHECKLIST.md` Priority 3
- [ ] 2. Core: business.facebook.com → Business Manager → verify your entity (needs the SAME legal
      name/address you chose for Razorpay KYC) → Security Center → Start Verification
- [ ] 3. Give me your legal entity name + registered address → I add it to the website footer
      (Meta requires the real business name on the site)
- [ ] 4. Wait 2–5 business days → confirm display name approved + limits raised

---

## 🟡 PHASE 7 — Prove it end-to-end (~1 day, both of us)

**Problem:** the full loop (trial → pay → activate → AI call → invoice → cancel) was spec'd, never run.

- [ ] 1. **Payment loop test** — run the spec in `sales/payment-loop-test.md` once KYC is live
      (register → trial → upgrade → pay → verify webhook → invoice → cancel → refund)
- [ ] 2. **Real AI call test** — dashboard → Voice AI → Test Call → verify recording + transcript land
      in the dashboard + Supabase bucket
- [ ] 3. **Record the demo call** (Priority 7) — this is your sales weapon; without it the pitch is words
- [ ] 4. Set up UptimeRobot on `/health` (Priority 5, 5 min)
- [ ] 5. Come back to me with anything that broke → I fix

---

## 🟢 PHASE 8 — Remaining code gaps (Codebuff, ~half a day)

Not blocking launch, but real — I'll fix these while you do Phases 1–7:

| # | Gap | Verified |
|---|---|---|
| 1 | **WhatsApp chatbot: no retry** — `whatsapp.ts:59` `setImmediate(...).catch(...)`: if the AI call fails (rate limit/timeout) the customer's message is silently dropped — no retry, no fallback reply | ✅ confirmed still present |
| 2 | **Campaign worker startup** — `index.ts` comments say campaign worker runs "as a separate Docker container (see docker-compose.yml)", but Render runs ONE process and the worker is imported+closed but the comment says not started → email campaigns may never send; needs an env-gated start (`START_CAMPAIGN_WORKER`) | ✅ confirmed needs decision |
| 3 | **Google Sheets sync UI** — service-account backend exists, but the UI (`sheets-sync/page.tsx`) never collects `clientEmail`/`privateKey` → dead feature; add credentials fields | ✅ confirmed |
| 4 | **`leadbridge_test` DB name** in `server/vitest.config.ts` → rename + create the new test DB | minor |
| 5 | **2 pre-existing failing tests** in `server/src/__tests__/auth-flow.test.ts` (fail on clean HEAD too) — root-cause | minor |
| 6 | Commit redactions done in Phase 0 (MessageBird key, Razorpay key ID) | ✅ done in working tree |

---

## 📅 Suggested order for the next 2 weeks

```
TODAY:        Phase 0 (commit+push)  →  Phase 1 (deploy)  →  Phase 2 (rotate secrets)
THIS WEEK:    Phase 3 (rename)  →  Phase 4 (MessageBird + IMAP)  →  start Phase 5 KYC paperwork
             (KYC + WhatsApp verification are the long-lead items — submit early)
WEEK 2:       Phase 5 approval  →  Phase 6 approval  →  Phase 7 (payment loop + demo call)
             →  first real broker (Phase 4d IndiaMART key)
ANYTIME:      Phase 8 code gaps in parallel with me
```

**Come back after each phase and tell me which number you finished — I'll verify and/or do my part.**
