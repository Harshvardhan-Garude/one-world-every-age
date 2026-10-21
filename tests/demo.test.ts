import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { BackendService } from '../apps/api/src/backend.js';
import { ProgressStore } from '../apps/api/src/progress.js';
import { ModulateAdapter, UnavailableRedactionAdapter, parseRedaction, redactionAdapterFromEnvironment } from '../apps/api/src/modulate.js';
import { FastSpringAdapter, UnavailableCheckoutAdapter } from '../apps/api/src/fastspring.js';
import { UnavailablePermissionAdapter, CdkTestAdapter, permissionAdapterFromEnvironment } from '../apps/api/src/kid.js';
import { GeminiAdapter, UnavailableReasoningAdapter } from '../apps/api/src/gemini.js';
import { InworldAdapter, UnavailableSpeechAdapter } from '../apps/api/src/inworld.js';
import { baselineFixtures, recognizeControlledFixture, renderDemo } from '@beacon/fixtures';
import type { ProviderContext } from '../apps/api/src/providers.js';
const offline = (now?: () => number) => new BackendService({ adapter: new UnavailablePermissionAdapter(), reasoning: new UnavailableReasoningAdapter(), speech: new UnavailableSpeechAdapter(), redaction: new UnavailableRedactionAdapter(), checkout: new UnavailableCheckoutAdapter(), now });
const start = { mode: 'local-demo', syntheticProfile: 'child', jurisdiction: 'US-CA', optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } };
async function owned(backend: BackendService, mode = 'local-demo', syntheticProfile = 'child', fixtureId = 'P01') {
  const session = await backend.start({ ...start, mode, syntheticProfile, optIns: { cloudAnalysis: mode === 'provider-test', spokenCoaching: mode === 'provider-test', memory: false } });
  const { assessment } = backend.createAssessment(session.credential, { fixtureId, variant: 'baseline', contextVersion: session.contextVersion });
  return { ...session, assessment, request: { assessmentId: assessment.id, contextVersion: session.contextVersion } };
}
function multipart(text = 'What should <pii:name></pii:name> check?', duration = 1000) {
  const form = new FormData(); form.set('metadata', new Blob([JSON.stringify({ text, duration_ms: duration, utterances: [{ text, language: 'en' }], redaction_ranges: [[1, 20]] })], { type: 'application/json' }), 'metadata.json'); form.set('audio', new Blob(['synthetic-redacted-audio'], { type: 'audio/mpeg' }), 'redacted.mp3'); return new Response(form);
}
function harness(options: { deny?: string; failRedaction?: boolean; failSpeech?: boolean; late?: () => Promise<Response>; adult?: boolean } = {}) {
  const stats = { modulate: 0, gemini: 0, speech: 0, checkout: 0 }; let denied = options.deny;
  const id = randomUUID();
  const adapter = new CdkTestAdapter({ key: 'example', mappingConfirmed: true, purchaseMappingConfirmed: true, fetcher: async input => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/get-requirements')) return Response.json({ shouldDisplay: true, approvedAgeCollectionMethods: ['age-slider'] });
    if (path.endsWith('/age-gate/check')) return Response.json({ status: 'PASS', session: { sessionId: id } });
    return Response.json({ sessionId: id, status: 'ACTIVE', jurisdiction: 'US-CA', ageStatus: options.adult === false ? 'DIGITAL_ADULT' : 'LEGAL_ADULT', permissions: ['ai-chat', 'ai-voice-mode', 'ai-media-upload', 'ai-media-generation', 'in-game-purchases'].map(name => ({ name, enabled: name !== denied, managedBy: 'PLAYER' })) });
  } });
  const redaction = new ModulateAdapter({ key: 'example', fetcher: async (input, init) => { stats.modulate++; assert.equal(String(input), 'https://platform.modulate.ai/api/velma-2-pii-phi-redaction-batch'); assert.equal(new Headers(init?.headers).get('X-API-Key'), 'example'); assert.ok(init?.body instanceof FormData); assert.equal(init.body.get('language'), 'en'); return options.late ? options.late() : options.failRedaction ? Response.json({ text: 'unredacted' }) : multipart(); } });
  const reasoning = new GeminiAdapter({ key: 'example', model: 'example-model', fetcher: async (_, init) => {
    stats.gemini++; const evidence = JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text);
    assert.match(JSON.stringify(evidence), /<pii:name><\/pii:name>/); assert.doesNotMatch(JSON.stringify(evidence), /synthetic-original-recording/);
    const text = 'Check the fictional toll account independently.';
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ assessmentId: evidence.assessmentId, explanation: text, spokenText: text, evidenceIds: evidence.evidence.map((e: { id: string }) => e.id), uncertainty: 'Synthetic evidence only.', suggestedNextStep: 'Use a known app.' }) }] } }] });
  } });
  const speech = new InworldAdapter({ key: 'example', model: 'example-model', voice: 'example-voice', fetcher: async (_, init) => { stats.speech++; assert.equal(JSON.parse(String(init?.body)).text, 'Check the fictional toll account independently.'); return options.failSpeech ? Response.json({ private: 'upstream-error' }, { status: 503 }) : Response.json({ audioContent: Buffer.from('test-mp3').toString('base64') }); } });
  const checkout = new FastSpringAdapter({ username: 'example', password: 'example', checkoutPath: 'ozone/web-demo', productPath: 'ozone-theme', fetcher: async (_, init) => { stats.checkout++; const body = JSON.parse(String(init?.body)); assert.equal(body.live, false); assert.deepEqual(body.cart.lineItems, [{ productPath: 'ozone-theme', quantity: 1 }]); return Response.json({ id: 'OS-example', live: false, currency: 'USD', cart: { netTotal: 1, lineItems: [{ productPath: 'ozone-theme', quantity: 1 }] }, checkoutStatus: ['READY_FOR_CHECKOUT'], checkoutUrls: { webcheckoutUrl: 'https://ozone.test.onfastspring.com/checkout/session/OS-example' } }); } });
  return { backend: new BackendService({ adapter, reasoning, speech, redaction, checkout, allowTestAdapter: true }), stats, deny: (name: string) => { denied = name; } };
}

test('P10 toll evidence, comparison and independent advice remain grounded; controlled recognizer rejects changed/hidden-equivalent text and remote URLs', () => {
  for (const fixture of baselineFixtures) {
    const actualUrl = `http://127.0.0.1:8787/fixtures/${fixture.id}?variant=${fixture.variant}`;
    assert.equal(recognizeControlledFixture({ actualUrl, fixtureId: fixture.id, variant: fixture.variant, visibleText: fixture.text, destination: fixture.illustrativeUrl })?.id, fixture.id);
    assert.equal(recognizeControlledFixture({ actualUrl, fixtureId: fixture.id, variant: fixture.variant, visibleText: fixture.text + ' altered', destination: fixture.illustrativeUrl }), null);
    assert.equal(recognizeControlledFixture({ actualUrl: actualUrl.replace('127.0.0.1', 'evil.example'), fixtureId: fixture.id, variant: fixture.variant, visibleText: fixture.text, destination: fixture.illustrativeUrl }), null);
  }
  const demo = renderDemo({ mode: 'local-demo', persona: 'adult', fixtureId: 'P10', variant: 'baseline' });
  assert.equal(demo.assessment.category, 'financial'); assert.match(demo.assessment.explanation, /does not prove whether any toll is owed/); assert.match(demo.assessment.safeActions[0], /independently/);
});

test('handoff creates a new owned local assessment, is one-time, expires and cannot transfer vendor access', async () => {
  let now = Date.now(); const backend = offline(() => now), source = await owned(backend), target = await owned(backend);
  const ticket = backend.createHandoff(source.credential, source.request);
  const redeemed = backend.redeemHandoff(target.credential, { ticket: ticket.ticket, contextVersion: target.contextVersion });
  assert.equal(redeemed.assessment.ownerId, target.ownerId); assert.notEqual(redeemed.assessment.id, source.assessment.id);
  assert.throws(() => backend.redeemHandoff(target.credential, { ticket: ticket.ticket, contextVersion: target.contextVersion }), { code: 'NOT_FOUND' });
  const expired = backend.createHandoff(source.credential, source.request); now += 45001;
  assert.throws(() => backend.redeemHandoff(target.credential, { ticket: expired.ticket, contextVersion: target.contextVersion }), { code: 'NOT_FOUND' });
  const fresh = backend.createHandoff(source.credential, source.request); await backend.updateContext(source.credential, { contextVersion: source.contextVersion, optIns: start.optIns });
  assert.throws(() => backend.redeemHandoff(target.credential, { ticket: fresh.ticket, contextVersion: target.contextVersion }), { code: 'CONFLICT' }); backend.close();
});

test('curated credit requires observation + reason + action; feedback/reveal/retry never farms credits; idempotency is transactional and persists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ozone-learning-')), file = join(dir, 'progress.sqlite');
  let store = new ProgressStore(file); const identity = store.identify(), other = store.identify();
  const run = store.issue(identity.id, 'link-check');
  const attempt = { runId: run.runId, challengeId: run.challenge.id, credit_key: run.challenge.credit_key, version: 1, choiceId: 'observe', reasonId: 'evidence', actionId: 'independent', interpretedChoiceConfirmed: true, idempotencyKey: randomUUID() };
  assert.throws(() => store.submit(other.id, attempt), { code: 'NOT_FOUND' });
  assert.throws(() => store.submit(identity.id, { ...attempt, correct: true }));
  const first = store.submit(identity.id, attempt); assert.equal(first.creditAwarded, true); assert.deepEqual(first.progress.badges, ['First Safe Step']);
  assert.deepEqual(store.submit(identity.id, attempt), first); assert.equal(store.submit(identity.id, { ...attempt, idempotencyKey: randomUUID() }).creditAwarded, false);
  assert.throws(() => store.submit(identity.id, { ...attempt, choiceId: 'appearance' }), { code: 'CONFLICT' });
  const second = store.issue(identity.id, 'private-chat'); store.reveal(identity.id, second.runId);
  assert.equal(store.submit(identity.id, { ...attempt, runId: second.runId, challengeId: second.challenge.id, credit_key: second.challenge.credit_key, idempotencyKey: randomUUID() }).creditAwarded, false);
  const wrong = store.issue(identity.id, 'toll-check');
  const wrongAttempt = { ...attempt, runId: wrong.runId, challengeId: wrong.challenge.id, credit_key: wrong.challenge.credit_key, reasonId: 'popular', idempotencyKey: randomUUID() };
  assert.equal(store.submit(identity.id, wrongAttempt).correct, false);
  assert.equal(store.submit(identity.id, { ...wrongAttempt, reasonId: 'evidence', idempotencyKey: randomUUID() }).creditAwarded, false);
  store.close(); store = new ProgressStore(file); assert.equal(store.identify(identity.token).id, identity.id); assert.equal(store.progress(identity.id).credits, 1); store.close(); rmSync(dir, { recursive: true });
});

test('all badge and status thresholds use distinct curated categories and careful judgments', () => {
  const store = new ProgressStore(), identity = store.identify();
  for (const lesson of store.catalog()) {
    const run = store.issue(identity.id, lesson.challenge.id);
    store.submit(identity.id, { runId: run.runId, challengeId: lesson.challenge.id, credit_key: lesson.challenge.credit_key, version: lesson.challenge.version, choiceId: 'observe', reasonId: 'evidence', actionId: 'independent', interpretedChoiceConfirmed: true, idempotencyKey: randomUUID() });
  }
  assert.deepEqual(store.progress(identity.id).badges, ['First Safe Step', 'Scam Pattern Spotter', 'Privacy Protector', 'Evidence Explorer', 'Careful Thinker']); assert.equal(store.progress(identity.id).status, 'Safety Guide'); store.close();
});

test('denied child and local adult purchases dispatch zero checkout calls; eligible adult sandbox is single-dispatch and uses server catalog', async () => {
  const h = harness(), child = await owned(h.backend, 'provider-test', 'child');
  const request = { ...child.request, itemId: 'ozone-theme', idempotencyKey: randomUUID() };
  const denied = await h.backend.purchase(child.credential, request); assert.equal(denied.state, 'blocked_by_policy'); assert.equal(h.stats.checkout, 0); assert.equal(denied.chargeCalls, 0);
  await assert.rejects(() => h.backend.purchase(child.credential, { ...request, amountMinor: 1 }));
  const adult = await owned(h.backend, 'provider-test', 'adult'); const input = { ...adult.request, itemId: 'ozone-theme', idempotencyKey: randomUUID() };
  const [a, b] = await Promise.all([h.backend.purchase(adult.credential, input), h.backend.purchase(adult.credential, input)]); assert.equal(a.state, 'checkout_ready'); assert.equal(b.checkoutCalls <= 1, true); assert.equal(h.stats.checkout, 1); assert.equal(a.amountMinor, 100); h.backend.close();
  const backend = offline(), local = await owned(backend, 'local-demo', 'adult'); assert.equal((await backend.purchase(local.credential, { ...local.request, itemId: 'ozone-theme', idempotencyKey: randomUUID() })).checkoutCalls, 0); backend.close();
});

test('voice is permission-checked and redaction-first; exact captions reach Inworld; no replay or cross-owner access', async () => {
  const h = harness(), person = await owned(h.backend, 'provider-test', 'adult', 'P10'), other = await owned(h.backend, 'provider-test', 'adult');
  const turn = await h.backend.beginVoice(person.credential, { ...person.request, adultPresenterConsent: true });
  assert.throws(() => h.backend.cancelVoice(other.credential, turn.turnId), { code: 'NOT_FOUND' });
  await assert.rejects(() => h.backend.beginVoice(person.credential, { ...person.request, adultPresenterConsent: true }), { code: 'CONFLICT' });
  const recording = { contextVersion: person.contextVersion, durationMs: 1000, mimeType: 'audio/webm', audioBase64: Buffer.from('synthetic-original-recording').toString('base64') };
  const response = await h.backend.voice(person.credential, turn.turnId, recording); assert.equal(response.reply.spokenText, response.reply.explanation); assert.equal(response.source, 'Modulate → Gemini → Inworld'); assert.deepEqual(h.stats, { modulate: 1, gemini: 1, speech: 1, checkout: 0 });
  await assert.rejects(() => h.backend.voice(person.credential, turn.turnId, recording), { code: 'NOT_FOUND' }); h.backend.close();
});

test('redaction failure stops the chain, denied permissions prevent recording setup, tagging is rejected and retention is explicit', async () => {
  assert.equal(redactionAdapterFromEnvironment({ MODULATE_API_KEY: 'example' }).transport, 'unavailable'); assert.equal(permissionAdapterFromEnvironment({ KID_API_KEY: 'kgp_test_example', KID_WORKFLOW: 'cdk-test' }).transport, 'unavailable');
  await assert.rejects(() => parseRedaction(multipart('Hello <pii:name>Fictional Name</pii:name>'), new AbortController().signal));
  await assert.rejects(() => parseRedaction(multipart('Test', 15001), new AbortController().signal));
  const h = harness({ failRedaction: true }), person = await owned(h.backend, 'provider-test', 'adult'); const turn = await h.backend.beginVoice(person.credential, { ...person.request, adultPresenterConsent: true });
  await assert.rejects(() => h.backend.voice(person.credential, turn.turnId, { contextVersion: person.contextVersion, durationMs: 1000, mimeType: 'audio/webm', audioBase64: Buffer.from('synthetic-original-recording').toString('base64') }), { code: 'UNAVAILABLE' }); assert.equal(h.stats.gemini, 0); assert.equal(h.stats.speech, 0); h.backend.close();
  const denied = harness({ deny: 'ai-media-upload' }), adult = await owned(denied.backend, 'provider-test', 'adult'); await assert.rejects(() => denied.backend.beginVoice(adult.credential, { ...adult.request, adultPresenterConsent: true }), { code: 'FORBIDDEN' }); assert.equal(denied.stats.modulate, 0); denied.backend.close();
});

test('Stop and consent revocation reject late redaction even when transport ignores abort', async () => {
  for (const cancel of ['stop', 'context', 'logout']) {
    let finish!: (response: Response) => void; const stalled = new Promise<Response>(r => { finish = r; });
    const h = harness({ late: () => stalled }), adult = await owned(h.backend, 'provider-test', 'adult'); const turn = await h.backend.beginVoice(adult.credential, { ...adult.request, adultPresenterConsent: true });
    const request = h.backend.voice(adult.credential, turn.turnId, { contextVersion: adult.contextVersion, durationMs: 1000, mimeType: 'audio/webm', audioBase64: Buffer.from('test').toString('base64') });
    const rejection = assert.rejects(request); while (!h.stats.modulate) await delay(1);
    if (cancel === 'stop') h.backend.cancelVoice(adult.credential, turn.turnId);
    else if (cancel === 'logout') h.backend.logout(adult.credential);
    else await h.backend.updateContext(adult.credential, { contextVersion: adult.contextVersion, optIns: start.optIns });
    finish(multipart()); await rejection; assert.equal(h.stats.gemini, 0); assert.equal(h.stats.speech, 0); h.backend.close();
  }
});

test('Modulate HTTP failures, malformed multipart, missing parts, tagging and stalled body fail closed with sanitized errors', async t => {
  const keepAlive = setTimeout(() => {}, 1000); t.after(() => clearTimeout(keepAlive));
  const fixture = renderDemo({ mode: 'local-demo', persona: 'adult', fixtureId: 'P10', variant: 'baseline' });
  const context: ProviderContext = { ownerId: fixture.assessment.ownerId, assessment: fixture.assessment, capabilities: fixture.capabilities, contextVersion: 1, executionMode: 'test-fake', signal: new AbortController().signal, assertCurrent: async () => {} };
  for (const status of [401, 403, 429, 500]) {
    const adapter = new ModulateAdapter({ key: 'example', fetcher: async () => Response.json({ detail: 'private-provider-detail' }, { status }) });
    await assert.rejects(() => adapter.redact(new Uint8Array([1]), 'audio/webm', context), e => e instanceof Error && !e.message.includes('private-provider-detail'));
  }
  const missing = new FormData(); missing.set('metadata', '{}');
  for (const response of [new Response('malformed', { headers: { 'Content-Type': 'multipart/form-data; boundary=broken' } }), new Response(missing), multipart('Hi <pii:name>raw</pii:name>')]) await assert.rejects(() => parseRedaction(response, context.signal));
  const adapter = new ModulateAdapter({ key: 'example', timeoutMs: 10, fetcher: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'multipart/form-data; boundary=never' } }) });
  await assert.rejects(() => adapter.redact(new Uint8Array([1]), 'audio/webm', context), { code: 'UNAVAILABLE' });
});

test('FastSpring rejects live responses, foreign checkout hosts and mismatched catalog totals', async () => {
  const fixture = renderDemo({ mode: 'local-demo', persona: 'adult', fixtureId: 'P01', variant: 'baseline' });
  const context: ProviderContext = { ownerId: fixture.assessment.ownerId, assessment: fixture.assessment, capabilities: fixture.capabilities, contextVersion: 1, executionMode: 'test-fake', signal: new AbortController().signal, assertCurrent: async () => {} };
  const good = { id: 'OS-example', live: false, currency: 'USD', cart: { netTotal: 1, lineItems: [{ productPath: 'ozone-theme', quantity: 1 }] }, checkoutStatus: ['READY_FOR_CHECKOUT'], checkoutUrls: { webcheckoutUrl: 'https://ozone.test.onfastspring.com/checkout/session/OS-example' } };
  for (const body of [{ ...good, live: true }, { ...good, checkoutUrls: { webcheckoutUrl: 'https://attacker.example/OS-example' } }, { ...good, cart: { ...good.cart, netTotal: 9 } }]) {
    const adapter = new FastSpringAdapter({ username: 'example', password: 'example', checkoutPath: 'ozone/web-demo', productPath: 'ozone-theme', fetcher: async () => Response.json(body) });
    await assert.rejects(() => adapter.checkout(randomUUID(), context), { code: 'UNAVAILABLE' });
  }
});

test('owned HTTP handoff/progress/purchase/voice routes require bearer, exact CORS and reject authority fields', async t => {
  const { createApp } = await import('../apps/api/src/server.js');
  const app = createApp({ backend: offline(), extensionOrigins: ['chrome-extension://' + 'a'.repeat(32)] });
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => { app.close(() => resolve()); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${(app.address() as import('node:net').AddressInfo).port}`;
  const post = async (path: string, body: unknown, credential?: string) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
  for (const route of ['/api/purchases', '/api/handoffs', '/api/voice/turns', '/api/progress/identity']) assert.equal((await post(route, {})).status, 401);
  const session = await (await post('/api/onboarding/session', start)).json();
  const assessment = await (await post('/api/assessments', { contextVersion: session.contextVersion, fixtureId: 'P10', variant: 'baseline' }, session.credential)).json();
  const ref = { contextVersion: session.contextVersion, assessmentId: assessment.assessment.id };
  const purchase = await (await post('/api/purchases', { ...ref, itemId: 'ozone-theme', idempotencyKey: randomUUID() }, session.credential)).json(); assert.equal(purchase.checkoutCalls, 0); assert.equal(purchase.chargeCalls, 0);
  assert.equal((await post('/api/purchases', { ...ref, itemId: 'ozone-theme', idempotencyKey: randomUUID(), approved: true }, session.credential)).status, 400);
  const preflight = await fetch(base + '/api/handoffs', { method: 'OPTIONS', headers: { Origin: 'chrome-extension://' + 'a'.repeat(32), 'Access-Control-Request-Headers': 'authorization, content-type' } }); assert.equal(preflight.status, 204); assert.match(preflight.headers.get('Access-Control-Allow-Headers')!, /Authorization/);
  assert.equal((await fetch(base + '/api/providers', { headers: { Origin: 'chrome-extension://' + 'b'.repeat(32), Authorization: `Bearer ${session.credential}` } })).status, 403);
  const identity = await (await post('/api/progress/identity', {}, session.credential)).json(); assert.equal(typeof identity.token, 'string'); assert.equal(identity.progress.credits, 0);
  assert.equal((await post('/api/progress/reset', {}, session.credential)).status, 200);
});


test('P10 owned teaching supports every persona/variant and Inworld-only failure preserves validated voice captions', async () => {
  const backend = offline();
  for (const syntheticProfile of ['child', 'teen', 'adult']) for (const variant of ['baseline', 'safe', 'ambiguous']) {
    const session = await backend.start({ ...start, syntheticProfile });
    const { assessment } = backend.createAssessment(session.credential, { contextVersion: session.contextVersion, fixtureId: 'P10', variant });
    const request = { assessmentId: assessment.id, contextVersion: session.contextVersion };
    await backend.explain(session.credential, request); const quiz = backend.quiz(session.credential, request);
    assert.equal(quiz.challenge.id, 'toll-address-and-request');
    const feedback = backend.answerQuiz(session.credential, quiz.challenge.id, { ...request, version: quiz.challenge.version, choiceId: 'address-request' });
    assert.equal(feedback.correct, true); assert.equal(feedback.masteryCreditAwarded, false); assert.match(feedback.feedback, /toll is owed/);
  }
  backend.close();
  const h = harness({ failSpeech: true }), adult = await owned(h.backend, 'provider-test', 'adult', 'P10');
  const turn = await h.backend.beginVoice(adult.credential, { ...adult.request, adultPresenterConsent: true });
  const response = await h.backend.voice(adult.credential, turn.turnId, { contextVersion: adult.contextVersion, durationMs: 1000, mimeType: 'audio/webm', audioBase64: Buffer.from('synthetic-original-recording').toString('base64') });
  assert.equal(response.audioBase64, undefined); assert.match(response.speechUnavailable!, /matching text captions/); assert.equal(response.reply.spokenText, response.reply.explanation); assert.equal(h.stats.gemini, 1); h.backend.close();
});
