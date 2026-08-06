/**
 * Backfill Call Costs — Reconciles completed calls that never logged a cost.
 *
 * WHY THIS EXISTS:
 *   recordCallCost only fires from the Omnidimension webhook (completed events).
 *   Seed/demo data, missed webhooks, or calls completed before the webhook URL
 *   was configured in the Omni dashboard leave COMPLETED calls with NO cost
 *   transaction — making platform spend invisible. This script finds those
 *   calls and records their real per-minute cost using the SAME math as
 *   recordCallCost() in src/services/credit-manager.service.ts:
 *
 *     durationMinutes = max(0.5, durationSeconds / 60)
 *     callCost        = round(durationMinutes × OMNIDIM_COST_PER_MINUTE × 100) / 100
 *
 * SAFETY:
 *   - Idempotent: skips any call that already has a CONSUME transaction.
 *   - Dry-run by default: pass --apply to actually write records.
 *   - Skips simulated seed/demo calls by default (omnidimensionCallId "sim-*"
 *     or call ids "seed-call-*" / "demo-*") so fake data never inflates costs.
 *     Pass --include-simulated to include them.
 *
 * USAGE:
 *   node scripts/backfill-call-costs.cjs            # dry run
 *   node scripts/backfill-call-costs.cjs --apply    # actually record
 *   node scripts/backfill-call-costs.cjs --apply --include-simulated
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COST_PER_MINUTE = Number(process.env.OMNIDIM_COST_PER_MINUTE || 4.6);
const APPLY = process.argv.includes("--apply");
const INCLUDE_SIMULATED = process.argv.includes("--include-simulated");

function isSimulatedCall(call) {
  const omniId = (call.omnidimensionCallId || "").toLowerCase();
  const id = (call.id || "").toLowerCase();
  return (
    omniId.startsWith("sim-") ||
    omniId.startsWith("demo-call-") ||
    id.startsWith("seed-call-") ||
    id.startsWith("demo-")
  );
}

async function getOrCreateCurrentCredit() {
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return prisma.platformCredit.upsert({
    where: { billingMonth },
    create: {
      billingMonth,
      totalMinutesPurchased: 0,
      minutesUsed: 0,
      costPerMinute: COST_PER_MINUTE,
      costPerPhoneMonthly: Number(process.env.PHONE_NUMBER_MONTHLY_COST || 200),
      alertThresholdPercent: Number(process.env.CREDIT_WARN_THRESHOLD_PERCENT || 20),
    },
    update: {},
  });
}

async function main() {
  console.log(`ℹ️  Backfill call costs | costPerMinute=₹${COST_PER_MINUTE} | apply=${APPLY} | includeSimulated=${INCLUDE_SIMULATED}`);
  console.log("");

  // All completed/answered calls that actually have a duration
  const calls = await prisma.call.findMany({
    where: {
      status: { in: ["COMPLETED", "ANSWERED"] },
      duration: { gt: 0 },
    },
    select: {
      id: true,
      status: true,
      duration: true,
      clientId: true,
      leadId: true,
      omnidimensionCallId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Existing CONSUME transactions grouped by callId
  const existingTxns = await prisma.creditTransaction.findMany({
    where: { type: "CONSUME", callId: { not: null } },
    select: { callId: true },
  });
  const consumedCallIds = new Set(existingTxns.map((t) => t.callId));

  let toRecord = 0;
  let skippedSimulated = 0;
  let skippedAlreadyCosted = 0;
  let totalCost = 0;
  let totalMinutes = 0;

  for (const call of calls) {
    const simulated = isSimulatedCall(call);

    if (consumedCallIds.has(call.id)) {
      skippedAlreadyCosted++;
      continue;
    }
    if (simulated && !INCLUDE_SIMULATED) {
      skippedSimulated++;
      continue;
    }

    const durationMinutes = Math.max(0.5, (call.duration || 0) / 60);
    const callCost = Math.round(durationMinutes * COST_PER_MINUTE * 100) / 100;
    totalCost += callCost;
    totalMinutes += Math.ceil(durationMinutes);

    const tag = simulated ? "[SIMULATED]" : "[REAL]";
    console.log(
      `${tag} ${call.id.padEnd(24)} ${call.status.padEnd(10)} ${String(call.duration).padStart(4)}s → ` +
      `${durationMinutes.toFixed(2)}min × ₹${COST_PER_MINUTE} = ₹${callCost.toFixed(2)} (${call.createdAt.toISOString().slice(0, 10)})`
    );
    toRecord++;

    if (APPLY) {
      const credit = await getOrCreateCurrentCredit();
      await prisma.$transaction(async (tx) => {
        await tx.platformCredit.update({
          where: { id: credit.id },
          data: { minutesUsed: { increment: Math.ceil(durationMinutes) } },
        });
        await tx.creditTransaction.create({
          data: {
            type: "CONSUME",
            amount: callCost,
            minutes: Math.ceil(durationMinutes),
            description: `Call cost (backfill): ${durationMinutes}min × ₹${COST_PER_MINUTE}/min = ₹${callCost}`,
            clientId: call.clientId,
            callId: call.id,
            metadata: { durationMinutes, costPerMinute: COST_PER_MINUTE, totalCost: callCost, backfilled: true },
          },
        });
        await tx.client.update({
          where: { id: call.clientId },
          data: { totalCostIncurred: { increment: callCost } },
        });
        if (call.leadId) {
          await tx.lead.update({
            where: { id: call.leadId },
            data: { platformCost: { increment: callCost } },
          });
        }
      });
    }
  }

  console.log("");
  console.log("───── SUMMARY ─────");
  console.log(`Calls found (COMPLETED/ANSWERED with duration): ${calls.length}`);
  console.log(`  → already costed (skipped):                   ${skippedAlreadyCosted}`);
  console.log(`  → simulated seed/demo (skipped):              ${skippedSimulated}`);
  console.log(`  → TO RECORD:                                  ${toRecord}`);
  console.log(`  → total minutes:                              ${totalMinutes}`);
  console.log(`  → total cost:                                 ₹${totalCost.toFixed(2)}`);
  if (!APPLY) {
    console.log("");
    console.log("⚠️  DRY RUN — nothing was written. Re-run with --apply to record these costs.");
  } else {
    console.log("✅ Applied. All listed calls now have CONSUME transactions.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
