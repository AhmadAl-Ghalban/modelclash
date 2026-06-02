import { GoogleGenAI } from "@google/genai";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

export class GoogleProvider implements LLMProvider {
  readonly name = "google" as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const call = () =>
      this.client.models.generateContent({
        model: req.model,
        contents: req.prompt,
        config: { temperature: req.temperature },
      });

    const res = await retryWithBackoff(() =>
      withTimeout(call(), req.timeoutMs ?? 60_000),
    );

    const text = res.text ?? "";
    const meta = res.usageMetadata;
    const usage = {
      input: meta?.promptTokenCount ?? 0,
      output: meta?.candidatesTokenCount ?? 0,
      total: meta?.totalTokenCount ?? 0,
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
    const stream = await this.client.models.generateContentStream({
      model: req.model,
      contents: req.prompt,
      config: { temperature: req.temperature },
    });

    let text = "";
    let usage = { input: 0, output: 0, total: 0 };

    for await (const chunk of stream) {
      const delta = chunk.text ?? "";
      if (delta) {
        text += delta;
        onChunk(delta);
      }
      if (chunk.usageMetadata) {
        usage = {
          input: chunk.usageMetadata.promptTokenCount ?? 0,
          output: chunk.usageMetadata.candidatesTokenCount ?? 0,
          total: chunk.usageMetadata.totalTokenCount ?? 0,
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
