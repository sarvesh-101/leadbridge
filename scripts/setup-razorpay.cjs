/**
 * setup-razorpay.cjs — One-shot Razorpay go-live wiring.
 *
 * Prereq: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (LIVE keys) must be set in
 * server/.env first (Settings → API Keys in the Razorpay dashboard).
 *
 * What it does (idempotent — safe to re-run):
 *   1. Creates the 3 monthly subscription plans via POST /v1/plans
 *      (Starter ₹18,000 · Growth ₹35,000 · Pro ₹60,000, period monthly, INR)
 *      — SKIPPED if RAZORPAY_PLAN_STARTER/GROWTH/PRO already set in .env.
 *   2. Generates RAZORPAY_WEBHOOK_SECRET and writes it to .env, then prints
 *      the EXACT dashboard steps to create the webhook.
 *      NOTE: Razorpay does NOT allow creating merchant webhooks via API —
 *      POST /v1/webhooks is a PARTNER-only endpoint. Merchant webhooks must
 *      be created in the dashboard (Settings → Webhooks → Add Webhook).
 *   3. Writes RAZORPAY_PLAN_STARTER/GROWTH/PRO + RAZORPAY_WEBHOOK_SECRET
 *      back into server/.env.
 *
 * Usage:  node scripts/setup-razorpay.cjs
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─── Paths ─────────────────────────────────────────────────────────────
const SERVER_ENV = path.join(__dirname, "..", "server", ".env");

// ─── Plans (match PLAN_DEFINITIONS in server/src/routes/client/billing.ts) ─
const PLANS = [
  { key: "RAZORPAY_PLAN_STARTER", name: "LeadBridge Starter (Monthly)", amountPaise: 18000 * 100 },
  { key: "RAZORPAY_PLAN_GROWTH", name: "LeadBridge Growth (Monthly)", amountPaise: 35000 * 100 },
  { key: "RAZORPAY_PLAN_PRO", name: "LeadBridge Pro (Monthly)", amountPaise: 60000 * 100 },
];

const WEBHOOK_EVENTS = [
  "subscription.charged",
  "subscription.cancelled",
  "subscription.pending",
  "payment.failed",
  "invoice.paid",
];

// ─── Load server/.env ─────────────────────────────────────────────────
function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function saveEnv(file, updates) {
  let content = fs.readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(content)) content = content.replace(re, `${k}=${v}`);
    else content += (content.endsWith("\n") ? "" : "\n") + `${k}=${v}\n`;
  }
  fs.writeFileSync(file, content);
  console.log(`✍️  ${file} updated (${Object.keys(updates).join(", ")})`);
}

// ─── Razorpay API helper ───────────────────────────────────────────────
async function razorpay(method, urlPath, body, keyId, keySecret) {
  const res = await fetch(`https://api.razorpay.com/v1${urlPath}`, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description || data?.message || JSON.stringify(data);
    throw new Error(`Razorpay ${method} ${urlPath} failed (${res.status}): ${msg}`);
  }
  return data;
}

(async () => {
  console.log("══════════════════════════════════════════════════");
  console.log("  Razorpay go-live setup");
  console.log("══════════════════════════════════════════════════\n");

  const env = loadEnv(SERVER_ENV);
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  const webhookUrl = env.WEBHOOK_URL?.trim();

  if (!keyId || !keySecret) {
    console.error("❌ RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in server/.env.");
    console.error("   1. Go to dashboard.razorpay.com → Settings → API Keys");
    console.error("   2. Copy the LIVE Key ID + Key Secret");
    console.error("   3. Add them to server/.env, then re-run this script.");
    process.exit(1);
  }
  if (!webhookUrl) {
    console.error("❌ WEBHOOK_URL is not set in server/.env (needed for the webhook URL).");
    process.exit(1);
  }
  console.log(`🔑 Keys present (${keyId.slice(0, 12)}…), WEBHOOK_URL=${webhookUrl}\n`);

  const updates = {};

  // ─── 1. Plans ────────────────────────────────────────────────────────
  for (const plan of PLANS) {
    const existing = env[plan.key]?.trim();
    if (existing) {
      console.log(`⏭️  ${plan.key} already set (${existing}) — skipping`);
      continue;
    }
    console.log(`📦 Creating plan: ${plan.name} (₹${plan.amountPaise / 100})`);
    const created = await razorpay("POST", "/plans", {
      period: "monthly",
      interval: 1,
      item: {
        name: plan.name,
        amount: plan.amountPaise,
        currency: "INR",
        description: "Monthly subscription — LeadBridge AI call automation",
      },
      notes: { tier: plan.key.replace("RAZORPAY_PLAN_", "") },
    }, keyId, keySecret);
    updates[plan.key] = created.id;
    // Persist immediately so a later step failing (e.g. env write below) can
    // never cause a re-run to create duplicate plans on the live account.
    saveEnv(SERVER_ENV, { [plan.key]: created.id });
    console.log(`   ✅ ${plan.key}=${created.id} (saved to .env)`);
  }

  // ─── 2. Webhook ──────────────────────────────────────────────────────
  // Razorpay merchant webhooks CANNOT be created via API (POST /v1/webhooks
  // is partner-only). So we generate + persist the secret locally and print
  // the dashboard steps the merchant must follow once.
  const existingSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const whUrl = `${webhookUrl.replace(/\/+$/, "")}/api/v1/webhooks/razorpay`;
  if (existingSecret) {
    console.log(`⏭️  RAZORPAY_WEBHOOK_SECRET already set — webhook already configured (check dashboard)`);
  } else {
    const secret = crypto.randomBytes(24).toString("hex");
    updates.RAZORPAY_WEBHOOK_SECRET = secret;
    console.log(`🔐 Generated RAZORPAY_WEBHOOK_SECRET (saved to .env)`);
    console.log(`\n   ⚠️  ONE-TIME MANUAL STEP — create the webhook in the Razorpay dashboard:`);
    console.log(`      1. Go to dashboard.razorpay.com → Settings → Webhooks → Add Webhook`);
    console.log(`      2. Webhook URL:  ${whUrl}`);
    console.log(`      3. Secret:       ${secret}`);
    console.log(`      4. Select events: ${WEBHOOK_EVENTS.join(", ")}`);
    console.log(`      5. Save. (If you miss this, payment events won't reach the server.)`);
  }

  // ─── 3. Write .env ───────────────────────────────────────────────────
  if (Object.keys(updates).length > 0) {
    saveEnv(SERVER_ENV, updates);
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("✅ Plans configured + webhook secret saved to .env.");
  console.log("⚠️  Webhook is NOT live yet — complete the ONE-TIME manual step");
  console.log("   in the Razorpay dashboard (steps printed above). Payment events");
  console.log("   won't reach the server until that webhook is created.");
  console.log("   Then restart the server: cd server && npm run dev → the");
  console.log("   'Razorpay payments' startup warning should be GONE.");
  console.log("══════════════════════════════════════════════════");
})().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
