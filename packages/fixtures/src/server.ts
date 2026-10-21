import { serverRubricSchema } from '@beacon/contracts/server';

// Not exported under a browser condition. Never send this module in an API response.
export const baselineRubric = serverRubricSchema.parse({
  challengeId: 'address-and-request', version: 1, credit_key: 'credential-evidence-01',
  correctChoiceId: 'address-request', requiredReasonId: 'inspect-actual-request', requiredActionId: 'use-independent-channel',
});
