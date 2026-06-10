<template>
  <div class="flex justify-start">
    <div class="max-w-[85%] w-full">
      <div class="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm overflow-hidden">
        <!-- Provider header -->
        <div class="flex items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-750">
          <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
            :class="providerColor(provider)">
            {{ provider[0].toUpperCase() }}
          </div>
          <span class="text-xs font-medium text-slate-400 capitalize">{{ provider }}</span>
          <div class="ml-auto">
            <div v-if="!text" class="flex gap-1">
              <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay:0ms" />
              <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay:150ms" />
              <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style="animation-delay:300ms" />
            </div>
            <span v-else class="w-2 h-4 bg-violet-400 animate-pulse inline-block rounded-sm" />
          </div>
        </div>
        <!-- Streaming text -->
        <div class="px-4 py-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap min-h-[40px]">
          {{ text || '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ provider: string; text: string }>()

const providerColor = (p: string) => ({
  openai: 'bg-emerald-500/20 text-emerald-400',
  anthropic: 'bg-orange-500/20 text-orange-400',
  google: 'bg-blue-500/20 text-blue-400',
  groq: 'bg-purple-500/20 text-purple-400',
  deepseek: 'bg-cyan-500/20 text-cyan-400',
  ollama: 'bg-gray-500/20 text-gray-400',
}[p] || 'bg-slate-500/20 text-slate-400')
</script>
