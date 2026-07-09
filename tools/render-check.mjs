import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const appjs = readFileSync(join(ROOT, 'app.js'), 'utf8');
const latest = readFileSync(join(ROOT, 'data/latest.json'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { if (!/Could not load img|css/i.test(e.message)) errors.push(e.message); });

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const { window } = dom;
Object.defineProperty(window, 'fetch', {
  value: async (url) => {
    if (String(url).includes('data/latest.json')) return { ok: true, json: async () => JSON.parse(latest) };
    throw new Error('unexpected fetch: ' + url);
  },
});
try { window.eval(appjs); } catch (e) { errors.push('eval: ' + e.message); }
await new Promise((r) => setTimeout(r, 300));

const doc = window.document;
const q = (s) => doc.querySelectorAll(s).length;
const report = {
  panels: q('.panel'),
  rows: q('li[data-search]'),
  mrrRows: q('#mrr-body tr'),
  tickerChips: q('.tick'),
  statCells: q('.stat'),
  topicChips: q('.topic-chip'),
  loadError: /Could not load/.test(doc.querySelector('#grid')?.innerHTML ?? ''),
  errors,
};
console.log(JSON.stringify(report, null, 2));
// Gate on STRUCTURAL integrity + zero JS errors, NOT data volume — so a
// legitimately thin day (a source outage → empty section) never fails CI and
// skips the snapshot commit. The volume numbers above are printed for humans.
const ok = report.panels >= 8 && report.statCells === 7 && !report.loadError && errors.length === 0;
console.log(ok ? 'RENDER_CHECK: PASS' : 'RENDER_CHECK: FAIL');
process.exit(ok ? 0 : 1);
