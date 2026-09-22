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
    'op.lt':           { b:-6 },
    /* the serve: across the court, leaning up or down by a different
       amount every time, which is what stops every point being the same
       point */
    'op.random':       { a:40, b:140 },
    /* the bat: 90 is straight across the court, and every unit away from
       the middle of the bat leans it 20 degrees */
    'op.add':          { a:90 },
    'op.mul':          { b:20 },
    'motion.setTo':    { a:'x', n:-7.6 },
    'motion.goto':     { x:0, y:0, z:1 },
    'data.change':     { v:'you', n:1 }
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
  /* Where something is, in the language's own x — the steps talk about
     the court in the same letters the blocks do. */
  const where = (a,k) => { const B=UI().BLOCKS;
    return (a && B) ? B.axisSign(k)*(+a[B.axisField(k)]||0) : 0; };
  const lx = a => where(a,'x');
  const ly = a => where(a,'y');
  /* HAS IT BEEN RUN SINCE THIS STEP BECAME LIVE?

     `VM.running` on its own is not that question. A student presses Run
     early and the program keeps going, so by the time a later step says
     "press Run" the flag has been true for minutes — and the step is
     ticked off by whatever block they happened to place last, without
     anybody pressing anything.

     The honest marker is the ball being ON the court. It leaves and
     keeps going the moment it has a `move` and nothing else, so between
     that step and the next press of Run it is always somewhere past a
     goal line. Coming back to the middle is something only the `go to`
     at the top of its own script does, and that only runs on Run. */
  const ranAgain = c => !!(UI().VM && UI().VM.running) && Math.abs(lx(c.ball)) < 11;

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
  /* THE TWO KINDS OF BOUNCE, and they are different on purpose.

     A WALL is a mirror: put the ball back on the line, then turn it to
     `180 − direction`. Two blocks, and the same two twice.

     A BAT IS NOT A MIRROR. That was the first thing this mission tried
     and it does not make a game: a mirror hands the ball back at the
     angle it arrived at, so a serve that goes across flat comes back flat
     for ever and neither paddle is ever beaten. A real bat sends the ball
     where you hit it — `90 + (how far off the middle) × 20` — which is
     one expression, ends rallies, and is the difference between a game
     and two paddles nodding at each other. It is also idempotent, so it
     needs no putting back: the same offset works out the same heading. */
  const has=(bk,op)=>{ let f=false; walk([bk],x=>{ if(x.op===op) f=true; }); return f; };
  function ifsIn(a, f){
    let n=0;
    ((a||{}).scripts||[]).forEach(sc=>walk(sc.body, b=>{
      if(b.op!=='ctrl.forever') return;
      walk(b.body, x=>{ if(x.op==='ctrl.if' && f(x)) n++; });
    }));
    return n;
  }
  /* an `if touching ...` that works an angle out */
  const batBounces  = a => ifsIn(a, x=>x.args && x.args.c && x.args.c.op==='sense.touch' &&
                                     (x.body||[]).some(y=>y.op==='motion.face' && has(y,'op.mul')));
  /* an `if (y position) ...` that puts the ball back and mirrors it */
  const wallBounces = a => ifsIn(a, x=>(x.body||[]).some(y=>y.op==='motion.setTo') &&
                                       (x.body||[]).some(y=>y.op==='motion.face' && has(y,'op.sub')));
  /* and how many `if`s change a score */
  function scores(a){
    let n=0;
    ((a||{}).scripts||[]).forEach(sc=>walk(sc.body, b=>walk(b.body, x=>{
      if(x.op!=='ctrl.if') return;
      walk(x.body, y=>{ if(y.op==='data.change'||y.op==='data.set') n++; });
    })));
    return n;
  }

  function steps(){
    const BALL='Ball', YOU='You', RIVAL='Rival';
    return label([
      /* ------------------------------------------- 1. look inside one */
      { want:'editor-open',
        say:'Click <b>BLOCKS</b>. Every rule of this game is in here somewhere.',
        sel:'#pongOpen',
        done:()=>{ const C=UI().CODER; return !!(C && C.open); },
        pal:only(['events'], EV) },
      Object.assign(chip(YOU,
        'Click <b>You</b>. That is your paddle, and it is already written — '+
        'two keys, and two more blocks that stop it walking off the screen.'),
        { pal:only(['events'], EV) }),
      run('Press <b>Run</b>, then hold <b>W</b> and <b>S</b>. Nothing is hidden: '+
          'that is the whole paddle.',
          'paddle-moves',
          /* the paddle has actually travelled: nothing was running before
             this step, so `running` is honest here, and the distance is
             what proves a key was held rather than just pressed */
          c=>!!(UI().VM && UI().VM.running) && Math.abs(ly(c.you))>0.6),

      /* ---------------------------------------------- 2. serve the ball */
      Object.assign(chip(BALL,
        'Now click <b>Ball</b>. Empty — which is why nothing has come at you.'),
        { pal:only(['events'], EV) }),
      pick('event.flag',
        'Click this, so the ball starts when somebody presses Run.',
        c=>hats(c.ball,'event.flag')>0,
        only(['events'], EV)),
      pick('motion.goto',
        'Click <b>go to</b>. Every point starts from the middle.',
        c=>uses(c.ball,'motion.goto'),
        only(['motion'], ['motion.goto','motion.face']), 'motion'),
      pick('motion.face',
        'Click <b>point in direction</b>. A ball has to be going somewhere '+
        'before it can go anywhere.',
        c=>uses(c.ball,'motion.face'),
        only(['motion'], ['motion.goto','motion.face'])),
      { want:'random-serve',
        say:'Click the number on it, then take <b>pick random</b> from Operators — '+
            'a serve that is the same every time makes a point that is the same every time.',
        find:()=>{ const b=[...D().querySelectorAll('#cScript .cblk')]
                     .filter(x=>/point in direction/i.test(x.textContent)).pop();
                   return b ? b.querySelector('input[data-slot]') : null; },
        done:c=>uses(c.ball,'op.random'),
        pal:only(['ops'], ['op.random']), tab:'ops' },
      pick('ctrl.forever',
        'Now <b>forever</b>, under those two. A ball that moves once has already stopped.',
        c=>uses(c.ball,'ctrl.forever'),
        only(['control'], LOOP), 'control'),
      Object.assign(intoMouth('Click the gap INSIDE the loop.', mouth, 'ctrl.forever',
        only(['control'], LOOP)), { tab:'control' }),
      pick('motion.move',
        'Click <b>move</b>. It slides the ball whichever way it is pointing.',
        c=>within(c.ball,'ctrl.forever','motion.move'),
        only(['motion'], MOVE), 'motion'),
      run('Press <b>Run</b>. It serves, it travels, and it leaves — because you '+
          'have not told it what a wall is yet.',
          'ball-flies',
          c=>uses(c.ball,'motion.move') && Math.abs(lx(c.ball))>11),

      /* -------------------------------- 3. the first bounce, click by click */
      pick('ctrl.if',
        'Click <b>if</b>. A bounce is a question the ball asks on every frame.',
        c=>within(c.ball,'ctrl.forever','ctrl.if'),
        only(['control'], LOOP), 'control'),
      shelf('sensing','Sensing', only(['sensing'], TOUCH)),
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
      Object.assign(intoMouth('Click the gap inside the <b>if</b>.', inner, 'ctrl.if',
        only(['motion'], ['motion.face','motion.pos','motion.dir'])), { tab:'motion' }),
      pick('motion.face',
        'Click <b>point in direction</b>. Bouncing is just pointing somewhere new — '+
        'and where is the interesting part.',
        c=>within(c.ball,'ctrl.if','motion.face'),
        only(['motion'], ['motion.face','motion.pos','motion.dir'])),
      /* THE ONE PIECE OF ARITHMETIC THAT IS REALLY ABOUT THE GAME. */
      { want:'bat-angle',
        say:'A bat is not a mirror. Click the number and build '+
            '<b>90 + (something × 20)</b> — <b>+</b> and <b>×</b> are in Operators. '+
            '90 sends it straight across; the rest is the lean.',
        find:()=>{ const b=[...D().querySelectorAll('#cScript .cblk')]
                     .filter(x=>/point in direction/i.test(x.textContent)).pop();
                   return b ? b.querySelector('input[data-slot]') : null; },
        done:c=>uses(c.ball,'op.add') && uses(c.ball,'op.mul'),
        pal:only(['ops'], MATHS.concat(['op.add','op.mul'])), tab:'ops' },
      { want:'bat-offset',
        say:'Now the lean itself, in the left box of the <b>×</b>: '+
            '<b>(y position) − (y of You)</b>. That is how far up the bat it hit — '+
            'catch it on the end and it leaves steeply.',
        done:c=>batBounces(c.ball)>=1 && uses(c.ball,'sense.posOf'),
        pal:only(['ops'], MATHS.concat(['op.add','op.mul'])) },
      run('Press <b>Run</b> and hit it with <b>W</b> and <b>S</b>, high and low. '+
          'Where you hit it is where it goes.',
          'first-bounce',
          c=>batBounces(c.ball)>=1 && ranAgain(c)),

      /* ------------------------------- 4. the other three, on their own */
      { want:'rival-bounce',
        say:'Now the same for <b>Rival</b>: <b>if touching Rival</b>, pointing to '+
            '<b>270 − ((y position) − (y of Rival)) × 20</b>. '+
            '270 is straight back the other way.',
        done:c=>batBounces(c.ball)>=2 },
      { want:'wall-bounce',
        say:'The walls are simpler, because a wall IS a mirror. '+
            '<b>if (y position) &gt; 6</b>, then <b>set y to 6</b> and '+
            '<b>point in direction (180 − direction)</b>. Then the same for the bottom.',
        done:c=>wallBounces(c.ball)>=2 },
      run('Press <b>Run</b>. It should stay in now, however long you keep it going.',
          'rally',
          c=>wallBounces(c.ball)>=2 && batBounces(c.ball)>=2 && ranAgain(c)),

      /* ------------------------------------------------ 5. the score */
      { want:'score-you',
        say:'The scoreboard is showing two variables, and nothing sets them yet. '+
            '<b>if (x position) &gt; 12</b>, then <b>change you by 1</b> — past the '+
            'rival is your point.',
        done:c=>scores(c.ball)>=1,
        pal:only(['data'], ['data.change','data.get']), tab:'data' },
      { want:'serve-again',
        say:'Under it, send the ball back to the middle and serve it again: '+
            '<b>go to x 0 y 0</b> and another <b>point in direction (pick random)</b>.',
        done:c=>count(c.ball,'motion.goto')>=2 && count(c.ball,'op.random')>=2 },
      { want:'score-rival',
        say:'Now the other end, the same way: <b>if (x position) &lt; -12</b>, '+
            '<b>change rival by 1</b>, back to the middle, serve again.',
        done:c=>scores(c.ball)>=2 && count(c.ball,'motion.goto')>=3 },
      run('Press <b>Run</b> and let one past you. The number on the scoreboard is '+
          'the variable your own blocks just changed.',
          'scored',
          c=>c.score.you+c.score.rival>=1),

      /* --------------------------------------------- 6. the opponent */
      Object.assign(chip(RIVAL,
        'Last one. Click <b>Rival</b> — the paddle that plays against you.',
        c=>scores(c.ball)>=2),
        { pal:only(['events'], EV) }),
      pick('event.flag',
        'Click this, so it starts with everything else.',
        c=>hats(c.rival,'event.flag')>0,
        only(['events'], EV), 'events'),
      pick('ctrl.forever',
        'Click <b>forever</b>, then <b>if</b> inside it — you have done this twice now.',
        c=>within(c.rival,'ctrl.forever','ctrl.if'),
        only(['control'], LOOP), 'control'),
      armBool('rival', 'Click the diamond on the <b>if</b>.',
        c=>within(c.rival,'ctrl.forever','ctrl.if') && !uses(c.rival,'op.gt'),
        only(['ops'], MATHS), 'ops'),
      pick('op.gt',
        'Click <b>&gt;</b>. The rival has one question: is the ball above me?',
        c=>uses(c.rival,'op.gt'),
        only(['ops'], MATHS)),
      pick('sense.posOf',
        'Click <b>of</b>, drop it in the left box, set it to <b>y of Ball</b>. '+
        'This is the first time a script has asked about somebody else.',
        c=>blocks(c.rival).some(b=>b.op==='sense.posOf'),
        only(['sensing'], ['sense.posOf']), 'sensing'),
      pick('motion.pos',
        'And <b>y position</b> in the right-hand box — the rival\u2019s own.',
        c=>uses(c.rival,'motion.pos'),
        only(['motion'], ['motion.pos','motion.changeBy','motion.setTo']), 'motion'),
      pick('motion.changeBy',
        'Now <b>change y by</b> inside the <b>if</b>, so it climbs towards the ball.',
        c=>within(c.rival,'ctrl.if','motion.changeBy'),
        only(['motion'], ['motion.pos','motion.changeBy','motion.setTo'])),
      { want:'rival-rest',
        say:'Finish it: a second <b>if</b> with <b>&lt;</b> to go down, and the same two '+
            'edge blocks your own paddle has, so it stays on the court.',
        done:c=>count(c.rival,'ctrl.if')>=4 && count(c.rival,'motion.setTo')>=2 },
      run('Press <b>Run</b> and play it. Every rule of that game is a block you can open.',
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

  const API={ steps, bounces, onTouch, batBounces, wallBounces, SET };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.PONGSTEPS=API;
})(typeof self!=='undefined' ? self : this);
