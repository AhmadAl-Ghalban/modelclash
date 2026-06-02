# modelclash ⚔️

A production-ready CLI tool to compare responses from **OpenAI**, **Anthropic**, and **Google** models side-by-side from a single prompt.

> **Keep this file in sync.** Whenever you add, remove, or change a feature, flag, script, env var, or run step, update the matching section of this README in the **same PR**. CI (see [Continuous Integration](#continuous-integration)) does not check docs — reviewers do.

## Features

- Parallel calls to OpenAI, Anthropic, and Google via official SDKs
- Token usage reporting and per-model cost estimation
- Configurable per-provider model selection, temperature, and timeout
- Optional streaming (sequential) output
- JSON output mode + file save
- Retry with exponential backoff and per-request timeouts
- Colored terminal UI with side-by-side summary table
- User config at `~/.modelclash/config.json` (managed via `modelclash config`)
- TypeScript strict mode, Vitest unit tests, npm workspaces monorepo

## Requirements

- **Node.js ≥ 18** (CI tests on 18, 20, 22)
- **npm** (workspaces support — bundled with Node 18+)
- API keys for at least one of: OpenAI, Anthropic, Google

## Quick start (for testers)

```bash
# 1. Clone & install
git clone <repo-url> modelclash
cd modelclash
npm install

# 2. Add API keys
cp .env.example .env
# then edit .env and fill in any keys you have

# 3. Build
npm run build

# 4. Run the CLI
npm run cli -- "Explain quantum entanglement in one sentence."
```

Providers without configured keys are simply skipped, so a single key is enough to try it out.

## Configuration

### Environment variables (`.env`)

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

### User config file

Persistent settings live at `~/.modelclash/config.json`. Manage via:

```bash
modelclash config            # show current config
modelclash config --edit     # open in $EDITOR
```

## Running the project

All commands are run from the repo root.

| What you want to do                      | Command                              |
| ---------------------------------------- | ------------------------------------ |
| Install deps                             | `npm install`                        |
| Build all packages                       | `npm run build`                      |
| Run the built CLI                        | `npm run cli -- <args>`              |
| Run the CLI from TS source (no build)    | `npm run cli:dev -- <args>`          |
| Build only the CLI workspace             | `npm run cli:build`                  |
| Run tests once                           | `npm test`                           |
| Run tests in watch mode                  | `npm run test:watch`                 |
| Typecheck the whole monorepo             | `npm run typecheck`                  |
| Clean build outputs                      | `npm run clean`                      |

The `--` separates npm flags from CLI flags, e.g.:

```bash
npm run cli -- --help
npm run cli:dev -- config
npm run cli -- "Write a haiku about Mondays" --temperature 0.9
```

### Install globally (optional)

```bash
npm run build
npm link    # makes `modelclash` available on your $PATH
modelclash "your prompt"
```

## CLI usage

```bash
modelclash "<prompt>" [options]
```

### Flags

| Flag                        | Description                | Default            |
| --------------------------- | -------------------------- | ------------------ |
| `--model-openai <model>`    | OpenAI model               | `gpt-4o`           |
| `--model-anthropic <model>` | Anthropic model            | `claude-sonnet-4`  |
| `--model-google <model>`    | Google model               | `gemini-2.5-pro`   |
| `-t, --temperature <num>`   | Sampling temperature       | `0.7`              |
| `--stream`                  | Stream responses           | `false`            |
| `--json`                    | Output JSON only           | `false`            |
| `--save <file>`             | Save JSON report to file   | —                  |
| `--timeout <ms>`            | Request timeout in ms      | `60000`            |

### Examples

```bash
# Basic comparison
npm run cli -- "Explain quantum entanglement in one sentence."

# Override a model and temperature
npm run cli -- "Write a haiku about Mondays" \
  --model-openai gpt-4o-mini \
  --temperature 0.9

# Stream + save JSON
npm run cli -- "Summarize the Iliad" --stream --save out.json

# Pure JSON output (for piping)
npm run cli -- "Capital of Iceland?" --json | jq '.results[].text'
```

## Project structure

Monorepo using npm workspaces.

```
packages/
  core/         # @modelclash/core — providers, pricing, retry, cost, formatter
  cli/          # modelclash       — CLI entrypoint, command parsing
  server/       # (optional) HTTP wrapper
.github/
  workflows/
    ci.yml      # PR + main: build & test on Node 18/20/22
```

## Continuous Integration

Every pull request to `main` runs `.github/workflows/ci.yml`:

1. `npm ci`
2. `npm run build`
3. `npm test`

…across Node 18, 20, and 22. To require this before merging, enable branch protection on `main` and select the `test` checks as required.

## Sharing for testing

When sending this repo to someone for testing, point them at the [Quick start](#quick-start-for-testers) section. They need: Node ≥ 18, the repo, and at least one API key.

## Keeping the README up to date

This README is the contract with anyone running the project. When a PR changes any of the following, update the matching section in the **same PR**:

- New/removed/renamed CLI flag → **CLI usage › Flags**
- New/changed npm script → **Running the project**
- New env var or config field → **Configuration**
- New package or moved directory → **Project structure**
- Change to CI steps or Node matrix → **Continuous Integration**
- Change to install or run steps → **Quick start**

## License

MIT
