import {
  buildProvidersFromSettings,
  configuredProvidersFromSettings,
  loadConfig,
  resolveSettings,
  type LLMProvider,
  type ProviderName,
  type ResolvedSettings,
} from "@modelclash/core";

export const PROVIDER_NAMES: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "deepseek",
  "ollama",
];

export interface SessionSettings extends ResolvedSettings {
  providers: LLMProvider[];
  configured: ProviderName[];
}

/**
 * Resolves config + env the same way the CLI does. Read fresh on every tool
 * call so edits to `~/.modelclash/config.json` are picked up without a restart.
 */
export async function loadSettings(): Promise<SessionSettings> {
  const config = await loadConfig();
  const settings = resolveSettings(config);
  return {
    ...settings,
    providers: buildProvidersFromSettings(settings),
    configured: configuredProvidersFromSettings(settings),
  };
}

/** Narrows the configured providers to the requested subset. */
export function selectProviders(
  session: SessionSettings,
  requested?: ProviderName[],
): { providers: LLMProvider[]; missing: ProviderName[] } {
  if (!requested || requested.length === 0) {
    return { providers: session.providers, missing: [] };
  }
  const wanted = new Set(requested);
  return {
    providers: session.providers.filter((p) => wanted.has(p.name)),
    missing: requested.filter((name) => !session.configured.includes(name)),
  };
}
