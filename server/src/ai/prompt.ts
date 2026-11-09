/**
 * V2 (T12) — render the AI representative system prompt.
 *
 * The template lives in ai/prompts/converza-agent.md and contains placeholders
 * that MUST be filled from config (never hand-edited):
 *   {{PLANS_TABLE}}              → config/plans.ts (GST-inclusive column)
 *   {{INTEGRATIONS_TABLE}}       → config/integration-status.ts
 *   {{SUPPORT_EMAIL}}            → SUPPORT_EMAIL env
 *   {{SITE_URL}}                 → NEXT_PUBLIC_SITE_URL / SITE_URL env
 *   {{GROWTH_PER_LEAD_INCL_GST}} → Growth incl-GST price per lead
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PLANS, TIERS, monthlyCharged, pricePerLeadEx, GST_RATE, OVERAGE_PER_LEAD_EX } from "../config/plans";
import { integrationsTableMarkdown } from "../config/integration-status";

export const PROMPT_FILE = "converza-agent.md";

/** Strings that must never appear in a rendered prompt (internal/vendor data). */
export const FORBIDDEN_PROMPT_STRINGS = [
  "4.6",
  "margin",
  "onrender.com",
  "leadbridge",
  "omnidimension",
  "deepseek",
  "circuit breaker",
  "platformcredit",
  "mrr",
  "leadbridge",
];

const inr = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

export function plansTableMarkdown(): string {
  const header = [
    "| Plan | Monthly (ex-GST) | Monthly (incl. 18% GST) | Annual (ex-GST, 10 months) | Leads/month | Approx. per lead (ex-GST) | Overage per lead | Team users |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const rows = TIERS.map((tier) => {
    const p = PLANS[tier];
    const monthlyIncl = monthlyCharged(tier);
    const annualIncl = Math.round(p.annualEx * (1 + GST_RATE));
    // Annual GST-inclusive price uses the same integer-paise derivation as the
    // plans config: ex-GST annual × (1 + GST_RATE), rounded to the nearest rupee.
    return `| ${tier.charAt(0) + tier.slice(1).toLowerCase()} | ${inr(p.monthlyEx)} | ${inr(monthlyIncl)} | ${inr(p.annualEx)} incl. of GST ${String(annualIncl).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} | ${p.leadsPerMonth} | ${inr(pricePerLeadEx(tier))} | ${inr(OVERAGE_PER_LEAD_EX[tier])} | ${p.teamUsers} |`;
  });
  return [...header, ...rows].join("\n");
}

/** Locate the prompt template in dev (src) and production (dist/cwd). */
export function loadPromptTemplate(): string {
  const candidates = [
    path.join(__dirname, "prompts", PROMPT_FILE),
    path.join(process.cwd(), "src", "ai", "prompts", PROMPT_FILE),
    path.join(process.cwd(), "ai", "prompts", PROMPT_FILE),
    path.join(process.cwd(), "dist", "ai", "prompts", PROMPT_FILE),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      // try next
    }
  }
  throw new Error(`AI prompt template not found (looked for ${PROMPT_FILE})`);
}

export interface PromptVars {
  supportEmail?: string;
  siteUrl?: string;
}

/** Render the prompt with live config values. Throws if a placeholder remains. */
export function renderConverzaPrompt(vars: PromptVars = {}): string {
  const supportEmail = vars.supportEmail || process.env.SUPPORT_EMAIL || "support@converza.tech";
  const siteUrl = vars.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://converza.tech";
  const growthPerLeadInclGst = Math.round(
    (PLANS.GROWTH.monthlyEx * (1 + GST_RATE)) / PLANS.GROWTH.leadsPerMonth
  );

  const rendered = loadPromptTemplate()
    .replace(/{{PLANS_TABLE}}/g, plansTableMarkdown())
    .replace(/{{INTEGRATIONS_TABLE}}/g, integrationsTableMarkdown())
    .replace(/{{SUPPORT_EMAIL}}/g, supportEmail)
    .replace(/{{SITE_URL}}/g, siteUrl)
    .replace(/{{GROWTH_PER_LEAD_INCL_GST}}/g, `Rs ${growthPerLeadInclGst}`);

  const leftover = rendered.match(/{{[A-Z_]+}}/g);
  if (leftover) {
    throw new Error(`Unrendered prompt placeholder(s): ${[...new Set(leftover)].join(", ")}`);
  }
  return rendered;
}

/**
 * Resolve the system prompt for a newly created agent.
 *
 * An explicit broker-supplied prompt wins; otherwise the rendered Converza
 * representative prompt is used. If the template or a config table fails to
 * load, return undefined so agent creation falls back to the provider default
 * instead of failing the whole onboarding flow.
 */
export function resolveAgentSystemPrompt(override?: string | null): string | undefined {
  if (override?.trim()) return override;
  try {
    return renderConverzaPrompt();
  } catch {
    return undefined;
  }
}

/** Return the forbidden strings present in a rendered prompt (empty = clean). */
export function findForbiddenPromptStrings(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  return FORBIDDEN_PROMPT_STRINGS.filter((needle) => lower.includes(needle));
}
