<template>
  <div class="px-4 py-4 border-t border-slate-800 bg-slate-950">
    <div class="max-w-3xl mx-auto">
      <div class="relative flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-2xl p-3
        focus-within:border-violet-500 transition-colors">
        <textarea
          ref="inputRef"
          v-model="input"
          :disabled="disabled"
          placeholder="Ask all models…"
          rows="1"
          class="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 resize-none
            outline-none leading-relaxed max-h-40 overflow-y-auto"
          @keydown.enter.exact.prevent="submit"
          @input="autoResize"
        />
        <button
          @click="submit"
          :disabled="disabled || !input.trim()"
          class="flex-shrink-0 w-8 h-8 bg-violet-600 hover:bg-violet-500 disabled:opacity-40
            disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all"
        >
          <svg v-if="!disabled" class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <div v-else class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </button>
      </div>
      <p class="text-center text-xs text-slate-600 mt-2">
        Sends to all configured providers simultaneously
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ submit: [content: string] }>()

const input = ref('')
const inputRef = ref<HTMLTextAreaElement>()

function submit() {
  const content = input.value.trim()
  if (!content || props.disabled) return
  emit('submit', content)
  input.value = ''
  nextTick(() => autoResize())
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}
</script>
