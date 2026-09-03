/* =====================================================================
   ZOMBIE — the animated survivor rig (Kenney Animated Characters, CC0).

   The kit ships one body and a pile of swappable skins, with the walk and
   idle in separate files.  So: fetch the body once, parse it fresh for
   every zombie (this build of three has no SkeletonUtils, and clones
   would share one skeleton), paint it with whichever skin the caller
   wants, and bind the clips — which live on the same bone names, so they
   drop straight on.
   ===================================================================== */
window.ZOMBIE = (function(){
  const BASE  = 'zombies/';
  const SKINS = ['zombieA','zombieC','survivorFemaleA','survivorMaleB'];
  const CLIPS = { idle:'idle', run:'run', jump:'jump' };

  let loader=null, body=null, clips=null;
  const skinTex=new Map();

  function skin(name){
    if(!skinTex.has(name)){
      const tx=new THREE.TextureLoader().load(BASE+'skins/'+name+'.png');
      tx.colorSpace=THREE.SRGBColorSpace;
      tx.flipY=false;                       // glTF counts UVs from the top
      skinTex.set(name,tx);
    }
    return skinTex.get(name);
  }
  function bytes(){
    if(!body) body = fetch(BASE+'characterMedium.glb').then(r=>{
      if(!r.ok) throw new Error('missing '+BASE+'characterMedium.glb');
      return r.arrayBuffer();
    });
    return body;
  }
  /* the clips are plain data — load them once and share them around */
  function animations(){
    if(clips) return clips;
    loader = loader || new THREE.GLTFLoader();
    const names=Object.keys(CLIPS);
    clips = Promise.all(names.map(n=>new Promise(res=>
      loader.load(BASE+CLIPS[n]+'.glb', g=>res(g.animations||[]), undefined, ()=>res([]))
    ))).then(sets=>{
      const out={};
      names.forEach((n,i)=>{
        // FBX2glTF names them "Root|Idle" — take the one that is the motion,
        // not the T-pose that rides along with it
        const list=sets[i];
        out[n] = list.find(a=>new RegExp(n,'i').test(a.name)) || list[list.length-1] || null;
      });
      return out;
    });
    return clips;
  }

  async function make(opt){
    opt=opt||{};
    loader = loader || new THREE.GLTFLoader();
    const buf=await bytes();
    const g=await new Promise((res,rej)=>loader.parse(buf.slice(0), BASE, res, rej));
    const root=g.scene;
    const tex=skin(SKINS.indexOf(opt.skin)>=0 ? opt.skin : SKINS[0]);
    root.traverse(o=>{
      if(!o.isMesh) return;
      o.frustumCulled=false;
      // the kit's material is a grey phong stand-in; give it the skin and
      // take the metalness off, or it renders almost black
      o.material=o.material.clone();
      o.material.map=tex;
      o.material.color.setHex(0xffffff);
      o.material.metalness=0;
      o.material.roughness=0.92;
      o.material.needsUpdate=true;
    });
    // the kit models in centimetres — stand everyone at the asked-for height
    const box=new THREE.Box3().setFromObject(root);
    const h=box.max.y-box.min.y;
    if(h>0.001) root.scale.setScalar((opt.height||2)/h);

    const holder=new THREE.Group();
    holder.add(root);
    const cl=await animations();
    holder.userData.rig=rig(root, cl);
    holder.userData.hand=root.getObjectByName('RightHand')||null;
    return holder;
  }

  function rig(root, cl){
    const mixer=new THREE.AnimationMixer(root);
    let cur=null, curName=null;
    return {
      play(name, fade){
        if(curName===name) return;
        const clip=cl[name]; if(!clip) return;
        const next=mixer.clipAction(clip);
        next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.2:fade).play();
        if(cur) cur.fadeOut(fade===undefined?0.2:fade);
        cur=next; curName=name;
      },
      update(dt){ mixer.update(dt||0); }
    };
  }
  function animate(obj, dt, name){
    const r = obj && obj.userData && obj.userData.rig;
    if(!r) return;
    if(name) r.play(name);
    r.update(dt);
  }

  return { SKINS, make, animate };
})();
