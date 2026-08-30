<template>
  <div
    class="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
  >
    <div class="max-w-3xl mx-auto">
      <label for="composer" class="sr-only">Prompt to send to every configured model</label>

      <div
        class="flex items-end gap-2 rounded-2xl border p-2.5 transition-colors
          bg-slate-50 dark:bg-slate-900
          border-slate-200 dark:border-slate-800
          focus-within:border-brand-500 dark:focus-within:border-brand-500"
      >
        <textarea
          id="composer"
          ref="inputRef"
          v-model="input"
          :disabled="loading"
          :placeholder="placeholder"
          :aria-describedby="hintId"
          rows="1"
          class="flex-1 bg-transparent px-1.5 py-1 text-[15px] leading-relaxed resize-none
            text-slate-900 dark:text-white
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            outline-none max-h-40 overflow-y-auto
            disabled:cursor-not-allowed"
          @keydown.enter.exact.prevent="submit"
          @input="autoResize"
        />

        <button
          type="button"
          class="btn-primary shrink-0 w-10 h-10 rounded-xl"
          :disabled="!canSend"
          :aria-label="loading ? 'Waiting for responses' : 'Send prompt'"
          @click="submit"
        >
          <svg v-if="!loading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span
            v-else
            class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin"
            aria-hidden="true"
          />
        </button>
      </div>

      <p :id="hintId" class="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
        <template v-if="!ready">
          No providers are set up yet — add an API key in
          <button type="button" class="underline underline-offset-2 hover:text-brand-600 dark:hover:text-brand-400" @click="$emit('openSettings')">
            Providers
          </button>
          to start comparing.
        </template>
        <template v-else>
          <kbd class="font-sans">Enter</kbd> to send ·
          <kbd class="font-sans">Shift</kbd>+<kbd class="font-sans">Enter</kbd> for a new line ·
          goes to all {{ providerCount }} active {{ providerCount === 1 ? 'provider' : 'providers' }}
        </template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  loading?: boolean
  /** False when no provider has a key — sending would go nowhere. */
  ready?: boolean
  providerCount?: number
}>()

const emit = defineEmits<{ submit: [content: string]; openSettings: [] }>()

const input = ref('')
const inputRef = ref<HTMLTextAreaElement>()
const hintId = useId()

const canSend = computed(() => !props.loading && props.ready !== false && input.value.trim().length > 0)

const placeholder = computed(() =>
  props.ready === false ? 'Add a provider to get started…' : 'Ask every model at once…',
)

function submit() {
  if (!canSend.value) return
  emit('submit', input.value.trim())
  // Only cleared once handed off, so a rejected send never loses the text.
  input.value = ''
  nextTick(autoResize)
}

/** Grows the textarea with its content, up to the CSS max-height. */
function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

/** Returns focus to the composer once a response finishes streaming. */
watch(
  () => props.loading,
  (isLoading, wasLoading) => {
    if (wasLoading && !isLoading) inputRef.value?.focus()
  },
)

defineExpose({ focus: () => inputRef.value?.focus() })
</script>
