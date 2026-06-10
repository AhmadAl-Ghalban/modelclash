<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')" />
        <div class="relative z-10 w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-white">API Settings</h2>
            <button @click="$emit('close')" class="text-slate-400 hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-4">
            <p class="text-sm text-slate-400">Configure API keys and default models. Keys are stored securely in the database.</p>

            <div v-for="item in localSettings" :key="item.provider" class="bg-slate-800 rounded-xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    :class="providerColor(item.provider)">
                    {{ item.provider[0].toUpperCase() }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-white capitalize">{{ item.provider }}</p>
                    <p class="text-xs text-slate-500">{{ providerLabel(item.provider) }}</p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="item.enabled" class="sr-only peer" />
                  <div class="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer
                    peer-checked:after:translate-x-full peer-checked:after:border-white after:content-['']
                    after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
                    after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              <div class="space-y-2">
                <div>
                  <label class="text-xs text-slate-400 mb-1 block">API Key</label>
                  <input
                    v-model="item.apiKey"
                    type="password"
                    :placeholder="item.hasKey ? '••••••••  (leave blank to keep current)' : 'Enter API key…'"
                    class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                      placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label class="text-xs text-slate-400 mb-1 block">Default Model</label>
                  <input
                    v-model="item.model"
                    type="text"
                    :placeholder="defaultModel(item.provider)"
                    class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                      placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
            <button @click="$emit('close')"
              class="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
              Cancel
            </button>
            <button @click="save" :disabled="store.isLoading"
              class="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50
                text-white rounded-lg transition-colors">
              {{ store.isLoading ? 'Saving…' : 'Save Settings' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useSettingsStore()
const localSettings = ref([] as any[])

watch(() => props.open, async (val) => {
  if (val) {
    await store.loadSettings()
    localSettings.value = store.settings.map((s) => ({ ...s, apiKey: '' }))
  }
})

async function save() {
  await store.saveSettings(localSettings.value.map((s) => ({
    provider: s.provider,
    apiKey: s.apiKey || undefined,
    model: s.model,
    enabled: s.enabled,
  })))
  emit('close')
}

const providerColor = (p: string) => ({
  openai: 'bg-emerald-500/20 text-emerald-400',
  anthropic: 'bg-orange-500/20 text-orange-400',
  google: 'bg-blue-500/20 text-blue-400',
  groq: 'bg-purple-500/20 text-purple-400',
  deepseek: 'bg-cyan-500/20 text-cyan-400',
  ollama: 'bg-gray-500/20 text-gray-400',
}[p] || 'bg-slate-500/20 text-slate-400')

const providerLabel = (p: string) => ({
  openai: 'GPT-4o, o1, o3…',
  anthropic: 'Claude 3.5, 3.7…',
  google: 'Gemini 2.5…',
  groq: 'Llama 3.3, Mixtral…',
  deepseek: 'DeepSeek Chat / Reasoner',
  ollama: 'Local models',
}[p] || '')

const defaultModel = (p: string) => ({
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4',
  google: 'gemini-2.5-pro',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  ollama: 'llama3.2',
}[p] || '')
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
