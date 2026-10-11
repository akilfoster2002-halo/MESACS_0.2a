/* Robin alone, every piece of her kit on and NAMED (worn:<id>: the jacket, the cuffs, the shoes, the flash bangle,
   the roll-top pack, the shades), so Godot can put each on and take it off as the story does (day two: the pack and
   the shoes, nothing else). Run in the console with TSH open; then finish.sh (robin). */
(async function(){
  const SRV = 'http://localhost:8899';
  try{ THREE.TextureSource = THREE.TextureSource || THREE.Source; }catch(e){}
  if(!window.GLTFExporter) await new Promise((ok, no)=>{ const s = document.createElement('script'); s.src = SRV + '/gltfexporter.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const send = async (name, body) => (await fetch(SRV + '/save?name=' + name, { method:'POST', body })).text();
  // the people: dressed, every clip they have, the skin under their clothes taken out
  const NAMES = ['idle','walk','sprint','jump','dance','fly','talk','talk2','walk_left','walk_right','walk_back','sprint_left','sprint_right','sprint_back','swim','ride','salsa','flip',
    'climb_up','climb_down','climb_start','climb_top','sleep','wake','text','kneel','roll','jab','cross','hook','kick','knee','elbow','power','dodge','block','hit','stagger','fall','getup','ko','flykick','sweep','spin'];
  async function person(model, name){
    const r = model.userData.rig, clips = [];
    for(const n of NAMES) if(r.has(n)){ const c = r.clip(n); if(c){ const k = c.clone(); k.name = n; clips.push(k); } }
    const saved = [];
    model.traverse(o=>{ if(!o.isMesh) return; const g = o.geometry, mats = [].concat(o.material);
      if(g.groups && g.groups.length && Array.isArray(o.material) ){ const idx = g.index.array, keep = [];
        for(const gr of g.groups){ const m = mats[gr.materialIndex]; if(m && m.visible !== false && !(m.opacity === 0 && m.transparent)) for(let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i]); }
        saved.push([o, g, o.material]); const ng = g.clone(); ng.setIndex(keep); ng.clearGroups(); o.geometry = ng; o.material = mats[g.groups[0].materialIndex] || mats[0]; } });
    const pos = model.position.clone(), rot = model.rotation.clone(); model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
    const uds = []; model.traverse(o=>{ uds.push([o, o.userData]); o.userData = {}; });      // the browser's rig and caches: nothing Godot reads
    try{ console.log(name, await send(name, await new GLTFExporter().parseAsync(model, { binary:true, animations:clips, onlyVisible:true, maxTextureSize:2048 }))); }
    finally{ uds.forEach(([o, u])=>{ o.userData = u; }); saved.forEach(([o, g, m])=>{ o.geometry = g; o.material = m; }); model.position.copy(pos); model.rotation.copy(rot); }
  }
  const m = AVATAR.model, IDS = ['tech-jacket', 'gecko-cuffs', 'skyline-shoes', 'flash-bangle', 'roll-top', 'shades', 'baggy-jeans'];
  // the body's triangles the wardrobe drops under each garment: kept, as surfaces of their own (under_jacket,
  // under_cuffs), so Godot can show them when that garment comes off
  const body = (()=>{ let b = null; m.traverse(o=>{ if(o.name === 'char1') b = o; }); return b; })();
  const visTris = () => { const g = body.geometry, idx = g.index.array, mats = [].concat(body.material), out = new Set();
    for(const gr of g.groups){ const mt = mats[gr.materialIndex]; if(mt && mt.visible !== false) for(let i = gr.start; i < gr.start + gr.count; i += 3) out.add(idx[i] + ',' + idx[i + 1] + ',' + idx[i + 2]); }
    return out; };
  const KIT = { bottom:'baggy-jeans', outer:'tech-jacket', hands:'gecko-cuffs', shoes:'skyline-shoes', wrist:'flash-bangle', back:'roll-top', face:'shades' };
  const wear = async o => { await WARDROBE.put(m, 'robin', o); await new Promise(r=>setTimeout(r, 900)); return visTris(); };
  const vNone = await wear({ bottom:'baggy-jeans', shoes:'skyline-shoes' });
  const vJ = await wear({ bottom:'baggy-jeans', shoes:'skyline-shoes', outer:'tech-jacket' });
  const vC = await wear({ bottom:'baggy-jeans', shoes:'skyline-shoes', hands:'gecko-cuffs' });
  await WARDROBE.put(m, 'robin', KIT);
  await new Promise(r=>setTimeout(r, 1500));
  const vAll = visTris();
  const underJ = [...vNone].filter(t=>!vJ.has(t)), underC = [...vNone].filter(t=>!vC.has(t) && vJ.has(t));
  const base = [...vNone].filter(t=>vAll.has(t) || (!underJ.includes(t) && !underC.includes(t)));
  // the body: what shows with the whole kit on; and two small meshes of the rest, on the same skeleton
  const subset = (list) => { const src = body.geometry, map = new Map(), idx = [];
    list.forEach(t=>t.split(',').forEach(v=>{ v = +v; if(!map.has(v)) map.set(v, map.size); idx.push(map.get(v)); }));
    const g = new THREE.BufferGeometry(), olds = [...map.keys()];
    const take = a => { const it = a.itemSize, out = a.normalized ? new Float32Array(olds.length*it) : new a.array.constructor(olds.length*it); olds.forEach((o, k)=>{ for(let c = 0; c < it; c++) out[k*it + c] = [a.getX, a.getY, a.getZ, a.getW][c].call(a, o); }); return new THREE.BufferAttribute(out, it, false); };
    for(const n in src.attributes) g.setAttribute(n, take(src.attributes[n]));
    g.setIndex(idx); return g; };
  const sk = (name, list) => { const sm = new THREE.SkinnedMesh(subset(list), [].concat(body.material)[0]); sm.name = name; sm.bind(body.skeleton, body.bindMatrix); body.parent.add(sm); return sm; };
  let saved = null;
  const extra = [sk('under_jacket', underJ), sk('under_cuffs', underC)];
  { const g = body.geometry.clone(), arr = []; base.forEach(t=>t.split(',').forEach(v=>arr.push(+v)));
    g.setIndex(arr); g.clearGroups(); saved = [body.geometry, body.material]; body.geometry = g; body.material = [].concat(body.material)[0];
    console.log('body', base.length, underJ.length, underC.length); }
  await new Promise(r=>setTimeout(r, 1500));
  for(const id of IDS) WARDROBE.wornOn(m, id).forEach((o, i)=>{ o.name = 'worn:' + id + (i ? '_' + i : ''); });
  await person(m, 'robin.glb');
  if(saved){ [body.geometry, body.material] = saved; }
  extra.forEach(o=>o.parent.remove(o));
  console.log('robin export done');
})();
