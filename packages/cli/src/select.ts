import { checkbox, select, input } from "@inquirer/prompts";
import type { LLMProvider } from "@modelclash/core";
import type { ProviderName } from "@modelclash/core";

const ALL: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "deepseek",
  "ollama",
];

export const MODELS_BY_PROVIDER: Record<ProviderName, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini"],
  anthropic: [
    "claude-sonnet-4",
    "claude-opus-4",
    "claude-haiku-4",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  ollama: ["llama3.2", "llama3.1", "llama3", "qwen2.5", "mistral"],
};

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
    message: "Select providers (space to toggle, enter to confirm):",
    choices: available.map((name) => ({
      name,
      value: name,
      checked: true,
    })),
    required: true,
    loop: false,
  });
  return selected;
}

export async function pickModelInteractive(
  provider: ProviderName,
  currentDefault: string,
): Promise<string> {
  const known = MODELS_BY_PROVIDER[provider] ?? [];
  const choices = [
    ...known.map((m) => ({
      name: m === currentDefault ? `${m}  (default)` : m,
      value: m,
    })),
    { name: "✎ custom…", value: "__custom__" },
  ];
  const picked = await select<string>({
    message: `Pick a model for ${provider}:`,
    choices,
    default: known.includes(currentDefault) ? currentDefault : known[0],
    loop: false,
  });
  if (picked !== "__custom__") return picked;
  const typed = (
    await input({
      message: `${provider} model name:`,
      default: currentDefault,
    })
  ).trim();
  return typed.length > 0 ? typed : currentDefault;
}

export const MODELS_WITH_EFFORT: Record<string, true> = {
  "o1": true,
  "o1-mini": true,
  "deepseek-reasoner": true,
};

export type EffortLevel = "low" | "medium" | "high";

export async function pickEffortInteractive(
  provider: ProviderName,
  model: string,
  current: EffortLevel = "medium",
): Promise<EffortLevel> {
  return select<EffortLevel>({
    message: `Reasoning effort for ${provider}/${model}:`,
    choices: [
      { name: "low      — fastest, cheapest, shallow reasoning", value: "low" },
      { name: "medium   — balanced (default)", value: "medium" },
      { name: "high     — deepest reasoning, slower & costlier", value: "high" },
    ],
    default: current,
    loop: false,
  });
}

export async function pickProviderInteractive(
  providers: ProviderName[],
): Promise<ProviderName> {
  return select<ProviderName>({
    message: "Pick a provider:",
    choices: providers.map((p) => ({ name: p, value: p })),
    loop: false,
  });
}

export async function pickModelsInteractive(
  providers: ProviderName[],
  currentDefaults: Record<ProviderName, string>,
  skip: Partial<Record<ProviderName, boolean>> = {},
): Promise<Partial<Record<ProviderName, string>>> {
  const out: Partial<Record<ProviderName, string>> = {};
  for (const p of providers) {
    if (skip[p]) continue;
    out[p] = await pickModelInteractive(p, currentDefaults[p]);
  }
  return out;
}
