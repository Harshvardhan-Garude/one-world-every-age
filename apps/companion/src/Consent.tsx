import React, { useState } from 'react';
import { openSession } from './demo-client';
export function Consent() {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); let client;
    try {
      client = await openSession('local-demo', 'adult');
      const before = await client.request('/api/onboarding/context', { contextVersion: client.session.contextVersion, optIns: { cloudAnalysis: true, spokenCoaching: false, memory: false } });
      const assessment = await client.request('/api/assessments', { contextVersion: before.contextVersion, fixtureId: 'P10', variant: 'baseline' });
      const after = await client.request('/api/onboarding/context', { contextVersion: before.contextVersion, optIns: { cloudAnalysis: false, spokenCoaching: false, memory: false } });
      let rejected = false;
      try { await client.request('/api/coaching/messages', { assessmentId: assessment.assessment.id, contextVersion: before.contextVersion }); } catch { rejected = true; }
      setMessage(`LOCAL DEMO consent transition: cloud analysis opt-in on → off. Server context ${before.contextVersion} → ${after.contextVersion}. ${rejected ? 'The old assessment was rejected.' : 'Unexpected result; stop the demonstration.'} Protected vendor permissions remain unavailable. This is a user opt-in change, not a verified jurisdiction or k-ID approval change. No provider was called.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Transition unavailable.'); }
    finally { client?.close(); setBusy(false); }
  }
  return <section className="demo-extra"><h2>See consent change safely</h2><p>This offline demonstration changes the user’s cloud-analysis opt-in and invalidates the old context. It makes no country-law claim.</p><button disabled={busy} onClick={() => void run()}>Demonstrate consent withdrawal</button><p role="status" data-testid="consent-result">{message}</p></section>;
}
