export type ProviderName =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "ollama";

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ReasoningEffort = "low" | "medium" | "high";

export interface ProviderRequest {
  prompt: string;
  history?: ChatMessage[];
  model: string;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
  reasoningEffort?: ReasoningEffort;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  text: string;
  usage: TokenUsage;
  /** Null when the model has no known price — never silently zero. */
  costUsd: number | null;
  durationMs: number;
}

export interface ProviderError {
  provider: ProviderName;
  model: string;
  message: string;
  durationMs: number;
}

export type ProviderResult =
  | { ok: true; value: ProviderResponse }
  | { ok: false; error: ProviderError };

export interface CliOptions {
  modelOpenai: string;
  modelAnthropic: string;
  modelGoogle: string;
  modelGroq: string;
  modelDeepseek: string;
  modelOllama: string;
  temperature: number;
  stream: boolean;
  json: boolean;
  save?: string;
  timeout: number;
}

/** A model offered by a provider, as reported live or from the offline catalog. */
export interface ModelInfo {
  id: string
  label?: string
  hint?: string
}

export interface ModelPricing {
  inputPerMTokens: number;
  outputPerMTokens: number;
}
