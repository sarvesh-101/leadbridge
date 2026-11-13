# Razorpay cutover — YOUR steps, in order

**Who this is for:** you, at the dashboards. Every step below is something this machine
cannot do (no Render API key, and Razorpay has no merchant-webhook API).

**Already done, verified live 2026-11-14 — do not redo:**
- New business account KYC + new company bank account: **active**.
- Live keys authenticate (`rzp_live_TzZts…`).
- All six plans created and drift-checked (`--verify` exit 0):

| Tier | Monthly incl. GST | Plan ID | Annual incl. GST | Plan ID |
|---|---|---|---|---|
| Starter | ₹17,699 | `plan_TzZx6AnyZg1COc` | ₹1,76,988 | `plan_TzZx6S5zR1aDI8` |
| Growth | ₹41,299 | `plan_TzZx6i9gxjn14t` | ₹4,12,988 | `plan_TzZx74cmsBPy79` |
| Pro | ₹70,799 | `plan_TzZx7HGbGReXSR` | ₹7,07,988 | `plan_TzZx7U919rjaVt` |

Production is still on the OLD account (`/health/razorpay` → `rzp_live_Ti0DZ`). That is what
steps 2–4 fix.

---

## ⚠️ Read this before step 7 — one documented limit

Razorpay's [Subscriptions Settings](https://razorpay.com/docs/payments/subscriptions/settings/)
page currently states:

> "Cards and UPI currently support recurring payments up to ₹15,000. Charges of higher value
> would automatically fail for domestic cards."

Every Converza tier charges **more** than ₹15,000 incl. GST (₹17,699 / ₹41,299 / ₹70,799). So:

- **UPI AutoPay is fine for proving the mandate** (the ₹5 test in step 7) but is not a usable
  method for a real tier charge.
- **Domestic cards will fail** for a real tier charge.
- **eMandate (NetBanking)** is the documented path for higher recurring amounts — in the
  Razorpay payment sheet, pick NetBanking/eMandate if UPI and card aren't offered or fail.

If the sheet offers no working method for Growth, **that is the cause — not a code bug.** Do
not change plan amounts or code to chase it; record the exact error and raise it with the
Razorpay account manager ("are Cards/UPI/eMandate enabled for my account, and what is my
per-debit recurring ceiling?"). This may become a pricing/packaging decision (quarterly or
annual billing, or raising the tier price into eMandate-only territory) — separate from the
technical cutover.

---

## Step 1 — Enable the subscription payment methods (2 min)

1. Razorpay dashboard (Live mode, not Test) → left menu → **Subscriptions** (under
   *Payment Products*).
2. **Settings**.
3. Enable **Card**, **UPI**, and **eMandate**.
   - This is the check that failed on the old personal account. If any method cannot be
     enabled here, stop — the rest of the cutover cannot pass.

**Done when:** all three toggles read enabled.

---

## Step 2 — Copy the three secrets (1 min)

They are at the bottom of `server/.env` on this machine. Print them **in your own terminal**
so they never appear in chat:

```bash
cd server && node -e "const e=require('dotenv').config().parsed;for(const k of ['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET'])console.log(k+'='+e[k])"
```

You should see `RAZORPAY_KEY_ID=rzp_live_TzZts…`. Keep this terminal open — steps 3 and 4 need
these values.

> The key pair was pasted into chat during the migration, so step 8 rotates it. Don't skip that.

---

## Step 3 — Set Render environment variables (5 min)

Render → **leadbridge-api** → **Environment**. Change **all six together** — a key pair and its
plan IDs belong to one account, and mixing them bills the wrong account or rejects checkout
with `Invalid plan id`.

| Variable | Value |
|---|---|
| `RAZORPAY_KEY_ID` | from step 2 (`rzp_live_TzZts…`) |
| `RAZORPAY_KEY_SECRET` | from step 2 |
| `RAZORPAY_WEBHOOK_SECRET` | from step 2 |
| `RAZORPAY_PLAN_STARTER` | `plan_TzZx6AnyZg1COc` |
| `RAZORPAY_PLAN_GROWTH` | `plan_TzZx6i9gxjn14t` |
| `RAZORPAY_PLAN_PRO` | `plan_TzZx7HGbGReXSR` |

Then **delete `RAZORPAY_PLAN_LAUNCH`** (trash icon on its row). It still holds the old
account's ₹7,999 plan ID, which does not exist on the new account — leaving it means a Launch
checkout fails with `Invalid plan id`. No Launch plan exists by design, and the Billing UI has
no Launch card.

**Done when:** six Razorpay variables (three keys + three plans), no `RAZORPAY_PLAN_LAUNCH`.

---

## Step 4 — Deploy and confirm the new account is live (3 min)

1. Render → **leadbridge-api** → **Manual Deploy** → wait for **Live**.
2. Check the credential actually swapped:

```bash
curl -s https://leadbridge-zy4o.onrender.com/health/razorpay
```

**Expect:** `{"razorpayAuth":{"ok":true,"keyIdPrefix":"rzp_live_TzZts"}}`

Still `rzp_live_Ti0DZ` = the env vars were not saved, or the service did not restart. Fix that
before going further.

> **Ignore one line in the next check.** `curl -s …/health/integrations` will still list
> `RAZORPAY_PLAN_LAUNCH` as missing, because production runs the older T8 build whose health
> check still requires it. That single entry is expected until the `converza-v2` branch
> deploys. Any *other* Razorpay var in that list is a real gap.

---

## Step 5 — Create the webhook (3 min)

1. Razorpay dashboard → **Accounts & Settings** → **Webhooks** (under *Website and app
   settings*) → **+ Add New Webhook**.
2. Fill in:

| Field | Value |
|---|---|
| Webhook URL | `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay` |
| Secret | the `RAZORPAY_WEBHOOK_SECRET` from step 2 — must be **identical** to Render's |
| Alert Email | your email (notifications on webhook failure) |
| Active Events | all seven below |

Events (all seven are handled by the route; omitting `halted`/`completed` leaves a
halted/unpaid client ACTIVE in our DB and still calling):

- `subscription.charged`
- `subscription.cancelled`
- `subscription.pending`
- `subscription.halted`
- `subscription.completed`
- `payment.failed`
- `invoice.paid`

3. **Create Webhook**. It shows as Active.

**Done when:** URL has no trailing slash, exactly seven events, secret matches Render.

---

## Step 6 — Tell me, or run the four checks yourself (2 min)

Paste this in chat and I'll run them: **"cutover deployed, run C1–C4"**.

Or do it yourself from the repo root:

```bash
# 1) new account is live
curl -s https://leadbridge-zy4o.onrender.com/health/razorpay
# expect: "keyIdPrefix":"rzp_live_TzZts"

# 2) nothing genuinely missing (RAZORPAY_PLAN_LAUNCH expected on the T8 build)
curl -s https://leadbridge-zy4o.onrender.com/health/integrations

# 3) a correctly signed webhook is accepted  → expect HTTP 200 + PASS, exit 0
RAZORPAY_WEBHOOK_SECRET=<from step 2> node scripts/send-test-webhook.cjs

# 4) a WRONG signature is rejected           → expect HTTP 401 + PASS, exit 0
RAZORPAY_WEBHOOK_SECRET=<from step 2> node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature
```

Then Render → leadbridge-api → **Logs**, search `Razorpay webhook received` (logs can lag ~30s).
A `200` with no log line means the URL is hitting something else.

> These scripts exit non-zero when the result is wrong, so `PASS` and `EXIT=0` must both
> appear. A `200` on check 4 means signature checking is broken — stop before any real payment.

---

## Step 7 — Prove UPI AutoPay works with ₹5 (5 min, no app data touched)

This is the exact action that failed on the old account, so do it before a real tier charge.

1. Razorpay → **Subscriptions → Plans → + Create Plan**: amount **₹5**, period **monthly**,
   interval 1, INR.
2. Create a subscription against that plan (Subscriptions → + Create Subscription), customer =
   yourself, and pay the authorisation charge via **UPI**.
3. **Pass** = the mandate authorises and the ₹5 is captured. **Fail** with "Payment is not
   allowed for this account" = the payment methods are not actually enabled — go back to
   step 1.

Cancel that ₹5 test subscription afterwards so it never bills again.

---

## Step 8 — The real app loop (10 min)

1. **Fresh incognito window** (old Razorpay checkout state interferes) → log in → **Billing**.
2. **Upgrade Growth (₹41,299/mo)** — it charges immediately, unlike Starter which defers 30
   days and therefore cannot produce a PAID invoice today.
3. In the Razorpay sheet: pay. Per the warning above, use **eMandate/NetBanking** if UPI/card
   are unavailable or fail at this amount.
4. The client must flip to **ACTIVE** within ~30 s (the webhook does that). If it stays
   `PAST_DUE`, check Render logs for a webhook 401 (secret mismatch) before anything else.
5. Verify the money loop:

```bash
node scripts/verify-money-loop.cjs --latest
```

> **This command fails until the V2 migrations are applied** — production's DB is five
> migrations behind and the script reads `Client.prepaidLeads`
> (`The column Client.prepaidLeads does not exist`). That is schema drift, not a broken
> verifier. Until `converza-v2` deploys, verify from the Razorpay dashboard + Render logs:
> `subscription.charged` received, invoice marked PAID, Payment row recorded.
> After the v2 deploy, re-run the script — it should show ACTIVE, a subscription row, a PAID
> invoice with GSTIN + "GS TECHNO", a Payment row with `providerPaymentId`, revenue
> incremented, and a generated PDF.
6. **Cancel + refund:** Billing → Cancel. Expect a pro-rated refund executed via Razorpay and
   the Payment row marked REFUNDED with a `refundId`. A `502` means Razorpay refused and the
   local sub deliberately stays ACTIVE — retry rather than assume success.
7. Erase the test account from the admin panel (DPDP).

---

## Step 9 — Retire the old account (5 min, only after step 8 passes)

1. Old Razorpay account → **Subscriptions** → cancel/expire **every** subscription so nothing
   double-charges later.
2. **Do not delete the old account yet** — it is the rollback path until a second real
   checkout on the new account succeeds.
3. One more real checkout on the new account to confirm stability, then it can stay dormant.

---

## Step 10 — Rotate the key pair (3 min, last)

The current live key pair was pasted into chat during the migration.

1. Razorpay → **Accounts & Settings → API Keys → Regenerate** (Live).
2. Update `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` on Render, and in `server/.env`.
3. Manual Deploy → re-run the step 4 health check. The prefix will change; that's expected.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/health/razorpay` still `Ti0DZ` | env not saved, or no restart | save + Manual Deploy |
| `missingVars` lists STARTER/GROWTH/PRO | that plan ID empty or typo'd | paste from the step-3 table |
| Checkout banner shows `Invalid plan id` | old-account plan ID still set | use the three plan IDs from the step-3 table, nothing else |
| Checkout says "payment required manually" | that tier's plan ID is unset | set it; the tier degrades silently by design |
| Signed webhook 200 but real events 401 | dashboard secret ≠ Render secret | re-paste in both, redeploy |
| Real charge fails, sheet shows no method | the ₹15,000 recurring cap (top of this doc) | use eMandate/NetBanking; confirm enabled methods with Razorpay |
| Client stays `PAST_DUE` after paying | webhook never arrived or 401'd | Render logs, then step 5 secret |
| `verify-money-loop.cjs` says a column doesn't exist | prod DB is behind the branch | expected until `converza-v2` deploys |

---

## Done when all true

- [ ] Card / UPI / eMandate enabled under Subscriptions → Settings.
- [ ] Six Razorpay vars on Render, `RAZORPAY_PLAN_LAUNCH` deleted.
- [ ] `/health/razorpay` → `keyIdPrefix: rzp_live_TzZts`.
- [ ] Webhook active with seven events and the matching secret.
- [ ] Signed webhook 200; bad signature 401.
- [ ] ₹5 UPI AutoPay mandate authorises.
- [ ] Real Growth checkout → client ACTIVE, PAID invoice with GSTIN + GS TECHNO.
- [ ] Cancel + refund executed and recorded.
- [ ] Old account's subscriptions all cancelled (account not deleted).
- [ ] Live key pair rotated and redeployed.
