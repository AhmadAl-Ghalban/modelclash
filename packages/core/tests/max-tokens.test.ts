import { describe, it, expect, vi } from "vitest";
import { DEFAULT_MAX_TOKENS } from "../src/index.js";

/**
 * Every provider must send an explicit output cap.
 *
 * Providers that ration by tokens-per-minute charge a request as prompt + the
 * maximum completion it could produce. Omitting the cap reserves the model's
 * whole output window against the quota, and Groq rejects even a three-word
 * prompt with `413 request_too_large`. These tests capture the request each
 * provider builds and assert the cap is present.
 */

function captureOpenAIStyle() {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: "hi" } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
  return { create, client: { chat: { completions: { create } } } };
}

const REQUEST = { prompt: "hi", model: "m", temperature: 0.7, timeoutMs: 5_000 };

describe("output token cap", () => {
  it("Groq sends max_tokens on generate", async () => {
    const { GroqProvider } = await import("../src/providers/groq.js");
    const provider = new GroqProvider("k");
    const { create, client } = captureOpenAIStyle();
    (provider as unknown as { client: unknown }).client = client;

    await provider.generate(REQUEST);
    expect(create.mock.calls[0][0].max_tokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("Groq sends max_tokens on the streaming path too", async () => {
    const { GroqProvider } = await import("../src/providers/groq.js");
    const provider = new GroqProvider("k");
    const create = vi.fn().mockResolvedValue([]);
    (provider as unknown as { client: unknown }).client = {
      chat: { completions: { create } },
    };

    await provider.streamGenerate(REQUEST, () => {});
    expect(create.mock.calls[0][0].max_tokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("OpenAI sends max_tokens", async () => {
    const { OpenAIProvider } = await import("../src/providers/openai.js");
    const provider = new OpenAIProvider("k");
    const { create, client } = captureOpenAIStyle();
    (provider as unknown as { client: unknown }).client = client;

    await provider.generate(REQUEST);
    expect(create.mock.calls[0][0].max_tokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("an explicit maxTokens overrides the default", async () => {
    const { GroqProvider } = await import("../src/providers/groq.js");
    const provider = new GroqProvider("k");
    const { create, client } = captureOpenAIStyle();
    (provider as unknown as { client: unknown }).client = client;

    await provider.generate({ ...REQUEST, maxTokens: 128 });
    expect(create.mock.calls[0][0].max_tokens).toBe(128);
  });
});
