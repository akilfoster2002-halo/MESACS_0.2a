/* =====================================================================
   ION'S MORNING QUESTIONS — the two things he asks himself, and what he
   gets wrong when they are wrong.

   It lives on its own for the same reason logic.js does: a lesson about
   booleans is only worth anything if the thing a student changes in the
   console is the thing the robot on the floor actually obeys. One
   evaluator, no DOM in it, called by the console and tested under Node.

   THIS IS THE FIRST BOOLEAN LESSON IN THE GAME, and it is deliberately
   the smallest one. It has been three things: four decisions about loops
   and walking; then a conditionals lesson with the booleans nested inside
   an if/else-if/else; and now just the booleans, because the course
   teaches booleans and operators and nothing else.

   WHAT IS LEFT WHEN THE LADDER GOES. Ion used to walk to the kitchen in a
   loop, ask whether he had arrived, and then run two rules in order — and
   the ORDER was half of what the lesson was about. Take the order away
   and the two rules do not become smaller, they become independent, which
   is a better first lesson than it was a second one: each is a question
   with a yes or a no, judged on its own, and neither can hide behind the
   other.

       CAN I COOK?        < pan (is) hot >  and  < there (is) batter >
       IS SOMETHING OUT?  < pan (is not) hot > or < there (is not) batter >

   THE SECOND IS THE FIRST ONE TURNED INSIDE OUT. Both sides flipped and
   the join swapped — De Morgan's law, arrived at by a nine-year-old
   reading a table of four mornings rather than by being told its name.
   Nobody is told. The table shows a morning where he neither cooks nor
   says why, and that is a morning he stands on the floor saying nothing.

   AND WHY THIS IS NOT THE PRE-FLIGHT OR THE BELT. The pre-flight (level
   two) is about the nine comparison words — `<` against `<=`, what "at
   least" means. The belt (level four) builds expressions over numeric
   gauges. This has no numbers in it at all: two yes/no facts, `and`, `or`
   and `not`, and that is the whole vocabulary. It is the first rung.

   EVERY RULE IS JUDGED ON EVERY MORNING THERE IS. Two yes/no facts make
   exactly four mornings, so the table is not a sample — it is the
   complete truth table, and a rule that is right on all four is right
   full stop. That is a thing only this level can say: the belt has to
   CHOOSE its parts because its gauges are numbers, and choosing is a
   weaker guarantee than covering.

   NOTHING IS MARKED AGAINST AN ANSWER KEY. There is no list of correct
   values in here. `should()` says what each morning deserves and the
   rules are run against it; any pair that comes out right is right.

   AND THE STORY IS NOT IN HERE. house.js flashes the lights and puts him
   back on the floor. This file is two questions and a table.
   ===================================================================== */
(function(root){
  const K = (typeof require==='function' && typeof module!=='undefined')
            ? require('./logic.js')
            : (root.KLOGIC || null);

  /* EVERY MORNING THERE IS. Two yes/no facts, so four rows and no more —
     the console draws them as a table somebody can point at. */
  const MORNINGS = [
    { hot:true,  batter:true  },
    { hot:true,  batter:false },
    { hot:false, batter:true  },
    { hot:false, batter:false }
  ];

  /* WHAT EACH QUESTION OUGHT TO ANSWER on a given morning, as functions of
     the morning rather than as strings, so the checker and the table
     cannot drift apart.

     He can cook when the pan is hot AND there is batter. Something is
     missing on exactly the other mornings — which is the whole of the
     second question, and the reason it is worth asking at all. */
  const ANSWERS = {
    cook: m => m.hot && m.batter,
    tell: m => !(m.hot && m.batter)
  };
  const should = (which, m) => !!ANSWERS[which](m);

  /* THE TWO QUESTIONS. Flat keys rather than nested ones, because the
     console rings a CONTROL by id and `cookJoin` is a control. Named in
     pairs so the two read as two. */
  const RULES = [
    { id:'cook', name:'CAN I COOK?',       hot:'cookHot', batter:'cookBatter', join:'cookJoin' },
    { id:'tell', name:'IS SOMETHING OUT?', hot:'tellHot', batter:'tellBatter', join:'tellJoin' }
  ];
  const ruleOf = which => RULES.find(x=>x.id===which) || RULES[0];

  /* What the console finds when it opens him up.

     BOTH ARE WRONG AND THEY ARE WRONG DIFFERENTLY. The first has a side
     flipped and the wrong join, so it fires on mornings it should not.
     The second is the first one COPIED — the same shape, unflipped —
     which is the most useful wrong answer there is, because it is what
     anybody gets by reading the line above and doing it again. The table
     shows him saying nothing on three mornings out of four. */
  const broken = () => ({
    cookHot:'is not', cookBatter:'is', cookJoin:'or',
    tellHot:'is',     tellBatter:'is', tellJoin:'and'
  });

  const yn  = v => v==='is'  ? 'is'  : 'is not';
  const aor = v => v==='and' ? 'and' : 'or';
  function tidy(s){
    s=s||{};
    return { cookHot: yn(s.cookHot), cookBatter: yn(s.cookBatter), cookJoin:aor(s.cookJoin),
             tellHot: yn(s.tellHot), tellBatter: yn(s.tellBatter), tellJoin:aor(s.tellJoin) };
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
  /* Does this question answer yes on this morning? */
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
  /* A rule in words, for a heading or a trace line. */
  const ruleText = (s, which) => {
    const t=tree(s, which);
    if(t) return K.text(t);
    const r=ruleOf(which);
    return (s[r.hot]==='is'?'':'not ')+'hot '+s[r.join]+' '
         + (s[r.batter]==='is'?'':'not ')+'batter';
  };

  /* WHAT HE DOES, which is now a fact about both answers at once rather
     than about which rule was asked first.

     There is no order here and no `else`. He cooks when the first says
     yes, he explains himself when the second does, and the two other
     outcomes are the ways a pair of questions can be wrong together:
     saying nothing at all on a morning, or trying to do both. Both read
     as plainly in the table as `cooks` does. */
  function does(s, m){
    const cook=fires(s,m,'cook'), tell=fires(s,m,'tell');
    return cook && tell ? 'both' : cook ? 'cook' : tell ? 'tell' : 'nothing';
  }
  const DID = { cook:'cooks', tell:'says so', nothing:'stands there', both:'tries both' };

  /* Every morning, with what each question answered and what it should
     have. Judged per QUESTION rather than per outcome, so a student can be
     sent at one of them without the other being blamed. */
  function mornings(s){
    s=tidy(s);
    return MORNINGS.map(m=>{
      const cookGot=fires(s,m,'cook'), tellGot=fires(s,m,'tell');
      const cookWant=should('cook',m), tellWant=should('tell',m);
      const got=does(s,m);
      return { hot:m.hot, batter:m.batter,
               cook:{ got:cookGot, want:cookWant, ok:cookGot===cookWant },
               tell:{ got:tellGot, want:tellWant, ok:tellGot===tellWant },
               got, did: DID[got] || got,
               ok: cookGot===cookWant && tellGot===tellWant };
    });
  }
  /* Is one question wrong, on its own terms? Asked without reference to
     the other, so the walkthrough can send somebody at one at a time. */
  const wrong = (s, which) =>
    MORNINGS.some(m => fires(tidy(s), m, which) !== should(which, m));
  const cookWrong = s => wrong(s, 'cook');

  /* --------------------------------------------------------------- run */
  function run(state){
    const s=tidy(state);
    const trace=[];
    const step=(text, kind)=>trace.push({ text, kind:kind||'do' });
    const rows=mornings(s);

    /* BOTH QUESTIONS ARE PRINTED BEFORE EITHER IS JUDGED, because the
       shape on screen — two questions, asked of the same morning, neither
       above the other — is as much the thing being taught as either one
       of them is. */
    step(`can I cook?       < pan ${s.cookHot} hot > ${s.cookJoin} < there ${s.cookBatter} batter >`, 'if');
    step(`is something out? < pan ${s.tellHot} hot > ${s.tellJoin} < there ${s.tellBatter} batter >`, 'if');

    rows.forEach(r=>{
      const m=(r.hot?'hot pan':'cold pan')+', '+(r.batter?'batter':'no batter');
      step(`  ${m} → he ${r.did}`
           + (r.ok ? '' : `  (he should ${r.cook.want ? 'cook' : 'say so'})`),
           r.ok ? 'good' : 'bad');
    });

    const ok = rows.every(r=>r.ok);
    if(ok) step('Pancakes.', 'good');
    return { trace, rows, ok, why: ok ? null : why(s, rows) };
  }

  /* WHAT TO SAY WHEN IT DID NOT WORK — about the questions, never about
     the answer. Every one of these is a thing the table can be read to
     check. */
  function why(s, rows){
    const bad=(rows||[]).filter(r=>!r.ok);
    if(!bad.length) return null;
    const r=bad[0];
    const m=(r.hot?'a hot pan':'a cold pan')+' and '+(r.batter?'batter':'no batter');
    /* `stands there` is its own diagnosis. It is the only outcome this
       program should never reach, so a morning that reaches it did not
       fail one question — both of them said no to it. */
    if(r.got==='nothing')
      return `On a morning with ${m} he says nothing at all. `
           + 'Every morning is one or the other: either he can cook, or something is missing.';
    if(r.got==='both')
      return `On a morning with ${m} both questions say yes at once. `
           + 'They cannot both be true of the same morning.';
    return `On a morning with ${m} he ${r.did}, and he should `
         + `${r.cook.want ? 'cook' : 'say so'}.`;
  }

  /* ========================================================== THE STEPS
     ONE QUESTION AT A TIME. Six decisions is not many, and handed over at
     once they are still six — so the console walks them, and the walk is
     in the order the questions are written rather than in the order they
     happen to be wrong.

     AND THE WORDS ARE COUNTED, to the same budget preflight.js is written
     to: five to nine words a sentence. These steps were seventy-one words
     over a table of four rows, and they were seventy-one words saying
     three things — the rule, then the rule again in the vocabulary line,
     then a sentence narrating a row of the table that was already red and
     already said "should no".

     SAY THE RULE; LET THE TABLE SAY THE REST. Which morning is wrong and
     how many of them there are is what a table is FOR, and prose that
     describes one is prose competing with something better at the job.
     preflight.js took the failing reading out of its own step sentence for
     exactly this reason and it is the same panel a level later. */
  const STEPS = [
    /* RULE ONE, WHICH IS THE ONLY THING A TWO-TERM `and` CAN BE. He cooks
       when BOTH are true, and a student who picks `or` gets a robot that
       cooks with no batter in the bowl — which the table says in a row
       rather than in a sentence. */
    { id:'cook', topic:'BOOLEANS', name:'CAN I COOK?',
      hole: s => {
        if(s.cookHot!=='is') return 'cookHot';
        if(s.cookBatter!=='is') return 'cookBatter';
        return 'cookJoin';
      },
      bad: s => wrong(s, 'cook'),
      /* THE VOCABULARY, AND ONLY ON THE STEP THAT INTRODUCES IT. These two
         words are met here for the first time in the whole course, so they
         are worth six words once — and not again on the next step, where
         the student has already used them. */
      help: '<b>and</b> wants both. <b>or</b> wants either.',
      say: 'He cooks only when both are true.' },

    /* RULE TWO, WHICH IS THE ONE WORTH THE MISSION. It has to be true on
       exactly the mornings the first one is false, and the only rule that
       is, is the first one turned inside out: both sides flipped and `and`
       become `or`. Nobody is told that. The table shows him standing
       there saying nothing on a morning he should be explaining himself,
       and that is a fact about `and` and `or` rather than about pancakes. */
    { id:'tell', topic:'BOOLEANS', name:'IS SOMETHING OUT?',
      hole: s => {
        const rows=mornings(s);
        /* A rule that misses the mornings where exactly one thing is wrong
           is an `and` where an `or` belongs: two flipped sides joined by
           `and` are only true when BOTH things are wrong at once. */
        const half = rows.some(r=>!r.tell.ok && (r.hot !== r.batter));
        if(half && s.tellJoin!=='or') return 'tellJoin';
        if(s.tellHot!=='is not') return 'tellHot';
        if(s.tellBatter!=='is not') return 'tellBatter';
        return 'tellJoin';
      },
      bad: s => wrong(s, 'tell'),
      help: 'Flipping one side is not enough.',
      say: 'True on every morning he cannot cook.' }
  ];

  /* The step the console is on, or null when both questions are right. */
  function step(state){
    const s=tidy(state);
    for(const st of STEPS){
      if(!st.bad(s)) continue;
      return { id:st.id, topic:st.topic, name:st.name, help:st.help,
               hole: typeof st.hole==='function' ? st.hole(s) : st.hole,
               say:  typeof st.say==='function'  ? st.say(s)  : st.say,
               n: STEPS.indexOf(st)+1, of: STEPS.length };
    }
    return null;
  }

  const API = { MORNINGS, RULES, ANSWERS,
                broken, tidy, run, step, STEPS,
                mornings, fires, does, ruleText, should, wrong, cookWrong };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROUTINE=API;
})(typeof self!=='undefined' ? self : this);
