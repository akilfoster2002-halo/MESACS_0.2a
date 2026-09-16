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
   go through AVATAR — he is a model with one clip, and that clip is the
   whole of what he is doing. See ion() below for why he is loaded here
   rather than added to the roster.
   ===================================================================== */
window.HOUSE = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  /* Read off the kit rather than copied from it: two constants that have
     to agree are two constants that eventually do not. */
  const U = () => (window.BUILDING && BUILDING.UNIT) || 4;
  const say_ = (s,p) => (window.t ? t(s,p) : s);
  const say = say_;

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
    '####W####',
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

  /* Has he been fixed? Kept in the save bag, so a student who gets him up
     and comes back tomorrow does not find him on the floor again. */
  const FIXED='ion_fixed';
  const fixed = () => { try{ return !!(window.PROGRESS && PROGRESS.get(FIXED,0)); }
                        catch(e){ return false; } };

  let on=false, L=null, loader=null, keyHook=null;

  /* E, while she is standing over him and the story is asking for it.
     Everywhere else in this game E is "go in", and G.room==='house' is not
     a room anything else routes it for — so this is the only listener that
     wants it and it keeps to itself. */
  function onKey(e){
    if(!on || !L || !L.askE) return;
    if(e.code!=='KeyE' || !nearIon()) return;
    L.eHit=true;
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

    const clip=(g.animations||[]).find(c=>c.name==='breathless') || (g.animations||[])[0];
    if(!clip){
      /* Silent on purpose everywhere else — rig.play() leaves the current
         clip alone when it cannot find one — and that is exactly how a
         model served from yesterday's cache looks like a robot standing
         to attention for no reason. */
      console.warn('HOUSE: Ion has no "breathless" clip; he will stand in his rest pose');
      L.ion={ grp, root, mixer:null };
      return;
    }
    const mixer=new THREE.AnimationMixer(root);
    const down=mixer.clipAction(clip);
    down.play();
    mixer.update(0);
    /* AND THE CLIP HE GETS UP INTO. It is rig/idle.glb — the same idle
       every person in this game stands in — retargeted onto him by bone
       name, which works because he is a Mixamo skeleton like the rest of
       them and costs nothing but a merge. Crossfaded rather than cut: a
       robot who has just been mended and snaps to attention in one frame
       looks repaired, not relieved. */
    const stand=(g.animations||[]).find(c=>c.name==='idle');
    L.ion={ grp, root, mixer, standing:false };
    L.ion.up=()=>{
      if(L.ion.standing || !stand) return;
      L.ion.standing=true;
      const a=mixer.clipAction(stand);
      a.reset().setEffectiveWeight(1).play();
      down.crossFadeTo(a, 1.4, false);
      /* He came to rest lying down; standing puts his feet back under him,
         so the drop that sat him on the floor has to be undone with him. */
      L.ion.lift = { from:grp.position.y, to:spot.y, t:0 };
    };
    /* AND NOW PUT HIM ON THE FLOOR, which the clip does not do. Mixamo
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
       So ask the skin. */
    root.updateMatrixWorld(true);
    const low=floorOf(root);
    if(low!==null) grp.position.y += spot.y - low;
    else console.warn('HOUSE: cannot skin Ion to the floor; he will lie where the clip puts him');
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
    /* ROBIN'S HOUSE, AND IT SAYS SO ITSELF. You reach it from RYU, which
       has already cast her, so this is the same answer twice — until it
       is not. PLANET.stop() runs a line above, and a room that inherits
       who it is from whichever world happened to load it is a room that
       is Kyle's the first time it is opened from anywhere else. The cast
       still does not touch what the player chose, and setCast is a no-op
       when it is already her. */
    if(window.AVATAR && AVATAR.setCast) AVATAR.setCast('w');
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

    G.room='house'; G.hudOwner='house'; G.missionId=null; G.running=true;
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

    /* THE STORY, unless it has already happened. A student who mended him
       yesterday walks into a house with a working robot in it, which is
       the correct thing to find and not a scene to sit through again. */
    if(fixed()){
      if(L.ion && L.ion.up) L.ion.up();
      if(window.lockPointer) lockPointer($('#view'));
      brief(say('Ion is up and about.'));
      return;
    }
    if(!keyHook){ keyHook=onKey; addEventListener('keydown', keyHook); }
    if(!window.SCENE){ brief(say('Through the door.')); return; }
    SCENE.play(story(), { faces:FACES,
      end:()=>{ G.running=true; prompt_(null); openConsole(); } });
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
  const FACES = {
    Robin: 'characters/previews/character-w.png',
    Ion:   'characters/previews/ion.png'
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
  function faceIon(){
    G.yaw = Math.atan2(-(ION_AT[0]-G.pos.x), -(ION_AT[1]-G.pos.z));
    G.pitch = -0.08;
  }

  function story(){
    const say=say_;
    return [
      /* --- room one: she is awake and she is hungry ------------------- */
      { shot:{ eye:[26, 5.4, 6], at:[16, 1.3, 13] }, ease:0,
        who:'Robin', say:say('Nnngh. Morning.') },
      { shot:{ eye:[20.5, 2.5, 7.5], at:[16, 1.5, 12.5] }, ease:1.1,
        who:'Robin', say:say('Ion? Are you up?') },
      { shot:{ eye:[16, 3.0, 8], at:[16, 1.6, DOOR_Z] }, ease:1.0,
        who:'Robin', say:say('You said you would do pancakes.') },
      /* --- and then she has to walk ---------------------------------- */
      { free:true, who:'Robin', say:say('\u2026Ion?'),
        wait:()=> G.pos.z > DOOR_Z + 2,
        on:()=>{ G.yaw=Math.PI; G.pitch=0.02; prompt_(say('Through the door')); },
        off:()=>prompt_(null) },
      /* --- room two: he is on the floor ------------------------------ */
      { shot:{ eye:[22.5, 1.5, 30], at:[16, 0.6, 36] }, ease:1.3, fade:false,
        who:'Robin', say:say('Ion!') },
      { shot:{ eye:[18.6, 0.85, 33], at:[16, 0.45, 36] }, ease:1.4,
        who:'Ion',   say:say('\u2026m-morning\u2026 R-Robin\u2026') },
      { shot:{ eye:[18.6, 0.85, 33], at:[16, 0.45, 36] },
        who:'Ion',   say:say('my legs will not\u2026 my legs will not\u2026 my legs will not\u2026') },
      { shot:{ eye:[19.5, 1.9, 32], at:[16, 0.5, 36] }, ease:1.0,
        who:'Robin', say:say('He is stuck in a loop. Something in his morning routine is broken.') },
      /* --- and the player is handed the controls back ---------------- */
      { free:true, who:'Robin', say:say('Let me look at his console.'),
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

  /* The console is a separate module: it is a lesson, and it has no idea
     there is a house around it. */
  function openConsole(){
    if(!window.IONFIX){ brief(say_('His console will not open.')); return; }
    /* A SHOT OF THE PANEL FIRST. The console is about to take most of the
       screen, and opening it straight from a shot of the room gives a
       student no idea what the row of lights they are about to program
       even belongs to. One glide down onto his open chest, and the rail
       appears where the camera is already looking. */
    SCENE.play([
      { shot:{ eye:[17.8, 1.45, 33.4], at:[16, 0.80, 36] }, ease:1.1, hold:1.4,
        who:'Robin', say:say('Let me see his morning routine.') }
    ], { faces:FACES, end:()=>{
      if(!on) return;
      IONFIX.open({
        onFixed: ()=>{ try{ if(window.PROGRESS) PROGRESS.set(FIXED,1); }catch(e){}
                       mended(); }
      });
    }});
  }

  /* He gets up. One shot, because the thing that changed is worth looking
     at and the player just earned it. */
  function mended(){
    if(!on || !L) return;
    if(L.ion && L.ion.mixer && L.ion.up) L.ion.up();
    SCENE.play([
      { shot:{ eye:[20.5, 1.6, 31.5], at:[16, 0.8, 36] }, ease:0.9,
        who:'Ion', say:say_('\u2026oh. Oh! That is much better.') },
      { shot:{ eye:[21.5, 2.2, 31], at:[16, 1.0, 36] }, ease:1.0,
        who:'Ion', say:say_('Good morning, Robin. You fixed my legs.') },
      { shot:{ eye:[21.5, 2.2, 31], at:[16, 1.0, 36] },
        who:'Robin', say:say_('Pancakes?') },
      { free:true, who:'Ion', say:say_('Pancakes.') }
    ], { faces:FACES, end:()=>{ G.running=true; prompt_(null); } });
  }

  function brief(msg){
    const b=$('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
    clearTimeout(brief._t);
    brief._t=setTimeout(()=>b.classList.add('hidden'), 6000);
  }

  function stop(){
    if(!on) return;
    on=false; L=null;
    if(keyHook){ removeEventListener('keydown', keyHook); keyHook=null; }
    if(window.SCENE) SCENE.stop();
    if(window.IONFIX) IONFIX.close();
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

    const lift=L.ion && L.ion.lift;
    if(lift){
      lift.t=Math.min(1, lift.t + dt/1.4);
      const u=lift.t*lift.t*(3-2*lift.t);
      L.ion.grp.position.y = lift.from + (lift.to-lift.from)*u;
      if(lift.t>=1) L.ion.lift=null;
    }
  }

  return { enter, stop, tick, get active(){ return on; }, PLAN, ION_TALL };
})();
