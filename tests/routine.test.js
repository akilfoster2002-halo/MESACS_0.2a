/* ION'S MORNING ROUTINE — the five minutes of coding the whole scene is
   built around.

   This is the half that has no screen in it, tested the way logic.js is:
   if the interpreter is wrong then the console lies to a student about
   what their program did, which is worse than no lesson at all. */
const test = require('node:test');
const assert = require('node:assert');
const R = require('../public/routine.js');

const say = r => r.trace.map(l=>l.text).join(' | ');

test('what the player walks in on is genuinely broken', ()=>{
  const r = R.run(R.broken());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.stuck, true, 'the symptom is the forever loop');
  assert.match(say(r), /nothing after this ever runs/);
});

test('a forever loop never reaches the line after it', ()=>{
  /* THE WHOLE LESSON, and the reason Ion is lying on the floor repeating
     half a sentence. A forever loop is not wrong in itself — it is wrong
     when something comes after it. */
  const r = R.run({ stride:10, loop:'forever', times:4, test:'is' });
  assert.strictEqual(r.ok, false, 'everything else is right and it still cannot work');
  assert.strictEqual(r.reached, false);
  assert.ok(!/in the kitchen —/.test(say(r)), 'the `if` is never even asked');
});

test('a loop that is too short stops short, and says by how much', ()=>{
  const r = R.run({ stride:10, loop:'repeat', times:2, test:'is' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.dist, 20);
  assert.match(say(r), /stops 20 steps short/);
  assert.match(r.why, /20/, 'the diagnosis does the arithmetic with them');
});

test('an inverted if makes breakfast in the hallway', ()=>{
  /* He never got there, the condition asked whether he had NOT got there,
     so it fired — and he cooks in the corridor. A student who only reads
     the last line sees "makes breakfast" and has to work out why that is
     not a win, which is the point. */
  const r = R.run({ stride:0, loop:'repeat', times:4, test:'is not' });
  assert.strictEqual(r.reached, false);
  assert.strictEqual(r.fired, true, 'the wrong question got a yes');
  assert.strictEqual(r.ok, false, 'and breakfast in the hallway is not breakfast');
});

test('reaching the kitchen is not enough on its own', ()=>{
  const r = R.run({ stride:10, loop:'repeat', times:4, test:'is not' });
  assert.strictEqual(r.reached, true);
  assert.strictEqual(r.fired, false);
  assert.strictEqual(r.ok, false);
  assert.match(r.why, /asked the wrong question/);
});

test('there is more than one right answer', ()=>{
  /* NOT AN ANSWER KEY. 4x10 and 5x8 are both forty steps and both are
     correct programs; a checker that only took the first would be
     teaching a student to guess what the teacher wrote down. */
  for(const s of [{stride:10,times:4},{stride:8,times:5},{stride:10,times:6},{stride:5,times:8}]){
    const r = R.run({ ...s, loop:'repeat', test:'is' });
    assert.strictEqual(r.ok, true, JSON.stringify(s)+' walks '+(s.stride*s.times)+' steps and should count');
  }
});

test('the loop cannot be dodged', ()=>{
  /* Without a cap on the stride, `repeat 1 [move 40]` walks him there in
     one hop and the lesson about loops is one the student never attends.
     This is that constraint, as an assertion rather than as a hope. */
  assert.ok(R.STRIDE_MAX < R.KITCHEN,
    'one stride reaches the kitchen: the loop is decoration');
  const one = R.run({ stride:R.STRIDE_MAX, loop:'repeat', times:1, test:'is' });
  assert.strictEqual(one.ok, false, 'a single pass must not be able to finish it');
  const need = Math.ceil(R.KITCHEN / R.STRIDE_MAX);
  assert.ok(need >= 4, `only ${need} passes are needed; that is barely a loop`);
  assert.ok(need <= R.REPEAT_MAX, 'the answer has to be reachable with the dial provided');
});

test('nothing a player can type breaks it', ()=>{
  for(const junk of [undefined, null, {}, {stride:'x',times:'y',loop:7,test:0},
                     {stride:-5, times:-99}, {stride:1e9, times:1e9}]){
    const r = R.run(junk);
    assert.ok(Array.isArray(r.trace) && r.trace.length, 'still returns a readable trace');
    assert.strictEqual(typeof r.ok, 'boolean');
  }
  const big = R.tidy({ stride:1e9, times:1e9, loop:'repeat', test:'is' });
  assert.strictEqual(big.stride, R.STRIDE_MAX);
  assert.strictEqual(big.times, R.REPEAT_MAX);
});

test('the trace is what the console draws, and every line is labelled', ()=>{
  /* ionfix.js colours each line by its kind — the same colours blocks.js
     gives those categories — so a kind it has never heard of renders as
     unstyled text in the middle of the program. */
  const kinds = new Set();
  for(const s of [R.broken(), {stride:10,loop:'repeat',times:4,test:'is'},
                  {stride:2,loop:'repeat',times:2,test:'is not'}])
    R.run(s).trace.forEach(l=>kinds.add(l.kind));
  for(const k of kinds)
    assert.ok(['hat','loop','in','if','do','good','bad'].includes(k), 'unknown trace kind: '+k);
});

/* ------------------------------------------------------- the walkthrough */
test('the console is walked one fault at a time, in order', ()=>{
  const seen=[];
  let s = R.broken();
  for(let i=0;i<10 && R.step(s); i++){
    const st = R.step(s);
    seen.push(st.id);
    /* Fix whatever the step is about, the smallest way, and ask again. */
    if(st.id==='loop') s = { ...s, loop:'repeat' };
    else if(st.id==='far') s = { ...s, stride:R.STRIDE_MAX, times:4 };
    else if(st.id==='test') s = { ...s, test:'is' };
  }
  assert.deepStrictEqual(seen, ['loop','far','test'],
    'the walkthrough has to reach every fault, and the loop first');
  assert.strictEqual(R.step(s), null, 'and stop when there is nothing left to say');
  assert.strictEqual(R.run(s).ok, true, 'a program with no steps left has to actually work');
});

test('the walkthrough is read off the program, not counted', ()=>{
  /* Fix them out of order and the step on screen is whichever is still
     wrong — a student who works the next one out unprompted is never told
     to do the thing they have already done. */
  const early = R.step({ stride:10, loop:'forever', times:4, test:'is' });
  assert.strictEqual(early.id, 'loop', 'the loop is still wrong and still the step');
  const s2 = { stride:10, loop:'repeat', times:4, test:'is not' };
  assert.strictEqual(R.step(s2).id, 'test', 'the first two are done; do not repeat them');
  /* And undoing a fix brings its step back rather than stranding anybody. */
  assert.strictEqual(R.step({ ...s2, loop:'forever' }).id, 'loop');
});

test('each step points at a block that is on the screen', ()=>{
  const HOLES = new Set(['loop','times','stride','test']);
  const probes = [ R.broken(),
    { stride:0, loop:'repeat', times:1, test:'is not' },
    { stride:10, loop:'repeat', times:1, test:'is not' },
    { stride:10, loop:'repeat', times:4, test:'is not' } ];
  for(const p of probes){
    const st=R.step(p);
    assert.ok(st, 'every broken program has something to say about it');
    assert.ok(HOLES.has(st.hole), 'step points at an unknown hole: '+st.hole);
    assert.ok(st.say && st.say.length>40, 'a step that says nothing is not a step');
  }
  /* THE STRIDE ONE MOVES. Nought steps is a different mistake from too few
     passes, and the ring has to be on the number that is wrong. */
  assert.strictEqual(R.step({stride:0,  loop:'repeat', times:4, test:'is'}).hole, 'stride');
  assert.strictEqual(R.step({stride:10, loop:'repeat', times:1, test:'is'}).hole, 'times');
});

test('no step ever hands over the answer', ()=>{
  /* "Change forever to repeat" names a block. "Put 4 in it" is the
     arithmetic, and the arithmetic is the part worth doing. */
  const far = R.step({ stride:10, loop:'repeat', times:1, test:'is not' });
  assert.ok(!/\b4\b/.test(far.say.replace(/40/g,'')),
    'the step tells them the number of repeats instead of the two facts');
  assert.match(far.say, /40/, 'it does give them how far the kitchen is');
  assert.match(far.say, /10/, 'and the longest stride his motors take');
});
