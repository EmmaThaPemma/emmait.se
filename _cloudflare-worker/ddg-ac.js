// Cloudflare Worker — CORS proxy for DuckDuckGo's autocomplete endpoint.
// Deploy with `wrangler deploy` or paste into the Cloudflare dashboard
// (Workers & Pages → Create Worker). Default *.workers.dev route is fine.
// After deploy, copy the assigned URL into AC_ENDPOINT in scripts.js.
//
// Defense in depth:
//   1. Origin header must be present and in ALLOW_ORIGINS.
//   2. Referer header must be present and its hostname in ALLOW_REFERER_HOSTS.
//      (Browsers default to strict-origin-when-cross-origin, so Referer is sent.)
//   3. User-Agent must not match BLOCKED_UA (common scripting clients).
//   4. Input `q` is Unicode-normalised, stripped of control chars, capped.
//   5. Upstream response is parsed as JSON and re-serialised with only the
//      `phrase` field whitelisted, so a compromised upstream cannot inject
//      unexpected structure or payloads.

const ALLOW_ORIGINS = new Set([
  'https://emmait.se',
  'https://www.emmait.se',
  'http://localhost:4000',
]);

const ALLOW_REFERER_HOSTS = new Set([
  'emmait.se',
  'www.emmait.se',
  'localhost',
]);

// Non-browser clients. Browsers never advertise themselves this way.
const BLOCKED_UA = /(curl|wget|python-requests|python-urllib|libwww|Go-http-client|Java\/|okhttp|Apache-HttpClient|Scrapy|httpx|axios\/|node-fetch|postmanruntime|insomnia|httpie)/i;

const MAX_QUERY_LEN = 200;
const MAX_UPSTREAM_BYTES = 50_000;
const MAX_SUGGESTIONS = 20;
const MAX_PHRASE_LEN = 500;
const CACHE_TTL = 60;

function corsHeaders(origin) {
  const allow = ALLOW_ORIGINS.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
  };
}

function json(body, origin, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? `public, max-age=${CACHE_TTL}` : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function forbidden(origin) {
  return new Response('Forbidden', {
    status: 403,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function sanitizeQuery(raw) {
  if (typeof raw !== 'string') return null;
  // Normalise Unicode so visually-identical strings have one canonical form
  // (defeats simple homograph-style padding tricks against any length cap).
  let q = raw.normalize('NFC');
  // Drop C0 and C1 control characters (incl. NUL, CR, LF, DEL).
  q = q.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  // Collapse internal whitespace runs, trim edges.
  q = q.replace(/\s+/g, ' ').trim();
  if (q.length > MAX_QUERY_LEN) q = q.slice(0, MAX_QUERY_LEN);
  return q || null;
}

function refererHost(header) {
  if (!header) return '';
  try { return new URL(header).hostname; } catch { return ''; }
}

async function parseUpstream(res) {
  if (!res || !res.ok) return [];
  const text = await res.text();
  if (text.length > MAX_UPSTREAM_BYTES) return [];
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const item of data) {
    if (!item || typeof item.phrase !== 'string') continue;
    if (item.phrase.length > MAX_PHRASE_LEN) continue;
    out.push({ phrase: item.phrase });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const method = request.method;

    // CORS preflight: Origin is the only header browsers guarantee here.
    if (method === 'OPTIONS') {
      if (!ALLOW_ORIGINS.has(origin)) return forbidden(origin);
      return new Response(null, {
        headers: {
          ...corsHeaders(origin),
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...corsHeaders(origin), 'Content-Type': 'text/plain' },
      });
    }

    if (!ALLOW_ORIGINS.has(origin)) return forbidden(origin);

    if (!ALLOW_REFERER_HOSTS.has(refererHost(request.headers.get('Referer')))) {
      return forbidden(origin);
    }

    const ua = request.headers.get('User-Agent') || '';
    if (!ua || BLOCKED_UA.test(ua)) return forbidden(origin);

    const url = new URL(request.url);
    const q = sanitizeQuery(url.searchParams.get('q'));
    if (!q) return json([], origin);

    let upstreamRes;
    try {
      upstreamRes = await fetch(
        'https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&t=h_&ia=web&ct=SE',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (emmait.se autocomplete proxy)',
            'Accept': 'application/json',
          },
          cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
        }
      );
    } catch {
      return json([], origin);
    }

    const clean = await parseUpstream(upstreamRes);
    return json(clean, origin);
  },
};
