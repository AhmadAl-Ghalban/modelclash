import { describe, it, expect, beforeEach, vi } from 'vitest';

// TypeORM column decorators rely on emitDecoratorMetadata which vitest's
// esbuild transformer does not emit, so we stub the entity module to a plain
// class. The service under test only uses the imported symbol as a token.
vi.mock('../src/settings/entities/provider-setting.entity.js', () => ({
  ProviderSetting: class ProviderSetting {},
}));

const { SettingsService } = await import('../src/settings/settings.service.js');
const { DEFAULT_MODELS, DEFAULT_OLLAMA_BASE_URL } = await import('@modelclash/core');
type ProviderSetting = unknown;

type Repo<T> = {
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

function makeRepo(): Repo<ProviderSetting> {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(async (x) => x),
    create: vi.fn((x) => x),
  };
}

describe('SettingsService.getSettings', () => {
  let repo: Repo<ProviderSetting>;
  let service: SettingsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SettingsService(repo as never);
  });

  it('returns one entry per known provider with defaults when DB is empty', async () => {
    repo.find.mockResolvedValue([]);
    const { settings } = await service.getSettings();
    expect(settings.map((s) => s.provider)).toEqual([
      'openai', 'anthropic', 'google', 'groq', 'deepseek', 'ollama',
    ]);
    for (const s of settings) {
      expect(s.hasKey).toBe(false);
      expect(s.apiKey).toBe('');
      expect(s.enabled).toBe(true);
      expect(s.model).not.toBe('');
    }
  });

  it('masks stored API keys to show only the last 4 chars', async () => {
    repo.find.mockResolvedValue([
      { provider: 'openai', apiKey: 'sk-secret-1234', model: 'gpt-4o', enabled: true },
    ]);
    const { settings } = await service.getSettings();
    const openai = settings.find((s) => s.provider === 'openai')!;
    expect(openai.hasKey).toBe(true);
    expect(openai.apiKey).toBe('••••••1234');
    expect(openai.apiKey).not.toContain('secret');
  });

  it('honours an explicitly stored enabled=false flag', async () => {
    repo.find.mockResolvedValue([
      { provider: 'groq', apiKey: 'gsk_x', model: 'm', enabled: false },
    ]);
    const { settings } = await service.getSettings();
    expect(settings.find((s) => s.provider === 'groq')!.enabled).toBe(false);
  });
});

describe('SettingsService.updateSettings', () => {
  let repo: Repo<ProviderSetting>;
  let service: SettingsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SettingsService(repo as never);
  });

  it('creates a new row when no setting exists for the provider', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.find.mockResolvedValue([]);
    await service.updateSettings({
      settings: [{ provider: 'openai', apiKey: 'sk-new', model: 'gpt-4o', enabled: true }],
    });
    expect(repo.create).toHaveBeenCalledWith({
      provider: 'openai',
      apiKey: 'sk-new',
      model: 'gpt-4o',
      enabled: true,
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it('preserves the existing API key when the incoming key is empty', async () => {
    const existing = { provider: 'openai', apiKey: 'sk-old', model: 'gpt-4o', enabled: true };
    repo.findOne.mockResolvedValue(existing);
    repo.find.mockResolvedValue([existing]);
    await service.updateSettings({
      settings: [{ provider: 'openai', apiKey: '', model: 'gpt-4o-mini', enabled: false }],
    });
    expect(existing.apiKey).toBe('sk-old');
    expect(existing.model).toBe('gpt-4o-mini');
    expect(existing.enabled).toBe(false);
  });

  it('updates the API key when a non-empty key is provided', async () => {
    const existing = { provider: 'openai', apiKey: 'sk-old', model: 'gpt-4o', enabled: true };
    repo.findOne.mockResolvedValue(existing);
    repo.find.mockResolvedValue([existing]);
    await service.updateSettings({
      settings: [{ provider: 'openai', apiKey: 'sk-new', model: 'gpt-4o', enabled: true }],
    });
    expect(existing.apiKey).toBe('sk-new');
  });

  it('falls back to the default model when creating with an empty model', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.find.mockResolvedValue([]);
    await service.updateSettings({
      settings: [{ provider: 'anthropic', apiKey: 'sk-a', model: '', enabled: true }],
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: DEFAULT_MODELS.anthropic }),
    );
  });
});

describe('SettingsService.getApiKeys / getModels', () => {
  it('returns enabled providers with a key, plus Ollama, which needs none', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValue([
      { provider: 'openai', apiKey: 'sk-1', enabled: true, model: 'gpt-4o' },
      { provider: 'groq', apiKey: '', enabled: true, model: 'g' },
    ]);
    const service = new SettingsService(repo as never);
    const keys = await service.getApiKeys();
    // Ollama is local: it gets a default base URL even with no row saved.
    expect(keys).toEqual({ openai: 'sk-1', ollama: DEFAULT_OLLAMA_BASE_URL });
  });

  it('omits Ollama once it has been explicitly disabled', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValue([
      { provider: 'ollama', apiKey: '', enabled: false, model: 'llama3.2' },
    ]);
    const service = new SettingsService(repo as never);
    expect(await service.getApiKeys()).toEqual({});
  });

  it('honours a custom Ollama server URL stored in the key slot', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValue([
      { provider: 'ollama', apiKey: 'http://box.local:11434/v1', enabled: true, model: 'llama3.2' },
    ]);
    const service = new SettingsService(repo as never);
    expect((await service.getApiKeys()).ollama).toBe('http://box.local:11434/v1');
  });

  it('getModels overlays stored models on top of the defaults', async () => {
    const repo = makeRepo();
    repo.find.mockResolvedValue([
      { provider: 'openai', apiKey: 'x', enabled: true, model: 'gpt-4o-mini' },
    ]);
    const service = new SettingsService(repo as never);
    const models = await service.getModels();
    expect(models.openai).toBe('gpt-4o-mini');
    expect(models.anthropic).toBe(DEFAULT_MODELS.anthropic);
    expect(models.ollama).toBe(DEFAULT_MODELS.ollama);
  });
});
