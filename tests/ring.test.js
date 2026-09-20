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

test('the blocks that need a second object are on, and the second object exists', ()=>{
  /* THIS TEST USED TO SAY THE OPPOSITE. `touching?`, `distance to` and
     `%a of %o` all take another object, and with one robot in the room
     they could only ever answer about nothing — a sensing block that is
     always false is worse than one that is missing. Attacks changed the
     premise: there is a training dummy now, so they earn their place.
     The pairing is what matters, and it goes both ways — if an
     object-taking block is on the palette, the ring must build something
     for it to point at. */
  const on=new Set(palette().ops);
  const needObj=BLOCKS.LIST.filter(b=>on.has(b.op) &&
    Object.keys(b.args||{}).some(k=>b.args[k].type==='obj'));
  if(!needObj.length) return;
  const src=read('public/ring.js');
  assert.match(src, /function ensureDummy\(/,
    needObj.map(b=>b.op).join(', ')+' need a second object and the ring builds none');
  assert.match(src, /ensureDummy\(\);/, 'the dummy is defined and never built');
  assert.match(src, /TEMPLATES\.DUMMY|T\.DUMMY/,
    'the dummy has no agreed name, so no dropdown can point at it');
});

test('the dummy is a plain shape, not a rigged model', ()=>{
  /* Rigged costumes do not instance (see costumes.js). The robot works
     around that with its own loader; a training post does not need to,
     and must not quietly acquire the same bug. */
  const src=read('public/ring.js');
  const fn=src.slice(src.indexOf('function ensureDummy('), src.indexOf('function install('));
  assert.match(fn, /shape:'(cube|ball|cylinder|cone)'/,
    'the dummy wears a model costume, which cannot instance correctly');
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
   These are worked examples a student takes apart, so the thing to
   guard is that they are made of blocks the student actually HAS —
   a template reaching for a block that is not on the palette is a
   worked example that cannot be edited, which is worse than none. */
function opsIn(t){
  const out=[];
  (function walk(x){
    if(!x || typeof x!=='object') return;
    if(Array.isArray(x)) return x.forEach(walk);
    if(x.op) out.push(x.op);
    Object.keys(x).forEach(k=>walk(x[k]));
  })([t.procs, t.scripts]);
  return out;
}

test('every template is built only out of blocks that are on the palette', ()=>{
  const on=new Set(palette().ops);
  TEMPLATES.LIST.forEach(t=>{
    opsIn(t).forEach(op=>assert.ok(on.has(op),
      t.id+' uses '+op+', which the student has not got \u2014 they could not have written it, and cannot edit it'));
  });
});

test('every block a template uses is a real block, with the args it really takes', ()=>{
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
    })([t.procs, t.scripts]);
  });
});

test('a template that sets a variable declares it, so the dropdown can find it', ()=>{
  TEMPLATES.LIST.forEach(t=>{
    const declared=new Set(t.vars||[]);
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if((x.op==='data.set'||x.op==='data.change'||x.op==='data.get') && x.args && x.args.v)
        assert.ok(declared.has(x.args.v),
          t.id+' uses the variable "'+x.args.v+'" and does not declare it in `vars`');
      Object.keys(x).forEach(k=>walk(x[k]));
    })([t.procs, t.scripts]);
  });
});

test('a template that calls a custom block defines it', ()=>{
  TEMPLATES.LIST.forEach(t=>{
    const defined=new Set((t.procs||[]).map(p=>p.name));
    opsIn(t); // walk for my.call specifically
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(x.op==='my.call' && x.args && x.args.p)
        assert.ok(defined.has(x.args.p),
          t.id+' calls "'+x.args.p+'" and never defines it');
      Object.keys(x).forEach(k=>walk(x[k]));
    })([t.procs, t.scripts]);
  });
});

test('every broadcast a template sends is one something listens for', ()=>{
  /* A message nobody receives is the quietest bug there is. */
  const sent=new Set(), heard=new Set();
  const scan=(t, into)=>{
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(x.op==='event.send' && x.args) sent.add(x.args.m);
      if(x.op==='event.recv' && x.args) heard.add(x.args.m);
      Object.keys(x).forEach(k=>walk(x[k]));
    })(into);
  };
  TEMPLATES.LIST.forEach(t=>scan(t,[t.procs,t.scripts]));
  scan(null, TEMPLATES.dummyScripts());
  sent.forEach(m=>assert.ok(heard.has(m),
    'something broadcasts "'+m+'" and nothing anywhere receives it'));
  heard.forEach(m=>assert.ok(sent.has(m),
    'something waits for "'+m+'" and nothing ever sends it'));
});

test('nothing the dummy does to itself moves it permanently', ()=>{
  /* IT WALKED AWAY. The flinch was `change x by 1.5` and nothing to undo
     it, so every landed punch shoved the dummy further off and it never
     came back — twenty punches into a lesson it was past the end of the
     floor and unreachable. Any axis a script nudges has to net to zero
     across the script, or the target leaves. */
  const net={};
  (function walk(x){
    if(!x || typeof x!=='object') return;
    if(Array.isArray(x)) return x.forEach(walk);
    if(x.op==='motion.changeBy' && x.args)
      net[x.args.a]=(net[x.args.a]||0)+Number(x.args.n||0);
    Object.keys(x).forEach(k=>walk(x[k]));
  })(TEMPLATES.dummyScripts());
  Object.keys(net).forEach(axis=>assert.ok(Math.abs(net[axis])<1e-9,
    'the dummy\'s own scripts move it '+net[axis]+' along '+axis+
    ' every time — it will walk off the floor'));
});

test('the dummy starts within reach of the punch as shipped', ()=>{
  /* "I ticked PUNCH, pressed space and nothing happened" is a terrible
     first five seconds. The lunge is repeat × step and the reach is the
     number in the `if`; between them they have to cover the gap from the
     robot's own start mark. */
  const t=TEMPLATES.byId('punch');
  const body=t.procs[0].body;
  const rep=body.find(b=>b.op==='ctrl.repeat');
  const lunge=Number(rep.args.n)*Math.abs(Number(rep.body[0].args.n));
  const reach=Number(body.find(b=>b.op==='ctrl.if').args.c.args.b);
  const src=read('public/ring.js');
  const at=Number((src.match(/d\.x=(\d+(?:\.\d+)?); d\.y=/)||[])[1]);
  assert.ok(isFinite(at), 'the dummy has no start mark to check against');
  assert.ok(lunge+reach >= at,
    'the dummy stands at '+at+' and the shipped punch only covers '+
    (lunge+reach)+' (lunge '+lunge+' + reach '+reach+') \u2014 the first press will miss');
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

test('the templates that only SET state come with the one that reads it', ()=>{
  /* `guard` and `dodging` do nothing on their own. If nothing on the
     list ever reads them back, blocking looks broken and the student is
     right to think so. */
  const writes=new Set(), reads=new Set();
  TEMPLATES.LIST.forEach(t=>{
    (function walk(x){
      if(!x || typeof x!=='object') return;
      if(Array.isArray(x)) return x.forEach(walk);
      if(x.op==='data.set' && x.args) writes.add(x.args.v);
      if(x.op==='data.get' && x.args) reads.add(x.args.v);
      Object.keys(x).forEach(k=>walk(x[k]));
    })([t.procs, t.scripts]);
  });
  ['guard','dodging'].forEach(v=>{
    assert.ok(writes.has(v), 'nothing sets '+v);
    assert.ok(reads.has(v),  v+' is set by a template and read by none of them');
  });
});

test('the dummy swings at you, or blocking has nothing to block', ()=>{
  const ds=TEMPLATES.dummyScripts();
  assert.ok(ds.length>0, 'the dummy comes with no scripts at all');
  const ops=[];
  (function walk(x){
    if(!x || typeof x!=='object') return;
    if(Array.isArray(x)) return x.forEach(walk);
    if(x.op) ops.push(x.op);
    Object.keys(x).forEach(k=>walk(x[k]));
  })(ds);
  assert.ok(ops.indexOf('event.send')>=0, 'the dummy never swings');
  assert.ok(ops.indexOf('event.recv')>=0, 'the dummy never notices being hit');
  const on=new Set(palette().ops);
  ops.forEach(op=>assert.ok(on.has(op),
    'the dummy uses '+op+', which is not on the palette \u2014 a student could not edit its scripts'));
});

/* --------------------------------------------------------- the bodies */
test('each robot names a model file that is really there', ()=>{
  ROBOTS.LIST.forEach(r=>{
    assert.ok(fs.existsSync(P(path.join('public', r.model))),
      r.id+' names '+r.model+', which is not there');
  });
});

test('the ring loads its own bodies, and says why', ()=>{
  /* COSTUMES cannot instance a rigged model — Object3D.clone() leaves the
     copy bound to the PROTOTYPE's skeleton, so the body is drawn where
     those bones are and ignores the clone's transform. Until that is
     fixed the ring loads its robots itself, and the reason has to stay
     written down or somebody will "tidy" it back onto the costume
     system and spend an afternoon on it. */
  const src=read('public/ring.js');
  assert.match(src, /GLTFLoader/, 'the ring does not load a model at all');
  assert.match(src, /skeleton/i, 'the ring does not say why it loads its own body');
  const cos=read('public/costumes.js');
  assert.match(cos, /skeleton/i,
    'costumes.js does not warn that rigged costumes do not instance');
  assert.ok(!/id:'robots'/.test(cos),
    'the robots shelf is back, and it cannot work until the clone is fixed');
});

test('the model is scaled by multiplying, never by setting', ()=>{
  /* These exports carry a scale of their own — a hundredth, being
     authored in centimetres — and the height is measured AFTER it.
     setScalar throws that hundredth away and leaves a four-metre robot
     four hundred and sixty metres tall, which from the floor looks
     exactly like a robot that failed to load. */
  const src=read('public/ring.js');
  assert.match(src, /r\.scale\.multiplyScalar\(/,
    'the ring does not multiply the model scale');
  assert.ok(!/r\.scale\.setScalar\(/.test(src),
    'the ring sets the model scale, which discards the export\'s own');
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
