# modelclash ⚔️

A production-ready CLI tool to compare responses from **OpenAI**, **Anthropic**, **Google**, **Groq**, **DeepSeek**, and local **Ollama** models — side-by-side from a single prompt, in an interactive multi-turn chat, or as a multi-model code reviewer pointed at a project folder.

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
- **Project review subcommand** — `modelclash review <path> [request]` bundles every reviewable source file under a folder and asks all selected providers for a thorough code review in parallel (same provider-picker, JSON/save, streaming, and summary table as the one-shot mode)
- **Agent-style chat** — replies end with a numbered `Next steps` block you can run with `/pick 1|2|3`, and any fenced code block tagged `path=foo/bar.ts` is offered to write straight to disk (with overwrite prompts)
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

## Review mode

Point modelclash at a project folder and every selected provider produces an independent code review in parallel — same comparison table, same `--json` / `--save` plumbing as the one-shot mode.

```bash
# General review across all providers with keys (interactive picker in a TTY)
npm run cli -- review ./my-app

# Targeted review with a specific request
npm run cli -- review ./my-app "Focus on auth, sessions, and CSRF risks"

# Pin providers, save the JSON report
npm run cli -- review ./my-app --providers openai,anthropic --save review.json

# Cap how much source gets bundled (bytes)
npm run cli -- review ./my-app --max-bytes 200000
```

modelclash walks the folder, skips `node_modules`, `dist`, `.git`, lockfiles, binaries, etc., and packs the remaining source into a single prompt. A header line reports `<n> files · <KB> · (truncated)` if the byte cap kicked in.

### Review flags

| Flag                        | Description                                                | Default |
| --------------------------- | ---------------------------------------------------------- | ------- |
| `-p, --providers <list>`    | Comma-separated providers                                  | all with keys |
| `--model-<provider> <name>` | Per-provider model override                                | per-provider default |
| `-t, --temperature <num>`   | Sampling temperature                                       | `0.7`   |
| `--stream`                  | Stream responses (sequential)                              | `false` |
| `--json`                    | Output JSON only (suppresses picker)                       | `false` |
| `--save <file>`             | Save JSON report to file                                   | —       |
| `--timeout <ms>`            | Request timeout in ms                                      | `60000` |
| `--max-bytes <n>`           | Max total bytes of source to bundle into the prompt        | built-in cap |

The same review flow is also available inside chat as the `/review <path> [request]` slash command — it reuses the chat's current providers/models and writes the resulting markdown to `review-<folder>-<YYYYMMDD-HHMM>.md` in your cwd.

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
| `/review <path> [request]`    | bundle a project folder and ask the current providers to review it; saves a `review-<folder>-<stamp>.md` next to where you ran the CLI |
| `/pick <n>`                   | run suggestion 1, 2, or 3 from the last `Next steps` block as your next prompt |
| `/write [path]`               | save the last assistant response to a markdown file (default `response-YYYYMMDD-HHMM.md` in cwd) |
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

### Agent behaviour — `Next steps` & file writing

Unless you pass `-s/--system`, chat boots with an agent-style system prompt that asks the model to:

1. **End every reply with a `### Next steps` block** of three concrete, conversation-specific suggestions. modelclash parses that block and prints:

   ```
   ▎ next steps  (/pick 1, /pick 2, /pick 3)
     [1] add a /pick <n> slash command to chat-cmd.ts
     [2] write Vitest coverage for extractNextSteps
     [3] document /review in the README
   ```

   `/pick 1` (or `2`, `3`) sends that exact suggestion as your next prompt.

2. **Return full file contents in fenced blocks tagged with a destination path**, e.g.:

   ````
   ```typescript path=packages/cli/src/foo.ts
   // full file contents…
   ```
   ````

   After the reply renders, modelclash lists every detected file and asks `write to disk? [Y/n/i=pick individually]`. Existing paths require an explicit `y` to overwrite. `~/…` paths expand. Snippets without `path=` are treated as plain examples and not written.

Pass `-s "<your prompt>"` (or set `/system <text>` mid-chat) to replace the agent prompt with your own — the `/pick` and file-write behaviour will still work if your model happens to produce the same formats, but won't be elicited by default.

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
  cli/                      # modelclash — CLI entrypoint, chat REPL, config + review commands
    src/chat-cmd.ts         # chat REPL, agent prompt, /pick + file-write extraction
    src/review-cmd.ts       # `review <path>` subcommand
    src/project-context.ts  # walks a project folder & builds the review prompt
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
- New/changed `review` flag or behaviour → **Review mode**
- Change to the agent system prompt, `Next steps` parsing, or `path=` file-write flow → **Chat mode › Agent behaviour**
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
