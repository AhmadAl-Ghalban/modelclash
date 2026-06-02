import { OpenAIProvider } from "../providers/openai.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { GoogleProvider } from "../providers/google.js";
import type { LLMProvider } from "../interfaces/provider.js";
import type { ProviderName } from "../types/index.js";
import type { ModelclashConfig } from "./schema.js";

export const DEFAULT_MODELS = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4",
  google: "gemini-2.5-pro",
} as const;

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
  };

  const models: Record<ProviderName, string> = {
    openai:
      overrides.modelOpenai ??
      env.DEFAULT_OPENAI_MODEL ??
      config.defaultModels?.openai ??
      DEFAULT_MODELS.openai,
    anthropic:
      overrides.modelAnthropic ??
      env.DEFAULT_ANTHROPIC_MODEL ??
      config.defaultModels?.anthropic ??
      DEFAULT_MODELS.anthropic,
    google:
      overrides.modelGoogle ??
      env.DEFAULT_GOOGLE_MODEL ??
      config.defaultModels?.google ??
      DEFAULT_MODELS.google,
  };

  const temperature =
    overrides.temperature ?? config.defaults?.temperature ?? 0.7;

  const timeoutMs =
    overrides.timeoutMs ??
    (env.REQUEST_TIMEOUT_MS ? parseInt(env.REQUEST_TIMEOUT_MS, 10) : undefined) ??
    config.defaults?.timeoutMs ??
    60_000;

  const stream = overrides.stream ?? config.defaults?.stream ?? false;

  return { apiKeys, models, temperature, timeoutMs, stream };
}

export function buildProvidersFromSettings(
  settings: ResolvedSettings,
): LLMProvider[] {
  const out: LLMProvider[] = [];
  if (settings.apiKeys.openai) out.push(new OpenAIProvider(settings.apiKeys.openai));
  if (settings.apiKeys.anthropic) out.push(new AnthropicProvider(settings.apiKeys.anthropic));
  if (settings.apiKeys.google) out.push(new GoogleProvider(settings.apiKeys.google));
  return out;
}

export function configuredProvidersFromSettings(
  settings: ResolvedSettings,
): ProviderName[] {
  const names: ProviderName[] = [];
  if (settings.apiKeys.openai) names.push("openai");
  if (settings.apiKeys.anthropic) names.push("anthropic");
  if (settings.apiKeys.google) names.push("google");
  return names;
}
