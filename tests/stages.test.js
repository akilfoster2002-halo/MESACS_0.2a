/* =====================================================================
   THE WALKTHROUGH INTO THE RING, under test.

   A stage is a list of steps now: one sentence, one thing to point at,
   and a question asked of the world. Which means most of what can go
   wrong with it is not a wrong answer, it is a DEAD END — a step whose
   target does not exist, or whose block is not on the shelf it just
   narrowed the palette to, or which asks for something a student cannot
   reach from where the step before left them.

   A dead end is unrecoverable in a way a wrong answer is not: the
   student is told to click a thing that is not there, and the only way
   out is to walk away. So that is what is checked hardest here.

   NOTHING IS KEPT, either — so there are tests that no part of this
   writes anything down, because a walkthrough that resumes half way is
   a walkthrough that starts by lying about where you are.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STAGES = require('../public/stages.js');
const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');

/* blocks.js is a browser global; read as source and run in a scratch context */
function blocksTable(){
  const ctx=vm.createContext({ console }); ctx.window=ctx; ctx.self=ctx;
  vm.runInContext(read('public/blocks.js'), ctx, { filename:'blocks.js' });
  return ctx.BLOCKS;
}
const BLOCKS = blocksTable();
const every = fn => STAGES.LIST.forEach(s=>s.steps.forEach((st,i)=>fn(st,i,s)));

/* ==================================================================== */
test('no two steps in a stage are waiting for the same thing', ()=>{
  /* COACH STANDS JUST PAST THE LAST STEP THAT IS TRUE, which is what lets
     a student who works ahead skip the steps they have already done. It
     also means two steps that answer the same question are two steps it
     cannot tell apart: stage one once had "click the gap inside the loop"
     and "click the gap inside the if" both asking `is the cursor in some
     mouth`, so clicking the first gap threw the student seven steps
     forward into a script they had not written yet.

     `want` is each step's answer to "waiting for what", declared so it
     can be compared. It is not used at runtime — done() is the real
     check — it exists so this test can exist. */
  STAGES.LIST.forEach(s=>{
    const seen={};
    s.steps.forEach((st,i)=>{
      assert.ok(st.want, s.name+' step '+(i+1)+' does not say what it is waiting for');
      (seen[st.want]=seen[st.want]||[]).push(i+1);
    });
    Object.keys(seen).forEach(k=>assert.strictEqual(seen[k].length, 1,
      s.name+' steps '+seen[k].join(' and ')+' are both waiting for "'+k+
      '", so the first one satisfies the second and the walkthrough skips ahead'));
  });
});

test('every step says one thing and knows when it has happened', ()=>{
  every((st,i,s)=>{
    const at=s.name+' step '+(i+1);
    assert.ok(st.say, at+' says nothing');
    assert.strictEqual(typeof st.done, 'function', at+' has no way to know it is done');
    assert.ok(st.sel || st.find, at+' points at nothing');
    /* One instruction. Two sentences is a step that should have been two
       steps, which is the whole complaint the walkthrough answers. */
    assert.ok(st.say.split(/\. |\? /).length<=3, at+' is a paragraph: "'+st.say+'"');
  });
});

/* THE PALETTE A STEP IS ACTUALLY LOOKING AT. A step with no `pal` of its
   own does not get a full palette — it INHERITS the last narrowing, which
   is the thing that made the first dead end so easy to write: "open
   Control" sat directly after a step that had cut the shelves down to
   Events, so there was no Control tab on the screen to click. Every check
   below asks what is on the palette at that moment, not what that one
   step happened to declare. */
function effective(stage){
  let cur=null;
  return stage.steps.map(st=>{ if(st.pal) cur=st.pal; return cur; });
}

test('a step never points at a block that is not on the palette in front of it', ()=>{
  /* THE DEAD END: a student staring at a shelf that does not contain the
     thing they have just been told to press, with no way on. */
  STAGES.LIST.forEach(s=>{
    const pals=effective(s);
    s.steps.forEach((st,i)=>{
      const m=/\[data-op="([^"]+)"\]/.exec(st.sel||'');
      const pal=pals[i];
      if(!m || !pal) return;
      assert.ok((pal.ops||[]).indexOf(m[1])>=0,
        s.name+' step '+(i+1)+' points at '+m[1]+', which is not on the palette by then');
    });
  });
});

test('a step never points at a shelf tab that is not on screen', ()=>{
  STAGES.LIST.forEach(s=>{
    const pals=effective(s);
    s.steps.forEach((st,i)=>{
      const m=/\[data-c="([^"]+)"\]/.exec(st.sel||'');
      const pal=pals[i];
      if(!m || !pal) return;
      assert.ok((pal.cats||[]).indexOf(m[1])>=0,
        s.name+' step '+(i+1)+' says to click the '+m[1]+
        ' tab, and there is no such tab on the palette by then');
    });
  });
});

test('a shelf a step opens is never empty when it gets there', ()=>{
  STAGES.LIST.forEach(s=>{
    const pals=effective(s);
    s.steps.forEach((st,i)=>{
      const pal=pals[i];
      if(!st.tab || !pal) return;
      assert.ok((pal.cats||[]).indexOf(st.tab)>=0,
        s.name+' step '+(i+1)+' opens the '+st.tab+' shelf and hides that whole category');
      const inTab=(pal.ops||[]).filter(op=>{
        const bd=BLOCKS.of(op); return bd && bd.cat===st.tab; });
      assert.ok(inTab.length>0,
        s.name+' step '+(i+1)+' opens the '+st.tab+' shelf and leaves nothing on it');
    });
  });
});

test('every block a step offers or points at is a real block', ()=>{
  const known=new Set(BLOCKS.LIST.map(b=>b.op));
  const cats =new Set(BLOCKS.CATS.map(c=>c.id));
  every((st,i,s)=>{
    const at=s.name+' step '+(i+1);
    (st.pal ? st.pal.ops||[] : []).forEach(op=>
      assert.ok(known.has(op), at+' offers '+op+', which is not a block'));
    (st.pal ? st.pal.cats||[] : []).forEach(c=>
      assert.ok(cats.has(c), at+' offers category '+c+', which does not exist'));
    const m=/\[data-op="([^"]+)"\]/.exec(st.sel||'');
    if(m) assert.ok(known.has(m[1]), at+' points at '+m[1]+', which is not a block');
    const t=/\[data-c="([^"]+)"\]/.exec(st.sel||'');
    if(t) assert.ok(cats.has(t[1]), at+' points at the '+t[1]+' shelf, which does not exist');
  });
});

test('a step that needs a block on screen was preceded by the step that puts it there', ()=>{
  /* Pointing into #cScript means "the thing you just built". If nothing
     earlier in the stage could have built it, the ring is drawing a ring
     around empty space. */
  STAGES.LIST.forEach(s=>{
    s.steps.forEach((st,i)=>{
      const sel=st.sel||'';
      if(sel.indexOf('#cScript')<0) return;
      assert.ok(i>0, s.name+' points into the script on its very first step');
    });
  });
});

test('every stage opens by opening the blocks, because nothing else can be clicked first', ()=>{
  STAGES.LIST.forEach(s=>{
    const first=s.steps[0];
    assert.match(first.say, /blocks/i, s.name+' starts somewhere other than the editor');
    assert.strictEqual(first.sel, '#ringOpen', s.name+' does not point at the way in');
  });
});

test('no step is already finished the moment a student walks in', ()=>{
  /* COACH STANDS JUST PAST THE LAST STEP THAT IS TRUE. A step that is
     true before it is read therefore carries every step before it away
     with it: the fight stage once said "back on your own robot" — which
     you already are, because that is where the room opens — and the whole
     walkthrough collapsed to its last line the instant anybody arrived.

     So this stands in the doorway. The editor is open on the student's
     own robot at the first shelf, the room is empty, nothing has been
     clicked and nothing has run: NOTHING may be true except the step that
     asked for the editor to be open. */
  const doorway = {
    open:true, actorName:()=>'Robot', shelf:()=>'events',
    slotArmed:()=>false, armedInside:()=>'', armedInMouth:()=>false
  };
  const had=global.window;
  global.window={ CODER:doorway };
  try{
    STAGES.LIST.forEach(s=>{
      /* WITH THE BLOCKS THE MISSION HANDS OVER, which is the whole point:
         a stage that starts you with a walking robot must not count the
         `if` it gave you as the `if` it is asking for. */
      const world={ me:{ scripts: s.start ? s.start() : [] }, foe:null,
        frames:{left:0,right:0,in:0,out:0}, gapMin:Infinity, said:false,
        won:false, readFoe:false, swings:{asked:0,landed:0,broke:0,far:0} };
      s.steps.forEach((st,i)=>{
        if(st.want==='editor-open') return;        // the one that IS the doorway
        assert.strictEqual(!!st.done(world), false,
          s.name+' step '+(i+1)+' ("'+st.want+'") is already true before anything has '+
          'been done, so the walkthrough skips straight past everything before it');
      });
    });
  } finally {
    if(had===undefined) delete global.window; else global.window=had;
  }
});

test('no stage walks you back through a stretch of an earlier one', ()=>{
  /* A walkthrough that keeps hold of you after you have understood
     something has stopped teaching and started supervising. Stages one,
     two and three used to open with the same four steps — flag, Control,
     forever, the gap — so the same idea was walked three times by the
     same person. What a stage hands over now is what the ones before it
     built, and it starts at the thing it is actually for.

     A RUN, not a single step. `if` turning up again to guard a punch is
     the same BLOCK doing a different job, which is worth showing; three
     steps in a row that a student has already been walked through is the
     thing that wastes their time. */
  const RUN=3;
  const wants = s => s.steps.map(x=>x.want).filter(w=>w!=='editor-open');
  const before=[];
  STAGES.LIST.forEach(s=>{
    const w=wants(s);
    for(let i=0;i+RUN<=w.length;i++){
      const run=w.slice(i,i+RUN).join(' > ');
      before.forEach(p=>assert.ok(p.seq.indexOf(run)<0,
        s.name+' walks through "'+run+'" again — '+p.name+' already did'));
    }
    before.push({ name:s.name, seq:w.join(' > ') });
  });
});

test('a stage that asks you to use something hands it to you', ()=>{
  /* AFFORD IT said "mash your punch key until the swings stop" in a room
     with no punch in it and no step that built one: a stage nobody could
     finish. Whatever a stage asks you to USE and does not teach, it must
     start you with. */
  const has=(scripts,op)=>{
    let found=false;
    STAGES.walk(scripts, b=>{ if(b.op===op) found=true; });
    (scripts||[]).forEach(sc=>STAGES.walk(sc.hat, b=>{ if(b.op===op) found=true; }));
    return found;
  };
  const needs={ spend:['data.set','sense.key','ctrl.forever'],   // it mashes a punch key
                fight:['data.set','sense.key','ctrl.forever'] }; // it fights
  Object.keys(needs).forEach(id=>{
    const s=STAGES.byId(id);
    assert.ok(s.start, s.name+' starts you with nothing and expects a program');
    const start=s.start();
    needs[id].forEach(op=>assert.ok(has(start,op),
      s.name+' expects a script using '+op+' and neither builds one nor hands one over'));
  });
  /* and the first stage hands over nothing, because it teaches the lot */
  assert.ok(!STAGES.byId('move').start, 'stage one starts with the answer already written');
});

test('what a mission hands over is the same every time, and is not a save', ()=>{
  const s=STAGES.byId('spend');
  const a=JSON.stringify(s.start()), b=JSON.stringify(s.start());
  assert.strictEqual(a, b, 'a mission hands over something different each time it is asked');
  /* a fresh object every call, or one student's edits would be the next
     student's starting point */
  assert.notStrictEqual(s.start(), s.start(),
    'the starting script is shared, so editing it in one run changes the next');
  assert.match(read('public/ring.js'), /JSON\.parse\(JSON\.stringify\(s\.start\(\)\)\)/,
    'the ring hands the stage\'s own object to the student to edit');
});

test('the last step of a stage cannot pass on a lucky first few seconds', ()=>{
  /* COACH stands past the LAST true step, so a finish that is true for a
     moment early in a run ends the stage there and then. AFFORD IT went
     exactly this way: "land three without a wasted swing" is true of the
     first three punches of ANY run, because they come out of a full tank
     whether or not the student built the check. A stage's finish has to
     depend on the thing it taught. */
  const world = over => Object.assign({
    me:{ scripts:[] }, foe:null, frames:{left:0,right:0,in:0,out:0},
    gapMin:Infinity, said:false, won:false, readFoe:false,
    swings:{asked:0,landed:0,broke:0,far:0},
    uses:()=>false, reads:()=>false, writes:()=>false }, over||{});

  /* Only where the state is REACHABLE. A stage that hands you a script
     which can already throw a punch can be mashed from the first second;
     one that hands you a walker cannot land anything at all until the
     student has built the punch, so the same assertion there would be
     about a run that cannot happen. */
  const RULES=require('../public/rules.js');
  const canPunch = s => {
    if(!s.start) return false;
    let yes=false;
    s.start().forEach(sc=>STAGES.walk(sc.body, b=>{
      if(b.op==='data.set' && RULES.SIGNALS.indexOf(String(b.args&&b.args.v))>=0) yes=true; }));
    return yes;
  };
  const mashed=STAGES.LIST.filter(canPunch);
  assert.ok(mashed.length, 'no stage hands over a punch, so this test is checking nothing');
  mashed.forEach(s=>{
    const last=s.steps[s.steps.length-1];
    const w=world({ swings:{asked:3,landed:3,broke:0,far:0}, me:{ scripts:s.start() } });
    assert.strictEqual(!!last.done(w), false,
      s.name+' hands over a punch and then finishes on the first three it lands, '+
      'before the student has built the thing the stage is about');
  });
});

test('a step is checked against the world, and a half-built world is not a crash', ()=>{
  /* done() runs every frame, including the frames before the room has
     finished being built. */
  const empty={ me:null, foe:null, frames:{}, swings:{}, gapMin:Infinity };
  every((st,i,s)=>assert.doesNotThrow(()=>st.done(empty),
    s.name+' step '+(i+1)+' throws on an empty world'));
  const nothing={ me:{scripts:[]}, foe:null,
    frames:{left:0,right:0,in:0,out:0}, gapMin:Infinity, said:false, won:false,
    swings:{asked:0,landed:0,broke:0,far:0} };
  STAGES.LIST.forEach(s=>assert.strictEqual(s.steps[1] ? !!s.steps[1].done(nothing) : false, false,
    s.name+' is already past its second step before anything has been done'));
});

/* ------------------------------------------------- reading the script */
test('the twitch is what stage one is about, and it says so where it matters', ()=>{
  const s=STAGES.byId('move');
  const where=s.steps.findIndex(x=>/checked ONCE/i.test(x.say));
  assert.ok(where>=0, 'stage one never explains why a bare conditional does not work');
  const ifStep=s.steps.findIndex(x=>/data-op="ctrl\.if"/.test(x.sel||''));
  assert.strictEqual(where, ifStep,
    'the twitch is explained somewhere other than the step that places the if');
});

test('a control is a key test inside a loop that actually moves something', ()=>{
  const wrap=(body)=>({ scripts:[{ hat:{op:'event.flag',args:{}}, body }] });
  const ifKey=(k,inner)=>({ op:'ctrl.if', args:{c:{op:'sense.key',args:{k}}}, body:inner });
  const move=[{ op:'motion.changeBy', args:{a:'x',n:1} }];

  const loop=wrap([{ op:'ctrl.forever', args:{}, body:[ifKey('d',move)] }]);
  assert.strictEqual(STAGES.controls(loop), 1);

  /* the twitch: the same three blocks, no loop */
  const twitch=wrap([ifKey('d',move)]);
  assert.strictEqual(STAGES.controls(twitch), 0,
    'a conditional outside the loop counted as a control');

  /* a key test that moves nothing is not a control either */
  const idle=wrap([{ op:'ctrl.forever', args:{}, body:[ifKey('d',[{op:'looks.say',args:{s:'hi'}}])] }]);
  assert.strictEqual(STAGES.controls(idle), 0);

  const both=wrap([{ op:'ctrl.forever', args:{}, body:[ifKey('d',move), ifKey('a',move)] }]);
  assert.strictEqual(STAGES.controls(both), 2);
  assert.deepStrictEqual(STAGES.keysUsed(both), ['d','a']);
});

test('reading a variable and writing one are different questions', ()=>{
  const set={ scripts:[{ hat:{op:'event.flag',args:{}},
    body:[{ op:'data.set', args:{ v:'light', n:1 } }] }] };
  assert.strictEqual(STAGES.writes(set,'light'), true);
  assert.strictEqual(STAGES.reads(set,'light'), false,
    'setting a variable counted as reading it, so stage four could be passed without looking');
  const got={ scripts:[{ hat:{op:'event.flag',args:{}}, body:[
    { op:'ctrl.if', args:{ c:{ op:'op.gt', args:{
        a:{ op:'data.get', args:{ v:'stamina' } }, b:20 } } }, body:[] } ] }] };
  assert.strictEqual(STAGES.reads(got,'stamina'), true,
    'a variable read two reporters deep was missed');
});

/* ------------------------------------------------------ nothing is kept */
test('nothing about a stage is written down', ()=>{
  /* Every entry is an empty room at step one. A saved stage, a saved
     "furthest reached" or a saved script all break the same promise. */
  const ring=read('public/ring.js');
  ['saveStage','saveReached','furthest'].forEach(k=>
    assert.ok(ring.indexOf(k)<0, 'the ring still keeps '+k));
  /* The only localStorage the ring may touch is the removeItem that
     sweeps what an older build left behind. */
  const uses=(ring.match(/localStorage\.\w+/g)||[]);
  uses.forEach(u=>assert.strictEqual(u, 'localStorage.removeItem',
    'the ring does '+u+' — it is meant to keep nothing'));
  assert.match(ring, /localStorage\.removeItem/,
    'the ring never clears the keys older builds of it wrote');
  assert.match(ring, /VM\.useScratch\(\)/,
    'the ring opens a saved slot, so a mission is not a fresh room');
  assert.ok(!/VM\.useSlot\(/.test(ring), 'the ring still opens a saved project slot');
});

test('a scratch project reads nothing and writes nothing', ()=>{
  const v=read('public/vm.js');
  assert.match(v, /function save\(\)\{\s*if\([^)]*\bscratch\b[^)]*\) return;/,
    'a scratch project can still be saved');
  assert.match(v, /if\(scratch\)\{[^}]*reset\(\)/,
    'load() still reads the slot for a scratch project');
  assert.match(v, /function useScratch\(\)/, 'there is no way to ask for a scratch project');
});

test('what a step reads about the world is live, not a photograph of the start', ()=>{
  /* COACH IS HANDED THE CONTEXT ONCE and then asks it the same questions
     sixty times a second for the next ten minutes. Built with
     Object.assign it was a snapshot: the frame counts were the counts at
     the moment the student walked in — zero — and stayed zero however far
     the robot ran, so the LAST step of every stage could never come true.

     It was silent, too, which is why it is worth a test: the steps that
     read the student's script kept working, because those go and look the
     actor up again every time. Only the counted ones froze. */
  const ring=read('public/ring.js');
  const i=ring.indexOf('function ctx(){');
  assert.ok(i>0, 'the ring has no walkthrough context to check');
  const body=ring.slice(i, ring.indexOf('\n  }', i));
  assert.ok(!/Object\.assign\(\{\}, run/.test(body),
    'the walkthrough context is copied from run, so every counter it reads freezes');
  ['frames','swings','gapMin','said','won'].forEach(k=>
    assert.ok(new RegExp('get '+k+'\\(\\)').test(body),
      'ctx.'+k+' is not a getter, so it is read once and never again'));
  /* and the actor is looked up each time, not captured */
  assert.ok(/get me\(\)\{ return me\(\); \}/.test(body.replace(/\s+/g,' ')) ||
            /get me\(\)/.test(body),
    'the walkthrough holds one actor object rather than looking it up');
});

test('the mission is chosen on the way in, because it cannot be remembered', ()=>{
  assert.match(read('public/ring.js'), /function start\(robotId, addTemplates, stageIx\)/,
    'the ring does not take the mission as an argument');
  assert.match(read('public/pit.js'), /onGo\(robot\(\), \[\], mission\)/,
    'the pit does not hand the ring a mission');
  assert.ok(!/ring_far|ring_stage/.test(read('public/pit.js')),
    'the pit is reading saved ring progress to decide what to offer');
});

/* ----------------------------------------------------------- the rows */
test('every stage is a complete row, and the order is the teaching order', ()=>{
  STAGES.LIST.forEach((s,i)=>{
    ['id','name','teach','goal','foe'].forEach(k=>
      assert.ok(s[k], 'stage '+(i+1)+' has no '+k));
    assert.strictEqual(s.n, i+1, s.name+' is numbered '+s.n+' and sits at '+(i+1));
    assert.ok((s.steps||[]).length>=4, s.name+' is not a walkthrough, it is a hint');
    assert.ok(['none','dummy','live'].indexOf(s.foe)>=0, s.name+' has an unknown kind of opponent');
  });
  assert.strictEqual(STAGES.LIST[0].foe, 'none',  'stage one is not an empty room');
  assert.strictEqual(STAGES.LIST[STAGES.LAST].foe, 'live', 'the last stage is not a fight');
});

test('an out-of-range stage is the nearest real one, not undefined', ()=>{
  assert.strictEqual(STAGES.byIndex(-5).id, STAGES.LIST[0].id);
  assert.strictEqual(STAGES.byIndex(99).id, STAGES.LIST[STAGES.LAST].id);
  assert.ok(STAGES.steps(99).length>0);
});

test('the palette a stage falls back to is everything its steps ever offered', ()=>{
  STAGES.LIST.forEach((s,i)=>{
    const p=STAGES.palette(i);
    if(!p) return;                         // the fight hands over the whole room
    s.steps.forEach(st=>{
      (st.pal ? st.pal.ops||[] : []).forEach(op=>assert.ok(p.ops.indexOf(op)>=0,
        s.name+' drops '+op+' when the walkthrough ends, so a finished student loses it'));
    });
  });
});
