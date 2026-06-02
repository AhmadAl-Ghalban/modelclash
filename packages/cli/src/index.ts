#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import { writeFile } from "node:fs/promises";
import {
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  runPrompt,
  type LLMProvider,
  type ProviderName,
} from "@modelclash/core";
import {
  formatHeader,
  formatResponses,
  formatSummaryTable,
  toJsonReport,
} from "./formatter.js";

interface CliOptions {
  modelOpenai: string;
  modelAnthropic: string;
  modelGoogle: string;
  temperature: number;
  stream: boolean;
  json: boolean;
  save?: string;
  timeout: number;
}

const DEFAULTS = {
  openai: process.env.DEFAULT_OPENAI_MODEL ?? "gpt-4o",
  anthropic: process.env.DEFAULT_ANTHROPIC_MODEL ?? "claude-sonnet-4",
  google: process.env.DEFAULT_GOOGLE_MODEL ?? "gemini-2.5-pro",
};

const program = new Command();

program
  .name("modelclash")
  .description("Compare responses from OpenAI, Anthropic, and Google models side-by-side")
  .version("1.0.0")
  .argument("<prompt>", "The prompt to send to all providers")
  .option("--model-openai <model>", "OpenAI model", DEFAULTS.openai)
  .option("--model-anthropic <model>", "Anthropic model", DEFAULTS.anthropic)
  .option("--model-google <model>", "Google model", DEFAULTS.google)
  .option("-t, --temperature <number>", "Sampling temperature", parseFloat, 0.7)
  .option("--stream", "Stream responses (sequential)", false)
  .option("--json", "Output JSON only", false)
  .option("--save <file>", "Save report to file")
  .option(
    "--timeout <ms>",
    "Request timeout in ms",
    (v) => parseInt(v, 10),
    parseInt(process.env.REQUEST_TIMEOUT_MS ?? "60000", 10),
  )
  .action(async (prompt: string, rawOpts) => {
    const opts: CliOptions = {
      modelOpenai: rawOpts.modelOpenai,
      modelAnthropic: rawOpts.modelAnthropic,
      modelGoogle: rawOpts.modelGoogle,
      temperature: rawOpts.temperature,
      stream: rawOpts.stream,
      json: rawOpts.json,
      save: rawOpts.save,
      timeout: rawOpts.timeout,
    };
    try {
      await run(prompt, opts);
    } catch (err) {
      console.error(chalk.red("Fatal:"), (err as Error).message);
      process.exit(1);
    }
  });

async function run(prompt: string, opts: CliOptions): Promise<void> {
  const providers = buildProviders();

  if (providers.length === 0) {
    throw new Error(
      "No API keys configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY.",
    );
  }

  if (!opts.json) {
    console.log(formatHeader(prompt));
  }

  const modelFor: Record<ProviderName, string> = {
    openai: opts.modelOpenai,
    anthropic: opts.modelAnthropic,
    google: opts.modelGoogle,
  };

  const results = await runPrompt({
    prompt,
    providers,
    modelFor,
    temperature: opts.temperature,
    timeoutMs: opts.timeout,
    stream: opts.stream,
    onChunk: opts.json
      ? undefined
      : (_, chunk) => process.stdout.write(chalk.dim(chunk)),
  });

  const report = toJsonReport(prompt, results);

  if (opts.json) {
    const output = JSON.stringify(report, null, 2);
    console.log(output);
    if (opts.save) await writeFile(opts.save, output, "utf8");
    return;
  }

  console.log("\n" + formatResponses(results));
  console.log("\n" + chalk.bold("Summary"));
  console.log(formatSummaryTable(results));

  if (opts.save) {
    await writeFile(opts.save, JSON.stringify(report, null, 2), "utf8");
    console.log(chalk.dim(`\nSaved report to ${opts.save}`));
  }

  const allFailed = results.every((r) => !r.ok);
  if (allFailed) process.exit(1);
}

function buildProviders(): LLMProvider[] {
  const out: LLMProvider[] = [];
  if (process.env.OPENAI_API_KEY) {
    out.push(new OpenAIProvider(process.env.OPENAI_API_KEY));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    out.push(new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
  }
  if (process.env.GOOGLE_API_KEY) {
    out.push(new GoogleProvider(process.env.GOOGLE_API_KEY));
  }
  return out;
}

program.parseAsync(process.argv);
