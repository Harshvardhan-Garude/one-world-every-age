import { BackendError, abortable } from './errors.js';
import type { ProviderContext, ProviderRuntime } from './providers.js';

export function assertProviderMode(context: ProviderContext, transport: ProviderRuntime['transport']) {
  if ((transport === 'vendor-test' && context.executionMode !== 'provider-test') ||
      (transport === 'test-fake' && context.executionMode !== 'test-fake')) {
    throw new BackendError(403, 'FORBIDDEN', 'Provider transport does not match the authorized execution mode.');
  }
}

// Fixed vendor URLs are supplied by adapters, never by HTTP callers. Deadlines
// cover both headers and body, even when an injected transport ignores abort.
export async function providerJson(options: {
  provider: string; url: string; headers: Record<string, string>; body: object;
  signal: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number; maxBytes: number;
}): Promise<unknown> {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 10_000)]);
  const failed = (message: string, retryable = false) => new BackendError(503, 'UNAVAILABLE', `${options.provider} ${message}`, retryable);
  try {
    signal.throwIfAborted();
    const response = await abortable(Promise.resolve().then(() => {
      signal.throwIfAborted();
      return (options.fetcher ?? fetch)(options.url, {
        method: 'POST', redirect: 'error', signal,
        headers: { ...options.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(options.body),
      });
    }), signal);
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      if ([401, 403].includes(response.status)) throw failed('authentication was rejected.');
      if (response.status === 429) throw failed('rate limit reached. Try again later.', true);
      throw failed('request failed.', response.status >= 500 || response.status === 408);
    }
    if (response.redirected || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw failed('returned an unsupported response.');
    const reader = response.body?.getReader();
    if (!reader) throw failed('returned an empty response.');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await abortable(reader.read(), signal);
        signal.throwIfAborted();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > options.maxBytes) throw failed('response exceeded the supported size.');
        chunks.push(next.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { void reader.cancel().catch(() => {}); }
  } catch (error) {
    if (signal.aborted) throw failed('operation was cancelled or reached its deadline.', true);
    if (error instanceof BackendError) throw error;
    throw failed('request or response could not be processed.', true);
  }
}
