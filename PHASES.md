# modelclash — Implementation Phases

Step-by-step build plan for evolving `modelclash` from a CLI-only tool into a CLI + local web portal with shared core, configuration UI, and advanced AI modes.

Each phase is independently shippable. Effort sizes: **S** = 1–2 days, **M** = 3–7 days, **L** = 1–2 weeks, **XL** = 3+ weeks.

---

## Phase 0 — Refactor to Monorepo (Foundation)

**Goal:** Extract the provider/cost/formatter logic into a shared `core` package so both the CLI and the future web portal use the same code.

**Effort:** S

**Tasks**
- Convert the repo to npm workspaces.
- Create `packages/core/` containing:
  - `providers/` (openai, anthropic, google)
  - `interfaces/`, `types/`, `config/pricing.ts`
  - `utils/cost.ts`, `utils/retry.ts`
  - A single `runPrompt(prompt, opts, providers)` orchestrator (extracted from `src/index.ts`).
- Create `packages/cli/` that imports from `@modelclash/core` and only owns:
  - Commander setup, argument parsing
  - Terminal formatter, color, spinner
  - `dotenv` loading
- Update `package.json` scripts and `tsconfig` references.
- Keep CLI behavior 100% unchanged. All existing tests must pass.

**Deliverables**
- `packages/core` published-ready (private for now).
- `packages/cli` works exactly as before.
- `npm run build` builds both.

**Acceptance**
- `modelclash "test"` produces identical output to current main.
- No new dependencies in `core`.

---

## Phase 1 — Local API Server (`modelclash serve`)

**Goal:** Run a local HTTP server that exposes the core engine over REST + SSE so any UI can drive it.

**Effort:** S

**Tasks**
- Add `packages/server/` (Fastify, TypeScript).
- Endpoints:
  - `GET  /api/providers` — list configured providers + default models.
  - `POST /api/generate` — run prompt across providers, return JSON report.
  - `GET  /api/generate/stream` — SSE stream of chunks per provider.
  - `GET  /api/health`.
- Add `modelclash serve --port 4000` subcommand that boots the server.
- CORS restricted to `localhost` by default.
- Reuse `runPrompt` from `core` — no duplicated logic.

**Deliverables**
- `modelclash serve` launches API.
- `curl localhost:4000/api/generate -d '{"prompt":"hi"}'` returns a report.

**Acceptance**
- SSE streaming works for OpenAI, Anthropic, Google in parallel.
- Errors per provider surface as structured JSON, not 500s.

---

## Phase 2 — Web Portal v1 (Read-only Compare UI)

**Goal:** Minimal Next.js portal that lets a user enter a prompt and watch responses stream side-by-side.

**Effort:** M

**Tasks**
- Add `packages/web/` (Next.js 15 + Tailwind + shadcn/ui).
- Pages:
  - `/` — prompt box, model picker per provider, temperature slider.
  - Results view: 3-column streaming layout, per-column token count + cost + duration.
  - Summary table (mirrors current CLI summary).
- API calls go to the Phase 1 server (configurable base URL).
- `modelclash serve --web` boots both the API and the Next.js app.

**Deliverables**
- Browser-based prompt comparison at `http://localhost:4000`.
- Dark mode, responsive, copy-to-clipboard on each response.

**Acceptance**
- Same prompt yields the same providers/results as the CLI.
- Streaming is visibly concurrent (not sequential).

---

## Phase 3 — Configuration Portal

**Goal:** Replace `.env` editing with a real settings UI. This is the biggest UX win.

**Effort:** M

**Tasks**
- Storage: `~/.modelclash/config.json` (file mode `0600`, OS keychain optional via `keytar`).
- Settings page sections:
  - **API Keys** — masked inputs for OpenAI, Anthropic, Google (and future providers). Test-connection button.
  - **Default Models** — dropdowns populated from each provider's models endpoint where available.
  - **Defaults** — temperature, timeout, retry policy.
  - **Model Groups / Aliases** — e.g. `fast` = `gpt-4o-mini` + `claude-haiku` + `gemini-flash`.
  - **Appearance** — theme, density.
- CLI reads the same config file; precedence: flag > env > config file > built-in default.
- `modelclash config get|set|path` subcommands for scripting.

**Deliverables**
- Users can fully configure modelclash without touching a terminal.
- CLI and portal share one config source of truth.

**Acceptance**
- Setting a key in the portal makes the CLI work immediately (no restart).
- Keys never leave the local machine; not logged.

---

## Phase 4 — Sessions, History, Saved Prompts

**Goal:** Persist what users do so they can revisit and iterate.

**Effort:** M

**Tasks**
- SQLite via `better-sqlite3` at `~/.modelclash/data.db`.
- Tables: `runs`, `messages`, `sessions`, `saved_prompts`, `tags`.
- Portal pages:
  - **History** — searchable list of past runs with cost rollups.
  - **Sessions** — multi-turn chat threads (foundation for Chat Mode).
  - **Library** — saved prompts with tags + variables.
- CLI: `modelclash history`, `modelclash replay <id>`.

**Deliverables**
- Every run is recorded automatically (opt-out flag).
- Cost-per-day / per-model charts on a dashboard tile.

**Acceptance**
- 10k runs in DB stays under 200 ms list-query latency.
- Export to JSON / Markdown works.

---

## Phase 5 — Expand Provider Coverage

**Goal:** Multiply value with cheap-to-add providers.

**Effort:** M

**Tasks**
- Add providers (all implement existing `LLMProvider` interface):
  - **OpenRouter** (one key, hundreds of models)
  - **Groq** (low-latency Llama/Mixtral)
  - **Mistral**
  - **DeepSeek**
  - **Ollama** (local models, no API key)
- Update `pricing.ts` with the new model rates.
- Portal: provider toggles in settings; new providers appear as additional result columns.

**Deliverables**
- Comparing 5–8 models in one shot becomes the norm.

**Acceptance**
- New providers are pure additions; no changes to `core` interfaces.

---

## Phase 6 — Advanced AI Modes in UI

**Goal:** Surface the modes proposed in `ROADMAP.md` §2 through the portal where they shine.

**Effort:** L

**Tasks**
- **Chat Mode** — multi-turn UI, branching conversations, per-provider thread.
- **Judge Mode** — after responses arrive, send them to a chosen judge model; show ranked scorecard.
- **Vision Mode** — drag-and-drop image upload; route to multimodal models.
- **RAG Mode** — drop a folder of docs; in-memory HNSW index; show retrieved chunks alongside answers.
- **Tool-Use Mode** — JSON-schema tool editor; per-provider tool-call traces.

**Deliverables**
- Each mode is a portal route + a CLI subcommand sharing the same core handler.

**Acceptance**
- Switching modes does not require restarting the server.

---

## Phase 7 — Benchmark Dashboard

**Goal:** Turn modelclash into a model-evaluation tool, not just a chat comparator.

**Effort:** L

**Tasks**
- YAML suite format: prompts, expected answers, rubric, scoring method.
- Runner executes the suite across selected providers/models in parallel.
- Dashboard charts: accuracy, latency p50/p95, $/query, win-rate matrix.
- Export shareable HTML/Markdown report.
- CLI: `modelclash bench suite.yaml --save report.html`.

**Deliverables**
- One-command nightly bench in CI; result badge in README.

**Acceptance**
- Re-running the same suite produces deterministic results when temperature is 0.

---

## Phase 8 — MCP + Plugin System

**Goal:** Make modelclash extensible without forking.

**Effort:** L

**Tasks**
- Expose modelclash as an MCP server (providers + modes as MCP tools).
- Consume external MCP tools inside Tool-Use and Agent modes.
- Plugin discovery: any `modelclash-plugin-*` package in `node_modules` is auto-loaded.
- Document plugin authoring (provider plugin, mode plugin).

**Deliverables**
- A third party can publish `modelclash-plugin-mistral` and have it Just Work.

**Acceptance**
- An MCP-compatible client (e.g. Claude Desktop) can call modelclash tools.

---

## Phase 9 — Hosted SaaS (Optional)

**Goal:** Offer modelclash as a hosted product for teams that don't want to run it locally.

**Effort:** XL

**Tasks**
- Auth (NextAuth or Clerk).
- Per-user encrypted API key vault (AWS KMS or libsodium sealed boxes).
- Postgres replaces SQLite.
- Per-org billing, usage quotas, audit log.
- Team features: shared prompt library, shared bench suites, role-based access.
- Deploy target: Vercel (web) + Fly.io/Render (API) + Neon (Postgres).

**Deliverables**
- Public landing page + signup flow.
- Free tier with BYO keys; paid tier with managed keys/credits.

**Acceptance**
- Security review passes (key encryption at rest, no plaintext in logs).
- SOC2-readiness checklist started.

---

## Cross-Cutting Workstreams (run alongside phases)

| Workstream      | Notes                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Testing         | Vitest unit + `msw` provider mocks + Playwright E2E for portal.       |
| Observability   | `pino` structured logs, optional OpenTelemetry traces.                |
| Security        | `npm audit` in CI, Dependabot, secret scanning, CSP on the portal.    |
| Docs            | Per-phase docs page; auto-generated CLI reference from commander.     |
| Release         | Changesets for versioning; GitHub Actions for build + publish.        |

---

## Suggested Order & Milestones

```
M1 (Week 1–2):   Phase 0 + Phase 1   →  Refactored core + local API
M2 (Week 3–5):   Phase 2 + Phase 3   →  Web portal v1 + Config UI  ← biggest UX win
M3 (Week 6–8):   Phase 4 + Phase 5   →  Persistence + more providers
M4 (Week 9–12):  Phase 6             →  Advanced modes
M5 (Week 13–16): Phase 7 + Phase 8   →  Benchmarks + plugins/MCP
M6 (optional):   Phase 9             →  Hosted SaaS
```

---

## Open Questions to Decide Before Starting

1. Local-only first, or build with hosted in mind from day one?
2. Next.js for the portal, or Vite + React with the Fastify server staying primary?
3. Where to store API keys: plain file (chmod 600), OS keychain via `keytar`, or both?
4. SQLite location: `~/.modelclash/` vs. XDG-compliant paths?
5. Pricing for hosted tier (if Phase 9 happens) — BYO-keys-only, or managed credits?
