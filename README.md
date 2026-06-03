# modelclash ⚔️

A production-ready CLI tool to compare responses from **OpenAI**, **Anthropic**, **Google**, **Groq**, **DeepSeek**, and local **Ollama** models — side-by-side from a single prompt, or in an interactive multi-turn chat.

> **Keep this file in sync.** Whenever you add, remove, or change a feature, flag, script, env var, or run step, update the matching section of this README in the **same PR**. CI (see [Continuous Integration](#continuous-integration)) does not check docs — reviewers do.

## Features

- Parallel calls to OpenAI, Anthropic, Google, Groq, DeepSeek, and Ollama (local)
- Token usage reporting and per-model cost estimation
- Configurable per-provider model selection, temperature, and timeout
- Streaming output (sequential, per-provider)
- JSON output mode + file save
- Retry with exponential backoff and per-request timeouts
- User config at `~/.modelclash/config.json` (managed via `modelclash config`)
- Provider selection: `--providers openai,groq` flag or interactive checkbox picker
- Multi-turn `modelclash chat` REPL with:
  - **Claude-Code-style slash menu** — type `/` and a live-filtered command list pops up under the prompt (↑/↓ navigate, Enter selects, Tab autocompletes, Esc dismisses, Backspace removes the `/` to hide)
  - **Interactive model picker** — on startup and via `/model`, pick a provider then a model from a list (or `✎ custom…` to type your own)
  - **Reasoning effort selection** — when you pick an effort-capable model (OpenAI `o1` / `o1-mini`, DeepSeek `deepseek-reasoner`), choose `low` / `medium` / `high` with one-line trade-off descriptions; sent through as `reasoning_effort`
  - Conversation history, system prompts, session save/load (`.json` or `.md`), mid-chat model swap, `/retry` for the last user message
  - Per-turn comparison table with fastest / cheapest / longest / highest tok/s badges
- Bundled Docker setup for running Ollama locally
- TypeScript strict mode, Vitest unit tests, npm workspaces monorepo

## Requirements

- **Node.js ≥ 20** (CI tests on 20, 22; `.nvmrc` pins `20` for local dev — run `nvm use`)
- **npm** (workspaces support — bundled with Node 20+)
- An API key for at least one of: OpenAI, Anthropic, Google, Groq, DeepSeek — **or** a local Ollama install (no key needed)

## Quick start (for testers)

```bash
# 1. Clone & install
git clone <repo-url> modelclash
cd modelclash
npm install

# 2. Add at least one API key (Groq, Google Gemini, and DeepSeek have free tiers — see below)
cp .env.example .env
# then edit .env and fill in any keys you have

# 3. Build
npm run build

# 4. Try it
npm run cli -- "Explain quantum entanglement in one sentence."
npm run cli -- chat
```

Providers without configured keys are simply skipped, so a single key is enough to try it out.

## Configuration

modelclash reads settings from three sources, in this priority order: **CLI flags → environment variables → `~/.modelclash/config.json`**. Whichever you set wins for that field; the others fill in the gaps.

### Environment variables (`.env`)

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434/v1

# Optional model overrides
DEFAULT_OPENAI_MODEL=gpt-4o
DEFAULT_ANTHROPIC_MODEL=claude-sonnet-4
DEFAULT_GOOGLE_MODEL=gemini-2.5-pro
DEFAULT_GROQ_MODEL=llama-3.3-70b-versatile
DEFAULT_DEEPSEEK_MODEL=deepseek-chat
DEFAULT_OLLAMA_MODEL=llama3.2

# Optional request timeout
REQUEST_TIMEOUT_MS=60000
```

`.env` is searched upward from the current working directory, so it works whether you run from the repo root (`npm run cli`) or from inside `packages/cli`.

### Free API keys

You can run modelclash without spending money using any of these:

| Provider     | Free tier                                                                          | Sign-up                                  |
| ------------ | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| **Groq**     | Generous free rate limits, very fast Llama 3.3 70B                                 | https://console.groq.com/keys            |
| **Google**   | Free Gemini tier (15 RPM)                                                          | https://aistudio.google.com/apikey       |
| **DeepSeek** | Free starter credits, strong reasoning (`deepseek-chat`, `deepseek-reasoner`)      | https://platform.deepseek.com            |
| **Ollama**   | 100 % local — no key, no network. Install Ollama, `ollama pull llama3.2`           | https://ollama.com                       |

### Persistent config (`~/.modelclash/config.json`)

Use the `config` subcommand to manage it:

```bash
modelclash config init                 # interactive: prompts for keys + default models
modelclash config path                 # print resolved config path
modelclash config list                 # print config (keys redacted by default)
modelclash config list --show-secrets  # print with full keys
modelclash config get <key>            # e.g. defaultModels.openai
modelclash config set <key> <value>    # e.g. apiKeys.groq gsk_...
modelclash config unset <key>
```

Settable keys: `apiKeys.<provider>`, `defaultModels.<provider>`, `defaults.temperature`, `defaults.timeoutMs`, `defaults.stream`, `aliases.<name>.<provider>`.

### Running Ollama in Docker

If you don't want to install Ollama natively, use the bundled `docker-compose.yml`:

```bash
# Start Ollama + auto-pull the default model (llama3.2)
docker compose up -d

# Pull additional models on demand
OLLAMA_MODELS="qwen2.5 llama3.1" docker compose run --rm ollama-pull

# Tail logs
docker compose logs -f ollama

# Stop (keeps the model volume)
docker compose down

# Stop AND delete downloaded models
docker compose down -v
```

Then point modelclash at the container:

```bash
export OLLAMA_BASE_URL=http://localhost:11434/v1
npm run cli -- chat -p ollama
```

`Dockerfile.ollama` builds a single image with models pre-baked (useful for offline/air-gapped use):

```bash
docker build -f Dockerfile.ollama -t modelclash-ollama \
  --build-arg OLLAMA_MODELS="llama3.2 qwen2.5" .
docker run -d -p 11434:11434 --name ollama modelclash-ollama
```

## Running the project

All commands run from the repo root.

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
npm run cli:dev -- chat
npm run cli -- "Write a haiku about Mondays" --temperature 0.9
```

### Install globally (optional)

```bash
npm run build
npm link    # makes `modelclash` available on your $PATH
modelclash "your prompt"
modelclash chat
```

## CLI usage — one-shot

```bash
modelclash "<prompt>" [options]
```

### Flags

| Flag                        | Description                                                                                                | Default                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| `--model-openai <model>`    | OpenAI model                                                                                               | `gpt-4o`                 |
| `--model-anthropic <model>` | Anthropic model                                                                                            | `claude-sonnet-4`        |
| `--model-google <model>`    | Google model                                                                                               | `gemini-2.5-pro`         |
| `--model-groq <model>`      | Groq model                                                                                                 | `llama-3.3-70b-versatile`|
| `--model-deepseek <model>`  | DeepSeek model                                                                                             | `deepseek-chat`          |
| `--model-ollama <model>`    | Ollama model                                                                                               | `llama3.2`               |
| `-p, --providers <list>`    | Providers to use (comma-separated, e.g. `openai,groq`). If omitted in a TTY, an interactive picker appears. | all with keys            |
| `-t, --temperature <num>`   | Sampling temperature                                                                                       | `0.7`                    |
| `--stream`                  | Stream responses                                                                                           | `false`                  |
| `--json`                    | Output JSON only (suppresses the picker)                                                                   | `false`                  |
| `--save <file>`             | Save JSON report to file                                                                                   | —                        |
| `--timeout <ms>`            | Request timeout in ms                                                                                      | `60000`                  |

### Examples

```bash
# Basic comparison (interactive provider picker if a TTY)
npm run cli -- "Explain quantum entanglement in one sentence."

# Pin providers and override a model
npm run cli -- "Write a haiku about Mondays" \
  --providers openai,groq \
  --model-openai gpt-4o-mini \
  --temperature 0.9

# Stream + save JSON
npm run cli -- "Summarize the Iliad" --stream --save out.json

# Pure JSON for piping
npm run cli -- "Capital of Iceland?" --json | jq '.results[].text'

# Only free providers
npm run cli -- "Hello" --providers groq,google,deepseek,ollama
```

## Chat mode

Multi-turn conversation against the providers you pick. Responses stream live (sequentially per provider), and after each turn a comparison table summarises every model's tokens, cost, time, and throughput — with auto-badges for the fastest, cheapest, longest, and highest tok/s response.

```bash
npm run cli -- chat                          # interactive provider + model picker
npm run cli -- chat --providers openai,groq  # explicit provider selection
npm run cli -- chat -p groq -s "Be concise." # with a system prompt
npm run cli -- chat -p ollama --no-stream    # disable streaming, show spinner
```

On startup, after the provider checkbox, you'll be prompted to pick a model for each selected provider (skipped for any provider you set via `--model-<name>` flag). If the model supports reasoning effort, you'll then pick `low` / `medium` / `high`.

### Live slash menu

Type `/` at any prompt and a filtered command list appears under the cursor — no Enter required.

| Key            | Action                                                  |
| -------------- | ------------------------------------------------------- |
| `/`            | open the menu (must be the first char of the line)      |
| type letters   | live-filter (`/mo` → `/model`)                          |
| ↑ / ↓          | move selection                                          |
| Enter          | run the highlighted command                             |
| Tab            | autocomplete the highlighted command into the buffer    |
| Backspace      | delete a char (deleting the leading `/` hides the menu) |
| Esc            | clear the buffer and hide the menu                      |
| Ctrl-C         | exit the chat                                           |

### Slash commands

| Command                       | Description                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| `/help`, `/?`                 | list commands                                                          |
| `/exit`, `/q`                 | leave the chat (or Ctrl+D)                                             |
| `/clear`                      | clear the screen                                                       |
| `/reset`                      | clear conversation history                                             |
| `/retry`                      | re-run the last user message (drops the previous assistant turn)       |
| `/history`                    | print conversation history                                             |
| `/providers`                  | list selected providers + models                                       |
| `/stats`                      | session totals (turns, tokens, cost)                                   |
| `/stream`                     | toggle streaming on/off                                                |
| `/temp <n>`                   | change sampling temperature                                            |
| `/system <text>`              | set system prompt (`/system off` to clear)                             |
| `/model`                      | pick provider, then model, then effort (interactive)                   |
| `/model <provider>`           | pick model + effort for one provider                                   |
| `/model <provider> <name>`    | set a model directly (effort prompt only if model supports it)         |
| `/effort <provider> <lvl>`    | set reasoning effort: `low` / `medium` / `high`                        |
| `/save [path]`                | save transcript — `.md` for prose, `.json` to round-trip with `/load`  |
| `/load <path>`                | load conversation from JSON                                            |

### Chat flags

| Flag                        | Description                          |
| --------------------------- | ------------------------------------ |
| `-p, --providers <list>`    | Comma-separated providers            |
| `-s, --system <prompt>`     | System prompt prepended to history   |
| `--no-stream`               | Disable streaming, show a spinner    |
| `--model-<provider> <name>` | Per-provider model override          |
| `-t, --temperature <num>`   | Sampling temperature                 |
| `--timeout <ms>`            | Request timeout in ms                |

Conversation history is shared across providers — each turn's context includes everyone's prior replies. On exit, a session summary prints (turns, tokens, total cost).

### Reasoning effort

Models that accept a reasoning-effort hint (currently OpenAI `o1`, `o1-mini`, and DeepSeek `deepseek-reasoner`) are detected automatically. When you pick one of them, you'll be prompted to choose:

- **low** — fastest, cheapest, shallow reasoning
- **medium** — balanced (default)
- **high** — deepest reasoning, slower & costlier

The selection is sent to the API as `reasoning_effort`. For other models the prompt is skipped silently and any previously stored effort is cleared.

## Project structure

Monorepo using npm workspaces.

```
packages/
  core/                     # @modelclash/core — providers, pricing, retry, cost, orchestrator
    src/providers/          # openai, anthropic, google, groq, openai-compatible (deepseek + ollama)
  cli/                      # modelclash — CLI entrypoint, chat REPL, config command
  server/                   # (optional) HTTP wrapper
.github/
  workflows/
    ci.yml                  # PR + main: build & test on Node 18/20/22
docker-compose.yml          # Ollama service with auto model pull
Dockerfile.ollama           # single image with models baked in
.env.example                # template for environment configuration
```

## Continuous Integration

Every pull request to `main` runs `.github/workflows/ci.yml`:

1. `npm ci`
2. `npm run build`
3. `npm test`

…across Node 18, 20, and 22. To require this before merging, enable branch protection on `main` and select the `test` checks as required.

## Sharing for testing

When sending this repo to someone for testing, point them at the [Quick start](#quick-start-for-testers) and the [free API keys](#free-api-keys) table. They need: Node ≥ 18, the repo, and either one API key or a local Ollama install.

## Keeping the README up to date

This README is the contract with anyone running the project. When a PR changes any of the following, update the matching section in the **same PR**:

- New/removed/renamed CLI flag → **CLI usage › Flags** or **Chat flags**
- New/changed slash command → **Chat mode › Slash commands** (and **Live slash menu** if its key bindings change)
- New reasoning/effort plumbing or model-picker behaviour → **Chat mode › Reasoning effort**
- New/changed npm script → **Running the project**
- New env var or config field → **Configuration**
- New provider → **Features**, **Configuration**, **Flags**, free-tier table, project structure
- New package or moved directory → **Project structure**
- Change to CI steps or Node matrix → **Continuous Integration**
- Change to install or run steps → **Quick start**
- New Docker file or compose change → **Running Ollama in Docker**

## License

MIT
