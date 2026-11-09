import { describe, expect, it } from "vitest";
import { normalizeReraNumber } from "../utils/rera";

describe("RERA number normalization (T13)", () => {
  it("uppercases and strips separators", () => {
    expect(normalizeReraNumber(" a519 0000-1234 ")).toBe("A51900001234");
  });

  it("treats empty input as absent", () => {
    expect(normalizeReraNumber(null)).toBeNull();
    expect(normalizeReraNumber("   ")).toBeNull();
  });

  it("rejects implausible values", () => {
    expect(() => normalizeReraNumber("ABC")).toThrow(/8–24/);
    expect(() => normalizeReraNumber("A519#0000")).toThrow(/8–24/);
  });
});
