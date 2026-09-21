/* =====================================================================
   TURNING, IN THREE DIMENSIONS.

   A thing in a room can rotate three ways, and the language had blocks
   for two of them: `turn %n degrees` spun it left and right, `tilt %n
   degrees` tipped it forward and back, and rolling it over sideways was
   simply not expressible. Worse, neither block said what it was turning
   AROUND — a child who had just been taught that x, y and z are three
   directions was handed two rotation blocks that named none of them, and
   had to learn separately that "turn" secretly meant "about the up one".

   So there are two blocks now and they are different in kind:

     `point in direction (90)` is a FACING. One number, the conventional
     one — 90 is to the right, the same as a compass and the same as
     Scratch — and it is what somebody writing "make it look that way" is
     actually thinking. It sets the same angle `direction` reports and
     `point towards` writes, which is the only reason the three are worth
     having together.

     `turn [z] by (15) degrees` is a ROTATION, and it names its axis.
     It is the same three letters as `change ... by`, so the axis a
     student learnt for moving is the axis they use for spinning.

   What these hold: that both exist, that `tilt` is gone without taking
   anybody's saved work with it, and that a turn about each axis moves the
   angle it should — including the sign on y, which is the one that can be
   wrong in a way nobody notices until a robot rolls the wrong way.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

/* the same stub renderer the axis suite uses: enough to move numbers */
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
function world(saved){
  const ctx=vm.createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  ctx.THREE=stubTHREE();
  let clock=0;
  ctx.performance={ now:()=>(clock+=5) };
  const store={};
  if(saved) store['dq_code_project']=JSON.stringify(saved);
  ctx.localStorage={ getItem:k=>store[k]||null, setItem(k,v){store[k]=v;}, removeItem(k){delete store[k];} };
  ctx.G={ keys:{}, pos:{x:0,y:0,z:0}, hits:[], roomGroup:null };
  ['public/blocks.js','public/vm.js'].forEach(f=>
    vm.runInContext(read(f), ctx, { filename:f }));
  const VM=ctx.VM;
  VM.enter(new ctx.THREE.Group());
  if(saved) return { VM, BLOCKS:ctx.BLOCKS };
  VM.project.actors.slice().forEach(a=>VM.delActor(a));
  const a=VM.addActor({ name:'Bot', x:0, y:0, z:0 });
  const run=(op,args)=>{ VM.runBlock({op,args},a); for(let i=0;i<4;i++) VM.step(0.016); };
  const val=(op,args)=>VM.runBlock({op,args},a).value;
  return { VM, BLOCKS:ctx.BLOCKS, a, run, val };
}

/* ------------------------------------------------------ the two blocks */
test('there are two rotation blocks, and they are different in kind', ()=>{
  const { BLOCKS } = world();
  const turn=BLOCKS.of('motion.turn'), face=BLOCKS.of('motion.face');
  assert.ok(turn, 'there is no turn block');
  assert.ok(face, 'there is no point-in-direction block');
  assert.strictEqual(turn.label, 'turn %a by %n degrees',
    'the turn block does not name the axis it turns around');
  assert.strictEqual(face.label, 'point in direction %n',
    'the facing block is not the conventional one-number shape');
});

test('the turn block offers exactly the axes the rest of the language uses', ()=>{
  const { BLOCKS } = world();
  assert.deepStrictEqual(BLOCKS.of('motion.turn').args.a.opts,
                         BLOCKS.of('motion.changeBy').args.a.opts,
    'turning offers a different set of axes from moving, in the same language');
  assert.strictEqual(BLOCKS.of('motion.turn').args.a.def, 'z',
    'the default is not the everyday left-and-right one, which is up (z)');
});

test('tilt is gone from the palette', ()=>{
  const { BLOCKS } = world();
  assert.ok(!BLOCKS.of('motion.tilt'),
    'tilt is still on the shelf beside the block that replaced it');
  const inMotion=BLOCKS.inCat('motion').map(b=>b.op);
  assert.ok(!inMotion.includes('motion.tilt'), 'and still in the motion drawer');
  assert.ok(inMotion.includes('motion.face'), 'point in direction never made it onto the shelf');
});

test('every rotation block has a help line', ()=>{
  const { BLOCKS } = world();
  ['motion.turn','motion.face'].forEach(op=>{
    const h=BLOCKS.help(op);
    assert.ok(h && h.length>20, op+' has nothing to say when you hover it');
  });
  /* and the help has to name the axes, because the block's whole point is
     that rotation HAS one */
  assert.match(BLOCKS.help('motion.turn'), /\bx\b[\s\S]*\by\b|\by\b[\s\S]*\bx\b/,
    'the turn help never says what the three letters do');
});

/* ------------------------------------------------------------ what it does */
test('turning about z is the left-and-right spin turn always was', ()=>{
  const { a, run } = world();
  run('motion.turn',{ a:'z', n:90 });
  assert.strictEqual(a.dir, 90, 'turning about up did not change the facing');
  assert.strictEqual(a.tilt, 0, 'it tipped it as well');
  assert.strictEqual(a.roll, 0, 'it rolled it as well');
});

test('turning about x tips it, and about y rolls it', ()=>{
  const { a, run } = world();
  run('motion.turn',{ a:'x', n:30 });
  assert.strictEqual(a.tilt, 30, 'turning about across did not tip it');
  assert.strictEqual(a.dir, 0, 'and it changed the facing instead');
  run('motion.turn',{ a:'y', n:45 });
  assert.strictEqual(a.roll, 45, 'turning about into-the-screen did not roll it');
  assert.strictEqual(a.tilt, 30, 'and it disturbed the tip');
});

test('a turn saved before the block had an axis still turns the old way', ()=>{
  /* `turn 15 degrees` meant left-and-right and nothing else. A project
     saved with one arrives here with no axis in it at all, and it must not
     land on whichever letter happens to be first. */
  const { a, run } = world();
  run('motion.turn',{ n:15 });
  assert.strictEqual(a.dir, 15, 'an axis-less turn stopped meaning the facing');
  assert.strictEqual(a.tilt, 0);
  assert.strictEqual(a.roll, 0);
});

test('negative degrees go the other way, on every axis', ()=>{
  const { a, run } = world();
  ['x','y','z'].forEach(k=>run('motion.turn',{ a:k, n:40 }));
  ['x','y','z'].forEach(k=>run('motion.turn',{ a:k, n:-40 }));
  assert.deepStrictEqual([a.tilt,a.roll,a.dir],[0,0,0],
    'turning back by what you turned by did not return it');
});

test('point in direction sets the facing, and direction reads it back', ()=>{
  const { a, run, val } = world();
  run('motion.turn',{ a:'z', n:200 });
  run('motion.face',{ n:90 });
  assert.strictEqual(a.dir, 90, 'point in direction added instead of setting');
  assert.strictEqual(val('motion.dir'), 90,
    'the reporter disagrees with the block that just set it');
});

test('point in direction and point towards write the same angle', ()=>{
  /* If these two disagreed, "point towards him, then read the direction,
     then point in that direction again" would move the robot. */
  const { VM, a, run, val } = world();
  const foe=VM.addActor({ name:'Foe', x:3, y:0, z:0 });
  run('motion.point',{ o:'Foe' });
  const aimed=val('motion.dir');
  run('motion.face',{ n:0 });
  run('motion.face',{ n:aimed });
  assert.ok(Math.abs(a.dir-aimed)<1e-9,
    'the two ways of aiming do not agree on what the number means');
  VM.delActor(foe);
});

test('a facing of 90 is to the right, the way a child expects', ()=>{
  /* The conventional bit of "conventional". move follows the facing, so
     this is checked by walking rather than by reading the number back. */
  const { a, run } = world();
  run('motion.face',{ n:90 });
  run('motion.move',{ n:10 });
  assert.ok(a.x > 0.9, 'facing 90 and walking did not go right (x='+a.x+')');
  assert.ok(Math.abs(a.z) < 1e-9, 'it drifted along the other axis too');
});

/* ------------------------------------------------- the engine underneath */
test('roll turns about the language y, which is the engine z reversed', ()=>{
  /* THE ONE SIGN THAT CAN BE QUIETLY WRONG. The language's y points into
     the screen and the engine's z points out of it, so a positive roll
     has to come out negative in the mesh — the same flip `change y by`
     already does for position. Getting this backwards gives a robot that
     rolls the opposite way from the arrow drawn on its own floor. */
  const { a, run } = world();
  run('motion.turn',{ a:'y', n:90 });
  assert.strictEqual(a.roll, 90, 'the angle itself should be plain positive');
  assert.ok(a.mesh.rotation.z < 0,
    'a positive roll about y came out positive about the engine z');
  assert.ok(Math.abs(a.mesh.rotation.z + Math.PI/2) < 1e-9,
    'the roll did not reach the mesh at the size it was given');
  /* and the other two are not flipped, because their axes are not */
  run('motion.turn',{ a:'x', n:90 });
  run('motion.turn',{ a:'z', n:90 });
  assert.ok(a.mesh.rotation.x > 0, 'tilt came out backwards');
  assert.ok(a.mesh.rotation.y > 0, 'the facing came out backwards');
});

test('roll is part of an object, so putting it back puts it back', ()=>{
  const { VM, a, run } = world();
  run('motion.turn',{ a:'y', n:70 });
  assert.strictEqual(a.roll, 70);
  VM.resetActor(a);
  assert.strictEqual(a.roll, 0, 'reset left the object lying on its side');
});

test('a clone carries the roll it was cloned from', ()=>{
  const src=bare(read('public/vm.js'));
  const clone=/case 'ctrl\.clone':[\s\S]*?addActor\(\{[\s\S]*?\}\);/.exec(src);
  assert.ok(clone, 'the clone block no longer builds its copy where this can see it');
  assert.match(clone[0], /roll:a\.roll/,
    'a clone of a rolled object stands up straight again');
});

/* ------------------------------------------------------ saved work */
test('a project saved with tilt opens as a turn about x', ()=>{
  /* The block was renamed, not removed. Somebody's script must not open
     with a hole in it where the editor cannot find a block by that name. */
  const saved={ actors:[{ id:1, name:'Bot', shape:'cube', colour:'#fff',
    x:0,y:0,z:0, dir:0, tilt:0, size:1, visible:true, vars:{},
    scripts:[{ hat:{op:'event.flag',args:{}}, body:[
      { op:'ctrl.forever', args:{}, body:[ { op:'motion.tilt', args:{ n:7 } } ] } ] }] }],
    vars:{}, lists:{}, procs:[], msgs:['message1'], uid:2, stage:'world' };
  const { VM, BLOCKS } = world(saved);
  const body=VM.project.actors[0].scripts[0].body[0].body[0];
  assert.strictEqual(body.op, 'motion.turn', 'the old block was left as it was');
  assert.strictEqual(body.args.a, 'x', 'it did not land on the axis tilt meant');
  assert.strictEqual(body.args.n, 7, 'it lost the number the student typed');
  assert.ok(BLOCKS.of(body.op), 'and the editor still cannot draw it');
});

test('the old tilt op still runs, for a project that never came through load', ()=>{
  /* A game opened out of the arcade is handed over as JSON from the
     server. The rewrite covers that path too, but the interpreter keeping
     the case costs two lines and means no route into the VM can hit a
     block it refuses to execute. */
  const src=bare(read('public/vm.js'));
  assert.match(src, /case 'motion\.tilt':/,
    'an old saved script would now silently skip its own rotation');
  const { a, run } = world();
  run('motion.tilt',{ n:12 });
  assert.strictEqual(a.tilt, 12, 'and it no longer does what it used to');
});

test('the rewrite is safe to run over a project twice', ()=>{
  const src=bare(read('public/vm.js'));
  const fn=/function freshen\(list\)\{[\s\S]*?\n  \}/.exec(src);
  assert.ok(fn, 'the rewrite is no longer where this can find it');
  /* it rewrites by op name, so a second pass finds nothing to do — the
     guard is that it only ever matches the OLD name */
  assert.match(fn[0], /MOVED\[bk\.op\]/, 'it no longer keys off the block name');
  assert.ok(!/motion\.turn.*=>.*motion\./.test(src.slice(src.indexOf('const MOVED'), src.indexOf('const MOVED')+240)),
    'the new name is itself a rewrite target, which would loop');
});
