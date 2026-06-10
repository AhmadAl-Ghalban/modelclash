<template>
  <div class="flex h-screen bg-slate-950 text-white overflow-hidden">
    <!-- Sidebar -->
    <AppSidebar
      @new-chat="handleNewChat"
      @select-session="handleSelectSession"
      @delete-session="handleDeleteSession"
      @open-settings="settingsOpen = true"
    />

    <!-- Main chat area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top bar -->
      <div class="flex items-center px-6 py-4 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        <div v-if="chatStore.activeSession">
          <h1 class="text-sm font-semibold text-white truncate max-w-md">
            {{ chatStore.activeSession.title }}
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">{{ providerCount }} providers configured</p>
        </div>
        <div v-else class="text-sm text-slate-500">Select or start a conversation</div>
      </div>

      <!-- Messages -->
      <div ref="messagesEl" class="flex-1 overflow-y-auto">
        <!-- Empty state -->
        <div v-if="!chatStore.activeSessionId" class="h-full flex flex-col items-center justify-center text-center px-6">
          <div class="w-16 h-16 bg-violet-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-white mb-2">Compare AI Models</h2>
          <p class="text-slate-400 text-sm max-w-sm mb-6">
            Send one prompt and get responses from all your configured AI providers simultaneously.
          </p>
          <button @click="handleNewChat"
            class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
            Start a new chat
          </button>
        </div>

        <!-- Loading messages -->
        <div v-else-if="chatStore.isLoadingMessages" class="h-full flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-slate-600 border-t-violet-500 rounded-full animate-spin" />
        </div>

        <!-- Message list -->
        <div v-else class="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <MessageBubble
            v-for="msg in chatStore.messages"
            :key="msg.id"
            :message="msg"
          />

          <!-- Streaming indicators -->
          <template v-if="chatStore.isStreaming">
            <StreamingBubble
              v-for="(text, provider) in chatStore.streamingChunks"
              :key="provider"
              :provider="provider"
              :text="text"
            />
            <!-- Waiting indicator if no chunks yet -->
            <div v-if="Object.keys(chatStore.streamingChunks).length === 0"
              class="flex justify-start">
              <div class="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
                <div class="flex gap-1.5 items-center text-xs text-slate-500">
                  <div class="flex gap-1">
                    <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay:0ms" />
                    <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay:150ms" />
                    <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay:300ms" />
                  </div>
                  Waiting for providers…
                </div>
              </div>
            </div>
          </template>

          <div ref="bottomEl" />
        </div>
      </div>

      <!-- Input -->
      <ChatInput
        :disabled="!chatStore.activeSessionId || chatStore.isStreaming"
        @submit="handleSend"
      />
    </div>

    <!-- Settings modal -->
    <SettingsModal :open="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from '~/stores/chat'
import { useSettingsStore } from '~/stores/settings'

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const settingsOpen = ref(false)
const messagesEl = ref<HTMLElement>()
const bottomEl = ref<HTMLElement>()

const providerCount = computed(() => settingsStore.settings.filter((s) => s.hasKey && s.enabled).length)

onMounted(async () => {
  await Promise.all([chatStore.loadSessions(), settingsStore.loadSettings()])
})

watch(
  () => [chatStore.messages.length, chatStore.streamingChunks],
  () => nextTick(() => bottomEl.value?.scrollIntoView({ behavior: 'smooth' })),
  { deep: true },
)

async function handleNewChat() {
  await chatStore.createSession()
}

async function handleSelectSession(id: string) {
  await chatStore.selectSession(id)
}

async function handleDeleteSession(id: string) {
  await chatStore.deleteSession(id)
}

async function handleSend(content: string) {
  await chatStore.sendMessage(content)
}
</script>
