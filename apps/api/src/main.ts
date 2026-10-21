import { mkdirSync } from 'node:fs';
import { BackendService } from './backend.js';
import { ProgressStore } from './progress.js';
import { createApp } from './server.js';

const port = Number(process.env.API_PORT ?? 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('API_PORT must be an unprivileged port');
mkdirSync('.local', { recursive: true, mode: 0o700 });
const backend = new BackendService({ progress: new ProgressStore(process.env.BEACON_PROGRESS_PATH ?? '.local/progress.sqlite') });
const app = createApp({ backend, companionOrigin: process.env.BEACON_COMPANION_ORIGIN, extensionOrigins: process.env.BEACON_EXTENSION_ORIGINS?.split(',').filter(Boolean), audit: event => console.info(JSON.stringify(event)) });
app.requestTimeout = 10_000;
app.headersTimeout = 10_000;
app.listen(port, '127.0.0.1', () => console.log(`Ozone Layer API (public fixtures and local sessions): http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { app.close(); app.closeAllConnections(); });
