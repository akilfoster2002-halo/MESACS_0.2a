/* =====================================================================
   The Ring, under test.

   The language in here is the game's own Scratch, which has its own
   tests — so these are not about what `forever` means. They are about
   what the RING decides, and every one of them is a way the mode could
   quietly stop teaching what it exists for:

     · that the palette it hands out really contains a loop, a
       conditional, a sensing block and something that moves, because
       those four together are the whole argument;
     · that every op it names is a real block, since a typo in that list
       is a block that silently never appears;
     · that nothing moves the robot except the student's own script;
     · that the robots wear costumes resolving to files that exist.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROBOTS = require('../public/robots.js');
const TEMPLATES = require('../public/templates.js');
const RULES = require('../public/rules.js');

const P = f => path.join(__dirname,'..',f);
const read = f => fs.readFileSync(P(f),'utf8');

/* blocks.js and costumes.js are browser globals, so they are read as
   source and run in a scratch context — the same trick the rest of this
   suite uses for files that assume a window. */
function globals(files){
  const ctx=vm.createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  files.forEach(f=>vm.runInContext(read(f), ctx, { filename:f }));
  return ctx;
}
const BLOCKS = globals(['public/blocks.js']).BLOCKS;

/* The ring's palette, read out of the source rather than imported:
   ring.js needs a DOM to load, and the one thing worth asserting about
   it is a plain object literal near the top. */
function palette(){
  const m=read('public/ring.js').match(/const PALETTE = (\{[\s\S]*?\n  \});/);
  assert.ok(m, 'ring.js has no PALETTE to check');
  return new Function('return '+m[1])();
}

/* ==================================================================== */
test('every block the ring puts on the palette is a real block', ()=>{
  const pal=palette();
  const known=new Set(BLOCKS.LIST.map(b=>b.op));
  pal.ops.forEach(op=>assert.ok(known.has(op),
    op+' is on the ring palette and is not a block in blocks.js'));
  const cats=new Set(BLOCKS.CATS.map(c=>c.id));
  pal.cats.forEach(c=>assert.ok(cats.has(c), c+' is not a category'));
});

test('every block on the palette is in a category the palette shows', ()=>{
  /* An op whose category is filtered out is an op nobody can reach: the
     editor lists categories first, then the blocks inside them. */
  const pal=palette();
  const cat=new Map(BLOCKS.LIST.map(b=>[b.op, b.cat]));
  pal.ops.forEach(op=>assert.ok(pal.cats.indexOf(cat.get(op))>=0,
    op+' is in category "'+cat.get(op)+'", which the ring does not show'));
});

test('the palette has a loop, a conditional, a sensing block and a way to move', ()=>{
  /* THE WHOLE ARGUMENT OF THE MODE. A conditional inside a forever loop
     is what makes a control persist, and it cannot be shown with any one
     of these four missing. */
  const pal=palette();
  ['event.flag','ctrl.forever','ctrl.if','sense.key','motion.changeBy']
    .forEach(op=>assert.ok(pal.ops.indexOf(op)>=0, 'the palette has no '+op));
});

/* ------------------------------------------------- the palette pairs up
   A block with half its family on the palette is worse than no family at
   all: the student goes looking for the rest and concludes they have
   missed something. Each of these is a pair that has to travel together,
   and the reason is in ring.js next to the list. */
test('nothing that changes a thing is on the palette without a way to read it', ()=>{
  const p=new Set(palette().ops);
  const pairs=[
    ['motion.turn','motion.dir',      'turn, with no way to read the direction'],
    ['motion.changeBy','motion.pos',  'change x by, with no x position to check it against'],
    ['motion.setTo','motion.pos',     'set x to, with no x position'],
    ['motion.move','motion.turn',     'move steps, with nothing to turn it first'],
    ['sense.timer','sense.resetTimer','a timer that can never be put back to zero'],
    ['looks.sayFor','looks.say',      'say-for-n-seconds without plain say']
  ];
  pairs.forEach(([a,b,why])=>{
    if(p.has(a)) assert.ok(p.has(b), why+' \u2014 '+a+' needs '+b);
  });
});

test('the comparisons and the booleans each come as a whole family', ()=>{
  const p=new Set(palette().ops);
  const family=(ops,what)=>{
    const on=ops.filter(o=>p.has(o));
    assert.ok(on.length===0 || on.length===ops.length,
      'the '+what+' are half on the palette ('+on.join(', ')+') \u2014 a student who finds two will hunt for the rest');
  };
  family(['op.lt','op.eq','op.gt'], 'comparisons');
  family(['op.and','op.or','op.not'], 'boolean operators');
});

test('every boolean slot on the palette has something to drop into it', ()=>{
  /* `if`, `repeat until` and `wait until` are all shaped to take a
     boolean. If the palette offers one and no boolean reporter, the slot
     can never be filled. */
  const p=palette(), on=new Set(p.ops);
  const wantsBool = BLOCKS.LIST.filter(b=>on.has(b.op) &&
    Object.keys(b.args||{}).some(k=>b.args[k].type==='bool'));
  if(!wantsBool.length) return;
  const bools = BLOCKS.LIST.filter(b=>on.has(b.op) && b.kind==='bool');
  assert.ok(bools.length>0,
    wantsBool.map(b=>b.op).join(', ')+' take a boolean and nothing on the palette reports one');
});

test('every reporter slot that wants a number has a reporter to fill it', ()=>{
  const on=new Set(palette().ops);
  const reporters=BLOCKS.LIST.filter(b=>on.has(b.op) && b.kind==='report');
  assert.ok(reporters.length>0, 'nothing on the palette reports a value to use');
});

test('the blocks that need a second object are on, and the opponent exists', ()=>{
  /* `touching?`, `distance to` and `%a of %o` all take another object.
     The pairing goes both ways: if one is on the palette, the ring has
     to build something for it to point at. */
  const on=new Set(palette().ops);
  const needObj=BLOCKS.LIST.filter(b=>on.has(b.op) &&
    Object.keys(b.args||{}).some(k=>b.args[k].type==='obj'));
  if(!needObj.length) return;
  const src=read('public/ring.js');
  assert.match(src, /function ensureFoe\(/,
    needObj.map(b=>b.op).join(', ')+' need a second object and the ring builds none');
  assert.match(src, /ensureFoe\(\)/, 'the opponent is defined and never built');
});

test('the costume block stays off, because rigged costumes do not instance', ()=>{
  const on=new Set(palette().ops);
  assert.ok(!on.has('looks.shape'),
    'become-a is on the palette, and it would silently draw the robot at the wrong size in the wrong place');
});

test('the palette is a subset and not all of Scratch', ()=>{
  /* Not a style rule. The argument for cutting Free Play down was that a
     palette of a hundred is a reference manual rather than a lesson.

     IT GREW WHEN ATTACKS ARRIVED, and it had to: an attack you BUILD
     rather than press needs variables to hold state, a custom block to
     be a function, and broadcast to tell the thing you hit. Those are
     not decoration, they are the lesson. The ceiling moved with them;
     what it still refuses is the whole language arriving by accident. */
  const p=palette();
  assert.ok(p.ops.length<=48, 'the palette has grown to '+p.ops.length+' blocks');
  assert.ok(p.ops.length < BLOCKS.LIST.length,
    'the palette is now every block there is, so it restricts nothing');
  assert.equal(new Set(p.ops).size, p.ops.length, 'a block is listed twice');
});

test('an attack can be BUILT, which means state, a function and a message', ()=>{
  /* The whole point of the mode. If any of these three comes off the
     palette, an attack stops being something a student assembles out of
     programming and goes back to being a button. */
  const on=new Set(palette().ops);
  [['data.set','a variable to hold state'],
   ['data.get','a way to read that state back'],
   ['my.call','a custom block, so an attack can be a function'],
   ['event.send','a way to tell the thing you hit'],
   ['event.recv','a way to be told'],
   ['ctrl.repeat','a counted loop'],
   ['ctrl.wait','time passing while you are committed'],
   ['sense.dist','a reading to test your reach against']
  ].forEach(([op,why])=>assert.ok(on.has(op), 'no '+op+' \u2014 '+why));
});

/* ------------------------------------------------------- the templates
   Worked examples a student takes apart, so the thing to guard is that
   they are made of blocks the student actually HAS — a template reaching
   for a block that is not on the palette is a worked example that cannot
   be edited, which is worse than none. */
function opsIn(x){
  const out=[];
  (function walk(v){
    if(!v || typeof v!=='object') return;
    if(Array.isArray(v)) return v.forEach(walk);
    if(v.op) out.push(v.op);
    Object.keys(v).forEach(k=>walk(v[k]));
  })(x);
  return out;
}
const allOf = t => [t.procs, t.scripts];

test('every template is built only out of blocks that are on the palette', ()=>{
  const on=new Set(palette().ops);
  TEMPLATES.LIST.forEach(t=>{
    opsIn(allOf(t)).forEach(op=>assert.ok(on.has(op),
      t.id+' uses '+op+', which the student has not got \u2014 they could not have written it, and cannot edit it'));
  });
});

test('every block a template uses is real, with the args it really takes', ()=>{
  const by=new Map(BLOCKS.LIST.map(b=>[b.op,b]));
  TEMPLATES.LIST.forEach(t=>{
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(x.op){
        const bd=by.get(x.op);
        assert.ok(bd, t.id+' uses '+x.op+', which is not a block');
        Object.keys(x.args||{}).forEach(k=>assert.ok(bd.args && (k in bd.args),
          t.id+': '+x.op+' has no argument called "'+k+'"'));
      }
      Object.keys(x).forEach(k=>walk(x[k]));
    })(allOf(t));
  });
});

test('a template uses only variables it declares, the referee owns, or signals with', ()=>{
  /* Three kinds of name, and the difference IS the lesson: `swinging`
     is the student's and they declare it; `health` and `stamina` belong
     to the referee and are read-only; `light` and `heavy` are how you
     ask the referee for a swing. Anything outside those three is a typo
     that would silently read zero forever. */
  const owned=new Set(RULES.OWNED), signals=new Set(RULES.SIGNALS);
  TEMPLATES.LIST.forEach(t=>{
    const mine=new Set(t.vars||[]);
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(/^data\.(set|change|get)$/.test(x.op||'') && x.args && x.args.v){
        const v=x.args.v;
        assert.ok(mine.has(v) || owned.has(v) || signals.has(v),
          t.id+' uses the variable "'+v+'" and does not declare it');
        if(owned.has(v)) assert.equal(x.op, 'data.get',
          t.id+' WRITES to "'+v+'", which the referee owns and stamps back');
      }
      Object.keys(x).forEach(k=>walk(x[k]));
    })(allOf(t));
  });
});

test('every custom block a template calls is defined by some template', ()=>{
  /* A PLAN calls jab and slam, which live in other templates — so the
     check is across the whole set, and the pit has to say which ones go
     together. */
  const defined=new Set();
  TEMPLATES.LIST.forEach(t=>(t.procs||[]).forEach(p=>defined.add(p.name)));
  TEMPLATES.LIST.forEach(t=>{
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(x.op==='my.call' && x.args && x.args.p)
        assert.ok(defined.has(x.args.p),
          t.id+' calls "'+x.args.p+'" and nothing defines it');
      Object.keys(x).forEach(k=>walk(x[k]));
    })(allOf(t));
  });
});

/* ====================================================== the opponent */
test('the opponent is written in blocks the student can read AND edit', ()=>{
  /* The whole reason it is an actor with scripts rather than a function
     hidden in the ring. If it reaches for a block that is not on the
     palette, a student can open it, read it, and then not be able to
     change it \u2014 which is the most annoying possible outcome. */
  const on=new Set(palette().ops);
  opsIn([TEMPLATES.aiProcs(), TEMPLATES.aiScripts()]).forEach(op=>
    assert.ok(on.has(op), 'the opponent uses '+op+', which the student has not got'));
});

test('the opponent checks it can afford a swing before it throws one', ()=>{
  /* Otherwise it is not a worked example of anything \u2014 a student
     reading it should see the habit worth stealing. */
  const src=JSON.stringify([TEMPLATES.aiProcs(), TEMPLATES.aiScripts()]);
  assert.match(src, /"v":"stamina"/, 'the opponent never reads its own stamina');
  TEMPLATES.aiProcs().forEach(p=>{
    assert.equal(p.body[0].op, 'ctrl.if',
      'the opponent\'s "'+p.name+'" swings without checking anything first');
  });
});

test('the opponent asks the referee for its swings like everybody else', ()=>{
  /* It must not be able to deal damage in a way the student cannot. */
  const sets=[];
  (function walk(x){
    if(!x || typeof x!=='object') return;
    if(Array.isArray(x)) return x.forEach(walk);
    if(x.op==='data.set' && x.args) sets.push(x.args.v);
    Object.keys(x).forEach(k=>walk(x[k]));
  })([TEMPLATES.aiProcs(), TEMPLATES.aiScripts()]);
  assert.ok(sets.some(v=>RULES.SIGNALS.indexOf(v)>=0),
    'the opponent never raises a swing signal, so it cannot be hitting anybody fairly');
  sets.forEach(v=>assert.ok(RULES.OWNED.indexOf(v)<0,
    'the opponent writes to "'+v+'", which the referee owns'));
});

test('the opponent is beatable — it has no guard and never dodges', ()=>{
  /* Deliberate. A student beats it by punishing the slam\u2019s long
     recovery, and that only works if it does not simply turtle. */
  const src=JSON.stringify([TEMPLATES.aiProcs(), TEMPLATES.aiScripts()]);
  assert.ok(!/"v":"guard"/.test(src), 'the opponent guards, which makes it a wall');
  assert.ok(!/"v":"dodging"/.test(src), 'the opponent dodges, which makes it unpunishable');
});

test('every template says what it teaches and what to change in it', ()=>{
  /* The `tune` list IS the exercise. A template without one is a thing
     to copy rather than a thing to take apart. */
  TEMPLATES.LIST.forEach(t=>{
    ['name','em','blurb','teaches'].forEach(k=>
      assert.ok(t[k] && String(t[k]).length, t.id+' has no '+k));
    assert.ok((t.tune||[]).length>0, t.id+' names nothing worth changing');
    (t.tune||[]).forEach(x=>{
      assert.ok(x.what && x.does, t.id+' has a tune row with a gap in it');
      assert.ok(/[0-9]/.test(x.what) || /\u2039|\u203a/.test(x.what),
        t.id+': "'+x.what+'" is not a number or a condition you could change');
    });
  });
});

test('the state a template sets is state the referee actually reads', ()=>{
  /* `guard` does nothing on its own. It is a fact about you that the
     REFEREE checks when a punch arrives — so if the ring stops reading
     it, blocking silently becomes decoration and the student is right
     to think it is broken. */
  const written=new Set();
  TEMPLATES.LIST.forEach(t=>{
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(x.op==='data.set' && x.args && (t.vars||[]).indexOf(x.args.v)>=0)
        written.add(x.args.v);
      Object.keys(x).forEach(k=>walk(x[k]));
    })(allOf(t));
  });
  assert.ok(written.has('guard'), 'nothing sets guard');
  const ring=read('public/ring.js');
  assert.match(ring, /vars\.guard/,
    'a template sets `guard` and the referee never reads it \u2014 blocking does nothing');
});

/* ======================================================== the referee
   The half of the fight the student cannot change. These are the rules
   the pit prints, so if they drift the screen starts lying. */
test('the heavy costs more, hurts more and reaches less than the light', ()=>{
  const m=RULES.RULES.moves;
  assert.ok(m.heavy.cost   > m.light.cost,   'the heavy is not dearer');
  assert.ok(m.heavy.damage > m.light.damage, 'the heavy does not hurt more');
  assert.ok(m.heavy.reach <= m.light.reach,  'the heavy reaches as far, so it is strictly better');
  /* AND IT IS BAD VALUE PER POINT, which is what makes choosing it a
     decision rather than an obvious yes. */
  assert.ok(m.heavy.damage/m.heavy.cost < m.light.damage/m.light.cost,
    'the heavy is better value per stamina, so nobody would ever jab');
});

test('a swing you cannot afford does not happen, and costs nothing', ()=>{
  const r=RULES.resolve('light', 0, 1, false);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'no-stamina');
  assert.equal(r.cost, 0, 'it charged for a swing that never happened');
  assert.equal(r.damage, 0);
});

test('a swing that misses still costs — that is what makes reach matter', ()=>{
  const m=RULES.RULES.moves.light;
  const r=RULES.resolve('light', 100, m.reach+2, false);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'too-far');
  assert.equal(r.cost, m.cost, 'a miss was free, so there is no reason to aim');
  assert.equal(r.damage, 0);
});

test('a guard softens a punch and does not stop it', ()=>{
  const clean=RULES.resolve('light', 100, 1, false);
  const held =RULES.resolve('light', 100, 1, true);
  assert.equal(clean.ok, true);
  assert.equal(held.ok, true, 'a guard stopped the punch outright');
  assert.ok(held.damage < clean.damage, 'guarding did nothing');
  assert.ok(held.damage > 0, 'a guard is a wall, so turtling wins every fight');
  assert.equal(held.cost, clean.cost, 'the attacker paid less for being blocked');
});

test('stamina comes back, and never past the cap', ()=>{
  const cap=RULES.RULES.stamina;
  assert.ok(RULES.regenerated(0,1) > 0, 'stamina never comes back, so one flurry ends you');
  assert.equal(RULES.regenerated(cap, 5), cap, 'stamina went past its own cap');
  assert.ok(RULES.regenerated(0,1) <= cap);
  /* Slow enough that heavies are not free. */
  const perSlam=RULES.RULES.moves.heavy.cost/RULES.RULES.regen;
  assert.ok(perSlam > 1, 'a heavy regenerates in under a second, so it costs nothing real');
});

test('resolve is pure, so the balance can be tested without a game', ()=>{
  const a=RULES.resolve('heavy', 60, 3, false);
  const b=RULES.resolve('heavy', 60, 3, false);
  assert.deepEqual(a, b);
  assert.equal(RULES.resolve('nonsense', 100, 1, false).ok, false);
});

test('the referee owns health and stamina, and stamps them back', ()=>{
  /* A script can `set [health] to 999`. It has to not work, or there is
     no game \u2014 and finding that out is the fastest lesson in here
     about what read-only means. */
  const ring=read('public/ring.js');
  assert.match(ring, /a\.vars\.health\s*=/,  'the ring never writes health back');
  assert.match(ring, /a\.vars\.stamina\s*=/, 'the ring never writes stamina back');
  assert.match(ring, /RULES\.SIGNALS|R\.SIGNALS/, 'the ring never looks for a swing signal');
  RULES.OWNED.forEach(v=>assert.ok(ring.indexOf('vars.'+v)>=0,
    'the ring does not own '+v+', so a script could just set it'));
});

test('the referee resolves everything before it publishes anything', ()=>{
  /* Stamped inside the resolution loop, a fighter's numbers were written
     before the other one had swung — so the punch that took somebody to
     zero left `(health)` reading six for another tick, and a script
     checking its own health got an answer that was true a twentieth of a
     second ago. Two passes: work it out, then publish it. */
  const src=read('public/ring.js');
  const fn=src.slice(src.indexOf('function referee('), src.indexOf('const book='));
  const resolveAt=fn.indexOf('R.resolve(');
  const stampAt=fn.indexOf('a.vars.health=');
  assert.ok(resolveAt>=0 && stampAt>=0, 'the referee no longer resolves or no longer stamps');
  assert.ok(stampAt > resolveAt,
    'the referee publishes health before it has finished resolving the tick');
  const between=fn.slice(resolveAt, stampAt);
  assert.match(between, /\}\);/, 'the stamp is inside the resolution loop rather than after it');
});

test('a knockout stops the scripts where they stand', ()=>{
  /* While the reset banner counted down with the scripts still running,
     the winner kept walking with no referee holding them on the floor
     and strolled to x=32 during their own victory lap. */
  const src=read('public/ring.js');
  const fn=src.slice(src.indexOf('function referee('));
  const knock=fn.indexOf('announce(win)');
  assert.ok(knock>=0, 'nothing announces a winner');
  assert.match(fn.slice(knock, knock+400), /VM\.stopAll\(\)/,
    'a knockout does not stop the scripts, so the loser keeps playing');
});

test('the floor and the gap are the referee\'s, not a script\'s', ()=>{
  const R=RULES.RULES;
  /* Both worked strategies walk toward the other one with a CONSTANT,
     which is correct until they pass through each other and then walks
     them apart forever. */
  const far=RULES.separate(-999, 999);
  assert.ok(Math.abs(far.a)<=R.floor && Math.abs(far.b)<=R.floor, 'the floor does not hold');
  const close=RULES.separate(0, 0.1);
  assert.ok(Math.abs(close.a-close.b) >= R.apart-1e-9,
    'two fighters can stand inside each other');
  const swapped=RULES.separate(5, 4.9);
  assert.ok(swapped.a > swapped.b, 'separating them swapped which side they are on');
  assert.match(read('public/ring.js'), /R\.separate\(/, 'the ring never separates them');
});

test('the pit prints the rules, and prints the ones that are real', ()=>{
  /* The sheet is generated from the same numbers the referee uses, so
     it cannot say one thing while the game does another. */
  const sheet=RULES.sheet();
  assert.ok(sheet.length>=5, 'the rule sheet is too short to be the rules');
  sheet.forEach(r=>{ assert.ok(r.what && r.says, 'a rule row has a gap in it'); });
  const all=sheet.map(r=>r.says).join(' ');
  assert.ok(all.indexOf(String(RULES.RULES.health))>=0, 'the sheet never states the health');
  assert.ok(all.indexOf(String(RULES.RULES.regen))>=0, 'the sheet never states the regen');
  assert.ok(all.indexOf(String(RULES.RULES.moves.heavy.cost))>=0,
    'the sheet never states what a heavy costs');
  assert.match(read('public/pit.js'), /RULES\.sheet\(\)/,
    'the pit does not print the rule sheet, so the fixed numbers are a secret');
});

/* --------------------------------------------------------- the bodies */
test('each robot names a model file that is really there', ()=>{
  ROBOTS.LIST.forEach(r=>{
    assert.ok(fs.existsSync(P(path.join('public', r.model))),
      r.id+' names '+r.model+', which is not there');
  });
});

test('the ring wears its robots as costumes rather than loading them itself', ()=>{
  /* It used to hold a GLTFLoader of its own because COSTUMES could not
     instance a rigged model. That is fixed, so this is the check that
     the workaround actually went away rather than being left next to
     the fix. */
  const src=read('public/ring.js');
  /* Comments stripped: the history of WHY it used to load its own is
     worth keeping written down next to the thing that replaced it. */
  const body=src.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/GLTFLoader/.test(body),
    'the ring still loads models itself, so the costume fix is not being used');
  assert.match(src, /VM\.dress\([a-z]+, *'robots\//,
    'the ring does not dress its fighters through the costume system');
});

test('costumes clone a rigged model with its OWN skeleton', ()=>{
  /* THE BUG THIS REPLACED. Object3D.clone() copies a SkinnedMesh and
     copies the bones but never re-points the copy at the copied bones,
     so every clone kept the prototype's Skeleton and was drawn by bones
     living outside itself — ignoring its own position and scale. A Box3
     measured everything as correct the whole time, which is what made it
     so hard to see. */
  const src=read('public/costumes.js');
  assert.ok(!/\.then\(o=>o\.clone\(true\)\)/.test(src),
    'costumes still use a plain clone, which shares the skeleton');
  assert.match(src, /function cloneRig\(/, 'there is no skeleton-aware clone');
  assert.match(src, /new THREE\.Skeleton\(/, 'nothing builds a new Skeleton for the copy');
  assert.match(src, /boneInverses/,
    'the new Skeleton does not carry the bind-pose inverses over');
  assert.match(src, /\.bind\(/, 'the cloned mesh is never rebound');
});

test('a costume is scaled by multiplying, never by setting', ()=>{
  /* These exports carry a scale of their own — a hundredth, being
     authored in centimetres — and the box is measured AFTER it.
     setScalar threw that away and left a four-metre robot four hundred
     and sixty, which from the floor looks exactly like a model that
     failed to load. */
  const src=read('public/costumes.js');
  const fn=src.slice(src.indexOf('function proto('), src.indexOf('const load ='));
  assert.match(fn, /root\.scale\.multiplyScalar\(/,
    'costumes do not multiply the model scale');
  assert.ok(!/root\.scale\.setScalar\(/.test(fn),
    'costumes set the model scale, which discards the export\'s own');
  /* And centred by looking again afterwards, not by scaling the old
     centre — which is only the same answer for a root with no transform
     of its own. */
  assert.match(fn, /root\.position\.sub\(/,
    'costumes centre by arithmetic on the old box rather than by measuring again');
});

test('costumes carry their animation clips, or a rigged one cannot move', ()=>{
  /* Dropping gltf.animations is what forced the ring to load the file a
     second time in the first place. Clips are shared and immutable; a
     mixer is per-object and stays the ring's. */
  assert.match(read('public/costumes.js'), /reels\.set\(/,
    'costumes still drop the animation clips');
  assert.match(read('public/costumes.js'), /clips *[,:=]/,
    'costumes do not expose the clips they kept');
  assert.match(read('public/ring.js'), /COSTUMES\.clips\(/,
    'the ring never asks for the clips, so nothing is animated');
  assert.match(read('public/ring.js'), /new THREE\.AnimationMixer\(/,
    'the ring has no mixer');
});

test('the robots are on a shelf, so anything can wear one', ()=>{
  const COSTUMES = globals(['public/costumes.js']).COSTUMES;
  const shelf=COSTUMES.SHELVES.find(x=>x.id==='robots');
  assert.ok(shelf, 'there is no robots shelf');
  ROBOTS.LIST.forEach(r=>{
    assert.ok(shelf.items.find(i=>i.file===r.id), r.id+' is not on the robots shelf');
    assert.ok(fs.existsSync(P(path.join('public', shelf.dir, r.id+'.glb'))),
      r.id+"'s costume points at a file that is not there");
  });
});

test('the robot stands on the floor rather than half inside it', ()=>{
  /* The body is centred on the actor, so the actor has to be half a
     robot up or it is buried to the waist. */
  assert.match(read('public/ring.js'), /bot\.y=spec\.height\/2/,
    'the robot is placed at the floor rather than half its height above it');
});

test('every robot is a complete row', ()=>{
  ROBOTS.LIST.forEach(r=>{
    ['name','em','tag','blurb','model'].forEach(k=>
      assert.ok(r[k] && String(r[k]).length, r.id+' has no '+k));
    assert.equal(typeof r.height, 'number', r.id+' has no height to size the model by');
    ['trim','plate'].forEach(k=>
      assert.match(r.skin[k], /^#[0-9a-f]{6}$/i, r.id+'’s '+k+' is not a colour'));
  });
  assert.ok(ROBOTS.LIST.length>=2, 'a pick screen needs something to pick between');
});

test('the two robots are different heights, which is the whole pick', ()=>{
  const h=ROBOTS.LIST.map(r=>r.height);
  assert.notEqual(h[0], h[1], 'both robots are the same size, so the choice means nothing');
});

test('an unknown robot is the first one on the list, not a crash', ()=>{
  assert.equal(ROBOTS.get('gundam').id, ROBOTS.LIST[0].id);
  assert.equal(ROBOTS.get(undefined).id, ROBOTS.LIST[0].id);
});

/* -------------------------------------------------------- the screens */
test('the pit no longer carries an editor of its own', ()=>{
  /* Two editors in front of one language is how they drift apart. */
  const src=read('public/pit.js');
  assert.ok(!/MECHACODE/.test(src), 'the pit still refers to the home-made language');
  assert.ok(!/pit_program/.test(src), 'the pit is still storing a program of its own');
});

test('the home-made language is gone, and nothing still reaches for it', ()=>{
  ['public/mechacode.js','public/bout.js'].forEach(f=>
    assert.ok(!fs.existsSync(P(f)), f+' is still here'));
  ['public/ring.js','public/pit.js','public/game.js','public/index.html'].forEach(f=>
    /* \bBOUT and not BOUT: the unanchored version matches the word
       "ABOUT" in a comment, which is a prose sentence and not a
       reference to anything. */
    assert.ok(!/MECHACODE|\bBOUT\.|bout\.js|mechacode\.js/.test(read(f)),
      f+' still refers to the language that was removed'));
});

test('the pit says the one thing that stops a student being stuck for a lesson', ()=>{
  /* A conditional on its own twitches once and stops. It is the single
     commonest Scratch bug there is and the mode is built around it, so
     the words are worth pinning down. */
  const src=read('public/pit.js');
  assert.match(src, /forever/i, 'the pit never mentions the loop');
  assert.match(src, /checked once/i,
    'the pit never explains why a bare conditional does not work');
});
