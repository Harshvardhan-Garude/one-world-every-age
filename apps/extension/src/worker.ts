import { z } from 'zod';
import { ownedAssessmentResponseSchema, sessionViewSchema } from '@beacon/contracts';
declare const __COMPANION_ORIGIN__: string;
const requestSchema = z.object({ operation: z.literal('beacon.fixtureHandoff'), fixtureId: z.enum(['P01', 'P10', 'P16']), variant: z.enum(['baseline', 'safe', 'ambiguous']) }).strict();
async function handoff(input: z.infer<typeof requestSchema>) {
  const post = async (path: string, body: unknown, credential?: string) => {
    const response = await fetch(`${__COMPANION_ORIGIN__}${path}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('The API connection or extension CORS allowlist is unavailable.'); return response.json();
  };
  // storage.session survives worker suspension but is not persisted to disk.
  const previous = (await chrome.storage.session.get('beacon.fixtureSession'))["beacon.fixtureSession"];
  if (typeof previous === 'string') void post('/api/onboarding/logout', {}, previous).catch(() => {});
  const { credential, ...view } = await post('/api/onboarding/session', { mode: 'local-demo', syntheticProfile: input.fixtureId === 'P10' ? 'adult' : 'child', jurisdiction: 'US-CA', optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } });
  if (typeof credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(credential)) throw new Error('No application session.');
  try {
    const session = sessionViewSchema.parse(view);
    if (session.mode !== 'local-demo') throw new Error('Wrong mode.');
    await chrome.storage.session.set({ 'beacon.fixtureSession': credential });
    const owned = ownedAssessmentResponseSchema.parse(await post('/api/assessments', { fixtureId: input.fixtureId, variant: input.variant, contextVersion: session.contextVersion }, credential));
    const result = z.object({ ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).passthrough().parse(await post('/api/handoffs', { assessmentId: owned.assessment.id, contextVersion: session.contextVersion }, credential));
    return { url: `${__COMPANION_ORIGIN__}/?fixture=${input.fixtureId}&variant=${input.variant}#handoff=${result.ticket}` };
  } catch { await chrome.storage.session.remove('beacon.fixtureSession'); void post('/api/onboarding/logout', {}, credential).catch(() => {}); throw new Error('Fixture handoff unavailable. Configure the exact extension origin and retry.'); }
}
let busy = false;
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  if (typeof message === 'object' && message !== null && Object.keys(message).length === 1 && 'operation' in message && message.operation === 'beacon.foundationStatus') { sendResponse({ stage: 'foundation', detection: 'controlled fixtures', voice: 'not configured' }); return false; }
  const parsed = requestSchema.safeParse(message); if (!parsed.success) return false;
  if (busy) { sendResponse({ error: 'A handoff is already in progress.' }); return false; }
  busy = true;
  void handoff(parsed.data).then(sendResponse, () => sendResponse({ error: 'Handoff unavailable. Add this extension origin to BEACON_EXTENSION_ORIGINS, restart the API and grant local companion access. Offline fixture links still work.' })).finally(() => { busy = false; });
  return true;
});
