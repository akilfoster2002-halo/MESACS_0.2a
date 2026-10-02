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
                file (the bangle).

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
    'tech-jacket':  { name:'Techwear jacket', slot:'outer', kind:'garment', hides:['upperArms', 'forearms'], bodies:['robin'], glow:0.35,
                      about:'Cropped, high collar, conductive thread in the seams. Robin made it.' },
    'baggy-jeans':  { name:'Baggy jeans', slot:'bottom', kind:'garment', hides:['hips', 'thighs', 'shins'], bodies:['robin', 'kofi', 'sable'],
                      about:'Dark indigo denim, wide in the leg, stacked at the ankle.' },
    'skyline-shoes':{ name:'Skyline shoes', slot:'shoes', kind:'garment', hides:['feet'], bodies:['robin'], glow:0.6,
                      about:'Her own high-tops, rebuilt: coils in the heels.' },
    'roll-top':     { name:'Roll-top backpack', slot:'back', kind:'accessory', model:'roll-top', fit:'back',
                      about:'Black, water-tight, a teal strip down one side.' },
    'gecko-cuffs':  { name:'Gecko gauntlets', slot:'hands', kind:'garment', hides:['hands', 'forearms'], bodies:['robin'], glow:0.5, role:'cuff',
                      about:'Fingerless, armour over the knuckles, grip film in the palms; a teal line burns while she holds on.' },
    'flash-bangle': { name:'Flash bangle', slot:'wrist', kind:'made', make:'bangle',
                      about:'White enamel and six lights. Clap, and anybody facing you sees white.' },
    'beanie':       { name:'Beanie', slot:'head', kind:'accessory', model:'beanie', fit:'crown', tune:{ size:0.205, along:0.49 },
                      about:'Black rib knit.' },
    'cap':          { name:'Cap', slot:'head', kind:'accessory', model:'cap', fit:'crown', tune:{ size:0.31, along:0.64, fwd:0.02, brim:true },
                      about:'A plain cap, worn forward.' },
    'shades':       { name:'Sunglasses', slot:'face', kind:'accessory', model:'shades', fit:'eyes', tune:{ along:0.47, fwd:0.05, size:0.15 },
                      about:'Round, black, polarised and IR-cut: a camera gets glare, not a face.' }
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

  /* THE BODY UNDER THE CLOTHES. A triangle of the body is drawn unless what is worn
     covers it. A garment made in the lab carries the list of this body's vertices it
     covers (`covers`, measured against this very file: glb files/wardrobe/README.md),
     and a triangle goes only when all three of its corners are under something — so
     the skin stops just inside a cuff, not at a bone's edge, and a hand is never cut.
     Anything without that list hides whole REGIONS instead: a triangle belongs to the
     region of the bone that moves its first corner most. */
  function regions(mesh){
    if(mesh.userData.regions) return mesh.userData.regions;
    const g = mesh.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    if(!g.index || !SI){ mesh.userData.regions = { tris:0 }; return mesh.userData.regions; }
    const names = mesh.skeleton.bones.map(b=>clean(b.name));
    const regionOfVert = i => { let best = 0, bw = -1; for(let k=0;k<4;k++){ const w = SW.getComponent(i, k); if(w > bw){ bw = w; best = SI.getComponent(i, k); } } return REGION_OF[names[best]] || 'torso'; };
    const index0 = Uint32Array.from(g.index.array), tris = index0.length/3, region = new Uint8Array(tris);
    for(let t=0;t<tris;t++) region[t] = Math.max(0, REGIONS.indexOf(regionOfVert(index0[t*3])));
    const shown = mesh.material, hidden = shown.clone(); hidden.visible = false;
    mesh.material = [shown, hidden];
    mesh.userData.regions = { index0, region, tris, key:null };
    return mesh.userData.regions;
  }
  /* draw everything but the regions in `set` and the triangles `covered` (one byte per vertex) lies over */
  function hideRegions(mesh, set, covered){
    const R = regions(mesh); if(!R.tris) return;
    const key = [...set].sort().join(',') + '|' + (covered ? covered.sum : 0);
    if(R.key === key) return; R.key = key;
    const off = new Uint8Array(REGIONS.length); set.forEach(r=>{ const i = REGIONS.indexOf(r); if(i >= 0) off[i] = 1; });
    const I = R.index0, shown = [], hid = [];
    for(let t=0;t<R.tris;t++){
      const a = I[t*3], b = I[t*3+1], c = I[t*3+2];
      ((off[R.region[t]] || (covered && covered[a] && covered[b] && covered[c])) ? hid : shown).push(a, b, c);
    }
    const g = mesh.geometry; g.setIndex(shown.concat(hid)); g.clearGroups();
    g.addGroup(0, shown.length, 0); if(hid.length) g.addGroup(shown.length, hid.length, 1);
  }
  /* a garment's `covers`: base64, one bit per vertex of the body it was made on */
  function coversOf(obj, n){
    const c = obj.userData && obj.userData.covers; if(!c || obj.userData.coversOf !== n) return null;
    if(obj.userData.coverBits) return obj.userData.coverBits;
    const bin = atob(c), out = new Uint8Array(n);
    for(let i=0;i<n;i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
    return (obj.userData.coverBits = out);
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
    // this body's own bones, in the garment's order, with the garment's own inverse binds: a file that was
    // quantized carries its dequantization in those, and a garment made for this body has this body's rest
    const ours = new Map(sm.skeleton.bones.map(b=>[clean(b.name), b]));
    const bones = src.skeleton.bones.map(b=>ours.get(clean(b.name)) || sm.skeleton.bones[0]);
    const skel = new THREE.Skeleton(bones, src.skeleton.boneInverses.map(m=>m.clone()));
    const geo = src.geometry.clone();
    const mat = src.material.clone(); mat.metalness = 0; mat.metalnessMap = null;
    // a garment with light in it (piping, a strip): lit from inside where its glow mask says (the lab bakes one:
    // only the lit lines), else its own colours, so the dark cloth stays dark
    if(ITEMS[id].glow && (mat.emissiveMap || mat.map)){ mat.emissiveMap = mat.emissiveMap || mat.map; mat.emissive = new THREE.Color(1, 1, 1); mat.emissiveIntensity = ITEMS[id].glow; }
    const m = new THREE.SkinnedMesh(geo, mat);
    m.userData.worn = id; m.userData.role = ITEMS[id].role || null; m.frustumCulled = false; m.name = 'worn:' + id;
    const cov = coversOf(src, sm.geometry.attributes.position.count);
    if(cov){ m.userData.coverBits = cov; }
    sm.parent.add(m); m.position.copy(sm.position); m.quaternion.copy(sm.quaternion); m.scale.copy(sm.scale);
    m.bind(skel, src.bindMatrix);
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
  /* measure the body STANDING and hang things on it there: Object3D.attach keeps the relation to the
     bone, so where the bone goes the thing goes. Standing is the first frame of its idle (rig.posed),
     whatever its clip has it doing at the moment — shades fitted to a head bowed over a phone sit on
     the forehead ever after. (Not the bind pose: these rigs' rest is at the file's own scale, and a
     pack sized there is sized wrong.) A body with no rig is measured as it stands. */
  function within(model, sm, f){
    const r = model.userData && model.userData.rig;
    if(r && r.posed && r.has && r.has('idle')) return r.posed('idle', ()=>{ model.updateMatrixWorld(true); return f(); });
    model.updateMatrixWorld(true); return f();
  }

  /* ----------------------------------------------- measuring a body as it stands */
  function posed(mesh){
    const P = mesh.geometry.attributes.position, out = new Float32Array(P.count*3), v = new THREE.Vector3();
    mesh.updateMatrixWorld(true); if(mesh.skeleton) mesh.skeleton.update();
    for(let i=0;i<P.count;i++){ v.fromBufferAttribute(P, i); if(mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld); out[i*3] = v.x; out[i*3+1] = v.y; out[i*3+2] = v.z; }
    return out;
  }
  function domBones(mesh){
    const SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight, names = mesh.skeleton.bones.map(b=>clean(b.name)), out = new Array(SI.count);
    for(let i=0;i<SI.count;i++){ let b = 0, w = -1; for(let k=0;k<4;k++){ const x = SW.getComponent(i, k); if(x > w){ w = x; b = SI.getComponent(i, k); } } out[i] = names[b]; }
    return out;
  }
  /* the arm's cross-section in a thin slice across `axis` at `at` — skin, or what is on it: its middle,
     and the oval round it (two radii along its two main directions in the slice) */
  function girth(model, at, axis, half, bones, reach){
    const pts = []; const v = new THREE.Vector3();
    // where the plane cuts the triangles (exact however sparse the mesh is along a forearm)
    model.traverse(m=>{ if(!m.isSkinnedMesh || m.visible === false || !m.geometry.index) return;
      const P = posed(m), dom = domBones(m), I = m.geometry.index.array, end = Math.min(I.length, m.geometry.drawRange.count === Infinity ? I.length : m.geometry.drawRange.count);
      const side = new Float32Array(P.length/3); for(let i=0;i<side.length;i++) side[i] = (P[i*3]-at.x)*axis.x + (P[i*3+1]-at.y)*axis.y + (P[i*3+2]-at.z)*axis.z;
      for(let t=0;t<end;t+=3){ const tri = [I[t], I[t+1], I[t+2]]; if(!tri.some(i=>bones.includes(dom[i]))) continue;
        for(let e=0;e<3;e++){ const a = tri[e], b = tri[(e+1)%3], sa = side[a], sb = side[b]; if((sa > 0) === (sb > 0)) continue;
          const k = sa/(sa - sb); v.set(P[a*3] + (P[b*3]-P[a*3])*k - at.x, P[a*3+1] + (P[b*3+1]-P[a*3+1])*k - at.y, P[a*3+2] + (P[b*3+2]-P[a*3+2])*k - at.z);
          if(v.length() <= reach) pts.push(v.clone()); } } });
    if(pts.length < 8) return null;
    const c = pts.reduce((a, p)=>a.add(p), new THREE.Vector3()).multiplyScalar(1/pts.length);
    // the slice's main direction (power iteration on its 2D spread)
    const e1 = new THREE.Vector3(1, 0, 0).projectOnPlane(axis); if(e1.lengthSq() < 1e-6) e1.set(0, 1, 0).projectOnPlane(axis); e1.normalize();
    for(let k=0;k<12;k++){ const n = new THREE.Vector3(); pts.forEach(p=>{ const q = p.clone().sub(c); n.addScaledVector(q, q.dot(e1)); }); if(n.lengthSq() < 1e-12) break; e1.copy(n.projectOnPlane(axis).normalize()); }
    const e2 = new THREE.Vector3().crossVectors(axis, e1).normalize();
    const a1 = pts.map(p=>Math.abs(p.clone().sub(c).dot(e1))).sort((x, y)=>x - y), a2 = pts.map(p=>Math.abs(p.clone().sub(c).dot(e2))).sort((x, y)=>x - y);
    const q = arr => arr[Math.floor(arr.length*0.96)];
    return { centre:c.add(at), r1:q(a1), r2:q(a2), e1, e2 };
  }
  function grid3(P, cell){
    const map = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
    for(let i=0;i<P.length/3;i++){ const k = key(Math.floor(P[i*3]/cell), Math.floor(P[i*3+1]/cell), Math.floor(P[i*3+2]/cell)); let a = map.get(k); if(!a) map.set(k, a = []); a.push(i); }
    return (x, y, z, R) => { const cx = Math.floor(x/cell), cy = Math.floor(y/cell), cz = Math.floor(z/cell); let best = -1, bd = Infinity;
      for(let dx=-R; dx<=R; dx++) for(let dy=-R; dy<=R; dy++) for(let dz=-R; dz<=R; dz++){ const a = map.get(key(cx+dx, cy+dy, cz+dz)); if(!a) continue;
        for(const i of a){ const ex = P[i*3]-x, ey = P[i*3+1]-y, ez = P[i*3+2]-z, d = ex*ex + ey*ey + ez*ez; if(d < bd){ bd = d; best = i; } } }
      return best; };
  }
  /* LAYERS. Where two garments overlap, the one worn over wins (a gauntlet over a sleeve: hands are worn
     over jackets, jackets over trousers): what of the one under lies over skin the one over covers is not
     drawn — the sleeve ends where the gauntlet starts, tucked into it; a shoe's collar goes up inside a hem. Worked out once per pair, in
     whatever pose the body is in (each garment point is matched to the skin point under it). */
  const LAYER = { shoes:0.5, bottom:1, top:1, outer:2, hands:3 };             // (trousers are worn over shoes: a hem stacks on the shoe)
  function underneath(sm, worn){
    const gs = Object.keys(worn).filter(id=>ITEMS[id].kind === 'garment' && LAYER[ITEMS[id].slot]).map(id=>({ id, m:worn[id][0], layer:LAYER[ITEMS[id].slot] })).filter(g=>g.m);
    if(gs.length < 2){ gs.forEach(g=>hideOwn(g.m, null)); return; }
    let B = null, near = null;
    gs.forEach(g=>{
      const over = gs.filter(o=>o.layer > g.layer && o.m.userData.coverBits);
      if(!over.length){ hideOwn(g.m, null); return; }
      if(!B){ B = posed(sm); near = grid3(B, 0.04); }
      if(!g.m.userData.bodyNear){ const P = posed(g.m), out = new Int32Array(P.length/3); for(let i=0;i<out.length;i++) out[i] = near(P[i*3], P[i*3+1], P[i*3+2], 1); g.m.userData.bodyNear = out; }
      const bn = g.m.userData.bodyNear, mask = new Uint8Array(bn.length);
      for(let i=0;i<bn.length;i++){ const j = bn[i]; if(j >= 0 && over.some(o=>o.m.userData.coverBits[j])) mask[i] = 1; }
      mask.sum = over.map(o=>o.id).join(',');
      hideOwn(g.m, mask);
    });
  }
  /* a garment's own triangles under `mask` (one byte per vertex) not drawn: moved to the end of its index, past the draw range */
  function hideOwn(m, mask){
    const g = m.geometry; if(!g.index) return;
    const R = m.userData.own || (m.userData.own = { index0:Uint32Array.from(g.index.array), key:'' });
    const key = mask ? mask.sum : ''; if(R.key === key) return; R.key = key;
    if(!mask){ g.setIndex(Array.from(R.index0)); g.setDrawRange(0, Infinity); return; }
    const I = R.index0, shown = [], hid = [];
    for(let t=0;t<I.length;t+=3){ const a = I[t], b = I[t+1], c = I[t+2]; (mask[a] && mask[b] && mask[c] ? hid : shown).push(a, b, c); }
    g.setIndex(shown.concat(hid)); g.setDrawRange(0, shown.length);
  }

  /* --------------------------------------------- the things drawn in code */
  const glowM = () => new THREE.MeshBasicMaterial({ color:new THREE.Color(0.4, 2.0, 1.8), transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending });
  const MADE = {
    // white enamel, six lights, snug on the right wrist — over whatever is on the wrist (a gauntlet's cuff), sized to it
    bangle(model){
      const hand = boneOf(model, 'RightHand'), fore = boneOf(model, 'RightForeArm'); if(!hand || !fore) return [];
      const h = new THREE.Vector3(), f = new THREE.Vector3(); hand.getWorldPosition(h); fore.getWorldPosition(f);
      const axis = h.clone().sub(f).normalize(), len = h.distanceTo(f), at = h.clone().addScaledVector(axis, -len*0.13);
      const G = girth(model, at, axis, len*0.035, ['RightArm', 'RightForeArm', 'RightHand'], len*0.3) || { centre:at, r1:len*0.12, r2:len*0.1, e1:new THREE.Vector3(1, 0, 0).projectOnPlane(axis).normalize(), e2:null };
      if(!G.e2) G.e2 = new THREE.Vector3().crossVectors(axis, G.e1).normalize();
      const tube = len*0.011, gap = tube*0.9;
      // a unit band, stretched to the oval round the wrist: x along its long way, y across, z along the arm
      const band = new THREE.Mesh(new THREE.TorusGeometry(1, tube, 10, 64), new THREE.MeshStandardMaterial({ color:0xeef3f1, roughness:0.3, metalness:0.1 }));
      band.geometry.scale(1, 1, 2.4);
      const P = band.geometry.attributes.position;
      for(let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), r = Math.hypot(x, y) || 1, k = r - 1;   // k: across the tube
        const ux = x/r, uy = y/r; P.setXYZ(i, ux*(G.r1 + gap) + ux*k, uy*(G.r2 + gap) + uy*k, P.getZ(i)); }
      band.geometry.computeVertexNormals();
      for(let i=0;i<6;i++){ const a = Math.PI*(0.18 + i*0.13), led = new THREE.Mesh(new THREE.SphereGeometry(tube*0.55, 8, 6), glowM());
        led.position.set(Math.cos(a)*(G.r1 + gap + tube*0.85), Math.sin(a)*(G.r2 + gap + tube*0.85), 0); led.userData.role = 'glow'; band.add(led); }
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(G.e1, G.e2, axis));
      return [hang(fore, band, G.centre, q)];
    },
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
    // on: anything new — garments first (a bangle is sized to what is on the wrist), and what is made in
    // code is made again when the garments change under it
    const rank = id => ({ garment:0, accessory:1, made:2 })[ITEMS[id].kind] || 1;
    const order = [...ids].sort((a, b)=>rank(a) - rank(b));
    const garmentsBefore = Object.keys(worn).filter(id=>ITEMS[id].kind === 'garment').sort().join(',');
    const garmentsAfter = order.filter(id=>ITEMS[id].kind === 'garment').sort().join(',');
    if(garmentsBefore !== garmentsAfter) Object.keys(worn).forEach(id=>{ if(ITEMS[id].kind === 'made'){ worn[id].forEach(o=>{ if(o.parent) o.parent.remove(o); }); delete worn[id]; } });
    for(const id of order){
      if(worn[id]) continue;
      const it = ITEMS[id]; let objs = null;
      try{ objs = it.kind === 'garment' ? await garment(model, body, id) : it.kind === 'accessory' ? await accessory(model, body, id) : made(model, id); }
      catch(e){ console.warn('wardrobe: could not put on', id, e); objs = null; }
      if(model.userData.dressRun !== run){ (objs || []).forEach(o=>{ if(o.parent) o.parent.remove(o); }); return model; }   // changed again while this loaded
      if(objs && objs.length) worn[id] = objs;
    }
    // what everything on now covers: the vertices a lab-made garment lists, or the regions of anything else
    const hide = new Set(), n = sm.geometry.attributes.position.count; let covered = null;
    Object.keys(worn).forEach(id=>{
      const bits = worn[id].map(o=>o.userData.coverBits).find(Boolean);
      if(bits && bits.length === n){ if(!covered){ covered = new Uint8Array(n); covered.sum = 0; } for(let i=0;i<n;i++) if(bits[i] && !covered[i]){ covered[i] = 1; covered.sum += i + 1; } }
      else (ITEMS[id].hides || []).forEach(r=>hide.add(r));
    });
    hideRegions(sm, hide, covered);
    underneath(sm, worn);
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
