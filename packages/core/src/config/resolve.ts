import { OpenAIProvider } from "../providers/openai.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { GoogleProvider } from "../providers/google.js";
import { GroqProvider } from "../providers/groq.js";
import { DeepSeekProvider, OllamaProvider } from "../providers/openai-compatible.js";
import type { LLMProvider } from "../interfaces/provider.js";
import type { ModelInfo, ProviderName } from "../types/index.js";
import type { ModelclashConfig } from "./schema.js";
import { DEFAULT_MODELS, MODEL_CATALOG, PROVIDER_NAMES, requiresKey } from "./catalog.js";

export { DEFAULT_MODELS };

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

export interface ResolvedSettings {
  apiKeys: Record<ProviderName, string | undefined>;
  models: Record<ProviderName, string>;
  temperature: number;
  timeoutMs: number;
  stream: boolean;
}

export interface CliOverrides {
  modelOpenai?: string;
  modelAnthropic?: string;
  modelGoogle?: string;
  modelGroq?: string;
  modelDeepseek?: string;
  modelOllama?: string;
  temperature?: number;
  timeoutMs?: number;
  stream?: boolean;
}

export function resolveSettings(
  config: ModelclashConfig,
  env: NodeJS.ProcessEnv = process.env,
  overrides: CliOverrides = {},
): ResolvedSettings {
  const apiKeys: Record<ProviderName, string | undefined> = {
    openai: env.OPENAI_API_KEY ?? config.apiKeys?.openai,
    anthropic: env.ANTHROPIC_API_KEY ?? config.apiKeys?.anthropic,
    google: env.GOOGLE_API_KEY ?? config.apiKeys?.google,
    groq: env.GROQ_API_KEY ?? config.apiKeys?.groq,
    deepseek: env.DEEPSEEK_API_KEY ?? config.apiKeys?.deepseek,
    /*
     * Ollama runs locally and takes no credential, so this slot holds a base URL
     * rather than a key — and it always has a value. Earlier versions required
     * OLLAMA_BASE_URL or OLLAMA_ENABLED=1 before Ollama would appear at all,
     * which meant a running local daemon was silently ignored. It is now always
     * built; an unreachable daemon simply fails that one provider's call.
     */
    ollama: env.OLLAMA_BASE_URL ?? config.apiKeys?.ollama ?? DEFAULT_OLLAMA_BASE_URL,
  };

  const overrideFor: Record<ProviderName, string | undefined> = {
    openai: overrides.modelOpenai,
    anthropic: overrides.modelAnthropic,
    google: overrides.modelGoogle,
    groq: overrides.modelGroq,
    deepseek: overrides.modelDeepseek,
    ollama: overrides.modelOllama,
  };

  const envModelFor: Record<ProviderName, string | undefined> = {
    openai: env.DEFAULT_OPENAI_MODEL,
    anthropic: env.DEFAULT_ANTHROPIC_MODEL,
    google: env.DEFAULT_GOOGLE_MODEL,
    groq: env.DEFAULT_GROQ_MODEL,
    deepseek: env.DEFAULT_DEEPSEEK_MODEL,
    ollama: env.DEFAULT_OLLAMA_MODEL,
  };

  const models = Object.fromEntries(
    PROVIDER_NAMES.map((p) => [
      p,
      overrideFor[p] ?? envModelFor[p] ?? config.defaultModels?.[p] ?? DEFAULT_MODELS[p],
    ]),
  ) as Record<ProviderName, string>;

  const temperature = overrides.temperature ?? config.defaults?.temperature ?? 0.7;

  const timeoutMs =
    overrides.timeoutMs ??
    (env.REQUEST_TIMEOUT_MS ? parseInt(env.REQUEST_TIMEOUT_MS, 10) : undefined) ??
    config.defaults?.timeoutMs ??
    60_000;

  const stream = overrides.stream ?? config.defaults?.stream ?? false;

  return { apiKeys, models, temperature, timeoutMs, stream };
}

export function buildProvidersFromSettings(settings: ResolvedSettings): LLMProvider[] {
  const out: LLMProvider[] = [];
  if (settings.apiKeys.openai) out.push(new OpenAIProvider(settings.apiKeys.openai));
  if (settings.apiKeys.anthropic) out.push(new AnthropicProvider(settings.apiKeys.anthropic));
  if (settings.apiKeys.google) out.push(new GoogleProvider(settings.apiKeys.google));
  if (settings.apiKeys.groq) out.push(new GroqProvider(settings.apiKeys.groq));
  if (settings.apiKeys.deepseek) out.push(new DeepSeekProvider(settings.apiKeys.deepseek));
  if (settings.apiKeys.ollama) out.push(new OllamaProvider(settings.apiKeys.ollama));
  return out;
}

export function configuredProvidersFromSettings(settings: ResolvedSettings): ProviderName[] {
  return PROVIDER_NAMES.filter((p) => !!settings.apiKeys[p]);
}

/** Builds a single provider, or undefined when it has no credential. */
export function buildProvider(
  provider: ProviderName,
  settings: ResolvedSettings,
): LLMProvider | undefined {
  return buildProvidersFromSettings(settings).find((p) => p.name === provider);
}

export interface ListModelsResult {
  models: ModelInfo[];
  /** Where the list came from — the UI says so, rather than implying freshness. */
  source: "live" | "catalog";
  /** Why the live fetch was skipped or failed, when it was. */
  reason?: string;
}

/**
 * Current models for a provider, asked of the provider itself when possible.
 *
 * A hardcoded list goes stale the moment a vendor ships — every provider in this
 * repo had drifted by at least one major generation before this existed. The
 * offline catalog is the fallback, never the first answer.
 */
export async function listModelsForProvider(
  provider: ProviderName,
  settings: ResolvedSettings,
): Promise<ListModelsResult> {
  const fallback = () => ({
    models: MODEL_CATALOG[provider].models.map((m) => ({
      id: m.id,
      label: m.label,
      hint: m.hint,
    })),
    source: "catalog" as const,
  });

  const client = buildProvider(provider, settings);
  if (!client?.listModels) {
    return {
      ...fallback(),
      reason: requiresKey(provider)
        ? "No API key configured"
        : "Provider unavailable",
    };
  }

  try {
    const models = await client.listModels();
    if (models.length === 0) return { ...fallback(), reason: "Provider returned no models" };
    return { models, source: "live" };
  } catch (err) {
    return { ...fallback(), reason: (err as Error).message };
  }
}
