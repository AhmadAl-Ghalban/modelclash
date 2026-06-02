import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  unsetConfigValue,
  isSettableKey,
  resolveSettings,
  buildProvidersFromSettings,
  getConfigPath,
  DEFAULT_MODELS,
} from "../src/index.js";

let dir: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "modelclash-test-"));
  env = { MODELCLASH_CONFIG: join(dir, "config.json") } as NodeJS.ProcessEnv;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("paths", () => {
  it("honors MODELCLASH_CONFIG", () => {
    expect(getConfigPath(env)).toBe(join(dir, "config.json"));
  });
});

describe("loadConfig / saveConfig", () => {
  it("returns empty config when file missing", async () => {
    const cfg = await loadConfig(env);
    expect(cfg).toEqual({});
  });

  it("round-trips and writes with mode 0600", async () => {
    const path = await saveConfig(
      { apiKeys: { openai: "sk-test" }, defaultModels: { openai: "gpt-4o-mini" } },
      env,
    );
    expect(existsSync(path)).toBe(true);
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
    const loaded = await loadConfig(env);
    expect(loaded.apiKeys?.openai).toBe("sk-test");
    expect(loaded.defaultModels?.openai).toBe("gpt-4o-mini");
  });

  it("throws on invalid JSON", async () => {
    const path = join(dir, "config.json");
    require("node:fs").writeFileSync(path, "{not json", "utf8");
    await expect(loadConfig(env)).rejects.toThrow(/Failed to read config/);
  });
});

describe("get / set / unset", () => {
  it("sets nested values and coerces numeric/boolean", () => {
    let cfg = {};
    cfg = setConfigValue(cfg, "apiKeys.openai", "sk-xyz");
    cfg = setConfigValue(cfg, "defaults.temperature", "0.3");
    cfg = setConfigValue(cfg, "defaults.timeoutMs", "30000");
    cfg = setConfigValue(cfg, "defaults.stream", "true");
    expect(getConfigValue(cfg, "apiKeys.openai")).toBe("sk-xyz");
    expect(getConfigValue(cfg, "defaults.temperature")).toBe(0.3);
    expect(getConfigValue(cfg, "defaults.timeoutMs")).toBe(30000);
    expect(getConfigValue(cfg, "defaults.stream")).toBe(true);
  });

  it("supports aliases.*.*", () => {
    let cfg = {};
    cfg = setConfigValue(cfg, "aliases.fast.openai", "gpt-4o-mini");
    expect(getConfigValue(cfg, "aliases.fast.openai")).toBe("gpt-4o-mini");
  });

  it("rejects unknown keys", () => {
    expect(() => setConfigValue({}, "notARealKey", "x")).toThrow(/Unknown config key/);
    expect(isSettableKey("apiKeys.openai")).toBe(true);
    expect(isSettableKey("nope")).toBe(false);
  });

  it("unset removes a key", () => {
    const cfg = setConfigValue({}, "apiKeys.openai", "sk-xyz");
    const next = unsetConfigValue(cfg, "apiKeys.openai");
    expect(getConfigValue(next, "apiKeys.openai")).toBeUndefined();
  });
});

describe("resolveSettings precedence", () => {
  it("falls back to built-in defaults when nothing is set", () => {
    const s = resolveSettings({}, {} as NodeJS.ProcessEnv, {});
    expect(s.models.openai).toBe(DEFAULT_MODELS.openai);
    expect(s.temperature).toBe(0.7);
    expect(s.timeoutMs).toBe(60_000);
    expect(s.stream).toBe(false);
    expect(buildProvidersFromSettings(s)).toHaveLength(0);
  });

  it("config file fills in API keys and model defaults", () => {
    const cfg = {
      apiKeys: { openai: "sk-cfg" },
      defaultModels: { openai: "gpt-4o-mini" },
      defaults: { temperature: 0.2 },
    };
    const s = resolveSettings(cfg, {} as NodeJS.ProcessEnv, {});
    expect(s.apiKeys.openai).toBe("sk-cfg");
    expect(s.models.openai).toBe("gpt-4o-mini");
    expect(s.temperature).toBe(0.2);
    expect(buildProvidersFromSettings(s)).toHaveLength(1);
  });

  it("env overrides config file", () => {
    const cfg = { apiKeys: { openai: "sk-cfg" }, defaultModels: { openai: "gpt-4o-mini" } };
    const s = resolveSettings(
      cfg,
      { OPENAI_API_KEY: "sk-env", DEFAULT_OPENAI_MODEL: "gpt-4o" } as NodeJS.ProcessEnv,
      {},
    );
    expect(s.apiKeys.openai).toBe("sk-env");
    expect(s.models.openai).toBe("gpt-4o");
  });

  it("CLI overrides win over env and config", () => {
    const cfg = { defaultModels: { openai: "gpt-4o-mini" } };
    const s = resolveSettings(
      cfg,
      { DEFAULT_OPENAI_MODEL: "gpt-4o" } as NodeJS.ProcessEnv,
      { modelOpenai: "o1", temperature: 0.9 },
    );
    expect(s.models.openai).toBe("o1");
    expect(s.temperature).toBe(0.9);
  });
});

describe("saveConfig file format", () => {
  it("writes pretty JSON ending with newline", async () => {
    const path = await saveConfig({ defaults: { temperature: 0.5 } }, env);
    const text = readFileSync(path, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('"temperature": 0.5');
  });
});
