import Groq from "groq-sdk";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { DEFAULT_MAX_TOKENS } from "../config/catalog.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

export class GroqProvider implements LLMProvider {
  readonly name = "groq" as const;
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const call = () =>
      this.client.chat.completions.create({
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: req.temperature,
        messages: [
          ...(req.history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: req.prompt },
        ],
      });

    const res = await retryWithBackoff(() =>
      withTimeout(call(), req.timeoutMs ?? 60_000),
    );

    const text = res.choices[0]?.message?.content ?? "";
    const usage = {
      input: res.usage?.prompt_tokens ?? 0,
      output: res.usage?.completion_tokens ?? 0,
      total: res.usage?.total_tokens ?? 0,
    };
    return {
      provider: this.name,
      model: req.model,
      text,
      usage,
      costUsd: estimateCost(req.model, usage),
      durationMs: Date.now() - start,
    };
  }

  async streamGenerate(
    req: ProviderRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ProviderResponse> {
    const start = Date.now();
    const stream = await this.client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature,
      messages: [{ role: "user", content: req.prompt }],
      stream: true,
    });

    let text = "";
    let usage = { input: 0, output: 0, total: 0 };
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        text += delta;
        onChunk(delta);
      }
      const x = chunk as { x_groq?: { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } } };
      if (x.x_groq?.usage) {
        usage = {
          input: x.x_groq.usage.prompt_tokens,
          output: x.x_groq.usage.completion_tokens,
          total: x.x_groq.usage.total_tokens,
        };
      }
    }

    return {
      provider: this.name,
      model: req.model,
      text,
      usage,
      costUsd: estimateCost(req.model, usage),
      durationMs: Date.now() - start,
    };
  }
}
