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
  pickModelsInteractive,
  pickModelInteractive,
  pickProviderInteractive,
  pickEffortInteractive,
  MODELS_WITH_EFFORT,
  type EffortLevel,
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
  effort: Partial<Record<ProviderName, EffortLevel>>;
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
    .action(async function (this: Command, opts: ChatCliOptions) {
      try {
        const parentOpts = (this.parent?.opts() ?? {}) as Partial<ChatCliOptions> & {
          providers?: string;
        };
        const merged: ChatCliOptions = { ...parentOpts, ...opts };
        await runChat(merged);
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

  const explicitModel: Partial<Record<ProviderName, boolean>> = {
    openai: opts.modelOpenai !== undefined,
    anthropic: opts.modelAnthropic !== undefined,
    google: opts.modelGoogle !== undefined,
    groq: opts.modelGroq !== undefined,
    deepseek: opts.modelDeepseek !== undefined,
    ollama: opts.modelOllama !== undefined,
  };
  const needsPick = selected.some((p) => !explicitModel[p]);
  const effort: Partial<Record<ProviderName, EffortLevel>> = {};
  if (needsPick && process.stdin.isTTY) {
    const picks = await pickModelsInteractive(selected, settings.models, explicitModel);
    for (const [name, model] of Object.entries(picks)) {
      if (!model) continue;
      const p = name as ProviderName;
      settings.models[p] = model;
      if (MODELS_WITH_EFFORT[model]) {
        effort[p] = await pickEffortInteractive(p, model);
      }
    }
  }

  const all = buildProvidersFromSettings(settings);
  const state: ChatState = {
    selected,
    providers: filterProviders(all, selected),
    settings,
    effort,
    systemPrompt: opts.system,
    history: [],
    stream: opts.noStream !== true,
    stats: { turns: 0, tokens: 0, costUsd: 0, byProvider: {} },
  };

  printWelcome(state);

  while (true) {
    let input: string;
    try {
      input = await readPrompt();
    } catch {
      break;
    }
    if (input.length === 0) continue;

    if (input.startsWith("/")) {
      const handled = await handleSlash(input, state);
      if (handled === "exit") break;
      if (handled === "handled") continue;
    }

    await runTurn(state, input);
  }

  printGoodbye(state);
}

const SLASH_COMMANDS: { name: string; desc: string }[] = [
  { name: "/help", desc: "show command list" },
  { name: "/model", desc: "switch provider/model (interactive)" },
  { name: "/effort", desc: "set reasoning effort (low|medium|high)" },
  { name: "/providers", desc: "list selected providers + models" },
  { name: "/stream", desc: "toggle streaming on/off" },
  { name: "/temp", desc: "change sampling temperature" },
  { name: "/system", desc: "set/clear system prompt" },
  { name: "/history", desc: "print conversation history" },
  { name: "/stats", desc: "session totals (tokens, cost)" },
  { name: "/retry", desc: "re-run the last user message" },
  { name: "/clear", desc: "clear the screen" },
  { name: "/reset", desc: "clear conversation history" },
  { name: "/save", desc: "save transcript (.md or .json)" },
  { name: "/load", desc: "load conversation from JSON" },
  { name: "/exit", desc: "leave the chat" },
];

async function promptLine(message: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(message);
  } finally {
    rl.close();
  }
}

async function readPrompt(): Promise<string> {
  if (!process.stdin.isTTY) return readPromptLine();
  return readPromptRaw();
}

async function readPromptLine(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];
  try {
    while (true) {
      const isContinuation = lines.length > 0;
      const prompt = isContinuation ? chalk.dim("· ") : chalk.bold.cyan("› ");
      const line = await rl.question(prompt);
      if (line.endsWith("\\")) {
        lines.push(line.slice(0, -1));
        continue;
      }
      lines.push(line);
      return lines.join("\n").trim();
    }
  } finally {
    rl.close();
  }
}

function readPromptRaw(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const promptStr = chalk.bold.cyan("› ");
    const promptVisibleLen = 2;

    let buffer = "";
    let menuIdx = 0;
    let linesBelow = 0;

    const menuOpen = () => buffer.startsWith("/");
    const filtered = () =>
      menuOpen()
        ? SLASH_COMMANDS.filter((c) => c.name.startsWith(buffer.toLowerCase()))
        : [];

    const eraseBelow = () => {
      if (linesBelow > 0) {
        stdout.write(`\x1b[${linesBelow}B`);
        for (let i = 0; i < linesBelow; i++) {
          stdout.write("\r\x1b[2K");
          if (i < linesBelow - 1) stdout.write("\x1b[1A");
        }
        stdout.write(`\x1b[${linesBelow - 1}A`);
      }
      linesBelow = 0;
    };

    const render = () => {
      eraseBelow();
      stdout.write("\r\x1b[2K" + promptStr + buffer);

      const matches = filtered();
      if (matches.length === 0) return;

      if (menuIdx >= matches.length) menuIdx = matches.length - 1;
      if (menuIdx < 0) menuIdx = 0;

      const maxRows = Math.min(matches.length, 8);
      const lines: string[] = [];
      const nameWidth = Math.max(...matches.map((m) => m.name.length));
      for (let i = 0; i < maxRows; i++) {
        const m = matches[i];
        const isCur = i === menuIdx;
        const cursor = isCur ? chalk.cyan("❯ ") : "  ";
        const name = isCur ? chalk.cyan.bold(m.name) : m.name;
        const pad = " ".repeat(Math.max(0, nameWidth - m.name.length));
        lines.push(`${cursor}${name}${pad}  ${chalk.dim(m.desc)}`);
      }
      if (matches.length > maxRows) {
        lines.push(chalk.dim(`  …${matches.length - maxRows} more`));
      }

      for (const l of lines) {
        stdout.write("\n" + l);
      }
      linesBelow = lines.length;

      stdout.write(`\x1b[${linesBelow}A`);
      const col = promptVisibleLen + buffer.length + 1;
      stdout.write(`\r\x1b[${col}G`);
    };

    const cleanup = () => {
      eraseBelow();
      stdin.removeListener("data", onData);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    };

    const finishLine = (out: string) => {
      cleanup();
      stdout.write("\n");
      resolve(out);
    };

    const onData = (chunk: Buffer | string) => {
      const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const code = s.charCodeAt(i);

        if (ch === "\x03") {
          cleanup();
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\x04") {
          if (buffer.length === 0) {
            cleanup();
            stdout.write("\n");
            return reject(new Error("EOF"));
          }
          continue;
        }
        if (ch === "\x1b") {
          if (i + 2 < s.length && s[i + 1] === "[") {
            const k = s[i + 2];
            i += 2;
            if (menuOpen()) {
              if (k === "A") {
                menuIdx = Math.max(0, menuIdx - 1);
                render();
                continue;
              }
              if (k === "B") {
                menuIdx = Math.min(filtered().length - 1, menuIdx + 1);
                render();
                continue;
              }
            }
            continue;
          }
          if (menuOpen()) {
            buffer = "";
            menuIdx = 0;
            render();
          }
          continue;
        }
        if (ch === "\t") {
          if (menuOpen()) {
            const m = filtered()[menuIdx];
            if (m) {
              buffer = m.name + " ";
              render();
            }
          }
          continue;
        }
        if (ch === "\r" || ch === "\n") {
          if (menuOpen()) {
            const m = filtered()[menuIdx];
            if (m) {
              return finishLine(m.name);
            }
          }
          return finishLine(buffer.trim());
        }
        if (code === 127 || code === 8) {
          buffer = buffer.slice(0, -1);
          menuIdx = 0;
          render();
          continue;
        }
        if (code < 32) continue;
        buffer += ch;
        if (ch === "/" || menuOpen()) menuIdx = 0;
        render();
      }
    };

    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdout.write(promptStr);
    stdin.on("data", onData);
  });
}

type SlashResult = "handled" | "exit" | "passthrough";

async function handleSlash(
  input: string,
  state: ChatState,
): Promise<SlashResult> {
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

    case "/retry": {
      let lastUser: string | undefined;
      for (let i = state.history.length - 1; i >= 0; i--) {
        if (state.history[i].role === "user") {
          lastUser = state.history[i].content;
          state.history.splice(i);
          break;
        }
      }
      if (!lastUser) {
        console.log(chalk.dim("  nothing to retry"));
        return "handled";
      }
      await runTurn(state, lastUser);
      return "handled";
    }

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

      let target: ProviderName;
      if (providerArg) {
        if (!ALL_PROVIDERS.includes(providerArg as ProviderName)) {
          console.log(chalk.red(`  unknown provider: ${providerArg}`));
          return "handled";
        }
        target = providerArg as ProviderName;
      } else if (state.selected.length === 1) {
        target = state.selected[0];
      } else {
        target = await pickProviderInteractive(state.selected);
      }

      const picked = model.length > 0
        ? model
        : await pickModelInteractive(target, state.settings.models[target]);
      state.settings.models[target] = picked;
      console.log(chalk.dim(`  ✓ ${target} model = ${picked}`));

      if (MODELS_WITH_EFFORT[picked]) {
        const eff = await pickEffortInteractive(
          target,
          picked,
          state.effort[target] ?? "medium",
        );
        state.effort[target] = eff;
        console.log(chalk.dim(`  ✓ ${target} effort = ${eff}`));
      } else if (state.effort[target]) {
        delete state.effort[target];
      }
      return "handled";
    }

    case "/effort": {
      const [providerArg, levelArg] = rest;
      if (!providerArg || !levelArg) {
        console.log(chalk.dim("  usage: /effort <provider> <low|medium|high>"));
        return "handled";
      }
      if (!ALL_PROVIDERS.includes(providerArg as ProviderName)) {
        console.log(chalk.red(`  unknown provider: ${providerArg}`));
        return "handled";
      }
      if (!["low", "medium", "high"].includes(levelArg)) {
        console.log(chalk.red(`  invalid level: ${levelArg}`));
        return "handled";
      }
      state.effort[providerArg as ProviderName] = levelArg as EffortLevel;
      console.log(chalk.dim(`  ✓ ${providerArg} effort = ${levelArg}`));
      return "handled";
    }

    case "/save": {
      if (state.history.length === 0) {
        console.log(chalk.dim("  nothing to save (history is empty)"));
        return "handled";
      }
      const path = arg || defaultMarkdownPath();
      const isMarkdown = path.toLowerCase().endsWith(".md");

      let scope: "full" | "last" = "full";
      if (isMarkdown) {
        const ans = (
          await promptLine(
            chalk.dim("  save full transcript or last response only? [full/last] (full) "),
          )
        )
          .trim()
          .toLowerCase();
        if (ans === "last" || ans === "l") scope = "last";
      }

      if (isMarkdown) {
        const md = renderMarkdown(state, scope);
        await writeFile(path, md, "utf8");
      } else {
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
        await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
      }
      console.log(chalk.dim(`  ✓ saved → ${path}`));
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
    reasoningEffort: state.effort[provider.name],
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
    ["/model [provider] [name]", "switch model (interactive if args omitted)"],
    ["/effort <provider> <lvl>", "set reasoning effort: low|medium|high"],
    ["/save [path]", "save transcript (.md → markdown, .json → JSON)"],
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

function defaultMarkdownPath(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `chat-${stamp}.md`;
}

function renderMarkdown(state: ChatState, scope: "full" | "last"): string {
  const lines: string[] = [];
  lines.push(`# modelclash chat`);
  lines.push(``);
  lines.push(`*Saved ${new Date().toISOString()}*`);
  lines.push(``);
  const providerList = state.selected
    .map((p) => `\`${p}\` (${state.settings.models[p]})`)
    .join(", ");
  lines.push(`**Providers:** ${providerList}`);
  if (state.systemPrompt) {
    lines.push(``);
    lines.push(`**System prompt:**`);
    lines.push(``);
    lines.push("> " + state.systemPrompt.split("\n").join("\n> "));
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  const messages =
    scope === "last" ? lastExchange(state.history) : state.history;
  for (const m of messages) {
    lines.push(m.role === "user" ? `## You` : `## Assistant`);
    lines.push(``);
    lines.push(m.content);
    lines.push(``);
  }

  if (scope === "full" && state.stats.turns > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(
      `*${state.stats.turns} turns · ${state.stats.tokens} tokens · ${formatCost(state.stats.costUsd)}*`,
    );
    lines.push(``);
  }
  return lines.join("\n");
}

function lastExchange(history: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    out.unshift(history[i]);
    if (history[i].role === "user") break;
  }
  return out;
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
