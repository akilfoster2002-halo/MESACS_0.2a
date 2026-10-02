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

test('the night starts in her room at 22:15, and the deal comes after the shoes', () => {
  const A = rules();
  assert.equal(A.next('intro', 'start'), 'wake', 'a fresh night opens in her room');
  assert.equal(A.next('wake', 'out'), 'lesson', 'out of the window, and the shoes are hers to learn');
  assert.equal(A.next('lesson', 'done'), 'deal', 'and then the buyer');
  assert.equal(A.clock(A.AT.wake), '22:15', 'the buyer calls');
  assert.equal(A.clock(A.AT.deal), '22:30');
  assert.equal(A.clock(75), '23:15');
  assert.equal(A.CHECKPOINT.wake, 'wake');
  assert.equal(A.CHECKPOINT.lesson, 'lesson');
});

test('every piece of the kit says what it does and what uses it', () => {
  const A = rules();
  assert.deepEqual([...A.KIT_ORDER], ['boots', 'cuffs', 'bangles', 'studs', 'rings']);
  const keys = A.KIT_ORDER.map(p => A.KIT[p].key).filter(Boolean);
  assert.deepEqual(keys, ['SPACE', 'G', 'F', 'J'], 'the boots on SPACE, cuffs on G, bangles on F, studs on J');
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

test('the opening is a film: the call, her room, the kit, the note, the window — and then she is falling', () => {
  const t = read('public/tsh.js'), r = read('public/tshroom.js');
  has(t, /scene\('wake', opening\)/, 'a fresh night starts with the opening');
  const op = t.slice(t.indexOf('function opening('), t.indexOf('function outsideLook('));
  // the order of the film, as written
  const beats = ["phoneBig('call')", "talk('call')", "cue('hangup')", "black(false)", "kitOn('jacket')", "kitOn('gloves')", "kitOn('shoes')", "kitOn('bracelet')",
                 "kitOn('pack')", 'note.hold(', "note.home(); stage(", 'R.window.open(true)', 'inside:false', "stage('jump'"];
  beats.forEach((k, i) => { assert.ok(op.includes(k), 'the opening has ' + k); if(i) assert.ok(op.indexOf(beats[i - 1]) < op.indexOf(k), beats[i - 1] + ' comes before ' + k); });
  has(t, /\['buyer','Hey\. You got my order\?'\], \['robin','Yeah\. It\\'s ready\.'\]/, 'the call, word for word');
  has(t, /function vfx\(who, text\)\{ return who === 'counselor' \|\| who === 'buyer' \? 'phone'/, 'the buyer sounds like he is on the phone');
  // the room: a sixteen-year-old's mess, and a business
  ['function fashion(', 'function pcb(', 'room.sewing', 'room.form', 'room.packing', 'ORDER #', 'burner phones', 'cash', 'room.pack', 'room.kitchen', 'room.momDoor',
   "Dinner\\'s in the fridge.", 'Love you.', '— Mom', 'function cityView(', 'open(v)', 'STATIC GIRLS', 'function bootPair(']
    .forEach(k => assert.ok(r.includes(k), 'the room has ' + k));
  const b = fs.readFileSync(path.join(__dirname, '..', 'public/characters/models/character-x.glb'));
  const names = (JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')).animations || []).map(a => a.name);
  ['wake', 'text', 'kneel', 'walk', 'jump', 'roll'].forEach(n => assert.ok(names.includes(n), 'Robin\'s model has no ' + n + ' clip'));
  has(t, /if\(mode === 'reel'\)\{ if\(\(c === 'Enter'/, 'ENTER skips the film');
  // the score: Web of Silence, cut to the film — the first hit on the lamp, the breakdown at the window, the beat held while she falls, the drop on the BOOM
  ['tsh/music/wos-a.mp3', 'tsh/music/wos-b.mp3'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', f)), f + ' is in the repo'));
  has(t, /hit:15\.91, hold:\[153\.50, 154\.45\], drop:154\.40/, 'the song\'s own landmarks');
  assert.ok(op.includes('scoreStart()'), 'the song starts with the film');
  assert.ok(op.indexOf('scoreBreak()') > op.indexOf('note.hold('), 'the breakdown comes after the note, at the window');
  has(t, /function fallStart\(skipped\)\{[\s\S]{0,200}scoreHold\(\)/, 'falling, the last beat before the drop is held');
  has(t, /BOOTS\.fire\(\);\s*scoreDrop\(\);/, 'and the drop is the BOOM');
  // and then it is yours: in the air, slow, until SPACE fires the shoes
  has(t, /playReel\(shots, skipped=>fallStart\(skipped\)\)/, 'the film ends falling, skipped or not');
  has(t, /slow:\(\)=>slowFall\(\)/, 'the fall is slow until she fires');
  has(t, /lessonId\(\) === 'fire' && c === 'Space'/, 'SPACE fires the shoes');
  has(t, /BOOTS\.fire\(\)/);
});

test('the things in her room are Higgsfield models, each standing in for the boxes it replaces', () => {
  const r = read('public/tshroom.js');
  ['bed', 'sewing', 'form', 'jacket', 'sneakers', 'backpack', 'packages', 'guitar', 'amp', 'chair', 'table'].forEach(id => {
    const f = path.join(__dirname, '..', 'public', 'tsh', 'room', id + '.glb');
    assert.ok(fs.existsSync(f), id + '.glb is in public/tsh/room');
    assert.ok(fs.statSync(f).size < 400000, id + '.glb is small enough to download with the room');
    assert.ok(r.includes("swap('" + id + "'"), 'the room puts the ' + id + ' model in');
  });
  has(r, /mt\.metalness = o\.metal \|\| 0/, 'SAM\'s fully-metal default is undone, or every model is black');
  has(read('public/tsh.js'), /TSHROOM\.swap\('backpack', pack/, 'and the backpack on her back is the same model');
});

test('the first thing you play is the shoes: fire them, then hold SPACE and they do the rest', () => {
  const t = read('public/tsh.js');
  const L = t.slice(t.indexOf('const LESSON = ['), t.indexOf('const lesson = {'));
  ['THE SHOES', 'HOLD SPACE', 'KEEP HOLDING', 'POINT', 'THE RHYTHM', 'DRAGON ALLEY'].forEach((k, i, all) => {
    assert.ok(L.includes("title:'" + k + "'"), 'the lesson has ' + k);
    if(i) assert.ok(L.indexOf("title:'" + all[i - 1] + "'") < L.indexOf("title:'" + k + "'"), all[i - 1] + ' comes before ' + k);
  });
  assert.ok(L.includes("teach:['bound','jump','steer']"), 'the bound is switched on when it is taught');
  has(t, /BOOTS\.TECH\.early\.concat\(BOOTS\.TECH\.mid\)\.forEach\(t=>BOOTS\.learn\(t\)\)/, 'and the rest of the moves at the end of it');
  has(t, /function lessonDone\(\)\{[\s\S]{0,400}outcome\('done'\)/, 'the lesson ends in the deal');
  has(t, /BOOTS\.attach\(/, 'TSH puts the boots on');
  has(t, /enabled:\(\)=>!inside/, 'and takes them off indoors');
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

/* ------------------------------------------------------- the storyboard
   The second play-through: things happened at random. The Director came
   on every screen because a clock said 23:30, a raid started because you
   walked near a stall, the buyer left at eleven whatever you were doing.
   Now every scene has a turn and a trigger, and nothing talks out of it. */
test('the storyboard plays every scene in order, and only once', () => {
  const A = rules();
  const ids = A.STORY.map(s=>s.id);
  assert.deepEqual(ids.slice(0, 7), ['wake', 'lesson', 'deal', 'drop', 'news', 'roof', 'voicemail']);
  A.STORY.forEach(s=>{ assert.ok(s.on, s.id + ' says what sets it off'); (s.after||[]).forEach(a=>assert.ok(ids.indexOf(a) < ids.indexOf(s.id), s.id + ' comes after ' + a)); });
  assert.equal(A.ready([], 'news'), false, 'no broadcast before the deal');
  const O = ['wake', 'lesson'];
  assert.equal(A.ready(O, 'news'), false);
  assert.equal(A.ready([], 'lesson'), false, 'no lesson before the window');
  assert.equal(A.ready(O.concat('drop'), 'news'), true, 'the dead drop counts as the deal');
  assert.equal(A.ready(O.concat('deal', 'news'), 'news'), false, 'a scene plays once');
  assert.equal(A.ready(O.concat('deal'), 'voicemail'), false, 'home comes after the roof');
  assert.equal(A.ready(O.concat('deal', 'news', 'roof'), 'maya'), false, 'Maya waits for the voicemail');
  assert.equal(A.next('deal', 'paid'), 'news', 'after the deal, the street');
  assert.equal(A.next('news', 'watched'), 'home');
  assert.equal(A.next('news', 'home'), 'news', 'you do not get home without passing the screens');
  assert.equal(A.next('drop', 'home'), 'drop', 'nor from the dead drop');
  assert.deepEqual(A.seenBefore('home'), ['wake', 'lesson', 'deal', 'news', 'roof'], 'an old save picks up where it was');
});

test('nothing in the night happens because the clock said so', () => {
  const A = rules(), t = read('public/tsh.js');
  assert.deepEqual(Object.keys(A.AT).sort(), ['deal', 'end', 'wake'], 'the clock has no story times in it');
  hasNot(t, /AI\.AT\.(kaiArrives|kaiGivesUp|speech|checkpointOn|checkpointOff|clubOut)/, 'no beat reads a story time');
  hasNot(t, /function raid\(/, 'no raid on a timer');
  hasNot(t, /talk\('released'\)/, 'the Director does not phone out of nowhere');
  hasNot(t, /function speech\(/, 'the speech is a scene now');
  has(t, /scene\('news', newsScene\)/, 'the broadcast is the storyboard\'s news scene');
  has(t, /const want = S\.step === 'home' \|\| S\.heat >= AI\.HEAT\.checkpoints;/, 'the checkpoint goes up with the walk home');
  has(t, /scene\('voicemail'/, 'the voicemail is a scene');
  has(t, /scene\('maya', /, 'and Maya is the one after it');
});

test('every line spoken in the night has a recording, in the voice of who says it', async () => {
  const { lines, vkey } = await import('../tools/tsh-voices.mjs');
  const t = read('public/tsh.js');
  const ctx = vm.createContext({}); ctx.window = ctx;
  vm.runInContext(read('public/tshvoice.js'), ctx);
  const have = ctx.TSHVOICE.lines;
  const all = lines(t);
  assert.ok(all.length > 120, 'the whole script, not a sample');
  const missing = all.filter(l=>!have[l.key]).map(l=>l.who + ': ' + l.text);
  assert.deepEqual(missing, [], 'record these with tools/tsh-voices.mjs');
  all.forEach(l=>assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'tsh', 'voice', l.key + '.mp3')), l.text));
  // the game and the tool name a line the same way
  const m = /function vkey\(who, text\)\{([\s\S]*?)\n  \}/.exec(t);
  assert.ok(m, 'tsh.js has vkey');
  const vk = new Function('who', 'text', m[1]);
  ['Hi, Mom.', 'She\'s… on a delivery truck. Doing laps.', 'Kai — the window!'].forEach(s=>assert.equal(vk('maya', s), vkey('maya', s)));
  hasNot(JSON.stringify(all.map(l=>l.text)), /📱/, 'texts are read, not heard');
});
