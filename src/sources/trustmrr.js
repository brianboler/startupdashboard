import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.js';

const BASE_URL = 'https://trustmrr.com';

/**
 * Parse a human-readable dollar amount into a number.
 *   "$980"   -> 980
 *   "$12.4k" -> 12400
 *   "$1.2M"  -> 1200000
 *   "$1,250" -> 1250
 *   junk     -> null
 */
export function parseMoney(text) {
  if (typeof text !== 'string') return null;
  const m = text.replace(/,/g, '').match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*([kKmM])?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1;
  return Math.round(n * mult);
}

function parsePct(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/(-?[0-9]+(?:\.[0-9]+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

// Round a numeric percentage to 2 decimals; pass through non-numbers as null.
function roundPct(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

/**
 * Map a raw TrustMRR startup record (as embedded in the page's data) to the
 * common Startup shape. Records use `currentMrr` and `currentLast30DaysRevenue`
 * for revenue, and `cachedGrowth30d`/`growth30d` for growth.
 */
function mapStartup(o) {
  if (!o || typeof o !== 'object') return null;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return null;

  // Revenue: prefer verified MRR, fall back to last-30-days revenue, then any
  // string amount (e.g. a `revenue`/`mrr` string) via parseMoney.
  let mrr = null;
  if (typeof o.currentMrr === 'number' && o.currentMrr > 0) {
    mrr = Math.round(o.currentMrr);
  } else if (typeof o.currentLast30DaysRevenue === 'number' && o.currentLast30DaysRevenue > 0) {
    mrr = Math.round(o.currentLast30DaysRevenue);
  } else if (typeof o.mrr === 'number' && o.mrr > 0) {
    mrr = Math.round(o.mrr);
  } else {
    mrr = parseMoney(String(o.mrr ?? o.revenue ?? ''));
  }

  // Growth percentage from whichever cached/raw field is present.
  let growthPct = null;
  for (const k of ['cachedGrowth30d', 'growth30d', 'cachedGrowthMRR30d', 'growth']) {
    if (typeof o[k] === 'number') {
      growthPct = roundPct(o[k]);
      break;
    }
    if (typeof o[k] === 'string') {
      growthPct = parsePct(o[k]);
      if (growthPct !== null) break;
    }
  }

  // URL: use an explicit url/website if present, else build from the slug.
  let url = null;
  if (typeof o.url === 'string' && o.url) url = o.url;
  else if (typeof o.website === 'string' && o.website) url = o.website;
  else if (typeof o.slug === 'string' && o.slug) url = `${BASE_URL}/${o.slug}`;

  const description =
    typeof o.description === 'string' && o.description.trim()
      ? o.description.trim()
      : typeof o.tagline === 'string' && o.tagline.trim()
      ? o.tagline.trim()
      : null;

  return { name, url, mrr, growthPct, description };
}

// Given a string and the index of a `{`, return the substring for the complete,
// string-aware balanced object (or null if unbalanced).
function extractBalancedObject(str, openIdx) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openIdx; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return str.slice(openIdx, i + 1);
    }
  }
  return null;
}

// Dedupe mapped startups by slug/url/name, preserving first-seen order.
function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (!s) continue;
    const key = s.url || s.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Strategy A: classic Next.js `__NEXT_DATA__` JSON blob (older Next.js / pages
 * router). Not present on the current TrustMRR build, but kept for robustness.
 */
function parseFromNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let json;
  try {
    json = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      const looksLikeStartup =
        typeof node.name === 'string' &&
        ('currentMrr' in node ||
          'currentLast30DaysRevenue' in node ||
          'mrr' in node ||
          'revenue' in node);
      if (looksLikeStartup) {
        const mapped = mapStartup(node);
        if (mapped) found.push(mapped);
      }
      Object.values(node).forEach(walk);
    }
  };
  walk(json);
  return dedupe(found);
}

/**
 * Strategy B (primary): the current TrustMRR build streams its data as React
 * Server Component flight chunks via `self.__next_f.push([1,"<payload>"])`.
 * Concatenate the JSON-decoded payloads and pull out the embedded startup
 * records — each is a JSON object beginning with `{"_id":`.
 */
function parseFromRscChunks(html) {
  const marker = 'self.__next_f.push([1,';
  const closer = '])</script>';
  let pos = 0;
  let payload = '';
  while (true) {
    const start = html.indexOf(marker, pos);
    if (start === -1) break;
    const jsonStart = start + marker.length;
    const end = html.indexOf(closer, jsonStart);
    if (end === -1) break;
    const raw = html.slice(jsonStart, end);
    try {
      const decoded = JSON.parse(raw);
      if (typeof decoded === 'string') payload += decoded;
    } catch {
      /* skip malformed chunk */
    }
    pos = end + closer.length;
  }
  if (!payload) return [];

  const objMarker = '{"_id":';
  let p = 0;
  const found = [];
  while (true) {
    const start = payload.indexOf(objMarker, p);
    if (start === -1) break;
    const objStr = extractBalancedObject(payload, start);
    if (!objStr) {
      p = start + objMarker.length;
      continue;
    }
    p = start + objStr.length;
    let obj;
    try {
      obj = JSON.parse(objStr);
    } catch {
      continue;
    }
    // Only treat records that carry a revenue/MRR signal as leaderboard entries.
    const looksLikeStartup =
      typeof obj.name === 'string' &&
      ('currentMrr' in obj ||
        'currentLast30DaysRevenue' in obj ||
        'mrr' in obj ||
        'revenue' in obj);
    if (!looksLikeStartup) continue;
    const mapped = mapStartup(obj);
    if (mapped) found.push(mapped);
  }
  return dedupe(found);
}

/**
 * Strategy C: cheerio DOM fallback. Scans candidate card/row elements for a
 * dollar amount and a heading. Only used if the JSON strategies come up short.
 */
function parseFromDom(html) {
  const $ = cheerio.load(html);
  const startups = [];
  $('[class*="leaderboard"] tr, [class*="startup"], [class*="card"], li, tr').each((_, el) => {
    const text = $(el).text();
    const mrr = parseMoney(text);
    if (mrr === null) return;
    const name = $(el).find('h1, h2, h3, h4, [class*="name"], [class*="title"], a').first().text().trim();
    if (!name) return;
    const href = $(el).find('a[href]').attr('href') || null;
    let url = href;
    if (href && href.startsWith('/')) url = `${BASE_URL}${href}`;
    startups.push({ name, url, mrr, growthPct: parsePct(text), description: null });
  });
  return dedupe(startups);
}

/**
 * Extract the TrustMRR leaderboard from a full page's HTML.
 * Returns an array of { name, url, mrr, growthPct, description }.
 */
export function parseTrustMrr(html) {
  if (typeof html !== 'string' || !html) return [];

  const strategies = [parseFromNextData, parseFromRscChunks, parseFromDom];
  let best = [];
  for (const strategy of strategies) {
    let result = [];
    try {
      result = strategy(html);
    } catch {
      result = [];
    }
    if (result.length >= 5) return result;
    if (result.length > best.length) best = result;
  }
  return best;
}

export async function fetchTrustMrrLeaderboard() {
  try {
    const html = await fetchText(`${BASE_URL}/`);
    const startups = parseTrustMrr(html);
    if (startups.length === 0) {
      console.warn('trustmrr: parsed 0 startups — page markup may have changed');
    }
    return startups;
  } catch (err) {
    console.warn(`trustmrr: fetch failed (${err.message})`);
    return [];
  }
}
