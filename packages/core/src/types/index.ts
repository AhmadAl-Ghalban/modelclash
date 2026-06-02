export type ProviderName = "openai" | "anthropic" | "google";

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface ProviderRequest {
  prompt: string;
  model: string;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  text: string;
  usage: TokenUsage;
  costUsd: number;
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
  temperature: number;
  stream: boolean;
  json: boolean;
  save?: string;
  timeout: number;
}

export interface ModelPricing {
  inputPerMTokens: number;
  outputPerMTokens: number;
}
