/* ✳ SIGNATURE — Apex backend proxy (Cloudflare Worker, free tier).
 *
 * WHAT: a tiny real backend for The Signature AI. Holds YOUR Groq key as an
 * encrypted Worker secret — the key never appears in page source, git, or any
 * browser. Users just chat; the Worker adds the key server-side.
 *
 * SETUP (5 minutes, free):
 *  1. Free account at https://dash.cloudflare.com/sign-up (your email)
 *  2. Workers & Pages → Create → Create Worker → name it e.g. signature-apex
 *  3. Replace the worker code with this file → Deploy
 *  4. Settings → Variables → Add variable:
 *       name  = GROQ_KEY        value = your groq key   (Encrypt!)
 *       name  = SITE_TOKEN       value = any random string you invent (Encrypt!)
 *  5. Copy the worker URL (https://signature-apex.<you>.workers.dev)
 *  6. On The Signature AI site → ⚙ Settings → paste it in "Backend URL" → Save.
 *     From then on NOBODY needs a key — not you, not users.
 *
 * SAFETY: per-IP rate limit below stops one abuser burning your quota.
 * Groq free tier is per-key; heavy abuse just slows down, costs nothing.
 */

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TOKENS = 800;
const ALLOWED_MODELS = null; /* null = any model Groq serves your key; or set ['openai/gpt-oss-120b'] */

/* simple per-IP sliding window (per isolate; good enough for abuse damping) */
const hits = new Map();
function rateOk(ip) {
  const now = Date.now(), win = 60 * 1000, max = 20;
  let a = hits.get(ip) || [];
  a = a.filter(t => now - t < win);
  a.push(now); hits.set(ip, a);
  return a.length <= max;
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://justinahiggins614-cmyk.github.io').split(',');
  const ok = allowed.some(a => origin && origin.startsWith(a.trim()));
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0].trim(),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Site-Token',
    'Content-Type': 'application/json'
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const headers = cors(req.headers.get('Origin'), env);
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    if (url.pathname !== '/chat' || req.method !== 'POST')
      return new Response(JSON.stringify({ error: 'Signature Apex proxy — POST /chat' }), { headers });

    /* cheap gate: page sends the site token (stops drive-by use of the endpoint) */
    if (env.SITE_TOKEN && req.headers.get('X-Site-Token') !== env.SITE_TOKEN)
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    if (!rateOk(ip))
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'Too many requests — wait a minute.' }), { status: 429, headers });

    if (!env.GROQ_KEY)
      return new Response(JSON.stringify({ error: 'no_key', message: 'Backend key not configured.' }), { status: 500, headers });

    let body;
    try { body = await req.json(); } catch (e) {
      return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers });
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : null;
    if (!messages || !messages.length)
      return new Response(JSON.stringify({ error: 'no_messages' }), { status: 400, headers });
    /* keep roles tight: only system/user/assistant/tool allowed through */
    const clean = messages.filter(m => ['system','user','assistant','tool'].includes(m.role))
      .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 4000),
                   ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                   ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
                   ...(m.name ? { name: m.name } : {}) }));
    let model = String(body.model || 'auto');
    if (model === 'auto' || (ALLOWED_MODELS && !ALLOWED_MODELS.includes(model)))
      model = (ALLOWED_MODELS && ALLOWED_MODELS[0]) || 'openai/gpt-oss-120b';

    const groqBody = { model, messages: clean, temperature: 0.7, max_tokens: MAX_TOKENS };
    if (Array.isArray(body.tools) && body.tools.length) {
      groqBody.tools = body.tools.slice(0, 6);
      groqBody.tool_choice = 'auto';
    }

    const gr = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_KEY },
      body: JSON.stringify(groqBody)
    });
    const data = await gr.json().catch(() => ({}));
    if (!gr.ok) {
      const msg = (data.error && data.error.message) || ('groq_' + gr.status);
      const code = gr.status === 401 ? 'badkey' : gr.status === 429 ? 'ratelimit' : 'api' + gr.status;
      return new Response(JSON.stringify({ error: code, message: msg }), { status: 502, headers });
    }
    return new Response(JSON.stringify(data), { headers });
  }
};
