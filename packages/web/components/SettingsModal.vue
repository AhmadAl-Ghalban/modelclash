<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="requestClose" />

        <!--
          Bottom sheet on phones, centred dialog from `sm` up — a centred modal
          on a 6" screen puts the actions out of the thumb zone.
        -->
        <div
          ref="panelEl"
          class="relative z-10 w-full sm:max-w-2xl sm:mx-4 flex flex-col
            max-h-[92vh] sm:max-h-[85vh]
            bg-white dark:bg-slate-900
            border border-slate-200 dark:border-slate-800
            rounded-t-2xl sm:rounded-2xl shadow-overlay"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @keydown.esc.prevent="requestClose"
          @keydown.tab="trapFocus"
        >
          <header
            class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800"
          >
            <div>
              <h2 :id="titleId" class="text-lg font-semibold text-slate-900 dark:text-white">
                Providers
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every enabled provider answers each prompt.
              </p>
            </div>
            <button type="button" class="btn-ghost p-2" aria-label="Close providers dialog" @click="requestClose">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="px-5 sm:px-6 py-4 overflow-y-auto space-y-3 flex-1">
            <p
              v-if="store.error"
              class="flex items-start gap-2 text-sm rounded-lg px-3 py-2.5
                bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300
                border border-red-200 dark:border-red-500/30"
              role="alert"
            >
              <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {{ store.error }}
            </p>

            <!-- Skeleton cards match the real card height to avoid a layout jump. -->
            <template v-if="store.isLoading && localSettings.length === 0">
              <div v-for="n in 3" :key="n" class="rounded-card border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <span class="skeleton block h-8 w-40" />
                <span class="skeleton block h-9 w-full" />
              </div>
            </template>

            <template v-else>
            <fieldset
              v-for="item in localSettings"
              :key="item.provider"
              class="rounded-card border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4 space-y-3"
            >
              <legend class="sr-only">{{ meta(item.provider).label }} settings</legend>

              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <ProviderBadge :provider="item.provider" size="md" />
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {{ meta(item.provider).label }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {{ meta(item.provider).models }}
                    </p>
                  </div>
                </div>

                <label class="flex items-center gap-2 cursor-pointer shrink-0">
                  <span class="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">
                    {{ item.enabled ? 'On' : 'Off' }}
                  </span>
                  <span class="relative inline-flex">
                    <input v-model="item.enabled" type="checkbox" class="sr-only peer" />
                    <span
                      class="w-10 h-6 rounded-full transition-colors
                        bg-slate-300 dark:bg-slate-700 peer-checked:bg-brand-600
                        peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2
                        peer-focus-visible:ring-offset-slate-50 dark:peer-focus-visible:ring-offset-slate-850
                        after:content-[''] after:absolute after:top-[3px] after:left-[3px]
                        after:h-[18px] after:w-[18px] after:bg-white after:rounded-full after:shadow-sm
                        after:transition-transform peer-checked:after:translate-x-4"
                    />
                  </span>
                </label>
              </div>

              <div class="space-y-2.5">
                <div>
                  <label :for="`key-${item.provider}`" class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    API key
                  </label>
                  <div class="relative">
                    <input
                      :id="`key-${item.provider}`"
                      v-model="item.apiKey"
                      :type="revealed[item.provider] ? 'text' : 'password'"
                      :placeholder="item.hasKey ? 'Saved — leave blank to keep it' : 'Paste your API key…'"
                      autocomplete="off"
                      spellcheck="false"
                      class="field pr-10"
                    />
                    <button
                      type="button"
                      class="absolute right-1 top-1/2 -translate-y-1/2 btn-ghost p-2"
                      :aria-label="revealed[item.provider] ? 'Hide API key' : 'Show API key'"
                      @click="revealed[item.provider] = !revealed[item.provider]"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          v-if="!revealed[item.provider]"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                        <path
                          v-else
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    </button>
                  </div>
                  <p v-if="item.enabled && !item.hasKey && !item.apiKey" class="mt-1 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Enabled but has no key — it will be skipped.
                  </p>
                </div>

                <div>
                  <label :id="`model-label-${item.provider}`" class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Default model
                  </label>
                  <ModelSelect
                    v-model="item.model"
                    :options="modelOptions(item.provider)"
                    :placeholder="meta(item.provider).defaultModel || 'Select a model'"
                    :labelled-by="`model-label-${item.provider}`"
                  />
                </div>
              </div>
            </fieldset>
            </template>
          </div>

          <footer
            class="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3"
          >
            <p v-if="isDirty" class="mr-auto text-xs text-slate-500 dark:text-slate-400">Unsaved changes</p>
            <button type="button" class="btn-ghost px-4 py-2.5" @click="requestClose">Cancel</button>
            <button type="button" class="btn-primary px-5 py-2.5" :disabled="store.isLoading" @click="save">
              {{ store.isLoading ? 'Saving…' : 'Save' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'
import type { ProviderSetting } from '~/types'

type Draft = ProviderSetting & { apiKey: string }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useSettingsStore()
const { meta } = useProviderMeta()

const titleId = useId()
const panelEl = ref<HTMLElement>()
const localSettings = ref<Draft[]>([])
const revealed = reactive<Record<string, boolean>>({})
/** Snapshot taken when the dialog opens, to detect unsaved edits. */
const baseline = ref('')

const isDirty = computed(() => JSON.stringify(localSettings.value) !== baseline.value)

/** The element focused before opening, so focus can be handed back on close. */
let previouslyFocused: HTMLElement | null = null

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      previouslyFocused?.focus()
      previouslyFocused = null
      document.body.style.removeProperty('overflow')
      return
    }

    previouslyFocused = document.activeElement as HTMLElement | null
    // Stop the page behind the dialog from scrolling with it.
    document.body.style.overflow = 'hidden'

    await store.loadSettings()
    localSettings.value = store.settings.map((s) => ({ ...s, apiKey: '' }))
    baseline.value = JSON.stringify(localSettings.value)

    await nextTick()
    focusable()[0]?.focus()
  },
)

onBeforeUnmount(() => document.body.style.removeProperty('overflow'))

function focusable(): HTMLElement[] {
  if (!panelEl.value) return []
  return Array.from(
    panelEl.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null)
}

/** Keeps Tab inside the dialog — focus must not escape to the page behind it. */
function trapFocus(event: KeyboardEvent) {
  const items = focusable()
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function requestClose() {
  // Discarding a half-typed API key silently would be unforgivable.
  if (isDirty.value && !confirm('Discard your unsaved provider changes?')) return
  emit('close')
}

async function save() {
  const ok = await store.saveSettings(
    localSettings.value.map((s) => ({
      provider: s.provider,
      apiKey: s.apiKey || undefined,
      model: s.model,
      enabled: s.enabled,
    })),
  )
  // On failure the dialog stays open with the input intact and the error shown.
  if (ok) emit('close')
}

const MODEL_CATALOG: Record<string, { value: string; label: string; hint?: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', hint: 'Flagship multimodal' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'Fast & cheap' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o3', label: 'o3', hint: 'Reasoning' },
    { value: 'o3-mini', label: 'o3-mini', hint: 'Fast reasoning' },
    { value: 'o1', label: 'o1' },
    { value: 'o1-mini', label: 'o1-mini' },
  ],
  anthropic: [
    { value: 'claude-opus-4', label: 'Claude Opus 4', hint: 'Most capable' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', hint: 'Balanced' },
    { value: 'claude-haiku-4', label: 'Claude Haiku 4', hint: 'Fastest' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
  google: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Most capable' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Fast' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', hint: 'Versatile' },
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', hint: 'Instant' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', hint: '32k ctx' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat', hint: 'General purpose' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', hint: 'Reasoning' },
  ],
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2', hint: 'Default in compose' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'gemma2', label: 'Gemma 2' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'phi3', label: 'Phi-3' },
  ],
}

const modelOptions = (p: string) => MODEL_CATALOG[p] || []
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
}
.overlay-leave-active {
  transition-duration: 140ms;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
