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
  assert.match(read('public/house.js'), /characters\/models\/ion\.glb/,
    'house.js loads Ion directly');
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
