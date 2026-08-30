<template>
  <!-- User turn -->
  <div v-if="isUser" class="flex justify-end">
    <div class="max-w-[85%] sm:max-w-[75%]">
      <div
        class="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words"
      >
        {{ message.content }}
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">
        <time :datetime="message.createdAt">{{ clockTime(message.createdAt) }}</time>
      </p>
    </div>
  </div>

  <!-- Model response -->
  <article
    v-else
    class="group h-full flex flex-col rounded-card border overflow-hidden bg-white dark:bg-slate-900"
    :class="
      isError
        ? 'border-red-300 dark:border-red-500/40'
        : 'border-slate-200 dark:border-slate-800'
    "
  >
    <header
      class="flex items-center gap-2 px-4 py-2.5 border-b"
      :class="
        isError
          ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-950/30'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850'
      "
    >
      <ProviderBadge v-if="message.provider" :provider="message.provider" />
      <div class="min-w-0">
        <p
          class="text-xs font-medium truncate"
          :class="isError ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'"
        >
          {{ providerLabel }}
          <span v-if="isError" class="font-normal"> · failed</span>
        </p>
        <p v-if="message.model" class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {{ message.model }}
        </p>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="btn-ghost p-1.5 rounded-lg opacity-60 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          :aria-label="copied ? 'Response copied' : `Copy ${providerLabel} response`"
          @click="copy"
        >
          <svg
            v-if="!copied"
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <svg
            v-else
            class="w-3.5 h-3.5 text-emerald-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </header>

    <!--
      Failures lead with a sentence the reader can act on; the provider's own
      text stays one disclosure away so debugging information isn't lost.
    -->
    <div v-if="isError" class="px-4 py-3 flex-1">
      <p class="text-[15px] leading-relaxed text-red-700 dark:text-red-300">
        {{ failure.summary }}
      </p>
      <details v-if="!failure.detailIsRedundant" class="mt-2">
        <summary
          class="text-xs cursor-pointer select-none text-red-600/80 dark:text-red-400/80 hover:text-red-700 dark:hover:text-red-300"
        >
          Provider response
        </summary>
        <pre
          class="mt-1.5 p-2 rounded-lg overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words
            bg-red-100/60 dark:bg-red-950/50 text-red-800 dark:text-red-300/90"
        >{{ failure.detail }}</pre>
      </details>
    </div>

    <div
      v-else
      class="px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words flex-1 text-slate-800 dark:text-slate-200"
    >
      {{ message.content }}
    </div>

    <!--
      Metrics live in a footer rather than the header: cards in the comparison
      grid are equal height, so the footers line up into a scannable row and the
      header keeps room for the model name.
    -->
    <dl
      v-if="hasMetrics"
      class="flex items-center gap-3 px-4 py-2 border-t text-[11px] tabular-nums whitespace-nowrap
        text-slate-500 dark:text-slate-400"
      :class="
        isError
          ? 'border-red-200 dark:border-red-500/20'
          : 'border-slate-200 dark:border-slate-800'
      "
    >
      <div v-if="tokenText" class="flex gap-1">
        <dt class="sr-only">Tokens</dt>
        <dd>{{ tokenText }}</dd>
      </div>
      <div v-if="costText" class="flex gap-1">
        <dt class="sr-only">Estimated cost</dt>
        <dd>{{ costText }}</dd>
      </div>
      <div v-if="durationText" class="flex gap-1 ml-auto">
        <dt class="sr-only">Time to respond</dt>
        <dd>{{ durationText }}</dd>
      </div>
    </dl>
  </article>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/types'

const props = defineProps<{ message: ChatMessage }>()

const { meta } = useProviderMeta()
const { tokens, cost, duration, clockTime } = useFormat()
const { explain } = useProviderError()

const isUser = computed(() => props.message.role === 'user')
const isError = computed(() => props.message.role === 'error')
const providerLabel = computed(() =>
  props.message.provider ? meta(props.message.provider).label : 'Assistant',
)

const failure = computed(() => explain(props.message.content))

const tokenText = computed(() => tokens(props.message.tokens))
const costText = computed(() => cost(props.message.costUsd))
const durationText = computed(() => duration(props.message.durationMs))
const hasMetrics = computed(() => !!(tokenText.value || costText.value || durationText.value))

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard access can be denied (insecure origin, permissions). Silently
    // leaving the icon unchanged is the honest outcome — nothing was copied.
  }
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>
