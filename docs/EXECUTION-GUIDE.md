# 🎯 EXECUTION GUIDE — Every Remaining Task, Step by Step

> **Created:** 2026-09-22 · After P0 (Razorpay webhook + GST) completed.
> **How to use:** Do tasks in this order. After each task, check the "✅ Done when" box.
> Come back to Codebuff after each task — verification help is part of the deal.
>
> **Legend:** 🧑 = you do it · 🤖 = Codebuff does it · 🔗 = needs the other first

---

## 📅 THE ORDER (one line per day)

```
TODAY:      Task 1 (deploy check, 5 min) → Task 2 (AI call test, 15 min) → start Task 3 (payment loop, 2 hrs)
TOMORROW:   Task 4 (SMS, 30 min) → Task 5 (IMAP, 10 min) → Task 6 (rebrand renames, 15 min)
DAY 3:      Task 7 (footer — needs your address) → Task 8 (WhatsApp leftovers) → Task 9 (backup bucket)
DAY 4-5:    Task 10 (Facebook, 30 min) → Task 11 (record demo call) → Task 12 (send Gupta & Sen!)
WEEK 2:     Task 13 (fill hitlist) → Task 14 (onboard first trial broker)
ANYTIME:    🤖 Task A (repo cleanup) — say the word and it's done
```

---

# PHASE P3 — PROVE IT WORKS 🟡

## Task 1 — Verify Render runs the latest code 🧑 (5 min)

**Why:** everything below is tested against the live API. If Render is stale, tests lie to you.

1. Open **https://dashboard.render.com** → click service **leadbridge-api**
2. Top-right → **Manual Deploy** → **Deploy latest commit**
3. Watch the build log until it says **Live** (~3-5 min)
4. In the log header, note the **commit hash** (7 characters, e.g. `7887f26`)
5. Open **https://github.com/sarvesh-101/leadbridge/commits/main** — the top commit hash must MATCH

Also verify health:
```bash
curl https://leadbridge-zy4o.onrender.com/health
```
Expect `"status"` healthy/ok in the JSON.

**✅ Done when:** deploy log hash = GitHub top commit AND `/health` is green.

---

## Task 2 — Real AI call test 🧑 (15 min)

**Why:** proves the CORE product loop — AI calls a phone, transcript + recording come back.

1. Log into your dashboard (**https://leadbridge-seven.vercel.app** → login)
2. Left sidebar → **Voice AI** (or Calls → Test Call)
3. Enter **your own mobile number** → click **Test Call**
4. Answer the phone! Have a natural conversation:
   - "Hi, main Andheri West mein 2BHK rent ke liye dekh raha hoon"
   - Budget puchiye, timeline puchiye, site visit offer kare
5. Hang up after 1-2 minutes

Verify (all 4):
- [ ] Dashboard → **Calls** → the call appears within ~2 min
- [ ] Status is not stuck on CALLING (should become COMPLETED/qualified)
- [ ] **Transcript** is visible on the call detail
- [ ] **Recording** plays (stored in Supabase `call-recordings` bucket)

**✅ Done when:** recording plays + transcript is accurate + lead score got computed.

**❌ If something breaks:** note which step failed (no call? no webhook? no transcript?) → tell Codebuff exactly that. Each failure maps to a specific worker (call.worker / extraction.worker / storage.service).

---

## Task 3 — Payment loop test 🧑🤖 (2 hrs) — THE BIG ONE

**Why:** money must work before ANY outreach. Spec: `sales/payment-loop-test.md` (read it first, this is the short version).

**Before you start:**
- [ ] Task 1 done (Render on latest code)
- [ ] Razorpay webhook registered (✅ done 2026-09-22) — `RAZORPAY_WEBHOOK_SECRET` set in Render

### Steps:

**Step 1 — Test account (10 min)**
1. Open the live site in an incognito window
2. **Register** a new broker account — use a real phone number you own + `+91` test email like `sarvesh+test1@gmail.com` (Gmail alias trick: `yourname+test1@gmail.com` reaches your inbox)
3. Select **30-day free trial** on the plan picker

**Step 2 — Trial sanity check (5 min)**
- [ ] Dashboard shows plan = TRIAL, trial end date = today + 30 days
- [ ] Add 1 test lead → AI call fires (reuse Task 2 flow)

**Step 3 — Upgrade to GROWTH (15 min)**
1. Dashboard → **Billing** → choose **GROWTH ₹35,000** → **Upgrade**
2. Razorpay checkout opens → pay with real UPI/card (~₹35,000 — refund comes later)

**Step 4 — Verify webhook did its job (10 min)**
Check these IN ORDER:
- [ ] Dashboard plan now shows **GROWTH / ACTIVE** (refresh after ~30s — webhook does the activation)
- [ ] **Invoices** page → new invoice, status **PAID**, GST breakup correct (18% = CGST 9% + SGST 9%)
- [ ] ⚠️ **The invoice PDF must NOT say "GST: Not applicable"** — Codebuff fixed this 2026-09-22; if Render wasn't redeployed after the fix you'll see the old line → redeploy first
- [ ] Billing history shows the payment
- [ ] Razorpay dashboard → **Payments** → the ₹35K payment shows **Captured**

**Step 5 — Server logs (Codebuff can do this)**
- Render → leadbridge-api → **Logs** tab → search `webhook` → expect `subscription.charged` / `payment.captured` received + signature verified lines

**Step 6 — Cancel (5 min)**
1. Billing → **Cancel subscription** → confirm
- [ ] Plan shows CANCELLED (or "active until period end" — whichever the code implements)

**Step 7 — Refund (5 min)**
1. Razorpay dashboard → Payments → the ₹35K payment → **Refund** (full amount)

**Step 8 — Cleanup (5 min)**
1. Log into the test account → **Settings → Privacy & Data → Request data erasure** (dogfoods your own DPDP flow!)
2. Admin panel → mark erasure processed

**✅ Done when:** all checkboxes ticked, refund received, zero red errors in server logs.

**❌ Failure triage map:**
| Symptom | Likely cause |
|---|---|
| Payment taken, plan not activated | Webhook secret mismatch OR webhook URL wrong → check Render logs for signature failure |
| Invoice not generated | `invoice.service.ts` / SMTP issue → check logs for "Invoice PDF generation failed" |
| Plan activated but invoice PAID missing | Webhook event list missing `invoice.paid` in Razorpay dashboard |

---

## Task 4 — Record the demo call 🧑 (30 min) — do same session as Task 2

**Why:** your entire outreach depends on ONE real recorded call. The hitlist calls it the "hero moment."

1. Do Task 2 again, but this time:
   - **Screen-record** your dashboard while the call comes in (Win + G on Windows, or phone screen record for the audio)
   - Have the most natural Hinglish conversation you can — as if a real buyer
2. After the call: **Calls** → download the recording (MP3) + transcript
3. Save as: `sales/demo-call-recording.mp3` + `sales/demo-call-transcript.txt` (or just keep on your phone — don't need to commit to repo)
4. Listen to it once. If the voice sounds robotic or the qualification is dumb → tell Codebuff, we'll tune the Omnidimension agent script.

**✅ Done when:** you have 1 file you'd proudly WhatsApp to a broker.

---

# PHASE P1 — LEAD CHANNELS 🟠

## Task 5 — SMS forwarding (JustDial/99acres/MagicBricks/Housing) 🧑 (30 min)

**Provider: MessageBird (you already have the API key + `CONVERZ` sender approved).**

1. **https://dashboard.messagebird.com** → **Numbers** (left sidebar) → **Buy a number**
   - Country: India, type: **SMS-capable (long number/virtual mobile)** — ~₹ few hundred/month
2. Verify the number (MessageBird sends an OTP code to it)
3. Configure the callback: with the number selected → **Developers → SMS** (or Number settings → webhook) → set the **inbound SMS callback URL**:
   ```
   https://leadbridge-zy4o.onrender.com/api/v1/webhooks/sms/incoming-messagebird
   ```
   Method: POST
4. Render → leadbridge-api → **Environment** → add:
   ```
   FORWARDING_SMS_NUMBER = +919XXXXXXXXX   (the number you just bought, E.164 format)
   ```
   → **Save** (auto-redeploys)
5. **TEST (2 min):** from your personal phone, SMS the new number:
   ```
   JustDial Enquiry - Amit Singh, +91-9876543210, Interested in 2BHK rental in Andheri West
   ```
6. Check:
   - [ ] Dashboard → **Leads** → new lead, source = `sms_forward`, name "Amit Singh"
   - [ ] AI call gets queued to the number in the message
7. **Dedup test:** send the EXACT same SMS again
   - [ ] Second one is deduped (no second lead/call)

**✅ Done when:** test SMS → lead + AI call, duplicate → deduped.

**❌ No lead appears?** Render logs → search `sms` — either the callback URL 404s (typo) or the parser rejected the format (tell Codebuff the exact message text you sent).

---

## Task 6 — Email forwarding (IMAP) 🧑 (10 min)

**Why:** backup channel for ALL portals. Use any mailbox you own.

1. Pick a mailbox — simplest is Gmail:
   - myaccount.google.com → **Security** → enable **2-Step Verification**
   - Then → **App passwords** → create one named "Converza" → copy the 16-char password
2. Render → **Environment** → add:
   ```
   IMAP_HOST   = imap.gmail.com
   IMAP_PORT   = 993
   IMAP_USER   = yourmail@gmail.com
   IMAP_PASS   = <the 16-char app password>
   IMAP_FOLDER = INBOX
   ```
   → **Save** (redeploys; the IMAP poller runs every 2 min)
3. **TEST:** forward (or send) a portal-style enquiry email to that mailbox:
   ```
   Subject: 99acres Enquiry
   Body: Name: Priya Sharma, Phone: 9876543210, Looking for 3BHK in Powai, budget 2Cr
   ```
4. Wait ~2-3 min → Dashboard → Leads
   - [ ] New lead "Priya Sharma", source = email

**✅ Done when:** forwarded email → lead within ~2-3 min.

**❌ Nothing arrives?** Render logs → search `imap`. Gmail rejects app passwords if 2FA isn't on — that's the #1 cause.

---

## Task 7 — Facebook Lead Ads 🧑 (30 min) — only if target brokers run FB ads

1. **https://developers.facebook.com** → My Apps → **Create App** → type **Business** → name it "Converza Lead Ingestion"
2. In the app dashboard → **Add Product** → **Facebook Login** (just to unlock settings)
3. Note from **Settings → Basic**: `App ID` (= `FACEBOOK_APP_ID`) and `App Secret` (= `FACEBOOK_APP_SECRET`)
4. **Webhooks** (left sidebar) → dropdown → select **Page** → **Subscribe to this object**:
   - Callback URL: `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/facebook`
   - Verify token: make up a strong random string — this IS `FACEBOOK_VERIFY_TOKEN`
   - Meta pings the URL — the server must answer the challenge (Render must be on latest code)
5. Still in Webhooks → Page → **Subscribe to the `leadgen` field**
6. Render → Environment → add all 3 vars → Save
7. Meta shows a **green check** on the webhook = verified

**✅ Done when:** webhook shows Verified in Meta + 3 env vars in Render. (Full lead test needs a real FB lead form — can wait for first client.)

---

## Task 8 — IndiaMART key 🧑+broker — ⛔ BLOCKED on first client

Needs a real broker's IndiaMART seller account (paid add-on). Skip until Task 14 brings your first broker. Then: their Lead Manager → CRM Integration → Generate Key → your dashboard → Integrations → IndiaMART → Save & Verify.

---

# PHASE P2 — TRUST & BRAND 🟠

## Task 9 — Rebrand renames 🧑 (15 min)

1. Render → **leadbridge-api** → **Settings** → Name → change to `converza-api` → Save
   - URL does NOT change (`leadbridge-zy4o.onrender.com` stays) — webhooks keep working
2. Vercel → **https://vercel.com/dashboard** → project **leadbridge-seven** → **Settings → General → Project Name** → change to `converza` → Save
   - ⚠️ **URL CHANGES** → new URL will be `converza.vercel.app` (or `converza-<random>.vercel.app` if taken) — **COPY THE NEW URL**
3. Update CORS/FRONTEND_URL: Render → Environment → `FRONTEND_URL` = the NEW Vercel URL → Save
4. **Give the new URL to Codebuff** → Codebuff runs the full sweep (Task 10 below)
5. Vercel → redeploy frontend so `NEXT_PUBLIC_APP_URL` picks up the new domain

**✅ Done when:** you can hand over the new frontend URL.

---

## Task 10 — Rebrand URL sweep 🤖 (30 min) — 🔗 needs Task 9's new URL

Codebuff does this — the exact edits are pre-staged in `docs/REBRAND-URL-SWITCH.md`:
- `render.yaml` `FRONTEND_URL`
- `frontend/.env.local` `NEXT_PUBLIC_APP_URL`
- ~30 links across `outreach/*.md`, `sales/*.md`, docs
- Final grep sweep: `grep -rn "leadbridge-seven"` = 0 results (docs-only exceptions allowed)

**✅ Done when:** sweep grep is clean and you confirm the new URL loads.

---

## Task 11 — Website footer: legal entity 🧑→🤖 (10 min)

**Meta REQUIRES the real legal name on the site for WhatsApp display-name approval.**

1. You send Codebuff: **GS TECHNO's registered address** (the one used in Meta Business Manager / GST registration — all three must match)
2. Codebuff adds to the landing footer (`frontend/src/app/page.tsx`):
   ```
   © 2026 GS TECHNO (Converza). All rights reserved.
   <registered address>
   ```
   (same block on `/legal/terms` + `/legal/privacy` footers)

**✅ Done when:** footer shows GS TECHNO + address on all 3 pages.

---

## Task 12 — WhatsApp leftovers 🧑 (15 min)

1. **Display name:** business.facebook.com → WhatsApp Manager → your number (+91 72088 55916) → check display name status
   - If still `PENDING_REVIEW` → it should clear once Task 11 (footer) is live + business verified (it is). Give it 1-2 days after the footer goes up.
2. **Daily limits:** same screen → check the messaging limit tier (should be 1K/day+ after verification; if it shows 250/day, wait 24h after display-name approval and recheck)
3. **SIM-side registration (was in cooldown):** put the +91 72088 55916 SIM in a phone → install WhatsApp → register
   - ⚠️ If it shows "temporarily unavailable" → the cooldown is still active. **Do NOT retry more than once a day** — retries EXTEND the cooldown. Wait 24-48h.
   - This matters: brokers will reply to this number; the WhatsApp app on the SIM is what receives their replies.

**✅ Done when:** display name approved, limits ≥1K/day, WhatsApp app registered on the SIM.

---

## Task 13 — DB backup bucket 🧑 (15 min)

Full detail: `docs/DB-BACKUP-SETUP.md` — short version:

1. **https://supabase.com/dashboard** → your project → **Storage** → **New bucket** → name: `db-backups` → **Private** (NOT public like recordings)
2. Supabase → **Settings → API** → copy the `service_role` key
3. Render → Environment → add (per `docs/DB-BACKUP-SETUP.md` exact var names):
   ```
   BACKUP_S3_ENDPOINT / BACKUP_BUCKET / BACKUP_ACCESS_KEY / BACKUP_SECRET_KEY  (per the doc)
   ```
4. Trigger one backup manually to test (per the doc's script/runbook)
   - [ ] A `.sql.gz` file appears in the `db-backups` bucket
5. Confirm the scheduled cron is enabled (the schedulers were committed 2026-09-14)

**✅ Done when:** one manual backup lands in the bucket + schedule is on.

---

# PHASE P4 — GO TO MARKET 🟢

## Task 14 — Send Gupta & Sen outreach 🧑 (30 min) — THE FIRST PITCH

Everything is pre-written. Today is the day.

1. Open **`outreach/gupta-and-sen-outreach.md`**
2. Send in this order (multi-channel playbook says never just one channel):
   - [ ] 10:00-11:30 am: **Email** owner + each agent (separate personalized mails — templates are in the file)
   - [ ] 12:00 noon: **Instagram DM** to the firm page
   - [ ] 6-8 pm: **WhatsApp** each agent's personal number
3. Tomorrow: **call** the owner — "kal mail bheji thi, dekhi?"
4. Update the tracker row in `outreach/demo-hitlist.md` (row 1: mark channels sent)

**✅ Done when:** all 3 channels sent + tracker updated.

**Note:** use the NEW Vercel URL in the mails (Task 9/10 must be done first — the mails currently carry `leadbridge-seven.vercel.app`).

---

## Task 15 — Fill the 20-broker hitlist 🧑 (2 hrs)

Follow `outreach/demo-hitlist.md` — the search strings are already written per slot:
1. JustDial / 99acres / Housing / MagicBricks agent directories + Instagram hashtags + Google Maps (strings are per slot in the doc)
2. Target: 5-50 agent mid-size firms (NOT giants like ANAROK/JLL, NOT solo agents)
3. Fill owner name/email/number + agent details + Instagram handle per the capture format in the doc
4. Paste the filled list to Codebuff → personalized outreach messages get written for each (Gupta & Sen format)

**✅ Done when:** all 20 rows have contacts.

---

## Task 16 — Onboard first trial broker 🧑 (Week 2, ongoing)

1. From demo conversations, offer: **"Trial mein aapka apna number chalega, 2-3 real leads pe test karo"** (the 2x conversion line)
2. Trial signup (30-day, LAUNCH/STARTER config)
3. **Day 1 checklist with them:**
   - [ ] Call forwarding set up (their portal numbers forward to the platform)
   - [ ] 2-3 REAL leads run through on day 1
   - [ ] Show them the first AI call recording in the dashboard
4. **Days 1-3:** check in daily — screenshot their first qualified lead to their WhatsApp
5. This also unlocks Task 8 (IndiaMART key)

**✅ Done when:** 1 broker is on a live trial with real leads flowing.

---

# PHASE P5 — CLEANUP 🧹

## Task A — Repo junk removal 🤖 (5 min) — say "go" and it happens
- Delete from repo root: `postgres_installer.exe`, `temppostgres-installer.exe`, `temppostgres-setup.exe`, `postgres.zip`, `temppostgres-setup.exe`
- Add `*.exe` / `*.zip` to `.gitignore`

## Task B — WABA ID fix 🧑 (2 min)
1. Meta Business Manager → WhatsApp accounts → copy the **WABA ID for +91 72088 55916** (the one on the "LeadConverter" app, NOT the old test `1008711545369398`)
2. Render → Environment → `WHATSAPP_BUSINESS_ACCOUNT_ID` = new ID → Save

---

# 📊 MASTER PROGRESS TRACKER

| # | Task | Phase | Time | Status |
|---|------|-------|------|--------|
| 1 | Verify Render on latest code | P3 | 5 min | ⬜ |
| 2 | Real AI call test | P3 | 15 min | ⬜ |
| 3 | Payment loop test | P3 | 2 hrs | ⬜ ← highest priority |
| 4 | Record demo call | P3 | 30 min | ⬜ |
| 5 | SMS forwarding | P1 | 30 min | ⬜ |
| 6 | IMAP email forwarding | P1 | 10 min | ⬜ |
| 7 | Facebook Lead Ads | P1 | 30 min | ⬜ |
| 8 | IndiaMART | P1 | — | ⛔ needs first client |
| 9 | Rebrand renames | P2 | 15 min | ⬜ |
| 10 | Rebrand URL sweep | P2 | 30 min | ⬜ 🔗 needs 9 |
| 11 | Footer = GS TECHNO + address | P2 | 10 min | ⬜ 🧑 needs your address |
| 12 | WhatsApp leftovers | P2 | 15 min | ⬜ |
| 13 | DB backup bucket | P2 | 15 min | ⬜ |
| 14 | Send Gupta & Sen | P4 | 30 min | ⬜ 🔗 needs 9/10 |
| 15 | Fill 20-broker hitlist | P4 | 2 hrs | ⬜ |
| 16 | Onboard first trial broker | P4 | ongoing | ⬜ 🔗 needs 3/4 |
| A | Repo junk cleanup | P5 | 5 min | ⬜ 🤖 |
| B | WABA ID fix | P5 | 2 min | ⬜ |

**Rule: after each task, tick the box + tell Codebuff the task number. Codebuff verifies / fixes breakage / does the 🤖 tasks.**
