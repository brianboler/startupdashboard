import { fetchJson } from '../lib/http.js';

export function parseLobsters(stories) {
  return (stories ?? [])
    .filter((s) => s.title && (s.url || s.comments_url))
    .slice(0, 15)
    .map((s) => ({
      id: `lb-${s.short_id}`,
      title: s.title,
      url: s.url || s.comments_url,
      source: 'lobsters',
      points: s.score ?? null,
      meta: `lobsters · ${(s.tags ?? []).slice(0, 3).join(', ')}`,
      createdAt: s.created_at ?? null,
      commentsUrl: s.comments_url ?? null,
      image: null,
    }));
}

export async function fetchLobsters() {
  const stories = await fetchJson('https://lobste.rs/hottest.json');
  return parseLobsters(stories);
}
