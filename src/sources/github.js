import { fetchJson } from '../lib/http.js';

export function parseRepos(apiResponse) {
  return (apiResponse.items ?? []).map((r) => ({
    id: `gh-${r.full_name}`,
    title: r.full_name,
    url: r.html_url,
    source: 'github',
    points: r.stargazers_count ?? 0,
    meta: [r.language, r.description].filter(Boolean).join(' · '),
    createdAt: r.created_at ?? null,
    topics: r.topics ?? [],
  }));
}

export async function fetchNewTrendingRepos() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const url = `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=25`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const data = await fetchJson(url, { headers });
  return parseRepos(data);
}
