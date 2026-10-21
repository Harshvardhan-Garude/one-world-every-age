import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserProfile = await mkdtemp(path.join(tmpdir(), 'beacon-smoke-'));
const apiPort = 18787, webPort = 15173;
const base = `http://127.0.0.1:${webPort}`;
const extensionPath = path.join(root, 'apps/extension/dist');
const processes = [];
let browser;
let output = '';
function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, API_PORT: String(apiPort), COMPANION_PORT: String(webPort), BEACON_COMPANION_ORIGIN: base, BEACON_EXTENSION_ORIGINS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-8000); });
  child.on('error', error => { output += error.message; }); processes.push(child); return child;
}
async function waitFor(url) {
  for (let i = 0; i < 80; i++) {
    if (processes.some(child => child.exitCode !== null)) throw new Error(`A smoke server exited. ${output}`);
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await delay(150);
  }
  throw new Error(`Smoke server did not start. ${output}`);
}
try {
  const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  start(['apps/api/dist/main.js']);
  start(['node_modules/vite/bin/vite.js', 'preview', 'apps/companion', '--config', 'apps/companion/vite.config.ts', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort']);
  await waitFor(`http://127.0.0.1:${apiPort}/health`); await waitFor(base);
  browser = await chromium.launchPersistentContext(browserProfile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`], viewport: { width: 1360, height: 1000 } });
  const page = await browser.newPage();
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base);
  await page.getByTestId('fixture-title').waitFor();
  assert.equal(await page.getByTestId('fixture-title').textContent(), 'The free reward offer');
  assert.match(await page.locator('main').textContent(), /gifts-check.example/);
  for (const persona of ['teen', 'adult', 'child']) {
    const response = page.waitForResponse(r => r.url().endsWith('/api/demo/assessments') && r.status() === 200);
    await page.locator('#persona').selectOption(persona);
    await response;
    await page.getByTestId('fixture-title').waitFor();
  }
  await page.getByLabel('Larger text', { exact: true }).check();
  assert.match(await page.locator('.app').getAttribute('class'), /large/);
  await page.getByLabel('Plain language', { exact: true }).check();
  await page.getByRole('button', { name: 'P16 · Learning page' }).click();
  await page.getByText('No supported indicators in this fixture', { exact: true }).waitFor();
  await page.getByLabel('Example variant').selectOption('ambiguous');
  await page.getByText('? Not enough evidence', { exact: true }).waitFor();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Preview my choice' }).click();
  await page.getByText(/No credit was awarded/).waitFor();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByText('⚑ Concern in this fixture', { exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').first().isChecked(), false);
  await page.screenshot({ path: path.join(tmpdir(), 'beacon-foundation.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile shell must not overflow');
  const fixturePage = await browser.newPage();
  await fixturePage.goto(`${base}/fixtures/P01`);
  await fixturePage.getByRole('heading', { name: 'The free reward offer' }).waitFor();
  assert.equal(await fixturePage.locator('input, form').count(), 0);
  await fixturePage.goto(`${base}/fixtures/P16`);
  await fixturePage.getByRole('heading', { name: 'A lesson about suspicious messages' }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.log('PASS: built companion → actual backend, child/teen/adult contexts, P01/P16 and ambiguous variant, preferences, preview without credit, reset, mobile width, inert local fixture pages.');
  const worker = browser.serviceWorkers()[0] ?? await browser.waitForEvent('serviceworker', { timeout: 10000 });
  const extensionId = new URL(worker.url()).hostname;
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByText('Local connection', { exact: true }).click();
  await popup.getByText('Worker ready · detection not implemented', { exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Show current-page access' }).click();
  await popup.getByText(/Page access unavailable here/).waitFor();
  console.log('PASS: actual unmodified unpacked MV3 extension loaded, real worker responded, popup rendered, manual action refused a restricted extension page.');
  console.log('MANUAL CHECK STILL REQUIRED: positive toolbar-invoked activeTab grant and content notice/dismissal on an HTTP(S) tab. A direct popup URL does not grant activeTab. See docs/FOUNDATION.md.');
} finally {
  await browser?.close();
  await Promise.all(processes.map(async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    await Promise.race([exited, delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
  }));
  await rm(browserProfile, { recursive: true, force: true });
}
