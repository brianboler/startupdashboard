import { domainOf } from './lib/media.js';

const STOPWORDS = new Set([
  'show', 'this', 'that', 'with', 'from', 'your', 'have', 'what', 'when', 'will',
  'about', 'into', 'over', 'just', 'like', 'more', 'than', 'them', 'then', 'they',
  'startup', 'startups', 'company', 'companies', 'launch', 'launches', 'launched',
  'using', 'built', 'build', 'make', 'made', 'open', 'source', 'first', 'best',
  'raises', 'raised', 'funding', 'announcing', 'introducing', 'https', 'week', 'today',
]);

export function extractTerms(items) {
  const counts = new Map();
  const add = (term, weight = 1) => counts.set(term, (counts.get(term) ?? 0) + weight);
  for (const item of items) {
    const words = (item.title ?? '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [];
    for (const w of words) if (!STOPWORDS.has(w)) add(w);
    for (const t of item.topics ?? []) add(t.toLowerCase(), 2);
  }
  return counts;
}

export function scoreEmergingTopics(todayTerms, previousSnapshots) {
  const prevAvg = new Map();
  for (const snap of previousSnapshots ?? []) {
    for (const { term, count } of snap?.sections?.emergingTopics ?? []) {
      prevAvg.set(term, (prevAvg.get(term) ?? 0) + count);
    }
  }
  const n = Math.max((previousSnapshots ?? []).length, 1);
  const scored = [];
  for (const [term, count] of todayTerms) {
    if (count < 3) continue;
    const avg = (prevAvg.get(term) ?? 0) / n;
    scored.push({ term, count, velocity: count / (avg + 1) });
  }
  return scored.sort((a, b) => b.velocity - a.velocity).slice(0, 20);
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/.test(key) || key === 'ref') u.searchParams.delete(key);
    }
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

export function attachMrrHistory(mrrLeaderboard, previousSnapshots, { top = 60, days = 14 } = {}) {
  const histByName = new Map();
  for (const snap of [...(previousSnapshots ?? [])].reverse()) { // oldest → newest
    for (const s of snap?.sections?.mrrLeaderboard ?? []) {
      if (s.mrr == null) continue;
      if (!histByName.has(s.name)) histByName.set(s.name, []);
      histByName.get(s.name).push(s.mrr);
    }
  }
  return mrrLeaderboard.map((s, i) => {
    if (i >= top) return s;
    const past = histByName.get(s.name) ?? [];
    const history = [...past, ...(s.mrr != null ? [s.mrr] : [])].slice(-days);
    return { ...s, history };
  });
}

export function buildSnapshot({ date, headlines, showHn, launches, repos, mrrLeaderboard, filings, news, community = [], previousSnapshots }) {
  const mergedLaunches = [...launches, ...showHn].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  const withDomain = (arr) => arr.map((it) => ({ ...it, domain: it.domain ?? domainOf(it.url) }));

  // Cross-source dedupe by normalized URL — priority headlines > launches > community > news
  // (first wins). Only real http(s) URLs are deduped; items with placeholder/invalid urls
  // are always kept so distinct items are never collapsed by a shared non-URL value.
  const seen = new Set();
  const dedupe = (arr) => arr.filter((it) => {
    if (!/^https?:\/\//.test(it.url ?? '')) return true;
    const key = normalizeUrl(it.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dHeadlines = dedupe(withDomain(headlines));
  const dLaunches = dedupe(withDomain(mergedLaunches));
  const dCommunity = dedupe(withDomain(community));
  const dNews = dedupe(withDomain(news));

  const topicSourceItems = [...dHeadlines, ...dLaunches, ...dCommunity, ...repos, ...dNews];
  const emergingTopics = scoreEmergingTopics(extractTerms(topicSourceItems), previousSnapshots);

  const sections = {
    headlines: dHeadlines,
    launches: dLaunches,
    community: dCommunity,
    mrrLeaderboard,
    trendingRepos: repos,
    formDFilings: filings.slice(0, 40),
    news: dNews,
    emergingTopics,
  };
  const sources = {};
  for (const [name, arr] of Object.entries(sections)) sources[name] = arr.length;

  const totalItems = Object.values(sections).reduce((sum, arr) => sum + arr.length, 0);
  const prevTotal = previousSnapshots?.[0]?.stats?.totalItems;

  return {
    date,
    generatedAt: new Date().toISOString(),
    stats: {
      totalItems,
      totalDelta: prevTotal != null ? totalItems - prevTotal : null,
      sources,
    },
    sections,
  };
}
