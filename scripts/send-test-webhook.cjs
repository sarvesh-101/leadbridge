#!/usr/bin/env node
/**
 * Send a correctly-signed synthetic Razorpay webhook to a Converza endpoint.
 *
 * Razorpay's dashboard has no "send test webhook" button — test events only fire
 * from a real Test-mode transaction. This script proves the OTHER half of the
 * wiring: that the deployed endpoint accepts a properly signed payload (correct
 * secret, raw-body HMAC, route registered, handler runs).
 *
 * Usage:
 *   RAZORPAY_WEBHOOK_SECRET=<value from Render env> \
 *     node scripts/send-test-webhook.cjs [eventType]
 *
 *   eventType defaults to subscription.charged. Also: subscription.cancelled,
 *   subscription.pending, subscription.halted, subscription.completed,
 *   payment.failed, invoice.paid.
 *
 *   Add --bad-signature to prove signature verification is actually enforced
 *   (expect 401).
 *
 * Safety: every id in the payload is a FAKE id (sub_FAKE_VERIFY_*, pay_FAKE_*),
 * so the handler's updateMany({ where: { razorpaySubId } }) matches zero rows and
 * no database state changes. Verify by checking the logs, not the DB.
 *
 * IMPORTANT: the payload is sent as compact JSON (no whitespace). The server
 * re-serializes the parsed body with JSON.stringify before computing the HMAC,
 * which only matches for compact JSON — exactly what Razorpay sends. Do not
 * pretty-print this payload or you will get a false 401.
 */

const https = require("https");
const http = require("http");
const crypto = require("crypto");

const TARGET = process.env.WEBHOOK_URL || "https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay";
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

const args = process.argv.slice(2);
const EVENT = args.find((a) => !a.startsWith("--")) || "subscription.charged";
const BAD_SIGNATURE = args.includes("--bad-signature");

const FAKE_SUB = "sub_FAKE_VERIFY_0000000000";
const FAKE_PAY = "pay_FAKE_VERIFY_0000000000";
const FAKE_INVOICE = "inv_FAKE_VERIFY_0000000000";
const NOW = Math.floor(Date.now() / 1000);

function buildPayload(event) {
  const subscription = {
    id: FAKE_SUB,
    entity: "subscription",
    plan_id: "plan_FAKE_VERIFY",
    status: "active",
    current_start: NOW,
    current_end: NOW + 30 * 24 * 60 * 60,
    created_at: NOW,
  };
  const payment = {
    id: FAKE_PAY,
    entity: "payment",
    amount: 500,
    currency: "INR",
    status: "captured",
    method: "upi",
    created_at: NOW,
    error_description: "synthetic test payment (no money moved)",
  };
  const invoice = {
    id: FAKE_INVOICE,
    entity: "invoice",
    subscription_id: FAKE_SUB,
    amount_paid: 500,
    status: "paid",
    created_at: NOW,
  };

  const payload = {
    entity: "event",
    account_id: "acc_FAKE_VERIFY",
    event,
    contains: [event.split(".")[0]],
    payload: {},
    created_at: NOW,
  };

  if (event.startsWith("subscription.")) payload.payload.subscription = { entity: subscription };
  if (event === "subscription.charged" || event === "invoice.paid") {
    payload.payload.payment = { entity: payment };
  }
  if (event === "invoice.paid") payload.payload.invoice = { entity: invoice };
  if (event === "payment.failed") {
    payload.payload.payment = { entity: { ...payment, status: "failed" } };
  }
  return payload;
}

function sign(rawBody, secret) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function post(url, rawBody, signature) {
  const target = new URL(url);
  const lib = target.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: target.pathname + target.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(rawBody),
          "x-razorpay-signature": signature,
          "x-razorpay-event-id": "evt_FAKE_VERIFY_" + NOW,
          "User-Agent": "converza-webhook-verify",
        },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString().slice(0, 500) })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout (30s) — is the API awake?")));
    req.write(rawBody);
    req.end();
  });
}

(async () => {
  if (!SECRET) {
    console.error("Missing RAZORPAY_WEBHOOK_SECRET.");
    console.error("Copy the value from Render → leadbridge-api → Environment, then:");
    console.error('  RAZORPAY_WEBHOOK_SECRET=xxxx node scripts/send-test-webhook.cjs');
    process.exit(1);
  }

  const payload = buildPayload(EVENT);
  const rawBody = JSON.stringify(payload);
  const signature = BAD_SIGNATURE
    ? "0".repeat(64)
    : sign(rawBody, SECRET);

  console.log(`event      : ${EVENT}`);
  console.log(`target     : ${TARGET}`);
  console.log(`secret     : ${SECRET.length} chars, prefix ${SECRET.slice(0, 4)}…`);
  console.log(`signature  : ${BAD_SIGNATURE ? "DELIBERATELY WRONG (expect 401)" : signature.slice(0, 16) + "…"}`);
  console.log(`sub id     : ${FAKE_SUB} (fake — matches no client row)`);
  console.log("");

  const started = Date.now();
  try {
    const res = await post(TARGET, rawBody, signature);
    const ms = Date.now() - started;
    console.log(`HTTP ${res.status} in ${ms} ms`);
    console.log(`body: ${res.body}`);
    console.log("");
    if (res.status === 200) {
      console.log("PASS — the endpoint accepted the signature and ran the handler.");
      console.log("Now check Render → leadbridge-api → Logs for:");
      console.log(`  { eventType: '${EVENT}' }  Razorpay webhook received`);
    } else if (res.status === 401) {
      console.log("FAIL — signature rejected. The secret here does not match Render's");
      console.log("RAZORPAY_WEBHOOK_SECRET (or Render is running old code without it).");
    } else {
      console.log("FAIL — unexpected status. Check the URL and the Render logs.");
    }
  } catch (e) {
    console.error("Request error:", e.message);
    process.exit(1);
  }
})();
