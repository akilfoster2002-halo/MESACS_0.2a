/* What the server lets through against what the browser can wear.

   These two lists live in different files, in different runtimes, and
   nothing but this test makes them agree.  When Kyle and Mia were added to
   the roster as `s` and `t`, the server's presence filter still spelled out
   the letters the game had shipped with — so it dropped them, and every
   player wearing the DEFAULT character was relayed to the room as somebody
   else.  Nothing threw and nothing logged; you only saw it by standing next
   to a classmate. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* the roster the browser offers, straight out of avatar.js */
function roster(){
  const m = read('public/avatar.js').match(/const IDS\s*=\s*'([a-z]+)'\.split/);
  assert.ok(m, 'avatar.js no longer declares IDS as a string of letters');
  return m[1].split('');
}
/* the test the server applies to an incoming presence message */
function serverAccepts(){
  const m = read('server/index.js').match(/m\.char==='string'\s*&&\s*(\/\^.+?\$\/)\.test/);
  assert.ok(m, 'server/index.js no longer filters m.char with a regex');
  return new RegExp(m[1].slice(1, -1));
}

test('the server relays every character the wardrobe can put you in', ()=>{
  const re = serverAccepts();
  const rejected = roster().filter(id => !re.test(id));
  assert.deepStrictEqual(rejected, [],
    'these characters would be dropped on the way to the room: ' + rejected.join(', '));
});

test('the character everybody starts as is the one the server assumes', ()=>{
  const first = roster()[0];
  /* Anchored on the live record itself, not on whichever field happened to
     sit next to it — adding the space coordinates moved `yaw` away from
     `char` and broke this test without anything being wrong. */
  const rec = read('server/index.js').match(/live\.set\(ws,\s*\{[\s\S]*?\}\);/);
  assert.ok(rec, 'server/index.js no longer seeds a live record per socket');
  const m = rec[0].match(/char:\s*'([a-z])'/);
  assert.ok(m, 'the live record no longer seeds a default char');
  assert.strictEqual(m[1], first,
    'a roster read before the first pos message would show the wrong character');
});

test('the filter checks the shape of a character id, not a list of them', ()=>{
  const re = serverAccepts();
  // adding a character must not need a server deploy...
  assert.ok(re.test('z'), 'a letter the roster has not reached yet is refused');
  // ...but the id still names a file, so it stays one plain letter
  ['', 'ab', '../x', 'A', '1', 'a/b'].forEach(bad =>
    assert.ok(!re.test(bad), JSON.stringify(bad) + ' is accepted as a character id'));
});

/* ------------------------------------------------------------------ act
   The same trap one field over. `act` carries the clip the body is
   playing, so a jump and an emote reach everybody else's screen instead of
   being guessed from how fast somebody crosses the ground — which can see
   a walk and can never see a jump. Add a clip and forget the server and it
   goes quiet in exactly the way `s` and `t` did. */
function clipsTheBrowserPlays(){
  const src = read('public/avatar.js');
  const body = src.match(/function clipFor\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(body, 'avatar.js no longer chooses its clip in one clipFor()');
  const names = [...body[1].matchAll(/'([a-z][a-z0-9_]*)'/g)].map(m => m[1]);
  const emote = src.match(/name\s*=\s*name\s*\|\|\s*'([a-z][a-z0-9_]*)'/);
  assert.ok(emote, 'avatar.js no longer names a default emote');
  return [...new Set(names.concat(emote[1]))];
}
function serverAcceptsAct(){
  const m = read('server/index.js').match(/m\.act==='string'\s*&&\s*(\/\^.+?\$\/)\.test/);
  assert.ok(m, 'server/index.js no longer filters m.act with a regex');
  return new RegExp(m[1].slice(1, -1));
}

test('the server relays every clip the body can play', ()=>{
  const re = serverAcceptsAct();
  const clips = clipsTheBrowserPlays();
  assert.ok(clips.includes('jump'), 'clipFor no longer names a jump: ' + clips.join(', '));
  const dropped = clips.filter(c => !re.test(c));
  assert.deepStrictEqual(dropped, [],
    'these clips would be dropped on the way to the room: ' + dropped.join(', '));
});

test('both rooms send what the body is doing, and the server passes it on', ()=>{
  // sent from the planet and from indoors...
  ['public/planet.js', 'public/menu.js'].forEach(f =>
    assert.match(read(f), /act:\s*AVATAR\.act/, f + ' does not send act with its presence'));
  // ...and put back on the roster the room is given
  assert.match(read('server/index.js'), /act:\s*p\.act/,
    'roster() does not hand act back out, so nothing sent ever arrives');
});

/* ----------------------------------------------------------------- space
   The third dimension. On the ground two numbers and a heading are the whole
   of where somebody is, because the ground supplies the rest — you are
   standing on it. Between the planets there is nothing to stand on, so
   height and pitch have to travel as well, or a classmate flying above you
   is a classmate flying beside you. Same trap as `char` and `act`: the
   sender can be right and the relay can quietly drop it. */
test('the ship sends where it is in all three dimensions', ()=>{
  const src = read('public/cruise.js');
  const call = src.match(/NET\.pos\(\{[\s\S]*?\}\)/);
  assert.ok(call, 'cruise.js no longer sends presence at all');
  ['x:', 'y:', 'z:', 'yaw:', 'pit:'].forEach(f =>
    assert.ok(call[0].includes(f), 'the flight does not send ' + f));
  assert.match(call[0], /at:\s*'space'/,
    "the flight does not mark itself as being in 'space', so a planet would try to draw it");
});

test('the server keeps and relays the third dimension', ()=>{
  const src = read('server/index.js');
  assert.match(src, /p\.y\s*=\s*\+m\.y/,   'the server drops the height off a presence message');
  assert.match(src, /p\.pit\s*=\s*\+m\.pit/, 'the server drops the pitch off a presence message');
  const roster = src.match(/function roster\([\s\S]*?\n\}/);
  assert.ok(roster, 'server/index.js no longer builds a roster');
  ['y:p.y', 'pit:p.pit'].forEach(f =>
    assert.ok(roster[0].replace(/\s/g,'').includes(f),
      'roster() does not hand back ' + f + ', so nothing sent ever arrives'));
});

test("'space' is a place the server will let you be", ()=>{
  const src = read('server/index.js');
  const m = src.match(/const at\s*=\s*\(typeof raw==='string'\s*&&\s*(\/\^.+?\$\/)\.test/);
  assert.ok(m, 'server/index.js no longer filters the `at` field with a regex');
  assert.ok(new RegExp(m[1].slice(1,-1)).test('space'),
    "the room the flight reports would be thrown away, and nobody would see anybody");
});
