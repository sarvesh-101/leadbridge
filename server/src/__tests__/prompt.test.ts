/**
 * V2 (T12) — the rendered AI prompt must match config and leak nothing internal.
 */
import { describe, expect, it } from "vitest";
import { findForbiddenPromptStrings, plansTableMarkdown, renderConverzaPrompt, resolveAgentSystemPrompt } from "../ai/prompt";

describe("AI representative prompt", () => {
  it("renders both config tables with no placeholder left", () => {
    const prompt = renderConverzaPrompt({ supportEmail: "help@converza.tech", siteUrl: "https://example.test" });
    expect(prompt).not.toMatch(/{{[A-Z_]+}}/);
    expect(prompt).toContain("| Lead source | Status | Notes |");
    expect(prompt).toContain("IndiaMART");
    expect(prompt).toContain("help@converza.tech");
    expect(prompt).toContain("https://example.test");
  });

  it("quotes GST-inclusive prices from the plans config", () => {
    const prompt = renderConverzaPrompt();
    expect(prompt).toContain("17,699");
    expect(prompt).toContain("41,299");
    expect(prompt).toContain("70,799");
    expect(prompt).toContain("176,988");
  });

  it("contains no forbidden internal or vendor strings", () => {
    expect(findForbiddenPromptStrings(renderConverzaPrompt())).toEqual([]);
  });

  it("agent creation uses the rendered prompt unless the broker supplied one", () => {
    // T12: the call provider receives this value on POST /voice/agents.
    const rendered = resolveAgentSystemPrompt();
    expect(rendered).toContain("Starter");
    expect(rendered).not.toMatch(/{{[A-Z_]+}}/);
    expect(resolveAgentSystemPrompt("custom broker script")).toBe("custom broker script");
    expect(resolveAgentSystemPrompt("   ")).toBe(rendered);
  });

  it("plans table has one row per paid plan", () => {
    const rows = plansTableMarkdown().trim().split("\n").slice(2);
    expect(rows).toHaveLength(3);
  });
});
