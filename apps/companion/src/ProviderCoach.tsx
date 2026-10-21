import React, { useEffect, useRef, useState } from 'react';
import { coachingResponseSchema, ownedAssessmentResponseSchema, purchaseResultSchema, sessionViewSchema, voiceResultSchema, type DemoRequest } from '@beacon/contracts';
import { openSession, type Client } from './demo-client';

type Session = ReturnType<typeof sessionViewSchema.parse>;
export function ProviderCoach({ fixtureId, variant }: Pick<DemoRequest, 'fixtureId' | 'variant'>) {
  const client = useRef<Client | null>(null), generation = useRef(0), turn = useRef<string | null>(null), recording = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null), pending = useRef<AbortController | null>(null), player = useRef<HTMLAudioElement | null>(null), audioUrl = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null), [assessmentId, setAssessment] = useState(''), [consent, setConsent] = useState(false), [message, setMessage] = useState(''), [captions, setCaptions] = useState(''), [busy, setBusy] = useState(false), [stage, setStage] = useState('idle'), [question, setQuestion] = useState('What is the safer way to check this fictional message?'), [checkout, setCheckout] = useState('');
  function halt() {
    generation.current++; pending.current?.abort(); pending.current = null;
    if (timer.current) clearTimeout(timer.current); timer.current = null;
    if (recording.current && recording.current.state !== 'inactive') { recording.current.onstop = null; recording.current.stop(); }
    recording.current = null; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    player.current?.pause(); player.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); audioUrl.current = null;
    const id = turn.current; turn.current = null;
    if (id && client.current) void client.current.request(`/api/voice/turns/${id}/cancel`, {}).catch(() => {});
  }
  useEffect(() => () => { halt(); client.current?.close(); client.current = null; }, []);
  const stop = () => { halt(); setBusy(false); setStage('stopped'); setMessage('Stopped. Microphone and playback are off. Late responses are discarded. Text is still available.'); };
  async function context(ready: Session, current: Client) {
    setSession(ready);
    const owned = ownedAssessmentResponseSchema.parse(await current.request('/api/assessments', { contextVersion: ready.contextVersion, fixtureId, variant }));
    setAssessment(owned.assessment.id);
  }
  async function connect() {
    halt(); client.current?.close(); setBusy(true); setCheckout(''); setAssessment(''); const id = generation.current;
    try {
      const current = await openSession('provider-test', 'adult', consent);
      if (id !== generation.current) { current.close(); return; } client.current = current;
      await context(current.session, current); setMessage(`Server-owned CDK Test Mode session: ${current.session.onboardingState}. AI mapping ${current.session.provider.mappingConfirmed ? 'confirmed' : 'unconfirmed'}. This is independent of the optional browser widget.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Provider test unavailable.'); } finally { if (id === generation.current) setBusy(false); }
  }
  async function refresh() {
    if (!client.current || !session) return; halt(); setBusy(true); const id = generation.current;
    try { const { changed: _, ...view } = await client.current.request('/api/onboarding/refresh', { contextVersion: session.contextVersion }); await context(sessionViewSchema.parse(view), client.current); setMessage('Permissions refreshed from the bound provider session; a current owned assessment was created.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Permission refresh unavailable.'); setAssessment(''); }
    finally { if (id === generation.current) setBusy(false); }
  }
  async function ask() {
    if (!client.current || !session) return; halt(); const id = generation.current, controller = new AbortController(); pending.current = controller; setBusy(true); setCaptions('');
    try { const result = coachingResponseSchema.parse(await client.current.request('/api/coaching/questions', { assessmentId, contextVersion: session.contextVersion, question }, controller.signal)); if (id === generation.current) { setCaptions(result.reply.explanation); setMessage(result.notice); } }
    catch (e) { if (id === generation.current) setMessage(e instanceof Error ? e.message : 'Question unavailable. Use the scripted evidence above.'); } finally { if (id === generation.current) setBusy(false); }
  }
  async function talk() {
    if (!client.current || !session || !consent || busy) return;
    halt(); const id = generation.current, controller = new AbortController(); pending.current = controller; setBusy(true); setCaptions(''); setStage('checking permission');
    try {
      // Server permission/configuration is checked BEFORE a browser mic prompt.
      const started = await client.current.request('/api/voice/turns', { assessmentId, contextVersion: session.contextVersion, adultPresenterConsent: true }, controller.signal);
      if (id !== generation.current) return; turn.current = started.turnId;
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. Use text.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (id !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('No supported recorder format. Use the text question.');
      const recorder = new MediaRecorder(media, { mimeType: mime }), chunks: Blob[] = []; let size = 0;
      recording.current = recorder;
      recorder.ondataavailable = event => { if (id !== generation.current) return; size += event.data.size; if (size > 2 * 1024 * 1024) { stop(); setMessage('Recording exceeded 2 MiB and was discarded. Use text.'); } else chunks.push(event.data); };
      recorder.onerror = () => { stop(); setMessage('The microphone recording failed. Continue with text.'); };
      recorder.onstop = async () => {
        media.getTracks().forEach(t => t.stop()); stream.current = null;
        if (timer.current) clearTimeout(timer.current); timer.current = null;
        if (id !== generation.current || !turn.current || !client.current) return;
        if (!chunks.length) { stop(); setMessage('No audio was captured. Continue with the text question.'); return; }
        setStage('redacting → reasoning → preparing speech');
        try {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); chunks.length = 0;
          let binary = ''; for (const value of bytes) binary += String.fromCharCode(value); bytes.fill(0);
          const response = voiceResultSchema.parse(await client.current.request(`/api/voice/turns/${turn.current}`, { contextVersion: session.contextVersion, mimeType: mime.split(';')[0], durationMs: Math.max(1, Math.min(15000, Math.round(performance.now() - began))), audioBase64: btoa(binary) }, controller.signal)); binary = '';
          if (id !== generation.current) return; turn.current = null;
          setCaptions(response.reply.spokenText); setMessage(response.speechUnavailable ?? response.notice);
          if (response.audioBase64) {
            const audio = Uint8Array.from(atob(response.audioBase64), c => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([audio], { type: 'audio/mpeg' })); audioUrl.current = url;
            const output = new Audio(url); player.current = output; setStage('speaking');
            output.onerror = () => { if (id === generation.current) { setStage('text fallback'); setBusy(false); setMessage('Audio could not play. Read the matching captions.'); } URL.revokeObjectURL(url); if (audioUrl.current === url) audioUrl.current = null; };
            output.onended = () => { if (id === generation.current) { setStage('ready'); setBusy(false); } URL.revokeObjectURL(url); if (audioUrl.current === url) audioUrl.current = null; };
            try { await output.play(); } catch { setStage('text fallback'); setBusy(false); setMessage('Playback was unavailable. Read the matching captions.'); }
          } else { setStage('text fallback'); setBusy(false); }
        } catch (e) { if (id === generation.current) { stop(); setMessage(e instanceof Error ? e.message : 'Voice failed. Continue with the local text explanation.'); } }
      };
      const began = performance.now(); recorder.start(250); setStage('recording'); setMessage('Recording only this explicit adult-presenter question. Send within 15 seconds, or Stop to discard.');
      timer.current = setTimeout(() => { if (id === generation.current && recorder.state !== 'inactive') recorder.stop(); }, 15000);
    } catch (e) {
      if (id === generation.current) { stop(); setMessage(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Microphone access denied. Nothing is recording. Use the text question or scripted explanation.' : e instanceof Error ? e.message : 'Voice unavailable. Use text.'); }
    }
  }
  async function purchase() {
    if (!session || !client.current) return; setBusy(true); setCheckout('');
    try { const result = purchaseResultSchema.parse(await client.current.request('/api/purchases', { assessmentId, contextVersion: session.contextVersion, itemId: 'ozone-theme', idempotencyKey: crypto.randomUUID() })); setMessage(result.reason); if (result.state === 'checkout_ready' && result.checkoutUrl) setCheckout(result.checkoutUrl); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Checkout unavailable.'); } finally { setBusy(false); }
  }
  return <section className="demo-extra provider-coach"><p className="eyebrow">SEPARATE PROVIDER TEST / SYNTHETIC EVIDENCE</p><h2>Ask about this evidence</h2><p>The offline lesson above always works. This panel uses a separate server-created k-ID CDK Test Mode session. A browser widget pass or a Gemini connectivity check grants no application access.</p>
    <label><input type="checkbox" checked={consent} disabled={!!session || busy} onChange={e => setConsent(e.target.checked)}/> I am a consenting adult presenter. Enable cloud analysis and spoken coaching for fictional test questions.</label>
    <button disabled={busy} onClick={() => void connect()}>Start server-owned provider test</button>{session && <><p>{session.onboardingState} · context {session.contextVersion} · mapping {session.provider.mappingConfirmed ? 'confirmed' : 'unconfirmed'}</p>{session.challenge && <a href={session.challenge.url} target="_blank" rel="noreferrer">Open genuine k-ID Test Mode challenge</a>}<button disabled={busy} onClick={() => void refresh()}>Refresh provider permissions</button>
      <label>Fictional text question<input value={question} maxLength={2000} onChange={e => setQuestion(e.target.value)}/></label><button disabled={busy || !assessmentId || !question.trim()} onClick={() => void ask()}>Ask using text</button><button disabled={busy || !assessmentId || !consent} onClick={() => void talk()}>Talk</button><button disabled={stage !== 'recording'} onClick={() => recording.current?.stop()}>Send voice question</button><button onClick={stop}>Stop</button><p role="status">Voice: {stage}. No background listening.</p>
      <button disabled={busy || !assessmentId} onClick={() => void purchase()}>Request optional Ozone theme · $1 sandbox</button>{checkout && <a href={checkout} target="_blank" rel="noreferrer">Open eligible adult hosted test checkout</a>}
    </>}<p role="status" data-testid="provider-message">{message}</p>{captions && <p className="captions" aria-label="Coach captions">{captions}</p>}<p className="note">Parent-approved saved-method purchases remain blocked until W14 prerequisites are verified. The optional theme never unlocks protection, lessons or badges.</p>
  </section>;
}
