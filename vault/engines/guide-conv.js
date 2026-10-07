/* ✳ SIGNATURE — Property of Justin Addam Higgins (JAH). Signature version. Built for the Signature network. */
/* ---------- Guide conversational layer (Manon's order: talk like a real AI) ----------
   Real dialog: session memory, intent handling, varied phrasing, never repeats.
   The old canned "The guide" fallback is retired — it is never emitted. */
var GuideConv = (function () {
  var turns = [];      /* {q, a} — last 8 exchanges */
  var recentSigs = []; /* signatures of the last 6 replies: no verbatim repeats */
  var cursors = {};
  var MAX_TURNS = 8;
  function norm(s) {
    return ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }
  function sig(s) {
    var w = String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    var stop = { the: 1, a: 1, an: 1, of: 1, to: 1, is: 1, it: 1, in: 1, and: 1, for: 1, with: 1, on: 1, that: 1, this: 1, i: 1, you: 1 };
    var out = [];
    for (var i = 0; i < w.length && out.length < 8; i++) if (!stop[w[i]]) out.push(w[i]);
    return out.join(' ');
  }
  /* variant rotation that skips anything said recently */
  function pick(bucket, variants) {
    var c = cursors[bucket] || 0, i, v;
    for (i = 0; i < variants.length; i++) {
      v = variants[(c + i) % variants.length];
      if (recentSigs.indexOf(sig(v)) < 0) {
        cursors[bucket] = (c + i + 1) % variants.length;
        return v;
      }
    }
    v = variants[c % variants.length];
    cursors[bucket] = (c + 1) % variants.length;
    return v;
  }
  function remember(q, a) {
    turns.push({ q: String(q || ''), a: String(a || '') });
    while (turns.length > MAX_TURNS) turns.shift();
    recentSigs.push(sig(a));
    while (recentSigs.length > 6) recentSigs.shift();
  }
  var R = {
    repeat: [
      'You are right — I handed you the same canned answer twice. That ends here. Ask me again in plain words and I will actually answer it.',
      'Fair catch. I repeated myself instead of answering. Give me the question again and I will give you a real answer this time.',
      'Point taken — same block twice is not a conversation. What were you actually asking? I will answer it straight.'
    ],
    identity: [
      'I am Signature Llama — the on-site guide for this project. I chat, explain AI and language models, answer questions about the Llama project, and point you to the right file, library, or tool. What do you want to dig into?',
      'Signature Llama, at your service — I am the guide that lives on this page. I explain the model, its files and tools, and I chat in plain words. Try me with a real question.',
      'I am the Signature Llama guide — built by Justin Addam Higgins as part of his Signature network. My job: talk through the Llama project with you, whatever angle you take.'
    ],
    test: [
      'Fair test, and I will answer it straight: I am the on-site guide — a curated conversational layer, not the trained model, and not conscious. Judge me on the answers, not the label. Ask me something real.',
      'Good — test away. Honest answer: I am the guide, not the 4-million-parameter model and not a mind. What I can do is talk through this whole project with you, coherently. Hit me.',
      'I like the test. Straight answer: no ghost in here — I am a curated guide for the Signature Llama project. The proof is in the dialog, so keep going and see if I keep up.'
    ],
    greet: [
      'Hey — good to see you. What do you want to talk through?',
      'Hello! What is on your mind — the model, the files, the tools?',
      'Hey there. Ask me anything about the Llama project, or just chat.'
    ],
    thanks: [
      'Anytime. What is next?',
      'You are welcome — keep the questions coming.',
      'Glad that helped. What else?'
    ],
    bye: [
      'Later — I will be here when you come back.',
      'Goodbye for now. The chat history stays until you hit Reset.',
      'See you — come back with harder questions next time.'
    ],
    duties: [
      'Here is my whole job: I chat in plain human words, explain AI and language models clearly, answer questions about the Signature Llama project, and point you to the right file, library, or tool. I also know the full JAH network — every site, what it does, where things live.',
      'What I do: talk through the Llama project with you — the model, the engine, the weights, the versions, the downloads — plus the whole Signature network of sites behind it. Ask me anything in that world.'
    ],
    dontknow: [
      'I do not have a good answer for that one yet. I know the Llama project cold — the model, sigllama.js, the weights, the versions, the downloads — so steer me there and I will deliver.',
      'That is outside what I know well. My ground is the Signature Llama project: files, tools, versions, how to use the model in your own page. What part of that are you after?',
      'Honest answer: I cannot speak to that. But the Llama project itself — ask me anything there.'
    ]
  };
  function isRepeat(t) {
    return /you( are|'re| r) (repeating|saying).{0,15}(same|again)|same (thing|answer|block).{0,12}(twice|again)|already said|copy.?paste|keep repeating|saying that again/.test(t);
  }
  function isIdentity(t) {
    return /(are you|are u|r u).{0,12}(ai|an ai|artificial|real|a robot|a bot)\b|who are you|what are you/.test(t);
  }
  function isTest(t) {
    return /test(ing)? .{0,12}(you|u)|to see if|are you (aware|conscious|sentient|alive)|just (a )?script/.test(t);
  }
  function isGreet(t) { return /^(hi|hii+|hey|hello|yo|howdy|sup|hiya)\b/.test(t.replace(/^ /, '')); }
  function isThanks(t) { return /thank|thx|appreciated|\bty\b/.test(t); }
  function isBye(t) { return /^(bye|goodbye|good ?night|see you|later|gtg|cya)\b/.test(t.replace(/^ /, '')); }
  function isDuties(t) { return /what can you do|your duties|your job|\bhelp( me)?\b|what do you do|abilities/.test(t); }
  function reply(q) {
    var t = norm(q), out;
    if (isTest(t)) out = pick('test', R.test);
    else if (isRepeat(t)) out = pick('repeat', R.repeat);
    else if (isIdentity(t)) out = pick('identity', R.identity);
    else if (isGreet(t)) out = pick('greet', R.greet);
    else if (isThanks(t)) out = pick('thanks', R.thanks);
    else if (isBye(t)) out = pick('bye', R.bye);
    else if (isDuties(t)) out = pick('duties', R.duties);
    else return null; /* not a conversational intent — caller tries KB / JAHtalk */
    return out;
  }
  return {
    reply: reply,
    remember: remember,
    dontknow: function () { return pick('dontknow', R.dontknow); },
    reset: function () { turns = []; recentSigs = []; cursors = {}; }
  };
})();
