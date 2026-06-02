import chalk from "chalk";
import Table from "cli-table3";
import type { ProviderResult } from "../types/index.js";
import { formatCost } from "./cost.js";

const PROVIDER_COLORS = {
  openai: chalk.green,
  anthropic: chalk.magenta,
  google: chalk.blue,
} as const;

export function formatHeader(prompt: string): string {
  const lines = [
    chalk.bold.cyan("━".repeat(60)),
    chalk.bold.cyan("  ⚔️  modelclash — Multi-Model Comparison"),
    chalk.bold.cyan("━".repeat(60)),
    chalk.dim("Prompt:"),
    chalk.white(truncate(prompt, 500)),
    "",
  ];
  return lines.join("\n");
}

export function formatResponses(results: ProviderResult[]): string {
  const blocks = results.map((r) => formatResponseBlock(r));
  return blocks.join("\n\n");
}

function formatResponseBlock(result: ProviderResult): string {
  if (!result.ok) {
    const color = PROVIDER_COLORS[result.error.provider];
    return [
      color.bold(`▌ ${result.error.provider.toUpperCase()} (${result.error.model})`),
      chalk.red(`  ✗ Error: ${result.error.message}`),
      chalk.dim(`  Duration: ${result.error.durationMs}ms`),
    ].join("\n");
  }
  const { value } = result;
  const color = PROVIDER_COLORS[value.provider];
  return [
    color.bold(`▌ ${value.provider.toUpperCase()} (${value.model})`),
    value.text,
  ].join("\n");
}

export function formatSummaryTable(results: ProviderResult[]): string {
  const table = new Table({
    head: [
      chalk.bold("Provider"),
      chalk.bold("Model"),
      chalk.bold("Status"),
      chalk.bold("Time"),
      chalk.bold("In"),
      chalk.bold("Out"),
      chalk.bold("Total"),
      chalk.bold("Cost"),
    ],
    style: { head: [], border: ["gray"] },
  });

  for (const r of results) {
    if (r.ok) {
      const v = r.value;
      const color = PROVIDER_COLORS[v.provider];
      table.push([
        color(v.provider),
        v.model,
        chalk.green("✓"),
        `${v.durationMs}ms`,
        String(v.usage.input),
        String(v.usage.output),
        String(v.usage.total),
        formatCost(v.costUsd),
      ]);
    } else {
      const color = PROVIDER_COLORS[r.error.provider];
      table.push([
        color(r.error.provider),
        r.error.model,
        chalk.red("✗"),
        `${r.error.durationMs}ms`,
        "-",
        "-",
        "-",
        "-",
      ]);
    }
  }
  return table.toString();
}

export function formatSideBySide(results: ProviderResult[]): string {
  const table = new Table({
    head: results.map((r) => {
      const provider = r.ok ? r.value.provider : r.error.provider;
      const model = r.ok ? r.value.model : r.error.model;
      const color = PROVIDER_COLORS[provider];
      return color.bold(`${provider}\n${chalk.dim(model)}`);
    }),
    colWidths: results.map(() => Math.floor(100 / results.length)),
    wordWrap: true,
    style: { head: [], border: ["gray"] },
  });

  table.push(
    results.map((r) =>
      r.ok ? r.value.text : chalk.red(`Error: ${r.error.message}`),
    ),
  );
  return table.toString();
}

export function toJsonReport(prompt: string, results: ProviderResult[]) {
  return {
    prompt,
    timestamp: new Date().toISOString(),
    results: results.map((r) =>
      r.ok
        ? { status: "success" as const, ...r.value }
        : { status: "error" as const, ...r.error },
    ),
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "…";
}
