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
  - **Claude-Code-style intro** — two-column rounded box with greeting, ASCII logo, current working dir, tips, and the active provider list with reasoning-effort badges
  - **Boxed input prompt** — `╭─❯ … ─╮` style with persistent status footer (provider chips · stream mode · temperature · `/ for commands`)
  - **Live slash menu** — type `/` and a filtered command list pops up under the prompt (↑/↓ navigate, Enter selects, Tab autocompletes, Esc dismisses, Backspace deletes the `/` to hide)
  - **Full line editing** — ← / → / Home / End / Ctrl-A / Ctrl-E cursor movement, Ctrl-W delete word, Ctrl-U clear-left, ↑/↓ walks input history (when menu is closed), bracketed-paste support for multi-line pastes
  - **Markdown rendering** in assistant replies — bold, italic, inline code, fenced code blocks, headings, bullet lists; each model's answer framed with a colored `┌─ ● provider · model` header and `└─ tokens · cost · time` footer
  - **Interactive model picker** — on startup and via `/model`, pick a provider then a model from a list (or `✎ custom…` to type your own)
  - **Reasoning effort selection** — when you pick an effort-capable model (OpenAI `o1` / `o1-mini`, DeepSeek `deepseek-reasoner`), choose `low` / `medium` / `high` with one-line trade-off descriptions; sent through as `reasoning_effort`
  - **Auto-save on exit + write permission prompt** — leaving the chat asks if you want to save the transcript (`md` / `json` / `no`), then confirms the path before writing; existing files require explicit overwrite. Default location is `~/modelclash-chats/chat-YYYYMMDD-HHMM.{md,json}` (directory is auto-created). `~/…` paths are expanded.
  - Conversation history, system prompts, session save/load (`.json` or `.md`), mid-chat model swap, `/retry` for the last user message
  - Per-turn comparison table with fastest / cheapest / longest / highest tok/s badges
- Bundled Docker setup for running Ollama locally
- **Web UI + HTTP API** — NestJS backend (`packages/server`) with Postgres-backed chat history & provider settings, plus a Nuxt 3 frontend (`packages/web`) with:
  - **Side-by-side comparison grid** — every provider's answer to one prompt sits in an equal-height card, with tokens / cost / latency aligned in a footer row you can scan across
  - **Responsive shell** — inline sidebar on desktop, overlay drawer with scrim on phones (Escape or tap-outside closes it); usable from 320px up
  - **Light / dark theme toggle** (persists in `localStorage`, defaults to system preference)
  - **Providers dialog** for all 6 providers — toggle, masked API-key input with show/hide, and a curated **model dropdown** per provider (with "+ custom model" fallback). Keys are persisted in Postgres, not the browser
  - Streaming SSE chat with parallel responses per provider, each with a live skeleton until its first token
  - **Real empty, loading and error states** — layout-matched skeletons instead of spinners, one-click example prompts, a "no providers set up" path into the dialog, and human-readable failures with a retry
  - **Undo on delete** instead of a confirmation dialog
  - **Accessible by default** — visible focus rings, keyboard-navigable dialog with a focus trap, labelled controls, `prefers-reduced-motion` honoured, no meaning carried by colour alone
- **MCP server** (`modelclash-mcp`) exposing `compare_models`, `list_providers`, and `estimate_cost` to any MCP client (Claude Code, Claude Desktop, …)
- One-command full stack via `docker compose up -d` (Postgres + NestJS + Nuxt + Ollama)
- TypeScript strict mode, Vitest unit tests, npm workspaces monorepo

## Requirements

- **Node.js ≥ 20** (CI tests on 20, 22; `.nvmrc` pins `20` for local dev — run `nvm use`)
- **npm** (workspaces support — bundled with Node 20+)
- An API key for at least one of: OpenAI, Anthropic, Google, Groq, DeepSeek — **or** a local Ollama install (no key needed)
- **Postgres 16+** — only if you run the NestJS server / web UI natively. Skip if you use `docker compose up -d` (Postgres is included) or only use the CLI.

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

# 4. Try the CLI
npm run cli -- "Explain quantum entanglement in one sentence."
npm run cli -- chat

# …or launch the full web stack (Postgres + NestJS API + Nuxt UI + Ollama)
npm run docker:up
# then open http://localhost:3000
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

# ── NestJS server (packages/server) ─────────────────────────
DATABASE_URL=postgresql://modelclash:modelclash@localhost:5432/modelclash
PORT=3001
FRONTEND_URL=http://localhost:3000

# ── Nuxt frontend (packages/web) ────────────────────────────
NUXT_PUBLIC_API_BASE=http://localhost:3001/api

# ── Docker Compose overrides ────────────────────────────────
# OLLAMA_MODELS=llama3.2 qwen2.5    # space-separated models to pull
# API_BASE=http://server:3001/api   # internal API URL when web runs in Docker
```

The CLI only needs the provider keys at the top. The `DATABASE_URL` / `PORT` / `FRONTEND_URL` block is read by `packages/server`; `NUXT_PUBLIC_API_BASE` is read by `packages/web`.

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

### Running the full web stack in Docker

The bundled `docker-compose.yml` brings up **Postgres + NestJS API + Nuxt UI + Ollama** together:

```bash
# Start everything (Postgres, server :3001, web :3000, Ollama :11434)
docker compose up -d
# or:
npm run docker:up

# Tail backend + frontend logs
npm run docker:logs

# Stop (keeps volumes)
npm run docker:down
```

Once up, open <http://localhost:3000> for the web UI. The API is at <http://localhost:3001/api>.

Ports exposed on the host:

| Service  | Host port    | Notes                                              |
|----------|--------------|----------------------------------------------------|
| Web      | `3000`       | Nuxt UI                                            |
| Server   | `3001`       | NestJS REST + SSE                                  |
| Postgres | `5433`       | Maps to container `5432` to avoid clashing with a local Postgres instance |
| Ollama   | `11434`      | Local model runtime                                |

#### Configuring providers from the UI

1. Open <http://localhost:3000>.
2. Click the **gear icon** at the bottom of the sidebar → *Settings*.
3. For each cloud provider (OpenAI, Anthropic, Google, Groq, DeepSeek): flip the toggle on, paste an API key, and pick a model from the dropdown.
4. For **Ollama**: just flip the toggle on — the server auto-uses `http://ollama:11434/v1` inside the docker network (override with the `OLLAMA_URL` env var on the `server` service). Pick a model that's actually pulled (default compose pulls `llama3.2`).
5. Hit **Save Settings**. Subsequent chat requests use whatever's saved in Postgres — no rebuild needed.

The sidebar's bottom area also has a **light/dark toggle** (sun/moon icon).

### Running Ollama-only in Docker

If you only want Ollama (no server / web), start just that service:

```bash
# Start Ollama + auto-pull the default model (llama3.2)
docker compose up -d ollama ollama-pull

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
| Build all packages (core + CLI + MCP)    | `npm run build`                      |
| Build server (core + NestJS)             | `npm run build:server`               |
| Build web (Nuxt)                         | `npm run build:web`                  |
| Build MCP server (core + MCP)            | `npm run build:mcp`                  |
| Run the built CLI                        | `npm run cli -- <args>`              |
| Run the CLI from TS source (no build)    | `npm run cli:dev -- <args>`          |
| Run NestJS server in watch mode          | `npm run dev:server`                 |
| Run Nuxt frontend in dev mode            | `npm run dev:web`                    |
| Start built NestJS server                | `npm run start:server`               |
| Start MCP server on stdio                | `npm run start:mcp`                  |
| Run MCP server from TS source            | `npm run dev:mcp`                    |
| Run tests once                           | `npm test`                           |
| Run tests in watch mode                  | `npm run test:watch`                 |
| Typecheck the whole monorepo             | `npm run typecheck`                  |
| Clean build outputs                      | `npm run clean`                      |
| Bring up full Docker stack               | `npm run docker:up`                  |
| Stop the Docker stack                    | `npm run docker:down`                |
| Tail server + web Docker logs            | `npm run docker:logs`                |

The `--` separates npm flags from CLI flags, e.g.:

```bash
npm run cli -- --help
npm run cli:dev -- chat
npm run cli -- "Write a haiku about Mondays" --temperature 0.9
```

### Toolchain notes

Two constraints in the web build are load-bearing and easy to undo by accident:

- **`vite` is pinned at the repo root (`^7.3.3`).** Nuxt's builder needs the same Vite *instance* as `@vitejs/plugin-vue`. Without the root pin, Vitest hoists Vite 5 to the root, the plugin binds to that copy, and `nuxt dev` fails with `No entry found in rollupOptions.input`. Vitest keeps its own nested Vite 5 — that is expected.
- **`packages/web` does not set `ssr: false`.** It hits the same builder bug in Nuxt 3.21. All data is fetched client-side anyway, so rendering the static shell on the server costs nothing and improves first paint.

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
| ↑ / ↓          | move selection (or walk input history when menu closed) |
| Enter          | run the highlighted command                             |
| Tab            | autocomplete the highlighted command into the buffer    |
| Backspace      | delete a char (deleting the leading `/` hides the menu) |
| Esc            | clear the buffer and hide the menu                      |
| Ctrl-C         | exit the chat                                           |

### Input editing

The prompt runs in raw mode with full single-line editing:

| Key                       | Action                                          |
| ------------------------- | ----------------------------------------------- |
| ← / →                     | move cursor by character                        |
| Home / End, Ctrl-A / Ctrl-E | jump to start / end                           |
| Ctrl-W                    | delete previous word                            |
| Ctrl-U                    | clear text before the cursor                    |
| Backspace                 | delete the character before the cursor          |
| ↑ / ↓ (menu closed)       | scroll through previous prompts in this session |
| Paste                     | bracketed-paste captures multi-line pastes as one insert; embedded newlines flatten to spaces |
| Ctrl-D                    | EOF — exits if the buffer is empty              |

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
| `/save [path]`                | save transcript — `.md` for prose, `.json` to round-trip with `/load`. Prompts to confirm before writing; `~/…` paths expand. Default location: `~/modelclash-chats/`. |
| `/load <path>`                | load conversation from JSON (accepts `~/…` paths)                      |

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

### Saving transcripts & write permission

`/save [path]` and the auto-save prompt on exit both go through the same flow:

1. **Format picker** (auto-save only): `[md/json/no]`. `md` produces a human-readable transcript with provider headings, models, system prompt, and a stats footer. `json` round-trips with `/load`.
2. **Path prompt** with a default of `~/modelclash-chats/chat-YYYYMMDD-HHMM.{md,json}`. Type your own to override.
3. **Permission prompt**:
   - new file → `write to <path>? [Y/n]` (Enter = yes)
   - existing file → `⚠  file exists — overwrite? [y/N]` (Enter = no, safer default)
4. Parent directory is auto-created with `mkdir -p`. `~/…` paths expand to your home directory.

Decline → `✗ cancelled — not saved`. Failures show both the system error and the absolute path that was attempted, so you can spot permission or typo issues quickly.

### Markdown rendering

Assistant replies pass through a minimal markdown renderer before display:

- `**bold**`, `*italic*`, `` `inline code` ``
- Fenced code blocks (```` ``` ````) render inside a cyan box
- `#`, `##`, `###` headings (bold cyan)
- `- ` / `* ` bullets become coloured `•`

Each provider's response is also framed: a colored `┌─ ● provider · model` header, a left `│` bar on every line, and a `└─ in↑ out↓ tok · $cost · time` footer. Errors show as `│ ✗ <message>`.

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
  mcp/                      # @modelclash/mcp — MCP stdio server (compare_models, list_providers, estimate_cost)
  server/                   # @modelclash/server — NestJS HTTP API (chat, settings, llm), Postgres via TypeORM
    src/chat/               #   sessions, messages, SSE streaming
    src/settings/           #   provider_settings (API keys + model + enabled) in Postgres
    src/llm/                #   bridges core providers using settings from DB
  web/                      # @modelclash/web — Nuxt 3 + Tailwind + Pinia chat UI
    assets/css/main.css     #   design tokens, global focus ring, skeleton, reduced-motion
    tailwind.config.ts      #   brand palette, elevation, motion + `xs` breakpoint
    components/
      AppSidebar.vue        #   sessions, provider status, theme toggle
      ChatInput.vue         #   composer; blocked with a reason when no provider is set up
      MessageBubble.vue     #   user turn, or one model's response card (metrics footer + copy)
      ModelSelect.vue       #   combobox model picker, arrow-key navigable
      ProviderBadge.vue     #   the coloured provider initial, shared by every view
      SettingsModal.vue     #   focus-trapped providers dialog (writes to DB via /api/settings)
      StreamingBubble.vue   #   per-provider live response, skeleton until the first token
    composables/
      useApi.ts             #   fetch wrapper + SSE parser; failures become human sentences
      useFormat.ts          #   token / cost / duration / relative-time formatting
      useProviderMeta.ts    #   single source of truth for provider labels + colours
      useTheme.ts           #   light / dark / system, persisted in localStorage
.github/
  workflows/
    ci.yml                  # PR + main: build & test on Node 18/20/22
docker-compose.yml          # Full stack: postgres (host 5433) + server + web + ollama
Dockerfile.ollama           # single image with models baked in
.env.example                # template for environment configuration
```

## MCP server

`@modelclash/mcp` exposes modelclash over the [Model Context Protocol](https://modelcontextprotocol.io), so any MCP client can fan a prompt out across providers and get usage + cost back.

### Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `compare_models` | `prompt` (required), `providers[]`, `history[]`, `temperature`, `timeoutMs` | Each provider's answer plus tokens, estimated cost, and latency |
| `list_providers` | — | All six providers, whether each has credentials, and the model that would be used |
| `estimate_cost` | `model`, `inputTokens`, `outputTokens` | USD estimate from the built-in pricing table |

Every tool also returns `structuredContent`, so clients that support structured tool output get typed results instead of parsing the text.

### Configuration

The server reads the **same** credentials as the CLI — environment variables first, then `~/.modelclash/config.json` (see [Configuration](#configuration)). Config is re-read on every call, so `modelclash config set …` takes effect without restarting the server. `compare_models` queries every configured provider unless you pass `providers`.

### Run it

```bash
npm run build:mcp     # build @modelclash/core + @modelclash/mcp
npm run start:mcp     # serve on stdio
npm run dev:mcp       # run from TypeScript source, no build step
```

### Register with a client

Claude Code:

```bash
claude mcp add modelclash -- node /absolute/path/to/cli-firebox/packages/mcp/dist/index.js
```

Claude Desktop — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "modelclash": {
      "command": "node",
      "args": ["/absolute/path/to/cli-firebox/packages/mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Use absolute paths — clients do not launch the server from this repo's directory. The transport is stdio, so the server writes **only** protocol messages to stdout; diagnostics go to stderr.

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
- Change to the input prompt key bindings → **Chat mode › Input editing**
- Change to save/load paths, defaults, or the permission prompt → **Chat mode › Saving transcripts & write permission**
- Change to assistant-side rendering (markdown, message frame) → **Chat mode › Markdown rendering**
- New/changed npm script → **Running the project**
- New env var or config field → **Configuration**
- New provider → **Features**, **Configuration**, **Flags**, free-tier table, project structure
- New package or moved directory → **Project structure**
- Change to CI steps or Node matrix → **Continuous Integration**
- Change to install or run steps → **Quick start**
- New Docker file or compose change → **Running Ollama in Docker**

## License

MIT
