import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchFrontPage, fetchShowHN } from './sources/hackernews.js';
import { fetchNewTrendingRepos } from './sources/github.js';
import { fetchTrustMrrLeaderboard } from './sources/trustmrr.js';
import { fetchTodayLaunches } from './sources/producthunt.js';
import { fetchRecentFormD } from './sources/edgar.js';
import { fetchNewsHeadlines } from './sources/rss.js';
import { buildSnapshot } from './aggregate.js';
import { saveSnapshot, loadRecentSnapshots, computeMrrDeltas } from './lib/snapshot.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

async function settle(name, promise) {
  try {
    const value = await promise;
    console.log(`✓ ${name}: ${value.length} items`);
    return value;
  } catch (err) {
    console.warn(`✗ ${name} failed: ${err.message}`);
    return [];
  }
}

const [headlines, showHn, repos, mrrRaw, launches, filings, news] = await Promise.all([
  settle('hackernews front page', fetchFrontPage()),
  settle('show hn', fetchShowHN()),
  settle('github trending', fetchNewTrendingRepos()),
  settle('trustmrr', fetchTrustMrrLeaderboard()),
  settle('product hunt', fetchTodayLaunches()),
  settle('edgar form d', fetchRecentFormD()),
  settle('rss news', fetchNewsHeadlines()),
]);

// Exclude today's own snapshot so a same-day re-run (e.g. manual
// workflow_dispatch) compares against the previous *day*, not itself —
// otherwise all mrr/rank deltas and topic velocities collapse to self-reference.
const today = new Date().toISOString().slice(0, 10);
const previousSnapshots = loadRecentSnapshots(DATA_DIR, 8).filter((s) => s.date !== today);
const previousMrr = previousSnapshots[0]?.sections?.mrrLeaderboard ?? null;
const mrrLeaderboard = computeMrrDeltas(mrrRaw, previousMrr);

const snapshot = buildSnapshot({
  date: today,
  headlines, showHn, launches, repos, mrrLeaderboard, filings, news,
  previousSnapshots,
});

try {
  saveSnapshot(snapshot, DATA_DIR);
} catch (err) {
  console.error(`Failed to write snapshot: ${err.message}`);
  process.exit(1);
}
console.log(`Snapshot saved: ${snapshot.stats.totalItems} items across ${Object.keys(snapshot.stats.sources).length} sections`);
// Exit explicitly: successful fetches leave AbortSignal.timeout timers and
// keep-alive sockets pending, which would otherwise delay process exit.
process.exit(0);
