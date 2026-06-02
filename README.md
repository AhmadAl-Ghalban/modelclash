# modelclash ⚔️

A production-ready CLI tool to compare responses from **OpenAI**, **Anthropic**, and **Google** models side-by-side from a single prompt.

## Features

- Parallel calls to OpenAI, Anthropic, and Google via official SDKs
- Token usage reporting and per-model cost estimation
- Configurable per-provider model selection, temperature, and timeout
- Optional streaming (sequential) output
- JSON output mode + file save
- Retry with exponential backoff and per-request timeouts
- Colored terminal UI with side-by-side summary table
- TypeScript strict mode, Vitest unit tests

## Installation

```bash
git clone <repo-url> modelclash
cd modelclash
npm install
npm run build
npm link        # makes `modelclash` available globally
```

Or run directly from source:

```bash
npm install
npm run dev -- "your prompt"
```

## Configuration

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

Providers without configured keys are simply skipped.

## Usage

```bash
modelclash "<prompt>" [options]
```

### Flags

| Flag                       | Description                          | Default              |
| -------------------------- | ------------------------------------ | -------------------- |
| `--model-openai <model>`   | OpenAI model                         | `gpt-4o`             |
| `--model-anthropic <model>`| Anthropic model                      | `claude-sonnet-4`    |
| `--model-google <model>`   | Google model                         | `gemini-2.5-pro`     |
| `-t, --temperature <num>`  | Sampling temperature                 | `0.7`                |
| `--stream`                 | Stream responses                     | `false`              |
| `--json`                   | Output JSON only                     | `false`              |
| `--save <file>`            | Save JSON report to file             | —                    |
| `--timeout <ms>`           | Request timeout in ms                | `60000`              |

### Examples

Basic comparison:

```bash
modelclash "Explain quantum entanglement in one sentence."
```

Override a model and temperature:

```bash
modelclash "Write a haiku about Mondays" \
  --model-openai gpt-4o-mini \
  --temperature 0.9
```

Stream responses and save JSON:

```bash
modelclash "Summarize the Iliad" --stream --save out.json
```

Pure JSON output (for piping):

```bash
modelclash "What is the capital of Iceland?" --json | jq '.results[].text'
```

## Project Structure

```
src/
  index.ts                 # CLI entrypoint
  providers/
    openai.ts
    anthropic.ts
    google.ts
  interfaces/
    provider.ts            # LLMProvider interface
  config/
    pricing.ts             # Per-model pricing
  utils/
    cost.ts                # Cost estimation
    formatter.ts           # Terminal output
    retry.ts               # Backoff + timeouts
  types/
    index.ts
tests/
  cost.test.ts
  formatter.test.ts
```

## Development

```bash
npm run dev -- "prompt"   # run from source
npm run build             # compile to dist/
npm test                  # vitest
```

## License

MIT
