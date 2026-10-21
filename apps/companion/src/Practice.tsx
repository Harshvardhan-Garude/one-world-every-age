import React, { useEffect, useRef, useState } from 'react';
import { curatedLessonSchema, learningResultSchema, progressSchema } from '@beacon/contracts';
import type { z } from 'zod';
import { openSession, type Client } from './demo-client';
const storageKey = 'ozone.progress.resume';
const readToken = () => { try { return localStorage.getItem(storageKey) ?? undefined; } catch { return undefined; } };
export function Practice() {
  const client = useRef<Client | null>(null), generation = useRef(0);
  const [catalog, setCatalog] = useState<z.infer<typeof curatedLessonSchema>[]>([]), [issued, setIssued] = useState<(z.infer<typeof curatedLessonSchema> & { runId: string }) | null>(null);
  const [progress, setProgress] = useState<z.infer<typeof progressSchema> | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState(''), [reason, setReason] = useState(''), [action, setAction] = useState('');
  useEffect(() => () => { generation.current++; client.current?.close(); }, []);
  async function initialize() {
    const id = ++generation.current; setBusy(true);
    let opened: Client | undefined;
    try {
      opened = await openSession('local-demo', 'adult');
      if (id !== generation.current) { opened.close(); return; }
      client.current = opened;
      const identity = await opened.request('/api/progress/identity', { ...(readToken() ? { token: readToken() } : {}) });
      const lessons = curatedLessonSchema.array().parse(await opened.request('/api/learning'));
      if (id !== generation.current) return;
      try { localStorage.setItem(storageKey, identity.token); } catch { /* memory-only progress still works */ }
      setProgress(progressSchema.parse(identity.progress)); setCatalog(lessons); setMessage('Choose a new challenge. The observation, reason and safe action all count. Feedback reveals the answer; retries then become practice only.');
    } catch (e) { opened?.close(); client.current = null; setMessage(e instanceof Error ? e.message : 'Practice unavailable.'); }
    finally { if (id === generation.current) setBusy(false); }
  }
  async function issue(id: string) {
    setBusy(true); setMessage('');
    try { const result = await client.current!.request(`/api/learning/${id}/issue`, {}); const lesson = curatedLessonSchema.parse({ challenge: result.challenge, reasons: result.reasons, actions: result.actions }); setIssued({ ...lesson, runId: result.runId }); setChoice(''); setReason(''); setAction(''); if (result.practiceOnly) setMessage('The answer was already revealed. This attempt is practice only.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Challenge unavailable.'); } finally { setBusy(false); }
  }
  async function submit(reveal = false) {
    if (!issued || !client.current) return; setBusy(true);
    try {
      if (reveal) { const result = await client.current.request(`/api/learning/${issued.runId}/reveal`, {}); setMessage(`${result.feedback} Answer revealed: practice only.`); }
      else {
        const result = learningResultSchema.parse(await client.current.request('/api/learning/attempts', { version: issued.challenge.version, credit_key: issued.challenge.credit_key, challengeId: issued.challenge.id, runId: issued.runId, choiceId: choice, reasonId: reason, actionId: action, interpretedChoiceConfirmed: true, idempotencyKey: crypto.randomUUID() }));
        setProgress(result.progress); setMessage(`${result.feedback} ${result.creditAwarded ? 'One mastery credit awarded.' : 'Practice only; no new credit.'}`);
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Answer unavailable.'); } finally { setBusy(false); }
  }
  return <section className="demo-extra" aria-labelledby="practice-title"><p className="eyebrow">CURATED CHALLENGES / FREE FOR EVERY AGE</p><h2 id="practice-title">Learning progress</h2><p>These new scenarios have private server rubrics. Live flags and the teaching quiz earn no credit. Badges have no monetary value.</p>
    {!progress ? <button disabled={busy} onClick={() => void initialize()}>Start curated practice</button> : <><p data-testid="progress">{progress.status} · {progress.credits} unique mastery credits · {progress.badges.join(', ') || 'No badges yet'}</p><p className="note">{progress.notice}</p><label>Choose a challenge<select aria-label="Curated challenge" value={issued?.challenge.id ?? ''} disabled={busy} onChange={e => void issue(e.target.value)}><option value="" disabled>Select a new scenario</option>{catalog.map(c => <option key={c.challenge.id} value={c.challenge.id}>{c.challenge.question}</option>)}</select></label>
      {issued && <><h3>{issued.challenge.question}</h3>{([['Observation', issued.challenge.choices, choice, setChoice], ['Reason', issued.reasons, reason, setReason], ['Safe action', issued.actions, action, setAction]] as const).map(([label, options, selected, setter]) => <label key={label}>{label}<select aria-label={label} value={selected} disabled={busy} onChange={e => setter(e.target.value)}><option value="" disabled>Choose one</option>{options.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select></label>)}<button disabled={busy || !choice || !reason || !action} onClick={() => void submit()}>Confirm and submit challenge</button><button disabled={busy} onClick={() => void submit(true)}>Reveal answer · practice only</button></>}
    </>}<p role="status" data-testid="practice-feedback">{message}</p>{progress && <button disabled={busy} onClick={async () => { try { setProgress(progressSchema.parse(await client.current!.request('/api/progress/reset', {}))); setIssued(null); setMessage('Learning progress reset on this local server. Anonymous progress can be reset; this is not identity-level anti-abuse.'); } catch { setMessage('Reset unavailable; progress was not changed.'); } }}>Reset learning progress</button>}<button onClick={() => { generation.current++; client.current?.close(); client.current = null; try { localStorage.removeItem(storageKey); } catch {} setProgress(null); setCatalog([]); setIssued(null); setBusy(false); setMessage('This browser forgot its anonymous progress token. Existing server progress is not an account or a new identity check.'); }}>Forget this browser’s progress</button>
  </section>;
}
