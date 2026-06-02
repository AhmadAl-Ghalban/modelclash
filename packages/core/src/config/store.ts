import { readFile, writeFile, mkdir, rename, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { getConfigPath } from "./paths.js";
import { type ModelclashConfig, EMPTY_CONFIG } from "./schema.js";

export async function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ModelclashConfig> {
  const path = getConfigPath(env);
  if (!existsSync(path)) return { ...EMPTY_CONFIG };
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as ModelclashConfig;
    return parsed ?? { ...EMPTY_CONFIG };
  } catch (err) {
    throw new Error(
      `Failed to read config at ${path}: ${(err as Error).message}`,
    );
  }
}

export async function saveConfig(
  config: ModelclashConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const path = getConfigPath(env);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  const json = JSON.stringify(config, null, 2) + "\n";
  await writeFile(tmp, json, { encoding: "utf8", mode: 0o600 });
  await rename(tmp, path);
  await chmod(path, 0o600).catch(() => {});
  return path;
}

const KEY_PATHS = {
  "apiKeys.openai": ["apiKeys", "openai"],
  "apiKeys.anthropic": ["apiKeys", "anthropic"],
  "apiKeys.google": ["apiKeys", "google"],
  "defaultModels.openai": ["defaultModels", "openai"],
  "defaultModels.anthropic": ["defaultModels", "anthropic"],
  "defaultModels.google": ["defaultModels", "google"],
  "defaults.temperature": ["defaults", "temperature"],
  "defaults.timeoutMs": ["defaults", "timeoutMs"],
  "defaults.stream": ["defaults", "stream"],
} as const;

export type SettableKey = keyof typeof KEY_PATHS;

export function isSettableKey(key: string): key is SettableKey {
  return key in KEY_PATHS || key.startsWith("aliases.");
}

export function getConfigValue(
  config: ModelclashConfig,
  key: string,
): unknown {
  const path = resolveKeyPath(key);
  if (!path) return undefined;
  let cur: unknown = config;
  for (const part of path) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function setConfigValue(
  config: ModelclashConfig,
  key: string,
  value: unknown,
): ModelclashConfig {
  const path = resolveKeyPath(key);
  if (!path) throw new Error(`Unknown config key: ${key}`);
  const coerced = coerceValue(key, value);
  const next = structuredClone(config) as Record<string, unknown>;
  let cur = next;
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i];
    if (typeof cur[part] !== "object" || cur[part] === null) {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = coerced;
  return next as ModelclashConfig;
}

export function unsetConfigValue(
  config: ModelclashConfig,
  key: string,
): ModelclashConfig {
  const path = resolveKeyPath(key);
  if (!path) throw new Error(`Unknown config key: ${key}`);
  const next = structuredClone(config) as Record<string, unknown>;
  let cur = next;
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i];
    if (typeof cur[part] !== "object" || cur[part] === null) return next as ModelclashConfig;
    cur = cur[part] as Record<string, unknown>;
  }
  delete cur[path[path.length - 1]];
  return next as ModelclashConfig;
}

function resolveKeyPath(key: string): string[] | null {
  if (key in KEY_PATHS) return [...KEY_PATHS[key as SettableKey]];
  if (key.startsWith("aliases.")) {
    const parts = key.split(".");
    if (parts.length === 3) return parts;
  }
  return null;
}

function coerceValue(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (key === "defaults.temperature") return Number.parseFloat(value);
  if (key === "defaults.timeoutMs") return Number.parseInt(value, 10);
  if (key === "defaults.stream") return value === "true" || value === "1";
  return value;
}
