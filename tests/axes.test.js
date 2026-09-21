/* =====================================================================
   THE THREE AXES, under test.

   The language names its directions for what a student can point at:
   x runs across the screen, y goes into it and back out, z is up. The
   engine underneath is Three.js, which is Y-up and is not going to stop
   being Y-up — so the language's y lives in the engine's z and its z in
   the engine's y, and exactly one line does the swapping.

   What these guard is that the line is the ONLY one. A block that reads
   a coordinate the engine's way while another writes it the language's
   way is a bug that looks like physics: things drift sideways when they
   should rise, and nothing anywhere says why. So: every block that names
   an axis is checked against the engine field it should land in, and the
   arrows drawn on the floor are checked against the same table the
   blocks compile from.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');

/* vm.js wants a renderer. It gets enough of one to move numbers around. */
function stubTHREE(){
  class Obj {
    constructor(){ this.children=[]; this.parent=null; this.userData={};
      this.visible=true;
      const v=()=>({x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}});
      this.position=v(); this.rotation=v(); this.scale=v(); }
    add(c){ c.parent=this; this.children.push(c); return this; }
    remove(c){ this.children=this.children.filter(x=>x!==c); c.parent=null; return this; }
    traverse(f){ f(this); this.children.forEach(c=>c.traverse(f)); }
  }
  function Any(){}
  return { Group:Obj, Mesh:Obj, Object3D:Obj,
    BoxGeometry:Any, SphereGeometry:Any, ConeGeometry:Any, CylinderGeometry:Any,
    MeshLambertMaterial:Any, MeshBasicMaterial:Any, Color:Any, Fog:Any,
    AmbientLight:Obj, DirectionalLight:Obj,
    Vector3:function(){ this.x=this.y=this.z=0; this.set=()=>this; } };
}
function world(){
  const ctx=vm.createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  ctx.THREE=stubTHREE();
  /* A CLOCK THAT ONLY MOVES WHEN ASKED. glide is written against real
     elapsed time, so on a wall clock a test either sleeps or races; here
     every reading is 5ms after the last one and the glide lands in two
     passes, the same two passes every run. */
  let clock=0;
  ctx.performance={ now:()=>(clock+=5) };
  ctx.localStorage={ getItem:()=>null, setItem(){}, removeItem(){} };
  ctx.G={ keys:{}, pos:{x:0,y:0,z:0}, hits:[], roomGroup:null };
  ['public/blocks.js','public/vm.js'].forEach(f=>
    vm.runInContext(read(f), ctx, { filename:f }));
  const VM=ctx.VM;
  VM.enter(new ctx.THREE.Group());
  VM.project.actors.slice().forEach(a=>VM.delActor(a));
  const a=VM.addActor({ name:'Bot', x:0, y:0, z:0 });
  /* a stack block joins the scheduler rather than running on the spot */
  const run=(op,args)=>{ VM.runBlock({op,args},a); for(let i=0;i<4;i++) VM.step(0.016); };
  const val=(op,args)=>VM.runBlock({op,args},a).value;
  return { VM, BLOCKS:ctx.BLOCKS, a, run, val };
}

/* ==================================================================== */
test('x is across, y is into the screen, z is up', ()=>{
  /* THE ROOM'S CAMERA STANDS OUT ALONG THE ENGINE'S +z, so "into the
     screen" is the engine's MINUS z. Without the sign, `change y by 1`
     came towards the viewer — the opposite of what the block says. */
  const { a, run } = world();
  run('motion.changeBy',{ a:'x', n:2 });
  assert.deepStrictEqual([a.x,a.y,a.z], [2,0,0], 'x should be the engine\'s x');
  run('motion.changeBy',{ a:'y', n:3 });
  assert.deepStrictEqual([a.x,a.y,a.z], [2,0,-3],
    'a positive y should go INTO the screen, which is the engine\'s -z');
  run('motion.changeBy',{ a:'z', n:4 });
  assert.deepStrictEqual([a.x,a.y,a.z], [2,4,-3], 'z should be the engine\'s y — up');
});

test('a coordinate reads back the way it was written', ()=>{
  /* The sign has to be on reads as well as writes. Applied to only one
     of them, `y position` reports the negative of where the robot is and
     a student comparing it with the number they just moved by is told
     they went the wrong way. */
  const { run, val } = world();
  run('motion.changeBy',{ a:'y', n:5 });
  assert.strictEqual(val('motion.pos',{a:'y'}), 5, 'moved +5 and y position says otherwise');
  run('motion.changeBy',{ a:'y', n:-8 });
  assert.strictEqual(val('motion.pos',{a:'y'}), -3);
  run('motion.setTo',{ a:'y', n:10 });
  assert.strictEqual(val('motion.pos',{a:'y'}), 10, 'set y to 10 and y position does not say 10');
});

test('go to and set put a coordinate where change by would have moved it', ()=>{
  const { a, run } = world();
  run('motion.goto',{ x:1, y:2, z:3 });
  assert.deepStrictEqual([a.x,a.y,a.z], [1,3,-2], 'go to disagrees with change by');
  run('motion.setTo',{ a:'z', n:9 });
  assert.strictEqual(a.y, 9, 'set z to did not set the height');
  run('motion.setTo',{ a:'y', n:8 });
  assert.strictEqual(a.z, -8, 'set y to did not send it into the screen');
});

test('a position reporter reads back exactly what moved the object', ()=>{
  const { run, val } = world();
  run('motion.goto',{ x:4, y:5, z:6 });
  assert.strictEqual(val('motion.pos',{a:'x'}), 4);
  assert.strictEqual(val('motion.pos',{a:'y'}), 5, 'y position is not the y you moved along');
  assert.strictEqual(val('motion.pos',{a:'z'}), 6, 'z position is not the z you moved along');
});

test('glide arrives exactly where go to would have', ()=>{
  const { a, VM, run } = world();
  VM.runBlock({ op:'motion.glide', args:{ t:0.01, x:2, y:3, z:4 } }, a);
  for(let i=0;i<40;i++) VM.step(0.05);
  assert.deepStrictEqual([a.x,a.y,a.z].map(n=>+n.toFixed(3)), [2,4,-3],
    'glide and go to do not land in the same place');
});

test('the blocks that work on the floor never name an axis, so none is swapped', ()=>{
  /* move/point/distance are arithmetic on the ground plane. If one of them
     ever starts naming an axis it has to go through the same map, and this
     is the reminder. */
  const src=read('public/vm.js');
  const body=op=>{
    const i=src.indexOf("case '"+op+"'"); assert.ok(i>0, 'no '+op);
    return src.slice(i, src.indexOf("case '", i+10));
  };
  ['motion.move','motion.point'].forEach(op=>
    assert.ok(!/g\('a'\)/.test(body(op)), op+' names an axis and must use ax()'));
  /* and the ones that DO name an axis go through the signed pair, not
     the bare field — a read that skips the sign reports the negative */
  ['motion.changeBy','motion.setTo'].forEach(op=>
    assert.match(body(op), /place\(a,/,
      op+' writes a coordinate without going through the signed map'));
  ['motion.pos','sense.posOf'].forEach(op=>
    assert.match(body(op), /coord\(/,
      op+' reads a coordinate without going through the signed map'));
});

test('the arrows on the floor are drawn from the same table the blocks compile from', ()=>{
  const { BLOCKS } = world();
  const ring=read('public/ring.js');
  assert.match(ring, /BLOCKS\.AXES/,
    'the ring draws its axis arrows from something other than the language');
  /* every axis is accounted for, each in its own engine field and its own
     colour, or two arrows point the same way */
  const fields=BLOCKS.AXES.map(a=>a.field);
  assert.deepStrictEqual([...new Set(fields)].sort(), ['x','y','z'],
    'two axes share an engine field, so an arrow points the wrong way');
  assert.strictEqual(new Set(BLOCKS.AXES.map(a=>a.hue)).size, 3,
    'two axes are the same colour');
  BLOCKS.AXES.forEach(a=>assert.ok(a.say && a.v, a.v+' has nothing to say about itself'));
  assert.strictEqual(BLOCKS.axisField('y'), 'z', 'y is no longer into the screen');
  assert.strictEqual(BLOCKS.axisField('z'), 'y', 'z is no longer up');
  assert.strictEqual(BLOCKS.axisField('nonsense'), 'x', 'a junk axis should read as x, not crash');
});

test('every axis dropdown offers the three the language actually has', ()=>{
  const { BLOCKS } = world();
  const names=BLOCKS.AXES.map(a=>a.v);
  BLOCKS.LIST.forEach(bd=>Object.entries(bd.args||{}).forEach(([k,sp])=>{
    if(sp.type!=='pick' || !sp.opts) return;
    if(sp.opts.indexOf('x')<0) return;              // not an axis picker
    assert.deepStrictEqual(sp.opts, names,
      bd.op+' %'+k+' offers axes the language does not have');
  }));
});

test('the help no longer tells a student that y is up', ()=>{
  const { BLOCKS } = world();
  const all=BLOCKS.LIST.map(b=>BLOCKS.help(b.op)).join(' ');
  assert.ok(!/y is up|'change y by 1' lifts/.test(all),
    'a help line still describes the old axes');
  assert.match(BLOCKS.help('motion.goto'), /y is into the screen/,
    'go to never says which way y goes, which is the only place it is written down');
});
