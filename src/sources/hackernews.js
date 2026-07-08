import { fetchJson } from '../lib/http.js';

const API = 'https://hn.algolia.com/api/v1';

export function parseHnHits(hits) {
  return hits.map((h) => ({
    id: `hn-${h.objectID}`,
    title: h.title ?? '(untitled)',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: 'hackernews',
    points: h.points ?? null,
    meta: h.num_comments != null ? `${h.num_comments} comments` : null,
    createdAt: h.created_at ?? null,
  }));
}

export async function fetchFrontPage() {
  const data = await fetchJson(`${API}/search?tags=front_page&hitsPerPage=30`);
  return parseHnHits(data.hits ?? []);
}

export async function fetchShowHN() {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const url = `${API}/search_by_date?tags=show_hn&numericFilters=created_at_i>${since},points>=5&hitsPerPage=30`;
  const data = await fetchJson(url);
  return parseHnHits(data.hits ?? []).sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}
