import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const widgetEnabled = process.env.BEACON_KID_WIDGET_ENABLED === 'true';
if (widgetEnabled) {
  try { createRequire(import.meta.url).resolve('@k-id/core'); }
  catch { throw new Error('The optional k-ID widget requires the privately supplied SDK. See docs/INTEGRATION.md; the default offline build needs no SDK.'); }
}
export default defineConfig({
  // Read VITE_* settings from the repo-root .env. Vite only exposes VITE_-prefixed
  // variables to browser code, so server secrets in the same file stay server-side.
  envDir: '../..',
  define: { __KID_WIDGET_ENABLED__: JSON.stringify(widgetEnabled) },
  resolve: { alias: { 'ozone:kid-widget': fileURLToPath(new URL(widgetEnabled ? '../../integrations/kid/widget.tsx' : './src/kid-unavailable.tsx', import.meta.url)) } },
  server: { host: '127.0.0.1', port: Number(process.env.COMPANION_PORT ?? 5173), strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? 8787}`, '/health': `http://127.0.0.1:${process.env.API_PORT ?? 8787}`, '/fixtures': `http://127.0.0.1:${process.env.API_PORT ?? 8787}` } },
  build: { target: 'es2022', manifest: true },
});
