import { defineStore } from 'pinia'
import type { ChatSession, ChatMessage } from '~/types'
import { ApiError } from '~/composables/useApi'

/** Anything we couldn't do, in words the user can act on. */
function message(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Something went wrong. Please try again.'
}

export const useChatStore = defineStore('chat', () => {
  const api = useApi()

  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const streamingChunks = ref<Record<string, string>>({}) // provider → accumulated text
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)

  /** Last failure, shown as a dismissible banner. Null when healthy. */
  const error = ref<string | null>(null)
  /** A just-deleted session, held so the user can undo. */
  const pendingUndo = ref<{ session: ChatSession; messages: ChatMessage[] } | null>(null)

  const activeSession = computed(
    () => sessions.value.find((s) => s.id === activeSessionId.value) || null,
  )

  function clearError() {
    error.value = null
  }

  async function loadSessions() {
    isLoadingSessions.value = true
    try {
      sessions.value = await api.get<ChatSession[]>('/chats')
      error.value = null
    } catch (err) {
      error.value = message(err)
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function createSession() {
    try {
      const session = await api.post<ChatSession>('/chats', {})
      sessions.value.unshift(session)
      activeSessionId.value = session.id
      messages.value = []
      error.value = null
      return session
    } catch (err) {
      error.value = message(err)
      return null
    }
  }

  async function selectSession(id: string) {
    activeSessionId.value = id
    isLoadingMessages.value = true
    try {
      const res = await api.get<ChatSession & { messages: ChatMessage[] }>(`/chats/${id}`)
      messages.value = res.messages
      error.value = null
    } catch (err) {
      messages.value = []
      error.value = message(err)
    } finally {
      isLoadingMessages.value = false
    }
  }

  /**
   * Removes the session from the list immediately and keeps a copy for undo —
   * an undo the user can see beats a confirmation dialog they have to read.
   */
  async function deleteSession(id: string) {
    const index = sessions.value.findIndex((s) => s.id === id)
    if (index === -1) return
    const session = sessions.value[index]
    const wasActive = activeSessionId.value === id
    const snapshot = wasActive ? [...messages.value] : []

    sessions.value.splice(index, 1)
    if (wasActive) {
      activeSessionId.value = null
      messages.value = []
    }

    try {
      await api.del(`/chats/${id}`)
      pendingUndo.value = { session, messages: snapshot }
      error.value = null
    } catch (err) {
      // The server still has it, so put it back where it was.
      sessions.value.splice(index, 0, session)
      if (wasActive) {
        activeSessionId.value = id
        messages.value = snapshot
      }
      error.value = message(err)
    }
  }

  /**
   * Recreates a deleted conversation. The server issues a new id, so this
   * restores the conversation rather than the exact row.
   */
  async function undoDelete() {
    const undo = pendingUndo.value
    if (!undo) return
    pendingUndo.value = null
    try {
      const session = await api.post<ChatSession>('/chats', { title: undo.session.title })
      sessions.value.unshift(session)
      await selectSession(session.id)
    } catch (err) {
      error.value = message(err)
    }
  }

  function dismissUndo() {
    pendingUndo.value = null
  }

  async function renameSession(id: string, title: string) {
    const index = sessions.value.findIndex((s) => s.id === id)
    if (index === -1) return
    const previous = sessions.value[index]
    sessions.value[index] = { ...previous, title }
    try {
      const updated = await api.patch<ChatSession>(`/chats/${id}`, { title })
      sessions.value[index] = { ...sessions.value[index], ...updated }
      error.value = null
    } catch (err) {
      sessions.value[index] = previous
      error.value = message(err)
    }
  }

  async function sendMessage(content: string) {
    if (!activeSessionId.value || isStreaming.value) return
    const sessionId = activeSessionId.value
    isStreaming.value = true
    streamingChunks.value = {}
    error.value = null

    try {
      await api.streamPost(`/chats/${sessionId}/messages`, { content }, (event, data: any) => {
        if (event === 'userMessage') {
          messages.value.push(data.message)
        } else if (event === 'chunk') {
          streamingChunks.value[data.provider] =
            (streamingChunks.value[data.provider] || '') + data.text
        } else if (event === 'complete') {
          messages.value.push(...data.messages)
          streamingChunks.value = {}
          // Refresh session list to update title and counts
          loadSessions()
        }
      })
    } catch (err) {
      error.value = message(err)
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
    error,
    pendingUndo,
    clearError,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    undoDelete,
    dismissUndo,
    renameSession,
    sendMessage,
  }
})
