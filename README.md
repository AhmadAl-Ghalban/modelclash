# modelclash ⚔️

A production-ready CLI tool to compare responses from **OpenAI**, **Anthropic**, **Google**, **Groq**, **DeepSeek**, and local **Ollama** models side-by-side from a single prompt.

> **Keep this file in sync.** Whenever you add, remove, or change a feature, flag, script, env var, or run step, update the matching section of this README in the **same PR**. CI (see [Continuous Integration](#continuous-integration)) does not check docs — reviewers do.

## Features

- Parallel calls to OpenAI, Anthropic, Google, Groq, DeepSeek, and Ollama (local)
- Token usage reporting and per-model cost estimation
- Configurable per-provider model selection, temperature, and timeout
- Optional streaming (sequential) output
- JSON output mode + file save
- Retry with exponential backoff and per-request timeouts
- Colored terminal UI with side-by-side summary table
- User config at `~/.modelclash/config.json` (managed via `modelclash config`)
- Pick which providers to run (`--providers openai,groq` or interactive picker)
- Multi-turn `modelclash chat` REPL with conversation history
- TypeScript strict mode, Vitest unit tests, npm workspaces monorepo

## Requirements

- **Node.js ≥ 18** (CI tests on 18, 20, 22)
- **npm** (workspaces support — bundled with Node 18+)
- API keys for at least one of: OpenAI, Anthropic, Google, Groq

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
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434/v1
```

**Free API keys** to try modelclash without spending money:

| Provider     | Free tier                                                                              | Sign-up                               |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------- |
| **Groq**     | Generous free rate limits, very fast Llama 3.3 70B                                     | https://console.groq.com/keys         |
| **Google**   | Free Gemini tier (15 RPM)                                                              | https://aistudio.google.com/apikey    |
| **DeepSeek** | Free starter credits, strong reasoning (`deepseek-chat`, `deepseek-reasoner`)          | https://platform.deepseek.com         |
| **Ollama**   | 100% local — no key, no network. Install Ollama, `ollama pull llama3.2`, set base URL  | https://ollama.com                    |

#### Running Ollama in Docker

If you don't want to install Ollama on your host, use the bundled `docker-compose.yml`:

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

Alternatively, `Dockerfile.ollama` builds a single image with models pre-baked (useful for offline/air-gapped use):

```bash
docker build -f Dockerfile.ollama -t modelclash-ollama \
  --build-arg OLLAMA_MODELS="llama3.2 qwen2.5" .
docker run -d -p 11434:11434 --name ollama modelclash-ollama
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
| `--model-groq <model>`      | Groq model                 | `llama-3.3-70b-versatile` |
| `--model-deepseek <model>`  | DeepSeek model             | `deepseek-chat`    |
| `--model-ollama <model>`    | Ollama model               | `llama3.2`         |
| `-p, --providers <list>`    | Providers to use (comma-separated, e.g. `openai,groq`). If omitted in a TTY, an interactive picker appears. | all with keys |
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

# Only run specific providers (skip ones you don't want to use)
npm run cli -- "Hello" --providers openai,groq
```

## Chat mode

Multi-turn conversation against the providers you pick:

```bash
npm run cli -- chat                          # interactive picker
npm run cli -- chat --providers openai,groq  # explicit selection
```

In the REPL:

| Command                       | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `/help`, `/?`                 | list commands                                 |
| `/exit`, `/q`                 | leave the chat (or Ctrl+D)                    |
| `/clear`                      | clear the screen                              |
| `/reset`                      | clear conversation history                    |
| `/history`                    | print conversation history                    |
| `/providers`                  | list selected providers + models              |
| `/stats`                      | session totals (turns, tokens, cost)          |
| `/stream`                     | toggle streaming on/off                       |
| `/temp <n>`                   | change sampling temperature                   |
| `/system <text>`              | set system prompt (`/system off` to clear)    |
| `/model <provider> <name>`    | switch a provider's model mid-chat            |
| `/save <path>`                | save conversation to JSON                     |
| `/load <path>`                | load conversation from JSON                   |
| end line with `\`             | multi-line input                              |

Flags: `--system "<prompt>"`, `--no-stream`, `-p openai,groq`, plus per-provider `--model-<name>`, `-t`, `--timeout`.

Responses stream live one provider at a time with a `↳ in↑ out↓ tok · $cost · seconds` footer. Conversation history is shared across providers — each turn's context includes everyone's prior replies. On exit, a session summary prints (turns, tokens, total cost).

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
