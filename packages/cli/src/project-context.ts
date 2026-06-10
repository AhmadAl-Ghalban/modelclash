import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname, isAbsolute, resolve as resolvePath } from "node:path";
import { homedir } from "node:os";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode",
  "target",
  ".gradle",
  ".pytest_cache",
  ".mypy_cache",
]);

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".c", ".h", ".cc", ".cpp", ".hpp", ".cs",
  ".php", ".scala", ".clj", ".ex", ".exs", ".erl",
  ".html", ".css", ".scss", ".sass", ".vue", ".svelte",
  ".json", ".yml", ".yaml", ".toml", ".ini", ".env",
  ".md", ".mdx", ".txt", ".sql", ".graphql", ".proto",
  ".sh", ".bash", ".zsh", ".fish", ".ps1",
  ".dockerfile", ".tf", ".hcl",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "composer.lock",
  ".DS_Store",
]);

const DEFAULT_MAX_BYTES = 200 * 1024;
const MAX_FILE_BYTES = 64 * 1024;

export interface ProjectContext {
  root: string;
  tree: string;
  files: string;
  bytesIncluded: number;
  filesIncluded: number;
  filesSkipped: number;
  truncated: boolean;
}

export function resolveProjectPath(p: string): string {
  let s = p.trim();
  if (s.startsWith("~/") || s === "~") s = join(homedir(), s.slice(1) || "/");
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

interface Entry {
  path: string;
  rel: string;
  size: number;
}

async function walk(root: string): Promise<Entry[]> {
  const out: Entry[] = [];
  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && SKIP_DIRS.has(e.name)) continue;
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await visit(full);
      } else if (e.isFile()) {
        if (SKIP_FILES.has(e.name)) continue;
        const ext = extname(e.name).toLowerCase();
        const named = e.name.toLowerCase();
        const isText =
          TEXT_EXTS.has(ext) ||
          named === "dockerfile" ||
          named === "makefile" ||
          named === "readme" ||
          named === ".gitignore" ||
          named === ".env.example";
        if (!isText) continue;
        try {
          const s = await stat(full);
          out.push({ path: full, rel: relative(root, full), size: s.size });
        } catch {
          // skip
        }
      }
    }
  }
  await visit(root);
  return out;
}

function buildTree(entries: Entry[]): string {
  const sorted = [...entries].sort((a, b) => a.rel.localeCompare(b.rel));
  return sorted.map((e) => `  ${e.rel}  (${formatBytes(e.size)})`).join("\n");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export async function buildProjectContext(
  rootInput: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<ProjectContext> {
  const root = resolveProjectPath(rootInput);
  const st = await stat(root);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${root}`);

  const entries = await walk(root);
  entries.sort((a, b) => a.size - b.size);

  const tree = buildTree(entries);
  let bytes = 0;
  let included = 0;
  let skipped = 0;
  let truncated = false;
  const chunks: string[] = [];

  for (const e of entries) {
    if (e.size > MAX_FILE_BYTES) {
      skipped++;
      continue;
    }
    if (bytes + e.size > maxBytes) {
      truncated = true;
      skipped++;
      continue;
    }
    let content: string;
    try {
      const buf = await readFile(e.path);
      if (buf.subarray(0, Math.min(buf.length, 8192)).includes(0)) {
        skipped++;
        continue;
      }
      content = buf.toString("utf8");
    } catch {
      skipped++;
      continue;
    }
    chunks.push(`--- FILE: ${e.rel} ---\n${content}`);
    bytes += e.size;
    included++;
  }

  return {
    root,
    tree,
    files: chunks.join("\n\n"),
    bytesIncluded: bytes,
    filesIncluded: included,
    filesSkipped: skipped,
    truncated,
  };
}

export function buildReviewPrompt(ctx: ProjectContext, request: string): string {
  const header =
    `You are reviewing a coding project located at ${ctx.root}.\n` +
    `User request: ${request}\n\n` +
    `Project file tree (${ctx.filesIncluded} files included, ${ctx.filesSkipped} skipped${ctx.truncated ? "; context truncated due to size limit" : ""}):\n${ctx.tree}\n\n` +
    `Source files follow. Each file is delimited by "--- FILE: <path> ---".\n\n`;
  return header + ctx.files + `\n\n--- END OF PROJECT ---\n\nNow address the user's request: ${request}`;
}
