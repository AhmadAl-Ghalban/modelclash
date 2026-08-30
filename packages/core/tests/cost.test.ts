import { describe, it, expect } from "vitest";
import { estimateCost, formatCost, roundTo } from "../src/utils/cost.js";

describe("estimateCost", () => {
  it("computes cost for gpt-5.6-terra", () => {
    const cost = estimateCost("gpt-5.6-terra", { input: 1_000_000, output: 1_000_000, total: 2_000_000 });
    expect(cost).toBeCloseTo(14.0, 4);
  });

  it("computes cost for claude-opus-5", () => {
    const cost = estimateCost("claude-opus-5", { input: 1000, output: 500, total: 1500 });
    expect(cost).toBeCloseTo(0.005 + 0.0125, 6);
  });

  it("computes cost for gemini-2.5-pro", () => {
    const cost = estimateCost("gemini-2.5-pro", { input: 1_000_000, output: 1_000_000, total: 2_000_000 });
    expect(cost).toBeCloseTo(11.25, 4);
  });

  it("returns null for an unpriced model rather than reporting it as free", () => {
    const cost = estimateCost("definitely-not-real-xyz", { input: 100, output: 100, total: 200 });
    expect(cost).toBeNull();
  });

  it("reports a genuinely free local model as 0, not null", () => {
    const cost = estimateCost("llama3.2", { input: 1_000_000, output: 1_000_000, total: 2_000_000 });
    expect(cost).toBe(0);
  });

  it("fuzzy matches a dated model id onto its base entry", () => {
    const cost = estimateCost("gpt-5.6-terra-2026-08-01", { input: 1_000_000, output: 0, total: 1_000_000 });
    expect(cost).toBeCloseTo(2.0, 4);
  });
});

describe("formatCost", () => {
  it("formats zero", () => {
    expect(formatCost(0)).toBe("$0.00");
  });
  it("formats an unknown cost as n/a", () => {
    expect(formatCost(null)).toBe("n/a");
  });
  it("formats small values with more precision", () => {
    expect(formatCost(0.0001234)).toBe("$0.00012");
  });
  it("formats larger values with 4 decimals", () => {
    expect(formatCost(1.23456)).toBe("$1.2346");
  });
  it("uses scientific for tiny values", () => {
    expect(formatCost(0.00000005)).toMatch(/e-/);
  });
});

describe("roundTo", () => {
  it("rounds to N digits", () => {
    expect(roundTo(1.23456789, 4)).toBe(1.2346);
    expect(roundTo(0.000123456, 6)).toBe(0.000123);
  });
});
