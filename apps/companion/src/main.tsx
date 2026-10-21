import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { providerStatusSchema, type DemoRequest } from '@beacon/contracts';
import { providerStatuses } from '@beacon/fixtures';
import type { z } from 'zod';
import { KidRoot } from './kid';
import { LearningError, loadLesson, type Lesson } from './learning';
import './style.css';

const initial: DemoRequest = { mode: 'local-demo', persona: 'child', fixtureId: 'P01', variant: 'baseline' };
function App() {
  const [request, setRequest] = useState(initial);
  const [data, setData] = useState<Lesson | null>(null);
  const [providers, setProviders] = useState<z.infer<typeof providerStatusSchema>[]>([]);
  const [error, setError] = useState('');
  const [largeText, setLargeText] = useState(false);
  const [plainLanguage, setPlainLanguage] = useState(false);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const currentLesson = useRef<Lesson | null>(null);
  const answerController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let loaded: Lesson | undefined;
    setData(null); setSelected(''); setMessage(''); setError(''); setChecking(false);
    loadLesson(request, controller.signal).then(lesson => {
      loaded = lesson;
      if (controller.signal.aborted) { lesson.dispose(); return; }
      currentLesson.current = lesson;
      setData(lesson);
      setProviders([...lesson.providers, ...providerStatuses.filter(p => !lesson.providers.some(current => current.provider === p.provider))]);
    }).catch(() => { if (!controller.signal.aborted) setError('The local teaching flow could not load. Start the API and reload this example.'); });
    return () => { controller.abort(); answerController.current?.abort(); loaded?.dispose(); if (currentLesson.current === loaded) currentLesson.current = null; };
  }, [request]);
  async function checkAnswer() {
    if (!data || !selected || checking) return;
    const lesson = data, controller = new AbortController(); answerController.current = controller;
    setChecking(true); setMessage('');
    try {
      const feedback = await lesson.answer(selected, controller.signal);
      if (!controller.signal.aborted && currentLesson.current === lesson) setMessage(`${feedback.feedback} Server-checked local-demo practice. No mastery credit was awarded.`);
    } catch (cause) {
      if (!controller.signal.aborted && currentLesson.current === lesson) {
        setMessage('Your answer could not be checked. Reload the example before trying again.');
        if (cause instanceof LearningError && ['UNAUTHORIZED', 'CONFLICT', 'NOT_FOUND'].includes(cause.code)) { lesson.dispose(); currentLesson.current = null; setData(null); setError('The session or assessment expired or changed. Reload this example.'); }
      }
    } finally { if (answerController.current === controller) { setChecking(false); answerController.current = null; } }
  }
  async function reset() {
    try {
      const response = await fetch('/api/demo');
      if (!response.ok) throw new Error('catalog unavailable');
      setProviders(providerStatusSchema.array().parse((await response.json()).providers));
      setRequest({ ...initial }); setLargeText(false); setPlainLanguage(false); setMessage('Demo reset. No learning progress or browsing history is stored by this foundation.');
    } catch { setError('The API is unavailable; no reset was performed.'); }
  }
  return <div className={largeText ? 'app large' : 'app'}>
    <a className="skip" href="#finding">Skip to evidence</a>
    <header><a className="brand" href="/" aria-label="Ozone Layer home"><span className="brand-mark" aria-hidden="true">◈</span> Ozone Layer<span className="brand-note">ONE WORLD, EVERY AGE</span></a><span className="tag">Foundation / local demo</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">A LITTLE PAUSE. A CLEARER CHOICE.</p><h1>Learn to notice.<br/><span>Choose with care.</span></h1><p className="lede">Explore a message, look at the evidence, and take a safer next step. Your pace. Your choice.</p></div><aside className="stage"><span className="stage-icon" aria-hidden="true">↗</span><h2>A local teaching demo</h2><p>Scripted examples and server-checked practice. No live scanning, verified k-ID approval, Gemini reasoning or vendor speech in this flow.</p><span className="small-tag">No background monitoring</span></aside></section>
      <section className="demo-controls" aria-label="Demo context"><div><label htmlFor="persona">Synthetic demo context</label><select id="persona" value={request.persona} onChange={e => setRequest({ ...request, persona: e.target.value as DemoRequest['persona'] })}><option value="child">Child</option><option value="teen">Teen</option><option value="adult">Adult</option></select><p>No real identity or age verification. All contexts can explore both examples.</p></div><div className="preferences"><label><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)}/> Larger text</label><label><input type="checkbox" checked={plainLanguage} onChange={e => setPlainLanguage(e.target.checked)}/> Plain language</label><p>Presentation preferences for every age, including older adults.</p></div></section>
      <div className="workspace"><section className="finding" id="finding" tabIndex={-1}>
        <div className="section-top"><p className="eyebrow">01 / EXPLORE THE EVIDENCE</p><span className="tag subtle">Fixture, not a live finding</span></div>
        <nav className="tabs" aria-label="Example"><button aria-pressed={request.fixtureId === 'P01'} onClick={() => setRequest({ ...request, fixtureId: 'P01' })}>P01 · Game reward</button><button aria-pressed={request.fixtureId === 'P16'} onClick={() => setRequest({ ...request, fixtureId: 'P16' })}>P16 · Learning page</button></nav>
        <label className="variant">Example variant<select value={request.variant} onChange={e => setRequest({ ...request, variant: e.target.value as DemoRequest['variant'] })}><option value="baseline">Baseline</option><option value="safe">Safe / educational comparison</option><option value="ambiguous">Not enough evidence</option></select></label>
        {error ? <div><p role="alert" className="error">{error}</p><button onClick={() => setRequest({ ...request })}>Reload example</button></div> : !data ? <p role="status">Loading the pre-authored example…</p> : <>
          <p className="state">{data.assessment.state === 'concern-found' ? '⚑ Concern in this fixture' : data.assessment.state === 'inconclusive' ? '? Not enough evidence' : 'No supported indicators in this fixture'}</p>
          <h2 data-testid="fixture-title">{data.fixture.title}</h2><blockquote>{data.fixture.text}</blockquote>
          <div className="evidence"><h3>What we can observe</h3>{data.assessment.evidence.map(e => <div key={e.id}><p className="evidence-label">{e.observation}</p><p>{e.excerpt}</p></div>)}</div>
          <h3>What it means</h3><p>{plainLanguage ? (request.fixtureId === 'P01' && request.variant === 'baseline' ? 'Keep your password and sign-in codes private. A familiar name or logo does not prove who runs a page.' : 'Look at the whole message. There may not be enough evidence to judge it.') : data.explanation.reply.explanation}</p>
          <p className="note">{data.explanation.notice}</p>
          <div className="safe-action"><span aria-hidden="true">↗</span><div><h3>A safer next step</h3><p>{data.assessment.safeActions[0]}</p></div></div><p className="note">{data.assessment.uncertainty}</p>
          <a className="text-link" href={`/fixtures/${request.fixtureId}?variant=${request.variant}`} target="_blank" rel="noreferrer">Open controlled local fixture ↗</a>
        </>}
      </section><aside className="side-column"><section className="lesson"><p className="eyebrow">02 / TRY A DIFFERENT LENS</p><h2>A small moment<br/>to practice.</h2><p>{data?.quiz.challenge.question ?? 'Loading the curated question…'}</p><fieldset disabled={!data || checking}><legend>Choose an observation</legend>{data?.quiz.challenge.choices.map(choice => <label key={choice.id} className="choice"><input type="radio" name="clue" value={choice.id} checked={selected === choice.id} onChange={() => { setSelected(choice.id); setMessage(''); }}/>{choice.text}</label>)}</fieldset><button className="primary" disabled={!data || !selected || checking} onClick={() => void checkAnswer()}>{checking ? 'Checking…' : 'Check my answer'} <span aria-hidden="true">→</span></button><p role="status" className="note" data-testid="teaching-feedback">{message || 'Curated local-demo practice · no mastery credit'}</p></section><section className="voice-note"><h3>Text comes first.</h3><p>Voice is unavailable in this offline flow. Nothing is recording or listening. You can explore every example through text.</p></section></aside></div>
      <section className="status-panel"><div><p className="eyebrow">03 / KNOW WHAT IS AVAILABLE</p><h2>Clear about our capabilities.</h2><p>All protected capabilities are unknown. This local demo cannot authorize production features.</p></div><ul>{providers.map(p => <li key={p.provider}><strong>{p.provider}</strong><span>{p.status}</span></li>)}</ul><details><summary>Inspect demo permission states</summary><ul>{data && Object.entries(data.capabilities.decisions).map(([name, d]) => <li key={name}><span>{name.replaceAll('_', ' ')}</span><span>{d.state} · {d.provenance}</span></li>)}</ul></details></section>
      <section className="handoff"><p><strong>Room for every age.</strong> P01/P16 baseline fixtures are ready to explore. The other 16 scenario families remain planned; this is not a completed protection product.</p><button onClick={reset}>Reset demo</button></section>
    </main><footer><span>Ozone Layer / a thoughtful first step</span><span>Local demo · no provider calls · no stored browsing history</span></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><KidRoot><App/></KidRoot></React.StrictMode>);
