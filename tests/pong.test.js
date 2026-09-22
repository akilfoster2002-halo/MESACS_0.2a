/* =====================================================================
   PONG — a whole game, and a walkthrough that can actually be walked.

   The room is three objects and a court. What these hold is the half
   that cannot be seen by looking at it: that the walkthrough leads
   somewhere, that every step it points at exists, and that no two steps
   wait on the same thing.

   THAT LAST ONE IS THE WHOLE FILE, really. COACH stands past the LAST
   step whose `done` is true, which is what lets it catch up with a
   student who works ahead. The cost is that two steps sharing a
   predicate are one step nobody ever sees: clicking the diamond on the
   ball's `if` also satisfied "click the diamond on the rival's `if`",
   and the walkthrough jumped fifteen steps into a script that did not
   exist yet. Every one of these tests is a bug that happened while this
   mission was being built:

     the Operators shelf is called `ops`, and a step that asked for
       `operators` could never be finished by anybody;
     `move` arrives set to 10, which crosses the court in nineteen
       frames — there is no game at that speed, only a flicker;
     a number slot is an <input>, not the <i> a boolean slot is, so the
       step pointed its ring at nothing;
     and "press Run" pointed at a button that greys out while a program
       is running, which it was, because the previous step had started one.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const STEPS = require('../public/pongsteps.js');
const PONGJS = bare(read('public/pong.js'));

function language(){
  const ctx=vm.createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  vm.runInContext(read('public/blocks.js'), ctx, { filename:'blocks.js' });
  return ctx.BLOCKS;
}
const B = language();
const steps = STEPS.steps();

/* ------------------------------------------------------ the walkthrough */
test('every step says something and knows when it is done', ()=>{
  assert.ok(steps.length > 20, 'a whole game is more than a handful of steps');
  steps.forEach((s,i)=>{
    assert.ok(s.say && s.say.length>5, 'step '+(i+1)+' says nothing');
    assert.strictEqual(typeof s.done, 'function', 'step '+(i+1)+' can never be finished');
    assert.ok(s.want, 'step '+(i+1)+' has no name');
  });
});

test('no two steps are called the same thing', ()=>{
  /* Names are how a step is told from its neighbour. Duplicates are
     numbered rather than forbidden — `forever` really is asked for on two
     different objects — but the labels have to come out unique. */
  const w=steps.map(s=>s.want);
  assert.strictEqual(new Set(w).size, w.length,
    'duplicate step name: '+w.filter((x,i)=>w.indexOf(x)!==i).join(', '));
});

test('no two steps wait on the same thing', ()=>{
  /* THE ONE THAT BIT, three times. COACH stands past the LAST step whose
     `done` answers true, so a predicate shared by two steps silently
     eats everything between them. Checked by SOURCE rather than by
     running them: two steps whose condition is written identically are
     two steps that will be satisfied identically. */
  /* Two steps built by the same helper share their source text and are
     still different steps, because the helper captured a different
     argument — "click the You chip" and "click the Ball chip" are one
     function and two questions. What tells those apart is exactly what
     `want` is built from, so the rule is: within a group of steps whose
     condition is written identically, no two may be asking for the same
     thing. `shelf:control` twice is the bug; `chip:You` and `chip:Ball`
     are not. The trailing #2 that label() adds is stripped first, since
     that is the symptom rather than the cause. */
  const groups=new Map();
  steps.forEach((s,i)=>{
    const body=String(s.done).replace(/\s+/g,' ').trim();
    if(!groups.has(body)) groups.set(body,[]);
    groups.get(body).push(i);
  });
  for(const [body, idx] of groups){
    const asks=idx.map(i=>String(steps[i].want).replace(/#\d+$/,''));
    const dup=asks.find((a,k)=>asks.indexOf(a)!==k);
    if(dup!==undefined){
      const which=idx.filter((_,k)=>asks[k]===dup).map(i=>(i+1)+' ("'+steps[i].want+'")');
      assert.fail('steps '+which.join(' and ')+' ask for the same thing AND wait on the '+
        'same condition, so finishing one finishes both: '+body);
    }
  }
});

test('every shelf and tab a step names is a real category', ()=>{
  /* `operators` is not a category id; `ops` is. A step naming the wrong
     one points at a tab that is not there and can never be finished. */
  const ids=B.CATS.map(c=>c.id);
  const src=bare(read('public/pongsteps.js'));
  const named=[
    ...[...src.matchAll(/shelf\('([a-z]+)'/g)].map(m=>m[1]),
    ...[...src.matchAll(/tab:'([a-z]+)'/g)].map(m=>m[1]),
    ...[...src.matchAll(/only\(\['([a-z]+)'\]/g)].map(m=>m[1])
  ];
  assert.ok(named.length>6, 'no categories are named at all any more');
  [...new Set(named)].forEach(id=>assert.ok(ids.includes(id),
    `"${id}" is not a category — the ids are ${ids.join(', ')}`));
});

test('every block a step asks for exists and is on the palette', ()=>{
  const src=bare(read('public/pongsteps.js'));
  const asked=[...src.matchAll(/pick\('([a-z]+\.[A-Za-z]+)'/g)].map(m=>m[1]);
  assert.ok(asked.length>8, 'the walkthrough stopped asking for blocks');
  const pal=/const PALETTE=\{[\s\S]*?\n  \};/.exec(PONGJS)[0];
  asked.forEach(op=>{
    assert.ok(B.of(op), `no such block: ${op}`);
    assert.ok(pal.includes(`'${op}'`), `${op} is asked for and is not on Pong's palette`);
  });
});

test('every block on the palette exists in the language', ()=>{
  const pal=/const PALETTE=\{[\s\S]*?\n  \};/.exec(PONGJS)[0];
  [...pal.matchAll(/'([a-z]+\.[A-Za-z]+)'/g)].map(m=>m[1])
    .forEach(op=>assert.ok(B.of(op), `the palette offers ${op}, which is not a block`));
});

test('the blocks arrive at numbers that make a game', ()=>{
  /* `move` defaults to 10 — a whole square a frame, and the ball crosses
     the court before anybody has seen it. `change y by` defaults to the
     x axis, which walks a paddle into a wall. Neither is a detail: they
     are the difference between Pong and a bug report. */
  const SET=STEPS.SET;
  assert.ok(SET, 'the starting values are gone');
  assert.strictEqual(SET['motion.move'].n, 5, 'the ball is back at the palette speed');
  assert.strictEqual(SET['motion.changeBy'].a, 'y', 'the paddles would move sideways');
  assert.strictEqual(SET['sense.posOf'].o, 'Ball', 'the rival would watch the wrong thing');
  assert.notStrictEqual(SET['sense.touch'].o, 'player',
    'there is no `player` on a Pong court, so the dropdown would name nothing');
  /* and every step that narrows the shelf hands them over */
  steps.filter(s=>s.pal).forEach(s=>assert.strictEqual(s.pal.defaults, SET,
    'step "'+s.want+'" offers blocks without their starting values'));
});

test('opening the whole shelf does not throw the numbers away', ()=>{
  /* The first Run takes the rails off the palette. `narrow(null)` would
     do that and lose `defaults` with it, which is most of the test
     above. A spec with no cats and no ops restricts nothing and keeps
     them. */
  const fn=/function openShelf\(\)\{[\s\S]*?\n  \}/.exec(PONGJS)[0];
  assert.ok(!/CODER\.narrow\(null\)/.test(fn),
    'the starting values are dropped the moment the shelf opens');
  assert.match(fn, /defaults:\(window\.PONGSTEPS\|\|\{\}\)\.SET/,
    'the full shelf no longer carries the starting values');
});

test('a step that asks for Run first ends the run before it', ()=>{
  /* Run greys out while a program is running. This mission presses it
     four times, and without stopping first, every one after the first
     points at a dead button. */
  const runs=steps.filter(s=>s.sel==='#cFlag');
  assert.ok(runs.length>=3, 'the mission no longer asks anybody to run anything');
  runs.forEach(s=>assert.strictEqual(s.stopFirst, true,
    'the Run step "'+s.want+'" would point at a greyed-out button'));
  assert.match(PONGJS, /s\.stopFirst && window\.VM && VM\.running\) VM\.stopAll\(\)/,
    'nothing acts on stopFirst, so marking the steps does nothing');
});

test('a Run step cannot be ticked off without running', ()=>{
  /* Every other condition on these is true the instant the last block
     lands, so each one has to look at the world as well as the script. */
  /* It has to read the WORLD, not just the script — where the ball got
     to, or what the score says. `VM.running` alone is not enough and was
     the bug: a program started five steps ago is still running, so the
     flag is true before anybody presses anything. */
  steps.filter(s=>s.sel==='#cFlag').forEach(s=>{
    const body=String(s.done);
    assert.ok(/ranAgain|lx\(|ly\(|score/.test(body),
      'the Run step "'+s.want+'" is satisfied by writing blocks alone, or by a '+
      'program that was already running before the step appeared');
  });
});

test('the last step waits for a game, not for conceding one', ()=>{
  const last=steps[steps.length-1];
  const body=String(last.done);
  assert.match(body, /score\.you>=1/,
    'the walkthrough ends when ANY point is scored — including the dozen '+
    'conceded while the ball is still being written');
  assert.match(body, /rival/, 'and it ends before the opponent has been built');
});

/* ------------------------------------------------------------- the room */
test('the room does not play the game', ()=>{
  /* THIS TEST USED TO SAY THE OPPOSITE, and that was the bug it was
     protecting.

     The room had a referee. It kept the paddles on the court, spotted a
     ball that had gone past one, counted the score, re-served, and
     quietly let go of a bat a ball had just bounced off. All of it
     correct and all of it invisible — and a student who opens the Ball,
     reads every block on it and still cannot find the part that scores a
     point has been shown the decorations on a game, not the inside of
     one. That is the whole of what this mission is for.

     So the room owns a floor, a camera and a scoreboard, and nothing
     that decides anything. */
  ['function referee(','function point(side)','function launch()',
   'function clearOf(','function clearWall('].forEach(fn=>
    assert.ok(!PONGJS.includes(fn),
      'the room is playing the game again: '+fn.replace('function ','')+' is back'));
  assert.ok(!/\byou\+\+|\brival\+\+/.test(PONGJS), 'the room is counting the score');
});

test('the score lives in the student\u2019s own variables', ()=>{
  /* The scoreboard is a window, not a scorer: it reads two project
     variables and puts them on screen. Until the blocks that change them
     exist it shows nought each, which is the truth. */
  assert.match(PONGJS, /const SCORE=\{ you:'you', rival:'rival' \}/, 'the two names are gone');
  assert.match(PONGJS, /VM\.project\.vars\[SCORE\[k\]\]/,
    'the scoreboard has stopped reading the variables');
  const pal=/const PALETTE=\{[\s\S]*?\n  \};/.exec(PONGJS)[0];
  ['data.set','data.change','data.get'].forEach(op=>assert.ok(pal.includes(op),
    op+' is not on the palette, so nobody can touch the score'));
});

test('every rule of the game is a block somebody can open', ()=>{
  /* Each of these is a rule Pong needs. Each one has to be reachable
     from a shelf, or it is being done somewhere the student cannot see. */
  const pal=/const PALETTE=\{[\s\S]*?\n  \};/.exec(PONGJS)[0];
  const needs={
    'serving it':          'motion.goto',
    'aiming the serve':    'op.random',
    'moving it':           'motion.move',
    'noticing a bat':      'sense.touch',
    'noticing a wall':     'motion.pos',
    'putting it back':     'motion.setTo',
    'turning it':          'motion.face',
    'mirroring the angle': 'op.sub',
    'reading the angle':   'motion.dir',
    'watching the ball':   'sense.posOf',
    'counting a point':    'data.change'
  };
  const src=bare(read('public/pongsteps.js'));
  Object.entries(needs).forEach(([what,op])=>{
    assert.ok(pal.includes(`'${op}'`), `${what} needs ${op}, and it is not on the palette`);
    assert.ok(src.includes(op), `no step ever mentions ${op} — ${what} would never get written`);
  });
});

test('the paddle handed over is a complete script, edges included', ()=>{
  /* It is the one object a student is given as an example of what a
     script looks like. It used to stop at the wall for reasons that were
     nowhere in it. */
  /* read from the onKey helper through given(), since the key blocks are
     built by the helper and the edge blocks by given() itself */
  const g=PONGJS.slice(PONGJS.indexOf('const onKey='),
                       PONGJS.indexOf('function legend()'));
  assert.match(g, /motion\.goto/,  'it never puts itself on its own line');
  assert.match(g, /sense\.key/,    'it does not read the keys');
  assert.match(g, /motion\.setTo/, 'nothing in it stops it walking off the top');
  assert.match(g, /op\.gt/,        'and nothing in it notices the edge');
});

test('the taught bounce line, the painted wall and the snap are one number', ()=>{
  /* A student whose `y position > 6` disagrees with where the wall is
     drawn has been given a bug to find that is not theirs. */
  assert.match(PONGJS, /const COURT=\{ x:11, y:6 \}/, 'the court moved');
  assert.strictEqual(STEPS.SET['op.gt'].b,  6,  'the greater-than arrives at a different line');
  assert.strictEqual(STEPS.SET['op.lt'].b, -6,  'and so does the less-than');
  const src=bare(read('public/pongsteps.js'));
  assert.match(src, /y position\) &gt; 6/, 'the wall step no longer teaches 6');
});

test('what is drawn is what `touching` tests', ()=>{
  /* `touching` is a sphere off `size`. Stretch the picture much past it
     and a ball visibly hits the bat and sails through — a bug the
     student cannot fix, because it is not in their script. */
  assert.match(PONGJS, /const REACH = \(a,b\) => \(\(a&&a\.size\|\|1\) \+ \(b&&b\.size\|\|1\)\) \* 0\.6/,
    'the room has stopped using the VM’s own reach');
  const stretch=/function shapeThem\(\)\{[\s\S]*?\n  \}/.exec(PONGJS)[0];
  const long=Math.max(...[...stretch.matchAll(/0\.36, 0\.5, ([\d.]+)/g)].map(m=>+m[1]));
  const size=+/size:([\d.]+)/.exec(/const PADDLE=\{[^}]*\}/.exec(PONGJS)[0])[1];
  const reach=(0.8+size)*0.6;
  assert.ok(long*size*0.5 <= reach,
    `the bat is drawn ${(long*size).toFixed(2)} long but only reaches ${reach.toFixed(2)}`);
});

test('the three objects are the three the steps talk about', ()=>{
  const names=['Ball','You','Rival'];
  names.forEach(n=>assert.ok(PONGJS.includes(`'${n}'`), `the room has no ${n}`));
  const src=bare(read('public/pongsteps.js'));
  names.forEach(n=>assert.ok(src.includes(`'${n}'`), `no step ever mentions ${n}`));
});

test('the room is always the top view, and never asks', ()=>{
  /* Pong is flat. There is no version of it that is better in three
     dimensions, so unlike the ring it offers no choice. */
  assert.match(PONGJS, /VM\.stageCam\(/, 'the camera is not the orthographic stage camera');
  assert.ok(!/ringPick|askView/.test(PONGJS), 'Pong is asking a question it has no second answer to');
});

test('nothing is kept between visits', ()=>{
  assert.match(PONGJS, /VM\.useScratch\(\)/, 'a Pong court would now survive being left');
  assert.ok(!/localStorage|PROGRESS\.set/.test(PONGJS), 'something is being written down');
});

/* --------------------------------------------------------- the wiring */
test('Pong is a station, a card, dispatched and on the page', ()=>{
  const planet=read('public/planet.js'), game=read('public/game.js');
  assert.match(planet, /id:'pong'/,   'no station row in Mission Control');
  assert.match(game,   /id==='pong'/, 'startMissionRoom does not dispatch it');
  assert.match(game,   /PONG\.active\) PONG\.tick\(dt\)/, 'the frame never ticks it');
  assert.match(game,   /PONG\.active\) return;/,
    'the planet still walks an invisible player about underneath the court');
  const html=read('public/index.html');
  assert.match(html, /src="pong\.js/,      'pong.js is not loaded by the page');
  assert.match(html, /src="pongsteps\.js/, 'the walkthrough is not loaded by the page');
  assert.match(html, /id="pong"/,          'the overlay is not in the page');
  assert.match(read('public/menu.js'), /id:'pong'/, 'no card in the menu');
});

test('every element the room and its steps point at is in the page', ()=>{
  /* A ring drawn round a selector that does not exist is a walkthrough
     pointing at nothing, and it is silent. */
  const html=read('public/index.html');
  const src=bare(read('public/pongsteps.js'))+PONGJS;
  const ids=[...src.matchAll(/#(pong[A-Za-z]+)/g)].map(m=>m[1]);
  assert.ok(ids.length>2, 'the room stopped naming any of its own furniture');
  [...new Set(ids)].forEach(id=>assert.match(html, new RegExp('id="'+id+'"'),
    `#${id} is pointed at and is not in index.html`));
});
