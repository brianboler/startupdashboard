import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrustMrr, parseMoney, isAnonymousName, mapApiStartup } from '../src/sources/trustmrr.js';

describe('mapApiStartup', () => {
  const sample = {
    name: 'Stan', slug: 'stan', website: 'https://stan.store',
    url: 'https://trustmrr.com/startup/stan', icon: 'https://cdn.example.com/stan.png',
    revenue: { last30Days: 2844652, mrr: 3569654, total: 76627685 },
    growth30d: -7.602785, growthMRR30d: 0.42784,
    visitorsLast30Days: 120000, revenuePerVisitor: 1.66, description: '  Link in bio  ',
  };

  it('maps an API record to the common shape (website as url, last30Days revenue primary)', () => {
    const s = mapApiStartup(sample);
    expect(s).toMatchObject({
      name: 'Stan', url: 'https://stan.store', logo: 'https://cdn.example.com/stan.png',
      mrr: 2844652, mrrValue: 3569654, totalRevenue: 76627685,
      traffic: 120000, revPerVisitor: 1.66, description: 'Link in bio',
    });
    expect(s.growthPct).toBeCloseTo(-7.6, 1);
  });

  it('returns null for nameless records and null-fills missing metrics', () => {
    expect(mapApiStartup({})).toBe(null);
    const s = mapApiStartup({ name: 'X', revenue: { last30Days: 100 } });
    expect(s.mrr).toBe(100);
    expect(s.mrrValue).toBe(null);
    expect(s.traffic).toBe(null);
  });
});

describe('isAnonymousName', () => {
  it('flags TrustMRR placeholder names', () => {
    for (const n of [
      'Stealth Company', 'Stealth Venture', 'Stealth 02', 'Hidden Business',
      'Hidden Company', 'Hidden Digital Business', 'Private Venture', 'Unnamed Company',
      'Anonymous Startup', 'anonymous-startup-2', 'Confidential Startup',
      'Stealth Company (Global Job Board)', '', '   ', null,
    ]) {
      expect(isAnonymousName(n)).toBe(true);
    }
  });

  it('keeps real company names', () => {
    for (const n of [
      'Gumroad', 'Stan', 'easytools', 'Avenue Ticketing, Inc.', 'Maverick Intelligence, Inc.',
      'Private Internet Access', 'Hidden Ridge Labs', 'Stealthburner 3D',
    ]) {
      expect(isAnonymousName(n)).toBe(false);
    }
  });
});

describe('parseMoney', () => {
  it('parses plain dollars', () => expect(parseMoney('$980')).toBe(980));
  it('parses k suffix', () => expect(parseMoney('$12.4k')).toBe(12400));
  it('parses M suffix', () => expect(parseMoney('$1.2M')).toBe(1200000));
  it('parses commas', () => expect(parseMoney('$1,250')).toBe(1250));
  it('returns null for junk', () => expect(parseMoney('n/a')).toBe(null));
});

describe('parseTrustMrr (against live fixture)', () => {
  const html = readFileSync('tests/fixtures/trustmrr.html', 'utf8');
  const startups = parseTrustMrr(html);

  it('extracts at least 5 startups', () => {
    expect(startups.length).toBeGreaterThanOrEqual(5);
  });

  it('every startup has a name and a numeric or null mrr', () => {
    for (const s of startups) {
      expect(typeof s.name).toBe('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.mrr === null || typeof s.mrr === 'number').toBe(true);
    }
  });

  it('at least one startup has a parsed MRR value', () => {
    expect(startups.some((s) => typeof s.mrr === 'number' && s.mrr > 0)).toBe(true);
  });

  it('extracts company logos as https URLs', () => {
    const withLogo = startups.filter((s) => s.logo);
    expect(withLogo.length).toBeGreaterThan(20);
    expect(withLogo.every((s) => /^https:\/\//.test(s.logo))).toBe(true);
  });

  it('extracts the full metric set (mrr, total revenue, growth, traffic, $/visitor)', () => {
    expect(startups.filter((s) => typeof s.mrrValue === 'number').length).toBeGreaterThan(50);
    expect(startups.filter((s) => typeof s.totalRevenue === 'number').length).toBeGreaterThan(50);
    expect(startups.filter((s) => typeof s.mrrGrowth === 'number').length).toBeGreaterThan(50);
    expect(startups.filter((s) => typeof s.traffic === 'number').length).toBeGreaterThan(20);
    expect(startups.filter((s) => typeof s.revPerVisitor === 'number').length).toBeGreaterThan(20);
  });
});
