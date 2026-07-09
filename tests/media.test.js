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
