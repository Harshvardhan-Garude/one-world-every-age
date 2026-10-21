import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const origin = new URL(process.env.BEACON_COMPANION_ORIGIN ?? 'http://127.0.0.1:5173');
if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname) || origin.href !== `${origin.origin}/`) throw new Error('Use a loopback HTTP companion origin');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const manifest = {
  manifest_version: 3, name: 'Ozone Layer · Demo', version: '0.1.0',
  description: 'Ozone Layer controlled-fixture detection, evidence and owned companion lessons. Local demo only.',
  permissions: ['activeTab', 'scripting', 'storage'],
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  action: { default_popup: 'popup.html', default_title: 'Open Ozone Layer' },
  background: { service_worker: 'worker.js', type: 'module' },
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const watchers = [];
for (const entry of ['popup', 'worker', 'content']) {
  const result = await build({
    root, configFile: false, publicDir: false, define: { __COMPANION_ORIGIN__: JSON.stringify(origin.origin) },
    build: {
      outDir, emptyOutDir: false, target: 'es2022', minify: false, watch: watch ? {} : null,
      ...(entry === 'popup' ? { rollupOptions: { input: path.join(root, 'popup.html') } } : {
        lib: { entry: path.join(root, `src/${entry}.ts`), formats: [entry === 'content' ? 'iife' : 'es'], name: 'BeaconFoundation', fileName: () => `${entry}.js` },
        rollupOptions: { output: { inlineDynamicImports: true } },
      }),
    },
  });
  if (watch) watchers.push(result);
}
if (watch) {
  console.log('Watching Ozone Layer extension; load apps/extension/dist and reload it after changes.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await Promise.all(watchers.map(w => w.close())); process.exit(0); });
}
