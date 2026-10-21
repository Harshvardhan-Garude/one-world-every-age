import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/main.ts'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'apps/companion/vite.config.ts', 'apps/companion'], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const forced = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 3000);
  forced.unref();
  Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise(resolve => child.once('exit', resolve)))).then(() => { clearTimeout(forced); process.exit(code); });
}
for (const child of children) { child.on('error', () => stop(1)); child.on('exit', code => { if (!stopping) stop(code ?? 1); }); }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
