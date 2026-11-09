# 2026-11-06 — Converza V2 completion pass (T1–T17 + closing gaps)

> **Prompt received:** complete all T tasks from the pasted V2 spec, then report with update and changes.
> **Working branch:** converza-v2 (already exists; tip was 3b5a273 before this session).
> **Rule kept through this session:** no live money, no live calls, no live SMS/WhatsApp, no live Razorpay keys, no secrets committed. Scripts that touch live services default to dry-run and require an explicit human gate.

## What was already true when the prompt arrived

- Phase 0 discovery done: docs/V2_DISCOVERY.md exists.
- Tasks already implemented (per git log + V2_REPORT.md + working-tree inspection):
  - T0 discovery (commit 8d1fe93)
  - T1 plans config single source of truth (commit 1681c0f) — canonical config in server/src/config/plans.ts, frontend consumes generated plans.autogen.ts, public /plans endpoint, plans-config.test.ts pins the doc table incl. GST rounding.
  - T3 plan gates (commit 8a99736) — team access on every paid plan, capped by user count.
  - T5 calling window (commit b50e8f0) — single-sourced window helper + jitter on re-queue + >=10-min first-call delay.
  - T4 Razorpay plan sync script (commit 2771cf3) — dry-run default, --live human gate, --verify drift check.
  - T2 leads-handled metering (commit 812f415) — dedup-first, 8-min fair-use, QUEUED_WAITING_CREDITS.
  - T7 platform credit monitor (commit 1637a68) — auto-pause/resume, never silently kill leads.
  - T6 public demo (commit 135916d) — OTP request/verify + real queued demo call + honest status.
  - T8 integration-status registry + raw-body webhook verification (commit 3b5a273).
- Working tree already contained uncommitted work for T9 (claims-lint), T10 (landing/rewrite), T11 (proof engine), T12 (AI prompt), T13 (territory), T14 (compliance), T15 (onboarding), T16 (feature hiding), T17 (domain/email docs) — but that uncommitted work did NOT typecheck cleanly and was not committed.

## What this session is doing

Goal: make every T task either already-landed or explicitly finished/blocked with the right artifacts, and report with a clean change set.

Priority order I used (matches the spec's P0/P1/P2 labels and the spec's dependencies):
1. Close env-example + CI gaps that many tasks depend on (T6/T7/T5/T11/T13/T14 env vars, claims lint config, CI running claims-lint).
2. T9 claims lint — final config + runner + CI + test that proves it fails on a seeded bad string.
3. T16 feature hiding — done as a scope-discipline pass (no code deletion), fits naturally while sweeping marketing copy.
4. T10 landing/marketing — finish the honest-landing pass already in progress: hero, stat-counter SSR, results section, integration section from config, comparison behind flag, refund text gate, LEGAL REVIEW stubs.
5. T12 AI representative prompt — install Appendix A as server prompt, render {{PLANS_TABLE}}/{{INTEGRATIONS_TABLE}} from T1/T8 config, forbidden-string test, eval script.
6. T14 compliance scaffolding (engineering only) — AI disclosure/prepend, DND test, lead erasure admin action, recording-retention cron toggle, stub legal pages with [LEGAL REVIEW REQUIRED].
7. T13 territory model and rules — micro-market zone fields, RERA/phone/RERA duplicate detection, disabled-by-default auto-release cron. (Independent; kept additive.)
8. T11 proof engine — weekly broker metric + Monday 09:00 IST snapshot cron + broker report (WhatsApp template with email fallback) + proof dashboard + admin profitability view + founder cost-per-lead alert + Prometheus metrics. (This is the largest remaining P1; I scaffold the metric definitions exactly as written and the cron/report/dashboard/alert shapes, and mark HUMAN GATE items where real data/template approval is required.)
9. T15 onboarding speed + self-test — test-with-my-own-number step, rate limit, window handling, onboarding timestamps + admin median.
10. T17 domain/email setup documentation — human action doc for Vercel apex/www, API custom domain, SPF/DKIM/DMARC, MX/forwarding, and every URL that must change on domain move.

Tasks I will NOT claim complete (by rule + spec):
- T4 --live plan creation (HUMAN GATE).
- “Real sample call recording”, “real portal sample emails”, WhatsApp template approvals, captcha keys, DNS/custom domain, founder photo — all HUMAN GATE or vendor actions.
- Anything that requires live Razorpay keys, live calls, live WhatsApp/SMS.

## Verification discipline for this session

For each task I touch:
- lint + typecheck where the task touches that layer,
- add or update tests where the spec lists acceptance,
- record files changed,
- record decisions that differ from the spec (repo wins on code; spec wins on product decisions),
- record HUMAN ACTIONS, RISKS, and SUGGESTED NEXT STEPS.

I am finishing this work as a small number of task-scoped commits where sensible, with the final state readable from git log and from this work-log entry, plus a summary in DAILY-WORK.md.
