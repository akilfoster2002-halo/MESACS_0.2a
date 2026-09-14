/* START FROM THE BEGINNING.

   A save that always carries on is right nine times in ten. The tenth is a
   student who wants level one back — to do it properly, or to see the
   walkthrough again — and a teacher at their shoulder who wants the same.
   What that has to mean: the level pointer goes, every flag the mission
   filed under its own name goes (walkthroughs walked, films seen), and the
   COMPLETE stamp stays, because taking a finished mission back would lock
   every mission that needed it. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const game = read('public/game.js');

/* The store is a closure inside game.js, which touches the DOM at load —
   so the closure alone is cut out and run against stubs. */
function loadProgress(){
  const a=game.indexOf('const PROGRESS=(function(){');
  const b=game.indexOf('\n})();', a);
  assert.ok(a>=0 && b>a, 'could not find the PROGRESS closure in game.js');
  const src=game.slice(a, b+'\n})();'.length) + '\nPROGRESS;';
  const ctx={ window:{ addEventListener(){} }, document:{ addEventListener(){} }, navigator:{},
              localStorage:{ getItem(){ return null; }, setItem(){} },
              setTimeout(){ return 1; }, clearTimeout(){}, t:x=>x };
  vm.createContext(ctx);
  return vm.runInContext(src, ctx);
}

test('restart goes back to level one and forgets what the mission has shown', ()=>{
  const P=loadProgress();
  P.reach('inv', 6);
  P.set('inv_film', 1); P.set('inv_walk_rank', 1); P.set('inv_walk_grid', 1);
  P.set('invite_code', 'x');        // a key that merely STARTS with the id is not the mission's
  P.set('flight_film', 1);          // and another mission's flags are its own
  P.restart('inv');
  assert.strictEqual(P.reached('inv'), 0, 'the level pointer should be cleared');
  assert.strictEqual(P.get('inv_film'), undefined, 'the film should play again');
  assert.strictEqual(P.get('inv_walk_rank'), undefined, 'the walkthroughs should walk again');
  assert.strictEqual(P.get('inv_walk_grid'), undefined);
  assert.strictEqual(P.get('invite_code'), 'x', 'restart took a key that was not the mission\'s');
  assert.strictEqual(P.get('flight_film'), 1, 'restart reached into another mission');
});

test('restart keeps the COMPLETE stamp, so nothing downstream locks again', ()=>{
  const P=loadProgress();
  P.complete('m1');
  P.recordQuiz('m1', 80);
  P.restart('m1');
  assert.ok(P.isDone('m1'), 'a finished mission should stay finished');
  assert.ok(P.unlocked('m2'), 'restarting Loops must not lock Choices');
  assert.strictEqual(P.quizScore('m1'), 80, 'the quiz score is a thing that happened');
});

test('only missions with levels offer a beginning to go back to', ()=>{
  const P=loadProgress();
  for(const id of ['inv','flight','sub','school','nav','race','m1','m2','m3'])
    assert.ok(P.leveled(id), `${id} tracks levels and should be restartable`);
  for(const id of ['tut','mech','mecha','free',null,undefined])
    assert.ok(!P.leveled(id), `${id} has no levels — a restart button there does nothing`);
});

test('the pause card carries the button, asks once, and relaunches from level one', ()=>{
  assert.match(game, /function pauseOver\(\)/, 'no pauseOver() in game.js');
  assert.match(game, /pauseOver\(\);/, 'togglePause never draws it');
  assert.match(game, /PROGRESS\.leveled\(id\)/, 'the button is not gated on the mission having levels');
  const fn=game.slice(game.indexOf('function pauseOver()'), game.indexOf('function pauseJump()'));
  assert.match(fn, /pOverYes/, 'no confirmation step');
  assert.match(fn, /PROGRESS\.restart\(id\);[\s\S]{0,300}startMissionRoom\(id\)/,
    'saying yes should restart the save and then relaunch the mission');
});

test('the swarm pauses to a lean card: no mission list, no hint, no jump row', ()=>{
  /* The swarm's mission panel and briefing are on screen the whole time, so
     the card only has to offer what you paused for — back, start over,
     the sound, the way out. The full card, jump row and all, is for the
     rooms you walk about in. */
  const fn=game.slice(game.indexOf('function togglePause()'), game.indexOf('function pauseOver()'));
  assert.match(fn, /const lean = !!\(window\.INVADERS && INVADERS\.active\)/, 'no lean card for the swarm');
  assert.match(fn, /const full = lean \? '' :/, 'the lean card still carries the mission list and the hint');
  assert.match(fn, /const keysJump = lean \? '' :/, 'the lean card still carries the keys and the jump row');
  assert.match(fn, /if\(!lean\) pauseJump\(\);/, 'the jump row is drawn into a card that has no room for it');
  assert.match(fn, /pauseOver\(\);/, 'the lean card lost the start-over button');
});

test('P pauses the board missions, and a paused board holds still', ()=>{
  /* The swarm, the trench, the flight and the school run with G.running off,
     and their corner promises "P pause & hint" all the same. */
  assert.match(game, /e\.code==='KeyP' && \(G\.running \|\| boardNow\)/,
    'P only answers when G.running is on — the board missions cannot pause');
  assert.match(game, /INVADERS\.active && !paused\) INVADERS\.tick/, 'the swarm keeps flying under the pause card');
  assert.match(game, /FLIGHT\.active && !paused\) FLIGHT\.tick/, 'the field keeps arriving under the pause card');
});

test('the swarm files everything it remembers under its own name', ()=>{
  /* restart() clears by prefix, so a flag saved as `film_inv` would survive a
     restart and the film would never play again. */
  const inv=read('public/invaders.js');
  for(const m of inv.matchAll(/PROGRESS\.set\('([^']+)'/g))
    assert.ok(m[1].startsWith('inv_'), `invaders.js saves "${m[1]}", which a restart would not clear`);
  assert.match(inv, /const TKEY = id => 'inv_walk_'\+id/, 'the walkthrough flags moved off the inv_ prefix');
});

test('the menu tile offers START OVER on a finished mission too, never on one without levels', ()=>{
  const menu=read('public/menu.js');
  assert.match(menu, /\(at \|\| done\) && PROGRESS\.leveled && PROGRESS\.leveled\(m\.id\)/,
    'the tile overlay is not gated the way the pause card is');
});

test('everything the card says, it can say in Spanish', ()=>{
  const es=read('public/strings.js');
  for(const k of ['THIS MISSION','Start from the beginning','Yes, start over','Keep going',
                  'Back to <b>level 1</b>, with the walkthroughs again. Everything you have done in this mission starts over.'])
    assert.ok(es.indexOf("'"+k+"'")>=0, `no Spanish for: ${k}`);
});
