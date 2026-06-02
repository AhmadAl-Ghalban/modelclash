import { describe, it, expect } from "vitest";
import { estimateCost, formatCost, roundTo } from "../src/utils/cost.js";

describe("estimateCost", () => {
  it("computes cost for gpt-4o", () => {
    const cost = estimateCost("gpt-4o", { input: 1_000_000, output: 1_000_000, total: 2_000_000 });
    expect(cost).toBeCloseTo(12.5, 4);
  });

  it("computes cost for claude-sonnet-4", () => {
    const cost = estimateCost("claude-sonnet-4", { input: 1000, output: 500, total: 1500 });
    expect(cost).toBeCloseTo(0.003 + 0.0075, 6);
  });

  it("computes cost for gemini-2.5-pro", () => {
    const cost = estimateCost("gemini-2.5-pro", { input: 1_000_000, output: 1_000_000, total: 2_000_000 });
    expect(cost).toBeCloseTo(11.25, 4);
  });

  it("returns 0 for unknown model", () => {
    const cost = estimateCost("definitely-not-real-xyz", { input: 100, output: 100, total: 200 });
    expect(cost).toBe(0);
  });

  it("fuzzy matches model prefix", () => {
    const cost = estimateCost("gpt-4o-2024-08-06", { input: 1_000_000, output: 0, total: 1_000_000 });
    expect(cost).toBeCloseTo(2.5, 4);
  });
});

describe("formatCost", () => {
  it("formats zero", () => {
    expect(formatCost(0)).toBe("$0.00");
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
