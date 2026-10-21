// Explicit operator-run connectivity diagnostic. This never constructs a fake
// ProviderContext, starts an application session or authorizes an app feature.
// Run with Node --env-file pointing at the existing local file; do not copy it.
import { parseRedaction } from '../apps/api/src/modulate.ts';
const report = event => console.log(JSON.stringify({ diagnosticOnly: true, applicationAuthorization: 'unverified', ...event }));
async function bounded(url, init = {}) {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) { void response.body?.cancel(); return { status: response.status }; }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 3 * 1024 * 1024) throw new Error('Response too large');
  return { status: response.status, response: new Response(bytes, { headers: response.headers }) };
}
let syntheticAudio;
if (process.env.KID_API_KEY && !process.env.KID_API_KEY.startsWith('kgp_')) {
  try { const r = await bounded('https://game-api.test.k-id.com/api/v1/age-gate/get-requirements?jurisdiction=US-CA', { headers: { Authorization: `Bearer ${process.env.KID_API_KEY}` } }); const data = r.response ? await r.response.json() : null; report({ provider: 'k-ID', stage: 'read-only-test-requirements', httpStatus: r.status, requirementsParsed: typeof data?.shouldDisplay === 'boolean' && Array.isArray(data?.approvedAgeCollectionMethods), sessionApproval: 'not tested', mapping: 'unconfirmed' }); } catch { report({ provider: 'k-ID', result: 'network, deadline or response failure' }); }
} else report({ provider: 'k-ID', result: 'not configured with a server key' });
if (process.env.INWORLD_API_KEY) {
  try {
    const headers = { Authorization: `Basic ${process.env.INWORLD_API_KEY}` };
    const r = await bounded('https://api.inworld.ai/voices/v1/voices?pageSize=20&filter=source%3D%22SYSTEM%22', { headers });
    const data = r.response ? await r.response.json() : null;
    const voice = data?.voices?.find(v => typeof v.voiceId === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(v.voiceId));
    report({ provider: 'Inworld', stage: 'system-voice-list', httpStatus: r.status, responseParsed: Array.isArray(data?.voices), voiceAvailable: !!voice });
    if (voice) {
      // Explicit official model for this one diagnostic only; no env is changed.
      const model = process.env.INWORLD_MODEL_ID || 'inworld-tts-2';
      const speech = await bounded('https://api.inworld.ai/tts/v1/voice', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Fictional test. Susan Example asks: how can I independently check this toll message?', voiceId: process.env.INWORLD_VOICE_ID || voice.voiceId, modelId: model, audioConfig: { audioEncoding: 'MP3' } }) });
      const result = speech.response ? await speech.response.json() : null;
      const audio = typeof result?.audioContent === 'string' ? Buffer.from(result.audioContent, 'base64') : null;
      const valid = !!audio?.length && audio.length < 2 * 1024 * 1024 && audio.toString('base64') === result.audioContent;
      report({ provider: 'Inworld', stage: 'fixed-fictional-tts', httpStatus: speech.status, responseParsed: valid, diagnosticModel: model, diagnosticVoice: process.env.INWORLD_VOICE_ID || voice.voiceId, configurationWritten: false, playbackVerified: false });
      if (valid) syntheticAudio = audio;
    }
  } catch { report({ provider: 'Inworld', result: 'network, deadline or response failure' }); }
} else report({ provider: 'Inworld', result: 'not configured' });
if (process.env.MODULATE_API_KEY && syntheticAudio) {
  try {
    const form = new FormData(); form.set('upload_file', new Blob([syntheticAudio], { type: 'audio/mpeg' }), 'fictional.mp3'); form.set('speaker_diarization', 'true'); form.set('language', 'en');
    const r = await bounded('https://platform.modulate.ai/api/velma-2-pii-phi-redaction-batch', { method: 'POST', headers: { 'X-API-Key': process.env.MODULATE_API_KEY }, body: form });
    let parsed = false; if (r.response) { try { await parseRedaction(r.response, AbortSignal.timeout(3000)); parsed = true; } catch {} }
    report({ provider: 'Modulate', stage: 'synthetic-tts-redaction', httpStatus: r.status, multipartParsed: parsed, redactionAccuracy: 'not established by this short diagnostic', retention: 'unconfirmed', sentToGemini: false });
  } catch { report({ provider: 'Modulate', result: 'network, deadline or response failure', sentToGemini: false }); }
} else report({ provider: 'Modulate', result: process.env.MODULATE_API_KEY ? 'synthetic audio unavailable; skipped' : 'not configured' });
syntheticAudio?.fill(0);
if (process.env.FASTSPRING_API_USERNAME && process.env.FASTSPRING_API_PASSWORD) {
  try {
    const r = await bounded('https://api.fastspring.com/products', { headers: { Authorization: `Basic ${Buffer.from(`${process.env.FASTSPRING_API_USERNAME}:${process.env.FASTSPRING_API_PASSWORD}`).toString('base64')}`, 'User-Agent': 'OzoneLayer-Demo-Diagnostic/0.1', 'Content-Type': 'application/json' } });
    const data = r.response ? await r.response.json() : null;
    report({ provider: 'FastSpring', stage: 'read-only-catalog', httpStatus: r.status, responseParsed: Array.isArray(data?.products), checkoutCalls: 0, chargeCalls: 0, orderCreated: false });
  } catch { report({ provider: 'FastSpring', result: 'network, deadline or response failure', checkoutCalls: 0, chargeCalls: 0 }); }
} else report({ provider: 'FastSpring', result: 'not configured' });
report({ provider: 'Gemini', result: 'historical successful diagnostic preserved; no repeat call or model change' });
