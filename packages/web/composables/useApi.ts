export const useApi = () => {
  const config = useRuntimeConfig()
  const base = config.public.apiBase as string

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${base}${path}`)
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  }

  const post = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  }

  const patch = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  }

  const put = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  }

  const del = async (path: string): Promise<void> => {
    const res = await fetch(`${base}${path}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) throw new Error(`API error ${res.status}`)
  }

  const streamPost = async (
    path: string,
    body: unknown,
    onEvent: (event: string, data: unknown) => void,
  ): Promise<void> => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = 'message'

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            onEvent(currentEvent, data)
          } catch {}
          currentEvent = 'message'
        }
      }
    }
  }

  return { get, post, patch, put, del, streamPost }
}
