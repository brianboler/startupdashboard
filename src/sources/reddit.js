import { fetchJson } from '../lib/http.js';

export const SUBREDDIT_GROUPS = [
  { name: 'founders', subs: ['startups', 'Entrepreneur', 'SaaS', 'indiehackers', 'SideProject', 'ycombinator'] },
  { name: 'ai', subs: ['LocalLLaMA', 'MachineLearning', 'artificial', 'OpenAI', 'ClaudeAI'] },
  { name: 'builders', subs: ['programming', 'webdev', 'selfhosted', 'opensource', 'devops'] },
];

const MIN_UPS = 10;
const MAX_PER_SUB = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function redditImage(p) {
  const prev = p.preview?.images?.[0]?.source?.url;
  if (prev) return prev.replace(/&amp;/g, '&');
  if (/^https?:\/\//.test(p.thumbnail ?? '')) return p.thumbnail;
  return null;
}

export function parseRedditPosts(listing) {
  const children = listing?.data?.children ?? [];
  const perSub = new Map();
  const posts = [];
  for (const { kind, data: p } of children) {
    if (kind !== 't3' || !p || p.stickied || p.over_18) continue;
    if ((p.ups ?? 0) < MIN_UPS) continue;
    const n = (perSub.get(p.subreddit) ?? 0) + 1;
    if (n > MAX_PER_SUB) continue;
    perSub.set(p.subreddit, n);
    const permalink = `https://www.reddit.com${p.permalink}`;
    const isRedditUrl = /^https?:\/\/(www\.|old\.)?reddit\.com/.test(p.url ?? '');
    posts.push({
      id: `rd-${p.id}`,
      title: p.title,
      url: p.url && !p.is_self && !isRedditUrl ? p.url : permalink,
      source: `reddit:r/${p.subreddit}`,
      points: p.ups ?? null,
      meta: `r/${p.subreddit} · ${p.num_comments ?? 0} comments`,
      createdAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      commentsUrl: permalink,
      image: redditImage(p),
    });
  }
  return posts.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

async function getAppToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const data = await fetchJson('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }, { retries: 2 });
  return data.access_token ?? null;
}

export async function fetchRedditPulse() {
  let base = 'https://www.reddit.com';
  let headers = {};
  try {
    const token = await getAppToken();
    if (token) {
      base = 'https://oauth.reddit.com';
      headers = { Authorization: `Bearer ${token}` };
    } else {
      console.warn('reddit: no REDDIT_CLIENT_ID/SECRET — trying unauthenticated (may 403)');
    }
  } catch (err) {
    console.warn(`reddit: oauth failed (${err.message}) — trying unauthenticated`);
  }

  const all = [];
  for (const group of SUBREDDIT_GROUPS) {
    const multi = group.subs.join('+');
    try {
      const listing = await fetchJson(
        `${base}/r/${multi}/top.json?t=day&limit=50&raw_json=1`,
        { headers },
        { retries: 2 }
      );
      all.push(...parseRedditPosts(listing));
    } catch (err) {
      console.warn(`reddit: group "${group.name}" failed (${err.message})`);
    }
    await sleep(1100); // ≥1s between reddit requests
  }
  const seen = new Set();
  return all
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 30);
}
