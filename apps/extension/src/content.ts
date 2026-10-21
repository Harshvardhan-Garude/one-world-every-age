import { recognizeControlledFixture } from '@beacon/fixtures';
// Runs only after a toolbar action. No forms, editable fields, hidden text or
// arbitrary browsing content are submitted. No cloud request occurs here.
(() => {
  if (!['http:', 'https:'].includes(location.protocol)) return { status: 'unsupported' };
  const id = 'beacon-foundation-notice';
  const article = document.querySelector<HTMLElement>('article[data-ozone-fixture]');
  const visible = (node: Element | null): node is HTMLElement => !!node && !node.closest('input,textarea,select,form,[contenteditable], [hidden],[aria-hidden="true"],#beacon-foundation-notice') && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && node.getClientRects().length > 0;
  const text = article?.querySelector('[data-fixture-text]'), destination = article?.querySelector('[data-fixture-destination]');
  const fixture = visible(article) && visible(text ?? null) && visible(destination ?? null) ? recognizeControlledFixture({ actualUrl: location.href, fixtureId: article.dataset.ozoneFixture ?? '', variant: article.dataset.variant ?? '', visibleText: (text as HTMLElement).innerText.slice(0, 10001), destination: (destination as HTMLElement).innerText.slice(0, 2049) }) : null;
  document.getElementById(id)?.remove();
  const host = document.createElement('aside'); host.id = id;
  const shadow = host.attachShadow({ mode: 'open' }), style = document.createElement('style');
  style.textContent = ':host{position:fixed;bottom:18px;right:18px;z-index:2147483647;max-width:min(390px,90vw)}section{font:15px/1.5 system-ui;background:#fffef5;color:#193d32;border:2px solid #66835c;border-radius:12px;padding:16px;box-shadow:0 8px 28px #0002}p{margin:8px 0;overflow-wrap:anywhere}button{font:inherit;background:#193d32;color:white;border:0;border-radius:5px;padding:8px 12px;cursor:pointer}button:focus-visible{outline:3px solid #ac5c20;outline-offset:3px}';
  const panel = document.createElement('section'); panel.setAttribute('role', 'status');
  const title = document.createElement('strong'); title.textContent = fixture ? `Ozone Layer · ${fixture.expectedState === 'concern-found' ? 'Concern in controlled fixture' : fixture.expectedState === 'inconclusive' ? 'Not enough evidence' : 'No supported indicators in fixture'}` : 'Ozone Layer · Manual access confirmed';
  const explanation = document.createElement('p'); explanation.textContent = fixture ? fixture.explanation : 'This page is outside the supported controlled fixtures. No general page verdict was made. Nothing is recording.';
  const address = document.createElement('p'); address.textContent = `Actual tab hostname: ${location.hostname}${fixture ? `. Illustrative destination: ${fixture.illustrativeUrl}` : ''}`;
  const action = document.createElement('p'); action.textContent = fixture ? fixture.safeAction : 'Use the companion’s labelled examples to practice.';
  const provenance = document.createElement('p'); provenance.textContent = 'Local demo · fixture recognition, not real k-ID verification or live AI analysis.';
  const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss'; dismiss.onclick = () => host.remove();
  panel.append(title, explanation, address, action, provenance, dismiss); shadow.append(style, panel); document.documentElement.append(host);
  if (fixture) { destination?.setAttribute('style', 'background:#fff0a6;color:#182d28'); return { status: 'fixture', fixtureId: fixture.id, variant: fixture.variant, title: fixture.title }; }
  return { status: 'unsupported' };
})();
