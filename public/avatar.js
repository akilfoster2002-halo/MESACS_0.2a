/* =====================================================================
   AVATAR — third-person character (Kenney Blocky Characters, CC0).
   The camera rides behind the player's shoulder like Roblox; the crosshair
   still aims from the camera, so shooting works exactly as before.

   Each character is parsed fresh from the same downloaded bytes instead of
   being cloned: this build of three has no SkeletonUtils, and a plain
   clone would share one skeleton, so every guard would walk the player's
   walk.  Parsing again is cheap — the file is only fetched once.
   ===================================================================== */
window.AVATAR = (function(){
  // order matters: chars.js unlocks the first FREE of these
  /* FOUR PEOPLE, ALL OF THEM PROPERLY MADE.

     There used to be twenty: Kyle, Mia, and eighteen out of the Kenney
     blocky kit. The kit characters were what this game had before it had
     anybody, and they are four bones and an idle — they cannot walk
     convincingly, cannot dance, and stand next to Kyle looking like a
     placeholder, because that is what they were. Nineteen choices of
     placeholder is not more choice than one good one.

     So the roster is the rigged characters — Kyle, Mia, Savannah and
     Carlos — all on the same skeleton, the same clips and the same scale
     (see "glb files"/README.md for how one gets here). Kyle leads: he is
     the character this game is about, and he is the one you are unless you
     say otherwise, which is now a keypress rather than a walk to the Mall. */
  const IDS = 'stuv'.split('');
  const NAMES = { s:'Kyle', t:'Mia', u:'Savannah', v:'Carlos' };
  /* ?v= on the asset, not just on the script. Without it a changed model
     is invisible for a day behind the server's cache header. */
  const V = ()=> '?v='+(window.ASSETV||'1');
  const CHARS = IDS.map(c=>({ id:c, name:NAMES[c] || ('Character '+c.toUpperCase()),
    model:`characters/models/character-${c}.glb`+V(),
    preview:`characters/previews/character-${c}.png`+V() }));
  const BASE = 'characters/models/';     // so the .glb finds its texture
  const TALL = 1.85;                     // how tall a person stands, in world units
  const HELD = 0.70;                     // and how long the blaster in their hand reads

  const BLASTER='blasters/blaster-g.glb';
  const bytes=new Map();
  let loader=null, gunProto=null;

  function file(id){
    const def = CHARS.find(c=>c.id===id) || CHARS[0];
    if(!bytes.has(def.id))
      bytes.set(def.id, fetch(def.model).then(r=>{
        if(!r.ok) throw new Error('missing '+def.model);
        return r.arrayBuffer();
      }));
    return bytes.get(def.id);
  }

  async function load(id){
    loader = loader || new THREE.GLTFLoader();
    const buf = await file(id);
    const g = await new Promise((res,rej)=>
      loader.parse(buf.slice(0), BASE, res, rej));
    const root = g.scene;
    root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; o.frustumCulled=false; }
      /* a model that carries its colour in the mesh rather than in a
         texture has to be told to use it */
      if(o.isMesh && o.geometry.attributes.color){ o.material.vertexColors=true;
                                                   o.material.needsUpdate=true; } });
    // the kit models at its own scale — stand everyone the same height
    /* MEASURE THE WORLD, NOT THE INTENTION. setFromObject reads each
       child's matrixWorld, and straight out of the loader those are all
       identity — so any scale sitting on the model's own root node is not
       counted and the height comes back wrong. The kit models happen to
       carry no root scale, which is why this never showed; a model that
       has been through FBX comes back a hundredth of its size with the
       correction on the root, and without this it is normalised from the
       wrong number. */
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y;
    /* Any positive height is a height. The old floor of 0.1 was there to
       dodge a divide by zero and instead became a silent way to fail: a
       model that arrives a hundredth of a unit tall — which is exactly
       what comes back from FBX — fell under it, was left unscaled, and
       rendered as an invisible speck with no error anywhere. */
    if(h > 1e-6) root.scale.setScalar(TALL / h);
    else console.warn('character has no height, cannot scale:', id);
    root.userData.rig = rig(root, g.animations||[]);
    return root;
  }

  /* The blaster the character is actually carrying.  The one in GUN hangs
     off the camera and only exists in first person, so in third person the
     player was holding nothing at all. */
  function blaster(){
    if(!gunProto){
      loader = loader || new THREE.GLTFLoader();
      gunProto = new Promise((res,rej)=>loader.load(BLASTER, g=>res(g.scene), undefined, rej));
    }
    return gunProto;
  }
  async function equip(root){
    const arm=root.getObjectByName('arm-right');
    if(!arm) return null;
    let src;
    try{ src=await blaster(); }catch(e){ return null; }
    const gun=src.clone(true);
    // the arm carries the whole body's normalising scale — divide it back out
    // so the blaster is sized in world units rather than character units
    const ws=new THREE.Vector3(); arm.getWorldScale(ws);
    const k=1/(ws.x||1);
    const box=new THREE.Box3().setFromObject(gun);
    const len=Math.max(0.001, box.max.z-box.min.z);
    gun.scale.setScalar((HELD/len)*k);
    gun.rotation.y = Math.PI;              // the model's muzzle is -Z, the body faces +Z

    /* Put it in the HAND.  Guessed offsets land wherever the rig happens to
       put its origin, so read the arm's own geometry and hang the blaster off
       the far end of it, on the outside of the body. */
    let limb=null; arm.traverse(o=>{ if(!limb && o.isMesh && o.geometry) limb=o; });
    if(limb){
      limb.geometry.computeBoundingBox();
      const b=limb.geometry.boundingBox;
      const midX=(b.min.x+b.max.x)/2;
      const outX=Math.abs(b.min.x)>Math.abs(b.max.x) ? b.min.x : b.max.x;
      gun.position.set(midX + (outX-midX)*0.45,       // outboard, clear of the hip
                       b.min.y + (b.max.y-b.min.y)*0.10,  // down at the hand
                       b.max.z + 0.04);               // just in front of the arm
    } else {
      gun.position.set(-0.28*k, -0.90*k, 0.24*k);
    }
    gun.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    arm.add(gun);
    return gun;
  }

  /* idle / walk / sprint, crossfaded so nobody pops between poses */
  function rig(root, clips){
    if(!clips.length) return null;
    const mixer=new THREE.AnimationMixer(root);
    let cur=null, curName=null;
    return {
      play(name, fade){
        if(curName===name) return;
        const clip=clips.find(c=>c.name===name);
        if(!clip) return;
        const next=mixer.clipAction(clip);
        next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
        if(cur) cur.fadeOut(fade===undefined?0.18:fade);
        cur=next; curName=name;
      },
      update(dt){ mixer.update(dt); },
      /* An emote can only be offered by a character who actually has one,
         and it has to know how long to hold before handing control back. */
      has(name){ return clips.some(c=>c.name===name); },
      seconds(name){ const c=clips.find(x=>x.name===name); return c?c.duration:0; }
    };
  }
  /* KEEP BREATHING WHILE THE WORLD IS HELD STILL. Whatever normally drives
     the player's body does it from inside the block a frozen world skips,
     so a panel that freezes the game to ask you something leaves a statue
     of yourself standing behind it. The quick change is exactly that panel,
     and what it is asking you to look at is a character. */
  function idle(dt){ if(model) animate(model, dt||0, 'idle'); }
  /* CAN THE BODY YOU ARE WEARING DO THIS? play() leaves the current clip
     alone when it cannot find the name — which is the right thing to do
     and is also completely silent, so asking for a clip a model has not
     got looks exactly like the clip playing and doing nothing. That cost
     an afternoon once: the flying animation was in the file, and the
     browser was serving yesterday's copy of the file from cache. */
  function can(name){
    const r = model && model.userData && model.userData.rig;
    return !!(r && r.has(name));
  }

  /* drive anything that came out of load() — the player, a guard, anyone */
  function animate(obj, dt, name){
    const r = obj && obj.userData && obj.userData.rig;
    if(!r) return;
    if(name) r.play(name);
    r.update(dt||0);
  }

  /* who the player is */
  /* Everybody starts as SOMEBODY. Nobody has to pick a character before they
     are allowed to play — the first time you arrive you are handed one of the
     free four at random and the Wardrobe is where you change it. A saved
     choice always wins, so this only ever fires once. */
  const FREE_AT_START = 4;
  let chosen = null;
  try{ chosen = localStorage.getItem('dq_char'); }catch(e){}
  if(!chosen || !CHARS.some(c=>c.id===chosen)){
    /* Not a random one of the free four any more. There is a main
       character now, and being handed somebody else on your first run
       made the Wardrobe a chore before it was a choice. */
    chosen = CHARS[0].id;
    try{ localStorage.setItem('dq_char', chosen); }catch(e){}
  }
  /* SOMEBODY WHO IS NOT YOU. The librarian, the guard on his beat and the
     resident behind the decks all want a body that is not the one the
     player is wearing — two of you in a room is a bug, not a cast. With a
     roster of two that is simply the other one; the modulo is there so it
     stays true if a third is ever added. */
  function other(offset){
    const i=CHARS.findIndex(c=>c.id===chosen);
    return CHARS[((i<0?0:i) + (offset||1) + CHARS.length) % CHARS.length].id;
  }
  function pick(id){
    chosen=id;
    try{ localStorage.setItem('dq_char',id); }catch(e){}
    /* PUT IT ON NOW. pick() used to do nothing but write the choice down,
       so the body already standing in the world went on being whoever it
       was until something else happened to rebuild the room — which in
       practice meant reloading the game. Every way of changing character
       ends up here: the Mall's grid, the mannequins you walk up to, and
       the shop when you buy one. So this is the one place it has to
       happen, and now it does. */
    if(body) attach();
    /* RECORD the choice; do not COMPLETE it. complete() is the mission
       payout path — it hands over coins and XP, at a quarter rate on a
       repeat — so changing your character paid you fifteen coins, every
       time, for ever. Nobody noticed while that meant walking to a menu and
       clicking a thumbnail. The Mall turns it into standing in one spot
       pressing E, which is a money printer with a shop attached. */
    if(window.PROGRESS) PROGRESS.set('char', id);
  }

  /* the player's own body, third person */
  let body=null, model=null;
  /* WHAT THE BODY IS DOING, worked out in one place because three callers
     want it: the two that draw us, and presence, which sends the name to
     everybody else's screen.  Their body used to guess from how fast it
     was crossing the ground, which can see a walk and a sprint and cannot
     ever see a jump — you go straight up, your speed over the ground does
     not change, and the classmate watching you sees you keep walking.

     ASK FOR A JUMP AND TAKE WHAT YOU GET. play() leaves the current clip
     alone when it cannot find the name, so a character with a jump plays
     it and one without carries on with whatever it was doing — which is
     exactly the clean held pose the kit characters have always used.
     Naming a clip nobody has was the old way of saying the same thing;
     naming the real one costs them nothing and pays whoever has it. */
  let acting='idle';
  /* A POSTURE OUTRANKS THE LEGS. Walk, sprint, jump and idle are all worked
     out from how fast the body is crossing the ground and whether it is
     touching it — which is the right question for somebody on their feet
     and the wrong one for somebody in the air, where every answer it can
     give is a person running on nothing.

     So a caller that owns the body's whole situation — flight, and one day
     swimming — says so once, and the legs stop being asked. An emote still
     wins: dancing in mid-air is a thing a nine-year-old will try in the
     first minute and there is no reason to stop them. */
  let posture=null;
  function setPosture(name){ posture = name || null; }
  function clipFor(dt, moving, running, onGround){
    return acting = emoteFrame(dt, moving)
                 || posture
                 || (onGround===false ? 'jump'
                 : moving ? (running ? 'sprint' : 'walk') : 'idle');
  }
  /* AN EMOTE IS A CLIP THAT IS NOT A STATE. Every other clip answers a
     question about the body — is it moving, is it airborne — and is chosen
     fresh each frame from the answer. This one is chosen because somebody
     pressed a button, so it needs somewhere to live between frames: how
     long is left of it, and which one it was.

     Walking cancels it. Nobody wants to watch their character finish a
     dance they have changed their mind about halfway through. */
  let emoting=0, emoteClip=null;
  /* Which attach is the current one. Two characters clicked quickly are two
     loads in flight, and the slower one must not win by finishing last. */
  let attachSeq=0;
  const rigOf = m => (m && m.userData && m.userData.rig) || null;
  function emote(name){
    const r=rigOf(model);
    name=name||'dance';
    if(!r || !r.has(name)) return false;
    emoteClip=name; emoting=r.seconds(name) || 3;
    return true;
  }
  function canEmote(name){
    const r=rigOf(model);
    return !!(r && r.has(name||'dance'));
  }
  const emoting_ = ()=> emoting>0;
  /* Returns the clip to play, or null to carry on as normal. Shared by both
     drivers — the flat world's update() and the planet's orient() — because
     an emote that only worked on one of them would be a bug somebody found
     by walking through a door. */
  function emoteFrame(dt, moving){
    if(emoting<=0) return null;
    if(moving){ emoting=0; return null; }
    emoting-=dt;
    return emoting>0 ? emoteClip : null;
  }
  /* LOAD FIRST, SWAP AFTER. Detaching up front left the world with nobody
     standing in it for as long as the new character took to arrive — a
     visible hole every time somebody changed clothes. The one you are
     wearing stays until the one you asked for is ready. */
  async function attach(){
    const seq=++attachSeq;
    let m;
    try{ m=await load(chosen); }
    catch(e){ console.warn('character failed to load',e); return; }
    if(seq!==attachSeq) return;            // they picked again while this loaded
    if(!G.roomGroup){ detach(); return; }  // nowhere to stand
    detach();
    model=m;
    body=new THREE.Group(); body.add(m);
    G.roomGroup.add(body);
    /* STAND THE NEW BODY WHERE THE OLD ONE WAS. A fresh Group is at the
       origin, and on a planet the origin is the middle of the ball — so
       swapping character while the world is held still put the new one
       three hundred metres underground and the player simply vanished.
       Nothing put it right afterwards either, because what normally moves
       the body is the walking code, and that is the very thing a frozen
       world is not running.

       The pose matters as much as the place: without it the new body
       stands in its bind pose, arms out, until something animates it. */
    if(placed){
      body.position.copy(placed.pos);
      body.quaternion.copy(placed.quat);
      body.visible=placed.vis;
    }
    /* IDLE, AT FULL WEIGHT, RIGHT NOW. play() normally crossfades over
       0.18s, and a crossfade that has not been stepped yet is weight zero
       — which is the bind pose. Asking for it with no fade and then
       stepping the mixer once is the difference between a character and a
       mannequin with its arms out. */
    const r=m.userData.rig;
    if(r){ r.play('idle', 0); r.update(0.05); }
    /* The hips, found once. Whatever the body is doing, that bone is the
       middle of it — see centre() below. */
    hipBone=null;
    m.traverse(o=>{ if(!hipBone && /Hips$/.test(o.name||'')) hipBone=o; });
    equip(m);                              // give them something to hold
  }
  function detach(){ if(body&&body.parent) body.parent.remove(body); body=null; model=null;
                     hipBone=null; emoting=0; emoteClip=null; }
  /* WHERE THE BODY ACTUALLY IS, which is not where it was put.

     Callers place the body at the ground under it and let the clip decide
     the rest — which is right, and means the group's own position is the
     character's FEET when they are standing and nowhere near them when
     they are not. The flying pose lies flat with the hips a metre up and
     the whole body a couple of metres along the nose, so anything that
     wants to draw at the character rather than at the spot they are
     standing on has to ask.

     The hips are the answer. It is the root of every Mixamo clip and it
     is the middle of a person in all of them. */
  let hipBone=null;
  function centre(out){
    const v=out||new THREE.Vector3();
    if(!body) return v;
    if(hipBone){ hipBone.getWorldPosition(v); return v; }
    return v.copy(body.position);
  }
  /* Where the body was last put, kept so a replacement can pick it up. Both
     of the things that place one write here — the flat rooms, which turn a
     body with a heading, and the planets, which stand it on a surface
     normal — so one record covers both. */
  let placed=null;
  function remember(){
    if(!body) return;
    if(!placed) placed={ pos:new THREE.Vector3(), quat:new THREE.Quaternion(), vis:true };
    placed.pos.copy(body.position);
    placed.quat.copy(body.quaternion);
    placed.vis=body.visible;
  }
  /* On a round world a body cannot be placed with a y-rotation — it has to
     stand along the surface normal, which points somewhere different at every
     step. A caller that owns its own gravity hands the basis in and this puts
     the model on it. The model faces +Z, so +Z is where the player is facing. */
  function orient(pos, up, fwd, dt, moving, running, onGround){
    if(!body) return;
    const u=up.clone().normalize();
    const f=fwd.clone().sub(u.clone().multiplyScalar(fwd.dot(u))).normalize();
    const r=new THREE.Vector3().crossVectors(u, f).normalize();   // right-handed: r × u = f
    body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    body.position.copy(pos);
    body.visible=!G.firstPerson;
    remember();
    animate(model, dt, clipFor(dt, moving, running, onGround));
  }
  function update(dt, moving, running, onGround){
    if(!body) return;
    body.position.set(G.pos.x, G.pos.y - EYE, G.pos.z);
    body.rotation.y = G.yaw + Math.PI;      // the model faces +z, the camera looks -z
    body.visible = !G.firstPerson;
    remember();
    animate(model, dt, clipFor(dt, moving, running, onGround));
  }

  /* WHO THE ACCOUNT SAYS YOU ARE. pick() has always written the choice into
     the progress bag as well as into this browser, and nothing has ever read
     it back — so the character followed the machine rather than the child.
     Sit down at the other side of the lab and you were Kyle again.

     It cannot be done where `chosen` is first worked out, at the top of this
     file: the bag has not been fetched from the server yet when scripts run.
     So it is a second, later question, asked by whoever loads a bag —
     sign-in, sign-up and the resume on boot. A bag with no character in it
     leaves this browser's choice exactly as it is, which is what makes it
     safe to call whether anybody is signed in or not. */
  function restore(){
    if(!window.PROGRESS || !PROGRESS.get) return chosen;
    const want=PROGRESS.get('char', null);
    if(!want || want===chosen || !CHARS.some(c=>c.id===want)) return chosen;
    pick(want);
    return chosen;
  }

  return { CHARS, load, pick, restore, other, attach, detach, update, orient, animate, idle,
           posture:setPosture, can, centre, get wearing(){ return posture; },
           emote, canEmote, get emoting(){ return emoting>0; },
           get act(){ return acting; },
           get chosen(){ return chosen; }, set chosen(v){ chosen=v; } };
})();
