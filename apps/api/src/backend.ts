import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assessmentSchema, contextUpdateSchema, onboardingRequestSchema, ownedAssessmentRequestSchema, permitsProtectedOperation, sessionViewSchema, type Assessment, type CapabilitySnapshot } from '@beacon/contracts';
import { renderDemo } from '@beacon/fixtures';
import { BackendError, abortable, unavailable } from './errors.js';
import { mapCapabilities, permissionAdapterFromEnvironment, type KidLink, type KidResult, type PermissionAdapter } from './kid.js';
import type { ProviderContext } from './providers.js';

type Start = z.infer<typeof onboardingRequestSchema>;
type State = 'local-demo' | 'active' | 'pending' | 'prohibited' | 'unavailable';
type StoredSession = {
  hash: string; ownerId: string; mode: Start['mode']; profile: Start['syntheticProfile']; jurisdiction: string; optIns: Start['optIns'];
  expiresAt: number; contextVersion: number; state: State; snapshot: CapabilitySnapshot;
  link?: KidLink; providerRevision?: string; busy: boolean; mutation?: AbortController; work: Set<AbortController>;
  assessments: Map<string, { data: Assessment; expiresAt: number }>;
};
export type Operation = 'coaching' | 'speech' | 'voice' | 'uploads' | 'memory';
const requirements = {
  coaching: ['cloud_content_analysis', 'ai_coaching'], speech: ['cloud_content_analysis', 'voice_output'],
  voice: ['cloud_content_analysis', 'ai_coaching', 'voice_input', 'uploads', 'voice_output'],
  uploads: ['cloud_content_analysis', 'uploads'], memory: ['cloud_content_analysis', 'ai_coaching', 'conversation_memory'],
} as const;
const hashCredential = (credential: string) => createHash('sha256').update(credential).digest('hex');

export class BackendService {
  #sessions = new Map<string, StoredSession>();
  #adapter: PermissionAdapter;
  #now: () => number;
  #lifetime: number;
  #limit: number;
  constructor(options: { adapter?: PermissionAdapter; now?: () => number; lifetimeMs?: number; maxSessions?: number; allowTestAdapter?: boolean } = {}) {
    this.#adapter = options.adapter ?? permissionAdapterFromEnvironment(process.env);
    if (this.#adapter.transport === 'test-fake' && !options.allowTestAdapter) throw new Error('Injected permission fakes are restricted to explicit automated-test services');
    this.#now = options.now ?? Date.now;
    this.#lifetime = options.lifetimeMs ?? 30 * 60_000;
    this.#limit = options.maxSessions ?? 1000;
  }
  #invalidate(session: StoredSession) {
    session.contextVersion++;
    for (const work of session.work) work.abort();
    session.work.clear();
  }
  #remove(session: StoredSession) {
    session.mutation?.abort(); this.#invalidate(session); session.assessments.clear(); this.#sessions.delete(session.hash);
  }
  #sweep() {
    for (const session of this.#sessions.values()) if (session.expiresAt <= this.#now()) this.#remove(session);
  }
  #alive(session: StoredSession) {
    if (this.#sessions.get(session.hash) !== session || session.expiresAt <= this.#now()) {
      if (this.#sessions.get(session.hash) === session) this.#remove(session);
      throw new BackendError(401, 'UNAUTHORIZED', 'Application session is missing, expired or signed out.');
    }
  }
  #get(credential: string): StoredSession {
    this.#sweep();
    if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) throw new BackendError(401, 'UNAUTHORIZED', 'A valid application bearer credential is required.');
    const session = this.#sessions.get(hashCredential(credential));
    if (!session) throw new BackendError(401, 'UNAUTHORIZED', 'A valid application bearer credential is required.');
    this.#alive(session); return session;
  }
  #version(session: StoredSession, version: number) {
    this.#alive(session);
    if (session.contextVersion !== version) throw new BackendError(409, 'CONFLICT', 'Context changed. Reload capabilities and create a current owned assessment.', true);
  }
  #set(session: StoredSession, result?: KidResult) {
    if (result?.state === 'active' && result.session.jurisdiction !== session.jurisdiction) throw unavailable();
    const state = result?.state ?? (session.mode === 'local-demo' ? 'local-demo' : 'unavailable');
    const next = mapCapabilities(session.ownerId, session.mode, session.contextVersion, state, result?.state === 'active' ? result.session : undefined, this.#now());
    const signature = (snapshot: CapabilitySnapshot) => JSON.stringify(Object.entries(snapshot.decisions).map(([key, decision]) => [key, decision.state, decision.provenance]));
    const revisionChanged = result?.state === 'active' && result.session.etag !== session.providerRevision;
    if (state !== session.state || signature(next) !== signature(session.snapshot) || revisionChanged) this.#invalidate(session);
    session.state = state;
    session.snapshot = { ...next, contextVersion: session.contextVersion };
    if (result?.state === 'active') session.providerRevision = result.session.etag;
    if (result) session.link = 'link' in result ? result.link : undefined;
  }
  async #resolve(session: StoredSession, start: boolean, externalSignal?: AbortSignal) {
    this.#alive(session);
    if (session.busy) throw new BackendError(409, 'CONFLICT', 'Another session transition is in progress. Retry after it finishes.', true);
    if (session.mode === 'local-demo') { this.#set(session); return; }
    session.busy = true;
    const version = session.contextVersion;
    const controller = new AbortController(); session.mutation = controller;
    const signal = AbortSignal.any([controller.signal, ...(externalSignal ? [externalSignal] : [])]);
    try {
      if (!start && !session.link) throw unavailable();
      signal.throwIfAborted();
      const result = await abortable(start ? this.#adapter.start(session.profile, session.jurisdiction, signal) : this.#adapter.refresh(session.link!, signal), signal);
      this.#version(session, version); signal.throwIfAborted(); this.#set(session, result);
    } catch (error) {
      this.#alive(session);
      if (session.contextVersion === version) this.#set(session);
      if (error instanceof BackendError && error.code === 'CONFLICT') throw error;
      throw unavailable();
    } finally { session.busy = false; if (session.mutation === controller) session.mutation = undefined; }
  }
  async start(input: unknown) {
    const request = onboardingRequestSchema.parse(input);
    this.#sweep();
    if (this.#sessions.size >= this.#limit) throw new BackendError(429, 'LIMITED', 'Local session capacity reached. Retry after sessions expire.', true);
    const credential = randomBytes(32).toString('base64url');
    const ownerId = randomUUID();
    const session: StoredSession = {
      hash: hashCredential(credential), ownerId, mode: request.mode, profile: request.syntheticProfile, jurisdiction: request.jurisdiction, optIns: { ...request.optIns },
      expiresAt: this.#now() + this.#lifetime, contextVersion: 1, state: request.mode === 'local-demo' ? 'local-demo' : 'unavailable',
      snapshot: mapCapabilities(ownerId, request.mode, 1, request.mode === 'local-demo' ? 'local-demo' : 'unavailable', undefined, this.#now()),
      busy: false, work: new Set(), assessments: new Map(),
    };
    this.#sessions.set(session.hash, session);
    try { await this.#resolve(session, true); } catch (error) { if (!(error instanceof BackendError) || error.code !== 'UNAVAILABLE') { this.#remove(session); throw error; } }
    return { credential, ...this.#view(session) };
  }
  #view(session: StoredSession) {
    this.#alive(session);
    return sessionViewSchema.parse({
      ownerId: session.ownerId, mode: session.mode, contextVersion: session.contextVersion,
      syntheticProfile: session.profile, jurisdiction: session.jurisdiction, optIns: { ...session.optIns },
      applicationExpiresAt: new Date(session.expiresAt).toISOString(), onboardingState: session.state,
      capabilities: structuredClone(session.snapshot), authorizationFreshness: 'refresh-before-dispatch-and-delivery',
      provider: { provider: 'k-ID', ...this.#adapter.status(), mappingConfirmed: this.#adapter.mappingConfirmed },
      ...(session.state === 'pending' && session.link && 'challengeId' in session.link ? { challenge: { type: session.link.type, url: session.link.url, environment: 'k-ID Test Mode' } } : {}),
    });
  }
  capabilities(credential: string) { return this.#view(this.#get(credential)); }
  async refresh(credential: string, version: number) {
    const session = this.#get(credential); this.#version(session, version);
    const before = session.contextVersion; await this.#resolve(session, false);
    return { ...this.#view(session), changed: before !== session.contextVersion };
  }
  async updateContext(credential: string, input: unknown) {
    const request = contextUpdateSchema.parse(input);
    const session = this.#get(credential); this.#version(session, request.contextVersion);
    if (session.busy) throw new BackendError(409, 'CONFLICT', 'Wait for the current session transition before changing context.', true);
    const restart = (request.jurisdiction !== undefined && request.jurisdiction !== session.jurisdiction) || (request.syntheticProfile !== undefined && request.syntheticProfile !== session.profile);
    this.#invalidate(session);
    if (request.optIns) session.optIns = { ...request.optIns };
    if (request.jurisdiction) session.jurisdiction = request.jurisdiction;
    if (request.syntheticProfile) session.profile = request.syntheticProfile;
    if (restart) session.link = undefined;
    this.#set(session);
    try { await this.#resolve(session, restart); } catch (error) { if (!(error instanceof BackendError) || error.code !== 'UNAVAILABLE') throw error; }
    return this.#view(session);
  }
  logout(credential: string) { this.#remove(this.#get(credential)); return { signedOut: true }; }
  createAssessment(credential: string, input: unknown) {
    const request = ownedAssessmentRequestSchema.parse(input);
    const session = this.#get(credential); this.#version(session, request.contextVersion);
    for (const [id, entry] of session.assessments) if (entry.expiresAt <= this.#now()) session.assessments.delete(id);
    if (session.assessments.size >= 32) throw new BackendError(429, 'LIMITED', 'Local assessment capacity reached. References expire after five minutes.', true);
    const fixture = renderDemo({ mode: 'local-demo', persona: session.profile, fixtureId: request.fixtureId, variant: request.variant });
    const data = assessmentSchema.parse({ ...fixture.assessment, id: randomUUID(), ownerId: session.ownerId, mode: session.mode, contextVersion: session.contextVersion, createdAt: new Date(this.#now()).toISOString() });
    const expiresAt = Math.min(this.#now() + 5 * 60_000, session.expiresAt);
    session.assessments.set(data.id, { data, expiresAt });
    return { assessment: structuredClone(data), referenceExpiresAt: new Date(expiresAt).toISOString(), fixture: fixture.fixture, challenge: fixture.challenge };
  }
  #owned(session: StoredSession, assessmentId: string): Assessment {
    const entry = session.assessments.get(assessmentId);
    if (!entry || entry.expiresAt <= this.#now()) { session.assessments.delete(assessmentId); throw new BackendError(404, 'NOT_FOUND', 'Owned assessment reference is unavailable.'); }
    this.#version(session, entry.data.contextVersion); return entry.data;
  }
  #eligible(session: StoredSession, operation: Operation, version: number) {
    this.#version(session, version);
    if (session.mode !== 'provider-test' || session.state !== 'active') throw new BackendError(403, 'FORBIDDEN', 'Only a validated, active provider-test session can use protected operations.');
    if (!this.#adapter.mappingConfirmed) throw new BackendError(503, 'UNAVAILABLE', 'The configured product AI permission mapping has not been confirmed.');
    if (!session.optIns.cloudAnalysis || (['speech', 'voice'].includes(operation) && !session.optIns.spokenCoaching) || (operation === 'memory' && !session.optIns.memory) || !permitsProtectedOperation(session.snapshot, requirements[operation], version, this.#now())) throw new BackendError(403, 'FORBIDDEN', 'Every applicable capability and user opt-in must allow this operation.');
  }
  async withAuthorizedOperation<T>(credential: string, assessmentId: string, operation: Operation, version: number, dispatch: (context: ProviderContext) => Promise<T>, externalSignal?: AbortSignal): Promise<T> {
    const session = this.#get(credential); this.#version(session, version); this.#owned(session, assessmentId);
    if (session.mode !== 'provider-test') throw new BackendError(403, 'FORBIDDEN', 'Local demo sessions cannot dispatch providers.');
    const deadline = AbortSignal.any([AbortSignal.timeout(20_000), AbortSignal.timeout(Math.max(1, session.expiresAt - this.#now())), ...(externalSignal ? [externalSignal] : [])]);
    deadline.throwIfAborted();
    await this.#resolve(session, false, deadline);
    this.#eligible(session, operation, version);
    if (session.work.size >= 16) throw new BackendError(429, 'LIMITED', 'Too many active protected operations.', true);
    const controller = new AbortController(); session.work.add(controller);
    const signal = AbortSignal.any([controller.signal, deadline]);
    const assertCurrent = async () => {
      signal.throwIfAborted(); this.#alive(session); this.#version(session, version);
      await this.#resolve(session, false, signal);
      signal.throwIfAborted(); this.#eligible(session, operation, version); this.#owned(session, assessmentId);
    };
    const context: ProviderContext = Object.freeze({ ownerId: session.ownerId, assessment: structuredClone(this.#owned(session, assessmentId)), capabilities: structuredClone(session.snapshot), contextVersion: version, signal, executionMode: this.#adapter.transport === 'test-fake' ? 'test-fake' : 'provider-test', assertCurrent });
    try {
      signal.throwIfAborted();
      const result = await abortable(dispatch(context), signal);
      await assertCurrent(); return result;
    } finally { session.work.delete(controller); controller.abort(); }
  }
  // Future validated webhook handlers can invalidate a bound reference here. No HTTP webhook is exposed.
  close() { for (const session of this.#sessions.values()) this.#remove(session); }
}
