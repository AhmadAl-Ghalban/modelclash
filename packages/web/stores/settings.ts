import { defineStore } from 'pinia'
import type { ProviderModelList, ProviderSetting } from '~/types'
import { ApiError } from '~/composables/useApi'

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Something went wrong. Please try again.'
}

export const useSettingsStore = defineStore('settings', () => {
  const api = useApi()
  const settings = ref<ProviderSetting[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Providers a prompt will actually reach: switched on, and either holding a
   * key or not needing one. Ollama runs locally with no credential, so gating
   * purely on `hasKey` used to hide a perfectly working local model.
   */
  const activeProviders = computed(() =>
    settings.value.filter((s) => s.enabled && (s.hasKey || s.requiresKey === false)),
  )

  const isConfigured = computed(() => activeProviders.value.length > 0)

  async function loadSettings() {
    isLoading.value = true
    try {
      const res = await api.get<{ settings: ProviderSetting[] }>('/settings')
      settings.value = res.settings
      error.value = null
    } catch (err) {
      error.value = message(err)
    } finally {
      isLoading.value = false
    }
  }

  /** Returns true on success so the caller knows whether to close the dialog. */
  async function saveSettings(
    updates: { provider: string; apiKey?: string; model: string; enabled: boolean }[],
  ): Promise<boolean> {
    isLoading.value = true
    try {
      const res = await api.put<{ settings: ProviderSetting[] }>('/settings', {
        settings: updates,
      })
      settings.value = res.settings
      error.value = null
      return true
    } catch (err) {
      error.value = message(err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Asks the server for a provider's current models. The server queries the
   * provider's own API when a key exists, so this stays correct as vendors ship
   * new models without anyone editing a list here.
   */
  async function fetchModels(provider: string): Promise<ProviderModelList> {
    try {
      return await api.get<ProviderModelList>(`/settings/models/${provider}`)
    } catch (err) {
      return {
        provider,
        models: [],
        source: 'catalog',
        reason: message(err),
      }
    }
  }

  return {
    settings,
    isLoading,
    error,
    activeProviders,
    isConfigured,
    loadSettings,
    saveSettings,
    fetchModels,
  }
})
