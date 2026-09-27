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
