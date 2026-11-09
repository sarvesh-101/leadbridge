/**
 * V2 (T9) — claims-lint must pass on the real tree and fail on a seeded string.
 *
 * The "passes on the current tree" case is a regression gate: if any in-copy
 * banned phrase is introduced, this test turns red and CI fails. The case that
 * fails on a seeded string proves the linter actually detects real violations.
 */
import { describe, expect, it } from "vitest";
import { findViolations, loadConfig, scan, summarize } from "../../scripts/claims-lint.mjs";

const config = loadConfig();
const root = typeof process !== "undefined" && process.cwd ? process.cwd() : undefined;

function scanRealTree() {
  // In CI (or when run from the repo root) this scans the real configured paths.
  // Locally the test still runs against the configured scan paths so the
  // assertion stays meaningful even if the workspace root differs.
  const targets = config.scan.map((t) => (root ? `${root}/${t}` : t));
  return scan(targets, root, config);
}

describe("claims lint", () => {
  it("fails on each seeded banned phrase", () => {
    const seeded = [
      "We offer 24/7 calling for every broker.",
      "Our predictive lead scoring is best.",
      "Bookings grew +200% last quarter.",
      "Leads expire in 24-48 hours.",
      "This is guaranteed to work.",
      "LeadBridge is the platform name.",
    ];
    for (const text of seeded) {
      expect(findViolations(text, config).length).toBeGreaterThan(0);
    }
  });

  it("allows the one permitted 24/7 formulation", () => {
    expect(findViolations("24/7 lead capture, calls 9 AM to 9 PM IST.", config)).toHaveLength(0);
    // …but not when "24/7 calling" also appears alongside it.
    expect(
      findViolations("24/7 lead capture, calls 9 AM to 9 PM IST. We do 24/7 calling.", config).length
    ).toBeGreaterThan(0);
  });

  it("does not flag the forbidden-list rule description itself", () => {
    // Comments that only exist to disallow the relevant claim are not in-copy claims.
    const metaComment =
      "No 24/7 calling claim, no guaranteed outcomes, and no never-silently-dropped-leads promise.";
    expect(findViolations(metaComment, config)).toEqual([]);
  });

  it("still fails when a banned phrase is in copy, not a disallowance comment", () => {
    const copyWithBannedPhrase =
      "We offer 24/7 calling and guaranteed results for every broker.";
    expect(findViolations(copyWithBannedPhrase, config).length).toBeGreaterThan(0);
  });

  it("passes on the current customer-facing tree", () => {
    // This is the CI gate: any new in-copy ban makes this red.
    expect(scanRealTree()).toEqual([]);
  });
});

/** Friendly one-line summary of this tree's claims-lint status (for reports). */
export function claimsLintStatus() {
  const hits = scanRealTree();
  if (hits.length === 0) return "claims-lint: clean";
  return `claims-lint: ${hits.length} violation(s) — ${hits.map(summarize).join(" · ")}`;
}

