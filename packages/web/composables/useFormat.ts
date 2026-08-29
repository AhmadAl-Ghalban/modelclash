/**
 * Display formatting for the numbers that appear beside every model response.
 * Kept together so a token count is written the same way everywhere.
 */
export function useFormat() {
  const numbers = new Intl.NumberFormat()

  /** 1234 → "1,234 tok" */
  function tokens(n?: number): string | null {
    return n == null ? null : `${numbers.format(n)} tok`
  }

  /**
   * Costs here are frequently below a tenth of a cent, where `toFixed(5)` prints
   * a wall of zeros. Sub-cent values get a "<$0.01" instead.
   */
  function cost(usd?: number): string | null {
    if (usd == null) return null
    if (usd === 0) return 'free'
    if (usd < 0.01) return `$${usd.toFixed(4)}`
    return `$${usd.toFixed(2)}`
  }

  /** 850 → "0.9s", 12400 → "12.4s" */
  function duration(ms?: number): string | null {
    if (ms == null) return null
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  /** Relative time for the session list, falling back to a date after a day. */
  function relativeTime(iso: string): string {
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return ''
    const mins = Math.floor((Date.now() - then) / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  function clockTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return { tokens, cost, duration, relativeTime, clockTime }
}
