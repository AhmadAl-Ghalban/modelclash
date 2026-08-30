<template>
  <aside
    class="flex flex-col w-72 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
    aria-label="Conversations"
  >
    <div class="px-3 pt-4 pb-3">
      <div class="flex items-center justify-between mb-3 px-1">
        <div class="flex items-center gap-2">
          <span
            class="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center"
            aria-hidden="true"
          >
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </span>
          <span class="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            ModelClash
          </span>
        </div>
        <button
          type="button"
          class="btn-ghost p-2 min-w-[36px] min-h-[36px]"
          aria-label="Hide sidebar"
          @click="$emit('toggle')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <button
        type="button"
        class="btn w-full justify-start gap-2 px-3 py-2.5
          text-slate-700 dark:text-slate-200
          bg-white dark:bg-slate-800
          border border-slate-200 dark:border-slate-700
          hover:border-brand-300 dark:hover:border-brand-500/40
          hover:bg-brand-50 dark:hover:bg-brand-500/10
          hover:text-brand-700 dark:hover:text-brand-200 group"
        @click="$emit('newChat')"
      >
        <svg
          class="w-4 h-4 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New chat
      </button>
    </div>

    <!-- Session list -->
    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <h2 class="sr-only">Recent conversations</h2>

      <!-- Skeleton rows mirror the real row height, so nothing jumps on load. -->
      <ul v-if="store.isLoadingSessions" class="space-y-1 px-1" aria-hidden="true">
        <li v-for="n in 5" :key="n" class="px-2 py-2.5 space-y-1.5">
          <span class="skeleton block h-3.5" :style="{ width: `${85 - n * 8}%` }" />
          <span class="skeleton block h-2.5 w-1/3" />
        </li>
      </ul>
      <p v-if="store.isLoadingSessions" class="sr-only" role="status">Loading conversations…</p>

      <p
        v-else-if="store.sessions.length === 0"
        class="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed py-10 px-3"
      >
        No conversations yet.<br />Start one above to compare models.
      </p>

      <ul v-else class="space-y-0.5">
        <li v-for="session in store.sessions" :key="session.id" class="relative group">
          <button
            type="button"
            class="w-full text-left rounded-xl pl-3 pr-10 py-2.5 transition-colors duration-150"
            :class="
              session.id === store.activeSessionId
                ? 'bg-brand-100 dark:bg-brand-500/15 text-brand-800 dark:text-brand-100'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            "
            :aria-current="session.id === store.activeSessionId ? 'true' : undefined"
            @click="$emit('selectSession', session.id)"
          >
            <span class="block text-sm font-medium truncate leading-tight">{{ session.title }}</span>
            <span class="block text-xs mt-0.5 opacity-60 truncate">
              <time :datetime="session.updatedAt">{{ relativeTime(session.updatedAt) }}</time>
              <template v-if="session.messageCount">
                · {{ session.messageCount }} {{ session.messageCount === 1 ? 'msg' : 'msgs' }}
              </template>
            </span>
          </button>

          <!--
            Always rendered (only visually de-emphasised until hover/focus) so it
            stays reachable on touch, where there is no hover state at all.
          -->
          <button
            type="button"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg
              text-slate-400 hover:text-red-600 dark:hover:text-red-400
              hover:bg-red-50 dark:hover:bg-red-500/15
              opacity-60 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100
              transition-all duration-150"
            :aria-label="`Delete conversation ${session.title}`"
            @click="$emit('deleteSession', session.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </li>
      </ul>
    </div>

    <!-- Provider status: the answer to "will my prompt actually go anywhere?" -->
    <div class="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
      <button
        type="button"
        class="btn w-full justify-start gap-2.5 px-3 py-2.5 text-slate-600 dark:text-slate-300
          hover:bg-slate-200/60 dark:hover:bg-slate-800 group"
        @click="$emit('openSettings')"
      >
        <svg
          class="w-4 h-4 group-hover:rotate-45 transition-transform duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Providers</span>
        <span class="ml-auto flex items-center gap-1.5">
          <!-- Dots carry a text label too — colour alone never conveys state. -->
          <span
            v-for="p in settings.activeProviders.slice(0, 4)"
            :key="p.provider"
            class="w-1.5 h-1.5 rounded-full"
            :class="meta(p.provider).dot"
            aria-hidden="true"
          />
          <span
            class="text-xs"
            :class="
              settings.isConfigured
                ? 'text-slate-500 dark:text-slate-400'
                : 'text-amber-700 dark:text-amber-400 font-medium'
            "
          >
            {{ settings.isConfigured ? `${settings.activeProviders.length} active` : 'None set up' }}
          </span>
        </span>
      </button>

      <button
        type="button"
        class="btn w-full justify-start gap-2.5 px-3 py-2.5 text-slate-600 dark:text-slate-300
          hover:bg-slate-200/60 dark:hover:bg-slate-800"
        :aria-label="`Switch to ${theme.isDark() ? 'light' : 'dark'} mode`"
        @click="theme.toggle()"
      >
        <svg v-if="theme.isDark()" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
        {{ theme.isDark() ? 'Light mode' : 'Dark mode' }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from '~/stores/chat'
import { useSettingsStore } from '~/stores/settings'

const store = useChatStore()
const settings = useSettingsStore()
const theme = useTheme()
const { meta } = useProviderMeta()
const { relativeTime } = useFormat()

defineEmits<{
  newChat: []
  selectSession: [id: string]
  deleteSession: [id: string]
  openSettings: []
  toggle: []
}>()
</script>
