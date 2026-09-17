/* THE HOUSE ON RYU, and the robot on the floor of it.

   Two rooms: one you arrive in, one with Ion in it. Almost everything that
   can go wrong here is silent — a plan that flood-fills into one room
   instead of two still builds, a door id nobody routes is dropped on the
   floor by use(), and a model with no clip in it stands to attention and
   says nothing. So these are the checks that fail loudly instead. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const abs  = f => path.join(__dirname, '..', f);

function plan(){
  const src = read('public/house.js');
  const m = src.match(/const PLAN = \[([\s\S]*?)\];/);
  assert.ok(m, 'house.js no longer declares PLAN as a list of strings');
  return m[1].split('\n')
             .map(l => (l.match(/'([^']*)'/) || [])[1])
             .filter(r => r !== undefined);
}

test('the house is two rooms with a door between them', ()=>{
  const P = plan();
  assert.ok(P.length >= 5, 'the plan is too small to be two rooms');

  /* Flood-fill the walkable tiles, treating a doorway as the edge of a
     room — the same rule BUILDING uses to decide where to hang a lamp. A
     plan that has quietly become one L-shaped room still builds, still
     lights, and is still wrong. */
  const at = (x,z) => (P[z] && P[z][x]) || ' ';
  const room = c => '.SG'.includes(c);
  const seen = new Set(), rooms = [];
  for(let z=0; z<P.length; z++) for(let x=0; x<P[z].length; x++){
    if(seen.has(x+','+z) || !room(at(x,z))) continue;
    const q=[[x,z]], cells=[];
    seen.add(x+','+z);
    while(q.length){
      const [cx,cz]=q.pop(); cells.push(at(cx,cz));
      for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
        const k=(cx+dx)+','+(cz+dz);
        if(seen.has(k) || !room(at(cx+dx,cz+dz))) continue;
        seen.add(k); q.push([cx+dx,cz+dz]);
      }
    }
    rooms.push(cells);
  }
  assert.strictEqual(rooms.length, 2,
    `the plan flood-fills into ${rooms.length} rooms, not 2`);

  const spawnRoom = rooms.filter(r => r.includes('S'));
  const ionRoom   = rooms.filter(r => r.includes('G'));
  assert.strictEqual(spawnRoom.length, 1, 'exactly one room has the spawn in it');
  assert.strictEqual(ionRoom.length, 1, 'exactly one room has Ion in it');
  assert.notStrictEqual(spawnRoom[0], ionRoom[0],
    'Robin spawns in the room Ion is lying in: there is nothing to walk to');

  /* TWO KINDS OF DOOR, AND ONLY ONE OF THEM JOINS ANYTHING. The doorway
     between the rooms has walkable floor on both sides. The front door
     has floor on one side and the outside world on the other — it is how
     you LEAVE, not how you get from one room to the next, and counting
     them together said "two rooms joined by two doors" about a house with
     one internal door in it. */
  const joins = [], exits = [];
  for(let z=0; z<P.length; z++) for(let x=0; x<P[z].length; x++){
    if(at(x,z)!=='D') continue;
    const sides=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>room(at(x+dx,z+dz)));
    (sides.length>1 ? joins : exits).push([x,z]);
  }
  assert.strictEqual(joins.length, 1, 'two rooms joined by exactly one door');

  /* AND THERE IS A FRONT DOOR. The way out used to be a window wall you
     walked at and pressed E, with the prompt saying "go outside" while
     you faced masonry. */
  assert.strictEqual(exits.length, 1, 'the house has no front door, or has more than one');
  /* It is in the spawn room, and on the far side of it from Ion: you wake
     up with his room ahead of you and your own front door behind you. */
  const [, exitZ] = exits[0];
  const [, joinZ] = joins[0];
  const spawnZ = P.findIndex(row=>row.includes('S'));
  assert.ok((exitZ < spawnZ) === (spawnZ < joinZ),
    'the front door is not on the opposite side of the spawn from the inner door');
});

test('Ion is installed, and carries the clip that lays him down', ()=>{
  const file = abs('public/characters/models/ion.glb');
  assert.ok(fs.existsSync(file), 'ion.glb is installed');
  const b = fs.readFileSync(file);
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const clips = (json.animations || []).map(a => a.name);
  assert.ok(clips.includes('breathless'),
    `Ion has no 'breathless' clip (${clips.join(', ') || 'none at all'}) — ` +
    'he would lie in his rest pose, standing to attention on the floor');
  /* AND THE TWO HE IS MOVED INTO. `idle` is what being mended looks like
     and `seizure` is what being hacked looks like; a model shipped
     without either leaves house.js crossfading to nothing, which is a
     robot who stands perfectly still through the whole of it and nothing
     anywhere saying why. */
  for(const c of ['idle','seizure'])
    assert.ok(clips.includes(c),
      `Ion has no '${c}' clip (${clips.join(', ')}) — see "glb files"/README.md`);
  /* He is painted by part rather than by garment, which means vertex
     colours: a mesh that arrived with none is a white robot. */
  const prim = json.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0, 'Ion has no vertex colours — he would render white');
});

test('Ion is a prop, not a body: nobody can wear him', ()=>{
  const avatar = read('public/avatar.js');
  /* By his model and by his NAME, not by the letters i-o-n — avatar.js is
     full of quaternions. */
  assert.ok(!/ion\.glb/.test(avatar),
    'avatar.js loads Ion: he is not a body the roster or a cast can hand out');
  const names = avatar.match(/const (?:NAMES|CAST_NAMES) = \{[^}]*\}/g) || [];
  for(const n of names)
    assert.ok(!/'Ion'/.test(n), 'Ion is named in avatar.js: he would be selectable or castable');
  const ids = avatar.match(/const (?:IDS|CAST_ONLY) = [^;]+;/g) || [];
  assert.strictEqual(ids.length, 2, 'avatar.js still declares IDS and CAST_ONLY');
  /* And the house loads him itself, for the same reason. */
  const house = read('public/house.js');
  assert.match(house, /characters\/models\/ion\.glb/, 'house.js loads Ion directly');
  /* AND WITH THE VERSION ON IT. Models are served with max-age=86400; one
     fetched without ?v= is yesterday's copy for a day, which is how Ion
     came back without the clip he stands up into. */
  assert.match(house, /ion\.glb\?v='\s*\+\s*\(window\.ASSETV/,
    'ion.glb is fetched without ?v=ASSETV: a changed model will not reach anybody');
});

test('Ion is sat on the floor by the skin, never by a Box3', ()=>{
  /* THE BUG THIS EXISTS TO STOP COMING BACK. Mixamo keeps the hips at a
     standing height even in a clip that lays the body flat, so out of the
     box Ion lies down two thirds of a metre in the air. The obvious fix —
     measure his box after a frame and drop him onto the tile — silently
     does nothing useful: Box3.setFromObject transforms a SkinnedMesh's
     geometry bounds by its matrixWorld and never asks the skeleton, so it
     returns the BIND pose's box however the clip has posed him. */
  const src = read('public/house.js');
  assert.match(src, /applyBoneTransform/,
    'the sit is not measured from the skin: a Box3 on a SkinnedMesh is the bind pose');
  const sit = src.slice(src.indexOf('function floorOf('));
  assert.ok(!/setFromObject/.test(sit.slice(0, sit.indexOf('\n  }'))),
    'floorOf() uses setFromObject, which cannot see the pose');
});

test('the house has a door on RYU, a route, and a way out of it', ()=>{
  const planet = read('public/planet.js');
  const world = planet.match(/const RYU_WORLD=\{[\s\S]*?\n  \};/);
  assert.ok(world, 'planet.js still declares RYU');
  assert.match(world[0], /id:'ryuhouse'/, 'the house stands on RYU');

  /* use() drops any id it does not recognise, so a building whose id is
     not in this list is a sign on a wall that swallows the key. */
  assert.match(planet, /const known = id==='ryuhouse'/,
    "use() does not know 'ryuhouse': the door would do nothing");
  assert.match(planet, /if\(id==='ryuhouse'\)\{[\s\S]{0,200}HOUSE\.enter\(\)/,
    'the door opens the house');

  /* And every teardown that stops the other rooms stops this one, or it
     keeps ticking behind the title screen with a robot breathing in it. */
  for(const f of ['public/planet.js','public/game.js','public/menu.js']){
    const src = read(f);
    const trail = (src.match(/TRAIL\.stop\(\)/g) || []).length;
    const house = (src.match(/HOUSE\.stop\(\)/g) || []).length;
    assert.strictEqual(house, trail,
      `${f} stops TRAIL ${trail} time(s) and HOUSE ${house}`);
  }
  assert.match(read('public/game.js'), /HOUSE\.active\) HOUSE\.tick\(dt\)/,
    'nothing drives the house: Ion would not breathe');
  assert.match(read('public/index.html'), /<script src="house\.js\?v=\d+"><\/script>/,
    'house.js is not on the page');
});

/* ------------------------------------------------------- the scene system */
test('a scene hands over to what comes next', ()=>{
  /* THE BUG THIS EXISTS TO STOP COMING BACK. The last beat used to read
     `stop(); if(ctx.end) ctx.end();` — and stop() clears ctx, so that is a
     property read off null. The guard sat outside the try, so the throw
     escaped, the scene ended, and the console never opened. Nothing in the
     console, nothing in the log, and a prompt that answered a keypress by
     doing nothing at all. */
  const src = read('public/scene.js');
  const tail = src.slice(src.indexOf('function enter('), src.indexOf('function aimOf('));
  assert.ok(!/stop\(\);\s*if\(ctx\./.test(tail),
    'the end handler is read off ctx after stop() has cleared it');
  assert.match(tail, /const fin = ctx && ctx\.end;[\s\S]{0,80}stop\(\);/,
    'the end handler has to be held before the scene is torn down');
});

test('SCENE does not shadow the global translation function', ()=>{
  /* strings.js puts a function called `t` on the page. A module-level
     `let t` inside an IIFE shadows it for every line in the file, so
     `window.t ? t(s) : s` tests the function and then calls the number —
     which is what a scene's own beat clock did, and it threw on the very
     first line of dialogue. */
  const src = read('public/scene.js');
  assert.ok(!/^\s*let\s+t\s*[=,]/m.test(src), 'scene.js declares a module-level `t`');
  assert.ok(!/\blet\s+[a-z]+\s*=\s*0,\s*glide/.test(src) || /let clock=0/.test(src),
    'the beat clock is named something other than t');
});

test('the story runs on scenes, and the console is a separate lesson', ()=>{
  const house = read('public/house.js');
  assert.match(house, /SCENE\.play\(story\(\)/, 'the house tells its story in beats');
  assert.match(house, /IONFIX\.open\(/, 'and hands over to the console at the end of it');
  /* The console must not be able to leave the world frozen: it sets
     G.running false on open, so every way out of it has to set it back. */
  const fix = read('public/ionfix.js');
  assert.match(fix, /function close\(\)\{[\s\S]*?G\.running=true;/,
    'closing the console leaves the world frozen');
  /* And routine.js is the thing that decides whether it was fixed — not
     the UI, which is why it can be tested at all. */
  assert.match(fix, /R\(\)\.run\(state\)/, 'the console asks routine.js what happened');
  assert.ok(!/stride===10|times===4|test==='is'\s*&&/.test(fix),
    'ionfix.js marks against an answer key instead of running the program');
  /* AND IT IS WALKED. Three faults handed over at once is not debugging,
     it is guessing — the step on screen is read off the program and the
     block it is about is ringed. */
  assert.match(fix, /R\(\)\.step\(state\)/, 'the console never asks which fault to point at');
  assert.match(fix, /classList\.add\('ring'\)/, 'nothing on screen is ever ringed');
  /* THE CONSOLE'S OWN BLOCKS, not a second drawing of them. .blk and its
     parts are global in index.html and belong to code.js; a panel that
     restyled them would drift away from the shape every other mission
     uses, which is the whole reason a student recognises it. */
  assert.match(fix, /class="blk rep/, 'the program is not drawn as console blocks');
  assert.match(fix, /blk-head|blk-body|blk-foot/, 'the C-blocks do not wrap');
  assert.ok(!/^\s*\.blk\{/m.test(fix), 'ionfix.js restyles .blk instead of using the real one');
});

/* --------------------------------------------------------- the reveal */
test('the hack is something that happens to Ion, not a note about him', ()=>{
  const house = read('public/house.js');
  const mended = house.slice(house.indexOf('function mended()'),
                             house.indexOf('function after()'));
  assert.ok(mended, 'house.js no longer has a mended()');

  /* THE THREE THINGS THAT MAKE IT A SCENE. Take any one of them out and
     it degrades back into what it replaced: somebody reading lines off a
     panel. */
  assert.match(mended, /on:\s*lightsOut/, 'the lights never go');
  assert.match(mended, /I\('fit'\)/, 'he never goes down: the message is delivered standing up');
  assert.match(mended, /lightsBack\(\)/, 'the lights never come back on');

  /* AND HE HAS TO GET BACK UP, or the mission ends with a robot on the
     floor and a brief telling the player to carry him somewhere. */
  assert.match(mended, /I\('rise'\)/, 'he is left seizing on the floor');

  /* THE VOICE IS NOT HIS, and the way the player is told that is the
     portrait going away — FACES has no entry for it, on purpose. */
  assert.match(mended, /who:'\?\?\?'/, 'the message comes out in Ion\'s own name');
  const faces = house.slice(house.indexOf('const FACES'), house.indexOf('function prompt_'));
  assert.ok(!/\?\?\?/.test(faces), 'the voice has a portrait: it would read as Ion saying it');

  /* HE SAYS WHAT HAPPENED TO HIM, in his own words, afterwards — the
     whole reason this is worth a seizure is that the fact lands on him
     and not on a student reading a diff. */
  assert.match(mended, /hacked/i, 'nobody ever says his code was hacked');
  assert.match(mended, /Mechanic/, 'he never says where to take him');

  /* AND THE LIGHTS ARE HANDED BACK. G.sun, G.amb and G.hemi are the
     page's, not this room's; walking out mid-flicker used to be a planet
     at dusk for no reason. */
  assert.match(house, /function stop\(\)\{[\s\S]{0,400}?lightsRestore\(\);[\s\S]{0,40}L=null/,
    'stop() drops L before putting the intensities back, so nothing is put back');
});

test('the console hands the story over and keeps none of it', ()=>{
  /* It used to hold the screen for five and a half seconds after a
     working RUN while a student read five commented-out lines. The
     console is a lesson; the reveal is the room's. */
  const fix = read('public/ionfix.js');
  assert.ok(!/r\.note/.test(fix), 'the console still draws a note');
  assert.ok(!/5600/.test(fix), 'the console still holds the screen to be read');
  assert.match(fix, /onFixed/, 'the console never tells the house it worked');
  assert.ok(!/note/.test(read('public/routine.js').replace(/\/\*[\s\S]*?\*\//g,'')),
    'routine.js still carries a note through the interpreter');
});

test('the story leads her out of the door; it does not put her outside', ()=>{
  /* THE BUG THIS EXISTS TO STOP COMING BACK. after() used to call
     outside(), which tears the house down and rebuilds RYU with Robin
     standing on it — so the scene ended in the second room and the next
     frame was the planet. The one piece of geography this mission has
     (a front door, and the ship parked outside it) was never something
     anybody did, only something that happened to them. */
  const house = read('public/house.js');
  const after = house.slice(house.indexOf('function after()'),
                            house.indexOf('function brief('));
  assert.ok(after, 'house.js no longer has an after()');
  assert.ok(!/outside\(\)/.test(after),
    'the end of the story still teleports her onto the planet');
  assert.match(after, /askOut=true/, 'nothing points her at the door');
  assert.match(after, /faceDoor\(\)/, 'she is not even turned to face the way out');

  /* AND THE PROMPT HAS TO LEAD HER, from anywhere in the house — the door
     is two rooms away from where the scene leaves her. */
  assert.match(house, /L\.askOut\) prompt_\(atDoor\(\) \? say\('E \\u2014 go outside'\) : say\('Back to the front door'\)\)/,
    'the way out is not signposted from the far room');

  /* THE DOOR IS A DOOR, whatever the story is pointing at. `askOut` used
     to also GATE it, so the one moment the game most wanted her to leave
     was the one moment E at the door did nothing. */
  const keyAt = house.indexOf('function onKey(');
  /* The CODE of onKey, not its commentary — the paragraph inside it is
     about askOut not gating the door, and says the word to say so. */
  const key = house.slice(keyAt, house.indexOf('/* =====', keyAt))
                   .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/askOut/.test(key), 'askOut gates the front door instead of labelling it');
  assert.match(key, /atDoor\(\) && !\(window\.SCENE && SCENE\.active\)\) outside\(\)/,
    'E at the front door does not open it');

  /* And what she is walking TOWARDS is named on both sides of it. */
  assert.match(house, /const ERRAND = [\s\S]{0,200}front door/, 'the errand does not name the door');
  assert.match(house, /const ATSHIP = [\s\S]{0,200}E-45/, 'nothing tells her where the ship is');
  assert.match(house, /if\(sent\) setTimeout/, 'the errand does not survive the trip outside');
});

test('the hacker says three things and none of them is jargon', ()=>{
  /* IT WAS A CHANGELOG. "PATCHED 04:12. THIS LINE IS NOT IN HIS LOG." is a
     timestamp, a verb out of version control and a noun for a file nobody
     has explained, all before the first full stop — and the line after it
     asked about the rover's spare CELLS, which have not existed since the
     rover was retired. The most confusing sentence in the game was
     pointing at something that was not there any more. */
  const house = read('public/house.js');
  const mended = house.slice(house.indexOf('function mended()'),
                             house.indexOf('WHAT IS NEXT'));
  /* The source spells its em-dashes and quotes as \uXXXX escapes, so the
     text a player reads is not the text a regex over the FILE sees. */
  const unesc = t => t.replace(/\\u([0-9a-fA-F]{4})/g,
                              (_,h)=>String.fromCharCode(parseInt(h,16)));
  /* A LINE MAY CARRY A PARAMETER NOW. E addresses the player by name, so
     that one is `say_('... {n}.', {n:...})` and a pattern demanding the
     closing bracket straight after the string walked past it — which is
     how this test reported the tower warning as missing when it was
     there. Match the string and stop; what follows it is not this test's
     business. */
  const lines = [...mended.matchAll(/say_\('([^']*)'/g)].map(m=>unesc(m[1]));
  const said = lines.join(' ');

  for(const dead of ['04:12', 'PATCHED', 'LOG', 'CRATE', 'CELLS'])
    assert.ok(!said.includes(dead),
      `the reveal still says "${dead}" — jargon, or a thing the game no longer has`);

  /* THREE FACTS AND A SIGNATURE. Take any one out and the mission stops
     making sense: why he fell over, why he cannot just check himself, and
     where he is asking to be taken. */
  assert.match(said, /changed (his|my) code/i, 'nobody says what was actually done to him');
  assert.match(said, /not remember|will not remember/i, 'nobody says he cannot remember it');
  assert.match(said, /TOWER/, 'the warning about the tower is gone');
  assert.match(said, /\u2014 E\./, 'it is not signed');
  assert.match(said, /Mechanic/, 'he never asks to be taken anywhere');

  /* AND THE SENTENCES ARE SHORT. Nothing here should need reading twice;
     the old version had a sixteen-word line about being the thing doing
     the reading. */
  const long = lines.filter(l => l.replace(/<[^>]+>/g,'').split(/\s+/).length > 19);
  assert.deepStrictEqual(long, [], 'a line of the reveal is too long to read once');
});
