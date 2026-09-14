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

test('the grid needs a second loop, not a bigger first one', ()=>{
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

test('every shield grows back, so no shield can simply be worn down', ()=>{
  for(const K of INV.STAGES)
    assert.ok(K.fort.regrow > 0,
      `stage "${K.id}" has a shield that never grows back — a long enough ` +
      `straight-line program would beat it, and the loop becomes optional`);
});

test('a built swarm wins only at full strength, and one rank short loses', ()=>{
  /* THE BUILD STAGES ARE SIZED, NOT TIMED. They are the two where a single
     volley is supposed to decide it, so the shield has to sit in the gap
     between "the formation the mission asked for" and "one rank less than
     that" — which is what makes the number of invaders the point, and
     therefore what makes the loop that puts them there the point. */
  const fortRow=ROWS-1;
  for(const K of INV.STAGES){
    if(!K.autoVolley) continue;
    const cols=8, rows=K.need.alive/cols;
    assert.ok(Number.isInteger(rows), `stage "${K.id}" is not a whole number of ranks`);
    const full=volley(rows, cols, fortRow);
    const short=volley(rows-1, cols, fortRow);
    assert.ok(full >= K.fort.shield,
      `stage "${K.id}": the formation it asks for does ${full} and the shield is ` +
      `${K.fort.shield} — it cannot be won`);
    assert.ok(short < K.fort.shield,
      `stage "${K.id}": ${rows-1} ranks already does ${short} against ${K.fort.shield} — ` +
      `the last rank is not needed, so neither is building it properly`);
  }
});

test('a marching swarm cannot win on one volley, however it is arranged', ()=>{
  /* The other three are timed rather than sized: the army is handed to you,
     so the only thing your program decides is how many volleys it lasts for.
     A shield that falls to the first one would make every loop in those
     stages decoration. */
  for(const K of INV.STAGES){
    if(!K.army) continue;
    const one=volley(K.army.rows, K.army.cols, ROWS-1);
    assert.ok(K.fort.shield > one,
      `stage "${K.id}": a shield of ${K.fort.shield} falls to a single volley worth ${one}`);
  }
});

test('the ladder ends on the golden rule', ()=>{
  /* An if inside a forever is the last thing the lesson teaches, so it is
     the last thing this mission asks for. */
  const last=INV.STAGES[INV.STAGES.length-1];
  assert.ok(last.pal.includes('forever') && last.pal.includes('ifc'),
    'the last stage should be the continuous listener');
  const code=last.learn.code;
  const fi=code.indexOf('forever'), ii=code.indexOf('if ');
  assert.ok(fi>=0 && ii>fi,
    'the worked answer must put the if INSIDE the forever, not above it');
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
    /* and the rails it sets must name real palette entries too */
    for(const s of (K.walk||[]))
      for(const op of (s.pal||[]))
        assert.ok(K.pal.includes(op),
          `stage "${K.id}" rails the shelf down to "${op}", which it never offers`);
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

test('every walkthrough ends on RUN, with RUN switched back on', ()=>{
  for(const K of INV.STAGES){
    if(!K.walk) continue;
    const last=K.walk[K.walk.length-1];
    assert.match(last.sel||'', /#conRun/, `stage "${K.id}" does not end by pressing RUN`);
    assert.notStrictEqual(last.rails && last.rails.run, false,
      `stage "${K.id}" ends pointing at a RUN button it has railed off`);
    /* and every step before it keeps RUN shut, so a half-built program
       cannot be launched out from under the walkthrough */
    K.walk.slice(0,-1).forEach((s,i)=>{
      assert.strictEqual(s.rails && s.rails.run, false,
        `stage "${K.id}" step ${i+1} leaves RUN live mid-walkthrough`);
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
