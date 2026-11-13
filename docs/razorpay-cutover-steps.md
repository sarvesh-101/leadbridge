# Razorpay cutover — YOUR steps, one by one

Everything here is a **dashboard action by you**. Nothing in this doc can be done from the
dev machine: there is no Render API key in this repo, and Razorpay has no API for creating
merchant webhooks.

Work top to bottom. Part A moves production to the new account, Part B proves money actually
moves, Part C closes the old account out. Total ~35 minutes, but **do not start Part B in the
same sitting as Part A** unless you have an hour — a failed payment needs a clear head.

---

## Step 0 — Do I have to create the plans in the Razorpay dashboard?

**No. Do not create any plan by hand.** All six plans (3 monthly + 3 annual) already exist on
the new account. Verified live against Razorpay on **2026-11-14**, read-only:

```bash
cd server && npx tsx --env-file=.env scripts/sync-razorpay-plans.ts --verify
```

```
✓ STARTER/monthly → plan_TzZx6AnyZg1COc (₹17699, monthly)
✓ STARTER/annual  → plan_TzZx6S5zR1aDI8 (₹176988, yearly)
✓ GROWTH/monthly  → plan_TzZx6i9gxjn14t (₹41299, monthly)
✓ GROWTH/annual   → plan_TzZx74cmsBPy79 (₹412988, yearly)
✓ PRO/monthly     → plan_TzZx7HGbGReXSR (₹70799, monthly)
✓ PRO/annual      → plan_TzZx7U919rjaVt (₹707988, yearly)

All plan amounts verified ✓      (exit 0)
```

These are the plans checkout will use. Your only job is to **copy the three monthly IDs into
Render** (step 3). You will *see* them in the dashboard under **Subscriptions → Plans** — that
is for confidence only, no action.

| Tier | Charged (incl. 18% GST) | Monthly plan ID | Annual plan ID |
|---|---|---|---|
| Starter | ₹17,699 | `plan_TzZx6AnyZg1COc` | `plan_TzZx6S5zR1aDI8` |
| Growth | ₹41,299 | `plan_TzZx6i9gxjn14t` | `plan_TzZx74cmsBPy79` |
| Pro | ₹70,799 | `plan_TzZx7HGbGReXSR` | `plan_TzZx7U919rjaVt` |

### Why hand-creating a plan breaks things

- **Amounts must be GST-inclusive and exact.** ₹14,999 ex-GST is charged as **₹17,699**
  (`server/src/config/plans.ts` → `monthlyCharged()`). A dashboard plan typed as ₹14,999
  under-bills every customer and makes invoice totals (total ÷ 1.18) come out wrong.
- **The verifier matches on plan `notes`, not on the ID.** `--verify` looks for
  `notes.planTier` / `notes.billingCycle` / `item.amount`. A hand-made plan has no notes, so it
  is reported **missing** even though it exists — and you would end up with duplicates.
- **Checkout reads the ID from Render env.** A new dashboard plan is dead weight until its ID
  is pasted into `RAZORPAY_PLAN_*`, which is exactly the manual step this script removes.

### The only case where you create a plan yourself

If `--verify` ever prints `✗ missing/mismatched: TIER/cycle`, do **not** use the dashboard.
Run the sync tool, which creates it with the correct amount **and** the notes the verifier needs:

```bash
cd server && npx tsx --env-file=.env scripts/sync-razorpay-plans.ts --live
```

It prints the new IDs and rewrites `server/razorpay.plan-map.json`. Then paste the printed
`RAZORPAY_PLAN_*` lines into Render and redeploy. `--live` is a human gate: it creates real,
billable objects, so only run it when you mean to.

**Separate, unrelated plan:** the ₹5 plan in step 7 is a throwaway for one UPI mandate test.
Create that one in the dashboard — it is not part of the product pricing.

---

## ⚠️ One documented limit — read before Part B

Razorpay's [Subscriptions Settings](https://razorpay.com/docs/payments/subscriptions/settings/)
page states:

> "Cards and UPI currently support recurring payments up to ₹15,000. Charges of higher value
> would automatically fail for domestic cards."

Every tier charges **more** than ₹15,000 (₹17,699 / ₹41,299 / ₹70,799), so:

- **UPI AutoPay only proves the mandate** (₹5, step 7). It is not a usable method for a real
  tier charge.
- **Domestic cards will fail** on a real tier charge.
- **eMandate / NetBanking** is the documented route for higher recurring amounts.

If the payment sheet offers no method that works for Growth, **that is the cause — not a code
bug.** Do not change amounts or code to chase it. Record the exact error and ask your Razorpay
account manager two questions: *"Are Cards, UPI and eMandate enabled on my account?"* and
*"What is my per-debit recurring ceiling?"* This may turn into a packaging decision (quarterly
or annual billing) — separate from the technical cutover.

---

# Part A — Move production to the new account

## Step 1 — Enable the subscription payment methods

**Where:** Razorpay dashboard → top-left mode selector shows **Live** (not Test) → left sidebar
→ **Subscriptions** (under *Payment Products*) → **Settings** tab.

**Do this:** switch on **Card**, **UPI**, and **eMandate**. If a method shows an "Enable" or
"Activate" button, click it and complete any prompt.

**Done when:** all three read enabled/active.

**If it doesn't:** if any method cannot be enabled, **stop here** — this is precisely what was
broken on the old personal account, and no later step can pass without it. Escalate to Razorpay
support with your MID before continuing.

---

## Step 2 — Get the three secrets into your clipboard

**Where:** this machine, a terminal in `server/`.

**Do this:** print them in *your* terminal (never in chat), then copy one at a time:

```bash
cd server && node -e "const e=require('dotenv').config().parsed;for(const k of ['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET'])console.log(k+'='+e[k])"
```

Copy-to-clipboard variant (nothing printed to screen):

```bash
cd server && node -e "process.stdout.write(require('dotenv').config().parsed.RAZORPAY_KEY_ID)" | clip
```

**You should see:** `RAZORPAY_KEY_ID=rzp_live_TzZt…` (23 chars), a 24-char key secret, and a
48-char hex webhook secret.

**Done when:** you have all three values and can paste them.

**Note:** the webhook secret is **not issued by Razorpay** — it is a string you choose, and the
one in `server/.env` is already the one Render uses. Nothing to regenerate. Keep this terminal
open; steps 3, 5 and 6 need these values.

**Note:** this key pair was pasted into chat during the migration, so step 10 rotates it. Do not
skip step 10.

---

## Step 3 — Change six variables on Render, in one save

**Where:** <https://dashboard.render.com> → **leadbridge-api** (Web Service, Node, rootDir
`server`) → **Environment** in the left menu.

**Do this:** edit these six, then click **Save Changes** once. A key pair and its plan IDs belong
to one account — a mixed set bills the wrong account or rejects checkout with `Invalid plan id`.

| Variable | Value |
|---|---|
| `RAZORPAY_KEY_ID` | from step 2 (`rzp_live_TzZt…`) |
| `RAZORPAY_KEY_SECRET` | from step 2 |
| `RAZORPAY_WEBHOOK_SECRET` | from step 2 (already correct — re-paste to be sure) |
| `RAZORPAY_PLAN_STARTER` | `plan_TzZx6AnyZg1COc` |
| `RAZORPAY_PLAN_GROWTH` | `plan_TzZx6i9gxjn14t` |
| `RAZORPAY_PLAN_PRO` | `plan_TzZx7HGbGReXSR` |

Then **delete `RAZORPAY_PLAN_LAUNCH`** — click the trash icon on its row. It still holds the old
account's ₹7,999 plan ID, which does not exist on the new account; left in place, a legacy Launch
checkout fails with `Invalid plan id`. There is no Launch card in the Billing UI any more.

**Done when:** exactly six `RAZORPAY_*` rows remain (3 keys + 3 plans), no `RAZORPAY_PLAN_LAUNCH`,
and the save succeeded.

**Saving does not restart the service** — step 4 is the deploy.

---

## Step 4 — Deploy, then confirm the account actually swapped

**Where:** Render → **leadbridge-api** → **Manual Deploy** → **Deploy latest commit** (or
**Clear build cache & deploy** if you want a clean build). Wait for status **Live**.

**Do this:** run the health check from any terminal:

```bash
curl -s https://leadbridge-zy4o.onrender.com/health/razorpay
```

**You should see:**

```json
{"razorpayAuth":{"ok":true,"keyIdPrefix":"rzp_live_TzZts"}}
```

**Done when:** `keyIdPrefix` is `rzp_live_TzZts`.

**If you still see `rzp_live_Ti0DZ`:** the env vars were not saved, or the service did not
restart. Render → **Events** tab shows whether a deploy actually ran; fix that before going on.

> **Ignore one line in the next check.** `curl -s https://leadbridge-zy4o.onrender.com/health/integrations`
> will still list `RAZORPAY_PLAN_LAUNCH` as missing: production runs the older T8 build, whose
> health check still requires it. That single entry is expected until the `converza-v2` branch
> deploys. Any *other* Razorpay variable in that list is a real gap — fix it in step 3.

---

## Step 5 — Create the webhook

**Where:** Razorpay dashboard → **Accounts & Settings** → **Webhooks** (under *Website and app
settings*) → **+ Add New Webhook**.

> Note: this is **not** under a plain "Settings → Webhooks" menu item, and not inside the
> Subscriptions product — the Subscriptions settings page (step 1) is a different screen.

**Do this:** fill the form exactly:

| Field | Value |
|---|---|
| Webhook URL | `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay` |
| Secret | the 48-char `RAZORPAY_WEBHOOK_SECRET` from step 2 — **byte-identical** to Render's |
| Alert Email | your email (you get notified when deliveries fail) |
| Active Events | the seven below, nothing else |

Tick exactly these seven. The dashboard groups them by product, so they are not in one list:
`subscription.*` is under **Subscriptions**, `payment.failed` under **Payments**, `invoice.paid`
under **Invoices**. Omitting `halted`/`completed` leaves a halted or finished client ACTIVE in our
database and still being called and billed for.

- `subscription.charged`
- `subscription.cancelled`
- `subscription.pending`
- `subscription.halted`
- `subscription.completed`
- `payment.failed`
- `invoice.paid`

### What each event type actually does in this repo

Handler: `server/src/routes/webhooks/razorpay.ts`. Every delivery is HMAC-SHA256 verified against
`RAZORPAY_WEBHOOK_SECRET`; a wrong signature gets **401** and changes nothing.

| Event | Razorpay fires it when… | Our handler… | What the broker sees |
|---|---|---|---|
| `subscription.charged` | a subscription charge succeeds — the first payment **and every renewal** (~every 30 days) | sets `planStatus = ACTIVE`; marks the latest **SENT** invoice PAID (renewals have none left, so it creates that cycle's invoice) and kicks off the GST PDF; records a `Payment` row + increments `totalRevenueGenerated` (idempotent on `providerPaymentId`); resets the call allowance — skipped on the **first** charge so trial usage is not rolled over | plan active, that month's GST invoice, fresh call quota |
| `subscription.cancelled` | the subscription is cancelled for good — by you in the dashboard, by the broker in Billing → Cancel, or because the mandate was revoked | sets `planStatus = CANCELLED`. No refund happens here — the cancel route issues that separately | marked cancelled; the paid plan is treated as ended |
| `subscription.pending` | a charge could not be completed and Razorpay is waiting on the customer — **also** fires while a brand-new mandate is still awaiting authorisation | sets `planStatus = PAST_DUE`, **except** for clients in `TRIAL` (a trial signup waiting on its mandate must not be demoted) | usually nothing yet; a real payment problem surfaces through dunning |
| `subscription.halted` | Razorpay gave up after repeated failed renewal retries, or the mandate was revoked | sets `planStatus = PAST_DUE` **and** `dunningStartedAt = now`; the daily dunning cron then reminds on day 1/3/7 and deactivates on day 7 | reminder emails; access cut at day 7 if still unpaid |
| `subscription.completed` | the subscription reached its final period/charge count — nothing will ever be charged again | sets `planStatus = CANCELLED` | marked cancelled; no further invoices |
| `payment.failed` | **any** single payment attempt failed (Razorpay may still retry it) | log-only: warns with the order id and `error_description`. Changes no state on purpose — one failed retry must not demote a paying client | nothing immediate; repeated failures become `pending`/`halted` |
| `invoice.paid` | a Razorpay invoice (one-off or subscription) is paid | marks the invoice PAID + GST PDF, and records `Payment` + revenue when the payload carries the payment entity; duplicate-safe against `subscription.charged` for the same money (unique `providerPaymentId` + per-cycle invoice index) | invoice shows PAID, sometimes alongside `subscription.charged` for the same charge |

### Two "cancelled" events — tick only one

The dashboard lists `subscription.cancelled` **and** `payment_link.cancelled` (Payment Links has its
own four: `payment_link.paid` / `partially_paid` / `cancelled` / `expired`). They are unrelated:

- **`subscription.cancelled`** — our plans. This is the one to tick.
- **`payment_link.cancelled`** — fires when a *Razorpay* Payment Link is cancelled. This repo never
  creates Razorpay Payment Link objects: `/dashboard/payment-links` builds its own `…/pay/<code>`
  URL and stores it in the `PaymentLink` table, so this event can never fire for us. Leave it off.

Same rule for the other lookalikes — `subscription.paused` / `resumed` / `updated` /
`authenticated` / `activated`, `invoice.expired`, `payment.captured`, `refund.*`. None are handled:
the route answers **200** and logs the event type, so an extra one is harmless but pure noise. Keep
the list at exactly seven so the "done when" below stays checkable.

Click **Create Webhook**.

**Done when:** the webhook shows as **Active**, the URL has **no trailing slash**, exactly seven
events are ticked, and the secret matches Render's.

**If it doesn't:** a wrong or trailing-slash URL still "succeeds" in the dashboard and every real
event 404s. That failure only shows up in Razorpay → Webhooks → the webhook → **Logs**.

---

## Step 6 — Prove the webhook verifies (2 minutes)

**Where:** repo root, any terminal.

**Do this:** paste this message in chat — **"cutover deployed, run C1–C4"** — and I run all four.
Or run them yourself:

```bash
# C1 — new account is live
curl -s https://leadbridge-zy4o.onrender.com/health/razorpay
#   expect "keyIdPrefix":"rzp_live_TzZts"

# C2 — nothing genuinely missing (RAZORPAY_PLAN_LAUNCH is expected on the T8 build)
curl -s https://leadbridge-zy4o.onrender.com/health/integrations

# C3 — correctly signed webhook is accepted → expect HTTP 200 + PASS + exit 0
RAZORPAY_WEBHOOK_SECRET=<from step 2> node scripts/send-test-webhook.cjs

# C4 — wrong signature is rejected → expect HTTP 401 + PASS + exit 0
RAZORPAY_WEBHOOK_SECRET=<from step 2> node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature
```

**You should see:** `PASS` **and** `EXIT=0` on both C3 and C4. The scripts exit non-zero when the
result is wrong, so a printed `200` with a non-zero exit is a fail, not a pass.

**Done when:** C1 shows the new prefix, C2 lists no Razorpay gap other than `RAZORPAY_PLAN_LAUNCH`,
C3 is 200/exit 0, C4 is 401/exit 0.

**Also check the server side:** Render → **leadbridge-api** → **Logs**, search
`Razorpay webhook received`. Logs can lag ~30 s. A 200 from C3 with no log line means the request
is hitting something other than this service.

**If C4 returns 200:** signature verification is not running — stop, do not take a real payment,
and tell me.

---

# Part B — Prove money actually moves

## Step 7 — ₹5 UPI AutoPay mandate test

Purpose: this is the exact action that failed on the old account. It costs ₹5 and touches no app
data.

**Where:** Razorpay dashboard → **Subscriptions** → **Plans** → **+ Create Plan**.

**Do this:**

1. Create a plan: amount **₹5**, period **monthly**, interval **1**, currency **INR**. Name it
   something obvious like `UPI mandate test — delete me`.
2. **Subscriptions** → **+ Create Subscription** → pick that plan → customer = yourself →
   create it and open the payment link / short URL it produces.
3. Pay the authorisation charge with **UPI**.
4. Afterwards, cancel that test subscription so it never bills again.

**Done when:** the mandate authorises and the ₹5 is captured (subscription moves to `active`,
payment shows `captured`).

**If it fails** with *"Payment is not allowed for this account"*: payment methods were not really
enabled — go back to step 1. If it fails with a mandate/amount error, note the code and skip to
step 8's eMandate path; the old account failed here too.

---

## Step 8 — The real app loop (Growth)

Why Growth and not Starter: Starter defers the first charge 30 days by design, so it cannot
produce a PAID invoice today. Growth charges immediately.

**Where:** <https://leadbridge-seven.vercel.app> in a **fresh incognito window** (old Razorpay
checkout state in a normal window causes confusing failures).

**Do this:**

1. Log in → **Billing**.
2. Click **Upgrade** on **Growth — ₹41,299/mo**.
3. In the Razorpay sheet, pay using **eMandate / NetBanking** (see the cap warning above). If UPI
   or card is offered, expect it to fail at this amount.
4. Watch the Billing page and Render logs. The client should flip to **ACTIVE** within ~30 s, and
   the log should show `subscription.charged` handled.
5. Cancel + refund: **Billing → Cancel**. A pro-rated refund is executed through Razorpay and the
   Payment row is marked REFUNDED with a `refundId`.
6. Erase the test account from the admin panel (DPDP hygiene).

**Optional automated check — currently expected to fail:**

```bash
node scripts/verify-money-loop.cjs --latest
```

> This errors with `The column Client.prepaidLeads does not exist in the current database`.
> Production's database is **five migrations behind** `converza-v2`, so this is schema drift, not
> a broken verifier. Until the v2 branch deploys, verify from the Razorpay dashboard + Render logs
> instead: `subscription.charged` received, invoice **PAID**, a Payment row with
> `providerPaymentId`, revenue incremented. Re-run the script after the v2 deploy — it should then
> print ACTIVE, the subscription row, a PAID invoice carrying GSTIN + "GS TECHNO", the Payment
> row, and a generated PDF.

**Done when:** client ACTIVE, PAID invoice with GSTIN + "GS TECHNO", refund recorded, test account
erased.

**If the client stays `PAST_DUE` after a successful payment:** the webhook never arrived or
returned 401. Check Render logs first, then re-check the step-5 secret.

**If the cancel returns `502`:** Razorpay refused the refund and the local subscription
deliberately stays ACTIVE. Retry — do not assume the cancellation succeeded.

---

# Part C — Close out

## Step 9 — Retire the old account (only after step 8 passes)

**Where:** the OLD Razorpay account → **Subscriptions**.

**Do this:**

1. Cancel or expire **every** subscription there, so nothing double-charges a customer later.
2. **Do not delete the old account yet.** It is the rollback path until a second real checkout on
   the new account succeeds.
3. After that second checkout, it can stay dormant; delete it only once you are confident.

**Done when:** the old account's subscription list is empty of live/active entries.

---

## Step 10 — Rotate the live key pair (last)

The current live key pair was pasted into chat during the migration, so treat it as public.

**Where:** Razorpay → **Accounts & Settings** → **API Keys** → **Regenerate** (Live mode).

**Do this:**

1. Regenerate and copy both values immediately (the secret is shown once).
2. Update `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` on Render (step 3 screen) **and** in
   `server/.env` on this machine.
3. Render → **Manual Deploy**.
4. Re-run the step 4 health check.

**Done when:** `/health/razorpay` is `ok:true` with a **new** `keyIdPrefix` (the prefix changing
is expected and correct), and one small real charge still succeeds.

**Note:** the webhook secret is independent of the API key pair — regenerating keys does not
require touching the webhook.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/health/razorpay` still `Ti0DZ` | env not saved, or no restart | save on Render, then Manual Deploy (step 4) |
| `missingVars` lists STARTER/GROWTH/PRO | that plan ID empty or mistyped | paste from the step-3 table |
| Checkout banner `Invalid plan id` | an old-account plan ID is still set | use only the three monthly IDs from step 0/3 |
| Checkout says "payment required manually" | that tier's plan ID is unset | set it — the tier degrades silently by design |
| C3 passes but real events 401 | dashboard secret ≠ Render secret | re-paste in both places, redeploy, retry |
| C4 returns 200 | signature verification not active | stop; report it before taking money |
| Real charge fails, sheet shows no method | the ₹15,000 recurring cap | use eMandate/NetBanking; confirm enabled methods with Razorpay |
| Client stays `PAST_DUE` after paying | webhook never arrived or 401'd | Render logs → step 5 secret |
| `verify-money-loop.cjs` says a column doesn't exist | prod DB behind the branch | expected until `converza-v2` deploys |
| `--verify` reports a plan missing | plan deleted, or a hand-made plan without notes | re-run sync with `--live`, then update Render |

---

## Done when all true

**Part A — cutover**
- [ ] Card / UPI / eMandate enabled under Subscriptions → Settings.
- [ ] Six `RAZORPAY_*` vars on Render, `RAZORPAY_PLAN_LAUNCH` deleted.
- [ ] `/health/razorpay` → `keyIdPrefix: rzp_live_TzZts`.
- [ ] Webhook Active, seven events, no trailing slash, secret matches Render.
- [x] C1 new prefix, C3 200 + exit 0, C4 401 + exit 0. *(re-run 2026-11-14 after the dashboard webhook was created: 200 / exit 0, 401 / exit 0)*

**Part B — money**
- [x] ₹5 UPI AutoPay mandate authorises. *(2026-11-14 — payment captured. Cancel the throwaway test subscription + delete the ₹5 plan: step 7.4.)*
- [ ] Real Growth checkout → client ACTIVE, PAID invoice with GSTIN + GS TECHNO.
- [ ] Cancel + pro-rated refund executed and recorded.

**Part C — close-out**
- [ ] Old account's subscriptions all cancelled (account not deleted).
- [ ] Live key pair rotated, redeployed, `ok:true` with a new prefix.
- [ ] Six plans still verify: `cd server && npx tsx --env-file=.env scripts/sync-razorpay-plans.ts --verify`.
