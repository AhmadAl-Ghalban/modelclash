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
  model: string
  enabled: boolean
}

export interface StreamingMessage {
  provider: string
  text: string
  done: boolean
}
