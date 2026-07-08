# Startup Pulse

Daily-refreshed dashboard aggregating startup news, launches, verified MRR
stats, SEC Form D filings, and emerging-field signals. $0/month to run.

**Live:** https://bb01010101.github.io/startupdashboard/

## How it works

1. A GitHub Actions cron (11:00 UTC daily) runs `npm run pipeline`.
2. The pipeline pulls from free sources in parallel (each optional — one
   failure never blocks the snapshot):
   - Hacker News (Algolia API) — headlines + Show HN launches
   - GitHub Search API — new repos trending by stars (emerging tools/fields)
   - TrustMRR (polite scrape) — verified-MRR startup leaderboard + day-over-day deltas
   - Product Hunt (GraphQL API, needs `PH_TOKEN`) — today's top launches
   - SEC EDGAR daily form index — fresh Form D filings (private fundraising)
   - RSS — TechCrunch Startups, Crunchbase News, VentureBeat
3. It writes `data/latest.json` + `data/history/<date>.json` and commits.
4. GitHub Pages serves the static dashboard, which reads `data/latest.json`.

## Local development

    npm install
    npm test                 # all parser/logic tests (no network)
    npm run pipeline         # fetch real data -> data/latest.json
    npx serve . -l 4173      # open http://localhost:4173

## Configuration

| Env var        | Required | Purpose                              |
|----------------|----------|--------------------------------------|
| `PH_TOKEN`     | no       | Product Hunt API (source skipped without it) |
| `GITHUB_TOKEN` | no       | Higher GitHub API rate limits (auto in CI)   |

## Operations

- **Manual refresh:** Actions tab → "Daily data refresh" → Run workflow.
- **A source broke:** check the Actions log for `✗ <source> failed`. The
  dashboard keeps working with the remaining sources. For TrustMRR, re-capture
  the fixture (`curl ... -o tests/fixtures/trustmrr.html`) and update the
  selectors in `src/sources/trustmrr.js` until `npm test` passes.
- **Add an RSS feed:** append to `FEEDS` in `src/sources/rss.js`.
- **History growth:** one ~100–300 KB JSON/day ≈ a few MB/year. Prune
  `data/history/` if it ever matters.

## Etiquette

All requests identify themselves via User-Agent with contact info, retry at
most 3× with backoff, and run once per day. SEC EDGAR requires the contact UA.
