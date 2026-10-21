import { z } from 'zod';
import { capabilityNames, capabilitySnapshotSchema, type CapabilitySnapshot } from '@beacon/contracts';
import { unavailable, abortable } from './errors.js';

export const testBase = 'https://game-api.test.k-id.com/api/v1';
const reference = z.uuid();
const permissionSchema = z.object({ name: z.string().min(1).max(100), enabled: z.boolean(), managedBy: z.enum(['GUARDIAN', 'PLAYER', 'PROHIBITED']) });
export const kidSessionSchema = z.object({ sessionId: reference, status: z.literal('ACTIVE'), ageStatus: z.string().min(1).max(50).optional(), jurisdiction: z.string().regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/), permissions: z.array(permissionSchema).max(200).default([]), etag: z.string().max(256).optional() }).superRefine((session, ctx) => {
  if (new Set(session.permissions.map(p => p.name)).size !== session.permissions.length || session.permissions.some(p => p.managedBy === 'PROHIBITED' && p.enabled)) ctx.addIssue({ code: 'custom', message: 'Ambiguous permission response' });
});
export type KidSession = z.infer<typeof kidSessionSchema>;
export type KidLink = { sessionId: string } | { challengeId: string; url: string; type: string };
export type KidResult = { state: 'active'; session: KidSession; link: KidLink } | { state: 'pending'; link: KidLink } | { state: 'prohibited' };
export type SyntheticProfile = 'child' | 'teen' | 'adult';
export interface PermissionAdapter {
  readonly transport: 'vendor-test' | 'unavailable' | 'test-fake';
  readonly mappingConfirmed: boolean;
  readonly purchaseMappingConfirmed?: boolean;
  start(profile: SyntheticProfile, jurisdiction: string, signal: AbortSignal): Promise<KidResult>;
  refresh(link: KidLink, signal: AbortSignal): Promise<KidResult>;
  status(): { status: 'live verified' | 'implemented but unverified' | 'not configured' | 'mock'; environment: 'k-ID Test Mode'; detail: string; lastSuccessfulCallAt?: string; verifiedSessionAt?: string };
}
export const capabilityMapping = {
  purchases: ['in-game-purchases'], ai_coaching: ['ai-chat'], voice_input: ['ai-chat', 'ai-voice-mode', 'ai-media-upload'],
  voice_output: ['ai-voice-mode', 'ai-media-generation'], uploads: ['ai-media-upload'], conversation_memory: ['ai-memory'],
} as const;
export function mapCapabilities(ownerId: string, mode: 'local-demo' | 'provider-test', contextVersion: number, state: 'active' | 'pending' | 'prohibited' | 'unavailable' | 'local-demo', session?: KidSession, now = Date.now()): CapabilitySnapshot {
  if (session) session = kidSessionSchema.parse(session);
  const decisions = Object.fromEntries(capabilityNames.map(name => {
    let decision: 'allowed' | 'denied' | 'unknown' | 'pending' = state === 'pending' ? 'pending' : state === 'prohibited' ? 'denied' : 'unknown';
    let provenance: 'provider' | 'app-policy' | 'local-demo' | 'not-configured' = state === 'local-demo' ? 'local-demo' : 'not-configured';
    let reason = 'No validated provider decision. Protected operations are unavailable.';
    if (name === 'permitted_guardian_sharing') { decision = 'denied'; provenance = 'app-policy'; reason = 'Guardian sharing is outside this iteration.'; }
    else if (name === 'cloud_content_analysis') { decision = 'allowed'; provenance = 'app-policy'; reason = 'Local application policy; explicit cloud consent and all operation-specific provider grants are also required.'; }
    else if (state === 'active' && session) {
      const required = capabilityMapping[name];
      const found = required.map(key => session.permissions.find(p => p.name === key));
      decision = found.some(p => p?.enabled === false) ? 'denied' : found.some(p => !p) ? 'unknown' : 'allowed';
      provenance = 'provider'; reason = `Requires documented k-ID permissions: ${required.join(', ')}. Missing decisions do not grant access.`;
    } else if (state === 'pending' || state === 'prohibited') { provenance = 'provider'; reason = state === 'pending' ? 'Hosted provider challenge has not been approved.' : 'Provider prohibited access.'; }
    return [name, { state: decision, provenance, reason, validatedAt: new Date(now).toISOString() }];
  }));
  return capabilitySnapshotSchema.parse({ ownerId, mode, contextVersion, decisions });
}

export class UnavailablePermissionAdapter implements PermissionAdapter {
  readonly transport = 'unavailable' as const;
  readonly mappingConfirmed = false;
  async start(): Promise<KidResult> { throw unavailable(); }
  async refresh(): Promise<KidResult> { throw unavailable(); }
  status() { return { status: 'not configured' as const, environment: 'k-ID Test Mode' as const, detail: 'Configure a Test Mode key and explicitly confirm the CDK workflow and AI permission mapping. Event Kai/product access is unverified.' }; }
}

// The injectable transport exists for unit tests only. Environment configuration cannot select a fake.
export class CdkTestAdapter implements PermissionAdapter {
  readonly transport: 'vendor-test' | 'test-fake';
  readonly mappingConfirmed: boolean;
  readonly purchaseMappingConfirmed?: boolean;
  #lastSuccessfulCallAt?: string;
  #verifiedSessionAt?: string;
  constructor(private readonly config: { key: string; mappingConfirmed: boolean; purchaseMappingConfirmed?: boolean; base?: string; fetcher?: typeof fetch; timeoutMs?: number }) {
    if (!config.key.trim() || (config.base ?? testBase) !== testBase) throw unavailable();
    this.transport = config.fetcher ? 'test-fake' : 'vendor-test';
    this.mappingConfirmed = config.mappingConfirmed;
    this.purchaseMappingConfirmed = config.purchaseMappingConfirmed === true;
  }
  status() {
    return { status: this.transport === 'test-fake' ? 'mock' as const : this.#verifiedSessionAt ? 'live verified' as const : 'implemented but unverified' as const, environment: 'k-ID Test Mode' as const, detail: this.transport === 'test-fake' ? 'Injected automated-test transport, never production assurance.' : 'CDK Test Mode adapter; event product/workflow and configured mapping must be confirmed. Test identity assurance is not production verification.', lastSuccessfulCallAt: this.#lastSuccessfulCallAt, verifiedSessionAt: this.#verifiedSessionAt };
  }
  async #request(route: '/age-gate/get-requirements' | '/age-gate/check' | '/session/get' | '/challenge/get-status', signal: AbortSignal, query?: Record<string, string>, body?: object): Promise<unknown> {
    const url = new URL(`${testBase}${route}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs ?? 10_000)]);
    try {
      const response = await abortable((this.config.fetcher ?? fetch)(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${this.config.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: deadline, redirect: 'error' }), deadline);
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw unavailable();
      const reader = response.body?.getReader();
      if (!reader) throw unavailable();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) { const next = await abortable(reader.read(), deadline); deadline.throwIfAborted(); if (next.done) break; size += next.value.byteLength; if (size > 65536) throw unavailable(); chunks.push(next.value); }
      } finally { void reader.cancel().catch(() => {}); }
      const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      this.#lastSuccessfulCallAt = new Date().toISOString();
      return result;
    } catch { throw unavailable(); }
  }
  async #session(sessionId: string, signal: AbortSignal): Promise<KidResult> {
    const session = kidSessionSchema.parse(await this.#request('/session/get', signal, { sessionId: reference.parse(sessionId) }));
    if (session.sessionId !== sessionId) throw unavailable();
    this.#verifiedSessionAt = new Date().toISOString();
    return { state: 'active', session, link: { sessionId } };
  }
  async start(profile: SyntheticProfile, jurisdiction: string, signal: AbortSignal): Promise<KidResult> {
    const requirements = z.object({ shouldDisplay: z.boolean(), approvedAgeCollectionMethods: z.array(z.string()).max(30) }).parse(await this.#request('/age-gate/get-requirements', signal, { jurisdiction }));
    // A default-permissions result is not a linked session: leave that flow unavailable, never invent one.
    if (!requirements.shouldDisplay) throw unavailable();
    const profiles = { child: { age: 8, dateOfBirth: '2018-04-15' }, teen: { age: 15, dateOfBirth: '2011-04-15' }, adult: { age: 34, dateOfBirth: '1992-04-15' } };
    const sample = profiles[profile];
    const ageInput = requirements.approvedAgeCollectionMethods.includes('age-slider') ? { age: sample.age } : requirements.approvedAgeCollectionMethods.includes('date-of-birth') ? { dateOfBirth: sample.dateOfBirth } : null;
    if (!ageInput) throw unavailable();
    const result = z.discriminatedUnion('status', [
      z.object({ status: z.literal('PASS'), session: z.object({ sessionId: reference }) }),
      z.object({ status: z.literal('PROHIBITED') }),
      z.object({ status: z.literal('CHALLENGE'), challenge: z.object({ challengeId: reference, type: z.enum(['CHALLENGE_PARENTAL_CONSENT', 'CHALLENGE_AGE_GATE_AGE_ASSURANCE']), url: z.url().max(2048) }) }),
    ]).parse(await this.#request('/age-gate/check', signal, undefined, { jurisdiction, ...ageInput }));
    if (result.status === 'PASS') return this.#session(result.session.sessionId, signal);
    if (result.status === 'PROHIBITED') return { state: 'prohibited' };
    const url = new URL(result.challenge.url);
    if (url.origin !== 'https://family.k-id.com' || url.username || url.password) throw unavailable();
    return { state: 'pending', link: result.challenge };
  }
  async refresh(link: KidLink, signal: AbortSignal): Promise<KidResult> {
    if ('sessionId' in link) return this.#session(link.sessionId, signal);
    const result = z.discriminatedUnion('status', [z.object({ status: z.literal('PASS'), sessionId: reference }), z.object({ status: z.enum(['PENDING', 'IN_PROGRESS', 'FAIL']) })]).parse(await this.#request('/challenge/get-status', signal, { challengeId: reference.parse(link.challengeId) }));
    if (result.status === 'PASS') return this.#session(result.sessionId, signal);
    if (result.status === 'FAIL') return { state: 'prohibited' };
    return { state: 'pending', link };
  }
}
export function permissionAdapterFromEnvironment(env: NodeJS.ProcessEnv): PermissionAdapter {
  if (env.KID_WORKFLOW !== 'cdk-test' || !env.KID_API_KEY?.trim() || /^kgp_/.test(env.KID_API_KEY.trim()) || (env.KID_API_BASE ?? testBase) !== testBase) return new UnavailablePermissionAdapter();
  return new CdkTestAdapter({ key: env.KID_API_KEY, base: env.KID_API_BASE, mappingConfirmed: env.KID_AI_MAPPING_CONFIRMED === 'true', purchaseMappingConfirmed: env.KID_PURCHASE_MAPPING_CONFIRMED === 'true' });
}
