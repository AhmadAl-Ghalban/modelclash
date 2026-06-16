import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderSetting } from './entities/provider-setting.entity.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

const PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'ollama'];
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4',
  google: 'gemini-2.5-pro',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  ollama: 'llama3.2',
};

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
        hasKey: !!(s?.apiKey),
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
    const settings = await this.settingRepo.find({ where: { enabled: true } });
    const result: Record<string, string> = {};
    for (const s of settings) {
      if (s.provider === 'ollama') {
        // Ollama doesn't use an API key — the value is treated as a baseURL by core.
        result.ollama = s.apiKey || process.env.OLLAMA_URL || 'http://ollama:11434/v1';
      } else if (s.apiKey) {
        result[s.provider] = s.apiKey;
      }
    }
    return result;
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
