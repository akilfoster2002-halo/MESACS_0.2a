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
    cats:['events','control','motion','looks','sensing','ops'],
    ops:[
      /* how a script starts */
      'event.flag','event.key',
      /* the shapes it is built out of */
      'ctrl.wait','ctrl.repeat','ctrl.forever',
      'ctrl.if','ctrl.ifelse','ctrl.repeatUntil','ctrl.waitUntil','ctrl.stop',
      /* what a robot can do, and how to read what it did */
      'motion.move','motion.turn','motion.changeBy','motion.setTo',
      'motion.goto','motion.glide','motion.pos','motion.dir',
      /* how it tells you what it thinks */
      'looks.say','looks.sayFor',
      /* what it can feel */
      'sense.key','sense.timer','sense.resetTimer',
      /* and what it can work out */
      'op.lt','op.eq','op.gt','op.and','op.or','op.not','op.random'
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
  let body=null, bodyFor=null, mixer=null, clips=[], cur=null, curName=null;
  let wasAt={x:0,y:0,z:0};

  /* ------------------------------------------------------------ start */
  function start(robotId){
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
    bodyFor=null; mixer=null; clips=[]; cur=null; curName=null;
    loadBody();

    if(window.CODER){
      CODER.restrict(PALETTE);
      CODER.setActor(bot);
    }
    hint();
    say();
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
  function loadBody(){
    if(bodyFor===spec.id) return;
    bodyFor=spec.id;
    if(body && body.parent) body.parent.remove(body);
    body=new THREE.Group();
    G.roomGroup.add(body);
    const want=spec.id;
    new THREE.GLTFLoader().load(spec.model+'?v='+(window.ASSETV||'1'), gl=>{
      if(!on || bodyFor!==want) return;          // left, or picked the other one
      const r=gl.scene;
      r.traverse(o=>{
        if(!o.isMesh) return;
        /* NEVER CULLED: a skinned mesh is culled against the bind box,
           which is not any pose it is ever in. */
        o.frustumCulled=false;
        o.castShadow=true;
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
         throws the hundredth away and leaves the robot a hundred times
         too big: four and a half metres became four hundred and sixty,
         and all you can see from the floor is a shadow.

         Scaled, never lifted — the skeleton stands on the origin even
         though the mesh straddles it. */
      if(h>1e-6) r.scale.multiplyScalar(spec.height/h);
      body.add(r);
      mixer=new THREE.AnimationMixer(r);
      clips=gl.animations||[];
      play(IDLE_CLIP, 0);
    });
  }

  function play(name, fade){
    if(!mixer || curName===name) return;
    const clip=clips.find(c=>c.name===name);
    if(!clip) return;
    const next=mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
    if(cur) cur.fadeOut(fade===undefined?0.18:fade);
    cur=next; curName=name;
  }
  /* The one place the missing walk cycle is handled. The moment a clip
     with one of these names exists in the .glb it is found and played
     while the robot is moving. That is the whole integration. */
  const walkClip = () => WALK_CLIPS.find(n=>clips.some(c=>c.name===n)) || null;

  function stop(){
    if(!on) return;
    on=false;
    if(window.CODER){
      if(CODER.open) CODER.hide();
      CODER.restrict(null);       // hand the whole palette back to Free Play
    }
    if(window.VM){ VM.stopAll(); VM.save(); VM.leave(); }
    body=null; bodyFor=null; mixer=null; clips=[]; cur=null; curName=null;
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
      say();
      /* AND THE PLANET'S PANELS STAY DOWN. CODER.hide() puts #objectives,
         #keys and #topbar back unconditionally, which is right in Free
         Play and wrong here: closing the blocks with C dropped Senio's
         mission list over the middle of the ring. Re-asserted rather than
         patched into the editor, because the editor is shared and this
         room is the odd one out. */
      HIDE.forEach(sel=>{ const e=$(sel); if(e) e.classList.add('hidden'); });
    }
  }

  /* The actor has the position; this has the body. One line of copying,
     and a walk clip the moment the robot is actually travelling. */
  function drive(dt){
    const bot=VM.actorByName(ACTOR);
    if(!bot || !body) return;
    /* The actor's own mesh is a cube standing exactly where the robot is.
       It is what the VM moves and what the crosshair finds, so it stays —
       it just does not need to be looked at.

       ITS MATERIAL AND NOT THE OBJECT. `say` hangs its speech bubble off
       a.mesh, so switching the whole subtree off takes the bubble with
       it and the robot talks invisibly. Turning off the MATERIAL stops
       the cube being drawn and leaves its children alone. */
    if(bot.mesh && bot.mesh.material) bot.mesh.material.visible=false;
    /* And the bubble sits at a fixed height meant for a one-unit object,
       which on a four-metre robot is somewhere inside its chest. Half a
       robot gets to the top of its head; the rest clears the gloves,
       which these two hold up in a guard and which are the real top of
       the silhouette. */
    if(bot.bubble) bot.bubble.position.y = spec.height/2 + 0.9;
    body.position.set(+bot.x||0, +bot.y||0, +bot.z||0);
    body.rotation.y=(+bot.dir||0)*Math.PI/180;
    body.scale.setScalar(1);

    const moved=Math.hypot(body.position.x-wasAt.x,
                           body.position.y-wasAt.y,
                           body.position.z-wasAt.z);
    wasAt={x:body.position.x, y:body.position.y, z:body.position.z};
    const w=walkClip();
    play(moved>0.001 && w ? w : IDLE_CLIP);
    if(mixer) mixer.update(dt);
  }

  /* Side on, drifting after the robot rather than locked to it — a
     camera welded to a moving thing makes the thing look still, and the
     whole point of this room is seeing that it moved. It follows in y as
     well, or a robot told to change y by 50 leaves the picture. */
  function camera(dt){
    const bot=window.VM && VM.actorByName(ACTOR);
    const x=bot?+bot.x||0:0, y=bot?+bot.y||0:0;
    const k=Math.min(1, dt*2.2);
    camX += (x-camX)*k;
    camY += (y-camY)*k;                 // the actor's y IS its middle
    G.camera.position.set(camX*0.5, camY+3.0, 15);
    G.camera.up.set(0,1,0);
    G.camera.lookAt(camX*0.8, camY, 0);
  }

  /* ---------------------------------------------------------- the HUD
     Where it is, in the numbers the blocks use. `x position` is a block
     on the palette, so the same three numbers are on screen — a student
     can read one against the other and see that they agree. */
  function say(){
    const el=$('#ringA'); if(!el || !spec) return;
    const bot=window.VM && VM.actorByName(ACTOR);
    const n=v=>(Math.round((+v||0)*10)/10).toFixed(1);
    const scripts=bot?(bot.scripts||[]).length:0;
    el.innerHTML=`<div class="ring-name"><b>${spec.name}</b>
        <small>${scripts} ${T(scripts===1?'script':'scripts')}${
          window.VM && VM.running ? ' · '+T('running') : ''}</small></div>
      <div class="ring-p"><span>x</span><i><b style="width:${Math.max(0,Math.min(100,(+bot?.x||0)/16*50+50))}%"></b></i>
        <span style="width:46px;text-align:right">${n(bot&&bot.x)}</span></div>
      <div class="ring-p"><span>y</span><i><b style="width:${Math.max(0,Math.min(100,(+bot?.y||0)/12*100))}%"></b></i>
        <span style="width:46px;text-align:right">${n(bot&&bot.y)}</span></div>
      <div class="ring-p"><span>z</span><i><b style="width:${Math.max(0,Math.min(100,(+bot?.z||0)/12*50+50))}%"></b></i>
        <span style="width:46px;text-align:right">${n(bot&&bot.z)}</span></div>`;
  }

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
