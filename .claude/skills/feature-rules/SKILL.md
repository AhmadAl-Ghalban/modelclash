---
name: feature-rules
description: Enforce project rules for implementing features in cli-firebox. Use whenever a new feature, command, provider, or non-trivial behavior is being added or modified — every feature must ship with unit tests.
---

# Feature implementation rules

These rules apply to any feature work in this repository (new commands, providers, flags, behaviors, or non-trivial refactors).

## Rule 1 — Unit tests are mandatory

Every feature implementation MUST include unit tests. A change is not complete until tests exist and pass.

- Test framework: **Vitest** (see `vitest.config.ts`).
- Place tests next to the code they cover (`foo.ts` → `foo.test.ts`) or under the package's `__tests__/` directory if one already exists.
- Run `npx vitest run` (or the package's test script) before reporting the task as done. Do not claim success on a feature without a green test run.

### What "covered" means

At minimum, a feature's tests must cover:

1. **Happy path** — the primary intended behavior with realistic inputs.
2. **At least one edge case** — empty input, missing config, invalid argument, error from a dependency, etc.
3. **Public surface only** — test the exported function / command / module, not private internals.

### When external services are involved

- Mock network, filesystem, and provider SDK calls at the boundary. Do not hit real APIs in unit tests.
- For provider integrations (OpenAI, Groq, Ollama, etc.), inject or stub the client so tests are deterministic and offline.

### When tests are genuinely not applicable

If a change is purely cosmetic (docs, comments, formatting) or is a config-only tweak with no logic, tests can be skipped — but say so explicitly in the response so the user can confirm.

## Rule 2 — Keep the test suite green

- If your change breaks existing tests, fix the tests (if the contract intentionally changed) or fix the code (if the test caught a regression). Never delete or skip a failing test to make CI pass.

## Rule 3 — Report test results

When finishing a feature task, the end-of-turn summary must state:

- which tests were added or updated, and
- the result of running the suite (e.g. `vitest: 42 passed`).

If tests could not be run (sandbox, missing deps), say so explicitly rather than implying success.
