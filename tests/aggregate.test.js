import { describe, it, expect } from 'vitest';
import { extractTerms, scoreEmergingTopics, buildSnapshot, normalizeUrl, attachMrrHistory, scoreHeadlineRelevance, curateHeadlines } from '../src/aggregate.js';

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

describe('scoreHeadlineRelevance', () => {
  it('scores startup/tech terms and ignores substrings (ai != brain)', () => {
    expect(scoreHeadlineRelevance('Mesh LLM: distributed AI computing')).toBeGreaterThanOrEqual(2);
    expect(scoreHeadlineRelevance('Startup raises $40M Series B')).toBeGreaterThanOrEqual(2);
    expect(scoreHeadlineRelevance('Modern decor may be straining brains')).toBe(0);
    expect(scoreHeadlineRelevance('Prefer strict tables in SQLite')).toBe(0);
  });
});

describe('curateHeadlines', () => {
  const hn = [
    { id: 'hn-1', title: 'Show HN: my side project', url: 'https://x.com/show', source: 'hackernews', points: 300 },
    { id: 'hn-2', title: 'The early history of SVD (1993) [pdf]', url: 'https://x.com/svd', source: 'hackernews', points: 250 },
    { id: 'hn-3', title: 'Nvidia acquires AI startup for $2B', url: 'https://x.com/nv', source: 'hackernews', points: 200 },
  ];
  const news = [
    { id: 'rss-1', title: 'Fintech startup raises Series A', url: 'https://tc.com/a', source: 'rss:techcrunch', points: null },
  ];

  it('drops Show HN promo and irrelevant HN, keeps relevant HN + all RSS', () => {
    const out = curateHeadlines(hn, news);
    const ids = out.map((h) => h.id);
    expect(ids).not.toContain('hn-1'); // Show HN promo
    expect(ids).not.toContain('hn-2'); // irrelevant (SVD paper)
    expect(ids).toContain('hn-3');     // Nvidia/AI/startup/acquires — relevant
    expect(ids).toContain('rss-1');    // RSS startup news
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `rss-${i}`, title: `Startup funding news ${i}`, url: `https://n.com/${i}`, source: 'rss:x', points: null }));
    expect(curateHeadlines([], many, { limit: 10 })).toHaveLength(10);
  });
});
