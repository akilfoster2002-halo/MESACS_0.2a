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

       turn  ↔  direction
         `turn` with no readout is a block whose effect you can only
         guess at. And `turn` + `move` is the other way of getting about
         — the turtle one — next to the co-ordinate one.

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
      'motion.move','motion.turn','motion.changeBy','motion.setTo',
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

  let on=false, wasFP=null, camX=0, camY=0, spec=null;
  let bodies={};              // actor name -> its model, mixer and clips
  let fighting=false, over=null, banner='';

  /* ------------------------------------------------------------ start */
  function start(robotId, addTemplates){
    stop();
    on=true;
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

    build();

    /* SAY WHICH PROJECT BEFORE MOUNTING IT. enter() is what opens the
       slot, so useSlot has to come first or the ring opens whatever this
       browser last had in the sandbox. */
    VM.useSlot(SLOT);
    VM.enter(G.roomGroup);
    const bot=ensureRobot();
    const foe=ensureFoe();
    (addTemplates||[]).forEach(id=>install(id, bot));
    bodies={};
    loadBody(TEMPLATES.ME,  spec);
    loadBody(TEMPLATES.FOE, RB().get('ambush'));
    /* On their marks with full bars, before a single script runs — so
       the HUD is never showing last round's numbers while the pit's
       words are still on screen. */
    bell(bot); bell(foe);

    if(window.CODER){
      CODER.restrict(PALETTE);
      CODER.setActor(bot);
    }
    hint();
    hud();
  }

  /* One robot, wearing what the pit picked. Kept across visits rather
     than rebuilt, because the scripts on it are the student's work and
     a fresh actor every time would throw them away. */
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
       is not — it is wherever last lesson's `change y by 40` left it, and
       a robot that starts forty units above the camera looks like a robot
       that failed to load.

       y IS HALF ITS HEIGHT because the body below is centred on the
       actor, the way every costume in this game is. */
    bot.size=spec.height;
    bot.x=0; bot.y=spec.height/2; bot.z=0; bot.dir=0;
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
    let f=VM.actorByName(T.FOE);
    if(!f){
      f=VM.addActor({ name:T.FOE, dir:0 });
      T.aiProcs().forEach(p=>{
        if(!VM.project.procs.find(x=>x.name===p.name))
          VM.project.procs.push(JSON.parse(JSON.stringify(p)));
      });
      f.scripts=T.aiScripts().map((sc,i)=>
        ({ id:'ai'+i, hat:JSON.parse(JSON.stringify(sc.hat)),
                      body:JSON.parse(JSON.stringify(sc.body)) }));
    }
    const fs=RB().get('ambush');
    f.size=fs.height; f.x=10; f.y=fs.height/2; f.z=0; f.dir=0;
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
    if(!me || !foe) return;

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
    if(VM.running && !fighting){ fighting=true; bell(me); bell(foe); }
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
        if(r.ok){
          state(b).health=R.clampHealth(state(b).health - r.damage);
          hitFx(b, r.why);
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

    if(state(me).health<=R.RULES.knockout || state(foe).health<=R.RULES.knockout){
      const meDown=state(me).health<=R.RULES.knockout;
      const win = meDown && state(foe).health<=R.RULES.knockout ? 'a draw'
                : meDown ? (RB().get('ambush').name+' wins') : 'you win';
      VM.actorByName(meDown?T.FOE:T.ME);
      announce(win);
      over=R.RULES.reset;
      /* Stop everything where it is. A round that is over is over — the
         losing script does not get to keep walking. */
      VM.stopAll();
      fighting=false;
    }
  }
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
    const b=bodies[who.name];
    if(b) b.flash=why==='guarded'?0.12:0.26;
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
  /* ONE OF THESE PER FIGHTER, keyed by the actor's name. Both of them
     wear rigged models, and rigged models cannot go through the costume
     system (see costumes.js), so the ring loads them itself and drives
     them off their actor's position every frame. */
  function loadBody(name, sp){
    const old=bodies[name];
    if(old && old.for===sp.id) return;
    if(old && old.g && old.g.parent) old.g.parent.remove(old.g);
    const rec=bodies[name]={ for:sp.id, g:new THREE.Group(), mixer:null,
                             clips:[], cur:null, curName:null, was:null, flash:0 };
    G.roomGroup.add(rec.g);
    new THREE.GLTFLoader().load(sp.model+'?v='+(window.ASSETV||'1'), gl=>{
      if(!on || bodies[name]!==rec) return;      // left, or swapped bodies
      const r=gl.scene;
      r.traverse(o=>{
        if(!o.isMesh) return;
        /* NEVER CULLED: a skinned mesh is culled against the bind box,
           which is not any pose it is ever in. */
        o.frustumCulled=false;
        o.castShadow=true;
        /* Its own material, or flashing one fighter flashes both — they
           are two loads of the same file for the same robot. */
        o.material=o.material.clone();
        if(o.geometry.attributes.color){
          o.material.vertexColors=true; o.material.needsUpdate=true;
        }
      });
      r.updateMatrixWorld(true);
      const bx=new THREE.Box3().setFromObject(r);
      const h=bx.max.y-bx.min.y;
      /* MULTIPLY, NEVER SET. These exports carry a scale of their own —
         a hundredth, because they are authored in centimetres — and the
         box above is measured AFTER that, in world units. setScalar
         throws the hundredth away and leaves a four-metre robot four
         hundred and sixty, which from the floor looks exactly like a
         model that failed to load.

         Scaled, never lifted — the skeleton stands on the origin even
         though the mesh straddles it. */
      if(h>1e-6) r.scale.multiplyScalar(sp.height/h);
      rec.g.add(r);
      rec.mixer=new THREE.AnimationMixer(r);
      rec.clips=gl.animations||[];
      play(rec, IDLE_CLIP, 0);
    });
  }

  function play(rec, name, fade){
    if(!rec || !rec.mixer || rec.curName===name) return;
    const clip=rec.clips.find(c=>c.name===name);
    if(!clip) return;
    const next=rec.mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
    if(rec.cur) rec.cur.fadeOut(fade===undefined?0.18:fade);
    rec.cur=next; rec.curName=name;
  }
  /* The one place the missing walk cycle is handled. The moment a clip
     with one of these names exists in the .glb it is found and played
     while a fighter is moving. That is the whole integration. */
  const walkClip = rec => WALK_CLIPS.find(n=>rec.clips.some(c=>c.name===n)) || null;

  function stop(){
    if(!on) return;
    on=false;
    if(window.CODER){
      if(CODER.open) CODER.hide();
      CODER.restrict(null);       // hand the whole palette back to Free Play
    }
    if(window.VM){ VM.stopAll(); VM.save(); VM.leave(); }
    bodies={}; fighting=false; over=null; banner='';
    Object.keys(book).forEach(k=>delete book[k]);
    $('#ring').classList.add('hidden');
    ['#ringFeed','#ringKeys'].forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
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

    /* A stripe every two units, and a lit one at zero. `change x by 10`
       is a sentence with a number in it, and a floor with nothing on it
       gives a student no way to see whether the number was ten. With
       stripes they can count. */
    for(let i=-F;i<=F;i+=2){
      const lit=i===0;
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 24),
        new THREE.MeshBasicMaterial({color: lit?0x8ff0ff:0x3b3059}));
      m.position.set(i, 0.02, 0); m.userData.flat=true; world.add(m);
    }
    /* And posts up the back wall, so `change y by` has something to be
       measured against too. Up is a direction you can only see moving in
       if there is something standing still beside you. */
    for(let h=2;h<=12;h+=2){
      const m=new THREE.Mesh(new THREE.BoxGeometry(F*2+6, 0.08, 0.08),
        new THREE.MeshBasicMaterial({color:0x342b50}));
      m.position.set(0, h, -11); world.add(m);
    }

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

  /* ------------------------------------------------------------- tick
     The VM is stepped HERE rather than by the game loop, which only does
     it in the Free Play room. Same call, same threads, same everything —
     the only difference is who owns the floor it is standing on. */
  function tick(dt){
    if(!on) return;
    if(window.VM) VM.step(dt);
    referee(dt);
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
      hud();
      /* AND THE PLANET'S PANELS STAY DOWN. CODER.hide() puts #objectives,
         #keys and #topbar back unconditionally, which is right in Free
         Play and wrong here: closing the blocks with C dropped Senio's
         mission list over the middle of the ring. Re-asserted rather than
         patched into the editor, because the editor is shared and this
         room is the odd one out. */
      HIDE.forEach(sel=>{ const e=$(sel); if(e) e.classList.add('hidden'); });
    }
  }

  /* The actors have the positions; the bodies are drawn from them. One
     line of copying per fighter, plus a walk clip whenever one of them
     is actually travelling and a flash whenever one is hit. */
  function drive(dt){
    const T=window.TEMPLATES; if(!T) return;
    [T.ME, T.FOE].forEach(name=>{
      const a=VM.actorByName(name), rec=bodies[name];
      if(!a || !rec) return;
      /* The actor's own mesh is a cube standing exactly where the fighter
         is. It is what the VM moves and what the crosshair finds, so it
         stays — it just does not need to be looked at.

         ITS MATERIAL AND NOT THE OBJECT. `say` hangs its speech bubble
         off a.mesh, so switching the whole subtree off takes the bubble
         with it and a fighter talks invisibly. */
      if(a.mesh && a.mesh.material) a.mesh.material.visible=false;
      if(a.bubble) a.bubble.position.y=(+a.size||4)/2 + 0.9;

      rec.g.position.set(+a.x||0, +a.y||0, +a.z||0);
      /* They face each other, whichever way round they are standing. */
      const other=VM.actorByName(name===T.ME?T.FOE:T.ME);
      rec.g.rotation.y = other && (+other.x||0) < (+a.x||0) ? -Math.PI/2 : Math.PI/2;

      const p=rec.g.position;
      const moved=rec.was ? Math.hypot(p.x-rec.was.x, p.y-rec.was.y, p.z-rec.was.z) : 0;
      rec.was={ x:p.x, y:p.y, z:p.z };
      const w=walkClip(rec);
      play(rec, moved>0.001 && w ? w : IDLE_CLIP);
      if(rec.mixer) rec.mixer.update(dt);

      /* The flash. A number going down in a corner is not evidence a
         punch landed; a body going white for a fifth of a second is. */
      if(rec.flash>0){
        rec.flash=Math.max(0, rec.flash-dt);
        const k=rec.flash;
        rec.g.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive)
          o.material.emissive.setScalar(k*1.6); });
      }
    });
  }

  /* Side on, framed on BOTH of them — a camera that followed only the
     player would push the opponent off the edge exactly when the gap is
     the thing you are trying to judge. */
  function camera(dt){
    const T=window.TEMPLATES; if(!T) return;
    const a=VM.actorByName(T.ME), b=VM.actorByName(T.FOE);
    const ax=a?+a.x||0:0, bx=b?+b.x||0:0;
    const mid=(ax+bx)/2, gap=Math.abs(ax-bx);
    const ay=a?+a.y||0:2.3;
    const k=Math.min(1, dt*2.2);
    camX += (mid-camX)*k;
    camY += (Math.max(ay,2.3)-camY)*k;
    G.camera.position.set(camX, camY+3.2, 15+Math.min(10, gap*0.6));
    G.camera.up.set(0,1,0);
    G.camera.lookAt(camX, camY, 0);
  }

  /* ---------------------------------------------------------- the HUD
     Both fighters, both numbers. Health and stamina are the referee's,
     so they are shown the way the referee has them rather than the way
     any script left them — and they are the same numbers `(health)` and
     `(stamina)` report inside the blocks, which is the point. */
  function hud(){
    const el=$('#ringA'), T=window.TEMPLATES, R=window.RULES;
    if(!el || !T || !R) return;
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

  /* The one sentence that is worth more than any other on this screen,
     and the reason it is here rather than in a help bubble: a student
     whose robot twitched once and stopped has written the commonest
     Scratch bug there is, and the fix is a shape, not a value. */
  function hint(){
    const line=`<b>C</b> ${T('open the blocks')} &nbsp;·&nbsp; `+
               `<b>${T('a conditional on its own is checked once')}</b> — `+
               `${T('put it inside a forever loop to make it a control')}`;
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

  return { start, stop, tick, leave, PALETTE, SLOT, ACTOR,
           get active(){ return on; } };
})();
