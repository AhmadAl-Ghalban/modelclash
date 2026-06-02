import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const call = () =>
      this.client.messages.create({
        model: req.model,
        max_tokens: 4096,
        temperature: req.temperature,
        messages: [{ role: "user", content: req.prompt }],
      });

    const res = await retryWithBackoff(() =>
      withTimeout(call(), req.timeoutMs ?? 60_000),
    );

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const usage = {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
      total: res.usage.input_tokens + res.usage.output_tokens,
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
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = this.client.messages.stream({
      model: req.model,
      max_tokens: 4096,
      temperature: req.temperature,
      messages: [{ role: "user", content: req.prompt }],
    });

    stream.on("text", (delta) => {
      text += delta;
      onChunk(delta);
    });

    const final = await stream.finalMessage();
    inputTokens = final.usage.input_tokens;
    outputTokens = final.usage.output_tokens;

    const usage = {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
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
}
