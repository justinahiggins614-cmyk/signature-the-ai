/* ✳ SIGNATURE — Apex AI engine 2.0. Property of Justin Addam Higgins (JAH).
   Cloud-LLM chat with real tool calling. Key lives ONLY on the user's device
   (localStorage) and is sent ONLY to the provider's API. No key is ever baked in. */
var ApexAI = (function () {
  var KEY_NAME = 'sig_apex_groq_key';
  var MODEL_KEY = 'sig_apex_model';
  var MODEL = null; /* resolved at runtime */
  var PREFER = ['llama-3.3-70b-versatile','llama-3.1-70b-versatile','openai/gpt-oss-120b',
    'qwen/qwen3-32b','qwen/qwen3.8-27b','meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct','openai/gpt-oss-20b',
    'llama-3.1-8b-instant','gemma2-9b-it','llama3-70b-8192','llama3-8b-8192'];
  function chatModels(ids){
    return ids.filter(function(id){
      var l=id.toLowerCase();
      return !/whisper|tts|prompt-guard|embed|moderation|vision|image|audio|tool-use$/.test(l);
    });
  }
  function pickBest(ids){
    var avail=chatModels(ids);
    for(var i=0;i<PREFER.length;i++) if(avail.indexOf(PREFER[i])>=0) return PREFER[i];
    return avail[0]||null;
  }
  function storedModel(){ try{ return localStorage.getItem(MODEL_KEY)||'auto'; }catch(e){ return 'auto'; } }
  function listModels(){
    return fetch('https://api.groq.com/openai/v1/models',{headers:{'Authorization':'Bearer '+ApexAI.key()}})
      .then(function(r){ if(!r.ok) throw new Error('models'+r.status); return r.json(); })
      .then(function(d){ return chatModels((d.data||[]).map(function(m){return m.id;})); });
  }
  function resolveModel(){
    var st=storedModel();
    if(st && st!=='auto') return Promise.resolve(st);
    return listModels().then(function(ids){
      var best=pickBest(ids);
      if(!best) throw new Error('nomodel');
      MODEL=best; return best;
    });
  }
  function modelNotFoundMsg(d){
    try{ return /model/i.test(d.error.message||''); }catch(e){ return false; }
  }
  var API = 'https://api.groq.com/openai/v1/chat/completions';
  var NET = 'https://justinahiggins614-cmyk.github.io';
  var hist = []; /* {role, content} — this session */

  var TOOLS = [
    { type: 'function', 'function': { name: 'define_word',
      description: 'Look up a word in the live Signature Dictionary. Use for define/meaning/spelling questions.',
      parameters: { type: 'object', properties: { word: { type: 'string', description: 'The word to define' } }, required: ['word'] } } },
    { type: 'function', 'function': { name: 'calculate',
      description: 'Safely evaluate a math expression (supports + - * / % ^ parentheses).',
      parameters: { type: 'object', properties: { expr: { type: 'string', description: 'Math expression, e.g. 12*8+3' } }, required: ['expr'] } } },
    { type: 'function', 'function': { name: 'wikipedia',
      description: 'Get a Wikipedia summary for web knowledge (people, places, history, science).',
      parameters: { type: 'object', properties: { title: { type: 'string', description: 'Article title to look up' } }, required: ['title'] } } },
    { type: 'function', 'function': { name: 'route_site',
      description: 'Point the user at a Signature network site (dictionary, wiki, calculator, patents, specs, music, llama, etc).',
      parameters: { type: 'object', properties: { topic: { type: 'string', description: 'What the user wants: e.g. patents, music, wiki, math' } }, required: ['topic'] } } }
  ];

  function sysPrompt() {
    return 'You are The Signature AI, the flagship Signature-version AI, built by Justin Addam Higgins (JAH). ' +
      'You are a top-tier assistant: reason carefully, be direct and warm, and never pad. ' +
      'TOOLS — use them proactively, never guess what a tool can answer: ' +
      'define_word (the live Signature Dictionary — every word lookup goes here), ' +
      'calculate (ALL math — never do arithmetic yourself), ' +
      'wikipedia (web knowledge: people, places, history, science — use for factual questions), ' +
      'route_site (pointing users at the 39-site Signature network). ' +
      'You may chain multiple tool calls to fully answer. After tool results arrive, synthesize a clean final answer — ' +
      'quote the facts you found, keep it tight. If tools fail, say so plainly and answer from what you know, labeled as such. ' +
      'Format for chat: short paragraphs, bullets for lists, no essays unless asked. ' +
      'Never claim to be Muse or Meta\u2019s model. Everything is free forever; nothing here costs the user money.';
  }
  function safeCalc(expr) {
    try {
      var e = String(expr).replace(/\^/g, '**');
      if (!/^[\d\s+\-*/().%*]+$/.test(e) || !/\d/.test(e)) return 'not a valid math expression';
      var v = Function('"use strict";return (' + e + ')')();
      return (typeof v === 'number' && isFinite(v)) ? String(v) : 'could not calculate';
    } catch (err) { return 'could not calculate'; }
  }

  function runTool(name, args) {
    args = args || {};
    try { ApexAI.onTool && ApexAI.onTool(name, args); } catch (e) {}
    if (name === 'define_word') {
      return dictLookup(args.word).then(function (row) {
        if (row) return row[0] + (row[1] ? ' (' + row[1] + ')' : '') + ': ' + (row[3] || 'on file') + ' [Signature Dictionary ' + row[4] + ']';
        return 'Not found in the Signature Dictionary: ' + args.word;
      });
    }
    if (name === 'calculate') return Promise.resolve(safeCalc(args.expr));
    if (name === 'wikipedia') {
      return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(args.title))
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { return (j.title ? j.title + ': ' : '') + (j.extract || 'no summary'); })
        .catch(function () { return 'Wikipedia lookup failed for: ' + args.title; });
    }
    if (name === 'route_site') {
      var t = String(args.topic || '').toLowerCase();
      var map = [
        ['dictionary', '3 Dictionary', NET + '/jah-dictionary'], ['word', '3 Dictionary', NET + '/jah-dictionary'],
        ['wiki', '4 JAH Wiki', NET + '/jah-wiki'], ['leak', '5 JAH-N Wiki Leaks', NET + '/jah-n-wiki-leaks'],
        ['calcul', '2 Calculator', NET + '/jah-calculator'], ['math', '2 Calculator', NET + '/jah-calculator'],
        ['patent', '8 Patent Catalog', NET + '/cyber-patent-catalog'],
        ['spec', '9 Spec Catalog', NET + '/signature-one-archive/specs.html'],
        ['music', '23 Music Studio', NET + '/signature-ai-song-maker'], ['song', '23 Music Studio', NET + '/signature-ai-song-maker'],
        ['llama', '6 Signature Llama', NET + '/signature-llama'], ['phone', '7 AI Phone Book', NET + '/jah-ai-models'],
        ['book', '11 Book Depository', NET + '/signature-books'], ['mall', '36 Cyber Mega-Mall', NET + '/signature-cyber-mega-mall']
      ];
      for (var i = 0; i < map.length; i++) if (t.indexOf(map[i][0]) >= 0) return Promise.resolve('Site ' + map[i][1] + ': ' + map[i][2]);
      return Promise.resolve('Signature network: ' + NET + '/signature-the-ai (39 sites — ask which one)');
    }
    return Promise.resolve('unknown tool: ' + name);
  }

  function groq(messages, tools, retried) {
    function doCall(model){
      MODEL=model;
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ApexAI.key() },
        body: JSON.stringify({ model: model, messages: messages, tools: tools, tool_choice: 'auto', temperature: 0.7, max_tokens: 800 })
      }).then(function (r) {
        if (r.status === 401) throw new Error('badkey');
        if (r.status === 429) throw new Error('ratelimit');
        if (!r.ok) return r.json().then(function(d){
          if(!retried && modelNotFoundMsg(d)){ try{localStorage.removeItem(MODEL_KEY);}catch(e){}
            return resolveModel().then(function(m2){ return groq(messages, tools, true); }); }
          throw new Error('api'+r.status);
        }, function(){ throw new Error('api'+r.status); });
        return r.json();
      }, function () { throw new Error('netfail'); });
    }
    if(MODEL && storedModel()!=='auto') return doCall(MODEL);
    return resolveModel().then(doCall);
  }
  function errText(e) {
    var m = (e && e.message) || '';
    if (m === 'badkey') return 'That key was rejected by Groq. Check the copy at console.groq.com/keys, or press Forget key and try a fresh one.';
    if (m === 'ratelimit') return 'Groq rate limit hit (free tier busy). Wait a minute and try again — your key is fine.';
    if (m.indexOf('api') === 0) return 'Groq returned error ' + m.slice(3) + '. Try again in a bit.';
    return 'Your phone could not reach Groq at all (connection blocked or offline). Check your connection — or try full Chrome instead of the Facebook in-app browser, which sometimes blocks API calls.';
  }

  function ask(q) {
    var messages = [{ role: 'system', content: sysPrompt() }];
    hist.forEach(function (h) { messages.push(h); });
    messages.push({ role: 'user', content: q });
    var rounds = 0;
    function loop() {
      return groq(messages, TOOLS).then(function (data) {
        var msg = data.choices[0].message;
        if (msg.tool_calls && msg.tool_calls.length && rounds < 8) {
          rounds++;
          messages.push(msg);
          var chain = Promise.resolve();
          msg.tool_calls.forEach(function (tc) {
            chain = chain.then(function () {
              var a = {};
              try { a = JSON.parse(tc['function']['arguments'] || '{}'); } catch (e) {}
              return runTool(tc['function'].name, a).then(function (out) {
                messages.push({ role: 'tool', tool_call_id: tc.id, content: String(out).slice(0, 2000) });
              });
            });
          });
          return chain.then(loop);
        }
        var text = msg.content || '(no answer)';
        hist.push({ role: 'user', content: q }, { role: 'assistant', content: text });
        if (hist.length > 20) hist = hist.slice(-20);
        return text;
      });
    }
    return loop();
  }

  function complete(messages, maxTokens) {
    function doC(model){
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ApexAI.key() },
      body: JSON.stringify({ model: model, messages: messages, temperature: 0.6, max_tokens: maxTokens || 900 })
    }).then(function (r) {
      if (r.status === 401) throw new Error('badkey');
      if (r.status === 429) throw new Error('ratelimit');
      if (!r.ok) throw new Error('api' + r.status);
      return r.json();
    }, function () { throw new Error('netfail'); })
    .then(function (d) { return d.choices[0].message.content || ''; });
    }
    return resolveModel().then(doC);
  }

  return {
    onTool: null,
    complete: complete,
    listModels: listModels,
    currentModel: function(){ return MODEL||storedModel(); },
    setModel: function(id){ try{ localStorage.setItem(MODEL_KEY, id); }catch(e){} MODEL=(id==='auto'?null:id); },
    resolveModel: resolveModel,
    key: function () { try { return (localStorage.getItem(KEY_NAME) || '').trim(); } catch (e) { return ''; } },
    hasKey: function () { return this.key().length > 10; },
    saveKey: function (k) { try { localStorage.setItem(KEY_NAME, String(k).trim()); } catch (e) {} },
    forgetKey: function () { try { localStorage.removeItem(KEY_NAME); } catch (e) {} hist = []; },
    clearHist: function () { hist = []; },
    ask: ask,
    errText: errText
  };
})();
