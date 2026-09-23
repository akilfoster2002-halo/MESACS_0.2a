/* =====================================================================
   THE HOUSE ON RYU — two rooms, and somebody on the floor of the second.

   This is the first interior on the world the game drops you on, and it
   is deliberately small: you walk in, you are in a room, and the only
   thing to do is go through the door in front of you and find out why
   nobody answered. An RPG opens by giving you one question, not a map.

   WHAT IS REUSED, because none of this is a second engine:

     BUILDING   the plan below is a text floor plan, exactly like the
                infiltration site and the Engineer's district — one
                string per row, and the kit lays itself out at its own
                scale.
     G / step() the same player controller, collision and third-person
                camera as every other room in this game.
     AVATAR     Robin is attached the way she is attached anywhere. She
                is not a special case here; RYU already cast her before
                the door was ever opened.

   WHAT IS NEW: Ion. He is not a character you can wear and he does not
   go through AVATAR — he is a model with three clips, and which of the
   three he is in is the whole of this morning: breathing on the floor,
   standing in the idle every person in this game stands in, and the one
   nobody put in his routine. See ion() below for why he is loaded here
   rather than added to the roster, and mended() for what the third clip
   is for.
   ===================================================================== */
window.HOUSE = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  /* Read off the kit rather than copied from it: two constants that have
     to agree are two constants that eventually do not. */
  const U = () => (window.BUILDING && BUILDING.UNIT) || 4;
  const say_ = (s,p) => (window.t ? t(s,p) : s);
  const say = say_;
  /* WHAT ION CALLS YOU. He used to say "Robin", because that is who you
     were made into the moment you landed. You arrive as yourself now, so
     the name is yours and it goes in as a parameter — which also means
     the Spanish line keeps the same {n} and nobody translates a username.
     See avatar.js: myName() is the one place that decides this. */
  const ME = () => (window.AVATAR && AVATAR.myName) ? AVATAR.myName() : say_('you');
  /* AND WHEN HE IS STUTTERING IT. The stutter was written into the
     string — "R-Robin" — which only works for a name beginning with R.
     Built off the first letter instead, so it stutters whoever you are. */
  const stut = n => (n && n.length) ? (n[0] + '-' + n) : n;

  /* ------------------------------------------------------------ the plan
       #  wall      W  window wall     D  doorway
       .  floor     S  where you come in
       G  somebody stands here — BUILDING calls these guard waypoints,
          which is the closest thing it has to "a person is on this tile".
          Ion is the only one, and he is not standing.

     Two rooms of seven by five tiles — twenty-eight by twenty world units
     each, and two courses of wall over them. The first version was five by
     three under a single course and it read as a box somebody was shut
     in: at four units a tile, a room only three tiles deep puts a wall in
     front of the camera before the camera has finished pulling back, and a
     ceiling at four and a half sits barely above the chase camera's own
     height. Wider, deeper and twice as tall is the same two rooms and a
     completely different place to stand in. */
  const COURSES = 2;
  const PLAN = [
    /* AND THE FRONT DOOR IS A DOOR. This row was a window wall, and the
       way out of the house was to walk at it and press E — the prompt
       said "go outside" while you stood facing masonry with a window in
       it. Everything about leaving worked; there was simply nothing there
       to leave through, which is the one thing a front door has to be.

       IT IS OPPOSITE THE SPAWN, so you wake up with Ion's room ahead of
       you and your own front door behind you, which is the shape of the
       story: forward to find him, back out through it with him. */
    '####D####',
    '#.......#',
    '#.......#',
    '#...S...#',
    '#.......#',
    '#.......#',
    '####D####',
    '#.......#',
    '#.......#',
    '#...G...#',
    '#.......#',
    '#.......#',
    '####W####'
  ];

  /* The model, the mixer, and nothing else: he has one clip and it plays
     for as long as the room is open. */
  /* ?v= ON THE ASSET, not just on the script. Models are served with
     max-age=86400 and every other model in this game is fetched with the
     version on it — avatar.js says so and "glb files"/README.md says so
     twice. Without it a changed model is invisible for a day: Ion was
     re-merged with an idle clip in him, the page loaded yesterday's copy
     that had only the breathless one, and up() found no clip to stand
     into and returned quietly. He lay on the floor being congratulated. */
  const ION_MODEL = () => 'characters/models/ion.glb?v=' + (window.ASSETV || '1');
  /* How tall he stands, in world units, measured in the REST pose before
     a clip has moved anything. A person in this game is 1.85 (AVATAR.TALL)
     and Ion comes up to about the chest of one, which is what the
     reference sheet draws and what makes the head read as oversized
     rather than the body as undersized. */
  const ION_TALL = 1.25;
  /* Every Nth vertex is enough to find the lowest point of him — see
     floorOf(). Twenty-two thousand of them is a lot to walk for a number
     we take once, and a robot is not made of spikes: the corner his
     shoulder rests on is a face, not a vertex. */
  const SIT_STRIDE = 3;

  /* WHERE THE TILES ARE, in world units, so a shot can be written down
     rather than worked out. The plan is nine by thirteen at four units a
     tile: room one is z 4..24, room two is z 28..44, and both run x 4..28
     with the middle at 16. */
  const W = (tx,tz) => [tx*U(), tz*U()];
  const ION_AT = [16, 36];          // the tile marked G, in world units
  const DOOR_Z = 24;                // the wall the doorway is in
  /* WHERE THE FRONT DOOR COMES OUT. The house stands at lon 0, lat -2 on
     RYU and the ship is parked at lon 5 — so stepping outside puts you
     between the two, looking at the thing you were just told you needed.
     Slightly south of the house so you are in front of it rather than
     inside its footprint. */
  /* CLEAR OF THE HOUSE, AND OF THE CAMERA BEHIND YOU. Two goes at this.
     The house is 28 by 24 centred on lon 0, which at a radius of 240 is
     about 3.3 degrees of half-width, so the first spot — 2.4 degrees out —
     was INSIDE the building and the screen was black. The second, at 3.9,
     put Robin outside and left the CHASE CAMERA in the wall: it sits five
     and a half units behind her, and on a planet nothing pulls it out of
     a solid the way it does indoors. A raycast out of the lens hit the
     roof at three metres.
     So: past the ship rather than short of it. She comes out looking at
     the thing she was just told she needs, with her own house behind it
     and nothing between the camera and open ground. */
  const OUTSIDE = { lon:6.3, lat:-2.4 };

  /* ===================================================================
     REPLAY  —  TEMPORARY, AND THE ONE LINE THAT TURNS IT OFF.

     Set true, every visit to this house starts at the top: Robin wakes up,
     walks through, finds him on the floor and opens the console with all
     three faults back in it. That is what you want while the mission is
     being BUILT — there is no other way to look at the opening twenty
     seconds again — and it is not what you want shipped, because a
     student who mended him yesterday should walk in on a robot that is
     working.

     Set it to false and everything below goes back to reading the save
     bag. Nothing else has to change: the flag is still written when he is
     mended, so the day this comes off, the memory is already there.
     =================================================================== */
  const ALWAYS_REPLAY = true;

  /* Has he been fixed? Kept in the save bag, so a student who gets him up
     and comes back tomorrow does not find him on the floor again. */
  const FIXED='ion_fixed';
  const fixed = () => { if(ALWAYS_REPLAY) return false;
                        try{ return !!(window.PROGRESS && PROGRESS.get(FIXED,0)); }
                        catch(e){ return false; } };

  let on=false, L=null, loader=null, keyHook=null;

  /* E, while she is standing over him and the story is asking for it.
     Everywhere else in this game E is "go in", and G.room==='house' is not
     a room anything else routes it for — so this is the only listener that
     wants it and it keeps to itself. */
  const atDoor = () => G.pos.z < 8;      // the front of the first room
  function onKey(e){
    if(!on || !L || e.code!=='KeyE') return;
    if(L.askE && nearIon()){ L.eHit=true; return; }
    /* AND THE FRONT DOOR SIMPLY WORKS. A house you can only leave at the
       one moment a scene offered it to you is a room with a cutscene for a
       door. `askOut` does not gate it — it only changes what the prompt
       SAYS, so the story can point at the door without owning it. */
    if(atDoor() && !(window.SCENE && SCENE.active)) outside();
  }

  /* ===================================================================
     ION
     He is loaded here and not through AVATAR on purpose. AVATAR.load
     normalises every body to the height of a person and hands back
     something the wardrobe, the Mall and the roster all expect to be able
     to talk about. Ion is none of those things: he is a foot shorter than
     a person, he is not for sale, nobody can wear him, and he has exactly
     one animation. Putting him in BODIES to get a loader would have been
     borrowing the machinery and inheriting the meaning.
     =================================================================== */
  async function ion(spot){
    loader = loader || new THREE.GLTFLoader();
    const g = await new Promise((res,rej)=>
      loader.load(ION_MODEL(), res, undefined, rej));
    if(!on || !L) return;
    const root=g.scene;
    root.traverse(o=>{
      if(!o.isMesh) return;
      o.frustumCulled=false;          // he is one object and always on screen
      /* He carries his colour in the mesh rather than in a texture, like
         every character in this game — see "glb files"/README.md. */
      if(o.geometry.attributes.color){ o.material.vertexColors=true;
                                       o.material.needsUpdate=true; }
    });
    /* MEASURE THE WORLD, NOT THE INTENTION, and measure it BEFORE the
       clip runs. Straight out of the loader every matrixWorld is
       identity, so the hundredfold correction fbx2glb leaves on the root
       is not counted and the height comes back a hundred times too small
       — avatar.js learned this the hard way and says so. And the box has
       to be the REST pose: the breathless clip lays him flat, so a box
       measured after it is his LENGTH, and scaling by that would stand a
       doll's house robot in the room. */
    root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(root);
    const h=box.max.y-box.min.y;
    if(h > 1e-6) root.scale.setScalar(ION_TALL/h);
    else console.warn('HOUSE: Ion has no height, cannot scale');

    const grp=new THREE.Group();
    grp.position.set(spot.x*U(), spot.y, spot.z*U());
    /* Turned so he is across the doorway rather than pointing at it: you
       come through the door and see him, rather than seeing the soles of
       his feet. */
    grp.rotation.y=Math.PI*0.5;
    grp.add(root);
    G.roomGroup.add(grp);

    const clipOf = n => (g.animations||[]).find(c=>c.name===n);
    const lying = clipOf('breathless') || (g.animations||[])[0];
    if(!lying){
      /* Silent on purpose everywhere else — rig.play() leaves the current
         clip alone when it cannot find one — and that is exactly how a
         model served from yesterday's cache looks like a robot standing
         to attention for no reason. */
      console.warn('HOUSE: Ion has no "breathless" clip; he will stand in his rest pose');
      L.ion={ grp, root, mixer:null };
      return;
    }
    /* THREE POSTURES, AND THIS MORNING IS WHICH ONE HE IS IN.

       `down`  is the clip he came with: he is breathing and nothing else.
       `stand` is rig/idle.glb — the same idle every person in this game
               stands in — retargeted onto him by bone name, which works
               because he is a Mixamo skeleton like the rest of them and
               costs nothing but a merge.
       `fit`   is rig/seizure.glb, and it is the one nobody put in his
               routine. It is a LAYING clip, so it takes him off his feet
               by itself: he does not have to be knocked down, the pose is
               the falling. */
    const mixer=new THREE.AnimationMixer(root);
    const A={ down:mixer.clipAction(lying) };
    for(const [k,n] of [['stand','idle'],['fit','seizure']]){
      const c=clipOf(n);
      if(c) A[k]=mixer.clipAction(c);
      else console.warn(`HOUSE: Ion has no "${n}" clip; he will not ${k==='stand'?'get up':'go down'}`);
    }

    /* AND NOW PUT HIM ON THE FLOOR, which the clips do not do. Mixamo
       keeps the hips at a standing height even in a clip that lays the
       body flat, and `inplace` only flattens the fore/aft drift — so out
       of the box he lies down in mid-air, two thirds of a metre over the
       tile, in a pose that is otherwise perfect. It reads as a bug in the
       room rather than in the clip, which is why it is worth a paragraph.

       The obvious measurement does not work. Box3.setFromObject
       transforms a SkinnedMesh's geometry bounds by its matrixWorld and
       never asks the skeleton, so it hands back the BIND pose's box
       however the clip has posed him — a number that looks right, never
       changes, and drops him a T-pose's worth through the floor. Bones
       are honest but they are inside him; the lowest one is a forearm and
       the arm around it is what actually touches the ground.
       So ask the skin.

       ONCE PER FLOOR POSE, because they are not the same shape. Lying
       still and thrashing put different parts of him lowest, and a
       seizure measured off the breathing clip either floats him or saws
       his shoulder through the tile. The thrash is sampled across its
       whole length and the LOWEST sample wins, so the one frame he is
       furthest over is the frame that decides and no part of him ever
       goes through the floor.

       THE WORLD MATRIX IS THE HALF THAT WAS MISSING. floorOf() reads
       world coordinates, and `root.updateMatrixWorld()` builds root's off
       its PARENT's, which nothing had updated — so the lowest point came
       back measured from the group's origin instead of from the tile and
       the correction was a slab thick, every time, in his favour. Ask the
       group to update itself and the arithmetic below is the arithmetic
       it always claimed to be. */
    const base=grp.position.y;
    const THRASH=[0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9];
    function tile(act, times){
      let low=Infinity;
      for(const at of times){
        for(const k in A) A[k].stop();
        act.reset().setEffectiveWeight(1).play();
        mixer.setTime(at);
        grp.updateMatrixWorld(true);
        const y=floorOf(root);
        if(y!==null && y<low) low=y;
      }
      for(const k in A) A[k].stop();
      if(isFinite(low)) return base + (spot.y - low);
      console.warn('HOUSE: cannot skin Ion to the floor; he will lie where the clip puts him');
      return base;
    }
    /* Measured now, with nobody looking, because measuring a pose means
       standing him in it — and KEYED BY THE POSE, not by what it looks
       like from outside. go() reads Y[name] with the name of the clip it
       is fading to, so a height filed under anything else is an undefined
       the group's y quietly becomes NaN from. */
    const Y={ stand:spot.y, down:tile(A.down,[0]),
              fit: A.fit ? tile(A.fit, THRASH) : spot.y };

    L.ion={ grp, root, mixer, pose:'down', glide:null };
    /* ONE WAY TO CHANGE WHAT HE IS DOING, because the body and the tile
       have to move together: every one of these poses sits at its own
       height and a crossfade that left the group where it was would slide
       him through the floor half way through. Crossfaded rather than cut
       — a robot who has just been mended and snaps to attention in one
       frame looks repaired, not relieved — and the fade is the argument
       for how long the drop takes, so he arrives with the pose. */
    function go(name, fade){
      const a=A[name];
      if(!a || L.ion.pose===name) return;
      /* AND A HEIGHT FILED UNDER THE SAME NAME. A pose with no entry in Y
         is an `undefined` that the group's y becomes NaN from on the very
         first frame of the glide — and a NaN position does not throw, does
         not warn and does not draw. Ion simply is not in the room, and the
         shot that was meant to be him getting up is an empty floor. */
      const to=Y[name];
      if(to===undefined) console.warn('HOUSE: no floor height for pose "'+name+'"');
      const from=A[L.ion.pose];
      a.reset().setEffectiveWeight(1).play();
      if(from) from.crossFadeTo(a, fade, false);
      L.ion.pose=name;
      L.ion.glide={ from:grp.position.y, t:0, for:fade,
                    to: to===undefined ? grp.position.y : to };
    }
    L.ion.up   = ()=>go('stand', 1.4);
    L.ion.fit  = ()=>go('fit',   0.30);   // nothing about this one is gentle
    L.ion.rise = ()=>go('stand', 1.7);

    A.down.play();
    mixer.update(0);
    grp.position.y=Y.down;
  }

  /* ===================================================================
     THE LIGHTS GOING

     BUILDING hangs a PointLight over the middle of every room it can
     flood-fill and does not hand them back, so they are found by walking
     the room rather than by growing a return value nobody else reads.
     The sun and the two ambients go with them: a flicker that leaves the
     fill light alone is a lamp with a loose connection, and this is not a
     lamp.

     AUTHORED, NOT RANDOM. A random flicker reads as weather. This is a
     pattern — out, back, out longer, one stab far too bright, and then a
     brown-out that does not recover — and it is the same every time,
     which is what makes it a thing being DONE rather than a thing going
     wrong.
     =================================================================== */
  const FLICKER=[[0,0],[.08,1],[.14,.02],[.26,1.4],[.33,0],[.48,.9],[.55,.05],
                 [.63,2.1],[.72,.08],[.88,.5],[.98,.03],[1.16,1.2],[1.26,.06],
                 [1.5,.3],[1.66,.08],[1.95,.26],[2.3,.1]];
  const BROWN=0.22;            // where the room sits while he is not his own
  const COMEBACK=1.6;          // seconds for it to come up again afterwards

  function lightsOut(){
    if(!L || L.lit) return;
    const bulbs=[];
    G.roomGroup.traverse(o=>{ if(o.isPointLight) bulbs.push({ o, i:o.intensity }); });
    for(const o of [G.sun, G.amb, G.hemi]) if(o) bulbs.push({ o, i:o.intensity });
    L.lit={ t:0, back:null, bulbs };
  }
  function lightsBack(){ if(L && L.lit && L.lit.back===null) L.lit.back=0; }

  /* What every light in the room is multiplied by, this frame. */
  function litLevel(l){
    if(l.back!==null){
      const u=Math.min(1, l.back/COMEBACK);
      return BROWN + (1-BROWN)*(u*u*(3-2*u));
    }
    const end=FLICKER[FLICKER.length-1][0];
    if(l.t < end){ let v=1; for(const [at,k] of FLICKER){ if(l.t<at) break; v=k; } return v; }
    /* AND THEN IT STAYS DOWN, unsteadily. A room that flickers and
       recovers is a loose connection; a room that flickers and then sits
       at a fifth, with something still pulling on it, is whatever is
       doing it still being there. */
    return Math.max(0, BROWN + 0.05*Math.sin(l.t*21) + 0.035*Math.sin(l.t*6.7));
  }

  /* Hand every intensity back exactly as it was found. G.sun, G.amb and
     G.hemi are the page's, not this room's, and a house that walks out
     leaving them at a fifth is a planet at dusk for no reason. */
  function lightsRestore(){
    if(!L || !L.lit) return;
    for(const b of L.lit.bulbs) b.o.intensity=b.i;
    L.lit=null;
  }

  /* The lowest point of a POSED skinned mesh, in world units — the one
     thing Box3 will not tell you about one. applyBoneTransform pushes a
     bind-pose vertex through the skeleton exactly as the vertex shader
     does, so this is where the model really is rather than where it was
     modelled. Taken once, when the room opens. */
  function floorOf(root){
    let mesh=null; root.traverse(o=>{ if(!mesh && o.isSkinnedMesh) mesh=o; });
    if(!mesh || typeof mesh.applyBoneTransform !== 'function') return null;
    mesh.skeleton.update();
    const pos=mesh.geometry.attributes.position;
    const v=new THREE.Vector3();
    let low=Infinity;
    for(let i=0;i<pos.count;i+=SIT_STRIDE){
      v.fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);       // bind pose -> posed, in mesh space
      mesh.localToWorld(v);
      if(v.y < low) low = v.y;
    }
    return isFinite(low) ? low : null;
  }

  /* =================================================================== */
  async function enter(){
    if(window.PLANET && PLANET.active) PLANET.stop();
    if(window.AVATAR) AVATAR.posture(null);
    /* AND IT NO LONGER DECIDES WHO YOU ARE. This used to cast Robin, the
       way RYU did, so that the house was hers whichever door you came in
       by. It is your house now: you wake up in it as whoever you picked,
       under whatever name you signed in with, and Ion says that name. The
       cast is cleared rather than set, because leaving a stale one on
       would be the old behaviour with extra steps. */
    if(window.AVATAR && AVATAR.setCast) AVATAR.setCast(null);
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.ground=null; G.ceiling=null; G.vel.y=0; G.onGround=true;

    G.camera.up.set(0,1,0);
    G.camera.near=0.1; G.camera.far=220; G.camera.updateProjectionMatrix();
    /* Indoors with the lights on. BUILDING hangs a lamp over the middle of
       every room it can flood-fill, so the sun's only job in here is to
       keep the corners from going black. */
    /* MORNING, because the first thing that happens here is breakfast. The
       windows are the reason to bother: a room lit only by its own lamp is
       a room at night whatever the plan says, and the story starts with
       somebody getting up. */
    G.scene.background=new THREE.Color(0x2b2536);
    G.scene.fog=null;
    if(G.sun){ G.sun.intensity=0.62; G.sun.color.setHex(0xffe8cc);
               G.sun.position.set(40,70,40);
               if(G.sun.target){ G.sun.target.position.set(16,0,24);
                                 G.sun.target.updateMatrixWorld(); } }
    if(G.amb)  G.amb.intensity=0.42;
    if(G.hemi){ G.hemi.intensity=0.70; G.hemi.color.setHex(0xffe2bd);
                G.hemi.groundColor.setHex(0x3a3348); }

    /* THIS HOUSE ONLY EXISTS INSIDE MISSION 8, whichever door you came in
       by, so it says which mission it is. It used to say `null`, and the
       pause menu reads G.missionId to decide whether to offer a way back
       to level one — so the one mission with four levels in it was the
       one mission you could not restart from inside. */
    G.room='house'; G.hudOwner='house'; G.missionId='ion'; G.running=true;
    G.firstPerson=false;
    on=true;

    const built=await BUILDING.build(PLAN, G.roomGroup, { courses:COURSES });
    if(!on) return;                    // somebody left while the kit loaded
    L={ built, ion:null, t:0 };
    G.solids=built.solids.slice();
    G.ground=built.heightAt;
    /* A LID ON IT, and the chase camera is the reason as much as the roof
       is. BUILDING's ceilingAt reports the underside of the storey above,
       and on a one-storey plan there is no storey above, so it answers
       Infinity everywhere and the camera is free to climb. It does: the
       camera sits 2.9 over the head and rises further as you look down,
       which clears the top of a 4.8 wall — and a wall it is above is a
       wall it is not stopped by, so it drifts out through the roof and
       you watch your own house from the garden.
       Capping it under the roof puts the camera back in the room, where
       the walls can do their job. */
    const LID=built.height;
    G.ceiling=(wx,wz,from)=>Math.min(built.ceilingAt(wx,wz,from), LID);
    roof(LID);
    G.vel.y=0; G.onGround=true;

    /* ROBIN COMES IN AT THE SPAWN, facing the door. The plan puts `S` in
       the middle of the first room and the doorway straight ahead of it,
       so "the way on" is the first thing on screen and nobody has to be
       told where to go. */
    const sp=built.spots.spawn;
    G.pos.set(sp.x*U(), sp.y+1.7, sp.z*U());
    G.yaw=Math.PI; G.pitch=0.02;
    /* AND STAND HER THERE, NOW. attach() hangs the body in the room and
       step() is what normally moves it under G.pos — but the first beat of
       the story is a cinematic, so G.running is false and step() never
       runs. Reached from the planet that did not show, because the body
       had already been placed by the room we came from; reached from
       Mission Control it is the first room there has been, and the wide
       shot opened on an empty floor with Robin at the origin.
       Awaited, because attach() has to fetch a character first. */
    if(window.AVATAR){
      try{ await AVATAR.attach(); }catch(e){}
      if(!on) return;
      AVATAR.update(0.016, false, false, true);
    }

    /* And Ion on the floor of the second one. `G` in the plan is a tile
       somebody stands on; there is one of them and he is on it. */
    const spot=(built.spots.guards||[])[0];
    if(spot){ try{ await ion(spot); }catch(e){ console.warn('HOUSE: Ion failed to load', e); } }
    if(!on) return;

    G.scene.updateMatrixWorld(true);
    $('#mapwrap').classList.add('hidden');
    ['#health','#skill','#trigger','#fbeat','#radar','#ptimer','#dash','#pmap']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    const ot=$('#objTitle'); if(ot) ot.textContent=say('HOME');
    const mn=$('#missionName'); if(mn) mn.textContent=say('RYU — the house');
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.updateCodeBtn) updateCodeBtn();

    /* THE STORY, unless it has already happened — see ALWAYS_REPLAY,
       which is on, so for now it always happens. A student who mended him
       yesterday walks into a house with a working robot in it, which is
       the correct thing to find and not a scene to sit through again. */
    if(fixed()){
      if(L.ion && L.ion.up) L.ion.up();
      if(window.lockPointer) lockPointer($('#view'));
      brief(say('Ion is up and about.'));
      return;
    }
    /* AND ONE LAST LOOK BEFORE THE STORY STARTS. enter() is a long async
       function — a kit to load, a character to attach, a robot to fetch —
       and LEAVE is a live button the whole time. Walk out during the load
       and stop() runs, and then this resumes and plays the opening scene
       of a room that is not on screen any more: a dialogue bar over the
       planet, with the camera being driven by a house nobody is in. Every
       other await in here is guarded; this was the gap after the last
       one. */
    if(!on) return;
    if(!keyHook){ keyHook=onKey; addEventListener('keydown', keyHook); }
    if(!window.SCENE){ brief(say('Through the door.')); return; }
    SCENE.play(story(), { faces:FACES,
      end:()=>{ if(!on) return;
                G.running=true; prompt_(null); openConsole(); } });
  }

  /* One slab over the whole footprint, facing down. The rooms are lit from
     under it — BUILDING hangs a lamp over the middle of each one — so this
     wants to be dark enough to read as a ceiling and not so dark it turns
     the room into a cave. */
  function roof(y){
    const cols=PLAN.reduce((n,r)=>Math.max(n,r.length),0), rows=PLAN.length;
    const g=new THREE.Mesh(
      new THREE.PlaneGeometry(cols*U(), rows*U()),
      new THREE.MeshLambertMaterial({ color:0x8d8496, side:THREE.FrontSide }));
    g.rotation.x=Math.PI/2;                 // face down, at the people under it
    g.position.set((cols-1)/2*U(), y, (rows-1)/2*U());
    G.roomGroup.add(g);
  }

  /* ===================================================================
     THE STORY
     Robin gets up, goes to ask her robot for breakfast, and finds him on
     the floor. Three shots for the first room, a walk, three for the
     second, and then a prompt — every one of them a camera already in the
     room rather than anything built for the purpose.
     =================================================================== */
  /* ONLY THE PEOPLE WHO ARE NOT YOU. The player's portrait is whoever
     they happen to be wearing, and SCENE looks that up itself off
     `who:'you'` — a face pinned here would be a second answer to the same
     question, and it would be Robin's whoever you had picked. */
  const FACES = {
    Ion: 'characters/previews/ion.png'
  };

  function prompt_(text){
    const e=$('#usePrompt'); if(!e) return;
    if(!text){ e.classList.add('hidden'); return; }
    e.textContent=text; e.classList.remove('hidden');
  }
  const nearIon = () =>
    Math.hypot(G.pos.x-ION_AT[0], G.pos.z-ION_AT[1]) < 5.5;
  /* TURN HER TOWARDS HIM before the controls come back. A cinematic beat
     moves the CAMERA and leaves the body's heading wherever the last beat
     of play put it — so W after a shot that looked at Ion from the side
     walks her past him and into the far wall, which is exactly what it
     did. G.yaw is the heading the chase camera and the walking both read,
     and this is the one moment anybody knows which way is interesting. */
  function faceAt(x, z, pitch){
    G.yaw = Math.atan2(-(x-G.pos.x), -(z-G.pos.z));
    G.pitch = pitch===undefined ? -0.08 : pitch;
  }
  const faceIon  = ()=>faceAt(ION_AT[0], ION_AT[1]);
  /* And the way OUT, for the moment the story hands the controls back and
     wants her to walk rather than be moved.

     NOT DOOR_Z. That is the doorway BETWEEN the two rooms — the one she
     came through to find him — and aiming her at it turned her round to
     face the room she was already standing in. The front of the house is
     low z, which is what atDoor() has always meant; FRONT_Z is a point
     past the front wall so she squares up to it rather than to a corner. */
  const FRONT_Z = 2;
  const faceDoor = ()=>faceAt(16, FRONT_Z, 0.02);

  function story(){
    const say=say_;
    return [
      /* --- room one: she is awake and she is hungry ------------------- */
      { shot:{ eye:[26, 5.4, 6], at:[16, 1.3, 13] }, ease:0,
        who:'you', say:say('Nnngh. Morning.') },
      { shot:{ eye:[20.5, 2.5, 7.5], at:[16, 1.5, 12.5] }, ease:1.1,
        who:'you', say:say('Ion? Are you up?') },
      { shot:{ eye:[16, 3.0, 8], at:[16, 1.6, DOOR_Z] }, ease:1.0,
        who:'you', say:say('You said you would do pancakes.') },
      /* --- and then she has to walk ---------------------------------- */
      { free:true, who:'you', say:say('\u2026Ion?'),
        wait:()=> G.pos.z > DOOR_Z + 2,
        on:()=>{ G.yaw=Math.PI; G.pitch=0.02; prompt_(say('Through the door')); },
        off:()=>prompt_(null) },
      /* --- room two: he is on the floor ------------------------------ */
      { shot:{ eye:[22.5, 1.5, 30], at:[16, 0.6, 36] }, ease:1.3, fade:false,
        who:'you', say:say('Ion!') },
      { shot:{ eye:[18.6, 0.85, 33], at:[16, 0.45, 36] }, ease:1.4,
        who:'Ion',   say:say('\u2026m-morning\u2026 {n}\u2026',{n:stut(ME())}) },
      { shot:{ eye:[18.6, 0.85, 33], at:[16, 0.45, 36] },
        who:'Ion',   say:say('I cannot tell\u2026 I cannot tell\u2026 I cannot tell\u2026') },
      { shot:{ eye:[19.5, 1.9, 32], at:[16, 0.5, 36] }, ease:1.0,
        /* IT USED TO SAY "he is stuck in a loop", which was true of the
           lesson underneath it when that lesson was about loops. It is two
           yes/no questions now, so the line points at those instead — a
           student primed to look for a loop and handed a pair of booleans
           has been told to look at the wrong thing by the game itself. */
        who:'you', say:say('He cannot work out whether he can cook. Something is wrong with what he asks himself.') },
      /* --- and the player is handed the controls back ---------------- */
      { free:true, who:'you', say:say('Let me look at his console.'),
        /* LATCHED, not polled. G.keys.KeyE is true only while the key is
           physically down, and a beat that watches it on the frame can
           miss a quick tap between two frames entirely — the prompt stays
           up and the key appears to do nothing, which is the worst kind
           of bug to be on the receiving end of. onKey() sets a flag that
           stays set. */
        wait:()=> !!(L && L.eHit),
        /* The prompt is put up by the frame, not by the beat: it is only
           true when she is standing over him, and a prompt that offers a
           key that does nothing is worse than no prompt. */
        on:()=>{ faceIon(); if(L){ L.askE=true; L.eHit=false; } },
        off:()=>{ if(L){ L.askE=false; L.eHit=false; } prompt_(null); } }
    ];
  }

  /* OUT OF THE FRONT DOOR AND ONTO THE PLANET. There was no way out of
     here at all: LEAVE goes to whichever ball you were last standing on,
     and a student who reached this room from Mission Control has never
     stood on RYU — so it put them on Wano, a world away from the ship
     they had just been told to go and build. Now leaving the house means
     leaving the house. */
  function outside(){
    if(!window.PLANET) return false;
    /* WAS SHE SENT, or is she just going out? Read before stop() clears L.
       The errand is only worth repeating on the far side of the door for
       somebody the story has just pointed through it. */
    const sent = !!(L && L.askOut);
    stop();
    document.querySelector('#hud').classList.remove('hidden');
    G.running=true;
    PLANET.enter(null, 'ryu', OUTSIDE);
    /* AND THE NEXT STEP GOES OUT WITH HER. PLANET posts its own arrival
       hint over the top of anything said before it, so this waits for it
       to finish greeting her and then says where the ship is — which is
       the whole reason she came outside. */
    if(sent) setTimeout(()=>{ if(window.PLANET && PLANET.active) brief(ATSHIP()); }, 900);
    return true;
  }

  /* The console is a separate module: it is a lesson, and it has no idea
     there is a house around it. */
  function openConsole(){
    if(!window.BOOLQUIZ){ brief(say_('His console will not open.')); return; }
    /* A SHOT OF THE PANEL FIRST. The console is about to take most of the
       screen, and opening it straight from a shot of the room gives a
       student no idea what the row of lights they are about to program
       even belongs to. One glide down onto his open chest, and the rail
       appears where the camera is already looking. */
    SCENE.play([
      { shot:{ eye:[17.8, 1.45, 33.4], at:[16, 0.80, 36] }, ease:1.1, hold:1.4,
        who:'you', say:say('Let me see what he is asking.') }
    ], { faces:FACES, end:()=>{
      if(!on) return;
      /* HIS MORNING RULES, TWENTY OF THEM.

         This was a console with six questions on it, each one two facts
         joined by `and` or `or`, and a four-row table to check them
         against. The course is about the six COMPARISONS now — less
         than, at most, exactly, not the same as — and joining two
         conditions together is a second subject that was teaching
         students to guess which half of a rule had gone wrong. Same
         panel as the ship and the belt; his own twenty. */
      BOOLQUIZ.open({ bank:'kitchen',
        /* LEVEL ONE OF MISSION 8. ion.js writes the flag and tells the
           course how far in this is, so the mission's card can say which
           level it is about to hand you. */
        onDone: ()=>{ if(window.ION) ION.pass(FIXED);
                      else try{ if(window.PROGRESS) PROGRESS.set(FIXED,1); }catch(e){}
                      mended(); }
      });
    }});
  }

  /* ===================================================================
     HE GETS UP — AND THEN SOMETHING ELSE DOES.

     THIS IS THE REVEAL, AND IT USED TO BE A FOOTNOTE. Five commented-out
     lines were appended to the console after a working RUN, read in a
     panel the student had already finished with, and then narrated back
     to them line by line in dialogue. Everything about it was told rather
     than shown: the antagonist of this game arrived as a diff, and the
     worst thing that has ever happened to Ion happened to a text box.

     So it happens to HIM. The repair works, he thanks her, and in the
     half second where everybody is relieved the lights go — and he goes
     down with them. What comes out of him while he is on the floor is not
     his voice and not addressed to him: it is the person who was inside
     him at four in the morning, saying it to her face. Then it lets go.

     AND THE WORST PART IS HIS. He has no record of any of it — not of
     being opened, not of speaking — which is the same fact the note used
     to carry and is now something he has to say out loud about himself.

     THE VOICE HAS NO FACE. Every other line in this game comes with a
     portrait; FACES has no entry for `???`, so the panel beside the
     dialogue goes blank for exactly as long as somebody else is using his
     mouth, and comes back when he does.
     =================================================================== */
  function mended(){
    if(!on || !L) return;
    const I = fn => ()=>{ if(L && L.ion && L.ion[fn]) L.ion[fn](); };
    if(L.ion && L.ion.mixer) I('up')();
    /* Where the camera stands for the flicker, and it is a WIDE — the
       thing that changed is the room, not his face, and a close-up of a
       robot in the dark is a robot in the dark. */
    const ROOM  ={ eye:[16.4, 3.6, 30.2], at:[16, 1.5, 37] };
    const FLOOR ={ eye:[18.5, 0.92, 33.2], at:[16, 0.75, 36] };
    const OVER  ={ eye:[19.6, 1.45, 32.7], at:[16, 0.80, 36] };
    SCENE.play([
      { shot:{ eye:[20.5, 1.6, 31.5], at:[16, 0.8, 36] }, ease:0.9,
        who:'Ion', say:say_('\u2026oh. Oh! That is much better.') },
      { shot:{ eye:[21.5, 2.2, 31], at:[16, 1.0, 36] }, ease:1.0,
        who:'Ion', say:say_('Good morning, {n}. You fixed my legs.',{n:ME()}) },
      { shot:{ eye:[21.5, 2.2, 31], at:[16, 1.0, 36] },
        who:'you', say:say_('Pancakes. In a minute.') },

      /* --- and the lights -------------------------------------------
         HELD, NOT PROMPTED, from here to the end of it. Every beat below
         runs on a timer instead of waiting for SPACE, because the one
         thing this cannot be is something the player is operating. She
         cannot stop it and neither can they. */
      { shot:ROOM, ease:0.8, hold:2.6, on:lightsOut },
      { shot:ROOM, hold:1.5, who:'you', say:say_('\u2026Ion? What is wrong with the lights?') },

      /* --- and then he is on the floor again ------------------------- */
      { shot:FLOOR, ease:0.45, hold:1.9, on:I('fit'),
        who:'Ion',  say:say_('{n} \u2014 there is s-something in my \u2014',{n:stut(ME())}) },
      { shot:FLOOR, hold:1.6, who:'you', say:say_('ION!') },

      /* --- somebody else, using his mouth ----------------------------
         FOUR SHORT SENTENCES A NINE-YEAR-OLD READS ONCE.

         This used to be jargon: "PATCHED 04:12. THIS LINE IS NOT IN HIS
         LOG." — a timestamp, a verb out of a changelog, and a noun for a
         file nobody has told a child about, all before the first full
         stop. It also still asked Robin about the spare CELLS, which were
         the rover's and the rover is gone, so the most confusing line in
         the game was the one pointing at something that no longer exists.

         THREE FACTS AND A SIGNATURE, and nothing else in them. Somebody
         changed his code. He will not remember it. Stay away from the
         tower. Everything the old version said that was not one of those
         three was atmosphere bought with a child's attention. */
      { shot:FLOOR, hold:2.6, who:'???',
        say:say_('I CHANGED HIS CODE WHILE HE WAS ASLEEP.') },
      { shot:OVER, ease:1.0, hold:2.6, who:'???',
        say:say_('HE WILL NOT REMEMBER ME. I MADE SURE OF THAT.') },
      /* AND E KNOWS WHO YOU ARE. This line was the last "Robin" left in
         the game and it hid from the search that found the others because
         it is shouted — E writes in capitals, so a grep for the name in
         dialogue walked straight past it. It is the one line in the story
         where somebody addresses the player directly and by name, which
         makes it the worst possible one to get wrong. */
      { shot:FLOOR, ease:0.9, hold:2.6, who:'???',
        say:say_('STAY AWAY FROM THE TOWER, {n}.', {n:ME().toUpperCase()}) },
      { shot:FLOOR, hold:2.2, who:'???', say:say_('\u2014 E.') },

      /* --- and it lets go -------------------------------------------- */
      { shot:FLOOR, hold:2.0, on:()=>{ I('rise')(); lightsBack(); } },

      /* --- the rest is his, and the player gets SPACE back -----------
         SHORT SENTENCES AND ORDINARY WORDS. There were nine lines here
         and most of them were the same fact said again in a more abstract
         way: no record of speaking, no record of falling, no gap in the
         log, and somebody who took the hole out after themselves. A
         nine-year-old who has just watched a robot fall over does not
         need the fact four times, they need it once, in words they
         already have. Eight lines became seven and none of them has a
         timestamp in it. */
      { shot:{ eye:[20.4, 1.7, 32.2], at:[16, 1.0, 36] }, ease:1.3,
        who:'Ion',   say:say_('\u2026{n}? Why am I on the floor?',{n:ME()}) },
      { shot:{ eye:[20.4, 1.7, 32.2], at:[16, 1.0, 36] },
        who:'you', say:say_('You were talking. But it was not you talking.') },
      { shot:{ eye:[19.4, 1.35, 33.0], at:[16, 0.95, 36] }, ease:1.1,
        who:'Ion',   say:say_('I do not remember talking. I do not remember falling over.') },
      { shot:{ eye:[19.4, 1.35, 33.0], at:[16, 0.95, 36] },
        who:'Ion',   say:say_('Somebody changed my code while I was asleep. I have been hacked.') },
      { shot:{ eye:[20.8, 1.9, 32.0], at:[16, 1.0, 36] }, ease:1.2,
        who:'you', say:say_('That was them just now. Using your voice.') },
      /* THE ONE IDEA WORTH A WHOLE LINE, and it is the reason the mission
         goes anywhere: he cannot check himself. Said as a picture rather
         than as a principle, because "I am the thing doing the reading"
         is a true sentence that explains nothing to a child. */
      { shot:{ eye:[21.2, 2.1, 31.6], at:[16, 1.0, 36] }, ease:1.1,
        who:'Ion',   say:say_('I cannot check my own code. I would be using the broken part to look at the broken part.') },
      { shot:{ eye:[21.2, 2.1, 31.6], at:[16, 1.0, 36] },
        who:'Ion',   say:say_('I need the Mechanic. Someone who is not me has to look inside me.') },
      { shot:{ eye:[21.2, 2.1, 31.6], at:[16, 1.0, 36] },
        who:'you', say:say_('Then we take the ship. Come on.') },
    ], { faces:FACES, end:()=>{ G.running=true; prompt_(null); after(); } });
  }

  /* ===================================================================
     WHAT IS NEXT, AND SHE WALKS IT.

     THIS USED TO TELEPORT HER. after() called outside(), which tears the
     house down and rebuilds RYU with Robin standing on it — so the scene
     ended in the second room and the next frame was the planet. The walk
     she had just been told to make was made for her, and a player who had
     spent five minutes in two rooms was somewhere else without having
     moved. Worse: the one piece of geography this mission has — the house
     has a front door, and the ship is parked outside it — was never
     something anybody did, only something that happened to them.

     So the controls come back where she is standing, she is turned to
     face the way out, and the prompt walks her there: "back to the front
     door" from the far room, "E — go outside" once she reaches it. The
     door was always able to do this; after() was just never asking it to.
     =================================================================== */
  const ERRAND = ()=>say('Ion needs the Mechanic. The <b>ship</b> is outside \u2014 '
                      + 'out through the front door.');
  const ATSHIP = ()=>say('The <b>E-45</b> is parked beside the house. '
                      + 'Walk up to her and press <b>E</b>.');
  function after(){
    if(!L) return;
    /* `askOut` is a label, not a lock — see onKey(). It says the story is
       pointing at the door, which is what changes the prompt from silence
       into a direction she can follow from anywhere in the house. */
    L.askOut=true;
    faceDoor();
    brief(ERRAND());
  }

  function brief(msg){
    const b=$('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
    clearTimeout(brief._t);
    brief._t=setTimeout(()=>b.classList.add('hidden'), 6000);
  }

  function stop(){
    if(!on) return;
    /* BEFORE L GOES, because the bulbs and the intensities they were found
       at are on it — and three of them are the page's own lights, not this
       room's. A house that walks out half way through the flicker and
       leaves G.sun at a fifth is a planet at dusk for no reason anybody
       standing on it can see. */
    lightsRestore();
    on=false; L=null;
    if(keyHook){ removeEventListener('keydown', keyHook); keyHook=null; }
    if(window.SCENE) SCENE.stop();
    if(window.BOOLQUIZ) BOOLQUIZ.close();
    prompt_(null);
    G.running=true;              // a scene left it false; the next room wants it
    clearTimeout(brief._t);
    const b=$('#briefing'); if(b) b.classList.add('hidden');
    /* Hand the shared HUD back the way we found it. Nobody else owns these
       two headings, so a room that renames them and walks out leaves the
       planet calling itself HOME. */
    const ot=$('#objTitle'); if(ot) ot.textContent=say('MISSION');
    const mn=$('#missionName'); if(mn) mn.textContent='';
  }

  /* The clip runs whether or not the world is live, so he is still
     breathing behind an open pause menu — a character who freezes the
     moment you look away from him is a prop. */
  function tick(dt){
    if(!on || !L) return;
    L.t += dt;
    if(L.ion && L.ion.mixer) L.ion.mixer.update(dt);
    /* Back up to the tile over the same second and a half the crossfade
       takes, so he rises with the pose rather than after it. */
    /* The E prompt follows her about: up when she is over him, down when
       she is not. */
    if(L.askE) prompt_(nearIon() ? say('E \u2014 open Ion\u2019s console') : null);
    else if(L.askOut) prompt_(atDoor() ? say('E \u2014 go outside') : say('Back to the front door'));
    else if(!(window.SCENE && SCENE.active))
      prompt_(atDoor() ? say('E \u2014 go outside') : null);

    /* THE TILE MOVES WITH THE POSE. Every posture he has sits at its own
       height — see tile() — and go() hands the drop over here with the
       same number of seconds the crossfade is taking, so he arrives on
       the floor with the pose rather than after it. */
    const gl=L.ion && L.ion.glide;
    if(gl){
      gl.t=Math.min(1, gl.t + dt/Math.max(0.01, gl.for));
      const u=gl.t*gl.t*(3-2*gl.t);
      L.ion.grp.position.y = gl.from + (gl.to-gl.from)*u;
      if(gl.t>=1) L.ion.glide=null;
    }

    /* And the room, while somebody else has hold of it. */
    const l=L.lit;
    if(l){
      l.t+=dt;
      if(l.back!==null) l.back+=dt;
      const k=litLevel(l);
      for(const b of l.bulbs) b.o.intensity=b.i*k;
      if(l.back!==null && l.back>=COMEBACK) lightsRestore();
    }
  }

  return { enter, stop, tick, outside, get active(){ return on; }, PLAN, ION_TALL };
})();
