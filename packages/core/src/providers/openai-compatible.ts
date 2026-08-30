import OpenAI from "openai";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ModelInfo,
  ProviderName,
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { DEFAULT_MAX_TOKENS } from "../config/catalog.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

function supportsReasoning(provider: ProviderName, model: string): boolean {
  if (provider === "deepseek") return model === "deepseek-reasoner";
  return false;
}

export interface OpenAICompatibleOptions {
  name: ProviderName;
  baseURL: string;
  apiKey: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: ProviderName;
  private client: OpenAI;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await this.client.models.list();
    return res.data.map((m) => ({ id: m.id })).sort((a, b) => a.id.localeCompare(b.id));
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const call = () =>
      this.client.chat.completions.create({
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: req.temperature,
        ...(req.reasoningEffort && supportsReasoning(this.name, req.model)
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
      messages: [
        ...(req.history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: req.prompt },
      ],
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

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super({ name: "deepseek", baseURL: "https://api.deepseek.com/v1", apiKey });
  }
}

export class OllamaProvider extends OpenAICompatibleProvider {
  constructor(baseURL = "http://localhost:11434/v1") {
    super({ name: "ollama", baseURL, apiKey: "ollama" });
  }
}
