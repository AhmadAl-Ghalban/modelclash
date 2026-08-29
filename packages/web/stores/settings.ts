import { defineStore } from 'pinia'
import type { ProviderSetting } from '~/types'
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

  /** Providers that have a key and are switched on — the ones a prompt reaches. */
  const activeProviders = computed(() =>
    settings.value.filter((s) => s.hasKey && s.enabled),
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

  return { settings, isLoading, error, activeProviders, isConfigured, loadSettings, saveSettings }
})
