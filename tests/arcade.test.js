/* THE ARCADE.

   The first thing in this game a child makes that other children read, and
   that changes what has to be true about it. Chat is never written down —
   a room that empties forgets every word — which is the right call for
   something said in passing and the wrong one for a game, whose whole
   point is outliving the lesson. So games are stored, and stored
   child-made work needs the things stored child-made work needs.

   Four of those are checkable here without a browser. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('a game has an author, a takedown and a size it cannot exceed', ()=>{
  const schema = read('server/db.js');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS games/, 'no games table');
  assert.match(schema, /author_id\s+INTEGER NOT NULL REFERENCES users\(id\)/,
    'a game with no author cannot be taken down or credited');
  assert.match(schema, /hidden\s+BOOLEAN NOT NULL DEFAULT false/,
    'no way to take a game down');
  /* One vote per player per game, enforced by the table rather than by the
     code — otherwise somebody can sit on a cabinet pushing it up. */
  assert.match(schema, /PRIMARY KEY \(game_id, user_id\)/,
    'a player can vote on the same game twice');

  const api = read('server/index.js');
  assert.match(api, /JSON\.stringify\(project\)\.length > \d+/,
    'a project of any size can be published');
  assert.match(api, /const CAP = /, 'strings a child wrote are not capped');
});

test('the server never trusts a length, and never lets you rate your own', ()=>{
  const api = read('server/index.js');
  /* Every string that reaches another child goes through CAP. Reading them
     back out of the source is crude, and it is the check that would have
     caught a new field added without one. */
  for(const bit of ['CAP(req.body.title', 'CAP(req.body.blurb', 'CAP(req.body.note'])
    assert.ok(api.includes(bit), `${bit} is not capped`);
  assert.match(api, /You cannot rate your own game/,
    'an author can rate their own game, which is the one vote that means nothing');
  /* Publishing is the only route that takes a large body. The 16kb ceiling
     is right for sign-in and chat and must stay on them. */
  assert.match(api, /const bigJson = express\.json\(\{ limit:'\d+kb' \}\)/,
    'the arcade has no body limit of its own');
  assert.match(api, /app\.post\('\/api\/arcade', bigJson/,
    'publishing does not use the larger limit');
  assert.match(api, /express\.json\(\{ limit:'16kb' \}\)/,
    'the global limit was raised instead of giving the arcade its own');
});

test('a visitor never writes on the author', ()=>{
  const vm = read('public/vm.js');
  /* Playing somebody's game runs THEIR project in YOUR browser, and their
     program can spawn clones, move objects and set variables. None of it
     may be saved: not over their copy, and not over your own sandbox. */
  assert.match(vm, /function save\(\)\{\s*if\(quiet \|\| visiting\) return;/,
    'saving is not turned off while visiting somebody else’s game');
  assert.match(vm, /if\(!visiting\) load\(\);/,
    'enter() still loads over an adopted project, which would open the sandbox instead');
  assert.match(vm, /function adopt\(proj, stage\)/, 'there is no way to take a project in');
  /* The actors handed over came from fetched JSON and the VM mutates them
     as it runs; without a copy, leaving and re-entering starts half-played. */
  assert.match(vm, /JSON\.parse\(JSON\.stringify\(a\)\)/,
    'adopted actors are not copied, so replaying a game starts it half-played');

  const arc = read('public/arcade.js');
  assert.match(arc, /project:VM\.plain\(\)/,
    'publishing sends the live project, which holds meshes and cannot be serialised');
  assert.doesNotMatch(arc, /project:VM\.project\b/, 'the live project is being published');
});

test('every word a child wrote reaches the screen as text', ()=>{
  const arc = read('public/arcade.js');
  /* textContent, never innerHTML, for anything that came from a person.
     The server caps the length; this makes sure it cannot be markup. Both,
     because either alone is one mistake from a class finding out. */
  assert.match(arc, /el\.textContent = str==null \? '' : String\(str\)/,
    'the text helper no longer sets textContent');
  const dangerous = [...arc.matchAll(/innerHTML\s*=\s*([^;]+);/g)].map(m=>m[1].trim());
  for(const rhs of dangerous)
    assert.ok(rhs === "''" || rhs === '""',
      `arcade.js builds markup from ${rhs} — a child's words must not be innerHTML`);
});

test('the arcade is a door on VOLTA that use() knows about', ()=>{
  const planet = read('public/planet.js');
  const at = planet.indexOf('const ARENA_BUILDINGS');
  const block = planet.slice(at, planet.indexOf('];', at));
  assert.ok(block.includes("id:'arcade'"), 'there is no arcade on VOLTA');
  const known = planet.slice(planet.indexOf('const known = id==='),
                             planet.indexOf('if(!known) return;'));
  /* A panel whose id use() has never heard of falls out of the bottom and
     does nothing: a door you can walk to, press E at, and be ignored by. */
  assert.ok(known.includes("id==='arcade'"), "use() does not know 'arcade'");
  assert.match(planet, /if\(id==='arcade'\)\{[\s\S]{0,200}ARCADE\.open\(\)/,
    'the arcade door does not open the arcade');

  const game = read('public/game.js');
  assert.match(game, /ARCADE\.playing\) ARCADE\.tick/, 'nothing drives the arcade per frame');
  assert.match(game, /function frozen\(\)[\s\S]{0,400}ARCADE\.flat/,
    'walking is not held during a 2D game, so WASD answers twice');
  assert.match(game, /btnPublish/, 'there is no way to publish');
});

/* ------------------------------------------------------------------------
   THE BENCH. Games are MADE in the arcade now, not in Free Play — you walk
   into the building on VOLTA, press MAKE A GAME, and the block editor opens
   in the room behind it. Which door it is behind is the whole point: a
   cabinet you can play and a bench you can build at, in the same room. */
test('the arcade has a workbench, and it is not Free Play\'s sandbox', ()=>{
  const arc = read('public/arcade.js');
  assert.match(arc, /function make\(g\)/, 'there is no way to start a game in the arcade');
  assert.match(arc, /const SLOT='dq_arcade_build'/, 'the bench has no slot of its own');
  /* Two rooms, two projects. A child who walks into the arcade to carry on
     with their game must not find whatever they last built in Free Play —
     nor lose it. */
  assert.match(arc, /VM\.useSlot\(SLOT\)/, 'the bench does not open its own slot');
  assert.match(arc, /VM\.install\(r\.game\.project, r\.game\.stage\)/,
    'opening one of your own does not load it onto the bench');
  const html = read('public/index.html');
  assert.ok(html.includes('id="arMake"'), 'there is no MAKE A GAME button');

  const vm = read('public/vm.js');
  /* install() is adopt()'s opposite number: same load, opposite intent.
     Editing yours turns saving back on; adopt() stays the one for
     somebody else's. */
  assert.match(vm, /function install\(proj, stage\)\{[\s\S]{0,200}visiting=false;[\s\S]{0,80}save\(\);/,
    'install() does not hand the project back as your own');

  const game = read('public/game.js');
  /* You came from the arcade, so LEAVE goes back to the shelf. Dropping
     somebody outside on VOLTA with no idea where their game went is the
     one exit that reads as having lost it. */
  assert.match(game, /ARCADE\.building && ARCADE\.leaveBench\(\)\) return;/,
    'leaving the bench does not go back to the arcade');
});

test('nothing a child wrote is put on the briefing as markup', ()=>{
  const arc = read('public/arcade.js');
  /* say() sets textContent on purpose, because every other string this file
     shows was written by a child. So the file's OWN strings cannot carry
     tags either — they would come out as angle brackets on the card. */
  for(const m of arc.matchAll(/say\(t\('([^']*)'/g))
    assert.ok(!/<[a-z/]/i.test(m[1]),
      `a briefing string carries markup and say() renders text: ${m[1]}`);
});
