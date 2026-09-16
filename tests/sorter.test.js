/* THE MECHANIC'S BELT — the conditionals lesson, with no screen attached.

   Everything here that matters is a claim about ORDER. A ladder is not a
   set of rules, it is a sequence of them, and the difference only ever
   shows up on an input that satisfies two lines at once. A belt that
   never carries such a part cannot tell a student which order they have
   picked — which is the same argument preflight.js makes about trying
   FUEL at exactly 20, and it cannot be seen by playing the mission,
   because a wrong ladder that happens to agree with the belt looks
   exactly like a right one. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../public/sorter.js');
const K = require('../public/logic.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* Every order the branches of a job could be put in. The `else` is pinned
   to the bottom by move(), so it never joins the shuffle. */
function orders(job){
  const isElse = i => job.branches[i].kind==='else';
  const body=job.branches.map((_,i)=>i).filter(i=>!isElse(i));
  const tail=job.branches.map((_,i)=>i).filter(isElse);
  const out=[];
  (function rec(left, acc){
    if(!left.length){ out.push(acc.concat(tail)); return; }
    left.forEach((v,i)=>rec(left.slice(0,i).concat(left.slice(i+1)), acc.concat([v])));
  })(body, []);
  return out;
}
/* Every combination of chips a job's blanks could hold. */
function fills(job){
  const hs=S.holes(job);
  if(!hs.length) return [{}];
  const out=[];
  (function rec(i, acc){
    if(i===hs.length){ out.push(Object.assign({}, acc)); return; }
    for(const c of hs[i].choices){ acc[hs[i].slot]=c; rec(i+1, acc); }
    delete acc[hs[i].slot];
  })(0, {});
  return out;
}

test('every job can be solved, and the belt is what says so', ()=>{
  for(const job of S.JOBS){
    let wins=0;
    for(const order of orders(job))
      for(const fill of fills(job))
        if(S.done(job, { order, fill })) wins++;
    assert.ok(wins>0, `${job.id} cannot be solved at all`);
  }
});

test('the belt tells a right ladder from a wrong one', ()=>{
  /* THE POINT OF CHOOSING THE PARTS. If most arrangements satisfy the
     belt then the belt is not testing anything — a student could fill it
     in at random and be told they were right.

     MEASURED ONLY WHERE THERE IS SOMETHING TO GET WRONG. Job one has no
     blanks and three movable lines, so there are six arrangements and
     three of them are genuinely correct ladders — B above C is as valid
     as C above B when nothing on the belt can tell them apart. Half of
     six passing is not a weak test, it is a small space; the claim worth
     making about that job is about SHADOWING, and it is made below. */
  for(const job of S.JOBS){
    if(!S.holes(job).length) continue;
    let wins=0, total=0;
    for(const order of orders(job))
      for(const fill of fills(job)){ total++; if(S.done(job, { order, fill })) wins++; }
    assert.ok(wins/total < 0.05,
      `${job.id}: ${wins} of ${total} arrangements pass — the belt barely discriminates`);
  }
});

test('putting the general line above the specific one always fails', ()=>{
  /* THE TRAP, AS A PROPERTY RATHER THAN AS ONE EXAMPLE. `heat > 900` is
     a subset of `heat > 400`, so any ladder with the 400 line above the
     900 line can never scrap anything — and the belt has to catch every
     such arrangement, not just the one the job happens to ship in. */
  const job=S.jobOf('order');
  const at = pred => job.branches.findIndex(pred);
  const i400=at(b=>b.cond && b.cond.k==='cmp' && b.cond.n===400);
  const i900=at(b=>b.cond && b.cond.k==='cmp' && b.cond.n===900);
  let checked=0;
  for(const order of orders(job)){
    const body=order.filter(i=>job.branches[i].kind!=='else');
    if(body.indexOf(i400) > body.indexOf(i900)) continue;   // specific first: fine
    checked++;
    assert.strictEqual(S.done(job, { order, fill:{} }), false,
      'a ladder with heat > 400 above heat > 900 passed the belt');
    const d=S.dead(job, { order, fill:{} });
    assert.ok(d && /900/.test(d.text),
      'the shadowed 900 line is not named when it is above nothing that can reach it');
  }
  assert.ok(checked>0, 'no trapped arrangement was examined');
});

test('order decides the answer, with every condition left alone', ()=>{
  /* THE WHOLE LESSON, as a property. Job one has no blanks in it: every
     condition is written and correct, and the only thing a student can
     change is the sequence. If some orders pass and others fail, then
     order carries meaning — which is the thing being taught, and it is
     not true of a set of rules, only of a ladder. */
  const job=S.jobOf('order');
  assert.strictEqual(S.holes(job).length, 0, 'job one has blanks in it: it is not about order alone');
  const results=orders(job).map(order=>S.done(job, { order, fill:{} }));
  assert.ok(results.some(Boolean), 'no order of job one works');
  assert.ok(results.some(r=>!r), 'every order of job one works: order means nothing');
  /* And the one it ships in is a wrong one, or the first thing a student
     sees is a finished exercise. */
  assert.strictEqual(S.done(job, S.blank(job)), false,
    'job one arrives already solved');
});

test('a line nothing can reach is named, and only when it is the fault', ()=>{
  /* SHADOWING IS INVISIBLE. `heat > 900` under `heat > 400` is spelled
     correctly, reads correctly, and can never once be true by the time
     anything gets to it. This is the only thing the console volunteers.

     AND IT IS NOT "never evaluated". The 900 line is looked at by every
     cool part on the belt and found false; counting branches the walker
     skipped finds nothing, which is exactly what the first version of
     dead() did. The test is that it never RUNS although its condition is
     true of something. */
  const job=S.jobOf('order');
  const byAction = a => job.branches.findIndex(b=>b.action===a && b.cond
                          && b.cond.k==='cmp' && b.cond.n===900);
  const i900=byAction('SCRAP');
  const i400=job.branches.findIndex(b=>b.cond && b.cond.k==='cmp' && b.cond.n===400);
  const iCrack=job.branches.findIndex(b=>b.cond && b.cond.k==='var');
  const iElse=job.branches.findIndex(b=>b.kind==='else');

  const trap={ order:[iCrack, i400, i900, iElse], fill:{} };
  const d=S.dead(job, trap);
  assert.ok(d, 'the general line above the specific one is not reported');
  assert.match(d.text, /900/, `reported the wrong line: ${d.text}`);
  /* The walker DID evaluate it — proving the report is not just counting
     skipped branches. */
  const rs=S.rows(job, trap);
  const looked=rs.some(r=>(r.trace||[]).some(tr=>tr.i===2 && tr.tested));
  assert.ok(looked, 'the shadowed line is never even evaluated: the test is not testing shadowing');

  /* SILENT WHEN THE LADDER IS RIGHT. A correct ladder must never be told
     off, or the sentence means nothing. */
  const good={ order:[iCrack, i900, i400, iElse], fill:{} };
  assert.strictEqual(S.done(job, good), true, 'the intended order does not pass');
  assert.strictEqual(S.dead(job, good), null, 'a correct ladder is told a line is dead');
});

test('an unfinished ladder answers nothing, and is never counted wrong', ()=>{
  /* A blank is not a mistake. Left to itself the walker treats an empty
     condition as not-true, so every part falls through to the `else` and
     the belt fills with confident answers — half of them red — before the
     student has touched anything. */
  for(const job of S.JOBS){
    if(!S.holes(job).length) continue;
    const rs=S.rows(job, S.blank(job));
    assert.ok(rs.every(r=>r.blank && r.got===null),
      `${job.id} reports answers for a ladder with blanks still in it`);
    assert.strictEqual(S.done(job, S.blank(job)), false, `${job.id} passes while unfilled`);
    assert.strictEqual(S.dead(job, S.blank(job)), null,
      `${job.id} complains about a dead line before anything is filled in`);
  }
});

test('the belt tries the boundary of every number it asks for', ()=>{
  /* `>` and `>=` agree about every number in the world except one, so a
     belt that never carries a part at exactly the threshold cannot tell a
     student which of the two they picked. Read the thresholds out of the
     jobs themselves, so a number changed in one place fails here. */
  for(const job of S.JOBS){
    const want=new Set();
    const walk = n => { if(!n || typeof n!=='object') return;
      if(n.k==='cmp'){ if(typeof n.n==='number') want.add(n.n); return; }
      walk(n.a); walk(n.b); };
    job.branches.forEach(b=>walk(b.cond));
    for(const key in (job.pick||{})) (job.pick[key]||[]).forEach(v=>{
      if(typeof v==='number') want.add(v); });
    /* Only the ones a correct answer actually uses: the chip lists offer
       decoys, and a belt is not obliged to probe a number nobody wants. */
    /* ONLY WHERE THE STUDENT PICKS THE OPERATOR. Job one hands every
       condition over already written, so `>` against `>=` is not a
       question it asks and a part at exactly 400 would probe nothing. */
    const asksOp = S.holes(job).some(h=>h.kind==='op');
    if(!asksOp) continue;
    const used=[...want].filter(n=>job.belt.some(p=>p.heat===n));
    assert.ok(used.length>0, `${job.id}: the belt never carries a part at any threshold`);
    for(const n of used)
      assert.ok(job.belt.some(p=>p.heat===n) && job.belt.some(p=>p.heat===n-1 || p.heat===n+1),
        `${job.id}: nothing on the belt sits either side of ${n}`);
  }
});

test('there is one engine, and it is the one the district already uses', ()=>{
  /* A second evaluator in sorter.js would be a second answer that no test
     ever sees — the same argument preflight.js makes about shipfix.js.
     logic.js has the tree, the operators and the ladder walker. */
  const src = read('public/sorter.js');
  assert.ok(!/const OPS\s*=/.test(src), 'sorter.js keeps its own operator table');
  assert.ok(!/\(a,\s*b\)\s*=>\s*a[<>=!]/.test(src), 'sorter.js compares two numbers itself');
  assert.match(src, /K\.run\(rule, st\)/, 'sorter.js does not walk the ladder with KLOGIC');
  assert.match(src, /K\.value\(/, 'sorter.js evaluates a condition without KLOGIC');
  /* And the screen decides nothing either. */
  const fix = read('public/sortfix.js');
  assert.match(fix, /S\(\)\.done\(/, 'the panel decides for itself whether a job passed');
  assert.match(fix, /S\(\)\.dead\(/, 'the panel works out shadowing for itself');
  assert.match(fix, /S\(\)\.rows\(/, 'the panel runs the belt itself');
  assert.match(fix, /function close\(\)\{[\s\S]*?G\.running=true;/,
    'closing the panel leaves the world frozen');
});

test('the belt is what the Mechanic is paid with, and it gates the repair', ()=>{
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  /* HANDING ION OVER IS NO LONGER THE END. He takes Ion and asks for the
     work; the work is the lesson; finishing the lesson is what mends him
     and completes Mission 8. */
  const hand = planet.slice(planet.indexOf('function handOver()'),
                            planet.indexOf('function theBelt()'));
  assert.ok(!/PROGRESS\.complete\(/.test(hand.replace(/\/\*[\s\S]*?\*\//g,'')),
    'the handover still finishes the mission, so the work is optional');
  assert.match(bare, /theBelt\(\);/, 'nothing ever opens the belt');
  assert.match(bare, /SORTFIX\.open\(/, 'the belt panel is never opened');
  const belt = planet.slice(planet.indexOf('function theBelt()'),
                            planet.indexOf('function mended()'));
  assert.match(belt, /PROGRESS\.set\(WORKED,1\)/, 'finishing the belt is not remembered');
  assert.match(belt, /mended\(\)/, 'finishing the belt does not mend Ion');
  const mend = planet.slice(planet.indexOf('function mended()'),
                            planet.indexOf('function finishIon()'));
  assert.match(mend, /SCENE\.play\(/, 'the repair is not a scene');
  assert.match(bare, /function finishIon\(\)\{[\s\S]{0,200}PROGRESS\.complete\('ion'\)/,
    'nothing completes Mission 8');
  /* AND SHUTTING THE PANEL MUST NOT STRAND ANYBODY. E at the Mechanic
     puts a student who closed it half way back on the belt. */
  assert.match(bare, /if\(!worked\(\)\)\{ theBelt\(\); return; \}/,
    'closing the belt panel locks the player out of the rest of the mission');
  /* The flag is under the mission's prefix, like every other one. */
  assert.match(planet, /const WORKED='ion_belt'/, 'the belt flag survives a restart');
  /* And both files are on the page. */
  const html = read('public/index.html');
  for(const f of ['sorter.js','sortfix.js'])
    assert.match(html, new RegExp(`<script src="${f}\\?v=\\d+"></script>`), f+' is not on the page');
});
