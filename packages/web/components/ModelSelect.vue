<template>
  <div ref="rootEl" class="relative">
    <button
      :id="buttonId"
      ref="buttonEl"
      type="button"
      class="w-full flex items-center justify-between gap-2 field text-left"
      role="combobox"
      :aria-expanded="open"
      :aria-controls="listId"
      aria-haspopup="listbox"
      :aria-labelledby="labelledBy ? `${labelledBy} ${buttonId}` : undefined"
      @click="toggle"
      @keydown.down.prevent="openAndFocus(0)"
      @keydown.up.prevent="openAndFocus(options.length - 1)"
    >
      <span class="truncate" :class="{ 'text-slate-400 dark:text-slate-500': !modelValue }">
        {{ modelValue || placeholder }}
      </span>
      <svg
        class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150"
        :class="{ 'rotate-180': open }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Transition name="dropdown">
      <div
        v-if="open"
        :id="listId"
        role="listbox"
        class="absolute z-20 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl shadow-overlay
          bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        @keydown.esc.prevent="close(true)"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
      >
        <p v-if="options.length === 0" class="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
          No suggested models for this provider — use a custom name below.
        </p>

        <button
          v-for="(opt, i) in options"
          :key="opt.value"
          :ref="(el) => (optionEls[i] = el as HTMLElement)"
          type="button"
          role="option"
          :aria-selected="modelValue === opt.value"
          class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors
            hover:bg-slate-100 dark:hover:bg-slate-700/70"
          :class="
            modelValue === opt.value
              ? 'bg-brand-50 dark:bg-brand-500/15 text-slate-900 dark:text-white'
              : 'text-slate-700 dark:text-slate-300'
          "
          @click="select(opt.value)"
        >
          <span class="min-w-0">
            <span class="block font-medium truncate">{{ opt.label }}</span>
            <span v-if="opt.hint" class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {{ opt.hint }}
            </span>
          </span>
          <svg
            v-if="modelValue === opt.value"
            class="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        <div class="border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            class="w-full px-3 py-2.5 text-xs text-left transition-colors
              text-slate-500 dark:text-slate-400
              hover:text-slate-900 dark:hover:text-white
              hover:bg-slate-100 dark:hover:bg-slate-700/70"
            @click="enableCustom"
          >
            + Use a custom model name…
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="customMode" class="mt-2">
      <label :for="customId" class="sr-only">Custom model name</label>
      <input
        :id="customId"
        ref="customEl"
        v-model="customInput"
        type="text"
        placeholder="e.g. gpt-4o-2024-11-20"
        spellcheck="false"
        class="field"
        @blur="commitCustom"
        @keydown.enter.prevent="commitCustom"
        @keydown.esc.prevent="customMode = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
type Option = { value: string; label: string; hint?: string }

const props = defineProps<{
  modelValue: string
  options: Option[]
  placeholder?: string
  /** Id of the visible <label>, so the trigger announces what it selects. */
  labelledBy?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const buttonId = useId()
const listId = useId()
const customId = useId()

const open = ref(false)
const customMode = ref(false)
const customInput = ref('')
const rootEl = ref<HTMLElement>()
const buttonEl = ref<HTMLElement>()
const customEl = ref<HTMLInputElement>()
const optionEls = ref<HTMLElement[]>([])

function toggle() {
  open.value ? close() : (open.value = true)
}

/** `restoreFocus` sends focus back to the trigger — required after Escape. */
function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) buttonEl.value?.focus()
}

async function openAndFocus(index: number) {
  open.value = true
  await nextTick()
  optionEls.value[index]?.focus()
}

function move(delta: number) {
  const items = optionEls.value.filter(Boolean)
  const current = items.indexOf(document.activeElement as HTMLElement)
  const next = (current + delta + items.length) % items.length
  items[next]?.focus()
}

function select(v: string) {
  emit('update:modelValue', v)
  customMode.value = false
  close(true)
}

async function enableCustom() {
  customInput.value = props.modelValue
  customMode.value = true
  open.value = false
  await nextTick()
  customEl.value?.focus()
}

function commitCustom() {
  const v = customInput.value.trim()
  if (v) emit('update:modelValue', v)
  customMode.value = false
}

function onDocPointerDown(e: PointerEvent) {
  if (!rootEl.value?.contains(e.target as Node)) open.value = false
}

// `pointerdown` rather than `click` so the menu closes before a click lands on
// whatever is underneath it.
onMounted(() => document.addEventListener('pointerdown', onDocPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown))
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 120ms cubic-bezier(0.2, 0, 0, 1),
    transform 120ms cubic-bezier(0.2, 0, 0, 1);
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
