# modelclash — Feature & SDK Roadmap

Suggestions for extending `modelclash` with new capabilities, additional AI provider SDKs, and richer interaction modes.

---

## 1. New AI Provider SDKs

Extend `src/providers/` with new adapters that implement the existing `LLMProvider` interface.

| Provider          | SDK / Package                          | Notes                                        |
| ----------------- | -------------------------------------- | -------------------------------------------- |
| Mistral AI        | `@mistralai/mistralai`                 | Open-weights + hosted models                 |
| Cohere            | `cohere-ai`                            | Strong on RAG and rerank                     |
| Groq              | `groq-sdk`                             | Ultra-low-latency Llama / Mixtral inference  |
| xAI Grok          | OpenAI-compatible REST                 | Reuse OpenAI client with custom `baseURL`    |
| DeepSeek          | OpenAI-compatible REST                 | Reasoning + coding models                    |
| Perplexity        | `pplx-api` (OpenAI-compatible)         | Built-in web search                          |
| Together AI       | `together-ai`                          | Hosted open-source models                    |
| Fireworks AI      | `fireworks-ai`                         | Fast OSS hosting                             |
| Ollama (local)    | `ollama` npm package                   | Run local models offline                     |
| AWS Bedrock       | `@aws-sdk/client-bedrock-runtime`      | Multi-vendor enterprise gateway              |
| Azure OpenAI      | `openai` with Azure endpoint           | Enterprise OpenAI deployments                |
| Vertex AI         | `@google-cloud/vertexai`               | Google enterprise Gemini + 3rd-party models  |
| OpenRouter        | OpenAI-compatible REST                 | Single key, hundreds of models               |
| Hugging Face      | `@huggingface/inference`               | Inference Endpoints + serverless             |

Implementation pattern:

```ts
// src/providers/mistral.ts
export class MistralProvider implements LLMProvider {
  readonly name = "mistral" as const;
  async generate(req: ProviderRequest): Promise<ProviderResponse> { /* ... */ }
  async streamGenerate(req, onChunk) { /* ... */ }
}
```

Then register in `buildProviders()` in `src/index.ts` and add pricing in `src/config/pricing.ts`.

---

## 2. New AI Modes

Modes change *how* the prompt is processed across providers. Each can be exposed as a CLI subcommand or `--mode` flag.

### 2.1 Chat Mode (multi-turn)
- Persistent conversation history per provider.
- Save/resume sessions to `~/.modelclash/sessions/<id>.json`.
- Flag: `modelclash chat --session my-session`.

### 2.2 Streaming-All Mode
- True concurrent streaming (currently `--stream` runs sequentially).
- Render each provider in its own terminal column using a TUI lib (`ink`, `blessed`).

### 2.3 Judge / Arbitration Mode
- After all models reply, send the responses back to a "judge" model.
- Judge ranks answers on correctness, clarity, conciseness.
- Flag: `--judge anthropic` or `--judge auto` (rotates judges).

### 2.4 Consensus / Ensemble Mode
- Synthesize a single answer by merging multi-model outputs.
- Useful for factual Q&A; reduces hallucination.

### 2.5 Tool-Use / Function Calling Mode
- Define tools in a config file (`tools.json`).
- Route calls through each SDK's native tool-use API (OpenAI functions, Anthropic tools, Gemini function calling).
- Built-in tools: web search, file read, shell exec (sandboxed), calculator.

### 2.6 Vision Mode
- Accept `--image <path-or-url>` and forward to multimodal models.
- Compare image-understanding across GPT-4o, Claude, Gemini.

### 2.7 Audio Mode
- Whisper (OpenAI) / Gemini audio input.
- TTS output via OpenAI / ElevenLabs.

### 2.8 RAG Mode
- Embed local documents (`--docs ./folder`).
- Vector store: in-memory (HNSW) or pluggable (Chroma, pgvector).
- Inject top-k chunks into each provider's prompt.

### 2.9 Agent Mode
- ReAct-style loop with tool calls until completion.
- Per-provider agent runs; compare reasoning traces.

### 2.10 Code Mode
- Specialized prompt template for code generation.
- Auto-run / lint the produced code in a sandbox; report pass/fail.

### 2.11 Benchmark Mode
- Run a YAML suite of prompts with expected answers / rubrics.
- Produce a scorecard (accuracy, latency, $/query) per model.
- Flag: `modelclash bench suite.yaml`.

### 2.12 Cost-Optimizer Mode
- Estimate the cost of a prompt across all configured models before sending.
- Auto-route to cheapest model meeting a quality threshold.

### 2.13 Diff Mode
- Highlight semantic / textual differences between provider outputs (using a diff lib + embeddings).

### 2.14 Prompt-Refinement Mode
- Iteratively rewrite the user prompt using a meta-model, then re-run.

---

## 3. Developer & UX Features

- **Interactive REPL** (`modelclash repl`) with slash commands (`/model`, `/save`, `/clear`).
- **Config file** at `~/.modelclash/config.yaml` for defaults, aliases, model groups.
- **Model groups / aliases**: `--group fast` → cheapest models from each provider.
- **Markdown rendering** in terminal (`marked-terminal`) for nicer answers.
- **Export formats**: `--save out.md`, `--save out.html`, `--save out.csv`.
- **History log** of all runs to a local SQLite DB for later querying.
- **Plugin system**: load providers/modes from `node_modules/modelclash-plugin-*`.
- **MCP (Model Context Protocol) support**: expose modelclash as an MCP server and consume MCP tools.
- **Web UI**: `modelclash serve` → local Express + minimal React dashboard.
- **Telemetry opt-in**: anonymous latency/cost stats to help compare providers over time.

---

## 4. Reliability & Quality

- **Caching** of identical (prompt, model, temperature) requests to disk.
- **Rate-limit handling** per provider (token-bucket).
- **Structured logging** (`pino`) with `--verbose`.
- **Snapshot tests** for formatter output across modes.
- **E2E tests** with provider mocks (`msw` / `nock`).
- **GitHub Action**: nightly bench run, post results to a markdown badge.

---

## 5. Suggested Implementation Order

1. Add OpenRouter + Groq providers (low effort, big model coverage win).
2. Implement Chat Mode + session persistence.
3. Add Judge Mode (high user value, small code).
4. Vision Mode (already supported by all three current SDKs).
5. RAG Mode + local vector store.
6. Benchmark Mode + YAML suite format.
7. MCP server interface.
8. Web UI.

---

## 6. New CLI Surface (proposed)

```bash
modelclash "prompt"                              # current behavior
modelclash chat --session work                   # multi-turn
modelclash bench prompts.yaml --save report.md   # benchmark suite
modelclash judge "prompt" --judge anthropic      # arbitration
modelclash vision "describe this" --image x.png  # multimodal
modelclash rag "question" --docs ./papers        # retrieval-augmented
modelclash agent "task" --tools tools.json       # tool-use agent
modelclash serve --port 4000                     # local web UI
```
