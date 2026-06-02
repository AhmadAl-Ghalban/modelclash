export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    factor = 2,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(factor, attempt - 1),
      );
      const jitter = Math.random() * delay * 0.2;
      await sleep(delay + jitter);
    }
  }
  throw lastError;
}

function defaultShouldRetry(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string };
  if (e?.status && [408, 429, 500, 502, 503, 504].includes(e.status)) {
    return true;
  }
  if (e?.code && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND"].includes(e.code)) {
    return true;
  }
  if (e?.message && /timeout|temporarily|rate.?limit/i.test(e.message)) {
    return true;
  }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
