import './style.css';
declare const __COMPANION_ORIGIN__: string;
const status = document.querySelector<HTMLElement>('#status')!;
document.querySelector('#origin')!.textContent = `Companion: ${__COMPANION_ORIGIN__}`;
document.querySelector('#extension-origin')!.textContent = `Extension origin: ${new URL(chrome.runtime.getURL('/')).origin}`;
chrome.runtime.sendMessage({ operation: 'beacon.foundationStatus' }).then(response => {
  document.querySelector('#worker')!.textContent = response?.stage === 'foundation' ? 'Worker ready · detection not implemented' : 'Worker status unavailable';
}).catch(() => { document.querySelector('#worker')!.textContent = 'Worker status unavailable'; });
document.querySelector<HTMLButtonElement>('#manual')!.onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) { status.textContent = 'Page access unavailable here. Open a regular HTTP(S) page and invoke the toolbar popup.'; return; }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    status.textContent = `Temporary page access confirmed: ${new URL(tab.url).hostname}. No content analysis ran. See the local page notice.`;
  } catch { status.textContent = 'Temporary access was not granted. Invoke Beacon from the toolbar on an accessible HTTP(S) page and retry.'; }
};
document.querySelector<HTMLButtonElement>('#open')!.onclick = () => { void chrome.tabs.create({ url: __COMPANION_ORIGIN__ }); };
