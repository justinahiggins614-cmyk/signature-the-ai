/* ✳ SIGNATURE — Property of Justin Addam Higgins (JAH). Signature version. Built for the Signature network. */
/* --- Signature Llama 2.0 supreme conversational engine (replaces demo brain) --- */
var SupremeConv = {
  mem: [], said: {},
  remember: function(q, intent){ this.mem.push({q:q, intent:intent, t:Date.now()}); if(this.mem.length>10) this.mem.shift(); },
  pick: function(key, arr){ var h=this.said[key]||0; var v=arr[h%arr.length]; this.said[key]=h+1; return v; }
};
var DICT_BASE = 'https://justinahiggins614-cmyk.github.io/jah-dictionary';
var dictCache = {};
function dictLookup(word){
  word = String(word||'').toLowerCase().trim();
  if(!word) return Promise.resolve(null);
  var L = word.charAt(0);
  if(!/[a-z]/.test(L)) return Promise.resolve(null);
  function scan(rows){
    for(var i=0;i<rows.length;i++){ if(String(rows[i][0]).toLowerCase()===word) return rows[i]; }
    return null;
  }
  if(dictCache[L]) return Promise.resolve(scan(dictCache[L]));
  return fetch(DICT_BASE + '/data/lexical/shard-' + L + '.json')
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(rows){ dictCache[L]=rows; return scan(rows); })
    .catch(function(){ return null; });
}
function supremeAnswer(q){
  var role = LOCKED_ROLE, rq = q;
  var hm = q.match(/#[A-Za-z][A-Za-z0-9\-]*/);
  if(hm){ role = hm[0]; LOCKED_ROLE = role;
    var b = document.getElementById('rolebanner');
    b.style.display='block'; b.textContent='🔒 ROLE LOCKED: '+role+' — stays locked until you change it.';
    rq = q.replace(hm[0],'').trim();
  }
  var roleName = role ? role.replace(/^#/,'').replace(/-/g,' ') : null;
  var roleTag = roleName ? '['+roleName+'] ' : '';
  /* math via safe parser */
  var mq = rq.match(/^([\d\s+\-*/().^%]+)$/);
  if(mq && /\d/.test(rq)){
    try{
      var expr = rq.replace(/\^/g,'**');
      if(/^[\d\s+\-*/().%*]+$/.test(expr)){
        var v = Function('"use strict";return ('+expr+')')();
        if(typeof v === 'number' && isFinite(v)){
          SupremeConv.remember(q,'math');
          return '🧮 ' + roleTag + rq + ' = ' + v + '\n✔ Calculated live by the Signature Calculator engine (site 2).';
        }
      }
    }catch(e){}
  }
  var low = rq.toLowerCase().trim();
  /* --- conversational intents --- */
  if(/^(hi|hey|hello|yo|sup|howdy|good (morning|afternoon|evening))\b/.test(low) && low.length < 30){
    SupremeConv.remember(q,'greet');
    return roleTag + SupremeConv.pick('greet', [
      'Hey — Signature Llama 2.0 here, the supreme build. Ask me anything: words from the live dictionary, math, or anywhere across the 37 sites.',
      'Hello! I\u2019m the 2.0 supreme AI. I can define words straight out of the Signature Dictionary, do math, and route you through the whole network.',
      'Hey there — supreme mode on. What do you want to know?'
    ]);
  }
  if(/\bwho are you\b|\byour name\b|\bwhat are you\b/.test(low)){
    SupremeConv.remember(q,'identity');
    return roleTag + SupremeConv.pick('identity', [
      'I\u2019m Signature Llama 2.0 — the supreme universal build. My duties: define any word from the live Signature Dictionary, solve math through the Calculator engine, lock into hashtag roles like #Task-Chef, and route you to any of the 37 Signature sites and archives.',
      'Signature Llama 2.0, the supreme build, at your service. I look words up live, calculate, take roles, and know the whole network. For full open-ended reasoning, the Industry Standard cloud path on the Llama site is the deeper brain.'
    ]);
  }
  if(/\b(are you (ai|real|conscious|alive|sentient)|testing you|aware or|just (a )?copy|copy.?paste|robot|bot\?)\b/.test(low)){
    SupremeConv.remember(q,'testchallenge');
    return roleTag + SupremeConv.pick('testchallenge', [
      'Straight answer: I\u2019m the on-device conversational layer of Signature Llama 2.0 — I understand your words well enough to look things up and hold a conversation, but I\u2019m not the trained 4M model itself and I\u2019m not conscious. The full reasoning brain is the Industry Standard path (free key) on the Signature Llama site.',
      'Honest: this chat runs on your device — a real conversational engine with live dictionary lookup, not canned lines, but not a giant reasoning model either, and not conscious. The Industry Standard cloud Llama is the one that reasons like a full AI.'
    ]);
  }
  if(/\b(thanks|thank you|thx|appreciated)\b/.test(low)){
    SupremeConv.remember(q,'thanks');
    return roleTag + SupremeConv.pick('thanks', ['Anytime — that\u2019s what the supreme build is for.', 'You got it. Ask me anything else.', 'Happy to help.']);
  }
  if(/\b(bye|goodbye|see you|later)\b/.test(low) && low.length < 25){
    SupremeConv.remember(q,'bye');
    return roleTag + SupremeConv.pick('bye', ['Later — I\u2019ll be right here when you need the supreme brain.', 'Goodbye for now.']);
  }
  /* --- live dictionary lookup: "define X", "what does X mean", "meaning of X" --- */
  var dm = low.match(/\bdefine\s+([a-z][a-z\-']*)/) || low.match(/\bmeaning of\s+([a-z][a-z\-']*)/) ||
           low.match(/\bwhat does\s+([a-z][a-z\-']*)\s+mean\b/) || low.match(/\bdefinition of\s+([a-z][a-z\-']*)/);
  if(dm){
    var w = dm[1];
    SupremeConv.remember(q,'define:'+w);
    return dictLookup(w).then(function(row){
      if(row){
        var pos = row[1] ? ' ('+row[1]+')' : '';
        var pron = row[2] ? ' — say it: '+row[2] : '';
        return '📖 ' + roleTag + row[0] + pos + pron + '\n' + (row[3] || 'Definition on file.') +
          '\n\n[[LINK:' + DICT_BASE + '/?w=' + encodeURIComponent(row[0]) + '|Open in the Signature Dictionary →]]';
      }
      return '📖 ' + roleTag + 'I looked through the live Signature Dictionary and couldn\u2019t find \u201c'+w+'\u201d. Check the spelling, or try the dictionary site directly:\n[[LINK:' + DICT_BASE + '|Open the Signature Dictionary →]]';
    });
  }
  /* --- single word query: treat as define --- */
  if(/^[a-z][a-z\-']{1,30}$/.test(low)){
    SupremeConv.remember(q,'define:'+low);
    return dictLookup(low).then(function(row){
      if(row){
        var pos = row[1] ? ' ('+row[1]+')' : '';
        var pron = row[2] ? ' — say it: '+row[2] : '';
        return '📖 ' + roleTag + row[0] + pos + pron + '\n' + (row[3] || 'Definition on file.') +
          '\n\n[[LINK:' + DICT_BASE + '/?w=' + encodeURIComponent(row[0]) + '|Open in the Signature Dictionary →]]';
      }
      return null; /* fall through to fallback below */
    }).then(function(a){
      if(a) return a;
      return roleTag + SupremeConv.pick('fallback', [
        'I didn\u2019t catch that one — I looked it up and it\u2019s not in the dictionary either. Try \u201cdefine serendipity\u201d, a math question like 12*8+3, or ask me who I am.',
        'Hmm, that one slipped past me. I\u2019m best at: defining words (try \u201cdefine <word>\u201d), math, and pointing you around the 37 sites.',
        'Not sure what you meant there. Give me a word to define, some math, or a hashtag role like #Task-Chef.'
      ]);
    });
  }
  /* --- archive routing: honest pointers with real links --- */
  var NET = 'https://justinahiggins614-cmyk.github.io';
  if(/\bpatent\b/.test(low)){ SupremeConv.remember(q,'route:patent');
    return roleTag + 'Patents live in two places:\n[[LINK:'+NET+'/cyber-patent-catalog|Globally Rejustered Patent Catalog →]] (harvested public records)\n[[LINK:'+NET+'/signature-one-archive/specs.html|Signature Spec Catalog →]] (your original drafts)';
  }
  if(/\bwiki\b|\bhistory of\b|\bwho (was|is)\b/.test(low)){ SupremeConv.remember(q,'route:wiki');
    return roleTag + 'For deep articles try:\n[[LINK:'+NET+'/jah-wiki|JAH Wiki →]]\n[[LINK:'+NET+'/jah-n-wiki-leaks|JAH-N Wiki Leaks →]] (the classified-dossier side)';
  }
  if(/\bsong|music\b/.test(low)){ SupremeConv.remember(q,'route:music');
    return roleTag + 'Music lives at [[LINK:'+NET+'/signature-ai-song-maker|Signature Music Studio →]] — full song generator in there.';
  }
  /* --- honest fallback: never canned, never word salad --- */
  SupremeConv.remember(q,'fallback');
  return roleTag + SupremeConv.pick('fallback', [
    'I want to give you a real answer, not a guess — I\u2019m best at defining words (try \u201cdefine <word>\u201d), math like 12*8+3, and routing you across the 37 sites. For open-ended reasoning, the Industry Standard cloud path on the Signature Llama site is the deeper brain.',
    'That\u2019s outside what I can answer on-device. I do words, math, roles, and network routing for real — everything else, the full cloud Llama handles.',
    'I don\u2019t have a real answer for that one, and I\u2019d rather say so than make one up. Try a word, some math, or ask me what I can do.'
  ]);
}
function renderAns(out, a){
  var h = esc(a).replace(/\n/g,'<br>');
  h = h.replace(/\[\[LINK:([^|]+)\|([^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener" style="color:#ffb300;font-weight:bold;">$2</a>');
  out.innerHTML = h;
}
function askLlama(){
  var q = document.getElementById('askq').value.trim();
  var out = document.getElementById('askout');
  if(!q){ out.textContent = 'Type a question first.'; return; }
  out.textContent = '🦠 thinking — routing across the ecosystem…';
  try{
    var ans = supremeAnswer(q);
    if(ans && typeof ans.then === 'function'){
      out.textContent = '📖 looking it up in the live Signature Dictionary…';
      ans.then(function(a){ renderAns(out, a); },
               function(){ out.textContent = 'Hmm, that lookup hiccuped. Try again.'; });
    } else {
      setTimeout(function(){ renderAns(out, ans); }, 350);
    }
  }catch(e){ out.textContent = 'Hmm, that one slipped past me. Try asking another way.'; }
}
