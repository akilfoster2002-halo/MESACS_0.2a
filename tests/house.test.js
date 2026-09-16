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

  const doors = P.join('').split('').filter(c=>c==='D').length;
  assert.strictEqual(doors, 1, 'two rooms joined by exactly one door');
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
});
