import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveSnapshot, loadRecentSnapshots, computeMrrDeltas } from '../src/lib/snapshot.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'snap-')); });

describe('saveSnapshot / loadRecentSnapshots', () => {
  it('writes latest.json and a dated history file', () => {
    saveSnapshot({ date: '2026-07-08', sections: {} }, dir);
    expect(existsSync(join(dir, 'latest.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'history/2026-07-08.json'), 'utf8')).date).toBe('2026-07-08');
  });

  it('loads recent snapshots newest first', () => {
    saveSnapshot({ date: '2026-07-06' }, dir);
    saveSnapshot({ date: '2026-07-07' }, dir);
    saveSnapshot({ date: '2026-07-08' }, dir);
    const recent = loadRecentSnapshots(dir, 2);
    expect(recent.map((s) => s.date)).toEqual(['2026-07-08', '2026-07-07']);
  });
});

describe('computeMrrDeltas', () => {
  const today = [
    { name: 'Alpha', mrr: 12000 },
    { name: 'Beta', mrr: 8000 },
    { name: 'NewCo', mrr: 500 },
  ];
  const previous = [
    { name: 'Beta', mrr: 9000 },
    { name: 'Alpha', mrr: 10000 },
  ];

  it('computes mrr and rank deltas by name', () => {
    const out = computeMrrDeltas(today, previous);
    expect(out[0]).toMatchObject({ name: 'Alpha', mrrDelta: 2000, rankDelta: 1 });   // rank 2 -> 1
    expect(out[1]).toMatchObject({ name: 'Beta', mrrDelta: -1000, rankDelta: -1 });  // rank 1 -> 2
    expect(out[2]).toMatchObject({ name: 'NewCo', mrrDelta: null, rankDelta: null });
  });

  it('handles null previous', () => {
    const out = computeMrrDeltas(today, null);
    expect(out.every((s) => s.mrrDelta === null && s.rankDelta === null)).toBe(true);
  });
});
