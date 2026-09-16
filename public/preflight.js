/* =====================================================================
   THE SHIP'S PRE-FLIGHT — nine safety rules with the operators missing.

   THIS IS A VOCABULARY LESSON, and the vocabulary is nine words:

       <   >   <=   >=   ==   !=        comparing two numbers
       and  or                          joining two questions
       not                              flipping one over

   Every one of them is the answer to exactly one check below, so the
   mission is not "fill in nine blanks" — it is meet each word once, in a
   place where only that word will do.

   WHY A CHECKLIST. A student who has been told that `>=` means "greater
   than or equal to" can repeat the sentence and still not know when to
   reach for it; the thing that is actually hard is the boundary. So every
   check is judged against READINGS out of the ship's own log, and the
   readings are chosen so that the boundary is in them. FUEL is tried at
   exactly 20. CARGO at exactly 400. The pad at exactly freezing. `>` and
   `>=` agree on every other number in the world and disagree there, which
   is why "at least" and "more than" are two different words — and a check
   that never tries the boundary cannot tell a student which one they have
   picked.

   EXACTLY ONE OPERATOR SURVIVES EACH CHECK. Not by assertion: the tests
   put every word this console can express into every slot and count the
   ones that come out right, and the answer has to be one. A panel with two
   right answers cannot ring the slot that is wrong, because neither is.

   NOTHING IS MARKED AGAINST AN ANSWER KEY. There is no list of correct
   operators in here. `run()` puts the rule the student built against the
   readings and reports what the gauge did, the way routine.js reports what
   Ion did — and `repeat 4 [move 10]` is to Ion's console what `fuel >= 20`
   and `20 <= fuel` would be to this one, if the console could express the
   second.

   NO DOM, AND IT RUNS UNDER NODE. shipfix.js is the screen.
   ===================================================================== */
(function(root){

  /* ------------------------------------------------------------- the words
     The whole vocabulary, in one list, because the panel draws the bank
     from it and the tests walk it. `kind` is the half of the lesson nobody
     writes down: `and` is not a worse answer than `>=` in a slot that
     compares two numbers, it is the wrong PART OF SPEECH, and a console
     that just says "no" there has taught nothing. */
  const WORDS = [
    { id:'<',   kind:'cmp',  name:'is less than',
      help:'True when the left number is smaller. 5 < 9.' },
    { id:'>',   kind:'cmp',  name:'is more than',
      help:'True when the left number is bigger. 9 > 5. NOT true when they are equal.' },
    { id:'<=',  kind:'cmp',  name:'is at most',
      help:'Less than <b>or the same</b>. 5 <= 5 is true; 6 <= 5 is not.' },
    { id:'>=',  kind:'cmp',  name:'is at least',
      help:'More than <b>or the same</b>. 5 >= 5 is true; 4 >= 5 is not.' },
    { id:'==',  kind:'cmp',  name:'is exactly',
      help:'True only when the two are the same number. One = sets a value; two == asks a question.' },
    { id:'!=',  kind:'cmp',  name:'is anything but',
      help:'True when they are <b>not</b> the same. The ! means not.' },
    { id:'and', kind:'join', name:'both are true',
      help:'Joins two questions. True only when BOTH sides are true.' },
    { id:'or',  kind:'join', name:'either is true',
      help:'Joins two questions. True when EITHER side is true — or both.' },
    { id:'not', kind:'neg',  name:'flip it over',
      help:'Turns the answer round. <b>not</b> (5 &lt; 9) is false, because 5 &lt; 9 is true.' }
  ];
  const wordOf = id => WORDS.find(w=>w.id===id) || null;
  const kindOf = id => { const w=wordOf(id); return w ? w.kind : null; };
  const inKind = k => WORDS.filter(w=>w.kind===k).map(w=>w.id);

  /* What a word does, once it is in a slot. The evaluator is here and
     nowhere else — a second copy in the panel is a second answer. */
  const CMP = {
    '<':  (a,b)=>a<b,   '>':  (a,b)=>a>b,
    '<=': (a,b)=>a<=b,  '>=': (a,b)=>a>=b,
    '==': (a,b)=>a===b, '!=': (a,b)=>a!==b
  };

  /* ------------------------------------------------------------ the checks
     Each is a rule with holes in it, and a handful of readings out of the
     log. `form` is a tiny tree: a comparison, two of them joined, or one
     of them flipped. `#name` is a slot the student fills.

     THE READINGS ARE THE ASSESSMENT and they are chosen, not sampled. Each
     list contains the boundary — the reading on which the two words a
     student is most likely to confuse disagree — because that is the only
     place the difference between them is visible. */
  const CHECKS = [
    { id:'fuel', name:'FUEL', word:'>=',
      says: 'There has to be <b>at least 20</b> units in the tank.',
      form: { t:'cmp', gauge:'fuel', op:'#op', rhs:20 },
      gauges:['fuel'],
      /* 20 exactly is the whole check: "at least 20" includes 20, and
         "more than 20" does not. */
      reads: [ { fuel:34, pass:true }, { fuel:20, pass:true }, { fuel:12, pass:false } ] },

    { id:'core', name:'CORE HEAT', word:'<',
      says: 'The core has to be <b>below 900</b>. 900 is not below 900.',
      form: { t:'cmp', gauge:'core', op:'#op', rhs:900 },
      gauges:['core'],
      reads: [ { core:640, pass:true }, { core:899, pass:true },
               { core:900, pass:false }, { core:1180, pass:false } ] },

    { id:'cargo', name:'CARGO', word:'<=',
      says: 'She will lift <b>400 at the most</b>. Exactly 400 is fine.',
      form: { t:'cmp', gauge:'load', op:'#op', rhs:400 },
      gauges:['load'],
      reads: [ { load:275, pass:true }, { load:400, pass:true }, { load:410, pass:false } ] },

    { id:'pad', name:'PAD', word:'>',
      says: 'The pad has to be <b>above freezing</b>. Freezing itself is not above it.',
      form: { t:'cmp', gauge:'pad', op:'#op', rhs:0 },
      gauges:['pad'],
      reads: [ { pad:6, pass:true }, { pad:0, pass:false }, { pad:-9, pass:false } ] },

    { id:'key', name:'IGNITION', word:'==',
      says: 'The key has to be <b>exactly at 1</b> — armed. 0 is off and 2 is already turning.',
      form: { t:'cmp', gauge:'key', op:'#op', rhs:1 },
      gauges:['key'],
      reads: [ { key:1, pass:true }, { key:0, pass:false }, { key:2, pass:false } ] },

    { id:'heading', name:'HEADING', word:'!=',
      says: 'Anything <b>but 180</b>. 180 is straight at the moon.',
      form: { t:'cmp', gauge:'heading', op:'#op', rhs:180 },
      gauges:['heading'],
      reads: [ { heading:90, pass:true }, { heading:275, pass:true },
               { heading:180, pass:false } ] },

    { id:'cabin', name:'CABIN AIR', word:'and',
      says: 'Pressure has to be <b>above 8 and below 40</b>. Both, or nobody breathes.',
      form: { t:'join', op:'#join',
              a:{ t:'cmp', gauge:'psi', op:'#lo', rhs:8 },
              b:{ t:'cmp', gauge:'psi', op:'#hi', rhs:40 } },
      gauges:['psi'],
      reads: [ { psi:20, pass:true }, { psi:8, pass:false }, { psi:40, pass:false },
               { psi:5, pass:false }, { psi:60, pass:false } ] },

    { id:'power', name:'POWER', word:'or',
      says: 'She flies on <b>either cell</b> — the main one or the backup. '
          + 'A cell reading below zero is draining, which is worse than empty.',
      form: { t:'join', op:'#join',
              a:{ t:'cmp', gauge:'main',   op:'#m', rhs:0 },
              b:{ t:'cmp', gauge:'backup', op:'#b', rhs:0 } },
      gauges:['main','backup'],
      /* A DRAINING CELL ON EACH SIDE, and both of them are load-bearing.
         Without the negative main, `!=` passes the whole log and there are
         two right answers; without the negative backup, `main > 0 or
         backup != 0` passes it too. A check with two answers cannot ring
         the blank that is wrong, so the log has to be able to tell the
         two words apart on BOTH sides of the `or`. */
      reads: [ { main:5, backup:5, pass:true }, { main:5, backup:0, pass:true },
               { main:0, backup:5, pass:true }, { main:0, backup:0, pass:false },
               { main:-3, backup:0, pass:false }, { main:0, backup:-3, pass:false },
               { main:-3, backup:5, pass:true } ] },

    { id:'thrust', name:'THRUST', word:'not',
      says: 'The thrusters must <b>not</b> be reversed. Reversed is anything below zero.',
      form: { t:'not', neg:'#neg', in:{ t:'cmp', gauge:'thrust', op:'#op', rhs:0 } },
      gauges:['thrust'],
      reads: [ { thrust:-4, pass:false }, { thrust:0, pass:true }, { thrust:12, pass:true } ] }
  ];
  const checkOf = id => CHECKS.find(c=>c.id===id) || null;

  /* Every slot in the console, as {check, slot, kind}. Walked by the panel
     to draw the blanks and by the tests to fill them. */
  function slotsOf(check){
    const out=[];
    (function walk(n){
      if(!n) return;
      if(n.t==='cmp'){ out.push({ check:check.id, slot:hole(n.op), kind:'cmp' }); return; }
      if(n.t==='join'){ walk(n.a); out.push({ check:check.id, slot:hole(n.op), kind:'join' }); walk(n.b); return; }
      if(n.t==='not'){ out.push({ check:check.id, slot:hole(n.neg), kind:'neg' }); walk(n.in); }
    })(check.form);
    return out;
  }
  const hole = s => String(s).replace(/^#/,'');
  const SLOTS = () => CHECKS.reduce((a,c)=>a.concat(slotsOf(c)), []);
  /* A slot's name in the save state: the check and the hole, so `cabin.lo`
     and `power.m` cannot collide however many checks are added. */
  const key = (checkId, slot) => checkId + '.' + slot;

  /* ---------------------------------------------------------------- state
     What the console finds when it is opened: nothing filled in. An empty
     slot is not a wrong answer and is never counted as one — the panel says
     "there is nothing here yet", which is a different sentence from "that
     word does not work here" and a student is owed both. */
  const blank = () => ({});

  /* And a state with a word in a slot it cannot take is a state this
     refuses, because the panel refuses it at the point of the click and the
     two have to agree. */
  function tidy(s){
    const out={};
    for(const sl of SLOTS()){
      const k=key(sl.check, sl.slot), v=s && s[k];
      if(v && kindOf(v)===sl.kind) out[k]=v;
    }
    return out;
  }
  const filled = s => { s=tidy(s); return SLOTS().filter(sl=>s[key(sl.check,sl.slot)]).length; };
  const total  = () => SLOTS().length;

  /* ------------------------------------------------------------ evaluating
     A rule with an empty slot has no answer — not `false`, which would be
     an answer. `null` all the way up, and the panel draws a dash. */
  function value(node, s, checkId, reading){
    if(!node) return null;
    if(node.t==='cmp'){
      const op = s[key(checkId, hole(node.op))];
      if(!op || !CMP[op]) return null;
      const g = reading[node.gauge];
      if(typeof g!=='number') return null;
      return CMP[op](g, node.rhs);
    }
    if(node.t==='join'){
      const op = s[key(checkId, hole(node.op))];
      const a = value(node.a, s, checkId, reading);
      const b = value(node.b, s, checkId, reading);
      if(!op || a===null || b===null) return null;
      return op==='and' ? (a && b) : (a || b);
    }
    if(node.t==='not'){
      const neg = s[key(checkId, hole(node.neg))];
      const v = value(node.in, s, checkId, reading);
      if(!neg || v===null) return null;
      return !v;
    }
    return null;
  }

  /* What one check did, on every reading in its log. */
  function rowsOf(checkId, state){
    const c=checkOf(checkId), s=tidy(state);
    if(!c) return [];
    return c.reads.map(r=>{
      const got=value(c.form, s, c.id, r);
      return { reading:r, got, want:r.pass,
               ok: got!==null && got===r.pass,
               blank: got===null };
    });
  }
  /* Is this check finished and right? A check with an empty slot is not
     wrong, it is unanswered — and `done` is the only thing that is allowed
     to unlock anything. */
  const done  = (checkId, state) => { const rs=rowsOf(checkId,state);
                                      return rs.length>0 && rs.every(r=>r.ok); };
  const begun = (checkId, state) => rowsOf(checkId,state).some(r=>!r.blank);

  /* ------------------------------------------------------------------ run
     The whole board, the way the console prints it. */
  function run(state){
    const s=tidy(state);
    const lines=[];
    const checks = CHECKS.map(c=>{
      const rows=rowsOf(c.id, s);
      const ok = rows.every(r=>r.ok);
      const unanswered = rows.some(r=>r.blank);
      lines.push({ text:`${c.name}  ${text(c, s)}`, kind:'rule' });
      rows.forEach(r=>{
        const gs=c.gauges.map(g=>`${g} ${r.reading[g]}`).join(', ');
        lines.push({
          text: `   ${gs} → ` + (r.blank ? '?' : (r.got ? 'PASS' : 'HOLD'))
              + (r.ok ? '' : r.blank ? '  (nothing in the blank yet)'
                                     : `  (the log says ${r.want ? 'PASS' : 'HOLD'})`),
          kind: r.ok ? 'good' : r.blank ? 'idle' : 'bad' });
      });
      return { id:c.id, name:c.name, ok, unanswered, rows };
    });
    const ok = checks.every(c=>c.ok);
    lines.push({ text: ok ? 'PRE-FLIGHT CLEAR. She will fly.'
                          : 'PRE-FLIGHT HELD.', kind: ok?'good':'bad' });
    return { checks, lines, ok, why: ok ? null : why(s) };
  }

  /* A rule in words, with a dash where a slot is still empty. */
  function text(c, s){
    s=tidy(s);
    const at = h => s[key(c.id, hole(h))] || '__';
    const cmp = n => `${n.gauge} ${at(n.op)} ${n.rhs}`;
    const f=c.form;
    if(f.t==='cmp')  return cmp(f);
    if(f.t==='join') return `${cmp(f.a)} ${at(f.op)} ${cmp(f.b)}`;
    if(f.t==='not')  return `${at(f.neg)} ( ${cmp(f.in)} )`;
    return '';
  }

  /* WHAT TO SAY WHEN IT IS HELD — about the reading, never about the word.
     Every one of these is a line of the log the student can go and look at. */
  function why(s){
    for(const c of CHECKS){
      const rows=rowsOf(c.id, s);
      if(rows.every(r=>r.ok)) continue;
      const un=rows.find(r=>r.blank);
      if(un) return `${c.name} has a blank in it, so there is nothing to check yet.`;
      const bad=rows.find(r=>!r.ok);
      const gs=c.gauges.map(g=>`${g} at ${bad.reading[g]}`).join(' and ');
      return `${c.name}: with ${gs} your rule says `
           + `${bad.got ? 'PASS' : 'HOLD'}, and the log says `
           + `${bad.want ? 'PASS' : 'HOLD'}.`;
    }
    return null;
  }

  /* ================================================== THE WALKTHROUGH
     FOURTEEN BLANKS IS FOURTEEN TOO MANY TO BE HANDED AT ONCE, and a wall
     of them is a worksheet rather than a repair. One check at a time, in
     order, with the blank it is about ringed and its readings open under
     it — and the rest of the board still on screen, because a checklist you
     can only see one line of is not a checklist.

     READ OFF THE BOARD, NOT COUNTED. `step` returns the first check that is
     not finished and right, so filling them out of order works and undoing
     one brings its step back. */
  function step(state){
    const s=tidy(state);
    for(const c of CHECKS){
      if(done(c.id, s)) continue;
      const slots=slotsOf(c);
      /* The blank to ring: the first empty one, or — if they are all
         full and it still does not match the log — the first one. Which
         one is "wrong" is not a thing a rule can know when three slots
         share the blame, and guessing at it would point somebody at a
         word that is fine. */
      const empty = slots.find(sl=>!s[key(sl.check, sl.slot)]);
      const at = empty || slots[0];
      const rows = rowsOf(c.id, s);
      const bad = rows.find(r=>!r.ok && !r.blank);
      return {
        id:c.id, name:c.name, says:c.says, hole:key(at.check, at.slot), kind:at.kind,
        n: CHECKS.indexOf(c)+1, of: CHECKS.length,
        need: empty ? 'fill' : 'fix',
        /* The sentence under the rule. It describes the reading that came
           out wrong; it never names the word that would fix it. */
        say: empty
          ? c.says
          : c.says + ' — ' + (bad
              ? `but with ${c.gauges.map(g=>`<b>${g} at ${bad.reading[g]}</b>`).join(' and ')} `
                + `your rule says <b>${bad.got?'PASS':'HOLD'}</b> and the log says `
                + `<b>${bad.want?'PASS':'HOLD'}</b>.`
              : 'and it does not match the log yet.')
      };
    }
    return null;
  }

  /* Why a word will not go in a slot — the part of speech, said out loud.
     Returned rather than thrown, because it is a sentence for the student
     and not an error for the console. */
  function refuse(wordId, slotKind){
    const w=wordOf(wordId);
    if(!w) return 'That is not one of the words.';
    if(w.kind===slotKind) return null;
    if(slotKind==='cmp')
      return w.kind==='join'
        ? `<b>${w.id}</b> joins two questions together. This blank is between two numbers, `
        + 'and it wants a word that compares them.'
        : `<b>not</b> flips one question over. This blank is between two numbers, `
        + 'and it wants a word that compares them.';
    if(slotKind==='join')
      return w.kind==='cmp'
        ? `<b>${w.id}</b> compares two numbers. This blank is between two whole questions, `
        + 'and it wants a word that joins them.'
        : `<b>not</b> flips one question over rather than joining two.`;
    return `<b>${w.id}</b> does not flip a question over. Only <b>not</b> does that.`;
  }

  const API = { WORDS, CHECKS, CMP,
                wordOf, kindOf, inKind, checkOf, slotsOf, SLOTS, key, hole,
                blank, tidy, filled, total,
                value, rowsOf, done, begun, run, text, why, step, refuse };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.PREFLIGHT=API;
})(typeof self!=='undefined' ? self : this);
