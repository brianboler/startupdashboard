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

export function buildSnapshot({ date, headlines, showHn, launches, repos, mrrLeaderboard, filings, news, previousSnapshots }) {
  const mergedLaunches = [...launches, ...showHn].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const topicSourceItems = [...headlines, ...mergedLaunches, ...repos, ...news];
  const emergingTopics = scoreEmergingTopics(extractTerms(topicSourceItems), previousSnapshots);

  const sections = {
    headlines,
    launches: mergedLaunches,
    mrrLeaderboard,
    trendingRepos: repos,
    formDFilings: filings.slice(0, 40),
    news,
    emergingTopics,
  };
  const sources = {};
  for (const [name, arr] of Object.entries(sections)) sources[name] = arr.length;

  return {
    date,
    generatedAt: new Date().toISOString(),
    stats: {
      totalItems: Object.values(sections).reduce((sum, arr) => sum + arr.length, 0),
      sources,
    },
    sections,
  };
}
