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
