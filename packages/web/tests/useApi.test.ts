import { describe, it, expect, beforeEach, vi } from 'vitest';

// Nuxt auto-imports are free identifiers at runtime, so stub them on the global
// object before the composable module is evaluated.
(globalThis as any).useRuntimeConfig = () => ({ public: { apiBase: 'http://api' } });

const { useApi } = await import('../composables/useApi');

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (queue.length === 0) return { done: true, value: undefined };
          return { done: false, value: encoder.encode(queue.shift()!) };
        },
      }),
    },
  } as unknown as Response;
}

describe('useApi REST helpers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  it('get prepends the apiBase and parses JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hello: 'world' }));
    const api = useApi();
    const out = await api.get('/x');
    expect(fetchMock).toHaveBeenCalledWith('http://api/x');
    expect(out).toEqual({ hello: 'world' });
  });

  it('post serialises the body and sets the content-type header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const api = useApi();
    await api.post('/p', { a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api/p');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
  });

  it('throws on non-OK responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const api = useApi();
    await expect(api.get('/x')).rejects.toThrow(/500/);
  });

  it('del tolerates 204 responses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 204 } as Response);
    const api = useApi();
    await expect(api.del('/x')).resolves.toBeUndefined();
  });

  it('del throws on other failure statuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    const api = useApi();
    await expect(api.del('/x')).rejects.toThrow(/500/);
  });
});

describe('useApi.streamPost SSE parsing', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  it('parses event-name + data pairs', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['event: chunk\ndata: {"text":"hi"}\n\n']),
    );
    const seen: Array<{ event: string; data: any }> = [];
    await useApi().streamPost('/x', {}, (event, data) => seen.push({ event, data }));
    expect(seen).toEqual([{ event: 'chunk', data: { text: 'hi' } }]);
  });

  it('buffers a partial data line across two reads and emits it on the second', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['event: chunk\ndata: {"tex', 't":"hi"}\n\n']),
    );
    const seen: any[] = [];
    await useApi().streamPost('/x', {}, (event, data) => seen.push({ event, data }));
    // NOTE: the parser resets currentEvent at the top of each read iteration,
    // so an event-name in one read followed by its data line in the next read
    // falls back to the default 'message' event. This test pins that behavior.
    expect(seen).toEqual([{ event: 'message', data: { text: 'hi' } }]);
  });

  it('emits the default "message" event when no event: line is present', async () => {
    fetchMock.mockResolvedValue(sseResponse(['data: {"n":1}\n\n']));
    const seen: any[] = [];
    await useApi().streamPost('/x', {}, (event, data) => seen.push({ event, data }));
    expect(seen).toEqual([{ event: 'message', data: { n: 1 } }]);
  });

  it('resets the current event back to "message" after each data line', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'event: chunk\ndata: {"x":1}\n',
        'data: {"x":2}\n\n',
      ]),
    );
    const seen: any[] = [];
    await useApi().streamPost('/x', {}, (event, data) => seen.push({ event, data }));
    expect(seen).toEqual([
      { event: 'chunk', data: { x: 1 } },
      { event: 'message', data: { x: 2 } },
    ]);
  });

  it('ignores malformed JSON instead of crashing the stream', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'event: bad\ndata: not-json\n',
        'event: good\ndata: {"ok":true}\n\n',
      ]),
    );
    const seen: any[] = [];
    await useApi().streamPost('/x', {}, (event, data) => seen.push({ event, data }));
    expect(seen).toEqual([{ event: 'good', data: { ok: true } }]);
  });

  it('throws if the initial response is not OK', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 } as Response);
    await expect(useApi().streamPost('/x', {}, () => {})).rejects.toThrow(/502/);
  });
});
