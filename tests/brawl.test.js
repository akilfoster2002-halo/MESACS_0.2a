/* TWO MACHINES ON THE RIDGE, AND A PAIR OF GLASSES TO SEE THEM WITH.

   The fight is the one thing in this game that is invisible by default,
   which makes it the one thing a broken build cannot show you is broken:
   every failure here looks exactly like "the player has not got the
   glasses yet". So the parts that cannot be seen get asserted instead. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const abs  = f => path.join(__dirname, '..', f);
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

function gltf(file){
  const b=fs.readFileSync(abs(file));
  const len=b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20+len).toString('utf8'));
}
const ROBOTS=['public/characters/models/ambush.glb',
              'public/characters/models/noisyboy.glb'];

/* The clips the choreography actually asks for, read out of brawl.js
   rather than typed here — a list typed twice is a list that disagrees
   with itself the first time somebody changes the fight. */
function roundRows(){
  const src=read('public/brawl.js');
  const block=src.slice(src.indexOf('const ROUND = ['), src.indexOf('];', src.indexOf('const ROUND = [')));
  const rows=[...block.matchAll(/\{\s*a:'([a-z0-9]+)',\s*n:'([a-z0-9]+)',\s*t:([0-9.]+)(,\s*boom:'([an])')?\s*\}/g)];
  return rows.map(m=>({ a:m[1], n:m[2], t:+m[3], boom:m[5]||null }));
}

test('both machines are built, painted and clipped', ()=>{
  for(const f of ROBOTS){
    const J=gltf(f);
    const name=f.replace(/^.*\//,'');
    /* PAINTED, which for this game means vertex colours and not a
       texture — every other character here carries its colour the same
       way, and a robot that arrived as raw grey Mixamo geometry would
       still load, still animate, and still be the wrong robot. */
    const prim=J.meshes[0].primitives[0];
    assert.ok(prim.attributes.COLOR_0!==undefined, name+' was never painted');
    assert.ok(prim.attributes.JOINTS_0!==undefined, name+' lost its skin weights');
    const clips=(J.animations||[]).map(a=>a.name);
    assert.ok(clips.length>=14, name+' has only '+clips.length+' clips');
    /* And nothing the welder or the merger left behind. */
    const reach=new Set();
    for(const m of (J.meshes||[])) for(const pr of m.primitives){
      for(const k in pr.attributes) reach.add(pr.attributes[k]);
      if(pr.indices!==undefined) reach.add(pr.indices);
    }
    for(const s of (J.skins||[])) if(s.inverseBindMatrices!==undefined) reach.add(s.inverseBindMatrices);
    for(const a of (J.animations||[])) for(const sm of a.samplers){ reach.add(sm.input); reach.add(sm.output); }
    const orphans=J.accessors.map((a,i)=>i).filter(i=>!reach.has(i));
    assert.deepStrictEqual(orphans, [], name+' carries '+orphans.length+' dead accessors');
  }
});

test('every clip the fight asks for is on both bodies', ()=>{
  /* THE CHOREOGRAPHY NAMES CLIPS BY STRING and play() returns quietly
     when it cannot find one — which is the right thing for a missing
     emote and a silent disaster here: a row naming a clip that is not on
     the model leaves that machine frozen in whatever it was last doing,
     for as long as the row lasts, and the fight merely looks stiff. */
  const rows=roundRows();
  assert.ok(rows.length>=12, 'the round parsed as only '+rows.length+' rows');
  const want=new Set();
  for(const r of rows){ want.add(r.a); want.add(r.n); }
  for(const f of ROBOTS){
    const have=new Set((gltf(f).animations||[]).map(a=>a.name));
    for(const w of want)
      assert.ok(have.has(w),
        f.replace(/^.*\//,'')+' has no clip called '+w+' — that row would freeze it');
  }
});

test('the round is a loop with both of them still standing', ()=>{
  const rows=roundRows();
  for(const r of rows) assert.ok(r.t>0, 'a row with no duration never advances');
  /* NOBODY WINS, BECAUSE IT LOOPS. A knockout in a thirty-second cycle is
     a machine that dies on the minute, every minute, for as long as the
     student has the glasses on. Both of them get floored and both get up. */
  const floored=rows.filter(r=>r.a==='floored'||r.n==='floored');
  assert.ok(floored.length>=1, 'nobody ever goes down: it reads as sparring');
  assert.ok(rows.some(r=>r.a==='getup'||r.n==='getup'),
    'somebody goes down and nobody gets up — the loop restarts them standing');
  /* And it has to END somewhere it can BEGIN. The last row and the first
     row are both the fighting stance, or the loop point is a cut from a
     kick to a different kick. */
  assert.strictEqual(rows[0].a, 'idle', 'the round does not open in the stance');
  assert.strictEqual(rows[rows.length-1].a, 'idle', 'the round does not close in the stance');
  assert.strictEqual(rows[rows.length-1].n, 'idle', 'the round does not close in the stance');
});

test('the glasses are the mission’s, so starting over takes them back', ()=>{
  /* THE SAME RULE `ship_cleared` HAD TO BE RENAMED TO OBEY. restart(id)
     forgets every key beginning with `id + '_'`, and Mission 8's id is
     `ion` — so a flag called `specs` would survive a start-over and hand
     the glasses to a student who asked for the beginning. */
  const planet=bare(read('public/planet.js'));
  const m=planet.match(/const SPECS\s*=\s*'([a-z_]+)'/);
  assert.ok(m, 'the glasses have no save flag at all');
  assert.match(m[1], /^ion_/,
    "the glasses' flag is '"+m[1]+"', which survives PROGRESS.restart('ion')");
});

test('the Mechanic is the one who hands them over', ()=>{
  const planet=bare(read('public/planet.js'));
  /* THE SCENE ITSELF, not everything between mended() and finishIon().
     The arena sequence now lives in that gap and has a camera setup in it
     called FIGHT, which is not somebody saying it out loud. */
  const mStart=planet.indexOf('function mended()');
  const mended=planet.slice(mStart, planet.indexOf('}});', mStart)+4);
  assert.ok(mended.length>200, 'mended() could not be found');
  assert.match(mended, /PROGRESS\.set\(SPECS,\s*1\)/,
    'the scene that lends you the glasses never records that it did');
  assert.match(mended, /who:'The Mechanic'/, 'he does not speak in his own scene');
  /* AND THE REVEAL IS NOT SPOILED IN DIALOGUE. Nobody in this tower knows
     what is on the ridge, and the moment a line says "robots" the whole
     point of the glasses is a fetch quest instead of a discovery. */
  assert.ok(!/robot|giant|fight/i.test(mended),
    'somebody says out loud what is on the ridge, which spoils the reveal');
  /* He does tell you the key, though, because a tool nobody can find is
     not a tool. */
  assert.match(mended, /Press G/, 'he never says which key');
});

test('the two of them are not fetched until there is a reason', ()=>{
  /* FIVE AND A HALF MEGABYTES. Building them with the world would put
     that on every student who has ever loaded RYU, including the ones
     four missions away from meeting the Mechanic and every one of whom
     would see exactly nothing for it. */
  const planet=bare(read('public/planet.js'));
  assert.match(planet, /if\(haveSpecs\(\)\) brawlBuild\(\);/,
    'the robots are built for players who cannot see them');
  /* AND NOT AT THE G PRESS EITHER, or the reveal is a loading screen. */
  const mended=planet.slice(planet.indexOf('function mended()'),
                            planet.indexOf('function finishIon()'));
  assert.match(mended, /brawlBuild\(\)/,
    'nothing starts the download at the handover, so the first G waits for it');
});

test('the ridge is cleared before the world it stands on is', ()=>{
  /* enter() replaces roomGroup, which takes both machines with it — but
     BRAWL would still hold the groups and skip rebuilding, so the next
     world gets a module that thinks it has two robots in a dead scene. */
  const planet=bare(read('public/planet.js'));
  const enter=planet.slice(planet.indexOf('function enter(sv, worldId, at'),
                           planet.indexOf('sky();'));
  assert.match(enter, /BRAWL\.clear\(\)/, 'the brawl is not cleared on a world change');
  const clearAt=enter.indexOf('BRAWL.clear()');
  const newRoom=enter.indexOf('G.roomGroup=new THREE.Group()');
  assert.ok(clearAt>=0 && newRoom>=0 && clearAt<newRoom,
    'the brawl is cleared AFTER its scene has already been thrown away');
});

test('the overlay composites over the game rather than on top of it', ()=>{
  /* mix-blend-mode blends an element with its backdrop WITHIN ITS OWN
     STACKING CONTEXT, and this overlay is position-fixed with a z-index,
     which makes it one. The first version screened a cyan layer and
     multiplied a vignette, both of which blended against each other and
     against nothing else: what went on screen was an opaque turquoise
     sheet with the whole game behind it. */
  /* READ WITH THE COMMENTS STRIPPED, because the paragraph above this
     assertion is itself in planet.js explaining the bug, and it names the
     property it is warning about. A test that greps its own explanation
     fails on a file that is correct. */
  const planet=bare(read('public/planet.js'));
  const ui=planet.slice(planet.indexOf('function specsUI()'),
                        planet.indexOf('let specsAt=0'));
  assert.ok(ui.length>200, 'specsUI() could not be found');
  assert.ok(!/mix-blend-mode/.test(ui),
    'the overlay blends inside its own stacking context and will render opaque');
  assert.match(ui, /pointer-events:none/, 'the overlay would swallow every click');
});

test('G is wired, and only where there is something to see', ()=>{
  const game=bare(read('public/game.js'));
  assert.match(game, /e\.code==='KeyG'/, 'G is not bound to anything');
  /* PLANET ANSWERS FOR BOTH GUARDS, because it is the one that knows
     whether it is running and what is in the save bag. It returns false
     when there is nothing to put on, which keeps G free everywhere else
     in the game. */
  assert.match(game, /PLANET\.specsKey\s*&&\s*PLANET\.specsKey\(\)/,
    'G does not defer to PLANET, so it fires in rooms with no ridge');
  const planet=bare(read('public/planet.js'));
  assert.match(planet, /function specsKey\(\)\s*\{[\s\S]{0,200}?if\(!on \|\| !haveSpecs\(\)\) return false;/,
    'specsKey does not refuse when the player has no glasses');
  /* And nothing else in the game had already taken the key. */
  const others=['public/chars.js','public/cruise.js','public/coder.js',
                'public/house.js','public/club.js'].filter(f=>fs.existsSync(abs(f)));
  for(const f of others)
    assert.ok(!/['"]KeyG['"]/.test(bare(read(f))), f+' also wants KeyG');
});

test('brawl.js is on the page', ()=>{
  const html=read('public/index.html');
  assert.match(html, /<script src="brawl\.js\?v=\d+"><\/script>/,
    'brawl.js is never loaded, so window.BRAWL is undefined and G does nothing');
});

test('the painter learned two things and both are documented', ()=>{
  const paint=read('glb files/paint-skinned.js');
  /* A DECAL IS A BAND THAT ALSO HAS TO BE AT THE FRONT. Without it
     Ambush's chevron runs down his spine and so does every one of Noisy
     Boy's chest panels. */
  assert.match(paint, /function decalAt\(/, 'the painter cannot place a front-only marking');
  assert.match(paint, /const dec=decalAt\(L, yN, ax, zN\); if\(dec\) return dec;/,
    'decals are never consulted on the robot path');
  assert.match(paint, /const WEATHER=/, 'the painter cannot weather a panel');
  for(const spec of ['glb files/ambush.paint.json','glb files/noisyboy.paint.json']){
    const d=JSON.parse(read(spec));
    const named=new Set(Object.keys(d.C));
    /* EVERY COLOUR A RULE ASKS FOR HAS TO EXIST. rgb() on undefined throws
       NaN into the buffer and the model renders black, which looks like a
       lighting bug and is a typo. */
    for(const L in (d.B.LIMBS||{})){
      const v=d.B.LIMBS[L];
      const names = typeof v==='string' ? [v] : v.map(s=>typeof s==='string'?s:s[1]);
      for(const n of names) assert.ok(named.has(n), spec+': LIMBS.'+L+' wants colour "'+n+'"');
    }
    for(const dec of (d.B.decals||[]))
      assert.ok(named.has(dec.c), spec+': a decal wants colour "'+dec.c+'"');
    for(const w in (d.WEATHER||{})){
      assert.ok(named.has(w), spec+': WEATHER names part "'+w+'" that has no colour');
      assert.match(d.WEATHER[w].c, /^#[0-9a-f]{6}$/i,
        spec+': WEATHER.'+w+' has a colour that will parse as NaN');
    }
  }
});

test('the bowl beats the planet it is standing on', ()=>{
  /* THE FIRST ONE CAME OUT FLAT. Nine tiers of five units climbed 45, and
     the ground under a rim 140 units out falls 41 — so the stands rose
     four units net and what stood round the sand was a ring of confetti
     lying on the desert. The curve does not reduce a building's height,
     it CANCELS it, and on a ball this small it cancels nearly all of it.

     So the number that has to be checked is not the rim height. It is the
     rim height MINUS what the ground drops underneath it. */
  const src=bare(read('public/brawl.js'));
  const num=n=>{ const m=src.match(new RegExp('const '+n+'\\s*=\\s*([0-9.]+)'));
                 assert.ok(m, 'brawl.js no longer defines '+n); return +m[1]; };
  const FLOOR=num('FLOOR'), WALL=num('WALL'), TIERS=num('TIERS'),
        TREAD=num('TREAD'), RISER=num('RISER');
  const PR=240;                                  // RYU's radius
  const Ro=FLOOR + TIERS*TREAD + 3.5;
  const rim=WALL + TIERS*RISER;
  const drop=PR*(1-Math.cos(Ro/PR));
  assert.ok(rim-drop > 40,
    'the stands rise '+(rim-drop).toFixed(0)+'u net over the sand: that is a ring, not a bowl');
  /* AND THE SAND IS ONLY JUST BIGGER THAN THE FIGHT, for the same reason
     from the other end: the bulge hides the bottom of anything far away,
     so a floor wide enough to make the front row distant is a floor from
     which you watch two chests. */
  const front=PR*(1-Math.cos((FLOOR+20)/PR));
  assert.ok(front < 20,
    'from the front row the curve hides the bottom '+front.toFixed(0)+
    'u of a fighter — most of his legs');
});

test('the bowl is on the ground, and does not reach the pole', ()=>{
  const brawl=bare(read('public/brawl.js'));
  const planet=bare(read('public/planet.js'));
  /* A FLOOR DRAWN ON THE BARE SPHERE HAD THE DESERT COMING UP THROUGH IT.
     RYU has seven and a half units of hills and the arena was drawn at
     exactly PR, so the terrain under the sand was higher than the sand. */
  assert.match(brawl, /const th=d\/PR, r=PR\+ground\(d,ph\)\+h;/,
    'the bowl is built on the bare sphere rather than on the ground');
  assert.match(planet, /function brawlGround\(C, F\)/,
    'planet.js no longer hands its terrain to the arena');
  /* AND THE ROOT IS AT PR EXACTLY, or the height at the middle is counted
     twice — once by the root and once by ground(). */
  assert.match(planet, /r\.root\.position\.copy\(C\)\.multiplyScalar\(PR\);/,
    'the arena root is lifted by the terrain that ground() already adds');

  /* A BOWL CENTRED AT LATITUDE 56 HAS ITS FAR RIM AT 98, which is not a
     latitude: the lathe wraps it back over the top of the world and the
     stands fold through themselves. */
  const m=planet.match(/BRAWL_AT=\{ lon:(-?\d+), lat:(-?\d+) \}/);
  assert.ok(m, 'the arena has no site');
  const lat=Math.abs(+m[2]);
  const num=n=>+bare(read('public/brawl.js')).match(new RegExp('const '+n+'\\s*=\\s*([0-9.]+)'))[1];
  const Ro=num('FLOOR')+num('TIERS')*num('TREAD')+3.5;
  const deg=Ro/240*180/Math.PI;
  assert.ok(lat+deg < 69,
    'the far rim reaches latitude '+(lat+deg).toFixed(0)+', which folds it over the pole');
});

test('the arena does not land on top of anything anybody built', ()=>{
  /* The Mechanic's tower is 118 units from the obvious spot for this,
     which is INSIDE the cheap seats. */
  const planet=bare(read('public/planet.js'));
  const m=planet.match(/BRAWL_AT=\{ lon:(-?\d+), lat:(-?\d+) \}/);
  const C=dir(+m[1], +m[2]);
  const num=n=>+bare(read('public/brawl.js')).match(new RegExp('const '+n+'\\s*=\\s*([0-9.]+)'))[1];
  const Ro=num('FLOOR')+num('TIERS')*num('TREAD')+3.5;
  /* RYU's two buildings, read out of planet.js rather than typed here */
  const ryu=planet.slice(planet.indexOf("id:'ryu'"), planet.indexOf("id:'ryu'")+4000);
  const bs=[...ryu.matchAll(/id:'(ryuhouse|tower)'[\s\S]{0,120}?lon:(-?\d+), lat:(-?\d+)/g)];
  assert.ok(bs.length>=2, 'could not find RYU’s buildings, found '+bs.length);
  for(const b of bs){
    const d=arc(C, dir(+b[2], +b[3]));
    assert.ok(d > Ro + 30,
      'the '+b[1]+' is '+d.toFixed(0)+'u from the middle of an arena '+
      Ro.toFixed(0)+'u across — it stands inside the stands');
  }
});

test('nothing in the arena is solid', ()=>{
  /* Every wall in this game is a box in G.solids, and a box you cannot
     see is a box you walk into and swear at. G is a toggle, and the first
     thing anybody does with a toggle is press it. */
  const brawl=bare(read('public/brawl.js'));
  assert.ok(!/solids/.test(brawl),
    'the arena puts collision boxes in a world where it is invisible');
});

test('the arena lights itself', ()=>{
  /* RYU's sun is one direction for the whole planet and this bowl is 260
     units across, so most of it faces away: the far stands came out solid
     black and from the sand the arena read as an empty desert under a
     dark sky. A light of its own does not fix it either — three.js lights
     are global whatever you parent them to, so anything bright enough to
     reach the far rim also turns RYU's night side to noon. */
  const brawl=bare(read('public/brawl.js'));
  const bowl=brawl.slice(brawl.indexOf('function bowl()'), brawl.indexOf('const SHIRTS'));
  assert.match(bowl, /MeshBasicMaterial/,
    'the stands are lit by the scene, so the far half of them is black');
  assert.ok(!/MeshLambertMaterial/.test(bowl), 'the stands still want a light');
  const crowd=brawl.slice(brawl.indexOf('function people()'), brawl.indexOf('function load('));
  assert.match(crowd, /MeshBasicMaterial/, 'the crowd goes dark on the far side');
});

test('the instrument says how to get there', ()=>{
  /* The bowl is 199 units from the tower: over the horizon from the
     ground, and on a sphere with no north there is no other way to be
     told where anything is. A bearing turns "there is something out
     there" into a heading. */
  const planet=bare(read('public/planet.js'));
  assert.match(planet, /function bearingToArena\(\)/, 'the glasses give no bearing');
  assert.match(planet, /Math\.atan2\(want\.dot\(left\), want\.dot\(me\.fwd\)\)/,
    'the bearing is not relative to where the player is facing');
  assert.match(planet, /ARENA/, 'standing in it, the readout still points at it');
  assert.match(planet, /function arenaGreet\(\)/, 'arriving is never acknowledged');
  assert.match(planet, /greeted=true;/, 'the arrival line would repeat every frame');
});

/* two helpers, because three of the tests above need spherical distance */
function dir(lon,lat){
  const lo=lon*Math.PI/180, la=lat*Math.PI/180;
  return [Math.cos(la)*Math.sin(lo), Math.sin(la), Math.cos(la)*Math.cos(lo)];
}
function arc(a,b){
  const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  return Math.acos(Math.max(-1,Math.min(1,d)))*240;
}

/* =====================================================================
   THE THREE PLACES ANYBODY PRACTISES, and getting to them twice.
   ===================================================================== */

test('the lift does not leave without its passenger', ()=>{
  /* E WORKS AT ARM'S LENGTH — that is what makes it E and not a pressure
     plate — so the button could be pressed from beside the shaft and the
     deck went up alone. What you saw was the floor name change, a lift
     vanishing into the ceiling, and yourself still in the lobby: the game
     announcing you had arrived somewhere you were not. */
  const planet=bare(read('public/planet.js'));
  const go=planet.slice(planet.indexOf('function liftGo()'),
                        planet.indexOf('lift.from=TOWER_STOPS'));
  assert.ok(go.length>60, 'liftGo() could not be found');
  assert.match(go, /SHAFT\.x1/, 'nothing checks the rider is inside the shaft');
  assert.match(go, /SHAFT\.z1/, 'the shaft is only checked on one axis');
  /* AND ON THE DECK, not merely in the column: the shaft is three floors
     tall, and standing in it downstairs while the deck is at the top is
     not being on the lift either. */
  assert.match(go, /Math\.abs\(l\.y - TOWER_STOPS\[lift\.at\]\.y\)/,
    'the height is not checked, so the shaft counts as the lift on every floor');
  assert.match(go, /DECK_GRIP/,
    'the ride-check and the carry-check use different distances');
  assert.match(go, /Step onto the lift first/, 'refusing says nothing');
});

test('the ship is noticed before it is pressed', ()=>{
  /* A student walks out onto a hillside with a smoking spaceship on it
     and, until they press E, nothing in the game has said anything is
     wrong. Smoke is a thing you have to be looking at. */
  const planet=bare(read('public/planet.js'));
  assert.match(planet, /function noticeTick\(\)/, 'nobody ever notices the ship');
  assert.match(planet, /noticeTick\(\);/, 'noticeTick is never called');
  const n=planet.slice(planet.indexOf('const NOTICE=['), planet.indexOf('function noticeTick'));
  assert.match(n, /at:\d+/, 'the lines are not tied to a distance');
  assert.ok((n.match(/say:/g)||[]).length>=2, 'one line is not an approach');
  /* AND NOT AFTER SHE IS MENDED, which would be the game telling you to
     fix something you already fixed. */
  const tick=planet.slice(planet.indexOf('function noticeTick'),
                          planet.indexOf('function arriveTick'));
  assert.match(tick, /if\(shipOpen\(\)\) return;/,
    'a mended ship is still described as broken');
  assert.match(tick, /noticed\+\+/, 'the same line repeats every frame');
});

test('all three practice points can be reached more than once', ()=>{
  /* THEY ARE THE WHOLE LESSON, and each of them used to be a door that
     locked behind you: the checklist vanished the moment it was passed,
     the belt closed for good, and a returning save walked onto a
     hillside where nothing was wrong and nobody had anything to say. */
  const planet=bare(read('public/planet.js'));
  /* the ship — its own hatch, which is the checks and nothing else */
  assert.match(planet, /enter:'preflight'/, 'the ship has no way back to the checks');
  assert.match(planet, /if\(id==='preflight'\)/, 'the hatch is not wired to anything');
  const hatch=planet.slice(planet.indexOf("if(id==='preflight')"),
                           planet.indexOf("if(id==='lift')"));
  assert.match(hatch, /openFix\(\)/, 'the hatch does not open the checklist');
  assert.ok(!/shipOpen\(\)/.test(hatch),
    'the hatch refuses once she is cleared, which is the bug it exists to fix');
  /* the Mechanic — dialogue, then the belt, on every visit */
  const again=planet.slice(planet.indexOf('if(handed()){'),
                           planet.indexOf('if(!window.SCENE){ return; }'));
  assert.match(again, /theBelt\(\)/, 'a return visit never reaches the belt');
});

test('sixty questions across three segments, all about comparisons', ()=>{
  /* TWENTY EACH, at three points. Two questions, three belt jobs and nine
     checklist blanks was an example rather than a lesson. */
  const Q=require('../public/boolquiz.js');
  for(const [bank, who] of [['kitchen','Ion'],['gauges','the ship'],['belt','the Mechanic']])
    assert.strictEqual(Q.BANKS[bank].length, 20,
      who+' asks '+Q.BANKS[bank].length+' questions');
  const all=['kitchen','gauges','belt'].reduce((n,b)=>n+Q.BANKS[b].length, 0);
  assert.strictEqual(all, 60, 'there are '+all+' questions in the course, not sixty');

  /* AND NOT ONE OF THEM JOINS TWO CONDITIONS. `and`, `or` and `not` were
     a second subject, and a course teaching both at once teaches a
     student to guess which half of a rule has gone wrong. */
  for(const bank of ['kitchen','gauges','belt'])
    for(const q of Q.BANKS[bank]){
      const text=(q.q+' '+q.ask+' '+q.opts.join(' ')).replace(/<[^>]+>/g,'');
      assert.ok(!/\b(and|or)\b/i.test(text),
        bank+': a join word is back in "'+q.ask+'": '+text.replace(/\n/g,' '));
    }

  /* EVERY ONE IS ABOUT A COMPARISON, by symbol or by name. */
  const cmp=/<=|>=|!=|==|&lt;|&gt;|[<>]|at least|at most|more than|less than|under|over|exactly|not the same|warmer than|reaches/i;
  for(const bank of ['kitchen','gauges','belt']){
    const off=Q.BANKS[bank].filter(q=>!cmp.test(q.q+' '+q.ask+' '+q.opts.join(' ')));
    assert.strictEqual(off.length, 0,
      bank+': '+off.length+' questions are not about a comparison: '+off.map(q=>q.ask).join(' | '));
  }

  /* THE BOUNDARY IS THE LESSON IN ALL THREE. "More than 20" and "at
     least 20" agree on every reading in the world except 20, so a bank
     that never sits exactly on a limit never asks the only question that
     separates them. */
  let onTheLine=0;
  for(const bank of ['kitchen','gauges','belt'])
    for(const q of Q.BANKS[bank]){
      const nums=(q.q+' '+q.opts.join(' ')).match(/-?\d+/g);
      if(nums && nums.length>=2 && nums.some((n,i)=>nums.indexOf(n)!==i)) onTheLine++;
    }
  assert.ok(onTheLine>=18,
    'only '+onTheLine+' of the sixty sit exactly on their own limit');

  /* Every question in every bank is answerable and gives a reason. */
  for(const bank of ['kitchen','gauges','belt'])
    for(const q of Q.BANKS[bank]){
      assert.ok(q.opts.length>=2, bank+': a question with nothing to choose between');
      assert.ok(q.a>=0 && q.a<q.opts.length, bank+': the answer is not one of the options');
      assert.ok(q.why && q.why.length>20, bank+': "'+q.ask+'" gives no reason');
    }

  /* AND THE BUILDER IS GONE, not merely unlinked. */
  const fs2=require('fs');
  for(const f of ['public/shipfix.js','public/preflight.js'])
    assert.ok(!fs2.existsSync(abs(f)), f+' is still here');
  const planet=bare(read('public/planet.js'));
  assert.ok(!/SHIPFIX/.test(planet), 'the ship still opens the old checklist');
  assert.match(planet, /BOOLQUIZ\.open\(\{ bank:'gauges'/,
    'the ship does not open its own twenty');
  assert.match(planet, /BOOLQUIZ\.open\(\{ bank:'belt'/,
    'the Mechanic does not open his own twenty');
  assert.match(bare(read('public/house.js')), /BOOLQUIZ\.open\(\{ bank:'kitchen'/,
    'Ion does not open his own twenty');
  assert.match(read('public/index.html'), /<script src="boolquiz\.js\?v=\d+"><\/script>/,
    'boolquiz.js is not on the page');
});

test('the Mechanic asks in English, and does not let go until you know', ()=>{
  /* WHAT THIS REPLACED. The belt asked a student to assemble a boolean
     expression out of blanks — pick a comparison, pick a number, pick a
     joining word, then read a six-row table to find out whether the thing
     you had built agreed with a man in a workshop. It assumed the one
     thing it was there to teach: before anybody can choose between `and`
     and `or` they have to know what the two words DO. No amount of
     tidying the panel fixes that, because the panel was the wrong
     question. */
  const Q=require('../public/boolquiz.js');
  for(const bank of ['kitchen','gauges','belt']){
    assert.strictEqual(Q.BANKS[bank].length, 20, bank+': twenty questions was the ask');
    for(const q of Q.BANKS[bank]){
      assert.ok(q.opts.length>=2, 'a question with nothing to choose between');
      assert.ok(q.a>=0 && q.a<q.opts.length, 'the right answer is not one of the options');
      assert.ok(q.why && q.why.length>20, '"'+q.ask+'" gives no reason');
    }
  }
  /* AND THE SYMBOLS ARE THE POINT. There was an assertion here that no
     question may contain one — right when this was a plain-English
     lesson about joining facts, and exactly backwards now: the course is
     `<`, `<=`, `>`, `>=`, `==` and `!=`, and a bank that never shows one
     is teaching the words without the thing they are words for. */
  let withSymbols=0;
  for(const bank of ['kitchen','gauges','belt'])
    withSymbols += Q.BANKS[bank].filter(q=>
      /<=|>=|!=|==|[<>]/.test(q.q+' '+q.opts.join(' '))).length;
  assert.ok(withSymbols>=24,
    'only '+withSymbols+' of the sixty ever show a comparison symbol');
  /* A WRONG ANSWER IS A TRY AGAIN, not a mark in a book.

     It used to reveal the right answer beside the wrong one and move on,
     with the question re-queued for the end. That is a fair way to mark a
     test and a poor way to teach: the moment somebody is most willing to
     think about `and` versus `or` is the second after getting it wrong,
     and being shown the answer is exactly what removes the reason to. */
  /* EVERY INDEX HERE IS A DISPLAY INDEX, because the options are shuffled
     per round and what the student clicks is a position on screen rather
     than the position the author wrote. shown() is the question as it is
     actually presented. */
  let s=Q.start();
  const first=Q.current(s);
  const right=Q.shown(s).a;
  const bad=(right===0?1:0);
  s=Q.answer(s, bad);
  assert.strictEqual(Q.current(s), first, 'a wrong answer moved the quiz on');
  assert.strictEqual(s.picked, null, 'a wrong answer revealed the right one');
  assert.deepStrictEqual(s.wrong, [bad], 'the wrong option is not struck out');
  /* the same wrong option cannot be clicked twice */
  s=Q.answer(s, bad);
  assert.deepStrictEqual(s.wrong, [bad], 'a struck-out option is still live');
  /* and getting it right releases it */
  s=Q.answer(s, right);
  assert.strictEqual(s.picked, right, 'the right answer is not revealed');

  /* THE SCORE IS STILL FIRST ATTEMPTS. Somebody who gets there on the
     third go has learned it and knows they took three. */
  assert.strictEqual(s.firstTry, 0, 'a question got wrong first still scored');
  let t=Q.start(), guard=0;
  while(!Q.done(t) && guard++ < 400){ t=Q.answer(t, Q.shown(t).a); t=Q.next(t); }
  assert.ok(guard<400, 'the quiz never ends');
  assert.strictEqual(t.firstTry, Q.QUESTIONS.length,
    'a clean run does not score '+Q.QUESTIONS.length);
  /* AND EVERY QUESTION IS ANSWERED EXACTLY ONCE when nothing goes wrong:
     there is no re-queue any more, because nothing is left behind. */
  assert.strictEqual(guard, Q.QUESTIONS.length, 'a clean run took '+guard+' turns');
});

test('the right answer is not always the first one', ()=>{
  /* EVERY QUESTION IN BOTH BANKS IS AUTHORED WITH ITS ANSWER FIRST,
     because that is the only sane way to write forty of them and keep
     them readable. Shown in that order it is not a quiz: click the top
     option forty times and you are through, having read nothing. */
  const Q=require('../public/boolquiz.js');
  for(const b of ['kitchen','gauges','belt'])
    assert.ok(Q.BANKS[b].every(q=>q.a===0),
      'the '+b+' bank is no longer authored answer-first, so the shuffle below '
      +'is testing something other than what it was written for');

  /* SO THE ROUND SHUFFLES THEM. Over many starts the right answer has to
     land in every position a question has. */
  for(const bank of ['kitchen','gauges','belt']){
    const seen=new Set();
    for(let r=0;r<300;r++){
      const s=Q.start();      // start() shuffles; open() picks the bank
      const v=Q.shown(s);
      seen.add(v.a);
    }
    assert.ok(seen.size>=2,
      'the answer always lands in position '+[...seen][0]+': the options are not shuffled');
  }

  /* AND CLICKING THE TOP ONE EVERY TIME MUST NOT PASS. Twenty questions,
     most with two or three options — getting through by reflex should be
     wildly improbable, and over ten rounds it must never once happen. */
  let cleanSweeps=0;
  for(let round=0; round<10; round++){
    let s=Q.start(), wrong=0, guard=0;
    while(!Q.done(s) && guard++ < 400){
      s=Q.answer(s, 0);
      if(s.picked===null){ wrong++; s=Q.answer(s, Q.shown(s).a); }
      s=Q.next(s);
    }
    if(wrong===0) cleanSweeps++;
  }
  assert.strictEqual(cleanSweeps, 0,
    'clicking the first option every time passed the quiz outright');

  /* A student who actually knows it still scores full. */
  let s=Q.start(), guard=0;
  while(!Q.done(s) && guard++ < 400){ s=Q.answer(s, Q.shown(s).a); s=Q.next(s); }
  assert.strictEqual(s.firstTry, Q.length, 'a clean run no longer scores full');

  /* AND THE PANEL DRAWS THE SHUFFLE, not the authored order — otherwise
     the options move and the green tick does not. */
  const src=bare(read('public/boolquiz.js'));
  const draw=src.slice(src.indexOf('function draw(){'), src.indexOf('u.dots.innerHTML'));
  assert.match(draw, /const q=v\.q/, 'draw() still reads the raw question');
  assert.match(draw, /v\.opts\.map/, 'draw() lists the authored options, not the shuffled ones');
  assert.match(draw, /i===v\.a/, 'draw() marks the authored answer, which is now the wrong button');
  assert.ok(!/q\.opts\.map/.test(draw), 'draw() still maps over the authored options');
});
