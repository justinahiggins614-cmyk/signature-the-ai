/* ✳ SIGNATURE — Property of Justin Addam Higgins (JAH). Signature version. Built for the Signature network. */
/* ============================================================
 * SignatureLlama.ask(question) — the on-demand Signature Llama API.
 * Signature Llama: The Fully Cyber Utilizable AI
 * Independent model by Justin Addam Higgins. Not affiliated with Meta.
 *
 * Current model: SIGLLAMA-V2 ("Signature Llama v2", word-level, on-device).
 * Previous: SIGLLAMA-V1 (preserved, still downloadable — see manifest).
 *
 * Usage — paste into any web page, no keys, no setup:
 *
 *   <script src="https://justinahiggins614-cmyk.github.io/signature-llama/llama-api.js"></script>
 *   <script>
 *     SignatureLlama.ask("What is a token?").then(function(answer){
 *       console.log(answer);
 *     });
 *   </script>
 *
 * SignatureLlama.ask(question, opts) -> Promise<string>.
 * Answers with the trained model (SIGLLAMA-V2) when the engine is loaded on
 * the page, otherwise from the on-site knowledge base. Every answer is
 * labeled with its engine identity:
 *   "✦ Trained Llama v2 · SIGLLAMA-V2 · LOCAL · ON-DEVICE: ..."
 *   "Guide: ..."   (knowledge base — never labeled as a Llama model)
 * SignatureLlama.askWithProvenance(question, opts) returns the answer plus
 * the full machine-readable provenance record (ENGINE, MODEL_ID,
 * MODEL_VERSION, MODE, PROVIDER, LOCAL_OR_CLOUD, TEMPERATURE, TOP_K,
 * MAX_TOKENS, SEED, DETERMINISTIC, TIMESTAMP, PROVENANCE_STATUS,
 * FALLBACK_REASON).
 * SignatureLlama.mode() reports the current mode:
 *   'trained' | 'guide' | 'loading' | 'failed'.
 * Options (opts): {
 *   allowFallback: true|false (default true) — when false and the model is
 *     not loaded, the promise rejects with MODEL_NOT_FOUND instead of
 *     answering from the knowledge base;
 *   requireModel: true|false (default false) — same as allowFallback:false,
 *     explicit opt-in to trained-model-only answers;
 *   deterministic: true|false, seed: <integer>,
 *   temperature, topK, maxTokens, timeoutMs
 * }
 * Industry Standard: SignatureLlama.askIndustry(question, opts) answers with
 * the full-scale cloud Llama (needs industry-llama.js + the user's free key),
 * labeled "⬢ Industry Standard · <model> · CLOUD · REMOTE". It is NOT the
 * on-device Signature Llama. SignatureLlama.industryReady() says if a key
 * is saved.
 * SignatureLlama.verifyIntegration() — phone-book integration proof: fetches
 * model-status.json and compares the live engine/weights/vocab hashes with
 * the pinned values, so other sites can verify they run the SAME engine and
 * weights automatically instead of trusting a typed claim.
 * License: free for any website, app, or project. No API key, no fee.
 * ============================================================ */
(function () {
  'use strict';
  var SITE = 'https://justinahiggins614-cmyk.github.io/signature-llama/';
  var MODEL_ID = 'SIGLLAMA-V2';
  var MODEL_VERSION = '2.0';
  var ENGINE_NAME = 'sigllama.js';
  /* Pinned identity — the exact bytes this API was released against. */
  var PINNED = {
    model_id: 'SIGLLAMA-V2',
    model_version: '2.0',
    engine_sha256: 'a8bc903a244c7f2ea8575100433548bfe238a468fb0012a956be6e986a47e50b',
    weights_sha256: 'e351a9e1133a1774782d9f6f0e77f6ab756ca769af59fbbe763f6321e32d7049',
    vocab_sha256: '94a6847481fe2344ff1f6dd732a8bc790279eb0edd3bfd0ea0b0678240fafe9c',
    vocab_tokens: 2879,
    context_length: 96
  };
  var FALLBACK_REASONS = ['model-not-loaded', 'model-download-failed',
    'unsupported-browser', 'corrupted-weights', 'engine-failure',
    'quality-gate-rejected', 'user-asked-guide'];

  var STOP = { the:1, a:1, an:1, of:1, to:1, is:1, it:1, in:1, and:1,
    what:1, how:1, does:1, do:1, for:1, with:1, on:1, by:1, i:1, you:1,
    me:1, my:1, this:1, that:1, tell:1, about:1, please:1, can:1, explain:1 };
  var kbCache = null;

  function namedError(code, message) {
    var e = new Error(message); e.code = code; return e;
  }
  /* Sampling validation — named errors, never silent clamping. */
  function validateSampling(opts) {
    opts = opts || {};
    function num(v, name) {
      if (v === undefined || v === null) return undefined;
      if (typeof v !== 'number' || isNaN(v) || !isFinite(v))
        throw namedError('INVALID_ARGUMENT', name + ' must be a finite number.');
      return v;
    }
    var t = num(opts.temperature, 'temperature');
    var k = num(opts.topK, 'topK');
    var m = num(opts.maxTokens, 'maxTokens');
    if (k !== undefined && (k < 1 || k > PINNED.vocab_tokens || Math.floor(k) !== k))
      throw namedError('INVALID_ARGUMENT',
        'topK must be an integer from 1 to ' + PINNED.vocab_tokens + '.');
    if (m !== undefined && (m < 1 || Math.floor(m) !== m))
      throw namedError('INVALID_ARGUMENT', 'maxTokens must be a positive integer.');
    if (opts.seed !== undefined && opts.seed !== null &&
        (typeof opts.seed !== 'number' || Math.floor(opts.seed) !== opts.seed || !isFinite(opts.seed)))
      throw namedError('INVALID_ARGUMENT', 'seed must be an integer.');
    if (opts.timeoutMs !== undefined && opts.timeoutMs !== null) {
      var ms = num(opts.timeoutMs, 'timeoutMs');
      if (ms < 0) throw namedError('INVALID_ARGUMENT', 'timeoutMs cannot be negative.');
    }
    return { temperature: t, topK: k, maxTokens: m };
  }
  function stamp() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function words(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(function (w) { return w && !STOP[w]; });
  }
  function fetchKB() {
    if (kbCache) return Promise.resolve(kbCache);
    return fetch(SITE + 'data/explainer-kb.json').then(function (r) { return r.json(); })
      .then(function (j) { kbCache = j.entries || j; return kbCache; })
      .catch(function () { kbCache = []; return kbCache; });
  }
  /* Conversational pre-pass for the Guide API path (Manon's order: real dialog,
     never the same canned block). Self-contained — llama-api.js is standalone. */
  var guideConvSeen = [];
  function guideConvReply(question) {
    var t = ' ' + String(question || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    var bank = null;
    if (/test(ing)? .{0,12}(you|u)|to see if|are you (aware|conscious|sentient|alive)/.test(t)) bank = [
      'Fair test, and I will answer it straight: I am the on-site guide — a curated conversational layer, not the trained model, and not conscious. Judge me on the answers, not the label. Ask me something real.',
      'Good — test away. Honest answer: I am the guide, not the 4-million-parameter model and not a mind. What I can do is talk through this whole project with you, coherently. Hit me.' ];
    else if (/you( are|'re| r) (repeating|saying).{0,15}(same|again)|same (thing|answer|block).{0,12}(twice|again)|already said|copy.?paste|keep repeating/.test(t)) bank = [
      'You are right — I handed you the same canned answer twice. That ends here. Ask me again in plain words and I will actually answer it.',
      'Fair catch. I repeated myself instead of answering. Give me the question again and I will give you a real answer this time.' ];
    else if (/(are you|are u|r u).{0,12}(ai|an ai|artificial|real|a robot|a bot)\b|who are you|what are you/.test(t)) bank = [
      'I am Signature Llama — the on-site guide for this project. I chat, explain AI and language models, answer questions about the Llama project, and point you to the right file, library, or tool. What do you want to dig into?',
      'Signature Llama, at your service — I am the guide that lives on this page. I explain the model, its files and tools, and I chat in plain words. Try me with a real question.' ];
    else if (/^(hi|hii+|hey|hello|yo|howdy|sup)\b/.test(t.replace(/^ /, ''))) bank = [
      'Hey — good to see you. What do you want to talk through?',
      'Hello! What is on your mind — the model, the files, the tools?' ];
    else if (/thank|thx|\bty\b/.test(t)) bank = [ 'Anytime. What is next?', 'You are welcome — keep the questions coming.' ];
    else if (/^(bye|goodbye|see you|later|cya)\b/.test(t.replace(/^ /, ''))) bank = [
      'Later — I will be here when you come back.', 'Goodbye for now.' ];
    else if (/what can you do|your duties|your job|\bhelp\b|what do you do/.test(t)) bank = [
      'Here is my whole job: I chat in plain human words, explain AI and language models clearly, answer questions about the Signature Llama project, and point you to the right file, library, or tool.' ];
    if (!bank) return null;
    for (var i = 0; i < bank.length; i++) {
      if (guideConvSeen.indexOf(bank[i]) < 0) {
        guideConvSeen.push(bank[i]);
        while (guideConvSeen.length > 6) guideConvSeen.shift();
        return bank[i];
      }
    }
    return bank[0];
  }
  function answerFromKB(question, kb) {
    var conv = guideConvReply(question);
    if (conv) return 'Signature Llama: ' + conv;
    var ws = words(question), best = null, bestScore = 0;
    kb.forEach(function (e) {
      var hay = (e.title + ' ' + (e.kw || []).join(' ') + ' ' + e.text).toLowerCase();
      var score = 0;
      ws.forEach(function (w) {
        if (hay.indexOf(w) >= 0) score += ((e.kw || []).indexOf(w) >= 0 ? 3 : 1);
      });
      if (score > bestScore) { bestScore = score; best = e; }
    });
    if (best && bestScore >= 2) return best.title + ': ' + best.text;
    /* retired the old canned block — honest, varied dontknow instead */
    var dks = [
      'I do not have a good answer for that one yet. I know the Llama project cold — the model, sigllama.js, the weights, the versions, the downloads — so steer me there and I will deliver.',
      'That is outside what I know well. My ground is the Signature Llama project: files, tools, versions, how to use the model in your own page. What part of that are you after?'
    ];
    var dk = dks[0], i;
    for (i = 0; i < dks.length; i++) {
      if (guideConvSeen.indexOf(dks[i]) < 0) { dk = dks[i]; break; }
    }
    guideConvSeen.push(dk);
    while (guideConvSeen.length > 6) guideConvSeen.shift();
    return 'Signature Llama: ' + dk;
  }
  function trainedReady() {
    try { return !!(window.SigLlama && SigLlama.loaded && SigLlama.loaded()); }
    catch (e) { return false; }
  }
  function lastFallbackReason() {
    try {
      if (window.LlamaRuntime) {
        if (LlamaRuntime.lastFailure) return 'engine-failure';
        if (LlamaRuntime.mode === 'failed') return 'engine-failure';
      }
    } catch (e) {}
    return 'model-not-loaded';
  }

  var api = window.SignatureLlama = window.SignatureLlama || {};
  api.version = '2.0';
  api.site = SITE;
  api.modelId = MODEL_ID;
  api.modelVersion = MODEL_VERSION;
  api.pinned = PINNED;
  /* mode() -> 'trained' | 'guide' | 'loading' | 'failed' */
  api.mode = function () {
    if (trainedReady()) return 'trained';
    if (window.LlamaRuntime && window.LlamaRuntime.mode) return window.LlamaRuntime.mode;
    return 'guide';
  };
  /* The formal response format — every answer carries machine-readable provenance. */
  api.askWithProvenance = function (question, opts) {
    opts = opts || {};
    var samp;
    try { samp = validateSampling(opts); }
    catch (e) { return Promise.reject(e); }
    var allowFallback = opts.allowFallback !== false && opts.requireModel !== true;
    var ts = stamp();
    var prov = function (fields) {
      var base = {
        ENGINE: null, MODEL_ID: null, MODEL_VERSION: null, MODE: null,
        PROVIDER: 'local', LOCAL_OR_CLOUD: 'ON-DEVICE',
        TEMPERATURE: samp.temperature === undefined ? 0.7 : samp.temperature,
        TOP_K: samp.topK === undefined ? 40 : samp.topK,
        MAX_TOKENS: samp.maxTokens === undefined ? 140 : samp.maxTokens,
        SEED: (opts.seed === undefined || opts.seed === null) ? null : opts.seed,
        DETERMINISTIC: !!opts.deterministic,
        TIMESTAMP: ts, PROVENANCE_STATUS: '', FALLBACK_REASON: null
      };
      for (var k in fields) base[k] = fields[k];
      return base;
    };
    if (trainedReady()) {
      try {
        var gopts = {
          maxTokens: samp.maxTokens === undefined ? 140 : samp.maxTokens,
          temperature: samp.temperature === undefined ? 0.7 : samp.temperature,
          topK: samp.topK === undefined ? 40 : samp.topK,
          stopAtEos: true
        };
        if (opts.deterministic) gopts.temperature = 0;
        var p = SigLlama.generate(
          'You are the Signature Llama on-site guide. Explain clearly and briefly: ' + question,
          gopts);
        if (opts.timeoutMs && opts.timeoutMs > 0) {
          p = Promise.race([p, new Promise(function (_, rej) {
            setTimeout(function () { rej(namedError('GENERATION_TIMEOUT',
              'Generation did not finish within timeoutMs.')); }, opts.timeoutMs);
          })]);
        }
        return p.then(function (t) {
          return {
            answer: t,
            engine: ENGINE_NAME, mode: 'trained_model',
            model_id: MODEL_ID, model_version: MODEL_VERSION,
            provenance: prov({
              ENGINE: ENGINE_NAME, MODEL_ID: MODEL_ID, MODEL_VERSION: MODEL_VERSION,
              MODE: 'trained_model',
              TEMPERATURE: gopts.temperature, TOP_K: gopts.topK, MAX_TOKENS: gopts.maxTokens,
              PROVENANCE_STATUS: 'generated by ' + ENGINE_NAME + ' (' + MODEL_ID + ') on this device — verify anything important',
              FALLBACK_REASON: null
            })
          };
        }, function (e) {
          if (!allowFallback) throw e;
          return kbFallback(question, ts, 'engine-failure', samp, opts);
        });
      } catch (e) { /* fall through to the knowledge base */ }
    }
    if (!allowFallback) {
      return Promise.reject(namedError('MODEL_NOT_FOUND',
        'The trained model is not loaded and allowFallback:false (requireModel:true) was passed — no knowledge-base answer was given.'));
    }
    return kbFallback(question, ts, lastFallbackReason(), samp, opts);
  };
  function kbFallback(question, ts, reason, samp, opts) {
    return fetchKB().then(function (kb) {
      return {
        answer: answerFromKB(question, kb),
        engine: 'guide', mode: 'guide', model_id: null, model_version: null,
        provenance: {
          ENGINE: 'guide', MODEL_ID: null, MODEL_VERSION: null, MODE: 'guide',
          PROVIDER: 'local', LOCAL_OR_CLOUD: 'N/A',
          TEMPERATURE: null, TOP_K: null, MAX_TOKENS: null,
          SEED: (opts.seed === undefined || opts.seed === null) ? null : opts.seed,
          DETERMINISTIC: !!opts.deterministic,
          TIMESTAMP: ts,
          PROVENANCE_STATUS: 'answered by the on-site knowledge base — curated text, NOT model output, never labeled as a Llama model',
          FALLBACK_REASON: reason
        }
      };
    });
  }
  /* ask(question, opts) -> Promise<string>, answer labeled with its engine identity */
  api.ask = function (question, opts) {
    return api.askWithProvenance(question, opts).then(function (r) {
      return r.mode === 'trained_model'
        ? '✦ Trained Llama v2 · SIGLLAMA-V2 · LOCAL · ON-DEVICE: ' + r.answer
        : 'Guide: ' + r.answer;
    });
  };
  /* Industry Standard: full-scale Llama via the cloud client (industry-llama.js).
   * Needs window.IndustryLlama and a saved key; otherwise the Promise rejects
   * with an Error carrying .code (MISSING_KEY, BAD_KEY, RATE_LIMITED,
   * NETWORK, BAD_RESPONSE). Replies are labeled '⬢ Industry Standard' and
   * are NOT the on-device Signature Llama. */
  api.askIndustry = function (question, opts) {
    opts = opts || {};
    if (!window.IndustryLlama) {
      return Promise.reject(namedError('ENGINE_LOAD_FAILED',
        'IndustryLlama engine file (industry-llama.js) is not loaded on this page.'));
    }
    var ts = stamp();
    return IndustryLlama.chat([
      { role: 'user', content: String(question) }
    ], { maxTokens: opts.maxTokens || 600 }).then(function (t) {
      var label = IndustryLlama.modelLabel ? IndustryLlama.modelLabel() : 'Llama';
      return {
        answer: t, engine: 'industry-llama.js', mode: 'industry',
        model_id: IndustryLlama.getModel ? IndustryLlama.getModel() : null,
        model_version: label,
        provenance: {
          ENGINE: 'industry-llama.js', MODEL_ID: IndustryLlama.getModel ? IndustryLlama.getModel() : null,
          MODEL_VERSION: label, MODE: 'industry', PROVIDER: 'groq', LOCAL_OR_CLOUD: 'CLOUD',
          TEMPERATURE: 0.7, TOP_K: null, MAX_TOKENS: opts.maxTokens || 600,
          SEED: null, DETERMINISTIC: false, TIMESTAMP: ts,
          PROVENANCE_STATUS: 'generated by a full-scale cloud Llama via Groq — REMOTE, not the on-device Signature Llama; verify anything important',
          FALLBACK_REASON: null
        },
        labeled: '⬢ Industry Standard · ' + label + ' · CLOUD · REMOTE: ' + t
      };
    });
  };
  api.industryReady = function () {
    return !!(window.IndustryLlama && IndustryLlama.ready());
  };
  /* verifyIntegration() — automatic proof for other sites (e.g. the Telephone
   * Book) that they run the SAME engine and weights. Returns
   * {ok, model_id, model_version, engine_hash_match, weights_hash_match,
   *  vocab_hash_match, detail}. Never a typed claim — it checks bytes. */
  api.verifyIntegration = function () {
    return fetch(SITE + 'model-status.json').then(function (r) {
      if (!r.ok) throw namedError('MODEL_NOT_FOUND', 'model-status.json unreachable');
      return r.json();
    }).then(function (st) {
      var e = (st.engine || {}).sha256, w = (st.weights || {}).sha256, v = (st.vocab || {}).sha256;
      var ok = st.MODEL_ID === PINNED.model_id &&
        e === PINNED.engine_sha256 && w === PINNED.weights_sha256 && v === PINNED.vocab_sha256;
      return {
        ok: ok,
        model_id: st.MODEL_ID, model_version: st.MODEL_VERSION,
        engine_hash_match: e === PINNED.engine_sha256,
        weights_hash_match: w === PINNED.weights_sha256,
        vocab_hash_match: v === PINNED.vocab_sha256,
        engine_hash: e, weights_hash: w, vocab_hash: v,
        detail: ok ? 'same engine + weights + vocab as the pinned SIGLLAMA-V2 release'
                   : 'DIVERGED from the pinned SIGLLAMA-V2 release — do not claim integration'
      };
    });
  };
  /* reproPackage(result) — the reproducibility package for an askWithProvenance
   * result: prompt + settings + model/engine/vocab identity + output hash. */
  api.reproPackage = function (result, prompt) {
    var p = result.provenance || {};
    return {
      prompt: String(prompt === undefined ? '' : prompt),
      seed: p.SEED, deterministic: p.DETERMINISTIC,
      temperature: p.TEMPERATURE, topK: p.TOP_K, maxTokens: p.MAX_TOKENS,
      model_id: p.MODEL_ID, model_version: p.MODEL_VERSION,
      model_hash: p.MODEL_ID === 'SIGLLAMA-V2' ? PINNED.weights_sha256 : null,
      engine_version: '1.0', engine_hash: PINNED.engine_sha256,
      vocab_hash: PINNED.vocab_sha256,
      output_hash: sha256hex(String(result.answer || '')),
      timestamp: p.TIMESTAMP
    };
  };
  function sha256hex(s) {
    /* sync fallback: a short deterministic digest when crypto.subtle is absent */
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
      h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519);
    }
    function hex(n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }
    return 'fnv-mix:' + hex(h1) + hex(h2);
  }
  /* formal API surface (also published in sigllama.d.ts) */
  api.api = ['ask', 'askWithProvenance', 'askIndustry', 'industryReady',
    'mode', 'verifyIntegration', 'reproPackage'];
  api.errorCodes = ['INVALID_ARGUMENT', 'MODEL_NOT_FOUND', 'MODEL_CORRUPT',
    'HASH_MISMATCH', 'ENGINE_LOAD_FAILED', 'GENERATION_TIMEOUT', 'GENERATION_FAILED',
    'MISSING_KEY', 'BAD_KEY', 'RATE_LIMITED', 'NETWORK', 'BAD_RESPONSE',
    'BROWSER_UNSUPPORTED', 'OUT_OF_MEMORY', 'NETWORK_REQUIRED', 'CONTEXT_TOO_LARGE'];
})();
