/* =====================================================================
   STAGES — the road into the ring, one step at a time.

   THE RING USED TO OPEN ON A FIGHT, then on a card with a goal written
   on it. A goal is still a thing a student can read and not know what to
   do about. So a stage is a WALKTHROUGH now: one sentence, one thing
   glowing, and the step ends when the world says it happened.

   THREE RULES, and everything below is one of them:

     ONE THING AT A TIME. A step names a single click. The palette is
     narrowed to what that click needs, so the block being asked for is
     often the only block on the shelf.

     READ THE WORLD, NEVER THE SCRIPT OF WHAT WE JUST SAID. Every `done`
     asks the project or the robot. A student who works two steps ahead
     is never told to do the thing they have already done — COACH stands
     just past the last step that is true.

     NOTHING IS KEPT. Every entry is an empty room and step one. There is
     no saved script to be half-way through, no progress to resume and
     nothing to lose by getting it wrong — which is what makes trying
     something silly free. See VM.useScratch().

   WHAT A STEP IS:
     say   one sentence, <b>for the one key or word to press</b>
     sel   what to put the ring around, or find() for a computed target
     done  ctx => is it true in the world yet
     pal   the palette while this step is live: { cats, ops }
     tab   the shelf to open first, so the block being asked for is there

   No DOM in the data — find() is a function the ring calls, and nothing
   here runs at load. Node reads this file for the tests.
   ===================================================================== */
(function(root){

  /* WHERE THE EDITOR LIVES, asked for rather than named. A step's done()
     runs sixty times a second in a browser and a handful of times in a
     test, and `UI().CODER` is a ReferenceError in the second — which
     would make every step in the file untestable, including the ones
     whose whole job is to not throw at an awkward moment. */
  const UI = () => (typeof window!=='undefined' && window) || root || {};

  const RULES = (typeof require==='function' && typeof module!=='undefined')
    ? require('./rules.js') : root.RULES;
  const reach = () => (RULES && RULES.RULES ? RULES.RULES.moves.light.reach : 6.5);

  /* --------------------------------------------------- reading a script
     A step sometimes needs to know what a student WROTE — "the `if` is
     inside the loop" is a fact about the program, not about the robot.
     These walk the block tree the way the VM runs it: arguments can hold
     blocks, and C-blocks have bodies. */
  function walk(node, fn){
    if(!node || typeof node!=='object') return;
    if(Array.isArray(node)) return node.forEach(n=>walk(n,fn));
    if(node.op) fn(node);
    Object.values(node.args||{}).forEach(v=>walk(v,fn));
    walk(node.body, fn); walk(node.body2, fn);
  }
  function blocks(actor){
    const out=[];
    ((actor||{}).scripts||[]).forEach(sc=>{ walk(sc.hat,b=>out.push(b)); walk(sc.body,b=>out.push(b)); });
    return out;
  }
  const uses   = (actor, op) => blocks(actor).some(b=>b.op===op);
  const count  = (actor, op) => blocks(actor).filter(b=>b.op===op).length;
  const hats   = (actor, op) => ((actor||{}).scripts||[]).filter(sc=>sc.hat && sc.hat.op===op).length;
  const reads  = (actor, v) => blocks(actor).some(b=>b.op==='data.get' && String(b.args&&b.args.v)===v);
  const writes = (actor, v) => blocks(actor).some(b=>(b.op==='data.set'||b.op==='data.change') &&
                                                     String(b.args&&b.args.v)===v);
  /* Is a block of this op somewhere inside a block of that one? The shape
     stage one is entirely about. */
  function within(actor, outer, inner){
    let found=false;
    ((actor||{}).scripts||[]).forEach(sc=>walk(sc.body,b=>{
      if(b.op!==outer) return;
      walk(b.body,  x=>{ if(x.op===inner) found=true; });
      walk(b.body2, x=>{ if(x.op===inner) found=true; });
    }));
    return found;
  }
  /* Every `if` that is inside a `forever` and has a key test in its
     diamond — which is what a control IS, and what stage one builds two
     of. Counted, because the second one is the whole second half. */
  function controls(actor){
    let n=0;
    ((actor||{}).scripts||[]).forEach(sc=>walk(sc.body,b=>{
      if(b.op!=='ctrl.forever') return;
      walk(b.body, x=>{
        if(x.op!=='ctrl.if') return;
        const c=x.args && x.args.c;
        if(c && c.op==='sense.key' && hasMotion(x)) n++;
      });
    }));
    return n;
  }
  const hasMotion = bk => { let m=false; walk(bk.body, x=>{ if(String(x.op).indexOf('motion.')===0) m=true; }); return m; };
  /* The keys those controls are watching, so a step can say "now the
     other one" and mean it. */
  function keysUsed(actor){
    const out=[];
    blocks(actor).forEach(b=>{
      if(b.op==='sense.key' || b.op==='event.key'){
        const k=String((b.args||{}).k||'');
        if(k && out.indexOf(k)<0) out.push(k);
      }
    });
    return out;
  }

  /* -------------------------------------------------------- the shelves
     What a step leaves on the palette. Narrow on purpose: when the step
     says "click this", it should be the only thing there to click. */
  const only = (cats, ops) => ({ cats, ops });
  const EV   = ['event.flag'];
  const MOVE = ['ctrl.forever','ctrl.if','sense.key','motion.changeBy'];

  /* --------------------------------------------------------- the steps */
  const openTheBlocks = {
    want:'editor-open',
    say:'Click <b>BLOCKS</b>.',
    sel:'#ringOpen',
    done:()=>{ const C=UI().CODER; return !!(C && C.open); },
    pal:only(['events'], EV)
  };
  const pressRun = extra => Object.assign({
    say:'Press <b>Run</b>, then hold your key.',
    sel:'#cFlag'
  }, extra);

  /* A shelf step: open a category.

     IT CARRIES ITS OWN PALETTE, and has to. A step with no `pal` leaves
     the last one in force — so "open Control" straight after a step that
     narrowed the shelves to Events is a student staring at a palette with
     no Control tab on it, being told to click the Control tab. What it
     hands over is what the step AFTER it needs, because opening a shelf
     and finding it empty is the same dead end one move later. */
  const shelf = (id, label, pal) => ({
    want:'shelf:'+id,
    say:'Open <b>'+label+'</b>.',
    sel:'#cPal [data-c="'+id+'"]',
    done:()=>{ const C=UI().CODER; return !!(C && C.shelf()===id); },
    /* NO `tab`. A step that opens the shelf it is asking you to open
       satisfies itself before you have looked at it, and the walkthrough
       flashes past the one moment it was teaching where blocks live. */
    pal
  });
  /* Clicking a block on the shelf. `after` is how the world proves it. */
  const pick = (op, say, after, pal, tab) => ({
    want:'pick:'+op,
    say, sel:'#cPal [data-op="'+op+'"]', done:after, pal, tab
  });
  /* The gap inside a block's mouth, which has no fixed selector because
     its path depends on what is already in the script. `mouth` is the
     outermost — the loop you have just made — and `inner` is the last one
     drawn, which is the block you most recently put inside it.

     THE SECOND ONE IS NOT A REFINEMENT. Without it the walkthrough said
     "click change x by" while the cursor was still sitting after the
     `if`, so the block landed BESIDE the conditional instead of inside
     it: a robot that walks whether or not the key is down, which is a
     more confusing wrong answer than the twitch. */
  const mouth = () => document.querySelector('#cScript .cmouth .cdrop');
  const inner = () => {
    const all=[...document.querySelectorAll('#cScript .cmouth')];
    const last=all[all.length-1];
    return last ? last.querySelector('.cdrop') : null;
  };
  /* NAMED, because two gaps are two different steps. See armedInside(). */
  const intoMouth = (say, find, op) => ({
    want:'mouth:'+op,
    say, find, done:()=>{ const C=UI().CODER; return !!(C && C.armedInside()===op); }
  });

  const LIST = [
    /* =============================================================== 1 */
    { id:'move', n:1, em:'🕹', a:'#8fd3ff',
      name:'MAKE IT MOVE',
      teach:'A conditional inside a loop',
      goal:'Drive your robot with two keys.',
      foe:'none',
      steps:[
        openTheBlocks,
        pick('event.flag',
          'Click this. It starts your program when somebody presses Run.',
          c=>hats(c.me,'event.flag')>0,
          only(['events'], EV)),
        shelf('control','Control', only(['control'], ['ctrl.forever'])),
        pick('ctrl.forever',
          'Click <b>forever</b>. Everything you put inside it happens over and over.',
          c=>uses(c.me,'ctrl.forever'),
          only(['control'], ['ctrl.forever'])),
        { want:'mouth:ctrl.forever',
          say:'Click the gap INSIDE the loop. That is where the next block has to go.',
          find:mouth,
          done:()=>{ const C=UI().CODER; return !!(C && C.armedInside()==='ctrl.forever'); },
          pal:only(['control'], ['ctrl.forever','ctrl.if']), tab:'control' },
        /* THE ONE SENTENCE THE WHOLE MODE IS BUILT ROUND, said at the one
           moment it is about to matter: the student is holding the block
           and about to decide where it goes. It used to be a paragraph on
           a menu screen, read before they could have made the mistake. */
        pick('ctrl.if',
          'Now click <b>if</b>. On its own it is checked ONCE and the robot twitches and '+
          'stops \u2014 inside the loop it gets asked over and over, which is what makes it a control.',
          c=>within(c.me,'ctrl.forever','ctrl.if'),
          only(['control'], ['ctrl.forever','ctrl.if'])),
        shelf('sensing','Sensing', only(['sensing'], ['sense.key'])),
        { want:'slot-armed',
          say:'Click the empty diamond on the <b>if</b>.',
          find:()=>document.querySelector('#cScript .cslot.bool'),
          done:()=>!!(UI().CODER && UI().CODER.slotArmed()),
          pal:only(['sensing'], ['sense.key']), tab:'sensing' },
        pick('sense.key',
          'Click <b>key pressed?</b>. It drops into the diamond you just armed.',
          c=>within(c.me,'ctrl.forever','ctrl.if') && uses(c.me,'sense.key'),
          only(['sensing'], ['sense.key'])),
        { want:'key-chosen',
          say:'Pick the key you want to go RIGHT with — try <b>d</b>.',
          find:()=>document.querySelector('#cScript select.ckey'),
          done:c=>keysUsed(c.me).length>0 && keysUsed(c.me)[0]!=='space',
          pal:only(['sensing'], ['sense.key']), tab:'sensing' },
        shelf('motion','Motion', only(['motion'], ['motion.changeBy'])),
        Object.assign(intoMouth('Now click the gap inside the <b>if</b> \u2014 the step has to go in there, '+
          'or the robot walks whether the key is down or not.', inner, 'ctrl.if'),
          { pal:only(['motion'], ['motion.changeBy']) }),
        pick('motion.changeBy',
          'Click <b>change x by</b>. x runs across the screen, so this is the step sideways.',
          c=>controls(c.me)>=1,
          only(['motion'], ['motion.changeBy'])),
        Object.assign(pressRun(), {
          want:'moved-one-way',
          say:'That is a control. Press <b>Run</b> and hold your key \u2014 the robot should keep going.',
          done:c=>c.frames.right>=6 || c.frames.left>=6,
          pal:only(['motion'], ['motion.changeBy']) }),
        { want:'two-controls',
          say:'It only goes one way. Build the same three blocks again for the other key.',
          sel:'#cPal [data-op="ctrl.if"]',
          done:c=>controls(c.me)>=2,
          pal:only(['control','sensing','motion'], MOVE), tab:'control' },
        { want:'moved-both-ways',
          say:'Set the second one to a negative number, like <b>-1</b>, so it goes the other way.',
          find:()=>document.querySelector('#cScript input.cin'),
          done:c=>c.frames.left>=6 && c.frames.right>=6,
          pal:only(['control','sensing','motion'], MOVE) }
      ] },

    /* =============================================================== 2 */
    { id:'near', n:2, em:'📏', a:'#a8e6cf',
      name:'CLOSE IN',
      teach:'A sensor is a number you can read',
      goal:'Walk up to Ambush and say how far away he is.',
      foe:'dummy',
      steps:[
        openTheBlocks,
        pick('event.flag', 'Click this to start the program.',
          c=>hats(c.me,'event.flag')>0, only(['events'], EV)),
        shelf('control','Control', only(['control'], ['ctrl.forever'])),
        pick('ctrl.forever', 'Click <b>forever</b>.',
          c=>uses(c.me,'ctrl.forever'),
          only(['control'], ['ctrl.forever'])),
        { want:'mouth:ctrl.forever',
          say:'Click the gap inside the loop.',
          find:mouth,
          done:()=>{ const C=UI().CODER; return !!(C && C.armedInside()==='ctrl.forever'); },
          pal:only(['control'], ['ctrl.forever']), tab:'control' },
        shelf('looks','Looks', only(['looks'], ['looks.say'])),
        pick('looks.say', 'Click <b>say</b>. Whatever you put in it, the robot holds over its head.',
          c=>uses(c.me,'looks.say'),
          only(['looks'], ['looks.say'])),
        { want:'slot-armed',
          say:'Click the white box on the <b>say</b> block to arm it.',
          find:()=>document.querySelector('#cScript input.cin'),
          done:()=>!!(UI().CODER && UI().CODER.slotArmed()),
          pal:only(['sensing'], ['sense.dist']), tab:'sensing' },
        pick('sense.dist',
          'Click <b>distance to</b>. It is a NUMBER, so it drops into anything that takes one.',
          c=>uses(c.me,'sense.dist'),
          only(['sensing'], ['sense.dist'])),
        { want:'said-something',
          say:'Press <b>Run</b>. The robot is now telling you what it can feel.',
          sel:'#cFlag', done:c=>c.said,
          pal:only(['sensing'], ['sense.dist']) },
        { want:'got-close',
          say:'Now walk it over. Add a key control that does <b>change x by</b> until you are next to him.',
          sel:'#cPal [data-c="motion"]',
          done:c=>c.gapMin<=reach(),
          pal:only(['control','sensing','motion'], MOVE), tab:'control' }
      ] },

    /* =============================================================== 3 */
    { id:'hit', n:3, em:'🥊', a:'#ffb4a2',
      name:'THROW ONE',
      teach:'There is no punch block',
      goal:'Land a punch on Ambush.',
      foe:'dummy',
      steps:[
        openTheBlocks,
        pick('event.flag', 'Start with this, as always.',
          c=>hats(c.me,'event.flag')>0, only(['events'], EV), 'events'),
        shelf('control','Control', only(['control'], ['ctrl.forever'])),
        pick('ctrl.forever', 'A <b>forever</b> loop, so you can punch more than once.',
          c=>uses(c.me,'ctrl.forever'),
          only(['control'], ['ctrl.forever'])),
        { want:'mouth:ctrl.forever',
          say:'The gap inside the loop.',
          find:mouth,
          done:()=>{ const C=UI().CODER; return !!(C && C.armedInside()==='ctrl.forever'); },
          pal:only(['control'], ['ctrl.forever','ctrl.if']), tab:'control' },
        pick('ctrl.if', 'An <b>if</b>, so the punch only happens when you ask for one.',
          c=>within(c.me,'ctrl.forever','ctrl.if'),
          only(['control'], ['ctrl.forever','ctrl.if'])),
        { want:'key-test-in',
          say:'Click the diamond, then put a <b>key pressed?</b> in it.',
          find:()=>document.querySelector('#cScript .cslot.bool'),
          done:c=>uses(c.me,'sense.key'),
          pal:only(['sensing'], ['sense.key']), tab:'sensing' },
        shelf('data','Variables', only(['data'], ['data.set'])),
        Object.assign(intoMouth('Click the gap inside the <b>if</b>.', inner, 'ctrl.if'),
          { pal:only(['data'], ['data.set']) }),
        /* THE WHOLE POINT OF THE STAGE, said on the block that makes it
           true rather than as a notice three steps earlier. */
        pick('data.set',
          'There is no PUNCH block. Click <b>set</b>, choose <b>light</b>, set it to <b>1</b> \u2014 '+
          'that is you ASKING, and the referee deciding.',
          c=>writes(c.me,'light'),
          only(['data'], ['data.set'])),
        { want:'punch-landed',
          say:'Press <b>Run</b>, get close to Ambush, and press your punch key.',
          sel:'#cFlag', done:c=>c.swings.landed>=1,
          pal:only(['control','sensing','motion','data'], MOVE.concat(['data.set'])) }
      ] },

    /* =============================================================== 4 */
    { id:'spend', n:4, em:'🔋', a:'#ffd8a8',
      name:'AFFORD IT',
      teach:'Check before you spend',
      goal:'Land three punches without asking for one you cannot afford.',
      foe:'dummy',
      steps:[
        openTheBlocks,
        { want:'asked-once',
          say:'Punching costs stamina. Ask for one you cannot afford and nothing happens at all.',
          sel:'#cFlag',
          done:c=>c.swings.asked>0,
          pal:only(['events','control','sensing','motion','data'],
                   EV.concat(MOVE, ['data.set'])) },
        { want:'tank-emptied',
          say:'Press Run and mash your punch key until the swings stop working.',
          sel:'#cFlag', done:c=>c.swings.broke>0,
          pal:only(['events','control','sensing','motion','data'],
                   EV.concat(MOVE, ['data.set'])) },
        { want:'shelf:ops',
          say:'That is an empty tank. Now stop it happening: open <b>Operators</b>.',
          sel:'#cPal [data-c="ops"]',
          done:()=>!!(UI().CODER && UI().CODER.shelf()==='ops'),
          pal:only(['ops'], ['op.gt']), tab:'ops' },
        pick('op.gt',
          'Click <b>&gt;</b>. Put it in the diamond of a new <b>if</b> around your punch.',
          c=>uses(c.me,'op.gt'),
          only(['ops'], ['op.gt'])),
        shelf('data','Variables', only(['data'], ['data.get','data.set'])),
        pick('data.get',
          'Drop <b>(stamina)</b> into the left side, and type what you want left over into the right.',
          c=>reads(c.me,'stamina'),
          only(['data'], ['data.get','data.set'])),
        { want:'three-clean',
          say:'Press <b>Run</b>. Land three, and do not throw one you cannot pay for.',
          sel:'#cFlag',
          done:c=>c.swings.landed>=3 && c.swings.broke===0,
          pal:only(['events','control','sensing','motion','data','ops'],
                   EV.concat(MOVE, ['data.set','data.get','op.gt','ctrl.ifelse'])) }
      ] },

    /* =============================================================== 5 */
    { id:'fight', n:5, em:'🏆', a:'#cdb4f6',
      name:'THE FIGHT',
      teach:'All of it, against something that fights back',
      goal:'Knock Ambush out.',
      foe:'live',
      steps:[
        openTheBlocks,
        { want:'reading-foe',
          say:'Ambush fights now. Click his name and read his strategy \u2014 you may steal it.',
          find:()=>document.querySelector('#cScript .cchip[data-name="Ambush"]'),
          done:()=>{ const C=UI().CODER; return !!(C && C.actorName()==='Ambush'); },
          pal:null },
        /* AND IT WANTS A SCRIPT, not just the chip. "Back on your own
           robot" is true the moment the room opens — you start there — so
           on its own this step was finished before it was read, and since
           COACH stands just past the LAST true step the whole stage
           collapsed to "press Run" as soon as a student walked in. */
        { want:'wrote-something',
          say:'Now click <b>Robot</b> and write something that beats it.',
          find:()=>document.querySelector('#cScript .cchip[data-name="Robot"]'),
          done:c=>{ const C=UI().CODER;
            return !!(C && C.actorName() && C.actorName()!=='Ambush'
                      && ((c.me||{}).scripts||[]).length>0); },
          pal:null },
        { want:'won',
          say:'Press <b>Run</b> and knock him out.',
          sel:'#cFlag', done:c=>c.won, pal:null }
      ] }
  ];

  const byIndex = i => LIST[Math.max(0, Math.min(LIST.length-1, i|0))];
  const byId    = id => LIST.find(s=>s.id===id) || null;
  const LAST    = LIST.length-1;
  const steps   = i => byIndex(i).steps;

  /* The palette a stage falls back to when no step is narrowing it: the
     union of everything its steps ever offer, so closing the walkthrough
     leaves a student with the blocks the stage was about and not with
     nothing. null means "whatever the room hands out". */
  function palette(i){
    const cats=[], ops=[];
    let any=false;
    steps(i).forEach(s=>{
      if(!s.pal) return;
      any=true;
      (s.pal.cats||[]).forEach(c=>{ if(cats.indexOf(c)<0) cats.push(c); });
      (s.pal.ops ||[]).forEach(o=>{ if(ops .indexOf(o)<0) ops .push(o); });
    });
    return any ? { cats, ops } : null;
  }

  const API={ LIST, byIndex, byId, LAST, steps, palette,
              blocks, uses, count, hats, reads, writes, within, controls, keysUsed, walk };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.STAGES=API;
})(typeof self!=='undefined' ? self : this);
