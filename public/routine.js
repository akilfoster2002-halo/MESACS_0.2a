/* =====================================================================
   ION'S MORNING ROUTINE — the program, and what happens when it runs.

   It lives on its own for the same reason logic.js does: a lesson about
   loops is only worth anything if the thing a student changes in the
   console is the thing the robot on the floor actually obeys. One
   interpreter, no DOM in it, called by the console and tested under Node.

   FOUR IDEAS, SIX DECISIONS. The program is one program — it is his
   morning and it reads as one — but every part of it is broken in a way
   that asks about something different:

     MOTION        move ( ? ) steps            how far one stride goes
     LOOPS         ( forever | repeat ( ? ) )  which loop, and how many
     CONDITIONALS  if he ( is | is not ) in the kitchen
     BOOLEANS      if < pan ( is ) hot > ( and | or ) < there ( is ) batter >

   THE BOOLEAN IS JUDGED ON FOUR MORNINGS, NOT ONE. A rule about `and` that
   is only ever tried on the morning it was written for is a rule nobody
   has tested: `or` gets that morning right too. So the rule is run against
   every combination of hot pan and batter there is, and it has to get all
   four right — which is the only way to tell somebody has understood the
   difference rather than found a setting that worked once.

   NOTHING IS MARKED AGAINST AN ANSWER KEY. There is no list of correct
   values in here. run() walks the program and reports what Ion DID, and
   whether that counts is about the breakfast. `repeat 4 [move 10]` and
   `repeat 5 [move 8]` are both forty steps and both open the door.
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

  /* EVERY MORNING THERE IS. The rule has to be right on all four, and the
     console draws them as a table — four rows somebody can point at. */
  const MORNINGS = [
    { hot:true,  batter:true  },
    { hot:true,  batter:false },
    { hot:false, batter:true  },
    { hot:false, batter:false }
  ];
  /* He should cook when the pan is hot AND there is batter, and wait
     otherwise. Written as a function of the morning rather than as a
     string, so the checker and the table cannot drift apart. */
  const should = m => m.hot && m.batter;

  /* What the console finds when it opens him up. */
  const broken = () => ({
    loop:'forever', times:1, stride:0,      // loops + motion
    where:'is not',                          // the conditional
    hot:'is not', batter:'is', join:'or'     // the boolean
  });

  const clamp=(n,lo,hi)=>Math.max(lo, Math.min(hi, Math.round(+n||0)));
  const yn = v => v==='is' ? 'is' : 'is not';
  function tidy(s){
    s=s||{};
    return { loop:   s.loop==='repeat' ? 'repeat' : 'forever',
             times:  clamp(s.times, 0, REPEAT_MAX),
             stride: clamp(s.stride, 0, STRIDE_MAX),
             where:  yn(s.where),
             hot:    yn(s.hot),
             batter: yn(s.batter),
             join:   s.join==='and' ? 'and' : 'or' };
  }

  /* ------------------------------------------------------------ the rule
     Built as a logic.js tree rather than evaluated by hand, so `and`, `or`
     and `not` mean here exactly what they mean in every other machine in
     this game — and so the console can print the rule by asking the same
     evaluator to write it out. */
  function tree(s){
    if(!K) return null;
    const leaf = (name, sense) => sense==='is' ? K.VAR(name) : K.NOT(K.VAR(name));
    const a=leaf('hot', s.hot), b=leaf('batter', s.batter);
    return s.join==='and' ? K.AND(a,b) : K.OR(a,b);
  }
  function fires(s, m){
    const t=tree(s);
    if(t) return !!K.value(t, { hot:m.hot, batter:m.batter });
    /* logic.js is the evaluator; this is only ever reached if it failed to
       load, and a silently different answer would be worse than none. */
    const a = s.hot==='is' ? m.hot : !m.hot;
    const b = s.batter==='is' ? m.batter : !m.batter;
    return s.join==='and' ? (a && b) : (a || b);
  }
  /* The rule in words, for the table's heading. */
  const ruleText = s => { const t=tree(s); return t ? K.text(t)
    : (s.hot==='is'?'':'not ')+'hot '+s.join+' '+(s.batter==='is'?'':'not ')+'batter'; };

  /* Which mornings the rule gets wrong, and what he did on each. */
  function mornings(s){
    return MORNINGS.map(m=>{
      const got=fires(s,m), want=should(m);
      return { hot:m.hot, batter:m.batter, got, want, ok:got===want,
               did: got ? 'cooks' : 'waits' };
    });
  }

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

    /* AND THEN THE RULE, on every morning there is. */
    const rows=mornings(s);
    step(`if < pan ${s.hot} hot > ${s.join} < there ${s.batter} batter >`, 'if');
    rows.forEach(r=>{
      const m=(r.hot?'hot pan':'cold pan')+', '+(r.batter?'batter':'no batter');
      step(`  ${m} → he ${r.did}` + (r.ok ? '' : `  (he should ${r.want?'cook':'wait'})`),
           r.ok ? 'good' : 'bad');
    });

    const allRight = rows.every(r=>r.ok);
    if(allRight) step('Pancakes.', 'good');

    const ok = reached && fired && allRight;
    return { trace, dist, reached, fired, rows, ok, stuck:false,
             why: ok ? null : why(s, reached, fired, rows),
             note: ok ? NOTE : null };
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
      return `On a morning with ${m} he ${r.did}, and he should ${r.want?'cook':'wait'}. `
           + `${bad.length} of the four mornings come out wrong.`;
    }
    return 'Not yet.';
  }

  /* ================================================== THE WALKTHROUGH
     SIX FAULTS IS SIX TOO MANY TO BE HANDED AT ONCE. A student who opens
     this and sees a whole program with no idea which part of it is the
     problem is not debugging, they are guessing — so the console is
     WALKED, one fault at a time, with the block it is about ringed.

     IT READS THE PROGRAM, NOT A COUNTER. `at` is whichever step is still
     unsatisfied, so fixing them out of order works, and undoing a fix
     brings its step back rather than stranding somebody past it.

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

    /* THE BOOLEAN, DIAGNOSED FROM THE TABLE RATHER THAN FROM THE ANSWER.
       Which control gets ringed is a judgement — a rule that fires when
       only one of the two holds is an `or` problem, and a rule that misses
       the morning it should catch has something negated — but WHETHER it
       is wrong is never a judgement. It is four mornings, checked. */
    { id:'bool', topic:'BOOLEANS',
      hole: s => {
        const rows=mornings(s);
        const half = rows.some(r=>!r.ok && (r.hot !== r.batter));
        if(half && s.join!=='and') return 'join';
        if(s.hot!=='is') return 'hot';
        if(s.batter!=='is') return 'batter';
        return 'join';
      },
      bad: s => mornings(s).some(r=>!r.ok),
      help: '<b>and</b> is true only when BOTH sides are true. <b>or</b> is true '
          + 'when EITHER side is. <b>is not</b> flips a side over.',
      say: s => {
        const bad=mornings(s).filter(r=>!r.ok);
        const r=bad[0];
        const m=(r.hot?'a hot pan':'a cold pan')+' and '+(r.batter?'batter':'no batter');
        return 'He should only cook when the pan is hot <b>and</b> there is batter. '
             + 'Right now, on a morning with ' + m + ', he <b>' + r.did + '</b> — '
             + 'and ' + bad.length + ' of the four mornings come out wrong.';
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

  /* ====================================================== THE NOTE
     NOT A FAULT. It is the last thing in his routine, it is commented out
     so it has never run, and it is not in his handwriting. The console
     only shows it once the program works, because until then there is a
     robot on the floor and nobody is reading footnotes. */
  const NOTE = {
    lines: [
      '# ion — if she asks where the spare cells went,',
      '# say the crate was empty when it arrived.',
      '# she does not need to come out to the tower.',
      '#                                    — E.'
    ],
    who: 'E.'
  };

  const API = { KITCHEN, STRIDE_MAX, REPEAT_MAX, MORNINGS, NOTE,
                broken, tidy, run, step, STEPS,
                mornings, fires, ruleText, should };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROUTINE=API;
})(typeof self!=='undefined' ? self : this);
