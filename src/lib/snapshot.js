import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function saveSnapshot(snapshot, dataDir) {
  const historyDir = join(dataDir, 'history');
  mkdirSync(historyDir, { recursive: true });
  const json = JSON.stringify(snapshot, null, 2);
  writeFileSync(join(historyDir, `${snapshot.date}.json`), json);
  writeFileSync(join(dataDir, 'latest.json'), json);
}

export function loadRecentSnapshots(dataDir, n) {
  const historyDir = join(dataDir, 'history');
  let files;
  try {
    files = readdirSync(historyDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }
  return files
    .sort()
    .reverse()
    .slice(0, n)
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(historyDir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function computeMrrDeltas(today, previous) {
  const prevByName = new Map((previous ?? []).map((s, i) => [s.name, { ...s, rank: i }]));
  return today.map((s, i) => {
    const prev = prevByName.get(s.name);
    return {
      ...s,
      mrrDelta: prev && s.mrr != null && prev.mrr != null ? s.mrr - prev.mrr : null,
      rankDelta: prev ? prev.rank - i : null,
    };
  });
}
