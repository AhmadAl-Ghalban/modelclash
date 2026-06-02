import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline/promises";
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  getConfigValue,
  setConfigValue,
  unsetConfigValue,
  isSettableKey,
  EMPTY_CONFIG,
  type ModelclashConfig,
} from "@modelclash/core";

export function buildConfigCommand(): Command {
  const cmd = new Command("config").description("Manage modelclash configuration");

  cmd
    .command("path")
    .description("Print the resolved config file path")
    .action(() => {
      console.log(getConfigPath());
    });

  cmd
    .command("list")
    .description("Print the entire config (API keys are redacted by default)")
    .option("--show-secrets", "Print API keys in full", false)
    .action(async (opts: { showSecrets: boolean }) => {
      const cfg = await loadConfig();
      console.log(JSON.stringify(opts.showSecrets ? cfg : redact(cfg), null, 2));
    });

  cmd
    .command("get <key>")
    .description("Print a single config value (e.g. defaultModels.openai)")
    .action(async (key: string) => {
      const cfg = await loadConfig();
      const value = getConfigValue(cfg, key);
      if (value === undefined) {
        process.exit(1);
      }
      console.log(typeof value === "string" ? value : JSON.stringify(value));
    });

  cmd
    .command("set <key> <value>")
    .description("Set a config value (e.g. apiKeys.openai sk-...)")
    .action(async (key: string, value: string) => {
      if (!isSettableKey(key)) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        process.exit(1);
      }
      const cfg = await loadConfig();
      const next = setConfigValue(cfg, key, value);
      const path = await saveConfig(next);
      console.log(chalk.green(`✓ Saved ${chalk.bold(key)} → ${path}`));
    });

  cmd
    .command("unset <key>")
    .description("Remove a config value")
    .action(async (key: string) => {
      if (!isSettableKey(key)) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        process.exit(1);
      }
      const cfg = await loadConfig();
      const next = unsetConfigValue(cfg, key);
      const path = await saveConfig(next);
      console.log(chalk.green(`✓ Removed ${chalk.bold(key)} → ${path}`));
    });

  cmd
    .command("init")
    .description("Interactively populate API keys and default models")
    .action(async () => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const ask = async (q: string, current?: string) => {
        const suffix = current ? chalk.dim(` (current: ${maskKey(current)})`) : "";
        const ans = (await rl.question(`${q}${suffix}: `)).trim();
        return ans.length === 0 ? undefined : ans;
      };

      const cfg = await loadConfig();
      const next: ModelclashConfig = structuredClone(cfg);
      next.apiKeys ??= {};
      next.defaultModels ??= {};

      console.log(chalk.bold("\nmodelclash config init"));
      console.log(chalk.dim("Press Enter to keep the current value (or skip if empty).\n"));

      const openaiKey = await ask("OpenAI API key", cfg.apiKeys?.openai);
      if (openaiKey) next.apiKeys.openai = openaiKey;
      const anthropicKey = await ask("Anthropic API key", cfg.apiKeys?.anthropic);
      if (anthropicKey) next.apiKeys.anthropic = anthropicKey;
      const googleKey = await ask("Google API key", cfg.apiKeys?.google);
      if (googleKey) next.apiKeys.google = googleKey;
      const groqKey = await ask("Groq API key", cfg.apiKeys?.groq);
      if (groqKey) next.apiKeys.groq = groqKey;
      const deepseekKey = await ask("DeepSeek API key", cfg.apiKeys?.deepseek);
      if (deepseekKey) next.apiKeys.deepseek = deepseekKey;
      const ollamaUrl = await ask(
        "Ollama base URL (blank to skip, e.g. http://localhost:11434/v1)",
        cfg.apiKeys?.ollama,
      );
      if (ollamaUrl) next.apiKeys.ollama = ollamaUrl;

      const openaiModel = await ask("Default OpenAI model", cfg.defaultModels?.openai ?? "gpt-4o");
      if (openaiModel) next.defaultModels.openai = openaiModel;
      const anthropicModel = await ask("Default Anthropic model", cfg.defaultModels?.anthropic ?? "claude-sonnet-4");
      if (anthropicModel) next.defaultModels.anthropic = anthropicModel;
      const googleModel = await ask("Default Google model", cfg.defaultModels?.google ?? "gemini-2.5-pro");
      if (googleModel) next.defaultModels.google = googleModel;
      const groqModel = await ask("Default Groq model", cfg.defaultModels?.groq ?? "llama-3.3-70b-versatile");
      if (groqModel) next.defaultModels.groq = groqModel;
      const deepseekModel = await ask("Default DeepSeek model", cfg.defaultModels?.deepseek ?? "deepseek-chat");
      if (deepseekModel) next.defaultModels.deepseek = deepseekModel;
      const ollamaModel = await ask("Default Ollama model", cfg.defaultModels?.ollama ?? "llama3.2");
      if (ollamaModel) next.defaultModels.ollama = ollamaModel;

      rl.close();
      const path = await saveConfig(next);
      console.log(chalk.green(`\n✓ Saved config → ${path}`));
    });

  return cmd;
}

function redact(cfg: ModelclashConfig): ModelclashConfig {
  if (!cfg.apiKeys) return cfg;
  const copy = structuredClone(cfg);
  copy.apiKeys = {
    openai: cfg.apiKeys.openai ? maskKey(cfg.apiKeys.openai) : undefined,
    anthropic: cfg.apiKeys.anthropic ? maskKey(cfg.apiKeys.anthropic) : undefined,
    google: cfg.apiKeys.google ? maskKey(cfg.apiKeys.google) : undefined,
    groq: cfg.apiKeys.groq ? maskKey(cfg.apiKeys.groq) : undefined,
    deepseek: cfg.apiKeys.deepseek ? maskKey(cfg.apiKeys.deepseek) : undefined,
    ollama: cfg.apiKeys.ollama,
  };
  return copy;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

void EMPTY_CONFIG;
