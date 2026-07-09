import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchText } from './http.js';

const MAX_AGE_MS = 14 * 24 * 3600 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function extractOgImage(html) {
  const $ = cheerio.load(html);
  const img =
    $('meta[property="og:image"]').attr('content') ??
    $('meta[name="twitter:image"]').attr('content') ??
    null;
  return img && /^https:\/\//.test(img) ? img : null;
}

export function loadOgCache(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

export function pruneOgCache(cache, now = Date.now()) {
  const out = {};
  for (const [url, entry] of Object.entries(cache)) {
    if (now - entry.fetchedAt < MAX_AGE_MS) out[url] = entry;
  }
  return out;
}

export async function enrichWithOgImages(items, cachePath, { limit = 14, delayMs = 350 } = {}) {
  const cache = pruneOgCache(loadOgCache(cachePath));
  let fetched = 0;
  for (const item of items) {
    if (item.image != null) continue;
    if (!item.url || !/^https:\/\//.test(item.url)) continue;
    if (item.url in cache) {
      item.image = cache[item.url].image;
      continue;
    }
    if (fetched >= limit) continue;
    fetched++;
    try {
      const html = await fetchText(item.url, {}, { retries: 1, timeoutMs: 8000 });
      cache[item.url] = { image: extractOgImage(html), fetchedAt: Date.now() };
    } catch {
      cache[item.url] = { image: null, fetchedAt: Date.now() };
    }
    item.image = cache[item.url].image;
    await sleep(delayMs);
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  return items;
}
