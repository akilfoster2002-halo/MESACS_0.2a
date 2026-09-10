/* WHO YOU CAN BE.

   There used to be twenty: Kyle, Mia, and eighteen out of the Kenney blocky
   kit. The kit characters were what this game had before it had anybody —
   four bones and an idle, no walk worth the name and no dance at all — and
   nineteen choices of placeholder is not more choice than one good one.

   Cutting them out is four lines in avatar.js and a long tail everywhere
   else, because half the game casts an NPC by naming a letter. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function roster(){
  const m = read('public/avatar.js').match(/const IDS\s*=\s*'([a-z]+)'\.split/);
  assert.ok(m, 'avatar.js no longer declares IDS as a string of letters');
  return m[1].split('');
}

test('the cast is Kyle and Mia, and Kyle is the one you start as', ()=>{
  assert.deepStrictEqual(roster(), ['s','t']);
  const names = read('public/avatar.js').match(/const NAMES\s*=\s*\{([^}]*)\}/);
  assert.ok(names, 'avatar.js still names them');
  assert.match(names[1], /s:'Kyle'/);
  assert.match(names[1], /t:'Mia'/);
  /* The default is CHARS[0] rather than a random pick, and CHARS is built
     from IDS in order — so "Kyle leads" is a fact about the string above. */
  assert.match(read('public/avatar.js'), /chosen = CHARS\[0\]\.id/,
    'a new player is the first character in the roster');
});

test('both of them are free, and both are in the Mall', ()=>{
  const shop = read('public/shop.js');
  const free = +(shop.match(/const FREE_CHARS=(\d+)/)||[])[1];
  assert.ok(free >= roster().length,
    `FREE_CHARS is ${free} for a cast of ${roster().length}: half the game behind a price`);
  const chars = read('public/chars.js');
  const f2 = +(chars.match(/const FREE = (\d+)/)||[])[1];
  assert.ok(f2 >= roster().length, 'and the picker unlocks all of them');
});

test('nobody casts an NPC by naming a letter', ()=>{
  /* The librarian was 'h' or 'q', the guard on his beat was 'p' and the
     resident behind the decks was 'b' — all kit characters, all now gone.
     A name left behind does not fail: AVATAR.load falls back to the first
     character, so every one of them would quietly have become the player's
     own face standing in the room with them. */
  assert.match(read('public/avatar.js'), /function other\(offset\)/,
    'AVATAR can be asked for somebody who is not you');
  for(const f of ['planet.js', 'puzzle.js', 'club.js']){
    const src = read('public/' + f);
    for(const m of src.matchAll(/AVATAR\.load\(\s*'([a-z])'\s*\)/g))
      assert.fail(`${f} still casts '${m[1]}' by name — use AVATAR.other()`);
  }
  assert.match(read('public/club.js'), /const CAST=\[[^\]]*\]/,
    'the club still names its floor');
  const cast = read('public/club.js').match(/const CAST=\[([^\]]*)\]/)[1]
    .match(/'([a-z])'/g).map(s=>s.replace(/'/g,''));
  for(const c of cast)
    assert.ok(roster().includes(c), `the club's floor includes '${c}', who no longer exists`);
});

test('the previews are of the whole person', ()=>{
  /* They were framed for the kit and never redone for the taller rigs, so
     the picker was advertising Kyle's knees. Regenerated from the models
     themselves, at the size the tile wants. This checks the shape rather
     than the content — but the old ones were 128x164, so it does catch the
     ones that were wrong. */
  for(const id of roster()){
    const p = path.join(__dirname, '..', 'public/characters/previews/character-'+id+'.png');
    assert.ok(fs.existsSync(p), `no preview for '${id}'`);
    const b = fs.readFileSync(p);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    assert.ok(w >= 256 && h >= 256, `character-${id}.png is ${w}x${h}, too small to be a portrait`);
    assert.ok(h > w, `character-${id}.png is ${w}x${h}: a person is taller than they are wide`);
  }
});

test('a model file exists for everybody in the cast', ()=>{
  for(const id of roster()){
    const p = path.join(__dirname, '..', 'public/characters/models/character-'+id+'.glb');
    assert.ok(fs.existsSync(p), `no model for '${id}'`);
  }
});
