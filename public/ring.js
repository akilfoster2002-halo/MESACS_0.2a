/* =====================================================================
   RING — the robot, the floor, and the real block editor.

   THE LANGUAGE IN HERE IS THE GAME'S OWN SCRATCH. Not a small one
   written for this screen — the same blocks.js, the same vm.js and the
   same drag-and-drop editor that Free Play and every mission use. The
   robot is a VM actor wearing a .glb, and the thing that moves it is

       when ▶ the game starts
       forever
         if <key [right arrow] pressed?> then
           change x by 0.3

   which is the shape a student will meet in every other kind of Scratch
   for the rest of their life. There was a bespoke `WHEN key → STEP LEFT`
   language here for about an hour. It was smaller and it taught a
   grammar that exists nowhere else, which makes it worse than useless:
   something to unlearn.

   THE CONDITIONAL HAS TO BE INSIDE THE LOOP and that is the lesson. A
   bare `if <key pressed?>` under the hat is checked once, on the frame
   Run was pressed, and then never again — so the robot twitches and
   stops. Wrapping it in `forever` is what makes a control a control, and
   it is a thing a student discovers by getting it wrong first. Nothing
   in here shortcuts that: there is no built-in movement to fall back on.

   WHAT THIS FILE OWNS: the room, the camera, which blocks are on the
   palette, and mounting the VM. WHAT IT DOES NOT: the language, the
   editor, the threads, or what any block means. All of that is upstream
   and shared, which is the point.

   THE BODIES ARE THE REAL BODIES — noisyboy.glb and ambush.glb, the
   rigged exports the arena on RYU uses, reached through the `robots`
   costume shelf. Wearing one is `become a [Noisy Boy]`, so changing
   robot is itself a block.
   ===================================================================== */
window.RING = (function(){
  const $ = s => document.querySelector(s);
  const RB = ()=>window.ROBOTS;
  const T  = s => (window.t ? t(s) : s);

  /* Its own project slot, so what a student builds in here survives and
     does not land in the Free Play sandbox. */
  const SLOT='dq_ring';
  const ACTOR='Robot';

  /* ------------------------------------------------------- the palette
     Not "all of Scratch" and not a token handful. The rule for what is on
     here is that the room contains ONE ROBOT, A FLOOR AND A KEYBOARD, and
     every block has to have a job in that room — AND its partners have to
     be here with it. A palette with half a family on it is worse than one
     without the family at all, because the student goes looking for the
     rest and concludes they have missed something.

     THE PAIRINGS, which are the whole reason this list is not longer or
     shorter than it is:

       change x by  ↔  set x to  ↔  x position
         Somewhere to nudge it, somewhere to put it, and a way to read
         where it ended up. Two out of three is a dead end.

       turn  ↔  point in direction  ↔  direction
         `turn` with no readout is a block whose effect you can only
         guess at. And `turn` + `move` is the other way of getting about
         — the turtle one — next to the co-ordinate one. `point in
         direction` is the third of that family and the one a child
         reaches for first: `turn` changes the facing BY an amount, this
         one says what the facing IS, and `direction` reads it back.

       <  =  >
         Find two of these and you will hunt for the third.

       and  or  not
         Likewise, and the moment anybody wants two keys at once they
         need the first one.

       forever  ·  repeat  ·  repeat until
         The three shapes a loop comes in, and the last one shares its
         boolean slot with `if`, so a condition a student wrote for one
         drops straight into the other.

       say  ↔  x position
         `say (x position)` is how a student finds out what the number
         actually is. It is the debugger, and it is one block.

     WHAT IS DELIBERATELY ABSENT:

       touching? · distance to · point towards — every one of them needs
         a SECOND object, and there is one robot in here. A sensing block
         that can only ever answer about nothing is a trap.

       become a [costume] — rigged costumes do not instance in this game
         (see costumes.js), so this block would hand a student a robot
         that silently renders in the wrong place at the wrong size.

       variables, lists, custom blocks, broadcast, clones — real and
         wanted, and all of them answers to questions this room has not
         asked yet. They come with something to count and somebody to
         talk to.

     Adding a block is a row here. Adding a block WITH NO PARTNER is how
     this list rots, and there is a test that says so. */
  const PALETTE = {
    cats:['events','control','motion','looks','sensing','ops','data','my'],
    ops:[
      /* how a script starts, and how objects tell each other things */
      'event.flag','event.key','event.send','event.recv',
      /* the shapes it is built out of */
      'ctrl.wait','ctrl.repeat','ctrl.forever',
      'ctrl.if','ctrl.ifelse','ctrl.repeatUntil','ctrl.waitUntil','ctrl.stop',
      /* what a robot can do, and how to read what it did */
      'motion.move','motion.turn','motion.face','motion.changeBy','motion.setTo',
      'motion.goto','motion.glide','motion.pos','motion.dir',
      /* how it tells you what it thinks */
      'looks.say','looks.sayFor',
      /* what it can feel — two of these need the dummy, which is why
         they were off the palette until there was one */
      'sense.key','sense.touch','sense.dist','sense.posOf','sense.timer','sense.resetTimer',
      /* what it can work out */
      'op.add','op.sub','op.lt','op.eq','op.gt','op.and','op.or','op.not','op.random',
      /* what it can REMEMBER, which is the whole of `guard` and `dodging` */
      'data.set','data.change','data.get',
      /* and what it can be taught to do — an attack is one of these */
      'my.call'
    ]
  };
  /* The first of these that exists in the model is played while the
     robot is travelling. None of them exist today — see the README. */
  const WALK_CLIPS = ['walk','Walk','walking','strafe','Strafe','run','Run'];
  const IDLE_CLIP  = 'idle';

  /* Everything that belongs to walking around a planet and not to
     standing in this room. It is a named list because it has to be put
     back on more than once — see tick(): closing the editor un-hides
     some of these on its own. */
  /* NOT #keys. That one is the hint bar along the bottom, and it is the
     ring's own — keyHint() writes the line about the forever loop into
     it. Hiding it takes the one sentence this room most wants on screen.
     CODER.hide() restoring it is right here as well as in Free Play. */
  const HIDE=['#mapwrap','#health','#skill','#trigger','#objectives',
              '#crosshair','#focus','#briefing'];

  let on=false, wasFP=null, camX=0, camY=0, spec=null, axisRoot=null;
  let flat=false, roomCam=null;
  let fighting=false, over=null, banner='', rang=-1;

  /* ------------------------------------------------------- the stages
     WHICH ROOM OF THE FIVE YOU ARE IN. The ring used to open on a fight;
     it opens on whichever stage you have reached, and the stage decides
     the palette, whether Ambush is in the room at all, and what has to
     happen before the next one unlocks. See stages.js.

     `run` is everything a stage's tests are allowed to ask about the
     world, and it is cleared every time Run is pressed — a stage is
     judged on one run of the program, not on everything that has ever
     happened in the room. */
  const ST = ()=>window.STAGES;
  let stage=0, cleared=false;
  let run=fresh();
  function fresh(){
    return { frames:{ left:0, right:0, in:0, out:0 },
             gapMin:Infinity, said:false, won:false, readFoe:false,
             swings:{ asked:0, landed:0, broke:0, far:0 } };
  }
  const spot = () => ST() ? ST().byIndex(stage) : null;
  /* Everything a step is allowed to ask about the world.

     EVERY FIELD IS A GETTER, and that is the whole design of it. COACH is
     handed this object ONCE, when the walkthrough starts, and then asks
     it the same questions sixty times a second for the next ten minutes.
     Built with Object.assign it was a photograph: the frame counts were
     the counts at the moment the student walked in — zero — and stayed
     zero however far the robot ran, so the last step of every stage could
     never come true. Worse, it was silent: the steps that read the SCRIPT
     kept working, because those went and looked the actor up again.

     It also means `run` can be replaced wholesale when a new run starts
     without anything going stale. */
  function ctx(){
    const me = () => VM.actorByName(ACTOR);
    return {
      get me(){ return me(); },
      get actor(){ return me(); },
      get foe(){ return VM.actorByName((window.TEMPLATES||{}).FOE); },
      get frames(){ return run.frames; },
      get swings(){ return run.swings; },
      get gapMin(){ return run.gapMin; },
      get said(){ return run.said; },
      get won(){ return run.won; },
      get readFoe(){ return run.readFoe; },
      uses:  op => ST().uses(me(), op),
      reads: v  => ST().reads(me(), v),
      writes:v  => ST().writes(me(), v),
      host: ()=> (window.CODER && CODER.open) ? CODER.coachHost() : null,
      finish: T('That is the whole of it. Take it again, or take the next one.'),
      onStep: onStep
    };
  }

  /* ------------------------------------------------------------ start */
  /* WHICH MISSION, EVERY TIME. Nothing is stored, so the stage cannot be
     resumed — it is chosen on the way in, in the pit, and this room has
     never heard of the one before it. */
  function start(robotId, addTemplates, stageIx){
    stop();
    on=true;
    stage=Math.max(0, Math.min(ST()?ST().LAST:0, stageIx|0));
    spec=RB().get(robotId);
    camX=0; camY=spec.height/2;

    G.running=true; G.hudOwner='ring'; G.missionId='ring'; G.room=null;
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.MENU) MENU.hideAll();
    if(window.AVATAR) AVATAR.detach();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    if(window.GUN) GUN.carried(false);
    HIDE.forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    $('#hud').classList.remove('hidden');
    $('#ring').classList.remove('hidden');
    $('#ringKeys').classList.remove('hidden');
    const ob=$('#ringOpen');
    if(ob){ ob.classList.remove('hidden'); ob.onclick=()=>{ if(window.CODER) CODER.toggle(); }; }
    const fb=$('#ringFlat');
    if(fb){ fb.classList.remove('hidden'); fb.onclick=()=>flatten(!flat); }
    flatten(false);
    legend();

    build();

    /* SAY WHICH PROJECT BEFORE MOUNTING IT. enter() is what opens the
       slot, so useSlot has to come first or the ring opens whatever this
       browser last had in the sandbox. */
    /* NOTHING IS KEPT. A mission opens the same empty room every time —
       no half-written script from last lesson, nothing somebody else left
       on the floor, and no way for step one to be talking about a program
       that is already finished. It also means a student can wreck it
       completely and the cure is to walk out and walk back in. */
    VM.useScratch();
    forget();
    VM.enter(G.roomGroup);
    const bot=ensureRobot();
    given(bot);
    const foe=ensureFoe();
    (addTemplates||[]).forEach(id=>install(id, bot));
    Object.keys(rigs).forEach(k=>delete rigs[k]);
    /* On their marks with full bars, before a single script runs — so
       the HUD is never showing last round's numbers while the pit's
       words are still on screen. */
    bell(bot); if(foe) bell(foe);

    if(window.CODER){
      CODER.restrict(palette());
      CODER.setActor(bot);
    }
    run=fresh(); cleared=false; seenRun=-1; rang=-1; lastPos=null;
    /* A fresh room is a fresh walkthrough, so the shelf starts narrow
       again — nothing in here is kept, including having been here. */
    ranOnce=false;
    hint();
    card();
    hud();
    walk();
  }
  /* AND THE OLD ONES GO. Earlier builds of this room kept a project and a
     stage number in the browser, and a student who used one still has
     them — a whole saved script sitting under a promise that nothing is
     saved. Swept once on the way in rather than left to rot, because
     "nothing is kept" is not true while the last thing that was kept is
     still there. */
  const STALE=['dq_ring','dq_ring_stage','dq_ring_far'];
  function forget(){
    STALE.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
    if(window.PROGRESS){ try{ PROGRESS.set('ring_stage',undefined);
                              PROGRESS.set('ring_far',undefined); }catch(e){} }
  }

  /* The blocks this stage hands over. Falls back to the whole ring
     palette if stages.js is missing, because a room with no blocks in it
     is a worse failure than a room with too many. */
  function palette(){
    return ST() ? Object.assign({}, ST().palette(stage)) : PALETTE;
  }

  /* One robot, wearing what the pit picked. Kept across visits rather
     than rebuilt, because the scripts on it are the student's work and
     a fresh actor every time would throw them away. */
  /* WHAT THE MISSION HANDS YOU. Not a save and not a resume: the same
     blocks in the same room on every entry, put there the way the robot
     and the dummy are. A stage that starts from what the one before it
     taught is a stage that never marches a student back through it. */
  function given(bot){
    const s=spot();
    bot.scripts = (s && s.start) ? JSON.parse(JSON.stringify(s.start())) : [];
  }
  function ensureRobot(){
    let bot = VM.actorByName(ACTOR);
    if(!bot){
      /* Anything already in this slot that is not the robot is the
         starter object every empty project gets. It is not wanted here —
         one body on the floor, and it is the one you picked. */
      VM.project.actors.slice().forEach(a=>VM.delActor(a));
      bot = VM.addActor({ name:ACTOR, dir:0 });
    }
    /* BACK ON ITS MARK, EVERY TIME YOU WALK IN. The scripts are the
       student's work and are never touched; where the robot is standing
       is not — it is wherever last lesson's `change z by 40` left it, and
       a robot that starts forty units above the camera looks like a robot
       that failed to load.

       y IS HALF ITS HEIGHT because the body below is centred on the
       actor, the way every costume in this game is. */
    bot.size=spec.height;
    bot.x=0; bot.y=spec.height/2; bot.z=0; bot.dir=0;
    /* dress() TAKES THE COSTUME AS ITS SECOND ARGUMENT and assigns
       String(costume), so calling it with one leaves the actor wearing
       the literal string "undefined" — not a costume, so it falls back
       to a cube. Only when it CHANGES, because dress() rebuilds the
       mesh and that would throw the mixer away every time you walk in. */
    if(bot.shape!=='robots/'+spec.id) VM.dress(bot, 'robots/'+spec.id);
    /* AND THIS IS THE MARK, not just where it happens to be standing.
       addActor took its home snapshot three lines up, when the robot was
       still a one-unit cube at y 1 — so without this, ↺ hands back a
       cube-sized Noisy Boy half-sunk into the floor, and the student has
       to leave the room and come back to get their robot's size again. */
    VM.setHome(bot);
    VM.sync(bot);
    return bot;
  }

  /* ---------------------------------------------------- the opponent
     AMBUSH IS AN ACTOR LIKE ANY OTHER, and that is the point: a student
     can select it in the editor and read every block of its strategy.
     An opponent you can read is a worked example that fights back.

     Its scripts are written once, when it is first made, and then they
     are the student's to change like anything else — nerf it, study it,
     or hand it a guard it does not have. */
  function ensureFoe(){
    const T=window.TEMPLATES; if(!T) return null;
    const mode=(spot()||{}).foe || 'live';
    let f=VM.actorByName(T.FOE);

    /* STAGE ONE IS AN EMPTY ROOM. Learning that a conditional has to be
       inside a loop is hard enough without something walking at you
       while you do it, and a body standing there doing nothing invites a
       student to spend the stage trying to hit it. */
    if(mode==='none'){ if(f) VM.delActor(f); return null; }

    if(!f) f=VM.addActor({ name:T.FOE, dir:0 });

    /* A DUMMY IS THE SAME ACTOR WITH NO SCRIPTS ON IT. Not a different
       object and not a special case in the referee — it takes punches,
       flashes when it is hit and reports its numbers exactly as it will
       in the fight. It simply never asks for anything, because nothing
       is telling it to. Its strategy arrives in one piece at stage 5,
       which is also when it becomes worth reading. */
    if(mode==='live'){
      T.aiProcs().forEach(p=>{
        if(!VM.project.procs.find(x=>x.name===p.name))
          VM.project.procs.push(JSON.parse(JSON.stringify(p)));
      });
      if(!(f.scripts||[]).length)
        f.scripts=T.aiScripts().map((sc,i)=>
          ({ id:'ai'+i, hat:JSON.parse(JSON.stringify(sc.hat)),
                        body:JSON.parse(JSON.stringify(sc.body)) }));
    } else {
      f.scripts=[];
    }

    const fs=RB().get('ambush');
    f.size=fs.height; f.x=10; f.y=fs.height/2; f.z=0; f.dir=0;
    if(f.shape!=='robots/ambush') VM.dress(f, 'robots/ambush');
    VM.setHome(f);                 // its corner of the ring, same as the robot's
    VM.sync(f);
    return f;
  }

  /* ---------------------------------------------------- the templates
     Installed as ORDINARY BLOCKS and then forgotten about. Nothing here
     marks them, nothing treats them specially afterwards, and a student
     can rename, rewire or delete any of it — which is the only way a
     worked example is worth having.

     Installing twice is the thing to guard against, because the pit is a
     screen you come back through. A template whose function already
     exists is already in; one that only adds a script is checked by its
     hat instead. */
  function install(id, bot){
    const T=window.TEMPLATES, t=T && T.byId(id);
    if(!t || !bot) return false;
    if(has(t, bot)) return false;

    /* A student's own variables belong to the FIGHTER, not the project —
       `guard` is a fact about you, and the opponent has its own. That is
       what makes `if ‹guard = 1›` mean the right thing inside either
       one's scripts. */
    (t.vars||[]).forEach(v=>{ if(!(v in bot.vars)) bot.vars[v]=0; });
    (t.procs||[]).forEach(p=>{
      if(!VM.project.procs.find(x=>x.name===p.name))
        VM.project.procs.push(copy(p));
    });
    (t.scripts||[]).forEach(sc=>{
      bot.scripts=bot.scripts||[];
      bot.scripts.push({ id:Date.now()+Math.random(), hat:copy(sc.hat), body:copy(sc.body) });
    });
    VM.save();
    return true;
  }
  const has = (t, bot) => (t.procs||[]).length
    ? (t.procs||[]).some(p=>VM.project.procs.find(x=>x.name===p.name))
    : (bot.scripts||[]).some(sc=>(t.scripts||[]).some(x=>
        sc.hat && x.hat && sc.hat.op===x.hat.op &&
        JSON.stringify(sc.body)===JSON.stringify(x.body)));
  /* Templates are shared data and the project is about to be edited, so
     what goes in is a copy. Without this, installing the same template
     twice would be editing the same blocks. */
  const copy = o => JSON.parse(JSON.stringify(o));

  /* ======================================================= THE REFEREE
     The half of the fight that is not up to anybody's code.

     It owns `health` and `stamina` on both fighters: it sets them at the
     bell, tops stamina up every tick, and STAMPS THEM BACK every tick
     afterwards. A script can `set [health] to 999` and it will hold for
     one twentieth of a second, which is the fastest lesson in here about
     what read-only means.

     And it resolves swings. A fighter asks for one by raising a flag —
     `set [light] to 1` — and the referee lowers it again, charges the
     stamina, measures the gap, checks the other one's guard and takes
     the damage off. Nothing a student writes deals damage directly,
     because a game where your own program says how hard you hit is not
     a game. */
  function referee(dt){
    const T=window.TEMPLATES, R=window.RULES;
    if(!T || !R) return;
    const me=VM.actorByName(T.ME), foe=VM.actorByName(T.FOE);
    if(!me) return;

    /* WATCHING, WHICH IS HOW A STAGE IS MARKED. Every frame the robot is
       under its own program, count which way it went — frames and not
       distance, because the difference between a control and a twitch is
       how many frames in a row it happens for, and `change x by 40` in a
       conditional that is checked once must not read as success. */
    watch(dt, me, foe);
    if(!foe) return;

    /* The bell. VM.running goes true the moment Run is pressed, so this
       is where a round starts — no separate button, and no way to be
       fighting with last round's health. */
    /* THE BANNER COUNTS DOWN FIRST, and before the running check,
       because by then nothing IS running — the knockout stops the
       scripts where they stand. It has to: while this was counting down
       with the scripts still going, they carried on walking with no
       referee to hold them on the floor, and the winner strolled to x=32
       during their own victory lap. */
    if(over!==null){
      over-=dt;
      if(over<=0){ over=null; banner=''; }
      return;
    }
    /* The bell, on the same signal and for the same reason — a restart
       used to leave both fighters on the health the last one ended on. */
    if(VM.running && (!fighting || rang!==VM.runId)){
      fighting=true; rang=VM.runId; bell(me); bell(foe);
    }
    if(!VM.running){ fighting=false; return; }

    /* RESOLVE EVERYTHING FIRST, STAMP AFTERWARDS, and the two have to be
       separate passes. Stamped inside the loop, a fighter's numbers were
       written before the second fighter had swung — so the punch that
       took somebody to zero left `(health)` reading 6 for another tick,
       and a script checking its own health got an answer that was true
       a twentieth of a second ago. One pass to work out what happened,
       one to publish it. */
    [[me,foe],[foe,me]].forEach(([a,b])=>{
      const st=state(a);
      st.stamina=R.regenerated(st.stamina, dt);
      R.SIGNALS.forEach(sig=>{
        if(!a.vars[sig]) return;
        a.vars[sig]=0;                                   // the flag is lowered first
        const gap=Math.abs((+a.x||0)-(+b.x||0));
        const r=R.resolve(sig, st.stamina, gap, !!b.vars.guard);
        st.stamina=Math.max(0, st.stamina-r.cost);
        /* The referee's verdict is the only honest record of a punch —
           a stage asking "did one land" must not re-derive it and get a
           different answer from the thing that actually dealt it. */
        if(a===me){
          run.swings.asked++;
          if(r.ok) run.swings.landed++;
          else if(r.why==='no-stamina') run.swings.broke++;
          else if(r.why==='too-far')    run.swings.far++;
        }
        /* THE SWING IS DRAWN WHETHER OR NOT IT LANDS — except the one
           that never happened. A punch thrown out of range is a punch you
           watched miss, and that is the feedback; a punch you could not
           afford did not occur at all, and animating it would be the body
           telling a student something the referee did not do. */
        if(r.why!=='no-stamina') strikeOn(a, SWING[sig]||SWING.light, HOLD[sig]||HOLD.light);
        if(r.ok){
          state(b).health=R.clampHealth(state(b).health - r.damage);
          hitFx(b, r.why);
          strikeOn(b, r.why==='guarded' ? 'block' : 'hit',
                      r.why==='guarded' ? HOLD.guard : HOLD.hurt);
        }
      });
    });
    [me,foe].forEach(a=>{
      a.vars.health=Math.round(state(a).health);
      a.vars.stamina=Math.round(state(a).stamina);
    });

    /* They cannot pass through each other and they cannot leave the
       floor. See rules.js — a constant "walk toward him" is right until
       they swap sides, and then it is a constant "run away". */
    const sep=R.separate(+me.x||0, +foe.x||0);
    me.x=sep.a; foe.x=sep.b;
    VM.sync(me); VM.sync(foe);

    /* A TRAINING DUMMY DOES NOT GO DOWN. It flashes, its numbers move
       for the frame, and then it is upright again — so a student
       practising the same punch twenty times is never interrupted by a
       victory they did not want and a five-second reset. */
    if((spot()||{}).foe==='dummy'){
      state(foe).health=R.RULES.health;
      foe.vars.health=R.RULES.health;
    }

    if(state(me).health<=R.RULES.knockout || state(foe).health<=R.RULES.knockout){
      const meDown=state(me).health<=R.RULES.knockout;
      const win = meDown && state(foe).health<=R.RULES.knockout ? 'a draw'
                : meDown ? (RB().get('ambush').name+' wins') : 'you win';
      VM.actorByName(meDown?T.FOE:T.ME);
      /* The knockout gets its whole clip. Nothing is waiting on the body
         afterwards — the scripts are stopped and the round is over. */
      strikeOn(meDown?me:foe, 'floored', HOLD.down);
      if(!meDown) run.won=true;
      announce(win);
      over=R.RULES.reset;
      /* Stop everything where it is. A round that is over is over — the
         losing script does not get to keep walking. */
      VM.stopAll();
      fighting=false;
    }
  }
  /* ---------------------------------------------------- the watcher
     WHAT THE STAGE TESTS GET TO ASK ABOUT. Counted here, once a frame,
     rather than worked out afterwards from the finished world — because
     "got within a punch of him at some point" and "is within a punch of
     him now" are different questions, and only the first one is fair to
     a program that closed in, hit, and backed off again.

     Only while the program is RUNNING. A robot the student drags around
     with the camera, or one left where last run finished, has not done
     anything: a stage is passed by a program, or it is not passed. */
  let lastPos=null, seenRun=-1;
  function watch(dt, me, foe){
    /* HAVING READ THE OPPONENT is a thing that happened, not a thing that
       is true — you are back on your own robot afterwards, which is where
       you started. Recorded here so a step can wait for it. */
    if(window.CODER && CODER.actorName && CODER.actorName()==='Ambush') run.readFoe=true;
    /* PRESSING RUN IS THE START OF AN ATTEMPT, and `running` cannot tell
       you when one begins: pressing Run again while a program is already
       going throws the threads away and starts over, and the flag is
       true either side of that. So the VM counts its runs and this
       watches the count. Without it a stage carried the last attempt's
       frames and punches forward and ticked itself on the strength of a
       program the student had already rewritten. */
    if(VM.running){
      if(seenRun!==VM.runId){
        seenRun=VM.runId; run=fresh(); lastPos=null;
        /* AND THE SHELF OPENS. Hung off the same count the attempts are,
           because "they have pressed Run" is exactly what that count
           means — and because this is the one place in the room that
           already knows, whichever button or key started it. */
        openShelf();
      }
      const p={ x:+me.x||0, y:+me.y||0, z:+me.z||0 };
      if(lastPos){
        /* A hair of movement is float noise, not a step. */
        const dx=p.x-lastPos.x, dz=p.z-lastPos.z, eps=0.0005;
        if(dx>  eps) run.frames.right++;
        if(dx< -eps) run.frames.left++;
        if(dz>  eps) run.frames.out++;        // toward the camera: the language's +y
        if(dz< -eps) run.frames.in++;
      }
      lastPos=p;
      if(me.saying) run.said=true;
      if(foe) run.gapMin=Math.min(run.gapMin, Math.abs((+me.x||0)-(+foe.x||0)));
    } else {
      lastPos=null;
    }

    /* WHO DECIDES A STAGE IS FINISHED. Not this — COACH does, because a
       stage IS its list of steps and the last step is the finish. The
       ring hears about it through onStep(null), which is also what takes
       the rails off. All the watcher does is keep the numbers those
       steps read. */
  }
  /* A stage is finished. The next one is NOT entered here — a student
     who has just made something work should get to watch it work, and be
     the one who says when they are done with it. */
  /* A stage is finished when its last step is. COACH says so; the ring
     just stops asking and offers the way out. */
  function clear(){
    if(cleared) return;
    cleared=true;
    const s=spot();
    announce(T('STAGE')+' '+s.n+' \u2014 '+T(s.name)+' \u00b7 '+T('CLEARED'));
    card();
  }
  /* Leaving is the only way on, because nothing here is kept: the way to
     stage two is to walk out and pick stage two, in a room that has never
     seen your stage-one script. */
  function done(){ leave(); }

  /* The referee's own copy, which is the one that counts. The actor's
     vars are a window onto it and nothing more. */
  const book={};
  const state = a => (book[a.name] = book[a.name] || { health:0, stamina:0 });
  function bell(a){
    const R=window.RULES;
    const st=state(a);
    st.health=R.RULES.health; st.stamina=R.RULES.stamina;
    a.vars.health=st.health; a.vars.stamina=st.stamina;
    R.SIGNALS.forEach(k=>{ a.vars[k]=0; });
    ['guard','dodging','swinging'].forEach(k=>{ if(k in a.vars) a.vars[k]=0; });
  }
  /* A hit has to be visible or the numbers are the only evidence. */
  function hitFx(who, why){
    const rec=rigOf(who);
    if(rec) rec.flash=why==='guarded'?0.12:0.26;
  }

  /* ------------------------------------------------------- the body
     THE RING DRAWS ITS OWN ROBOT, and it is worth saying why rather than
     leaving it looking like distrust of the costume system.

     COSTUMES cannot instance a rigged model. Object3D.clone() copies a
     SkinnedMesh and its bones but leaves the copy pointing at the
     PROTOTYPE's skeleton, so the body is drawn wherever those bones are
     and takes no notice of the clone's transform. A four-metre robot
     came out four hundred and sixty and stood somewhere else; a Box3
     measured it as correct the whole time, which is what made it take an
     hour. Fixing that properly is a skeleton-aware clone in costumes.js
     and a change every mode in the game inherits — not something to do
     on the way past.

     So the actor carries the POSITION and the scripts, and this carries
     the BODY, and tick() copies one onto the other. Which also means the
     mixer is ours, which is what the animation clips will need. */
  /* --------------------------------------------------- the animation
     THE BODIES ARE COSTUMES NOW. This file used to hold a GLTFLoader of
     its own, because COSTUMES could not instance a rigged model — every
     clone kept the prototype's skeleton and was drawn wherever those
     bones were, ignoring its own position and scale. That is fixed in
     costumes.js, so the robots are worn like any other costume and the
     VM moves them like any other object.

     WHAT IS STILL OURS IS THE MIXER. An AnimationClip is shared and
     immutable — COSTUMES hands the same ones to everybody — but an
     AnimationMixer is per-object, because two fighters are not in the
     same pose. So this keeps one per actor and builds it the first time
     that actor's costume has actually arrived, which is some frames
     after `dress()` is called. */
  const rigs={};
  function rigOf(a){
    if(!a || !a.mesh) return null;
    let rec=rigs[a.name];
    if(rec && rec.root && rec.root.parent) return rec;
    let root=null;
    a.mesh.traverse(o=>{ if(o.isSkinnedMesh && !root) root=o; });
    if(!root) return null;
    /* The mixer is made on the costume's own root, not the skinned mesh,
       so clips that animate bones above it still bind. */
    let top=root; while(top.parent && top.parent!==a.mesh) top=top.parent;
    rec=rigs[a.name]={ root:top, mixer:new THREE.AnimationMixer(top),
                       clips:COSTUMES.clips(a.shape), cur:null, curName:null, flash:0 };
    play(rec, IDLE_CLIP, 0);
    return rec;
  }

  function play(rec, name, fade){
    if(!rec || !rec.mixer || rec.curName===name) return;
    const clip=(rec.clips||[]).find(c=>c.name===name);
    if(!clip) return;
    const next=rec.mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
    if(rec.cur) rec.cur.fadeOut(fade===undefined?0.18:fade);
    rec.cur=next; rec.curName=name;
  }
  /* The one place the missing walk cycle is handled. The moment a clip
     with one of these names exists in the .glb it is found and played
     while a fighter is moving. That is the whole integration. */
  const walkClip = rec => WALK_CLIPS.find(n=>(rec.clips||[]).some(c=>c.name===n)) || null;

  /* ------------------------------------------------- the one-shots
     A PUNCH IS NOT A LOOP. idle and walk run until something else takes
     over; a jab happens once and the body goes back to what it was
     doing, so these play with LoopOnce and hold the body for a moment
     afterwards rather than being cross-faded away on the very next frame
     by whichever of idle or walk drive() thinks is right.

     THEY ARE CAPPED, and that is not tidiness. `hit` is five and a half
     seconds of staggering and `cross` is two — long enough that a fighter
     throwing punches at a sensible rate would spend the whole round in
     an animation that started three punches ago, looking like it had
     stopped responding. The cap lets the clip start, read as what it is,
     and give the body back. */
  const HOLD={ light:0.55, heavy:0.85, hurt:0.5, guard:0.6, down:2.4 };
  const SWING={ light:'jab', heavy:'cross' };
  function strike(rec, name, hold){
    if(!rec || !rec.mixer) return;
    const clip=(rec.clips||[]).find(c=>c.name===name);
    if(!clip) return;
    const act=rec.mixer.clipAction(clip);
    act.reset().setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished=true;
    act.setEffectiveWeight(1).fadeIn(0.06).play();
    if(rec.cur && rec.cur!==act) rec.cur.fadeOut(0.06);
    rec.cur=act; rec.curName=name;
    rec.hold=Math.min(clip.duration, hold||clip.duration);
  }
  /* by actor, because the referee resolves before the bodies are drawn */
  function strikeOn(a, name, hold){ const rec=rigOf(a); if(rec) strike(rec, name, hold); }

  function stop(){
    if(!on) return;
    on=false;
    if(window.COACH) COACH.stop();
    if(window.CODER){
      CODER.walking(false);
      if(CODER.open) CODER.hide();
      CODER.restrict(null);       // hand the whole palette back to Free Play
    }
    if(window.VM){ VM.stopAll(); VM.save(); VM.leave(); }
    Object.keys(rigs).forEach(k=>delete rigs[k]);
    fighting=false; over=null; banner='';
    Object.keys(book).forEach(k=>delete book[k]);
    $('#ring').classList.add('hidden');
    flatten(false);
    ['#ringFeed','#ringKeys','#ringAxes','#ringStage','#ringOpen','#ringFlat']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    ['#objectives','#crosshair','#briefing']
      .forEach(s=>{ const e=$(s); if(e) e.classList.remove('hidden'); });
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
    if(window.keyHint) keyHint(null);
    if(window.AVATAR) AVATAR.attach();
  }

  /* ================================================== building the room */
  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null; G.ground=()=>0;
    G.scene.background=new THREE.Color(0x120e22);
    G.scene.fog=new THREE.Fog(0x120e22, 60, 200);
    G.camera.near=0.3; G.camera.far=400; G.camera.updateProjectionMatrix();
    G.camera.up.set(0,1,0);
    const world=G.roomGroup;

    const F=16;
    const floor=new THREE.Mesh(new THREE.BoxGeometry(F*2+10, 1, 26),
      new THREE.MeshLambertMaterial({color:0x2b2444}));
    floor.position.y=-0.5; floor.userData.flat=true;
    floor.receiveShadow=true;
    world.add(floor);

    /* ------------------------------------------------------- the grid
       ONE SQUARE IS ONE UNIT, which is what makes the number in the block
       mean something you can see. `change x by 1` crosses one square;
       `change x by 0.2` takes five frames to do it. A floor with nothing
       on it gives a student no way to tell those apart — it used to have
       stripes one way only, so the depth the language now calls y was a
       direction you could move in and not measure.

       EVERY FIFTH LINE IS BRIGHTER and the middle two are brightest, so
       a distance is counted in fives rather than by touching the screen.
       One LineSegments for the lot rather than a mesh per line: this used
       to be seventeen boxes and a grid this fine would have been two
       hundred.

       Drawn a hair above the floor. Level with it they fight over the
       same pixels and the whole grid crawls as the camera moves. */
    grid(world, F, 13);
    /* And posts up the back wall, so `change z by` has something to be
       measured against too. Up is a direction you can only see moving in
       if there is something standing still beside you. */
    for(let h=2;h<=12;h+=2){
      const m=new THREE.Mesh(new THREE.BoxGeometry(F*2+6, 0.08, 0.08),
        new THREE.MeshBasicMaterial({color:0x342b50}));
      m.position.set(0, h, -11); world.add(m);
    }

    axisRoot = axes(world, -7, 6.5);

    world.add(new THREE.AmbientLight(0xb9a8ff, 0.45));
    const key=new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(12, 28, 18);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    const sc=key.shadow.camera;
    sc.left=-F-8; sc.right=F+8; sc.top=22; sc.bottom=-22; sc.near=1; sc.far=80;
    sc.updateProjectionMatrix();
    key.shadow.bias=-0.0006; key.shadow.normalBias=0.4;
    world.add(key); world.add(key.target);
    const fill=new THREE.DirectionalLight(0x8fa8ff, 0.4);
    fill.position.set(-16, 10, -14); world.add(fill);

    G.scene.updateMatrixWorld(true);
  }

  /* ------------------------------------------------------- the grid */
  /* Light enough to count against a floor this dark. The old stripes
     were 0x3b3059 on 0x2b2444 and nearly invisible from above, which is
     the view the grid is most FOR. */
  const GRID={ minor:0x4a3f73, major:0x6f5da8, axis:0x8ff0ff };
  function grid(world, halfX, halfZ){
    const pts=[], col=[], c=new THREE.Color();
    const push=(x1,z1,x2,z2,hex)=>{
      c.setHex(hex);
      pts.push(x1,0.015,z1, x2,0.015,z2);
      col.push(c.r,c.g,c.b, c.r,c.g,c.b);
    };
    const shade = i => i===0 ? GRID.axis : (i%5===0 ? GRID.major : GRID.minor);
    for(let x=-halfX;x<=halfX;x++) push(x,-halfZ,x,halfZ, shade(x));
    for(let z=-halfZ;z<=halfZ;z++) push(-halfX,z,halfX,z, shade(z));
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
    const m=new THREE.LineSegments(g,
      new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.85 }));
    m.userData.flat=true;
    world.add(m);
    return m;
  }

  /* ------------------------------------------------ the three axes
     A NUMBER IN A BLOCK IS A DIRECTION, and until you can see which
     direction, `change y by 1` and `change z by 1` are the same block
     with a different letter. The stripes and the wall posts already
     measure two of them; this says which is which, and names the third,
     which has nothing to measure it because it points at the camera.

     Stood in the near corner rather than at the origin: the origin is
     where the robot is, and an arrow through a robot's shins is an arrow
     nobody can read. Drawn from BLOCKS.AXES so the arrow and the block
     can never disagree about which way y goes. */
  function axisLabel(text, hue){
    const c=document.createElement('canvas'); c.width=128; c.height=128;
    const g=c.getContext('2d');
    g.fillStyle='#'+hue.toString(16).padStart(6,'0');
    g.font='bold 92px '+(window.uiFont?uiFont():'monospace');
    g.textAlign='center'; g.textBaseline='middle';
    g.fillText(text, 64, 68);
    const tex=new THREE.CanvasTexture(c);
    if(THREE.SRGBColorSpace) tex.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    sp.scale.set(1.3,1.3,1);
    return sp;
  }
  /* The same three, in words, for the one that points at the camera and
     so cannot be drawn. Reads off BLOCKS.AXES like the arrows do. */
  function legend(){
    const el=$('#ringAxes'); if(!el) return;
    const hex=h=>'#'+h.toString(16).padStart(6,'0');
    el.innerHTML=(window.BLOCKS?BLOCKS.AXES:[]).map(a=>
      `<div class="ring-ax"><i style="background:${hex(a.hue)}"></i>`+
      `<b>${a.v}</b>${T(flat && a.flat ? a.flat : a.say)}</div>`).join('');
    el.classList.remove('hidden');
  }
  function axes(world, x, z){
    /* Short. The y arrow points very nearly at the camera, so every unit
       of it costs almost no screen width and a lot of screen height. */
    const L=2.5, R=0.06;
    const root=new THREE.Group();
    root.position.set(x, 0.06, z);
    /* a small pale cube where the three meet, so the corner reads as a
       corner and not as three unrelated sticks */
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),
      new THREE.MeshBasicMaterial({color:0xece6ff})));

    (window.BLOCKS ? BLOCKS.AXES : []).forEach(a=>{
      /* WHICH WAY THE ARROW POINTS IS WHICH WAY THE BLOCK MOVES. AXES
         holds the engine field each student axis lives in AND the sign
         along it, and both have to be used: y is the engine's z run
         backwards, so an arrow drawn from the field alone would point at
         the camera while `change y by 1` went away from it. An arrow
         disagreeing with the block it names is worse than no arrow. */
      const s=(a.sign===undefined?1:a.sign);
      const d=new THREE.Vector3(a.field==='x'?s:0, a.field==='y'?s:0, a.field==='z'?s:0);
      const mat=new THREE.MeshBasicMaterial({color:a.hue});
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(R,R,L,10), mat);
      /* CylinderGeometry and ConeGeometry both stand up the engine's y,
         so the two that are not up get laid over — and the sign decides
         which end the point is at. */
      if(a.field==='x') rod.rotation.z=-Math.PI/2;
      if(a.field==='z') rod.rotation.x= Math.PI/2;
      rod.position.copy(d).multiplyScalar(L/2);
      root.add(rod);

      const tip=new THREE.Mesh(new THREE.ConeGeometry(R*3.2, 0.5, 12), mat);
      if(a.field==='x') tip.rotation.z=-s*Math.PI/2;
      if(a.field==='y' && s<0) tip.rotation.x= Math.PI;
      if(a.field==='z') tip.rotation.x= s*Math.PI/2;
      tip.position.copy(d).multiplyScalar(L);
      root.add(tip);

      const lab=axisLabel(a.v, a.hue);
      lab.position.copy(d).multiplyScalar(L+0.85);
      root.add(lab);
    });
    world.add(root);
    return root;
  }

  /* ------------------------------------------------------------- tick
     The VM is stepped HERE rather than by the game loop, which only does
     it in the Free Play room. Same call, same threads, same everything —
     the only difference is who owns the floor it is standing on. */
  function tick(dt){
    if(!on) return;
    if(window.VM) VM.step(dt);
    referee(dt);
    if(window.COACH) COACH.tick(dt);
    if(window.CODER) CODER.tick(dt);
    drive(dt);
    camera(dt);
    /* The editor has its own bar across the top and so does this, and
       they were sitting on each other. The editor's wins while it is
       open — it has the Run button on it. */
    const coding=!!(window.CODER && CODER.open);
    const mine=$('#ring');
    if(mine) mine.classList.toggle('hidden', coding);
    if(!coding){
      hud(); card();
      /* AND THE PLANET'S PANELS STAY DOWN. CODER.hide() puts #objectives,
         #keys and #topbar back unconditionally, which is right in Free
         Play and wrong here: closing the blocks with C dropped Senio's
         mission list over the middle of the ring. Re-asserted rather than
         patched into the editor, because the editor is shared and this
         room is the odd one out. */
      HIDE.forEach(sel=>{ const e=$(sel); if(e) e.classList.add('hidden'); });
    }
  }

  /* The VM moves the bodies, because they are costumes on its actors.
     What is left here is which way they face, which clip they are
     playing, and the flash when one of them is hit. */
  function drive(dt){
    const T=window.TEMPLATES; if(!T) return;
    [T.ME, T.FOE].forEach(name=>{
      const a=VM.actorByName(name);
      if(!a || !a.mesh) return;
      /* THEY FACE EACH OTHER, whichever way round they are standing.
         `dir` is the actor's own and a script may set it, so this only
         turns the mesh — a student pointing their robot somewhere with
         `turn` still sees it turn. */
      const other=VM.actorByName(name===T.ME?T.FOE:T.ME);
      if(other) a.mesh.rotation.y =
        (+other.x||0) < (+a.x||0) ? -Math.PI/2 : Math.PI/2;

      const rec=rigOf(a);
      if(!rec) return;
      const p=a.mesh.position;
      const moved=rec.was ? Math.hypot(p.x-rec.was.x, p.y-rec.was.y, p.z-rec.was.z) : 0;
      rec.was={ x:p.x, y:p.y, z:p.z };
      /* A one-shot owns the body until its hold runs out. Without this
         the jab was replaced by idle on the frame after it started, which
         reads as a punch that never happened. */
      if(rec.hold>0) rec.hold-=dt;
      else {
        const w=walkClip(rec);
        play(rec, moved>0.001 && w ? w : IDLE_CLIP);
      }
      rec.mixer.update(dt);

      /* The flash. A number going down in a corner is not evidence a
         punch landed; a body going white for a fifth of a second is. */
      if(rec.flash>0){
        rec.flash=Math.max(0, rec.flash-dt);
        const k=rec.flash;
        rec.root.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive)
          o.material.emissive.setScalar(k*1.6); });
      }
      if(a.bubble) a.bubble.position.y=(+a.size||4)/2 + 0.9;
    });
  }

  /* Side on, framed on BOTH of them — a camera that followed only the
     player would push the opponent off the edge exactly when the gap is
     the thing you are trying to judge. */
  /* ------------------------------------------------------ the 2D view
     LOOKING STRAIGHT DOWN IS THE LANGUAGE'S OWN PICTURE. From up here x
     runs across the screen and y runs up it — the two axes the blocks are
     named for, both in full view and both flat to the camera — and z, the
     height, points at you and is the one thing you cannot see, which is
     exactly what a 2D game is.

     It is the VM's stage camera, not a moved version of the room's. It
     has to be ORTHOGRAPHIC: a flat game is played by reading positions
     off the screen, and under perspective two robots the same distance
     apart are different distances apart depending where they stand. */
  function flatten(on2){
    flat=!!on2;
    const btn=$('#ringFlat');
    if(btn){ btn.classList.toggle('on', flat); btn.innerHTML=flat?'▦ 3D VIEW':'▢ 2D VIEW'; }
    if(flat){
      roomCam = roomCam || G.camera;
      if(window.VM) VM.reframe();
    } else if(roomCam){
      G.camera=roomCam; roomCam=null;
    }
    legend();
  }
  function camera(dt){
    const T=window.TEMPLATES; if(!T) return;
    if(flat){
      /* Re-asked every frame so it follows a resize, and because the
         frame is worked out from where the bodies actually are. */
      G.camera=VM.stageCam(innerWidth/Math.max(1,innerHeight));
      return;
    }
    const a=VM.actorByName(T.ME), b=VM.actorByName(T.FOE);
    const ax=a?+a.x||0:0;
    /* AN EMPTY RING IS FRAMED ON THE ROBOT. Framing on the midpoint of
       two fighters is right for a fight and wrong for stage one, where
       the second fighter does not exist and counts as standing at zero —
       so the robot drifted to the edge of the shot as it walked away
       from a body that was not there. */
    const bx=b?+b.x||0:ax;
    const mid=(ax+bx)/2, gap=Math.abs(ax-bx);
    const ay=a?+a.y||0:2.3;
    const k=Math.min(1, dt*2.2);
    camX += (mid-camX)*k;
    camY += (Math.max(ay,2.3)-camY)*k;
    G.camera.position.set(camX, camY+3.2, 15+Math.min(10, gap*0.6));
    G.camera.up.set(0,1,0);
    G.camera.lookAt(camX, camY, 0);
    /* THE ARROWS RIDE ALONG. Left where they were built they slide out of
       frame the first time the fight moves down the floor, and a direction
       guide you have to go looking for is not a guide. Held a fixed step
       to the left of wherever the camera is looking, so they keep the same
       corner of the screen while staying real geometry in the real room —
       which is the whole reason they are arrows and not a picture. */
    if(axisRoot) axisRoot.position.x = camX - 7;
  }

  /* ---------------------------------------------------------- the HUD
     Both fighters, both numbers. Health and stamina are the referee's,
     so they are shown the way the referee has them rather than the way
     any script left them — and they are the same numbers `(health)` and
     `(stamina)` report inside the blocks, which is the point. */
  function hud(){
    const el=$('#ringA'), T=window.TEMPLATES, R=window.RULES;
    if(!el || !T || !R) return;
    /* NOTHING IS FIGHTING IN STAGE ONE, so a health bar is a number that
       cannot move and a stamina bar is a cost nothing is charging. Both
       arrive with the dummy, which is the stage they start to mean
       something. */
    const top=$('#ringTop');
    if(top) top.classList.toggle('hidden', (spot()||{}).foe==='none');
    const row=(who, label, mine)=>{
      const a=VM.actorByName(who);
      if(!a) return '';
      const st=book[who]||{ health:0, stamina:0 };
      const hp=Math.max(0, Math.round(st.health)), sp=Math.max(0, Math.round(st.stamina));
      const hpc=Math.round(hp/R.RULES.health*100), spc=Math.round(sp/R.RULES.stamina*100);
      return `<div class="ring-side${mine?'':' foe'}">
        <div class="ring-name"><b>${label}</b>
          <small>${fighting?'':'\u2014 '}${(a.scripts||[]).length} ${T2(a.scripts)}</small></div>
        <div class="ring-p ${hp<=30?'low':''}"><span>${T3('HEALTH')}</span>
          <i><b style="width:${hpc}%"></b></i>
          <span style="width:34px;text-align:right">${hp}</span></div>
        <div class="ring-p sta"><span>${T3('STAMINA')}</span>
          <i><b style="width:${spc}%"></b></i>
          <span style="width:34px;text-align:right">${sp}</span></div>
      </div>`;
    };
    el.innerHTML = row(T.ME, spec?spec.name:'YOU', true)
                 + row(T.FOE, RB().get('ambush').name, false)
                 + (banner?`<div class="ring-banner">${banner}</div>`:'');
  }
  const T2 = sc => T((sc||[]).length===1?'script':'scripts');
  const T3 = s => T(s);
  /* Said over the top when a round ends. Not `say` — there is a say() in
     the VM's world and one in this file already, and two of those was
     enough. */
  function announce(text){ banner=text||''; }

  /* ------------------------------------------------------- the card
     WHAT THIS STAGE WANTS, AND HOW FAR YOU ARE. The checklist is the
     important half: a goal is a sentence a student can misread, and a
     row that ticks itself the instant the world satisfies it cannot be.
     They also say, by not ticking, exactly which half is missing — which
     is the difference between "it does not work" and "the robot moves
     right but never left".

     Redrawn on every change rather than every frame; the watcher calls
     it when a stage clears, and hud() is the only thing on a timer. */
  /* Not `esc` — hint() already has a local of that name holding a DOM
     node, and one of them shadowing the other is a trap waiting to be
     stood on. */
  const escHtml = s => String(s==null?'':s).replace(/[&<>"]/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function card(){
    const el=$('#ringStage'); if(!el || !ST()) return;
    const s=spot();
    /* WHAT IS LEFT OF THE CARD. The goal and the reasoning have moved into
       the walkthrough, a sentence at a time, beside the thing they are
       about — so what stays here is a name, a shelf-mark of how far
       through you are, and the door out. Anything longer competes with
       the step for the one thing a student is reading. */
    el.innerHTML=`
      <div class="ring-stage-card" style="--a:${s.a}">
        <div class="ring-stage-head"><span class="ring-stage-em">${s.em}</span>
          <div><b>${escHtml(T(s.name))}</b><small>${escHtml(T(s.teach))}</small></div></div>
        <div class="ring-stage-dots">${s.steps.map((x,k)=>
          `<i class="${k<at()?'on':k===at()?'now':''}"></i>`).join('')}</div>
        ${cleared ? `<button class="btn good small" id="ringNext">${T('DONE \u25b6')}</button>` : ''}
      </div>`;
    el.classList.remove('hidden');
    const nx=$('#ringNext'); if(nx) nx.onclick=done;
  }
  const at = () => (window.COACH && COACH.index!=null) ? COACH.index : 0;

  /* ------------------------------------------------- the walkthrough
     ONE SENTENCE, ONE THING GLOWING, and the step ends when the world
     says it happened. The ring owns none of that — COACH does — so all
     that is here is starting it, giving it somewhere to talk, and doing
     what a step asks of the palette while it is live. */
  let seenCats=[];
  function walk(){
    if(!window.COACH || !ST()) return;
    seenCats=[];
    COACH.stop();
    COACH.start(ST().steps(stage), ctx());
  }
  /* ------------------------------------------- the shelf opens at Run
     THE FIRST RUN ENDS THE NARROWING, AND NOTHING NARROWS IT AGAIN.

     Showing one block at a time is how somebody is shown WHERE a block
     is. It is not how they are kept there, and the difference matters
     the moment the walkthrough stops being the most interesting thing on
     the screen. A student who has pressed Run has watched their own
     program move a robot; the very next thought is a thing they want to
     try, and that thing is never the block the next step happens to be
     about. Leaving the shelf narrow there does not keep them on the
     lesson, it just tells them the game will not let them.

     So Run is the door. Every block in the language is on the shelf
     afterwards — the same shelf Free Play gets, custom blocks and all —
     and the walkthrough carries on pointing, talking and ticking its
     steps beside it. The pointing still works: the step's own block is
     lit up and ringed, which is what made "click this" unambiguous in
     the first place. What it no longer does is take everything else
     away. */
  let ranOnce=false;
  function openShelf(){
    if(ranOnce) return;
    ranOnce=true;
    /* null, not a longer list: that is what the editor already means by
       "no restriction", and it is what hands back the New button and the
       make-a-block row along with the blocks. */
    if(window.CODER) CODER.narrow(null);
  }
  /* A step says which blocks it needs; this is what that means. Narrow on
     purpose: when a step says "click this", it should very often be the
     only thing on the shelf to click — until the first Run, after which
     nothing here touches the palette again. */
  function onStep(s){
    if(!window.CODER) return;
    CODER.walking(!!s);
    if(!s){
      seenCats=[];
      /* The rails come off with the last step. What is left is the whole
         of what the stage was about, so a student can carry on building
         in the room they just learnt in — or, if they have run anything,
         the whole language, which they already had. */
      if(!ranOnce) CODER.narrow(palette());
      clear();
      return;
    }
    /* THE SHELVES ACCUMULATE, THE BLOCKS DO NOT. A step narrows the
       palette to the one block it is asking for — that is what makes
       "click this" unambiguous. But the CATEGORIES a stage has already
       sent a student to have to stay on screen, or "open Sensing" is an
       instruction to click a tab that is not there, and the blocks they
       used two steps ago vanish while they are still looking at them. */
    if(s.pal && !ranOnce){
      (s.pal.cats||[]).forEach(c=>{ if(seenCats.indexOf(c)<0) seenCats.push(c); });
      CODER.narrow({ cats:seenCats.slice(), ops:s.pal.ops||[] });
    }
    /* The tab still opens either way: a step that is about a Sensing
       block should still put Sensing in front of them, whether or not
       the other seven tabs are there too. */
    if(s.tab) CODER.openCat(s.tab);
  }

  /* The one sentence that is worth more than any other on this screen,
     and the reason it is here rather than in a help bubble: a student
     whose robot twitched once and stopped has written the commonest
     Scratch bug there is, and the fix is a shape, not a value. */
  /* The bottom bar used to carry the lesson about the forever loop. The
     walkthrough says that now, at the step it is about, so what is left
     here is the key — and the walkthrough is pointing at the button that
     does the same thing. */
  function hint(){
    const line=`<b>C</b> ${T('open the blocks')}`;
    if(window.keyHint) keyHint(line);
    const esc=$('#escHint'); if(esc) esc.classList.add('hidden');
    const mid=$('#ringKeys');
    if(mid){ mid.innerHTML=''; mid.classList.add('hidden'); }
  }

  function leave(msg){
    stop();
    if(window.PIT) PIT.show({ onGo:start });
    if(msg && window.say) window.say(msg);
  }

  return { start, stop, tick, leave, flatten, PALETTE, SLOT, ACTOR,
           get flat(){ return flat; },
           get active(){ return on; },
           /* what the walkthrough's steps are reading, for diagnosing a
              step that will not tick */
           get watched(){ return run; },
           /* which clip each body is playing, for telling "the walk is
              missing" apart from "the walk is not being reached for" */
           get playing(){ const o={}; Object.keys(rigs).forEach(k=>o[k]=rigs[k].curName); return o; },
           get stage(){ return stage; },
           get cleared(){ return cleared; } };
})();
