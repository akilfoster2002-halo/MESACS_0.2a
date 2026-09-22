/* =====================================================================
   PONG — a finished game, and nothing hidden behind it.

   The room arrives playing. Press Run and it serves, bounces off two
   bats and two walls, keeps score and stops when somebody has won; click
   any of the three objects and you are reading the blocks that did it.
   There is no walkthrough, because the thing this room is for is not
   learning to assemble Pong — it is seeing what a working game is made
   of, and a card telling you which block to press next sits on top of
   exactly that.

   WHAT THESE TESTS ARE FOR, then, is the one claim the room makes:
   EVERY RULE OF THE GAME IS A BLOCK. Not most of them. A referee that
   quietly keeps the bats on the court, or spots a ball that has gone
   past one, is a rule a student can look for and never find — and this
   mission is worth nothing the moment one of those creeps back in.

   So the scripts are built by the real function the room uses and then
   read, block by block, against the rules Pong actually needs. If a rule
   moves out of the blocks and back into JavaScript, something here goes
   red.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const PONGJS = bare(read('public/pong.js'));

/* the language, and the room's own script builder, loaded for real */
function load(){
  const ctx=vm.createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  vm.runInContext(read('public/blocks.js'), ctx, { filename:'blocks.js' });
  vm.runInContext(read('public/pong.js'),   ctx, { filename:'pong.js' });
  return { B:ctx.BLOCKS, PONG:ctx.PONG };
}
const { B, PONG } = load();
const S = PONG.scripts();

/* ------------------------------------------------------------ helpers */
function all(list, out){
  out = out || [];
  (list||[]).forEach(b=>{
    if(!b || typeof b!=='object') return;
    out.push(b);
    Object.keys(b.args||{}).forEach(k=>{
      const v=b.args[k];
      if(v && typeof v==='object' && v.op) all([v], out);
    });
    all(b.body, out); all(b.body2, out);
  });
  return out;
}
const blocks = name => { const sc=S[name][0]; return all([sc.hat]).concat(all(sc.body)); };
const uses   = (name,op) => blocks(name).some(b=>b.op===op);
const count  = (name,op) => blocks(name).filter(b=>b.op===op).length;
/* every `if` in an object, with the blocks inside it */
function ifs(name){
  return all(S[name][0].body).filter(b=>b.op==='ctrl.if');
}
const has = (bk,op) => all([bk]).some(b=>b.op===op);
const loopOf = name => S[name][0].body.find(b=>b.op==='ctrl.forever');

/* ================================================== it is a whole game */
test('all three objects arrive with a script on them', ()=>{
  ['Ball','You','Rival'].forEach(n=>{
    assert.ok(S[n] && S[n].length, n+' has no script — the game does not arrive finished');
    assert.strictEqual(S[n][0].hat.op, 'event.flag', n+' never starts');
    assert.ok(loopOf(n), n+' has no forever loop, so it does something once and stops');
  });
});

test('every block in all three scripts is a real block', ()=>{
  /* A typo in an op is a block the editor cannot draw and the VM skips
     in silence — the game would simply not do that part. */
  ['Ball','You','Rival'].forEach(n=>blocks(n).forEach(b=>
    assert.ok(B.of(b.op), `${n} contains ${b.op}, which is not a block`)));
});

test('every block in all three scripts is on the palette', ()=>{
  /* Otherwise the game uses something a student cannot get hold of to
     change it, which is the same as it being hidden. */
  const pal=/const PALETTE=\{[\s\S]*?\n  \};/.exec(PONGJS)[0];
  ['Ball','You','Rival'].forEach(n=>blocks(n).forEach(b=>
    assert.ok(pal.includes(`'${b.op}'`),
      `${n} uses ${b.op} and it is not on the shelf — nobody can change that rule`)));
});

test('every slot in every block is filled in', ()=>{
  /* A block with an empty number reads as 0 and does nothing visible,
     which is the worst way for a finished game to be broken. */
  ['Ball','You','Rival'].forEach(n=>blocks(n).forEach(b=>{
    const bd=B.of(b.op);
    Object.keys(bd.args||{}).forEach(k=>{
      if(bd.args[k].type==='bool') return;          // filled by the `if` itself
      const v=(b.args||{})[k];
      assert.ok(v!==undefined && v!=='' && v!==null,
        `${n}: ${b.op} has nothing in its "${k}" slot`);
    });
  }));
});

/* ============================================ the rules, one at a time */
test('the ball serves itself, from the middle and at an angle', ()=>{
  const body=S.Ball[0].body;
  const beforeLoop=body.slice(0, body.findIndex(b=>b.op==='ctrl.forever'));
  assert.ok(beforeLoop.some(b=>b.op==='motion.goto'), 'it never goes to the centre spot');
  const serve=beforeLoop.find(b=>b.op==='motion.face');
  assert.ok(serve, 'it is never pointed anywhere, so it would sit still');
  assert.ok(has(serve,'op.random'),
    'the serve is the same every time — which makes every point the same point');
});

test('the ball travels', ()=>{
  assert.ok(has(loopOf('Ball'),'motion.move'), 'nothing moves the ball');
});

test('a bat sends the ball where it was hit, and is not a mirror', ()=>{
  /* THE ONE THAT MAKES IT A GAME. A mirror hands the ball back at the
     angle it arrived at, so a flat serve comes back flat for ever and
     neither bat is ever beaten — measured at nought all after eight
     minutes. Where on the bat it struck has to reach the new heading. */
  const bats=ifs('Ball').filter(x=>x.args.c && x.args.c.op==='sense.touch');
  assert.strictEqual(bats.length, 2, 'the ball does not notice both bats');
  const names=bats.map(x=>String(x.args.c.args.o)).sort();
  assert.deepStrictEqual(names, ['Rival','You'], 'it is watching for the wrong objects');
  bats.forEach(x=>{
    const turn=(x.body||[]).find(y=>y.op==='motion.face');
    assert.ok(turn, 'a bat bounce that never turns the ball');
    assert.ok(has(turn,'op.mul'),
      'the bounce ignores where on the bat it hit, so the rally never ends');
    assert.ok(has(turn,'sense.posOf'), 'it never asks where the bat is');
    assert.ok(has(turn,'motion.pos'),  'or where itself is');
  });
});

test('a wall is a mirror, and puts the ball back before it turns', ()=>{
  /* `180 − direction` on its own shivers: the ball is still past the
     line next frame, so it mirrors again, and again. The `set` is what
     makes the condition go quiet by itself. */
  const walls=ifs('Ball').filter(x=>(x.body||[]).some(y=>y.op==='motion.setTo') &&
                                    (x.body||[]).some(y=>y.op==='motion.face'));
  assert.strictEqual(walls.length, 2, 'the ball does not bounce off both walls');
  walls.forEach(x=>{
    const put=(x.body||[]).find(y=>y.op==='motion.setTo');
    const turn=(x.body||[]).find(y=>y.op==='motion.face');
    assert.strictEqual(x.body.indexOf(put) < x.body.indexOf(turn), true,
      'it turns before it puts the ball back, which is the sticky order');
    assert.ok(has(turn,'motion.dir'), 'a mirror has to read the heading it is mirroring');
  });
});

test('the ball scores its own points, into the two variables', ()=>{
  const goals=ifs('Ball').filter(x=>(x.body||[]).some(y=>y.op==='data.change'));
  assert.strictEqual(goals.length, 2, 'both ends of the court have to be worth a point');
  const named=goals.map(x=>String((x.body.find(y=>y.op==='data.change').args||{}).v)).sort();
  assert.deepStrictEqual(named, ['rival','you'],
    'the points do not go into the two variables the scoreboard reads');
  /* and it serves again, or the first point ends the game */
  goals.forEach(x=>{
    assert.ok((x.body||[]).some(y=>y.op==='motion.goto'), 'the ball never comes back');
    assert.ok((x.body||[]).some(y=>y.op==='motion.face'), 'and is never served again');
  });
});

test('the game can be won', ()=>{
  const wins=ifs('Ball').filter(x=>(x.body||[]).some(y=>y.op==='ctrl.stop'));
  assert.strictEqual(wins.length, 2, 'only one of them can win, or neither can');
  wins.forEach(x=>{
    assert.ok(has(x.args.c,'data.get'), 'the win is not decided by the score');
    assert.ok((x.body||[]).some(y=>y.op==='looks.say'), 'nothing says who won');
  });
  /* and a new game starts clean */
  const opening=S.Ball[0].body.filter(b=>b.op==='data.set');
  assert.strictEqual(opening.length, 2,
    'the scores are not put back to nought, so the second game starts finished');
});

test('both bats keep themselves on the court', ()=>{
  /* This was the room's job and was therefore nowhere a student could
     read it: the one object handed over as an example of a script had a
     hole in it where the reason it stopped at the wall should have been. */
  ['You','Rival'].forEach(n=>{
    const edge=ifs(n).filter(x=>(x.body||[]).some(y=>y.op==='motion.setTo'));
    assert.strictEqual(edge.length, 2, n+' can walk off one end of the court');
    edge.forEach(x=>assert.ok(has(x.args.c,'motion.pos'),
      n+' checks its edge against something that is not its own position'));
  });
});

test('your bat is driven by two keys', ()=>{
  const keys=ifs('You').filter(x=>x.args.c && x.args.c.op==='sense.key');
  assert.strictEqual(keys.length, 2, 'a paddle with one key only goes one way');
  keys.forEach(x=>assert.ok((x.body||[]).some(y=>y.op==='motion.changeBy'),
    'a key that moves nothing'));
  const which=keys.map(x=>String(x.args.c.args.k)).sort();
  assert.deepStrictEqual(which, ['s','w'], 'the keys are not the ones the hint bar names');
});

test('the opponent watches the ball and is beatable', ()=>{
  const sees=ifs('Rival').filter(x=>has(x.args.c,'sense.posOf'));
  assert.strictEqual(sees.length, 2, 'it cannot follow the ball both ways');
  sees.forEach(x=>{
    assert.ok(has(x.args.c,'motion.pos'), 'it never compares that with where it is');
    assert.ok((x.body||[]).some(y=>y.op==='motion.changeBy'), 'and never moves');
  });
  /* IT HAS TO BE SLOWER THAN THE BALL CAN CLIMB, or it is never beaten
     and the game is a demonstration. The steepest a bat can send the
     ball is LEAN degrees off straight, and the climb is the sine of
     that. */
  const num = re => +re.exec(PONGJS)[1];
  const speed=num(/const SPEED=([\d.]+)/), rival=num(/const RIVAL_SPEED=([\d.]+)/);
  const lean =num(/const LEAN_DEFAULT=([\d.]+)/), mine=num(/speed:([\d.]+)/);
  const climb = speed*0.1*Math.sin(lean*1.5*Math.PI/180);   // a hit 1.5 off the middle
  assert.ok(rival < climb,
    `the rival climbs at ${rival} and the steepest ball climbs at ${climb.toFixed(2)} — `+
    'it can always get there, so nobody can ever score past it');
  assert.ok(mine >= rival, 'your own bat is slower than the opponent’s');
});

/* ======================================== and the room stays out of it */
test('the room does not play the game', ()=>{
  ['function referee(','function point(side)','function launch()',
   'function clearOf(','function clearWall('].forEach(fn=>
    assert.ok(!PONGJS.includes(fn),
      'the room is playing the game again: '+fn.replace('function ','')+' is back'));
  assert.ok(!/\byou\+\+|\brival\+\+/.test(PONGJS), 'the room is counting the score');
});

test('the scoreboard reads the variables and cannot write them', ()=>{
  assert.match(PONGJS, /const SCORE=\{ you:'you', rival:'rival' \}/, 'the two names are gone');
  assert.match(PONGJS, /VM\.project\.vars\[SCORE\[k\]\]/, 'it has stopped reading them');
  const bd=PONGJS.slice(PONGJS.indexOf('function board()'), PONGJS.indexOf('function camera()'));
  assert.ok(!/vars\[[^\]]*\]\s*=/.test(bd), 'the scoreboard is setting the score');
});

test('there is no walkthrough left anywhere', ()=>{
  assert.ok(!/COACH/.test(PONGJS), 'the room still starts a walkthrough');
  assert.ok(!fs.existsSync(path.join(__dirname,'..','public','pongsteps.js')),
    'the step list is still on disk');
  assert.ok(!/pongsteps/.test(read('public/index.html')),
    'the page still loads a walkthrough that is gone — a 404 on every visit');
});

test('a new block arrives set up like the ones already there', ()=>{
  /* `move` defaults to 10 in the language, which is twice what this game
     runs at: a second one dropped in behaves nothing like the first and
     the change cannot be read. */
  const set=/const SET=\{[\s\S]*?\n  \};/.exec(PONGJS)[0];
  const speed=/const SPEED=([\d.]+)/.exec(PONGJS)[1];
  assert.ok(set.includes(`{ n:SPEED }`), 'a new `move` no longer matches the ball');
  assert.match(set, /'motion\.changeBy':\s*\{ a:'y'/, 'a new `change by` walks a bat sideways');
  assert.match(PONGJS, /CODER\.restrict\(Object\.assign\(\{ defaults:SET \}, PALETTE\)\)/,
    'the shelf is handed out without them');
  assert.ok(+speed>0, 'the ball has no speed');
});

/* --------------------------------------------------------- the wiring */
test('Pong is a station, a card, dispatched and on the page', ()=>{
  const planet=read('public/planet.js'), game=read('public/game.js');
  assert.match(planet, /id:'pong'/,   'no station row in Mission Control');
  assert.match(game,   /id==='pong'/, 'startMissionRoom does not dispatch it');
  assert.match(game,   /PONG\.active\) PONG\.tick\(dt\)/, 'the frame never ticks it');
  assert.match(game,   /PONG\.active\) return;/,
    'the planet still walks an invisible player about underneath the court');
  const html=read('public/index.html');
  assert.match(html, /src="pong\.js/, 'pong.js is not loaded by the page');
  assert.match(html, /id="pong"/,     'the overlay is not in the page');
  assert.match(read('public/menu.js'), /id:'pong'/, 'no card in the menu');
});

test('every element the room points at is in the page', ()=>{
  const html=read('public/index.html');
  const ids=[...PONGJS.matchAll(/#(pong[A-Za-z]+)/g)].map(m=>m[1]);
  assert.ok(ids.length>2, 'the room stopped naming any of its own furniture');
  [...new Set(ids)].forEach(id=>assert.match(html, new RegExp('id="'+id+'"'),
    `#${id} is pointed at and is not in index.html`));
});

test('what is drawn is what `touching` tests', ()=>{
  /* `touching` is a sphere off `size`. A bat drawn much longer than that
     is a bat balls visibly hit and sail through — and the student cannot
     fix it, because it is not in their script. */
  const vmsrc=bare(read('public/vm.js'));
  assert.match(vmsrc, /\(ctx\.actor\.size\+\(o\.size\|\|1\)\)\*0\.6/,
    'the VM has changed what touching means');
  const size=+/size:([\d.]+)/.exec(/const PADDLE=\{[^}]*\}/.exec(PONGJS)[0])[1];
  const long=+/const BAT_LONG = ([\d.]+)/.exec(PONGJS)[1];
  const reach=(0.8+size)*0.6;
  assert.ok(long*size*0.5 <= reach,
    `the bat is drawn ${(long*size).toFixed(2)} long but only reaches ${reach.toFixed(2)}`);
});

test('nothing is kept between visits', ()=>{
  assert.match(PONGJS, /VM\.useScratch\(\)/, 'a Pong court would now survive being left');
  assert.ok(!/localStorage|PROGRESS\.set/.test(PONGJS), 'something is being written down');
});
