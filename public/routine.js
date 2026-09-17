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
  /* ================================================== THE SIX QUESTIONS
     TWO WAS NOT A LESSON, IT WAS AN EXAMPLE. Ion's kitchen routine asked
     `and` once and De Morgan once, and a student who happened to guess
     both was through the only boolean practice in this room in ninety
     seconds. Six is five minutes, and five minutes is the point: this is
     the first of three places in Mission 8 where anybody writes a boolean
     expression, and the other two are a hatch on a spaceship and a
     conveyor belt.

     THEY ARE THE SHAPES TWO FACTS CAN MAKE. Each side of a question is a
     fact or its opposite and the join is `and` or `or`, so with a hot pan
     and a bowl of batter there are eight questions to ask and these six
     are the ones worth asking:

       1  hot AND batter            he can cook
       2  NOT hot OR NOT batter     something is missing      (1 inside out)
       3  hot OR batter             there is something to do
       4  hot AND NOT batter        the pan is on for nothing
       5  NOT hot AND NOT batter    the kitchen is asleep      (3 inside out)
       6  NOT hot OR batter         it is safe to walk away

     THE ORDER IS THE LESSON. 1 is `and`. 2 is 1 turned inside out, which
     is the only way to get it and is the whole of De Morgan. 3 is `or`,
     which is easy once 1 is done. 4 puts a `not` on one side only. 5 is 3
     turned inside out, so the trick from 2 is wanted again with the other
     join. And 6 is the one worth the room: "off, or cooking" is how a
     person says "if it is on, there had better be batter in it", and an
     implication written as an `or` is a thing most adults have never
     noticed.

     EACH ONE CARRIES ITS OWN ANSWER as a function of the morning, so the
     checker, the table and the walkthrough cannot drift apart: there is
     one definition of what question 4 means and everything reads it. */
  const RULES = [
    { id:'cook', name:'CAN I COOK?',
      want: m => m.hot && m.batter,
      did:'cooks',
      start:{ hot:'is not', batter:'is', join:'or' },
      help:'<b>and</b> wants both. <b>or</b> wants either.',
      say:'He cooks only when both are true.' },

    { id:'miss', name:'IS SOMETHING MISSING?',
      want: m => !m.hot || !m.batter,
      did:'says something is missing',
      /* THE COPY. Reading the line above and doing it again is the most
         useful wrong answer there is, so it is the one he is found with. */
      start:{ hot:'is', batter:'is', join:'and' },
      help:'Flipping one side is not enough.',
      say:'True on every morning he cannot cook.' },

    { id:'start', name:'IS THERE ANYTHING TO DO?',
      want: m => m.hot || m.batter,
      did:'gets started',
      /* NOT HOT AND BATTER: what you get by reading "anything to do" as
         "something is off, and something is ready". */
      start:{ hot:'is not', batter:'is', join:'and' },
      help:'One is enough for <b>or</b>.',
      say:'Either one is enough to be worth starting.' },

    { id:'dry', name:'IS THE PAN ON FOR NOTHING?',
      want: m => m.hot && !m.batter,
      did:'turns the pan off',
      /* The `not` dropped and the join guessed: the shape most people
         write first for a question with "nothing" in it. */
      start:{ hot:'is', batter:'is', join:'or' },
      help:'A <b>not</b> can sit on one side alone.',
      say:'Hot, and nothing to put in it.' },

    { id:'dead', name:'IS THE KITCHEN ASLEEP?',
      want: m => !m.hot && !m.batter,
      did:'goes back to sleep',
      /* QUESTION ONE, COPIED. By this point it is the rule on the screen
         that is known to be right, so it is the one that gets reused. */
      start:{ hot:'is', batter:'is', join:'and' },
      help:'Both wrong at once wants <b>and</b>.',
      say:'Nothing hot and nothing to cook.' },

    { id:'safe', name:'IS IT SAFE TO LEAVE?',
      want: m => !m.hot || m.batter,
      did:'leaves the room',
      /* QUESTION FOUR, COPIED — the one directly above it, and genuinely
         tempting: "hot and empty" is the unsafe morning, so it looks like
         the same fact asked the other way round. It is not. */
      start:{ hot:'is', batter:'is not', join:'and' },
      help:'Off, <b>or</b> busy. Either one is safe.',
      say:'Safe when the pan is off, or in use.' }
  ];
  /* The control ids, derived rather than typed: the console rings a
     control by name and `cookJoin` is a control. Six rules is eighteen of
     them, and eighteen typed strings is eighteen chances to typo one. */
  RULES.forEach(r=>{ r.hot=r.id+'Hot'; r.batter=r.id+'Batter'; r.join=r.id+'Join'; });

  const ANSWERS = {};
  RULES.forEach(r=>{ ANSWERS[r.id]=r.want; });
  const should = (which, m) => !!ANSWERS[which](m);

  const ruleOf = which => RULES.find(x=>x.id===which) || RULES[0];

  /* What the console finds when it opens him up.

     BOTH ARE WRONG AND THEY ARE WRONG DIFFERENTLY. The first has a side
     flipped and the wrong join, so it fires on mornings it should not.
     The second is the first one COPIED — the same shape, unflipped —
     which is the most useful wrong answer there is, because it is what
     anybody gets by reading the line above and doing it again. The table
     shows him saying nothing on three mornings out of four. */
  const broken = () => {
    const o={};
    RULES.forEach(r=>{ o[r.hot]=r.start.hot; o[r.batter]=r.start.batter;
                       o[r.join]=r.start.join; });
    return o;
  };

  const yn  = v => v==='is'  ? 'is'  : 'is not';
  const aor = v => v==='and' ? 'and' : 'or';
  function tidy(s){
    s=s||{};
    const o={};
    RULES.forEach(r=>{ o[r.hot]=yn(s[r.hot]); o[r.batter]=yn(s[r.batter]);
                       o[r.join]=aor(s[r.join]); });
    return o;
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

  /* WHAT HE DOES, which is a fact about all six answers at once.

     There is no order here and no `else`: every question is asked of
     every morning and each one answers for itself. With two questions the
     interesting outcomes were "neither" and "both"; with six they are
     simply the list of the ones that said yes, which is what a robot
     following six rules actually does. */
  function does(s, m){
    const on=RULES.filter(r=>fires(s,m,r.id));
    if(!on.length) return 'stands there';
    return on.map(r=>r.did).join(', and ');
  }

  /* Every morning, with what each question answered and what it should
     have. Judged per QUESTION rather than per outcome, so a student can
     be sent at one of them without the others being blamed. Each rule's
     verdict is filed under its own id, which is how the console asks for
     one question's table. */
  function mornings(s){
    s=tidy(s);
    return MORNINGS.map(m=>{
      const row={ hot:m.hot, batter:m.batter };
      let all=true;
      RULES.forEach(r=>{
        const got=fires(s,m,r.id), want=should(r.id,m);
        row[r.id]={ got, want, ok:got===want };
        if(got!==want) all=false;
      });
      row.got=does(s,m); row.did=row.got; row.ok=all;
      return row;
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

    /* ALL SIX ARE PRINTED BEFORE ANY OF THEM IS JUDGED, because the shape
       on screen — six questions asked of the same morning, none above any
       other — is as much the thing being taught as any one of them. */
    RULES.forEach(r=>{
      step(`${r.name.toLowerCase().replace('?','')}? `
           + `< pan ${s[r.hot]} hot > ${s[r.join]} < there ${s[r.batter]} batter >`, 'if');
    });

    rows.forEach(r=>{
      const m=(r.hot?'hot pan':'cold pan')+', '+(r.batter?'batter':'no batter');
      const bad=RULES.filter(x=>!r[x.id].ok);
      step(`  ${m} → he ${r.did}`
           + (bad.length ? `  (${bad.map(x=>x.name.replace('?','')).join(', ')} wrong)` : ''),
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
    const q=RULES.find(x=>!r[x.id].ok);
    if(!q) return null;
    return `On a morning with ${m}, "${q.name}" says `
         + `${r[q.id].got ? 'yes' : 'no'} and should say `
         + `${r[q.id].want ? 'yes' : 'no'}.`;
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
  /* ONE STEP PER QUESTION, GENERATED. Six steps typed out is six copies
     of the same four fields, and the walkthrough's job is the same for
     every one of them: find the first control that is not what the
     question needs, ring it, and say the rule in one short sentence.

     WHICH CONTROL IS RINGED IS NOT THE ORDER THEY ARE WRITTEN IN. The
     join is asked for FIRST whenever the join is wrong, because the join
     is the thing this level is about — a student with `and` where `or`
     belongs will flip both sides trying to fix it and end up further
     away. Sides after, left to right.

     AND WHAT EACH QUESTION NEEDS IS DERIVED FROM ITS OWN ANSWER, not
     typed beside it: solve() reads the four mornings and works out the
     only shape that fits them. There is one definition of question 4 and
     everything, including the walkthrough that marks it, reads that. */
  function solve(r){
    /* the eight shapes, and the one whose column matches this question */
    for(const hot of ['is','is not'])
      for(const bat of ['is','is not'])
        for(const join of ['and','or']){
          const fits=MORNINGS.every(m=>{
            const a = hot==='is' ? m.hot : !m.hot;
            const b = bat==='is' ? m.batter : !m.batter;
            return (join==='and' ? (a&&b) : (a||b)) === !!r.want(m);
          });
          if(fits) return { hot, batter:bat, join };
        }
    return null;
  }
  const STEPS = RULES.map(r=>{
    const need=solve(r);
    return {
      id:r.id, topic:'BOOLEANS', name:r.name,
      hole: s => {
        if(!need) return r.join;
        if(s[r.join]!==need.join)     return r.join;
        if(s[r.hot]!==need.hot)       return r.hot;
        if(s[r.batter]!==need.batter) return r.batter;
        return r.join;
      },
      bad: s => wrong(s, r.id),
      help: r.help,
      say: r.say
    };
  });

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
                broken, tidy, run, step, STEPS, solve,
                mornings, fires, does, ruleText, should, wrong, cookWrong };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROUTINE=API;
})(typeof self!=='undefined' ? self : this);
