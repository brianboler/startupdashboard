import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrustMrr, parseMoney, isAnonymousName } from '../src/sources/trustmrr.js';

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
});
