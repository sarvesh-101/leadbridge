# Domain & Email Setup (V2 T17)

> **Every step here is a HUMAN step.** Nothing in this document is automated,
> and nothing should be flipped in production before the previous step verifies.

The app currently works on a Vercel URL. This document moves it to
`converza.tech` without breaking OAuth, webhooks or email.

---

## 1. Apex + www on Vercel

1. Vercel → Project → **Settings → Domains** → add `converza.tech` and `www.converza.tech`.
2. At the DNS provider, add the records Vercel shows:
   - `A  @  76.76.21.21` (Vercel's apex IP — confirm in the dashboard, it can change)
   - `CNAME  www  cname.vercel-dns.com`
3. Choose one canonical host and redirect the other (Vercel → Domains → Redirect).
4. Wait for the certificate to show **Valid** before continuing.

## 2. API custom domain

1. Render (or your host) → Service → **Settings → Custom Domains** → `api.converza.tech`.
2. DNS: `CNAME  api  <service>.onrender.com`.
3. Verify `https://api.converza.tech/health` returns 200.
4. Set server env `SITE_URL=https://converza.tech` and `FRONTEND_URL=https://converza.tech`.

## 3. Email authentication (sending provider)

For the provider that sends `noreply@converza.tech` (SES / Brevo / SMTP2GO):

| Record | Name | Value |
|---|---|---|
| SPF | `@` | `v=spf1 include:<provider-spf-include> ~all` |
| DKIM | provider selector, e.g. `s1._domainkey` | the CNAME/TXT the provider issues |
| DMARC | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@converza.tech; pct=100` |

Start DMARC at `p=none`, watch the reports for two weeks, then move to
`p=quarantine`. Do not jump straight to `p=reject`.

## 4. Mailboxes

- `support@converza.tech` — MX to the mailbox provider; this is `SUPPORT_EMAIL`
  and the address in the AI prompt.
- `forward@converza.tech` — inbound portal-email forwarding (`FORWARDING_EMAIL`).
- `dmarc@converza.tech` — aggregate report inbox (can be an alias).

Set `SUPPORT_EMAIL` and `NEXT_PUBLIC_SUPPORT_EMAIL` to the live mailbox.

## 5. Values that MUST change when the domain moves

- [ ] `NEXT_PUBLIC_SITE_URL` (frontend, canonical URLs + metadata)
- [ ] `NEXT_PUBLIC_API_URL` (frontend → API)
- [ ] `SITE_URL` (server, used by the AI prompt)
- [ ] `FRONTEND_URL` (CORS origin)
- [ ] Google OAuth — authorised redirect URIs:
      `https://api.converza.tech/api/v1/auth/google/callback`
- [ ] Razorpay — webhook URL: `https://api.converza.tech/api/v1/webhooks/razorpay`
- [ ] WhatsApp Cloud API — callback URL: `https://api.converza.tech/api/v1/webhooks/whatsapp`
- [ ] Meta Lead Ads — callback URL: `https://api.converza.tech/api/v1/webhooks/facebook`
- [ ] IndiaMART — Push API webhook shown in the broker dashboard
      (`/api/v1/webhooks/indiamart/<clientId>`) — brokers must re-paste the new URL
- [ ] `WEBHOOK_URL` (server) used to register OmniDimension call-event webhooks
- [ ] Any Supabase storage CORS origins for the new frontend host
- [ ] Invoice/email templates that contain links (they read `SITE_URL`, but verify)

## 6. Verification checklist after the switch

1. `https://converza.tech` loads and every internal link uses the new host.
2. `https://api.converza.tech/health` → 200.
3. Google sign-in completes from the new origin.
4. A ₹5 Razorpay test subscription produces a verified webhook (see the money-loop runbook).
5. A forwarded portal lead still lands (email + SMS forwarding).
6. A test email to Gmail shows `spf=pass dkim=pass dmarc=pass` in the headers.
7. `NEXT_PUBLIC_SITE_URL` is not still pointing at the Vercel preview URL.

## 7. Rollback

Keep the Vercel URL working until steps 1–6 pass. Reverting is a DNS change plus
restoring the previous `*_URL` env values — no database changes are involved.
