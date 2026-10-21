import {
  coachingResponseSchema, ownedAssessmentResponseSchema, providerListSchema,
  purchaseResultSchema, quizFeedbackSchema, quizResponseSchema, sessionViewSchema, structuredErrorSchema, type DemoRequest,
} from '@beacon/contracts';
import type { z } from 'zod';

export type Lesson = z.infer<typeof ownedAssessmentResponseSchema> & {
  capabilities: z.infer<typeof sessionViewSchema>['capabilities'];
  explanation: z.infer<typeof coachingResponseSchema>;
  quiz: z.infer<typeof quizResponseSchema>;
  providers: z.infer<typeof providerListSchema>['providers'];
  answer(choiceId: string, signal: AbortSignal): Promise<z.infer<typeof quizFeedbackSchema>>;
  purchase(signal: AbortSignal): Promise<z.infer<typeof purchaseResultSchema>>;
  dispose(): void;
};
export class LearningError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
async function request(path: string, body: unknown, credential?: string, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', signal,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = structuredErrorSchema.safeParse(value);
    throw new LearningError(error.success ? error.data.code : 'UNAVAILABLE', error.success ? error.data.message : 'The local teaching service is unavailable.');
  }
  return value;
}
// Application bearer credentials live only in this closure: never URL/storage,
// page markup, extension messages or diagnostic logs.
export async function loadLesson(input: DemoRequest, signal: AbortSignal, handoff?: string): Promise<Lesson> {
  let credential: string | undefined;
  const dispose = () => {
    if (!credential) return;
    const current = credential; credential = undefined;
    void request('/api/onboarding/logout', {}, current).catch(() => {});
  };
  try {
    const created = await request('/api/onboarding/session', {
      mode: 'local-demo', syntheticProfile: input.persona, jurisdiction: 'US-CA',
      optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false },
    });
    // Parse the one-time credential separately from the strict public session view.
    const { credential: issued, ...view } = created as Record<string, unknown>;
    if (typeof issued !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(issued)) throw new LearningError('UNAVAILABLE', 'The application session could not be created.');
    credential = issued;
    signal.throwIfAborted();
    const session = sessionViewSchema.parse(view);
    if (session.mode !== 'local-demo') throw new LearningError('UNAVAILABLE', 'Offline teaching requires a local-demo session.');
    const owned = ownedAssessmentResponseSchema.parse(await request(handoff ? '/api/handoffs/redeem' : '/api/assessments', handoff ? { ticket: handoff, contextVersion: session.contextVersion } : {
      contextVersion: session.contextVersion, fixtureId: input.fixtureId, variant: input.variant,
    }, credential, signal));
    if (owned.assessment.ownerId !== session.ownerId || owned.assessment.contextVersion !== session.contextVersion || owned.assessment.mode !== 'local-demo') throw new LearningError('UNAVAILABLE', 'The assessment does not match this application session.');
    const ref = { assessmentId: owned.assessment.id, contextVersion: session.contextVersion };
    const explanation = coachingResponseSchema.parse(await request('/api/coaching/messages', ref, credential, signal));
    const quiz = quizResponseSchema.parse(await request(`/api/challenges?assessmentId=${encodeURIComponent(ref.assessmentId)}&contextVersion=${ref.contextVersion}`, undefined, credential, signal));
    const { providers } = providerListSchema.parse(await request('/api/providers', undefined, credential, signal));
    signal.throwIfAborted();
    if (explanation.mode !== 'local-demo' || explanation.reply.assessmentId !== ref.assessmentId || quiz.assessmentId !== ref.assessmentId || explanation.contextVersion !== ref.contextVersion || quiz.contextVersion !== ref.contextVersion) throw new LearningError('UNAVAILABLE', 'The teaching response changed. Reload the example.');
    return {
      ...owned, capabilities: session.capabilities, explanation, quiz, providers,
      async answer(choiceId, answerSignal) {
        if (!credential) throw new LearningError('UNAUTHORIZED', 'This session was closed. Reload the example.');
        const feedback = quizFeedbackSchema.parse(await request(`/api/challenges/${quiz.challenge.id}/attempts`, {
          ...ref, version: quiz.challenge.version, choiceId,
        }, credential, answerSignal));
        if (feedback.assessmentId !== ref.assessmentId || feedback.contextVersion !== ref.contextVersion || feedback.challengeId !== quiz.challenge.id) throw new LearningError('UNAVAILABLE', 'The feedback does not match this lesson.');
        return feedback;
      },
      async purchase(purchaseSignal) { return purchaseResultSchema.parse(await request('/api/purchases', { ...ref, itemId: 'ozone-theme', idempotencyKey: crypto.randomUUID() }, credential, purchaseSignal)); }, dispose,
    };
  } catch (error) { dispose(); throw error; }
}
