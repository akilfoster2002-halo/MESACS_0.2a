/* ION'S MORNING ROUTINE — the assessment, with no screen attached.

   NINE DECISIONS, SEVEN OF THEM ABOUT A QUESTION. This is a conditionals
   and boolean logic lesson: one `if`, one `else if` that is only asked
   when the first says no, and two two-term rules over the same two facts.
   If the interpreter is wrong then the console lies to a student about
   what their program did, which is worse than no lesson at all — so it is
   tested the way logic.js is, under Node, against the same evaluator the
   machines in this game think with. */
const test = require('node:test');
const assert = require('node:assert');
const R = require('../public/routine.js');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* The one program that works. Both rules are written out rather than
   derived, so a change to either of them fails here first. */
const RIGHT = { loop:'repeat', times:4, stride:10, where:'is',
                cookHot:'is',     cookBatter:'is',     cookJoin:'and',
                tellHot:'is not', tellBatter:'is not', tellJoin:'or' };

const SENSES = ['is','is not'], JOINS = ['and','or'];

/* ---------------------------------------------------------- the faults */
test('what the player walks in on is broken in every idea at once', ()=>{
  const r = R.run(R.broken());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.stuck, true, 'the symptom is the forever loop');
  const topics = R.STEPS.map(s=>s.topic);
  for(const want of ['LOOPS','MOTION + LOOPS','CONDITIONALS','BOOLEANS',
                     'CONDITIONALS + BOOLEANS'])
    assert.ok(topics.includes(want), 'nothing assesses '+want);

  /* AND THE WEIGHT IS ON THE QUESTIONS. Loops and the walking are the
     symptom Robin finds him in and they are worth one decision each; the
     mission is the two conditionals and the two booleans hanging off
     them. If that balance ever tips back, this is the lesson quietly
     becoming a different lesson. */
  const asks = topics.filter(t=>/CONDITIONALS|BOOLEANS/.test(t)).length;
  assert.ok(asks > topics.length - asks,
    `only ${asks} of ${topics.length} steps are about a condition`);
});

test('a forever loop never reaches the line after it', ()=>{
  const r = R.run({ ...RIGHT, loop:'forever' });
  assert.strictEqual(r.ok, false, 'everything else is right and it still cannot work');
  assert.ok(!/in the kitchen —/.test(r.trace.map(l=>l.text).join(' ')),
    'the `if` is never even asked');
});

test('a loop that is too short stops short, and says by how much', ()=>{
  const r = R.run({ ...RIGHT, times:2 });
  assert.strictEqual(r.dist, 20);
  assert.match(r.why, /20/, 'the diagnosis does the arithmetic with them');
});

test('the loop cannot be dodged', ()=>{
  /* Without a cap on the stride, `repeat 1 [move 40]` walks him there in
     one hop and the lesson about loops is one nobody attends. */
  assert.ok(R.STRIDE_MAX < R.KITCHEN, 'one stride reaches the kitchen');
  assert.strictEqual(R.run({ ...RIGHT, times:1, stride:R.STRIDE_MAX }).ok, false);
  assert.ok(Math.ceil(R.KITCHEN / R.STRIDE_MAX) >= 4, 'that is barely a loop');
});

/* --------------------------------------------------------- conditionals */
test('an inverted outer if makes breakfast in the hallway', ()=>{
  const r = R.run({ ...RIGHT, stride:0, where:'is not' });
  assert.strictEqual(r.reached, false);
  assert.strictEqual(r.fired, true, 'the wrong question got a yes');
  assert.strictEqual(r.ok, false, 'and breakfast in the hallway is not breakfast');
});

test('the second rule is only asked when the first one says no', ()=>{
  /* THE WHOLE OF `else if`, and the reason the answer to the second rule
     is not obvious. Give both rules the SAME condition. It is true on the
     hot-pan-and-batter morning, so on two stacked `if`s he would cook and
     then announce he cannot — and in a chain the second one is never
     asked at all. Which is also why this is the wrong answer a student
     reaches for first: copying the line above you produces a branch that
     can never run. */
  const copied = { ...RIGHT, tellHot:'is', tellBatter:'is', tellJoin:'and' };
  const both = { hot:true, batter:true };
  assert.strictEqual(R.fires(copied, both, 'cook'), true);
  assert.strictEqual(R.fires(copied, both, 'tell'), true, 'the probe is not a copy');
  assert.strictEqual(R.does(copied, both), 'cook',
    'the `else if` was asked about a morning the `if` above it had already taken');
  /* And on every morning the first rule turns down, a copy catches
     nothing: the branch is unreachable, not merely wrong. */
  for(const m of R.MORNINGS)
    if(!R.fires(copied, m, 'cook'))
      assert.strictEqual(R.fires(copied, m, 'tell'), false,
        'a copy of the first rule fired where the first rule did not');
});

test('a morning that reaches the last else is a morning nothing caught', ()=>{
  /* `wait` is the only outcome this program should never produce, and it
     is the console's way of saying a morning fell through both rules. A
     correct program must never produce it; the one the player walks in on
     must, or the shape of an if/else-if/else is never on screen. */
  assert.ok(R.mornings(RIGHT).every(r=>r.got!=='wait'),
    'the finished program still leaves a morning uncaught');
  const copied = { ...RIGHT, tellHot:'is', tellBatter:'is', tellJoin:'and' };
  const fell = R.mornings(copied).filter(r=>r.got==='wait');
  assert.strictEqual(fell.length, 3,
    'copying the first rule into the `else if` has to strand the mornings it turned down');
  assert.match(R.run(copied).why, /fell past both/,
    'nothing tells the player the morning was not caught by anything');
});

/* ------------------------------------------------------------ the rules */
test('exactly one pair of rules survives four mornings', ()=>{
  /* THE WHOLE POINT OF A TRUTH TABLE. A rule tried on one morning proves
     nothing — `or` gets the hot-pan-and-batter morning right too. Run
     every pair of rules the console can express against every morning
     there is, and precisely one may pass.

     There are sixty-four pairs. That there is one answer rather than
     several is not a nicety: a console with two right answers cannot ring
     the control that is wrong, because neither of them is. */
  const pass=[];
  for(const cookHot of SENSES) for(const cookBatter of SENSES) for(const cookJoin of JOINS)
    for(const tellHot of SENSES) for(const tellBatter of SENSES) for(const tellJoin of JOINS){
      const s={ ...RIGHT, cookHot, cookBatter, cookJoin, tellHot, tellBatter, tellJoin };
      if(R.mornings(s).every(r=>r.ok))
        pass.push(R.ruleText(s,'cook') + ' | ' + R.ruleText(s,'tell'));
    }
  assert.deepStrictEqual(pass, ['hot and batter | not hot or not batter'],
    'more than one pair passes: the table is not discriminating');
});

test('the second rule is the first one turned inside out', ()=>{
  /* DE MORGAN, WITHOUT THE NAME. The `else if` has to catch exactly the
     mornings the `if` turned down, and the only two-term rule that does is
     both sides flipped and the join swapped. A nine-year-old gets there by
     reading four rows; this is the same statement, checked. */
  for(const m of R.MORNINGS)
    assert.strictEqual(R.fires(RIGHT, m, 'tell'), !R.fires(RIGHT, m, 'cook'),
      'the two rules are not each other\'s opposite on every morning');
  assert.strictEqual(RIGHT.tellJoin, RIGHT.cookJoin==='and' ? 'or' : 'and');
  assert.notStrictEqual(RIGHT.tellHot, RIGHT.cookHot);
  assert.notStrictEqual(RIGHT.tellBatter, RIGHT.cookBatter);
});

test('or fires on the two half-mornings, which is how you can see it is or', ()=>{
  const rows = R.mornings({ ...RIGHT, cookJoin:'or' });
  const wrong = rows.filter(r=>!r.ok);
  assert.strictEqual(wrong.length, 2);
  for(const r of wrong)
    assert.notStrictEqual(r.hot, r.batter, 'only the one-true mornings should differ');
});

test('both rules use logic.js rather than a second evaluator', ()=>{
  const K = require('../public/logic.js');
  for(const rule of R.RULES)
    for(const join of JOINS) for(const hot of SENSES) for(const batter of SENSES)
      for(const m of R.MORNINGS){
        const s={ ...RIGHT, [rule.hot]:hot, [rule.batter]:batter, [rule.join]:join };
        const mine = R.fires(s, m, rule.id);
        const leaf = (n,sense)=> sense==='is' ? K.VAR(n) : K.NOT(K.VAR(n));
        const t = join==='and' ? K.AND(leaf('hot',hot), leaf('batter',batter))
                               : K.OR (leaf('hot',hot), leaf('batter',batter));
        assert.strictEqual(mine, !!K.value(t, { hot:m.hot, batter:m.batter }),
          'the console and the machines disagree about '+R.ruleText(s, rule.id));
      }
});

test('a rule that is right needs no morning to be lucky', ()=>{
  const r = R.run(RIGHT);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.rows.length, 4);
  assert.ok(r.rows.every(x=>x.ok));
});

/* ------------------------------------------------------ the walkthrough */
test('the console is walked one decision at a time, in the order he asks them', ()=>{
  const FIX = { loop:{loop:'repeat'}, stride:{stride:R.STRIDE_MAX}, times:{times:4},
                where:{where:'is'},
                cookJoin:{cookJoin:'and'}, cookHot:{cookHot:'is'},
                cookBatter:{cookBatter:'is'},
                tellJoin:{tellJoin:'or'}, tellHot:{tellHot:'is not'},
                tellBatter:{tellBatter:'is not'} };
  const seen=[];
  let s = R.broken();
  for(let i=0;i<20 && R.step(s); i++){
    const st = R.step(s);
    seen.push(st.id + ':' + st.hole);
    assert.ok(FIX[st.hole], 'the walkthrough points at a control nothing can set: '+st.hole);
    s = { ...s, ...FIX[st.hole] };
  }
  assert.deepStrictEqual(seen,
    ['loop:loop', 'far:stride', 'far:times', 'where:where',
     'cook:cookJoin', 'cook:cookHot',
     'tell:tellJoin', 'tell:tellHot', 'tell:tellBatter'],
    'the walkthrough has to reach every decision, in a sensible order');
  assert.strictEqual(R.step(s), null, 'and stop when there is nothing left to say');
  assert.strictEqual(R.run(s).ok, true, 'a program with no steps left has to work');

  /* AND THE SECOND RULE IS NEVER BLAMED FOR THE FIRST ONE'S MISTAKE. The
     `else if` is only reached when the `if` above it says no, so a wrong
     first rule makes the second one look wrong too — pointing a student
     at it then is pointing them at a symptom. */
  const cookBroken = seen.findIndex(x=>x.startsWith('cook:'));
  const tellFirst  = seen.findIndex(x=>x.startsWith('tell:'));
  assert.ok(cookBroken >= 0 && tellFirst > cookBroken,
    'the walkthrough reaches the `else if` before the `if` above it is right');
});

test('the walkthrough is read off the program, not counted', ()=>{
  assert.strictEqual(R.step({ ...RIGHT, loop:'forever' }).id, 'loop',
    'the loop is still wrong and still the step');
  assert.strictEqual(R.step({ ...RIGHT, cookJoin:'or' }).id, 'cook',
    'the ones before it are done; do not repeat them');
  assert.strictEqual(R.step({ ...RIGHT, tellJoin:'and' }).id, 'tell',
    'a wrong `else if` with everything above it right is the `else if`');
  assert.strictEqual(R.step({ ...RIGHT, cookJoin:'or', tellJoin:'and' }).id, 'cook',
    'the first rule comes first even when both are wrong');
  assert.strictEqual(R.step({ ...RIGHT, loop:'forever', tellJoin:'and' }).id, 'loop',
    'and undoing an early fix brings its step back');
});

test('every step names a control, a topic and a word', ()=>{
  const HOLES = new Set(['loop','times','stride','where',
                         'cookHot','cookBatter','cookJoin',
                         'tellHot','tellBatter','tellJoin']);
  const probes = [ R.broken(),
    { ...R.broken(), loop:'repeat' },
    { ...R.broken(), loop:'repeat', stride:10 },
    { ...RIGHT, where:'is not' },
    { ...RIGHT, cookJoin:'or' },
    { ...RIGHT, cookHot:'is not' },
    { ...RIGHT, cookBatter:'is not' },
    { ...RIGHT, tellJoin:'and' },
    { ...RIGHT, tellHot:'is' },
    { ...RIGHT, tellBatter:'is' } ];
  for(const p of probes){
    const st=R.step(p);
    assert.ok(st, 'every broken program has something to say about it');
    assert.ok(HOLES.has(st.hole), 'step points at an unknown control: '+st.hole);
    assert.ok(st.topic, 'a step with no topic cannot be labelled');
    /* VOCAB. A student meeting `and` for the first time in the middle of a
       repair gets the same sentence CODE's palette would have given them. */
    assert.ok(st.help && st.help.length>30, st.id+' has no vocabulary line');
    assert.ok(st.say && st.say.length>40, 'a step that says nothing is not a step');
  }
});

test('no step ever hands over the answer', ()=>{
  const far = R.step({ ...R.broken(), loop:'repeat', stride:10 });
  assert.ok(!/\b4\b/.test(far.say.replace(/40/g,'')),
    'the step tells them the number of repeats instead of the two facts');
  assert.match(far.say, /40/, 'it does give them how far the kitchen is');
  assert.match(far.say, /10/, 'and the longest stride his motors take');
  /* NEITHER RULE'S STEP MAY NAME THE OPERATOR TO USE. Both describe a
     morning and what he did on it; the student decides what that means.
     `and` may appear in the first one because the SPEC is "hot and
     batter" — what may not appear is an instruction to change one
     operator into the other. */
  for(const p of [{ ...RIGHT, cookJoin:'or' }, { ...RIGHT, tellJoin:'and' },
                  { ...RIGHT, tellHot:'is' }]){
    const st=R.step(p);
    assert.ok(!/\bchange\b[^.]*\b(and|or)\b/i.test(st.say),
      st.id+' dictates the operator instead of describing the morning');
    assert.ok(!/\bis not\b[^.]*\binstead\b/i.test(st.say),
      st.id+' hands over which way round the side goes');
  }
});

/* ------------------------------------------------- the reveal is not here
   IT USED TO BE. A working RUN handed back five commented-out lines to
   append to the console, and the reveal of who has been inside Ion was a
   footnote a student read in a panel they had already finished with. It
   is a scene now — house.js flashes the lights, puts him back on the
   floor and lets whoever wrote those lines say them out loud through him
   — and this file is a program and a trace again. */
test('a run carries no story, however well the program works', ()=>{
  for(const s of [R.broken(), { ...RIGHT, cookJoin:'or' }, RIGHT]){
    const r = R.run(s);
    assert.ok(!('note' in r), 'run() still hands the console something to reveal');
  }
  assert.strictEqual(R.NOTE, undefined, 'routine.js still exports the note');
  /* And the console must not have kept a place to put one. */
  const fix = read('public/ionfix.js');
  assert.ok(!/r\.note|className='note'/.test(fix),
    'ionfix.js still draws the note the run no longer hands it');
});

test('nothing a player can click breaks it', ()=>{
  for(const junk of [undefined, null, {}, {loop:7,times:'x',stride:-9,where:0,cookJoin:null},
                     {...RIGHT, times:1e9, stride:1e9}]){
    const r = R.run(junk);
    assert.ok(Array.isArray(r.trace) && r.trace.length);
    assert.strictEqual(typeof r.ok, 'boolean');
    const st = R.step(junk);
    assert.ok(st===null || typeof st.say==='string');
  }
  const big = R.tidy({ ...RIGHT, times:1e9, stride:1e9 });
  assert.strictEqual(big.stride, R.STRIDE_MAX);
  assert.strictEqual(big.times, R.REPEAT_MAX);
  /* An unknown rule is the first one rather than a crash: `fires(s,m)`
     with no third argument is how the fallback evaluator is reached. */
  assert.strictEqual(R.fires(RIGHT, R.MORNINGS[0]), R.fires(RIGHT, R.MORNINGS[0], 'cook'));
  assert.strictEqual(R.fires(RIGHT, R.MORNINGS[0], 'nonsense'),
                     R.fires(RIGHT, R.MORNINGS[0], 'cook'));
});

test('the trace is what the console draws, and every line is labelled', ()=>{
  const kinds = new Set();
  for(const s of [R.broken(), RIGHT, { ...RIGHT, cookJoin:'or' },
                  { ...RIGHT, where:'is not' }, { ...RIGHT, tellJoin:'and' }])
    R.run(s).trace.forEach(l=>kinds.add(l.kind));
  for(const k of kinds)
    assert.ok(['hat','loop','in','if','do','good','bad'].includes(k), 'unknown trace kind: '+k);
  /* BOTH RULES ARE PRINTED, in the order he asks them, even when the first
     one already took every morning — the shape is what is being taught. */
  const text = R.run(RIGHT).trace.map(l=>l.text).join('\n');
  assert.match(text, /\nif < pan is hot > and < there is batter >/);
  assert.match(text, /\nelse if < pan is not hot > or < there is not batter >/);
});

/* ------------------------------------------------------------ the console
   The panel is drawn by hand, so the controls it draws and the controls
   routine.js rings are two lists that can drift. These are the checks
   that fail when they do. */
test('the console draws a control for every decision, and rings the right one', ()=>{
  const fix = read('public/ionfix.js');
  for(const id of ['ifloop','iftimes','ifstride','ifwhere'])
    assert.ok(fix.includes(`id="${id}"`) || fix.includes(`id="${id}"`),
      'the console draws no '+id);
  /* The six rule controls are emitted from one template over RULES, which
     is what stops `iftellbatter` being wired to the cook rule's side. */
  assert.match(fix, /id="if\$\{which\}hot"/, 'the rule sides are not drawn from RULES');
  assert.match(fix, /id="if\$\{which\}join"/, 'the joins are not drawn from RULES');
  assert.match(fix, /R\(\)\.RULES\.forEach/, 'the handlers are typed out rather than built');
  /* AND THE else-if IS ONE BLOCK. Two stacked `if`s would say both
     questions are always asked, which is the mistake the step exists to
     correct. */
  assert.match(fix, /say\('else if'\)/, 'the second rule is not drawn as an `else if`');
  assert.ok((fix.match(/blk-head mid/g)||[]).length >= 3,
    'the if / else-if / else block does not have three bars');
});
