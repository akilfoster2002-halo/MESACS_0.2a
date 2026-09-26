/* THE TWO GAMES ARE ONE ROOM.

   There is a browser game in public/ and a Godot game in koro-godot/, they
   sign in to the same server, they join the same rooms, and a student in one
   is meant to walk past a student in the other. Nothing in either codebase
   makes that true: presence is a handful of numbers with a meaning agreed by
   convention, and a convention that lives in two runtimes drifts silently.
   When it drifts nothing throws — you only find out by standing two machines
   side by side and noticing that the classmate is in the wrong field, in the
   wrong pose, or standing perfectly still on a pad they left a minute ago.

   So these are the agreements, written down once. Each one is a thing that
   HAS gone wrong, or a thing that would go wrong the next time somebody
   edited one game and not the other. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
/* Numbers only, so a comparison is not defeated by 0.72 vs 0.720 or by which
   side of the multiplication TRIP is written on. */
const nums = s => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

/* ============================================================= the ground
   Where somebody is standing on a ball is two angles and a heading. The two
   angles are easy to agree on; the heading is not, because there is no
   continuous north on a sphere, so both games build the SAME tangent frame
   at your feet and measure against that. Change the frame in one game and
   every classmate from the other faces the wrong way — further wrong the
   further round the ball they are. */
test('longitude and latitude are the same two angles in both games', ()=>{
  const web = read('public/planet.js').match(/const dirOf=\(lonDeg,latDeg\)=>\{([\s\S]*?)\n  \};/);
  assert.ok(web, 'planet.js no longer turns a longitude and latitude into a direction in one dirOf');
  const gd = read('koro-godot/scripts/planet.gd').match(/static func dir_of\([\s\S]*?\n\treturn ([^\n]*)/);
  assert.ok(gd, 'planet.gd no longer has a dir_of');
  /* cos(lat)sin(lon), sin(lat), cos(lat)cos(lon) — in that order, in both */
  const shape = s => s.replace(/\s|Math\.|_deg|Deg|V\(|Vector3\(/g, '')
                      .replace(/lon|lo\b/g, 'LON').replace(/lat|la\b/g, 'LAT');
  assert.strictEqual(shape(web[1].match(/return ([\s\S]*)/)[1]).replace(/;$/,''),
                     shape(gd[1]),
    'the browser and Godot place a longitude and latitude at different points on the ball');
});

test('the tangent frame under your feet is built the same way, and dodges the same pole', ()=>{
  const web = read('public/planet.js').match(/function frameAt\(dir, spin\)\{([\s\S]*?)\n  \}/);
  const gd  = read('koro-godot/scripts/planet.gd').match(/static func frame_at\(dir[\s\S]*?\n\treturn Basis\(([^)]*)\)/);
  assert.ok(web && gd, 'one of the games no longer builds a tangent frame in one place');
  // the pole it refuses to use as a reference, and the axis it swaps to
  assert.ok(web[1].includes('0.94') && /0\.94/.test(gd[0]),
    'the two games pick their reference axis at different latitudes, so a frame near a pole disagrees');
  // right = ref x up, fwd = up x right, then right is rebuilt from the spun fwd
  for(const src of [web[1], gd[0]]){
    assert.match(src, /cross[Vectors]*\(\s*ref\s*,\s*up|ref\.cross\(up\)/,
      'right is not ref × up');
    assert.match(src, /cross[Vectors]*\(\s*up\s*,\s*right\s*\)|up\.cross\(right\)/,
      'fwd is not up × right');
  }
  // and the basis is handed out in the same order: right, up, fwd
  assert.strictEqual(gd[1].replace(/\s/g,''), 'right,up,fwd',
    'Godot hands back its basis in a different order than the browser reads one');
  assert.match(web[1], /return \{ up, fwd, right \}/,
    'planet.js no longer returns its frame as up/fwd/right');
});

test('the heading that travels is measured against that frame, not against the mouse', ()=>{
  /* G.yaw is how far the mouse has been dragged, which means nothing on
     anybody else's screen. What goes on the wire is the angle between where
     the body faces and the frame this spot would build for ANYBODY. */
  assert.match(read('public/planet.js'),
    /Math\.atan2\(me\.fwd\.dot\(f\.right\), me\.fwd\.dot\(f\.fwd\)\)/,
    'planet.js no longer sends the heading in the frame under its own feet');
  assert.match(read('koro-godot/scripts/net.gd'),
    /atan2\(p\.fwd\.dot\(f\.x\), p\.fwd\.dot\(f\.z\)\)/,
    'net.gd no longer sends the heading in the frame under its own feet (f.x is right, f.z is forward)');
});

/* ================================================================== where
   `at` is the place those two angles are MEASURED in. Both games filter the
   room's roster on it, and a filter is only as good as the two lists of
   names agreeing. */
test('both games draw only the people whose `at` is the ball they are on', ()=>{
  assert.match(read('public/planet.js'), /if\(p\.at!==W\.id\) return;/,
    'planet.js no longer checks which world a classmate is measuring their position in');
  assert.match(read('koro-godot/scripts/others.gd'), /p\.get\("at", ""\)\) != Worlds\.current/,
    'others.gd no longer checks which world a classmate is measuring their position in');
});

test('the worlds are called the same thing in both games', ()=>{
  const web = read('public/planet.js');
  const gd = read('koro-godot/scripts/worlds.gd');
  /* 'hub' and 'arena' are what both games call Wano and VOLTA on the wire,
     and 'home' is every player's own ball. A rename on one side alone makes
     the whole class invisible to the other. */
  for(const id of ['hub','arena','home']){
    assert.match(web, new RegExp("id:'"+id+"'"), `the browser has no world called '${id}'`);
    assert.match(gd, new RegExp('"id": "'+id+'"|"'+id+'"'), `Godot has no world called '${id}'`);
  }
});

test('a home planet is private in both games', ()=>{
  /* Every home planet is built from its owner's seed and every one of them
     reports the same `at` — there is one 'home' in the list and a different
     ball per player. Drawn as a place, thirty students on thirty planets
     became thirty students on each other's hills. Both games skip the crowd
     there; one of them skipping it is worse than neither, because then one
     screen shows a classmate the other knows is not there. */
  assert.match(read('koro-godot/scripts/others.gd'), /Worlds\.current == "home"/,
    'others.gd no longer treats a home planet as one ball per player');
  const web = read('public/planet.js');
  assert.match(web, /const alone = \(\) => solo\(\) \|\| !!\(W && W\.id==='home'\)/,
    'planet.js no longer treats a home planet as one ball per player');
  assert.match(web, /if\(alone\(\)\)\{/,
    'planet.js works out that it is alone and then paints the crowd anyway');
});

/* ================================================================== space
   Out between the planets there is no ground to supply the rest, so all
   three coordinates travel, and both games have to put the planets at the
   same points or two pilots are flying in two different frames. */
test('the planets hang at the same points in both games', ()=>{
  const web = read('public/cruise.js');
  const gd = read('koro-godot/scripts/cruise.gd');
  // the scale of the whole frame: how fast a ship goes and for how long
  for(const [re, name] of [[/top:\s*(\d+)/, 'the ship top speed'],
                           [/TRIP_SECONDS\s*=\s*(\d+)/, 'the crossing time']]){
    const a = web.match(re), b = gd.match(new RegExp(name==='the ship top speed'
      ? 'TOP := (\\d+)' : 'TRIP_SECONDS := (\\d+)'));
    assert.ok(a && b, name + ' is no longer a number in one of the games');
    assert.strictEqual(a[1], b[1],
      name + ' differs, so TRIP differs, so the planets are not where the other game thinks');
  }
  const gdAt = gd.match(/const AT := \{([^}]*)\}/);
  assert.ok(gdAt, 'cruise.gd no longer lists where each world hangs');
  const spots = {
    hub:   web.match(/const WANO_AT\s*=\s*new THREE\.Vector3\(([^)]*)\)/),
    arena: web.match(/const VOLTA_AT\s*=\s*new THREE\.Vector3\(([^)]*)\)/),
    home:  web.match(/const HOME_AT\s*=\s*new THREE\.Vector3\(([^)]*)\)/)
  };
  for(const id of ['hub','arena','home']){
    assert.ok(spots[id], `cruise.js no longer says where '${id}' hangs in space`);
    const line = gdAt[1].match(new RegExp('"'+id+'": Vector3\\(([^)]*)\\)'));
    assert.ok(line, `cruise.gd no longer says where '${id}' hangs in space`);
    assert.deepStrictEqual(nums(spots[id][1]), nums(line[1]),
      `'${id}' is in two different places, so a ship from the other game is drawn off its true bearing`);
  }
  // and every world the flight can be aimed at has a point of its own
  assert.match(web, /spotOf = id => id==='arena' \? VOLTA_AT : id==='home' \? HOME_AT : WANO_AT/,
    'cruise.js no longer knows where all three are, so a course to one of them has no length');
});

test('a ship says where it is in all three dimensions, in both games', ()=>{
  const web = read('public/cruise.js').match(/NET\.pos\(\{[\s\S]*?\}\)/);
  const gd = read('koro-godot/scripts/net.gd').match(/func in_space\([\s\S]*?\n\n/);
  assert.ok(gd, "net.gd no longer has an in_space(): a Godot ship reports nothing out there");
  for(const f of ['x', 'y', 'z', 'yaw', 'pit'])
    for(const [src, who] of [[web[0], 'the browser'], [gd[0], 'Godot']])
      assert.match(src, new RegExp('"?'+f+'"?\\s*:'), who + ' does not send ' + f + ' from a ship');
  for(const [src, who] of [[web[0], 'the browser'], [gd[0], 'Godot']])
    assert.match(src, /at:\s*'space'|"at": "space"/,
      who + " does not mark a flight as being in 'space', so a planet tries to draw it");
});

test('a ship that stops reporting is not a ship standing on a pad', ()=>{
  /* The world node is gone out there, so the line that reports a walker has
     nothing to say — and the server keeps the last thing it heard. Until the
     ship reported itself, a pilot stood frozen on the pad they took off from
     for everybody still on that planet, in both games at once. */
  assert.match(read('koro-godot/scripts/cruise.gd'), /net\.in_space\(where, yaw, pitch\)/,
    'cruise.gd flies without telling the room, so the pilot is left standing on the planet');
  assert.match(read('koro-godot/scripts/net.gd'), /if world == null or not is_instance_valid\(world\)/,
    'net.gd no longer guards the walker report on there being a world to read');
});

test('both games draw the ships that are out there with them', ()=>{
  assert.match(read('public/cruise.js'), /if\(p\.at!=='space'\) return;/,
    'cruise.js no longer picks the people who are actually out in space');
  assert.match(read('koro-godot/scripts/cruise.gd'), /!= "space":/,
    'cruise.gd no longer picks the people who are actually out in space');
  /* The nose is read the same way on both screens: yaw, then pitch, in the
     ship's own YXZ. Swap the order and a classmate flies sideways. */
  assert.match(read('public/cruise.js'), /new THREE\.Euler\(m\.pit, m\.yaw, 0, 'YXZ'\)/,
    'cruise.js reads another ship’s nose in a different order than it writes its own');
  assert.match(read('koro-godot/scripts/cruise.gd'),
    /Basis\(Vector3\.UP, m\.yaw\) \* Basis\(Vector3\.RIGHT, m\.pit\)/,
    'cruise.gd reads another ship’s nose in a different order than the browser sends it');
});

/* =============================================================== the body
   What a classmate is DOING travels as the name of the clip they are
   playing, and the name comes out of whichever game they are in. The two
   lists of names are not the same list and never will be — Godot spells its
   side-steps out, a mech pilot is 'ride' — so neither game may depend on
   knowing the other's. */
test('a clip the body has not got falls back, in both games, rather than freezing it', ()=>{
  /* Returning on a miss left the body in whatever pose it was last in:
     frozen mid-stride, sliding across the field, which is worse than the
     wrong animation. */
  assert.match(read('public/avatar.js'),
    /if\(!clips\.some\(c=>c\.name===name\)\) name=String\(name\|\|''\)\.split\('_'\)\[0\];[\s\S]{0,120}name='idle'/,
    'avatar.js no longer falls back from a clip name it does not know');
  assert.match(read('koro-godot/scripts/others.gd'),
    /if not ap\.has_animation\(clip\):\s*\n\s*clip = "idle"/,
    'others.gd no longer falls back from a clip name it does not know');
});

test('every clip either game plays gets past the server', ()=>{
  const re = read('server/index.js').match(/m\.act==='string'\s*&&\s*\/(\^.+?\$)\/\.test/);
  assert.ok(re, 'server/index.js no longer filters m.act with a regex');
  const ok = new RegExp(re[1]);
  /* what the Godot walker can be playing: the postures, the eight-way gaits
     spelled out, and an emote */
  const gd = read('koro-godot/scripts/walker.gd');
  const clips = [...gd.matchAll(/want = "([a-z_]+)"/g)].map(m=>m[1])
    .concat(['walk_back','walk_left','walk_right','sprint_back','sprint_left','sprint_right']);
  assert.ok(clips.includes('idle') && clips.includes('ride'),
    'walker.gd no longer names its postures in one place: ' + clips.join(', '));
  const dropped = clips.filter(c=>!ok.test(c));
  assert.deepStrictEqual(dropped, [],
    'these clips would be dropped on the way to the room: ' + dropped.join(', '));
});

/* ========================================================== the moderation
   A teacher can mute somebody, take one line back out of a room, or clear
   the lot. All three go to every socket in the room — and a line nobody was
   meant to read is no less read on a Godot screen than in a browser. */
test("the teacher's buttons reach both games", ()=>{
  const server = read('server/index.js');
  for(const m of ['muted','unsay','clear'])
    assert.match(server, new RegExp("t:'"+m+"'"), 'the server no longer sends ' + m);
  const web = read('public/net.js');
  const gd = read('koro-godot/scripts/net.gd');
  for(const m of ['muted','unsay','clear']){
    assert.match(web, new RegExp("m\\.t==='"+m+"'"), 'the browser ignores ' + m);
    assert.match(gd, new RegExp('"'+m+'"'), 'Godot ignores ' + m);
  }
  /* and a line has to be identifiable for one of them to be taken back */
  assert.match(gd, /"id": int\(m\.get\("id", 0\)\)/,
    'net.gd drops the id off a chat line, so there is nothing for unsay to find');
  for(const f of ['koro-godot/scripts/hud.gd', 'koro-godot/scripts/phone.gd']){
    const src = read(f);
    assert.match(src, /line\.get\("clear", false\)/, f + ' does not clear when the room is cleared');
    assert.match(src, /line\.has\("unsay"\)/, f + ' does not drop a line the teacher took back');
  }
});
