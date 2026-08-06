/**
 * Reconcile Calls Limit — Aligns existing clients' callsLimit with their plan.
 *
 * The plan definitions in src/routes/client/billing.ts are the source of truth:
 *   STARTER → 100 calls
 *   GROWTH  → 500 calls
 *   PRO     → 999999 calls (effectively unlimited)
 *
 * Existing records may hold stale values (100/300) from old seed data or signup
 * paths. This script updates clients whose callsLimit doesn't match their plan.
 *
 * USAGE:
 *   node scripts/reconcile-calls-limit.cjs            # dry run (shows what would change)
 *   node scripts/reconcile-calls-limit.cjs --apply    # actually update
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

const PLAN_CALLS = {
  STARTER: 100,
  GROWTH: 500,
  PRO: 999999,
};

async function main() {
  const clients = await prisma.client.findMany({
    select: { id: true, businessName: true, email: true, plan: true, callsLimit: true },
    orderBy: { createdAt: "asc" },
  });

  let toFix = 0;
  let fixed = 0;

  console.log(`ℹ️  Reconcile callsLimit | apply=${APPLY}`);
  console.log("");

  for (const c of clients) {
    const expected = PLAN_CALLS[c.plan];
    if (expected === undefined) {
      console.log(`⏭️  ${c.businessName || c.email} — plan "${c.plan}" has no mapping, skipped`);
      continue;
    }
    if (c.callsLimit === expected) continue;

    toFix++;
    console.log(
      `${c.businessName || c.email} (${c.plan}): callsLimit ${c.callsLimit} → ${expected}`
    );

    if (APPLY) {
      await prisma.client.update({
        where: { id: c.id },
        data: { callsLimit: expected },
      });
      fixed++;
    }
  }

  console.log("");
  console.log(`Clients checked: ${clients.length} | to fix: ${toFix} | fixed: ${fixed}`);
  if (!APPLY) {
    console.log("⚠️  DRY RUN — nothing changed. Re-run with --apply to update.");
  } else {
    console.log("✅ Done. All clients now match their plan definition.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
