import { z } from 'zod';
import { textSchema } from '@beacon/contracts';
import { BackendError } from './errors.js';
import { assertProviderMode, providerJson } from './provider-http.js';
import type { ProviderContext, SpeechProvider } from './providers.js';

const configuredId = (id: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id);
const audioSchema = z.object({ audioContent: z.string().min(4).max(1_398_104).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) });

export class InworldAdapter implements SpeechProvider {
  readonly transport: 'vendor-test' | 'test-fake';
  constructor(private readonly config: { key: string; model: string; voice: string; fetcher?: typeof fetch; timeoutMs?: number }) {
    if (!config.key.trim() || !configuredId(config.model) || !configuredId(config.voice)) throw new Error('Inworld requires a key, model ID and voice ID.');
    this.transport = config.fetcher ? 'test-fake' : 'vendor-test';
  }
  status() {
    return { provider: 'Inworld' as const, status: this.transport === 'test-fake' ? 'mock' as const : 'implemented but unverified' as const,
      mode: 'provider-test' as const, detail: this.transport === 'test-fake' ? 'Injected simulated HTTP responses for automated tests; no Inworld connection or generated vendor speech.' : 'Configured non-streaming MP3 adapter. Voice/model access, playback and live behavior still need verification.' };
  }
  async speak(validatedText: string, context: ProviderContext) {
    assertProviderMode(context, this.transport);
    await context.assertCurrent();
    const text = textSchema.parse(validatedText);
    const result = await providerJson({
      provider: 'Inworld', url: 'https://api.inworld.ai/tts/v1/voice', headers: { Authorization: `Basic ${this.config.key}` },
      body: { text, modelId: this.config.model, voiceId: this.config.voice, audioConfig: { audioEncoding: 'MP3' } },
      signal: context.signal, fetcher: this.config.fetcher, timeoutMs: this.config.timeoutMs, maxBytes: 2 * 1024 * 1024,
    });
    let audio: Buffer;
    try {
      const { audioContent } = audioSchema.parse(result);
      audio = Buffer.from(audioContent, 'base64');
      if (!audio.length || audio.length > 1024 * 1024 || audio.toString('base64') !== audioContent) throw new Error('Invalid audio');
    } catch { throw new BackendError(503, 'UNAVAILABLE', 'Inworld returned no supported audio. Keep using the explanation text.'); }
    await context.assertCurrent();
    return { audio: new Uint8Array(audio), mimeType: 'audio/mpeg' };
  }
}

export class UnavailableSpeechAdapter implements SpeechProvider {
  readonly transport = 'unavailable' as const;
  status() { return { provider: 'Inworld' as const, status: 'not configured' as const, mode: null, detail: 'Inworld is not configured. Set server-only INWORLD_API_KEY, INWORLD_MODEL_ID and INWORLD_VOICE_ID. Text remains available.' }; }
  async speak(): Promise<never> { throw new BackendError(503, 'UNAVAILABLE', this.status().detail); }
}
export function speechAdapterFromEnvironment(env: NodeJS.ProcessEnv): SpeechProvider {
  return env.INWORLD_API_KEY?.trim() && env.INWORLD_MODEL_ID && configuredId(env.INWORLD_MODEL_ID) && env.INWORLD_VOICE_ID && configuredId(env.INWORLD_VOICE_ID)
    ? new InworldAdapter({ key: env.INWORLD_API_KEY, model: env.INWORLD_MODEL_ID, voice: env.INWORLD_VOICE_ID }) : new UnavailableSpeechAdapter();
}
