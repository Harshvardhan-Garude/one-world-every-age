import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const forbidden = ['correctChoiceId', 'requiredReasonId', 'requiredActionId', 'baselineRubric', 'GEMINI_API_KEY', 'KID_API_KEY', 'INWORLD_API_KEY', 'MODULATE_API_KEY', 'KID_WEBHOOK_SECRET', 'FASTSPRING_API_USERNAME', 'FASTSPRING_API_PASSWORD', 'FASTSPRING_WEBHOOK_SECRET', 'apps/api/src'];
let checked = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(js|html|json|css)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8');
      for (const marker of forbidden) if (text.includes(marker)) throw new Error(`Server-only marker ${marker} in ${path.relative(root, file)}`);
      checked++;
    }
  }
}
await inspect(path.join(root, 'apps/companion/dist'));
await inspect(path.join(root, 'apps/extension/dist'));
console.log(`Browser boundary inspection passed for ${checked} generated assets. No rubric fields, server entrypoints or provider credential variable names found.`);
