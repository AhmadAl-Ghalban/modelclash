<template>
  <aside class="flex flex-col w-72 min-h-screen bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
    <!-- Header -->
    <div class="px-4 pt-5 pb-3">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">ModelClash</span>
        </div>
        <button
          @click="$emit('toggle')"
          class="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Hide sidebar"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <button
        @click="$emit('newChat')"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300
          hover:text-violet-700 dark:hover:text-violet-200
          bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-500/10
          border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/30
          rounded-xl transition-all duration-150 group"
      >
        <svg class="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Chat
      </button>
    </div>

    <!-- Session list -->
    <div class="flex-1 overflow-y-auto px-3 space-y-0.5 pb-2">
      <div v-if="store.isLoadingSessions" class="flex items-center justify-center py-8">
        <div class="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-violet-500 rounded-full animate-spin" />
      </div>

      <p v-else-if="store.sessions.length === 0" class="text-xs text-slate-500 text-center py-8 px-2">
        No conversations yet.<br/>Start a new chat above.
      </p>

      <template v-else>
        <div
          v-for="session in store.sessions"
          :key="session.id"
          class="group relative flex items-center rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150"
          :class="session.id === store.activeSessionId
            ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-100'
            : 'text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-500/10'"
          @click="$emit('selectSession', session.id)"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate leading-tight">{{ session.title }}</p>
            <p class="text-xs mt-0.5 opacity-50 truncate">
              {{ formatDate(session.updatedAt) }}
              <span v-if="session.messageCount"> · {{ session.messageCount }} msgs</span>
            </p>
          </div>
          <!-- Delete button -->
          <button
            class="opacity-0 group-hover:opacity-100 ml-2 p-1 rounded-md hover:bg-red-500/20 hover:text-red-400
              transition-all duration-150 flex-shrink-0"
            @click.stop="$emit('deleteSession', session.id)"
            title="Delete"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- Footer: Theme toggle + Settings button -->
    <div class="px-3 pb-4 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
      <button
        @click="theme.toggle()"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400
          hover:text-violet-700 dark:hover:text-violet-200
          hover:bg-violet-50 dark:hover:bg-violet-500/10
          rounded-xl transition-all duration-150"
      >
        <svg v-if="theme.isDark()" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        {{ theme.isDark() ? 'Light mode' : 'Dark mode' }}
      </button>
      <button
        @click="$emit('openSettings')"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400
          hover:text-violet-700 dark:hover:text-violet-200
          hover:bg-violet-50 dark:hover:bg-violet-500/10
          rounded-xl transition-all duration-150 group"
      >
        <svg class="w-4 h-4 group-hover:rotate-45 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
        <span class="ml-auto text-xs opacity-40">API Keys</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from '~/stores/chat'

const store = useChatStore()
const theme = useTheme()

defineEmits<{
  newChat: []
  selectSession: [id: string]
  deleteSession: [id: string]
  openSettings: []
  toggle: []
}>()

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString()
}
</script>
