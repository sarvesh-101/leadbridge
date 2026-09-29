# 💰 Entry-Tier Pricing — Countering Vyora ₹799

> **Status:** DRAFT — Sarvesh decides. Nothing in code changes until approved.
> **Prepared:** 2026-09-29 · **Sources:** `server/src/services/subscription.service.ts` (PLAN_DEFINITIONS),
> `server/src/config.ts` (OMNIDIM_COST_PER_MINUTE ₹4.6, BROKER_CALL_PRICE ₹70), Vyora public plans (compare page).

---

## 1. The problem

Vyora's ₹799/mo plan is the first price a broker googling "AI calling India" sees.
Our cheapest listed plan is **₹7,999 (Launch)** — 10× higher. Even though Launch was
deliberately designed as a stepping stone (worst per-call rate in the ladder), a ₹7,999
headline next to Vyora's ₹799 loses the click before the demo.

**Constraint:** we should NOT make Launch cheaper per call than Growth — the ladder
logic (`docs/plan-margins.md`) depends on per-call rate improving as plans go up.

## 2. Current ladder (real, from code)

| Plan | Monthly | Calls incl. | Leads/mo | Users | ₹/call |
|---|---|---|---|---|---|
| Launch | ₹7,999 | 50 | 200 | 2 | ₹160 |
| Starter | ₹18,000 | 100 | 500 | 5 | ₹180 |
| Growth | ₹35,000 | 500 | 3,000 | 15 | ₹70 |
| Pro | ₹60,000 | ~2,000 cap | 50,000 | 50 | ₹30 |

*(Starter ₹180/call > Launch ₹160/call is a known quirk — see backlog note in plan-margins.)*

## 3. Cost model (per AI call)

| Item | Value | Source |
|---|---|---|
| Omnidim voice AI | ₹4.6/min | `OMNIDIM_COST_PER_MINUTE` (their Growth-tier rate) |
| Avg call duration | 2.5 min (range 1.5–4) | assumption — lead-qualification calls; margin shown at both ends |
| **COGS per call** | **₹11.50** (2.5 min) / **₹18.40** (4 min) | 4.6 × duration |
| Fixed infra (Render + Vercel + Supabase + Aiven) | ≈ ₹2,000/mo total | negligible per-client at scale |
| Razorpay fee | 2% | standard IN domestic |

## 4. Option A (RECOMMENDED): ₹2,499 credits wallet — separate track

Wallet model, **not** a subscription ladder rung — so it never breaks Launch's
"stepping stone" logic:

- Broker tops up **₹2,499** → wallet credits, calls deducted at **₹160/call** (same rate as Launch)
- ≈ **15 AI calls** per top-up · credits valid 90 days (creates re-purchase rhythm)
- Same ingestion pipeline, same compliance gate, 1 agent, 1 user — a "test-drive for the business, not the toy"
- No auto-renewal — buy again when out (low commitment, low support burden)

**Margin math (per ₹2,499 top-up):**

| Scenario | COGS (15 calls) | Razorpay | Total cost | **Gross margin** |
|---|---|---|---|---|
| 2.5-min calls | ₹173 | ₹50 | ₹223 | **₹2,276 (91%)** |
| 4-min calls | ₹276 | ₹50 | ₹326 | **₹2,173 (87%)** |

Add infra share (~₹400/client at small scale) → still **~70–75% margin**. Compare Vyora ₹799:
at ₹4.6/min their ₹799 buys ~175 min of OUR cost basis — they're subsidizing entry to win logos.

**Why this beats racing to ₹799:** we don't sell minutes, we sell *calls that get answered
and transferred*. Vyora ₹799 = shared number + CSV upload. Our ₹2,499 = dedicated AI agent,
23 languages, auto-ingest from portals, transfer to broker. The comparison page does the rest.

## 5. Option B: cut Launch ₹7,999 → ₹4,999 (30 calls)

- Per-call ₹167 ≈ same economics, better headline (₹4,999 vs ₹7,999)
- ❌ Breaks the "Launch is the worst rate" ladder note; churns existing framing; needs Razorpay plan re-creation
- ✅ Simpler than a wallet (one subscription flow, already built)

**Margin at ₹4,999/30 calls:** COGS ₹345–552 + 2% fee → **~85–88% gross**. Fine, but adds
a 4th subscription tier to explain.

## 6. Option C: do nothing on price, attack on positioning

- Keep ₹7,999 floor; win the comparison click: dedicated vs shared number, auto-ingest vs CSV, 23 vs 8 languages, transfer on every plan vs Business-only
- ❌ The ₹799 vs ₹7,999 sticker gap stays on Google

## 7. Recommendation

**Ship Option A** (₹2,499 wallet) + a "Plans from ₹2,499" line on the landing hero.
Revisit Launch pricing after 10 paying clients.

## 8. Code changes if approved (Codebuff, ~half day)

1. `PLAN_DEFINITIONS`-adjacent wallet model in `credit-manager.service.ts` (credits ledger already exists — `prepaidCalls`)
2. New Razorpay **one-time payment** flow (not subscription) → `routes/client/billing.ts`
3. Webhook: `payment.captured` → credit wallet, invoice PDF (GSTIN already wired)
4. Pricing page + landing hero "from ₹2,499" + compare page mention
5. Tests: credit consumption, expiry (90d), wallet + plan-cap interaction
