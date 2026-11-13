#!/usr/bin/env node
/**
 * setup-razorpay.cjs — DEPRECATED. Does not create anything. Refuses to run.
 *
 * Why it is disabled: this script hardcoded the RETIRED price list
 * (Launch ₹7,999 · Starter ₹18,000 · Growth ₹35,000 · Pro ₹60,000) and created
 * plans from it. The canonical amounts now live in
 * `server/src/config/plans.ts` and are charged GST-inclusive:
 *   Starter ₹17,699/mo · Growth ₹41,299/mo · Pro ₹70,799/mo
 * No new ₹7,999 LAUNCH plan is created at all (legacy subscribers stay on it).
 *
 * Running it against the new business account would have created three
 * wrong-amount plans (and a fourth retired one) that then look legitimate in
 * the dashboard. Plan creation is owned by ONE script:
 *
 *   cd server
 *   npx tsx scripts/sync-razorpay-plans.ts           # dry-run, prints payloads
 *   npx tsx scripts/sync-razorpay-plans.ts --live     # creates + writes plan map
 *   npx tsx scripts/sync-razorpay-plans.ts --verify   # drift check
 *
 * Webhook note (unchanged): Razorpay merchant webhooks cannot be created via
 * API (POST /v1/webhooks is partner-only). Create it in the dashboard at
 * Settings → Webhooks, pointing at <WEBHOOK_URL>/api/v1/webhooks/razorpay with
 * events subscription.charged / subscription.cancelled / subscription.pending /
 * subscription.halted / subscription.completed / payment.failed / invoice.paid,
 * and set the same secret as RAZORPAY_WEBHOOK_SECRET in the host environment.
 */

console.error("✗ scripts/setup-razorpay.cjs is disabled — it created plans at retired prices.");
console.error("");
console.error("  Plan creation is owned by server/scripts/sync-razorpay-plans.ts,");
console.error("  whose amounts come from server/src/config/plans.ts:");
console.error("    Starter ₹17,699/mo · Growth ₹41,299/mo · Pro ₹70,799/mo (incl. GST)");
console.error("");
console.error("  cd server");
console.error("  npx tsx scripts/sync-razorpay-plans.ts          # dry-run, touches nothing");
console.error("  npx tsx scripts/sync-razorpay-plans.ts --live    # create + print plan IDs");
console.error("  npx tsx scripts/sync-razorpay-plans.ts --verify  # drift check");
process.exit(1);
