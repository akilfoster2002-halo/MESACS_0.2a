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

test('the cast is Kyle, Mia and Savannah, and Kyle is the one you start as', ()=>{
  assert.deepStrictEqual(roster(), ['s','t','u']);
  const names = read('public/avatar.js').match(/const NAMES\s*=\s*\{([^}]*)\}/);
  assert.ok(names, 'avatar.js still names them');
  assert.match(names[1], /s:'Kyle'/);
  assert.match(names[1], /t:'Mia'/);
  assert.match(names[1], /u:'Savannah'/);
  /* The default is CHARS[0] rather than a random pick, and CHARS is built
     from IDS in order — so "Kyle leads" is a fact about the string above. */
  assert.match(read('public/avatar.js'), /chosen = CHARS\[0\]\.id/,
    'a new player is the first character in the roster');
});

test('all of them are free, and all of them are in the Mall', ()=>{
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

/* ------------------------------------------------------------------------
   A CHARACTER WHO CANNOT MOVE. Savannah arrived as a T-pose out of Mixamo —
   one "animation" with two keys in it, which is the bind pose and not a
   clip. Dropped in as she was she would have stood frozen with her arms out
   while the walk played on nobody, and nothing anywhere would have said so.

   These read the glb's own JSON, which is enough to know whether a
   character can stand, walk, run, jump and dance without opening a browser. */
function gltf(id){
  const b = fs.readFileSync(path.join(__dirname,'..',
    'public/characters/models/character-'+id+'.glb'));
  let off=12, json=null;
  while(off < b.length){
    const len=b.readUInt32LE(off), type=b.readUInt32LE(off+4);
    if(type===0x4E4F534A) json=JSON.parse(b.slice(off+8, off+8+len).toString('utf8'));
    off += 8+len;
    if(!len) break;
  }
  assert.ok(json, 'character-'+id+'.glb has no JSON chunk');
  return json;
}
const NEEDED = ['idle','walk','sprint','jump','dance'];

test('everybody in the cast has every clip the game plays', ()=>{
  for(const id of roster()){
    const g = gltf(id);
    const got = (g.animations||[]).map(a=>a.name);
    for(const want of NEEDED)
      assert.ok(got.includes(want),
        `character-${id}.glb has no '${want}' clip — it has [${got.join(', ')}]`);
  }
});

test('everybody is skinned, painted, and stored at the same scale', ()=>{
  for(const id of roster()){
    const g = gltf(id);
    const prim = g.meshes[0].primitives[0];
    for(const attr of ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0','COLOR_0'])
      assert.ok(attr in prim.attributes,
        `character-${id}.glb has no ${attr}: `+
        (attr==='COLOR_0' ? 'it was never painted' : 'it cannot be posed'));
    assert.ok(g.skins && g.skins.length, `character-${id}.glb has no skin`);
    /* THE SCALE HAS TO AGREE ACROSS THE CAST, because the clips do not
       carry one. Every character is stored at a hundredth of life size
       with the hundred on the scene root — that is what FBX2glTF writes
       and what every clip in "glb files"/rig/ is measured against. Ship one
       at life size and the rotations still play, so it walks: with the bob
       and the jump arc flattened to a hundredth of themselves. */
    const root = g.nodes[g.scenes[g.scene||0].nodes[0]];
    assert.deepStrictEqual(root.scale, [100,100,100],
      `character-${id}.glb has root scale ${JSON.stringify(root.scale)}, not [100,100,100]`);
  }
});

/* ------------------------------------------------------------------------
   AND A WAY TO SWAP THAT IS NOT A WALK. The Mall is a building on a planet;
   changing who you are is something a child does ten times a lesson. */
test('the quick change is wired to a key, a button and the freeze', ()=>{
  const game = read('public/game.js');
  assert.match(game, /e\.code==='KeyB'[\s\S]{0,120}CHARS\.quickToggle\(\)/,
    'B no longer opens the quick change');
  assert.match(game, /CHARS\.quickUp && CHARS\.quickKey\(e\)/,
    'the panel no longer takes the keyboard while it is up');
  assert.match(game, /function frozen\(\)[\s\S]{0,240}CHARS\.quickUp/,
    'the world no longer holds still while the panel is up — you would walk off blind');
  assert.match(game, /on\('#btnWho'/, 'the HUD button is gone, so only a hotkey opens it');
  const html = read('public/index.html');
  for(const id of ['swap','swapRow','swapView','swapTitle','swapHint','btnWho'])
    assert.ok(html.includes('id="'+id+'"'), `the page has no #${id} for the quick change`);
  const chars = read('public/chars.js');
  assert.match(chars, /quickOpen, quickClose, quickToggle, quickKey/,
    'chars.js no longer exports the quick change');
  /* One context for the row, not one per tile: a canvas each is a WebGL
     context each, and the browser starts dropping the oldest at about
     sixteen — which is the planet's own canvas going white. */
  assert.ok((chars.match(/new THREE\.WebGLRenderer/g)||[]).length <= 3,
    'chars.js is making a renderer per character again');
  assert.match(chars, /setScissorTest\(true\)/,
    'the row is no longer drawn through scissor rectangles');
});
