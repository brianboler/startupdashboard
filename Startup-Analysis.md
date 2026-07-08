# Startup Pulse — Daily Startup News & Data Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily-refreshed static dashboard that aggregates news, launches, verified-MRR stats, funding filings, and emerging-field signals for startups and early companies — with a fully automated, $0/month data pipeline.

**Architecture:** Node.js fetcher modules (one per data source, each a pure `parse*` function + thin `fetch*` wrapper) run once daily by a GitHub Actions cron job. The pipeline writes a dated JSON snapshot plus `data/latest.json` and commits them to the repo. A static vanilla-JS frontend (served free by GitHub Pages) reads `data/latest.json` and renders an interactive dashboard. Trends/deltas are computed by comparing today's snapshot against prior snapshots stored in `data/history/`.

**Tech Stack:** Node.js 20+ (built-in `fetch`), Vitest (tests), cheerio (HTML parsing fallback), rss-parser (news feeds), vanilla HTML/CSS/JS frontend, GitHub Actions (cron), GitHub Pages (hosting).

## Global Constraints

- **Zero monthly cost.** Only free APIs and free-tier infrastructure. No paid services, no servers, no databases.
- **Node.js >= 20** required (built-in `fetch`, ESM). `package.json` must contain `"type": "module"`.
- **Runtime dependencies limited to:** `cheerio`, `rss-parser`. Dev dependency: `vitest`. Nothing else without explicit approval.
- **Polite scraping only:** every HTTP request sends the User-Agent `startup-pulse-bot/1.0 (personal dashboard; contact: brian.boler340@gmail.com)`; max 1 request/second per host; respect failures (no hammering retries — 3 attempts max with backoff). SEC EDGAR **requires** a UA with contact info or it blocks you.
- **Every source is optional at runtime.** The pipeline uses `Promise.allSettled`; one failing source must never break the daily snapshot. A failed source contributes `[]` and a logged warning.
- **Common item shape** produced by all news-like sources: `{ id: string, title: string, url: string, source: string, points: number|null, meta: string|null, createdAt: string|null }`.
- **Secrets via env vars only:** `PH_TOKEN` (Product Hunt, optional), `GITHUB_TOKEN` (raises GitHub API rate limits; provided automatically in Actions). Never committed.
- **All data files** live under `data/`: `data/latest.json` and `data/history/YYYY-MM-DD.json`.
- Frontend must work when opened via a local static server (`npx serve .`) and on GitHub Pages under a repo subpath — therefore **all frontend fetches use relative paths** (`data/latest.json`, never `/data/latest.json`).
- No external frontend assets (fonts, CDNs). System font stack, inline SVG icons.

## File Structure

```
startupdashboard/
├── Startup-Analysis.md          # this plan
├── package.json                 # type: module, scripts: pipeline/test
├── .gitignore                   # node_modules
├── index.html                   # dashboard shell (repo root so Pages serves it)
├── styles.css                   # dashboard styling
├── app.js                       # dashboard rendering logic
├── data/
│   ├── latest.json              # today's snapshot (committed daily by CI)
│   └── history/                 # dated snapshots for delta/trend computation
├── src/
│   ├── lib/
│   │   ├── http.js              # fetchJson/fetchText: UA, timeout, retry
│   │   └── snapshot.js          # save/load snapshots, MRR deltas
│   ├── sources/
│   │   ├── hackernews.js        # HN Algolia API: front page + Show HN
│   │   ├── github.js            # GitHub search API: new trending repos
│   │   ├── trustmrr.js          # TrustMRR leaderboard scrape (MRR stats)
│   │   ├── producthunt.js       # Product Hunt GraphQL (needs PH_TOKEN)
│   │   ├── edgar.js             # SEC EDGAR daily Form D filings
│   │   └── rss.js               # startup news RSS feeds
│   ├── aggregate.js             # merge sources, emerging-topic scoring
│   └── run.js                   # pipeline entry point
├── tests/
│   ├── fixtures/                # captured API/HTML samples for parser tests
│   └── *.test.js
└── .github/workflows/daily.yml  # daily cron: run pipeline, commit, deploy
```

Each source module exports a **pure parser** (tested against fixtures — no network in tests) and a thin **fetcher** that does the network call and delegates to the parser.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `data/history/.gitkeep`

**Interfaces:**
- Produces: npm scripts `npm test` (vitest run) and `npm run pipeline` (node src/run.js) that every later task relies on.

- [ ] **Step 1: Initialize git and npm**

```bash
cd /Users/brianboler/startupdashboard
git init
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "startup-pulse",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "pipeline": "node src/run.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
.DS_Store
.env
```

- [ ] **Step 4: Install and verify**

```bash
npm install
mkdir -p data/history src/lib src/sources tests/fixtures
touch data/history/.gitkeep
npx vitest run
```
Expected: vitest exits 0 with "no test files found" (passWithNoTests may be needed — if vitest errors, add `"test": "vitest run --passWithNoTests"`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore data/history/.gitkeep
git commit -m "chore: scaffold startup-pulse project"
```

---

### Task 2: HTTP utility (`src/lib/http.js`)

**Files:**
- Create: `src/lib/http.js`
- Test: `tests/http.test.js`

**Interfaces:**
- Produces:
  - `fetchJson(url: string, options?: RequestInit): Promise<any>` — GET with UA header, 15s timeout, 3 retries w/ exponential backoff, throws on final failure.
  - `fetchText(url: string, options?: RequestInit): Promise<string>` — same semantics, returns body text.
  - `USER_AGENT: string` constant.
- Every source module in Tasks 3–8 consumes these.

- [ ] **Step 1: Write the failing test**

`tests/http.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, fetchText, USER_AGENT } from '../src/lib/http.js';

afterEach(() => vi.restoreAllMocks());

describe('http', () => {
  it('exposes a UA identifying the bot with contact info', () => {
    expect(USER_AGENT).toMatch(/startup-pulse-bot/);
    expect(USER_AGENT).toMatch(/brian\.boler340@gmail\.com/);
  });

  it('fetchJson sends UA header and parses JSON', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), { status: 200 })
    );
    const result = await fetchJson('https://example.com/api');
    expect(result).toEqual({ ok: 1 });
    const [, opts] = mock.mock.calls[0];
    expect(opts.headers['User-Agent']).toBe(USER_AGENT);
  });

  it('retries on 500 then succeeds', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('hello', { status: 200 }));
    const text = await fetchText('https://example.com', {}, { retryDelayMs: 1 });
    expect(text).toBe('hello');
  });

  it('throws after 3 failed attempts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 500 }));
    await expect(fetchText('https://example.com', {}, { retryDelayMs: 1 }))
      .rejects.toThrow(/500/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/http.test.js`
Expected: FAIL — cannot find module `../src/lib/http.js`.

- [ ] **Step 3: Write implementation**

`src/lib/http.js`:
```js
export const USER_AGENT =
  'startup-pulse-bot/1.0 (personal dashboard; contact: brian.boler340@gmail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options = {}, { retries = 3, retryDelayMs = 1000, timeoutMs = 15000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(retryDelayMs * attempt);
    }
  }
  throw lastErr;
}

export async function fetchJson(url, options = {}, retryOpts = {}) {
  const res = await fetchWithRetry(url, options, retryOpts);
  return res.json();
}

export async function fetchText(url, options = {}, retryOpts = {}) {
  const res = await fetchWithRetry(url, options, retryOpts);
  return res.text();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/http.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/http.js tests/http.test.js
git commit -m "feat: http utility with UA, timeout, retry"
```

---

### Task 3: Hacker News source (`src/sources/hackernews.js`)

Free Algolia API, no auth, no bot blocker. Provides top headlines + "Show HN" launches from the last 24h.

**Files:**
- Create: `src/sources/hackernews.js`
- Test: `tests/hackernews.test.js`

**Interfaces:**
- Consumes: `fetchJson` from `src/lib/http.js`.
- Produces:
  - `parseHnHits(hits: any[]): Item[]` — maps Algolia hits to the common item shape (`source: 'hackernews'`).
  - `fetchFrontPage(): Promise<Item[]>` — current front page (up to 30).
  - `fetchShowHN(): Promise<Item[]>` — Show HN posts from last 24h with ≥ 5 points, sorted by points desc.

- [ ] **Step 1: Write the failing test**

`tests/hackernews.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseHnHits } from '../src/sources/hackernews.js';

const sampleHits = [
  {
    objectID: '41000001',
    title: 'Show HN: I built a tool for X',
    url: 'https://example.com/tool',
    points: 142,
    num_comments: 37,
    created_at: '2026-07-08T09:00:00Z',
  },
  {
    objectID: '41000002',
    title: 'Ask HN: something',
    url: null,
    points: 12,
    num_comments: 4,
    created_at: '2026-07-08T08:00:00Z',
  },
];

describe('parseHnHits', () => {
  it('maps hits to the common item shape', () => {
    const items = parseHnHits(sampleHits);
    expect(items[0]).toEqual({
      id: 'hn-41000001',
      title: 'Show HN: I built a tool for X',
      url: 'https://example.com/tool',
      source: 'hackernews',
      points: 142,
      meta: '37 comments',
      createdAt: '2026-07-08T09:00:00Z',
    });
  });

  it('falls back to the HN item URL when url is null', () => {
    const items = parseHnHits(sampleHits);
    expect(items[1].url).toBe('https://news.ycombinator.com/item?id=41000002');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hackernews.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/sources/hackernews.js`:
```js
import { fetchJson } from '../lib/http.js';

const API = 'https://hn.algolia.com/api/v1';

export function parseHnHits(hits) {
  return hits.map((h) => ({
    id: `hn-${h.objectID}`,
    title: h.title ?? '(untitled)',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: 'hackernews',
    points: h.points ?? null,
    meta: h.num_comments != null ? `${h.num_comments} comments` : null,
    createdAt: h.created_at ?? null,
  }));
}

export async function fetchFrontPage() {
  const data = await fetchJson(`${API}/search?tags=front_page&hitsPerPage=30`);
  return parseHnHits(data.hits ?? []);
}

export async function fetchShowHN() {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const url = `${API}/search_by_date?tags=show_hn&numericFilters=created_at_i>${since},points>=5&hitsPerPage=30`;
  const data = await fetchJson(url);
  return parseHnHits(data.hits ?? []).sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/hackernews.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Smoke-test the live API (manual, not in test suite)**

```bash
node -e "import('./src/sources/hackernews.js').then(async m => console.log((await m.fetchFrontPage()).slice(0,3)))"
```
Expected: 3 real HN items printed.

- [ ] **Step 6: Commit**

```bash
git add src/sources/hackernews.js tests/hackernews.test.js
git commit -m "feat: hacker news source (front page + show hn)"
```

---

### Task 4: GitHub trending source (`src/sources/github.js`)

Free search API (higher limits with `GITHUB_TOKEN`). Surfaces brand-new repos gaining stars fast — leading indicator for emerging tools/fields.

**Files:**
- Create: `src/sources/github.js`
- Test: `tests/github.test.js`

**Interfaces:**
- Consumes: `fetchJson` from `src/lib/http.js`; env var `GITHUB_TOKEN` (optional).
- Produces:
  - `parseRepos(apiResponse: {items: any[]}): Repo[]` where `Repo = { id, title, url, source: 'github', points (stars), meta (language · description), createdAt, topics: string[] }`.
  - `fetchNewTrendingRepos(): Promise<Repo[]>` — repos created in the last 7 days, sorted by stars, top 25.

- [ ] **Step 1: Write the failing test**

`tests/github.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseRepos } from '../src/sources/github.js';

const apiResponse = {
  items: [
    {
      full_name: 'acme/new-ai-tool',
      html_url: 'https://github.com/acme/new-ai-tool',
      stargazers_count: 900,
      language: 'Rust',
      description: 'A fast new AI tool',
      created_at: '2026-07-03T00:00:00Z',
      topics: ['ai', 'agents'],
    },
  ],
};

describe('parseRepos', () => {
  it('maps repos to the common item shape with topics', () => {
    const [repo] = parseRepos(apiResponse);
    expect(repo).toEqual({
      id: 'gh-acme/new-ai-tool',
      title: 'acme/new-ai-tool',
      url: 'https://github.com/acme/new-ai-tool',
      source: 'github',
      points: 900,
      meta: 'Rust · A fast new AI tool',
      createdAt: '2026-07-03T00:00:00Z',
      topics: ['ai', 'agents'],
    });
  });

  it('handles missing language/description/topics', () => {
    const [repo] = parseRepos({ items: [{ full_name: 'a/b', html_url: 'u', stargazers_count: 1, created_at: null }] });
    expect(repo.meta).toBe('');
    expect(repo.topics).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/github.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/sources/github.js`:
```js
import { fetchJson } from '../lib/http.js';

export function parseRepos(apiResponse) {
  return (apiResponse.items ?? []).map((r) => ({
    id: `gh-${r.full_name}`,
    title: r.full_name,
    url: r.html_url,
    source: 'github',
    points: r.stargazers_count ?? 0,
    meta: [r.language, r.description].filter(Boolean).join(' · '),
    createdAt: r.created_at ?? null,
    topics: r.topics ?? [],
  }));
}

export async function fetchNewTrendingRepos() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const url = `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=25`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const data = await fetchJson(url, { headers });
  return parseRepos(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/github.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sources/github.js tests/github.test.js
git commit -m "feat: github new trending repos source"
```

---

### Task 5: TrustMRR source (`src/sources/trustmrr.js`)

The user's flagship request: **top headlines, stats, and comprehensive data from TrustMRR** — verified-MRR startups. No official API; polite scrape of the public leaderboard. The site's HTML structure must be captured as a fixture FIRST, then the parser is written against reality (not guesses).

**Files:**
- Create: `src/sources/trustmrr.js`
- Create: `tests/fixtures/trustmrr.html` (captured live)
- Test: `tests/trustmrr.test.js`

**Interfaces:**
- Consumes: `fetchText` from `src/lib/http.js`; `cheerio`.
- Produces:
  - `parseTrustMrr(html: string): Startup[]` where `Startup = { name: string, url: string|null, mrr: number|null, growthPct: number|null, description: string|null }`.
  - `fetchTrustMrrLeaderboard(): Promise<Startup[]>`.
  - `parseMoney(text: string): number|null` — `"$12.4k" → 12400`, `"$1.2M" → 1200000`, `"$980" → 980`, junk → `null`.

- [ ] **Step 1: Capture a live fixture**

```bash
curl -sL -A "startup-pulse-bot/1.0 (personal dashboard; contact: brian.boler340@gmail.com)" \
  https://trustmrr.com/ -o tests/fixtures/trustmrr.html
wc -c tests/fixtures/trustmrr.html
```
Expected: non-trivial file size (> 10 KB). **Then inspect it:**

```bash
grep -o '__NEXT_DATA__' tests/fixtures/trustmrr.html | head -1
grep -oE '\$[0-9.,]+[kKmM]?' tests/fixtures/trustmrr.html | head -10
```

**Decision point for the implementer:**
- If `__NEXT_DATA__` (or a similar embedded JSON blob like `self.__next_f`) is present, parse the JSON — it is far more stable than CSS selectors. Adapt `parseTrustMrr` to extract startup entries (name/MRR/growth) from that JSON.
- Otherwise parse the DOM with cheerio. Identify the repeating leaderboard row element in the fixture (look near the `$` amounts found above) and target it.
- If the page returns a bot-block page or requires JS rendering (fixture has no `$` amounts at all), implement `parseTrustMrr` against whatever list data IS server-rendered; if truly nothing, have `fetchTrustMrrLeaderboard()` return `[]` with a `console.warn`, and file a follow-up note in README — the rest of the dashboard must not depend on this source succeeding (Global Constraints).

- [ ] **Step 2: Write the failing test (parseMoney is fixed; leaderboard test runs against the captured fixture)**

`tests/trustmrr.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrustMrr, parseMoney } from '../src/sources/trustmrr.js';

describe('parseMoney', () => {
  it('parses plain dollars', () => expect(parseMoney('$980')).toBe(980));
  it('parses k suffix', () => expect(parseMoney('$12.4k')).toBe(12400));
  it('parses M suffix', () => expect(parseMoney('$1.2M')).toBe(1200000));
  it('parses commas', () => expect(parseMoney('$1,250')).toBe(1250));
  it('returns null for junk', () => expect(parseMoney('n/a')).toBe(null));
});

describe('parseTrustMrr (against live fixture)', () => {
  const html = readFileSync('tests/fixtures/trustmrr.html', 'utf8');
  const startups = parseTrustMrr(html);

  it('extracts at least 5 startups', () => {
    expect(startups.length).toBeGreaterThanOrEqual(5);
  });

  it('every startup has a name and a numeric or null mrr', () => {
    for (const s of startups) {
      expect(typeof s.name).toBe('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.mrr === null || typeof s.mrr === 'number').toBe(true);
    }
  });

  it('at least one startup has a parsed MRR value', () => {
    expect(startups.some((s) => typeof s.mrr === 'number' && s.mrr > 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/trustmrr.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write implementation**

`src/sources/trustmrr.js` — starting point (the cheerio selectors below are a scaffold; **adjust them to match the fixture per the Step 1 decision point**, keeping the exported signatures identical):
```js
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.js';

export function parseMoney(text) {
  if (typeof text !== 'string') return null;
  const m = text.replace(/,/g, '').match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*([kKmM])?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1;
  return Math.round(n * mult);
}

function parsePct(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/(-?[0-9]+(?:\.[0-9]+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

export function parseTrustMrr(html) {
  // Strategy A: embedded Next.js JSON (preferred if present — see Task 5 Step 1).
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const json = JSON.parse(nextData[1]);
      const found = [];
      // Walk the JSON tree for objects that look like startup entries.
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === 'object') {
          if (typeof node.name === 'string' && ('mrr' in node || 'revenue' in node)) {
            found.push({
              name: node.name,
              url: node.url ?? node.website ?? null,
              mrr: typeof node.mrr === 'number' ? node.mrr : parseMoney(String(node.mrr ?? node.revenue ?? '')),
              growthPct: typeof node.growth === 'number' ? node.growth : parsePct(String(node.growth ?? '')),
              description: node.description ?? node.tagline ?? null,
            });
          }
          Object.values(node).forEach(walk);
        }
      };
      walk(json);
      if (found.length >= 5) return found;
    } catch { /* fall through to DOM parsing */ }
  }

  // Strategy B: DOM rows. ADJUST selectors to the captured fixture.
  const $ = cheerio.load(html);
  const startups = [];
  $('[class*="leaderboard"] tr, [class*="startup"], [class*="card"]').each((_, el) => {
    const text = $(el).text();
    const mrr = parseMoney(text);
    if (mrr === null) return;
    const name = $(el).find('h2, h3, [class*="name"], a').first().text().trim();
    if (!name) return;
    startups.push({
      name,
      url: $(el).find('a[href^="http"]').attr('href') ?? null,
      mrr,
      growthPct: parsePct(text),
      description: null,
    });
  });
  return startups;
}

export async function fetchTrustMrrLeaderboard() {
  try {
    const html = await fetchText('https://trustmrr.com/');
    const startups = parseTrustMrr(html);
    if (startups.length === 0) console.warn('trustmrr: parsed 0 startups — selectors may need updating');
    return startups;
  } catch (err) {
    console.warn(`trustmrr: fetch failed (${err.message})`);
    return [];
  }
}
```

- [ ] **Step 5: Run test, iterate selectors until it passes**

Run: `npx vitest run tests/trustmrr.test.js`
Expected: PASS (8 tests). If the fixture-based tests fail, open `tests/fixtures/trustmrr.html`, find the real leaderboard markup, and refine Strategy A/B until they pass. Do NOT weaken the assertions (≥ 5 startups, ≥ 1 numeric MRR) — they define "comprehensive data," which is the point of this source.

- [ ] **Step 6: Commit**

```bash
git add src/sources/trustmrr.js tests/trustmrr.test.js tests/fixtures/trustmrr.html
git commit -m "feat: trustmrr leaderboard scraper with fixture-based tests"
```

---

### Task 6: Product Hunt source (`src/sources/producthunt.js`)

Official free GraphQL API. Requires a free dev token (`PH_TOKEN` env var). Without the token the source cleanly returns `[]`.

**Files:**
- Create: `src/sources/producthunt.js`
- Test: `tests/producthunt.test.js`

**Interfaces:**
- Consumes: `fetchJson` from `src/lib/http.js`; env var `PH_TOKEN` (optional).
- Produces:
  - `parsePhPosts(gqlResponse: any): Item[]` — items with `source: 'producthunt'`, `topics: string[]` extra field.
  - `fetchTodayLaunches(): Promise<Item[]>` — top 20 posts by votes from the last 24h; `[]` (with warn) if `PH_TOKEN` unset.

- [ ] **Step 1: Write the failing test**

`tests/producthunt.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parsePhPosts } from '../src/sources/producthunt.js';

const gqlResponse = {
  data: {
    posts: {
      edges: [
        {
          node: {
            id: 'ph1',
            name: 'CoolTool',
            tagline: 'Does cool things',
            votesCount: 310,
            url: 'https://www.producthunt.com/posts/cooltool',
            createdAt: '2026-07-08T07:00:00Z',
            topics: { edges: [{ node: { name: 'AI' } }, { node: { name: 'SaaS' } }] },
          },
        },
      ],
    },
  },
};

describe('parsePhPosts', () => {
  it('maps GraphQL posts to items with topics', () => {
    const [item] = parsePhPosts(gqlResponse);
    expect(item).toEqual({
      id: 'ph-ph1',
      title: 'CoolTool',
      url: 'https://www.producthunt.com/posts/cooltool',
      source: 'producthunt',
      points: 310,
      meta: 'Does cool things',
      createdAt: '2026-07-08T07:00:00Z',
      topics: ['AI', 'SaaS'],
    });
  });

  it('returns [] for empty/missing data', () => {
    expect(parsePhPosts({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/producthunt.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/sources/producthunt.js`:
```js
import { fetchJson } from '../lib/http.js';

const QUERY = `
query TodayPosts($postedAfter: DateTime!) {
  posts(order: VOTES, postedAfter: $postedAfter, first: 20) {
    edges { node {
      id name tagline votesCount url createdAt
      topics(first: 3) { edges { node { name } } }
    } }
  }
}`;

export function parsePhPosts(gqlResponse) {
  const edges = gqlResponse?.data?.posts?.edges ?? [];
  return edges.map(({ node }) => ({
    id: `ph-${node.id}`,
    title: node.name,
    url: node.url,
    source: 'producthunt',
    points: node.votesCount ?? 0,
    meta: node.tagline ?? null,
    createdAt: node.createdAt ?? null,
    topics: (node.topics?.edges ?? []).map((e) => e.node.name),
  }));
}

export async function fetchTodayLaunches() {
  const token = process.env.PH_TOKEN;
  if (!token) {
    console.warn('producthunt: PH_TOKEN not set — skipping source');
    return [];
  }
  const postedAfter = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const data = await fetchJson('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: QUERY, variables: { postedAfter } }),
  });
  return parsePhPosts(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/producthunt.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sources/producthunt.js tests/producthunt.test.js
git commit -m "feat: product hunt daily launches source"
```

---

### Task 7: SEC EDGAR Form D source (`src/sources/edgar.js`)

Truly free, no bot blocker, official. **Form D filings = private companies raising money** — the earliest public funding signal there is. Uses EDGAR's plain-text daily form index (stable, documented format), not the HTML search UI.

**Files:**
- Create: `src/sources/edgar.js`
- Test: `tests/edgar.test.js`

**Interfaces:**
- Consumes: `fetchText` from `src/lib/http.js`.
- Produces:
  - `parseFormIndex(idxText: string): Filing[]` where `Filing = { formType: 'D'|'D/A', company: string, cik: string, dateFiled: string (YYYYMMDD), url: string }` — only Form D and D/A rows.
  - `dailyIndexUrl(date: Date): string` — e.g. `https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/form.20260707.idx`.
  - `fetchRecentFormD(): Promise<Filing[]>` — tries today then walks back up to 4 days (weekends/holidays have no index), returns first non-empty day's Form D filings.

- [ ] **Step 1: Write the failing test**

`tests/edgar.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseFormIndex, dailyIndexUrl } from '../src/sources/edgar.js';

const idxSample = `Description:           Daily Index of EDGAR Dissemination Feed by Form Type
Last Data Received:    July 7, 2026

Form Type   Company Name                     CIK         Date Filed  File Name
---------------------------------------------------------------------------------
10-K        BigCo Inc                        0000320193  20260707    edgar/data/320193/0000320193-26-000001.txt
D           Acme Ventures Fund II LP         0001234567  20260707    edgar/data/1234567/0001234567-26-000042.txt
D/A         Beta Robotics Inc                0007654321  20260707    edgar/data/7654321/0007654321-26-000007.txt
S-1         SomeCo                           0001111111  20260707    edgar/data/1111111/0001111111-26-000003.txt
`;

describe('parseFormIndex', () => {
  it('extracts only Form D and D/A filings', () => {
    const filings = parseFormIndex(idxSample);
    expect(filings).toHaveLength(2);
    expect(filings[0]).toEqual({
      formType: 'D',
      company: 'Acme Ventures Fund II LP',
      cik: '0001234567',
      dateFiled: '20260707',
      url: 'https://www.sec.gov/Archives/edgar/data/1234567/0001234567-26-000042.txt',
    });
    expect(filings[1].formType).toBe('D/A');
  });

  it('returns [] for text without D filings', () => {
    expect(parseFormIndex('Form Type Company\n10-K X 1 2 y.txt')).toEqual([]);
  });
});

describe('dailyIndexUrl', () => {
  it('builds the correct quarter path', () => {
    expect(dailyIndexUrl(new Date('2026-07-07T12:00:00Z'))).toBe(
      'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/form.20260707.idx'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/edgar.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/sources/edgar.js`:
```js
import { fetchText } from '../lib/http.js';

export function dailyIndexUrl(date) {
  const y = date.getUTCFullYear();
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${q}/form.${ymd}.idx`;
}

export function parseFormIndex(idxText) {
  const filings = [];
  for (const line of idxText.split('\n')) {
    // Columns are separated by runs of 2+ spaces; company names may contain single spaces.
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length < 5) continue;
    const [formType, company, cik, dateFiled, fileName] = cols;
    if (formType !== 'D' && formType !== 'D/A') continue;
    filings.push({
      formType,
      company,
      cik,
      dateFiled,
      url: `https://www.sec.gov/Archives/${fileName}`,
    });
  }
  return filings;
}

export async function fetchRecentFormD() {
  for (let back = 0; back <= 4; back++) {
    const date = new Date(Date.now() - back * 24 * 3600 * 1000);
    try {
      const text = await fetchText(dailyIndexUrl(date), {}, { retries: 1 });
      const filings = parseFormIndex(text);
      if (filings.length > 0) return filings;
    } catch {
      // Index not published yet (or weekend/holiday) — walk back a day.
    }
  }
  console.warn('edgar: no daily index with Form D filings found in last 5 days');
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/edgar.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Smoke-test live (manual)**

```bash
node -e "import('./src/sources/edgar.js').then(async m => { const f = await m.fetchRecentFormD(); console.log(f.length, 'filings; first:', f[0]); })"
```
Expected: dozens–hundreds of filings; first entry has company/cik/url.

- [ ] **Step 6: Commit**

```bash
git add src/sources/edgar.js tests/edgar.test.js
git commit -m "feat: sec edgar daily form d filings source"
```

---

### Task 8: RSS news source (`src/sources/rss.js`)

Startup/VC headlines from free RSS feeds (TechCrunch Startups, Crunchbase News, etc.). Feed list is data, not code — easy to extend.

**Files:**
- Create: `src/sources/rss.js`
- Test: `tests/rss.test.js`

**Interfaces:**
- Consumes: `rss-parser` package; `USER_AGENT` from `src/lib/http.js`.
- Produces:
  - `FEEDS: {name: string, url: string}[]` — the configured feed list.
  - `parseFeedItems(feedName: string, items: any[]): Item[]` — `source: 'rss:<feedName>'`, capped at 10 per feed, only items < 48h old.
  - `fetchNewsHeadlines(): Promise<Item[]>` — all feeds via `Promise.allSettled`, failures logged and skipped, merged sorted by date desc.

- [ ] **Step 1: Write the failing test**

`tests/rss.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseFeedItems } from '../src/sources/rss.js';

afterEach(() => vi.useRealTimers());

const NOW = new Date('2026-07-08T12:00:00Z');

describe('parseFeedItems', () => {
  it('maps items, filters stale ones, caps at 10', () => {
    vi.useFakeTimers({ now: NOW });
    const items = [
      { title: 'Fresh startup news', link: 'https://tc.com/a', isoDate: '2026-07-08T09:00:00Z' },
      { title: 'Stale news', link: 'https://tc.com/old', isoDate: '2026-07-01T09:00:00Z' },
      ...Array.from({ length: 15 }, (_, i) => ({
        title: `Item ${i}`, link: `https://tc.com/${i}`, isoDate: '2026-07-08T08:00:00Z',
      })),
    ];
    const parsed = parseFeedItems('techcrunch', items);
    expect(parsed).toHaveLength(10);
    expect(parsed[0]).toEqual({
      id: 'rss-https://tc.com/a',
      title: 'Fresh startup news',
      url: 'https://tc.com/a',
      source: 'rss:techcrunch',
      points: null,
      meta: 'techcrunch',
      createdAt: '2026-07-08T09:00:00Z',
    });
    expect(parsed.some((p) => p.title === 'Stale news')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rss.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/sources/rss.js`:
```js
import Parser from 'rss-parser';
import { USER_AGENT } from '../lib/http.js';

export const FEEDS = [
  { name: 'techcrunch', url: 'https://techcrunch.com/category/startups/feed/' },
  { name: 'crunchbase-news', url: 'https://news.crunchbase.com/feed/' },
  { name: 'venturebeat', url: 'https://venturebeat.com/feed/' },
];

const MAX_AGE_MS = 48 * 3600 * 1000;

export function parseFeedItems(feedName, items) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return (items ?? [])
    .filter((it) => it.title && it.link)
    .filter((it) => {
      const t = Date.parse(it.isoDate ?? it.pubDate ?? '');
      return !Number.isNaN(t) && t >= cutoff;
    })
    .slice(0, 10)
    .map((it) => ({
      id: `rss-${it.link}`,
      title: it.title,
      url: it.link,
      source: `rss:${feedName}`,
      points: null,
      meta: feedName,
      createdAt: it.isoDate ?? null,
    }));
}

export async function fetchNewsHeadlines() {
  const parser = new Parser({ headers: { 'User-Agent': USER_AGENT }, timeout: 15000 });
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => parseFeedItems(f.name, (await parser.parseURL(f.url)).items))
  );
  const items = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else console.warn(`rss: ${FEEDS[i].name} failed (${r.reason?.message})`);
  });
  return items.sort((a, b) => Date.parse(b.createdAt ?? 0) - Date.parse(a.createdAt ?? 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rss.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/sources/rss.js tests/rss.test.js
git commit -m "feat: rss startup news headlines source"
```

---

### Task 9: Snapshot store & MRR deltas (`src/lib/snapshot.js`)

**Files:**
- Create: `src/lib/snapshot.js`
- Test: `tests/snapshot.test.js`

**Interfaces:**
- Consumes: `node:fs`, `node:path`.
- Produces:
  - `saveSnapshot(snapshot: object, dataDir: string): void` — writes `dataDir/history/<snapshot.date>.json` AND `dataDir/latest.json` (pretty-printed).
  - `loadRecentSnapshots(dataDir: string, n: number): object[]` — up to `n` most recent history files, newest first, excluding files that fail to parse.
  - `computeMrrDeltas(today: Startup[], previous: Startup[]|null): (Startup & {mrrDelta: number|null, rankDelta: number|null})[]` — matches by `name`; `mrrDelta` = today.mrr − prev.mrr; `rankDelta` = prevRank − todayRank (positive = climbed); both `null` when no previous entry.

- [ ] **Step 1: Write the failing test**

`tests/snapshot.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveSnapshot, loadRecentSnapshots, computeMrrDeltas } from '../src/lib/snapshot.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'snap-')); });

describe('saveSnapshot / loadRecentSnapshots', () => {
  it('writes latest.json and a dated history file', () => {
    saveSnapshot({ date: '2026-07-08', sections: {} }, dir);
    expect(existsSync(join(dir, 'latest.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'history/2026-07-08.json'), 'utf8')).date).toBe('2026-07-08');
  });

  it('loads recent snapshots newest first', () => {
    saveSnapshot({ date: '2026-07-06' }, dir);
    saveSnapshot({ date: '2026-07-07' }, dir);
    saveSnapshot({ date: '2026-07-08' }, dir);
    const recent = loadRecentSnapshots(dir, 2);
    expect(recent.map((s) => s.date)).toEqual(['2026-07-08', '2026-07-07']);
  });
});

describe('computeMrrDeltas', () => {
  const today = [
    { name: 'Alpha', mrr: 12000 },
    { name: 'Beta', mrr: 8000 },
    { name: 'NewCo', mrr: 500 },
  ];
  const previous = [
    { name: 'Beta', mrr: 9000 },
    { name: 'Alpha', mrr: 10000 },
  ];

  it('computes mrr and rank deltas by name', () => {
    const out = computeMrrDeltas(today, previous);
    expect(out[0]).toMatchObject({ name: 'Alpha', mrrDelta: 2000, rankDelta: 1 });   // rank 2 -> 1
    expect(out[1]).toMatchObject({ name: 'Beta', mrrDelta: -1000, rankDelta: -1 });  // rank 1 -> 2
    expect(out[2]).toMatchObject({ name: 'NewCo', mrrDelta: null, rankDelta: null });
  });

  it('handles null previous', () => {
    const out = computeMrrDeltas(today, null);
    expect(out.every((s) => s.mrrDelta === null && s.rankDelta === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/snapshot.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/lib/snapshot.js`:
```js
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function saveSnapshot(snapshot, dataDir) {
  const historyDir = join(dataDir, 'history');
  mkdirSync(historyDir, { recursive: true });
  const json = JSON.stringify(snapshot, null, 2);
  writeFileSync(join(historyDir, `${snapshot.date}.json`), json);
  writeFileSync(join(dataDir, 'latest.json'), json);
}

export function loadRecentSnapshots(dataDir, n) {
  const historyDir = join(dataDir, 'history');
  let files;
  try {
    files = readdirSync(historyDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }
  return files
    .sort()
    .reverse()
    .slice(0, n)
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(historyDir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function computeMrrDeltas(today, previous) {
  const prevByName = new Map((previous ?? []).map((s, i) => [s.name, { ...s, rank: i }]));
  return today.map((s, i) => {
    const prev = prevByName.get(s.name);
    return {
      ...s,
      mrrDelta: prev && s.mrr != null && prev.mrr != null ? s.mrr - prev.mrr : null,
      rankDelta: prev ? prev.rank - i : null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/snapshot.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/snapshot.js tests/snapshot.test.js
git commit -m "feat: snapshot store with history and mrr delta computation"
```

---

### Task 10: Aggregator & emerging-topic scoring (`src/aggregate.js`)

Turns raw source output into the final snapshot, including the "emerging fields" signal: keyword velocity of today's titles/topics vs the average of prior days.

**Files:**
- Create: `src/aggregate.js`
- Test: `tests/aggregate.test.js`

**Interfaces:**
- Consumes: nothing (pure functions). `src/run.js` (Task 11) wires it to sources and snapshot store.
- Produces:
  - `extractTerms(items: {title?: string, topics?: string[]}[]): Map<string, number>` — lowercase term counts from titles (words ≥ 4 chars, stopwords removed) and explicit `topics` arrays (topics count double).
  - `scoreEmergingTopics(todayTerms: Map, previousSnapshots: object[]): {term: string, count: number, velocity: number}[]` — `velocity = count / (avgPrevCount + 1)`, requires `count >= 3`, top 20 by velocity. Reads prior term counts from each previous snapshot's `sections.emergingTopics` (`{term, count}` entries).
  - `buildSnapshot(inputs: {date, headlines, showHn, launches, repos, mrrLeaderboard, filings, news, previousSnapshots}): Snapshot` — the full snapshot object (shape below).

**Snapshot shape (consumed by the frontend in Task 12 — treat as a contract):**
```json
{
  "date": "2026-07-08",
  "generatedAt": "2026-07-08T11:02:00.000Z",
  "stats": { "totalItems": 0, "sources": { "hackernews": 30, "trustmrr": 50 } },
  "sections": {
    "headlines":      [ { "id": "", "title": "", "url": "", "source": "", "points": 0, "meta": "", "createdAt": "" } ],
    "launches":       [ { "...same item shape, from showHn + producthunt merged, sorted by points desc": 0 } ],
    "mrrLeaderboard": [ { "name": "", "url": "", "mrr": 0, "growthPct": 0, "description": "", "mrrDelta": 0, "rankDelta": 0 } ],
    "trendingRepos":  [ { "...item shape plus topics: []": 0 } ],
    "formDFilings":   [ { "formType": "D", "company": "", "cik": "", "dateFiled": "", "url": "" } ],
    "news":           [ { "...item shape": 0 } ],
    "emergingTopics": [ { "term": "", "count": 0, "velocity": 0 } ]
  }
}
```

- [ ] **Step 1: Write the failing test**

`tests/aggregate.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractTerms, scoreEmergingTopics, buildSnapshot } from '../src/aggregate.js';

describe('extractTerms', () => {
  it('counts title words >= 4 chars, lowercased, stopwords removed', () => {
    const terms = extractTerms([
      { title: 'Show HN: Voice agents for restaurants' },
      { title: 'Voice cloning startup raises' },
    ]);
    expect(terms.get('voice')).toBe(2);
    expect(terms.get('agents')).toBe(1);
    expect(terms.has('show')).toBe(false); // stopword
    expect(terms.has('for')).toBe(false);  // < 4 chars
  });

  it('counts explicit topics double', () => {
    const terms = extractTerms([{ title: 'x', topics: ['robotics'] }]);
    expect(terms.get('robotics')).toBe(2);
  });
});

describe('scoreEmergingTopics', () => {
  it('ranks by velocity vs prior snapshots and requires count >= 3', () => {
    const today = new Map([['voice', 6], ['saas', 3], ['rare', 1]]);
    const prev = [
      { sections: { emergingTopics: [{ term: 'saas', count: 4 }] } },
      { sections: { emergingTopics: [{ term: 'saas', count: 2 }] } },
    ];
    const scored = scoreEmergingTopics(today, prev);
    const terms = scored.map((s) => s.term);
    expect(terms).toContain('voice');
    expect(terms).not.toContain('rare'); // count < 3
    const voice = scored.find((s) => s.term === 'voice');
    const saas = scored.find((s) => s.term === 'saas');
    expect(voice.velocity).toBe(6);                 // 6 / (0 + 1)
    expect(saas.velocity).toBeCloseTo(3 / 4);       // 3 / (3 + 1)
    expect(terms.indexOf('voice')).toBeLessThan(terms.indexOf('saas'));
  });
});

describe('buildSnapshot', () => {
  it('assembles sections and stats', () => {
    const snap = buildSnapshot({
      date: '2026-07-08',
      headlines: [{ id: 'hn-1', title: 'AI voice startups everywhere', url: 'u', source: 'hackernews', points: 100, meta: null, createdAt: null }],
      showHn: [{ id: 'hn-2', title: 'Show HN: thing', url: 'u', source: 'hackernews', points: 50, meta: null, createdAt: null }],
      launches: [{ id: 'ph-1', title: 'Thing2', url: 'u', source: 'producthunt', points: 80, meta: null, createdAt: null, topics: [] }],
      repos: [],
      mrrLeaderboard: [{ name: 'Alpha', mrr: 1000, mrrDelta: null, rankDelta: null }],
      filings: [],
      news: [],
      previousSnapshots: [],
    });
    expect(snap.date).toBe('2026-07-08');
    expect(snap.sections.launches.map((l) => l.id)).toEqual(['ph-1', 'hn-2']); // merged, points desc
    expect(snap.stats.totalItems).toBeGreaterThan(0);
    expect(Array.isArray(snap.sections.emergingTopics)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/aggregate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

`src/aggregate.js`:
```js
const STOPWORDS = new Set([
  'show', 'this', 'that', 'with', 'from', 'your', 'have', 'what', 'when', 'will',
  'about', 'into', 'over', 'just', 'like', 'more', 'than', 'them', 'then', 'they',
  'startup', 'startups', 'company', 'companies', 'launch', 'launches', 'launched',
  'using', 'built', 'build', 'make', 'made', 'open', 'source', 'first', 'best',
  'raises', 'raised', 'funding', 'announcing', 'introducing', 'https', 'week', 'today',
]);

export function extractTerms(items) {
  const counts = new Map();
  const add = (term, weight = 1) => counts.set(term, (counts.get(term) ?? 0) + weight);
  for (const item of items) {
    const words = (item.title ?? '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [];
    for (const w of words) if (!STOPWORDS.has(w)) add(w);
    for (const t of item.topics ?? []) add(t.toLowerCase(), 2);
  }
  return counts;
}

export function scoreEmergingTopics(todayTerms, previousSnapshots) {
  const prevAvg = new Map();
  for (const snap of previousSnapshots ?? []) {
    for (const { term, count } of snap?.sections?.emergingTopics ?? []) {
      prevAvg.set(term, (prevAvg.get(term) ?? 0) + count);
    }
  }
  const n = Math.max((previousSnapshots ?? []).length, 1);
  const scored = [];
  for (const [term, count] of todayTerms) {
    if (count < 3) continue;
    const avg = (prevAvg.get(term) ?? 0) / n;
    scored.push({ term, count, velocity: count / (avg + 1) });
  }
  return scored.sort((a, b) => b.velocity - a.velocity).slice(0, 20);
}

export function buildSnapshot({ date, headlines, showHn, launches, repos, mrrLeaderboard, filings, news, previousSnapshots }) {
  const mergedLaunches = [...launches, ...showHn].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const topicSourceItems = [...headlines, ...mergedLaunches, ...repos, ...news];
  const emergingTopics = scoreEmergingTopics(extractTerms(topicSourceItems), previousSnapshots);

  const sections = {
    headlines,
    launches: mergedLaunches,
    mrrLeaderboard,
    trendingRepos: repos,
    formDFilings: filings.slice(0, 40),
    news,
    emergingTopics,
  };
  const sources = {};
  for (const [name, arr] of Object.entries(sections)) sources[name] = arr.length;

  return {
    date,
    generatedAt: new Date().toISOString(),
    stats: {
      totalItems: Object.values(sections).reduce((sum, arr) => sum + arr.length, 0),
      sources,
    },
    sections,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/aggregate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.js tests/aggregate.test.js
git commit -m "feat: aggregator with emerging-topic velocity scoring"
```

---

### Task 11: Pipeline entry point (`src/run.js`)

**Files:**
- Create: `src/run.js`

**Interfaces:**
- Consumes: every source fetcher (Tasks 3–8), `buildSnapshot` (Task 10), `saveSnapshot`/`loadRecentSnapshots`/`computeMrrDeltas` (Task 9).
- Produces: `data/latest.json` + `data/history/<date>.json` on disk; exits 0 even when individual sources fail (Global Constraints), exits 1 only if writing the snapshot itself fails.

- [ ] **Step 1: Write implementation** (no unit test — this is glue; it's verified by running it)

`src/run.js`:
```js
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchFrontPage, fetchShowHN } from './sources/hackernews.js';
import { fetchNewTrendingRepos } from './sources/github.js';
import { fetchTrustMrrLeaderboard } from './sources/trustmrr.js';
import { fetchTodayLaunches } from './sources/producthunt.js';
import { fetchRecentFormD } from './sources/edgar.js';
import { fetchNewsHeadlines } from './sources/rss.js';
import { buildSnapshot } from './aggregate.js';
import { saveSnapshot, loadRecentSnapshots, computeMrrDeltas } from './lib/snapshot.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

async function settle(name, promise) {
  try {
    const value = await promise;
    console.log(`✓ ${name}: ${value.length} items`);
    return value;
  } catch (err) {
    console.warn(`✗ ${name} failed: ${err.message}`);
    return [];
  }
}

const [headlines, showHn, repos, mrrRaw, launches, filings, news] = await Promise.all([
  settle('hackernews front page', fetchFrontPage()),
  settle('show hn', fetchShowHN()),
  settle('github trending', fetchNewTrendingRepos()),
  settle('trustmrr', fetchTrustMrrLeaderboard()),
  settle('product hunt', fetchTodayLaunches()),
  settle('edgar form d', fetchRecentFormD()),
  settle('rss news', fetchNewsHeadlines()),
]);

const previousSnapshots = loadRecentSnapshots(DATA_DIR, 7);
const previousMrr = previousSnapshots[0]?.sections?.mrrLeaderboard ?? null;
const mrrLeaderboard = computeMrrDeltas(mrrRaw, previousMrr);

const snapshot = buildSnapshot({
  date: new Date().toISOString().slice(0, 10),
  headlines, showHn, launches, repos, mrrLeaderboard, filings, news,
  previousSnapshots,
});

saveSnapshot(snapshot, DATA_DIR);
console.log(`Snapshot saved: ${snapshot.stats.totalItems} items across ${Object.keys(snapshot.stats.sources).length} sections`);
```

- [ ] **Step 2: Run the full pipeline for real**

```bash
npm run pipeline
```
Expected: per-source ✓/✗ lines; final "Snapshot saved: N items"; `data/latest.json` and `data/history/<today>.json` exist and contain populated sections. At minimum `headlines`, `trendingRepos`, and `formDFilings` must be non-empty (these sources have no auth and no bot blockers). Inspect:

```bash
node -e "const s = JSON.parse(require('fs').readFileSync('data/latest.json')); console.log(s.stats)"
```

- [ ] **Step 3: Run the whole test suite**

Run: `npx vitest run`
Expected: all tests from Tasks 2–10 PASS.

- [ ] **Step 4: Commit (including the first real snapshot)**

```bash
git add src/run.js data/
git commit -m "feat: pipeline entry point with first live snapshot"
```

---

### Task 12: Dashboard frontend (`index.html`, `styles.css`, `app.js`)

Super clean, dynamic, engaging: dark theme, stat chips, animated count-ups, delta badges (▲ green / ▼ red), section tabs, instant client-side search across everything, topic-velocity chips. Zero build step, zero external assets.

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`

**Interfaces:**
- Consumes: `data/latest.json` (snapshot shape from Task 10 — the contract).
- Produces: the shipped UI.

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Startup Pulse — Daily Startup Intelligence</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-dot"></span>
      <h1>Startup&nbsp;Pulse</h1>
      <span class="date-badge" id="date-badge">—</span>
    </div>
    <input id="search" type="search" placeholder="Search everything… (/)" autocomplete="off" />
  </header>

  <section class="stats-row" id="stats-row"><!-- stat chips injected --></section>

  <nav class="tabs" id="tabs">
    <button class="tab active" data-tab="all">Overview</button>
    <button class="tab" data-tab="headlines">Headlines</button>
    <button class="tab" data-tab="launches">Launches</button>
    <button class="tab" data-tab="mrr">MRR Leaderboard</button>
    <button class="tab" data-tab="repos">Trending Repos</button>
    <button class="tab" data-tab="filings">Form D Filings</button>
    <button class="tab" data-tab="news">News</button>
  </nav>

  <main class="grid" id="grid"><!-- panels injected --></main>

  <footer class="footer">
    <span id="generated-at"></span>
    <span>Sources: Hacker News · GitHub · TrustMRR · Product Hunt · SEC EDGAR · RSS</span>
  </footer>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write styles.css**

```css
:root {
  --bg: #0b0e14;
  --panel: #131824;
  --panel-hover: #1a2130;
  --border: #232b3d;
  --text: #e6ebf4;
  --text-dim: #8b95ab;
  --accent: #5b8cff;
  --accent-2: #9d6bff;
  --green: #34d399;
  --red: #f87171;
  --radius: 14px;
  font-size: 15px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: radial-gradient(1200px 600px at 70% -10%, #16203a 0%, var(--bg) 55%);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  min-height: 100vh;
}

/* Top bar */
.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 18px 28px; position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand h1 { font-size: 1.15rem; letter-spacing: 0.02em; }
.brand-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 12px var(--accent); animation: pulse 2.4s ease-in-out infinite;
}
@keyframes pulse { 50% { transform: scale(1.35); opacity: 0.7; } }
.date-badge {
  font-size: 0.75rem; color: var(--text-dim); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 999px;
}
#search {
  background: var(--panel); border: 1px solid var(--border); color: var(--text);
  padding: 9px 14px; border-radius: 10px; width: min(360px, 40vw); outline: none;
  transition: border-color 0.2s;
}
#search:focus { border-color: var(--accent); }

/* Stat chips */
.stats-row { display: flex; flex-wrap: wrap; gap: 12px; padding: 20px 28px 4px; }
.stat-chip {
  background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 12px 18px; min-width: 130px;
}
.stat-chip .num { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat-chip .label { font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }

/* Tabs */
.tabs { display: flex; gap: 6px; padding: 14px 28px 0; flex-wrap: wrap; }
.tab {
  background: none; border: 1px solid transparent; color: var(--text-dim);
  padding: 7px 14px; border-radius: 999px; cursor: pointer; font-size: 0.85rem;
  transition: all 0.15s;
}
.tab:hover { color: var(--text); background: var(--panel); }
.tab.active { color: var(--text); background: var(--panel); border-color: var(--accent); }

/* Panels grid */
.grid {
  display: grid; gap: 18px; padding: 18px 28px 40px;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  align-items: start;
}
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; animation: rise 0.35s ease both;
}
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
.panel h2 {
  font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim);
  padding: 14px 18px 10px; display: flex; justify-content: space-between; align-items: center;
}
.panel h2 .count { color: var(--accent); }
.panel ul { list-style: none; max-height: 480px; overflow-y: auto; }
.panel li { border-top: 1px solid var(--border); transition: background 0.12s; }
.panel li:hover { background: var(--panel-hover); }
.panel li a { display: block; padding: 11px 18px; color: inherit; text-decoration: none; }
.item-title { font-size: 0.92rem; line-height: 1.35; }
.item-meta { font-size: 0.75rem; color: var(--text-dim); margin-top: 3px; display: flex; gap: 8px; flex-wrap: wrap; }
.pts { color: var(--accent); font-weight: 600; }

/* Deltas + badges */
.delta-up { color: var(--green); font-weight: 600; }
.delta-down { color: var(--red); font-weight: 600; }
.mrr-val { font-variant-numeric: tabular-nums; font-weight: 700; }
.badge {
  font-size: 0.68rem; padding: 2px 8px; border-radius: 999px;
  border: 1px solid var(--border); color: var(--text-dim);
}

/* Topic chips */
.topic-cloud { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 18px 16px; }
.topic-chip {
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--panel)), var(--panel));
  border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px;
  font-size: 0.8rem; cursor: default;
}
.topic-chip .vel { color: var(--accent-2); font-weight: 700; margin-left: 5px; }

.footer {
  display: flex; justify-content: space-between; padding: 14px 28px 26px;
  color: var(--text-dim); font-size: 0.75rem; border-top: 1px solid var(--border);
}
.empty { padding: 18px; color: var(--text-dim); font-size: 0.85rem; }
.hidden { display: none !important; }

@media (max-width: 640px) {
  .topbar { flex-direction: column; align-items: stretch; }
  #search { width: 100%; }
  .grid { grid-template-columns: 1fr; padding: 14px; }
}
```

- [ ] **Step 3: Write app.js**

```js
const $ = (sel, el = document) => el.querySelector(sel);
const fmtMoney = (n) =>
  n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function countUp(el, target, ms = 700) {
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min((t - start) / ms, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function itemLi(item) {
  return `<li data-search="${esc((item.title + ' ' + (item.meta ?? '')).toLowerCase())}">
    <a href="${esc(item.url)}" target="_blank" rel="noopener">
      <div class="item-title">${esc(item.title)}</div>
      <div class="item-meta">
        ${item.points != null ? `<span class="pts">▲ ${item.points}</span>` : ''}
        ${item.meta ? `<span>${esc(item.meta)}</span>` : ''}
        <span class="badge">${esc(item.source)}</span>
      </div>
    </a>
  </li>`;
}

function mrrLi(s, rank) {
  const delta = s.mrrDelta == null ? '' :
    s.mrrDelta >= 0 ? `<span class="delta-up">▲ ${fmtMoney(s.mrrDelta)}</span>`
                    : `<span class="delta-down">▼ ${fmtMoney(-s.mrrDelta)}</span>`;
  const rankBadge = s.rankDelta == null || s.rankDelta === 0 ? '' :
    s.rankDelta > 0 ? `<span class="delta-up">↑${s.rankDelta}</span>` : `<span class="delta-down">↓${-s.rankDelta}</span>`;
  const inner = `
      <div class="item-title">#${rank + 1} ${esc(s.name)} ${rankBadge}</div>
      <div class="item-meta">
        <span class="mrr-val">${fmtMoney(s.mrr)}/mo</span> ${delta}
        ${s.growthPct != null ? `<span>${s.growthPct > 0 ? '+' : ''}${s.growthPct}% growth</span>` : ''}
        ${s.description ? `<span>${esc(s.description)}</span>` : ''}
      </div>`;
  return `<li data-search="${esc(s.name.toLowerCase())}">
    ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${inner}</a>` : `<a>${inner}</a>`}
  </li>`;
}

function filingLi(f) {
  const date = `${f.dateFiled.slice(0, 4)}-${f.dateFiled.slice(4, 6)}-${f.dateFiled.slice(6, 8)}`;
  return `<li data-search="${esc(f.company.toLowerCase())}">
    <a href="${esc(f.url)}" target="_blank" rel="noopener">
      <div class="item-title">${esc(f.company)}</div>
      <div class="item-meta"><span class="badge">Form ${esc(f.formType)}</span><span>filed ${date}</span><span>CIK ${esc(f.cik)}</span></div>
    </a>
  </li>`;
}

function panel(key, title, lis, extraHtml = '') {
  return `<section class="panel" data-panel="${key}">
    <h2>${title} <span class="count">${lis.length}</span></h2>
    ${extraHtml}
    <ul>${lis.length ? lis.join('') : '<div class="empty">No data today — check pipeline logs.</div>'}</ul>
  </section>`;
}

const PANEL_TABS = {
  headlines: ['headlines'], launches: ['launches'], mrr: ['mrr'],
  repos: ['repos'], filings: ['filings'], news: ['news'],
};

async function main() {
  let snap;
  try {
    snap = await (await fetch('data/latest.json', { cache: 'no-store' })).json();
  } catch {
    $('#grid').innerHTML = '<div class="empty">Could not load data/latest.json — run <code>npm run pipeline</code> first.</div>';
    return;
  }
  const s = snap.sections;

  $('#date-badge').textContent = snap.date;
  $('#generated-at').textContent = `Generated ${new Date(snap.generatedAt).toLocaleString()}`;

  const chips = [
    ['Total items', snap.stats.totalItems],
    ['Headlines', s.headlines.length],
    ['Launches', s.launches.length],
    ['MRR startups', s.mrrLeaderboard.length],
    ['New repos', s.trendingRepos.length],
    ['Form D filings', s.formDFilings.length],
  ];
  $('#stats-row').innerHTML = chips.map(([label]) =>
    `<div class="stat-chip"><div class="num">0</div><div class="label">${label}</div></div>`).join('');
  document.querySelectorAll('.stat-chip .num').forEach((el, i) => countUp(el, chips[i][1]));

  const topicChips = s.emergingTopics.map((t) =>
    `<span class="topic-chip" title="count ${t.count}">${esc(t.term)}<span class="vel">×${t.velocity.toFixed(1)}</span></span>`).join('');

  $('#grid').innerHTML = [
    panel('headlines', 'Top Headlines', s.headlines.map(itemLi)),
    panel('launches', 'New Launches', s.launches.map(itemLi)),
    panel('mrr', 'Verified MRR Leaderboard', s.mrrLeaderboard.map(mrrLi)),
    panel('repos', 'Trending New Repos', s.trendingRepos.map(itemLi)),
    panel('filings', 'Fresh Form D Filings (SEC)', s.formDFilings.map(filingLi)),
    panel('news', 'Startup News', s.news.map(itemLi)),
    panel('topics', 'Emerging Fields', [], `<div class="topic-cloud">${topicChips || '<span class="empty">Velocity builds after a few days of snapshots.</span>'}</div>`),
  ].join('');

  // Tabs
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    const key = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach((p) => {
      const show = key === 'all' || (PANEL_TABS[key] ?? []).includes(p.dataset.panel) || (key === 'all' && p.dataset.panel === 'topics');
      p.classList.toggle('hidden', !show && key !== 'all');
    });
  });

  // Search ("/" focuses; filters every list item live)
  const search = $('#search');
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('li[data-search]').forEach((li) => {
      li.classList.toggle('hidden', q !== '' && !li.dataset.search.includes(q));
    });
  });
}

main();
```

- [ ] **Step 4: Verify in a browser**

```bash
npx serve . -l 4173
```
Open `http://localhost:4173`. Verify: date badge shows today; stat chips animate; all panels populated (or show the explicit empty state); tabs filter panels; typing in search (or pressing `/`) live-filters items; MRR rows show `$X/mo` values; every link opens in a new tab. Check the browser console — zero errors.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: dashboard frontend (dark theme, tabs, search, deltas)"
```

---

### Task 13: GitHub Actions daily automation (`.github/workflows/daily.yml`)

**Files:**
- Create: `.github/workflows/daily.yml`

**Interfaces:**
- Consumes: `npm run pipeline` (Task 11); repo secrets `PH_TOKEN` (optional); built-in `GITHUB_TOKEN`.
- Produces: a fresh committed snapshot every day at 11:00 UTC (~7 AM ET); GitHub Pages serves the updated dashboard automatically once Pages is enabled on `main`.

- [ ] **Step 1: Write the workflow**

`.github/workflows/daily.yml`:
```yaml
name: Daily data refresh

on:
  schedule:
    - cron: '0 11 * * *'   # 11:00 UTC daily (~7 AM ET)
  workflow_dispatch: {}      # manual trigger for testing

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Run pipeline
        run: npm run pipeline
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PH_TOKEN: ${{ secrets.PH_TOKEN }}

      - name: Run tests
        run: npm test

      - name: Commit fresh snapshot
        run: |
          git config user.name "startup-pulse-bot"
          git config user.email "actions@github.com"
          git add data/
          git diff --cached --quiet && echo "No data changes" && exit 0
          git commit -m "data: daily snapshot $(date -u +%F)"
          git push
```

- [ ] **Step 2: Create the GitHub repo and push**

```bash
gh repo create startupdashboard --public --source . --push
```
(Public repo = unlimited free Actions minutes. If the user prefers private, free tier still comfortably covers one ~2-minute run/day.)

- [ ] **Step 3: Enable GitHub Pages + trigger a manual run**

```bash
gh api repos/{owner}/startupdashboard/pages -X POST -f "source[branch]=main" -f "source[path]=/" || echo "Enable Pages manually: repo Settings → Pages → Deploy from branch → main /(root)"
gh workflow run daily.yml
gh run watch
```
Expected: workflow succeeds; a `data: daily snapshot YYYY-MM-DD` commit appears; dashboard is live at `https://<owner>.github.io/startupdashboard/`.

- [ ] **Step 4: (Optional, user action) Add PH_TOKEN secret**

Document for the user: create a free token at https://www.producthunt.com/v2/oauth/applications, then:
```bash
gh secret set PH_TOKEN
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/daily.yml
git commit -m "ci: daily data refresh cron with auto-commit"
git push
```

---

### Task 14: README & runbook

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above (documents it).
- Produces: onboarding + operations doc.

- [ ] **Step 1: Write README.md**

```markdown
# Startup Pulse

Daily-refreshed dashboard aggregating startup news, launches, verified MRR
stats, SEC Form D filings, and emerging-field signals. $0/month to run.

**Live:** https://<owner>.github.io/startupdashboard/

## How it works

1. A GitHub Actions cron (11:00 UTC daily) runs `npm run pipeline`.
2. The pipeline pulls from free sources in parallel (each optional — one
   failure never blocks the snapshot):
   - Hacker News (Algolia API) — headlines + Show HN launches
   - GitHub Search API — new repos trending by stars (emerging tools/fields)
   - TrustMRR (polite scrape) — verified-MRR startup leaderboard + day-over-day deltas
   - Product Hunt (GraphQL API, needs `PH_TOKEN`) — today's top launches
   - SEC EDGAR daily form index — fresh Form D filings (private fundraising)
   - RSS — TechCrunch Startups, Crunchbase News, VentureBeat
3. It writes `data/latest.json` + `data/history/<date>.json` and commits.
4. GitHub Pages serves the static dashboard, which reads `data/latest.json`.

## Local development

    npm install
    npm test                 # all parser/logic tests (no network)
    npm run pipeline         # fetch real data -> data/latest.json
    npx serve . -l 4173      # open http://localhost:4173

## Configuration

| Env var        | Required | Purpose                              |
|----------------|----------|--------------------------------------|
| `PH_TOKEN`     | no       | Product Hunt API (source skipped without it) |
| `GITHUB_TOKEN` | no       | Higher GitHub API rate limits (auto in CI)   |

## Operations

- **Manual refresh:** Actions tab → "Daily data refresh" → Run workflow.
- **A source broke:** check the Actions log for `✗ <source> failed`. The
  dashboard keeps working with the remaining sources. For TrustMRR, re-capture
  the fixture (`curl ... -o tests/fixtures/trustmrr.html`) and update the
  selectors in `src/sources/trustmrr.js` until `npm test` passes.
- **Add an RSS feed:** append to `FEEDS` in `src/sources/rss.js`.
- **History growth:** one ~100–300 KB JSON/day ≈ a few MB/year. Prune
  `data/history/` if it ever matters.

## Etiquette

All requests identify themselves via User-Agent with contact info, retry at
most 3× with backoff, and run once per day. SEC EDGAR requires the contact UA.
```

- [ ] **Step 2: Final verification sweep**

```bash
npm test          # everything passes
npm run pipeline  # fresh snapshot, sources ✓
npx serve . -l 4173  # visual check of the dashboard
```

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: readme and runbook"
git push
```

---

## Self-Review Notes

- **Spec coverage:** ✅ daily news (Task 3 HN + Task 8 RSS), new-company data (Task 4 GitHub, Task 6 PH, Task 7 EDGAR Form D), TrustMRR headlines/stats/comprehensive data with day-over-day deltas (Tasks 5 + 9), emerging fields (Task 10 velocity scoring), fresh-daily automated pipeline as cheap as possible — $0 (Task 13), clean/dynamic/engaging UI (Task 12).
- **Known reality-check point:** Task 5 (TrustMRR) intentionally starts by capturing a live fixture because the site's markup can't be assumed; the exported function signatures are fixed so downstream tasks are insulated from whatever parsing strategy wins. Same philosophy applies if any RSS feed 403s — the feed list is data.
- **Type consistency check:** `fetchTrustMrrLeaderboard` → `computeMrrDeltas` → `mrrLeaderboard` section → `mrrLi()` renderer all use `{name, url, mrr, growthPct, description, mrrDelta, rankDelta}`. Common item shape is identical across `parseHnHits`, `parsePhPosts`, `parseFeedItems`, `parseRepos` (repos add `topics`). Snapshot shape in Task 10 matches exactly what `app.js` reads in Task 12.
