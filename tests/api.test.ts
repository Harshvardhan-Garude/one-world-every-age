import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/server.js';
import { demoResponseSchema } from '@beacon/contracts';

test('local API validates demo boundaries without accepting production authority', async t => {
  const app = createApp();
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => { app.close(() => resolve()); app.closeAllConnections(); }));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const post = (body: unknown) => fetch(`${base}/api/demo/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const valid = { mode: 'local-demo', persona: 'teen', fixtureId: 'P01', variant: 'baseline' };
  await t.test('health and valid demo respond; no server rubric escapes', async () => {
    assert.equal((await (await fetch(`${base}/health`)).json()).productionAuthorization, false);
    const response = await post(valid);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(demoResponseSchema.parse(body).assessment.ownerId, 'demo:teen');
    assert.doesNotMatch(JSON.stringify(body), /correctChoiceId|requiredReasonId|requiredActionId/);
  });
  await t.test('invalid modes, oversized payloads and authority fields rejected', async () => {
    for (const body of [{ ...valid, mode: 'production' }, { ...valid, ownerId: 'victim' }, { ...valid, correct: true }, { ...valid, permissions: { ai_coaching: 'allowed' } }, { ...valid, fixtureId: 'P18' }]) assert.equal((await post(body)).status, 400);
    const response = await post({ ...valid, extra: 'x'.repeat(5000) });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, 'TOO_LARGE');
    assert.equal((await fetch(`${base}/api/demo/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await fetch(`${base}/api/demo/assessments`, { method: 'POST', body: '{}' })).status, 415);
  });
  await t.test('origin controls and nonexistent protected routes do not grant authority', async () => {
    assert.equal((await fetch(`${base}/api/demo`, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const allowed = await fetch(`${base}/api/demo`, { headers: { Origin: 'http://127.0.0.1:5173' } });
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5173');
    for (const route of ['/api/voice/turns', '/api/challenges/test/attempts']) assert.equal((await fetch(`${base}${route}`, { method: 'POST' })).status, 404);
  });
  await t.test('controlled fixtures are inert and illustrative domains are labeled', async () => {
    for (const fixture of ['P01', 'P16']) {
      const response = await fetch(`${base}/fixtures/${fixture}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /not the actual tab URL/);
      assert.match(html, /No credentials collected/);
      assert.doesNotMatch(html, /<input|<form|<script/);
      assert.match(response.headers.get('Content-Security-Policy')!, /form-action 'none'/);
    }
    assert.equal((await fetch(`${base}/fixtures/P01?variant=unknown`)).status, 404);
  });
});
