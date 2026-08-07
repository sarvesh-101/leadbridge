# 📓 Daily Work Log

> **Why this folder exists:** AI assistants don't persist memory between sessions.
> Every work session must leave a dated record here so the next session (or a
> human) can pick up exactly where things stopped — no re-discovery, no lost context.

## How to use

1. **Every session**, create a new file: `work-log/YYYY-MM-DD.md` (e.g. `2026-08-02.md`)
2. Fill in the template below.
3. If continuing previous work, **read the most recent entry first**.

> 🚀 **Launch plan:** the tracked pre/post-launch checklist lives in
> [`launch-plan.md`](./launch-plan.md) — update its checkboxes as tasks complete.

## Template

```markdown
# YYYY-MM-DD — Session Summary

## Status: [IN PROGRESS / DONE / BLOCKED]

## What was done
- ...

## What changed (files)
- ...

## What's broken / not configured
- ...

## Decisions / facts learned
- ... (e.g. "Omnidimension calls verified working with a real agent — 2026-08-02")

## What's next (for the next session)
1. ...
```

## Key facts (as of 2026-08-02)

- **Omnidimension (AI calls + phone numbers) is VERIFIED WORKING** — real calls were
  tested with a proper agent by the team. `OMNIDIM_API_KEY` is set in `server/.env`.
- **NOT configured** (empty keys in `server/.env`): Razorpay, WhatsApp Cloud API,
  DeepSeek/OpenRouter LLM, Twilio, Supabase storage, MessageBird SMS.
- **`DEMO_MODE` must never run in production** — the server now refuses to boot
  with `DEMO_MODE=true` + `NODE_ENV=production` (added 2026-08-02).
- See `2026-08-02.md` for the full Column B completion record.
