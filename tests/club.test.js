/* VOLTA, and the room with the decks in it.

   Nearly all of this is a scene graph and a sound, and neither of those can
   be asserted in a test runner. What CAN be is the handful of facts the
   whole thing rests on — the ones that were wrong at some point on the way
   here, and the ones that are wrong quietly rather than loudly:

     - a world that names a flora nobody grows,
     - a panel whose id `use()` has never heard of, which is how you build an
       arena out of a typo,
     - a bassline read off the step you can hear rather than the step being
       booked, which is every note right and every note late,
     - a scheduler that comes back from a backgrounded tab and fires eight
       sixteenths at once,
     - a mute button the club does not answer to. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const planet = () => read('public/planet.js');
const club   = () => read('public/club.js');

/* Pull one world literal out of planet.js by its id. Crude, and deliberately
   so: it fails loudly if the shape of these declarations changes, which is
   the moment somebody should look at this file. */
function world(id){
  const src = planet();
  const at = src.indexOf(`id:'${id}',`);
  assert.ok(at > 0, `planet.js no longer declares a world with id '${id}'`);
  const end = src.indexOf('};', at);
  return src.slice(at, end);
}

test('VOLTA is much smaller than the hub, and is its own place', ()=>{
  const v = world('arena'), hub = world('hub');
  const rOf = s => +(s.match(/radius:\s*(\d+)/)||[])[1];
  assert.ok(rOf(v) < rOf(hub)*0.45,
    `VOLTA (${rOf(v)}) should be well under half the hub (${rOf(hub)})`);
  /* Its own everything. Sharing the hub's soil or a BIOMES entry is how it
     used to be "a different planet": the same planet with a filter on it. */
  assert.match(v, /sky:0x[0-9a-f]{6}/, 'VOLTA sets its own sky');
  assert.match(v, /soil:NIGHT_SOIL/,   'VOLTA sets its own soil');
  assert.match(v, /flora:'crystal'/,   'and grows its own thing');
  assert.match(v, /night:true/,        'and is lit as a night world');
});

test('every world grows a flora that exists', ()=>{
  const src = planet();
  const names = [...src.matchAll(/^\s{4}([a-z]+):\{/gm)].map(m=>m[1]);
  assert.ok(names.includes('wood') && names.includes('crystal'),
    'FLORA still declares wood and crystal');
  for(const m of src.matchAll(/flora:'([a-z]+)'/g))
    assert.ok(names.includes(m[1]), `a world grows '${m[1]}', which FLORA has not got`);
});

test('the two things on VOLTA are the Gym and the club', ()=>{
  const src = planet();
  const at = src.indexOf('const ARENA_BUILDINGS');
  const block = src.slice(at, src.indexOf('];', at));
  const ids = [...block.matchAll(/id:'([a-z]+)'/g)].map(m=>m[1]);
  assert.deepStrictEqual(ids, ['gym','club']);
});

test('use() knows every id the club puts on a panel', ()=>{
  const src = planet();
  const known = src.slice(src.indexOf('const known = id==='),
                          src.indexOf('if(!known) return;'));
  /* Anything a panel `opens` and use() has not heard of falls out of the
     bottom of that function and does nothing at all — a console you can
     walk up to, press E at, and be ignored by. */
  for(const id of ['club','decks'])
    assert.ok(known.includes(`id==='${id}'`), `use() does not know '${id}'`);
  assert.match(src, /id==='decks'\).*CLUB\.take\(\)/s, 'and the decks open the set');
});

test('the decks take the keyboard and the mouse while they are up', ()=>{
  const game = read('public/game.js');
  assert.match(game, /CLUB\.playing && CLUB\.key\(e\)/,
    'game.js hands keys to the decks first — arrows and space are the grid\'s');
  assert.match(game, /CLUB\.playing\) return;\s*\/\/ and so do the decks/,
    'and does not grab the pointer back out of them');
  assert.match(planet(), /CLUB\.playing\) return;/,
    'and walking is held while somebody is playing');
});

test('the bassline is read off the step being booked, not the one playing', ()=>{
  const src = club();
  assert.match(src, /LINE\[ix % LINE\.length\]/,
    'the note belongs to the step being scheduled');
  assert.ok(!/LINE\[step % LINE\.length\]/.test(src),
    '`step` is the step you can hear, which is one behind the one being booked');
});

test('the scheduler gives up rather than catching up', ()=>{
  /* setInterval throttles to about 1Hz in a background tab. Without this the
     loop books every missed sixteenth at once, all clamped to now. */
  assert.match(club(), /if\(nextAt < ac\.currentTime - stepSecs\(\)\) nextAt=ac\.currentTime/,
    'a scheduler that has fallen behind restarts from now');
});

test('the club answers to the mute button, live', ()=>{
  const src = club();
  const m = src.match(/master\.gain\.value =[\s\S]{0,120}/);
  assert.ok(m, 'the club still sets a master gain');
  assert.ok(/MUSIC && MUSIC\.muted/.test(m[0]),
    'and reads the mute button where it sets it — every frame, not at start');
});

test('the club is torn down with the planet', ()=>{
  const src = planet();
  const stops = (src.match(/if\(window\.CLUB\) CLUB\.stop\(\);/g)||[]).length;
  assert.ok(stops >= 2,
    'both enter() and leave() stop it — a scheduler left running is a '
    + 'nightclub playing on the title screen');
});

test('the sun is handed back on the way out', ()=>{
  /* VOLTA turns the world's one directional light down to a moon. Every flat
     room in the game borrows that same light. */
  const src = planet();
  assert.match(src, /const DAY=\{ i:1\.62/, 'the daylight it started with is written down');
  assert.match(src, /G\.sun\.intensity=DAY\.i/, 'and given back in leave()');
});

test('a pattern row is as long as the sequencer says it is', ()=>{
  const src = club();
  const steps = +(src.match(/const STEPS=(\d+)/)||[])[1];
  assert.ok(steps > 0, 'club.js still declares STEPS');
  const at = src.indexOf('const OPENING=[');
  const block = src.slice(at, src.indexOf('];', at));
  const rows = [...block.matchAll(/\[([01,\s]+)\]/g)]
    .map(m=>m[1].split(',').filter(x=>x.trim()!=='').length);
  assert.strictEqual(rows.length, 4, 'four tracks');
  rows.forEach((n,i)=>assert.strictEqual(n, steps,
    `track ${i} of the opening pattern is ${n} steps, not ${steps}`));
});

test('the crowd meter can read something other than full', ()=>{
  /* The track weights are what the meter is drawn from, so if they add up to
     more than one the bar is pinned at 100% from the moment you walk in. */
  const src = club();
  const w = (src.match(/const WEIGHT=\[([^\]]+)\]/)||[])[1];
  assert.ok(w, 'club.js still weights the tracks');
  const sum = w.split(',').map(Number).reduce((a,b)=>a+b, 0);
  assert.ok(Math.abs(sum-1) < 1e-9, `the weights add to ${sum}, not 1`);
  assert.ok(!/energy\*1\.6/.test(src), 'and the meter does not scale them back up');
});

test('the page ships one version number, not two', ()=>{
  /* `sed s/v=N/v=N+1/` moves the script tags and cannot see
     window.ASSETV='N', because that line has no "v=" in it. When they drift,
     the code updates on a deploy and the models keep serving out of cache —
     which reads as a model that refuses to change. `npm run bump` moves
     both; this fails if anybody goes back to moving them by hand. */
  const html = read('public/index.html');
  const tags = new Set([...html.matchAll(/\?v=(\d+)/g)].map(m=>m[1]));
  const av = html.match(/window\.ASSETV\s*=\s*'(\d+)'/);
  assert.ok(av, 'index.html still sets ASSETV');
  tags.add(av[1]);
  assert.strictEqual(tags.size, 1,
    `index.html is serving mixed versions (${[...tags].join(', ')}) — run \`npm run bump\``);
});

test('the world map does not shadow the world', ()=>{
  /* `W` is the world everywhere else in planet.js. drawMap used to declare
     its own W for the canvas width, which hid the world for the whole
     function — so the label at the bottom read t(undefined) and came out
     BLANK. Not an error, not a wrong name: nothing at all, which is the
     kind of wrong nobody reports. Naming the local W back is how it comes
     back, so the name is what this guards. */
  const src = planet();
  const at = src.indexOf('function drawMap()');
  const body = src.slice(at, src.indexOf('\n  }', at));
  assert.ok(!/\bW\s*=\s*c\.width/.test(body),
    'drawMap must not call the canvas width W — that is the world');
  assert.match(body, /CW=c\.width/, 'it is CW');
  assert.match(body, /t\(W\.name\)/, 'and the label reads the world');
});
