// Stage the static frontend into dist/ for Cloudflare Workers Static Assets.
// Data is NOT copied — the Worker edge-proxies data/latest.json from GitHub raw.
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const f of ['index.html', 'styles.css', 'app.js']) {
  copyFileSync(join(ROOT, f), join(DIST, f));
}
console.log('built dist/ (index.html, styles.css, app.js)');
