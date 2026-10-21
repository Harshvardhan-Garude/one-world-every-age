chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || typeof message !== 'object' || message === null || Object.keys(message).length !== 1 || !('operation' in message) || message.operation !== 'beacon.foundationStatus') return false;
  sendResponse({ stage: 'foundation', detection: 'not implemented', voice: 'not configured' });
  return false;
});
