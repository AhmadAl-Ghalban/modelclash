import type { ModelPricing, ProviderName } from "../types/index.js";

/**
 * Offline model catalog.
 *
 * This is a *fallback*, not the source of truth. Providers ship new models
 * constantly, so `listModels()` on each provider queries the live API whenever a
 * credential is available (see `LLMProvider.listModels`). This table is what the
 * pickers show before a key is entered, when a provider is unreachable, and it
 * supplies pricing — which no provider exposes over its models endpoint.
 *
 * Verified 2026-08-30 against each vendor's published model and pricing pages.
 * Prices are USD per 1M tokens, standard (non-batch, non-cached) rates. Where a
 * vendor tiers by context length, the short-context rate is used — it is the one
 * that applies to typical comparison prompts.
 */
export interface CatalogModel {
  id: string
  /** Human-readable name for pickers. */
  label: string
  /** Short note on what this model is for. */
  hint?: string
  /** Omitted when the vendor's price isn't known — cost is reported as unknown. */
  pricing?: ModelPricing
  /** Accepts a low/medium/high reasoning-effort hint. */
  effort?: boolean
}

export interface ProviderCatalog {
  /** Model used when nothing else is configured. */
  defaultModel: string
  /** False for local providers that need no credential (Ollama). */
  requiresKey: boolean
  models: CatalogModel[]
}

export const MODEL_CATALOG: Record<ProviderName, ProviderCatalog> = {
  openai: {
    defaultModel: "gpt-5.6-terra",
    requiresKey: true,
    models: [
      {
        id: "gpt-5.6-sol",
        label: "GPT-5.6 Sol",
        hint: "Flagship",
        pricing: { inputPerMTokens: 4.0, outputPerMTokens: 20.0 },
        effort: true,
      },
      {
        id: "gpt-5.6-terra",
        label: "GPT-5.6 Terra",
        hint: "Balanced",
        pricing: { inputPerMTokens: 2.0, outputPerMTokens: 12.0 },
        effort: true,
      },
      {
        id: "gpt-5.6-luna",
        label: "GPT-5.6 Luna",
        hint: "Cheapest",
        pricing: { inputPerMTokens: 0.2, outputPerMTokens: 1.2 },
        effort: true,
      },
      {
        id: "gpt-realtime-2.1",
        label: "GPT Realtime 2.1",
        hint: "Reasoning with tool use",
      },
    ],
  },

  anthropic: {
    defaultModel: "claude-opus-5",
    requiresKey: true,
    models: [
      {
        id: "claude-opus-5",
        label: "Claude Opus 5",
        hint: "Default — 1M context",
        pricing: { inputPerMTokens: 5.0, outputPerMTokens: 25.0 },
        effort: true,
      },
      {
        id: "claude-fable-5",
        label: "Claude Fable 5",
        hint: "Most capable",
        pricing: { inputPerMTokens: 10.0, outputPerMTokens: 50.0 },
        effort: true,
      },
      {
        id: "claude-sonnet-5",
        label: "Claude Sonnet 5",
        hint: "Balanced",
        pricing: { inputPerMTokens: 2.0, outputPerMTokens: 10.0 },
        effort: true,
      },
      {
        id: "claude-opus-4-8",
        label: "Claude Opus 4.8",
        pricing: { inputPerMTokens: 5.0, outputPerMTokens: 25.0 },
        effort: true,
      },
      {
        id: "claude-opus-4-7",
        label: "Claude Opus 4.7",
        pricing: { inputPerMTokens: 5.0, outputPerMTokens: 25.0 },
        effort: true,
      },
      {
        id: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        pricing: { inputPerMTokens: 3.0, outputPerMTokens: 15.0 },
        effort: true,
      },
      {
        id: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        hint: "Fastest",
        pricing: { inputPerMTokens: 1.0, outputPerMTokens: 5.0 },
      },
    ],
  },

  google: {
    defaultModel: "gemini-3.7-flash",
    requiresKey: true,
    models: [
      {
        id: "gemini-3.7-flash",
        label: "Gemini 3.7 Flash",
        hint: "Newest stable",
        // Promotional rate published through 2026-12-31; doubles on 2027-01-01.
        pricing: { inputPerMTokens: 0.75, outputPerMTokens: 3.75 },
      },
      {
        id: "gemini-3.5-flash",
        label: "Gemini 3.5 Flash",
        pricing: { inputPerMTokens: 1.5, outputPerMTokens: 9.0 },
      },
      {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro",
        hint: "Preview",
        pricing: { inputPerMTokens: 2.0, outputPerMTokens: 12.0 },
      },
      {
        id: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash Lite",
        hint: "Cheapest",
      },
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        pricing: { inputPerMTokens: 1.25, outputPerMTokens: 10.0 },
      },
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        pricing: { inputPerMTokens: 0.3, outputPerMTokens: 2.5 },
      },
    ],
  },

  groq: {
    defaultModel: "llama-3.3-70b-versatile",
    requiresKey: true,
    models: [
      {
        id: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        hint: "Versatile",
        pricing: { inputPerMTokens: 0.59, outputPerMTokens: 0.79 },
      },
      {
        id: "llama-3.1-8b-instant",
        label: "Llama 3.1 8B",
        hint: "Instant",
        pricing: { inputPerMTokens: 0.05, outputPerMTokens: 0.08 },
      },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Open weights" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "Open weights" },
      { id: "groq/compound", label: "Groq Compound", hint: "Agentic system" },
      { id: "groq/compound-mini", label: "Groq Compound Mini" },
    ],
  },

  deepseek: {
    defaultModel: "deepseek-v4-flash",
    requiresKey: true,
    models: [
      {
        id: "deepseek-v4-flash",
        label: "DeepSeek V4 Flash",
        hint: "Fast & cheap",
        // Off-peak rate; DeepSeek charges up to 2x during peak UTC hours.
        pricing: { inputPerMTokens: 0.22, outputPerMTokens: 0.66 },
        effort: true,
      },
      {
        id: "deepseek-v4-pro",
        label: "DeepSeek V4 Pro",
        hint: "Reasoning",
        pricing: { inputPerMTokens: 0.66, outputPerMTokens: 1.98 },
        effort: true,
      },
      {
        id: "deepseek-v4-flash-vision-exp",
        label: "DeepSeek V4 Flash Vision",
        hint: "Experimental, vision",
        pricing: { inputPerMTokens: 0.22, outputPerMTokens: 0.66 },
      },
    ],
  },

  ollama: {
    defaultModel: "llama3.2",
    // Runs on your own machine — no account, no key, no cost.
    requiresKey: false,
    models: [
      { id: "llama3.2", label: "Llama 3.2", hint: "Default in compose", pricing: FREE() },
      { id: "llama3.1", label: "Llama 3.1", pricing: FREE() },
      { id: "qwen2.5", label: "Qwen 2.5", pricing: FREE() },
      { id: "gemma2", label: "Gemma 2", pricing: FREE() },
      { id: "mistral", label: "Mistral", pricing: FREE() },
      { id: "phi3", label: "Phi-3", pricing: FREE() },
    ],
  },
}

/** Local models cost nothing to run — that's a real zero, not an unknown. */
function FREE(): ModelPricing {
  return { inputPerMTokens: 0, outputPerMTokens: 0 }
}

/**
 * Output-token cap sent with every request.
 *
 * This must be set explicitly. Providers that ration by tokens-per-minute price
 * a request as prompt + the *maximum* completion it might produce, so omitting
 * it reserves the model's entire output window against the quota: Groq rejects
 * a three-word prompt with `413 request_too_large` for that reason alone.
 * Comparison answers are short, so a modest cap costs nothing and keeps every
 * provider inside its per-request budget.
 */
export const DEFAULT_MAX_TOKENS = 4096

export const PROVIDER_NAMES = Object.keys(MODEL_CATALOG) as ProviderName[]

/** `{ openai: "gpt-5.6-terra", ... }` — the default model per provider. */
export const DEFAULT_MODELS = Object.fromEntries(
  PROVIDER_NAMES.map((p) => [p, MODEL_CATALOG[p].defaultModel]),
) as Record<ProviderName, string>

/** Providers that work with no credential at all. */
export function requiresKey(provider: ProviderName): boolean {
  return MODEL_CATALOG[provider]?.requiresKey ?? true
}

/** Flat `modelId → pricing` map, used by cost estimation. */
export const PRICING: Record<string, ModelPricing> = Object.fromEntries(
  PROVIDER_NAMES.flatMap((p) =>
    MODEL_CATALOG[p].models
      .filter((m): m is CatalogModel & { pricing: ModelPricing } => !!m.pricing)
      .map((m) => [m.id, m.pricing]),
  ),
)

/** Models that accept a reasoning-effort hint. */
export const MODELS_WITH_EFFORT: Record<string, true> = Object.fromEntries(
  PROVIDER_NAMES.flatMap((p) =>
    MODEL_CATALOG[p].models.filter((m) => m.effort).map((m) => [m.id, true as const]),
  ),
)

/** Catalog entry for a model id, across every provider. */
export function findModel(id: string): CatalogModel | undefined {
  for (const p of PROVIDER_NAMES) {
    const hit = MODEL_CATALOG[p].models.find((m) => m.id === id)
    if (hit) return hit
  }
  return undefined
}
