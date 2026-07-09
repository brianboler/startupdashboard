import { fetchJson } from '../lib/http.js';

const QUERY = `
query TodayPosts($postedAfter: DateTime!) {
  posts(order: VOTES, postedAfter: $postedAfter, first: 20) {
    edges { node {
      id name tagline votesCount url createdAt
      thumbnail { url }
      topics(first: 3) { edges { node { name } } }
    } }
  }
}`;

export function parsePhPosts(gqlResponse) {
  const edges = gqlResponse?.data?.posts?.edges ?? [];
  return edges.map(({ node }) => ({
    id: `ph-${node.id}`,
    title: node.name,
    url: node.url,
    source: 'producthunt',
    points: node.votesCount ?? 0,
    meta: node.tagline ?? null,
    createdAt: node.createdAt ?? null,
    image: node.thumbnail?.url ?? null,
    topics: (node.topics?.edges ?? []).map((e) => e.node.name),
  }));
}

export async function fetchTodayLaunches() {
  const token = process.env.PH_TOKEN;
  if (!token) {
    console.warn('producthunt: PH_TOKEN not set — skipping source');
    return [];
  }
  const postedAfter = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const data = await fetchJson('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: QUERY, variables: { postedAfter } }),
  });
  return parsePhPosts(data);
}
