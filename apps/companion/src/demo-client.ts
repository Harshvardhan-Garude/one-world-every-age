import { sessionViewSchema, structuredErrorSchema } from '@beacon/contracts';
export async function api(path: string, body?: unknown, credential?: string, signal?: AbortSignal) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', signal, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) { const error = structuredErrorSchema.safeParse(value); throw new Error(error.success ? error.data.message : 'The operation is unavailable. Continue with the local text example.'); }
  return value;
}
export async function openSession(mode: 'local-demo' | 'provider-test', persona: 'child' | 'teen' | 'adult', optIn = false) {
  const { credential, ...view } = await api('/api/onboarding/session', { mode, syntheticProfile: persona, jurisdiction: 'US-CA', optIns: { cloudAnalysis: optIn, spokenCoaching: optIn, memory: false } });
  if (typeof credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(credential)) throw new Error('The session could not be created.');
  try {
    const session = sessionViewSchema.parse(view);
    return { session, request: (path: string, body?: unknown, signal?: AbortSignal) => api(path, body, credential, signal), close: () => { void api('/api/onboarding/logout', {}, credential).catch(() => {}); } };
  } catch (e) { void api('/api/onboarding/logout', {}, credential).catch(() => {}); throw e; }
}
export type Client = Awaited<ReturnType<typeof openSession>>;
