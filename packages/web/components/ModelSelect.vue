<template>
  <div ref="rootEl" class="relative">
    <button
      type="button"
      @click="open = !open"
      class="w-full flex items-center justify-between gap-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-650 border border-slate-300 dark:border-slate-600
        rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white text-left transition-colors focus:outline-none focus:ring-2
        focus:ring-violet-500 focus:border-transparent"
    >
      <span class="truncate">{{ modelValue || placeholder }}</span>
      <svg
        class="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0 transition-transform"
        :class="{ 'rotate-180': open }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Transition name="dropdown">
      <div
        v-if="open"
        class="absolute z-20 mt-1.5 w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl
          overflow-hidden max-h-72 overflow-y-auto"
      >
        <div v-if="options.length === 0" class="px-3 py-3 text-xs text-slate-500">
          No suggested models for this provider.
        </div>
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          @click="select(opt.value)"
          class="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left
            hover:bg-slate-200 dark:hover:bg-slate-700/70 transition-colors"
          :class="modelValue === opt.value ? 'bg-violet-600/15 text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">{{ opt.label }}</p>
            <p v-if="opt.hint" class="text-xs text-slate-500 mt-0.5 truncate">{{ opt.hint }}</p>
          </div>
          <svg
            v-if="modelValue === opt.value"
            class="w-4 h-4 text-violet-400 flex-shrink-0 ml-2"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <div class="border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            @click="enableCustom"
            class="w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/70
              transition-colors text-left"
          >
            + Use a custom model name…
          </button>
        </div>
      </div>
    </Transition>

    <input
      v-if="customMode"
      v-model="customInput"
      @blur="commitCustom"
      @keydown.enter.prevent="commitCustom"
      type="text"
      placeholder="Enter custom model name"
      class="mt-2 w-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white
        placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
    />
  </div>
</template>

<script setup lang="ts">
type Option = { value: string; label: string; hint?: string }

const props = defineProps<{
  modelValue: string
  options: Option[]
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const open = ref(false)
const customMode = ref(false)
const customInput = ref('')
const rootEl = ref<HTMLElement>()

function select(v: string) {
  emit('update:modelValue', v)
  open.value = false
  customMode.value = false
}

function enableCustom() {
  customInput.value = props.modelValue
  customMode.value = true
  open.value = false
  nextTick(() => {
    const el = rootEl.value?.querySelector('input') as HTMLInputElement | null
    el?.focus()
  })
}

function commitCustom() {
  const v = customInput.value.trim()
  if (v) emit('update:modelValue', v)
  customMode.value = false
}

function onDocClick(e: MouseEvent) {
  if (!rootEl.value?.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-4px); }
</style>