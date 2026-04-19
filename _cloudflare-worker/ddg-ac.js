// Cloudflare Worker — CORS proxy for DuckDuckGo's autocomplete endpoint.
// Deploy with `wrangler deploy` or paste into the Cloudflare dashboard
// (Workers & Pages → Create Worker). Default *.workers.dev route is fine.
// After deploy, copy the assigned URL into AC_ENDPOINT in scripts.js.

const ALLOW_ORIGINS = new Set([
  'https://emmait.se',
  'https://www.emmait.se',
  'http://localhost:4000',
]);

function corsHeaders(origin) {
  const allow = ALLOW_ORIGINS.has(origin) ? origin : 'https://emmait.se';
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').slice(0, 200);
    if (!q) {
      return new Response('[]', {
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const upstream = 'https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list';
    const res = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (emmait.se autocomplete proxy)',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 60, cacheEverything: true },
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  },
};
