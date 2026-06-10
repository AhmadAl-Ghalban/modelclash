type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'modelclash-theme'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', isDark)
}

const state = ref<Theme>('dark')

export const useTheme = () => {
  if (process.client && !state.value) state.value = 'dark'

  function init() {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Theme | null
    state.value = saved || 'system'
    apply(state.value)
  }

  function set(theme: Theme) {
    state.value = theme
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme)
    apply(theme)
  }

  function toggle() {
    set(isDark() ? 'light' : 'dark')
  }

  function isDark(): boolean {
    return state.value === 'dark' || (state.value === 'system' && systemPrefersDark())
  }

  return { theme: state, init, set, toggle, isDark }
}
