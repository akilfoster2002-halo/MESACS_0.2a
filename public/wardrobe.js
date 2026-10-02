/* =====================================================================
   WARDROBE — what everybody wears.

   A BODY, AND THINGS ON IT. Every person in this game is one skinned mesh
   on the shared Mixamo skeleton (avatar.js). Clothes are more meshes on
   that same skeleton, bound to the body's OWN bones the moment they go on,
   so they move with it through every clip without an animation of their
   own — and taking one off is taking it away: nothing reloads, and the
   clip the body is in carries straight on. That is what makes trying
   something on smooth, and what makes a new outfit one more entry below.

   THREE KINDS OF THING
     garment    a skinned mesh made for a body (a jacket, trousers), in that
                body's bind space. It HIDES the regions of the body it covers,
                so an elbow never pokes through a sleeve.
     accessory  a rigid model on one bone (shoes on the feet, a pack on the
                back, glasses on the face), sized and placed from the body's
                own skeleton when it goes on — so one file fits everybody.
     made       an accessory drawn here in code: things too simple to be a
                file (the hood and shades, the Gecko cuffs, the bangle).

   SLOTS hold one thing each. REGIONS are the parts of a body a garment can
   hide, read off the skin: a triangle belongs to whichever bone moves it
   most.

   THE BASE BODY. Everybody's base is a plain, modest outfit — a fitted
   grey tee, black knee-length bike shorts, white socks — and everything
   else goes on over it. A body that was made before this (their whole
   look in one mesh) still works: accessories go on it as they are, and a
   garment hides the regions of the old clothes it replaces.

   THE CLOSET is what this player owns and what each body has on, kept in
   this browser and in the progress bag; an OUTFIT is a named set of slots.
   Other players see what you have on: it travels as `fit` (see code()).

   ADDING SOMETHING TO WEAR is an entry in ITEMS and, for a garment, one
   file per body from glb files/wardrobe/ (see its README).
   ===================================================================== */
window.WARDROBE = (function(){
  const V = () => '?v=' + (window.ASSETV || '1');
  const DIR = 'characters/wardrobe/';

  /* ------------------------------------------------------------ slots */
  const SLOTS = [
    { id:'outer',  name:'Jackets' },
    { id:'top',    name:'Tops' },
    { id:'bottom', name:'Bottoms' },
    { id:'shoes',  name:'Shoes' },
    { id:'hands',  name:'Gloves' },
    { id:'wrist',  name:'Wrists' },
    { id:'head',   name:'Head' },
    { id:'face',   name:'Glasses' },
    { id:'back',   name:'Bags' }
  ];
  /* -------------------------------------------------------- regions
     Which bones move which part of a person. A triangle goes to the region
     of the bone with the most weight on its first corner. */
  const REGION_OF = {
    Hips:'hips', Spine:'torso', Spine1:'torso', Spine2:'torso', Neck:'neck', Head:'head', HeadTop_End:'head', headfront:'head',
    LeftShoulder:'torso', RightShoulder:'torso', LeftArm:'upperArms', RightArm:'upperArms',     // a collarbone is the top of the torso (long hair often hangs off it)
    LeftForeArm:'forearms', RightForeArm:'forearms', LeftHand:'hands', RightHand:'hands',
    LeftUpLeg:'thighs', RightUpLeg:'thighs', LeftLeg:'shins', RightLeg:'shins',
    LeftFoot:'feet', RightFoot:'feet', LeftToeBase:'feet', RightToeBase:'feet'
  };
  const REGIONS = ['head', 'neck', 'torso', 'hips', 'upperArms', 'forearms', 'hands', 'thighs', 'shins', 'feet'];

  /* ------------------------------------------------------------- items
     Everything there is to wear. `bodies` lists who a garment has been
     made for (a garment is a file per body); an accessory or a made thing
     fits anybody. `hides` is the regions of the body it covers. */
  const ITEMS = {
    'tech-jacket':  { name:'Techwear jacket', slot:'outer', kind:'garment', hides:['upperArms', 'forearms'], bodies:['robin', 'nia', 'kofi', 'sable', 'zuri'], glow:0.35,
                      about:'Cropped, high collar, conductive thread in the seams. Robin made it.' },
    'skyline-shoes':{ name:'Skyline shoes', slot:'shoes', kind:'accessory', model:'skyline-shoe', fit:'feet', hides:['feet'],
                      about:'Her own high-tops, rebuilt: coils in the heels.' },
    'roll-top':     { name:'Roll-top backpack', slot:'back', kind:'accessory', model:'roll-top', fit:'back',
                      about:'Black, water-tight, a teal strip down one side.' },
    'gecko-cuffs':  { name:'Gecko cuffs', slot:'hands', kind:'made', make:'cuffs',
                      about:'Grip film in the palms; a teal line burns while it holds.' },
    'flash-bangle': { name:'Flash bangle', slot:'wrist', kind:'made', make:'bangle',
                      about:'White enamel and six lights. Clap, and anybody facing you sees white.' },
    'hood':         { name:'Hood and shades', slot:'head', kind:'made', make:'hood',
                      about:'Up, and nobody filming you gets your face.' },
    'beanie':       { name:'Beanie', slot:'head', kind:'accessory', model:'beanie', fit:'crown', tune:{ size:0.205, along:0.49 },
                      about:'Black rib knit.' },
    'cap':          { name:'Cap', slot:'head', kind:'accessory', model:'cap', fit:'crown', tune:{ size:0.31, along:0.64, fwd:0.02, brim:true },
                      about:'A plain cap, worn forward.' },
    'shades':       { name:'Sunglasses', slot:'face', kind:'accessory', model:'shades', fit:'eyes', tune:{ along:0.47, fwd:0.06, size:0.15 },
                      about:'Round, black.' }
  };
  const itemsIn = slot => Object.keys(ITEMS).filter(id=>ITEMS[id].slot === slot);
  /* a garment fits only the bodies it was made for */
  function fits(id, body){
    const it = ITEMS[id]; if(!it) return false;
    return it.kind !== 'garment' || (it.bodies || []).includes(body);
  }

  /* ------------------------------------------------------------ closet
     What you own, what each body has on, and the outfits you have saved.
     Everything in the catalog is yours to start with; give() is for the
     day something has to be earned or bought. */
  const KEY = 'dq_closet';
  let closet = null;
  function fresh(){ return { owned:Object.keys(ITEMS), on:{}, outfits:{} }; }
  function load(){
    if(closet) return closet;
    try{ closet = JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(e){ closet = null; }
    if(!closet || typeof closet !== 'object') closet = fresh();
    closet.owned = Array.from(new Set((closet.owned || []).concat(Object.keys(ITEMS).filter(id=>!ITEMS[id].price))));
    closet.on = closet.on || {}; closet.outfits = closet.outfits || {};
    return closet;
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(closet)); }catch(e){}
    try{ if(window.PROGRESS && PROGRESS.set) PROGRESS.set('closet', closet); }catch(e){}
  }
  /* another machine's closet, once the bag has come down (sign-in): it wins over this browser's */
  function restore(){
    try{ const c = window.PROGRESS && PROGRESS.get && PROGRESS.get('closet', null); if(c && typeof c === 'object'){ closet = null; localStorage.setItem(KEY, JSON.stringify(c)); load(); changed(); } }catch(e){}
  }
  const owns = id => load().owned.includes(id);
  function give(id){ if(ITEMS[id] && !owns(id)){ load().owned.push(id); save(); changed(); } }
  /* what `body` has on: { slot:itemId } (a copy) */
  function on(body){ return Object.assign({}, load().on[body] || {}); }
  function setOn(body, slots){
    const c = load(), clean = {};
    Object.keys(slots || {}).forEach(s=>{ const id = slots[s]; if(id && ITEMS[id] && ITEMS[id].slot === s && fits(id, body)) clean[s] = id; });
    c.on[body] = clean; save(); changed(body);
  }
  function wear(id, body){
    const it = ITEMS[id]; if(!it || !fits(id, body)) return false;
    const s = on(body); s[it.slot] = id; setOn(body, s); return true;
  }
  function takeOff(slot, body){ const s = on(body); delete s[slot]; setOn(body, s); }
  function saveOutfit(name, body){ const c = load(); c.outfits[name] = on(body); save(); changed(); }
  function wearOutfit(name, body){ const o = load().outfits[name]; if(o) setOn(body, o); }
  function dropOutfit(name){ const c = load(); delete c.outfits[name]; save(); changed(); }

  /* WHAT TRAVELS: "slot:item,slot:item", short enough to ride on every presence update */
  const code = slots => Object.keys(slots || {}).sort().map(s=>s + ':' + slots[s]).join(',');
  function decode(str){ const o = {}; String(str || '').split(',').forEach(p=>{ const [s, id] = p.split(':'); if(s && id && ITEMS[id] && ITEMS[id].slot === s) o[s] = id; }); return o; }

  /* a cast (a story putting Robin in her kit) dresses a body without touching what the player saved */
  const casts = {};
  function cast(body, slots){ if(slots) casts[body] = Object.assign({}, slots); else delete casts[body]; changed(body); }
  const lookOf = body => casts[body] || on(body);

  /* ---------------------------------------------------------- dressing
     put(model, body, slots) dresses a character AVATAR.load() returned:
     everything it had on that is not in `slots` comes off, everything in
     `slots` it did not have goes on. Called again with a different set,
     it changes only the difference — which is what a try-on wants. */
  const loader = () => put.loader || (put.loader = (()=>{ const L = new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder); return L; })());
  const files = new Map();
  function gltf(url){
    if(!files.has(url)) files.set(url, new Promise((ok, no)=>loader().load(url + V(), ok, undefined, no)).catch(e=>{ files.delete(url); throw e; }));
    return files.get(url);
  }
  function skinnedOf(model){ let s = null; model.traverse(o=>{ if(!s && o.isSkinnedMesh && !o.userData.worn) s = o; }); return s; }
  const clean = n => String(n || '').replace(/^mixamorig:?/, '');
  function boneOf(model, name){ let b = null; model.traverse(o=>{ if(!b && o.isBone && clean(o.name) === name) b = o; }); return b; }

  /* the body's triangles, sorted by region, so a region can be switched off as one draw group */
  function regions(mesh){
    if(mesh.userData.regions) return mesh.userData.regions;
    const g = mesh.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    if(!g.index || !SI){ mesh.userData.regions = { groups:[] }; return mesh.userData.regions; }
    const names = mesh.skeleton.bones.map(b=>clean(b.name));
    const regionOfVert = i => { let best = 0, bw = -1; for(let k=0;k<4;k++){ const w = SW.getComponent(i, k); if(w > bw){ bw = w; best = SI.getComponent(i, k); } } return REGION_OF[names[best]] || 'torso'; };
    const idx = g.index.array, buckets = {}; REGIONS.forEach(r=>buckets[r] = []);
    for(let t=0;t<idx.length;t+=3){ const r = regionOfVert(idx[t]); (buckets[r] || buckets.torso).push(idx[t], idx[t+1], idx[t+2]); }
    const out = [], groups = []; let at = 0;
    REGIONS.forEach(r=>{ const b = buckets[r]; if(!b.length) return; groups.push({ region:r, start:at, count:b.length }); for(const v of b) out.push(v); at += b.length; });
    g.setIndex(out); g.clearGroups(); groups.forEach(gr=>g.addGroup(gr.start, gr.count, 0));
    const shown = mesh.material, hidden = shown.clone(); hidden.visible = false;
    mesh.material = [shown, hidden];
    mesh.userData.regions = { groups };
    return mesh.userData.regions;
  }
  function hideRegions(mesh, set){
    const R = regions(mesh);
    R.groups.forEach((gr, i)=>{ mesh.geometry.groups[i].materialIndex = set.has(gr.region) ? 1 : 0; });
  }

  /* the body's frame at bind: up, its left and its forward, read off the shoulders (no rig agrees on bone axes) */
  function frame(model){
    const ls = boneOf(model, 'LeftArm'), rs = boneOf(model, 'RightArm');
    const a = new THREE.Vector3(), b = new THREE.Vector3(); if(ls) ls.getWorldPosition(a); if(rs) rs.getWorldPosition(b);
    const up = new THREE.Vector3(0, 1, 0), left = a.sub(b).setY(0).normalize(), fwd = new THREE.Vector3().crossVectors(left, up).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
    return { up, left, fwd, q };
  }
  /* hang `obj` on `bone` at a world position and orientation, keeping both (Object3D.attach) */
  function hang(bone, obj, pos, quat){ obj.position.copy(pos); obj.quaternion.copy(quat); obj.updateMatrixWorld(true);
    const scn = bone.parent ? (()=>{ let r = bone; while(r.parent) r = r.parent; return r; })() : bone; scn.add(obj); obj.updateMatrixWorld(true); bone.attach(obj); return obj; }

  /* a garment: its skinned mesh, rebound to this body's own skeleton by bone name */
  async function garment(model, body, id){
    const sm = skinnedOf(model); if(!sm) return null;
    const g = await gltf(DIR + id + '/' + body + '.glb');
    let src = null; g.scene.traverse(o=>{ if(!src && o.isSkinnedMesh) src = o; }); if(!src) return null;
    const theirs = src.skeleton.bones.map(b=>clean(b.name)), ours = sm.skeleton.bones.map(b=>clean(b.name));
    const remap = theirs.map(n=>Math.max(0, ours.indexOf(n)));
    const geo = src.geometry.clone(), SI = geo.attributes.skinIndex;
    for(let i=0;i<SI.count;i++) for(let k=0;k<4;k++) SI.setComponent(i, k, remap[SI.getComponent(i, k)]);
    const mat = src.material.clone(); mat.metalness = 0;
    // a garment with light in it (piping, a strip): its own colours, lit from inside, so the dark cloth stays dark
    if(ITEMS[id].glow && mat.map){ mat.emissiveMap = mat.map; mat.emissive = new THREE.Color(1, 1, 1); mat.emissiveIntensity = ITEMS[id].glow; }
    const m = new THREE.SkinnedMesh(geo, mat);
    m.userData.worn = id; m.frustumCulled = false; m.name = 'worn:' + id;
    sm.parent.add(m); m.position.copy(sm.position); m.quaternion.copy(sm.quaternion); m.scale.copy(sm.scale);
    m.bind(sm.skeleton, sm.bindMatrix);
    return [m];
  }

  /* --------------------------------------------- accessories, by where they go
     Each `fit` reads the body as it stands and returns [{ bone, pos, quat, size }]:
     where the thing goes in the world, which bone carries it, and how big it
     should be (its longest side, in world units). An item's `tune` adjusts its
     own: size, along (how far from the base of the skull to the crown), fwd
     (forward of that), turn (about the body's up, for a model that came out
     facing the wrong way). */
  const FITS = {
    // a shoe on each foot: as long as the foot, along it, its sole on that foot's sole
    feet(model, F){
      return ['Left', 'Right'].map(side=>{
        const foot = boneOf(model, side + 'Foot'), toe = boneOf(model, side + 'ToeBase'); if(!foot || !toe) return null;
        const a = new THREE.Vector3(), b = new THREE.Vector3(); foot.getWorldPosition(a); toe.getWorldPosition(b);
        const dir = b.clone().sub(a).normalize(), len = a.distanceTo(b)*2.1;
        const pos = a.clone().lerp(b, 0.42); pos.y = Math.min(pos.y, F.sole[side] === undefined ? pos.y : F.sole[side]);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        return { bone:foot, pos, quat:q, size:len, side };
      }).filter(Boolean);
    },
    // a pack on the back, its straps to her
    back(model, F){
      const chest = boneOf(model, 'Spine2') || boneOf(model, 'Spine1'), mid = boneOf(model, 'Spine1') || chest; if(!chest) return [];
      const c = new THREE.Vector3(); mid.getWorldPosition(c);
      return [{ bone:chest, pos:c.addScaledVector(F.fwd, -0.15*F.k).addScaledVector(F.up, -0.06*F.k), quat:F.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)), size:0.40*F.k, by:'h' }];
    },
    // on top of the head
    crown(model, F, t){
      const head = boneOf(model, 'Head'), top = boneOf(model, 'HeadTop_End'); if(!head) return [];
      const a = new THREE.Vector3(), b = new THREE.Vector3(); head.getWorldPosition(a); (top || head).getWorldPosition(b);
      return [{ bone:head, pos:a.lerp(b, t.along === undefined ? 0.6 : t.along).addScaledVector(F.fwd, t.fwd || 0), quat:turned(F.q, t.turn), size:t.size || 0.24 }];
    },
    // across the eyes
    eyes(model, F, t){
      const head = boneOf(model, 'Head'), top = boneOf(model, 'HeadTop_End'); if(!head) return [];
      const a = new THREE.Vector3(), b = new THREE.Vector3(); head.getWorldPosition(a); (top || head).getWorldPosition(b);
      return [{ bone:head, pos:a.lerp(b, t.along === undefined ? 0.55 : t.along).addScaledVector(F.fwd, t.fwd === undefined ? 0.065 : t.fwd), quat:turned(F.q, t.turn), size:t.size || 0.15 }];
    }
  };
  const turned = (q, a) => a ? q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a)) : q.clone();
  /* the bottom of each foot, as the body stands now: the lowest point of what each foot's bones move */
  function solesOf(sm){
    const P = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, v = new THREE.Vector3(), out = {};
    if(!SI) return out;
    const names = sm.skeleton.bones.map(b=>clean(b.name)); sm.updateMatrixWorld(true);
    for(let i=0;i<P.count;i++){
      let best = 0, bw = -1; for(let k=0;k<4;k++){ const w = SW.getComponent(i, k); if(w > bw){ bw = w; best = SI.getComponent(i, k); } }
      const n = names[best], side = /^Left(Foot|ToeBase)$/.test(n) ? 'Left' : /^Right(Foot|ToeBase)$/.test(n) ? 'Right' : null; if(!side) continue;
      v.fromBufferAttribute(P, i); sm.applyBoneTransform(i, v); v.applyMatrix4(sm.matrixWorld);
      if(out[side] === undefined || v.y < out[side]) out[side] = v.y;
    }
    return out;
  }
  /* a model, its front turned to +z and its feet on y=0, sized so its longest side (or height) is 1.
     `brim`: a cap whose picture was taken at an angle — find the brim (the low part reaching furthest
     out from the crown) and turn the cap so the brim faces forward. */
  function unit(src, by, brim){
    const o = src.clone(true);
    if(brim){
      o.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(o), mid = bb.getCenter(new THREE.Vector3()), low = bb.min.y + (bb.max.y - bb.min.y)*0.3, v = new THREE.Vector3();
      let far = 0, dir = 0;
      o.traverse(n=>{ if(!n.isMesh) return; const P = n.geometry.attributes.position;
        for(let i=0;i<P.count;i+=3){ v.fromBufferAttribute(P, i).applyMatrix4(n.matrixWorld); if(v.y > low) continue; const d = Math.hypot(v.x - mid.x, v.z - mid.z); if(d > far){ far = d; dir = Math.atan2(v.x - mid.x, v.z - mid.z); } } });
      const g0 = new THREE.Group(); g0.add(o); g0.rotation.y = -dir; g0.updateMatrixWorld(true);
      return unit(g0, by, false);
    }
    const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = 1/((by === 'h' ? s.y : Math.max(s.x, s.y, s.z)) || 1);
    const g = new THREE.Group(); o.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); g.add(o); o.updateMatrix();
    const w = new THREE.Group(); w.add(g); g.scale.setScalar(k);
    o.traverse(n=>{ if(n.isMesh){ n.frustumCulled = false; const mt = n.material; if(mt){ mt.metalness = 0; mt.roughness = Math.max(0.5, mt.roughness || 0.7); } } });
    return w;
  }
  async function accessory(model, body, id){
    const it = ITEMS[id], sm = skinnedOf(model); if(!sm) return null;
    const g = await gltf(DIR + it.model + '.glb');
    return within(model, sm, ()=>{
      const F = Object.assign(frame(model), { k:1, sole:it.fit === 'feet' ? solesOf(sm) : {} });
      return (FITS[it.fit] || (()=>[]))(model, F, it.tune || {}).map(p=>{
        let src = g.scene;
        // a pair in one file: each foot takes its own half
        if(it.fit === 'feet') src = half(g.scene, p.side);
        const obj = unit(src, p.by, !!(it.tune && it.tune.brim)); obj.scale.multiplyScalar(p.size); obj.userData.worn = id;
        return hang(p.bone, obj, p.pos, p.quat);
      });
    });
  }
  /* the left or right half of a model that is a pair side by side (a shoe each) */
  function half(scene, side){
    const o = scene.clone(true), b = new THREE.Box3().setFromObject(o), cx = (b.min.x + b.max.x)/2;
    o.traverse(n=>{ if(!n.isMesh) return; n.updateMatrixWorld(true);
      const geo = n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone(), P = geo.attributes.position, keep = [], v = new THREE.Vector3();
      for(let t=0;t<P.count;t+=3){ v.fromBufferAttribute(P, t).applyMatrix4(n.matrixWorld); if((side === 'Left') === (v.x > cx)) keep.push(t); }
      const out = new THREE.BufferGeometry();
      Object.keys(geo.attributes).forEach(k=>{ const A = geo.attributes[k], arr = new A.array.constructor(keep.length*3*A.itemSize);
        keep.forEach((t, j)=>{ for(let c=0;c<3*A.itemSize;c++) arr[j*3*A.itemSize + c] = A.array[t*A.itemSize + c]; });
        out.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize, A.normalized)); });
      n.geometry = out; });
    return o;
  }
  /* measure the body as it stands NOW (whatever its clip has it doing) and hang things on it as it is:
     Object3D.attach keeps the relation to the bone, so where the bone goes the thing goes. (Not the
     bind pose: these rigs' rest is at the file's own scale, and a pack sized there is sized wrong.) */
  function within(model, sm, f){ model.updateMatrixWorld(true); return f(); }

  /* --------------------------------------------- the things drawn in code */
  const glowM = () => new THREE.MeshBasicMaterial({ color:new THREE.Color(0.4, 2.0, 1.8), transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
  const MADE = {
    cuffs(model){
      return ['Left', 'Right'].map(side=>{
        const hand = boneOf(model, side + 'Hand'), fore = boneOf(model, side + 'ForeArm'); if(!hand || !fore) return [];
        const h = new THREE.Vector3(), f = new THREE.Vector3(); hand.getWorldPosition(h); fore.getWorldPosition(f);
        const axis = h.clone().sub(f).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 22), new THREE.MeshStandardMaterial({ color:0x16211f, roughness:0.35, metalness:0.7, emissive:0x38ffd0, emissiveIntensity:0.5 }));
        const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), glowM());
        const hc = hang(hand, cuff, h.clone().lerp(f, 0.05), q);
        const pc = hang(hand, palm, h.clone().addScaledVector(axis, 0.06), q);
        cuff.userData.role = 'cuff'; palm.userData.role = 'glow';
        return [hc, pc];
      }).flat();
    },
    bangle(model){
      const hand = boneOf(model, 'RightHand'), fore = boneOf(model, 'RightForeArm'); if(!hand || !fore) return [];
      const h = new THREE.Vector3(), f = new THREE.Vector3(); hand.getWorldPosition(h); fore.getWorldPosition(f);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), h.clone().sub(f).normalize());
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.011, 8, 24), new THREE.MeshStandardMaterial({ color:0xeef4f4, roughness:0.35, metalness:0.25, emissive:0x2a4644, emissiveIntensity:0.6 }));
      for(let i=0;i<6;i++){ const a = i/6*Math.PI*2, led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), glowM()); led.position.set(Math.cos(a)*0.047, Math.sin(a)*0.047, 0.006); led.userData.role = 'glow'; band.add(led); }
      return [hang(fore, band, h.clone().lerp(f, 0.22), q)];
    },
    // TSH's hood and shades: a dark hood over the hair, a rim round the face, black shades with a teal glint
    hood(model){
      const head = boneOf(model, 'Head'), top = boneOf(model, 'HeadTop_End'); if(!head) return [];
      const F = frame(model), a = new THREE.Vector3(), b = new THREE.Vector3(); head.getWorldPosition(a); (top || head).getWorldPosition(b);
      const k = Math.max(0.6, a.distanceTo(b)/0.18);                  // sized to this head (base of skull to crown)
      const g = new THREE.Group();
      const cloth = new THREE.MeshStandardMaterial({ color:0x1b2321, roughness:0.95, side:THREE.DoubleSide });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12, Math.PI*0.62, Math.PI*1.76, 0, Math.PI*0.72), cloth);
      hood.position.set(0, 0.105, -0.012); hood.scale.set(1.02, 1.08, 1.12); g.add(hood);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.018, 6, 20, Math.PI*1.25), cloth);
      rim.position.set(0, 0.1, 0.075); rim.rotation.set(0, 0, Math.PI*1.12); g.add(rim);
      const shades = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.034, 0.03), new THREE.MeshStandardMaterial({ color:0x050606, roughness:0.05, metalness:0.9 }));
      shades.position.set(0, 0.085, 0.1); g.add(shades);
      const glint = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.002), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.6, 2.4, 2.0) }));
      glint.position.set(0, 0.098, 0.116); g.add(glint);
      g.scale.setScalar(k);
      return [hang(head, g, a, F.q)];
    }
  };
  function made(model, id){
    const sm = skinnedOf(model); if(!sm) return [];
    return within(model, sm, ()=>MADE[ITEMS[id].make](model) || []);
  }

  /* dress a loaded character: `slots` (or what `body` has on) — only the difference changes */
  async function put(model, body, slots){
    if(!model) return model;
    // nothing given is this player's own look; '' is somebody else wearing just the base layer
    const want = slots == null ? lookOf(body) : (typeof slots === 'string' ? decode(slots) : slots);
    const sm = skinnedOf(model); if(!sm) return model;
    const worn = model.userData.wornBy || (model.userData.wornBy = {});        // itemId -> [objects]
    const run = (model.userData.dressRun || 0) + 1; model.userData.dressRun = run;
    const ids = new Set(Object.values(want).filter(id=>ITEMS[id] && fits(id, body)));
    // off: anything not wanted
    Object.keys(worn).forEach(id=>{ if(!ids.has(id)){ worn[id].forEach(o=>{ if(o.parent) o.parent.remove(o); }); delete worn[id]; } });
    // on: anything new
    for(const id of ids){
      if(worn[id]) continue;
      const it = ITEMS[id]; let objs = null;
      try{ objs = it.kind === 'garment' ? await garment(model, body, id) : it.kind === 'accessory' ? await accessory(model, body, id) : made(model, id); }
      catch(e){ console.warn('wardrobe: could not put on', id, e); objs = null; }
      if(model.userData.dressRun !== run){ (objs || []).forEach(o=>{ if(o.parent) o.parent.remove(o); }); return model; }   // changed again while this loaded
      if(objs && objs.length) worn[id] = objs;
    }
    // the regions everything on now covers
    const hide = new Set(); Object.keys(worn).forEach(id=>(ITEMS[id].hides || []).forEach(r=>hide.add(r)));
    hideRegions(sm, hide);
    model.userData.look = code(want);
    return model;
  }
  /* the objects an item put on a model (TSH lights the cuffs and the bangle with these) */
  const wornOn = (model, id) => (model && model.userData.wornBy && model.userData.wornBy[id]) || [];

  /* ------------------------------------------------------------ change */
  const listeners = [];
  function changed(body){ listeners.forEach(f=>{ try{ f(body); }catch(e){} }); }
  function onChange(f){ listeners.push(f); }

  return { SLOTS, ITEMS, REGIONS, itemsIn, fits, owns, give, on, setOn, wear, takeOff, saveOutfit, wearOutfit, dropOutfit,
           get outfits(){ return Object.assign({}, load().outfits); }, code, decode, cast, lookOf, put, wornOn, onChange, restore,
           regions, hideRegions };
})();
