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
  assert.deepEqual(ids.slice(0, 7), ['wake', 'lesson', 'deal', 'news', 'roof', 'voicemail', 'maya']);
  A.STORY.forEach(s=>{ assert.ok(s.on, s.id + ' says what sets it off'); (s.after||[]).forEach(a=>assert.ok(ids.indexOf(a) < ids.indexOf(s.id), s.id + ' comes after ' + a)); });
  assert.equal(A.ready([], 'news'), false, 'no broadcast before the deal');
  const O = ['wake', 'lesson'];
  assert.equal(A.ready(O, 'news'), false);
  assert.equal(A.ready([], 'lesson'), false, 'no lesson before the window');
  assert.equal(A.ready(O.concat('deal'), 'news'), true, 'the fight in the alley, then the street');
  assert.equal(A.ready(O.concat('deal', 'news'), 'news'), false, 'a scene plays once');
  assert.equal(A.ready(O.concat('deal'), 'voicemail'), false, 'home comes after the roof');
  assert.equal(A.ready(O.concat('deal', 'news', 'roof'), 'maya'), false, 'Maya waits for the voicemail');
  assert.equal(A.next('deal', 'fought'), 'news', 'after the fight, the street');
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
  const beats = ["caption('EXT. DRAGON ALLEY", "talk('fightIn1')", "talk('fightIn2')", "cue('sus')", "talk('fightIn3')", "talk('fightIn4')", "fprop.bagOn = t1",
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

test('out of the way: SPACE with a direction is a cartwheel, a flip or a roll, and a click comes out of it as a sweep', () => {
  const src = read('public/tshfight.js'), t = read('public/tsh.js'), F = fight();
  const clips = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'public', f)); return (JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')).animations || []).map(a => a.name); };
  const hers = clips('characters/fight/robin.glb');
  ['cartL', 'cartR', 'flip', 'roll', 'wall', 'vault'].forEach(k => { assert.ok(F.EVADE[k], k); assert.ok(hers.includes(F.EVADE[k].clip), 'her fight file has ' + F.EVADE[k].clip); });
  // the fight's own copies: the shoes' flip and roll keep their own speed
  assert.ok(!['flip', 'roll'].includes(F.EVADE.flip.clip) && !['flip', 'roll'].includes(F.EVADE.roll.clip), 'the fight plays its own copies of the flip and the roll');
  has(src, /Math\.abs\(fx\) >= Math\.abs\(fz\) \? \(fx < 0 \? 'cartL' : 'cartR'\) : fz < 0 \? 'flip' : 'roll'/, 'A or D a cartwheel that way, S a backflip, W a roll');
  has(src, /if\(R\.act === 'dodge' && R\.evade && kind === 'punch'\)\{ R\.buffer = kind; return false; \}/, 'a click mid-cartwheel is kept for the landing');
  has(src, /if\(R\.outOfEvade\)\{[\s\S]{0,80}return 'sweep'/, 'and comes out as a sweep');
  has(t, /Object\.values\(TSHFIGHT\.EVADE\)\.forEach\(v=>\{ speed\[v\.clip\] = v\.speed; \}\)/, 'played at the speed the fight sets');
  ['cartL', 'cartR', 'bflip', 'wallkick', 'evroll', 'evflip'].forEach(n => has(t, new RegExp("'" + n + "'\\]?, ?|'" + n + "'\\]"), n + ' plays once'));
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
