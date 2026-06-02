import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as dotenvConfig } from "dotenv";

export function loadDotenv(): void {
  const start = process.cwd();
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      dotenvConfig({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
