/* ION'S MORNING QUESTIONS — the first boolean lesson, with no screen.

   Two yes/no facts make exactly four mornings, so the table here is not a
   sample: it is every morning there is. A rule that is right on all four
   is right full stop, which is a stronger thing than any later lesson in
   this mission can say — the belt has to CHOOSE its parts, because its
   gauges are numbers, and choosing is weaker than covering.

   THIS USED TO BE A LADDER. One `if` about the kitchen and an
   if/else-if/else inside it, with a loop and a stride in front; the ORDER
   of the branches was half the lesson. The course teaches booleans and
   operators now, so the order is gone and what is left is a set of
   independent questions asked of the same morning.

   AND THERE USED TO BE TWO OF THEM, which was an example rather than a
   lesson: `and` once, De Morgan once, ninety seconds, done. Six is the
   whole of what two facts and a join can say, and it is the five minutes
   this room is supposed to be worth. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../public/routine.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

const V = ['is','is not'], J = ['and','or'];
/* The eight shapes one question can take. */
function everyShape(){
  const out=[];
  for(const hot of V) for(const batter of V) for(const join of J)
    out.push({ hot, batter, join });
  return out;
}
/* A whole state with every question set to the shape `pick` chooses. */
function state(pick){
  const s={};
  R.RULES.forEach(r=>{ const p=pick(r);
    s[r.hot]=p.hot; s[r.batter]=p.batter; s[r.join]=p.join; });
  return s;
}
const RIGHT = () => state(r=>R.solve(r));

test('there are four mornings, and they are all of them', ()=>{
  assert.strictEqual(R.MORNINGS.length, 4);
  const seen=new Set(R.MORNINGS.map(m=>`${m.hot}|${m.batter}`));
  assert.strictEqual(seen.size, 4, 'two of the mornings are the same morning');
});

test('six questions, and no two of them are the same question', ()=>{
  /* THE POINT OF SIX IS THAT THEY ARE SIX DIFFERENT SHAPES. Two rules
     that happen to be true on the same four mornings are one rule asked
     twice, and a student who solves the first gets the second free —
     which is exactly the ninety seconds this replaced. */
  assert.strictEqual(R.RULES.length, 6, 'the question list has changed size');
  const cols=new Map();
  for(const r of R.RULES){
    const col=R.MORNINGS.map(m=>r.want(m)?1:0).join('');
    assert.ok(!cols.has(col),
      `"${r.name}" is the same question as "${cols.get(col)}" — same column: ${col}`);
    cols.set(col, r.name);
    /* And neither always-yes nor always-no, which are not questions. */
    assert.ok(/0/.test(col) && /1/.test(col),
      `"${r.name}" answers the same on every morning`);
  }
});

test('every question has exactly one shape that answers it', ()=>{
  /* THE CONSOLE CAN ONLY SAY EIGHT THINGS — a fact or its opposite on
     each side, joined by `and` or `or`. A question with no shape cannot
     be finished and the walkthrough would ring controls for ever; a
     question with two has a second right answer the walkthrough will
     mark wrong. */
  for(const r of R.RULES){
    const fits=everyShape().filter(sh=>
      R.MORNINGS.every(m=>{
        const a = sh.hot==='is' ? m.hot : !m.hot;
        const b = sh.batter==='is' ? m.batter : !m.batter;
        return (sh.join==='and' ? (a&&b) : (a||b)) === !!r.want(m);
      }));
    assert.strictEqual(fits.length, 1,
      `"${r.name}" has ${fits.length} shapes that answer it, not one`);
    assert.deepStrictEqual(R.solve(r), fits[0],
      `solve() disagrees with the truth table about "${r.name}"`);
  }
});

test('what the player walks in on is wrong in every question', ()=>{
  /* A question that is already right is a question nobody reads. */
  const b=R.broken();
  for(const r of R.RULES)
    assert.ok(R.wrong(b, r.id), `"${r.name}" is already right when he is opened up`);
  assert.ok(!R.run(b).ok, 'the broken robot already makes pancakes');
});

test('the mistakes he is found with are mistakes somebody would make', ()=>{
  /* NOT RANDOM WRONGNESS. Each starting shape is one a student would
     actually write — a missing `not`, a copied line, the wrong join —
     because the value of the exercise is in recognising your own error,
     and a shape nobody would choose teaches nothing on the way past.

     Concretely: every start must differ from its answer in at least one
     place and at most all three, and the whole set must take real work —
     fourteen decisions, not six. */
  let clicks=0;
  for(const r of R.RULES){
    const need=R.solve(r), st=r.start;
    const off=(st.hot!==need.hot) + (st.batter!==need.batter) + (st.join!==need.join);
    assert.ok(off>=1, `"${r.name}" starts already correct`);
    clicks+=off;
  }
  assert.ok(clicks>=13,
    'the whole console is '+clicks+' decisions: that is not five minutes');
});

test('the walkthrough converges, and only ever rings a real control', ()=>{
  /* THE ONE THING A WALKTHROUGH MUST NOT DO is send somebody at a control
     that is already right, or at a control that does not exist — both
     look to a student like the game being broken, and the second is a
     silent no-op. */
  const ids=new Set();
  R.RULES.forEach(r=>{ ids.add(r.hot); ids.add(r.batter); ids.add(r.join); });
  let s=R.broken(), seen=[], guard=0;
  while(guard++ < 200){
    const st=R.step(s);
    if(!st) break;
    assert.ok(ids.has(st.hole), 'step rings "'+st.hole+'", which is not a control');
    const r=R.RULES.find(x=>x.id===st.id);
    assert.ok(r, 'step names a question that does not exist: '+st.id);
    assert.ok(R.wrong(s, r.id), 'the walkthrough is on "'+r.name+'", which is already right');
    const need=R.solve(r);
    const want = st.hole===r.join ? need.join : st.hole===r.hot ? need.hot : need.batter;
    assert.notStrictEqual(s[st.hole], want,
      'it rang '+st.hole+', which already holds the right value');
    s=Object.assign({}, s); s[st.hole]=want;
    seen.push(st.id);
  }
  assert.ok(guard<200, 'the walkthrough never finishes');
  assert.ok(R.run(s).ok, 'following every step to the end does not fix him');
  assert.strictEqual(R.step(s), null, 'he is right and the console still wants something');
  /* IN THE ORDER THEY ARE WRITTEN. The list is ordered as a lesson — and,
     then De Morgan, then or, then a lone not — and a walkthrough that
     jumps about undoes that. */
  const order=seen.filter((x,i)=>seen[i-1]!==x);
  assert.deepStrictEqual(order, R.RULES.map(r=>r.id),
    'the questions are not walked in the order they are written');
});

test('the join is asked for before the sides', ()=>{
  /* A student with `and` where `or` belongs will flip both sides trying
     to fix it and end up further away, having "corrected" two things that
     were right. So whenever the join is wrong, the join is what is
     ringed. */
  for(const r of R.RULES){
    const need=R.solve(r);
    const s=RIGHT();
    s[r.join] = need.join==='and' ? 'or' : 'and';     // only the join wrong
    const st=R.step(s);
    assert.ok(st, 'a wrong join is not noticed at all');
    assert.strictEqual(st.id, r.id);
    assert.strictEqual(st.hole, r.join,
      `"${r.name}" has the wrong join and the console rings ${st.hole}`);
  }
});

test('De Morgan is in here, and it is in here twice', ()=>{
  /* THE ONE THING THIS ROOM IS FOR. A question and its opposite cannot
     both be got by flipping one side: the sides flip AND the join
     changes, and a student who only flips sides gets a rule that is
     right on two mornings out of four. It is asked once with `and` going
     to `or` and once with `or` going to `and`, because doing it in one
     direction is a trick and doing it in both is a rule. */
  let pairs=0;
  for(const a of R.RULES) for(const b of R.RULES){
    if(a===b) continue;
    const opposite = R.MORNINGS.every(m => !!a.want(m) === !b.want(m));
    if(!opposite) continue;
    pairs++;
    const A=R.solve(a), B=R.solve(b);
    assert.notStrictEqual(A.join, B.join,
      `"${a.name}" and "${b.name}" are opposites with the same join`);
    assert.notStrictEqual(A.hot, B.hot);
    assert.notStrictEqual(A.batter, B.batter);
  }
  assert.ok(pairs>=4, 'there is no pair of opposite questions to learn it from');
});

test('the join always shows, and where it shows depends on the nots', ()=>{
  /* EVERY QUESTION MUST BE ABLE TO TELL `and` FROM `or`, or the join is
     guesswork and the student is right by luck. Flipping it has to change
     the answer on at least one morning.

     WHERE it changes is the more interesting half, and it caught this
     test out first: with both sides read the same way, the two mornings
     where exactly one thing is true are the discriminator — `and` wants
     both, `or` wants either, and those mornings have exactly one. But put
     a `not` on ONE side and the sides now disagree precisely on those
     mornings and agree on the other two, so the join stops mattering
     there and starts mattering on hot-and-batter and cold-and-empty
     instead. "Is the pan on for nothing" is the same answer with `and` or
     `or` on every half-morning there is. */
  const half=R.MORNINGS.filter(m=>m.hot!==m.batter);
  const both=R.MORNINGS.filter(m=>m.hot===m.batter);
  assert.strictEqual(half.length, 2);
  for(const r of R.RULES){
    const need=R.solve(r);
    const s=RIGHT();
    s[r.join]= need.join==='and' ? 'or' : 'and';
    const differsOn = rows => rows.some(m=>R.fires(R.tidy(s), m, r.id) !== r.want(m));
    assert.ok(differsOn(R.MORNINGS),
      `"${r.name}" answers the same whichever join it has: the join cannot be learned`);
    /* And it is the negation that decides which pair tells you. */
    const sameSense = (need.hot===need.batter);
    assert.ok(differsOn(sameSense ? half : both),
      `"${r.name}" does not come apart where its shape says it should`);
  }
});

test('every question uses logic.js rather than a second evaluator', ()=>{
  /* `and`, `or` and `not` have to mean here what they mean in every other
     machine in this game, or the lesson is about this panel. */
  const src=bare(read('public/routine.js'));
  assert.match(src, /K\.AND\(/, 'and is not logic.js’s and');
  assert.match(src, /K\.OR\(/,  'or is not logic.js’s or');
  assert.match(src, /K\.NOT\(/, 'not is not logic.js’s not');
  assert.match(src, /K\.value\(/, 'the answer is not evaluated by logic.js');
  /* And the hand-rolled fallback must agree with it exactly, on every
     shape and every morning — it only runs when logic.js failed to load,
     and a silently different answer is worse than none. */
  for(const sh of everyShape()) for(const m of R.MORNINGS){
    const a = sh.hot==='is' ? m.hot : !m.hot;
    const b = sh.batter==='is' ? m.batter : !m.batter;
    const byHand = sh.join==='and' ? (a&&b) : (a||b);
    const s=state(()=>sh);
    assert.strictEqual(R.fires(R.tidy(s), m, R.RULES[0].id), byHand,
      'logic.js and the fallback disagree on '+JSON.stringify(sh));
  }
});

test('there are no conditionals and no loops left in it', ()=>{
  /* The course was scoped to booleans and operators. A ladder in here is
     the lesson this file used to be. */
  const src=bare(read('public/routine.js'));
  assert.ok(!/\bK\.IF\b|\bifBlock\b|\bloopHead\b|\bK\.LADDER\b/.test(src),
    'a conditional has come back into the kitchen');
  const panel=bare(read('public/ionfix.js'));
  assert.ok(!/\bifBlock\b|\bloopHead\b|\brulesBlock\b/.test(panel),
    'the console still draws a ladder');
});

test('the words are counted, and the table is left to do its job', ()=>{
  /* Which morning is wrong and how many there are is what a table is FOR,
     and prose that describes one is prose competing with something better
     at the job. Five to nine words a sentence, the same budget
     preflight.js is written to. */
  for(const st of R.STEPS){
    for(const [what, text] of [['say', st.say], ['help', st.help]]){
      assert.ok(text, st.id+' has no '+what);
      const words=String(text).replace(/<[^>]+>/g,'').trim().split(/\s+/).length;
      assert.ok(words<=9, `${st.id}.${what} is ${words} words: "${text}"`);
    }
    /* AND NO STEP HANDS OVER THE ANSWER. "Use or" is not a lesson. */
    const all=(st.say+' '+st.help).toLowerCase();
    assert.ok(!/\b(pick|choose|use|set|click)\s+(<b>)?(and|or|is not)\b/.test(all),
      st.id+' tells the student which word to place: "'+st.say+' / '+st.help+'"');
  }
});

test('nothing a player can click breaks it', ()=>{
  /* Every shape of every question, through the evaluator, the table and
     the walkthrough: no throw, no undefined answer. */
  for(const sh of everyShape()){
    const s=state(()=>sh);
    const rows=R.mornings(s);
    assert.strictEqual(rows.length, 4);
    for(const row of rows) for(const r of R.RULES){
      assert.ok(row[r.id], 'no verdict for "'+r.name+'"');
      assert.strictEqual(typeof row[r.id].got, 'boolean');
      assert.strictEqual(typeof row[r.id].ok,  'boolean');
    }
    const out=R.run(s);
    assert.ok(Array.isArray(out.trace));
    assert.strictEqual(typeof out.ok, 'boolean');
    if(!out.ok) assert.ok(out.why && out.why.length>10, 'a failure with no reason');
    R.step(s);                                  // must not throw
  }
  /* and junk in the state is tidied rather than believed */
  const junk=R.tidy({ cookHot:'banana', cookJoin:'nor' });
  assert.strictEqual(junk.cookHot, 'is not');
  assert.strictEqual(junk.cookJoin, 'or');
});

test('the trace is what the console draws, and every line is labelled', ()=>{
  const out=R.run(R.broken());
  assert.ok(out.trace.length >= R.RULES.length + 4,
    'the trace does not print every question and every morning');
  for(const line of out.trace){
    assert.ok(typeof line.text==='string' && line.text.length,
      'a trace line with no text');
    assert.ok(['if','do','good','bad'].includes(line.kind),
      'a trace line kinded "'+line.kind+'", which the console cannot colour');
  }
  /* Every question is printed before any morning is judged. */
  const firstJudged=out.trace.findIndex(l=>l.kind==='good'||l.kind==='bad');
  const printed=out.trace.slice(0, firstJudged).filter(l=>l.kind==='if').length;
  assert.strictEqual(printed, R.RULES.length,
    'the questions are not all printed before the mornings are judged');
});

test('a run carries no story, however well the program works', ()=>{
  /* The trace is a machine's account of what it did. Praise belongs to
     the room around it, not to the log. */
  const out=R.run(RIGHT());
  assert.ok(out.ok, 'the right answer does not come out right');
  assert.strictEqual(out.why, null, 'a working program still has a complaint');
  const words=out.trace.map(l=>l.text).join(' ');
  assert.ok(!/well done|good job|great|nice work|congratulations/i.test(words),
    'the trace congratulates the player');
});
