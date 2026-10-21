import type { z } from 'zod';
import type { structuredErrorSchema } from '@beacon/contracts';
export class BackendError extends Error {
  constructor(public readonly status: number, public readonly code: z.infer<typeof structuredErrorSchema>['code'], message: string, public readonly retryable = false) { super(message); }
}
export const unavailable = () => new BackendError(503, 'UNAVAILABLE', 'k-ID test session could not be validated. Protected operations are unavailable.', true);
export async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new BackendError(503, 'UNAVAILABLE', 'The protected operation was cancelled or reached its deadline.', true));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try { return await Promise.race([work, cancelled]); }
  finally { if (onAbort) signal.removeEventListener('abort', onAbort); }
}
