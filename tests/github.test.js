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
