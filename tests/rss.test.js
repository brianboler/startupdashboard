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
