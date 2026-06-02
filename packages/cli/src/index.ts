#!/usr/bin/env node
import { loadDotenv } from "./env.js";
loadDotenv();
import { Command } from "commander";
import chalk from "chalk";
import { writeFile } from "node:fs/promises";
import {
  runPrompt,
  loadConfig,
  resolveSettings,
  buildProvidersFromSettings,
  configuredProvidersFromSettings,
  DEFAULT_MODELS,
} from "@modelclash/core";
import {
  formatHeader,
  formatResponses,
  formatSummaryTable,
  toJsonReport,
} from "./formatter.js";
import { buildConfigCommand } from "./config-cmd.js";
import { buildChatCommand } from "./chat-cmd.js";
import {
  parseProviderList,
  filterProviders,
  pickProvidersInteractive,
} from "./select.js";

interface PromptCliOptions {
  modelOpenai?: string;
  modelAnthropic?: string;
  modelGoogle?: string;
  modelGroq?: string;
  modelDeepseek?: string;
  modelOllama?: string;
  temperature?: number;
  stream?: boolean;
  json: boolean;
  save?: string;
  timeout?: number;
  providers?: string;
}

const program = new Command();

program
  .name("modelclash")
  .description("Compare responses from OpenAI, Anthropic, and Google models side-by-side")
  .version("1.0.0")
  .argument("<prompt>", "The prompt to send to all providers")
  .option("--model-openai <model>", `OpenAI model (default: ${DEFAULT_MODELS.openai})`)
  .option("--model-anthropic <model>", `Anthropic model (default: ${DEFAULT_MODELS.anthropic})`)
  .option("--model-google <model>", `Google model (default: ${DEFAULT_MODELS.google})`)
  .option("--model-groq <model>", `Groq model (default: ${DEFAULT_MODELS.groq})`)
  .option("--model-deepseek <model>", `DeepSeek model (default: ${DEFAULT_MODELS.deepseek})`)
  .option("--model-ollama <model>", `Ollama model (default: ${DEFAULT_MODELS.ollama})`)
  .option("-p, --providers <list>", "Comma-separated providers to use (e.g. openai,groq)")
  .option("-t, --temperature <number>", "Sampling temperature", parseFloat)
  .option("--stream", "Stream responses (sequential)")
  .option("--json", "Output JSON only", false)
  .option("--save <file>", "Save report to file")
  .option("--timeout <ms>", "Request timeout in ms", (v) => parseInt(v, 10))
  .action(async (prompt: string, rawOpts: PromptCliOptions) => {
    try {
      await runCli(prompt, rawOpts);
    } catch (err) {
      console.error(chalk.red("Fatal:"), (err as Error).message);
      process.exit(1);
    }
  });

program.addCommand(buildConfigCommand());
program.addCommand(buildChatCommand());

async function runCli(prompt: string, opts: PromptCliOptions): Promise<void> {
  const config = await loadConfig();
  const settings = resolveSettings(config, process.env, {
    modelOpenai: opts.modelOpenai,
    modelAnthropic: opts.modelAnthropic,
    modelGoogle: opts.modelGoogle,
    modelGroq: opts.modelGroq,
    modelDeepseek: opts.modelDeepseek,
    modelOllama: opts.modelOllama,
    temperature: opts.temperature,
    timeoutMs: opts.timeout,
    stream: opts.stream,
  });

  const allProviders = buildProvidersFromSettings(settings);
  if (allProviders.length === 0) {
    throw new Error(
      "No API keys configured. Run `modelclash config init`, set apiKeys in your config, or export OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / GROQ_API_KEY / DEEPSEEK_API_KEY / OLLAMA_BASE_URL.",
    );
  }

  const available = configuredProvidersFromSettings(settings);
  let providers = allProviders;
  if (opts.providers) {
    const requested = parseProviderList(opts.providers);
    const missing = requested.filter((p) => !available.includes(p));
    if (missing.length > 0 && !opts.json) {
      console.log(chalk.yellow(`Skipping (no API key): ${missing.join(", ")}`));
    }
    providers = filterProviders(allProviders, requested);
  } else if (!opts.json && process.stdin.isTTY && available.length > 1) {
    const selected = await pickProvidersInteractive(available);
    providers = filterProviders(allProviders, selected);
  }

  if (providers.length === 0) {
    throw new Error("No providers selected.");
  }

  if (!opts.json) {
    console.log(formatHeader(prompt));
  }

  const results = await runPrompt({
    prompt,
    providers,
    modelFor: settings.models,
    temperature: settings.temperature,
    timeoutMs: settings.timeoutMs,
    stream: settings.stream,
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

program.parseAsync(process.argv);
