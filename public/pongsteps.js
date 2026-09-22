/* =====================================================================
   PONG, STEP BY STEP.

   THREE OBJECTS, ONE OF THEM ALREADY WRITTEN. The paddle you drive is a
   conditional inside a loop watching a key, which is the whole of the
   ring's first mission — so it is handed over finished and the
   walkthrough opens by asking you to CLICK IT AND READ IT. That is the
   idea this mission is actually about: everything on the screen is made
   of blocks, and you can open any of it.

   Then the two that are new. The BALL travels along a heading and
   bounces, which is the first program in this game whose interesting
   part is arithmetic: a reflection off a side wall is `0 − direction`
   and off an end wall is `180 − direction`, and once a student has
   built one of them the other three are the same block.

   The RIVAL watches another object. `y of Ball` against `y position` is
   the first time a script has asked about somebody else, and it is four
   blocks that look exactly like an opponent thinking.

   NOT MARCHED THROUGH THE SAME IDEA TWICE. The first bounce is built
   click by click; the second one says "now the same for the other
   paddle" and waits for it. A walkthrough that keeps hold of you after
   you have understood something has stopped teaching.
   ===================================================================== */
(function(root){
  const UI = () => (typeof window!=='undefined' ? window : {});
  const S  = () => UI().STAGES || {};
  const D  = () => UI().document;

  /* The shelves a step leaves behind, and what the blocks on them arrive
     already set to.

     THE NUMBER IN A BLOCK IS PART OF THE LESSON, and a wrong one is not a
     detail here: `move` arrives set to 10, which is a whole square every
     frame — the ball crosses the court in nineteen of them and there is
     no game, only a flicker. 5 is a ball you can see travelling and can
     get a bat to. A student who wants it faster types a bigger number,
     which is the lesson working. */
  const only = (cats, ops) => ({ cats, ops, defaults:SET });
  const SET = {
    'motion.move':     { n:5 },
    'motion.face':     { n:0 },
    /* NOT `player`, which is what this block defaults to and which does
       not exist on a Pong court: a step that says "change it to You" has
       to be changing it FROM something real, or the dropdown is showing
       a name with nothing behind it. */
    'sense.touch':     { o:'Rival' },
    'motion.changeBy': { a:'y', n:0.2 },
    'motion.pos':      { a:'y' },
    'sense.posOf':     { a:'y', o:'Ball' },
    /* `−` arrives as `0 − ...`, because the left-hand number is not the
       lesson here and a student who has to be told to type a 0 before
       they can see the mirror work has been given a chore, not a step. */
    'op.sub':          { a:0 },
    'op.gt':           { b:6 },
    'op.lt':           { b:-6 }
  };
  const EV     = ['event.flag'];
  const LOOP   = ['ctrl.forever','ctrl.if'];
  const MOVE   = ['motion.move'];
  const FACE   = ['motion.face','motion.dir'];
  const TOUCH  = ['sense.touch'];
  const WHERE  = ['motion.pos','sense.posOf'];
  const MATHS  = ['op.sub','op.gt','op.lt'];

  /* ------------------------------------------------- reading a script
     Borrowed from stages.js rather than written again, so "is there a
     forever in this object" means the same thing in both missions. */
  const blocks = a => (S().blocks ? S().blocks(a) : []);
  const uses   = (a,op) => (S().uses   ? S().uses(a,op)   : false);
  const count  = (a,op) => (S().count  ? S().count(a,op)  : 0);
  const hats   = (a,op) => (S().hats   ? S().hats(a,op)   : 0);
  const within = (a,x,y)=> (S().within ? S().within(a,x,y): false);

  /* Every `if` inside a `forever` whose body points the object somewhere
     — which is what a bounce IS. Counted, because the ball needs four of
     them and each one is a step. */
  function bounces(a){
    let n=0;
    ((a||{}).scripts||[]).forEach(sc=>walk(sc.body, b=>{
      if(b.op!=='ctrl.forever') return;
      walk(b.body, x=>{
        if(x.op!=='ctrl.if' || !x.args || !x.args.c) return;
        let points=false;
        walk(x.body, y=>{ if(y.op==='motion.face') points=true; });
        if(points) n++;
      });
    }));
    return n;
  }
  /* and the ones that ask about the OTHER object rather than about a
     number, which is the difference between a paddle bounce and a wall */
  function onTouch(a){
    let n=0;
    ((a||{}).scripts||[]).forEach(sc=>walk(sc.body, b=>walk(b.body, x=>{
      if(x.op==='ctrl.if' && x.args && x.args.c && x.args.c.op==='sense.touch'){
        let points=false;
        walk(x.body, y=>{ if(y.op==='motion.face') points=true; });
        if(points) n++;
      }
    })));
    return n;
  }
  function walk(list, f){
    (list||[]).forEach(b=>{
      if(!b || typeof b!=='object') return;
      f(b);
      Object.keys(b.args||{}).forEach(k=>{
        const v=b.args[k];
        if(v && typeof v==='object' && v.op) walk([v], f);
      });
      walk(b.body, f); walk(b.body2, f);
    });
  }
  /* is this object the one open in the editor? */
  const editing = name => { const C=UI().CODER;
    return !!(C && C.actorName && C.actorName()===name); };

  /* ------------------------------------------------------- step shapes */
  /* CLICKING AN OBJECT. `also` is how a chip step says what ELSE must be
     true before it counts — needed because COACH stands past the last
     step that has already happened, and "the Ball is selected" is true of
     whatever the room happened to open on. The editor being open is the
     floor under all of them. */
  const chip = (name, say, also) => ({
    want:'chip:'+name,
    say,
    find:()=>{ const els=[...D().querySelectorAll('#cScript [data-a]')];
               return els.find(b=>b.dataset.name===name) || null; },
    done:c=>{ const C=UI().CODER;
              return !!(C && C.open) && editing(name) && (!also || also(c)); }
  });
  const shelf = (id, label, pal) => ({
    want:'shelf:'+id,
    say:'Open <b>'+label+'</b>.',
    sel:'#cPal [data-c="'+id+'"]',
    done:()=>{ const C=UI().CODER; return !!(C && C.shelf()===id); },
    pal
  });
  const pick = (op, say, after, pal, tab) => ({
    want:'pick:'+op,
    say, sel:'#cPal [data-op="'+op+'"]', done:after, pal, tab
  });
  const mouth = () => D().querySelector('#cScript .cmouth .cdrop');
  const inner = () => {
    const empty=[...D().querySelectorAll('#cScript .cmouth')]
      .find(m=>!m.querySelector('.cblk'));
    return empty ? empty.querySelector('.cdrop') : null;
  };
  const intoMouth = (say, find, op, pal, tab) => ({
    want:'mouth:'+op,
    say, find, pal, tab,
    done:()=>{ const C=UI().CODER; return !!(C && C.armedInside()===op); }
  });
  /* ARMING A SLOT, AND WHICH SLOT IT IS.

     `slotArmed()` answers yes or no and will not say which — so three
     steps that all wait on "a slot is armed" are three steps that are all
     satisfied by the first click, and COACH stands past the last of them.
     That is not a cosmetic bug: it silently skips five steps of the
     lesson and leaves the student in front of a script they were never
     shown how to build.

     So every one of these carries `also`: a second condition that is only
     true at the point in the build where that step actually lives. */
  const armBool = (whose, say, also, pal, tab) => ({
    /* NAMED FOR WHOSE DIAMOND IT IS. Two steps both called `bool-armed`
       are two steps that look interchangeable to anything reading the
       list — including the test that exists to catch exactly the case
       where they turn out to be. */
    want:'bool-armed:'+whose,
    say,
    find:()=>D().querySelector('#cScript .cslot.bool'),
    done:c=>!!(UI().CODER && UI().CODER.slotArmed()) && (!also || also(c)),
    pal, tab
  });
  /* A STEP THAT ASKS FOR A RUN ENDS THE LAST ONE FIRST.

     Run greys out while a program is running — that is how the editor
     says which of the two states you are in — and this mission presses
     Run three times, once per object. Without this the second step that
     says "press Run" is pointing at a dead button, because the program
     from the first one is still going: the student clicks it, nothing
     happens, and the walkthrough waits forever for something they are
     not able to do.

     So the step carries `stopFirst`, and the room stops the VM as the
     step goes live. The button is live, it is the one being pointed at,
     and pressing it starts a fresh run over the blocks just written —
     which is what "press Run" meant. */
  const run = (say, want, done) => ({ want, say, sel:'#cFlag', done, stopFirst:true });

  /* ===================================================== the steps */
  function steps(){
    const BALL='Ball', YOU='You', RIVAL='Rival';
    return label([
      /* ---------------------------------------------- 1. look inside */
      { want:'editor-open',
        say:'Click <b>BLOCKS</b>. Everything on this court is made of them.',
        sel:'#pongOpen',
        done:()=>{ const C=UI().CODER; return !!(C && C.open); },
        pal:only(['events'], EV) },
      Object.assign(chip(YOU,
        'Click <b>You</b>. That is your paddle — and it already has a script, '+
        'which you can read.'),
        { pal:only(['events'], EV) }),
      run('Press <b>Run</b>, then hold <b>W</b> and <b>S</b>. Three blocks, and you have a paddle.',
          'paddle-moves',
          c=>{ const y=c.you; return !!(UI().VM && UI().VM.running) &&
                 !!y && Math.abs(UI().BLOCKS.axisSign('y')*(+y[UI().BLOCKS.axisField('y')]||0))>0.6; }),

      /* ---------------------------------------------- 2. the ball */
      Object.assign(chip(BALL,
        'Now click <b>Ball</b>. It is empty — that is why nothing has come at you yet.'),
        { pal:only(['events'], EV) }),
      pick('event.flag',
        'Click this, so the ball starts when somebody presses Run.',
        c=>hats(c.ball,'event.flag')>0,
        only(['events'], EV)),
      shelf('control','Control', only(['control'], ['ctrl.forever'])),
      pick('ctrl.forever',
        'Click <b>forever</b>. A ball that moves once is a ball that has already stopped.',
        c=>uses(c.ball,'ctrl.forever'),
        only(['control'], ['ctrl.forever'])),
      Object.assign(intoMouth('Click the gap INSIDE the loop.', mouth, 'ctrl.forever',
        only(['control'], ['ctrl.forever'])), { tab:'control' }),
      shelf('motion','Motion', only(['motion'], MOVE)),
      pick('motion.move',
        'Click <b>move</b>. It slides the ball whichever way it is already pointing — '+
        'the referee serves it, so it is always pointing somewhere.',
        c=>within(c.ball,'ctrl.forever','motion.move'),
        only(['motion'], MOVE)),
      run('Press <b>Run</b>. The ball flies off, you lose the point, and it is served again. '+
          'Now make it bounce.',
          'ball-flies',
          c=>c.score.you+c.score.rival>0),

      /* --------------------------------- 3. the first bounce, clicked */
      /* NO SECOND "open Control" STEP. Its predicate would be the same
         sentence as the first one's — "the Control shelf is open" — and
         two steps that wait on the same thing are one step the student
         never sees. The pick opens the tab itself. */
      pick('ctrl.if',
        'Click <b>if</b>. A bounce is a question the ball asks on every single frame.',
        c=>within(c.ball,'ctrl.forever','ctrl.if'),
        only(['control'], LOOP), 'control'),
      shelf('sensing','Sensing', only(['sensing'], TOUCH)),
      /* "a slot is armed" is true of the rival's diamond too, so this has
         to say which object AND how far along it is. */
      armBool('ball', 'Click the empty diamond on the <b>if</b>.',
        c=>within(c.ball,'ctrl.forever','ctrl.if') && !uses(c.ball,'sense.touch'),
        only(['sensing'], TOUCH), 'sensing'),
      pick('sense.touch',
        'Click <b>touching</b>. This is how the ball finds out it has hit something.',
        c=>uses(c.ball,'sense.touch'),
        only(['sensing'], TOUCH)),
      { want:'touch-you',
        say:'Change it to <b>You</b> — your paddle is the thing it should notice.',
        find:()=>D().querySelector('#cScript select.cin[data-set="o"]'),
        done:c=>blocks(c.ball).some(b=>b.op==='sense.touch' &&
                 String((b.args||{}).o)==='You'),
        pal:only(['sensing'], TOUCH), tab:'sensing' },
      Object.assign(intoMouth('Click the gap inside the <b>if</b>. The bounce goes in there, '+
        'or the ball turns whether it touched you or not.', inner, 'ctrl.if',
        only(['motion'], FACE)), { tab:'motion' }),
      pick('motion.face',
        'Click <b>point in direction</b>. Bouncing is just pointing somewhere new.',
        c=>within(c.ball,'ctrl.if','motion.face') || uses(c.ball,'motion.face'),
        only(['motion'], FACE)),
      shelf('ops','Operators', only(['ops'], MATHS)),
      { want:'sub-armed',
        say:'Click the number on <b>point in direction</b> — the new heading is a sum, not a number.',
        /* the number ON `point in direction`, not the first number in the
           script — `move 5` has one too, and a ring drawn round the wrong
           box is worse than no ring. A bool slot is an <i>; a number slot
           is an <input> that arms the same way. */
        find:()=>{ const b=[...D().querySelectorAll('#cScript .cblk')]
                     .filter(x=>/point in direction/i.test(x.textContent)).pop();
                   return b ? b.querySelector('input[data-slot]') : null; },
        done:c=>!!(UI().CODER && UI().CODER.slotArmed()) &&
                uses(c.ball,'motion.face') && !uses(c.ball,'op.sub'),
        pal:only(['ops'], MATHS), tab:'ops' },
      pick('op.sub',
        'Click the <b>−</b> block. Bouncing off something upright means '+
        '<b>0 − direction</b>: the same angle, mirrored.',
        c=>uses(c.ball,'op.sub'),
        only(['ops'], MATHS)),
      pick('motion.dir',
        'Click the right-hand box of the <b>−</b>, then click <b>direction</b>. '+
        'Now the new heading is worked out from the old one — that is a mirror.',
        c=>uses(c.ball,'motion.dir'),
        only(['motion'], FACE), 'motion'),
      /* A BOUNCE IS NOT "point in direction" ON ITS OWN. The moment the
         block lands inside the `if` there is technically a touch that
         points the ball somewhere — and if this step settled for that, it
         would fire four steps early and skip the whole reason the
         subtraction is here. What makes it a bounce is that the new
         heading is worked out FROM the old one. */
      /* AND IT HAS TO BE RUN. Every other condition here is true the
         instant the last block lands, so without this the step that says
         "press Run and hit it" is ticked off before they have. The room
         stops the previous run as this step goes live (see run()), so
         `VM.running` can only be true again because they pressed it. */
      run('Press <b>Run</b> and hit the ball with <b>W</b> and <b>S</b>. That is a bounce you wrote.',
          'first-bounce',
          c=>onTouch(c.ball)>=1 && uses(c.ball,'op.sub') && uses(c.ball,'motion.dir')
             && !!(UI().VM && UI().VM.running)),

      /* ------------------------------- 4. the other three, by themselves */
      { want:'rival-bounce',
        say:'Now the same three blocks again, for <b>Rival</b> — an <b>if touching Rival</b> '+
            'that points it back the other way. Everything you need is on the shelves.',
        done:c=>onTouch(c.ball)>=2 },
      { want:'wall-bounce',
        say:'And the two walls. <b>if (y position) &gt; 6</b> and <b>if (y position) &lt; -6</b>, '+
            'each pointing to <b>180 − direction</b> — that is the mirror for a flat wall '+
            'rather than an upright one.',
        done:c=>bounces(c.ball)>=4 },

      /* ---------------------------------------------- 5. the opponent */
      Object.assign(chip(RIVAL,
        'Last one. Click <b>Rival</b> — the paddle that plays against you.',
        c=>bounces(c.ball)>=4),
        { pal:only(['events'], EV) }),
      pick('event.flag',
        'Click this, so it starts with everything else.',
        c=>hats(c.rival,'event.flag')>0,
        only(['events'], EV), 'events'),
      /* ONE STEP FOR BOTH, because this is the third time. A walkthrough
         that keeps hold of you after you have understood something has
         stopped teaching. */
      pick('ctrl.forever',
        'Click <b>forever</b>, then <b>if</b> inside it — you have done this twice now.',
        c=>within(c.rival,'ctrl.forever','ctrl.if'),
        only(['control'], LOOP), 'control'),
      armBool('rival', 'Click the diamond on the <b>if</b>.',
        c=>within(c.rival,'ctrl.forever','ctrl.if') && !uses(c.rival,'op.gt'),
        only(['ops'], MATHS), 'ops'),
      pick('op.gt',
        'Click <b>&gt;</b>. The rival has one question to ask: is the ball above me?',
        c=>uses(c.rival,'op.gt'),
        only(['ops'], MATHS)),
      pick('sense.posOf',
        'Click <b>of</b>, drop it in the left box and set it to <b>y of Ball</b>. '+
        'This is the first time a script has asked about somebody else.',
        c=>blocks(c.rival).some(b=>b.op==='sense.posOf'),
        only(['sensing'], ['sense.posOf']), 'sensing'),
      pick('motion.pos',
        'Click <b>y position</b> for the right-hand box — the rival’s own.',
        c=>uses(c.rival,'motion.pos'),
        only(['motion'], ['motion.pos','motion.changeBy']), 'motion'),
      pick('motion.changeBy',
        'Now <b>change y by</b> inside the <b>if</b>, so it moves up towards the ball.',
        c=>within(c.rival,'ctrl.if','motion.changeBy'),
        only(['motion'], ['motion.pos','motion.changeBy'])),
      { want:'rival-down',
        say:'And the other half: a second <b>if</b> with <b>&lt;</b> instead, moving it '+
            'down. Then it can follow the ball both ways.',
        done:c=>count(c.rival,'ctrl.if')>=2 && count(c.rival,'motion.changeBy')>=2 },
      /* WON A POINT, WITH THE RIVAL BUILT. Not "some points have been
         scored": the ball flies off the court a dozen times while it is
         being written, and a last step satisfied by conceding is a last
         step that fires in the middle of the mission and ends the
         walkthrough before the rival exists. */
      run('Press <b>Run</b> and play it. First to '+7+'.',
          'played',
          c=>count(c.rival,'motion.changeBy')>=2 && c.score.you>=1)
    ]);
  }
  /* NO TWO STEPS MAY BE CALLED THE SAME THING.

     `want` is how a step is told apart from its neighbours, and the ring
     learned the hard way what happens when two of them share one: both
     wait on the same condition, the first satisfies the second, and the
     walkthrough skips a step nobody ever saw. Here the same block really
     is asked for three times — `forever` on the ball and again on the
     rival — and those are genuinely different steps because their
     predicates ask about different objects. So the repeat is numbered
     rather than forbidden: the labels stay unique, and a step that is
     accidentally a duplicate of another still shows up as one. */
  function label(list){
    const seen={};
    return list.map(s=>{
      const w=s.want;
      seen[w]=(seen[w]||0)+1;
      return seen[w]>1 ? Object.assign({}, s, { want:w+'#'+seen[w] }) : s;
    });
  }

  const API={ steps, bounces, onTouch, SET };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.PONGSTEPS=API;
})(typeof self!=='undefined' ? self : this);
