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
  // order matters: chars.js unlocks the first FREE of these. Nia is moved up
  // so the four starting characters aren't all boys/bots — Cato slides back
  // to fifth, ready to unlock first once PER_MISSION rewards are turned on.
  const IDS = 'abndcefghijklmopqr'.split('');
  // a name each, initial matching the file, so nobody is "Character G"
  const NAMES = { a:'Ash', b:'Bex', c:'Cato', d:'Dot', e:'Enzo', f:'Fin',
                  g:'Gus', h:'Hana', i:'Iris', j:'Jax', k:'Kit', l:'Lex',
                  m:'Mo',  n:'Nia', o:'Ozzy', p:'Pip', q:'Quinn', r:'Rae' };
  const CHARS = IDS.map(c=>({ id:c, name:NAMES[c] || ('Character '+c.toUpperCase()),
    model:`characters/models/character-${c}.glb`,
    preview:`characters/previews/character-${c}.png` }));
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
    root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; o.frustumCulled=false; } });
    // the kit models at its own scale — stand everyone the same height
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y;
    if(h > 0.1) root.scale.setScalar(TALL / h);
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
      update(dt){ mixer.update(dt); }
    };
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
    const pool=CHARS.slice(0, Math.min(FREE_AT_START, CHARS.length));
    chosen = pool[Math.floor(Math.random()*pool.length)].id;
    try{ localStorage.setItem('dq_char', chosen); }catch(e){}
  }
  function pick(id){
    chosen=id;
    try{ localStorage.setItem('dq_char',id); }catch(e){}
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
  async function attach(){
    detach();
    try{
      const m=await load(chosen);
      model=m;
      body=new THREE.Group(); body.add(m);
      G.roomGroup.add(body);
      equip(m);                            // give them something to hold
    }catch(e){ console.warn('character failed to load',e); body=null; model=null; }
  }
  function detach(){ if(body&&body.parent) body.parent.remove(body); body=null; model=null; }
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
    animate(model, dt, onGround===false ? 'static'
                     : moving ? (running ? 'sprint' : 'walk') : 'idle');
  }
  function update(dt, moving, running, onGround){
    if(!body) return;
    body.position.set(G.pos.x, G.pos.y - EYE, G.pos.z);
    body.rotation.y = G.yaw + Math.PI;      // the model faces +z, the camera looks -z
    body.visible = !G.firstPerson;
    // the kit has no jump clip, so hold a clean pose while off the ground
    const clip = onGround===false ? 'static'
               : moving ? (running ? 'sprint' : 'walk') : 'idle';
    animate(model, dt, clip);
  }

  return { CHARS, load, pick, attach, detach, update, orient, animate,
           get chosen(){ return chosen; }, set chosen(v){ chosen=v; } };
})();
