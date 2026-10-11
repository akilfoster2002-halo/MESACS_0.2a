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
      if(g.groups && g.groups.length && Array.isArray(o.material)){ const idx = g.index.array, keep = [];
        for(const gr of g.groups){ const m = mats[gr.materialIndex]; if(m && m.visible !== false && !(m.opacity === 0 && m.transparent)) for(let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i]); }
        saved.push([o, g, o.material]); const ng = g.clone(); ng.setIndex(keep); ng.clearGroups(); o.geometry = ng; o.material = mats[g.groups[0].materialIndex] || mats[0]; } });
    const pos = model.position.clone(), rot = model.rotation.clone(); model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
    try{ console.log(name, await send(name, await new GLTFExporter().parseAsync(model, { binary:true, animations:clips, onlyVisible:true, maxTextureSize:2048 }))); }
    finally{ saved.forEach(([o, g, m])=>{ o.geometry = g; o.material = m; }); model.position.copy(pos); model.rotation.copy(rot); }
  }
  const m = AVATAR.model, IDS = ['tech-jacket', 'gecko-cuffs', 'skyline-shoes', 'flash-bangle', 'roll-top', 'shades', 'baggy-jeans'];
  await WARDROBE.put(m, 'robin', { bottom:'baggy-jeans', outer:'tech-jacket', hands:'gecko-cuffs', shoes:'skyline-shoes', wrist:'flash-bangle', back:'roll-top', face:'shades' });
  await new Promise(r=>setTimeout(r, 1500));
  for(const id of IDS) WARDROBE.wornOn(m, id).forEach((o, i)=>{ o.name = 'worn:' + id + (i ? '_' + i : ''); });
  await person(m, 'robin.glb');
  console.log('robin export done');
})();
