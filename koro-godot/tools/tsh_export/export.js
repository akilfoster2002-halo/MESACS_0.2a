/* Run in the browser game's console, with TSH open on the night street (see README.md). Sends city.glb, city.json,
   lights.json, robin.glb (as she is dressed now) and maya.glb (in her look) to recv.js. */
(async function(){
  const SRV = 'http://localhost:8899';
  try{ THREE.TextureSource = THREE.TextureSource || THREE.Source; }catch(e){}
  if(!window.GLTFExporter) await new Promise((ok, no)=>{ const s = document.createElement('script'); s.src = SRV + '/gltfexporter.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const send = async (name, body) => (await fetch(SRV + '/save?name=' + name, { method:'POST', body })).text();
  const W = TSH._world(); W.cityGroup.updateMatrixWorld(true);
  // the city: what stands still (no people, no coins, no lines); instanced windows baked into plain meshes
  const root = new THREE.Group(); root.name = 'tsh_city';
  const hasSkin = o => { let k = false; o.traverse(c=>{ if(c.isSkinnedMesh) k = true; }); return k; };
  (function copy(src, dst){
    for(const c of src.children){
      if(c.isLine || c.isPoints || c.name === 'coins' || (hasSkin(c) && !c.isMesh) || c.isSkinnedMesh || !c.visible) continue;
      if(c.isInstancedMesh){
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(), n = c.count, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = c.instanceColor;
        const pos = new Float32Array(P.count*3*n), nor = N && new Float32Array(P.count*3*n), uv = U && new Float32Array(P.count*2*n), col = C && new Float32Array(P.count*3*n);
        const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), cc = new THREE.Color();
        for(let i = 0; i < n; i++){ c.getMatrixAt(i, m); nm.getNormalMatrix(m); if(C) c.getColorAt(i, cc);
          for(let j = 0; j < P.count; j++){ const k = i*P.count + j; v.fromBufferAttribute(P, j).applyMatrix4(m); pos.set([v.x, v.y, v.z], k*3);
            if(nor){ v.fromBufferAttribute(N, j).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], k*3); } if(uv) uv.set([U.getX(j), U.getY(j)], k*2); if(col) col.set([cc.r, cc.g, cc.b], k*3); } }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); if(nor) bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        if(uv) bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); if(col) bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
        let mat = c.material; if(col){ mat = mat.clone(); mat.vertexColors = true; }
        const mm = new THREE.Mesh(bg, mat); mm.name = (c.name || 'instances') + '_baked'; c.matrix.decompose(mm.position, mm.quaternion, mm.scale); dst.add(mm); continue;
      }
      const k = c.clone(false); dst.add(k); copy(c, k);
    }
  })(W.cityGroup, root);
  console.log('city', await send('city.glb', await new GLTFExporter().parseAsync(root, { binary:true, onlyVisible:true, maxTextureSize:2048 })));
  console.log('city.json', await send('city.json', JSON.stringify({ solids:W.solids.filter(s=>!s.off).map(s=>[s.x1, s.x2, s.z1, s.z2, s.y1 === undefined ? -1 : s.y1, s.y2 === undefined ? 60 : s.y2, s.tag || '']),
    ladders:W.ladders.map(l=>({ bottom:l.bottom, top:l.top, y0:l.y0, y1:l.y1 })), spots:W.spots, start:[-86, 0, 8] })));
  const lights = []; G.scene.traverse(o=>{ if(o.isLight){ const p = o.getWorldPosition(new THREE.Vector3()); lights.push({ type:o.type, p:p.toArray(), t:o.target ? o.target.getWorldPosition(new THREE.Vector3()).toArray() : null,
    c:o.color.getHexString(), g:o.groundColor ? o.groundColor.getHexString() : null, i:o.intensity, d:o.distance || 0, shadow:!!o.castShadow, vis:o.visible }); } });
  const f = G.scene.fog;
  console.log('lights', await send('lights.json', JSON.stringify({ lights, env:{ fog:f ? { c:f.color.getHexString(), density:f.density } : null,
    bg:G.scene.background && G.scene.background.isColor ? G.scene.background.getHexString() : null, exposure:G.renderer.toneMappingExposure } })));
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
  await person(AVATAR.model, 'robin.glb');
  const maya = await AVATAR.load('maya'); G.scene.add(maya);
  await WARDROBE.put(maya, 'maya', { top:'red-turtleneck', bottom:'navy-trousers', shoes:'black-boots', outer:'lab-coat', face:'round-glasses' });
  await new Promise(r=>setTimeout(r, 1500)); AVATAR.animate(maya, 0, 'idle');
  await person(maya, 'maya.glb'); G.scene.remove(maya);
  console.log('TSH export done — now run koro-godot/tools/tsh_export/finish.sh');
})();
