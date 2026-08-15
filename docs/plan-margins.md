# 📊 Phase 2.2 — Per-Plan Margin Analysis (LeadBridge)

> **Status:** ✅ ANALYSED 2026-08-15 · **Question:** is each plan profitable per broker after
> phone-number cost + AI call cost? Any plan we can't make money on must be fixed before selling it.
> **Sources:** `server/src/config.ts` (cost constants), `server/src/services/subscription.service.ts` (`PLAN_DEFINITIONS`).

---

## The cost model (what the platform pays)

| Constant | Value | Meaning |
|---|---|---|
| `OMNIDIM_COST_PER_MINUTE` | ₹4.6 | platform pays OmniDimension per AI call minute |
| `AVG_CALL_DURATION_MINUTES` | 2 | cost-estimation assumption (⚠️ weak point, see below) |
| `PHONE_NUMBER_MONTHLY_COST` | ₹200 | monthly rental per broker phone number |
| `PRO_MONTHLY_CALL_CAP` | ~~5,000~~ → **2,000** | hard cap on PRO calls (protects against "unlimited" burn) — lowered 2026-08-15 |

**Cost per call = duration × ₹4.6:**

| Avg call | Cost/call |
|---|---|
| 2 min | ₹9.2 |
| 4 min | ₹18.4 |
| 6 min | ₹27.6 |

---

## Per-plan margins (revenue vs. platform cost)

Plans from `subscription.service.ts`: STARTER ₹18K/100 calls · GROWTH ₹35K/500 calls ·
PRO ₹60K/up-to-5,000 calls (capped).

### STARTER — ₹18,000/mo, 100 calls ✅ SAFE

| Avg call | Call cost | + phone ₹200 | Platform cost | Margin | % |
|---|---|---|---|---|---|
| 2 min | ₹920 | ₹1,120 | ₹1,120 | **₹16,880** | 94% |
| 4 min | ₹1,840 | ₹2,040 | ₹2,040 | **₹15,960** | 89% |
| 6 min | ₹2,760 | ₹2,960 | ₹2,960 | **₹15,040** | 84% |

Even at 6-min calls, STARTER keeps ~84% margin. No risk.

### GROWTH — ₹35,000/mo, 500 calls ✅ SAFE

| Avg call | Call cost | + phone ₹200 | Platform cost | Margin | % |
|---|---|---|---|---|---|
| 2 min | ₹4,600 | ₹4,800 | ₹4,800 | **₹30,200** | 86% |
| 4 min | ₹9,200 | ₹9,400 | ₹9,400 | **₹25,600** | 73% |
| 6 min | ₹13,800 | ₹14,000 | ₹14,000 | **₹21,000** | 60% |

Comfortable even at 6-min calls. No risk.

### PRO — ₹60,000/mo, up to 5,000 calls (cap) ⚠️ RISK AT CAP

| Avg call | Call cost @5,000 | + phone ₹200 | Platform cost | Margin | % |
|---|---|---|---|---|---|
| 2 min | ₹46,000 | ₹46,200 | ₹46,200 | **₹13,800** | 23% |
| 4 min | ₹92,000 | ₹92,200 | ₹92,200 | **−₹32,200** | ❌ NEGATIVE |
| 6 min | ₹138,000 | ₹138,200 | ₹138,200 | **−₹78,200** | ❌ NEGATIVE |

**PRO is the only plan with real downside.** At the 5,000-call cap with 4-min calls the platform
loses ₹32K/mo on a single broker.

### PRO break-even caps (where margin = 0)

| Avg call | Break-even cap | Cap at 2,000 (applied 2026-08-15) |
|---|---|---|
| 2 min | ~6,500 calls | safe |
| 4 min | ~3,250 calls | safe |
| 6 min | ~2,170 calls | safe (worst case ~8% margin) |

---

## The weak assumption: 2-minute average calls

The 2-min default is optimistic for real-estate telecalling. These are **sales conversations** —
answering objections, qualifying budget/location, booking site visits — typically **3–5+ minutes**.
`recordCallCost` in `credit-manager.service.ts` bills per actual minute, so the real number will
come from production data once brokers are live (Phase 4.2 is the measuring window).

**Until real data exists, plan as if calls average 4 min.** That is the prudent middle case.

---

## Offline/prepaid calls (BROKER_CALL_PRICE = ₹70)

| Avg call | Cost/call | Platform margin/call | % |
|---|---|---|---|
| 2 min | ₹9.2 | ₹60.8 | 87% |
| 4 min | ₹18.4 | ₹51.6 | 74% |
| 6 min | ₹27.6 | ₹42.4 | 61% |

Healthy at every duration. Offline top-ups are safe to keep selling.

---

## ✅ Verdict & recommendation

1. **STARTER and GROWTH are safely profitable** — no pricing change needed. Sell them freely.
2. **PRO decision — APPLIED 2026-08-15: cap lowered to 2,000.** `PRO_MONTHLY_CALL_CAP` is now 2,000
   (in `server/.env` and the code default in `config.ts`). At 2,000 calls the worst case (6 min)
   costs ₹55,400 → still ~8% margin, and no realistic call duration loses money. Alternative
   options that were considered (may matter later):
   - **B. Raise PRO price** to ₹75–80K/mo if we want to sell more than 2,000 calls/mo — re-prices
     the "unlimited" promise and needs landing-page + Razorpay plan updates.
   - **C. Monitor weekly** (`docs` checklist 6.1 cost-per-call) and raise the cap when real data
     proves longer calls are rare. When real call durations come in from Phase 4.2, re-run this
     table and tune the cap.
3. **Track real `AVG_CALL_DURATION_MINUTES` from production** (platform credits health endpoint
   already records minutes used vs. calls) — replace the 2-min assumption with data after the
   first broker month.

---

## How to re-run this analysis

Costs live in `server/src/config.ts` (`OMNIDIM_COST_PER_MINUTE`, `PHONE_NUMBER_MONTHLY_COST`,
`PRO_MONTHLY_CALL_CAP`) and plans in `server/src/services/subscription.service.ts`
(`PLAN_DEFINITIONS`). Re-run whenever those change or after Phase 4.2 real-duration data arrives.
