# 🔀 Converza — Rebrand URL Switch (apply after Render/Vercel renames)

> **Purpose:** the exact, ready-to-paste edits for `render.yaml`, `frontend/.env.local`
> and the CSP once Sarvesh renames the Render service and Vercel project (Runbook Step 3).
> Prepare once, apply in ~10 minutes with zero downtime.
>
> **Placeholder used below:** `<NEW-FRONTEND-URL>` = the new Vercel domain after the rename
> (e.g. `converza.vercel.app` or `converza-xyz.vercel.app` — Vercel picks it, you copy it).
> **The API URL does NOT change** — renaming a Render *service* keeps
> `https://leadbridge-zy4o.onrender.com` (cosmetic name only). Verify this yourself:
> after renaming, Render → Settings → "Primary URL" must still show `leadbridge-zy4o.onrender.com`.
>
> ⚠️ If the API URL ever changes (custom domain later), also update `frontend/next.config.js`
> `connect-src` (https + wss) — the CSP is pinned to the exact API origin, not a wildcard.

---

## 0️⃣ Before you touch anything (2 min)

- [ ] Rename Render service `leadbridge-api` → `converza-api` (Settings → Name → Save). Confirm URL unchanged.
- [ ] Rename Vercel project `leadbridge-seven` → `converza` (Settings → General → Project Name).
- [ ] Note the **new Vercel production URL** → this is `<NEW-FRONTEND-URL>`.
- [ ] Vercel: old URL `leadbridge-seven.vercel.app` may keep redirecting for a while — don't rely on it.

## 1️⃣ `frontend/.env.local` (local dev) — 3 lines, then Vercel env vars mirror them

**Before:**
```
NEXT_PUBLIC_API_URL=https://leadbridge-zy4o.onrender.com/api/v1
NEXT_PUBLIC_WS_URL=wss://leadbridge-zy4o.onrender.com
NEXT_PUBLIC_APP_URL=https://leadbridge-seven.vercel.app
```
**After** (only line 3 changes — API URL is unchanged):
```
NEXT_PUBLIC_API_URL=https://leadbridge-zy4o.onrender.com/api/v1
NEXT_PUBLIC_WS_URL=wss://leadbridge-zy4o.onrender.com
NEXT_PUBLIC_APP_URL=https://<NEW-FRONTEND-URL>
```

**Vercel must mirror the same 3 values** (Settings → Environment Variables → Production):
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` (unchanged values), `NEXT_PUBLIC_APP_URL` → `https://<NEW-FRONTEND-URL>` → then **Redeploy** (env changes don't apply to the already-built bundle).

## 2️⃣ `render.yaml` — 2 values

```yaml
# BEFORE
      - key: FRONTEND_URL
        value: https://leadbridge-seven.vercel.app
# AFTER
      - key: FRONTEND_URL
        value: https://<NEW-FRONTEND-URL>
```
`WEBHOOK_URL` (`https://leadbridge-zy4o.onrender.com`) stays as-is.

## 3️⃣ Render Dashboard (the render.yaml file is infra-as-code; the dashboard is live truth)

Render → `converza-api` → **Environment**:
| Key | Before | After |
|---|---|---|
| `FRONTEND_URL` | `https://leadbridge-seven.vercel.app` | `https://<NEW-FRONTEND-URL>` |

Save → auto-redeploys (~2 min).

> 🔴 **`FRONTEND_URL` is the CORS allowlist + OAuth redirect base.** If it's stale,
> the frontend gets CORS-blocked and Google login breaks — this is the #1 thing to get right.

## 4️⃣ `frontend/next.config.js` — nothing to change unless the API domain changes

`connect-src` is already pinned to the exact API origin
(`https://leadbridge-zy4o.onrender.com` + `wss://…`). Because the API URL is unchanged,
**no edit needed now**. Only if you later add a custom API domain, update both origins there
(see the comment in the file).

## 5️⃣ Razorpay dashboard — display names (you)

Dashboard → Subscriptions → Plans → edit each plan's **display name**:
`LeadBridge Starter/Growth/Pro…` → `Converza Starter/Growth/Pro…` (IDs `plan_TLa2O5pEwG46mP`, `plan_TLa2OL7fmEXbnz`, `plan_TLa2OaHr2MHxTe` — unchanged).

## 6️⃣ External callbacks — unchanged, verify only

These all point at the API, which keeps its URL — just confirm they're still registered:
- MessageBird SMS callback → `…/api/v1/webhooks/sms/incoming-messagebird`
- Razorpay webhook → `…/api/v1/webhooks/razorpay`
- Meta/FB webhook → `…/api/v1/webhooks/facebook`
- Omnidimension agent webhook → `…/api/v1/webhooks/omnidimension`

## 7️⃣ Smoke test (10 min, after Render redeploys + Vercel redeploys)

- [ ] `curl -s https://leadbridge-zy4o.onrender.com/health` → `"app":"Converza"`, database healthy
- [ ] Open `https://<NEW-FRONTEND-URL>` → landing loads, **zero CSP errors** in console (F12)
- [ ] Register a throwaway account → email verification arrives → login works (CORS OK)
- [ ] Dashboard WebSocket connects (Network tab → WS → 101, live updates work)
- [ ] Google login works (OAuth redirect origin matches)
- [ ] WhatsApp bot still replies (webhook untouched)

## 8️⃣ After verification — cleanup commits (Codebuff)

- [ ] Update `docs/GO-LIVE-RUNBOOK.md` Step 3 checkboxes
- [ ] Delete this doc (it's served its purpose) or mark it ✅ APPLIED
- [ ] Sweep for leftover `leadbridge-seven` refs: `grep -rn "leadbridge-seven" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.ts" --include="*.js" .`

---

*Prepared 2026-09-07. Apply order: 0 → 1 → 2/3 together → 5 → 7. Everything else is verify-only.*
