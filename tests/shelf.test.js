/* THE SHELF WAS A CAGE.

   The ring teaches by narrowing: a step says "click this" and the palette
   holds the one block it is asking for, so there is nothing else to click
   and nothing to be confused by. That is the right way to show somebody
   where a block lives, and it was also, for fourteen steps, the only thing
   the editor would let them touch.

   Which is fine right up to the moment the walkthrough stops being the most
   interesting thing on screen. A student who has pressed Run and watched
   their own program move a robot immediately wants to try a thing — and the
   thing they want is never the block the next step happens to be about. The
   report was "i want to do things but it isnt letting me", which is not a
   complaint about the lesson. It is a complaint about the cage.

   So Run is the door: the first press ends the narrowing for the rest of
   the mission, and the walkthrough carries on pointing beside a full shelf.
   These tests hold both halves — that it opens, and that it opens to
   EVERYTHING rather than to a slightly bigger handful.

   Source-level, because the thing under test is a room with a renderer in
   it. Comments are stripped first: the paragraphs above explain the rule
   using the same words the code does, and a test that matched those would
   pass on prose. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const RING = bare(read('public/ring.js'));

/* the whole language, loaded the way the other suites load it */
function language(){
  const ctx = vm.createContext({ console });
  ctx.window = ctx; ctx.self = ctx;
  vm.runInContext(read('public/blocks.js'), ctx, { filename:'blocks.js' });
  return ctx.BLOCKS;
}

test('pressing Run opens the shelf', ()=>{
  assert.match(RING, /function openShelf\(\)/,
    'there is something whose job is opening it');
  /* Hung off the run counter, inside the block that already means "an
     attempt has begun". Anywhere else and it is a second opinion about
     when Run was pressed, which is how the two drift apart. */
  const watch = /function watch\([^)]*\)\{[\s\S]*?\n  \}/.exec(RING);
  assert.ok(watch, 'the watcher is still there to hang it off');
  assert.match(watch[0], /seenRun!==VM\.runId[\s\S]*?openShelf\(\)/,
    'the shelf opens on the frame a run begins');
});

test('it opens to the whole language and not to a longer list', ()=>{
  const fn = /function openShelf\(\)\{[\s\S]*?\n  \}/.exec(RING)[0];
  assert.match(fn, /CODER\.narrow\(null\)/,
    'null is what the editor already means by no restriction — a hand-written '+
    'list of every op is a list that goes stale the first time a block is added');
});

test('and it only opens once', ()=>{
  const fn = /function openShelf\(\)\{[\s\S]*?\n  \}/.exec(RING)[0];
  assert.match(fn, /if\(ranOnce\) return;/,
    'called every frame of every run; it must not re-render the palette on each');
});

test('no step narrows the palette again afterwards', ()=>{
  const step = /function onStep\(s\)\{[\s\S]*?\n  \}/.exec(RING);
  assert.ok(step, 'onStep is still the one place a step touches the palette');
  const body = step[0];
  /* every narrow() in here is guarded by not having run yet */
  const calls = body.match(/CODER\.narrow\([^)]*\)/g) || [];
  assert.ok(calls.length >= 1, 'it still narrows before the first run');
  assert.match(body, /if\(s\.pal && !ranOnce\)/,
    'a step stops taking blocks away once they have run something');
  assert.match(body, /if\(!ranOnce\) CODER\.narrow\(palette\(\)\)/,
    'and the end of the walkthrough does not put the stage subset back');
});

test('the step still opens its own tab either way', ()=>{
  const body = /function onStep\(s\)\{[\s\S]*?\n  \}/.exec(RING)[0];
  /* Pointing is the half that has to survive. A step about a Sensing block
     should still put Sensing in front of them — it just no longer takes the
     other seven tabs away to do it, so this must sit OUTSIDE the guard. */
  const guard = body.indexOf('if(s.pal && !ranOnce)');
  const tab   = body.indexOf('if(s.tab) CODER.openCat(s.tab)');
  assert.ok(tab > guard, 'the tab still opens');
  const between = body.slice(guard, tab);
  assert.ok((between.match(/\{/g)||[]).length === (between.match(/\}/g)||[]).length,
    'and it is not nested inside the "have they run anything" guard');
});

test('a fresh room is a narrow shelf again', ()=>{
  /* Nothing in the ring is kept, including having been here. A student who
     re-enters mission one gets the walkthrough from the top, and a shelf
     that stayed open would be the one thing that remembered. */
  const start = /function start\(robotId[\s\S]*?\n  \}/.exec(RING);
  assert.ok(start, 'the room still has a way in');
  assert.match(start[0], /ranOnce=false/,
    'entering a mission puts the rails back on');
});

test('the full shelf is genuinely the full language', ()=>{
  /* What CODER.narrow(null) means, checked against the editor rather than
     assumed: no restriction has to be the thing that shows every category
     and every block in it. */
  const coder = bare(read('public/coder.js'));
  assert.match(coder, /const cats\s*=\s*\(\)\s*=>\s*BLOCKS\.CATS\.filter\(c=>!only/,
    'no restriction shows every category');
  assert.match(coder, /const shown\s*=\s*c\s*=>\s*BLOCKS\.inCat\(c\)\.filter\(bd=>!only/,
    'and every block on it');
  const B = language();
  const total = B.CATS.reduce((n,c)=>n+B.inCat(c.id).length, 0);
  assert.ok(total > 60, 'and that is a catalogue worth opening ('+total+' blocks)');
});

test('the ring palette is still there for the stages that have not run yet', ()=>{
  /* Opening the shelf at Run must not have quietly deleted the curated list
     the room starts from — that is what the first steps narrow out of, and
     what a mission with no walkthrough falls back to. */
  assert.match(RING, /const PALETTE = \{/, 'the room still has its own list');
  assert.match(RING, /function palette\(\)\{[\s\S]*?ST\(\)/,
    'and a stage still narrows out of it');
});
