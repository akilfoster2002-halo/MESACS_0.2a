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

test('the move block moves on all three axes', ()=>{
  /* Up and down has to be as reachable as left and right, and in Scratch
     that is one block with a dropdown rather than three blocks. */
  const b=BLOCKS.LIST.find(x=>x.op==='motion.changeBy');
  assert.ok(b, 'there is no change-by block');
  assert.deepEqual(b.args.a.opts, ['x','y','z']);
});

test('the sensing block is a boolean, so it fits inside the conditional', ()=>{
  const key=BLOCKS.LIST.find(b=>b.op==='sense.key');
  const iff=BLOCKS.LIST.find(b=>b.op==='ctrl.if');
  assert.equal(key.kind, 'bool', 'key-pressed? is not a boolean and will not drop into an if');
  assert.equal(iff.args.c.type, 'bool', 'if has no boolean slot to drop it into');
});

test('the boolean operators are there, for holding two keys at once', ()=>{
  const pal=palette();
  ['op.and','op.or','op.not'].forEach(op=>
    assert.ok(pal.ops.indexOf(op)>=0, op+' is missing'));
  ['op.and','op.or'].forEach(op=>{
    const b=BLOCKS.LIST.find(x=>x.op===op);
    assert.equal(b.kind,'bool');
    Object.keys(b.args).forEach(k=>assert.equal(b.args[k].type,'bool'));
  });
});

/* --------------------------------------------------- nothing is free */
test('the ring hard-codes no movement of its own', ()=>{
  /* If this fails, somebody has added a convenience control and quietly
     removed the reason to write a script at all. The robot moves because
     a block moved it, or it does not move. */
  const body=read('public/ring.js').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/G\.keys/.test(body),
    'ring.js reads the keyboard itself — the blocks are supposed to do that');
  assert.ok(!/ArrowLeft|ArrowRight|KeyA\b|KeyD\b/.test(body),
    'ring.js names a movement key, so something is bound outside the blocks');
});

test('the ring steps the VM itself, because the game loop only does it in Free Play', ()=>{
  const src=read('public/ring.js');
  assert.match(src, /VM\.step\(dt\)/, 'nothing steps the VM, so no script will ever run');
  assert.match(src, /VM\.useSlot\(/, 'the ring does not say which project to open');
  assert.match(src, /VM\.enter\(/,   'the ring never mounts the VM into its room');
  assert.match(read('public/game.js'), /RING\.active\) RING\.tick\(dt\)/,
    'the game loop never ticks the ring');
});

test('the ring gives the whole palette back when you leave', ()=>{
  /* restrict() is global to the editor, so a ring that does not undo it
     leaves Free Play with five categories and a handful of blocks. */
  assert.match(read('public/ring.js'), /CODER\.restrict\(null\)/,
    'leaving the ring never hands the full palette back');
});

test('C opens the editor in the ring, not only in Free Play', ()=>{
  assert.match(read('public/game.js'), /RING\.active && window\.CODER/,
    'the ring has an editor and no key that opens it');
});

test('the ring keeps its scripts in its own slot, not the Free Play sandbox', ()=>{
  const src=read('public/ring.js');
  const m=src.match(/const SLOT='([^']+)'/);
  assert.ok(m, 'the ring names no project slot');
  assert.notEqual(m[1], 'dq_sandbox', 'the ring would overwrite Free Play');
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
