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
  const say = (s,p) => (window.t ? t(s,p) : s);

  /* ------------------------------------------------------------ the plan
       #  wall      W  window wall     D  doorway
       .  floor     S  where you come in
       G  somebody stands here — BUILDING calls these guard waypoints,
          which is the closest thing it has to "a person is on this tile".
          Ion is the only one, and he is not standing.

     Two rooms of five by three tiles. At four world units a tile that is
     twenty by twelve each, which is a room you cross in a few steps —
     the point of the walk is the door, not the distance. */
  const PLAN = [
    '###W###',
    '#.....#',
    '#..S..#',
    '#.....#',
    '###D###',
    '#.....#',
    '#..G..#',
    '#.....#',
    '###W###'
  ];

  /* The model, the mixer, and nothing else: he has one clip and it plays
     for as long as the room is open. */
  const ION_MODEL = 'characters/models/ion.glb';
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

  let on=false, L=null, loader=null;

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
      loader.load(ION_MODEL, res, undefined, rej));
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
    mixer.clipAction(clip).play();
    mixer.update(0);
    L.ion={ grp, root, mixer };
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
    G.scene.background=new THREE.Color(0x1a1622);
    G.scene.fog=null;
    if(G.sun){ G.sun.intensity=0.24; G.sun.color.setHex(0xffe6c8);
               G.sun.position.set(30,80,24);
               if(G.sun.target){ G.sun.target.position.set(12,0,16);
                                 G.sun.target.updateMatrixWorld(); } }
    if(G.amb)  G.amb.intensity=0.24;
    if(G.hemi){ G.hemi.intensity=0.40; G.hemi.color.setHex(0xffd9b0);
                G.hemi.groundColor.setHex(0x2a2334); }

    G.room='house'; G.hudOwner='house'; G.missionId=null; G.running=true;
    G.firstPerson=false;
    on=true;

    const built=await BUILDING.build(PLAN, G.roomGroup);
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
    const LID=built.storey;
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
    if(window.AVATAR) AVATAR.attach();

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
    brief(say('Through the door.'));
    if(window.lockPointer) lockPointer($('#view'));
  }

  /* One slab over the whole footprint, facing down. The rooms are lit from
     under it — BUILDING hangs a lamp over the middle of each one — so this
     wants to be dark enough to read as a ceiling and not so dark it turns
     the room into a cave. */
  function roof(y){
    const cols=PLAN.reduce((n,r)=>Math.max(n,r.length),0), rows=PLAN.length;
    const g=new THREE.Mesh(
      new THREE.PlaneGeometry(cols*U(), rows*U()),
      new THREE.MeshLambertMaterial({ color:0x6d6478, side:THREE.FrontSide }));
    g.rotation.x=Math.PI/2;                 // face down, at the people under it
    g.position.set((cols-1)/2*U(), y, (rows-1)/2*U());
    G.roomGroup.add(g);
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
  }

  return { enter, stop, tick, get active(){ return on; }, PLAN, ION_TALL };
})();
