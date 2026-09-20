/* =====================================================================
   THE ROAD INTO THE RING, under test.

   The ring used to open on a fight. It opens on a stage now, and a
   stage is only worth having if it can FAIL — a checklist that ticks
   itself for a program that does not work is worse than no checklist,
   because it tells a student the thing they got wrong is the thing they
   got right.

   So most of what is in here is the failing cases. Stage one is the one
   that matters most: the twitch — a conditional under the hat instead of
   inside the loop — moves the robot a long way on ONE frame, and every
   obvious way of marking that stage passes it. Counting frames is what
   does not, and there is a test for exactly that below.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const STAGES = require('../public/stages.js');
const RULES  = require('../public/rules.js');
const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');

/* a context with nothing in it: no frames, no punches, nothing said */
function ctx(over){
  return Object.assign({
    frames:{ left:0, right:0, in:0, out:0 },
    gapMin:Infinity, said:false, won:false,
    swings:{ asked:0, landed:0, broke:0, far:0 },
    uses:()=>false, reads:()=>false, writes:()=>false
  }, over||{});
}
const S = id => STAGES.LIST.findIndex(s=>s.id===id);

/* ==================================================================== */
test('a fresh student passes nothing', ()=>{
  STAGES.LIST.forEach((s,i)=>assert.strictEqual(STAGES.done(i, ctx()), false,
    'stage '+s.n+' ('+s.name+') is already finished before anything has happened'));
});

test('the twitch does not pass stage one, however far it moves the robot', ()=>{
  /* An `if` under the hat with the key already down moves once, on the
     frame Run was pressed. A stage marked on DISTANCE would pass this
     for `change x by 40`; one marked on frames cannot. */
  const twitch=ctx({ frames:{ left:1, right:1, in:0, out:0 } });
  assert.strictEqual(STAGES.done(S('move'), twitch), false,
    'one frame each way passed stage one — the twitch is being marked as a control');
  const loop=ctx({ frames:{ left:20, right:20, in:0, out:0 } });
  assert.strictEqual(STAGES.done(S('move'), loop), true,
    'a robot that ran both ways for twenty frames did not pass stage one');
});

test('stage one wants BOTH directions, not one of them twice', ()=>{
  assert.strictEqual(STAGES.done(S('move'), ctx({ frames:{left:0,right:99,in:0,out:0} })), false);
  assert.strictEqual(STAGES.done(S('move'), ctx({ frames:{left:99,right:0,in:0,out:0} })), false);
});

test('stage two wants the sensor READ, not merely a robot that got close', ()=>{
  const close=ctx({ gapMin:1, said:true });                 // walked over, said something
  assert.strictEqual(STAGES.done(S('near'), close), false,
    'a robot that wandered into range passed a stage about reading a sensor');
  const proper=ctx({ gapMin:1, said:true, uses:op=>op==='sense.dist' });
  assert.strictEqual(STAGES.done(S('near'), proper), true);
});

test('stage two wants it within a punch, and a punch is what the referee says it is', ()=>{
  const r=RULES.RULES.moves.light.reach;
  const near=g=>ctx({ gapMin:g, said:true, uses:op=>op==='sense.dist' });
  assert.strictEqual(STAGES.done(S('near'), near(r-0.1)), true);
  assert.strictEqual(STAGES.done(S('near'), near(r+0.1)), false,
    'stage two accepted a gap the referee would call too far');
});

test('stage three wants a punch that LANDED, not one that was asked for', ()=>{
  const asked=ctx({ writes:v=>v==='light', swings:{ asked:9, landed:0, broke:5, far:4 } });
  assert.strictEqual(STAGES.done(S('hit'), asked), false,
    'nine swings that all missed passed the stage about landing one');
  const landed=ctx({ writes:v=>v==='light', swings:{ asked:1, landed:1, broke:0, far:0 } });
  assert.strictEqual(STAGES.done(S('hit'), landed), true);
});

test('stage four fails the button-masher, which is the whole point of it', ()=>{
  /* Plenty of punches landed — and a tank emptied on the way, which is
     exactly the habit the stage exists to break. */
  const masher=ctx({ reads:()=>true, swings:{ asked:30, landed:5, broke:12, far:0 } });
  assert.strictEqual(STAGES.done(S('spend'), masher), false,
    'a student who threw twelve punches they could not afford passed AFFORD IT');
  const careful=ctx({ reads:v=>v==='stamina', swings:{ asked:3, landed:3, broke:0, far:0 } });
  assert.strictEqual(STAGES.done(S('spend'), careful), true);
});

test('stage four wants the script to have LOOKED at stamina', ()=>{
  const lucky=ctx({ reads:()=>false, swings:{ asked:3, landed:3, broke:0, far:0 } });
  assert.strictEqual(STAGES.done(S('spend'), lucky), false,
    'a script that never reads (stamina) passed the stage about reading it');
});

test('stage five is won, and nothing short of it counts', ()=>{
  assert.strictEqual(STAGES.done(S('fight'), ctx({ swings:{asked:99,landed:99,broke:0,far:0} })), false);
  assert.strictEqual(STAGES.done(S('fight'), ctx({ won:true })), true);
});

/* ------------------------------------------------------- the palettes */
test('the palette only ever grows, and every op on it is a real block', ()=>{
  const ctxBlocks=require('node:vm').createContext({ console });
  ctxBlocks.window=ctxBlocks; ctxBlocks.self=ctxBlocks;
  require('node:vm').runInContext(read('public/blocks.js'), ctxBlocks);
  const known=new Set(ctxBlocks.BLOCKS.LIST.map(b=>b.op));
  const cats =new Set(ctxBlocks.BLOCKS.CATS.map(c=>c.id));
  let prev=[];
  STAGES.LIST.forEach((s,i)=>{
    const p=STAGES.palette(i);
    p.ops.forEach(o=>assert.ok(known.has(o), s.name+' offers '+o+', which is not a block'));
    p.cats.forEach(c=>assert.ok(cats.has(c), s.name+' offers category '+c+', which does not exist'));
    prev.forEach(o=>assert.ok(p.ops.indexOf(o)>=0,
      s.name+' took away '+o+', which an earlier stage handed out — a student\'s script would break'));
    prev=p.ops;
  });
});

test('no block on a stage palette is missing the block that makes it usable', ()=>{
  /* The ring's own rule, applied per stage: a sensing block with nothing
     to put it in, or a conditional with nothing to test, is a block a
     student cannot use yet. */
  const need=[
    ['sense.key',     'ctrl.if',   'a key test with nothing to put it in'],
    ['ctrl.if',       'ctrl.forever','a conditional with no loop to live in'],
    ['data.get',      'data.set',  'a way to read a variable and no way to set one'],
    ['op.gt',         'ctrl.if',   'a comparison with nothing to decide'],
    ['sense.dist',    'looks.say', 'a number to read and nowhere to show it']
  ];
  STAGES.LIST.forEach((s,i)=>{
    const ops=STAGES.palette(i).ops;
    need.forEach(([a,b,why])=>{
      if(ops.indexOf(a)>=0) assert.ok(ops.indexOf(b)>=0, s.name+' has '+why);
    });
  });
});

test('the last stage is the ring\'s whole palette — no block is lost on the way', ()=>{
  const m=read('public/ring.js').match(/const PALETTE = (\{[\s\S]*?\n  \});/);
  assert.ok(m, 'ring.js has no PALETTE to compare against');
  const P=new Function('return '+m[1])();
  const last=STAGES.palette(STAGES.LAST);
  P.ops .forEach(o=>assert.ok(last.ops .indexOf(o)>=0, o+' is on the ring palette and on no stage'));
  P.cats.forEach(c=>assert.ok(last.cats.indexOf(c)>=0, c+' is a ring category and on no stage'));
  last.ops.forEach(o=>assert.ok(P.ops.indexOf(o)>=0, o+' is on a stage and not on the ring palette'));
});

/* ------------------------------------------------------ reading a script */
test('reading a variable and writing one are different questions', ()=>{
  const a={ scripts:[{ hat:{op:'event.flag',args:{}}, body:[
    { op:'data.set', args:{ v:'light', n:1 } } ] }] };
  assert.strictEqual(STAGES.writes(a,'light'), true);
  assert.strictEqual(STAGES.reads (a,'light'), false,
    'setting a variable counted as reading it, so stage four could be passed without looking');
  const b={ scripts:[{ hat:{op:'event.flag',args:{}}, body:[
    { op:'ctrl.if', args:{ c:{ op:'op.gt', args:{
        a:{ op:'data.get', args:{ v:'stamina' } }, b:20 } } }, body:[] } ] }] };
  assert.strictEqual(STAGES.reads(b,'stamina'), true, 'a variable read inside two nested reporters was missed');
});

test('a block is found however deep it is buried', ()=>{
  const a={ scripts:[{ hat:{op:'event.flag',args:{}}, body:[
    { op:'ctrl.forever', args:{}, body:[
      { op:'ctrl.ifelse', args:{ c:{op:'op.not',args:{ c:{op:'sense.key',args:{k:'w'}} }} },
        body:[], body2:[ { op:'looks.say', args:{ s:{op:'sense.dist',args:{o:'Ambush'}} } } ] } ] } ] }] };
  assert.strictEqual(STAGES.uses(a,'sense.key'),  true, 'a block inside a nested boolean was missed');
  assert.strictEqual(STAGES.uses(a,'sense.dist'), true, 'a block in an else-body argument was missed');
  assert.strictEqual(STAGES.uses(a,'motion.move'),false);
});

test('a stage whose test throws is a stage not yet passed, not a crash', ()=>{
  const broken={ frames:null };            // the world half-built, as it is on frame one
  STAGES.LIST.forEach((s,i)=>assert.doesNotThrow(()=>STAGES.done(i, broken), s.name+' threw'));
  assert.strictEqual(STAGES.done(0, broken), false);
});

/* ----------------------------------------------------------- the rows */
test('every stage is a complete row, and the order is the teaching order', ()=>{
  STAGES.LIST.forEach((s,i)=>{
    ['id','name','teach','goal','why','foe'].forEach(k=>
      assert.ok(s[k], 'stage '+(i+1)+' has no '+k));
    assert.strictEqual(s.n, i+1, s.name+' is numbered '+s.n+' and sits at '+(i+1));
    assert.ok((s.tests||[]).length, s.name+' has nothing that could fail');
    assert.ok(['none','dummy','live'].indexOf(s.foe)>=0, s.name+' has an unknown kind of opponent');
  });
  assert.strictEqual(STAGES.LIST[0].foe, 'none',  'stage one is not an empty room');
  assert.strictEqual(STAGES.LIST[STAGES.LAST].foe, 'live', 'the last stage is not a fight');
});

test('an out-of-range stage is the nearest real one, not undefined', ()=>{
  assert.strictEqual(STAGES.byIndex(-5).id, STAGES.LIST[0].id);
  assert.strictEqual(STAGES.byIndex(99).id, STAGES.LIST[STAGES.LAST].id);
});

/* --------------------------------------------------------- the wiring */
test('the ring reads the stage for its palette and its opponent, not a constant', ()=>{
  const src=read('public/ring.js');
  assert.match(src, /CODER\.restrict\(palette\(\)\)/,
    'the ring still hands out one fixed palette whatever stage you are on');
  assert.match(src, /mode==='none'/,  'the ring cannot empty the room for stage one');
  assert.match(src, /mode==='live'/,  'the ring never gives Ambush its strategy');
  assert.match(src, /foe==='dummy'/,  'nothing stops the training dummy being knocked out');
});

test('a stage is judged on one run, and the VM says when a run begins', ()=>{
  /* `running` is true either side of pressing Run again, so it cannot
     mark the start of an attempt. */
  assert.match(read('public/vm.js'), /runId\+\+/, 'the VM does not count its runs');
  assert.match(read('public/ring.js'), /seenRun!==VM\.runId/,
    'the ring works out when a run started from something other than the run counter');
});
