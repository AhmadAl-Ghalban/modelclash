import { checkbox, select, input } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { MODEL_CATALOG, MODELS_WITH_EFFORT, listModelsForProvider } from "@modelclash/core";
import type { LLMProvider, ModelInfo, ProviderName, ResolvedSettings } from "@modelclash/core";

const THEME = {
  prefix: { idle: chalk.cyan("◆"), done: chalk.green("✓") },
  spinner: {
    interval: 80,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  },
  style: {
    answer: (text: string) => chalk.cyan(text),
    message: (text: string) => chalk.bold(text),
    error: (text: string) => chalk.red(text),
    defaultAnswer: (text: string) => chalk.dim(text),
    help: (text: string) => chalk.dim(text),
    highlight: (text: string) => chalk.cyan.bold(text),
    key: (text: string) => chalk.cyan(`<${text}>`),
    disabled: (text: string) => chalk.gray.strikethrough(text),
    description: (text: string) => chalk.dim(text),
  },
  icon: {
    checked: chalk.green("◉"),
    unchecked: chalk.dim("◯"),
    cursor: chalk.cyan("❯"),
  },
};

const PROVIDER_LABEL: Record<ProviderName, { name: string; tag: string }> = {
  openai: { name: "OpenAI", tag: "GPT · o-series" },
  anthropic: { name: "Anthropic", tag: "Claude" },
  google: { name: "Google", tag: "Gemini" },
  groq: { name: "Groq", tag: "Llama · Mixtral · ultra-fast" },
  deepseek: { name: "DeepSeek", tag: "chat · reasoner" },
  ollama: { name: "Ollama", tag: "local · free" },
};

export function printSetupIntro(available: ProviderName[]): void {
  const cols = process.stdout.columns ?? 100;
  const w = Math.max(60, Math.min(cols, 100));
  const inner = w - 4;
  const top = chalk.cyan("╭─── setup " + "─".repeat(w - 11) + "╮");
  const bot = chalk.cyan("╰" + "─".repeat(w - 2) + "╯");
  const pad = (s: string, visLen: number) =>
    chalk.cyan("│ ") + s + " ".repeat(Math.max(0, inner - visLen)) + chalk.cyan(" │");

  const title = `${chalk.bold("⚔  modelclash")} ${chalk.dim("·  multi-LLM chat setup")}`;
  const titleVis = "⚔  modelclash ·  multi-LLM chat setup".length;
  const subtitle = chalk.dim("Pick the providers and models you want to chat with.");
  const subVis = "Pick the providers and models you want to chat with.".length;

  console.log();
  console.log(top);
  console.log(pad(title, titleVis));
  console.log(pad(subtitle, subVis));
  console.log(pad("", 0));
  console.log(pad(chalk.bold("Available providers"), 19));
  for (const p of available) {
    const meta = PROVIDER_LABEL[p];
    const line = `  ${chalk.green("●")} ${chalk.bold(meta.name.padEnd(10))} ${chalk.dim(meta.tag)}`;
    const lineVis = 2 + 2 + 10 + 1 + meta.tag.length;
    console.log(pad(line, lineVis));
  }
  console.log(pad("", 0));
  const hint = chalk.dim("space toggles · a all · i invert · ⏎ confirm");
  const hintVis = "space toggles · a all · i invert · ⏎ confirm".length;
  console.log(pad(hint, hintVis));
  console.log(bot);
  console.log();
}

const ALL: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "deepseek",
  "ollama",
];

/**
 * Offline model list per provider, from the shared catalog in @modelclash/core.
 * `pickModelInteractive` asks the provider for its live list first and only
 * falls back to this.
 */
export const MODELS_BY_PROVIDER: Record<ProviderName, string[]> = Object.fromEntries(
  (Object.keys(MODEL_CATALOG) as ProviderName[]).map((p) => [
    p,
    MODEL_CATALOG[p].models.map((m) => m.id),
  ]),
) as Record<ProviderName, string[]>;

export function parseProviderList(raw: string): ProviderName[] {
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const unknown = parts.filter((p) => !ALL.includes(p as ProviderName));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown provider(s): ${unknown.join(", ")}. Valid: ${ALL.join(", ")}`,
    );
  }
  return Array.from(new Set(parts)) as ProviderName[];
}

export function filterProviders(
  providers: LLMProvider[],
  selected: ProviderName[],
): LLMProvider[] {
  return providers.filter((p) => selected.includes(p.name));
}

export async function pickProvidersInteractive(
  available: ProviderName[],
): Promise<ProviderName[]> {
  if (available.length <= 1) return available;
  const selected = await checkbox<ProviderName>({
    message: "Which providers should answer?",
    choices: available.map((name) => {
      const meta = PROVIDER_LABEL[name];
      return {
        name: `${meta.name.padEnd(10)} ${chalk.dim(meta.tag)}`,
        value: name,
        checked: true,
        short: name,
      };
    }),
    required: true,
    loop: false,
    theme: THEME,
  });
  return selected;
}

export async function pickModelInteractive(
  provider: ProviderName,
  currentDefault: string,
  settings?: ResolvedSettings,
): Promise<string> {
  const meta = PROVIDER_LABEL[provider];

  /*
   * Ask the provider what it actually offers. Vendors ship models faster than a
   * bundled list can track, so the catalog is only the fallback — and the prompt
   * says which one you're looking at rather than implying the list is current.
   */
  let models: ModelInfo[] = MODEL_CATALOG[provider].models.map((m) => ({
    id: m.id,
    label: m.label,
    hint: m.hint,
  }));
  let note = chalk.dim("bundled list");

  if (settings) {
    const spinner = ora({ text: `Fetching ${meta.name} models…`, spinner: "dots" }).start();
    const result = await listModelsForProvider(provider, settings);
    models = result.models;
    if (result.source === "live") {
      spinner.succeed(`${meta.name}: ${models.length} models available`);
      note = chalk.dim("live from provider");
    } else {
      spinner.info(`${meta.name}: using bundled list (${result.reason})`);
      note = chalk.dim("bundled list");
    }
  }

  const known = models.map((m) => m.id);
  const choices = [
    ...models.map((m) => {
      const label = m.label && m.label !== m.id ? `${m.id}  ${chalk.dim(m.label)}` : m.id;
      return {
        name: m.id === currentDefault ? `${label} ${chalk.dim("· default")}` : label,
        value: m.id,
        short: m.id,
        description: m.hint,
      };
    }),
    { name: chalk.dim("✎  custom model name…"), value: "__custom__", short: "custom" },
  ];
  const picked = await select<string>({
    message: `Pick a model for ${chalk.cyan(meta.name)} ${note}`,
    choices,
    default: known.includes(currentDefault) ? currentDefault : known[0],
    loop: false,
    theme: THEME,
  });
  if (picked !== "__custom__") return picked;
  const typed = (
    await input({
      message: `${meta.name} model name`,
      default: currentDefault,
      theme: THEME,
    })
  ).trim();
  return typed.length > 0 ? typed : currentDefault;
}

export { MODELS_WITH_EFFORT };

export type EffortLevel = "low" | "medium" | "high";

export async function pickEffortInteractive(
  provider: ProviderName,
  model: string,
  current: EffortLevel = "medium",
): Promise<EffortLevel> {
  return select<EffortLevel>({
    message: `Reasoning effort for ${chalk.cyan(provider)} ${chalk.dim("·")} ${chalk.bold(model)}`,
    choices: [
      { name: `low      ${chalk.dim("— fastest, cheapest, shallow reasoning")}`, value: "low" },
      { name: `medium   ${chalk.dim("— balanced (default)")}`, value: "medium" },
      { name: `high     ${chalk.dim("— deepest reasoning, slower & costlier")}`, value: "high" },
    ],
    default: current,
    loop: false,
    theme: THEME,
  });
}

export async function pickProviderInteractive(
  providers: ProviderName[],
): Promise<ProviderName> {
  return select<ProviderName>({
    message: "Pick a provider",
    choices: providers.map((p) => {
      const meta = PROVIDER_LABEL[p];
      return {
        name: `${meta.name.padEnd(10)} ${chalk.dim(meta.tag)}`,
        value: p,
        short: p,
      };
    }),
    loop: false,
    theme: THEME,
  });
}

export async function pickModelsInteractive(
  providers: ProviderName[],
  currentDefaults: Record<ProviderName, string>,
  skip: Partial<Record<ProviderName, boolean>> = {},
  /** Passing settings lets each picker fetch that provider's live model list. */
  settings?: ResolvedSettings,
): Promise<Partial<Record<ProviderName, string>>> {
  const out: Partial<Record<ProviderName, string>> = {};
  for (const p of providers) {
    if (skip[p]) continue;
    out[p] = await pickModelInteractive(p, currentDefaults[p], settings);
  }
  return out;
}
