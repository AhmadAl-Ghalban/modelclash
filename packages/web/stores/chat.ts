import { defineStore } from 'pinia'
import type { ChatSession, ChatMessage } from '~/types'

export const useChatStore = defineStore('chat', () => {
  const api = useApi()

  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const streamingChunks = ref<Record<string, string>>({}) // provider → accumulated text
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)

  const activeSession = computed(() =>
    sessions.value.find((s) => s.id === activeSessionId.value) || null,
  )

  async function loadSessions() {
    isLoadingSessions.value = true
    try {
      sessions.value = await api.get<ChatSession[]>('/chats')
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function createSession() {
    const session = await api.post<ChatSession>('/chats', {})
    sessions.value.unshift(session)
    await selectSession(session.id)
    return session
  }

  async function selectSession(id: string) {
    activeSessionId.value = id
    isLoadingMessages.value = true
    try {
      const res = await api.get<ChatSession & { messages: ChatMessage[] }>(`/chats/${id}`)
      messages.value = res.messages
    } finally {
      isLoadingMessages.value = false
    }
  }

  async function deleteSession(id: string) {
    await api.del(`/chats/${id}`)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (activeSessionId.value === id) {
      activeSessionId.value = null
      messages.value = []
    }
  }

  async function renameSession(id: string, title: string) {
    const updated = await api.patch<ChatSession>(`/chats/${id}`, { title })
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx !== -1) sessions.value[idx] = { ...sessions.value[idx], ...updated }
  }

  async function sendMessage(content: string) {
    if (!activeSessionId.value || isStreaming.value) return
    const sessionId = activeSessionId.value
    isStreaming.value = true
    streamingChunks.value = {}

    try {
      await api.streamPost(`/chats/${sessionId}/messages`, { content }, (event, data: any) => {
        if (event === 'userMessage') {
          messages.value.push(data.message)
        } else if (event === 'chunk') {
          streamingChunks.value[data.provider] = (streamingChunks.value[data.provider] || '') + data.text
        } else if (event === 'complete') {
          messages.value.push(...data.messages)
          streamingChunks.value = {}
          // Refresh session list to update title and counts
          loadSessions()
        }
      })
    } finally {
      isStreaming.value = false
      streamingChunks.value = {}
    }
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isStreaming,
    streamingChunks,
    isLoadingSessions,
    isLoadingMessages,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    sendMessage,
  }
})
