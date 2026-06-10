import { Injectable, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';

type CoreProviderResult = {
  ok: true;
  value: {
    provider: string;
    model: string;
    text: string;
    usage: { input: number; output: number; total: number };
    costUsd: number;
    durationMs: number;
  };
} | {
  ok: false;
  error: {
    provider: string;
    model: string;
    message: string;
    durationMs: number;
  };
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class LlmService implements OnModuleInit {
  private core: typeof import('@modelclash/core');

  constructor(private settingsService: SettingsService) {}

  async onModuleInit() {
    this.core = await import('@modelclash/core');
  }

  async streamToProviders(
    prompt: string,
    history: ChatMessage[],
    requestedProviders: string[] | undefined,
    onChunk: (provider: string, chunk: string) => void,
    onResult: (result: CoreProviderResult) => Promise<void>,
  ) {
    const apiKeys = await this.settingsService.getApiKeys();
    const models = await this.settingsService.getModels();

    const allProviders = this.core.buildProvidersFromSettings({
      apiKeys: apiKeys as any,
      models: models as any,
      temperature: 0.7,
      timeoutMs: 60_000,
      stream: true,
    });

    const providers = requestedProviders
      ? allProviders.filter((p) => requestedProviders.includes(p.name))
      : allProviders;

    if (providers.length === 0) return;

    const modelFor = models as Record<string, string>;

    const tasks = providers.map(async (p) => {
      const start = Date.now();
      try {
        const req = {
          prompt,
          history,
          model: modelFor[p.name] || '',
          temperature: 0.7,
          timeoutMs: 60_000,
        };
        let fullText = '';
        const value = p.streamGenerate
          ? await p.streamGenerate(req, (chunk) => {
              fullText += chunk;
              onChunk(p.name, chunk);
            })
          : await p.generate(req);
        const result: CoreProviderResult = { ok: true, value: value as any };
        await onResult(result);
      } catch (err) {
        const result: CoreProviderResult = {
          ok: false,
          error: {
            provider: p.name,
            model: modelFor[p.name] || '',
            message: (err as Error).message,
            durationMs: Date.now() - start,
          },
        };
        await onResult(result);
      }
    });

    await Promise.allSettled(tasks);
  }
}
