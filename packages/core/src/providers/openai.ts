import OpenAI from "openai";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ModelInfo,
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { DEFAULT_MAX_TOKENS } from "../config/catalog.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

function supportsReasoning(model: string): boolean {
  return /^o[1-9]/.test(model);
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await this.client.models.list();
    return res.data
      .map((m) => m.id)
      .filter(isChatModel)
      .sort()
      .map((id) => ({ id }));
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const call = () =>
      this.client.chat.completions.create({
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: req.temperature,
        ...(req.reasoningEffort && supportsReasoning(req.model)
          ? { reasoning_effort: req.reasoningEffort }
          : {}),
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
      stream_options: { include_usage: true },
    });

    let text = "";
    let usage = { input: 0, output: 0, total: 0 };
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        text += delta;
        onChunk(delta);
      }
      if (chunk.usage) {
        usage = {
          input: chunk.usage.prompt_tokens,
          output: chunk.usage.completion_tokens,
          total: chunk.usage.total_tokens,
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

/**
 * The models endpoint returns every model on the account — audio, image,
 * embedding and moderation included. Only chat-completion models can answer a
 * prompt, so filter by exclusion: the families are stable, the names are not.
 */
function isChatModel(id: string): boolean {
  const NON_CHAT =
    /(^|-)(tts|whisper|transcribe|embedding|moderation|image|dall-e|audio|search|codex|realtime)(-|$)/;
  if (NON_CHAT.test(id)) return false;
  return /^(gpt|o[1-9]|chatgpt)/.test(id);
}
