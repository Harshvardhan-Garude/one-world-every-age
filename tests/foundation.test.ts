import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import {
  assessmentSchema, attemptSchema, capabilitySnapshotSchema, contextSchema, demoRequestSchema, demoResponseSchema,
  parseExplanationForAssessment, permitsProtectedOperation, publicChallengeSchema, voiceTurnSchema,
} from '@beacon/contracts';
import { baselineFixtures, renderDemo } from '@beacon/fixtures';
import { baselineRubric } from '@beacon/fixtures/server';
import { describeUrl } from '@beacon/detection';

const input = { mode: 'local-demo', persona: 'child', fixtureId: 'P01', variant: 'baseline' } as const;
const demo = () => renderDemo(input);
test('all six baseline/safe/ambiguous fixtures validate for all three demo personas', () => {
  for (const fixture of baselineFixtures) for (const persona of ['child', 'teen', 'adult'] as const) {
    const response = demoResponseSchema.parse(renderDemo({ ...input, persona, fixtureId: fixture.id, variant: fixture.variant }));
    assert.equal(response.assessment.state, fixture.expectedState);
    assert.equal(response.assessment.severity, fixture.expectedSeverity);
    assert.equal(response.assessment.ownerId, `demo:${persona}`);
    assert.equal(response.assessment.evidence[0].excerpt, fixture.text);
  }
  assert.equal(demo().assessment.state, 'concern-found');
  assert.equal(renderDemo({ ...input, fixtureId: 'P16' }).assessment.state, 'no-supported-indicators');
});
test('requests reject production mode, unknown fixture, grant/owner injection and invalid persona', () => {
  for (const value of [{ ...input, mode: 'production' }, { ...input, fixtureId: 'P08' }, { ...input, persona: 'admin' }, { ...input, ownerId: 'other' }, { ...input, grants: { voice_input: true } }]) assert.equal(demoRequestSchema.safeParse(value).success, false);
  assert.equal(contextSchema.safeParse({ ...demo().context, mode: 'made-up' }).success, false);
});
test('assessment rejects oversized text, invalid state and foreign or duplicate evidence', () => {
  const assessment = demo().assessment;
  for (const value of [{ ...assessment, explanation: 'x'.repeat(2001) }, { ...assessment, state: 'safe' }, { ...assessment, evidenceIds: ['another-assessment:request'] }, { ...assessment, evidence: [assessment.evidence[0], assessment.evidence[0]] }, { ...assessment, mode: 'production' }]) assert.equal(assessmentSchema.safeParse(value).success, false);
});
test('explanations cannot cite another assessment or invent an evidence ID', () => {
  const assessment = demo().assessment;
  const reply = { assessmentId: assessment.id, explanation: 'A copied logo is not proof.', spokenText: 'A copied logo is not proof.', evidenceIds: assessment.evidenceIds, uncertainty: 'Fixture only.', suggestedNextStep: 'Use an independently known channel.' };
  assert.deepEqual(parseExplanationForAssessment(reply, assessment), reply);
  assert.throws(() => parseExplanationForAssessment({ ...reply, evidenceIds: ['foreign:address'] }, assessment));
  assert.throws(() => parseExplanationForAssessment({ ...reply, assessmentId: 'someone-else' }, assessment));
});
test('response schema enforces matching owners and context versions', () => {
  const response = demo();
  assert.equal(demoResponseSchema.safeParse({ ...response, assessment: { ...response.assessment, ownerId: 'another-owner' } }).success, false);
  assert.equal(demoResponseSchema.safeParse({ ...response, capabilities: { ...response.capabilities, contextVersion: 9 } }).success, false);
});
test('unknown/denied/pending/expired and local demo decisions fail closed', () => {
  const snapshot = demo().capabilities;
  assert.equal(permitsProtectedOperation(snapshot, ['voice_input'], 1), false);
  const providerSnapshot = { ...snapshot, mode: 'provider-test' as const, decisions: Object.fromEntries(Object.entries(snapshot.decisions).map(([key, d]) => [key, { ...d, state: 'allowed' as const, provenance: 'provider' as const }])) };
  const valid = capabilitySnapshotSchema.parse(providerSnapshot);
  assert.equal(permitsProtectedOperation(valid, ['voice_input', 'ai_coaching'], 1), true);
  assert.equal(permitsProtectedOperation(valid, ['voice_input'], 2), false);
  for (const state of ['unknown', 'denied', 'pending', 'expired'] as const) {
    const modified = { ...valid, decisions: { ...valid.decisions, voice_input: { ...valid.decisions.voice_input, state } } };
    assert.equal(permitsProtectedOperation(modified, ['voice_input'], 1), false);
  }
  const expired = { ...valid, decisions: { ...valid.decisions, voice_input: { ...valid.decisions.voice_input, expiresAt: '2000-01-01T00:00:00.000Z' } } };
  assert.equal(permitsProtectedOperation(expired, ['voice_input'], 1), false);
  assert.equal(capabilitySnapshotSchema.safeParse({ ...snapshot, mode: 'production', decisions: { ...snapshot.decisions, voice_input: { ...snapshot.decisions.voice_input, state: 'allowed', provenance: 'local-demo' } } }).success, false);
  assert.equal(capabilitySnapshotSchema.safeParse({ ...snapshot, decisions: { ...snapshot.decisions, voice_input: { ...snapshot.decisions.voice_input, state: 'enabled' } } }).success, false);
});
test('public challenges omit rubric and reject client correctness/reveal authority', () => {
  const challenge = demo().challenge;
  assert.equal(challenge.credit_key, baselineRubric.credit_key);
  assert.equal(challenge.version, baselineRubric.version);
  assert.ok(challenge.choices.some(c => c.id === baselineRubric.correctChoiceId));
  assert.equal('correctChoiceId' in challenge, false);
  assert.equal(publicChallengeSchema.safeParse({ ...challenge, correctChoiceId: baselineRubric.correctChoiceId }).success, false);
  const attempt = { challengeId: challenge.id, version: 1, credit_key: challenge.credit_key, choiceId: 'logo', reasonId: 'inspect-actual-request', actionId: 'use-independent-channel', interpretedChoiceConfirmed: true, idempotencyKey: 'attempt-1' };
  assert.equal(attemptSchema.safeParse(attempt).success, true);
  for (const extra of [{ correct: true }, { independent: true }, { revealed: false }, { ownerId: 'foreign' }]) assert.equal(attemptSchema.safeParse({ ...attempt, ...extra }).success, false);
});
test('browser resolution cannot import server-only rubric export', async () => {
  await assert.rejects(() => build({ stdin: { contents: "import { baselineRubric } from '@beacon/fixtures/server'; console.log(baselineRubric)", resolveDir: process.cwd() }, bundle: true, platform: 'browser', write: false, logLevel: 'silent' }));
});
test('URL parsing handles public suffixes and rejects executable/credential URLs', () => {
  assert.equal(describeUrl('https://roblox.com.gifts-check.example/reward').registrableDomain, 'gifts-check.example');
  assert.equal(describeUrl('https://shop.example.co.uk/path').registrableDomain, 'example.co.uk');
  assert.equal(describeUrl('https://account.github.io').registrableDomain, 'account.github.io');
  for (const url of ['javascript:alert(1)', 'https://name:password@example.com', 'not a URL', `https://example.com/${'x'.repeat(2049)}`]) assert.throws(() => describeUrl(url));
});
test('voice lifecycle rejects an active cancelled turn and impossible deadline', () => {
  const turn = { id: 'turn-1', ownerId: 'demo:adult', sessionId: 'session-1', assessmentId: demo().assessment.id, contextVersion: 1, stage: 'stopped', cancelled: true, createdAt: '2026-10-21T18:00:00.000Z', deadlineAt: '2026-10-21T18:00:20.000Z' };
  assert.equal(voiceTurnSchema.safeParse(turn).success, true);
  assert.equal(voiceTurnSchema.safeParse({ ...turn, stage: 'speaking' }).success, false);
  assert.equal(voiceTurnSchema.safeParse({ ...turn, deadlineAt: turn.createdAt }).success, false);
});
