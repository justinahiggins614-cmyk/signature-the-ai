/* ✳ SIGNATURE — Apex AI engine 2.0. Property of Justin Addam Higgins (JAH).
   Cloud-LLM chat with real tool calling. Key lives ONLY on the user's device
   (localStorage) and is sent ONLY to the provider's API. No key is ever baked in. */
var ApexAI = (function () {
  var KEY_NAME = 'sig_apex_groq_key';
  var MODEL = 'llama-3.3-70b-versatile';
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
      'You are warm, direct, and honest. You have real tools: define_word (the live Signature Dictionary with all its words), ' +
      'calculate (safe math), wikipedia (web knowledge), route_site (the 39-site Signature network). ' +
      'Use tools whenever the user asks about words, math, facts, or the network — never guess what a tool can answer. ' +
      'Keep answers short and plain-spoken like a chat, not essays. Never claim to be Muse or Meta\'s model. ' +
      'Everything is free forever; nothing here costs the user money.';
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

  function groq(messages, tools) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ApexAI.key() },
      body: JSON.stringify({ model: MODEL, messages: messages, tools: tools, tool_choice: 'auto', temperature: 0.7, max_tokens: 800 })
    }).then(function (r) {
      if (r.status === 401) throw new Error('badkey');
      if (!r.ok) throw new Error('api' + r.status);
      return r.json();
    });
  }

  function ask(q) {
    var messages = [{ role: 'system', content: sysPrompt() }];
    hist.forEach(function (h) { messages.push(h); });
    messages.push({ role: 'user', content: q });
    var rounds = 0;
    function loop() {
      return groq(messages, TOOLS).then(function (data) {
        var msg = data.choices[0].message;
        if (msg.tool_calls && msg.tool_calls.length && rounds < 5) {
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

  return {
    key: function () { try { return (localStorage.getItem(KEY_NAME) || '').trim(); } catch (e) { return ''; } },
    hasKey: function () { return this.key().length > 10; },
    saveKey: function (k) { try { localStorage.setItem(KEY_NAME, String(k).trim()); } catch (e) {} },
    forgetKey: function () { try { localStorage.removeItem(KEY_NAME); } catch (e) {} hist = []; },
    clearHist: function () { hist = []; },
    ask: ask
  };
})();
