# UI/UX Boost + Source Diversification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the templated purple-gradient UI with a distinctive "trading floor at night" design (amber-phosphor terminal aesthetic, live ticker tape, images/favicons, sortable MRR table with sparklines, light/dark themes), and diversify data with Reddit community signals, Lobsters, and six new RSS feeds.

**Architecture:** Same $0/month pipeline (Node fetchers → daily snapshot JSON → static frontend on GitHub Pages). Additions: two new source modules (`reddit.js`, `lobsters.js`), a media-enrichment layer (og:image scraping with a committed cache, favicon/social-image URL builders), a v2 snapshot schema (community section, image/domain fields, MRR history arrays), and a full frontend rewrite (`index.html`, `styles.css`, `app.js`).

**Tech Stack:** Node.js 20+ ESM, cheerio (og:image extraction — already a dep), rss-parser, vitest; NEW dev dependency: `jsdom` (headless render verification only — explicitly approved by this plan). Vanilla HTML/CSS/JS frontend, zero build step.

## Current State (what exists — do not rebuild)

Repo: `github.com/brianboler/startupdashboard`, live at `https://brianboler.github.io/startupdashboard/`. Working: `src/lib/http.js` (fetchJson/fetchText/USER_AGENT), 6 sources (hackernews, github, trustmrr — RSC flight-chunk parser, do not touch —, producthunt, edgar, rss), `src/lib/snapshot.js`, `src/aggregate.js`, `src/run.js`, CI cron (`.github/workflows/daily.yml`), 30 passing tests. Secrets set: `PH_TOKEN`.

## Global Constraints

- **Zero monthly cost.** Free APIs and free-tier infra only. No servers, no databases.
- **Node.js >= 20**, ESM, `"type": "module"`.
- **Runtime deps limited to:** `cheerio`, `rss-parser`. **Dev deps:** `vitest`, plus `jsdom` (newly approved here, verification only). Nothing else.
- **Polite fetching:** every request sends `USER_AGENT` from `src/lib/http.js`; ≤ 3 retries with backoff; ≥ 1s between requests to the same host (Reddit especially).
- **Every source is optional at runtime.** A failing source contributes `[]` + a `console.warn`. The snapshot must always be written. Reddit WILL 403 from some networks — that is an expected, non-fatal outcome.
- **Frontend fetches use relative paths** (`data/latest.json`, never `/data/...`) — GitHub Pages serves under a repo subpath.
- **External assets policy (AMENDED):** still NO external fonts, CSS, or JS. Remote **images are now allowed** from exactly three origins: (1) item-provided image URLs (og:image / reddit previews / PH thumbnails), (2) `icons.duckduckgo.com` favicon service, (3) `opengraph.githubassets.com`. Every remote `<img>` must have `loading="lazy"`, `referrerpolicy="no-referrer"`, and an `onerror` handler that removes it (graceful text-only degradation).
- **XSS:** every string that reaches `innerHTML` passes through `esc()`. Image URLs are attribute-escaped too.
- **Secrets via env vars only:** existing `PH_TOKEN`, `GITHUB_TOKEN`; new optional `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`.
- **Old snapshots must still render:** the frontend null-checks every v2 field (`image`, `domain`, `community`, `history`, `totalDelta`, `commentsUrl`).

## Design Direction (binding — this section outranks any implementer taste)

**Concept: "trading floor at night."** Startup Pulse is a money-and-momentum terminal, so the UI borrows from the one place that aesthetic is native: market terminals. Warm graphite darks (never blue-navy), a single **amber phosphor** interface accent, and market **green/red used exclusively for money movement**. Daylight variant = "morning print edition" (warm paper, ink, darkened accents).

**Signature element:** a **live ticker tape** under the masthead — an endless marquee of today's real movers (MRR deltas, fresh Form D filings, hot repos), amber-on-graphite, monospace, pauses on hover, every chip clickable. It is the "pulse" made literal. Secondary micro-signature: the masthead wordmark ends in a blinking block cursor `▮` (disabled under reduced motion).

**Design tokens (copy verbatim into `styles.css`):**

| Token | Dark (default) | Light (`[data-theme="light"]`) |
|---|---|---|
| `--bg` | `#0C0C0B` | `#F7F5F0` |
| `--surface` | `#141412` | `#FFFFFF` |
| `--surface-2` | `#1B1B18` | `#EFECE4` |
| `--hairline` | `#262620` | `#E2DFD5` |
| `--text` | `#EDEAE3` | `#1C1B16` |
| `--dim` | `#96938A` | `#6E6A5E` |
| `--amber` | `#FFB224` | `#9A6700` |
| `--up` | `#3FB950` | `#1A7F37` |
| `--down` | `#F85149` | `#CF222E` |
| `--radius` | `6px` | `6px` |

**Type:** UI sans = system stack. **All data is monospace** (`ui-monospace, 'SF Mono', Menlo, Consolas, monospace`): numerals, timestamps, points, tickers, CIKs, section labels (11px uppercase, 0.08em tracking), tab labels. `font-variant-numeric: tabular-nums` everywhere numbers appear. Item titles: 14.5px sans, weight 550, line-height 1.35.

**Anti-goals (a reviewer should reject the task if any appear):**
- NO gradients of any kind (background, text, border). NO purple/violet/indigo/blue accents.
- NO glow shadows, no `backdrop-filter` glassmorphism, no `box-shadow` except a 1px hairline equivalent.
- NO 999px pill shapes. Max radius 6px (tag chips 4px).
- NO emoji in UI chrome (data strings may contain them).
- NO external fonts. NO decorative "01/02/03" numbering — the ONLY index numbers are MRR leaderboard ranks (real information).
- Motion budget: ticker marquee + 180ms ease-out hovers + staggered 24ms row entrances + existing count-ups. Nothing else. All of it disabled under `prefers-reduced-motion`.

**Layout (desktop ≥ 980px):**

```
┌──────────────────────────────────────────────────────────────┐
│ STARTUP PULSE▮   2026-07-09        [search──────] [◐ theme]  │  masthead (sticky)
├──────────────────────────────────────────────────────────────┤
│ ◄ Maverick ▲ $312 · FORM D Acme Robotics · repo/x ★900 ...  │  ticker tape (signature)
├──────────────────────────────────────────────────────────────┤
│ 651 items  ▲21 vs yesterday │ 30 headlines │ 29 launches │…  │  stat bar (mono, hairlines)
├──────────────────────────────────────────────────────────────┤
│ Overview  Headlines  Launches  MRR  Community  Repos  Filings│  tabs (amber underline)
├────────────────────────────────┬─────────────────────────────┤
│ HEADLINES            [30]      │ MRR LEADERS         [464]   │
│ ▪ thumb  title                 │  #  name        MRR    Δ  ⌁ │
│          fav meta · 2h · 142   │  1  Maverick   $9.7k  ▲312 ╱│  sortable table
│ COMMUNITY            [30]      │ LAUNCHES            [29]    │  + sparklines
│ NEWS                 [21]      │ NEW REPOS · FORM D · FIELDS │
└────────────────────────────────┴─────────────────────────────┘
```

Main column ~58%, rail ~42%. Mobile: single column, ticker retained, table scrolls horizontally.

## Snapshot Schema v2 (contract between Tasks 1–4 and Tasks 5–6)

Additions to the existing shape — everything current stays identical:

```json
{
  "stats": { "totalItems": 0, "totalDelta": null, "sources": { "community": 30 } },
  "sections": {
    "community": [ { "id": "rd-abc", "title": "", "url": "", "source": "reddit:r/startups",
                     "points": 84, "meta": "r/startups · 41 comments", "createdAt": "",
                     "commentsUrl": "https://www.reddit.com/r/...", "image": null, "domain": "example.com" } ],
    "headlines":  [ { "...existing item shape plus": "", "image": "https://... or null", "domain": "example.com or null" } ],
    "mrrLeaderboard": [ { "...existing shape plus": "", "history": [9100, 9400, 9705] } ]
  }
}
```

- `image: string|null` on items in `headlines`, `launches`, `community`, `news` (null when unknown). `trendingRepos` images are DERIVED client-side (`opengraph.githubassets.com/1/<full_name>`) — not stored.
- `domain: string|null` on all news-like items (from `new URL(url).hostname`, `www.` stripped).
- `history: number[]` (oldest→newest, ≤ 14 points, today included) on the top 60 MRR entries only.
- `stats.totalDelta: number|null` = today's totalItems − most recent previous snapshot's.

---

### Task 1: Reddit community source (`src/sources/reddit.js`)

Trending posts from three curated multireddits (founders / AI / builders) via Reddit's JSON API. **Ground truth from live testing (2026-07-08):** unauthenticated `www.reddit.com/.../top.json` returns **403 from many networks** regardless of UA (`old.reddit.com` too). Therefore: prefer the free official OAuth app-only flow when `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` are set (`oauth.reddit.com`, 100 QPM free tier), fall back to one unauthenticated attempt, and treat total failure as a normal `[]` outcome. Reference: https://til.simonwillison.net/reddit/scraping-reddit-json (note it predates the 2023+ tightening).

**Files:**
- Create: `src/sources/reddit.js`
- Create: `tests/fixtures/reddit-top.json`
- Test: `tests/reddit.test.js`

**Interfaces:**
- Consumes: `fetchJson` from `src/lib/http.js`; env `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (both optional).
- Produces:
  - `SUBREDDIT_GROUPS: {name: string, subs: string[]}[]`
  - `parseRedditPosts(listing: any): Item[]` — filters stickied/NSFW/low-score, caps 5 per subreddit, maps to common item shape + `commentsUrl` + `image`.
  - `fetchRedditPulse(): Promise<Item[]>` — all groups, deduped, top 30 by points.

- [ ] **Step 1: Write the fixture** — `tests/fixtures/reddit-top.json` (hand-authored to Reddit's stable Listing schema; a live capture is nice-to-have but NOT required — the implementing network may be 403'd):

```json
{
  "kind": "Listing",
  "data": {
    "children": [
      { "kind": "t3", "data": { "id": "1abc01", "title": "We hit $40k MRR — AMA about our pivot", "permalink": "/r/startups/comments/1abc01/we_hit_40k_mrr/", "url": "https://www.reddit.com/r/startups/comments/1abc01/we_hit_40k_mrr/", "is_self": true, "ups": 412, "num_comments": 187, "created_utc": 1783290000, "subreddit": "startups", "stickied": false, "over_18": false, "thumbnail": "self", "link_flair_text": "Success Story" } },
      { "kind": "t3", "data": { "id": "1abc02", "title": "Show off Saturday: I built an open-source Stripe alternative", "permalink": "/r/SaaS/comments/1abc02/show_off/", "url": "https://github.com/example/openstripe", "is_self": false, "ups": 233, "num_comments": 58, "created_utc": 1783293600, "subreddit": "SaaS", "stickied": false, "over_18": false, "thumbnail": "https://b.thumbs.redditmedia.com/xyz.jpg", "preview": { "images": [ { "source": { "url": "https://preview.redd.it/openstripe.png?width=1200&amp;format=png&amp;auto=webp&amp;s=abc123" } } ] } } },
      { "kind": "t3", "data": { "id": "1abc03", "title": "Weekly promo thread — pinned", "permalink": "/r/indiehackers/comments/1abc03/weekly/", "url": "https://www.reddit.com/r/indiehackers/comments/1abc03/weekly/", "is_self": true, "ups": 900, "num_comments": 40, "created_utc": 1783200000, "subreddit": "indiehackers", "stickied": true, "over_18": false, "thumbnail": "self" } },
      { "kind": "t3", "data": { "id": "1abc04", "title": "Barely upvoted post", "permalink": "/r/startups/comments/1abc04/meh/", "url": "https://example.com/meh", "is_self": false, "ups": 4, "num_comments": 1, "created_utc": 1783296000, "subreddit": "startups", "stickied": false, "over_18": false, "thumbnail": "default" } },
      { "kind": "t3", "data": { "id": "1abc05", "title": "Local LLM beats GPT on our eval — writeup", "permalink": "/r/LocalLLaMA/comments/1abc05/local_llm/", "url": "https://blog.example.com/local-llm-eval", "is_self": false, "ups": 156, "num_comments": 73, "created_utc": 1783297200, "subreddit": "LocalLLaMA", "stickied": false, "over_18": false, "thumbnail": "default" } },
      { "kind": "t3", "data": { "id": "1abc06", "title": "I automated my whole agency with n8n and lost my job (in a good way)", "permalink": "/r/Entrepreneur/comments/1abc06/automated/", "url": "https://www.reddit.com/r/Entrepreneur/comments/1abc06/automated/", "is_self": true, "ups": 88, "num_comments": 31, "created_utc": 1783298000, "subreddit": "Entrepreneur", "stickied": false, "over_18": false, "thumbnail": "self" } }
    ]
  }
}
```

- [ ] **Step 2: Write the failing test** — `tests/reddit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseRedditPosts, SUBREDDIT_GROUPS } from '../src/sources/reddit.js';

const listing = JSON.parse(readFileSync('tests/fixtures/reddit-top.json', 'utf8'));

describe('parseRedditPosts', () => {
  const posts = parseRedditPosts(listing);

  it('filters stickied and low-score posts', () => {
    expect(posts.map((p) => p.id)).not.toContain('rd-1abc03'); // stickied
    expect(posts.map((p) => p.id)).not.toContain('rd-1abc04'); // ups < 10
    expect(posts).toHaveLength(4);
  });

  it('maps a self post to the common item shape linking to the thread', () => {
    const p = posts.find((x) => x.id === 'rd-1abc01');
    expect(p).toEqual({
      id: 'rd-1abc01',
      title: 'We hit $40k MRR — AMA about our pivot',
      url: 'https://www.reddit.com/r/startups/comments/1abc01/we_hit_40k_mrr/',
      source: 'reddit:r/startups',
      points: 412,
      meta: 'r/startups · 187 comments',
      createdAt: new Date(1783290000 * 1000).toISOString(),
      commentsUrl: 'https://www.reddit.com/r/startups/comments/1abc01/we_hit_40k_mrr/',
      image: null,
    });
  });

  it('uses the external url for link posts and unescapes preview images', () => {
    const p = posts.find((x) => x.id === 'rd-1abc02');
    expect(p.url).toBe('https://github.com/example/openstripe');
    expect(p.commentsUrl).toBe('https://www.reddit.com/r/SaaS/comments/1abc02/show_off/');
    expect(p.image).toBe('https://preview.redd.it/openstripe.png?width=1200&format=png&auto=webp&s=abc123');
  });

  it('sorts by points descending', () => {
    expect(posts[0].points).toBeGreaterThanOrEqual(posts[posts.length - 1].points);
  });
});

describe('SUBREDDIT_GROUPS', () => {
  it('covers founder, AI, and builder niches', () => {
    const all = SUBREDDIT_GROUPS.flatMap((g) => g.subs.map((s) => s.toLowerCase()));
    for (const must of ['startups', 'saas', 'indiehackers', 'localllama', 'programming']) {
      expect(all).toContain(must);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails** — `npx vitest run tests/reddit.test.js` → FAIL (module not found).

- [ ] **Step 4: Write implementation** — `src/sources/reddit.js`:

```js
import { fetchJson } from '../lib/http.js';

export const SUBREDDIT_GROUPS = [
  { name: 'founders', subs: ['startups', 'Entrepreneur', 'SaaS', 'indiehackers', 'SideProject', 'ycombinator'] },
  { name: 'ai', subs: ['LocalLLaMA', 'MachineLearning', 'artificial', 'OpenAI', 'ClaudeAI'] },
  { name: 'builders', subs: ['programming', 'webdev', 'selfhosted', 'opensource', 'devops'] },
];

const MIN_UPS = 10;
const MAX_PER_SUB = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function redditImage(p) {
  const prev = p.preview?.images?.[0]?.source?.url;
  if (prev) return prev.replace(/&amp;/g, '&');
  if (/^https?:\/\//.test(p.thumbnail ?? '')) return p.thumbnail;
  return null;
}

export function parseRedditPosts(listing) {
  const children = listing?.data?.children ?? [];
  const perSub = new Map();
  const posts = [];
  for (const { kind, data: p } of children) {
    if (kind !== 't3' || !p || p.stickied || p.over_18) continue;
    if ((p.ups ?? 0) < MIN_UPS) continue;
    const n = (perSub.get(p.subreddit) ?? 0) + 1;
    if (n > MAX_PER_SUB) continue;
    perSub.set(p.subreddit, n);
    const permalink = `https://www.reddit.com${p.permalink}`;
    const isRedditUrl = /^https?:\/\/(www\.|old\.)?reddit\.com/.test(p.url ?? '');
    posts.push({
      id: `rd-${p.id}`,
      title: p.title,
      url: p.url && !p.is_self && !isRedditUrl ? p.url : permalink,
      source: `reddit:r/${p.subreddit}`,
      points: p.ups ?? null,
      meta: `r/${p.subreddit} · ${p.num_comments ?? 0} comments`,
      createdAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      commentsUrl: permalink,
      image: redditImage(p),
    });
  }
  return posts.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

async function getAppToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const data = await fetchJson('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }, { retries: 2 });
  return data.access_token ?? null;
}

export async function fetchRedditPulse() {
  let base = 'https://www.reddit.com';
  let headers = {};
  try {
    const token = await getAppToken();
    if (token) {
      base = 'https://oauth.reddit.com';
      headers = { Authorization: `Bearer ${token}` };
    } else {
      console.warn('reddit: no REDDIT_CLIENT_ID/SECRET — trying unauthenticated (may 403)');
    }
  } catch (err) {
    console.warn(`reddit: oauth failed (${err.message}) — trying unauthenticated`);
  }

  const all = [];
  for (const group of SUBREDDIT_GROUPS) {
    const multi = group.subs.join('+');
    try {
      const listing = await fetchJson(
        `${base}/r/${multi}/top.json?t=day&limit=50&raw_json=1`,
        { headers },
        { retries: 2 }
      );
      all.push(...parseRedditPosts(listing));
    } catch (err) {
      console.warn(`reddit: group "${group.name}" failed (${err.message})`);
    }
    await sleep(1100); // ≥1s between reddit requests
  }
  const seen = new Set();
  return all
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 30);
}
```

- [ ] **Step 5: Run test to verify it passes** — `npx vitest run tests/reddit.test.js` → PASS (5 tests).

- [ ] **Step 6: Optional live smoke** (do NOT block on this — 403 is expected on many networks):
`node -e "import('./src/sources/reddit.js').then(async m => console.log((await m.fetchRedditPulse()).length, 'posts'))"`

- [ ] **Step 7: Commit** — `git add src/sources/reddit.js tests/reddit.test.js tests/fixtures/reddit-top.json && git commit -m "feat: reddit community source (oauth-first, multireddit, per-sub caps)"`

---

### Task 2: Lobsters source + RSS diversification

Lobsters (`lobste.rs/hottest.json`) is verified working (HTTP 200, clean JSON). Six new RSS feeds verified 200 on 2026-07-08: Techmeme, The Verge, Ars Technica, The Next Web, Sifted, GeekWire.

**Files:**
- Create: `src/sources/lobsters.js`
- Test: `tests/lobsters.test.js`
- Modify: `src/sources/rss.js` (FEEDS array only)
- Modify: `tests/rss.test.js` (add FEEDS assertion)

**Interfaces:**
- Consumes: `fetchJson` from `src/lib/http.js`.
- Produces: `parseLobsters(stories: any[]): Item[]` (source `'lobsters'`, `commentsUrl`, `image: null`); `fetchLobsters(): Promise<Item[]>` (top 15).

- [ ] **Step 1: Write the failing test** — `tests/lobsters.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseLobsters } from '../src/sources/lobsters.js';

const stories = [
  {
    short_id: 'abc123',
    title: 'Announcing TypeScript 7.0',
    url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-7',
    comments_url: 'https://lobste.rs/s/abc123',
    score: 36,
    comment_count: 9,
    created_at: '2026-07-08T11:57:26.000-05:00',
    tags: ['javascript', 'release', 'plt', 'extra'],
  },
  { short_id: 'noTitle', url: 'https://x.com', score: 5 },
  {
    short_id: 'selfpost',
    title: 'What are you working on this week?',
    url: '',
    comments_url: 'https://lobste.rs/s/selfpost',
    score: 12,
    comment_count: 40,
    created_at: '2026-07-08T09:00:00.000-05:00',
    tags: ['ask'],
  },
];

describe('parseLobsters', () => {
  const items = parseLobsters(stories);

  it('maps stories to the common item shape with tags in meta', () => {
    expect(items[0]).toEqual({
      id: 'lb-abc123',
      title: 'Announcing TypeScript 7.0',
      url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-7',
      source: 'lobsters',
      points: 36,
      meta: 'lobsters · javascript, release, plt',
      createdAt: '2026-07-08T11:57:26.000-05:00',
      commentsUrl: 'https://lobste.rs/s/abc123',
      image: null,
    });
  });

  it('drops entries without a title and falls back to comments_url for self posts', () => {
    expect(items).toHaveLength(2);
    expect(items[1].url).toBe('https://lobste.rs/s/selfpost');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/lobsters.test.js` → FAIL.

- [ ] **Step 3: Write implementation** — `src/sources/lobsters.js`:

```js
import { fetchJson } from '../lib/http.js';

export function parseLobsters(stories) {
  return (stories ?? [])
    .filter((s) => s.title && (s.url || s.comments_url))
    .slice(0, 15)
    .map((s) => ({
      id: `lb-${s.short_id}`,
      title: s.title,
      url: s.url || s.comments_url,
      source: 'lobsters',
      points: s.score ?? null,
      meta: `lobsters · ${(s.tags ?? []).slice(0, 3).join(', ')}`,
      createdAt: s.created_at ?? null,
      commentsUrl: s.comments_url ?? null,
      image: null,
    }));
}

export async function fetchLobsters() {
  const stories = await fetchJson('https://lobste.rs/hottest.json');
  return parseLobsters(stories);
}
```

- [ ] **Step 4: Expand FEEDS** in `src/sources/rss.js` — replace the `FEEDS` array with:

```js
export const FEEDS = [
  { name: 'techcrunch', url: 'https://techcrunch.com/category/startups/feed/' },
  { name: 'crunchbase-news', url: 'https://news.crunchbase.com/feed/' },
  { name: 'venturebeat', url: 'https://venturebeat.com/feed/' },
  { name: 'techmeme', url: 'https://www.techmeme.com/feed.xml' },
  { name: 'the-verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'ars-technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'tnw', url: 'https://thenextweb.com/feed' },
  { name: 'sifted', url: 'https://sifted.eu/feed' },
  { name: 'geekwire', url: 'https://www.geekwire.com/feed/' },
];
```

- [ ] **Step 5: Add a FEEDS assertion** to `tests/rss.test.js` (append inside the file, new describe block):

```js
import { FEEDS } from '../src/sources/rss.js';

describe('FEEDS', () => {
  it('includes the diversified feed set', () => {
    const names = FEEDS.map((f) => f.name);
    for (const must of ['techcrunch', 'techmeme', 'the-verge', 'ars-technica', 'tnw', 'sifted', 'geekwire']) {
      expect(names).toContain(must);
    }
    expect(FEEDS.every((f) => f.url.startsWith('https://'))).toBe(true);
  });
});
```

- [ ] **Step 6: Run all touched tests** — `npx vitest run tests/lobsters.test.js tests/rss.test.js` → PASS (existing rss test must still pass — per-feed cap of 10 and 48h filter are unchanged).

- [ ] **Step 7: Commit** — `git add src/sources/lobsters.js tests/lobsters.test.js src/sources/rss.js tests/rss.test.js && git commit -m "feat: lobsters source + 6 new rss feeds (techmeme, verge, ars, tnw, sifted, geekwire)"`

---

### Task 3: Media enrichment (`src/lib/media.js`, `src/lib/og.js`)

Pipeline-side image discovery: og:image scraping for top headlines/news (with a committed cache so each URL is fetched once, ever), plus pure URL builders for favicons and GitHub social images used by the frontend.

**Files:**
- Create: `src/lib/media.js`
- Create: `src/lib/og.js`
- Test: `tests/media.test.js`
- Modify: `src/sources/producthunt.js` (add thumbnail to query + parser)
- Modify: `tests/producthunt.test.js` (expect thumbnail mapping)

**Interfaces:**
- Consumes: `fetchText` from `src/lib/http.js`; `cheerio`; `node:fs`.
- Produces:
  - `domainOf(url: string): string|null` — hostname, `www.` stripped, null on junk.
  - `faviconUrl(domain: string|null): string|null` — DuckDuckGo icon service URL.
  - `ghSocialImage(fullName: string): string` — `https://opengraph.githubassets.com/1/<fullName>`.
  - `extractOgImage(html: string): string|null` — og:image → twitter:image → null; https URLs only.
  - `loadOgCache(path) / pruneOgCache(cache, now?)` — JSON cache, entries expire after 14 days.
  - `enrichWithOgImages(items, cachePath, {limit=14, delayMs=350}): Promise<items>` — mutates `item.image` in place for items lacking one; at most `limit` live fetches per run; failures cached as `null` (never refetched for 14 days); writes cache back.

- [ ] **Step 1: Write the failing test** — `tests/media.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { domainOf, faviconUrl, ghSocialImage } from '../src/lib/media.js';
import { extractOgImage, pruneOgCache } from '../src/lib/og.js';

describe('media urls', () => {
  it('domainOf strips www and rejects junk', () => {
    expect(domainOf('https://www.example.com/a/b?c=1')).toBe('example.com');
    expect(domainOf('https://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
    expect(domainOf('not a url')).toBe(null);
    expect(domainOf(null)).toBe(null);
  });

  it('faviconUrl builds the ddg icon url', () => {
    expect(faviconUrl('example.com')).toBe('https://icons.duckduckgo.com/ip3/example.com.ico');
    expect(faviconUrl(null)).toBe(null);
  });

  it('ghSocialImage builds the opengraph asset url', () => {
    expect(ghSocialImage('acme/tool')).toBe('https://opengraph.githubassets.com/1/acme/tool');
  });
});

describe('extractOgImage', () => {
  it('prefers og:image, falls back to twitter:image, requires https', () => {
    expect(extractOgImage('<meta property="og:image" content="https://x.com/a.png"><meta name="twitter:image" content="https://x.com/b.png">')).toBe('https://x.com/a.png');
    expect(extractOgImage('<meta name="twitter:image" content="https://x.com/b.png">')).toBe('https://x.com/b.png');
    expect(extractOgImage('<meta property="og:image" content="/relative.png">')).toBe(null);
    expect(extractOgImage('<p>nothing</p>')).toBe(null);
  });
});

describe('pruneOgCache', () => {
  it('drops entries older than 14 days', () => {
    const now = Date.now();
    const cache = {
      'https://fresh.com': { image: 'https://x.com/i.png', fetchedAt: now - 1000 },
      'https://stale.com': { image: null, fetchedAt: now - 15 * 24 * 3600 * 1000 },
    };
    const pruned = pruneOgCache(cache, now);
    expect(Object.keys(pruned)).toEqual(['https://fresh.com']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/media.test.js` → FAIL.

- [ ] **Step 3: Write `src/lib/media.js`:**

```js
export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function faviconUrl(domain) {
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
}

export function ghSocialImage(fullName) {
  return `https://opengraph.githubassets.com/1/${fullName}`;
}
```

- [ ] **Step 4: Write `src/lib/og.js`:**

```js
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchText } from './http.js';

const MAX_AGE_MS = 14 * 24 * 3600 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function extractOgImage(html) {
  const $ = cheerio.load(html);
  const img =
    $('meta[property="og:image"]').attr('content') ??
    $('meta[name="twitter:image"]').attr('content') ??
    null;
  return img && /^https:\/\//.test(img) ? img : null;
}

export function loadOgCache(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

export function pruneOgCache(cache, now = Date.now()) {
  const out = {};
  for (const [url, entry] of Object.entries(cache)) {
    if (now - entry.fetchedAt < MAX_AGE_MS) out[url] = entry;
  }
  return out;
}

export async function enrichWithOgImages(items, cachePath, { limit = 14, delayMs = 350 } = {}) {
  const cache = pruneOgCache(loadOgCache(cachePath));
  let fetched = 0;
  for (const item of items) {
    if (item.image != null) continue;
    if (!item.url || !/^https:\/\//.test(item.url)) continue;
    if (item.url in cache) {
      item.image = cache[item.url].image;
      continue;
    }
    if (fetched >= limit) continue;
    fetched++;
    try {
      const html = await fetchText(item.url, {}, { retries: 1, timeoutMs: 8000 });
      cache[item.url] = { image: extractOgImage(html), fetchedAt: Date.now() };
    } catch {
      cache[item.url] = { image: null, fetchedAt: Date.now() };
    }
    item.image = cache[item.url].image;
    await sleep(delayMs);
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  return items;
}
```

- [ ] **Step 5: Add Product Hunt thumbnails.** In `src/sources/producthunt.js`: add `thumbnail { url }` to the GraphQL node selection, and in `parsePhPosts` add `image: node.thumbnail?.url ?? null` to the mapped object. In `tests/producthunt.test.js`: add `thumbnail: { url: 'https://ph-files.imgix.net/cooltool.png' }` to the fixture node and `image: 'https://ph-files.imgix.net/cooltool.png'` to the expected object; also assert `parsePhPosts` maps a node WITHOUT thumbnail to `image: null` (extend the empty-data test or add a node).

- [ ] **Step 6: Run tests** — `npx vitest run tests/media.test.js tests/producthunt.test.js` → PASS.

- [ ] **Step 7: Commit** — `git add src/lib/media.js src/lib/og.js tests/media.test.js src/sources/producthunt.js tests/producthunt.test.js && git commit -m "feat: media enrichment (og:image cache, favicons, gh social, ph thumbnails)"`

---

### Task 4: Aggregate v2 + pipeline wiring

Community section, cross-source URL dedupe, MRR history sparkline data, domains on items, totalDelta, and run.js wiring for the three new capabilities.

**Files:**
- Modify: `src/aggregate.js`
- Modify: `tests/aggregate.test.js`
- Modify: `src/run.js`

**Interfaces:**
- Consumes: Tasks 1–3 exports; existing `loadRecentSnapshots`, `computeMrrDeltas`, all fetchers.
- Produces:
  - `normalizeUrl(url: string): string` — strips hash, `utm_*`/`ref` params, trailing slash.
  - `attachMrrHistory(mrrLeaderboard, previousSnapshots, {top=60, days=14})` — adds `history: number[]` (oldest→newest incl. today) to top N entries.
  - `buildSnapshot(inputs)` — now also accepts `community: Item[]`; sections gain `community`; items in headlines/launches/community/news gain `domain`; dedupes by `normalizeUrl(url)` with priority headlines > launches > community > news (first wins); `stats.totalDelta`.

- [ ] **Step 1: Write the failing tests** — append to `tests/aggregate.test.js`:

```js
import { normalizeUrl, attachMrrHistory } from '../src/aggregate.js';

describe('normalizeUrl', () => {
  it('strips utm params, hash, and trailing slash', () => {
    expect(normalizeUrl('https://ex.com/post/?utm_source=x&utm_medium=y#top')).toBe('https://ex.com/post');
    expect(normalizeUrl('https://ex.com/a?id=1&ref=hn')).toBe('https://ex.com/a?id=1');
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('attachMrrHistory', () => {
  it('builds oldest-first history ending with today', () => {
    const prev = [
      { sections: { mrrLeaderboard: [{ name: 'Alpha', mrr: 9400 }] } }, // newest previous
      { sections: { mrrLeaderboard: [{ name: 'Alpha', mrr: 9100 }] } }, // older
    ];
    const out = attachMrrHistory([{ name: 'Alpha', mrr: 9705 }], prev);
    expect(out[0].history).toEqual([9100, 9400, 9705]);
  });

  it('only decorates the top N entries', () => {
    const board = Array.from({ length: 65 }, (_, i) => ({ name: `S${i}`, mrr: 1000 - i }));
    const out = attachMrrHistory(board, [], { top: 60 });
    expect(out[59].history).toBeDefined();
    expect(out[64].history).toBeUndefined();
  });
});

describe('buildSnapshot v2', () => {
  const base = {
    date: '2026-07-09',
    headlines: [{ id: 'hn-1', title: 'A big story', url: 'https://ex.com/story?utm_source=hn', source: 'hackernews', points: 100, meta: null, createdAt: null }],
    showHn: [],
    launches: [],
    repos: [],
    mrrLeaderboard: [],
    filings: [],
    news: [{ id: 'rss-1', title: 'Same story from rss', url: 'https://ex.com/story/', source: 'rss:techmeme', points: null, meta: 'techmeme', createdAt: null }],
    community: [{ id: 'rd-1', title: 'We hit 40k MRR', url: 'https://red.dit/x', source: 'reddit:r/startups', points: 84, meta: 'r/startups · 12 comments', createdAt: null, commentsUrl: 'https://red.dit/x', image: null }],
    previousSnapshots: [{ stats: { totalItems: 600 }, sections: { emergingTopics: [] } }],
  };

  it('adds community section, dedupes by normalized url, attaches domains and totalDelta', () => {
    const snap = buildSnapshot(base);
    expect(snap.sections.community).toHaveLength(1);
    expect(snap.sections.news).toHaveLength(0); // deduped against headline
    expect(snap.sections.headlines[0].domain).toBe('ex.com');
    expect(snap.stats.sources.community).toBe(1);
    expect(snap.stats.totalDelta).toBe(snap.stats.totalItems - 600);
  });
});
```

- [ ] **Step 2: Run to verify new tests fail** — `npx vitest run tests/aggregate.test.js`.

- [ ] **Step 3: Implement in `src/aggregate.js`.** Add imports and new exports; extend `buildSnapshot`:

```js
import { domainOf } from './lib/media.js';

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/.test(key) || key === 'ref') u.searchParams.delete(key);
    }
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

export function attachMrrHistory(mrrLeaderboard, previousSnapshots, { top = 60, days = 14 } = {}) {
  const histByName = new Map();
  for (const snap of [...(previousSnapshots ?? [])].reverse()) { // oldest → newest
    for (const s of snap?.sections?.mrrLeaderboard ?? []) {
      if (s.mrr == null) continue;
      if (!histByName.has(s.name)) histByName.set(s.name, []);
      histByName.get(s.name).push(s.mrr);
    }
  }
  return mrrLeaderboard.map((s, i) => {
    if (i >= top) return s;
    const past = histByName.get(s.name) ?? [];
    const history = [...past, ...(s.mrr != null ? [s.mrr] : [])].slice(-days);
    return { ...s, history };
  });
}
```

In `buildSnapshot({ date, headlines, showHn, launches, repos, mrrLeaderboard, filings, news, community = [], previousSnapshots })`:
1. Build `mergedLaunches` as before.
2. Attach domains: `const withDomain = (arr) => arr.map((it) => ({ ...it, domain: it.domain ?? domainOf(it.url) }));` applied to headlines, mergedLaunches, community, news.
3. Dedupe in priority order headlines → launches → community → news: keep a `Set` of `normalizeUrl(it.url)`; drop later duplicates.
4. `topicSourceItems` now also includes community.
5. `sections.community` between `launches` and `mrrLeaderboard` keys.
6. `stats.totalDelta = previousSnapshots?.[0]?.stats?.totalItems != null ? totalItems - previousSnapshots[0].stats.totalItems : null`.

Keep every existing behavior identical (the existing buildSnapshot test must still pass — `community` defaults to `[]`).

- [ ] **Step 4: Wire `src/run.js`.** Add imports (`fetchRedditPulse`, `fetchLobsters`, `enrichWithOgImages`); add to the `Promise.all`:

```js
settle('reddit pulse', fetchRedditPulse()),
settle('lobsters', fetchLobsters()),
```

After sources settle, before buildSnapshot:

```js
const community = [...reddit, ...lobsters].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
const OG_CACHE = join(DATA_DIR, 'og-cache.json');
await enrichWithOgImages(headlines.slice(0, 14), OG_CACHE, { limit: 10 });
await enrichWithOgImages(news.slice(0, 10), OG_CACHE, { limit: 8 });
```

Pass `community` into `buildSnapshot`. (`data/og-cache.json` is committed by the existing CI `git add data/` step — that persistence is the point.)

- [ ] **Step 5: Run the full suite then the live pipeline** — `npx vitest run` → all pass. `npm run pipeline` → expect `✓ lobsters: 15 items`; reddit may be `✓ 30` or a warned failure (both acceptable); `data/latest.json` has `sections.community`, headline `image`/`domain` fields, `og-cache.json` exists.

- [ ] **Step 6: Commit** — `git add src/aggregate.js tests/aggregate.test.js src/run.js data/ && git commit -m "feat: snapshot v2 (community, dedupe, mrr history, og enrichment)"`

---

### Task 5: Frontend structure + design system (`index.html`, `styles.css`)

Full rewrite to the Design Direction. This task lands the DOM contract and every visual token; Task 6 rewrites `app.js` against this exact DOM. (Between the two commits the deployed site would be inconsistent — do NOT push until Task 7.)

**Files:**
- Rewrite: `index.html`
- Rewrite: `styles.css`

**Interfaces:**
- Produces (DOM contract Task 6 depends on): elements with IDs `#date-badge`, `#search`, `#theme-toggle`, `#ticker`, `#stats-row`, `#tabs` (buttons with `data-tab` ∈ all|headlines|launches|mrr|community|repos|filings|news), `#grid`, `#generated-at`. CSS classes exactly as used below.

- [ ] **Step 1: Write `index.html`:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Startup Pulse — Daily Startup Intelligence</title>
  <meta name="description" content="A daily-refreshed dashboard of startup news, launches, verified-MRR leaders, SEC Form D filings, community chatter, and emerging fields." />
  <meta name="theme-color" content="#0C0C0B" />
  <script>(function(){var t=localStorage.getItem('sp-theme');if(t)document.documentElement.dataset.theme=t;})();</script>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Startup Pulse — Daily Startup Intelligence" />
  <meta property="og:description" content="News, launches, verified MRR, SEC Form D filings, community chatter, and emerging fields — refreshed daily, $0/month." />
  <meta property="og:url" content="https://brianboler.github.io/startupdashboard/" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" type="image/svg+xml" href="FAVICON_DATA_URI" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="masthead">
    <a class="wordmark" href="./">STARTUP&nbsp;PULSE<span class="cursor" aria-hidden="true">▮</span></a>
    <span class="date-badge" id="date-badge">—</span>
    <div class="masthead-tools">
      <input id="search" type="search" placeholder="Search everything (/)" autocomplete="off" />
      <button id="theme-toggle" type="button" aria-label="Switch theme">◐</button>
    </div>
  </header>

  <div class="ticker" id="ticker" aria-label="Today's movers"></div>

  <section class="statbar" id="stats-row"></section>

  <nav class="tabs" id="tabs" aria-label="Sections">
    <button class="tab active" data-tab="all">Overview</button>
    <button class="tab" data-tab="headlines">Headlines</button>
    <button class="tab" data-tab="launches">Launches</button>
    <button class="tab" data-tab="mrr">MRR leaders</button>
    <button class="tab" data-tab="community">Community</button>
    <button class="tab" data-tab="repos">New repos</button>
    <button class="tab" data-tab="filings">Form D</button>
    <button class="tab" data-tab="news">News</button>
  </nav>

  <main class="layout" id="grid"></main>

  <footer class="footer">
    <span id="generated-at"></span>
    <span>HN · GitHub · TrustMRR · Product Hunt · SEC EDGAR · Reddit · Lobsters · RSS</span>
  </footer>

  <script src="app.js"></script>
</body>
</html>
```

Replace `FAVICON_DATA_URI` with the output of:

```bash
printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0C0C0B"/><rect x="9" y="8" width="6" height="16" fill="#FFB224"/><rect x="19" y="14" width="4" height="10" fill="#3FB950"/></svg>' | base64 | tr -d '\n' | sed 's/^/data:image\/svg+xml;base64,/'
```

- [ ] **Step 2: Write `styles.css`** (complete file; tokens from the Design Direction table are law):

```css
:root {
  --bg: #0C0C0B; --surface: #141412; --surface-2: #1B1B18; --hairline: #262620;
  --text: #EDEAE3; --dim: #96938A; --amber: #FFB224; --up: #3FB950; --down: #F85149;
  --radius: 6px;
  --mono: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px;
}
[data-theme="light"] {
  --bg: #F7F5F0; --surface: #FFFFFF; --surface-2: #EFECE4; --hairline: #E2DFD5;
  --text: #1C1B16; --dim: #6E6A5E; --amber: #9A6700; --up: #1A7F37; --down: #CF222E;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]):not([data-theme="light"]) {
    --bg: #F7F5F0; --surface: #FFFFFF; --surface-2: #EFECE4; --hairline: #E2DFD5;
    --text: #1C1B16; --dim: #6E6A5E; --amber: #9A6700; --up: #1A7F37; --down: #CF222E;
  }
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: var(--sans); min-height: 100vh; }
a { color: inherit; }
::selection { background: var(--amber); color: var(--bg); }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
img { max-width: 100%; }

/* Masthead */
.masthead {
  display: flex; align-items: center; gap: 14px; padding: 12px 24px;
  border-bottom: 1px solid var(--hairline); position: sticky; top: 0; z-index: 20;
  background: var(--bg);
}
.wordmark {
  font-family: var(--mono); font-size: 0.95rem; font-weight: 700; letter-spacing: 0.18em;
  text-decoration: none; white-space: nowrap;
}
.cursor { color: var(--amber); animation: blink 1.1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.date-badge { font-family: var(--mono); font-size: 0.72rem; color: var(--dim); letter-spacing: 0.06em; }
.masthead-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; }
#search {
  background: var(--surface); border: 1px solid var(--hairline); color: var(--text);
  font-family: var(--mono); font-size: 0.8rem; padding: 7px 12px; border-radius: var(--radius);
  width: min(320px, 38vw);
}
#search:focus { border-color: var(--amber); outline: none; }
#search::placeholder { color: var(--dim); }
#theme-toggle {
  background: none; border: 1px solid var(--hairline); color: var(--dim); cursor: pointer;
  font-size: 0.95rem; line-height: 1; padding: 7px 10px; border-radius: var(--radius);
}
#theme-toggle:hover { color: var(--amber); border-color: var(--amber); }

/* Ticker tape (signature) */
.ticker { border-bottom: 1px solid var(--hairline); overflow: hidden; background: var(--surface); }
.ticker:empty { display: none; }
.ticker-track {
  display: inline-flex; align-items: center; gap: 28px; padding: 8px 0;
  white-space: nowrap; animation: tape 75s linear infinite; will-change: transform;
}
.ticker:hover .ticker-track { animation-play-state: paused; }
@keyframes tape { to { transform: translateX(-50%); } }
.tick { font-family: var(--mono); font-size: 0.76rem; color: var(--dim); text-decoration: none; }
.tick:hover { color: var(--text); }
.tick b { font-weight: 600; }
.tick .up { color: var(--up); } .tick .down { color: var(--down); } .tick .amber { color: var(--amber); }
.tick-sep { color: var(--hairline); }

/* Stat bar */
.statbar { display: flex; flex-wrap: wrap; padding: 14px 24px 2px; }
.stat { padding: 4px 20px 4px 0; margin-right: 20px; border-right: 1px solid var(--hairline); }
.stat:last-child { border-right: 0; }
.stat .num { font-family: var(--mono); font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat .num .tdelta { font-size: 0.72rem; font-weight: 600; margin-left: 6px; }
.stat .label { font-family: var(--mono); font-size: 0.66rem; color: var(--dim); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }

/* Tabs */
.tabs { display: flex; gap: 2px; padding: 10px 24px 0; flex-wrap: wrap; border-bottom: 1px solid var(--hairline); }
.tab {
  background: none; border: 0; border-bottom: 2px solid transparent; color: var(--dim);
  font-family: var(--sans); font-size: 0.84rem; padding: 8px 12px; cursor: pointer;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--text); border-bottom-color: var(--amber); }

/* Layout */
.layout { display: grid; grid-template-columns: 58fr 42fr; gap: 18px; padding: 18px 24px 36px; align-items: start; }
.col-main, .col-rail { display: grid; gap: 18px; min-width: 0; }

/* Panels */
.panel { background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--radius); overflow: hidden; }
.panel > h2 {
  font-family: var(--mono); font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--dim); padding: 12px 16px 8px;
  display: flex; justify-content: space-between;
}
.panel > h2 .count { color: var(--amber); }
.panel ul { list-style: none; max-height: 520px; overflow-y: auto; scrollbar-width: thin; }
.panel li { border-top: 1px solid var(--hairline); animation: rise 0.3s ease-out both; }
.panel li:hover { background: var(--surface-2); }
@keyframes rise { from { opacity: 0; transform: translateY(4px); } }

/* Item rows */
.row { display: flex; gap: 12px; padding: 10px 16px; text-decoration: none; }
.thumbbox { flex: 0 0 64px; }
.thumb { width: 64px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--hairline); display: block; }
.row-body { min-width: 0; }
.item-title { font-size: 0.92rem; font-weight: 550; line-height: 1.35; }
.item-meta {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 3px;
  font-family: var(--mono); font-size: 0.72rem; color: var(--dim);
}
.fav { width: 14px; height: 14px; border-radius: 3px; }
.pts { color: var(--text); font-weight: 600; }
.cmt { color: var(--dim); text-decoration: none; }
.cmt:hover { color: var(--amber); }
.delta-up { color: var(--up); font-weight: 600; } .delta-down { color: var(--down); font-weight: 600; }
.amber { color: var(--amber); }

/* MRR table */
.mrr-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.mrr-scroll { max-height: 560px; overflow: auto; scrollbar-width: thin; }
.mrr-table th {
  font-family: var(--mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--dim); text-align: left; padding: 8px 10px; border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline); background: var(--surface); position: sticky; top: 0;
  cursor: pointer; user-select: none;
}
.mrr-table th:hover, .mrr-table th.sorted { color: var(--amber); }
.mrr-table td { padding: 7px 10px; border-top: 1px solid var(--hairline); font-size: 0.84rem; }
.mrr-table td.num { font-family: var(--mono); font-size: 0.8rem; }
.mrr-table tr:hover td { background: var(--surface-2); }
.rank { color: var(--dim); font-family: var(--mono); font-size: 0.74rem; }
.mrr-name { font-weight: 550; text-decoration: none; }
.mrr-name:hover { color: var(--amber); }
.spark { display: block; }

/* Topic chips */
.topic-cloud { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 16px 14px; }
.topic-chip {
  background: none; border: 1px solid var(--hairline); border-radius: 4px; padding: 4px 10px;
  font-family: var(--mono); font-size: 0.74rem; color: var(--text); cursor: pointer;
}
.topic-chip:hover { border-color: var(--amber); color: var(--amber); }
.topic-chip .vel { color: var(--amber); margin-left: 5px; }

.footer {
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 24px 24px; border-top: 1px solid var(--hairline);
  font-family: var(--mono); font-size: 0.7rem; color: var(--dim);
}
.empty { padding: 16px; color: var(--dim); font-size: 0.82rem; }
.hidden { display: none !important; }

@media (max-width: 980px) {
  .layout { grid-template-columns: 1fr; }
  .masthead { flex-wrap: wrap; }
  .masthead-tools { width: 100%; margin-left: 0; }
  #search { width: 100%; flex: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .cursor { animation: none; }
  .ticker-track { animation: none; }
  .ticker { overflow-x: auto; }
  .panel li { animation: none; }
}
```

- [ ] **Step 3: Sanity check** — open `index.html` raw in a browser (`npx serve . -l 4173` or `python3 -m http.server 4173`); the shell must show masthead, empty ticker collapsed, tabs, and empty main — no console errors from CSS/HTML (app.js is still the OLD one and will error against the new DOM: that is expected until Task 6; do not "fix" app.js in this task).

- [ ] **Step 4: Commit** — `git add index.html styles.css && git commit -m "feat: terminal design system + layout shell (amber phosphor, no gradients)"`

---

### Task 6: Frontend interactivity (`app.js` rewrite)

**Files:**
- Rewrite: `app.js`

**Interfaces:**
- Consumes: Snapshot Schema v2 (top of this plan) via `fetch('data/latest.json')`; Task 5's DOM contract.
- Produces: the shipped UI behavior.

- [ ] **Step 1: Write `app.js`** (complete file):

```js
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = (n) =>
  n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n}`;
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };
const relTime = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s) || s < 0) return '';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

function countUp(el, target, ms = 650) {
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min((t - start) / ms, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function favImg(item) {
  const dom = item.domain ?? domainOf(item.url);
  return dom ? `<img class="fav" loading="lazy" referrerpolicy="no-referrer" alt=""
    src="https://icons.duckduckgo.com/ip3/${esc(dom)}.ico" onerror="this.remove()">` : '';
}

function thumbImg(src) {
  return src ? `<span class="thumbbox"><img class="thumb" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""
    src="${esc(src)}" onerror="this.closest('.thumbbox').remove()"></span>` : '';
}

function itemLi(item, { thumb = false, ghImage = false } = {}) {
  const img = thumb ? thumbImg(ghImage ? `https://opengraph.githubassets.com/1/${esc(item.title)}` : item.image) : '';
  const comments = item.commentsUrl && item.commentsUrl !== item.url
    ? ` <a class="cmt" href="${esc(item.commentsUrl)}" target="_blank" rel="noopener">↳ thread</a>` : '';
  return `<li data-search="${esc(`${item.title} ${item.meta ?? ''} ${item.source}`.toLowerCase())}">
    <a class="row" href="${esc(item.url)}" target="_blank" rel="noopener">
      ${img}
      <span class="row-body">
        <div class="item-title">${esc(item.title)}</div>
        <div class="item-meta">
          ${favImg(item)}
          ${item.points != null ? `<span class="pts">${item.points}</span>` : ''}
          ${item.meta ? `<span>${esc(item.meta)}</span>` : ''}
          ${item.createdAt ? `<span>${relTime(item.createdAt)}</span>` : ''}${comments}
        </div>
      </span>
    </a>
  </li>`;
}

function filingLi(f) {
  const date = `${f.dateFiled.slice(0, 4)}-${f.dateFiled.slice(4, 6)}-${f.dateFiled.slice(6, 8)}`;
  return `<li data-search="${esc(f.company.toLowerCase())}">
    <a class="row" href="${esc(f.url)}" target="_blank" rel="noopener">
      <span class="row-body">
        <div class="item-title">${esc(f.company)}</div>
        <div class="item-meta"><span class="amber">FORM ${esc(f.formType)}</span><span>${date}</span><span>CIK ${esc(f.cik)}</span></div>
      </span>
    </a>
  </li>`;
}

function sparkline(values, w = 72, h = 20) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) =>
    `${(1 + (i / (values.length - 1)) * (w - 2)).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`
  ).join(' ');
  const up = values[values.length - 1] >= values[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="var(--${up ? 'up' : 'down'})" stroke-width="1.5"/></svg>`;
}

/* ---- MRR sortable table ---- */
let mrrData = [];
let mrrSort = { key: 'rank', dir: 1 };

function mrrDelta(s) {
  if (s.mrrDelta == null || s.mrrDelta === 0) return '<span class="rank">—</span>';
  return s.mrrDelta > 0
    ? `<span class="delta-up">▲ ${fmtMoney(s.mrrDelta)}</span>`
    : `<span class="delta-down">▼ ${fmtMoney(-s.mrrDelta)}</span>`;
}

function renderMrrBody() {
  const { key, dir } = mrrSort;
  const sorted = [...mrrData].sort((a, b) => {
    const av = key === 'rank' ? a.rank : key === 'name' ? a.name?.toLowerCase() : a[key];
    const bv = key === 'rank' ? b.rank : key === 'name' ? b.name?.toLowerCase() : b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });
  $('#mrr-body').innerHTML = sorted.map((s) => `
    <tr data-search="${esc((s.name ?? '').toLowerCase())}">
      <td class="rank">${s.rank}</td>
      <td>${s.url ? `<a class="mrr-name" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : `<span class="mrr-name">${esc(s.name)}</span>`}</td>
      <td class="num">${fmtMoney(s.mrr)}</td>
      <td class="num">${mrrDelta(s)}</td>
      <td>${sparkline(s.history)}</td>
    </tr>`).join('');
  document.querySelectorAll('.mrr-table th').forEach((th) =>
    th.classList.toggle('sorted', th.dataset.key === key));
  applySearch($('#search').value);
}

function mrrPanel(board) {
  mrrData = board.map((s, i) => ({ ...s, rank: i + 1 }));
  return `<section class="panel" data-panel="mrr">
    <h2>MRR leaders <span class="count">${board.length}</span></h2>
    <div class="mrr-scroll"><table class="mrr-table">
      <thead><tr>
        <th data-key="rank">#</th><th data-key="name">Startup</th>
        <th data-key="mrr">MRR</th><th data-key="mrrDelta">Δ day</th><th data-key="history">14d</th>
      </tr></thead>
      <tbody id="mrr-body"></tbody>
    </table></div>
  </section>`;
}

/* ---- Ticker (signature) ---- */
function buildTicker(s) {
  const chips = [];
  for (const m of (s.mrrLeaderboard ?? [])
    .filter((x) => x.mrrDelta)
    .sort((a, b) => Math.abs(b.mrrDelta) - Math.abs(a.mrrDelta)).slice(0, 12)) {
    const cls = m.mrrDelta > 0 ? 'up' : 'down';
    const arrow = m.mrrDelta > 0 ? '▲' : '▼';
    chips.push(`<a class="tick" href="${esc(m.url ?? '#')}" target="_blank" rel="noopener">${esc(m.name)} <b class="${cls}">${arrow} ${fmtMoney(Math.abs(m.mrrDelta))}</b></a>`);
  }
  for (const f of (s.formDFilings ?? []).slice(0, 8)) {
    chips.push(`<a class="tick" href="${esc(f.url)}" target="_blank" rel="noopener"><b class="amber">FORM ${esc(f.formType)}</b> ${esc(f.company)}</a>`);
  }
  for (const r of (s.trendingRepos ?? []).slice(0, 5)) {
    chips.push(`<a class="tick" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} <b class="up">★ ${(r.points ?? 0).toLocaleString()}</b></a>`);
  }
  if (!chips.length) return '';
  const seg = chips.join('<span class="tick-sep">·</span>') + '<span class="tick-sep">·</span>';
  return `<div class="ticker-track">${seg}${seg}</div>`; // duplicated for seamless -50% loop
}

function panel(key, title, lis, extraHtml = '') {
  return `<section class="panel" data-panel="${key}">
    <h2>${title} <span class="count">${lis.length}</span></h2>
    ${extraHtml}
    <ul>${lis.length ? lis.join('') : '<div class="empty">Nothing here yet today. The pipeline refreshes at 11:00 UTC.</div>'}</ul>
  </section>`;
}

const PANEL_TABS = {
  headlines: ['headlines'], launches: ['launches'], mrr: ['mrr'], community: ['community'],
  repos: ['repos'], filings: ['filings'], news: ['news'],
};

function applySearch(qRaw) {
  const q = qRaw.trim().toLowerCase();
  document.querySelectorAll('[data-search]').forEach((el) => {
    el.classList.toggle('hidden', q !== '' && !el.dataset.search.includes(q));
  });
}

async function main() {
  let snap;
  try {
    snap = await (await fetch('data/latest.json', { cache: 'no-store' })).json();
  } catch {
    $('#grid').innerHTML = '<div class="empty">Could not load data/latest.json. Run <code>npm run pipeline</code>, then reload.</div>';
    return;
  }
  const s = snap.sections;
  const community = s.community ?? [];

  $('#date-badge').textContent = snap.date;
  $('#generated-at').textContent = `Generated ${new Date(snap.generatedAt).toLocaleString()}`;
  $('#ticker').innerHTML = buildTicker(s);

  const td = snap.stats.totalDelta;
  const tdHtml = td == null || td === 0 ? '' :
    `<span class="tdelta ${td > 0 ? 'delta-up' : 'delta-down'}">${td > 0 ? '▲' : '▼'}${Math.abs(td)}</span>`;
  const chips = [
    ['Items today', snap.stats.totalItems, tdHtml],
    ['Headlines', s.headlines.length, ''],
    ['Launches', s.launches.length, ''],
    ['MRR tracked', s.mrrLeaderboard.length, ''],
    ['Community', community.length, ''],
    ['Repos', s.trendingRepos.length, ''],
    ['Filings', s.formDFilings.length, ''],
  ];
  $('#stats-row').innerHTML = chips.map(([label, , extra]) =>
    `<div class="stat"><div class="num"><span>0</span>${extra}</div><div class="label">${label}</div></div>`).join('');
  document.querySelectorAll('.stat .num > span').forEach((el, i) => countUp(el, chips[i][1]));

  const topicChips = (s.emergingTopics ?? []).map((t) =>
    `<button class="topic-chip" data-term="${esc(t.term)}" title="count ${t.count}">${esc(t.term)}<span class="vel">×${t.velocity.toFixed(1)}</span></button>`).join('');

  $('#grid').innerHTML = `
    <div class="col-main">
      ${panel('headlines', 'Headlines', s.headlines.map((i) => itemLi(i, { thumb: true })))}
      ${panel('community', 'Community', community.map((i) => itemLi(i, { thumb: true })))}
      ${panel('news', 'News', s.news.map((i) => itemLi(i, { thumb: true })))}
    </div>
    <div class="col-rail">
      ${mrrPanel(s.mrrLeaderboard)}
      ${panel('launches', 'Launches', s.launches.map((i) => itemLi(i, { thumb: true })))}
      ${panel('repos', 'New repos', s.trendingRepos.map((i) => itemLi(i, { thumb: true, ghImage: true })))}
      ${panel('filings', 'Form D filings', s.formDFilings.map(filingLi))}
      ${panel('topics', 'Emerging fields', [], `<div class="topic-cloud">${topicChips || '<span class="empty">Velocity builds after a few days of snapshots.</span>'}</div>`)}
    </div>`;
  renderMrrBody();

  /* Tabs + keyboard 1-8 */
  const tabs = [...document.querySelectorAll('.tab')];
  const activateTab = (tab) => {
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    const key = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach((p) => {
      const show = key === 'all' || (PANEL_TABS[key] ?? []).includes(p.dataset.panel);
      p.classList.toggle('hidden', !show);
    });
  };
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) activateTab(tab);
  });

  /* Search */
  const search = $('#search');
  search.addEventListener('input', () => applySearch(search.value));
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); }
    else if (e.key === 'Escape' && typing) { search.value = ''; applySearch(''); search.blur(); }
    else if (!typing && /^[1-8]$/.test(e.key) && tabs[e.key - 1]) activateTab(tabs[e.key - 1]);
  });

  /* Topic chips filter the search */
  $('#grid').addEventListener('click', (e) => {
    const chip = e.target.closest('.topic-chip');
    if (!chip) return;
    search.value = chip.dataset.term;
    applySearch(chip.dataset.term);
  });

  /* MRR sort */
  $('#grid').addEventListener('click', (e) => {
    const th = e.target.closest('.mrr-table th');
    if (!th) return;
    const key = th.dataset.key;
    mrrSort = { key, dir: mrrSort.key === key ? -mrrSort.dir : (key === 'name' || key === 'rank' ? 1 : -1) };
    renderMrrBody();
  });

  /* Theme toggle */
  $('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme
      ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('sp-theme', next);
  });
}

main();
```

- [ ] **Step 2: Syntax check** — `node --check app.js` → OK.

- [ ] **Step 3: Manual browser verify** — serve locally (`python3 -m http.server 4173`), open `http://localhost:4173`. Check: ticker scrolls with real movers and pauses on hover; NO purple anywhere; stat bar counts up with the vs-yesterday delta; MRR table sorts by each column; sparklines render for entries with `history` (first day after Task 4's pipeline run they may be 2 points or absent — fine); thumbnails/favicons load lazily and vanish gracefully when blocked; tabs, `/` search, Escape, 1–8 keys work; theme toggle flips and persists on reload; reduced-motion (macOS: System Settings → Accessibility → Display → Reduce motion) stops ticker + cursor. Zero console errors.

- [ ] **Step 4: Commit** — `git add app.js && git commit -m "feat: interactive terminal ui (ticker, sortable mrr + sparklines, themes)"`

---

### Task 7: Verification harness + ship

**Files:**
- Create: `tools/render-check.mjs`
- Modify: `package.json` (jsdom devDep + `verify:render` script)
- Modify: `.github/workflows/daily.yml` (add render check step)
- Modify: `README.md` (sources, secrets, design note)

**Interfaces:**
- Consumes: everything.
- Produces: `npm run verify:render` — headless jsdom render of the real `index.html` + `app.js` + `data/latest.json` asserting panels/rows/ticker populate with zero JS errors; the deployed site.

- [ ] **Step 1:** `npm install --save-dev jsdom` (approved by this plan), add script `"verify:render": "node tools/render-check.mjs"`.

- [ ] **Step 2: Write `tools/render-check.mjs`:**

```js
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
const ok = report.panels >= 8 && report.rows > 80 && report.mrrRows > 50 &&
  report.tickerChips > 5 && report.statCells === 7 && !report.loadError && errors.length === 0;
console.log(ok ? 'RENDER_CHECK: PASS' : 'RENDER_CHECK: FAIL');
process.exit(ok ? 0 : 1);
```

- [ ] **Step 3:** Add to `.github/workflows/daily.yml` after the "Run tests" step:

```yaml
      - name: Verify dashboard renders
        run: npm run verify:render
```

- [ ] **Step 4: Update `README.md`:** add Reddit + Lobsters + new feeds to the sources list; add secrets rows `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` ("optional — create a **script** app at https://www.reddit.com/prefs/apps, redirect URI can be `http://localhost:8080` (unused); then `gh secret set REDDIT_CLIENT_ID` and `gh secret set REDDIT_CLIENT_SECRET`"); note the design direction ("amber terminal, light/dark, no external fonts/JS; images hotlinked with graceful fallback").

- [ ] **Step 5: Full verification sweep:**

```bash
npx vitest run          # ~37+ tests, all pass
npm run pipeline        # all sources ✓ (reddit may warn — acceptable)
npm run verify:render   # RENDER_CHECK: PASS
```

- [ ] **Step 6: Ship** — commit remaining files, push, `gh workflow run daily.yml`, `gh run watch` until green (the new render-check step must pass in CI), then verify live: `curl -s https://brianboler.github.io/startupdashboard/ | grep -c FFB224` ≥ 1 (may take ~1 min for Pages rebuild) and load the URL — ticker visible, no purple.

- [ ] **Step 7: Tell the human** to (optionally) create the Reddit script app and set the two secrets — reddit data appears on the next daily run.

---

## Self-Review Notes

- **Spec coverage:** less vibe-coded UI (Design Direction + anti-goals, Tasks 5–6) ✅; dynamic/interactive (ticker, sortable table, sparklines, themes, keyboard, topic-chip filtering) ✅; images/icons from sites (Task 3 + frontend `favImg`/`thumbImg`/GH social images) ✅; diverse news sources (Task 2: +6 feeds, Lobsters) ✅; Reddit JSON API per the TIL, hardened for 2026 reality (Task 1: OAuth-first, 403-tolerant, multireddit batching, niche subs incl. self-promo communities) ✅.
- **Verified live before planning (2026-07-08):** reddit unauthenticated = 403 from test network (both www and old, any UA); lobste.rs/hottest.json = 200; all six new RSS feeds = 200.
- **Type consistency:** `commentsUrl`/`image` produced by reddit+lobsters parsers → carried through aggregate untouched → consumed by `itemLi`. `history` produced by `attachMrrHistory` → consumed by `sparkline`. `domain` produced in aggregate via `domainOf` → consumed by `favImg` (with client-side fallback for old snapshots). `community` defaults to `[]` everywhere.
- **Backward compat:** frontend null-checks all v2 fields, so pre-boost snapshots in `data/history/` still render.
- **Risk register:** (1) Reddit may 403 even from GitHub Actions IPs without OAuth — source stays optional; user can add secrets anytime. (2) Hotlinked og:images may be blocked by some origins — `onerror` removes them, text layout unaffected. (3) The two-commit frontend rewrite (Tasks 5→6) leaves the working tree inconsistent between them — nothing is pushed until Task 7.
