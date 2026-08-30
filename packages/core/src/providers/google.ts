import { GoogleGenAI } from "@google/genai";
import type { LLMProvider } from "../interfaces/provider.js";
import type {
  ModelInfo,
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";
import { DEFAULT_MAX_TOKENS } from "../config/catalog.js";
import { estimateCost } from "../utils/cost.js";
import { retryWithBackoff, withTimeout } from "../utils/retry.js";

export class GoogleProvider implements LLMProvider {
  readonly name = "google" as const;
  private client: GoogleGenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new GoogleGenAI({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    // Called over REST rather than through the SDK: the listing shape has moved
    // between @google/genai versions, and this endpoint is stable.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}`,
    );
    if (!res.ok) throw new Error(`Google models request failed (${res.status})`);
    const body = (await res.json()) as {
      models?: {
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }[];
    };
    return (body.models ?? [])
      // Only models that can answer a prompt; the list also carries embedding
      // and token-counting models.
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        // Names come back prefixed, e.g. "models/gemini-3.7-flash".
        id: m.name.replace(/^models\//, ""),
        label: m.displayName,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const start = Date.now();
    const contents = buildGoogleContents(req);
    const call = () =>
      this.client.models.generateContent({
        model: req.model,
        contents,
        config: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        },
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
      contents: buildGoogleContents(req),
      config: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        },
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

function buildGoogleContents(req: ProviderRequest) {
  const history = req.history ?? [];
  if (history.length === 0) return req.prompt;
  return [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: req.prompt }] },
  ];
}
