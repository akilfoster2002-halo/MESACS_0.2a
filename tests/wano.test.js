/* WANO — the roofs, the buildings and the sky islands.

   Everything here is a NUMBER that cannot be checked by looking. A roof you
   fall through looks exactly like a roof. A waterfall landing inside Mission
   Control looks, from the air, like a waterfall. An island above the flight
   ceiling looks like an island — right up until a child spends a minute
   climbing towards one they can never reach.

   So these are the arithmetic checks a playthrough would not make. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* islands.js touches no THREE at load — it is constants and function
   declarations and nothing else until build() is called — so the island
   table can be read under Node. */
function loadIslands(){
  const ctx={ window:{} };
  vm.createContext(ctx);
  vm.runInContext(read('public/islands.js'), ctx);
  return ctx.window.ISLANDS;
}
const ISLANDS = loadIslands();

/* The hub's buildings, read out of planet.js rather than copied, so moving
   one moves the thing these tests measure against. */
function hubBuildings(){
  const src=read('public/planet.js');
  const tbl=src.slice(src.indexOf('const HUB_BUILDINGS=['));
  const body=tbl.slice(0, tbl.indexOf('\n  ];'));
  const out=[];
  for(const m of body.matchAll(
      /\{ id:'([a-z]+)',[^}]*?lon:\s*(-?\d+),\s*lat:\s*(-?\d+),\s*w:(\d+),\s*d:(\d+)/g)){
    out.push({ id:m[1], lon:+m[2], lat:+m[3], w:+m[4], d:+m[5] });
  }
  return out;
}
const PR = (()=>{
  const m=read('public/planet.js').match(/radius:320/);
  assert.ok(m, 'the hub is no longer radius 320 — these clearances assume it');
  return 320;
})();
const CEILING = (()=>{
  const src=read('public/planet.js');
  const hub=src.slice(src.indexOf("id:'hub'"));
  return +hub.match(/ceiling:(\d+)/)[1];
})();

// great-circle distance between two lon/lat, in metres on the hub
const apart = (a,b) =>
  Math.hypot(a.lon-b.lon, a.lat-b.lat) * Math.PI/180 * PR;

/* ------------------------------------------------------------- roofs */

test('a roof is a surface you can stand on', ()=>{
  const src=read('public/planet.js');
  /* floorAt has to be able to answer with the LID, which means it has to
     know how high up you are — the version that took only a direction could
     only ever answer with the ground floor. */
  assert.match(src, /function floorAt\(dir, alt\)/,
    'floorAt no longer takes an altitude, so it cannot tell a roof from a floor');
  assert.match(src, /const roofTopOf = b =>/, 'nothing works out where a lid is');
  assert.match(src, /onRoofPlan\(b,l\.x,l\.z\)/,
    'floorAt does not check whether you are over the footprint');
  // and the callers have to pass it, or the parameter is decoration
  for(const call of ['floorAt(me.dir, me.alt)'])
    assert.ok(src.includes(call), `nobody calls ${call}`);
});

test('walking off a roof is a fall, not a teleport', ()=>{
  /* A grounded walker is pinned to whatever floorAt last said. Step off a
     nine-metre lid without this and you do not drop — you are simply on the
     grass, one frame later. */
  assert.match(read('public/planet.js'),
    /me\.onGround && floor < me\.alt-0\.6.*\n?.*me\.onGround=false/,
    'stepping off an edge does not start a fall');
});

/* -------------------------------------------------------- the buildings */

test('every building gets a base, corners, eaves, windows and a threshold', ()=>{
  const src=read('public/planet.js');
  assert.match(src, /function dress\(b, g, hw, hd, H, DOOR\)/, 'no exterior dressing');
  assert.match(src, /function indoors\(b, g, hw, hd, H, gap\)/, 'no interior dressing');
  /* Called from build(), which every building on every world goes through —
     not from the branch that furnishes one particular hall. */
  const build=src.slice(src.indexOf('  function build(b){'));
  const upto=build.slice(0, build.indexOf("if(b.id==='missions')"));
  assert.match(upto, /dress\(b, g, hw, hd, H, DOOR\);/, 'build() never dresses the outside');
  assert.match(upto, /indoors\(b, g, hw, hd, H, gap\);/, 'build() never dresses the inside');
  /* THE RAIL AND THE SKIRTING MUST BREAK AT THE DOOR. They ran the full
     width of every wall, and the front wall of a building with a doorway in
     it is two walls — so both of them crossed the opening and walking in
     meant walking through a stick at chest height. */
  assert.match(src, /const side=\(b\.w-gap\)\/2;\s*\/\/ the front, either side/,
    'the interior trim runs straight across the doorway again');
});

test('no hall is left empty', ()=>{
  /* Five of the six hub buildings furnished themselves and the Workshop did
     not — it was four walls and a sign, which is what a room looks like
     before anybody moves in. */
  const src=read('public/planet.js');
  assert.match(src, /function workshopRoom\(g, b, hw, hd\)/, 'the workshop has no furniture');
  assert.match(src, /b\.id==='workshop'/, 'the workshop branch is not wired into build()');
  for(const id of ['missions','workshop','mall','mechanic','library'])
    assert.ok(src.includes(`b.id==='${id}'`), `${id} has no interior of its own`);
});

/* ------------------------------------------------------- the sky islands */

test('every island is inside the flight ceiling', ()=>{
  /* The ceiling is measured off the ground, and an island you cannot climb
     to is worse than no island: it is a minute of a child pressing Space. */
  for(const k of ISLANDS.ISLES){
    const crown = k.alt + k.r*0.10;
    assert.ok(crown < CEILING-6,
      `${k.id}'s deck is at ${crown.toFixed(0)}m and the ceiling is ${CEILING}m — ` +
      `you could never land on it`);
  }
});

test('the islands do not sit on top of each other', ()=>{
  const L=ISLANDS.ISLES;
  for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){
    const d=apart(L[i],L[j]);
    if(Math.abs(L[i].alt-L[j].alt) > 14) continue;   // one is safely over the other
    assert.ok(d > L[i].r+L[j].r,
      `${L[i].id} and ${L[j].id} are ${d.toFixed(0)}m apart at the same height ` +
      `and their radii add to ${(L[i].r+L[j].r).toFixed(0)}`);
  }
});

test('the waterfall lands in open country, not inside a building', ()=>{
  /* THE ONE THAT ACTUALLY HAPPENED. The falls were first placed sixty metres
     from Mission Control, whose own half-diagonal is thirty-nine, with a
     pool twenty-five across — so the water came down through the castle and
     you landed in the gate. */
  const falls=ISLANDS.ISLES.find(k=>k.fall);
  assert.ok(falls, 'no island carries the waterfall any more');
  const poolR = falls.r*0.72;
  for(const b of hubBuildings()){
    const clear = apart(falls,b) - Math.hypot(b.w,b.d)/2 - poolR;
    assert.ok(clear > 5,
      `the plunge pool overlaps ${b.id} by ${(-clear).toFixed(0)}m`);
  }
});

test('the lake is shallow enough to wade and sits below its own shore', ()=>{
  /* A metre of water is paddling. Three is drowning, and there is no
     swimming in this game. The shore has to be the higher of the two or the
     lake pours out over the grass. */
  const src=read('public/islands.js');
  const bed=src.match(/bed:\s*crownY\(k, 0\.10\) - k\.r\*([\d.]+)/);
  const top=src.match(/const surface = LAKE\.bed \+ k\.r\*([\d.]+)/);
  assert.ok(bed && top, 'the lake no longer states its own depth');
  const depth=+top[1], drop=+bed[1];
  assert.ok(depth < drop,
    `the water stands ${depth} of a radius above a bed cut only ${drop} deep — ` +
    `it would sit proud of the shore and run away`);
  const falls=ISLANDS.ISLES.find(k=>k.fall);
  assert.ok(falls.r*depth < 1.4,
    `${(falls.r*depth).toFixed(2)}m of water is over a child's head`);
});

test('the ground you stand on is the ground you can see', ()=>{
  const src=read('public/islands.js');
  /* One table of numbers, read by the mesh AND by the collision. They were
     two, and the deck was flat while the crown domed — so walking out from
     the middle left you hovering over your own shadow. */
  assert.match(src, /const CROWN=\[/, 'the crown profile is gone');
  assert.match(src, /\.\.\.CROWN\.map/, 'the lathe no longer uses the crown profile');
  assert.match(src, /crownY\(k, off\/k\.r\)/, 'floorAt no longer follows the crown');
  /* and the lake is a hole in that deck, or the fish swim under your shoes */
  assert.match(src, /top = k\.alt \+ is\.bed/, 'the lake is not a hole in the deck');
});

test('the swarm of islands is wired into the planet it hangs over', ()=>{
  const src=read('public/planet.js');
  assert.match(src, /ISLANDS\.build\(\{ id:W\.id/, 'nothing builds the islands');
  assert.match(src, /ISLANDS\.tick\(dt\)/, 'the falls never run');
  assert.match(src, /ISLANDS\.clear\(\)/, 'the islands are never torn down');
  assert.match(src, /ISLANDS\.floorAt\(dir, alt\)/, 'you cannot land on them');
  assert.match(src, /ISLANDS\.blocked\(dir, me\.alt\)/, 'you can fly through them');
  /* NOT window.SKY. planet.js keeps the world's sky COLOUR in a variable of
     that name, which shadows any global called SKY inside its own closure —
     the first version of this module was answered with a number. */
  assert.ok(!/window\.SKY\b/.test(src), 'the module is being reached for as SKY again');
  assert.match(read('public/index.html'), /src="islands\.js/, 'islands.js is not loaded');
});

test('the islands belong to Wano and nowhere else', ()=>{
  /* VOLTA is a rock with two buildings on it and a home planet is somebody's
     own; a set of floating gardens over either is a different game. */
  assert.match(read('public/islands.js'), /W\.id!=='hub'/,
    'the islands no longer check which world they are on');
});

/* ------------------------------------------------------- the waterfall
   Three of these are bugs that shipped and had to be pointed out, and all
   three look plausible in a still frame. A screenshot cannot tell you which
   way water is moving, whether a river is one river or nine puddles, or
   that a turtle is on rails. */

test('the water falls downwards', ()=>{
  /* THE SIGN THAT WAS WRONG. A texture is sampled at uv*repeat + offset, so
     a streak painted at v is drawn wherever uv = (v - offset)/repeat.
     DECREASE the offset and that quotient rises — which is what the first
     build did, and sixty metres of water appeared to be climbing back up
     onto the island. */
  const src=read('public/islands.js');
  assert.match(src, /sh\.mat\.map\.offset\.y \+= sh\.speed\*dt/,
    'the falls scroll their texture the wrong way — the water will run upwards');
  assert.ok(!/offset\.y -= .*speed/.test(src),
    'something still scrolls a falling surface upwards');
  /* and the droplets, which are the unambiguous half: they must be driven
     from the top of the drop towards zero */
  assert.match(src, /a2\.array\[i\*3\+1\]=u\.drop\*\(1-k\)/,
    'the droplets do not fall from the lip to the pool');
});

test('the falls are a column with a lip, not a rectangle in mid-air', ()=>{
  const src=read('public/islands.js');
  assert.match(src, /function sheetGeo\(wTop, wBot, h\)/,
    'the sheets are plain rectangles again — falling water spreads');
  assert.match(src, /wBot=wTop\*1\.55/, 'the column no longer widens as it falls');
  assert.match(src, /lipM/, 'there is no lip, so the water starts falling in mid-air');
  assert.match(src, /rings\.forEach/, 'nothing marks where the water lands');
});

test('the water leaves the pool along a river', ()=>{
  /* A waterfall ending in a round pool is a bath. */
  const src=read('public/islands.js');
  assert.match(src, /function river\(startDir, startY, poolR\)/, 'there is no river');
  assert.match(src, /river\(base, groundY\+surfY, pr\)/, 'the pool never feeds it');
  /* Steepest descent over the REAL terrain, not a painted curve. */
  assert.match(src, /W\.terrainH\(cand\)/, 'the river does not follow the ground it is on');
  assert.match(src, /Math\.abs\(off\)\*0\.45/,
    'the straight-on bias is gone — pure steepest descent zig-zags on noise');
});

test('the river is sampled finely enough to stay in one piece', ()=>{
  /* The ribbon is a flat quad between one sample and the next and the ground
     between them bulges. At nine metres the hills cut through the water and
     the river came out as a row of disconnected puddles. */
  const src=read('public/islands.js');
  const step=+src.match(/const STEP=(\d+);/)[1];
  assert.ok(step<=5, `the river samples every ${step}m — the terrain will poke through it`);
  const lift=+src.match(/W\.PR \+ up\[i\] \+ ([\d.]+)\)/)[1];
  assert.ok(lift>=0.25, `the ribbon is laid only ${lift}m over the grass`);
});

test('the turtles are not on rails', ()=>{
  /* They used to advance one angle around a fixed radius, which reads as a
     circle within about two seconds. A turtle picks somewhere, walks to it,
     and then stops for a while and does nothing — which is most of what a
     turtle does. */
  const src=read('public/islands.js');
  assert.ok(!/tt\.a \+= tt\.spd\*dt/.test(src), 'the turtles still orbit the lake');
  assert.match(src, /if\(tt\.rest>0\)/, 'a turtle that never rests is a machine');
  assert.match(src, /aim\(tt, 1\.16\)/, 'the turtles have nowhere they are going');
  assert.match(src, /function aim\(c, band\)/, 'nothing picks a new destination');
  // the legs must stop when the turtle does, or it paddles on the spot
  const body=src.slice(src.indexOf('turtles.forEach'));
  const rest=body.slice(0, body.indexOf('const dx=tt.tx'));
  assert.ok(!/userData\.legs/.test(rest), 'a resting turtle still works its legs');
  // and the fish got the same treatment
  assert.ok(!/f\.a \+= f\.spd\*dt/.test(src), 'the fish still swim in circles');
});

/* --------------------------------------------------------- swimming
   The plunge pool is fed by sixty metres of falling water, so it is deep —
   and deep water is neither a floor nor a fall. Both of the ways that goes
   wrong are silent: you stand on the bottom with the surface over your head,
   or you are put into a swimming pose to cross a puddle. */

test('the plunge pool is deep enough to swim in', ()=>{
  const src=read('public/islands.js');
  const d=+src.match(/const POOL_DEPTH=([\d.]+);/)[1];
  assert.ok(d>=6, `a ${d}m pool is a paddling pool — you would stand in it`);
  /* THE SURFACE IS SET FROM THE RIM, not from the middle of the pool. A
     basin dug out of a hillside has a rim that follows the hill, and water
     levelled to the centre stands proud of the low side and runs out of it. */
  assert.match(src, /const rimY = \(W\.basinRim && W\.basinRim\(base\)\)/,
    'the water level is no longer taken from the rim');
  assert.match(src, /\(rimY - 0\.45\) - groundY/,
    'the water is not held below the rim');
});

test('the ground knows where the water is', ()=>{
  const src=read('public/islands.js');
  assert.match(src, /function waterAt\(dir\)/, 'nothing can say where a surface is');
  assert.match(src, /waterAt,/, 'waterAt is not exported, so planet.js cannot ask');
  /* it must answer for the pool AND for the lake up on the island */
  const fn=src.slice(src.indexOf('function waterAt(dir)'));
  const body=fn.slice(0, fn.indexOf('\n  function floorAt'));
  assert.match(body, /return pool\.surface;/, 'the pool has no surface');
  assert.match(body, /k\.alt \+ is\.lake\.y/, 'the sky lake has no surface');
});

test('you float on deep water and wade through shallow', ()=>{
  const src=read('public/planet.js');
  assert.match(src, /const surf = window\.ISLANDS \? ISLANDS\.waterAt\(me\.dir\) : null;/,
    'walking never asks whether there is water underfoot');
  /* THE DEPTH TEST IS THE WHOLE THING. Without it the shallows of a lake
     behave like the middle of one and you are put into a swimming pose to
     cross ankle-deep water. */
  assert.match(src, /\(surf-floor\) > 1\.6/,
    'swimming does not check how deep the water actually is');
  assert.match(src, /AVATAR\.posture\('swim'\)/, 'the body never goes horizontal');
  assert.match(src, /me\.alt \+= \(surf-me\.alt\)\*/,
    'you do not rise to the surface — you would stand on the bottom');
  // and it has to come off again, or you swim across the grass
  assert.match(src, /if\(swimming\)\{ swimming=false; if\(window\.AVATAR\) AVATAR\.posture\(null\); \}/,
    'the swimming posture is never taken off');
});

test('a character with no swim clip still swims', ()=>{
  /* These four characters carry six animations and none of them is a swim.
     The posture asks for one anyway and is given the flying clip, which is
     the same horizontal body — so the feature works today and improves by
     itself the day a real clip is baked in. */
  const av=read('public/avatar.js');
  assert.match(av, /const ALIAS=\{ swim:'fly' \}/, 'there is no fallback for a missing swim clip');
  assert.match(av, /name = ALIAS\[name\] && !clips\.some/, 'the alias is never applied');
});

/* --------------------------------------------------- where you land
   A hub is somewhere you ARRIVE. The door you are being sent to is in front
   of you, the sign over it is readable, and the walk is the same walk every
   time — which is what lets a teacher say "meet me outside Mission Control"
   and have it mean one place. Being put back wherever you logged out is
   right for a world you were exploring and wrong for the one everybody
   starts from. */

test('Wano always lands you at the same spot', ()=>{
  const src=read('public/planet.js');
  /* THE HUB IS STILL THE EXEMPTION, however the line is spelled. A caller
     may now name a landing spot — walking out of the house on RYU comes
     out of the house's own door — and that outranks the bag for one
     arrival; what must never come back is the hub reading a saved one. */
  assert.match(src, /const back = at \? null : \(W\.kind==='hub' \? null : savedSpot\(W\.id\)\);/,
    'the hub restores a saved spot again — every student wakes up somewhere different');
  /* THE LANDING SPOT IS THE THIRD ARGUMENT and the house depends on it —
     both for where it puts you and, since Mission 8 started restarting
     itself on arrival, for telling a door apart from a join. A fourth
     argument was added after it; this only cares that the third is still
     there and still called `at`. */
  assert.match(src, /function enter\(sv, worldId, at\b/,
    'enter() no longer takes a landing spot, so the house has no door');
  /* and it must not WRITE one either: an unread spot is churn on a bag that
     is pushed to the network */
  assert.match(src, /if\(W\.kind!=='hub'\) PROGRESS\.set\(SPOT\(W\.id\)/,
    'the hub is still saving a position nothing reads');
});

test('the worlds you explore still remember where you were', ()=>{
  /* The exemption is the hub's alone. A home planet is yours and VOLTA is
     somewhere you were part-way through looking at; on both of those being
     put back where you were is the entire point. */
  const src=read('public/planet.js');
  assert.match(src, /function savedSpot\(id\)/, 'nothing restores a position any more');
  assert.match(src, /W\.kind==='hub' \? null : savedSpot/,
    'the exemption is not scoped to the hub');
  assert.ok(!/const back = null;/.test(src), 'every world has lost its saved spot');
  /* and which ball you were on is still worth keeping, or signing back in
     always drops you on Wano */
  assert.match(src, /PROGRESS\.set\('world', W\.id\)/, 'the world you were on is not saved');
});

test('the meadow is wired into the planet it grows on', ()=>{
  /* Grass you walk through is a disc round your feet, re-laid as you move —
     so if nothing ticks it, it is a patch where you landed and nowhere else. */
  const src=read('public/planet.js');
  assert.match(src, /MEADOW\.build\(\{[^}]*lushAt/, 'nothing plants the meadow');
  assert.match(src, /MEADOW\.tick\(dt, me\)/, 'the meadow never follows you');
  assert.match(src, /MEADOW\.clear\(\)/, 'the meadow is never torn down');
  assert.match(read('public/index.html'), /src="meadow\.js/, 'meadow.js is not loaded');
  assert.ok(require('fs').existsSync('public/ground/grass_clump.png'), 'the clump picture is missing');
});

test('mission control is the temple, and the temple is wired in', ()=>{
  /* Mission Control is a Blender model now. Its walls and roofs come from
     layout.js — written by the same build as the model — so a hall you can
     walk through the walls of is a missing script tag, not a missing file. */
  const src=read('public/planet.js');
  assert.match(src, /id:'missions'[^\n]*\n[^\n]*temple:true/, 'mission control is not flagged as the temple');
  assert.match(src, /TEMPLE\.build\(b, g, \{ panel, statue, STATIONS, t, signTexture \}\)/, 'nothing builds the temple');
  assert.match(src, /TEMPLE\.tick\(dt\)/, 'the pool and the petals never move');
  assert.match(src, /TEMPLE\.clear\(\)/, 'the temple is never torn down');
  assert.match(src, /b\.roofAt \? b\.roofAt\(l\.x,l\.z\)/, 'you cannot land on its roofs');
  const html=read('public/index.html');
  assert.ok(html.indexOf('src="temple/layout.js')>0 && html.indexOf('src="temple/layout.js') < html.indexOf('src="temple.js'),
    'layout.js has to load before temple.js');
  const fs=require('fs');
  assert.ok(fs.existsSync('public/temple/layout.js'), 'the layout was never built');
  assert.ok(fs.existsSync('public/temple/temple.glb'), 'the model was never built');
});
