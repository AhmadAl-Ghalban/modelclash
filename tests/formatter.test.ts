import { describe, it, expect } from "vitest";
import {
  formatHeader,
  formatResponses,
  formatSummaryTable,
  toJsonReport,
} from "../src/utils/formatter.js";
import type { ProviderResult } from "../src/types/index.js";

const successResult: ProviderResult = {
  ok: true,
  value: {
    provider: "openai",
    model: "gpt-4o",
    text: "Hello world",
    usage: { input: 10, output: 5, total: 15 },
    costUsd: 0.000075,
    durationMs: 432,
  },
};

const errorResult: ProviderResult = {
  ok: false,
  error: {
    provider: "anthropic",
    model: "claude-sonnet-4",
    message: "rate limit",
    durationMs: 100,
  },
};

describe("formatHeader", () => {
  it("includes the prompt", () => {
    const out = formatHeader("What is 2+2?");
    expect(out).toContain("What is 2+2?");
    expect(out).toContain("modelclash");
  });

  it("truncates long prompts", () => {
    const long = "x".repeat(1000);
    const out = formatHeader(long);
    expect(out).toContain("…");
  });
});

describe("formatResponses", () => {
  it("renders success and error blocks", () => {
    const out = formatResponses([successResult, errorResult]);
    expect(out).toContain("OPENAI");
    expect(out).toContain("Hello world");
    expect(out).toContain("ANTHROPIC");
    expect(out).toContain("rate limit");
  });
});

describe("formatSummaryTable", () => {
  it("contains provider and stats", () => {
    const out = formatSummaryTable([successResult, errorResult]);
    expect(out).toContain("openai");
    expect(out).toContain("gpt-4o");
    expect(out).toContain("432ms");
    expect(out).toContain("15");
    expect(out).toContain("anthropic");
  });
});

describe("toJsonReport", () => {
  it("returns structured report", () => {
    const report = toJsonReport("hi", [successResult, errorResult]);
    expect(report.prompt).toBe("hi");
    expect(report.results).toHaveLength(2);
    expect(report.results[0].status).toBe("success");
    expect(report.results[1].status).toBe("error");
    expect(report.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
