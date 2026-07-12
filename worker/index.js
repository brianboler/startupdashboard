// Cloudflare Worker for Startup Pulse.
// Serves the static dashboard (index.html/styles.css/app.js) from the ASSETS
// binding, and edge-proxies the daily data snapshot from GitHub raw so the
// live site always reflects the latest cron-committed snapshot with no redeploy.

const DATA_UPSTREAM =
  'https://raw.githubusercontent.com/brianboler/startupdashboard/main/data/latest.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/data/latest.json') {
      const upstream = await fetch(DATA_UPSTREAM, {
        cf: {
          cacheEverything: true,
          // Cache good responses ~15 min at the edge; never cache errors.
          cacheTtlByStatus: { '200-299': 900, '300-399': 0, '400-499': 0, '500-599': 0 },
        },
      });
      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: 'data unavailable' }), {
          status: 502,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=600',
          'access-control-allow-origin': '*',
        },
      });
    }

    // Everything else is a static asset (falls back to index.html on miss).
    return env.ASSETS.fetch(request);
  },
};
