/* =====================================================================
   ION'S MORNING ROUTINE — the program, and what happens when it runs.

   It lives on its own for the same reason logic.js does: a lesson about
   conditions is only worth anything if the thing a student changes in the
   console is the thing the robot on the floor actually obeys. One
   interpreter, no DOM in it, called by the console and tested under Node.

   THIS IS A CONDITIONALS AND BOOLEAN LOGIC LESSON. It did not used to be:
   it was four ideas with one decision each, and half of them were about
   loops. Half a lesson on loops is a fine thing to be in the middle of
   once, and it is not what this mission is for — so the loop and the
   walking stay, because they are the SYMPTOM Robin walks in on and the
   opening scene is built out of them, and everything after them is now
   about asking the right question:

     LOOPS         ( forever | repeat ( ? ) )   which loop — 1 decision
     MOTION        move ( ? ) steps             how far — 1 decision
     CONDITIONALS  if he ( is | is not ) in the kitchen
                   ...and a second `if` that only gets asked when the
                   first one says no
     BOOLEANS      two rules, three decisions each: which way round each
                   side reads, and whether they are joined by `and` or `or`

   Seven of the nine decisions are about a question rather than about a
   number, and the two that are not are the two you meet in the first
   fifteen seconds.

   TWO RULES, AND THE SECOND ONE IS WHY `or` EXISTS.

       if      < pan (is) hot >     and < there (is) batter >     -> cook
       else if < pan (is not) hot >  or < there (is not) batter > -> say so
       else                                                      -> wait

   The first rule is the only thing a two-term `and` can be: he cooks when
   BOTH are true. The second has to catch every morning the first one
   missed, and the only rule that does is both sides flipped and the join
   swapped — which is De Morgan's law, arrived at by a nine-year-old
   reading a table of four mornings rather than by being told its name.

   AND THE LAST `else` NEVER RUNS. That is not a mistake, it is the
   answer: once both questions are right there is no morning left over,
   and `he waits` in the table is the console's way of saying a morning
   fell through both of them. A student who sees `waits` anywhere has a
   rule that does not cover what it should.

   EVERY RULE IS JUDGED ON FOUR MORNINGS, NOT ONE. A rule about `and` that
   is only ever tried on the morning it was written for is a rule nobody
   has tested: `or` gets that morning right too. So both rules are run
   against every combination of hot pan and batter there is, and all four
   have to come out right — which is the only way to tell somebody has
   understood the difference rather than found a setting that worked once.
   Exactly one pair of rules survives that; see the tests.

   NOTHING IS MARKED AGAINST AN ANSWER KEY. There is no list of correct
   values in here. run() walks the program and reports what Ion DID, and
   whether that counts is about the breakfast. `repeat 4 [move 10]` and
   `repeat 5 [move 8]` are both forty steps and both open the door.

   AND THE STORY IS NOT IN HERE. There used to be a fifth thing in his
   routine — commented-out lines somebody else had written, handed back
   with a working program — and the reveal of the game's antagonist was a
   footnote a student read in a panel and then closed. It is a scene now:
   house.js flashes the lights, puts him back on the floor and lets
   whoever wrote those lines say them out loud through him. This file is
   a program and a trace again, and the run has no `note` on it.
   ===================================================================== */
(function(root){
  const K = (typeof require==='function' && typeof module!=='undefined')
            ? require('./logic.js')
            : (root.KLOGIC || null);

  /* How far the kitchen is, in Ion's own steps. Forty rather than four so
     the stride is a number worth choosing. */
  const KITCHEN = 40;
  /* AND WHY THE LOOP CANNOT BE DODGED. Without a cap, `repeat 1 [move
     40]` walks him there in one hop and the lesson about loops is a
     lesson the student never has to attend. His motors are the reason,
     and the console says it out loud rather than enforcing it silently. */
  const STRIDE_MAX = 10;
  const REPEAT_MAX = 12;

  /* EVERY MORNING THERE IS. Both rules have to be right on all four, and
     the console draws them as a table — four rows somebody can point at. */
  const MORNINGS = [
    { hot:true,  batter:true  },
    { hot:true,  batter:false },
    { hot:false, batter:true  },
    { hot:false, batter:false }
  ];
  /* WHAT HE OUGHT TO DO, as a function of the morning rather than as a
     string, so the checker and the table cannot drift apart. Cook when the
     pan is hot AND there is batter; on every other morning say which of
     them is missing. There is no morning on which the right answer is to
     stand there — which is exactly what makes `waits` in the table legible
     as "that morning fell through both rules". */
  const should = m => (m.hot && m.batter) ? 'cook' : 'tell';

  /* THE TWO RULES, AND THE ORDER THEY ARE ASKED IN. Flat keys rather than
     nested ones, because the console rings a CONTROL by id and `cookJoin`
     is a control. Named in pairs so the two rules read as two rules. */
  const RULES = [
    { id:'cook', hot:'cookHot', batter:'cookBatter', join:'cookJoin' },
    { id:'tell', hot:'tellHot', batter:'tellBatter', join:'tellJoin' }
  ];
  const ruleOf = which => RULES.find(x=>x.id===which) || RULES[0];

  /* What the console finds when it opens him up.

     THE SECOND RULE IS BROKEN BY BEING THE FIRST ONE AGAIN. `pan is hot
     and there is batter` in the `else if` can never be true there — the
     `if` above it has already taken every morning that satisfies it — so
     he falls through to `wait` on three mornings out of four. It is the
     most useful wrong answer there is: it is what you get by copying the
     line above you, and the table says so in one glance. */
  const broken = () => ({
    loop:'forever', times:1, stride:0,                     // loops + motion
    where:'is not',                                        // the conditional
    cookHot:'is not', cookBatter:'is', cookJoin:'or',      // the `and` rule
    tellHot:'is', tellBatter:'is', tellJoin:'and'          // the `or` rule
  });

  const clamp=(n,lo,hi)=>Math.max(lo, Math.min(hi, Math.round(+n||0)));
  const yn  = v => v==='is'  ? 'is'  : 'is not';
  const aor = v => v==='and' ? 'and' : 'or';
  function tidy(s){
    s=s||{};
    return { loop:    s.loop==='repeat' ? 'repeat' : 'forever',
             times:   clamp(s.times, 0, REPEAT_MAX),
             stride:  clamp(s.stride, 0, STRIDE_MAX),
             where:   yn(s.where),
             cookHot: yn(s.cookHot), cookBatter: yn(s.cookBatter),
             cookJoin:aor(s.cookJoin),
             tellHot: yn(s.tellHot), tellBatter: yn(s.tellBatter),
             tellJoin:aor(s.tellJoin) };
  }

  /* ------------------------------------------------------------ the rules
     Built as logic.js trees rather than evaluated by hand, so `and`, `or`
     and `not` mean here exactly what they mean in every other machine in
     this game — and so the console can print a rule by asking the same
     evaluator to write it out. */
  function tree(s, which){
    if(!K) return null;
    const r=ruleOf(which);
    const leaf = (name, sense) => sense==='is' ? K.VAR(name) : K.NOT(K.VAR(name));
    const a=leaf('hot', s[r.hot]), b=leaf('batter', s[r.batter]);
    return s[r.join]==='and' ? K.AND(a,b) : K.OR(a,b);
  }
  /* Does this rule fire on this morning? */
  function fires(s, m, which){
    const r=ruleOf(which);
    const t=tree(s, r.id);
    if(t) return !!K.value(t, { hot:m.hot, batter:m.batter });
    /* logic.js is the evaluator; this is only ever reached if it failed to
       load, and a silently different answer would be worse than none. */
    const a = s[r.hot]==='is' ? m.hot : !m.hot;
    const b = s[r.batter]==='is' ? m.batter : !m.batter;
    return s[r.join]==='and' ? (a && b) : (a || b);
  }
  /* AND THE ORDER IS THE LESSON. `else if` is only asked when the `if`
     above it said no — so a second rule that overlaps the first is not
     wrong so much as unreachable, which is a different mistake and reads
     as a different row in the table. */
  function does(s, m){
    if(fires(s, m, 'cook')) return 'cook';
    if(fires(s, m, 'tell')) return 'tell';
    return 'wait';
  }
  /* A rule in words, for a heading or a trace line. */
  const ruleText = (s, which) => {
    const t=tree(s, which);
    if(t) return K.text(t);
    const r=ruleOf(which);
    return (s[r.hot]==='is'?'':'not ')+'hot '+s[r.join]+' '
         + (s[r.batter]==='is'?'':'not ')+'batter';
  };

  /* Which mornings come out wrong, and what he did on each. */
  function mornings(s){
    s=tidy(s);
    return MORNINGS.map(m=>{
      const got=does(s,m), want=should(m);
      return { hot:m.hot, batter:m.batter, got, want, ok:got===want,
               did: got==='cook' ? 'cooks' : got==='tell' ? 'says so' : 'waits' };
    });
  }
  /* Is the FIRST rule wrong, on its own terms? Asked without reference to
     the second, so the walkthrough can send somebody at one rule at a time
     and the `else if` is never blamed for a mistake made above it. */
  const cookWrong = s => MORNINGS.some(m => fires(s,m,'cook') !== (should(m)==='cook'));

  /* --------------------------------------------------------------- run */
  function run(state){
    const s=tidy(state);
    const trace=[];
    const step=(text, kind)=>trace.push({ text, kind:kind||'do' });

    let dist=0, stuck=false;
    if(s.loop==='forever'){
      /* A forever loop is not a bug in itself — it is the right block for
         a thing that should never stop. It is a bug HERE because there is
         a line after it, and nothing after a forever loop ever runs. */
      stuck=true;
      step('repeat for ever:', 'loop');
      step(s.stride ? `walks ${s.stride} steps… and again… and again…`
                    : 'tries to walk 0 steps… and again… and again…', 'in');
      step('nothing after this ever runs.', 'bad');
      return { trace, dist:null, reached:false, fired:false, rows:[], ok:false, stuck,
               why:'He never comes out of the loop, so he never gets to the next line.' };
    }

    step(`repeat ${s.times} times:`, 'loop');
    if(s.times===0) step('…which is no times at all. He does not move.', 'in');
    for(let i=0;i<s.times;i++){ dist+=s.stride; step(`walks ${s.stride} steps (${dist} so far)`, 'in'); }

    const reached = dist >= KITCHEN;
    step(reached ? `He is in the kitchen. (${dist} of ${KITCHEN})`
                 : `He stops ${KITCHEN-dist} steps short of the kitchen. (${dist} of ${KITCHEN})`,
         reached ? 'good' : 'bad');

    const fired = s.where==='is' ? reached : !reached;
    step(`if he ${s.where} in the kitchen — ${fired ? 'YES' : 'no'}`, 'if');
    if(!fired){
      step('says: my legs will not…', 'bad');
      return { trace, dist, reached, fired, rows:[], ok:false, stuck:false,
               why: why(s, reached, fired, []) };
    }

    /* AND THEN THE TWO RULES, on every morning there is. Both are printed
       before either is judged, because the SHAPE on screen — one question,
       and then a second one asked only when the first says no — is as much
       the thing being taught as either rule is. */
    const rows=mornings(s);
    step(`if < pan ${s.cookHot} hot > ${s.cookJoin} < there ${s.cookBatter} batter >`, 'if');
    step(`else if < pan ${s.tellHot} hot > ${s.tellJoin} < there ${s.tellBatter} batter >`, 'if');
    rows.forEach(r=>{
      const m=(r.hot?'hot pan':'cold pan')+', '+(r.batter?'batter':'no batter');
      step(`  ${m} → he ${r.did}`
           + (r.ok ? '' : `  (he should ${r.want==='cook'?'cook':'say so'})`),
           r.ok ? 'good' : 'bad');
    });

    const allRight = rows.every(r=>r.ok);
    if(allRight) step('Pancakes.', 'good');

    const ok = reached && fired && allRight;
    return { trace, dist, reached, fired, rows, ok, stuck:false,
             why: ok ? null : why(s, reached, fired, rows) };
  }

  /* WHAT TO SAY WHEN IT DID NOT WORK — about the program, never about the
     answer. Every one of these is a thing the trace can be read to check. */
  function why(s, reached, fired, rows){
    if(!reached && s.stride===0)
      return 'His stride is 0, so every trip round the loop moves him nowhere.';
    if(!reached && s.times===0)
      return 'The loop runs 0 times, so the walking never happens at all.';
    if(!reached)
      return `${s.times} × ${s.stride} is ${s.times*s.stride}, and the kitchen is ${KITCHEN} steps away.`;
    if(!fired)
      return 'He got to the kitchen, and then the `if` asked the wrong question about it.';
    const bad=(rows||[]).filter(r=>!r.ok);
    if(bad.length){
      const r=bad[0];
      const m=(r.hot?'a hot pan':'a cold pan')+' and '+(r.batter?'batter':'no batter');
      /* `waits` is its own diagnosis. It is the only outcome the program
         should never reach, so a morning that reaches it did not fail a
         rule — it got past both of them without either one looking at it. */
      const tail = r.got==='wait'
        ? ' That morning fell past both questions without either one catching it.'
        : '';
      return `On a morning with ${m} he ${r.did}, and he should `
           + `${r.want==='cook' ? 'cook' : 'say why he cannot'}. `
           + `${bad.length} of the four mornings come out wrong.` + tail;
    }
    return 'Not yet.';
  }

  /* ================================================== THE WALKTHROUGH
     NINE DECISIONS IS NINE TOO MANY TO BE HANDED AT ONCE. A student who
     opens this and sees a whole program with no idea which part of it is
     the problem is not debugging, they are guessing — so the console is
     WALKED, one fault at a time, with the block it is about ringed.

     IT READS THE PROGRAM, NOT A COUNTER. `step` returns whichever entry is
     still unsatisfied, so fixing them out of order works, and undoing a
     fix brings its step back rather than stranding somebody past it.

     AND THE TWO RULES ARE TWO STEPS, in the order they are asked in. The
     `else if` is only ever reached when the `if` above it says no, so
     pointing somebody at the second rule while the first is still wrong is
     pointing them at a symptom of a mistake that is not there.

     `help` is the vocabulary. CODE's palette carries a line on every block
     saying what it does, and a student meeting `and` for the first time in
     the middle of a repair deserves the same sentence. */
  const STEPS = [
    { id:'loop', hole:'loop', topic:'LOOPS',
      bad: s => s.loop!=='repeat',
      help: '<b>forever</b> never stops. <b>repeat</b> goes round a set number of '
          + 'times and then carries on down the program.',
      say: 'This loop never ends, so nothing after it ever runs — which is '
         + 'why he is stuck saying half a sentence. A <b>forever</b> loop is the '
         + 'wrong loop when something has to happen afterwards.' },

    { id:'far', topic:'MOTION + LOOPS',
      hole: s => s.stride===0 ? 'stride' : 'times',
      bad: s => s.times * s.stride < KITCHEN,
      help: 'The loop body runs once per pass, so he travels '
          + '<b>steps × times</b> in total.',
      say: s => 'Now count. The kitchen is <b>' + KITCHEN + '</b> steps away and his '
         + 'motors will not take a stride longer than <b>' + STRIDE_MAX + '</b>. '
         + 'Right now the loop walks him ' + s.times + ' × ' + s.stride
         + ' = <b>' + (s.times*s.stride) + '</b>.' },

    { id:'where', hole:'where', topic:'CONDITIONALS',
      bad: s => s.where!=='is',
      help: 'An <b>if</b> runs what is inside it only when its question comes out '
          + 'true. <b>is not</b> asks the opposite question.',
      say: 'He gets there now — and then makes breakfast in the hallway. Read '
         + 'the <b>if</b> out loud: it fires when he is <b>not</b> in the kitchen.' },

    /* RULE ONE, DIAGNOSED FROM THE TABLE RATHER THAN FROM THE ANSWER.
       Which control gets ringed is a judgement — a rule that fires when
       only one of the two holds is an `or` problem, and a rule that misses
       the morning it should catch has something negated — but WHETHER it
       is wrong is never a judgement. It is four mornings, checked. */
    { id:'cook', topic:'BOOLEANS',
      hole: s => {
        const half = MORNINGS.some(m => m.hot!==m.batter
                                     && fires(s,m,'cook') !== (should(m)==='cook'));
        if(half && s.cookJoin!=='and') return 'cookJoin';
        if(s.cookHot!=='is') return 'cookHot';
        if(s.cookBatter!=='is') return 'cookBatter';
        return 'cookJoin';
      },
      bad: cookWrong,
      help: '<b>and</b> is true only when BOTH sides are true. <b>or</b> is true '
          + 'when EITHER side is. <b>is not</b> flips a side over.',
      say: s => {
        const bad=MORNINGS.filter(m => fires(s,m,'cook') !== (should(m)==='cook'));
        const m=bad[0];
        const w=(m.hot?'a hot pan':'a cold pan')+' and '+(m.batter?'batter':'no batter');
        const did=fires(s,m,'cook') ? 'starts cooking' : 'does not cook';
        return 'Start with the first <b>if</b> — the one that makes pancakes. He '
             + 'should only cook when the pan is hot <b>and</b> there is batter. '
             + 'On a morning with ' + w + ' he <b>' + did + '</b>, and '
             + bad.length + ' of the four mornings come out wrong.';
      } },

    /* RULE TWO, WHICH IS THE ONE WORTH THE MISSION. It is only asked on
       the mornings the first rule turned down, so the only rule that
       catches all of them is the first one turned inside out: both sides
       flipped and `and` become `or`. Nobody is told that. The table shows
       `waits` on a morning he should be explaining himself, and `waits` is
       a thing this program should never do — which is a fact about the
       SHAPE of an if/else-if/else and not about pancakes. */
    { id:'tell', topic:'CONDITIONALS + BOOLEANS',
      hole: s => {
        const rows=mornings(s);
        /* A rule that misses the mornings where exactly one thing is wrong
           is an `and` where an `or` belongs: two flipped sides joined by
           `and` only fire when BOTH things are wrong at once. */
        const half = rows.some(r=>!r.ok && (r.hot !== r.batter));
        if(half && s.tellJoin!=='or') return 'tellJoin';
        if(s.tellHot!=='is not') return 'tellHot';
        if(s.tellBatter!=='is not') return 'tellBatter';
        return 'tellJoin';
      },
      bad: s => mornings(s).some(r=>!r.ok),
      help: '<b>else if</b> is only asked when the <b>if</b> above it said no — so '
          + 'it has to catch every morning that one turned down. The last '
          + '<b>else</b> is what happens when neither of them caught it, and '
          + '<b>he should never get that far</b>.',
      say: s => {
        const bad=mornings(s).filter(r=>!r.ok);
        const r=bad[0];
        const m=(r.hot?'a hot pan':'a cold pan')+' and '+(r.batter?'batter':'no batter');
        return 'Breakfast is right. Now the <b>else if</b> — the one that says why '
             + 'he cannot cook. On a morning with ' + m + ' he <b>' + r.did
             + '</b>, and he is never meant to just stand there: every morning the '
             + 'first rule turns down, this one has to catch.';
      } }
  ];

  /* The step the console is on, or null when the program is right. */
  function step(state){
    const s=tidy(state);
    for(const st of STEPS){
      if(!st.bad(s)) continue;
      return { id:st.id, topic:st.topic, help:st.help,
               hole: typeof st.hole==='function' ? st.hole(s) : st.hole,
               say:  typeof st.say==='function'  ? st.say(s)  : st.say,
               n: STEPS.indexOf(st)+1, of: STEPS.length };
    }
    return null;
  }

  const API = { KITCHEN, STRIDE_MAX, REPEAT_MAX, MORNINGS, RULES,
                broken, tidy, run, step, STEPS,
                mornings, fires, does, ruleText, should };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROUTINE=API;
})(typeof self!=='undefined' ? self : this);
