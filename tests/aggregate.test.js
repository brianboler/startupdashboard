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
