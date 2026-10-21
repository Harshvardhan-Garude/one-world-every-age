import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/server.js';
import { BackendService } from '../apps/api/src/backend.js';
import { CdkTestAdapter, UnavailablePermissionAdapter } from '../apps/api/src/kid.js';
import { UnavailableReasoningAdapter } from '../apps/api/src/gemini.js';
import { UnavailableSpeechAdapter } from '../apps/api/src/inworld.js';

const onboarding = { mode: 'provider-test', syntheticProfile: 'adult', jurisdiction: 'US-CA', optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } };
const offline = () => new BackendService({ adapter: new UnavailablePermissionAdapter(), reasoning: new UnavailableReasoningAdapter(), speech: new UnavailableSpeechAdapter() });
async function start(t: test.TestContext, backend = offline()) {
  const app = createApp({ backend });
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => { app.close(() => resolve()); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  return (path: string, body: unknown, credential?: string) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
}

test('claim token is accepted, never echoed, and reported as an honest blocker', async t => {
  const post = await start(t);
  const response = await post('/api/kid/claim', { claimToken: 'example-claim-token-value' });
  assert.equal(response.status, 202);
  const text = await response.text();
  assert.doesNotMatch(text, /example-claim-token-value/);
  assert.equal(JSON.parse(text).redeemed, false);
  for (const body of [{}, { claimToken: 42 }, { claimToken: 'short' }, { claimToken: 'example-claim-token-value', sessionId: randomUUID() }]) assert.equal((await post('/api/kid/claim', body)).status, 400);
});

test('widget session read requires application authentication and cannot accept arbitrary vendor IDs', async t => {
  const post = await start(t);
  assert.equal((await post('/api/kid/session', { sessionId: randomUUID() })).status, 401);
  const session = await (await post('/api/onboarding/session', onboarding)).json();
  assert.equal(session.provider.status, 'not configured');
  assert.equal((await post('/api/kid/session', { sessionId: randomUUID() }, session.credential)).status, 400);
  const response = await post('/api/kid/session', { contextVersion: session.contextVersion }, session.credential);
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'UNAVAILABLE');
  assert.equal((await post('/api/kid/session', { contextVersion: session.contextVersion + 1 }, session.credential)).status, 409);
});

test('widget session read refreshes only the server-owned k-ID link and emits a sanitized W02 session view', async t => {
  const sessionId = randomUUID(); let seen = '';
  const adapter = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, fetcher: async (input, init) => {
    const url = new URL(String(input)); assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer example');
    if (url.pathname.endsWith('/get-requirements')) return Response.json({ shouldDisplay: true, approvedAgeCollectionMethods: ['age-slider'] });
    if (url.pathname.endsWith('/age-gate/check')) return Response.json({ status: 'PASS', session: { sessionId } });
    seen = url.href;
    return Response.json({ sessionId, status: 'ACTIVE', jurisdiction: 'US-CA', permissions: [{ name: 'ai-chat', enabled: false, managedBy: 'GUARDIAN' }], dateOfBirth: '1992-04-15', etag: 'example' });
  } });
  const backend = new BackendService({ adapter, allowTestAdapter: true, reasoning: new UnavailableReasoningAdapter(), speech: new UnavailableSpeechAdapter() });
  const post = await start(t, backend), session = await (await post('/api/onboarding/session', onboarding)).json();
  const response = await post('/api/kid/session', { contextVersion: session.contextVersion }, session.credential);
  assert.equal(response.status, 200);
  assert.equal(new URL(seen).searchParams.get('sessionId'), sessionId);
  const body = await response.json();
  assert.equal(body.ownerId, session.ownerId); assert.equal(body.capabilities.decisions.ai_coaching.state, 'denied');
  assert.equal(body.provider.status, 'mock'); assert.equal(body.authorizationFreshness, 'refresh-before-dispatch-and-delivery');
  assert.doesNotMatch(JSON.stringify(body), /dateOfBirth|1992-04-15/); assert.equal(JSON.stringify(body).includes(sessionId), false);
});

test('failed bound widget refresh invalidates approval instead of granting access', async t => {
  const sessionId = randomUUID(); let fail = false;
  const adapter = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, fetcher: async input => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/get-requirements')) return Response.json({ shouldDisplay: true, approvedAgeCollectionMethods: ['age-slider'] });
    if (path.endsWith('/age-gate/check')) return Response.json({ status: 'PASS', session: { sessionId } });
    return fail ? Response.json({ private: 'example vendor failure' }, { status: 401 }) : Response.json({ sessionId, status: 'ACTIVE', jurisdiction: 'US-CA', permissions: [{ name: 'ai-chat', enabled: true, managedBy: 'PLAYER' }] });
  } });
  const backend = new BackendService({ adapter, allowTestAdapter: true, reasoning: new UnavailableReasoningAdapter(), speech: new UnavailableSpeechAdapter() });
  const post = await start(t, backend), session = await (await post('/api/onboarding/session', onboarding)).json();
  fail = true;
  const response = await post('/api/kid/session', { contextVersion: session.contextVersion }, session.credential);
  assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /example vendor failure/);
  const current = backend.capabilities(session.credential);
  assert.equal(current.onboardingState, 'unavailable'); assert.notEqual(current.capabilities.decisions.ai_coaching.state, 'allowed');
});
