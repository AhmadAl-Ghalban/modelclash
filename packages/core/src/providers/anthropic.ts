import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ModelInfo,
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { DEFAULT_MAX_TOKENS } from "../config/catalog.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    // Called over REST: the pinned @anthropic-ai/sdk (0.30) predates the Models
    // API, and upgrading it would touch the message path too. Swap this for
    // `client.models.list()` whenever the SDK is bumped.
    const models: ModelInfo[] = [];
    let after: string | undefined;

    do {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after_id", after);

      const res = await fetch(url, {
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) throw new Error(`Anthropic models request failed (${res.status})`);

      const body = (await res.json()) as {
        data?: { id: string; display_name?: string }[];
        has_more?: boolean;
        last_id?: string;
      };
      for (const m of body.data ?? []) {
        models.push({ id: m.id, label: m.display_name });
      }
      after = body.has_more ? body.last_id : undefined;
    } while (after);

    return models;
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const call = () =>
      this.client.messages.create({
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
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature,
      messages: [
        ...(req.history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: req.prompt },
      ],
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
