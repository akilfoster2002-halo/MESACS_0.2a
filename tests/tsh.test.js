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

test('the flat is a conversation you play, not subtitles on a timer', () => {
  const t = read('public/tsh.js');
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
  const b = fs.readFileSync(path.join(__dirname, '..', 'public/characters/models/character-robin.glb'));
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
  const roll = fs.readFileSync(path.join(__dirname, '..', 'public/characters/wardrobe/roll-top.glb')), floor = fs.readFileSync(path.join(__dirname, '..', 'public/tsh/room/backpack.glb'));
  assert.ok(roll.equals(floor), 'and the backpack on her back (the wardrobe\'s roll-top) is the one off her floor');
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
  assert.deepEqual(ids.slice(0, 7), ['wake', 'lesson', 'deal', 'raid', 'mom', 'sleep', 'watchers'], 'the prologue: the alley, WFC, the phone, 3 AM, the binoculars');
  assert.deepEqual(ids.slice(7, 11), ['news', 'roof', 'voicemail', 'maya'], 'and Part Two after it');
  A.STORY.forEach(s=>{ assert.ok(s.on, s.id + ' says what sets it off'); (s.after||[]).forEach(a=>assert.ok(ids.indexOf(a) < ids.indexOf(s.id), s.id + ' comes after ' + a)); });
  const O = ['wake', 'lesson'];
  assert.equal(A.ready([], 'lesson'), false, 'no lesson before the window');
  assert.equal(A.ready(O, 'raid'), false, 'no WFC before the deal');
  assert.equal(A.ready(O.concat('deal'), 'raid'), true, 'the fight in the alley, then the billboard');
  assert.equal(A.ready(O.concat('deal', 'raid'), 'raid'), false, 'a scene plays once');
  assert.equal(A.ready(O.concat('deal'), 'mom'), false, 'Mom calls in the chase, not before it');
  assert.equal(A.ready(O.concat('deal', 'raid'), 'sleep'), false, 'home comes after the call');
  assert.equal(A.ready(O.concat('deal', 'raid', 'mom', 'sleep'), 'watchers'), true, 'and the binoculars last');
  assert.equal(A.ready(O.concat('deal'), 'news'), false, 'the broadcast is Part Two now');
  assert.equal(A.next('deal', 'fought'), 'raid', 'after the fight, WFC');
  assert.equal(A.next('raid', 'home'), 'night', 'home over the roofs, and 3 AM');
  assert.equal(A.next('night', 'slept'), 'end');
  assert.equal(A.next('raid', 'watched'), 'raid', 'nothing else ends the chase');
  assert.deepEqual(A.seenBefore('raid'), ['wake', 'lesson', 'deal']);
  assert.equal(A.next('deal', 'paid'), 'deal', 'there is no paying: the buyer never meant to');
  assert.equal(A.next('news', 'watched'), 'home');
  assert.equal(A.next('news', 'home'), 'news', 'you do not get home without passing the screens');
  assert.equal(A.CHECKPOINT.drop, 'deal', 'a night saved in the old dead drop is back at the deal');
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
  // lines written but not recorded yet (the prologue finale): they play as subtitles until they are.
  // Record one, and it comes off this list; anything new without a recording still fails here.
  const awaiting = new Set(JSON.parse(read('tests/tsh-unrecorded.json')));
  const missing = all.filter(l=>!have[l.key]).map(l=>l.who + ': ' + l.text);
  assert.deepEqual(missing.filter(m=>!awaiting.has(m)), [], 'record these with tools/tsh-voices.mjs');
  assert.deepEqual([...awaiting].filter(m=>!missing.includes(m)), [], 'recorded (or rewritten) now: take these off tests/tsh-unrecorded.json');
  all.filter(l=>have[l.key]).forEach(l=>assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'tsh', 'voice', l.key + '.mp3')), l.text));
  // the game and the tool name a line the same way
  const m = /function vkey\(who, text\)\{([\s\S]*?)\n  \}/.exec(t);
  assert.ok(m, 'tsh.js has vkey');
  const vk = new Function('who', 'text', m[1]);
  ['Hi, Mom.', 'She\'s… on a delivery truck. Doing laps.', 'Kai — the window!'].forEach(s=>assert.equal(vk('maya', s), vkey('maya', s)));
  hasNot(JSON.stringify(all.map(l=>l.text)), /📱/, 'texts are read, not heard');
});

/* ------------------------------------------------------ Dragon Alley
   The deal is a fight now: the buyer (not Kai — Kai is not seen yet) does
   not pay, and his crew comes out of the alley. A film as the night
   opened, then the gauntlets taught a move at a time in slow motion,
   every hit landing with a jolt; then a film out. */
function fight(){
  const ctx = vm.createContext({ Math, console });
  ctx.window = ctx; ctx.THREE = { Vector3:function(){} }; ctx.G = { keys:{}, pos:{} };
  vm.runInContext(read('public/tshfight.js'), ctx, { filename:'tshfight.js' });
  return ctx.TSHFIGHT;
}

test('Kai is not in the alley: the buyer is somebody else, with a crew', () => {
  const t = read('public/tsh.js');
  hasNot(t, /function dealBegin\(|function kaiSchedule\(|function leaveInMailbox\(/, 'the Kai deal is gone');
  const story = t.slice(t.indexOf('const LINES = {'), t.indexOf('const WHO = {'));
  const alley = story.slice(story.indexOf('fightIn1'), story.indexOf('fightOut5'));
  hasNot(alley, /\['kai'/, 'Kai says nothing in Dragon Alley');
  has(t, /dealer:\['THE BUYER'/, 'the buyer has a name card of his own');
  has(t, /if\(S\.step === 'deal' \|\| S\.step === 'lesson'\) crewCast\(\);/, 'his crew is in the alley from the start of the beat');
  has(t, /scene\('deal', fightIntro\)/, 'walking up to him starts the film');
  ['character-thug-buyer.glb', 'character-thug-a.glb', 'character-thug-b.glb'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'characters', 'models', f)), f));
  const a = read('public/avatar.js');
  ['thug-buyer', 'thug-a', 'thug-b'].forEach(id => has(a, new RegExp("id:'" + id + "'"), id + ' is a body avatar.js can load'));
});

test('the alley scene is told the way the night opened: a film, then yours, then a film', () => {
  const t = read('public/tsh.js');
  const intro = t.slice(t.indexOf('function fightIntro('), t.indexOf('function fightBegin('));
  // the script, in order
  const beats = ["caption('EXT. DRAGON ALLEY", "talk('fightIn1')", "talk('fightIn2')", "cue('rise')", "cue('sting')", "talk('fightIn3')", "talk('fightIn4')", "fprop.bagOn = t1",
                 "talk('fightIn5')", "fprop.bagOn = buyer", "cue('hurt')", "talk('fightIn6')", 'pack:false', "talk('fightIn7')", 'cuffGlow(true)'];
  beats.forEach((k, i) => { assert.ok(intro.includes(k), 'the film has ' + k); if(i) assert.ok(intro.indexOf(beats[i - 1]) < intro.indexOf(k), beats[i - 1] + ' comes before ' + k); });
  has(intro, /playReel\(shots, \(\)=>fightBegin\(/, 'a film (ENTER skips it), and the fight after it, skipped or not');
  const outro = t.slice(t.indexOf('function fightOutro('), t.indexOf('function wireQuestThings('));
  const after = ["fprop.bagOn = 'robin'", "talk('fightOut1')", "talk('fightOut2')", "talk('fightOut3')", 'me.kit = null', "phoneBig('text')", "talk('fightText')",
                 "talk('fightOut4')", "talk('fightOut5')", "phoneBig('reply')", "outcome('fought')"];
  after.forEach((k, i) => { assert.ok(outro.includes(k), 'the film after has ' + k); if(i) assert.ok(outro.indexOf(after[i - 1]) < outro.indexOf(k), after[i - 1] + ' comes before ' + k); });
  has(t, /case 'fight': tickFight\(dt\); break;/, 'the fight runs in the frame');
  has(t, /if\(mode === 'fight'\)\{[\s\S]{0,120}TSHFIGHT\.key\(e\)/, 'and has the keys');
  has(t, /enabled:\(\)=>!inside && mode !== 'fight'/, 'the shoes stay out of it');
  has(t, /if\(path\.includes\('fought'\)\) lines = lines\.concat\(LINES\.roofFought\)/, 'and the roof knows what happened in the alley');
  const i = read('public/index.html');
  assert.ok(i.indexOf('tshfight.js') > 0 && i.indexOf('tshfight.js') < i.indexOf('src="tsh.js'), 'the fight loads before TSH');
});

test('the fight teaches the gauntlets in the order the crew comes at her', () => {
  const F = fight();
  assert.deepEqual([...F.STEPS.map(s=>s.id)], ['attack', 'dodge', 'combo', 'break', 'parry', 'more', 'pull', 'free', 'regret', 'last']);
  F.STEPS.filter(s=>s.title).forEach(s => assert.ok(s.how.length > 20, s.id + ' says what to press'));
  const src = read('public/tshfight.js');
  // the gauntlet's two moves: the power punch (hold, let go) and the pull, like a line cast out
  assert.ok(F.MOVE.power.fly > F.MOVE.kick.push*4 && F.MOVE.power.dmg >= 4, 'the power punch throws a man');
  has(src, /input\.heldT > 0\.38/, 'holding the punch charges it');
  has(src, /t\.state = 'pulled'/, 'the pull drags him in');
  has(src, /function tether\(e\)/, 'and you can see the line');
  assert.deepEqual([...F.CHAIN], ['jab', 'cross', 'hook', 'kick'], 'four clicks: jab, cross, hook, kick');
  // the robin clips the moves ask for are in her fight file or on her body
  const clips = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'public', f)); return (JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')).animations || []).map(a => a.name); };
  const hers = clips('characters/fight/robin.glb').concat(clips('characters/models/character-robin.glb'));
  Object.values(F.MOVE).forEach(m => assert.ok(hers.includes(m.clip), 'Robin has no ' + m.clip + ' clip'));
  ['dodge', 'block', 'hit', 'fall', 'fight', 'flip', 'jump', 'stagger'].forEach(n => assert.ok(hers.includes(n), 'Robin has no ' + n + ' clip'));
  const theirs = clips('characters/models/character-thug-a.glb');
  ['fight', 'jab', 'cross', 'hook', 'block', 'hit', 'stagger', 'fall', 'getup', 'ko', 'walk_left', 'walk_back'].forEach(n => assert.ok(theirs.includes(n), 'the crew has no ' + n + ' clip'));
  // every line the fight says is in the script
  const t = read('public/tsh.js');
  (src.match(/say\('(\w+)'/g) || []).concat((src.match(/after:'(\w+)'/g) || [])).forEach(m => { const k = m.match(/'(\w+)'/)[1]; assert.ok(t.includes('    ' + k + ':'), 'LINES has ' + k); });
});

test('aim, then strike: the mouse picks the man, and what she throws depends on where he is and what he is doing', () => {
  const src = read('public/tshfight.js');
  const F = fight();
  // every move a click can throw is one of hers, and has a clip she has
  const clips = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'public', f)); return (JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')).animations || []).map(a => a.name); };
  const hers = clips('characters/fight/robin.glb');
  F.STRINGS.forEach(s => s.forEach(n => assert.ok(F.MOVE[n] && hers.includes(F.MOVE[n].clip), n + ' is a move with a clip')));
  ['knee', 'elbow', 'zip', 'spin', 'sweep'].forEach(n => assert.ok(F.MOVE[n] && hers.includes(F.MOVE[n].clip), n));
  assert.ok(F.MOVE.spin.area && F.MOVE.sweep.area, 'the hurricane kick and the sweep take everyone in reach');
  assert.deepEqual([...F.STRINGS[0]], [...F.CHAIN], 'the first string is the one the lesson teaches');
  // the aim: the camera (the mouse) and the direction held
  has(src, /function aimDir\(\)\{[\s\S]{0,400}const look = G\.yaw \+ Math\.PI;/, 'the camera is the aim');
  has(src, /cs <= bs \+ 0\.35/, 'the marked man keeps the mark until somebody is plainly a better pick');
  has(src, /const t = \(R\.forceTarget && standing\(R\.forceTarget\)\) \? R\.forceTarget : \(aimTarget\(\)/, 'a click goes at the one you aim at');
  has(src, /if\(t && d > FAR\)\{ R\.chain = 0; return 'zip'; \}/, 'across the alley: the flying kick');
  has(src, /\(R\.combo \+ 1\) % 5 === 0/, 'every fifth hit is a finisher');
  has(src, /t\.state === 'stagger' && t\.parried && d < 2\.2/, 'a man left wide open gets the knee and the elbow');
  has(src, /if\(!dir \|\| !dir\.free\)\{[\s\S]{0,200}CHAIN\[R\.chain\+\+\]/, 'and the lessons still teach the chain as written');
  // the camera keeps both of them in the picture, and pushes in on a hit
  has(src, /cam\.pull = lerp\(cam\.pull, t \? clamp\(\(td - 2\)/, 'further back the further off he is');
  has(src, /camPunch\(big \? 1 : 0\.45\)/, 'a hit pushes the lens in');
  has(src, /G\.camera\.fov = baseFov; G\.camera\.updateProjectionMatrix\(\);/, 'and the lens is put back after');
});

test('the alley is wide enough to fight in, and the fight stays inside it', () => {
  const c = read('public/tshcity.js'), F = fight();
  const m = c.match(/const X1 = (-?\d+), X2 = (-?\d+), Z1 = (-?\d+), Z2 = (-?\d+)/);
  const [X1, X2] = [+m[1], +m[2]];
  assert.ok(X2 - X1 >= 10, 'Dragon Alley is at least ten metres wide');
  has(c, new RegExp("\\['B1', -56, " + X1 + ","), 'B1 stops at the west wall');
  has(c, new RegExp("\\['B3', " + X2 + ","), 'B3 starts at the east wall');
  has(c, new RegExp('alleyFloor\\(' + X1 + ', ' + X2 + ','), 'and the wet floor runs wall to wall');
  assert.ok(F.ARENA.x1 > X1 && F.ARENA.x2 < X2, 'the fight stays off the walls');
  [F.MEET.robin, F.MEET.buyer].forEach(p => assert.ok(p[0] > F.ARENA.x1 && p[0] < F.ARENA.x2, 'and starts inside it'));
});

test('out of the way: SPACE, and she picks the move — a backflip, a cartwheel, a roll — and a click comes out of it as a sweep', () => {
  const src = read('public/tshfight.js'), t = read('public/tsh.js'), F = fight();
  const clips = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'public', f)); return (JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')).animations || []).map(a => a.name); };
  const hers = clips('characters/fight/robin.glb');
  ['cartL', 'cartR', 'flip', 'roll', 'wall', 'vault'].forEach(k => { assert.ok(F.EVADE[k], k); assert.ok(hers.includes(F.EVADE[k].clip), 'her fight file has ' + F.EVADE[k].clip); });
  // the fight's own copies: the shoes' flip and roll keep their own speed
  assert.ok(!['flip', 'roll'].includes(F.EVADE.flip.clip) && !['flip', 'roll'].includes(F.EVADE.roll.clip), 'the fight plays its own copies of the flip and the roll');
  has(src, /const pick = evadeFor\(p, \(fx \|\| fz\) \? a : null\);/, 'SPACE alone: she picks; a direction held only steers');
  has(src, /offer\('flip', from,[\s\S]{0,200}offer\(cart\(from \+ Math\.PI\/2\)[\s\S]{0,200}offer\('roll'/, 'straight back a backflip, to the sides a cartwheel, a roll when back is crowded');
  has(src, /if\(room < v\.go\*0\.55\) return;/, 'never into a wall or the car');
  has(src, /R\.lastEvade === fam\(kind\) \? 0\.9 : 0/, 'and not the same move twice running if another will do');
  has(src, /if\(R\.act === 'dodge' && R\.evade && kind === 'punch'\)\{ R\.buffer = kind; return false; \}/, 'a click mid-cartwheel is kept for the landing');
  has(src, /if\(R\.outOfEvade\)\{[\s\S]{0,80}return 'sweep'/, 'and comes out as a sweep');
  has(t, /Object\.values\(TSHFIGHT\.EVADE\)\.forEach\(v=>\{ speed\[v\.clip\] = v\.speed; \}\)/, 'played at the speed the fight sets');
  ['cartL', 'cartR', 'bflip', 'wallkick', 'evroll', 'evflip'].forEach(n => has(t, new RegExp("'" + n + "'\\]?, ?|'" + n + "'\\]"), n + ' plays once'));
});

test('the fight is over when the last of them is down, whatever the lessons were doing', () => {
  const src = read('public/tshfight.js'), F = fight();
  assert.equal(F.STEPS.find(x=>x.id === 'free').done(), false, 'the free fight has no end of its own');
  has(src, /if\(dir\.free && !dir\.ending && s\.id !== 'regret' && s\.id !== 'last' && !E\.some\(e=>e\.kind !== 'buyer' && e\.hp > 0\)\)\{/, 'the last one down ends it, from any step');
  has(src, /if\(dir\.freeze\) unfreeze\(\);/, 'a lesson frozen on nobody is let go');
  has(src, /const when = e => e\.state === 'down' \? Infinity/, 'the one who gets back up is the last one she put down');
  has(src, /ctx\.say\('fightGreat', fin\); ctx\.later\(fin, 1300\);/, 'and the film after it starts on a clock, not on a voice that may never finish');
});

test('recorded sound effects: every file the list names is there, and a cue with none keeps its tone', () => {
  const t = read('public/tsh.js');
  const ctx = vm.createContext({}); ctx.window = ctx;
  vm.runInContext(read('public/tshsfx.js'), ctx);
  const S = ctx.TSHSFX;
  assert.ok(S && S.files && S.vol, 'the list is loaded');
  Object.entries(S.files).forEach(([k, list]) => list.forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'tsh', 'sfx', f)), k + ': ' + f)));
  Object.keys(S.vol).forEach(k => assert.ok(S.files[k], 'a volume for a sound with no files: ' + k));
  has(t, /sfxLoad\(a\); if\(sfxPlay\(a, kind\)\) return;/, 'cue plays the recording when there is one, and falls through to the tone when not');
  const i = read('public/index.html');
  assert.ok(i.indexOf('tshsfx.js') > 0 && i.indexOf('tshsfx.js') < i.indexOf('src="tsh.js'), 'the list loads before TSH');
});

test("Robin's face: the shapes are on her, she blinks and talks with them, and every line she says has a feeling", async () => {
  const t = read('public/tsh.js'), a = read('public/avatar.js');
  const b = fs.readFileSync(path.join(__dirname, '..', 'public', 'characters', 'models', 'character-robin.glb'));
  const J = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const names = (J.meshes[0].extras || {}).targetNames || [];
  ['jawOpen', 'smile', 'mouthO', 'frown', 'browUp', 'browDown', 'blink'].forEach(n => assert.ok(names.includes(n), 'her model has the ' + n + ' shape'));
  assert.equal((J.meshes[0].primitives[0].targets || []).length, names.length, 'one target per name');
  has(a, /function faceTick\(dt\)\{[\s\S]{0,400}face\.blinkIn -= dt;/, 'she blinks by herself');
  has(t, /lips\.an\.getFloatTimeDomainData/, 'her mouth follows her voice');
  has(t, /lips\.flap = recorded \? 0 :/, 'and a line not recorded yet still moves her mouth');
  const FEELS = eval('(' + t.match(/const FEELS = (\{[\s\S]*?\n  \});/)[1] + ')'), FEEL = eval('(' + t.match(/const FEEL = (\{[\s\S]*?\n  \});/)[1] + ')');
  Object.values(FEEL).forEach(f => assert.ok(FEELS[f], 'a feeling that exists: ' + f));
  const { lines } = await import('../tools/tsh-voices.mjs');
  const hers = lines(t).filter(l => l.who === 'robin').map(l => l.text);
  hers.forEach(x => assert.ok(FEEL[x], 'what does she feel saying "' + x + '"? (FEEL in tsh.js)'));
  assert.ok(new Set(hers.map(x => FEEL[x])).size >= 10, 'a range of feelings, not three');
  // the films' silent moods: each one a feeling there is, and the opening (where her face is bare) acted all the way through
  (t.match(/mood:'(\w+)'/g) || []).forEach(m => { const k = m.slice(6, -1); assert.ok(FEELS[k], 'a mood that exists: ' + k); });
  const open = t.slice(t.indexOf('  function opening('), t.indexOf('  function opening(') + 12000);
  assert.ok((open.match(/mood:'/g) || []).length >= 15, 'the opening has her feeling her way through it');
  ['sleepy', 'sad', 'grin'].forEach(k => assert.ok(open.includes("mood:'" + k + "'"), 'the opening has ' + k));
  has(t, /if\(mode === 'reel' && lips\.mood && lips\.feelT <= 0/, 'a shot\'s mood holds under her lines');
});

test('Maya: her own body, dressed a piece at a time, a face, and four arms that carry her at the end', () => {
  const t = read('public/tsh.js'), a = read('public/avatar.js'), w = read('public/wardrobe.js'), i = read('public/index.html');
  has(a, /id:'maya', name:'Maya'/, 'Maya is a body avatar.js can load');
  const b = fs.readFileSync(path.join(__dirname, '..', 'public', 'characters', 'models', 'character-maya.glb'));
  const J = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  ['jawOpen', 'smile', 'blink', 'browUp'].forEach(n => assert.ok(((J.meshes[0].extras || {}).targetNames || []).includes(n), 'her face has ' + n));
  hasNot(t, /spawn\('maya', 'sable'/, 'Maya is not Sable any more');
  has(t, /const MAYA_LOOK = \{ top:'red-turtleneck', bottom:'navy-trousers', shoes:'black-boots', outer:'lab-coat', face:'round-glasses' \};/, 'her look');
  ['red-turtleneck', 'navy-trousers', 'black-boots', 'lab-coat'].forEach(id => { has(w, new RegExp("'" + id + "':\\s*\\{[^}]*bodies:\\['maya'\\]"), id + ' is made for her');
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'characters', 'wardrobe', id, 'maya.glb')), id + ' file'); });
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'characters', 'wardrobe', 'glasses.glb')), 'the glasses');
  has(t, /function npcFace\(n, dt\)/, 'she blinks and talks');
  // the arms
  assert.ok(i.indexOf('tentacles.js') > 0 && i.indexOf('tentacles.js') < i.indexOf('src="tsh.js'), 'the arms load before TSH');
  const n = t.slice(t.indexOf('  function nightScene('), t.indexOf('  function kitOff('));
  has(n, /const oc = octoStart\(maya, MK\.y, Math\.PI\/2, \{ hidden:true \}\);/, 'on the roof her arms are kept in');
  const yeah = n.indexOf("talk('watchers')"), out = n.indexOf('oc.burst(');
  assert.ok(yeah > 0 && out > yeah, 'until she has said it: then they come out');
  [0, 1, 2, 3].forEach(k => has(n, new RegExp('oc\\.burst\\(' + k + ','), 'arm ' + k + ' comes out its own way'));
  has(n, /world:\[kai\.x/, 'one goes for Kai');
  has(n, /oc\.lift\(1\.5\)/, 'and they lift her off the roof');
  has(n, /oc\.to\(MK\.maya\[0\] - 9, MK\.maya\[1\] \+ 3, 1\.7\)/, 'and they carry her off');
  has(t, /n\.y = oc\.body\.y - octo\.hip;/, 'her feet never touch the roof: the arms hold her body');
  const T = read('public/tentacles.js');
  has(T, /function solve\(pts, base, target, L\)/, 'each arm is a chain solved to its claw');
  has(T, /hide\(\)\{ arms\.forEach\(A=>\{ A\.ext = 0;/, 'they fold away into her back');
  has(T, /u < 0\.16 \? B\.from \+ \(1\.14 - B\.from\)/, 'and come out fast, past their length, and ring back');
  has(T, /Math\.sin\(k\*Math\.PI\*2\.2 - t\*3\.1 \+ phase\)\*wave\*env/, 'with a ripple down it, still at both ends: a snake');
});

test('slow, then fast: every lesson waits in slow motion, and every hit lands with a jolt', () => {
  const src = read('public/tshfight.js'), t = read('public/tsh.js'), g = read('public/game.js');
  has(g, /const dt=Math\.min\(\(now-last\)\/1000, 0\.05\)\*\(G\.timeScale===undefined\?1:G\.timeScale\)/, 'the whole world runs on G.timeScale');
  has(src, /function freeze\([\s\S]{0,600}slowTo\(0\.0\d+/, 'a lesson drops the world to a crawl until the key');
  has(src, /function unfreeze\(\)\{[\s\S]{0,200}slowTo\(0\.25/, 'and ramps back up through slow motion as the move lands');
  has(src, /function landOn\([\s\S]{0,1200}hitstop\([\s\S]{0,40}shake\(/, 'a hit stops time for an instant and shakes the picture');
  has(src, /function hurt\([\s\S]{0,600}shake\(/, 'and so does being hit');
  has(t, /function render\(dt\)\{[\s\S]{0,400}shk\.len > 0/, 'the shake is drawn');
  has(t, /G\.timeScale = 1; shk\.len = 0;/, 'leaving the city puts time back to normal');
  has(src, /const now = fx; fx = \[\];[\s\S]{0,300}fx = live\.concat\(fx\);/, 'sparks thrown off while effects run are kept and faded, not left hanging in the air');
  has(src, /if\(!held\) e\.t \+= dt;/, 'the swing a lesson is frozen on hangs there until the key');
  has(src, /function clearFor\(want\)/, 'and the key it asks for always works, whatever she was doing');
  has(src, /dodged:R\.sinceDodge < 0\.9/, 'a swing at where she just was counts as dodged');
  const F = fight();
  F.STEPS.slice(0, 5).forEach(s => assert.ok(/freeze\(/.test(s.enter.toString() + JSON.stringify(Object.keys(s.on || {})) + Object.values(s.on || {}).map(f=>f.toString()).join('')), s.id + ' is taught in a freeze'));
});

test('the car in Dragon Alley is a Higgsfield model, and something to throw a man into', () => {
  const c = read('public/tshcity.js');
  const f = path.join(__dirname, '..', 'public', 'tsh', 'alley', 'car.glb');
  assert.ok(fs.existsSync(f) && fs.statSync(f).size < 400000, 'tsh/alley/car.glb, small');
  has(c, /function parkedCar\(/);
  has(c, /mt\.metalness = 0\.15/, 'SAM\'s fully-metal default is undone');
  has(c, /solid\(car\.x1, car\.x2, car\.z1, car\.z2/, 'you cannot walk through it');
  has(read('public/tsh.js'), /car:W\.car/, 'the fight knows where it is');
});

/* ------------------------------------------------------- the chase
   Out of the alley, the billboard, and WFC: a chase that teaches itself a
   stage at a time, with missiles that are always telegraphed and cover
   that is a real way out. */
function chase(){
  const ctx = vm.createContext({ Math, console });
  ctx.window = ctx; ctx.THREE = { Vector3:function(){} }; ctx.G = { keys:{}, pos:{}, vel:{} };
  vm.runInContext(read('public/tshai.js'), ctx, { filename:'tshai.js' });
  vm.runInContext(read('public/tshchase.js'), ctx, { filename:'tshchase.js' });
  return ctx;
}

test('the chase is a chase: she runs, in the order the script has it, and is cornered three times', () => {
  const A = rules(), CH = A.CHASE;
  assert.deepEqual(CH.stages.map(s=>s.id), ['run', 'van', 'wall', 'roofs', 'rappel', 'hide', 'call', 'found', 'home']);
  assert.deepEqual(CH.stages.filter(s=>s.fight).map(s=>s.fight), [1, 2, 3], 'three fights, no more');
  CH.stages.forEach(s=>assert.ok(s.title && s.how.length > 20, s.id + ' says what to do'));
  assert.ok(CH.stages.slice(0, A.stageAt('roofs')).every(s=>s.floor >= 3), 'nobody calls off the chase while it is teaching you to run');
  assert.equal(CH.stages[A.stageAt('home')].floor, 0, 'the last stretch is lost by hiding');
  const t = read('public/tsh.js'), c = read('public/tshchase.js');
  has(t, /scene\('raid', raidIntro\)/, 'stepping out of the alley plays the billboard');
  has(t, /TSHCHASE\.start\(chaseCtx\(\), i \|\| 0, drone\)/, 'and then the chase is yours');
  has(c, /shoes\(true\)[\s\S]*roofs\(\)\{\s*shoes\(false\)/, 'the shoes are cold until the roofs');
  has(c, /C\.ringing\(true\)[\s\S]{0,80}'MOM'/, 'the phone rings, and it is Mom');
  has(t, /if\(S\.step === 'raid'\) return raidCaught\(\);/, 'caught in the chase is the stage again, not a booking');
  const i = read('public/index.html');
  assert.ok(i.indexOf('tshchase.js') > i.indexOf('tshfight.js') && i.indexOf('tshchase.js') < i.indexOf('src="tsh.js'), 'the chase loads before TSH');
  // every line the chase says is in the script
  (c.match(/talk\('(\w+)'/g) || []).forEach(m=>{ const k = m.match(/'(\w+)'/)[1]; assert.ok(t.includes('    ' + k + ':'), 'LINES has ' + k); });
});

test('the missiles are fair: telegraphed, aimed at a ring, never more than two', () => {
  const A = rules(), M = A.CHASE.missile;
  assert.ok(M.lock >= 1.2 && M.airLock >= 0.9, 'a second or more of warning');
  assert.ok(M.live <= 2, 'never more than two in the air');
  assert.ok(M.gapGround[0] > M.lock, 'one at a time on the ground');
  const at = { x:0, y:0.9, z:0 };
  assert.ok(A.blastHits(at, { x:1, y:0, z:1 }), 'standing in the ring is a hit');
  assert.ok(!A.blastHits(at, { x:M.blast + 0.3, y:0, z:0 }), 'a step out of it is not');
  assert.ok(!A.blastHits(at, { x:0, y:6, z:0 }), 'nor is being above it');
  const lead = A.leadPoint({ x:0, y:10, z:0 }, { x:10, y:-5, z:0 }, true);
  assert.equal(lead.x, 10*M.fly, 'in the air it fires at where she is going');
  assert.ok(lead.y < 10, 'falling as she goes');
  // a dive changes where she goes: the lead point is no longer where she ends up
  const dive = { x:10*M.fly*0.7, y:10 - 20*M.fly };
  assert.ok(!A.blastHits({ x:lead.x, y:lead.y + 0.9, z:0 }, { x:dive.x, y:dive.y, z:0 }), 'a dive takes her out of a lock');
  const c = read('public/tshchase.js');
  has(c, /if\(C\.me\.hidden \|\| R\.cover/, 'nobody fires at her while she is hidden');
  has(c, /const gapAt = Math\.floor\(Math\.random\(\)\*S_\.rings\);/, 'a strafing run always leaves a gap');
});

test('hiding is not failing: heat cools fastest behind cover, and never below the stage', () => {
  const A = rules(), CH = A.CHASE;
  assert.ok(CH.cool.cover < CH.cool.unseen, 'cover cools faster than just being out of sight');
  assert.deepEqual({ ...A.chaseCool(4, CH.cool.cover, true, 0) }, { heat:3, reset:true }, 'a star off behind cover');
  assert.deepEqual({ ...A.chaseCool(4, CH.cool.cover, false, 0) }, { heat:4, reset:false }, 'not yet, only out of sight');
  assert.deepEqual({ ...A.chaseCool(3, 99, true, 3) }, { heat:3, reset:false }, 'never below the floor');
  assert.equal(A.chaseCool(1, 0, false, 3).heat, 3, 'and raised to it');
  const t = read('public/tsh.js');
  has(t, /AI\.chaseCool\(S\.heat, heatSeenT, !!TSHCHASE\.cover/, 'the night uses the chase\'s cooling in the chase');
  has(t, /const lo = me\.crouch \? 0\.45 : 1\.3/, 'down behind a box, there is less of her to see');
});

test('cover: she moves round the box, and the way round is continuous', () => {
  const ctx = chase(), H = ctx.TSHCHASE;
  const c = { x1:0, x2:2, z1:0, z2:1 }, P = H.perim(c);
  assert.ok(Math.abs(P.L - 2*(3.1 + 2.1)) < 1e-9, 'the walk round is the box, half a metre out');
  let last = H.perimAt(c, 0);
  for(let s = 0.05; s <= P.L + 0.05; s += 0.05){
    const q = H.perimAt(c, s);
    assert.ok(Math.hypot(q[0] - last[0], q[1] - last[1]) < 0.051, 'no jumps at ' + s.toFixed(2));
    const inX = q[0] > c.x1 - 0.5 && q[0] < c.x2 + 0.5, inZ = q[1] > c.z1 - 0.5 && q[1] < c.z2 + 0.5;
    assert.ok(!(inX && inZ), 'never inside the box');
    last = q;
  }
});

test('home, 3 AM, and the binoculars: the prologue ends the way it was written', () => {
  const t = read('public/tsh.js');
  const night = t.slice(t.indexOf('function nightScene('), t.indexOf('function kitOff('));
  const beats = ["talk('raidHome')", 'R.window.open(true)', "phoneBig('time')", "talk('rats')", "kitOff('jacket')", "kitOff('shoes')", 'lie(0)', "caption('EXT. ROOFTOP — NIGHT')", 'bino:true', "talk('watchers')"];
  beats.forEach((k, i)=>{ assert.ok(night.includes(k), 'the night has ' + k); if(i) assert.ok(night.indexOf(beats[i - 1]) < night.indexOf(k), beats[i - 1] + ' comes before ' + k); });
  has(t, /\['maya','That\\'s her\.'\], \['kai','You\\'re sure\?'\], \['maya','Yeah\.'\]/, 'word for word');
  has(t, /\['momcall','At this hour\?'\], \['robin','Really good TV\.'\]/, 'and the call');
  has(t, /END OF PROLOGUE/);
  const A = rules();
  assert.equal(A.clock(A.AT.end), '03:07', 'her phone says 3:07');
  // the clips the chase and the night ask her body for
  const clips = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'public', f)); return (JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')).animations || []).map(a => a.name); };
  const hers = clips('characters/fight/robin.glb').concat(clips('characters/models/character-robin.glb'));
  ['kneel', 'text', 'idle', 'jump', 'roll', 'block', 'stagger', 'jab', 'cross', 'hook'].forEach(n=>assert.ok(hers.includes(n), 'Robin has no ' + n + ' clip'));
});

test('the three fights: each one the alley\'s fight in uniform, each opened by a short film that ends on GET READY', () => {
  const t = read('public/tsh.js'), c = read('public/tshchase.js'), f = read('public/tshfight.js');
  // nothing in the chase slows the world down, and her hands are only hers in a fight
  hasNot(c, /G\.timeScale/, 'no slow motion in the chase');
  hasNot(c, /function (strike|parry|pull|brawl)\(/, 'no fighting on the run');
  ['van', 'rappel', 'found'].forEach((id, i)=>has(c, new RegExp(id + '\\(\\)\\{[\\s\\S]{0,500}C\\.fight\\(' + (i + 1)), id + ' is fight ' + (i + 1)));
  // the fight engine takes a place of its own and a straight fight with no lessons
  has(f, /ARENA = c\.arena \|\| ALLEY; FLOOR = c\.floor \|\| 0;/, 'an arena and a floor of its own (a roof is 13 m up)');
  has(f, /steps:ctx\.script === 'brawl' \? BRAWL : STEPS/, 'and no lessons');
  hasNot(f.slice(f.indexOf('const BRAWL'), f.indexOf('function pick(')), /freeze\(/, 'nobody frozen in a straight fight');
  // each film: about ten seconds, the last shot GET READY over her gauntlets, then the fight
  has(t, /function raidFight\(n, done\)/);
  has(t, /readyCard\(n, true\)/, 'GET READY, and the keys');
  has(t, /playReel\(shots, \(\)=>raidFightBegin\(n, R0, ry, fctx\)/, 'the film, then the fight');
  has(t, /dressCrew:\(e, m\)=>uniform\(m\)/, 'WFC in uniform');
  const films = t.slice(t.indexOf('function raidFight('), t.indexOf('function raidFightBegin('));
  ['raidVan', 'raidFine', 'raidDrop', 'raidOkay', 'raidHands', 'raidPass', 'momFound'].forEach(k=>assert.ok(films.includes("talk('" + k + "')") && t.includes('    ' + k + ':'), k));
});

test('The Other Robin: the morning after — late, over the roofs in daylight, to school', () => {
  const t = read('public/tsh.js'), ai = read('public/tshai.js'), c = read('public/tshcity.js'), look = read('public/tshlook.js');
  // it follows the prologue: a button on its results, and a checkpoint at the top of the morning so enter() resumes it
  has(t, /data-a="day">☀ Next: The Other Robin/, 'the prologue ends with the way into the morning');
  has(t, /S\.day = true; S\.step = 'morning'; S\.dm = 8\*60 \+ 42;[\s\S]{0,200}S\.cp = JSON\.stringify\(snap\)/, '8:42, and a checkpoint so it is the morning that loads');
  ['morning', 'commute', 'school', 'sneak', 'detention'].forEach(k => has(ai, new RegExp('\\b' + k + ':\\s*\\{'), 'a beat for ' + k));
  ['late', 'overlook', 'lobby', 'caught', 'detention', 'repair', 'device', 'mother', 'outside'].forEach(k => has(ai, new RegExp("id:'" + k + "'"), 'a scene for ' + k));
  // daylight: the sun, a sky, the street only damp; nothing out looking for her
  has(t, /function air\(\)\{ return day\(\) \?/, 'the morning air is not the night\'s');
  has(t, /W\.sky\.material[\s\S]{0,120}daySky\(\)/, 'a morning sky');
  has(look, /function setWet\(k\)/, 'and a street that has dried');
  has(t, /function gearSeen\(what\)\{\s*if\(day\(\)\) return;/, 'nobody reports the shoes on a school day');
  has(t, /function populate\(\)\{\s*if\(day\(\)\) return dayPopulate\(\);/, 'no drones, no WFC on the beat');
  // the scene: the alarm, 8:42, Rats, the boots, the window; then the roofs to the school
  const m = t.slice(t.indexOf('  function morning('), t.indexOf('  function dayRoom('));
  ["alarm(true)", "phoneBig('late')", "talk('rats')", "kitOn('pack')", "talk('upBoots')", "kitOn('shoes')", 'R.window.open(true)'].forEach(b => assert.ok(m.includes(b), 'the morning has ' + b));
  has(c, /out\.spots\.schoolDoor = /, 'the school has a door');
  has(c, /HARBOR LANE HIGH SCHOOL/, 'and its name over it');
  has(t, /scene\('overlook', overlookScene\)/, 'and from the roof across the lane: 8:57');
});

test('The Other Robin: Harbor Lane High — the guard, her teacher across the lobby, and a sneak that ends in "Robin."', () => {
  const t = read('public/tsh.js'), sc = read('public/tshschool.js'), i = read('public/index.html'), w = read('public/wardrobe.js');
  assert.ok(i.indexOf('tshschool.js') > 0 && i.indexOf('tshschool.js') < i.indexOf('src="tsh.js'), 'the school loads before TSH');
  has(t, /W\.school = window\.TSHSCHOOL \? TSHSCHOOL\.build\(root, W\) : null;[\s\S]{0,120}W\.solids\.forEach/, 'built with the district, its walls solid');
  has(sc, /const SX = 400/, 'off the map, like the flat');
  // the lobby: the guard, the teacher, "...Nope."
  const L = t.slice(t.indexOf('  function lobbyScene('), t.indexOf('  function sneakBegin('));
  ["talk('lobby')", "talk('nope')", "outcome('spotted')", 'sneakBegin()'].forEach(b => assert.ok(L.includes(b), 'the lobby has ' + b));
  has(sc, /S\.guard = add\('mechanic'/, 'the guard is a body from the cast');
  has(sc, /S\.teacher = add\('sable'[\s\S]{0,120}teacher-glasses/, 'and so is her teacher, in her glasses');
  has(w, /'teacher-glasses':\{[^}]*fit:'eyes'/, 'glasses set for the teacher\'s face');
  // the sneak: a cone she can see down, walls and students in the way, the board, the bathroom — and caught, whatever happens
  has(sc, /function sees\(px, pz\)\{[\s\S]{0,700}K\.los[\s\S]{0,500}< 0\.42\) return 0;/, 'walls and a student between them hide her');
  has(sc, /if\(sn\.board\)\{ k \*= /, 'reading the board is a back like anybody\'s');
  has(sc, /return caught\('bathroom', out\)/, 'out of the bathroom, and she is right there');
  has(sc, /if\(d114 < 1\.3\) return caught\('door'\)/, 'and at 114, she is right behind you');
  has(sc, /if\(sn\.meter >= 1\) return caught\('seen'\)/, 'or she just sees you');
  const C = t.slice(t.indexOf('  function caughtScene('), t.indexOf('  function freeCam('));
  ["talk('caught')", "talk('caught2')", "outcome('caught')"].forEach(b => assert.ok(C.includes(b), 'caught has ' + b));
});

test('The Other Robin: detention, the robot she fixes, what her teacher says, and out into the sun', () => {
  const t = read('public/tsh.js'), pz = read('public/tshpuzzle.js'), i = read('public/index.html');
  assert.ok(i.indexOf('tshpuzzle.js') > 0 && i.indexOf('tshpuzzle.js') < i.indexOf('src="tsh.js'), 'the puzzles load before TSH');
  // the puzzles, every board solvable and none solved before she touches it
  const ctx = vm.createContext({ performance:{ now:()=>0 } }); ctx.window = ctx; vm.runInContext(pz, ctx);
  const P = ctx.TSHPUZZLE;
  { const L = P._route(4, 101), g = L.g; assert.equal(P._powered(L).done, false, 'board 1 starts broken'); L.g = L.sol; assert.equal(P._powered(L).done, true, 'board 1 can be solved'); L.g = g; }
  // boards 2 and 3: the network — every tile lit, no loose ends
  [[5, 264], [6, 317]].forEach(([n, seed])=>{ const L = P._net(n, seed), g = L.g; assert.equal(P._powered(L).done, false, 'network ' + n + ' starts broken');
    L.g = L.sol; const p = P._powered(L); assert.ok(p.done && p.on.size === n*n && !p.loose.size, 'network ' + n + ' can be solved, every tile lit'); L.g = g; });
  P.SIGNALS.forEach((L, k)=>{ const used = new Set(); L.ends.forEach((e, c)=>{ const p = P._solPath(L, c), l = p[p.length - 1];
    assert.deepEqual(l, e[1], 'bus ' + k + ': signal ' + c + ' reaches its twin');
    p.forEach(q=>{ assert.ok(!used.has(q + ''), 'bus ' + k + ': no two signals cross'); used.add(q + ''); }); }); });
  assert.equal(P.CASE.causes.filter(c=>c[2] === null).length, 1, 'the diagnosis has one right answer');
  // the scenes, in order
  const D = t.slice(t.indexOf('  function detentionScene('), t.indexOf('  function benchMode('));
  ["talk('where')", "talk('where2')", "talk('detained')", "talk('robot')", 'benchPuzzles()'].forEach(b => assert.ok(D.includes(b), 'detention has ' + b));
  has(t, /TSHPUZZLE\.open\('route', \{ levels:3 \}, \(\)=>TSHPUZZLE\.open\('signal', \{ levels:3 \}, \(\)=>TSHPUZZLE\.open\('gears'/, 'power, then signals, then the drive');
  const R = t.slice(t.indexOf('  function robotLives('), t.indexOf('  function talkScene('));
  ["talk('fixed')", "talk('fixed2')", "TSHPUZZLE.open('diagnose'", "outcome('fixed')"].forEach(b => assert.ok(R.includes(b), 'the robot runs, then ' + b));
  const T = t.slice(t.indexOf('  function talkScene('), t.indexOf('  let phones = null;'));
  ["talk('see')", "talk('bright')", "talk('proud')", "mood:'sad'", "talk('yeah')", "talk('thanks')"].forEach(b => assert.ok(T.includes(b), 'the talk has ' + b));
  const O = t.slice(t.indexOf('  function outsideScene('), t.indexOf('  function dayPopulate('));
  ['headphones(true)', '3:20 PM', 'The rest of the day is hers.'].forEach(b => assert.ok(O.includes(b), 'outside has ' + b));
});

test('the face shapes really move: Robin\'s and Maya\'s are not empty (a sparse export once wrote them as zeros)', () => {
  ['robin', 'maya'].forEach(who => {
    const b = fs.readFileSync(path.join(__dirname, '..', 'public', 'characters', 'models', 'character-' + who + '.glb'));
    const jl = b.readUInt32LE(12), J = JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin = b.slice(20 + jl + 8);
    const prim = J.meshes[0].primitives[0], names = J.meshes[0].extras.targetNames;
    ['jawOpen', 'smile', 'blink'].forEach(n => {
      const a = J.accessors[prim.targets[names.indexOf(n)].POSITION];
      assert.ok(!a.sparse, who + ' ' + n + ': stored whole, not sparse');
      const bv = J.bufferViews[a.bufferView], sz = { 5126:4, 5122:2, 5120:1 }[a.componentType], rd = { 5126:'readFloatLE', 5122:'readInt16LE', 5120:'readInt8' }[a.componentType];
      const st = bv.byteStride || 3*sz; let moved = 0;
      for(let i = 0; i < a.count; i++) for(let c = 0; c < 3; c++) if(bin[rd]((bv.byteOffset || 0) + (a.byteOffset || 0) + i*st + c*sz)) moved++;
      assert.ok(moved > 50, who + ' ' + n + ' moves some of her face (' + moved + ' values)');
    });
  });
});

test("the buyer and his crew have faces: shapes on their bodies, and the fight on them", () => {
  ['thug-buyer', 'thug-a', 'thug-b'].forEach(who => {
    const b = fs.readFileSync(path.join(__dirname, '..', 'public', 'characters', 'models', 'character-' + who + '.glb'));
    const jl = b.readUInt32LE(12), J = JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin = b.slice(20 + jl + 8);
    const names = (J.meshes[0].extras || {}).targetNames || [], prim = J.meshes[0].primitives[0];
    ['jawOpen', 'frown', 'browDown', 'blink'].forEach(n => assert.ok(names.includes(n), who + ' has ' + n));
    const a = J.accessors[prim.targets[names.indexOf('jawOpen')].POSITION], bv = J.bufferViews[a.bufferView];
    assert.ok(!a.sparse, who + ': shapes stored whole');
    let moved = 0; for(let i = 0; i < a.count*3; i++) if(bin.readInt16LE((bv.byteOffset || 0) + (a.byteOffset || 0) + i*2)) moved++;
    assert.ok(moved > 50, who + "'s jaw moves");
  });
  const f = read('public/tshfight.js'), t = read('public/tsh.js');
  has(f, /function face\(e, dt\)\{/, 'their faces are driven');
  has(f, /\(c === 'hit' \|\| c === 'stagger'\) \? FACES\.hurt/, 'a wince when hit');
  has(f, /e\.state === 'ko'[\s\S]{0,80}FACES\.out/, 'eyes shut on the ground');
  has(t, /TSHFIGHT\.talker\(who\)/, 'and the one with the line talks');
});

test('a mute button: on screen and on M, and it silences everything without stopping the clock', () => {
  const t = read('public/tsh.js'), css = read('public/app.css');
  has(t, /<button class="tsh-mute" id="tshMute"/, 'the button is on the HUD');
  has(t, /Object\.defineProperty\(AC, 'destination', \{ value:m/, 'everything goes through one gain');
  has(t, /AC\.master\.gain\.setTargetAtTime\(muted \? 0 : 1/, 'muting turns that gain down (not a suspend: the films are timed on the context clock)');
  has(t, /if\(c === 'KeyM' && !e\.repeat[^\n]*setMute\(!muted\)/, 'M works anywhere');
  has(t, /localStorage\.setItem\('tsh_mute'/, 'and it is remembered');
  has(css, /#tsh \.tsh-mute\{[^}]*pointer-events:auto/, 'and it can be clicked');
});
