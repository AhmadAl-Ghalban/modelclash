import { checkbox } from "@inquirer/prompts";
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
