# 📥 Portal Lead Ingestion — Setup Guide (Real Product)

> **Purpose:** Make the core promise true — a broker with JustDial, IndiaMART, 99acres,
> MagicBricks, Housing.com accounts gets every enquiry **AI-called automatically**.
>
> **Code is done.** This doc covers the dashboard/account actions needed to turn it on.

---

## The model (why this works)

| Portal | How leads reach Converza | Status |
|---|---|---|
| **IndiaMART** | Official IndiaMART Leads API — real-time push + 5-min pull fallback | ✅ Code built — needs per-broker credentials |
| **Facebook Lead Ads** | Official Meta `leadgen` webhook + Graph API | ✅ Code built — needs a Meta app + broker page connection |
| **JustDial** | Broker forwards enquiry SMS/email → Converza parses → AI call | ✅ Code built — needs Twilio + inbound email |
| **99acres / MagicBricks / Housing.com** | Same as JustDial (forward SMS/email) | ✅ Code built — same setup |
| **Any other portal (Sulekha, TradeIndia, NoBroker…)** | SMS/email forwarding (parser auto-detects the portal) | ✅ Covered by the same forwarding engine |
| **Zapier / website forms** | HTTP POST to the broker's webhook source | ✅ Works today — create a source in Settings |

---

## 🔴 Part 1 — IndiaMART (real API connector)

**Built:** `POST /api/v1/webhooks/indiamart/:clientId` (Push API receiver) + 5-min Pull API poller + connect/test/sync in the Integrations page.

### Broker steps (what the broker does — or you do for them)
1. Log in to **seller.indiamart.com**
2. Go to **Lead Manager → (⋮ three-dot menu) → CRM Integration → Generate Key**
   - Direct link: `https://seller.indiamart.com/leadmanager/crmapi`
3. The **CRM key** is emailed to their registered email
4. In your dashboard → **Integrations → IndiaMART → Connect**:
   - Enter the **10-digit registered mobile number**
   - Paste the **CRM key**
   - Click **Save & Verify** — the platform tests the key against the Pull API immediately

### Enable real-time push (recommended)
After connecting, the Integrations page shows the broker's **Push API webhook URL**
(`https://<your-domain>/api/v1/webhooks/indiamart/<client-id>`). Then:

1. Broker goes to IndiaMART → **Lead Manager → Import/Export Leads → Push API**
2. Select **"Other"** as the CRM platform
3. Enter platform name `Converza` + the webhook URL from the Integrations page
4. Confirm the **OTP** sent to their mobile — done. Leads now arrive in real-time.

> ⚠️ **Paid add-on:** the IndiaMART Leads API is a **paid IndiaMART service**
> ("LMS Leads API"). If the CRM key page doesn't work for a broker, their IndiaMART
> account manager must enable API access. Until then, IndiaMART enquiries can still
> be ingested via SMS/email forwarding (Part 2) — no broker waits on hold.

---

## 🟦 Part 1b — Facebook Lead Ads (real Meta connector)

**Built:** `GET/POST /api/v1/webhooks/facebook` (leadgen webhook) + Graph API lead
fetch + connect/test UI (OAuth or manual Page Access Token).

### Your setup (one time, ~30 min)
1. **Create a Meta app** at [developers.facebook.com](https://developers.facebook.com) →
   My Apps → Create App → type **Business**.
2. Add the **Facebook Login** product and note `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.
3. **Configure the Page webhook** (App → Webhooks → Page):
   - Callback URL: `https://<your-domain>/api/v1/webhooks/facebook`
   - Verify token: pick a strong one → set as `FACEBOOK_VERIFY_TOKEN` env var
   - Subscribe to the **`leadgen`** field
4. Set env vars: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_VERIFY_TOKEN`.
5. For production lead volume, submit the app for review with the
   `leads_retrieval` permission (until then, small-scale/manual tokens work).

### Broker steps
1. Integrations → **Facebook Lead Ads → Connect**
2. Either click **Connect with Facebook** (authorize their Page) or paste a
   long-lived **Page Access Token** (Graph API Explorer → Page → Get Page Access
   Token with `leads_retrieval`).
3. Done — every lead form submission is AI-called automatically.

---

## 🟡 Part 2 — SMS forwarding (JustDial, 99acres, MagicBricks, Housing)

**Built:** `POST /api/v1/webhooks/sms/incoming` (Twilio) **and**
`POST /api/v1/webhooks/sms/incoming-messagebird` (MessageBird) — shared regex +
LLM fallback parsing, dedup, AI call queue. Both fail closed (403) until
credentials are configured.

**Two provider options — pick ONE:**

### Option A — MessageBird (recommended: you already have the API key)
1. **Buy an SMS-enabled number** in the [MessageBird dashboard](https://dashboard.messagebird.com) → Numbers (requires an approved sender/verification for the number).
2. **Point MessageBird at Converza:**
   - Developers → SMS → callback URL **or** Flow Builder → "Call HTTP endpoint" flow on the number
   - URL: `https://<your-domain>/api/v1/webhooks/sms/incoming-messagebird` (POST)
3. **Env vars:** `MESSAGEBIRD_API_KEY` (already set) + `FORWARDING_SMS_NUMBER` (the MessageBird number in E.164).
4. Signatures are verified automatically (`X-MessageBird-Signature`).

### Option B — Twilio
1. **Buy a Twilio number** with SMS capability (Indian +91 number, ~$1/month):
   - [console.twilio.com](https://console.twilio.com) → Phone Numbers → Buy a number → check **SMS**
   - ⚠️ The number must NOT be registered on any WhatsApp account
2. **Point Twilio at Converza:** Active Numbers → your number → Messaging → **"A message comes in"** → Webhook → `https://<your-domain>/api/v1/webhooks/sms/incoming` (POST)
3. **Env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `FORWARDING_SMS_NUMBER`.

### Broker steps (either option)
Open the portal enquiry SMS → **Forward** it to the Converza number → done, AI calls the lead.

> The forwarding page has step-by-step Android/iPhone instructions + example portal
> SMS formats. Brokers can also use an auto-forward app (e.g. SMS Forwarder) to make
> it hands-free.

---

## 🟡 Part 3 — Email forwarding (backup channel for all portals)

**Built:** `POST /api/v1/webhooks/email/incoming` (SendGrid/Mailgun/CloudMailin)
**and** an IMAP poller (`cron/email-imap.cron.ts`, every 2 min) that runs the same
pipeline on any mailbox. regex + LLM parsing, dedup, AI call queue.

**Two options — pick ONE:**

### Option A — IMAP (recommended: use a mailbox you already own, zero signups)
1. Pick a mailbox (e.g. `forward@converza.tech`, or a Gmail inbox with an **app password**).
2. **Env vars:** `IMAP_HOST` (e.g. `imap.gmail.com`), `IMAP_PORT` (993), `IMAP_USER`, `IMAP_PASS`, `IMAP_FOLDER` (INBOX).
3. Done — the poller reads UNSEEN mail every 2 minutes and AI-calls every parsed lead.

### Option B — Inbound-email webhook service
Configure one to POST parsed emails to `https://<your-domain>/api/v1/webhooks/email/incoming`:

| Service | How |
|---|---|
| **CloudMailin** (simplest) | Add `forward@converza.tech` as an address → set target URL to the webhook above |
| **SendGrid Inbound Parse** | Create an Inbound Parse webhook on a subdomain → POST to the webhook above |
| **Mailgun Routes** | Create a route on your domain → forward to the webhook above |

> The broker's forwarding email must match their account email (the platform matches
> broker by sender email). `FORWARDING_EMAIL` env var is already `forward@converza.tech`.

---

## ✅ What works right now vs. what needs the above

| Channel | Works today? | Needs |
|---|---|---|
| Custom webhook (`/webhooks/ingest/:token`) | ✅ Yes | Nothing — create a source in Settings |
| WhatsApp incoming | ✅ Yes | Nothing |
| IndiaMART (API) | ✅ Code live | Per-broker CRM key (Part 1) |
| IndiaMART (email forward fallback) | ⚠️ | Part 3 |
| SMS forwarding (JustDial/99acres/etc.) | ⚠️ Code live — needs MessageBird number or Twilio | Part 2 |
| Email forwarding (JustDial/99acres/etc.) | ⚠️ Code live — needs IMAP mailbox creds or inbound service | Part 3 |

---

## 🧪 Testing checklist (after setup)

1. **IndiaMART:** Integrations → IndiaMART → Save & Verify → expect "credentials verified";
   send a test push from IndiaMART's Push API test screen → expect a lead + AI call within 60s.
2. **SMS:** From a test phone, text the forwarding number with:
   `JustDial Enquiry - Amit Singh, +91-9876543210, Interested in 2BHK rental in Andheri West`
   → expect lead created (source `sms_forward`) + AI call queued.
3. **SMS (MessageBird):** same, via the MessageBird number → `/webhooks/sms/incoming-messagebird`.
4. **Email:** forward a portal enquiry email to the IMAP mailbox / forwarding address → expect lead created.
5. **Duplicate check:** Send the same SMS/email twice → second is deduped.

## 📎 Useful links

- IndiaMART API docs: https://help.indiamart.com/knowledge-base/im-lms-leads-api/
- MessageBird dashboard: https://dashboard.messagebird.com
- Twilio console: https://console.twilio.com
- CloudMailin: https://www.cloudmailin.com