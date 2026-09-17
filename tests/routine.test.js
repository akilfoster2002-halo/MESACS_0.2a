/* ION'S MORNING QUESTIONS — the first boolean lesson, with no screen.

   Two yes/no facts make exactly four mornings, so the table here is not a
   sample: it is every morning there is. A rule that is right on all four
   is right full stop, which is a stronger thing than any later lesson in
   this mission can say — the belt has to CHOOSE its parts, because its
   gauges are numbers, and choosing is weaker than covering.

   THIS USED TO BE A LADDER. One `if` about the kitchen and an
   if/else-if/else inside it, with a loop and a stride in front; the ORDER
   of the branches was half the lesson. The course teaches booleans and
   operators now, so the order is gone and what is left is two independent
   questions asked of the same morning. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../public/routine.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

const V = ['is','is not'], J = ['and','or'];
/* Every pair of questions this console can express: sixty-four in all. */
function everyPair(){
  const out=[];
  for(const a of V) for(const b of V) for(const c of J)
    for(const d of V) for(const e of V) for(const f of J)
      out.push({ cookHot:a, cookBatter:b, cookJoin:c,
                 tellHot:d, tellBatter:e, tellJoin:f });
  return out;
}
const RIGHT = { cookHot:'is',     cookBatter:'is',     cookJoin:'and',
                tellHot:'is not', tellBatter:'is not', tellJoin:'or' };

test('there are four mornings, and they are all of them', ()=>{
  /* Two yes/no facts. Four rows is not a choice about how much to test,
     it is the complete truth table — and the reason this level can make a
     promise the later ones cannot. */
  assert.strictEqual(R.MORNINGS.length, 4, 'the table is no longer every morning');
  const seen=new Set(R.MORNINGS.map(m=>`${!!m.hot}/${!!m.batter}`));
  assert.strictEqual(seen.size, 4, 'two mornings are the same morning');
});

test('what the player walks in on is wrong, and wrong in both questions', ()=>{
  const b=R.broken();
  assert.strictEqual(R.run(b).ok, false, 'he opens already working');
  assert.ok(R.wrong(b,'cook'), 'the first question is already right');
  assert.ok(R.wrong(b,'tell'), 'the second question is already right');
  /* AND IT IS THE USEFUL KIND OF WRONG. The second question is the first
     one copied unflipped, which is what anybody gets by reading the line
     above and doing it again. */
  assert.strictEqual(b.tellHot, 'is', 'the second question is not the copied-line mistake');
  assert.strictEqual(b.tellBatter, 'is', 'the second question is not the copied-line mistake');
});

test('exactly one pair of questions survives four mornings', ()=>{
  /* THE WHOLE ASSESSMENT. A rule about `and` that is only ever tried on
     the morning it was written for is a rule nobody has tested — `or`
     gets that morning right too. Judged on all four, one pair stands. */
  const wins=everyPair().filter(s=>R.run(s).ok);
  assert.strictEqual(wins.length, 1,
    `${wins.length} pairs pass, not 1: `
    + wins.map(s=>R.ruleText(s,'cook')+' / '+R.ruleText(s,'tell')).join(' | '));
  assert.deepStrictEqual(R.tidy(wins[0]), R.tidy(RIGHT));
});

test('the second question is the first one turned inside out', ()=>{
  /* DE MORGAN, ARRIVED AT RATHER THAN NAMED. "Something is missing" has
     to be true on exactly the mornings "I can cook" is false, and the
     only way to write that with these controls is both sides flipped and
     the join swapped. Nobody is told; the table shows it. */
  assert.strictEqual(RIGHT.cookJoin, 'and');
  assert.strictEqual(RIGHT.tellJoin, 'or');
  assert.notStrictEqual(RIGHT.cookHot, RIGHT.tellHot);
  assert.notStrictEqual(RIGHT.cookBatter, RIGHT.tellBatter);
  /* And it is not a claim about the shape: on every morning the two
     answers must genuinely be opposites. */
  for(const m of R.MORNINGS)
    assert.notStrictEqual(R.fires(R.tidy(RIGHT), m, 'cook'),
                          R.fires(R.tidy(RIGHT), m, 'tell'),
      `both questions answer the same on ${m.hot?'hot':'cold'}/${m.batter?'batter':'none'}`);
});

test('and and or come apart on the half-mornings', ()=>{
  /* THE TWO MORNINGS WHERE EXACTLY ONE THING IS WRONG are the only place
     `and` and `or` disagree, which is why they are in the table and why
     the copied-line mistake is visible at all. */
  const half=R.MORNINGS.filter(m=>m.hot!==m.batter);
  assert.strictEqual(half.length, 2, 'the half-mornings have gone');
  for(const which of ['cook','tell']){
    const good=R.tidy(RIGHT);
    const flipped=Object.assign({}, good,
      { [which+'Join']: good[which+'Join']==='and' ? 'or' : 'and' });
    assert.ok(half.some(m=>R.fires(flipped,m,which)!==R.fires(good,m,which)),
      `swapping the ${which} join changes nothing on a half-morning`);
  }
});

test('a morning nothing answers is its own diagnosis', ()=>{
  /* `stands there` is the only outcome this program should never reach:
     every morning is either one he can cook or one where something is
     missing. A morning that reaches it had both questions say no. */
  const copied=R.broken();
  const rows=R.mornings(copied);
  assert.ok(rows.some(r=>r.got==='nothing' || r.got==='both'),
    'the broken pair never produces a morning nothing answers');
  const why=R.run(copied).why;
  assert.ok(why && /says nothing|both questions/.test(why),
    `the explanation does not name what went wrong: ${why}`);
});

test('both questions use logic.js rather than a second evaluator', ()=>{
  /* `and`, `or` and `not` have to mean here exactly what they mean in
     every other machine in this game. A second table of truth in this
     file would be a second answer no test ever sees. */
  const src=bare(read('public/routine.js'));
  for(const call of ['K\\.AND\\(','K\\.OR\\(','K\\.NOT\\(','K\\.value\\('])
    assert.ok(new RegExp(call).test(src),
      'routine.js does not build or evaluate its rules with logic.js');
  /* The hand-rolled branch is a fallback for logic.js failing to load and
     must agree with it everywhere, or a student on a bad connection gets
     a different lesson. */
  for(const s of everyPair()) for(const m of R.MORNINGS) for(const w of ['cook','tell']){
    const side = k => s[w+k]==='is' ? m[k==='Hot'?'hot':'batter'] : !m[k==='Hot'?'hot':'batter'];
    const t = s[w+'Join']==='and' ? (side('Hot') && side('Batter'))
                                  : (side('Hot') || side('Batter'));
    assert.strictEqual(R.fires(R.tidy(s), m, w), t, 'the fallback and logic.js disagree');
  }
});

test('there are no conditionals and no loops left in it', ()=>{
  /* THE COURSE TEACHES BOOLEANS AND OPERATORS. This lesson had a loop, a
     stride, an outer `if` about the kitchen and an if/else-if/else whose
     order was half the point. All of it went. */
  const src=bare(read('public/routine.js'));
  const fix=bare(read('public/ionfix.js'));
  for(const [name, code] of [['routine.js',src],['ionfix.js',fix]]){
    for(const gone of ['KITCHEN','STRIDE_MAX','REPEAT_MAX','stride','ifwhere','loopHead'])
      assert.ok(!new RegExp('\\b'+gone+'\\b').test(code),
        `${name} still carries ${gone} from the loops-and-conditionals lesson`);
  }
  /* And the state a student can build has six keys, all of them boolean. */
  const keys=Object.keys(R.tidy({})).sort();
  assert.deepStrictEqual(keys,
    ['cookBatter','cookHot','cookJoin','tellBatter','tellHot','tellJoin'],
    'the program still carries something that is not a boolean decision');
});

test('the console is walked one question at a time, in the order they are written', ()=>{
  /* Six decisions handed over at once are still six. The walk goes in the
     order the questions appear, not in the order they happen to be wrong,
     so fixing the second first does not move the first out of the way. */
  assert.deepStrictEqual(R.STEPS.map(s=>s.id), ['cook','tell'],
    'the walk is no longer the two questions');
  const b=R.broken();
  assert.strictEqual(R.step(b).id, 'cook', 'the walk does not start at the first question');
  const half=Object.assign({}, b, { cookHot:'is', cookBatter:'is', cookJoin:'and' });
  assert.strictEqual(R.step(half).id, 'tell', 'fixing the first question does not advance the walk');
  assert.strictEqual(R.step(RIGHT), null, 'a finished program still has a step on screen');
});

test('every step rings one of the two questions own controls', ()=>{
  /* A ring that lands on nothing, or on the other question's control,
     points a student at a block that is not wrong. */
  const fix=read('public/ionfix.js');
  for(const s of everyPair()){
    const st=R.step(s);
    if(!st) continue;
    assert.ok(st.hole, `the ${st.id} step rings nothing`);
    const r=R.RULES.find(x=>[x.hot,x.batter,x.join].includes(st.hole));
    assert.ok(r, `${st.hole} is not one of the two questions' controls`);
  }
  /* And the panel builds those ids off RULES rather than typing them out,
     so a ring cannot point at a control that is not drawn. */
  assert.match(fix, /id="if\$\{which\}hot"/, 'the console no longer builds its control ids from RULES');
  assert.match(fix, /on_\('if'\+r\.id\+'hot'/, 'the console no longer wires its controls from RULES');
});

test('no step ever hands over the answer', ()=>{
  /* A console that says "choose and" has replaced the lesson with a hint.
     Each step says what the question has to be true of and which morning
     it is getting wrong; what to press is the student's to work out. */
  for(const s of everyPair()){
    const st=R.step(s);
    if(!st) continue;
    const said=(st.say||'')+' '+(st.help||'');
    assert.ok(!/choose <b>and<\/b>|pick <b>and<\/b>|set it to/i.test(said),
      `the ${st.id} step tells the student what to press: ${said}`);
  }
});

test('nothing a player can click breaks it', ()=>{
  /* tidy() is the gate: every one of the sixty-four states this console
     can reach has to run and report, and nothing may throw. */
  for(const s of everyPair()){
    const r=R.run(s);
    assert.ok(Array.isArray(r.rows) && r.rows.length===4, 'a state produced no table');
    assert.strictEqual(typeof r.ok, 'boolean');
    if(!r.ok) assert.ok(r.why && r.why.length>10, 'a wrong program explains nothing');
    else assert.strictEqual(r.why, null, 'a right program explains itself anyway');
  }
  /* And rubbish in is not a crash. */
  for(const junk of [null, undefined, {}, {cookJoin:'xor', tellHot:42}])
    assert.strictEqual(R.run(junk).rows.length, 4, 'junk state broke the run');
});

test('the trace is what the console draws, and every line is labelled', ()=>{
  const r=R.run(R.broken());
  assert.ok(r.trace.length>=6, 'the trace is too short to be the program and the table');
  for(const line of r.trace){
    assert.ok(typeof line.text==='string' && line.text.length, 'a trace line with no text');
    assert.ok(['do','if','in','good','bad','loop'].includes(line.kind),
      `a trace line labelled ${line.kind}, which the console cannot colour`);
  }
  /* BOTH QUESTIONS ARE PRINTED BEFORE EITHER IS JUDGED, because the shape
     on screen is part of what is being taught. */
  const ifs=r.trace.filter(l=>l.kind==='if');
  assert.strictEqual(ifs.length, 2, 'the two questions are not both printed');
  assert.ok(r.trace.indexOf(ifs[1]) < r.trace.findIndex(l=>l.kind==='good'||l.kind==='bad'),
    'a morning is judged before both questions have been printed');
});

test('a run carries no story, however well the program works', ()=>{
  /* The reveal is a scene in house.js: the lights go, he goes down with
     them, and somebody else speaks through him. It used to be five
     commented-out lines appended to a panel the student had finished
     with. */
  const r=R.run(RIGHT);
  assert.strictEqual(r.ok, true);
  assert.ok(!('note' in r), 'the run carries a story note again');
  assert.ok(!/E\.|four in the morning/.test(JSON.stringify(r.trace)),
    'the reveal is back in the trace');
});
