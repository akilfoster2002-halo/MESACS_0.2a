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
  const IDS = 'abcdefghijklmnopqr'.split('');
  const CHARS = IDS.map(c=>({ id:c, name:'Character '+c.toUpperCase(),
    model:`characters/models/character-${c}.glb`,
    preview:`characters/previews/character-${c}.png` }));
  const BASE = 'characters/models/';     // so the .glb finds its texture
  const TALL = 1.85;                     // how tall a person stands, in world units

  const bytes=new Map();
  let loader=null;

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
  let chosen = 'a';
  try{ chosen = localStorage.getItem('dq_char') || 'a'; }catch(e){}
  function pick(id){
    chosen=id;
    try{ localStorage.setItem('dq_char',id); }catch(e){}
    if(window.PROGRESS){ const p=PROGRESS.all(); p.char=id; PROGRESS.complete('char'); }
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
    }catch(e){ console.warn('character failed to load',e); body=null; model=null; }
  }
  function detach(){ if(body&&body.parent) body.parent.remove(body); body=null; model=null; }
  function update(dt, moving, running){
    if(!body) return;
    body.position.set(G.pos.x, G.pos.y - EYE, G.pos.z);
    body.rotation.y = G.yaw + Math.PI;      // the model faces +z, the camera looks -z
    body.visible = !G.firstPerson;
    animate(model, dt, moving ? (running ? 'sprint' : 'walk') : 'idle');
  }

  return { CHARS, load, pick, attach, detach, update, animate,
           get chosen(){ return chosen; }, set chosen(v){ chosen=v; } };
})();
