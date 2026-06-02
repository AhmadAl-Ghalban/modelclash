import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { writeFile, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import {
  loadConfig,
  resolveSettings,
  buildProvidersFromSettings,
  configuredProvidersFromSettings,
  DEFAULT_MODELS,
  formatCost,
  type ChatMessage,
  type LLMProvider,
  type ProviderName,
  type ProviderResponse,
  type ProviderResult,
  type ResolvedSettings,
} from "@modelclash/core";
import {
  parseProviderList,
  filterProviders,
  pickProvidersInteractive,
} from "./select.js";
import { PROVIDER_COLORS, formatTurnSummary } from "./formatter.js";

const ALL_PROVIDERS: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "deepseek",
  "ollama",
];

interface ChatCliOptions {
  modelOpenai?: string;
  modelAnthropic?: string;
  modelGoogle?: string;
  modelGroq?: string;
  modelDeepseek?: string;
  modelOllama?: string;
  temperature?: number;
  timeout?: number;
  providers?: string;
  noStream?: boolean;
  system?: string;
}

interface SessionStats {
  turns: number;
  tokens: number;
  costUsd: number;
  byProvider: Partial<Record<ProviderName, { tokens: number; costUsd: number; turns: number }>>;
}

interface ChatState {
  selected: ProviderName[];
  providers: LLMProvider[];
  settings: ResolvedSettings;
  systemPrompt?: string;
  history: ChatMessage[];
  stream: boolean;
  stats: SessionStats;
}

export function buildChatCommand(): Command {
  return new Command("chat")
    .description("Interactive multi-turn chat against selected providers")
    .option("-p, --providers <list>", "Comma-separated providers (e.g. openai,groq)")
    .option("--model-openai <model>", `OpenAI model (default: ${DEFAULT_MODELS.openai})`)
    .option("--model-anthropic <model>", `Anthropic model (default: ${DEFAULT_MODELS.anthropic})`)
    .option("--model-google <model>", `Google model (default: ${DEFAULT_MODELS.google})`)
    .option("--model-groq <model>", `Groq model (default: ${DEFAULT_MODELS.groq})`)
    .option("--model-deepseek <model>", `DeepSeek model (default: ${DEFAULT_MODELS.deepseek})`)
    .option("--model-ollama <model>", `Ollama model (default: ${DEFAULT_MODELS.ollama})`)
    .option("-t, --temperature <number>", "Sampling temperature", parseFloat)
    .option("--timeout <ms>", "Request timeout in ms", (v) => parseInt(v, 10))
    .option("--no-stream", "Disable streaming output")
    .option("-s, --system <prompt>", "System prompt prepended to history")
    .action(async (opts: ChatCliOptions) => {
      try {
        await runChat(opts);
      } catch (err) {
        if ((err as { code?: string }).code === "ERR_USE_AFTER_CLOSE") return;
        if ((err as Error).name === "ExitPromptError") return;
        console.error(chalk.red("Error:"), (err as Error).message);
        process.exit(1);
      }
    });
}

async function runChat(opts: ChatCliOptions): Promise<void> {
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
  });

  const available = configuredProvidersFromSettings(settings);
  if (available.length === 0) {
    throw new Error(
      "No API keys configured. Run `modelclash config init` or set OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / GROQ_API_KEY.",
    );
  }

  let selected: ProviderName[];
  if (opts.providers) {
    const requested = parseProviderList(opts.providers);
    const missing = requested.filter((p) => !available.includes(p));
    if (missing.length > 0) {
      console.log(chalk.yellow(`  ⚠  skipping (no API key): ${missing.join(", ")}`));
    }
    selected = requested.filter((p) => available.includes(p));
  } else {
    selected = await pickProvidersInteractive(available);
  }

  if (selected.length === 0) throw new Error("No providers selected.");

  const all = buildProvidersFromSettings(settings);
  const state: ChatState = {
    selected,
    providers: filterProviders(all, selected),
    settings,
    systemPrompt: opts.system,
    history: [],
    stream: opts.noStream !== true,
    stats: { turns: 0, tokens: 0, costUsd: 0, byProvider: {} },
  };

  printWelcome(state);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let exited = false;
  rl.on("close", () => {
    exited = true;
  });

  while (!exited) {
    let input: string;
    try {
      input = await readPrompt(rl);
    } catch {
      break;
    }
    if (exited) break;
    if (input.length === 0) continue;

    if (input.startsWith("/")) {
      const handled = await handleSlash(input, state);
      if (handled === "exit") break;
      if (handled === "handled") continue;
    }

    await runTurn(state, input);
  }

  rl.close();
  printGoodbye(state);
}

async function readPrompt(rl: ReturnType<typeof createInterface>): Promise<string> {
  const lines: string[] = [];
  while (true) {
    const isContinuation = lines.length > 0;
    const prompt = isContinuation
      ? chalk.dim("· ")
      : chalk.bold.cyan("› ");
    const line = await rl.question(prompt);
    if (line.endsWith("\\")) {
      lines.push(line.slice(0, -1));
      continue;
    }
    lines.push(line);
    return lines.join("\n").trim();
  }
}

type SlashResult = "handled" | "exit" | "passthrough";

async function handleSlash(input: string, state: ChatState): Promise<SlashResult> {
  const [cmd, ...rest] = input.split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd) {
    case "/exit":
    case "/quit":
    case "/q":
      return "exit";

    case "/help":
    case "/?":
      printHelp();
      return "handled";

    case "/clear":
      process.stdout.write("\x1Bc");
      printWelcome(state);
      return "handled";

    case "/reset":
      state.history.length = 0;
      console.log(chalk.dim("  ✓ history cleared"));
      return "handled";

    case "/history":
      printHistory(state.history);
      return "handled";

    case "/providers":
      printProviders(state);
      return "handled";

    case "/stats":
      printStats(state);
      return "handled";

    case "/stream": {
      state.stream = !state.stream;
      console.log(chalk.dim(`  ✓ streaming ${state.stream ? "on" : "off"}`));
      return "handled";
    }

    case "/temp":
    case "/temperature": {
      const n = Number.parseFloat(arg);
      if (Number.isNaN(n)) {
        console.log(chalk.dim(`  temperature = ${state.settings.temperature}`));
      } else {
        state.settings.temperature = n;
        console.log(chalk.dim(`  ✓ temperature = ${n}`));
      }
      return "handled";
    }

    case "/system": {
      if (arg.length === 0) {
        console.log(chalk.dim(`  system = ${state.systemPrompt ?? "(none)"}`));
      } else if (arg === "off" || arg === "none") {
        state.systemPrompt = undefined;
        console.log(chalk.dim(`  ✓ system prompt cleared`));
      } else {
        state.systemPrompt = arg;
        console.log(chalk.dim(`  ✓ system prompt set`));
      }
      return "handled";
    }

    case "/model": {
      const [providerArg, ...modelParts] = rest;
      const model = modelParts.join(" ").trim();
      if (!providerArg || !model) {
        console.log(chalk.dim("  usage: /model <provider> <model-name>"));
        return "handled";
      }
      if (!ALL_PROVIDERS.includes(providerArg as ProviderName)) {
        console.log(chalk.red(`  unknown provider: ${providerArg}`));
        return "handled";
      }
      state.settings.models[providerArg as ProviderName] = model;
      console.log(chalk.dim(`  ✓ ${providerArg} model = ${model}`));
      return "handled";
    }

    case "/save": {
      if (!arg) {
        console.log(chalk.dim("  usage: /save <path>"));
        return "handled";
      }
      const payload = {
        savedAt: new Date().toISOString(),
        providers: state.selected,
        models: Object.fromEntries(
          state.selected.map((p) => [p, state.settings.models[p]]),
        ),
        systemPrompt: state.systemPrompt,
        history: state.history,
        stats: state.stats,
      };
      await writeFile(arg, JSON.stringify(payload, null, 2), "utf8");
      console.log(chalk.dim(`  ✓ saved → ${arg}`));
      return "handled";
    }

    case "/load": {
      if (!arg) {
        console.log(chalk.dim("  usage: /load <path>"));
        return "handled";
      }
      const raw = await readFile(arg, "utf8");
      const data = JSON.parse(raw) as { history?: ChatMessage[]; systemPrompt?: string };
      state.history = data.history ?? [];
      if (data.systemPrompt) state.systemPrompt = data.systemPrompt;
      console.log(chalk.dim(`  ✓ loaded ${state.history.length} message(s) ← ${arg}`));
      return "handled";
    }

    default:
      console.log(chalk.dim(`  unknown command: ${cmd} (try /help)`));
      return "handled";
  }
}

async function runTurn(state: ChatState, input: string): Promise<void> {
  const turnResults: ProviderResult[] = [];
  const baseHistory = buildHistoryForRequest(state);

  console.log();
  for (const provider of state.providers) {
    const res = await runOne(provider, state, input, baseHistory);
    turnResults.push(res);
  }

  if (turnResults.length > 1 || turnResults.some((r) => !r.ok)) {
    console.log(chalk.bold("  Turn summary"));
    console.log(indentBlock(formatTurnSummary(turnResults), 2));
    console.log();
  }

  printTurnDivider();

  const ok = turnResults.filter(
    (r): r is { ok: true; value: ProviderResponse } => r.ok,
  );
  if (ok.length === 0) {
    console.log(chalk.red("  all providers failed; history not updated"));
    return;
  }

  state.stats.turns += 1;
  for (const r of ok) {
    state.stats.tokens += r.value.usage.total;
    state.stats.costUsd += r.value.costUsd;
    const bp = state.stats.byProvider[r.value.provider] ?? {
      tokens: 0,
      costUsd: 0,
      turns: 0,
    };
    bp.tokens += r.value.usage.total;
    bp.costUsd += r.value.costUsd;
    bp.turns += 1;
    state.stats.byProvider[r.value.provider] = bp;
  }

  state.history.push({ role: "user", content: input });
  if (ok.length === 1) {
    state.history.push({ role: "assistant", content: ok[0].value.text });
  } else {
    const joined = ok
      .map((r) => `[${r.value.provider}] ${r.value.text}`)
      .join("\n\n");
    state.history.push({ role: "assistant", content: joined });
  }
}

function buildHistoryForRequest(state: ChatState): ChatMessage[] {
  if (!state.systemPrompt) return [...state.history];
  return [
    { role: "user", content: `[system]\n${state.systemPrompt}` },
    { role: "assistant", content: "Understood." },
    ...state.history,
  ];
}

async function runOne(
  provider: LLMProvider,
  state: ChatState,
  prompt: string,
  history: ChatMessage[],
): Promise<ProviderResult> {
  const color = PROVIDER_COLORS[provider.name];
  const model = state.settings.models[provider.name];
  printProviderHeader(provider.name, model, color);

  const start = Date.now();
  const req = {
    prompt,
    history,
    model,
    temperature: state.settings.temperature,
    timeoutMs: state.settings.timeoutMs,
  };

  try {
    if (state.stream && provider.streamGenerate) {
      let first = true;
      const res = await provider.streamGenerate(req, (chunk) => {
        if (first) {
          process.stdout.write("  ");
          first = false;
        }
        process.stdout.write(chunk.replace(/\n/g, "\n  "));
      });
      process.stdout.write("\n");
      printFooter(res, Date.now() - start);
      return { ok: true, value: res };
    }

    const spinner = ora({
      text: chalk.dim(`  thinking…`),
      spinner: "dots",
    }).start();
    try {
      const res = await provider.generate(req);
      spinner.stop();
      console.log(indent(res.text));
      printFooter(res, Date.now() - start);
      return { ok: true, value: res };
    } catch (err) {
      spinner.stop();
      throw err;
    }
  } catch (err) {
    const message = (err as Error).message;
    console.log(chalk.red(`  ✗ ${message}\n`));
    return {
      ok: false,
      error: {
        provider: provider.name,
        model,
        message,
        durationMs: Date.now() - start,
      },
    };
  }
}

function printProviderHeader(
  name: ProviderName,
  model: string,
  color: (s: string) => string,
): void {
  const label = `${color("●")} ${color.call(chalk, name)} ${chalk.dim(`· ${model}`)}`;
  console.log(`  ${label}`);
}

function printFooter(res: ProviderResponse, durationMs: number): void {
  const parts = [
    `${res.usage.input}↑ ${res.usage.output}↓ tok`,
    formatCost(res.costUsd),
    `${(durationMs / 1000).toFixed(2)}s`,
  ];
  console.log(chalk.dim(`  ↳ ${parts.join("  ·  ")}\n`));
}

function printWelcome(state: ChatState): void {
  const width = 64;
  const top = "╭" + "─".repeat(width - 2) + "╮";
  const bot = "╰" + "─".repeat(width - 2) + "╯";
  const pad = (s: string, visibleLen: number) =>
    "│  " + s + " ".repeat(Math.max(0, width - 4 - visibleLen)) + "│";

  console.log();
  console.log(chalk.cyan(top));
  console.log(chalk.cyan(pad(chalk.bold("⚔  modelclash chat"), 19)));
  console.log(chalk.cyan(pad("", 0)));
  for (const name of state.selected) {
    const color = PROVIDER_COLORS[name];
    const model = state.settings.models[name];
    const visible = `●  ${name}  ${model}`;
    const styled = `${color("●")}  ${color(name)}  ${chalk.dim(model)}`;
    console.log(chalk.cyan(pad(styled, visible.length)));
  }
  console.log(chalk.cyan(pad("", 0)));
  const hint = `${state.stream ? "streaming" : "non-streaming"}  ·  temp ${state.settings.temperature}  ·  /help`;
  console.log(chalk.cyan(pad(chalk.dim(hint), hint.length)));
  console.log(chalk.cyan(bot));
}

function printGoodbye(state: ChatState): void {
  console.log();
  if (state.stats.turns > 0) {
    console.log(
      chalk.dim(
        `  session: ${state.stats.turns} turns · ${state.stats.tokens} tokens · ${formatCost(state.stats.costUsd)}`,
      ),
    );
  }
  console.log(chalk.dim("  bye\n"));
}

function printHelp(): void {
  const rows: [string, string][] = [
    ["/help, /?", "show this list"],
    ["/exit, /q", "leave the chat (or Ctrl+D)"],
    ["/clear", "clear the screen"],
    ["/reset", "clear conversation history"],
    ["/history", "print conversation history"],
    ["/providers", "list selected providers + models"],
    ["/stats", "session totals (tokens, cost)"],
    ["/stream", "toggle streaming on/off"],
    ["/temp <n>", "change sampling temperature"],
    ["/system <text>", "set system prompt (or 'off' to clear)"],
    ["/model <provider> <name>", "switch a provider's model"],
    ["/save <path>", "save conversation to JSON"],
    ["/load <path>", "load conversation from JSON"],
    ["end line with \\", "multi-line input"],
  ];
  console.log();
  for (const [cmd, desc] of rows) {
    console.log(`  ${chalk.cyan(cmd.padEnd(24))} ${chalk.dim(desc)}`);
  }
}

function printProviders(state: ChatState): void {
  console.log();
  for (const name of state.selected) {
    const color = PROVIDER_COLORS[name];
    console.log(
      `  ${color("●")} ${color(name)} ${chalk.dim(`· ${state.settings.models[name]}`)}`,
    );
  }
}

function printStats(state: ChatState): void {
  const { stats } = state;
  console.log();
  console.log(
    chalk.dim(
      `  total: ${stats.turns} turns · ${stats.tokens} tokens · ${formatCost(stats.costUsd)}`,
    ),
  );
  for (const name of state.selected) {
    const bp = stats.byProvider[name];
    if (!bp) continue;
    const color = PROVIDER_COLORS[name];
    console.log(
      `  ${color("●")} ${color(name).padEnd(20)} ${chalk.dim(
        `${bp.turns} turns · ${bp.tokens} tok · ${formatCost(bp.costUsd)}`,
      )}`,
    );
  }
}

function printHistory(history: ChatMessage[]): void {
  if (history.length === 0) {
    console.log(chalk.dim("  (empty)"));
    return;
  }
  console.log();
  for (const m of history) {
    const tag =
      m.role === "user"
        ? chalk.bold.cyan("you")
        : chalk.bold.magenta("assistant");
    const body = m.content.split("\n").join("\n         ");
    console.log(`  ${tag}: ${body}`);
  }
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => "  " + l)
    .join("\n");
}

function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((l) => pad + l).join("\n");
}

function printTurnDivider(): void {
  const width = Math.min(process.stdout.columns ?? 64, 64);
  console.log(chalk.dim("─".repeat(width)));
}
