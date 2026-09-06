# 🚀 Converza — GO-LIVE RUNBOOK (everything remaining, in order)

> **Owner:** Sarvesh · **Start at Step 1, do in order.** Each step depends on the one before.
> Tick the checkboxes as you go. Come back to me after each step — I'll verify and/or do my part.
>
> **Already done ✅:** Phase 0 (code committed + pushed), Phase 1 (deploy live, `/health` green),
> JWT secrets rotated, UptimeRobot keep-alive running.

---

# STEP 1 — Rotate the leaked Supabase password 🔴 (~15 min, you)

**Why:** the old password `Sarvesh_198012` is in git history (commit `c94c8d0`) AND still live in your `.env`. Anyone with repo access can log into your database.

- [ ] 1. Go to **https://supabase.com/dashboard** → click project **oavzflfdjluxvdlymbug**
- [ ] 2. Left menu → **Project Settings** → **Database**
- [ ] 3. Scroll to **Database password** → click **Reset database password**
- [ ] 4. Type a NEW strong password (20+ random chars) → **save it in a notes app now**
- [ ] 5. Wait ~10 seconds for it to apply
- [ ] 6. Open `server/.env` on your machine → find BOTH lines starting `DATABASE_URL=` and `DATABASE_URL_PRISMA=`
- [ ] 7. In BOTH lines, replace only the part between `:` and `@` with the new password
      (keep everything else identical — host, port, `?sslmode=require`)
- [ ] 8. Save the file
- [ ] 9. **Render** → https://render.com/dashboard → click **leadbridge-api** service → **Environment** tab
- [ ] 10. Find `DATABASE_URL` and `DATABASE_URL_PRISMA` → **Edit** each → paste the new values → **Save Changes** (auto-redeploys ~2 min)
- [ ] 11. After redeploy, check **https://leadbridge-zy4o.onrender.com/health** → expect `"database": "healthy"`

**✅ Done when:** I confirm the old password is gone from `.env`, and `/health` is green.

---

# STEP 2 — Make Render's ENCRYPTION_KEY match local 🔴 (~5 min, you)

**Why:** Render auto-generated its own key — different from your local one. Encrypted broker credentials (WhatsApp tokens, integration keys) would be garbled.

- [ ] 1. Open `server/.env` → copy the `ENCRYPTION_KEY` value
- [ ] 2. Render → **leadbridge-api** → **Environment** tab → find `ENCRYPTION_KEY` (says "auto-generated")
- [ ] 3. Click **Edit** → **replace** the auto-generated value with your local one → **Save Changes**
- [ ] 4. After redeploy: any credentials already stored under the old key won't decrypt — re-enter them once in the dashboard (WhatsApp token, etc.) if you see garbled values

**✅ Done when:** Render's `ENCRYPTION_KEY` = your local `server/.env` value.

---

# STEP 3 — Rebrand leftover names 🟠 (~15 min, you → me)

- [ ] 1. Render → **leadbridge-api** service → **Settings** → rename service to **converza-api** (URL stays the same — safe)
- [ ] 2. Vercel → project **leadbridge-seven** → **Settings** → rename to **converza** ⚠️ (URL CHANGES — write down the new one)
- [ ] 3. Hand the new frontend URL to Codebuff → the exact pre-staged edits (render.yaml `FRONTEND_URL`, `frontend/.env.local`, Razorpay plan display names, smoke tests) are ready in **`docs/REBRAND-URL-SWITCH.md`** — apply per that doc (the API URL does NOT change, only the frontend one)

**✅ Done when:** you can tell me both live URLs, rebranded.

---

# STEP 4 — Turn on SMS forwarding (JustDial/99acres/MagicBricks/Housing) 🟠 (~30 min, you)

**Pick ONE provider. MessageBird recommended (you already have the API key).**

### Option A — MessageBird (recommended)
- [ ] 1. **https://dashboard.messagebird.com** → **Numbers** → buy an SMS-enabled number
- [ ] 2. Verify the number (MessageBird sends a code to it)
- [ ] 3. Point inbound SMS at Converza: **Developers → SMS → callback URL** on that number →
      `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/sms/incoming-messagebird` (POST)
- [ ] 4. Render → Environment → add `FORWARDING_SMS_NUMBER` = the MessageBird number in E.164 (e.g. `+919876543210`) → Save
      (`MESSAGEBIRD_API_KEY` is already set)

### Option B — Twilio
- [ ] 1. **console.twilio.com** → Phone Numbers → Buy a number (Indian +91, ~$1/mo) → must have **SMS** capability → must NOT be registered on any WhatsApp account
- [ ] 2. Active Numbers → your number → Messaging → **"A message comes in"** → Webhook →
      `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/sms/incoming` (POST)
- [ ] 3. Render → add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `FORWARDING_SMS_NUMBER` → Save

### Test (either option)
- [ ] From any phone, text the forwarding number:
      `JustDial Enquiry - Amit Singh, +91-9876543210, Interested in 2BHK rental in Andheri West`
- [ ] Expect: a lead appears in the dashboard (source `sms_forward`) + AI call queued
- [ ] Send the SAME text again → second one is deduped (no double call)

**✅ Done when:** a test SMS creates a lead + triggers a call.

---

# STEP 5 — Turn on email forwarding (backup for ALL portals) 🟠 (~10 min, you)

**Use a mailbox you already own. Zero signups.**

- [ ] 1. Pick a mailbox, e.g. a Gmail inbox (enable **2-Step Verification → App passwords** → generate one for "Mail")
- [ ] 2. Render → Environment → add:
      - `IMAP_HOST` = `imap.gmail.com` (or your host)
      - `IMAP_PORT` = `993`
      - `IMAP_USER` = your full email
      - `IMAP_PASS` = the app password
      - `IMAP_FOLDER` = `INBOX`
- [ ] 3. Save → redeploys
- [ ] 4. Test: forward a portal enquiry email to that mailbox → expect a lead within ~2 min (poller runs every 2 min)

**✅ Done when:** a forwarded email creates a lead.

---

# STEP 6 — Facebook Lead Ads (only if clients run FB ads) 🟠 (~30 min, you)

- [ ] 1. **https://developers.facebook.com** → My Apps → Create App → type **Business**
- [ ] 2. Add the **Facebook Login** product → note `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`
- [ ] 3. App → **Webhooks** → **Page**:
      - Callback URL: `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/facebook`
      - Verify token: pick a strong one → this becomes `FACEBOOK_VERIFY_TOKEN`
      - Subscribe to the **`leadgen`** field
- [ ] 4. Render → add `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_VERIFY_TOKEN` → Save
- [ ] 5. (Later, for volume) submit app for review with `leads_retrieval` permission

**✅ Done when:** env vars set + webhook verified (Meta shows a green check).

---

# STEP 7 — Razorpay: KYC + webhook 🔴 (~1 hr + 3-7 days waiting) — START TODAY, longest wait

### 7a. KYC (blocks receiving money)
- [ ] 1. **https://dashboard.razorpay.com** → log in
- [ ] 2. Left sidebar → **Settings** → **KYC**
- [ ] 3. Pick entity type — **Sole proprietor** is simplest:
      - PAN card (personal)
      - Aadhaar card (front + back)
      - Bank account proof (cancel cheque or statement — must match PAN holder)
      - Address proof (Aadhaar works)
- [ ] 4. Submit → Razorpay sends ₹1 to your bank (micro-deposit) → enter the exact amount in the dashboard (1-2 days)
- [ ] 5. Wait 3-7 business days → check **Settings → KYC** for status

### 7b. Webhook (so payments activate subscriptions)
- [ ] 1. Razorpay Dashboard → **Settings** → **Webhooks** → **Add Webhook**
- [ ] 2. URL: `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`
- [ ] 3. Events: `subscription.charged`, `subscription.cancelled`, `payment.failed`, `invoice.paid`
- [ ] 4. Save → copy the **webhook secret** → Render → add `RAZORPAY_WEBHOOK_SECRET` → Save

### 7c. GST decision
- [ ] 1. Call your CA and ask: *"SaaS product, SAC 9983, pricing ₹18K/₹35K/₹60K monthly. Register for GST now or stay under the ₹20L/yr threshold? Sole proprietor or private limited?"*
- [ ] 2. Tell me the answer → I update the pricing page + invoice GSTIN line

**✅ Done when:** KYC = "Verified", payouts enabled, webhook registered.

---

# STEP 8 — WhatsApp business verification 🟡 (~30 min + 2-5 days waiting)

- [ ] 1. **https://business.facebook.com** → Settings → **Business Info**:
      - Legal Business Name = the SAME name you used for Razorpay KYC
      - Address = registered address (matches GST/CoI)
      - Phone + Website = your Converza domain
- [ ] 2. Add the WhatsApp Business Account (+91 72088 55916) to this Business Manager
- [ ] 3. **Security Center** → **Start Verification** → upload business document (GST cert / CoI / MSME)
- [ ] 4. Complete the verification code step (Meta calls or mails the registered contact)
- [ ] 5. Tell me your **legal entity name + registered address** → I add it to the website footer (Meta requires the real business name on the site)
- [ ] 6. Wait 2-5 business days → check **WhatsApp Manager** → display name should change from PENDING_REVIEW → approved, limits raised

**✅ Done when:** WhatsApp display name approved + daily limits adequate.

---

# STEP 9 — MessageBird sender ID (for SMS fallback) 🟡 (~10 min + 24-48 hrs)

- [ ] 1. **https://dashboard.messagebird.com** → **SMS** → **Senders** → **Add Sender**
- [ ] 2. Sender ID: `CONVERZ` → Description: `Converza AI calling platform` → submit
- [ ] 3. Wait 24-48 hours for Indian telecom approval (if rejected, try `CONVRZA` or `CVRZA`)
- [ ] 4. Verify Render has `MESSAGEBIRD_API_KEY` + `SMS_SENDER_ID` = `CONVERZ`

**✅ Done when:** sender ID approved.

---

# STEP 10 — Prove it end-to-end 🟡 (~1 day, both of us) — AFTER KYC clears

- [ ] 1. **Payment loop test** (full spec in `sales/payment-loop-test.md`):
      register test broker → start 30-day trial → upgrade to GROWTH → pay with real UPI/card (refunded later) →
      verify webhook fired (check server logs) → plan shows ACTIVE + invoice PAID →
      cancel subscription → verify CANCELLED → refund in Razorpay → delete test account (Settings → Privacy → Erasure)
- [ ] 2. **Real AI call test:** dashboard → **Voice AI** → **Test Call** → AI calls your phone →
      verify recording + transcript land in dashboard + storage bucket
- [ ] 3. **Record the demo call** — download the recording + transcript → this is your sales weapon
- [ ] 4. Come back to me with anything that broke → I fix

**✅ Done when:** you can show a paying broker the whole loop working live.

---

# STEP 11 — Code gaps (my job, ~half a day — runs in parallel) ✅ DONE 2026-09-04

- [x] WhatsApp chatbot retry (failed AI calls currently drop the message silently) — already fixed by the deep audit (retry after 3s + language-aware fallback reply in `whatsapp-chatbot.service.ts`); verified present
- [x] Campaign worker startup (email campaigns may never send on Render's single process) — fixed by the audit (worker starts in-process via the import); the misleading "DO NOT start it here" comment + log line in `index.ts` corrected to match reality
- [x] Google Sheets sync UI (backend exists, UI never collects credentials) — Sheets page now collects service-account email + private key, saves them to the integration (`provider: "google"` added to the catalog), auto-detects the existing integration, and enables sync; credentials stay in sync on updates
- [x] Test DB rename + 2 pre-existing failing tests — `leadbridge_test` → `converza_test` in `vitest.config.ts`; both auth-flow failures root-caused (fire-and-forget email change reported `emailSent: true` unconditionally) and fixed — the routes now report the real send result within a 1.5s window; suite green: 172 passed / 8 skipped (E2E gated)

---

## 📅 Suggested rhythm

```
TODAY:      Step 1 (DB password) → Step 7a (submit KYC — longest wait!) → Step 2 (ENCRYPTION_KEY)
THIS WEEK:  Step 3 (rebrand) → Step 4 (MessageBird number) → Step 5 (IMAP) →
            Step 8 (WhatsApp verification) → Step 9 (sender ID)
            while I do Step 11 in parallel
WEEK 2:     KYC + WhatsApp approved → Step 10 (payment loop + demo call)
            → first real broker (IndiaMART key in `docs/portal-ingestion-setup.md` Part 1)
```

**Rule of thumb: submit KYC and WhatsApp verification FIRST — they're the only steps with multi-day waits. Everything else is same-day.**

Come back after each step and tell me the number you finished — I'll verify and/or do my part.