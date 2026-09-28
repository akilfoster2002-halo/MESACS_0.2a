/* TSH, George Wang's night in the city (tsh.js, tshcity.js).

   Two things went wrong on the first play-through and are easy to put
   back without noticing: the chase camera sat at the height of the
   alley's canopy and blade signs and filmed the back of them for the
   whole deal, and the story played itself — subtitles on a timer, under
   the letterbox where nobody could read them. These checks fail loudly
   instead. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// a match that, when it fails, says what was missing rather than printing the whole file
const has = (text, re, msg) => assert.ok(re.test(text), msg || ('missing: ' + re));
const hasNot = (text, re, msg) => assert.ok(!re.test(text), msg || ('should not have: ' + re));

/* tshcity.js reads a couple of helpers off TSHLOOK at load; the rest of
   THREE is only needed by build(), which these tests do not call. */
function city(){
  function Any(){ this.userData = {}; }
  function Vec(x, y, z){ this.x = x||0; this.y = y||0; this.z = z||0; }
  const THREE = new Proxy({ Vector3:Vec }, { get:(t, k) => t[k] || Any });
  const ctx = vm.createContext({ console, THREE, Math, Map });
  ctx.window = ctx;
  ctx.TSHLOOK = { seeded:()=>Math.random };
  vm.runInContext(read('public/tshcity.js'), ctx, { filename:'tshcity.js' });
  return ctx.TSHCITY;
}

test('the camera ducks under what hangs over the alley, and looks over what hangs low', () => {
  const { overhead } = city();
  const lid = overhead([
    { x1:-44, x2:-39, z1:-40, z2:-16, y1:4.48 },   // the canopy
    { x1:-39.2, x2:-39.0, z1:-30, z2:-28, y1:2.4 }, // a sign on the wall, a hand above your hair
  ]);
  assert.equal(lid(-41.5, -25, 0), 4.48, 'under the canopy the lid is the canopy');
  assert.equal(lid(-41.5, -25, 5), Infinity, 'standing on a roof above it, the canopy is not over your head');
  assert.equal(lid(-39.5, -29, 0), 4.48, 'a sign barely above head height is looked over, not ducked under');
  assert.equal(lid(0, 0, 0), Infinity, 'in the open there is nothing to duck under');
  assert.equal(lid(-44.8, -25, 0), 4.48, 'a metre either side still counts: what blinds a lens is just in front of it');
});

test('the lens can tell when a lantern is in its face, or between it and Robin', () => {
  const { lensTest } = city();
  const L = lensTest([{ x1:-1, x2:1, y1:2, y2:3, z1:-1, z2:1 }]);
  assert.ok(L.near(0, 2.5, 1.3, 0.45), 'a lens 30 cm from the lantern is up against it');
  assert.ok(!L.near(0, 2.5, 3, 0.45), 'two metres off is clear');
  assert.ok(L.seg(0, 2.5, -5, 0, 2.5, 5), 'a line straight through it is blocked');
  assert.ok(!L.seg(0, 4, -5, 0, 4, 5), 'a line over the top of it is not');
});

test('the city hands the camera its lid and its lens, and TSH uses both', () => {
  const c = read('public/tshcity.js'), t = read('public/tsh.js');
  has(c, /out\.ceilingAt = overhead\(/);
  has(c, /out\.lens = lensTest\(/);
  has(t, /G\.ground = groundAt; G\.ceiling = streetLid;/, 'outside, the chase camera has to be told about the canopy');
  has(t, /function render\(dt\)\{[\s\S]{0,120}chaseCam\(dt\)/, 'the lens check runs after game.js has placed the camera');
});

test('the deal and the flat are conversations you play, not subtitles on a timer', () => {
  const t = read('public/tsh.js');
  const deal = t.slice(t.indexOf('function dealBegin('), t.indexOf('function tickDeal('));
  has(deal, /convo\(\[/, 'the deal is a conversation');
  assert.ok((deal.match(/\{ ask:/g) || []).length >= 3, 'Robin decides at least three things at the deal');
  has(deal, /Show him the rings/, 'the rings-first choice is offered');
  has(deal, /Keep the rings/, 'the run-with-the-money choice is offered');
  hasNot(deal, /talk\('deal/, 'the deal must not fall back to timed subtitles');
  const flat = t.slice(t.indexOf('function startConversation('), t.indexOf('function aptMoves('));
  has(flat, /convo\(\[/, 'Maya\'s pitch is a conversation');
  has(t, /function aptMoves\(\)[\s\S]{0,900}Lunge for the light switch[\s\S]{0,400}Go for the window[\s\S]{0,400}Flash her/, 'Robin can act instead of answering');
});

test('every line in a conversation waits for the player', () => {
  const t = read('public/tsh.js');
  has(t, /function convoAdvance\(\)/);
  has(t, /if\(mode === 'talk'\) return convoKey\(e\);/, 'keys go to the conversation first');
  has(t, /talk\(s\.lines, [\s\S]{0,120}\{ paced:true \}\)/, 'a cutscene\'s lines wait for SPACE');
  has(t, /if\(q\.paced && q\.i >= 0\)\{ if\(!q\.go\) return;/, 'a paced line stays up until it is moved on');
});

test('the words are drawn on the letterbox, not under it', () => {
  const css = read('public/app.css');
  has(css, /#tsh \.tsh-sub,#tsh \.tsh-talk\{z-index:2\}/, 'subtitles have to sit above the black bars');
});

/* ------------------------------------------------------------ the kit
   Robin's jewelry: finished at her bench before the night starts, and
   what lets her climb, blind, and jam her way through it after. */
function rules(){
  const ctx = vm.createContext({ Math });
  ctx.window = ctx;
  vm.runInContext(read('public/tshai.js'), ctx, { filename:'tshai.js' });
  return ctx.TSHAI;
}

test('the night starts at the bench, before ten, and the deal comes after it', () => {
  const A = rules();
  assert.equal(A.next('intro', 'start'), 'prep', 'a fresh night opens in the workshop');
  assert.equal(A.next('prep', 'done'), 'deal', 'leaving the flat with the kit starts the deal');
  assert.equal(A.clock(-20), '21:40', 'the workshop reads as 21:40, not 22:00');
  assert.equal(A.clock(0), '22:00');
  assert.equal(A.clock(75), '23:15');
  assert.equal(A.CHECKPOINT.prep, 'prep');
});

test('every piece of the kit says what it does and what uses it', () => {
  const A = rules();
  assert.deepEqual([...A.KIT_ORDER], ['cuffs', 'bangles', 'studs', 'rings']);
  const keys = A.KIT_ORDER.map(p => A.KIT[p].key).filter(Boolean);
  assert.deepEqual(keys, ['G', 'F', 'J'], 'cuffs on G, bangles on F, studs on J');
  A.KIT_ORDER.forEach(p => assert.ok(A.KIT[p].name && A.KIT[p].does.length > 30, p + ' needs a name and a sentence about what it does'));
  assert.ok(A.CRIMES.gear, 'using the cuffs where WFC can see is a crime of its own');
});

test('the grip reaches a high roof but not the two towers', () => {
  const { GRIP } = rules();
  const reach = GRIP.hold*GRIP.up;
  assert.ok(reach >= 16 + 2, 'the ending wants a roof over 16 m: the cuffs have to be one way up');
  assert.ok(reach < 26, 'if nothing is out of reach the grip is not a limit at all');
  assert.ok(GRIP.regen > 1, 'the film comes back on the ground in a few seconds');
});

test('the workshop builds every piece, and the pieces only work once they are built', () => {
  const t = read('public/tsh.js');
  has(t, /if\(S\.step === 'intro'\)\{ S\.step = 'prep'/, 'a fresh night starts in the workshop');
  const build = t.slice(t.indexOf('const BUILD = {'), t.indexOf('const bench = {'));
  ['cuffs', 'bangles', 'studs', 'rings'].forEach(p => has(build, new RegExp('\\n    ' + p + ': \\['), 'no bench steps for ' + p));
  has(t, /function flash\(\)\{\s*if\(!has\('bangles'\)\)/, 'the bangles have to be finished before F does anything');
  has(t, /function jam\(\)\{\s*if\(!has\('studs'\)\)/, 'the studs have to be finished before J does anything');
  has(t, /if\(S\.step === 'prep'\) return prepOut\(via\);/, 'the flat\'s door and window end the workshop');
  has(t, /if\(!kitDone\(\)\)\{ note\('Not yet/, 'and not before the pieces are finished');
});

test('G climbs a building\'s wall, and the ladders face the wall too', () => {
  const t = read('public/tsh.js');
  has(t, /if\(c === 'KeyG'\)\{ tryScale\(\); return true; \}/);
  has(t, /case 'scale': tickScale\(dt\); break;/);
  has(t, /s\.tag\.indexOf\('bld:'\) !== 0\) continue;/, 'only buildings are climbable: a hoarding at the edge of the map is not a way out of it');
  has(t, /function crimeSeen\(kind\)/, 'climb() has always called crimeSeen; it has to exist');
  has(t, /G\.yaw = me\.climbing\.face \+ Math\.PI;/, 'climbing a ladder facing away from it put the camera between her and the wall');
});

test('Robin carries the wall-climbing clips, and the cuffs play them', () => {
  const b = fs.readFileSync(path.join(__dirname, '..', 'public/characters/models/character-w.glb'));
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const names = (json.animations || []).map(a => a.name);
  ['climb_up', 'climb_down', 'climb_start', 'climb_top'].forEach(n => assert.ok(names.includes(n), 'character-w.glb has no ' + n + ' — see glb files/README.md, Robin climbs walls'));
  ['idle', 'walk', 'sprint', 'jump', 'talk', 'talk2', 'walk_left', 'ride'].forEach(n => assert.ok(names.includes(n), 'merging the climbs dropped ' + n));
  const t = read('public/tsh.js');
  has(t, /wallClip\(dt, 'climb_up', G_\.up\/G_\.clip\)/, 'the climb plays at the speed she climbs');
  has(t, /wallClip\(dt, 'climb_top', 1\)/, 'the mantle is the braced hang');
  has(t, /wallClip\(dt, 'climb_start', 1\)/, 'the run-up is the sprint to the wall');
});
