<template>
  <article
    class="h-full flex flex-col rounded-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
  >
    <header
      class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
    >
      <ProviderBadge :provider="provider" />
      <p class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
        {{ meta(provider).label }}
      </p>
      <span class="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {{ text ? 'Writing…' : 'Thinking…' }}
        <span class="relative flex w-1.5 h-1.5">
          <span
            class="absolute inline-flex w-full h-full rounded-full bg-brand-400 opacity-75 motion-safe:animate-ping"
          />
          <span class="relative inline-flex w-1.5 h-1.5 rounded-full bg-brand-500" />
        </span>
      </span>
    </header>

    <!--
      Partial output is announced politely rather than assertively: a screen
      reader should not re-read the whole answer on every token.
    -->
    <div
      class="px-4 py-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words flex-1 min-h-[3.5rem]"
      aria-live="polite"
      aria-busy="true"
      :aria-label="`${meta(provider).label} is responding`"
    >
      <template v-if="text">{{ text }}</template>
      <!-- Skeleton lines while the first token is still in flight. -->
      <template v-else>
        <span class="sr-only">Waiting for the first response…</span>
        <span aria-hidden="true" class="block space-y-2">
          <span class="skeleton block h-3 w-11/12" />
          <span class="skeleton block h-3 w-4/5" />
          <span class="skeleton block h-3 w-2/3" />
        </span>
      </template>
      <span
        v-if="text"
        class="inline-block w-[2px] h-4 align-[-2px] ml-0.5 bg-brand-500 motion-safe:animate-pulse"
        aria-hidden="true"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
defineProps<{ provider: string; text: string }>()

const { meta } = useProviderMeta()
</script>
