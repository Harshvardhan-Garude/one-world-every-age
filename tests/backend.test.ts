import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { AddressInfo } from 'node:net';
import { BackendService } from '../apps/api/src/backend.js';
import { CdkTestAdapter, kidSessionSchema, mapCapabilities, permissionAdapterFromEnvironment, testBase } from '../apps/api/src/kid.js';
import { createApp } from '../apps/api/src/server.js';
import type { ProviderContext } from '../apps/api/src/providers.js';

const request = { mode: 'provider-test', syntheticProfile: 'adult', jurisdiction: 'US-CA', optIns: { cloudAnalysis: true, spokenCoaching: true, memory: true } } as const;
const permissionNames = ['ai-chat', 'ai-voice-mode', 'ai-media-upload', 'ai-media-generation', 'ai-memory'];
function harness(mappingConfirmed = true) {
  const sessionId = randomUUID(), challengeId = randomUUID();
  let permissions = permissionNames.map(name => ({ name, enabled: true, managedBy: 'PLAYER' }));
  let fail = false, challenge = false, challengeState = 'PENDING', malformed = false;
  let release: (() => void) | undefined;
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    assert.equal(url.origin, 'https://game-api.test.k-id.com');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer example');
    assert.equal(init?.redirect, 'error');
    if (fail) return Response.json({ error: 'private upstream failure' }, { status: 500 });
    if (url.pathname.endsWith('/get-requirements')) return Response.json({ shouldDisplay: true, approvedAgeCollectionMethods: ['age-slider'] });
    if (url.pathname.endsWith('/age-gate/check')) return Response.json(challenge ? { status: 'CHALLENGE', challenge: { challengeId, type: 'CHALLENGE_PARENTAL_CONSENT', url: 'https://family.k-id.com/authorize?otp=example' } } : { status: 'PASS', session: { sessionId } });
    if (url.pathname.endsWith('/get-status')) return Response.json({ status: challengeState, ...(challengeState === 'PASS' ? { sessionId } : {}) });
    if (release) await new Promise<void>(resolve => { release = resolve; });
    return Response.json(malformed ? { sessionId, status: 'ACTIVE', jurisdiction: 'US-CA', permissions: 'invalid' } : { sessionId, status: 'ACTIVE', jurisdiction: 'US-CA', permissions, dateOfBirth: '1992-04-15', etag: 'example' });
  };
  const adapter = new CdkTestAdapter({ key: 'example', mappingConfirmed, fetcher });
  const backend = new BackendService({ adapter, allowTestAdapter: true });
  return { backend, adapter, calls, deny: (name: string) => { permissions = permissions.map(p => p.name === name ? { ...p, enabled: false } : p); }, omit: (name: string) => { permissions = permissions.filter(p => p.name !== name); }, fail: () => { fail = true; }, malformed: () => { malformed = true; }, challenge: () => { challenge = true; }, passChallenge: () => { challengeState = 'PASS'; }, hold: () => { release = () => {}; }, release: () => { release?.(); release = undefined; } };
}
async function owned(h: ReturnType<typeof harness>, input: object = request) {
  const session = await h.backend.start(input);
  const { assessment } = h.backend.createAssessment(session.credential, { contextVersion: session.contextVersion, fixtureId: 'P01', variant: 'baseline' });
  return { ...session, assessment };
}

test('session credentials are random, private, expiring and replay fails after logout', async () => {
  let now = Date.now();
  const backend = new BackendService({ now: () => now, lifetimeMs: 1000, maxSessions: 2 });
  const first = await backend.start({ ...request, mode: 'local-demo' });
  const second = await backend.start({ ...request, mode: 'local-demo' });
  assert.notEqual(first.credential, second.credential); assert.notEqual(first.ownerId, second.ownerId);
  assert.equal('credential' in backend.capabilities(first.credential), false);
  await assert.rejects(() => backend.start({ ...request, mode: 'local-demo' }), { code: 'LIMITED' });
  assert.throws(() => backend.capabilities('invalid'), { code: 'UNAUTHORIZED' });
  backend.logout(first.credential);
  assert.throws(() => backend.capabilities(first.credential), { code: 'UNAUTHORIZED' });
  now += 1001;
  assert.throws(() => backend.capabilities(second.credential), { code: 'UNAUTHORIZED' });
  backend.close();
});
test('local demo cannot promote itself or dispatch even with every opt-in', async () => {
  const h = harness(); const s = await owned(h, { ...request, mode: 'local-demo' }); let dispatched = 0;
  await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async () => ++dispatched), { code: 'FORBIDDEN' });
  assert.equal(dispatched, 0); assert.equal(h.calls.length, 0);
  for (const extra of [{ ownerId: 'other' }, { mode: 'production' }, { provenance: 'provider' }, { sessionId: randomUUID() }, { permissions: [] }]) {
    await assert.rejects(() => h.backend.start({ ...request, ...extra }));
  }
  await assert.rejects(() => h.backend.updateContext(s.credential, { contextVersion: s.contextVersion, mode: 'provider-test', optIns: request.optIns }));
  h.backend.close();
});
test('owned reference is opaque and cannot cross owners, expire or bypass context version', async () => {
  const h = harness(); const a = await owned(h), b = await owned(h);
  assert.equal(a.assessment.source, 'fixture'); assert.equal(a.assessment.mode, 'provider-test');
  assert.equal(a.assessment.ownerId, a.ownerId); assert.notEqual(a.assessment.id, 'P01');
  await assert.rejects(() => h.backend.withAuthorizedOperation(b.credential, a.assessment.id, 'coaching', b.contextVersion, async () => true), { code: 'NOT_FOUND' });
  await assert.rejects(() => h.backend.withAuthorizedOperation(a.credential, a.assessment.id, 'coaching', a.contextVersion + 1, async () => true), { code: 'CONFLICT' });
  assert.throws(() => h.backend.createAssessment(a.credential, { contextVersion: a.contextVersion, fixtureId: 'P01', variant: 'baseline', ownerId: b.ownerId }));
  h.backend.close();
});
test('permission mapping honors explicit denial, prohibited management and absent grants', () => {
  const session = kidSessionSchema.parse({ sessionId: randomUUID(), status: 'ACTIVE', jurisdiction: 'US', permissions: [{ name: 'ai-chat', enabled: true, managedBy: 'PLAYER' }, { name: 'ai-voice-mode', enabled: false, managedBy: 'PROHIBITED' }] });
  const mapped = mapCapabilities(randomUUID(), 'provider-test', 1, 'active', session);
  assert.equal(mapped.decisions.ai_coaching.state, 'allowed');
  assert.equal(mapped.decisions.voice_input.state, 'denied');
  assert.equal(mapped.decisions.uploads.state, 'unknown');
  assert.equal(mapped.decisions.permitted_guardian_sharing.state, 'denied');
  assert.equal(kidSessionSchema.safeParse({ ...session, permissions: [session.permissions[0], session.permissions[0]] }).success, false);
  assert.equal(kidSessionSchema.safeParse({ ...session, permissions: [{ name: 'ai-chat', enabled: true, managedBy: 'PROHIBITED' }] }).success, false);
});
for (const permission of permissionNames) test(`voice/memory authorization blocks denied ${permission} before downstream dispatch`, async () => {
  const h = harness(); h.deny(permission); const s = await owned(h); let dispatched = 0;
  const operation = permission === 'ai-memory' ? 'memory' : 'voice';
  await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, operation, s.contextVersion, async () => ++dispatched), { code: 'FORBIDDEN' });
  assert.equal(dispatched, 0); h.backend.close();
});
test('all voice grants cannot override missing cloud or spoken-coaching opt-in', async () => {
  for (const optIns of [{ ...request.optIns, cloudAnalysis: false }, { ...request.optIns, spokenCoaching: false }]) {
    const h = harness(); const s = await owned(h, { ...request, optIns }); let dispatched = 0;
    await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'voice', s.contextVersion, async () => ++dispatched), { code: 'FORBIDDEN' });
    assert.equal(dispatched, 0); h.backend.close();
  }
});
test('permitted test dispatch gets a trusted context and refreshes again before delivery', async () => {
  const h = harness(); const s = await owned(h);
  const count = h.calls.length;
  const result = await h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async context => {
    assert.equal(context.ownerId, s.ownerId); assert.equal(context.executionMode, 'test-fake'); assert.equal(context.assessment.id, s.assessment.id);
    await context.assertCurrent(); return 'test-spy-only';
  });
  assert.equal(result, 'test-spy-only'); assert.equal(h.calls.length, count + 3);
  assert.equal(h.adapter.status().status, 'mock'); h.backend.close();
});
test('missing permission, failed refresh and malformed session cause zero downstream calls', async () => {
  for (const mutation of ['omit', 'fail', 'malformed'] as const) {
    const h = harness(); const s = await owned(h); let dispatched = 0;
    if (mutation === 'omit') h.omit('ai-chat'); else h[mutation]();
    await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async () => ++dispatched));
    assert.equal(dispatched, 0);
    assert.notEqual(h.backend.capabilities(s.credential).capabilities.decisions.ai_coaching.state, 'allowed'); h.backend.close();
  }
});
test('pending challenge cannot authorize; server-polled PASS resolves only its bound session', async () => {
  const h = harness(); h.challenge(); const s = await owned(h); let dispatched = 0;
  assert.equal(s.onboardingState, 'pending'); assert.ok(s.challenge?.url.startsWith('https://family.k-id.com/'));
  await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async () => ++dispatched), { code: 'FORBIDDEN' });
  assert.equal(dispatched, 0); h.passChallenge();
  const refreshed = await h.backend.refresh(s.credential, s.contextVersion);
  assert.equal(refreshed.onboardingState, 'active'); assert.equal(refreshed.changed, true); assert.equal('challenge' in refreshed, false);
  h.backend.close();
});
for (const action of ['logout', 'revoke', 'context', 'refresh-failure'] as const) test(`${action} cancels active work and prevents delivery of a late response`, async () => {
  const h = harness(); const s = await owned(h); let resolve!: (value: string) => void; let started!: () => void; let context!: ProviderContext;
  const ready = new Promise<void>(r => { started = r; });
  const operation = h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async trusted => { context = trusted; started(); return new Promise<string>(r => { resolve = r; }); });
  const rejection = assert.rejects(operation);
  await ready;
  if (action === 'logout') h.backend.logout(s.credential);
  if (action === 'revoke') { h.deny('ai-chat'); await h.backend.refresh(s.credential, s.contextVersion); }
  if (action === 'context') await h.backend.updateContext(s.credential, { contextVersion: s.contextVersion, optIns: { ...request.optIns, cloudAnalysis: false } });
  if (action === 'refresh-failure') { h.fail(); await assert.rejects(() => h.backend.refresh(s.credential, s.contextVersion)); }
  assert.equal(context.signal.aborted, true); resolve('late reply'); await rejection; h.backend.close();
});
test('context correction reruns server onboarding and invalidates old assessment', async () => {
  const h = harness(); const s = await owned(h);
  const changed = await h.backend.updateContext(s.credential, { contextVersion: s.contextVersion, syntheticProfile: 'teen' });
  assert.equal(changed.syntheticProfile, 'teen'); assert.ok(h.calls.filter(p => p.endsWith('/age-gate/check')).length === 2);
  await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', changed.contextVersion, async () => true), { code: 'CONFLICT' });
  h.backend.close();
});
test('runtime configuration never selects fake, production or arbitrary network destinations', async () => {
  for (const config of [{}, { KID_WORKFLOW: 'fake' }, { KID_WORKFLOW: 'cdk-test', KID_API_KEY: 'example', KID_API_BASE: 'https://game-api.k-id.com/api/v1' }]) assert.equal(permissionAdapterFromEnvironment(config).transport, 'unavailable');
  assert.throws(() => new CdkTestAdapter({ key: 'example', mappingConfirmed: true, base: 'http://127.0.0.1' }));
  const h = harness(); assert.throws(() => new BackendService({ adapter: h.adapter }));
  let calls = 0;
  const adapter = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, fetcher: async () => { calls++; return Response.json({ shouldDisplay: false, approvedAgeCollectionMethods: [] }); } });
  await assert.rejects(() => adapter.start('adult', 'US', new AbortController().signal)); assert.equal(calls, 1);
  assert.equal(testBase, 'https://game-api.test.k-id.com/api/v1'); h.backend.close();
});
test('adapter enforces timeouts and rejects mismatched session identities', async () => {
  const controller = new AbortController();
  const slow = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, timeoutMs: 10, fetcher: async (_url, init) => { await delay(100, undefined, { signal: init!.signal! }); return Response.json({}); } });
  await assert.rejects(() => slow.start('adult', 'US', controller.signal), { code: 'UNAVAILABLE' });
  const wrong = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, fetcher: async () => Response.json({ sessionId: randomUUID(), status: 'ACTIVE', jurisdiction: 'US', permissions: [] }) });
  await assert.rejects(() => wrong.refresh({ sessionId: randomUUID() }, controller.signal), { code: 'UNAVAILABLE' });
});
test('unconfirmed product mapping blocks downstream execution despite valid provider permissions', async () => {
  const h = harness(false); const s = await owned(h); let calls = 0;
  await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async () => ++calls), { code: 'UNAVAILABLE' });
  assert.equal(calls, 0); h.backend.close();
});
test('logout during an in-flight refresh discards a late vendor approval', async () => {
  const h = harness(); const s = await owned(h); h.hold();
  const pending = h.backend.refresh(s.credential, s.contextVersion);
  const rejected = assert.rejects(pending, { code: 'UNAUTHORIZED' });
  await assert.rejects(() => h.backend.updateContext(s.credential, { contextVersion: s.contextVersion, optIns: request.optIns }), { code: 'CONFLICT' });
  h.backend.logout(s.credential); h.release(); await rejected;
  assert.throws(() => h.backend.capabilities(s.credential), { code: 'UNAUTHORIZED' }); h.backend.close();
});
test('assessment storage is bounded and references expire independently of application credentials', async () => {
  let now = Date.now();
  const h = harness();
  const backend = new BackendService({ adapter: h.adapter, allowTestAdapter: true, now: () => now });
  const s = await backend.start(request);
  const body = { contextVersion: s.contextVersion, fixtureId: 'P01', variant: 'baseline' };
  const first = backend.createAssessment(s.credential, body);
  for (let i = 1; i < 32; i++) backend.createAssessment(s.credential, body);
  assert.throws(() => backend.createAssessment(s.credential, body), { code: 'LIMITED' });
  now += 5 * 60_000 + 1;
  await assert.rejects(() => backend.withAuthorizedOperation(s.credential, first.assessment.id, 'coaching', s.contextVersion, async () => true), { code: 'NOT_FOUND' });
  assert.ok(backend.createAssessment(s.credential, body).assessment.id); backend.close(); h.backend.close();
});
test('adapter rejects an oversized response and untrusted hosted challenge URL', async () => {
  const huge = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, fetcher: async () => Response.json({ padding: 'x'.repeat(70000) }) });
  await assert.rejects(() => huge.start('adult', 'US', new AbortController().signal), { code: 'UNAVAILABLE' });
  const adapter = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, fetcher: async url => String(url).includes('get-requirements') ? Response.json({ shouldDisplay: true, approvedAgeCollectionMethods: ['age-slider'] }) : Response.json({ status: 'CHALLENGE', challenge: { challengeId: randomUUID(), type: 'CHALLENGE_PARENTAL_CONSENT', url: 'https://untrusted.example/approve' } }) });
  await assert.rejects(() => adapter.start('adult', 'US', new AbortController().signal), { code: 'UNAVAILABLE' });
});
test('caller cancellation prevents dispatch and terminates work that ignores its signal', async () => {
  const h = harness(); const s = await owned(h); let calls = 0;
  const cancelled = new AbortController(); cancelled.abort();
  const before = h.calls.length;
  await assert.rejects(() => h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async () => ++calls, cancelled.signal));
  assert.equal(calls, 0); assert.equal(h.calls.length, before);
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>(r => { started = r; });
  const pending = h.backend.withAuthorizedOperation(s.credential, s.assessment.id, 'coaching', s.contextVersion, async () => { started(); return new Promise<never>(() => {}); }, controller.signal);
  const rejected = assert.rejects(pending, { code: 'UNAVAILABLE' });
  await ready; controller.abort(); await rejected; h.backend.close();
});
test('HTTP private API requires bearer credentials independent of origin and sanitizes errors/audit', async t => {
  const events: object[] = [];
  const app = createApp({ audit: event => events.push(event) });
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => { app.close(() => resolve()); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const post = (route: string, body: object, credential?: string) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await fetch(base + '/api/capabilities')).status, 401);
  assert.equal((await fetch(base + '/api/capabilities', { headers: { Origin: 'http://127.0.0.1:5173' } })).status, 401);
  const preflight = await fetch(base + '/api/capabilities', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Headers': 'Authorization' } });
  assert.match(preflight.headers.get('Access-Control-Allow-Headers')!, /Authorization/);
  assert.equal((await fetch(base + '/api/capabilities', { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const response = await post('/api/onboarding/session', request); assert.equal(response.status, 201); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const session = await response.json(); assert.equal(session.onboardingState, 'unavailable');
  const authenticated = await fetch(base + '/api/capabilities', { headers: { Authorization: `Bearer ${session.credential}` } });
  assert.equal(authenticated.status, 200);
  const failure = await post('/api/onboarding/refresh', { contextVersion: session.contextVersion }, session.credential);
  assert.equal(failure.status, 503); const error = await failure.json(); assert.equal(error.code, 'UNAVAILABLE'); assert.equal(error.retryable, true); assert.ok(error.requestId);
  assert.equal((await post('/api/onboarding/session', { ...request, ownerId: 'attacker' })).status, 400);
  assert.equal((await post('/api/onboarding/logout', {}, session.credential)).status, 200);
  assert.equal((await fetch(base + '/api/capabilities', { headers: { Authorization: `Bearer ${session.credential}` } })).status, 401);
  const log = JSON.stringify(events); assert.equal(log.includes(session.credential), false); assert.doesNotMatch(log, /dateOfBirth|permissions|otp|private upstream failure/);
});
