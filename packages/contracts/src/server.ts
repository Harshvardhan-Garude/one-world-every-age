import { z } from 'zod';
import { idSchema } from './index.js';

// Server condition only; neither this schema nor answer data belongs in a browser bundle.
export const serverRubricSchema = z.object({ challengeId: idSchema, version: z.number().int().positive(), credit_key: idSchema, correctChoiceId: idSchema, requiredReasonId: idSchema, requiredActionId: idSchema }).strict();
