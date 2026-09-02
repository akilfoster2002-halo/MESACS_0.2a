/* =====================================================================
   AVATAR — third-person character (Kenney Blocky Characters, CC0).
   The camera rides behind the player's shoulder like Roblox; the crosshair
   still aims from the camera, so shooting works exactly as before.
   ===================================================================== */
window.AVATAR = (function(){
  const IDS = 'abcdefghijklmnopqr'.split('');
  const CHARS = IDS.map(c=>({ id:c, name:'Character '+c.toUpperCase(),
    model:`characters/models/character-${c}.glb`,
    preview:`characters/previews/character-${c}.png` }));

  const cache=new Map();
  let loader=null;
  function load(id){
    if(cache.has(id)) return Promise.resolve(cache.get(id).clone(true));
    loader = loader || new THREE.GLTFLoader();
    const def = CHARS.find(c=>c.id===id) || CHARS[0];
    return new Promise((res,rej)=>{
      loader.load(def.model, g=>{
        const root=g.scene;
        root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
        root.scale.setScalar(1.0);
        cache.set(id, root);
        res(root.clone(true));
      }, undefined, err=>rej(err));
    });
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
  let body=null, bodyId=null;
  async function attach(){
    detach();
    try{
      const m=await load(chosen);
      body=new THREE.Group(); body.add(m);
      G.roomGroup.add(body); bodyId=chosen;
    }catch(e){ console.warn('character failed to load',e); body=null; }
  }
  function detach(){ if(body&&body.parent) body.parent.remove(body); body=null; }
  function update(){
    if(!body) return;
    body.position.set(G.pos.x, 0, G.pos.z);
    body.rotation.y = G.yaw + Math.PI;      // the model faces +z, the camera looks -z
    body.visible = !G.firstPerson;
  }

  return { CHARS, load, pick, attach, detach, update,
           get chosen(){ return chosen; }, set chosen(v){ chosen=v; } };
})();
