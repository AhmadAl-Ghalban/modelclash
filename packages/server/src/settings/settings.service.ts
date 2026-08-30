import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderSetting } from './entities/provider-setting.entity.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import {
  DEFAULT_MODELS,
  DEFAULT_OLLAMA_BASE_URL,
  MODEL_CATALOG,
  PROVIDER_NAMES,
  listModelsForProvider,
  requiresKey,
  type ProviderName,
} from '@modelclash/core';

// Provider list, default models and the offline catalog all come from
// @modelclash/core so there is one place to update when a vendor ships.
const PROVIDERS = PROVIDER_NAMES;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ProviderSetting)
    private settingRepo: Repository<ProviderSetting>,
  ) {}

  async getSettings() {
    const existing = await this.settingRepo.find();
    const existingMap = Object.fromEntries(existing.map((s) => [s.provider, s]));
    const settings = PROVIDERS.map((provider) => {
      const s = existingMap[provider];
      return {
        provider,
        apiKey: s?.apiKey ? '••••••' + s.apiKey.slice(-4) : '',
        hasKey: !!s?.apiKey,
        // Ollama runs locally and needs no credential, so clients must not
        // treat "no key" as "not usable".
        requiresKey: requiresKey(provider),
        model: s?.model || DEFAULT_MODELS[provider] || '',
        enabled: s?.enabled ?? true,
      };
    });
    return { settings };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    for (const item of dto.settings) {
      const existing = await this.settingRepo.findOne({ where: { provider: item.provider } });
      if (existing) {
        if (item.apiKey !== undefined && item.apiKey !== '') {
          existing.apiKey = item.apiKey;
        }
        existing.model = item.model;
        existing.enabled = item.enabled;
        await this.settingRepo.save(existing);
      } else {
        await this.settingRepo.save(
          this.settingRepo.create({
            provider: item.provider,
            apiKey: item.apiKey || '',
            model: item.model || DEFAULT_MODELS[item.provider] || '',
            enabled: item.enabled,
          }),
        );
      }
    }
    return this.getSettings();
  }

  async getApiKeys(): Promise<Record<string, string>> {
    const rows = await this.settingRepo.find();
    const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r]));
    const result: Record<string, string> = {};

    for (const provider of PROVIDERS) {
      const row = byProvider[provider];
      // A missing row means "not configured yet", which defaults to enabled.
      if (row && !row.enabled) continue;

      if (provider === 'ollama') {
        /*
         * Ollama takes no API key — this slot carries a base URL. It is always
         * populated so a locally running daemon is picked up without any setup;
         * previously it only appeared once a row had been saved.
         */
        result.ollama =
          row?.apiKey || process.env.OLLAMA_URL || DEFAULT_OLLAMA_BASE_URL;
      } else if (row?.apiKey) {
        result[provider] = row.apiKey;
      }
    }
    return result;
  }

  /**
   * Models a provider currently offers, asked of the provider itself when a
   * credential is available and falling back to the bundled catalog otherwise.
   * The response says which, so the UI never implies a stale list is live.
   */
  async listModels(provider: string) {
    if (!PROVIDERS.includes(provider as ProviderName)) {
      return { provider, models: [], source: 'catalog' as const, reason: 'Unknown provider' };
    }
    const name = provider as ProviderName;
    const apiKeys = await this.getApiKeys();
    const models = await this.getModels();

    const result = await listModelsForProvider(name, {
      apiKeys: apiKeys as never,
      models: models as never,
      temperature: 0.7,
      timeoutMs: 30_000,
      stream: false,
    });

    // Attach catalog hints/labels to live ids where we know them, so the picker
    // still reads well when the provider only returns bare ids.
    const known = new Map(MODEL_CATALOG[name].models.map((m) => [m.id, m]));
    return {
      provider,
      source: result.source,
      reason: result.reason,
      models: result.models.map((m) => ({
        id: m.id,
        label: m.label ?? known.get(m.id)?.label,
        hint: m.hint ?? known.get(m.id)?.hint,
      })),
    };
  }

  async getModels(): Promise<Record<string, string>> {
    const settings = await this.settingRepo.find();
    const result: Record<string, string> = { ...DEFAULT_MODELS };
    for (const s of settings) {
      if (s.model) result[s.provider] = s.model;
    }
    return result;
  }
}
