#!/usr/bin/env node
/**
 * Read-only verification of the Razorpay money loop for one broker account.
 *
 * Usage:
 *   node scripts/verify-money-loop.cjs <email>
 *   node scripts/verify-money-loop.cjs --latest          # most recently updated client
 *
 * Checks the state a successful ₹5 money-loop run must leave behind:
 * activation, subscription row, PAID invoice with GST fields, Payment row,
 * revenue increment, and the generated invoice PDF reference.
 *
 * READ ONLY — never writes. Safe to run against production at any time.
 */

const fs = require("fs");
const path = require("path");

// ─── Load DATABASE_URL from server/.env without depending on dotenv ──────────
const envPath = path.join(__dirname, "..", "server", ".env");
if (fs.existsSync(envPath)) {
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (line) {
    const value = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    if (!process.env.DATABASE_URL) process.env.DATABASE_URL = value;
  }
}
if (!process.env.DATABASE_URL) {
  console.error("No DATABASE_URL found (server/.env or environment).");
  process.exit(1);
}

const { PrismaClient } = require(path.join(__dirname, "..", "server", "node_modules", "@prisma", "client"));
const prisma = new PrismaClient();

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}
function info(label, value) {
  console.log(`      ${label}: ${value}`);
}

function inr(n) {
  return n === null || n === undefined ? "—" : `₹${Number(n).toLocaleString("en-IN")}`;
}
function dt(d) {
  return d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) + "Z" : "—";
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/verify-money-loop.cjs <email> | --latest");
    process.exit(1);
  }

  let client;
  if (arg === "--latest") {
    client = await prisma.client.findFirst({ orderBy: { updatedAt: "desc" } });
  } else {
    client = await prisma.client.findUnique({ where: { email: arg.trim().toLowerCase() } });
    if (!client) client = await prisma.client.findUnique({ where: { email: arg.trim() } });
  }

  if (!client) {
    console.error(`No client found for ${arg}`);
    process.exit(1);
  }

  console.log(`\n=== ${client.businessName} <${client.email}> ===`);
  console.log(`client id: ${client.id}`);
  console.log(`created  : ${dt(client.createdAt)}\n`);

  // ─── 1. Activation ─────────────────────────────────────────────────────────
  console.log("── Activation ──");
  info("plan / planStatus", `${client.plan} / ${client.planStatus}`);
  info("razorpaySubId", client.razorpaySubId || "—");
  info("trialStartedAt", dt(client.trialStartedAt));
  info("convertedFromTrialAt", dt(client.convertedFromTrialAt));
  info("callsLimit / callsThisMonth", `${client.callsLimit} / ${client.callsThisMonth}`);
  check("planStatus is ACTIVE", client.planStatus === "ACTIVE", `got ${client.planStatus}`);
  check("razorpaySubId recorded on client", !!client.razorpaySubId);
  check("convertedFromTrialAt stamped (first charge)", !!client.convertedFromTrialAt);

  // ─── 2. Subscription row ───────────────────────────────────────────────────
  console.log("\n── Subscription ──");
  const subs = await prisma.subscription.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });
  if (!subs.length) {
    check("subscription row exists", false, "none found");
  } else {
    const sub = subs[0];
    info("latest sub", `${sub.id} status=${sub.status} tier=${sub.planTier}`);
    info("providerSubId", sub.providerSubscriptionId || "—");
    info("amount / total", `${inr(sub.amount)} / ${inr(sub.totalAmount)}`);
    info("start / end", `${dt(sub.startDate)} → ${dt(sub.endDate)}`);
    check("subscription status ACTIVE", sub.status === "ACTIVE", `got ${sub.status}`);
    check(
      "providerSubscriptionId matches client.razorpaySubId",
      !!sub.providerSubscriptionId && sub.providerSubscriptionId === client.razorpaySubId
    );
    if (subs.length > 1) info("note", `${subs.length} subscription rows (prior checkouts)`);
  }

  // ─── 3. Invoice ────────────────────────────────────────────────────────────
  console.log("\n── Invoice ──");
  const invoices = await prisma.invoice.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!invoices.length) {
    check("invoice exists", false, "none found");
  } else {
    const inv = invoices[0];
    info("invoiceNumber", inv.invoiceNumber);
    info("status", inv.status);
    info("amount / total", `${inr(inv.amount)} / ${inr(inv.totalAmount)}`);
    info("taxable / gst", `${inr(inv.taxableAmount)} / ${inr(inv.gstAmount)}`);
    info("gstNumber", inv.gstNumber || "—");
    info("paidAt", dt(inv.paidAt));
    info("invoicePdfUrl", inv.invoicePdfUrl || "—");
    info("pdf generated at", dt(inv.invoicePdfGeneratedAt));
    check("latest invoice is PAID", inv.status === "PAID", `got ${inv.status}`);
    check("paidAt set", !!inv.paidAt);
    check("GST amount computed", Number(inv.gstAmount) > 0, inr(inv.gstAmount));
    check("GSTIN present on invoice", !!inv.gstNumber, inv.gstNumber || "missing");
    check("PDF generated", !!inv.invoicePdfUrl, inv.invoicePdfUrl || "missing");
    if (invoices.length > 1) info("note", `${invoices.length} invoices on account`);
  }

  // ─── 4. Payment + revenue ──────────────────────────────────────────────────
  console.log("\n── Payment ──");
  const payments = await prisma.payment.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!payments.length) {
    check("payment row exists", false, "none found — webhook never recorded the charge");
  } else {
    const p = payments[0];
    info("amount / status", `${inr(p.amount)} / ${p.status}`);
    info("providerPaymentId", p.providerPaymentId || "—");
    info("paymentMethod", p.paymentMethod || "—");
    info("refund", `${inr(p.refundAmount)} ${p.refundedAt ? `on ${dt(p.refundedAt)}` : ""}`);
    check("payment status SUCCESSFUL", p.status === "SUCCESSFUL", `got ${p.status}`);
    check("providerPaymentId set (idempotency key)", !!p.providerPaymentId);
    if (payments.length > 1) info("note", `${payments.length} payment rows (duplicates would mean a double-count)`);
  }
  info("totalRevenueGenerated", inr(client.totalRevenueGenerated));
  check("revenue incremented", Number(client.totalRevenueGenerated) > 0, inr(client.totalRevenueGenerated));

  // ─── Summary ───────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) {
    console.log("Still failing:");
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
    console.log("\nIf the webhook-dependent ones fail: check Render logs for");
    console.log("  'Razorpay webhook received' — absent means Razorpay did not deliver.");
  } else {
    console.log("Money loop verified: activation, invoice, GST, payment and revenue all correct.");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
