import type { ProviderName } from "../types/index.js";

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
}

export interface DefaultModels {
  openai?: string;
  anthropic?: string;
  google?: string;
}

export interface ConfigDefaults {
  temperature?: number;
  timeoutMs?: number;
  stream?: boolean;
}

export interface ModelGroup {
  openai?: string;
  anthropic?: string;
  google?: string;
}

export interface ModelclashConfig {
  apiKeys?: ApiKeys;
  defaultModels?: DefaultModels;
  defaults?: ConfigDefaults;
  aliases?: Record<string, ModelGroup>;
}

export type ConfigKey =
  | `apiKeys.${ProviderName}`
  | `defaultModels.${ProviderName}`
  | "defaults.temperature"
  | "defaults.timeoutMs"
  | "defaults.stream"
  | `aliases.${string}.${ProviderName}`;

export const EMPTY_CONFIG: ModelclashConfig = {};
