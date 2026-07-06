/**
 * Cloudflare Worker template for Improving Muslim AI search reranking.
 *
 * Required Worker secrets / vars:
 * - OPENAI_API_KEY: private OpenAI API key
 * - OPENAI_MODEL: optional, defaults to gpt-4o-mini
 * - ALLOWED_ORIGIN: optional, defaults to https://improvingmuslim.com
 *
 * Deploy this as a Worker, then set `aiSearchEndpoint` in
 * `scripts/home-config.js` to the Worker URL.
 */
let aiUnavailableUntil = 0;

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://improvingmuslim.com';
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (origin && origin !== allowedOrigin) {
      return json({ error: 'Origin not allowed' }, 403, corsHeaders);
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsHeaders);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY is not configured' }, 500, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const query = cleanText(body.query, 160);
    const items = Array.isArray(body.items) ? body.items.slice(0, 80).map(cleanItem).filter(Boolean) : [];
    if (!query || !items.length) {
      return json({ results: [] }, 200, corsHeaders);
    }
    if (Date.now() < aiUnavailableUntil) {
      return json({ results: [], fallback: 'ai-unavailable' }, 200, corsHeaders);
    }

    const prompt = {
      query,
      instructions: [
        'Rank the most relevant Islamic lecture search results for the query.',
        'Use meaning, intent, topic, speaker, titles, recaps, and keywords.',
        'Return only item IDs from the provided items.',
        'Prefer helpful learning matches over exact word overlap.',
        'Do not invent IDs.',
      ],
      items,
    };

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        results: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              score: { type: 'number' },
              reason: { type: 'string' },
            },
            required: ['id', 'score', 'reason'],
          },
        },
      },
      required: ['results'],
    };

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || 'gpt-4o-mini',
          input: [
            {
              role: 'system',
              content: 'You are a careful search reranker for an Islamic lecture platform. Respond as strict JSON.',
            },
            {
              role: 'user',
              content: JSON.stringify(prompt),
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'search_ranking',
              strict: true,
              schema,
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data.error?.message || '';
        if (response.status === 429 || /quota|billing/i.test(message)) {
          aiUnavailableUntil = Date.now() + 5 * 60 * 1000;
          return json({ results: [], fallback: 'ai-unavailable' }, 200, corsHeaders);
        }
        return json({ error: 'AI search temporarily unavailable' }, 502, corsHeaders);
      }

      const text = data.output_text || extractOutputText(data);
      const parsed = JSON.parse(text || '{"results":[]}');
      const validIds = new Set(items.map((item) => item.id));
      const results = (Array.isArray(parsed.results) ? parsed.results : [])
        .map((result) => ({
          id: String(result.id || '').toLowerCase(),
          score: Number(result.score) || 0,
          reason: cleanText(result.reason, 180),
        }))
        .filter((result, index, all) => validIds.has(result.id) && all.findIndex((item) => item.id === result.id) === index)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      return json({ results }, 200, corsHeaders);
    } catch (error) {
      return json({ error: error.message || 'AI search failed' }, 500, corsHeaders);
    }
  },
};

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanItem(item) {
  const id = cleanText(item.id, 260).toLowerCase();
  const title = cleanText(item.title, 180);
  if (!id || !title) return null;
  return {
    id,
    title,
    speaker: cleanText(item.speaker, 120),
    topic: cleanText(item.topic, 120),
    type: cleanText(item.type, 30),
    text: cleanText(item.text, 1800),
  };
}

function extractOutputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || '')
    .join('');
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
