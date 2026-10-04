/* OPEN MICS — everybody in a room hears whoever is near them, louder up
   close. The sound goes browser to browser; what is checked here is the
   part that decides who hears whom: the curve, the units, the server's
   relay and the teacher's mute. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function load(){
  global.window = { addEventListener(){} };
  global.document = { readyState:'complete', querySelector:()=>null };
  global.localStorage = { getItem:()=>null, setItem(){} };
  global.t = s => s;
  delete require.cache[require.resolve('../public/voice.js')];
  require('../public/voice.js');
  return window.VOICE;
}

test('loud up close, quieter with distance, silent far away', ()=>{
  const V = load();
  assert.strictEqual(V._level(0), 1);
  assert.strictEqual(V._level(3), 1);
  let last = 1;
  for(let d=4; d<30; d+=2){ const g=V._level(d); assert.ok(g < last, `${d} m is not quieter than ${d-2} m`); last=g; }
  assert.strictEqual(V._level(30), 0);
  assert.strictEqual(V._level(500), 0);
});

test('the server relays voice only within a room, and a mute takes you off the air', ()=>{
  const srv = read('server/index.js');
  assert.match(srv, /if\(m\.t==='vc'\)\{ voiceMsg\(ws, p, m\); return; \}/, 'the socket does not pass voice on');
  assert.match(srv, /q\.server===p\.server && q\.vc/, 'voice can reach somebody in another room');
  assert.match(srv, /if\(until\) voiceOff\(p, 'Your teacher muted you\.'\)/, 'a teacher mute leaves the mic on');
  assert.match(srv, /mutedUntil && Date\.now\(\)<p\.mutedUntil\)\s*return ws\.send\(JSON\.stringify\(\{ t:'vc', op:'denied'/, 'a muted student can turn the mic back on');
  assert.match(srv, /calls\.gone\(ws, p\);\s*voiceOff\(p\);/, 'a closed tab stays on the air');
  assert.match(srv, /vc:p\.vc\|\|undefined/, 'the roster does not say who has a mic on');
});

test('every place that does not send metres says how to read it', ()=>{
  assert.match(read('public/planet.js'), /VOICE\.place\(p => p\.at===W\.id \? dirOf/, 'the planet is measured in degrees');
  assert.match(read('public/chatroom.js'), /VOICE\.place\(p => p\.at==='chatroom' \? fromWire/, 'a chat room is measured in degrees');
  const html = read('public/index.html');
  assert.ok(html.indexOf('voice.js') > html.indexOf('net.js') && html.indexOf('voice.js') < html.indexOf('planet.js'),
    'voice.js must load after net.js and before the places that register with it');
});
