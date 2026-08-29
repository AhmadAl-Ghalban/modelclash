/**
 * Single source of truth for how each provider is presented.
 *
 * This used to be copy-pasted into MessageBubble, StreamingBubble and
 * SettingsModal, which meant a new provider had to be added in three places and
 * the colours could silently drift apart.
 */

export interface ProviderMeta {
  /** Display name with the casing the vendor actually uses. */
  label: string
  /** One-line description of what models this provider offers. */
  models: string
  /** Badge colours — tuned so text hits 4.5:1 on both themes. */
  badge: string
  /** Solid dot colour, for legends where a full badge is too heavy. */
  dot: string
  defaultModel: string
}

const PROVIDERS: Record<string, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    models: 'GPT-4o, o1, o3…',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    label: 'Anthropic',
    models: 'Claude 3.5, 3.7…',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    defaultModel: 'claude-sonnet-4',
  },
  google: {
    label: 'Google',
    models: 'Gemini 2.5…',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    defaultModel: 'gemini-2.5-pro',
  },
  groq: {
    label: 'Groq',
    models: 'Llama 3.3, Mixtral…',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  deepseek: {
    label: 'DeepSeek',
    models: 'DeepSeek Chat / Reasoner',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    dot: 'bg-cyan-500',
    defaultModel: 'deepseek-chat',
  },
  ollama: {
    label: 'Ollama',
    models: 'Local models',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
    defaultModel: 'llama3.2',
  },
}

const FALLBACK: ProviderMeta = {
  label: 'Unknown',
  models: '',
  badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  dot: 'bg-slate-500',
  defaultModel: '',
}

export const PROVIDER_ORDER = Object.keys(PROVIDERS)

export function useProviderMeta() {
  function meta(provider: string): ProviderMeta {
    return PROVIDERS[provider] ?? { ...FALLBACK, label: provider || 'Unknown' }
  }

  /** Initial shown in the square badge. */
  function initial(provider: string): string {
    return (meta(provider).label[0] ?? '?').toUpperCase()
  }

  return { meta, initial, order: PROVIDER_ORDER }
}
