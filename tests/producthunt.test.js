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
