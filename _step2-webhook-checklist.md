# Step 2 — Wire the Razorpay webhook

**Prerequisite:** Step 1 green (Launch + Starter checkout sheets open). ✅ Confirmed.

---

## 2a — Confirm / set the webhook secret in Render

The webhook **only verifies** if the secret you put in the Razorpay dashboard **matches** `RAZORPAY_WEBHOOK_SECRET` in Render's environment. If they differ, every webhook returns `401 Invalid signature` and nothing happens.

### Check what Render currently has

1. Go to **https://dashboard.render.com** → `leadbridge-api` → **Environment**.
2. Look for `RAZORPAY_WEBHOOK_SECRET`.
   - **If it's already there** with value `8e994f4cb5677d2097ea3dfe66c29b3c47d2637c5d66025f` → skip to 2b.
   - **If it's missing or a different value** → set it now:
     - Key: `RAZORPAY_WEBHOOK_SECRET`
     - Value: `8e994f4cb5677d2097ea3dfe66c29b3c47d2637c5d66025f`
     - Save.
   - **If you want a fresh secret** (recommended if you're unsure what's there):
     - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` anywhere
     - Set that value in Render env as `RAZORPAY_WEBHOOK_SECRET`
     - **Also update your local `.env`** so local tests match (currently line 37 is `8e994f4cb5677d2097ea3dfe66c29b3c47d2637c5d66025f`)
     - Hit **Manual Deploy** (or wait for auto-deploy) so the new secret takes effect.

> **Don't proceed to 2b until the Render secret is set.** Without it, the dashboard can create the webhook but every event will 401.

---

## 2b — Create the webhook in the Razorpay dashboard

1. Open **https://dashboard.razorpay.com** (Live mode, not Test).
2. **Settings** (top-right gear icon) → **Webhooks** → **Add Webhook**.
3. Fill in:
   - **URL:** `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`
   - **Events** — select these five (all):
     - `subscription.charged`
     - `subscription.cancelled`
     - `subscription.pending`
     - `payment.failed`
     - `invoice.paid`
   - **Secret** — paste the same value that's in Render env as `RAZORPAY_WEBHOOK_SECRET` (default: `8e994f4cb5677d2097ea3dfe66c29b3c47d2637c5d66025f`, unless you generated a fresh one in 2a).
4. Click **Create Webhook**.

> The dashboard shows the webhook as "Active" once created. Don't test yet — create it first, then test in 2c.

---

## 2c — Test the webhook by sending a signed event yourself

> **Corrected 2026-10-28:** the Razorpay dashboard has **no "Send Test Webhook" button**. Per
> https://razorpay.com/docs/webhooks/validate-test, test events only fire from a real transaction in
> **Test mode**, or via **Replay events** (Settings → Webhooks → Replay events) — which needs past events
> to exist, and we have none yet. So we verify with our own correctly-signed payload instead.

`scripts/send-test-webhook.cjs` sends a compact JSON `subscription.charged` signed with HMAC-SHA256
over the exact raw body — the same thing Razorpay does. All ids are fake (`sub_FAKE_VERIFY_*`), so the
handler's `updateMany` matches zero rows and **no database state changes**.

1. Copy `RAZORPAY_WEBHOOK_SECRET` from Render → leadbridge-api → Environment.
2. From the repo root:
   ```
   RAZORPAY_WEBHOOK_SECRET=<paste> node scripts/send-test-webhook.cjs
   ```
   Expect `HTTP 200`. A `401` means the secret doesn't match Render's value (or Render is running code
   without it) — fix 2a first.
3. Prove verification is actually enforced (not just that the route responds):
   ```
   RAZORPAY_WEBHOOK_SECRET=<paste> node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature
   ```
   Expect `HTTP 401`. If this returns 200, signature checking is broken — stop and escalate.
4. Render → leadbridge-api → Logs, search `Razorpay webhook received`. Expect:
   ```
   info  { eventType: 'subscription.charged' }  Razorpay webhook received
   info  { razorpaySubId: 'sub_FAKE_VERIFY_0000000000' }  Subscription charged — client activated
   info  { eventType: 'subscription.cancelled' }  Razorpay webhook received
   ```
   Logs can lag ~30s. No log line + a 200 → the URL is hitting something else; confirm it is exactly
   `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay` (`https://`, no trailing slash).

> This proves the endpoint, the secret, and the handler. It does **not** prove that Razorpay's own
> dashboard config is paired correctly — only a genuine delivery can. That happens in the ₹5 money-loop
> test (Step 3): the real charge fires real `subscription.charged` / `invoice.paid` events. Watch Render
> logs during it and treat any 401 there as a dashboard-secret mismatch.

**Known code caveat:** the handler re-serializes the parsed body (`JSON.stringify(request.body)`) before
computing the HMAC rather than hashing raw bytes. That matches for Razorpay's compact JSON, but if a real
delivery ever 401s with a confirmed-matching secret, this is the cause — fix it by capturing the raw body
in the `application/json` content-type parser in `server/src/index.ts`.

---

## 2d — Confirm the route handles all 5 events

The route at `src/routes/webhooks/razorpay.ts` handles:

| Event | What it does |
|---|---|
| `subscription.charged` | Activates client (`planStatus = ACTIVE`), marks latest SENT invoice PAID, generates GST invoice PDF, records Payment + revenue, resets call cycle (not on first charge). |
| `subscription.cancelled` | Sets `planStatus = CANCELLED`. |
| `subscription.pending` | Sets `planStatus = PAST_DUE` (only if not TRIAL — protects trial signups). |
| `subscription.halted` | Sets `planStatus = PAST_DUE`, starts dunning (`dunningStartedAt`). |
| `subscription.completed` | Sets `planStatus = CANCELLED` (sub ran out). |
| `payment.failed` | Logs warning with error description. |
| `invoice.paid` | Marks invoice PAID, records Payment + revenue (when payment entity present). |

All seven are wired. The five you selected in 2b cover the full money loop.

---

## Done when

- [ ] `RAZORPAY_WEBHOOK_SECRET` is set in Render env and matches the dashboard webhook secret.
- [ ] Webhook created in Razorpay dashboard with all 5 events, URL = `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`.
- [ ] `node scripts/send-test-webhook.cjs` → `HTTP 200` + log line `Razorpay webhook received { eventType: 'subscription.charged' }`.
- [ ] `--bad-signature` variant → `HTTP 401` (proves signature enforcement is on).
- [ ] Real proof deferred to Step 3: during the ₹5 charge, real `subscription.charged` + `invoice.paid` arrive and the client flips ACTIVE.

When Step 2 is done, tell me and I'll move to Step 3 (₹5 money-loop test) — or if you want to stop after Step 2, that's fine too.
