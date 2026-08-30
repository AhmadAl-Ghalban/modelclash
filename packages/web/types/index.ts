export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  provider?: string
  model?: string
  costUsd?: number
  tokens?: number
  durationMs?: number
  createdAt: string
}

export interface ProviderSetting {
  provider: string
  apiKey: string
  hasKey: boolean
  /** False for local providers (Ollama) that work without a credential. */
  requiresKey?: boolean
  model: string
  enabled: boolean
}

/** One model a provider offers, from its live API or the bundled catalog. */
export interface ProviderModel {
  id: string
  label?: string
  hint?: string
}

export interface ProviderModelList {
  provider: string
  models: ProviderModel[]
  /** "live" when fetched from the provider just now. */
  source: 'live' | 'catalog'
  /** Why the live fetch didn't happen or failed. */
  reason?: string
}

export interface StreamingMessage {
  provider: string
  text: string
  done: boolean
}
