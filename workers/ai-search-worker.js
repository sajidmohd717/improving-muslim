/**
 * Cloudflare Worker template for Improving Muslim AI search reranking.
 *
 * Required Worker secrets / vars:
 * - AI_PROVIDER: optional, defaults to deepseek
 * - DEEPSEEK_API_KEY: private DeepSeek API key when AI_PROVIDER=deepseek
 * - DEEPSEEK_MODEL: optional, defaults to deepseek-v4-flash
 * - OPENAI_API_KEY: private OpenAI API key when AI_PROVIDER=openai
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
    const provider = (env.AI_PROVIDER || 'deepseek').toLowerCase();
    if (!providerConfig(env, provider).apiKey) {
      return json({ error: `${providerConfig(env, provider).secretName} is not configured` }, 500, corsHeaders);
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
      const { response, data, text } = provider === 'openai'
        ? await callOpenAI(env, prompt, schema)
        : await callDeepSeek(env, prompt);
      if (!response.ok) return handleProviderError(response, data, corsHeaders);

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

function providerConfig(env, provider) {
  if (provider === 'openai') {
    return {
      apiKey: env.OPENAI_API_KEY,
      secretName: 'OPENAI_API_KEY',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  return {
    apiKey: env.DEEPSEEK_API_KEY,
    secretName: 'DEEPSEEK_API_KEY',
    model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
  };
}

async function callDeepSeek(env, prompt) {
  const config = providerConfig(env, 'deepseek');
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: [
            'You are a careful search reranker for an Islamic lecture platform.',
            'Return only valid JSON with this shape:',
            '{"results":[{"id":"provided-id","score":0.95,"reason":"short reason"}]}',
            'Use only IDs from the provided items. Do not invent IDs.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(prompt),
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1200,
      stream: false,
    }),
  });
  const data = await response.json();
  return {
    response,
    data,
    text: data.choices?.[0]?.message?.content || '',
  };
}

async function callOpenAI(env, prompt, schema) {
  const config = providerConfig(env, 'openai');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
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
  return {
    response,
    data,
    text: data.output_text || extractOutputText(data),
  };
}

function handleProviderError(response, data, headers) {
  const message = data.error?.message || data.message || '';
  if (response.status === 429 || /quota|billing|balance|insufficient/i.test(message)) {
    aiUnavailableUntil = Date.now() + 5 * 60 * 1000;
    return json({ results: [], fallback: 'ai-unavailable' }, 200, headers);
  }
  return json({ error: 'AI search temporarily unavailable' }, 502, headers);
}

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
