/* Day two's places and people, for Godot. Run in the browser game's console with TSH open (any beat; the school and
   the station are built with the world): sends school.glb + school_parts.json, sub.glb + sub_parts.json, apt.glb +
   apt_parts.json, and the school's people (people/*.glb), to recv.js. Then finish.sh.

   What Godot has to move or light is NAMED here first (the robot's joints, the lab's rings and arms and field, the
   station's gates and lamps, the flat's boots and pack and window sash); the lab's four ShaderMaterials cannot go
   through glTF, so each mesh that wears one is named SH<k>_<i> and its uniforms written to the parts file
   (koro-godot/shaders/tsh_lab_*.gdshader are the same shaders); hidden things are listed so Godot hides them too;
   the krackle swarm (a Points cloud drawn by a shader) is written as its attribute data. */
(async function(){
  const SRV = 'http://localhost:8899';
  try{ THREE.TextureSource = THREE.TextureSource || THREE.Source; }catch(e){}
  if(!window.GLTFExporter) await new Promise((ok, no)=>{ const s = document.createElement('script'); s.src = SRV + '/gltfexporter.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const send = async (name, body) => (await fetch(SRV + '/save?name=' + name, { method:'POST', body })).text();
  const W = TSH._world();
  const shaderIds = new Map();
  const shaderK = m => { if(!shaderIds.has(m.fragmentShader)) shaderIds.set(m.fragmentShader, shaderIds.size); return shaderIds.get(m.fragmentShader); };
  const uval = v => v && v.isColor ? [v.r, v.g, v.b] : v && v.isVector3 ? [v.x, v.y, v.z] : typeof v === 'number' ? v : null;
  // a group, copied for export: skinned people out; shader meshes named and swapped for a stand-in; lines and sprites
  // out (Godot draws its own); a Points cloud with a shader written down instead
  async function exportGroup(group, file, parts){
    group.updateMatrixWorld(true);
    const P = Object.assign({ shaders:[], hidden:[], clouds:[] }, parts || {});
    let n = 0;
    const root = new THREE.Group(); root.name = 'tsh_' + file.replace('.glb', '');
    (function copy(src, dst){
      for(const c of src.children){
        if(c.isSkinnedMesh || c.userData.rig || c.isLine || c.isSprite) continue;
        if(c.isPoints){
          const m = c.material;
          if(m.isShaderMaterial && c.geometry.attributes.aS){ P.clouds.push({ name:c.name || ('cloud' + n++), k:shaderK(m), m:c.matrixWorld.toArray(), aS:Array.from(c.geometry.attributes.aS.array),
            u:Object.fromEntries(Object.entries(m.uniforms).map(([k, v])=>[k, uval(v.value)])) }); }
          continue;
        }
        const k = c.clone(false);
        if(!c.visible){ if(!k.name) k.name = 'hid_' + (n++); P.hidden.push(k.name); k.visible = true; }
        const mats = c.material ? [].concat(c.material) : [];
        if(mats.some(m=>m.isShaderMaterial)){
          const m = mats.find(m=>m.isShaderMaterial), sk = shaderK(m);
          k.name = 'SH' + sk + '_' + (n++) + (c.name ? '_' + c.name : '');
          P.shaders.push({ name:k.name, k:sk, u:Object.fromEntries(Object.entries(m.uniforms).map(([q, v])=>[q, uval(v.value)])),
            add:m.blending === THREE.AdditiveBlending, side:m.side, dw:m.depthWrite });
          k.material = new THREE.MeshBasicMaterial({ color:0xff00ff });
        }
        dst.add(k); copy(c, k);
      }
    })(group, root);
    const wasVis = group.visible; group.visible = true;
    try{ console.log(file, await send(file, await new GLTFExporter().parseAsync(root, { binary:true, onlyVisible:false, maxTextureSize:2048 }))); }
    finally{ group.visible = wasVis; }
    console.log(file + ' parts', await send(file.replace('.glb', '_parts.json'), JSON.stringify(P)));
  }
  // whatever an action moves: snapshot every object, do it, see what changed, name it, undo it
  function nameWhatMoves(group, act, undo, name){
    const before = new Map(); group.traverse(o=>before.set(o, o.position.toArray().concat(o.scale.toArray())));
    act(); let i = 0;
    group.traverse(o=>{ const b = before.get(o); if(!b) return; const a = o.position.toArray().concat(o.scale.toArray()); if(a.some((v, j)=>Math.abs(v - b[j]) > 1e-4)) o.name = name + (i++ ? '_' + i : ''); });
    undo();
  }

  /* ---------------------------------------------------------------- the school, and the lab in it */
  const S = TSHSCHOOL.S, L = S.lab, u = S.robot.userData;
  S.robot.name = 'robot'; u.body.name = 'robot_body'; u.head.name = 'robot_head'; u.arm.name = 'robot_arm'; u.panel.name = 'robot_panel';
  (u.legs || []).forEach((l, i)=>{ l.name = 'robot_leg' + i; }); (u.rings || []).forEach((r, i)=>{ r.name = 'robot_ring' + i; });
  S.robot.traverse(o=>{ if(o.isMesh && o.material === u.eye) o.name = 'robot_eye'; });
  L.core.name = 'lab_core'; L.ink.name = 'lab_ink'; L.lattice.name = 'lab_lattice'; L.lattice2.name = 'lab_lattice2';
  L.shells.forEach((s, i)=>{ s.name = 'lab_shell' + i; }); L.ring.forEach((r, i)=>{ r.name = 'lab_ring' + i; });
  L.waves.forEach((w, i)=>{ w.name = 'lab_wave' + i; w.userData.ph = w.userData.ph || 0; });
  L.arms.forEach((A, i)=>{ A.base.name = 'lab_arm' + i + '_base'; A.sh.name = 'lab_arm' + i + '_sh'; A.el.name = 'lab_arm' + i + '_el'; A.wr.name = 'lab_arm' + i + '_wr'; });
  if(L.holo) L.holo.name = 'lab_holo'; L.beam.name = 'lab_beam';
  L.flick.forEach((m, i)=>{ m.name = 'lab_flick' + i; });
  await exportGroup(S.group, 'school.glb', { spots:S.spots, lab:{ at:L.at, tips:L.boltCfg.tips.map(v=>v.toArray()), tesla:L.tesla.toArray(), NB:L.boltCfg.NB, SEG:L.boltCfg.SEG,
    waves:L.waves.map(w=>w.userData.ph || 0), arms:L.arms.map(A=>A.ph), burst:L.burst ? { p:L.burst.getWorldPosition(new THREE.Vector3()).toArray(), s:L.burst.scale.toArray() } : null,
    light:L.light, tLight:L.tLight }, robot:{ p:S.robot.position.toArray() } });

  /* ---------------------------------------------------------------- Harbor Lane Station */
  if(W.sub) await exportGroup(W.sub.group, 'sub.glb', { spots:W.sub.spots, lights:W.sub.lights.map(l=>({ x:l.x, y:l.y, z:l.z, col:l.col ? [l.col.r, l.col.g, l.col.b] : null, k:l.k, d:l.d })) });

  /* ---------------------------------------------------------------- the flat */
  const R = W.room;
  let bi = 0; W.aptGroup.traverse(o=>{ if(o.userData.boot) o.name = 'boot' + (bi++); if(o.userData.pack) o.name = 'pack'; });
  if(R.form && R.form.jacket) R.form.jacket.name = 'form_jacket';
  if(R.window) nameWhatMoves(W.aptGroup, ()=>R.window.open(true), ()=>R.window.open(false), 'win_sash');
  await exportGroup(W.aptGroup, 'apt.glb', {});

  /* ---------------------------------------------------------------- the school's people */
  const NAMES = ['idle','walk','sprint','jump','talk','talk2','walk_back','sit','ride','text','kneel','wave','point','phone','sleep','wake','fall','getup','hit','stagger','ko','block','jab','cross','hook','kick'];
  async function person(model, name){
    const r = model.userData.rig, clips = [];
    for(const n of NAMES) if(r && r.has(n)){ const c = r.clip(n); if(c){ const k = c.clone(); k.name = n; clips.push(k); } }
    const saved = [];
    model.traverse(o=>{ if(!o.isMesh) return; const g = o.geometry, mats = [].concat(o.material);
      if(g.groups && g.groups.length && Array.isArray(o.material)){ const idx = g.index.array, keep = [];
        for(const gr of g.groups){ const m = mats[gr.materialIndex]; if(m && m.visible !== false && !(m.opacity === 0 && m.transparent)) for(let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i]); }
        saved.push([o, g, o.material]); const ng = g.clone(); ng.setIndex(keep); ng.clearGroups(); o.geometry = ng; o.material = mats[g.groups[0].materialIndex] || mats[0]; } });
    try{ console.log(name, await send(name, await new GLTFExporter().parseAsync(model, { binary:true, animations:clips, onlyVisible:true, maxTextureSize:1024 }))); }
    finally{ saved.forEach(([o, g, m])=>{ o.geometry = g; o.material = m; }); }
  }
  const PEOPLE = [['mechanic', 'guard', { head:'cap' }], ['sable', 'teacher', { face:'teacher-glasses' }],
    ['walk-t', 't'], ['walk-u', 'u'], ['walk-x', 'x'], ['nia', 'nia'], ['zuri', 'zuri']];
  for(const [char, file, wear] of PEOPLE){
    try{
      const m = await AVATAR.load(char); G.scene.add(m);
      if(wear && window.WARDROBE) await WARDROBE.put(m, char, wear);
      await new Promise(r=>setTimeout(r, 900)); AVATAR.animate(m, 0, 'idle');
      await person(m, 'people_' + file + '.glb'); G.scene.remove(m);
    }catch(e){ console.warn('person', char, e); }
  }
  console.log('TSH day export done — now run koro-godot/tools/tsh_export/finish_day.sh');
})();
