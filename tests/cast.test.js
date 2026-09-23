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
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

function roster(){
  const m = read('public/avatar.js').match(/const IDS\s*=\s*'([a-z]+)'\.split/);
  assert.ok(m, 'avatar.js no longer declares IDS as a string of letters');
  return m[1].split('');
}

test('the cast is Kyle, Mia, Savannah, Carlos and Robin, and Kyle leads', ()=>{
  assert.deepStrictEqual(roster(), ['s','t','u','v','w']);
  const names = read('public/avatar.js').match(/const NAMES\s*=\s*\{([^}]*)\}/);
  assert.ok(names, 'avatar.js still names them');
  assert.match(names[1], /s:'Kyle'/);
  assert.match(names[1], /t:'Mia'/);
  assert.match(names[1], /u:'Savannah'/);
  assert.match(names[1], /v:'Carlos'/);
  assert.match(names[1], /w:'Robin'/);
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
  assert.match(game, /function frozen\(\)[\s\S]{0,600}CHARS\.quickUp/,
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


/* ---------------------------------------------------------------- the cast
   NOTHING CASTS THE PLAYER ANY MORE. RYU used to put every player in Robin
   on the way in and take her off again on the way out, so the one ball
   where the story happens quietly replaced whoever a student had spent six
   missions becoming. She is on the roster now and the worlds leave you
   alone; if you want to be her, you choose her.

   The machinery stays, because a place is still ALLOWED to hand out a body
   and the rule that mattered about it still matters: it may never do so by
   writing to the save bag, because the choice is the player's. */
test('Robin is chosen like anybody else, and no world casts her', ()=>{
  const avatar = read('public/avatar.js');
  assert.ok(roster().includes('w'), 'Robin is off the roster again: she cannot be chosen');

  assert.match(avatar, /const BODIES = CHARS\.concat\(/, 'BODIES is the roster plus any cast-only bodies');
  assert.match(avatar, /const def = bodyDef\(id\);/,
    'load() resolves through BODIES, or a cast-only body comes back as Kyle');
  assert.match(avatar, /BODIES\.some\(c=>c\.id===id\)/,
    'setCast accepts a body that is not on the roster');

  /* AND NO WORLD SETS ONE. A `cast` on RYU is the old behaviour returning:
     it would put every player in Robin again and the name in the dialogue
     would stop being theirs. */
  const planet = read('public/planet.js');
  const bare = planet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  assert.ok(!/cast:\s*'w'/.test(bare), "RYU casts Robin again: the player's own character is taken off them");
  const house = read('public/house.js').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  assert.ok(!/setCast\('w'\)/.test(house), 'the house casts Robin again');
  assert.match(house, /setCast\(null\)/,
    'the house leaves whatever cast the last world set, which is the old behaviour with extra steps');

  /* Nothing that offers a CHOICE may read BODIES. Each of these builds a
     grid, a price list or a picker out of the roster, and a character in one
     of them is a character somebody can become without going to RYU. */
  for(const f of ['chars.js','shop.js','menu.js']){
    const src = read('public/' + f);
    assert.ok(!/AVATAR\.BODIES/.test(src),
      `${f} picks from BODIES: Robin is choosable there`);
  }
  /* And the dashboard, which shows the body rather than the choice, must
     read the wider list or it cannot name her at all. */
  assert.match(read('public/planet.js'), /AVATAR\.bodyDef\(AVATAR\.bodyOf\(AVATAR\.chosen\)\)/,
    'the dashboard names the body you are in, cast or not');

  const fs2 = require('fs');
  for(const f of ['public/characters/models/character-w.glb',
                  'public/characters/previews/character-w.png'])
    assert.ok(fs2.existsSync(path.join(__dirname, '..', f)), f + ' is installed');
});

test('a world can cast everybody without touching what they chose', ()=>{
  const avatar = read('public/avatar.js');
  assert.match(avatar, /function setCast\(/, 'AVATAR can be told who everybody is here');
  assert.match(avatar, /const bodyOf = id => cast \|\| id/,
    'and resolves any character through it');
  /* The body that gets attached is the resolved one, not the chosen one —
     otherwise the cast is a value nothing reads. */
  assert.match(avatar, /load\(bodyOf\(chosen\)\)/,
    'your own body goes through the cast');

  const setCast = avatar.slice(avatar.indexOf('function setCast('),
                               avatar.indexOf('function other('));
  assert.ok(!/PROGRESS\.set|localStorage\.setItem/.test(setCast),
    'setCast writes to the save bag: a visit would sell the player their own character');

  const planet = read('public/planet.js');
  assert.match(planet, /AVATAR\.setCast\(W\.cast \|\| null\)/,
    'entering a world puts its cast on, and entering one without a cast takes it off');
  assert.match(planet, /AVATAR\.bodyOf\(p\.char\)/,
    'everybody else on the ball is resolved through the cast too');
});

test('RYU has one door, and it is the Ion station on the floor of Mission Control', ()=>{
  const planet = read('public/planet.js');
  const world = planet.match(/const RYU_WORLD=\{[\s\S]*?\n  \};/);
  assert.ok(world, 'planet.js still declares RYU');
  assert.match(world[0], /cast:'w'/, 'RYU casts Robin');
  assert.match(world[0], /mission:'hub'/, 'RYU is not declared a mission world');
  assert.match(planet, /const WORLDS = \(\)=>\[[^\]]*RYU_WORLD/, 'RYU is in WORLDS');
  assert.match(planet, /id==='ryu' \? RYU_WORLD/, 'and worldById can find it');

  /* THE TRAP THIS CLOSES, and it is the one the shuttle used to be here to
     close in the other direction. RYU had a pad with a LAUNCH sign on it
     pointed at Wano, so the story had two front doors and two ways out —
     and a student could walk into it halfway through, or wander off it
     mid-scene, with no idea either had happened. One door now. */
  assert.ok(!/shuttle:\s*true/.test(world[0]), 'RYU still declares a shuttle');
  assert.ok(!/\bpad:\s*\{/.test(world[0]), 'RYU still declares a launch pad');
  assert.ok(!/course:/.test(world[0]), 'RYU still charts a course off itself');
  /* And no other world charts a course TO it. */
  for(const m of planet.matchAll(/course:'([a-z]+)'/g))
    assert.notStrictEqual(m[1], 'ryu', 'a world still flies to RYU');
  /* And the panel that lists what is here does not offer one either. */
  assert.match(planet, /\.concat\(W\.pad \?/,
    'the objective list still advertises a pad on every world, including the ones without one');
  /* Nothing launches from a mission even if something calls travel(). */
  assert.match(planet, /function travel\(to\)\{[\s\S]{0,600}?if\(W\.mission\)\{/,
    'travel() will still fly you off a mission world');

  /* THE ONE DOOR. The station on the wall of Mission Control, and it is the
     station that opens the house — an id use() does not know is dropped on
     the floor, so this is not optional decoration. */
  const menu = read('public/menu.js');
  assert.match(menu, /ion:'Mission 8/, 'the mission has a name wherever missions are named');
  /* NOT ON THE WALL ANY MORE, and that is deliberate. Mission Control was
     trimmed to the two rooms built on the current block language (the ring
     and Pong) because the older rooms disagree with them about which
     letter points where. Ion is still a mission, still dispatched, still
     on the page — it is just not what a student is pointed at from the
     hall. What has to stay true is that the door still opens. */
  assert.ok(!/\{ id:'ion',/.test(planet.slice(planet.indexOf('const STATIONS=['),
                                              planet.indexOf('const dirOf='))),
    'Ion is back on the wall — if that is wanted, this test is the thing to change');
  assert.match(bare(read('public/game.js')), /id==='ion'/,
    'and now it cannot be reached at all: nothing dispatches it');
  /* THE STATION OPENS THE HOUSE, which is the whole shape of this
     mission: you start inside, with Ion on the kitchen floor, and RYU is
     somewhere you only reach by walking out of the front door. The branch
     grew a restart and a cold open in front of that; what matters here is
     still that the house is where it ends up. */
  const ion=bare(read('public/game.js'));
  const branch=ion.slice(ion.indexOf("if(id==='ion'){"), ion.indexOf("if(id==='ion'){")+700);
  assert.match(branch, /HOUSE\.enter\(\)/, 'the station does not open the house');
  /* AND NOT ON THE WAY IN. Landing every student on RYU put a story in
     front of everybody who opened Koro whether they had come for it or
     not. The front door of the game is Wano. */
  assert.match(menu, /PLANET\.enter\(NET\.signedIn \? world : null, where \|\| PLANET\.lastWorld\(\)\)/,
    'entering the game no longer asks where to land');
});

test('leaving the Robin Ryu mission comes out at Mission Control', ()=>{
  /* EVERY OTHER MISSION IN THIS GAME COMES OUT IN THE SAME PLACE — the
     door of Mission Control on Wano — because the hub is the one world
     PLANET refuses to restore a saved spot on. RYU used to be the
     exception by accident: LEAVE stepped you out of the house onto the
     planet, and pressing it again rebuilt the world you were standing on,
     which was RYU. There was no way out of the mission at all. */
  const planet = read('public/planet.js');
  assert.match(planet, /const leaveTo = \(\) => \(W && W\.mission\) \|\| null;/,
    'planet.js no longer says where a mission hands you back to');
  assert.match(planet, /lastWorld, leaveTo,/, 'and does not export it');

  const game = read('public/game.js');
  assert.match(game, /MENU\.homeworld\(PLANET\.leaveTo && PLANET\.leaveTo\(\)\)/,
    'LEAVE does not ask the world where it hands you back to');
  assert.ok(!/HOUSE\.active && HOUSE\.outside/.test(game),
    'LEAVE still steps out of the front door instead of leaving the mission');
  /* The front door is still a door, and it is still E. */
  assert.match(read('public/house.js'), /atDoor\(\) && !\(window\.SCENE && SCENE\.active\)\) outside\(\)/,
    'E at the front door no longer goes outside');

  /* AND A MISSION IS NEVER WHAT YOU COME BACK TO. Signing in resumes the
     ball you were last on; a story you were half way through is not one. */
  assert.match(planet, /if\(!W\.mission\) PROGRESS\.set\('world', W\.id\)/,
    'a mission world is written to the save bag as somewhere you live');
  assert.match(planet, /return \(w && !w\.mission\) \? id : 'hub';/,
    'lastWorld() would still hand back a mission world');
});

test('Robin has every clip the rig can drive', ()=>{
  /* The five characters share one skeleton and one set of names, and
     rig.play() leaves the current clip alone when it cannot find the one it
     was asked for — so a character missing a clip does not fail, it just
     flies in its idle pose and says nothing about why. */
  const fs2 = require('fs');
  const file = path.join(__dirname, '..', 'public/characters/models/character-w.glb');
  assert.ok(fs2.existsSync(file), 'character-w.glb is installed');
  const b = fs2.readFileSync(file);
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const clips = (json.animations || []).map(a => a.name);
  for(const want of ['idle','walk','sprint','jump','dance','fly','swim','salsa','flip'])
    assert.ok(clips.includes(want), `Robin has no '${want}' clip: ${clips.join(', ')}`);
});

test('every way INTO Koro opens on Wano, and no way back does', ()=>{
  /* A class told to meet outside Mission Control was thirty children each
     waking up wherever they last logged out — one on their own home
     planet, one half way through the story on RYU, one in the dark on
     VOLTA. The front door is one door now.

     AND ONLY THE FRONT DOOR. homeworld() is also what every BACK button
     out of a room calls — the mecha bench, the arcade shelf, the wardrobe,
     the pause card's HOME — and a back button that teleports you across
     the system is not a back button. Those pass nothing and get the ball
     they were standing on. */
  const menu = read('public/menu.js');
  const ways = {
    "btnGuest": /#btnGuest'\); if\(guest\) guest\.onclick=\(\)=>\{ homeworld\('hub'\); \}/,
    "btnStart": /#btnStart'\); if\(st\) st\.onclick=\(\)=>\{ NET\.signedIn \? homeworld\('hub'\)/,
    "afterSignIn": /homeworld\('hub'\);\s*\/\/ signing in/
  };
  for(const [name, re] of Object.entries(ways))
    assert.match(menu, re, name+' is a way into Koro that does not land on Wano');

  /* Wano is the hub, and the hub is the one world PLANET refuses to
     restore a saved spot on — which is what makes "the same spawn" true
     rather than merely intended. */
  const planet = read('public/planet.js');
  assert.match(planet, /id:'hub',[^\n]*name:'Wano'/, "the hub is no longer called Wano");
  assert.match(planet, /const back = at \? null : \(W\.kind==='hub' \? null : savedSpot\(W\.id\)\)/,
    'the hub restores a saved spot: entering Koro would land you somewhere different each time');

  /* And the rooms still come back to where they came from. */
  for(const f of ['public/mech.js','public/pit.js','public/arcade.js','public/chars.js'])
    assert.match(read(f), /MENU\.homeworld\(\)/,
      f+' asks homeworld() for a particular world: leaving a room would move the player');
  assert.match(read('public/game.js'), /MENU\.homeworld\(\)/,
    'the pause card sends the player to a world instead of back to their own');
});

test('no NPC anywhere calls the player by a hard-coded name', ()=>{
  /* THE WHOLE POINT OF THE CHANGE. The player arrives as whoever they
     picked, under whatever name they signed in with, so every line that
     names them has to take that name as a parameter. One `who:'Robin'`
     or one "Good morning, Robin" left behind is a cutscene that calls a
     student by somebody else's name, and it will be in the middle of the
     one scene the whole mission was built towards.

     Comments are stripped first: the paragraphs explaining why this
     changed necessarily contain the word, and matching them would make
     this test pass or fail on prose. */
  const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  for(const f of ['house.js','planet.js','scene.js','boolquiz.js','game.js']){
    const code = bare(read('public/'+f));
    assert.ok(!/who:\s*'Robin'/.test(code),
      `${f} still labels a line of dialogue Robin`);
    /* Robin's name inside a spoken string. The player's name arrives as
       {n}; a bare "Robin" in a say() is one somebody forgot. */
    /* CASE-INSENSITIVELY, because E SHOUTS. The line "STAY AWAY FROM THE
       TOWER, ROBIN." was the last one in the game and this test walked
       straight past it for two rounds: it matched `Robin` and E writes in
       capitals. It is also the one line in the story where somebody
       addresses the player directly and by name, which makes it the worst
       one to have missed. */
    const spoken = code.match(/say_?\(\s*'[^']*[Rr][Oo][Bb][Ii][Nn][^']*'|t\(\s*'[^']*[Rr][Oo][Bb][Ii][Nn][^']*'/g);
    assert.strictEqual(spoken, null,
      `${f} has a line of dialogue with Robin's name written into it: ${spoken}`);
  }
});

test('the player has one name and one face, and they come from one place', ()=>{
  const avatar = read('public/avatar.js');
  /* ONE FUNCTION DECIDES. A second copy of "what do we call the player"
     is a second answer, and the place it shows up is halfway through a
     cutscene with two different names in it. */
  assert.match(avatar, /function myName\(\)/, 'nothing decides what to call the player');
  assert.match(avatar, /function myFace\(\)/, 'nothing decides which portrait is the player');
  /* The username wins, because it is the name they chose to be called.
     Without one, the character they picked — never a word like "Guest",
     which would read as "Good morning, Guest." */
  assert.match(avatar, /NET\.me\.display/, 'the signed-in name is not preferred');
  assert.match(avatar, /CHARS\[0\]\.name/, 'there is no last-resort name');

  /* AND THE SCENE BAR ASKS IT RATHER THAN BEING TOLD. */
  const scene = read('public/scene.js');
  assert.match(scene, /const YOU='you'/, 'SCENE has no sentinel for the player');
  assert.match(scene, /AVATAR\.myName/, 'SCENE does not ask who the player is');
  assert.match(scene, /AVATAR\.myFace/, 'SCENE does not ask what the player looks like');
  /* A USERNAME IS NOT TRANSLATED. Every other label goes through the
     string table, which is right for `The Mechanic` and wrong for a
     person: a student called Mia should not find their name swapped for
     the Spanish for Mia. */
  assert.match(scene, /mine \? nameOfYou\(\) : \(b\.who \? say_\(b\.who\) : ''\)/,
    "the player's own name is run through the translation table");
});
