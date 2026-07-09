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
