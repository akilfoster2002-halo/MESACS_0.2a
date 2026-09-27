/* SANFRAN, the quest world (sanfran.js, sfbots.js).

   Two promises this quest makes are easy to break without noticing: that
   it is played rather than read, and that it is lit rather than black. A
   paragraph slips back into a panel one line at a time; a wall a camera
   can pass through only shows up as a black screen on somebody else's
   machine. These are the checks that fail loudly instead. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* Just enough THREE for the two files to load and answer questions about
   their rules: every constructor makes an object, and a Vector3 holds x y z. */
function load(){
  function Any(){ this.userData = {}; }
  function Vec(x, y, z){ this.x = x||0; this.y = y||0; this.z = z||0; }
  const THREE = new Proxy({ Vector3:Vec }, { get:(t, k) => t[k] || Any });
  const ctx = vm.createContext({ console, THREE, addEventListener(){}, Math });
  ctx.window = ctx;
  vm.runInContext(read('public/sfbots.js'), ctx, { filename:'sfbots.js' });
  vm.runInContext(read('public/sanfran.js'), ctx, { filename:'sanfran.js' });
  return ctx;
}

test('the page loads the robots before the quest, and Wano has the gate', () => {
  const html = read('public/index.html');
  const at = f => html.indexOf('src="' + f + '?');
  assert.ok(at('sfbots.js') > 0, 'sfbots.js is not on the page');
  assert.ok(at('sanfran.js') > at('sfbots.js'), 'sanfran.js builds its items from SFBOTS, so it must load after it');
  assert.match(read('public/planet.js'), /SANFRAN\.enter\(server\)/);
});

test('every line anybody says is seven words or fewer', () => {
  const { SANFRAN } = load();
  const lines = Object.entries(SANFRAN.LINES).flatMap(([k, ls]) => ls.map(l => [k, l[0], l[1]]));
  assert.ok(lines.length > 10, 'LINES is nearly empty — did the story move somewhere else?');
  for(const [key, who, text] of lines){
    const words = text.replace(/[📱…]/gu, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
    assert.ok(words.length <= 7, `${key}: ${who} says ${words.length} words — "${text}". A bubble is read at a glance or not at all.`);
  }
});

test('nobody talks outside LINES, and there is no dialogue box to press through', () => {
  const src = read('public/sanfran.js');
  assert.doesNotMatch(src, /function dialog\(/, 'the press-SPACE-for-the-next-line dialogue box is back');
  assert.doesNotMatch(src, /\bsay\(/, 'say() put a sentence on the screen for looking at a poster');
  assert.doesNotMatch(src, /<p[ >]/, 'a <p> is a paragraph, and the panels are pictures and buttons');
  // every talk() names a conversation that exists
  const { SANFRAN } = load();
  for(const m of src.matchAll(/talk\('([a-zA-Z0-9]+)'/g))
    assert.ok(SANFRAN.LINES[m[1]], `talk('${m[1]}') has no lines`);
});

test('a room wall is thicker than the gap between the chase camera\'s samples', () => {
  /* thirdPerson() in game.js looks for walls by sampling the line from
     your head to where the camera wants to be, `steps` times. A wall
     thinner than one step can fall between two samples, and then the
     camera is outside the room and the screen is the back of a wall. */
  const game = read('public/game.js');
  const back = +game.match(/const CAM = \{ back:([\d.]+)/)[1];
  const steps = +game.match(/function thirdPerson\(\)[\s\S]*?const steps=(\d+)/)[1];
  const T = +read('public/sanfran.js').match(/function walls\(W, D, H, mat\)\{\s*const T = ([\d.]+)/)[1];
  assert.ok(T > back/steps, `walls are ${T} m thick but the camera samples every ${(back/steps).toFixed(2)} m`);
});

test('the light rig is SANFRAN\'s while you are there, and handed back when you leave', () => {
  const src = read('public/sanfran.js');
  const leave = src.match(/function leave\(\)\{([\s\S]*?)\n  \}/)[1];
  assert.match(leave, /giveRigBack\(\)/, 'leave() keeps SANFRAN\'s exposure, sky and sun on Wano');
  const back = src.match(/function giveRigBack\(\)\{([\s\S]*?)\n  \}/)[1];
  for(const bit of ['toneMappingExposure', 'environment = null', 'G.amb.color', 'G.hemi.color', 'G.sun.color'])
    assert.ok(back.includes(bit), `giveRigBack() does not put back ${bit}`);
  // and no scene is built out of near-black paint
  const looks = src.match(/const LOOKS = \{([\s\S]*?)\n  \};/)[1];
  for(const scene of ['bedroom', 'street', 'market', 'arena'])
    assert.match(looks, new RegExp(scene + ':\\{[^]*?exp:1\\.[2-9]'), `${scene} has no exposure of its own`);
});

test('a hit lands on the side it came from, and the Titan\'s right motor is the one that doubles', () => {
  const { SFBOTS } = load();
  const facingZ = { x:0, z:0, a:0 };                                  // facing +z
  assert.strictEqual(SFBOTS.where({ x:0, z:5 }, facingZ), 'front');
  assert.strictEqual(SFBOTS.where({ x:0, z:-5 }, facingZ), 'rear');
  /* Facing +z, your own left hand is at +x. The model puts wheels[1] at
     +x, which is why it is the one painted with the LEFT motor's damage. */
  assert.strictEqual(SFBOTS.where({ x:5, z:0 }, facingZ), 'left');
  assert.strictEqual(SFBOTS.where({ x:-5, z:0 }, facingZ), 'right');
  assert.ok(SFBOTS.FOES.titan.weakRight, 'the Titan has no weak motor to find');
  assert.match(read('public/sfbots.js'), /wheels\[1\]\.userData\.tyre\.material\.color\.setHex\(u\.hp\.lmotor/,
    'the left motor\'s damage is painted on the wrong wheel');
});

test('a bench with no weapon shows no weapon, and plating is armour', () => {
  const { SFBOTS } = load();
  const bare = SFBOTS.stats({ frame:'frame_balanced' });
  assert.strictEqual(bare.weaponKind, null, 'an empty weapon slot shows up as a hammer nobody bought');
  const plated = SFBOTS.stats({ frame:'frame_balanced', plating:true });
  assert.strictEqual(plated.armor - bare.armor, 30);
  const fast = SFBOTS.stats({ frame:'frame_light', motor:'motor_sprint' });
  assert.ok(fast.speed > bare.speed && fast.armor < bare.armor, 'a light frame and a sprint motor are not a trade-off any more');
});
