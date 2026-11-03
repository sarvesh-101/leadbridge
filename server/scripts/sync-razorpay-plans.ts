/**
 * T4 — Razorpay plan sync (V2 doc).
 *
 * DRY-RUN IS THE DEFAULT. `--live` is a HUMAN GATE: it creates/verifies real
 * Razorpay plans against the canonical config in server/src/config/plans.ts.
 *
 * What it does
 *   dry-run (default) → prints the exact plan payloads + .env snippet, touches nothing
 *   --live            → creates missing monthly/annual plans, verifies existing
 *                       ones, writes razorpay.plan-map.json + prints the .env lines
 *   --verify          → read-only: compares existing Razorpay plans to the config
 *
 * Env: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (test or live keys).
 * Local keys are known stale (401) — the script exits 2 with a clear message.
 *
 * Run:  cd server && npx tsx scripts/sync-razorpay-plans.ts
 *       cd server && npx tsx scripts/sync-razorpay-plans.ts --live
 *       cd server && npx tsx scripts/sync-razorpay-plans.ts --verify
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  TIERS,
  PLANS,
  GST_RATE,
  monthlyCharged,
  annualCharged,
  type PlanTier,
} from "../src/config/plans";

const LIVE = process.argv.includes("--live");
const VERIFY = process.argv.includes("--verify");

function roundInt(n: number): number {
  return Math.round(n);
}

/** Canonical desired plan matrix — single source of truth is config/plans.ts. */
function planMatrix() {
  const asPaise = (r: number) => roundInt(r * 100);
  return TIERS.map((tier: PlanTier) => ({
    tier,
    monthly: {
      chargedInclGst: monthlyCharged(tier),
      amountPaise: asPaise(monthlyCharged(tier)),
      period: "month" as const,
    },
    annual: {
      chargedInclGst: annualCharged(tier),
      amountPaise: asPaise(annualCharged(tier)),
      period: "year" as const,
    },
    leadsPerMonth: PLANS[tier].leadsPerMonth,
    teamUsers: PLANS[tier].teamUsers,
    exGst: PLANS[tier].monthlyEx,
    gstRate: GST_RATE,
  }));
}

function makePlanCreds() {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  return { keyId, keySecret, ok: Boolean(keyId && keySecret) };
}

function envSnippet(): string {
  return [
    "# T4 — paste into Render / .env after --live completes:",
    "# (monthly plan IDs power checkout today; annual is parked until annual checkout ships)",
    ...planMatrix().map(
      (p) => `RAZORPAY_PLAN_${p.tier}=<new plan id for ₹${p.monthly.chargedInclGst}/mo incl. GST>`
    ),
  ].join("\n");
}

function printDryRun(): void {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║ T4 RAZORPAY PLAN SYNC — DRY RUN (default). Nothing was changed.  ║");
  console.log("║ Re-run with --live ONLY after human review (V2 HUMAN GATE).      ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();
  for (const p of planMatrix()) {
    console.log(`— ${p.tier} (ex-GST ₹${p.exGst}, +${p.gstRate} GST)`);
    console.log(`   monthly: ₹${p.monthly.chargedInclGst} incl. GST → create Razorpay plan {`);
    console.log(`     item: { name: "Converza ${p.tier} — ${p.leadsPerMonth} leads/mo", amount: ${p.monthly.amountPaise}, currency: "INR" },`);
    console.log(`     period: "${p.monthly.period}", interval: 1,`);
    console.log(`     notes: { planTier: "${p.tier}", billingCycle: "monthly", exGst: "${p.exGst}", leadsPerMonth: "${p.leadsPerMonth}", teamUsers: "${p.teamUsers}" },`);
    console.log(`   }`);
    console.log(`   annual (10× incl-GST ₹${p.annual.chargedInclGst}) → create Razorpay plan {`);
    console.log(`     item: { name: "Converza ${p.tier} — annual (12 for 10)", amount: ${p.annual.amountPaise}, currency: "INR" },`);
    console.log(`     period: "${p.annual.period}", interval: 1,`);
    console.log(`          notes: { planTier: "${p.tier}", billingCycle: "annual", exGstAnnual: "${PLANS[p.tier].annualEx}", leadsPerMonth: "${p.leadsPerMonth}", teamUsers: "${p.teamUsers}" },`);
    console.log(`   }`);
  }
  console.log();
  console.log("Legacy LAUNCH: no NEW plan. Existing ₹7,999 plan keeps charging until");
  console.log("the map-to-STARTER migration (T2 migration scope); RAZORPAY_PLAN_LAUNCH stays as-is.");
  console.log();
  console.log(envSnippet());
  console.log();
  console.log("Drift check: create plans ONLY if the printed amounts match your config");
  console.log("(server/src/config/plans.ts is the source of truth).");
}

async function main(): Promise<number> {
  if (!LIVE && !VERIFY) {
    printDryRun();
    return 0;
  }

  const { keyId, keySecret, ok } = makePlanCreds();
  if (!ok) {
    console.error("✗ RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing — set keys and re-run.");
    return 2;
  }
  void keyId; void keySecret; // keys go straight to the Razorpay client

  // Lazy import so dry-run never touches the Razorpay SDK.
  const Razorpay = (await import("razorpay")).default;
  const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });

  if (VERIFY) {
    console.log("→ read-only verify (fetching Razorpay plans)…");
    try {
      const plans = await rzp.plans.all({ count: 100 });
      const planMap = planMatrix();
      let problems = 0;
      for (const p of planMap) {
        for (const cycle of ["monthly", "annual"] as const) {
          const wanted = p[cycle];
          const match = plans.items.find(
            (it: any) =>
              it.notes?.planTier === p.tier &&
              it.notes?.billingCycle === cycle &&
              it.item?.amount === wanted.amountPaise &&
              it.item?.currency === "INR"
          );
          if (!match) {
            problems++;
            console.log(`✗ missing/mismatched: ${p.tier}/${cycle} — expected ₹${wanted.chargedInclGst} (${wanted.amountPaise}p)`);
          } else {
            console.log(`✓ ${p.tier}/${cycle} → ${match.id} (₹${wanted.chargedInclGst}, ${wanted.period})`);
          }
        }
      }
      console.log(problems === 0 ? "\nAll plan amounts verified ✓" : `\n${problems} problem(s) — re-run with --live to create/fix.`);
      return problems === 0 ? 0 : 1;
    } catch (err: any) {
      console.error(`✗ Razorpay API error (keys may be stale — refresh keys, or run from Render): ${err?.error?.description || err?.message}`);
      return 2;
    }
  }

  // ─── LIVE ────────────────────────────────────────────────────────────
  console.log("🚨 --live: creating/verifying REAL Razorpay plans (HUMAN GATE passed)…");
  try {
    const results: Record<string, unknown> = {};
    const existing = await rzp.plans.all({ count: 100 });
    for (const p of planMatrix()) {
      for (const cycle of ["monthly", "annual"] as const) {
        const wanted = p[cycle];
        const already = existing.items.find(
          (it: any) =>
            it.notes?.planTier === p.tier &&
            it.notes?.billingCycle === cycle &&
            it.item?.amount === wanted.amountPaise
        );
        if (already) {
          results[`${p.tier}.${cycle}`] = { planId: already.id, created: false };
          console.log(`✓ exists: ${p.tier}/${cycle} → ${already.id}`);
          continue;
        }
        const notes = {
          planTier: p.tier,
          billingCycle: cycle,
          exGst: String(p.exGst),
          exGstAnnual: String(PLANS[p.tier].annualEx),
          leadsPerMonth: String(p.leadsPerMonth),
          teamUsers: String(p.teamUsers),
          syncedAt: new Date().toISOString(),
        };
        const label = `Converza ${p.tier}${cycle === "annual" ? " — annual (12 for 10)" : ` — ${p.leadsPerMonth} leads/mo`}`;
        const plan = await rzp.plans.create({
          period: wanted.period,
          interval: 1,
          item: { name: label, amount: wanted.amountPaise, currency: "INR" },
          notes,
        });
        results[`${p.tier}.${cycle}`] = { planId: plan.id, created: true };
        console.log(`+ created: ${p.tier}/${cycle} → ${plan.id}`);
      }
    }

    const mapPath = path.resolve(process.cwd(), "razorpay.plan-map.json");
    fs.writeFileSync(
      mapPath,
      JSON.stringify({ syncedAt: new Date().toISOString(), plans: results }, null, 2)
    );
    console.log(`\nplan map written → ${mapPath}`);
    console.log("\n" + envSnippet());
    console.log("\n⚠️ After the human deploys these plan IDs, run --verify once from Render.");
    return 0;
  } catch (err: any) {
    console.error(`✗ Razorpay API error (keys may be stale — run from Render instead): ${err?.error?.description || err?.message}`);
    return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`✗ unexpected failure: ${err?.message}`);
    process.exit(2);
  });
