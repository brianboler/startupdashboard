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
