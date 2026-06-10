<template>
  <div :class="isUser ? 'flex justify-end' : 'flex justify-start'">
    <!-- User message -->
    <div v-if="isUser" class="max-w-[75%]">
      <div class="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        {{ message.content }}
      </div>
      <p class="text-xs text-slate-600 mt-1 text-right">{{ formatTime(message.createdAt) }}</p>
    </div>

    <!-- Assistant / error message -->
    <div v-else class="max-w-[85%] w-full">
      <div class="bg-slate-800 border rounded-2xl rounded-tl-sm overflow-hidden"
        :class="isError ? 'border-red-500/30' : 'border-slate-700'">
        <!-- Provider header -->
        <div v-if="message.provider" class="flex items-center gap-2 px-4 py-2 border-b"
          :class="isError ? 'border-red-500/20 bg-red-950/20' : 'border-slate-700 bg-slate-750'">
          <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
            :class="providerColor(message.provider)">
            {{ message.provider[0].toUpperCase() }}
          </div>
          <span class="text-xs font-medium capitalize" :class="isError ? 'text-red-400' : 'text-slate-400'">
            {{ message.provider }}
            <span v-if="message.model" class="opacity-60">· {{ message.model }}</span>
          </span>
          <div class="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
            <span v-if="message.tokens">{{ message.tokens }} tok</span>
            <span v-if="message.costUsd">${{ message.costUsd.toFixed(5) }}</span>
            <span v-if="message.durationMs">{{ (message.durationMs / 1000).toFixed(1) }}s</span>
          </div>
        </div>
        <!-- Content -->
        <div class="px-4 py-3 text-sm leading-relaxed"
          :class="isError ? 'text-red-400' : 'text-slate-200'">
          <span class="whitespace-pre-wrap">{{ message.content }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/types'

const props = defineProps<{ message: ChatMessage }>()

const isUser = computed(() => props.message.role === 'user')
const isError = computed(() => props.message.role === 'error')

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const providerColor = (p: string) => ({
  openai: 'bg-emerald-500/20 text-emerald-400',
  anthropic: 'bg-orange-500/20 text-orange-400',
  google: 'bg-blue-500/20 text-blue-400',
  groq: 'bg-purple-500/20 text-purple-400',
  deepseek: 'bg-cyan-500/20 text-cyan-400',
  ollama: 'bg-gray-500/20 text-gray-400',
}[p] || 'bg-slate-500/20 text-slate-400')
</script>
