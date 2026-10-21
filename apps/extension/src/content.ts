// Injected only by a user-invoked activeTab action. No extraction, network or monitoring.
(() => {
  if (!['http:', 'https:'].includes(location.protocol)) return;
  const id = 'beacon-foundation-notice';
  if (document.getElementById(id)) return;
  const host = document.createElement('aside');
  host.id = id;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host{position:fixed;bottom:18px;right:18px;z-index:2147483647;max-width:min(340px,90vw)}section{font:14px/1.5 system-ui;background:#fffef5;color:#193d32;border:2px solid #66835c;border-radius:12px;padding:16px;box-shadow:0 8px 28px #0002}p{margin:8px 0}button{font:inherit;background:#193d32;color:white;border:0;border-radius:5px;padding:6px 12px;cursor:pointer}button:focus-visible{outline:3px solid #ac5c20;outline-offset:3px}';
  const panel = document.createElement('section');
  panel.setAttribute('role', 'status');
  const title = document.createElement('strong'); title.textContent = 'Beacon · Manual access confirmed';
  const text = document.createElement('p'); text.textContent = 'Foundation shell only. No page analysis, protection decision or recording has run.';
  const address = document.createElement('p'); address.textContent = `Actual tab hostname: ${location.hostname}`;
  const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss'; dismiss.onclick = () => host.remove();
  panel.append(title, text, address, dismiss); shadow.append(style, panel); document.documentElement.append(host);
})();
