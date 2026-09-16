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
    { id:'<',   kind:'cmp',  name:'less than',
      help:'True when the left number is smaller. 5 < 9.' },
    { id:'>',   kind:'cmp',  name:'more than',
      help:'True when the left number is bigger. 9 > 5. NOT true when they are equal.' },
    { id:'<=',  kind:'cmp',  name:'at most',
      help:'Less than <b>or the same</b>. 5 <= 5 is true; 6 <= 5 is not.' },
    { id:'>=',  kind:'cmp',  name:'at least',
      help:'More than <b>or the same</b>. 5 >= 5 is true; 4 >= 5 is not.' },
    { id:'==',  kind:'cmp',  name:'the same as',
      help:'True only when the two are the same number. One = sets a value; two == asks a question.' },
    { id:'!=',  kind:'cmp',  name:'not the same',
      help:'True when they are <b>not</b> the same. The ! means not.' },
    { id:'and', kind:'join', name:'both',
      help:'Joins two questions. True only when BOTH sides are true.' },
    { id:'or',  kind:'join', name:'either',
      help:'Joins two questions. True when EITHER side is true — or both.' },
    { id:'not', kind:'neg',  name:'the opposite',
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
      says: 'Fuel must be <b>at least 20</b>.',
      form: { t:'cmp', gauge:'fuel', op:'#op', rhs:20 },
      gauges:['fuel'],
      /* 20 exactly is the whole check: "at least 20" includes 20, and
         "more than 20" does not. */
      reads: [ { fuel:34, pass:true }, { fuel:20, pass:true }, { fuel:12, pass:false } ] },

    { id:'core', name:'CORE HEAT', word:'<',
      says: 'Heat must be <b>under 900</b>.',
      form: { t:'cmp', gauge:'core', op:'#op', rhs:900 },
      gauges:['core'],
      reads: [ { core:640, pass:true }, { core:899, pass:true },
               { core:900, pass:false }, { core:1180, pass:false } ] },

    { id:'cargo', name:'CARGO', word:'<=',
      says: 'Load must be <b>400 or less</b>.',
      form: { t:'cmp', gauge:'load', op:'#op', rhs:400 },
      gauges:['load'],
      reads: [ { load:275, pass:true }, { load:400, pass:true }, { load:410, pass:false } ] },

    { id:'pad', name:'PAD', word:'>',
      says: 'The pad must be <b>warmer than 0</b>.',
      form: { t:'cmp', gauge:'pad', op:'#op', rhs:0 },
      gauges:['pad'],
      reads: [ { pad:6, pass:true }, { pad:0, pass:false }, { pad:-9, pass:false } ] },

    { id:'key', name:'IGNITION', word:'==',
      says: 'The key must be <b>exactly 1</b>.',
      form: { t:'cmp', gauge:'key', op:'#op', rhs:1 },
      gauges:['key'],
      reads: [ { key:1, pass:true }, { key:0, pass:false }, { key:2, pass:false } ] },

    { id:'heading', name:'HEADING', word:'!=',
      says: 'Heading must be <b>anything but 180</b>.',
      form: { t:'cmp', gauge:'heading', op:'#op', rhs:180 },
      gauges:['heading'],
      reads: [ { heading:90, pass:true }, { heading:275, pass:true },
               { heading:180, pass:false } ] },

    { id:'cabin', name:'CABIN AIR', word:'and',
      says: 'Air must be <b>over 8</b> and <b>under 40</b>.',
      form: { t:'join', op:'#join',
              a:{ t:'cmp', gauge:'psi', op:'#lo', rhs:8 },
              b:{ t:'cmp', gauge:'psi', op:'#hi', rhs:40 } },
      gauges:['psi'],
      reads: [ { psi:20, pass:true }, { psi:8, pass:false }, { psi:40, pass:false },
               { psi:5, pass:false }, { psi:60, pass:false } ] },

    { id:'power', name:'POWER', word:'or',
      says: 'One cell must be <b>over 0</b>. Either will do.',
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
      says: 'Thrust must <b>not</b> be under 0.',
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
        /* THE SENTENCE IS THE RULE AND NOTHING ELSE. It used to carry the
           failing reading with it — "but with fuel at 20 your rule says
           PASS and the log says HOLD" — which is twenty words describing a
           row of a table the student is already looking at, and the row is
           already red. Say the rule; let the table say the rest. */
        say: c.says,
        /* One nudge, only once every blank is full and it still does not
           match. Six words, pointing at the table rather than at a word. */
        miss: (!empty && bad) ? 'Not yet \u2014 look at the red line.' : null
      };
    }
    return null;
  }

  /* ================================================== THE FIRST TIME
     A PANEL IS NOT SELF-EXPLANATORY BECAUSE IT IS TIDY. The console opens
     on five things at once — a system name, a rule in English, the same
     rule with holes in it, nine words, and a table of readings — and
     every one of them is doing a different job. An adult reads the layout
     and infers the job. A nine-year-old reads the biggest text, presses
     the brightest thing, and if that does not obviously do something,
     stops.

     So the first time it opens, the five parts introduce themselves, one
     per click, each pointing at the thing it is about. Five steps is the
     whole of it: what the rule is, what the words are, what the table is,
     what the table is FOR, and what to press. Then it gets out of the
     way and does not come back.

     WHAT `at` MEANS is a region of the panel, not a selector — this file
     has never known there is a screen and is not going to start. shipfix.js
     owns the mapping from these five names to the four boxes it drew.

     THE LAST STEP IS NOT A STEP, it is the handover: it names the ringed
     blank and then the tour is over, because the next thing that should
     happen is a click on a word and a tour that is still talking over
     that is a tour in the way. */
  const TOUR = [
    { at:'rule',  say:'This is one of her safety rules.' },
    { at:'rule',  say:'The blank is the part she lost.' },
    { at:'bank',  say:'One of these nine words goes in it.' },
    { at:'reads', say:'This is her log. Real readings, already judged.' },
    { at:'reads', say:'Your rule has to agree with every line.' },
    { at:'rule',  say:'Click a word. It lands in the ringed blank.' }
  ];

  /* ------------------------------------------------- AND THE BOUNDARY.
     THE ONE MISTAKE WORTH CATCHING BY NAME. Every check in here is built
     so that the two words a student actually confuses disagree on exactly
     one reading — fuel at 20, cargo at 400, a pad at freezing — and that
     reading is in the log precisely so the console can show them the
     difference rather than assert it.

     But a red row only says "this line is wrong". On the FIRST check a
     student has ever filled in, it is worth spending one sentence saying
     which line and why it is the interesting one, because the whole of
     `>` against `>=` is in it and everything after this check assumes
     they have met the idea once.

     ONLY WHEN IT IS THE BOUNDARY THAT BROKE. If their rule fails on a
     reading that is not the edge they have not made this mistake, they
     have made a different one, and a sentence about 20 would be a
     sentence about something they did not do. Returns null the rest of
     the time, which is most of the time.

     THE QUESTION IS ASKED, NOT ANSWERED. "Is 20 at least 20?" is a thing
     a nine-year-old can answer out loud and then go and act on. "You
     want >= because at least includes the boundary" is the answer to a
     question they were never asked, and it reads as a correction. */
  function edge(checkId, state){
    const c=checkOf(checkId), s=tidy(state);
    if(!c) return null;
    const rows=rowsOf(checkId, s);
    if(!rows.length || rows.some(r=>r.blank)) return null;   // not finished
    if(rows.every(r=>r.ok)) return null;                     // not wrong
    /* The boundary row is the reading that is EXACTLY the number the rule
       is about — read off the rule's own right-hand side, so a check whose
       threshold is edited cannot leave this pointing at the old one. */
    const rhs = (function find(n){
      if(!n) return null;
      if(n.t==='cmp')  return n.rhs;
      if(n.t==='not')  return find(n.in);
      return null;                       // a joined rule has two, and neither
    })(c.form);                          // is THE boundary — so say nothing
    if(rhs===null) return null;
    const g=c.gauges[0];
    const row=rows.find(r=>r.reading[g]===rhs);
    if(!row || row.ok) return null;      // the edge is not what they got wrong
    /* SAID AS WHAT THEIR RULE IS DOING TO HER, which is a different
       sentence depending on which way they got it round — and the
       difference is the entire lesson. A rule that is too tight is
       refusing a ship that is fine; a rule that is too loose is clearing
       one that is not. Both are one word out, and they are not the same
       mistake. */
    return { gauge:g, value:rhs, want:row.want,
             say: row.want
               ? `Look at ${g} ${rhs}. Your rule stops her. Should it?`
               : `Look at ${g} ${rhs}. Your rule clears her. Should it?` };
  }

  /* Why a word will not go in a slot — the part of speech, said out loud.
     Returned rather than thrown, because it is a sentence for the student
     and not an error for the console. */
  function refuse(wordId, slotKind){
    const w=wordOf(wordId);
    if(!w) return 'That is not one of the words.';
    if(w.kind===slotKind) return null;
    /* WHAT KIND OF WORD IT IS, in one line. These nine are three different
       parts of speech, and a console that only says "no" has taught
       nothing — but it does not need a paragraph to say so either. */
    const wants = slotKind==='cmp'  ? 'compares two numbers'
                : slotKind==='join' ? 'joins two questions'
                :                     'flips a question over';
    const does  = w.kind==='cmp'  ? 'compares two numbers'
                : w.kind==='join' ? 'joins two questions'
                :                   'flips a question over';
    return `<b>${w.id}</b> ${does}. This blank ${wants}.`;
  }

  const API = { WORDS, CHECKS, CMP, TOUR,
                wordOf, kindOf, inKind, checkOf, slotsOf, SLOTS, key, hole,
                blank, tidy, filled, total,
                value, rowsOf, done, begun, run, text, why, step, refuse, edge };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.PREFLIGHT=API;
})(typeof self!=='undefined' ? self : this);
