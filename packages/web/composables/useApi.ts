/**
 * Thin fetch wrapper.
 *
 * Every failure comes back as an `ApiError` carrying a sentence we are willing
 * to show a user — status codes and stack traces stay in `cause` for the
 * console. Callers render `err.message` directly.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'client' | 'server',
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function humanize(status: number): ApiError {
  if (status === 404) return new ApiError('That conversation no longer exists.', 'client', status)
  if (status === 401 || status === 403) {
    return new ApiError('Your API key was rejected. Check it in Settings.', 'client', status)
  }
  if (status === 429) {
    return new ApiError('Rate limited by the provider. Wait a moment and try again.', 'client', status)
  }
  if (status >= 500) {
    return new ApiError('The ModelClash server hit an error. Try again in a moment.', 'server', status)
  }
  return new ApiError('That request was rejected. Please try again.', 'client', status)
}

const OFFLINE = new ApiError(
  "Can't reach the ModelClash server. Make sure it's running on port 3001.",
  'network',
)

export const useApi = () => {
  const config = useRuntimeConfig()
  const base = config.public.apiBase as string

  async function request<T>(path: string, init?: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, init)
    } catch (err) {
      // fetch only rejects on network-level failure — DNS, refused, CORS, abort.
      if ((err as Error).name === 'AbortError') throw err
      throw OFFLINE
    }
    if (!res.ok) throw humanize(res.status)
    return res
  }

  const json = (body: unknown): RequestInit => ({
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const get = async <T>(path: string, signal?: AbortSignal): Promise<T> =>
    (await request<T>(path, { signal })).json()

  const post = async <T>(path: string, body?: unknown): Promise<T> =>
    (await request<T>(path, { method: 'POST', ...json(body) })).json()

  const patch = async <T>(path: string, body?: unknown): Promise<T> =>
    (await request<T>(path, { method: 'PATCH', ...json(body) })).json()

  const put = async <T>(path: string, body?: unknown): Promise<T> =>
    (await request<T>(path, { method: 'PUT', ...json(body) })).json()

  const del = async (path: string): Promise<void> => {
    try {
      await request(path, { method: 'DELETE' })
    } catch (err) {
      // Defensive: a 204 is a successful delete even if the response object
      // reports itself as not-ok.
      if (err instanceof ApiError && err.status === 204) return
      throw err
    }
  }

  const streamPost = async (
    path: string,
    body: unknown,
    onEvent: (event: string, data: unknown) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const res = await request(path, { method: 'POST', ...json(body), signal })
    if (!res.body) throw new ApiError('The server sent an empty response.', 'server')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = 'message'

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // The trailing element is an unterminated line — hold it for the next read.
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              onEvent(currentEvent, JSON.parse(line.slice(6)))
            } catch {
              // A malformed frame shouldn't tear down the whole stream.
            }
            currentEvent = 'message'
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  return { get, post, patch, put, del, streamPost }
}
