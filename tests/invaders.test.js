/* THE SWARM.

   A loops mission is only a loops mission if the loop is the cheapest way
   through it, and that is a claim about NUMBERS — a budget, a shield, a
   regrow rate — rather than about how the stage reads. Every one of those
   numbers is easy to change by accident and impossible to check by
   playing, because a stage that has quietly become solvable without a loop
   still looks exactly like a stage that is not.

   So the useful tests here are the ones a teacher would ask:

     can it be done         the worked answer the mission SHOWS a student
                            has to be a program the mission's own palette
                            can express, inside the mission's own budget
     must it be done that way
                            the straight-line version has to be over
                            budget, or the loop is decoration
     does it go in          the station has to be in the hall, in the
                            unlock order, and on the page
     does it speak Spanish  because half this lab does

   The first two are what stop somebody "balancing" a shield number and
   turning the whole lesson off without noticing. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const P = require('../public/program.js');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const B = (id,type,extra) => Object.assign({id,type}, extra||{});
const names = steps => steps.map(s=>s.name);

/* invaders.js is a browser file that touches nothing at load — no THREE, no
   document, no G — so it can be read for its stage table under Node. */
function loadInvaders(){
  const ctx={ window:{} };
  vm.createContext(ctx);
  vm.runInContext(read('public/invaders.js'), ctx);
  return ctx.window.INVADERS;
}
const INV = loadInvaders();

/* Which palette op each line of a worked answer needs. This is the same
   mapping the console makes when a student types instead of dragging, and
   it is written out here rather than imported so that a rename in code.js
   that forgets a stage shows up as a failure instead of a silent pass. */
function opOf(line){
  const s=line.trim();
  if(!s || s==='end') return null;
  if(/^repeat until /.test(s)) return 'until';
  if(/^repeat \d+$/.test(s))   return 'repeat';
  if(s==='forever')            return 'forever';
  if(/^if /.test(s))           return 'ifc';
  return { 'spawn()':'spawn', 'nextRow()':'nextRow', 'across()':'across',
           'down()':'descend', 'fire()':'volley' }[s] || ('?'+s);
}
const linesOf = code => code.split('\n').map(l=>l.trim()).filter(Boolean);
const opsOf   = code => linesOf(code).map(opOf).filter(Boolean);

/* ------------------------------------------------------- the compiler */

test('forever is a loop with real jumps, not an unrolled tape', ()=>{
  const p=[B(1,'forever',{body:[B(2,'across')]})];
  const s=P.compile(p);
  assert.deepStrictEqual(names(s), ['__until','across','__loop']);
  assert.strictEqual(s[2].back, 0);        // the bottom goes back to the top
  assert.strictEqual(s[0].jump, 3);        // and the way out is past the end
});

test('a forever loop tests nothing, so nothing can end it', ()=>{
  /* This is the whole difference between forever and repeat-until, and it
     is carried by the condition being null rather than by a step name — a
     runner that already steps an until-loop gets forever for free, because
     no world answers yes to a question that was never asked. */
  const s=P.compile([B(1,'forever',{body:[B(2,'across')]})]);
  assert.strictEqual(s[0].cond, null);
  const until=P.compile([B(1,'until',{cond:'the shield is down',body:[B(2,'across')]})]);
  assert.strictEqual(until[0].cond, 'the shield is down');
});

test('a forever loop is not unrolled, however long it runs', ()=>{
  /* repeat 100 compiles to a hundred copies; forever must not, or a stage
     that is meant to run until the fortress falls would compile to a tape
     with an end on it. */
  const s=P.compile([B(1,'forever',{body:[B(2,'volley')]})]);
  assert.strictEqual(s.filter(x=>x.name==='volley').length, 1);
});

test('forever nests inside and around the other loops', ()=>{
  const p=[B(1,'forever',{body:[
    B(2,'across'),
    B(3,'ifc',{cond:'over the fortress', body:[B(4,'volley')]})]})];
  const s=P.compile(p);
  assert.deepStrictEqual(names(s), ['__until','across','__if','volley','__loop']);
  assert.strictEqual(s[2].jump, 4);   // a false test lands on the bottom of the loop
  assert.strictEqual(s[4].back, 0);   // which goes round again
});

/* ---------------------------------------------------------- the ladder */

test('every stage hands out the blocks its own worked answer needs', ()=>{
  for(const K of INV.STAGES){
    if(!K.learn || !K.learn.code) continue;
    for(const op of opsOf(K.learn.code)){
      assert.ok(!String(op).startsWith('?'),
        `stage "${K.id}" shows a line this test cannot read: ${op.slice(1)}`);
      assert.ok(K.pal.includes(op),
        `stage "${K.id}" shows ${op} in its answer but does not put it in the palette`);
    }
  }
});

test('every worked answer fits inside the budget it is shown under', ()=>{
  for(const K of INV.STAGES){
    if(!K.learn || !K.learn.code || !K.budget) continue;
    const n=opsOf(K.learn.code).length;
    assert.ok(n<=K.budget,
      `stage "${K.id}" shows a ${n}-block answer under a budget of ${K.budget}`);
  }
});

test('every sensor a stage tests for is a sensor that stage hands out', ()=>{
  const DEFAULT=['the shield is down','over the fortress','at the edge'];
  for(const K of INV.STAGES){
    if(!K.learn || !K.learn.code) continue;
    const have=K.conds||DEFAULT;
    for(const line of linesOf(K.learn.code)){
      const m=line.match(/^(?:repeat until|if) (.+)$/);
      if(!m) continue;
      assert.ok(have.includes(m[1]),
        `stage "${K.id}" tests for "${m[1]}", which is not in its conds`);
    }
  }
});

test('the first stage cannot be brute-forced — a rank costs more than the budget', ()=>{
  /* THE LESSON, AS ARITHMETIC. Eight spawns written out is eight blocks
     against a budget of two, so the loop is not the tidy answer here, it
     is the only answer. If somebody raises this budget to eight the stage
     still plays and still looks right, and has stopped teaching. */
  const K=INV.STAGES.find(s=>s.id==='rank');
  assert.ok(K, 'the rank stage is gone');
  assert.strictEqual(K.need.alive, 8);
  assert.ok(K.need.alive > K.budget,
    `writing ${K.need.alive} spawns out costs ${K.need.alive} blocks, and the budget is ` +
    `${K.budget} — raise the budget to ${K.need.alive} and the loop becomes optional`);
});

test('the nested-loop stage needs a second loop, not a bigger first one', ()=>{
  /* One rank is as wide as the board, so 32 invaders cannot be one rank —
     the only way to that number is more rows, and the only way to more
     rows inside the budget is a loop around the loop. */
  const K=INV.STAGES.find(s=>s.id==='grid');
  assert.ok(K.need.alive > 11,
    'a grid that fits in one row is not a grid, and does not need nesting');
  assert.ok(K.pal.includes('nextRow'), 'no way to start a second row');
  const depth=P.depthOf([B(1,'repeat',{count:4,body:[
    B(2,'repeat',{count:8,body:[B(3,'spawn')]}), B(4,'nextRow')]})]);
  assert.strictEqual(depth, 2, 'the worked answer for the grid is two loops deep');
});

/* What one volley is worth, exactly as doVolley() scores it: a bolt is one
   damage, plus up to two more for how much of the gap the swarm has closed.
   Written out here so that changing the formula in the game and not meaning
   to changes a number in this file too. */
const ROWS=9;
function volley(rows, cols, fortRow){
  let d=0;
  for(let r=0;r<rows;r++){
    const gap=Math.max(0, fortRow-r);
    d += cols * (1 + Math.min(2, Math.max(0, 4-gap)));
  }
  return d;
}

/* ------------------------------------------------ the board, as hits
   Enough of the engine to play a stage on paper, written out again rather
   than imported so that a change to the rules there and not here fails a
   test instead of passing one. A volley is ONE HIT if any invader is over
   the fortress; a volley at nothing rebuilds the shield where the stage
   says so; across() turns at the wall. Nothing grows back. */
const COLS=11, MAXREP=20;                 // code.js caps the counter at 20
function board(K){
  const c0 = (K.army && K.army.c0!==undefined) ? K.army.c0 : 1;
  const inv=[];
  if(K.army) for(let r=0;r<K.army.rows;r++) for(let c=0;c<K.army.cols;c++) inv.push({c:c0+c, r});
  const f={ c0:K.fort.c0, c1:K.fort.c1, shield:K.fort.shield, max:K.fort.shield, rebuilds:!!K.fort.missRebuilds };
  const W={ inv, f, dir:1, misses:0, beats:0,
    get broken(){ return f.shield<=0; },
    over(){ return inv.some(v=>v.c>=f.c0 && v.c<=f.c1); },
    fire(){
      W.beats++;
      if(!W.over()){ if(f.rebuilds && f.shield>0){ f.shield=f.max; W.misses++; } return; }
      f.shield=Math.max(0, f.shield-1);
    },
    across(){
      W.beats++;
      const lo=Math.min(...inv.map(v=>v.c)), hi=Math.max(...inv.map(v=>v.c));
      if((W.dir>0 && hi>=COLS-1) || (W.dir<0 && lo<=0)) W.dir=-W.dir;
      inv.forEach(v=>v.c+=W.dir);
    }
  };
  return W;
}
/* How many blocks a worked answer would be with every loop written out.
   A forever cannot be written out at all. */
function flat(code){
  const lines=linesOf(code);
  const walk=i=>{
    let n=0;
    while(i<lines.length){
      const l=lines[i];
      if(l==='end') return [n, i+1];
      const m=l.match(/^repeat (\d+)$/);
      if(m){ const [inner, j]=walk(i+1); n+=inner*(+m[1]); i=j; continue; }
      if(l==='forever') return [Infinity, lines.length];
      if(/^if /.test(l)){ const [inner, j]=walk(i+1); n+=inner+1; i=j; continue; }
      n+=1; i++;
    }
    return [n, i];
  };
  return walk(0)[0];
}

test('nothing grows back: a shield is a count of hits, and the panel says so', ()=>{
  for(const K of INV.STAGES){
    assert.ok(!('regrow' in K.fort), `stage "${K.id}" still has a regrow`);
    assert.ok(Number.isInteger(K.fort.shield) && K.fort.shield>=1, `stage "${K.id}" has no whole number of hits`);
  }
  const src=read('public/invaders.js');
  assert.match(src, /f\.shield=Math\.max\(0, f\.shield-1\)/, 'a volley does not take exactly one hit off');
  assert.match(src, /const SEG=Math\.max\(1, f\.shield\|0\)/, 'the fortress does not show one segment per hit');
  assert.match(src, /\$\{t\('hits left'\)\}/, 'the panel does not say how many hits are left');
});

test('the loop is forced by the budget: no worked answer fits written out', ()=>{
  /* THE LESSON, AS ARITHMETIC. With nothing growing back, the only thing
     that stops a student writing fire() four times is that four blocks do
     not fit in two — so on every stage the unrolled answer must be over
     budget, or the loop is decoration. */
  for(const K of INV.STAGES){
    const n=flat(K.learn.code);
    assert.ok(n > K.budget,
      `stage "${K.id}": the answer written out is ${n} blocks under a budget of ${K.budget} — the loop is optional`);
  }
});

test('a handed swarm cannot win on one volley', ()=>{
  for(const K of INV.STAGES){
    if(!K.army) continue;
    assert.ok(K.fort.shield > 1, `stage "${K.id}": a shield of ${K.fort.shield} falls to one fire()`);
  }
});

test('set the count: the count is the hits, and more than the budget', ()=>{
  const K=INV.STAGES.find(s=>s.id==='volley');
  const n=+K.learn.code.match(/repeat (\d+)/)[1];
  assert.strictEqual(n, K.fort.shield, 'the number on the loop should be exactly the hits the shield takes');
  assert.ok(n > K.budget, `${n} fire() blocks written out is ${n} against a budget of ${K.budget}`);
});

test('build, then fire: fire() inside the build loop is too early, and the answer is two loops in a row', ()=>{
  const K=INV.STAGES.find(s=>s.id==='then');
  assert.ok(K.practice, 'Build, Then Fire should be practice');
  assert.ok(K.fort.shield < K.goal.cols,
    'the shield must fall before the row is finished if fire() is inside the build loop — or the mistake is invisible');
  assert.deepStrictEqual(Array.from(loopDepths(K.learn.code)), [0,0], 'the answer is two loops, one after the other, not nested');
  const src=read('public/invaders.js');
  assert.match(src, /L\.pc<L\.steps\.length\s*\? t\('You fired too early/, 'firing before the outline is full is not told apart from a program that simply ended');
});

test('a column: nextRow() inside the loop; two rows: nextRow() between the loops', ()=>{
  /* The picture that makes placement visible: the same two blocks build a
     column with nextRow() inside the loop and rows with it between loops. */
  const col=INV.STAGES.find(s=>s.id==='column'), rows=INV.STAGES.find(s=>s.id==='ranks');
  assert.ok(col.walk && col.goal.cols===1 && col.goal.rows>1, 'A Column should be walked and tall');
  assert.match(col.learn.code, /^repeat \d+\n  spawn\(\)\n  nextRow\(\)\nend/, 'the column answer should have nextRow() inside the loop');
  assert.ok(rows.practice && rows.goal.rows===2, 'Two Rows should be practice with two rows');
  assert.match(rows.learn.code, /^repeat 8\n  spawn\(\)\nend\nnextRow\(\)\nrepeat 8/, 'the two-rows answer should have nextRow() between the loops');
  const src=read('public/invaders.js');
  assert.match(src, /which loop <b>nextRow\(\)<\/b> is in/, 'a wrong shape gets no sentence about where nextRow() is');
});

test('no number: the biggest repeat there is falls short, and forever does not', ()=>{
  for(const id of ['forever','past']){
    const K=INV.STAGES.find(s=>s.id===id);
    assert.ok(K.pal.includes('repeat'), `"${id}": the student has to be able to TRY the biggest repeat`);
    assert.ok(K.fort.shield > MAXREP, `"${id}": repeat ${MAXREP} { fire() } breaks a shield of ${K.fort.shield} — so forever is optional`);
    const W=board(K); let n=0; while(!W.broken && n<200){ W.fire(); n++; }
    assert.ok(W.broken && n<=40, `"${id}": forever takes ${n} volleys, which is a long time to watch the same thing`);
  }
});

test('the listener and its practice need the if: firing every pass rebuilds the shield at a wall', ()=>{
  for(const id of ['listen','over']){
    const K=INV.STAGES.find(s=>s.id===id);
    assert.ok(K.fort.missRebuilds, `"${id}": a volley at nothing has to cost something, or the if is decoration`);
    assert.strictEqual(K.conds[0], 'over the fortress', `"${id}": the if should come off the shelf already asking the right question`);
    const blind=board(K);
    assert.ok(!blind.over(), `"${id}": the swarm starts over the fortress, so an if ABOVE the loop would fire`);
    for(let i=0;i<80;i++){ blind.across(); blind.fire(); }
    assert.ok(!blind.broken, `"${id}": forever { across() fire() } wins without an if in it`);
    assert.ok(blind.misses>=3, `"${id}": only ${blind.misses} misses in eighty passes — the run is never told why it is losing`);
    const asks=board(K); let n=0;
    while(!asks.broken && n<80){ asks.across(); if(asks.over()) asks.fire(); n++; }
    assert.ok(asks.broken, `"${id}": the worked answer never breaks it`);
    assert.ok(asks.beats<=60, `"${id}": the worked answer takes ${asks.beats} beats`);
  }
});

test('a build stage is won only when the outline is filled', ()=>{
  /* A Column is three slots stacked, and spawn() spawn() spawn() fire() —
     three invaders side by side — is the same one hit to a shield of one.
     Only the outline tells those apart, so the breach has to ask it. */
  const src=read('public/invaders.js');
  assert.match(src, /if\(breached\)\{\s*if\(!goalFilled\(\)\)/, 'the win on a build stage does not check the outline');
  const K=INV.STAGES.find(s=>s.id==='column');
  assert.strictEqual(K.fort.shield, 1, 'a column stage is about the shape, not the hits');
});

test('every build stage draws the shape it is asking for, and the shape is the number', ()=>{
  /* "Build two ranks" is a sentence a student has to picture; an outline of
     the formation on the board is not. So every stage that starts with an
     empty board carries a goal shape — and that shape has to be exactly the
     count the stage needs to win, standing where the cursor will put it. */
  for(const K of INV.STAGES){
    const builds = K.pal.includes('spawn');
    if(!builds){ assert.ok(!K.goal, `stage "${K.id}" hands out an army and draws an outline too`); continue; }
    assert.ok(K.goal && K.goal.rows>0 && K.goal.cols>0, `build stage "${K.id}" draws no outline to fill`);
    assert.strictEqual(K.goal.rows*K.goal.cols, K.need.alive,
      `stage "${K.id}" outlines ${K.goal.rows*K.goal.cols} invaders and needs ${K.need.alive}`);
    assert.ok(1+K.goal.cols<=COLS, `stage "${K.id}" outlines a rank wider than the board`);
  }
});

/* Which lines of a worked answer are loops, and how deep each one sits
   inside other loops. The `if` is a container but not a loop, so it does
   not count — the listener nests an if in a forever and is still one loop
   deep. */
const LOOP=/^(repeat \d+|forever)$/;
function loopDepths(code){
  const out=[]; const stack=[];
  for(const line of linesOf(code)){
    if(line==='end'){ stack.pop(); continue; }
    const isLoop=LOOP.test(line);
    if(isLoop) out.push(stack.filter(Boolean).length);
    if(isLoop || /^if /.test(line)) stack.push(isLoop);
  }
  return out;
}

test('nothing nests a loop in a loop until the final challenge, and everything after it does', ()=>{
  /* NESTED LOOPS ARE THE FINAL CHALLENGE: walked once, then practised once.
     Getting into the inner loop and back out again is the hardest thing the
     console asks of anybody, and putting it second — where it used to be —
     was the whole of "the levels are too hard". */
  const S=Array.from(INV.STAGES);
  const at=S.findIndex(K=>K.id==='grid');
  assert.ok(at>=0, 'the nested-loop stage is gone');
  S.slice(0,at).forEach(K=>assert.ok(loopDepths(K.learn.code).every(d=>d===0),
    `stage "${K.id}" puts a loop inside a loop before the nested-loop stage`));
  S.slice(at).forEach(K=>assert.ok(loopDepths(K.learn.code).some(d=>d>0),
    `stage "${K.id}" comes after the nested-loop stage and does not nest`));
  assert.ok(S[at].walk && S[S.length-1].practice, 'nesting should be walked, then practised, and that is the end');
});

const CONTAINER=new Set(['repeat','forever','until','ifc']);
const loopsIn = code => Array.from(opsOf(code)).filter(op=>CONTAINER.has(op));
/* What a stage brings that no stage before it had: any block — a loop or a
   verb — or the first loop inside a loop. Every one of those is worth a
   walkthrough, and a verb is not exempt: "every invader fires once" on the
   shelf is not being shown. */
function introduces(K, seen){
  const fresh=Array.from(opsOf(K.learn.code)).filter((op,i,a)=>!seen.has(op) && a.indexOf(op)===i);
  const nests=loopDepths(K.learn.code).some(d=>d>0);
  return { fresh, nests: nests && !seen.has('nest') };
}

test('every new block is walked once, then practised before the next one arrives', ()=>{
  /* INTRODUCED, THEN PRACTISED. A walkthrough shows where a block goes;
     only writing it yourself shows that you know. So a stage that brings a
     new block is walked, and its walk rings that block; a stage that brings
     nothing new is practice (no coach, the answer behind the Hint button);
     and every walked stage but the last is followed by a practice stage
     that uses every loop it introduced and only blocks already shown.
     "You should never drop a new block into the flow without it having a
     walkthrough level." */
  const S=Array.from(INV.STAGES);
  const seen=new Set();
  S.forEach((K,i)=>{
    const { fresh, nests } = introduces(K, seen);
    const isNew = fresh.length>0 || nests;
    if(isNew){
      assert.ok(K.walk && !K.practice,
        `stage "${K.id}" introduces ${fresh.join('+')||'nesting'} and is not walked`);
      const rung=palSteps(K);
      fresh.forEach(op=>assert.ok(rung.includes(op),
        `stage "${K.id}" introduces ${op} but its walkthrough never rings it`));
      if(i<S.length-1){
        const next=S[i+1];
        assert.ok(next.practice && !next.walk,
          `stage "${next.id}" comes straight after "${K.id}" introduced ${fresh.join('+')||'nesting'} — it should be practice, not another walkthrough`);
        fresh.filter(op=>CONTAINER.has(op)).forEach(op=>assert.ok(loopsIn(next.learn.code).includes(op),
          `stage "${next.id}" is the practice for ${op} but its answer never uses it`));
        if(nests) assert.ok(loopDepths(next.learn.code).some(d=>d>0),
          `stage "${next.id}" is the practice for nesting but its answer does not nest`);
        else assert.ok(fresh.some(op=>opsOf(next.learn.code).includes(op)),
          `stage "${next.id}" practises nothing that "${K.id}" introduced`);
      }
    } else {
      assert.ok(K.practice && !K.walk,
        `stage "${K.id}" introduces nothing new, so it should be practice rather than walked`);
    }
    fresh.forEach(op=>seen.add(op)); if(nests) seen.add('nest');
  });
  assert.ok(S.some(K=>K.practice), 'there is no practice on the ladder at all');
});

test('a practice stage keeps its answer behind the hint button, and opens the console anyway', ()=>{
  /* The worked answer stays in the table for these tests to check, but a
     practice stage must not print it on the card — that is the console's
     hint:true, first line for a click and the rest for another. */
  for(const K of INV.STAGES){
    if(!K.practice) continue;
    assert.ok(K.learn && K.learn.code, `practice stage "${K.id}" has no worked answer to hint at`);
    assert.ok(!K.walk, `practice stage "${K.id}" still has a walkthrough`);
  }
  const src=read('public/invaders.js');
  assert.match(src, /K\.practice \? Object\.assign\(\{ hint:true \}, K\.learn\)/,
    'practice stages do not hand the console a hidden answer');
  /* and the coach from the stage before is gone: its strip lives in the
     console, which RUN closed, so it could not clear itself */
  const st=src.slice(src.indexOf('function start(n){'), src.indexOf('function start(n){')+8000);
  const stopAt=st.indexOf('COACH.stop()'), shelfAt=st.indexOf('CODE.setPalette(K.pal)');
  assert.ok(stopAt>=0, 'a new stage does not stop the last walkthrough, so a practice stage opens on its last step');
  assert.ok(stopAt<shelfAt, 'the old walkthrough is stopped AFTER the new shelf is set — stopping it re-applies the old shelf');
  assert.match(src, /if\(K\.practice\)\{[^}]*CODE\.show\(\)/,
    'a practice stage should open the console by itself, like a walked one');
});

test('the first two rungs are one loop round one block, and a fire()', ()=>{
  /* "Simple challenges that demonstrate loops": the walked rank is a loop
     round one verb and then the volley; its practice is a loop round one
     verb. One loop each, and nothing over three blocks. */
  INV.STAGES.slice(0,2).forEach(K=>{
    assert.ok(K.budget<=3, `stage "${K.id}" should be a three-block stage at most`);
    assert.strictEqual(loopsIn(K.learn.code).length, 1, `stage "${K.id}" should have exactly one loop`);
  });
  assert.deepStrictEqual(Array.from(opsOf(INV.STAGES[0].learn.code)), ['repeat','spawn','volley'],
    'the first stage is a rank, then fire()');
});

test('the golden rule is walked, with the if inside the forever', ()=>{
  const K=INV.STAGES.find(s=>s.id==='listen');
  assert.ok(K && K.walk, 'the listener should be a walked stage');
  const code=K.learn.code;
  const fi=code.indexOf('forever'), ii=code.indexOf('if ');
  assert.ok(fi>=0 && ii>fi,
    'the worked answer must put the if INSIDE the forever, not above it');
});

/* ------------------------------------------------------ the screen */

test('the film puts the HUD away and brings it back, and a repaint mid-film does not', ()=>{
  /* The captions run along the bottom and so does the [C] Code Console
     button; a film that leaves the HUD up writes its second line across
     the button. Space Explorer's film hides #hud for its ten seconds and
     restores what it hid; this one has to as well — and its own hud(),
     which un-hides #hud on every repaint, must hold off while it plays. */
  const src=read('public/invaders.js');
  const film=src.slice(src.indexOf('function startFilm('), src.indexOf('function filmTick('));
  assert.match(film, /\['#hud','#briefing'\]\.forEach/, 'the film does not put the HUD away');
  assert.match(film, /filmHid\.forEach\(sel=>\{[^}]*classList\.remove\('hidden'\)/, 'the film never brings the HUD back');
  assert.match(src, /if\(h && !film\) h\.classList\.remove\('hidden'\)/, 'hud() brings the HUD back in the middle of the film');
});

test('the bubble is for verdicts: no stage brief, hidden at the start, hidden under the console', ()=>{
  /* Every stage used to open with a paragraph in the bubble, and every word
     of it was already on screen — the numbers in the panel, the budget on
     the console, the task on the card. A teacher called it confusing and
     they were right. */
  for(const K of INV.STAGES) assert.ok(!K.brief, `stage "${K.id}" still carries a brief for the bubble`);
  const src=read('public/invaders.js');
  assert.ok(!/say\(t\(K\.brief\)\)/.test(src), 'a stage still says its brief into the bubble');
  assert.match(src, /bub\.innerHTML=''; bub\.classList\.add\('hidden'\)/, 'a stage does not open with the bubble put away');
  const css=read('public/index.html');
  assert.match(css, /body\.con-open #briefing\{display:none\}/, 'the bubble still shows under the open console');
  assert.match(css, /#briefing:empty\{display:none\}/, 'an empty bubble still draws');
  const code=read('public/code.js');
  assert.match(code, /document\.body\.classList\.add\('con-open'\)/, 'the console does not mark the page while it is open');
  assert.match(code, /document\.body\.classList\.remove\('con-open'\)/, 'the console does not unmark the page when it closes');
});

test('the briefing bubble sits clear of the code console button', ()=>{
  /* Both are bottom-centre. The bubble is two lines of 19px text in 12px
     of padding and a 3px border — about 80px — and the button is about
     50px tall, so the bubble\'s bottom must clear the button\'s top. */
  const css=read('public/index.html');
  const px=(sel)=>{ const m=css.match(new RegExp(sel.replace('.','\\.')+'\\{[^}]*?bottom:(\\d+)px')); assert.ok(m, 'no bottom for '+sel); return +m[1]; };
  const brief=px('#briefing'), btn=px('.codebtn'), health=px('#health');
  assert.ok(brief >= btn+56, `the briefing (bottom ${brief}px) sits on the code button (bottom ${btn}px, ~50px tall)`);
  assert.ok(btn >= health+40, `the code button (bottom ${btn}px) sits on the health bar (bottom ${health}px)`);
});

/* -------------------------------------------------- the walkthroughs
   Every stage here introduces a loop the one before it did not have, so
   every stage is walked the first time it opens. What makes a walkthrough
   go wrong is never the words — it is a step pointing at a button that is
   not there, or naming a block the stage does not hand out, or building
   something other than the answer the same stage prints in its guide. */

const ADD = /data-add="([A-Za-z]+)"/;   // nextRow is camelCase; [a-z]+ silently misses it
/* Array.from, and it is not decoration. invaders.js is evaluated inside a vm
   context, so the arrays it hands back carry THAT realm's Array.prototype —
   and deepStrictEqual compares prototypes, so a walk list and an identical
   list built here compare unequal while printing as the same two strings.
   Copying into this realm first is what makes the comparison mean what it
   reads as. */
const palSteps = K => Array.from(K.walk||[])
                           .map(s=>s.sel||'')
                           .map(sel=>(sel.match(ADD)||[])[1])
                           .filter(Boolean);

test('every walkthrough builds the very answer its own stage shows', ()=>{
  /* The guide card prints the target program and the coach walks you to it.
     If those two drift apart, a student is shown one thing and led to
     another — so the blocks the walk reaches for, in order, have to be the
     blocks the worked answer is made of, in order. */
  for(const K of INV.STAGES){
    if(!K.walk) continue;
    assert.deepStrictEqual(palSteps(K), opsOf(K.learn.code),
      `stage "${K.id}": the walkthrough and the worked answer are different programs`);
  }
});

test('a walkthrough only ever reaches for blocks the stage hands out', ()=>{
  for(const K of INV.STAGES){
    for(const op of palSteps(K))
      assert.ok(K.pal.includes(op),
        `stage "${K.id}" walks to "${op}", which is not in its palette`);
    /* THE SHELF IS NEVER NARROWED. Emptying it mid-walkthrough left a child
       looking at a blank BLOCKS column on a screen whose whole job is
       offering blocks, which reads as the game having broken. */
    for(const s of (K.walk||[]))
      assert.ok(!s.pal, `stage "${K.id}" still narrows the palette on a step`);
  }
});

test('a walkthrough gets inside every loop it opens', ()=>{
  /* TAKING A LOOP OFF THE SHELF DOES NOT PUT YOU IN IT. The next block lands
     under the loop rather than inside it, which is the commonest way a first
     program comes out wrong — and a walkthrough that skips the click is a
     walkthrough that builds the wrong program while telling you it is right.
     So: one "click the loop" step for every container the walk adds. */
  const CONTAINER=new Set(['repeat','forever','until','ifc']);
  for(const K of INV.STAGES){
    if(!K.walk) continue;
    const opened = palSteps(K).filter(op=>CONTAINER.has(op)).length;
    const entered = K.walk.filter(s=>/blk-head/.test(s.sel||'')).length;
    assert.ok(entered >= opened,
      `stage "${K.id}" opens ${opened} loop(s) but only steps into ${entered} — ` +
      `a block after the missing one lands outside the loop`);
  }
});

test('every walkthrough ends on RUN, and never bolts a control shut', ()=>{
  for(const K of INV.STAGES){
    if(!K.walk) continue;
    const last=K.walk[K.walk.length-1];
    assert.match(last.sel||'', /#conRun/, `stage "${K.id}" does not end by pressing RUN`);
    /* Nothing is disabled any more. Running early is a thing a child will do
       and the mission simply tells them what happened — which teaches more
       than a greyed-out button does. */
    K.walk.forEach((s,i)=>{
      assert.ok(!s.rails, `stage "${K.id}" step ${i+1} still disables a control`);
    });
  }
});

test('every walkthrough step says how it knows it has happened', ()=>{
  /* COACH stands past the last step that is already true, so a step with no
     done() is a step it can never get past. */
  for(const K of INV.STAGES)
    (K.walk||[]).forEach((s,i)=>{
      assert.strictEqual(typeof s.done, 'function',
        `stage "${K.id}" step ${i+1} has no done()`);
      assert.ok(s.sel || s.find,
        `stage "${K.id}" step ${i+1} points at nothing`);
    });
});

/* ------------------------------------------------------- the wiring */

test('the swarm is a station in the hall, dispatched, and on the page', ()=>{
  const planet=read('public/planet.js');
  const game=read('public/game.js');
  assert.match(planet, /id:'inv'/, 'no station row in PLANET.STATIONS');
  assert.match(game, /id==='inv'/, 'startMissionRoom does not dispatch it');
  assert.match(read('public/index.html'), /src="invaders\.js/, 'not loaded by the page');
});

test('adding the swarm took nobody else off the wall', ()=>{
  /* A new station is an ADDITION. The eight that were in Mission Control
     before it are all still listed, in the same order, with the same ids —
     which is what stops a future edit quietly reusing a plinth instead of
     building one. */
  const planet=read('public/planet.js');
  const table=planet.slice(planet.indexOf('const STATIONS=['));
  const ids=[...table.slice(0, table.indexOf('];')).matchAll(/id:'([a-z0-9]+)'/g)].map(m=>m[1]);
  assert.deepStrictEqual(ids,
    ['tut','school','nav','flight','m1','m2','m3','sub','inv'],
    'the station list is not the old one plus the swarm');
});

test('a student who has finished nothing can still walk into the swarm', ()=>{
  /* THE LESSON IS THE GATE, NOT THE SAVE FILE. This is the game that goes
     with a thirty-minute period on loops, so a class having that lesson
     today has to be able to open it today — chained behind the Trench it
     would sit locked behind four other missions on the one afternoon it is
     wanted. PROGRESS.unlocked() opens anything that is not in ORDER, so the
     check is that the swarm stays out of it. */
  const game=read('public/game.js');
  const order=[...game.slice(game.indexOf('const ORDER='))
                    .slice(0, game.slice(game.indexOf('const ORDER=')).indexOf(';'))
                    .matchAll(/'([a-z0-9]+)'/g)].map(m=>m[1]);
  assert.ok(order.length, 'could not read the unlock order');
  assert.ok(!order.includes('inv'),
    `'inv' is in ORDER (${order.join(', ')}), so the swarm is locked behind ` +
    `'${order[order.indexOf('inv')-1]}' — a student with an empty save cannot open it`);
  /* and the same rule unlocked() uses, applied cold */
  const unlocked = id => { const i=order.indexOf(id); return i<=0; };
  assert.ok(unlocked('inv'), 'the swarm is not open on a fresh save');
});

test('Mission Control has a plinth for every station it lists', ()=>{
  /* The spots array is indexed by station, and falls back to the LAST spot
     when it runs short — so one station too many is not an error, it is two
     consoles standing in the same place. */
  const planet=read('public/planet.js');
  const table=planet.slice(planet.indexOf('const STATIONS=['));
  const stations=(table.slice(0, table.indexOf('];')).match(/\{ id:'/g)||[]).length;
  const spots=planet.slice(planet.indexOf('const spots=['));
  const n=(spots.slice(0, spots.indexOf('];')).match(/\{ x:/g)||[]).length;
  assert.ok(n>=stations,
    `${stations} stations and only ${n} places to stand — the last ones would overlap`);
});

test('the swarm cleans up after itself when you leave', ()=>{
  /* A mission whose module keeps thinking it is active after you have
     walked out keeps the code console alive in rooms that have no console.
     Whatever tears the other games down has to tear this one down too. */
  for(const f of ['public/game.js','public/menu.js','public/planet.js'])
    assert.match(read(f), /INVADERS\.stop\(\)/, `${f} never stops the swarm`);
});

test('everything the swarm says, it can say in Spanish', ()=>{
  /* The whole game is bilingual, and a string that reaches a screen without
     a translation reaches it in English — silently, because t() falls back
     to its key. These are the ones a student actually reads. */
  const src=read('public/invaders.js');
  const es=read('public/strings.js');
  const said=new Set();
  for(const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) said.add(m[1]);
  INV.STAGES.forEach(K=>{
    said.add(K.name);
    if(K.brief) said.add(K.brief);
    if(K.stuck) said.add(K.stuck);
    if(K.learn){ said.add(K.learn.name); said.add(K.learn.text); }
    /* the walkthrough talks too, and it is the first thing a student reads */
    (K.walk||[]).forEach(s=>{ if(s.say) said.add(s.say); });
  });
  const missing=[...said].filter(s=>{
    if(!s || !/[a-z]{3}/.test(s)) return false;
    return es.indexOf("'"+s.replace(/\\'/g,"'")+"'")<0
        && es.indexOf('"'+s+'"')<0;
  });
  assert.deepStrictEqual(missing, [],
    'no Spanish for:\n  ' + missing.join('\n  '));
});
