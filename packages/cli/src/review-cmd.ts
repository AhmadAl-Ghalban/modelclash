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
import {
  parseProviderList,
  filterProviders,
  pickProvidersInteractive,
} from "./select.js";
import { buildProjectContext, buildReviewPrompt } from "./project-context.js";

interface ReviewCliOptions {
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
  maxBytes?: number;
}

const DEFAULT_REQUEST =
  "Perform a thorough code review of this project. Identify bugs, security issues, design concerns, and concrete improvements. Reference specific files and lines.";

export function buildReviewCommand(): Command {
  return new Command("review")
    .description("Review a coding project at <path> using all configured providers")
    .argument("<path>", "Path to the project folder")
    .argument("[request...]", "What to review or look for (defaults to a general code review)")
    .option("-p, --providers <list>", "Comma-separated providers (e.g. openai,groq)")
    .option("--model-openai <model>", `OpenAI model (default: ${DEFAULT_MODELS.openai})`)
    .option("--model-anthropic <model>", `Anthropic model (default: ${DEFAULT_MODELS.anthropic})`)
    .option("--model-google <model>", `Google model (default: ${DEFAULT_MODELS.google})`)
    .option("--model-groq <model>", `Groq model (default: ${DEFAULT_MODELS.groq})`)
    .option("--model-deepseek <model>", `DeepSeek model (default: ${DEFAULT_MODELS.deepseek})`)
    .option("--model-ollama <model>", `Ollama model (default: ${DEFAULT_MODELS.ollama})`)
    .option("-t, --temperature <number>", "Sampling temperature", parseFloat)
    .option("--stream", "Stream responses (sequential)")
    .option("--json", "Output JSON only", false)
    .option("--save <file>", "Save report to file")
    .option("--timeout <ms>", "Request timeout in ms", (v) => parseInt(v, 10))
    .option("--max-bytes <n>", "Max total bytes of source to include", (v) => parseInt(v, 10))
    .action(async (path: string, requestParts: string[], opts: ReviewCliOptions) => {
      try {
        const request = requestParts.join(" ").trim() || DEFAULT_REQUEST;
        await runReview(path, request, opts);
      } catch (err) {
        console.error(chalk.red("Fatal:"), (err as Error).message);
        process.exit(1);
      }
    });
}

async function runReview(
  path: string,
  request: string,
  opts: ReviewCliOptions,
): Promise<void> {
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
      "No API keys configured. Run `modelclash config init` or set provider API keys.",
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

  if (providers.length === 0) throw new Error("No providers selected.");

  if (!opts.json) {
    console.log(chalk.dim(`Scanning ${path}…`));
  }
  const ctx = await buildProjectContext(path, opts.maxBytes);
  if (ctx.filesIncluded === 0) {
    throw new Error(`No reviewable source files found under ${ctx.root}`);
  }
  if (!opts.json) {
    console.log(
      chalk.dim(
        `  ${ctx.filesIncluded} files · ${(ctx.bytesIncluded / 1024).toFixed(1)}KB${ctx.truncated ? " (truncated)" : ""}${ctx.filesSkipped > 0 ? ` · ${ctx.filesSkipped} skipped` : ""}`,
      ),
    );
  }

  const prompt = buildReviewPrompt(ctx, request);

  if (!opts.json) {
    console.log(formatHeader(`[review ${ctx.root}] ${request}`));
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

  const report = toJsonReport(`[review ${ctx.root}] ${request}`, results);

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
