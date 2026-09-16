/* ION'S MORNING ROUTINE — the assessment, with no screen attached.

   Four ideas and six decisions. If the interpreter is wrong then the
   console lies to a student about what their program did, which is worse
   than no lesson at all — so this is tested the way logic.js is, under
   Node, against the same evaluator the machines in this game think with. */
const test = require('node:test');
const assert = require('node:assert');
const R = require('../public/routine.js');

const RIGHT = { loop:'repeat', times:4, stride:10, where:'is',
                hot:'is', batter:'is', join:'and' };

/* ---------------------------------------------------------- the faults */
test('what the player walks in on is broken in four different ways', ()=>{
  const r = R.run(R.broken());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.stuck, true, 'the symptom is the forever loop');
  const topics = new Set(R.STEPS.map(s=>s.topic));
  for(const want of ['LOOPS','MOTION + LOOPS','CONDITIONALS','BOOLEANS'])
    assert.ok([...topics].some(t=>t===want), 'nothing assesses '+want);
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

test('an inverted outer if makes breakfast in the hallway', ()=>{
  const r = R.run({ ...RIGHT, stride:0, where:'is not' });
  assert.strictEqual(r.reached, false);
  assert.strictEqual(r.fired, true, 'the wrong question got a yes');
  assert.strictEqual(r.ok, false, 'and breakfast in the hallway is not breakfast');
});

/* -------------------------------------------------------- the boolean */
test('exactly one of the eight rules survives four mornings', ()=>{
  /* THE WHOLE POINT OF A TRUTH TABLE. A rule tried on one morning proves
     nothing — `or` gets the hot-pan-and-batter morning right too. Run
     every rule the console can express against every morning there is,
     and precisely one may pass. */
  const pass=[];
  for(const join of ['and','or'])
    for(const hot of ['is','is not'])
      for(const batter of ['is','is not']){
        const s={ ...RIGHT, join, hot, batter };
        if(R.mornings(s).every(r=>r.ok)) pass.push(R.ruleText(s));
      }
  assert.deepStrictEqual(pass, ['hot and batter'],
    'more than one rule passes: the table is not discriminating');
});

test('or fires on the two half-mornings, which is how you can see it is or', ()=>{
  const rows = R.mornings({ ...RIGHT, join:'or' });
  const wrong = rows.filter(r=>!r.ok);
  assert.strictEqual(wrong.length, 2);
  for(const r of wrong)
    assert.notStrictEqual(r.hot, r.batter, 'only the one-true mornings should differ');
});

test('the boolean uses logic.js rather than a second evaluator', ()=>{
  const K = require('../public/logic.js');
  for(const join of ['and','or'])
    for(const hot of ['is','is not'])
      for(const batter of ['is','is not'])
        for(const m of R.MORNINGS){
          const s={ ...RIGHT, join, hot, batter };
          const mine = R.fires(s, m);
          const leaf = (n,sense)=> sense==='is' ? K.VAR(n) : K.NOT(K.VAR(n));
          const t = join==='and' ? K.AND(leaf('hot',hot), leaf('batter',batter))
                                 : K.OR (leaf('hot',hot), leaf('batter',batter));
          assert.strictEqual(mine, !!K.value(t, { hot:m.hot, batter:m.batter }),
            'the console and the machines disagree about '+R.ruleText(s));
        }
});

test('a rule that is right needs no morning to be lucky', ()=>{
  const r = R.run(RIGHT);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.rows.length, 4);
  assert.ok(r.rows.every(x=>x.ok));
});

/* ------------------------------------------------------ the walkthrough */
test('the console is walked one fault at a time, through all four ideas', ()=>{
  const seen=[];
  let s = R.broken();
  for(let i=0;i<12 && R.step(s); i++){
    const st = R.step(s);
    seen.push(st.id + ':' + st.hole);
    if(st.id==='loop')       s = { ...s, loop:'repeat' };
    else if(st.id==='far')   s = st.hole==='stride' ? { ...s, stride:R.STRIDE_MAX }
                                                    : { ...s, times:4 };
    else if(st.id==='where') s = { ...s, where:'is' };
    else if(st.id==='bool')  s = st.hole==='join' ? { ...s, join:'and' }
                                : st.hole==='hot' ? { ...s, hot:'is' }
                                                  : { ...s, batter:'is' };
  }
  assert.deepStrictEqual(seen,
    ['loop:loop', 'far:stride', 'far:times', 'where:where', 'bool:join', 'bool:hot'],
    'the walkthrough has to reach every decision, in a sensible order');
  assert.strictEqual(R.step(s), null, 'and stop when there is nothing left to say');
  assert.strictEqual(R.run(s).ok, true, 'a program with no steps left has to work');
});

test('the walkthrough is read off the program, not counted', ()=>{
  assert.strictEqual(R.step({ ...RIGHT, loop:'forever' }).id, 'loop',
    'the loop is still wrong and still the step');
  assert.strictEqual(R.step({ ...RIGHT, join:'or' }).id, 'bool',
    'the first four are done; do not repeat them');
  assert.strictEqual(R.step({ ...RIGHT, loop:'forever', join:'or' }).id, 'loop',
    'and undoing an early fix brings its step back');
});

test('every step names a control, a topic and a word', ()=>{
  const HOLES = new Set(['loop','times','stride','where','hot','batter','join']);
  const probes = [ R.broken(),
    { ...R.broken(), loop:'repeat' },
    { ...R.broken(), loop:'repeat', stride:10 },
    { ...RIGHT, where:'is not' },
    { ...RIGHT, join:'or' },
    { ...RIGHT, hot:'is not' } ];
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
  const bool = R.step({ ...RIGHT, join:'or' });
  assert.ok(!/\bchange\b.*\bor\b.*\band\b/i.test(bool.say),
    'the boolean step should describe the morning, not dictate the operator');
});

/* ------------------------------------------------------------- the note */
test('the note only turns up once the program works, and is not a fault', ()=>{
  assert.strictEqual(R.run(R.broken()).note, undefined,
    'a broken run must not leak it');
  assert.strictEqual(R.run({ ...RIGHT, join:'or' }).note, null,
    'and neither must a run that is nearly right');
  const r = R.run(RIGHT);
  assert.ok(r.note && r.note.lines.length, 'a working program reveals it');
  /* It is commented out: it has never run, which is why nothing in the
     trace was ever wrong because of it. */
  for(const l of r.note.lines)
    assert.match(l, /^#/, 'a line of the note is not commented out: '+l);
  assert.match(r.note.lines.join(' '), /tower/, 'it has to point somewhere');
});

test('nothing a player can click breaks it', ()=>{
  for(const junk of [undefined, null, {}, {loop:7,times:'x',stride:-9,where:0,join:null},
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
});

test('the trace is what the console draws, and every line is labelled', ()=>{
  const kinds = new Set();
  for(const s of [R.broken(), RIGHT, { ...RIGHT, join:'or' }, { ...RIGHT, where:'is not' }])
    R.run(s).trace.forEach(l=>kinds.add(l.kind));
  for(const k of kinds)
    assert.ok(['hat','loop','in','if','do','good','bad'].includes(k), 'unknown trace kind: '+k);
});
