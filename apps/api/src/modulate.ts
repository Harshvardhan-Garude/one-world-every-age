import { z } from 'zod';
import { BackendError, abortable } from './errors.js';
import { assertProviderMode } from './provider-http.js';
import type { ProviderContext, ProviderRuntime, RedactionAdapter } from './providers.js';

export type RedactionProvider = RedactionAdapter & ProviderRuntime;
const metadataSchema = z.object({
  text: z.string().trim().min(1).max(2000), duration_ms: z.number().int().positive().max(15000),
  utterances: z.array(z.object({ text: z.string().max(2000), language: z.string().optional() })).max(100),
  redaction_ranges: z.array(z.tuple([z.number().nonnegative(), z.number().nonnegative()])).max(1000),
});
// Use Node's MIME parser, not string splitting: the audio part is binary.
export async function parseRedaction(response: Response, signal: AbortSignal) {
  const fail = () => new BackendError(503, 'UNAVAILABLE', 'Modulate redaction failed. No transcript was sent to Gemini.');
  if (!response.ok || response.redirected || !response.headers.get('content-type')?.startsWith('multipart/form-data;')) { void response.body?.cancel(); throw fail(); }
  const reader = response.body?.getReader(); if (!reader) throw fail();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const next = await abortable(reader.read(), signal); signal.throwIfAborted(); if (next.done) break;
      bytes += next.value.length; if (bytes > 3 * 1024 * 1024) throw fail(); chunks.push(next.value);
    }
    const form = await abortable(new Response(Buffer.concat(chunks), { headers: { 'Content-Type': response.headers.get('content-type')! } }).formData(), signal);
    if (form.getAll('metadata').length !== 1 || form.getAll('audio').length !== 1 || [...form.keys()].some(key => !['metadata', 'audio'].includes(key))) throw fail();
    const part = form.get('metadata'), audio = form.get('audio');
    if (!(audio instanceof Blob) || audio.type !== 'audio/mpeg' || !audio.size || audio.size > 2 * 1024 * 1024) throw fail();
    if (part instanceof Blob && (part.type !== 'application/json' || part.size > 65536)) throw fail();
    const text = typeof part === 'string' ? part : part instanceof Blob ? await part.text() : '';
    if (Buffer.byteLength(text) > 65536) throw fail();
    const data = metadataSchema.parse(JSON.parse(text));
    // Tagging retains PII inside markers. Accept only redaction's empty markers.
    const hasRawSpan = (value: string) => /<\/?(?:pii:|phi)/i.test(value.replace(/<(pii:[\w-]+|phi)><\/\1>/gi, ''));
    if ([data.text, ...data.utterances.map(u => u.text)].some(hasRawSpan) || data.utterances.some(u => u.language && u.language !== 'en') || data.redaction_ranges.some(([a, b]) => a > b || b > data.duration_ms)) throw fail();
    signal.throwIfAborted(); return { redactedText: data.text };
  } catch { throw fail(); } finally { void reader.cancel().catch(() => {}); }
}
export class ModulateAdapter implements RedactionProvider {
  readonly transport: 'vendor-test' | 'test-fake';
  constructor(private readonly config: { key: string; fetcher?: typeof fetch; timeoutMs?: number }) {
    if (!config.key.trim()) throw new Error('Modulate requires a server key.');
    this.transport = config.fetcher ? 'test-fake' : 'vendor-test';
  }
  status() { return { provider: 'Modulate' as const, status: this.transport === 'test-fake' ? 'mock' as const : 'implemented but unverified' as const, mode: 'provider-test' as const, detail: this.transport === 'test-fake' ? 'Simulated multipart redaction responses; no real connection.' : 'Batch redaction adapter configured; retention, entitlement and live redaction quality require verification.' }; }
  async redact(audio: Uint8Array, mimeType: string, context: ProviderContext) {
    assertProviderMode(context, this.transport); await context.assertCurrent();
    const extensions: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };
    if (!audio.length || audio.length > 2 * 1024 * 1024 || !extensions[mimeType]) throw new BackendError(400, 'INVALID_REQUEST', 'Use supported audio up to 15 seconds and 2 MiB.');
    const form = new FormData(); form.set('upload_file', new Blob([new Uint8Array(audio)], { type: mimeType }), `question.${extensions[mimeType]}`); form.set('speaker_diarization', 'true'); form.set('language', 'en');
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(this.config.timeoutMs ?? 10000)]);
    try {
      const response = await abortable((this.config.fetcher ?? fetch)('https://platform.modulate.ai/api/velma-2-pii-phi-redaction-batch', { method: 'POST', redirect: 'error', headers: { 'X-API-Key': this.config.key }, body: form, signal }), signal);
      const result = await parseRedaction(response, signal); await context.assertCurrent(); return result;
    } catch { throw new BackendError(503, 'UNAVAILABLE', 'Modulate redaction unavailable. No raw transcript fallback is permitted.'); }
  }
}
export class UnavailableRedactionAdapter implements RedactionProvider {
  readonly transport = 'unavailable' as const;
  status() { return { provider: 'Modulate' as const, status: 'not configured' as const, mode: null, detail: 'Modulate is not configured for application use. MODULATE_API_KEY and MODULATE_RETENTION_CONFIRMED=true are required after verifying retention and redaction access. Use text.' }; }
  async redact(): Promise<never> { throw new BackendError(503, 'UNAVAILABLE', this.status().detail); }
}
export function redactionAdapterFromEnvironment(env: NodeJS.ProcessEnv): RedactionProvider {
  return env.MODULATE_API_KEY?.trim() && env.MODULATE_RETENTION_CONFIRMED === 'true' ? new ModulateAdapter({ key: env.MODULATE_API_KEY }) : new UnavailableRedactionAdapter();
}
