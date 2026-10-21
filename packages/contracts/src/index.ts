import { z } from 'zod';

export const idSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9:_-]+$/);
export const textSchema = z.string().trim().min(1).max(2000);
const timestamp = z.iso.datetime();
export const modeSchema = z.enum(['local-demo', 'provider-test', 'production']);
export const personaSchema = z.enum(['child', 'teen', 'adult']);
export const contextSchema = z.object({
  id: idSchema,
  mode: modeSchema,
  persona: personaSchema,
  contextVersion: z.number().int().positive(),
  jurisdiction: z.object({ country: z.string().regex(/^[A-Z]{2}$/), state: z.string().max(80).optional(), source: z.enum(['synthetic', 'user-declared', 'estimated', 'provider']) }).strict(),
  preferences: z.object({ largeText: z.boolean(), plainLanguage: z.boolean() }).strict(),
}).strict();
export const capabilityNames = ['cloud_content_analysis', 'ai_coaching', 'voice_input', 'voice_output', 'uploads', 'conversation_memory', 'permitted_guardian_sharing'] as const;
export const capabilityNameSchema = z.enum(capabilityNames);
export const decisionSchema = z.object({
  state: z.enum(['allowed', 'denied', 'pending', 'unknown', 'expired']),
  provenance: z.enum(['local-demo', 'provider', 'app-policy', 'not-configured']),
  reason: textSchema,
  validatedAt: timestamp,
  expiresAt: timestamp.optional(),
}).strict();
export const capabilitySnapshotSchema = z.object({
  ownerId: idSchema, mode: modeSchema, contextVersion: z.number().int().positive(),
  decisions: z.record(capabilityNameSchema, decisionSchema),
}).strict().superRefine((snapshot, ctx) => {
  if (snapshot.mode === 'production' && Object.values(snapshot.decisions).some(d => d.provenance === 'local-demo')) {
    ctx.addIssue({ code: 'custom', message: 'Demo decisions cannot establish production capabilities' });
  }
});
export const browserGrantsSchema = z.object({ siteAccess: z.enum(['temporary', 'granted-origin', 'missing']), microphone: z.enum(['granted', 'denied', 'prompt', 'unknown']) }).strict();
export const optInsSchema = z.object({ cloudAnalysis: z.boolean(), spokenCoaching: z.boolean(), memory: z.boolean() }).strict();
export type CapabilitySnapshot = z.infer<typeof capabilitySnapshotSchema>;

// A contract-level predicate, not a session authenticator or a vendor mapping.
// Provider-backed execution must supply the server-owned snapshot in W02.
export function permitsProtectedOperation(snapshot: CapabilitySnapshot, required: readonly z.infer<typeof capabilityNameSchema>[], contextVersion: number, now = Date.now()): boolean {
  const result = capabilitySnapshotSchema.safeParse(snapshot);
  if (!result.success || snapshot.mode === 'local-demo' || snapshot.contextVersion !== contextVersion || required.length === 0) return false;
  return required.every(name => {
    const d = snapshot.decisions[name];
    return d?.state === 'allowed' && d.provenance !== 'local-demo' && d.provenance !== 'not-configured' && (!d.expiresAt || Date.parse(d.expiresAt) > now) && Date.parse(d.validatedAt) <= now;
  });
}

export const evidenceSchema = z.object({ id: idSchema, observation: textSchema, excerpt: textSchema }).strict();
export const assessmentSchema = z.object({
  id: idSchema, ownerId: idSchema, contextVersion: z.number().int().positive(), mode: modeSchema,
  source: z.enum(['fixture', 'local-rule', 'provider']), detectorVersion: idSchema,
  category: z.enum(['credential', 'financial', 'privacy', 'claim', 'provenance', 'support', 'comparison']),
  severity: z.enum(['informational', 'caution', 'high-concern', 'urgent-support']),
  state: z.enum(['analyzing', 'concern-found', 'inconclusive', 'no-supported-indicators', 'unavailable', 'error']),
  intervention: z.enum(['explain', 'pause', 'restrict']),
  evidence: z.array(evidenceSchema).min(1).max(12), evidenceIds: z.array(idSchema).min(1).max(12),
  explanation: textSchema, uncertainty: textSchema, safeActions: z.array(textSchema).min(1).max(5), createdAt: timestamp,
}).strict().superRefine((assessment, ctx) => {
  const known = new Set(assessment.evidence.map(e => e.id));
  if (known.size !== assessment.evidence.length || new Set(assessment.evidenceIds).size !== assessment.evidenceIds.length || assessment.evidenceIds.some(id => !known.has(id))) {
    ctx.addIssue({ code: 'custom', message: 'Evidence references must be unique and belong to this assessment' });
  }
  if (assessment.mode === 'production' && assessment.source === 'fixture') ctx.addIssue({ code: 'custom', message: 'A fixture is not a production assessment' });
});
export const explanationReplySchema = z.object({ assessmentId: idSchema, explanation: textSchema, spokenText: textSchema, evidenceIds: z.array(idSchema).min(1).max(12), uncertainty: textSchema, suggestedNextStep: textSchema }).strict();
export function parseExplanationForAssessment(input: unknown, assessment: z.infer<typeof assessmentSchema>) {
  const reply = explanationReplySchema.parse(input);
  if (reply.assessmentId !== assessment.id || reply.evidenceIds.some(id => !assessment.evidenceIds.includes(id))) throw new Error('Reply does not reference the owned assessment evidence');
  return reply;
}
export const providerStatusSchema = z.object({
  provider: z.enum(['k-ID', 'Gemini', 'Inworld', 'Modulate', 'FastSpring']),
  status: z.enum(['live verified', 'implemented but unverified', 'mock', 'not configured', 'deferred']),
  mode: modeSchema.nullable(), detail: textSchema,
}).strict();
export const structuredErrorSchema = z.object({ code: z.enum(['INVALID_REQUEST', 'NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN', 'CONFLICT', 'LIMITED', 'TOO_LARGE', 'UNAVAILABLE', 'INTERNAL']), message: textSchema, retryable: z.boolean(), requestId: idSchema }).strict();
export const publicChallengeSchema = z.object({
  id: idSchema, version: z.number().int().positive(), credit_key: idSchema,
  category: z.enum(['financial', 'privacy', 'claim', 'judgment']), question: textSchema,
  choices: z.array(z.object({ id: idSchema, text: textSchema }).strict()).min(2).max(6),
}).strict().superRefine((challenge, ctx) => {
  if (new Set(challenge.choices.map(c => c.id)).size !== challenge.choices.length) ctx.addIssue({ code: 'custom', message: 'Choice IDs must be unique' });
});
export const attemptSchema = z.object({
  challengeId: idSchema, version: z.number().int().positive(), credit_key: idSchema, choiceId: idSchema, reasonId: idSchema, actionId: idSchema,
  interpretedChoiceConfirmed: z.boolean(), idempotencyKey: idSchema,
}).strict();
// Reveal/independence state must be looked up by the server, not trusted from an attempt.
export const attemptRecordSchema = z.object({ ownerId: idSchema, attempt: attemptSchema, revealedAt: timestamp.nullable(), independent: z.boolean(), submittedAt: timestamp }).strict();
export const voiceTurnSchema = z.object({
  id: idSchema, ownerId: idSchema, sessionId: idSchema, assessmentId: idSchema, contextVersion: z.number().int().positive(),
  stage: z.enum(['ready', 'recording', 'redacting', 'reasoning', 'preparing-speech', 'speaking', 'stopped', 'unavailable', 'error']),
  cancelled: z.boolean(), createdAt: timestamp, deadlineAt: timestamp,
}).strict().superRefine((turn, ctx) => {
  if (Date.parse(turn.deadlineAt) <= Date.parse(turn.createdAt)) ctx.addIssue({ code: 'custom', message: 'Deadline must follow creation' });
  if (turn.cancelled && !['stopped', 'error', 'unavailable'].includes(turn.stage)) ctx.addIssue({ code: 'custom', message: 'A cancelled turn cannot remain active' });
});
export const demoRequestSchema = z.object({
  mode: z.literal('local-demo'), persona: personaSchema, fixtureId: z.enum(['P01', 'P16']), variant: z.enum(['baseline', 'safe', 'ambiguous']),
}).strict();
export const onboardingRequestSchema = z.object({
  mode: z.enum(['local-demo', 'provider-test']), syntheticProfile: personaSchema,
  jurisdiction: z.string().regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/), optIns: optInsSchema,
}).strict();
export const contextUpdateSchema = z.object({
  contextVersion: z.number().int().positive(), optIns: optInsSchema.optional(),
  jurisdiction: onboardingRequestSchema.shape.jurisdiction.optional(), syntheticProfile: personaSchema.optional(),
}).strict().refine(value => value.optIns !== undefined || value.jurisdiction !== undefined || value.syntheticProfile !== undefined, 'Supply a context change');
export const refreshRequestSchema = z.object({ contextVersion: z.number().int().positive() }).strict();
export const ownedAssessmentRequestSchema = z.object({
  contextVersion: z.number().int().positive(), fixtureId: z.enum(['P01', 'P16']), variant: z.enum(['baseline', 'safe', 'ambiguous']),
}).strict();
// Additive W06/W07/local-practice handoff. Mode, ownership and explanation text
// are resolved by the server; clients submit references, never provider authority.
export const coachingRequestSchema = z.object({ assessmentId: idSchema, contextVersion: z.number().int().positive() }).strict();
export const coachingResponseSchema = z.object({
  explanationId: idSchema, contextVersion: z.number().int().positive(),
  mode: z.enum(['local-demo', 'provider-test']), source: z.enum(['scripted-fixture', 'Gemini']),
  notice: textSchema, reply: explanationReplySchema,
}).strict().refine(value => (value.mode === 'local-demo') === (value.source === 'scripted-fixture'), 'Explanation provenance must match execution mode');
export const speechRequestSchema = coachingRequestSchema.extend({ explanationId: idSchema }).strict();
export const speechResponseSchema = z.object({
  assessmentId: idSchema, explanationId: idSchema, contextVersion: z.number().int().positive(),
  mode: z.literal('provider-test'), source: z.literal('Inworld'), notice: textSchema,
  captions: textSchema, mimeType: z.literal('audio/mpeg'), audioBase64: z.string().min(4).max(1_398_104),
}).strict();
export const quizRequestSchema = coachingRequestSchema;
export const quizResponseSchema = z.object({
  assessmentId: idSchema, contextVersion: z.number().int().positive(), mode: z.literal('local-demo'),
  source: z.literal('curated-fixture'), notice: textSchema, challenge: publicChallengeSchema,
}).strict();
export const quizAnswerRequestSchema = coachingRequestSchema.extend({ version: z.number().int().positive(), choiceId: idSchema }).strict();
export const quizFeedbackSchema = z.object({
  assessmentId: idSchema, contextVersion: z.number().int().positive(), challengeId: idSchema, version: z.number().int().positive(),
  mode: z.literal('local-demo'), source: z.literal('server-checked-fixture'), correct: z.boolean(),
  feedback: textSchema, notice: textSchema, masteryCreditAwarded: z.literal(false),
}).strict();
export const providerListSchema = z.object({ providers: z.array(providerStatusSchema) }).strict();
export const sessionViewSchema = z.object({
  ownerId: idSchema, mode: z.enum(['local-demo', 'provider-test']), contextVersion: z.number().int().positive(),
  syntheticProfile: personaSchema, jurisdiction: onboardingRequestSchema.shape.jurisdiction, optIns: optInsSchema,
  applicationExpiresAt: timestamp, onboardingState: z.enum(['local-demo', 'active', 'pending', 'prohibited', 'unavailable']),
  capabilities: capabilitySnapshotSchema, authorizationFreshness: z.literal('refresh-before-dispatch-and-delivery'),
  provider: z.object({ provider: z.literal('k-ID'), status: providerStatusSchema.shape.status, environment: z.literal('k-ID Test Mode'), detail: textSchema, mappingConfirmed: z.boolean(), lastSuccessfulCallAt: timestamp.optional(), verifiedSessionAt: timestamp.optional() }).strict(),
  challenge: z.object({ type: z.enum(['CHALLENGE_PARENTAL_CONSENT', 'CHALLENGE_AGE_GATE_AGE_ASSURANCE']), url: z.url().max(2048), environment: z.literal('k-ID Test Mode') }).strict().optional(),
}).strict().superRefine((view, ctx) => {
  if (view.capabilities.ownerId !== view.ownerId || view.capabilities.mode !== view.mode || view.capabilities.contextVersion !== view.contextVersion || (view.mode === 'local-demo' && view.onboardingState !== 'local-demo') || (view.mode !== 'local-demo' && view.onboardingState === 'local-demo') || (view.challenge && view.onboardingState !== 'pending')) ctx.addIssue({ code: 'custom', message: 'Session response must preserve server-owned context and mode' });
});
export const fixtureSchema = z.object({
  id: z.enum(['P01', 'P16']), variant: z.enum(['baseline', 'safe', 'ambiguous']), title: textSchema,
  illustrativeUrl: z.url().max(2048), text: textSchema,
  expectedState: assessmentSchema.shape.state, expectedSeverity: assessmentSchema.shape.severity,
  explanation: textSchema, uncertainty: textSchema, safeAction: textSchema,
}).strict();
export const ownedAssessmentResponseSchema = z.object({
  assessment: assessmentSchema, referenceExpiresAt: timestamp, fixture: fixtureSchema, challenge: publicChallengeSchema,
}).strict();
export type DemoRequest = z.infer<typeof demoRequestSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type PublicChallenge = z.infer<typeof publicChallengeSchema>;
export const demoResponseSchema = z.object({ context: contextSchema, capabilities: capabilitySnapshotSchema, fixture: fixtureSchema, assessment: assessmentSchema, challenge: publicChallengeSchema }).strict().superRefine((response, ctx) => {
  if (response.context.mode !== 'local-demo' || response.capabilities.mode !== 'local-demo' || response.assessment.mode !== 'local-demo' || response.assessment.source !== 'fixture' || response.assessment.ownerId !== response.context.id || response.capabilities.ownerId !== response.context.id || response.assessment.contextVersion !== response.context.contextVersion || response.capabilities.contextVersion !== response.context.contextVersion) ctx.addIssue({ code: 'custom', message: 'Demo response must preserve mode, ownership and context' });
});
