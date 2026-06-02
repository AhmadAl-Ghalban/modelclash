import type { LLMProvider } from "./interfaces/provider.js";
import type {
  ChatMessage,
  ProviderName,
  ProviderResult,
} from "./types/index.js";

export interface RunPromptOptions {
  prompt: string;
  history?: ChatMessage[];
  providers: LLMProvider[];
  modelFor: Record<ProviderName, string>;
  temperature: number;
  timeoutMs: number;
  stream?: boolean;
  onChunk?: (provider: ProviderName, chunk: string) => void;
}

export async function runPrompt(
  opts: RunPromptOptions,
): Promise<ProviderResult[]> {
  const { providers, prompt, history, modelFor, temperature, timeoutMs, stream, onChunk } = opts;

  const tasks = providers.map(async (p): Promise<ProviderResult> => {
    const model = modelFor[p.name];
    const start = Date.now();
    try {
      const req = { prompt, history, model, temperature, timeoutMs };
      const value = stream && p.streamGenerate
        ? await p.streamGenerate(req, (chunk) => onChunk?.(p.name, chunk))
        : await p.generate(req);
      return { ok: true, value };
    } catch (err) {
      return {
        ok: false,
        error: {
          provider: p.name,
          model,
          message: (err as Error).message,
          durationMs: Date.now() - start,
        },
      };
    }
  });

  const settled = await Promise.allSettled(tasks);
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : {
          ok: false,
          error: {
            provider: providers[i].name,
            model: modelFor[providers[i].name],
            message: String(s.reason),
            durationMs: 0,
          },
        },
  );
}
