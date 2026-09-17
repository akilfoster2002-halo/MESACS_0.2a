/* THE MECHANIC'S BELT — the boolean lesson, with no screen attached.

   Everything here that matters is a claim about a COMPOUND expression:
   that `and` and `or` come apart on this belt, that `not` over a group is
   not the same as `not` over one of its pieces, and that each job has
   exactly one answer. None of it can be seen by playing the mission — a
   wrong expression that happens to agree with the belt looks exactly like
   a right one — so it is counted here instead.

   NO LADDERS. This lesson used to be if/elif/else and the order of the
   branches was the whole of it. The course teaches booleans and operators
   now, so the belt asks one question per part and the question is an
   expression. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../public/sorter.js');
const K = require('../public/logic.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* Every combination of words a job's blanks could hold. */
function fills(job){
  const hs=S.holes(job);
  const out=[];
  (function rec(i, acc){
    if(i===hs.length){ out.push(Object.assign({}, acc)); return; }
    for(const c of hs[i].choices){ acc[hs[i].slot]=c; rec(i+1, acc); }
    delete acc[hs[i].slot];
  })(0, {});
  return out;
}
const solutions = job => fills(job).filter(f=>S.done(job, { fill:f }));

test('every job has exactly one answer, and the belt is what says so', ()=>{
  /* EXACTLY ONE, not at least one. A belt with two right answers cannot
     tell a student which of them they picked — the same argument
     preflight.js makes about trying FUEL at exactly 20, and the reason
     job two carries a part at 300: without it `heat < 200` and
     `heat < 400` agreed on every part and there were three. */
  for(const job of S.JOBS){
    const wins=solutions(job);
    assert.strictEqual(wins.length, 1,
      `${job.id} has ${wins.length} right answers, not 1: `
      + wins.map(f=>K.text(S.build(job,{fill:f}))).join(' | '));
  }
});

test('and and or come apart on every belt', ()=>{
  /* THE LESSON, AS A PROPERTY. If swapping the joining word still
     satisfied the belt then the job would not be teaching the difference
     between them — a student could pick either and be told they were
     right. Every job here has one joining blank, and the answer must stop
     working the moment it is flipped. */
  for(const job of S.JOBS){
    const only=solutions(job)[0];
    const joinSlot=S.holes(job).find(h=>h.kind==='join');
    assert.ok(joinSlot, `${job.id} has no joining word to get wrong`);
    const flipped=Object.assign({}, only,
      { [joinSlot.slot]: only[joinSlot.slot]==='and' ? 'or' : 'and' });
    assert.strictEqual(S.done(job, { fill:flipped }), false,
      `${job.id}: swapping ${only[joinSlot.slot]} for its opposite still passes`);
  }
});

test('not over a group is not the same as not over one piece', ()=>{
  /* DE MORGAN, WHICH IS THE THIRD JOB. "Leave the cracked ones, leave the
     hot ones" has an "and" in the English and needs an `or` inside the
     `not`. Writing `not (cracked and hot)` is what nearly everybody does
     first, and it only rejects parts where BOTH are wrong — so a cool
     cracked part and a hot whole one both come back onto the belt.

     The belt has to carry both of those or the mistake is invisible. */
  const job=S.jobOf('neither');
  assert.ok(job, 'the not-over-a-group job has been renamed');
  const right=solutions(job)[0];
  const joinSlot=S.holes(job).find(h=>h.kind==='join').slot;
  assert.strictEqual(right[joinSlot], 'or', 'the answer no longer needs `or` inside the `not`');

  const trap=Object.assign({}, right, { [joinSlot]:'and' });
  assert.strictEqual(S.done(job, { fill:trap }), false, 'the `and` grouping passes the belt');

  /* AND THE BELT CATCHES IT FOR THE RIGHT REASON. The two expressions
     differ exactly where one thing is wrong and the other is fine, so
     both such parts must be on the belt and both must be wrong under the
     trap. */
  const rows=S.rows(job, { fill:trap });
  const onlyCracked=rows.find(r=>r.part.cracked && r.part.heat<900);
  const onlyHot=rows.find(r=>!r.part.cracked && r.part.heat>=900);
  assert.ok(onlyCracked, 'the belt carries no part that is cracked but cool');
  assert.ok(onlyHot, 'the belt carries no part that is hot but whole');
  assert.strictEqual(onlyCracked.ok, false, 'the cracked-but-cool part does not expose the mistake');
  assert.strictEqual(onlyHot.ok, false, 'the hot-but-whole part does not expose the mistake');
});

test('the belt tries the boundary of every comparison it asks for', ()=>{
  /* `<` and `<=` agree about every number in the world except one, so a
     belt that never tries a part at exactly the threshold cannot tell a
     student which of the two they picked.

     ASSERTED AS THE THING THAT MATTERS, not as one way of arranging it.
     The first version of this looked for a part at n-1 or n+1 beside
     every threshold, which is A way to probe a boundary and not the only
     one — job two pins `load < 200` against `load <= 200` with a part at
     exactly 200 and nothing adjacent to it, and was failed for it. What
     has to be true is that swapping an operator for the one it differs
     from at the boundary BREAKS the belt. */
  for(const job of S.JOBS){
    const only=solutions(job)[0];
    const ops=S.holes(job).filter(h=>h.kind==='op');
    assert.ok(ops.length>0, `${job.id} asks for no comparisons at all`);
    const neighbour={ '<':'<=', '<=':'<', '>':'>=', '>=':'>' };
    for(const h of ops){
      const near=neighbour[only[h.slot]];
      if(!near) continue;                  // == and != have no such twin
      const off=Object.assign({}, only, { [h.slot]:near });
      assert.strictEqual(S.done(job, { fill:off }), false,
        `${job.id}: ${only[h.slot]} and ${near} both satisfy the belt — `
        + 'nothing on it sits on the boundary where they differ');
    }
  }
});

test('the blanks are collected in the order they are written', ()=>{
  /* holes() IS TWO THINGS AT ONCE: the list the panel draws its word
     choices from, and the order it arms the next blank in after a word is
     placed. So it has to run left to right across the expression exactly
     as the screen does.

     A joining word is written BETWEEN its two sides and used to be
     collected before either of them. Nothing looked wrong — every blank
     drew and every blank filled — but placing the operator armed the
     joining word in the middle of the expression and then jumped back to
     the number, so the word list changed under a student reading left to
     right. */
  const order = n => {           // the slots in the order exprHTML writes them
    const out=[];
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(typeof x.k==='string' && x.k[0]==='#'){ walk(x.a); out.push(x.k); walk(x.b); return; }
      if(x.k==='cmp'){
        for(const key of ['v','op','n'])
          if(typeof x[key]==='string' && x[key][0]==='#') out.push(x[key]);
        return;
      }
      walk(x.a); walk(x.b);
    })(n);
    return out;
  };
  for(const job of S.JOBS)
    assert.deepStrictEqual(S.holes(job).map(h=>h.slot), order(job.form),
      `${job.id}: the blanks are armed in a different order from the one they are written in`);
});

test('an unfinished expression answers nothing, and is never counted wrong', ()=>{
  /* A blank is not a mistake. Left to itself a missing piece reads as
     not-true, so every part would come out LEAVE and the belt would fill
     with confident red before the student had touched anything — a column
     of mistakes they have not made yet. */
  for(const job of S.JOBS){
    const rs=S.rows(job, S.blank());
    assert.ok(rs.every(r=>r.blank && r.got===null),
      `${job.id} reports answers for an expression with blanks in it`);
    assert.strictEqual(S.done(job, S.blank()), false, `${job.id} passes while unfilled`);
    assert.strictEqual(S.why(job, S.blank()), null,
      `${job.id} explains a mistake before anything is filled in`);
    assert.strictEqual(S.build(job, S.blank()), null,
      `${job.id} builds a usable expression out of empty blanks`);
  }
});

test('a wrong expression is shown worked, piece by piece', ()=>{
  /* THE ONE THING THE CONSOLE VOLUNTEERS. A compound expression is the
     first thing in this game whose answer is not visible in any one part
     of it, so the panel takes a part it gets wrong and writes the whole
     thing out again with each piece replaced by what it came out as.

     It must NOT name the wrong word: what to change is the student's to
     find, and a console that points at the answer has replaced the
     lesson with a hint. */
  const job=S.jobOf('neither');
  const right=solutions(job)[0];
  const joinSlot=S.holes(job).find(h=>h.kind==='join').slot;
  const w=S.why(job, { fill:Object.assign({}, right, { [joinSlot]:'and' }) });
  assert.ok(w, 'a wrong expression is not explained at all');
  assert.ok(w.parts.length>=3, 'the expression is not broken into pieces');
  /* Every leaf carries a value, and the joining words are shown as
     themselves — a piece with no value would be a gap in the working. */
  const leaves=w.parts.filter(p=>p.text && !p.open && !p.join);
  assert.ok(leaves.length>=2, 'the working has fewer than two pieces to compare');
  for(const leaf of leaves)
    assert.ok(typeof leaf.value==='boolean', `piece "${leaf.text}" is shown without a value`);
  assert.ok(w.parts.some(p=>p.join), 'the joining word is not shown');
  /* And it says what the part actually was, or the working is about
     nothing in particular. */
  assert.ok(w.part && typeof w.got==='boolean' && typeof w.want==='boolean',
    'the working does not say which part it is about or what was expected');

  /* SILENT WHEN IT IS RIGHT. */
  assert.strictEqual(S.why(job, { fill:right }), null,
    'a correct expression is explained as though it were wrong');
});

test('there are no conditionals anywhere in the belt', ()=>{
  /* THE COURSE TEACHES BOOLEANS AND OPERATORS. This lesson was an
     if/elif/else ladder and the order of the branches was the point; it
     is one expression now. A branch creeping back in would be a second
     idea in a lesson that is meant to have one. */
  const src = read('public/sorter.js');
  const fix = read('public/sortfix.js');
  for(const [name, code] of [['sorter.js',src],['sortfix.js',fix]]){
    const bare = code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    assert.ok(!/\bkind:\s*'(if|elif|else)'/.test(bare), `${name} still builds ladder branches`);
    assert.ok(!/branches/.test(bare), `${name} still talks about branches`);
    assert.ok(!/K\.run\(|KLOGIC\.run\(/.test(bare), `${name} still walks a ladder`);
  }
  /* The evaluator it DOES use is the boolean one. */
  assert.match(src, /K\.value\(/, 'sorter.js does not evaluate with KLOGIC');
  /* No second evaluator: logic.js owns the tree and the operators. */
  assert.ok(!/const OPS\s*=/.test(src), 'sorter.js keeps its own operator table');
  assert.ok(!/\(a,\s*b\)\s*=>\s*a[<>=!]/.test(src), 'sorter.js compares two numbers itself');
  /* And the screen decides nothing. */
  assert.match(fix, /S\(\)\.done\(/, 'the panel decides for itself whether a job passed');
  assert.match(fix, /S\(\)\.why\(/, 'the panel works out its own explanation');
  assert.match(fix, /S\(\)\.rows\(/, 'the panel runs the belt itself');
  assert.match(fix, /function close\(\)\{[\s\S]*?G\.running=true;/,
    'closing the panel leaves the world frozen');
});

test('every job uses more than one gauge, or it is the pre-flight again', ()=>{
  /* WHY THIS IS NOT shipfix.js WITH DIFFERENT NUMBERS. The pre-flight's
     `and` joins two facts about the same dial (psi over 8, psi under 40).
     Joining two DIFFERENT gauges is the step up, and it is the reason
     this lesson exists at all. */
  for(const job of S.JOBS){
    assert.ok(job.vars.length>=2, `${job.id} only ever looks at one gauge`);
    const seen=new Set();
    (function walk(n){
      if(!n || typeof n!=='object') return;
      if(n.k==='cmp'){ if(typeof n.v==='string' && n.v[0]!=='#') seen.add(n.v); return; }
      if(n.k==='var'){ seen.add(n.v); return; }
      walk(n.a); walk(n.b);
    })(job.form);
    assert.ok(seen.size>=2,
      `${job.id}'s expression only reads ${[...seen].join(',')||'nothing'}`);
  }
});

test('the belt is what the Mechanic is paid with, and it gates the repair', ()=>{
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  /* HANDING ION OVER IS NOT THE END. He takes Ion and asks for the work;
     the work is the lesson; finishing it is what mends him. */
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
  assert.match(bare, /function finishIon\(\)\{[\s\S]{0,200}PROGRESS\.complete\('ion'\)/,
    'nothing completes Mission 8');
  /* AND SHUTTING THE PANEL MUST NOT STRAND ANYBODY. A student who closes
     the belt half way through has undone nothing and must be able to walk
     back to the Mechanic and carry on — with the jobs they already passed
     still passed.

     THE RETURN VISIT IS A SCENE NOW, so what this checks is the guarantee
     rather than the line that used to provide it: every path through
     handOver() for somebody who has already handed Ion over ends up at
     the belt. It used to drop them straight into the panel with no word
     from the man standing next to them, which on a second visit is the
     only thing they see. */
  const back = bare.slice(bare.indexOf('if(handed()){'),
                          bare.indexOf('if(!window.SCENE){ return; }'));
  assert.ok(back.length>80, 'the already-handed-over branch has gone');
  assert.match(back, /if\(!window\.SCENE\)\{ theBelt\(\); return; \}/,
    'with no scene engine there is no way back to the belt at all');
  assert.match(back, /end:\(\)=>\{ if\(on\)\{ G\.running=true; theBelt\(\); \} \}/,
    'the return scene does not hand on to the belt, so the panel never opens');
  assert.match(back, /who:'The Mechanic'/,
    'he says nothing on a return visit: a stranger, a bench and a grid of blanks');
  assert.match(planet, /const WORKED='ion_belt'/, 'the belt flag survives a restart');
  const html = read('public/index.html');
  for(const f of ['sorter.js','sortfix.js'])
    assert.match(html, new RegExp(`<script src="${f}\\?v=\\d+"></script>`), f+' is not on the page');
});
