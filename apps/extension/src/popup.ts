import './style.css';
import { z } from 'zod';
declare const __COMPANION_ORIGIN__: string;
const status = document.querySelector<HTMLElement>('#status')!;
document.querySelector('#origin')!.textContent = `Companion: ${__COMPANION_ORIGIN__}`;
document.querySelector('#extension-origin')!.textContent = `Extension origin: ${new URL(chrome.runtime.getURL('/')).origin}`;
chrome.runtime.sendMessage({ operation: 'beacon.foundationStatus' }).then(response => {
  document.querySelector('#worker')!.textContent = response?.stage === 'foundation' ? 'Worker ready · controlled fixtures' : 'Worker status unavailable';
}).catch(() => { document.querySelector('#worker')!.textContent = 'Worker status unavailable'; });
document.querySelector<HTMLButtonElement>('#manual')!.onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) { status.textContent = 'Page access unavailable here. Open a regular HTTP(S) page and invoke the toolbar popup.'; return; }
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const parsed = z.object({ status: z.literal('fixture'), fixtureId: z.enum(['P01', 'P10', 'P16']), variant: z.enum(['baseline', 'safe', 'ambiguous']), title: z.string().max(2000) }).strict().safeParse(results[0]?.result);
    if (parsed.success) {
      const result = parsed.data;
      status.textContent = `Recognized controlled fixture: ${result.title}. Evidence is highlighted on the page. Open its owned lesson below.`;
      const handoff = document.querySelector<HTMLButtonElement>('#handoff')!; handoff.hidden = false;
      handoff.onclick = async () => {
        try {
          const granted = await chrome.permissions.request({ origins: [`${__COMPANION_ORIGIN__}/*`] });
          if (!granted) { status.textContent = 'Local connection permission denied. The on-page text remains available.'; return; }
          const reply = await chrome.runtime.sendMessage({ operation: 'beacon.fixtureHandoff', fixtureId: result.fixtureId, variant: result.variant });
          if (!reply?.url || !reply.url.startsWith(`${__COMPANION_ORIGIN__}/?fixture=`)) throw new Error('Unavailable');
          await chrome.tabs.create({ url: reply.url });
        } catch { status.textContent = 'Owned handoff unavailable. Add the exact extension origin shown below to BEACON_EXTENSION_ORIGINS and restart the API. You can still open the offline companion.'; }
      };
    } else status.textContent = `Temporary page access confirmed: ${new URL(tab.url).hostname}. No supported controlled fixture matched. No general verdict was made.`;
  } catch { status.textContent = 'Temporary access was not granted. Invoke Ozone Layer from the toolbar on an accessible HTTP(S) page and retry.'; }
};
document.querySelector<HTMLButtonElement>('#open')!.onclick = () => { void chrome.tabs.create({ url: __COMPANION_ORIGIN__ }); };
