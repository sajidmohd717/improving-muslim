/**
 * Cloudflare Worker for Improving Muslim popularity counters.
 *
 * Anonymous, aggregate-only play/completion counts per lecture — no user ids,
 * no IPs stored, nothing personal. Backed by a KV namespace.
 *
 *   POST /event    body {"key":"episode:{slug}:{id}"|"video:{id}","event":"play"|"complete"}
 *                  increments the counter, returns 204
 *   GET  /popular  returns {"items":{"<key>":{"p":<plays>,"c":<completes>}}}
 *                  edge-cached for 15 minutes
 *
 * Required bindings / vars (see wrangler.popularity.jsonc):
 * - POPULARITY: KV namespace for the counters
 * - ALLOWED_ORIGIN: optional, defaults to https://improvingmuslim.com
 *
 * Deploy with: npx wrangler deploy -c wrangler.popularity.jsonc
 *
 * Note: KV increments are read-modify-write, not atomic — near-simultaneous
 * plays can occasionally lose a count. That is acceptable for a best-effort
 * popularity signal.
 */
const KEY_PATTERN = /^(episode:[a-z0-9-]{1,60}:[A-Za-z0-9_-]{4,20}|video:[a-z0-9-]{1,80})$/;
const COUNTER_PREFIX = "count:";
const POPULAR_CACHE_SECONDS = 900;

export default {
  async fetch(request, env, ctx) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://improvingmuslim.com";
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (origin && origin !== allowedOrigin) {
      return json({ error: "Origin not allowed" }, 403, corsHeaders);
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/popular") {
      // Serve from the edge cache so a burst of homepage visits costs one KV list.
      const cache = caches.default;
      const cacheKey = new Request(`${url.origin}/popular`);
      const cached = await cache.match(cacheKey);
      if (cached) {
        return withCors(cached, corsHeaders);
      }

      const items = {};
      let cursor;
      do {
        const page = await env.POPULARITY.list({ prefix: COUNTER_PREFIX, cursor });
        for (const entry of page.keys) {
          const value = await env.POPULARITY.get(entry.name, "json");
          if (value) items[entry.name.slice(COUNTER_PREFIX.length)] = value;
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);

      const response = new Response(JSON.stringify({ items }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${POPULAR_CACHE_SECONDS}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return withCors(response, corsHeaders);
    }

    if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/event")) {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400, corsHeaders);
      }
      const key = String(body?.key || "");
      const event = String(body?.event || "");
      if (!KEY_PATTERN.test(key) || (event !== "play" && event !== "complete")) {
        return json({ error: "Invalid event" }, 400, corsHeaders);
      }

      const counterKey = `${COUNTER_PREFIX}${key}`;
      const counts = (await env.POPULARITY.get(counterKey, "json")) || { p: 0, c: 0 };
      if (event === "play") counts.p += 1;
      else counts.c += 1;
      await env.POPULARITY.put(counterKey, JSON.stringify(counts));
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  },
};

function withCors(response, corsHeaders) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
