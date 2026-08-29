<template>
  <div class="flex h-[100dvh] overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
    <!--
      One sidebar, two behaviours: an inline column from `lg` up, an overlay
      drawer below it. A drawer that only collapses to width 0 leaves phone users
      with no way to reach their conversations.
    -->
    <Transition name="scrim">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        aria-hidden="true"
        @click="sidebarOpen = false"
      />
    </Transition>

    <div
      class="fixed lg:relative inset-y-0 left-0 z-40 flex-shrink-0 overflow-hidden
        transition-[width,transform] duration-200 ease-emphasized"
      :class="[
        sidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full lg:w-0 lg:translate-x-0',
      ]"
      :inert="!sidebarOpen && isSmallScreen ? true : undefined"
    >
      <AppSidebar
        @new-chat="handleNewChat"
        @select-session="handleSelectSession"
        @delete-session="handleDeleteSession"
        @open-settings="settingsOpen = true"
        @toggle="sidebarOpen = false"
      />
    </div>

    <div class="relative flex-1 flex flex-col min-w-0">
      <header
        class="flex items-center gap-3 px-3 sm:px-4 h-14 flex-shrink-0 border-b border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          class="btn-ghost p-2 min-w-[40px] min-h-[40px]"
          :aria-label="sidebarOpen ? 'Hide conversations' : 'Show conversations'"
          :aria-expanded="sidebarOpen"
          @click="sidebarOpen = !sidebarOpen"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div v-if="chatStore.activeSession" class="min-w-0">
          <h1 class="text-sm font-semibold truncate">{{ chatStore.activeSession.title }}</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
            {{ activeProviderSummary }}
          </p>
        </div>
        <p v-else class="text-sm text-slate-500 dark:text-slate-400">ModelClash</p>

        <button
          type="button"
          class="btn-ghost ml-auto px-3 py-2 lg:hidden"
          aria-label="Open provider settings"
          @click="settingsOpen = true"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <!-- Connection / request failures, stated in plain language with a retry. -->
      <Transition name="banner">
        <div
          v-if="chatStore.error"
          class="flex items-start gap-3 px-4 py-3 text-sm border-b
            bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/25
            text-red-800 dark:text-red-200"
          role="alert"
        >
          <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p class="flex-1">{{ chatStore.error }}</p>
          <button type="button" class="font-medium underline underline-offset-2 shrink-0" @click="retry">
            Retry
          </button>
          <button type="button" class="btn-ghost p-1 shrink-0" aria-label="Dismiss error" @click="chatStore.clearError()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Transition>

      <main ref="scrollEl" class="flex-1 overflow-y-auto" @scroll.passive="onScroll">
        <!-- Nothing selected yet -->
        <div
          v-if="!chatStore.activeSessionId"
          class="min-h-full flex flex-col items-center justify-center text-center px-6 py-12"
        >
          <span
            class="w-14 h-14 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mb-4"
            aria-hidden="true"
          >
            <svg class="w-7 h-7 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>

          <h2 class="text-2xl font-semibold tracking-tight">Compare AI models</h2>
          <p class="mt-2 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Send one prompt and see how every provider answers it, side by side — with tokens,
            cost, and latency for each.
          </p>

          <!-- Setup comes before prompts: sending with no key configured goes nowhere. -->
          <div
            v-if="!settingsStore.isConfigured && !settingsStore.isLoading"
            class="mt-6 w-full max-w-md rounded-card border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-4 py-3.5 text-left"
          >
            <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
              No providers set up yet
            </p>
            <p class="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
              Add at least one API key to start comparing. Groq, Google and DeepSeek all have free tiers.
            </p>
            <button type="button" class="btn-primary mt-3 px-4 py-2" @click="settingsOpen = true">
              Add a provider
            </button>
          </div>

          <template v-else>
            <button type="button" class="btn-primary mt-6 px-5 py-2.5" @click="handleNewChat">
              Start a new chat
            </button>

            <div class="mt-8 w-full max-w-lg">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2.5">
                Or try one of these
              </p>
              <ul class="grid gap-2 sm:grid-cols-2">
                <li v-for="prompt in EXAMPLE_PROMPTS" :key="prompt">
                  <button
                    type="button"
                    class="w-full h-full text-left text-sm rounded-xl px-3.5 py-3 transition-colors
                      border border-slate-200 dark:border-slate-800
                      text-slate-700 dark:text-slate-300
                      hover:border-brand-300 dark:hover:border-brand-500/40
                      hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    @click="startWith(prompt)"
                  >
                    {{ prompt }}
                  </button>
                </li>
              </ul>
            </div>
          </template>
        </div>

        <!-- Loading an existing conversation -->
        <div v-else-if="chatStore.isLoadingMessages" class="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <p class="sr-only" role="status">Loading conversation…</p>
          <div v-for="n in 2" :key="n" class="space-y-4" aria-hidden="true">
            <div class="flex justify-end">
              <span class="skeleton h-12 w-1/2 rounded-2xl" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <span class="skeleton h-28 rounded-card" />
              <span class="skeleton h-28 rounded-card" />
            </div>
          </div>
        </div>

        <!-- Conversation -->
        <div v-else class="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6">
          <p
            v-if="turns.length === 0 && !chatStore.isStreaming"
            class="text-center text-sm text-slate-500 dark:text-slate-400 py-16"
          >
            Ask something below — every enabled provider answers at once.
          </p>

          <section v-for="turn in turns" :key="turn.id" class="space-y-3">
            <MessageBubble v-if="turn.prompt" :message="turn.prompt" />

            <!--
              The whole point of the app is comparison, so responses to one
              prompt sit side by side rather than stacking. Equal-height cards
              keep the metrics rows aligned for scanning.
            -->
            <div v-if="turn.responses.length" class="grid gap-3" :class="gridColsFor(turn.responses.length)">
              <MessageBubble v-for="msg in turn.responses" :key="msg.id" :message="msg" />
            </div>
          </section>

          <!-- Live responses, in the same grid so nothing shifts when they land -->
          <section v-if="chatStore.isStreaming" class="space-y-3">
            <div v-if="streamingProviders.length" class="grid gap-3" :class="gridColsFor(streamingProviders.length)">
              <StreamingBubble
                v-for="provider in streamingProviders"
                :key="provider"
                :provider="provider"
                :text="chatStore.streamingChunks[provider]"
              />
            </div>
            <div v-else class="grid gap-3" :class="gridColsFor(expectedProviderCount)">
              <StreamingBubble
                v-for="p in settingsStore.activeProviders"
                :key="p.provider"
                :provider="p.provider"
                text=""
              />
            </div>
          </section>

          <div ref="bottomEl" class="h-px" />
        </div>
      </main>

      <!-- Jump back down after scrolling up mid-stream -->
      <Transition name="banner">
        <button
          v-if="!stickToBottom && chatStore.activeSessionId"
          type="button"
          class="absolute left-1/2 -translate-x-1/2 bottom-32 z-10 btn px-3.5 py-2 text-xs
            bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
            border border-slate-200 dark:border-slate-700 shadow-panel"
          @click="scrollToBottom('smooth')"
        >
          Jump to latest
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </Transition>

      <ChatInput
        ref="composer"
        :loading="chatStore.isStreaming"
        :ready="settingsStore.isConfigured"
        :provider-count="settingsStore.activeProviders.length"
        @submit="handleSend"
        @open-settings="settingsOpen = true"
      />
    </div>

    <!-- Undo beats a confirmation dialog: the delete already happened, reversibly. -->
    <Transition name="toast">
      <div
        v-if="chatStore.pendingUndo"
        class="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
          rounded-xl px-4 py-3 shadow-overlay
          bg-slate-900 dark:bg-slate-800 text-white text-sm"
        role="status"
      >
        <span class="truncate max-w-[16rem]">Deleted “{{ chatStore.pendingUndo.session.title }}”</span>
        <button type="button" class="font-medium text-brand-300 hover:text-brand-200" @click="chatStore.undoDelete()">
          Undo
        </button>
        <button type="button" class="btn-ghost p-1 text-slate-400 hover:text-white hover:bg-white/10" aria-label="Dismiss" @click="chatStore.dismissUndo()">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>

    <SettingsModal :open="settingsOpen" @close="onSettingsClose" />
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from '~/stores/chat'
import { useSettingsStore } from '~/stores/settings'
import type { ChatMessage } from '~/types'

const EXAMPLE_PROMPTS = [
  'Explain quantum entanglement in one sentence.',
  'Write a haiku about debugging at 2am.',
  'What are the trade-offs of using a monorepo?',
  'Refactor this into pure functions: [paste code]',
]

/** How long the undo toast stays before the deletion becomes final. */
const UNDO_TIMEOUT_MS = 8000
/** Treat the view as "at the bottom" within this many pixels. */
const STICK_THRESHOLD_PX = 80

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const settingsOpen = ref(false)
const sidebarOpen = ref(true)
const scrollEl = ref<HTMLElement>()
const bottomEl = ref<HTMLElement>()
const composer = ref<{ focus: () => void }>()
const stickToBottom = ref(true)
const isSmallScreen = ref(false)

const activeProviderSummary = computed(() => {
  const n = settingsStore.activeProviders.length
  if (n === 0) return 'No providers configured'
  return `${n} ${n === 1 ? 'provider' : 'providers'} · ${settingsStore.activeProviders
    .map((p) => p.provider)
    .join(', ')}`
})

const streamingProviders = computed(() => Object.keys(chatStore.streamingChunks))
const expectedProviderCount = computed(() => Math.max(settingsStore.activeProviders.length, 1))

/**
 * Groups the flat message list into turns: one user prompt plus every model
 * response that followed it. Responses are rendered as a comparison grid.
 */
interface Turn {
  id: string
  prompt: ChatMessage | null
  responses: ChatMessage[]
}

const turns = computed<Turn[]>(() => {
  const out: Turn[] = []
  for (const msg of chatStore.messages) {
    if (msg.role === 'user' || out.length === 0) {
      out.push({
        id: msg.id,
        prompt: msg.role === 'user' ? msg : null,
        responses: msg.role === 'user' ? [] : [msg],
      })
    } else {
      out[out.length - 1].responses.push(msg)
    }
  }
  return out
})

/** One column on phones; never more than three, so text stays readable. */
function gridColsFor(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  bottomEl.value?.scrollIntoView({ behavior, block: 'end' })
  stickToBottom.value = true
}

/**
 * Auto-scroll only while the user is already at the bottom. Yanking the view
 * down while someone is reading an earlier response is worse than not scrolling.
 */
function onScroll() {
  const el = scrollEl.value
  if (!el) return
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX
}

// Watching cheap scalars rather than deep-watching the message array: during a
// stream that watcher would re-run on every token.
watch(
  () => [chatStore.messages.length, JSON.stringify(chatStore.streamingChunks).length],
  () => {
    if (stickToBottom.value) nextTick(() => scrollToBottom())
  },
)

let undoTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => chatStore.pendingUndo,
  (undo) => {
    clearTimeout(undoTimer)
    if (undo) undoTimer = setTimeout(() => chatStore.dismissUndo(), UNDO_TIMEOUT_MS)
  },
)

let mediaQuery: MediaQueryList | undefined
function syncScreen(matches: boolean) {
  isSmallScreen.value = !matches
  // The drawer covers the content on small screens, so it starts closed there.
  sidebarOpen.value = matches
}

onMounted(async () => {
  mediaQuery = window.matchMedia('(min-width: 1024px)')
  syncScreen(mediaQuery.matches)
  mediaQuery.addEventListener('change', (e) => syncScreen(e.matches))

  window.addEventListener('keydown', onKeydown)

  await Promise.all([chatStore.loadSessions(), settingsStore.loadSettings()])
})

onBeforeUnmount(() => {
  clearTimeout(undoTimer)
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  // Escape closes the mobile drawer; the dialog handles its own Escape.
  if (e.key === 'Escape' && isSmallScreen.value && sidebarOpen.value && !settingsOpen.value) {
    sidebarOpen.value = false
  }
}

function closeDrawerOnSmallScreen() {
  if (isSmallScreen.value) sidebarOpen.value = false
}

async function handleNewChat() {
  closeDrawerOnSmallScreen()
  const session = await chatStore.createSession()
  if (session) nextTick(() => composer.value?.focus())
}

async function handleSelectSession(id: string) {
  closeDrawerOnSmallScreen()
  stickToBottom.value = true
  await chatStore.selectSession(id)
}

function handleDeleteSession(id: string) {
  return chatStore.deleteSession(id)
}

async function handleSend(content: string) {
  if (!chatStore.activeSessionId) {
    const session = await chatStore.createSession()
    if (!session) return
  }
  stickToBottom.value = true
  await chatStore.sendMessage(content)
}

/** Example-prompt shortcut: open a conversation and send it in one click. */
async function startWith(prompt: string) {
  await handleSend(prompt)
}

function onSettingsClose() {
  settingsOpen.value = false
  // Keys may have changed, so the "is anything configured?" answer may have too.
  settingsStore.loadSettings()
}

function retry() {
  chatStore.clearError()
  if (chatStore.activeSessionId) chatStore.selectSession(chatStore.activeSessionId)
  else chatStore.loadSessions()
}
</script>

<style scoped>
.scrim-enter-active,
.scrim-leave-active,
.banner-enter-active,
.banner-leave-active,
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 200ms cubic-bezier(0.2, 0, 0, 1),
    transform 200ms cubic-bezier(0.2, 0, 0, 1);
}
.scrim-leave-active,
.banner-leave-active,
.toast-leave-active {
  transition-duration: 140ms;
}
.scrim-enter-from,
.scrim-leave-to,
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
