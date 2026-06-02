import { homedir } from "node:os";
import { join } from "node:path";

export function getConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MODELCLASH_CONFIG_DIR) return env.MODELCLASH_CONFIG_DIR;
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "modelclash");
  return join(homedir(), ".modelclash");
}

export function getConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MODELCLASH_CONFIG) return env.MODELCLASH_CONFIG;
  return join(getConfigDir(env), "config.json");
}
