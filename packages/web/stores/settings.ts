import { defineStore } from 'pinia'
import type { ProviderSetting } from '~/types'

export const useSettingsStore = defineStore('settings', () => {
  const api = useApi()
  const settings = ref<ProviderSetting[]>([])
  const isLoading = ref(false)

  async function loadSettings() {
    isLoading.value = true
    try {
      const res = await api.get<{ settings: ProviderSetting[] }>('/settings')
      settings.value = res.settings
    } finally {
      isLoading.value = false
    }
  }

  async function saveSettings(updates: { provider: string; apiKey?: string; model: string; enabled: boolean }[]) {
    isLoading.value = true
    try {
      const res = await api.put<{ settings: ProviderSetting[] }>('/settings', { settings: updates })
      settings.value = res.settings
    } finally {
      isLoading.value = false
    }
  }

  return { settings, isLoading, loadSettings, saveSettings }
})
