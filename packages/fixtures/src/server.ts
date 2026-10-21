import { serverRubricSchema } from '@beacon/contracts/server';
import { publicChallengeSchema } from '@beacon/contracts';
import { baselineChallenge } from './index.js';

// Not exported under a browser condition. Never send this module in an API response.
export const baselineRubric = serverRubricSchema.parse({
  challengeId: 'address-and-request', version: 1, credit_key: 'credential-evidence-01',
  correctChoiceId: 'address-request', requiredReasonId: 'inspect-actual-request', requiredActionId: 'use-independent-channel',
});

// Short unscored practice. Answer keys and feedback stay in the node-only export.
// Full independence/credit/idempotent award rules remain W09 work.
export function fixtureLesson(fixtureId: 'P01' | 'P10' | 'P16') {
  if (fixtureId === 'P10') return {
    challenge: publicChallengeSchema.parse({ ...baselineChallenge, id: 'toll-address-and-request', credit_key: 'toll-teaching-01', category: 'financial', question: 'What should Susan inspect before paying a message about a toll?', choices: [{ id: 'address-request', text: 'The actual destination, deadline and payment request together' }, { id: 'logo', text: 'Only the displayed service name' }, { id: 'color', text: 'Only the colors in the email' }] }),
    correctChoiceId: 'address-request', teaching: 'The displayed name does not verify the destination. A short deadline and request for card details deserve a pause. Check through a known app, saved address or a number on a genuine statement; this fixture cannot establish whether a toll is owed.',
  };
  if (fixtureId === 'P01') return {
    challenge: baselineChallenge, correctChoiceId: baselineRubric.correctChoiceId,
    teaching: 'Look at the actual address and request together. A logo or page color does not establish who runs a page. Keep passwords and sign-in codes private and use an independently known channel.',
  };
  return {
    challenge: publicChallengeSchema.parse({
      id: 'context-before-keywords', version: 1, credit_key: 'context-evidence-01', category: 'judgment',
      question: 'How should you judge a page that discusses a suspicious message?',
      choices: [
        { id: 'keywords-only', text: 'Treat any mention of a password as proof of a threat' },
        { id: 'actual-context', text: 'Read the context and check what the page actually asks me to do' },
        { id: 'familiar-style', text: 'Trust the page if its style looks familiar' },
      ],
    }),
    correctChoiceId: 'actual-context',
    teaching: 'A lesson can quote a risky request without making that request. Read the surrounding context and actual request. Missing details call for an independent check, not an accusation or a guarantee of safety.',
  };
}
