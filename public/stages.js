/* =====================================================================
   STAGES — the road into the ring.

   THE RING USED TO OPEN ON A FIGHT. A student who had never written a
   block stood in front of an opponent that walks, closes and punches,
   with sixty blocks on the palette and no idea which of them was the
   one that moved anything. The first thing that happens to you should
   not be losing to a program you cannot read yet.

   So the ring is five rooms now, and they are the same room. Each one
   opens exactly the blocks its idea needs, says what it wants in one
   sentence, and watches the world to find out whether it happened.
   Nothing is unlocked by clicking through — the only way past a stage
   is a program that does the thing.

   THE ARC, and why it is in this order:

     1  MOVE       a conditional inside a loop is a control
     2  CLOSE IN   a sensor is a number you can read
     3  SWING      there is no punch block; you raise a flag
     4  AFFORD IT  check what it costs before you spend it
     5  THE FIGHT  all of it at once, against something that fights back

   Every one of those is a thing a student is otherwise told and does
   not believe. Stage 1 is the twitch: an `if` under the hat instead of
   inside the loop moves the robot for exactly one frame, and no amount
   of explaining lands like watching it happen and then watching the
   loop fix it.

   THE PALETTES ARE CUMULATIVE. Stage 2 is stage 1 plus a sensor, not a
   different set — a student's movement script has to keep working, and
   blocks disappearing out from under a program they already wrote is
   the opposite of the lesson.

   WHAT COUNTS AS DONE IS WATCHED, NOT ASKED. Each test reads the world
   or the student's own script tree. There is no "click here when you
   have finished", because the point of a test is that it can fail.

   No DOM. Node loads this too, because the tests read it.
   ===================================================================== */
(function(root){

  const RULES = (typeof require==='function' && typeof module!=='undefined')
    ? require('./rules.js') : root.RULES;
  const reach = () => (RULES && RULES.RULES ? RULES.RULES.moves.light.reach : 6.5);

  /* --------------------------------------------------- reading a script
     A stage sometimes needs to know what a student WROTE and not only
     what their robot did — "your script reads (stamina)" is a fact about
     the program, and a robot that happens to have enough stamina is not
     evidence of it. These walk the block tree the same way the VM runs
     it: arguments can hold blocks, and C-blocks have bodies. */
  function walk(node, fn){
    if(!node || typeof node!=='object') return;
    if(Array.isArray(node)) return node.forEach(n=>walk(n,fn));
    if(node.op) fn(node);
    Object.values(node.args||{}).forEach(v=>walk(v,fn));
    walk(node.body, fn); walk(node.body2, fn);
  }
  /* every block in every script on an actor, hats included */
  function blocks(actor){
    const out=[];
    ((actor||{}).scripts||[]).forEach(sc=>{ walk(sc.hat,b=>out.push(b)); walk(sc.body,b=>out.push(b)); });
    return out;
  }
  const uses = (actor, op) => blocks(actor).some(b=>b.op===op);
  /* A variable is READ by `(name)` and WRITTEN by `set`/`change`. The
     difference matters: stage 4 wants a student who LOOKED at stamina. */
  const reads = (actor, name) =>
    blocks(actor).some(b=>b.op==='data.get' && String(b.args&&b.args.v)===name);
  const writes = (actor, name) =>
    blocks(actor).some(b=>(b.op==='data.set'||b.op==='data.change') &&
                          String(b.args&&b.args.v)===name);
  /* Is any block of this op somewhere INSIDE a block of that one? The
     shape stage 1 is really about — though stage 1 does not ask, because
     watching the robot is the better question. Kept for the card. */
  function within(actor, outer, inner){
    let found=false;
    ((actor||{}).scripts||[]).forEach(sc=>walk(sc.body,b=>{
      if(b.op!==outer) return;
      walk(b.body,  x=>{ if(x.op===inner) found=true; });
      walk(b.body2, x=>{ if(x.op===inner) found=true; });
    }));
    return found;
  }

  /* ------------------------------------------------------- the palettes
     Written as what each stage ADDS, and stacked below, so a stage can
     be read as its one idea rather than as a list of forty ops. */
  const ADDS = {
    move: { cats:['events','control','motion','sensing'],
            ops:['event.flag','ctrl.forever','ctrl.if','sense.key','motion.changeBy'] },
    near: { cats:['looks'],
            ops:['sense.dist','looks.say','looks.sayFor','motion.pos','sense.posOf'] },
    hit:  { cats:['data'],
            ops:['event.key','data.set','data.get','data.change','sense.touch'] },
    spend:{ cats:['ops'],
            ops:['ctrl.ifelse','ctrl.wait','op.gt','op.lt','op.and','op.or','op.not'] },
    all:  { cats:['my'],
            ops:['event.send','event.recv','ctrl.repeat','ctrl.repeatUntil','ctrl.waitUntil',
                 'ctrl.stop','motion.move','motion.turn','motion.setTo','motion.goto',
                 'motion.glide','motion.dir','sense.timer','sense.resetTimer',
                 'op.add','op.sub','op.eq','op.random','my.call'] }
  };

  const LIST = [
    /* ------------------------------------------------------------- 1 */
    { id:'move', n:1, em:'🕹', a:'#8fd3ff',
      name:'MAKE IT MOVE',
      teach:'A conditional inside a loop',
      goal:'Drive your robot left and right with two keys.',
      /* THE PARAGRAPH ON THE CARD. Written to be read once, before the
         student has done anything, and to be the thing they remember
         when it goes wrong — which it will, in exactly this way. */
      why:'An `if` on its own is checked ONCE, on the frame you pressed Run, '+
          'and then never again. Your robot will twitch a single step and '+
          'stop. Put it inside a `forever` and the same question gets asked '+
          'sixty times a second — which is what turns a test into a control.',
      foe:'none',
      add:['move'],
      tests:[
        { say:'it keeps going right while you hold a key', done:c=>c.frames.right>=8 },
        { say:'and left while you hold another',           done:c=>c.frames.left >=8 }
      ] },

    /* ------------------------------------------------------------- 2 */
    { id:'near', n:2, em:'📏', a:'#a8e6cf',
      name:'CLOSE IN',
      teach:'A sensor is a number you can read',
      goal:'Walk up to Ambush and say how far away he is.',
      why:'`distance to [Ambush]` is not a thing that happens — it is a '+
          'NUMBER, and you can drop it into anything that takes one. Put it '+
          'in a `say` and the robot tells you what it can feel. That number '+
          'is the same one every strategy in here is eventually built on.',
      foe:'dummy',
      add:['move','near'],
      tests:[
        { say:'your script reads (distance to Ambush)', done:c=>c.uses('sense.dist') },
        { say:'the robot says something while it runs', done:c=>c.said },
        { say:'and you got within a punch of him',      done:c=>c.gapMin<=reach() }
      ] },

    /* ------------------------------------------------------------- 3 */
    { id:'hit', n:3, em:'🥊', a:'#ffb4a2',
      name:'THROW ONE',
      teach:'There is no punch block',
      goal:'Land a punch on Ambush.',
      why:'There is no PUNCH block and there is not going to be one. A punch '+
          'is you raising a flag — `set [light] to 1` — and the referee '+
          'seeing it, charging you for it, and working out whether you were '+
          'close enough. Your program asks. Something outside it decides.',
      foe:'dummy',
      add:['move','near','hit'],
      tests:[
        { say:'your script sets (light)',  done:c=>c.writes('light') },
        { say:'and a punch landed on him', done:c=>c.swings.landed>=1 }
      ] },

    /* ------------------------------------------------------------- 4 */
    { id:'spend', n:4, em:'🔋', a:'#ffd8a8',
      name:'AFFORD IT',
      teach:'Check before you spend',
      goal:'Land three punches in one run without ever asking for one you cannot afford.',
      why:'A swing you cannot pay for does not happen AT ALL — and the half '+
          'second you spent asking is gone anyway. `(stamina)` is a number '+
          'the referee writes and you can read. Look at it before you swing, '+
          'and you stop throwing punches into an empty tank.',
      foe:'dummy',
      add:['move','near','hit','spend'],
      tests:[
        { say:'your script reads (stamina)',          done:c=>c.reads('stamina') },
        { say:'three punches landed this run',        done:c=>c.swings.landed>=3 },
        { say:'and none were thrown on an empty tank',done:c=>c.swings.broke===0 }
      ] },

    /* ------------------------------------------------------------- 5 */
    { id:'fight', n:5, em:'🏆', a:'#cdb4f6',
      name:'THE FIGHT',
      teach:'All of it, against something that fights back',
      goal:'Knock Ambush out.',
      why:'He moves now, and his code is on the palette for you to read — '+
          'select AMBUSH in the editor and take his strategy apart. He closes '+
          'when he is far, swings heavy when he can afford it and light when '+
          'he cannot, and backs off with an empty tank. Beat that.',
      foe:'live',
      add:['move','near','hit','spend','all'],
      tests:[
        { say:'Ambush is down', done:c=>c.won }
      ] }
  ];

  /* The palette a stage hands over: everything it adds, and everything
     every stage before it added. Deduped, order kept, so the palette a
     student sees only ever grows. */
  function palette(stage){
    const s=byIndex(stage);
    const cats=[], ops=[];
    (s.add||[]).forEach(k=>{
      const a=ADDS[k]; if(!a) return;
      a.cats.forEach(c=>{ if(cats.indexOf(c)<0) cats.push(c); });
      a.ops .forEach(o=>{ if(ops .indexOf(o)<0) ops .push(o); });
    });
    return { cats, ops };
  }

  const byIndex = i => LIST[Math.max(0, Math.min(LIST.length-1, i|0))];
  const byId    = id => LIST.find(s=>s.id===id) || null;
  const LAST    = LIST.length-1;

  /* Which tests pass right now, as a list the card can draw straight. */
  function progress(stage, ctx){
    return byIndex(stage).tests.map(t=>({ say:t.say, ok:!!safe(t.done, ctx) }));
  }
  const done = (stage, ctx) => progress(stage, ctx).every(t=>t.ok);
  /* A test reads a half-built world every frame. One that throws is a
     test that has not happened yet, not a crash. */
  function safe(fn, ctx){ try{ return fn(ctx); }catch(e){ return false; } }

  const API={ LIST, ADDS, byIndex, byId, LAST, palette, progress, done,
              blocks, uses, reads, writes, within, walk };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.STAGES=API;
})(typeof self!=='undefined' ? self : this);
