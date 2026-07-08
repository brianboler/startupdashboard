import Parser from 'rss-parser';
import { USER_AGENT } from '../lib/http.js';

export const FEEDS = [
  { name: 'techcrunch', url: 'https://techcrunch.com/category/startups/feed/' },
  { name: 'crunchbase-news', url: 'https://news.crunchbase.com/feed/' },
  { name: 'venturebeat', url: 'https://venturebeat.com/feed/' },
];

const MAX_AGE_MS = 48 * 3600 * 1000;

export function parseFeedItems(feedName, items) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return (items ?? [])
    .filter((it) => it.title && it.link)
    .filter((it) => {
      const t = Date.parse(it.isoDate ?? it.pubDate ?? '');
      return !Number.isNaN(t) && t >= cutoff;
    })
    .slice(0, 10)
    .map((it) => ({
      id: `rss-${it.link}`,
      title: it.title,
      url: it.link,
      source: `rss:${feedName}`,
      points: null,
      meta: feedName,
      createdAt: it.isoDate ?? null,
    }));
}

export async function fetchNewsHeadlines() {
  const parser = new Parser({ headers: { 'User-Agent': USER_AGENT }, timeout: 15000 });
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => parseFeedItems(f.name, (await parser.parseURL(f.url)).items))
  );
  const items = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else console.warn(`rss: ${FEEDS[i].name} failed (${r.reason?.message})`);
  });
  return items.sort((a, b) => Date.parse(b.createdAt ?? 0) - Date.parse(a.createdAt ?? 0));
}
