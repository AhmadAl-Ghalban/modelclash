/**
 * Provider SDKs surface failures as raw strings — an HTTP status glued to a JSON
 * body, or a bare timeout. The server persists them verbatim, which is right for
 * debugging and wrong for the screen: a user should not be shown
 * `401 {"type":"error","error":{...}}`, and should never be shown a key fragment.
 *
 * This turns one of those strings into a sentence plus the untouched original,
 * so the UI can lead with the sentence and keep the detail one disclosure away.
 */
export interface ExplainedError {
  /** What happened and what to do about it. */
  summary: string
  /** The provider's own text, for the details disclosure. Redacted. */
  detail: string
  /** True when the summary already says everything the detail would. */
  detailIsRedundant: boolean
}

/**
 * Masks anything shaped like a key. Providers sometimes echo the credential back
 * (OpenAI includes a partial), and this text is rendered and copyable.
 */
function redact(text: string): string {
  return text
    .replace(/\b(sk|pk|gsk|xai|key)[-_][A-Za-z0-9-_*]{6,}/gi, '[key redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9-._~+/]+=*/gi, 'Bearer [redacted]')
}

export function useProviderError() {
  function explain(raw: string): ExplainedError {
    const detail = redact((raw ?? '').trim())
    const lower = detail.toLowerCase()

    let summary: string | null = null

    if (/\b401\b/.test(detail) || lower.includes('authentication_error') || lower.includes('invalid api key') || lower.includes('incorrect api key')) {
      summary = 'This provider rejected the API key. Check it in Providers.'
    } else if (/\b403\b/.test(detail) || lower.includes('permission')) {
      summary = "The key is valid but isn't allowed to use this model."
    } else if (/\b429\b/.test(detail) || lower.includes('rate limit') || lower.includes('quota')) {
      summary = 'Rate limited or out of quota. Wait a moment and retry.'
    } else if (/\b413\b/.test(detail) || lower.includes('request_too_large') || lower.includes('too large')) {
      /*
       * Almost always an agentic model rather than a long prompt: systems like
       * `groq/compound` run web searches server-side and fold the results back
       * into the request, which can exceed the size limit even for a one-line
       * question. Naming the cause saves people shortening a prompt that was
       * never the problem.
       */
      summary =
        'The request grew too large for this model. Agentic models expand it with search results — try a plain chat model instead.'
    } else if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('etimedout')) {
      summary = 'The provider took too long to respond.'
    } else if (/\b404\b/.test(detail) || lower.includes('model_not_found') || lower.includes('does not exist')) {
      summary = "That model isn't available on this account. Pick another in Providers."
    } else if (lower.includes('econnrefused') || lower.includes('fetch failed') || lower.includes('enotfound')) {
      summary = "Couldn't reach the provider. If this is Ollama, check that it's running."
    } else if (/\b5\d\d\b/.test(detail)) {
      summary = 'The provider had a server error. Retrying usually works.'
    }

    // A short, already-readable message is better shown as-is than replaced by a
    // vaguer generic one.
    if (!summary) {
      const readable = detail.length > 0 && detail.length <= 120 && !detail.includes('{')
      return {
        summary: readable ? detail : 'This provider failed to answer.',
        detail,
        detailIsRedundant: readable,
      }
    }

    return { summary, detail, detailIsRedundant: false }
  }

  return { explain }
}
