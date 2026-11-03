import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  PLANS,
  OVERAGE_PER_LEAD_EX,
  monthlyCharged,
  annualCharged,
  pricePerLeadEx,
  TRIAL,
  CALL_WINDOW,
  FAIR_USE_MINUTES_PER_LEAD,
  RETIRED_PLANS,
  buildPlansPayload,
} from "../config/plans";
import { PLAN_DEFINITIONS } from "../services/subscription.service";
import { FEATURE_PLANS } from "../utils/plan-gates";

/**
 * T1 acceptance: a unit test asserts the V2 doc §1.2 table EXACTLY, including
 * GST-inclusive rounding — and proves the server plan table + the generated
 * frontend payload derive from the same canonical config.
 */

describe("T1 — canonical plans config (doc §1.2 table)", () => {
  it("matches the ex-GST prices, annual prices and leads counts exactly", () => {
    //            monthly ex-GST   annual ex-GST   leads   per-lead(approx) overage
    expect(PLANS.STARTER.monthlyEx).toBe(14999);
    expect(PLANS.STARTER.annualEx).toBe(149990);
    expect(PLANS.STARTER.leadsPerMonth).toBe(200);
    expect(PLANS.GROWTH.monthlyEx).toBe(34999);
    expect(PLANS.GROWTH.annualEx).toBe(349990);
    expect(PLANS.GROWTH.leadsPerMonth).toBe(600);
    expect(PLANS.PRO.monthlyEx).toBe(59999);
    expect(PLANS.PRO.annualEx).toBe(599990);
    expect(PLANS.PRO.leadsPerMonth).toBe(1200);
  });

  it("rounds the GST-inclusive figures exactly as the doc table states", () => {
    // 14,999 × 1.18 = 17,698.82 → ₹17,699
    // 34,999 × 1.18 = 41,298.82 → ₹41,299
    // 59,999 × 1.18 = 70,798.82 → ₹70,799
    expect(monthlyCharged("STARTER")).toBe(17699);
    expect(monthlyCharged("GROWTH")).toBe(41299);
    expect(monthlyCharged("PRO")).toBe(70799);
    // Annual incl-GST = round(annualEx × 1.18): 176,988.2 / 412,988.2 / 707,988.2
    expect(annualCharged("STARTER")).toBe(176988);
    expect(annualCharged("GROWTH")).toBe(412988);
    expect(annualCharged("PRO")).toBe(707988);
  });

  it("matches the per-lead price and overage columns", () => {
    // 14999/200 → ₹75 · 34999/600 → ₹58 · 59999/1200 → ₹50
    expect(pricePerLeadEx("STARTER")).toBe(75);
    expect(pricePerLeadEx("GROWTH")).toBe(58);
    expect(pricePerLeadEx("PRO")).toBe(50);
    expect(OVERAGE_PER_LEAD_EX).toEqual({ STARTER: 90, GROWTH: 70, PRO: 55 });
  });

  it("matches users / dedicated number / follow-ups / support columns", () => {
    expect(PLANS.STARTER.teamUsers).toBe(3);
    expect(PLANS.GROWTH.teamUsers).toBe(15);
    expect(PLANS.PRO.teamUsers).toBe(50);
    // V2 §1.2: every paid plan ships a dedicated calling number.
    expect(PLANS.STARTER.dedicatedNumber).toBe(true);
    expect(PLANS.GROWTH.dedicatedNumber).toBe(true);
    expect(PLANS.PRO.dedicatedNumber).toBe(true);
    expect(PLANS.STARTER.followUpDays).toBe(3);
    expect(PLANS.GROWTH.followUpDays).toBe(3);
    expect(PLANS.PRO.followUpDays).toBe(7);
    expect(PLANS.STARTER.support).toBe("WhatsApp");
    expect(PLANS.GROWTH.support).toBe("Priority");
    expect(PLANS.PRO.support).toBe("Account manager");
  });

  it("carries the trial, calling-window and fair-use constants", () => {
    // Trial: 30 days, up to 50 leads, 25/day (leads — metering switches in T2)
    expect(TRIAL).toEqual({ days: 30, maxLeads: 50, maxLeadsPerDay: 25 });
    expect(CALL_WINDOW).toEqual({ startHour: 9, endHour: 21, timezone: "Asia/Kolkata" });
    expect(FAIR_USE_MINUTES_PER_LEAD).toBe(8);
  });
});

describe("T1 — server plan table derives from the config (one edit rules all)", () => {
  it("charges the GST-inclusive figures", () => {
    expect(PLAN_DEFINITIONS.STARTER.monthly).toBe(17699);
    expect(PLAN_DEFINITIONS.GROWTH.monthly).toBe(41299);
    expect(PLAN_DEFINITIONS.PRO.monthly).toBe(70799);
    expect(PLAN_DEFINITIONS.STARTER.yearly).toBe(176988);
    expect(PLAN_DEFINITIONS.GROWTH.yearly).toBe(412988);
    expect(PLAN_DEFINITIONS.PRO.yearly).toBe(707988);
  });

  it("carries the new limits into the server plan table", () => {
    expect(PLAN_DEFINITIONS.STARTER.leads).toBe(200);
    expect(PLAN_DEFINITIONS.GROWTH.leads).toBe(600);
    expect(PLAN_DEFINITIONS.PRO.leads).toBe(1200);
    expect(PLAN_DEFINITIONS.STARTER.users).toBe(3);
    expect(PLAN_DEFINITIONS.GROWTH.users).toBe(15);
    expect(PLAN_DEFINITIONS.PRO.users).toBe(50);
  });

  it("keeps LAUNCH at its legacy charged amount (existing Razorpay plan unchanged)", () => {
    expect(RETIRED_PLANS.LAUNCH.legacyMonthlyCharged).toBe(7999);
    expect(RETIRED_PLANS.LAUNCH.legacyYearlyCharged).toBe(79990);
    expect(PLAN_DEFINITIONS.LAUNCH.monthly).toBe(7999);
    expect(PLAN_DEFINITIONS.LAUNCH.yearly).toBe(79990);
  });
});

describe("T1 — frontend generated payload stays in sync (drift check)", () => {
  it("plans.autogen.ts PLANS_VERSION equals the hash of the canonical payload", async () => {
    // Locate the frontend dir regardless of cwd (server/ or repo root).
    const candidates = [
      resolve(process.cwd(), "..", "frontend", "src", "lib", "plans.autogen.ts"),
      resolve(process.cwd(), "frontend", "src", "lib", "plans.autogen.ts"),
    ];
    const genPath = candidates.find((p) => existsSync(p));
    expect(genPath, `plans.autogen.ts not found in any of:\n${candidates.join("\n")}`).toBeDefined();
    const generated = readFileSync(genPath!, "utf8");

    const versionMatch = generated.match(/PLANS_VERSION = "([a-f0-9]+)"/);
    expect(versionMatch).not.toBeNull();

    const canonicalJson = JSON.stringify(buildPlansPayload(), null, 2);
    const expectedVersion = createHash("sha256").update(canonicalJson).digest("hex").slice(0, 12);

    expect(versionMatch![1]).toBe(expectedVersion);

    // And the key derived figures are present in the emitted file. Since the
    // hash is computed over the full payload, these extra pins only fail if
    // someone hand-edits the generated file instead of regenerating.
    expect(generated).toContain('"monthlyInclGst": 17699');
    expect(generated).toContain('"monthlyInclGst": 41299');
    expect(generated).toContain('"monthlyInclGst": 70799');
  });
});

describe("T3 — plan gates follow the V2 rule (team on every paid plan)", () => {
  it("team access is granted on every paid plan (LAUNCH legacy included)", () => {
    expect(FEATURE_PLANS.team).toEqual(["LAUNCH", "STARTER", "GROWTH", "PRO"]);
  });

  it("voice / reports stay Growth-and-above; campaigns / AB / API stay Pro", () => {
    expect(FEATURE_PLANS.voice).toEqual(["GROWTH", "PRO"]);
    expect(FEATURE_PLANS.reports).toEqual(["GROWTH", "PRO"]);
    expect(FEATURE_PLANS.email_campaigns).toEqual(["PRO"]);
    expect(FEATURE_PLANS.sms_campaigns).toEqual(["PRO"]);
    expect(FEATURE_PLANS.ab_testing).toEqual(["PRO"]);
    expect(FEATURE_PLANS.api_access).toEqual(["PRO"]);
  });
});
