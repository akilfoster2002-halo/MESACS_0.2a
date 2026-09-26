/* CHAT ROOMS, THE BROWSER HALF — and the agreements it has to keep.

   A chat room is one room on one server with two clients standing in it.
   The Godot game builds it from koro-godot/data/chatrooms.json; the browser
   builds it from the same file, fetched. Everything below is a place where
   the two could quietly disagree and nothing would throw — you would only
   find out by standing two machines side by side and noticing that the couch
   is somewhere else, the robot is in a different place, or the classmate is
   standing in a wall.

   THE ONE THAT TAKES CARE is where somebody IS. koro-godot stands a room on
   the north pole of a two-kilometre ball and reports a longitude and a
   latitude on it; the browser stands the room flat and walks in metres. The
   conversion is written twice — once in each game — so it is checked here
   against the other game's own arithmetic rather than against itself. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const CAT = JSON.parse(read('koro-godot/data/chatrooms.json'));

/* ============================================================ the catalog */
test('the browser builds from the same catalogue the Godot game does', ()=>{
  /* Not a copy of it: the server hands over the one file, and the browser
     asks for it. Two lists of what a room may contain is two rooms. */
  const server = read('server/index.js');
  assert.match(server, /app\.get\('\/api\/rooms\/catalog'/,
    'the server no longer hands the browser the catalogue');
  const iCat = server.indexOf("app.get('/api/rooms/catalog'");
  const iId  = server.indexOf("app.get('/api/rooms/:id'");
  assert.ok(iCat > 0 && iId > 0 && iCat < iId,
    "the catalogue route sits below '/api/rooms/:id', which would swallow the word \"catalog\" and answer 404");
  assert.match(read('public/chatroom.js'), /NET\.roomCatalog\(\)/,
    'chatroom.js no longer asks for the catalogue');
  assert.match(read('public/net.js'), /roomCatalog\(\)\{ return api\('\/rooms\/catalog'\); \}/,
    'net.js no longer knows how to ask for it');
});

test('the browser can build every kind of thing a room may hold', ()=>{
  /* A type in the catalogue that the kit has never heard of is a hole in
     somebody's room. The kit falls back to a plain block rather than
     nothing, but a type that was ADDED and never drawn is a mistake, not a
     fallback — so every one of them is named here. */
  const kit = read('public/roomkit.js');
  const missing = Object.keys(CAT.objects).filter(k => !kit.includes("case '"+k+"'"));
  assert.deepStrictEqual(missing, [],
    'the browser draws no such thing as: ' + missing.join(', '));
  /* and the fallback is still there for the next one somebody adds */
  assert.match(kit, /default: \{[\s\S]*?spec && spec\.solid/,
    'a type the kit has not learned yet would be a hole in the room');
});

test('the browser knows every floor, wall, light and sky the catalogue lists', ()=>{
  const kit = read('public/roomkit.js');
  const list = name => (kit.match(new RegExp('const '+name+" = \\[([^\\]]*)\\]"))||[])[1] || '';
  assert.deepStrictEqual(list('FLOORS').match(/'([a-z]+)'/g).map(s=>s.replace(/'/g,'')),
    CAT.env.floor, 'the browser and the catalogue disagree about the floors');
  assert.deepStrictEqual(list('SKIES').match(/'([a-z]+)'/g).map(s=>s.replace(/'/g,'')),
    CAT.env.sky, 'the browser and the catalogue disagree about the skies');
  CAT.env.walls.forEach(w => assert.ok(kit.includes("'"+w+"'"),
    'the browser has no wall called ' + w));
  const lights = (kit.match(/const LIGHTS = \{([\s\S]*?)\n  \};/)||[])[1] || '';
  CAT.env.light.forEach(l => assert.ok(lights.includes(l+':'),
    'the browser has no light preset called ' + l));
});

test('the light presets are the same numbers in both games', ()=>{
  /* A room set to "dim" has to be as dim in both, or the owner lit it for
     one screen and not the other. */
  const web = read('public/roomkit.js').match(/const LIGHTS = \{([\s\S]*?)\n  \};/)[1];
  const gd  = read('koro-godot/scripts/chatroom.gd').match(/const LIGHTS := \{([\s\S]*?)\n\}/)[1];
  CAT.env.light.forEach(name=>{
    const a = (web.match(new RegExp(name+':\\s*\\{ energy:([\\d.]+)'))||[])[1];
    const b = (gd.match(new RegExp('"'+name+'": \\{"energy": ([\\d.]+)'))||[])[1];
    assert.ok(a && b, 'one of the games no longer gives ' + name + ' an energy');
    assert.strictEqual(Number(a), Number(b),
      name + ' is ' + a + ' in the browser and ' + b + ' in Godot');
  });
});

/* ======================================================== where you stand
   The conversion, checked against the arithmetic koro-godot actually does:
   a walker's world position is dir × (R + alt), and net.gd puts
   lon = atan2(dir.x, dir.z) and lat = asin(dir.y) on the wire. A room sits
   at the north pole of that ball (world.gd: room.position = (0, R, 0)) with
   its own axes lined up with the world's, so room metres go in and come out
   of that formula unchanged — or they had better. */
const BALL = 2000;
function godotWire(x, y, z){                      // what koro-godot would send
  const r = Math.hypot(x, BALL + y, z);
  return { lon: Math.atan2(x/r, z/r)*180/Math.PI,
           lat: Math.asin((BALL + y)/r)*180/Math.PI,
           alt: r - BALL };
}
/* the browser's own two, lifted out of chatroom.js so the test runs the
   shipped arithmetic rather than a copy of it */
function browserWire(){
  const src = read('public/chatroom.js');
  const to   = src.match(/function toWire\(x, y, z\)\{[\s\S]*?\n  \}/);
  const from = src.match(/function fromWire\(lon, lat, alt\)\{[\s\S]*?\n  \}/);
  assert.ok(to && from, 'chatroom.js no longer converts room metres to the wire in toWire/fromWire');
  const ball = src.match(/const BALL = (\d+);/);
  assert.ok(ball, 'chatroom.js no longer names the ball a Godot room stands on');
  return new Function('const BALL='+ball[1]+';'+to[0]+from[0]+'return {toWire, fromWire};')();
}

test('the ball a Godot chat room stands on is the one the browser reads it off', ()=>{
  const gd = read('koro-godot/scripts/worlds.gd').match(/"id": "chatroom"[\s\S]*?"radius": ([\d.]+)/);
  assert.ok(gd, 'worlds.gd no longer describes the ball a chat room stands on');
  const web = read('public/chatroom.js').match(/const BALL = (\d+);/);
  assert.strictEqual(Number(web[1]), Number(gd[1]),
    'the browser reads Godot’s coordinates off a ball of a different size, so everybody stands in the wrong place');
  /* and the room sits at its north pole with the world's own axes */
  assert.match(read('koro-godot/scripts/world.gd'), /room\.position = Vector3\(0, Planet\.R, 0\)/,
    'the Godot room no longer sits at the pole, which is the whole of what the browser assumes');
});

test('room metres survive the trip, and match what Godot would have sent', ()=>{
  const { toWire, fromWire } = browserWire();
  let worst = 0;
  for(const x of [-9.8,-4.2,-0.01,0,3.3,9.8])
    for(const z of [-9.8,-2,0,6.25,9.8])
      for(const y of [0,1.2,6.8]){
        const w = toWire(x,y,z);
        const g = godotWire(x,y,z);
        assert.ok(Math.abs(w.lon-g.lon) < 1e-9 && Math.abs(w.lat-g.lat) < 1e-9
               && Math.abs(w.alt-g.alt) < 1e-9,
          `the browser and Godot put (${x},${y},${z}) on the wire differently`);
        const b = fromWire(w.lon, w.lat, w.alt);
        worst = Math.max(worst, Math.abs(b.x-x), Math.abs(b.y-y), Math.abs(b.z-z));
      }
  assert.ok(worst < 1e-6, 'a round trip through the wire moves you ' + worst + ' metres');
});

test("'chatroom' is the word both games filter the roster on", ()=>{
  /* Whoever is in the room and whoever is out on a planet arrive in the same
     list; the only thing that separates them is this word. */
  assert.match(read('public/chatroom.js'), /at:'chatroom'/,
    'the browser no longer says which kind of place it is measuring from');
  assert.match(read('public/chatroom.js'), /p\.at!=='chatroom'/,
    'the browser draws people who are not in this room');
  assert.match(read('koro-godot/scripts/net.gd'), /Worlds\.current == "chatroom"/,
    'net.gd no longer treats a chat room as its own kind of place');
  const at = read('server/index.js').match(/const at = \(typeof raw==='string' && \/(\^.+?\$)\/\.test/);
  assert.ok(at && new RegExp(at[1]).test('chatroom'),
    'the server would throw the word away and nobody would see anybody');
});

/* ============================================================== the robot
   A robot runs Koro's own blocks, and the two games have to agree about
   where it ends up — a robot half way through its program is in a different
   place on every screen otherwise. Both compile the program into a timeline
   and read a pose off the server's clock. */
test('a robot walks the same program the same way in both games', ()=>{
  const src = read('public/chatroom.js');
  const bits = src.match(/const STEP_M = ([\d.]+);/);
  const gd = read('koro-godot/scripts/chatroom.gd').match(/const STEP_M := ([\d.]+)/);
  assert.ok(bits && gd, 'one of the games no longer says how far a step is');
  assert.strictEqual(Number(bits[1]), Number(gd[1]),
    'a "move 30 steps" is a different distance in the two games');
  /* the timeline is built the same way: unrolled loops, capped, then read
     off by time */
  ['function compile(', 'function poseAt(', 'function steps('].forEach(f=>
    assert.ok(src.includes(f), 'chatroom.js no longer has ' + f));
  assert.match(src, /out\.length < 400/, 'the browser no longer caps an unrolled program');
  assert.match(src, /if\(tt > 600\) break;/, 'the browser no longer caps a timeline at ten minutes');
  const g = read('koro-godot/scripts/chatroom.gd');
  assert.match(g, /out\.size\(\) < 400/, 'Godot no longer caps an unrolled program');
  assert.match(g, /if tt > 600\.0:/, 'Godot no longer caps a timeline at ten minutes');
});

test('the browser runs a robot exactly where Godot would put it', ()=>{
  /* The arithmetic, run: the default robot's own program, three metres
     forward, a wait, a quarter turn to its right, three metres more. Worked
     out from the shipped compile()/poseAt() rather than from a copy. */
  const src = read('public/chatroom.js');
  const parts = ['function endOf(', 'function unroll(', 'function steps(',
                 'function compile(', 'function poseAt('].map(f=>{
    const i = src.indexOf(f);
    assert.ok(i > 0, 'chatroom.js no longer has ' + f);
    const end = src.indexOf('\n  }', i);
    return src.slice(i, end+4);
  });
  const run = new Function('const STEP_M=0.1;' + parts.join('\n')
    + 'return {compile, poseAt};')();
  const prog = CAT.objects.robot.props.program;
  const tl = run.compile(prog, { x:0, z:0 }, Math.PI, 20, 20);
  const end = run.poseAt(tl, tl.total + 1);
  /* facing 180°, "move 30 steps" is three metres along -z; then `turn z by
     90` points it at +x and it goes three more */
  assert.ok(Math.abs(end.p.z - (-3)) < 1e-6 && Math.abs(end.p.x - 3) < 1e-6,
    'the robot finishes at ' + JSON.stringify(end.p) + ', not three metres back and three across');
  const half = run.poseAt(tl, 0.001);
  assert.ok(Math.abs(half.p.x) < 0.01 && Math.abs(half.p.z) < 0.01,
    'the robot does not start where it stands');
});

/* ========================================================= the live half */
test('what is happening in a room reaches both games, stamped with one clock', ()=>{
  const server = read('server/index.js');
  assert.match(server, /if\(st\.run\) st=\{ \.\.\.st, run:Date\.now\(\) \}/,
    'the server no longer stamps a run with its own clock, so two screens replay it from two moments');
  ['public/chatroom.js', 'koro-godot/scripts/chatroom.gd'].forEach(f=>{
    const s = read(f);
    assert.ok(/cro_all/.test(s), f + ' does not take the room’s state when it walks in');
    assert.ok(/skew/.test(s), f + ' does not follow the server’s clock');
  });
  assert.match(read('public/net.js'), /t:'cro', o:objId, s\}/,
    'the browser cannot tell the room anything changed');
});

test('the owner is the only one who can change a room, and the server decides that', ()=>{
  /* Not the browser. Every one of these is a question asked of the server;
     the panel only ever shows the answer. */
  const net = read('public/net.js');
  ['roomCreate','roomEnter','roomSave','roomRename','roomAccess','roomInvite',
   'roomKick','roomDelete'].forEach(fn=>
    assert.ok(net.includes(fn+'('), 'net.js cannot ' + fn));
  const server = read('server/index.js');
  assert.match(server, /async function ownRoom\(req, res, s\)[\s\S]*?r\.owner_id !== s\.id/,
    'the server no longer checks who owns a room');
  /* and the browser never decides it for itself */
  const web = read('public/roomedit.js');
  assert.match(web, /NET\.roomSave\(CHATROOM\.room\.id/,
    'the builder saves somewhere other than the server');
  assert.match(read('public/chatroom.js'), /mine = \(\)=> !!\(room && room\.mine\)/,
    'the browser works out ownership for itself instead of reading what the server said');
});

test('a room you cannot leave is not a room anybody should walk into', ()=>{
  /* Every template ships a portal, but its owner can delete one — so the
     way out cannot be a thing in the room. */
  Object.keys(CAT.templates).forEach(k=>
    assert.ok((CAT.templates[k].objects||[]).some(o=>o.type==='portal'),
      'the ' + k + ' template has no way out in it'));
  assert.match(read('public/rooms.js'), /CHATROOM\.leave\(\)/,
    'the rooms panel has no way out that does not depend on a portal');
});
