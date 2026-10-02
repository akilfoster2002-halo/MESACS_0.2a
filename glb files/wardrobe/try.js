/* THE FITTING ROOM: the game's own avatar.js and wardrobe.js, a body, what it
   has on, a clip at a moment, four views. lab.mjs `try` drives it. */
(function(){
  const R = new THREE.WebGLRenderer({ canvas:document.getElementById('c'), antialias:true, preserveDrawingBuffer:true });
  R.outputColorSpace = THREE.SRGBColorSpace; R.setScissorTest(true);
  const S = new THREE.Scene(); S.background = new THREE.Color(0xc8ccd0);
  S.add(new THREE.HemisphereLight(0xffffff, 0x8a8580, 1.7)); const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(1.5, 3, 2.5); S.add(k);
  const b = new THREE.DirectionalLight(0xcfe0ff, 0.7); b.position.set(-2, 2, -3); S.add(b);
  window.TRY = async function(body, slots, clip, at){
    if(window.TRY.bg) S.background = new THREE.Color(window.TRY.bg);
    const m = await AVATAR.load(body); S.add(m);
    AVATAR.animate(m, 0, 'idle'); AVATAR.animate(m, 0.3, 'idle'); m.updateMatrixWorld(true);
    await WARDROBE.put(m, body, slots || {});
    if(clip && clip !== 'idle'){ AVATAR.animate(m, 0, clip); AVATAR.animate(m, at || 0, clip); }
    m.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), h = Math.max(1.9, box.max.y - box.min.y);
    if(window.TRY.head){ let hb = null; m.traverse(o=>{ if(!hb && /Head$/.test(o.name || '')) hb = o; }); if(hb){ hb.getWorldPosition(c); c.y += 0.08; h = 0.42; } }
    if(window.TRY.hand){ let hb = null; const side = window.TRY.hand === 'R' ? /RightHand$/ : /LeftHand$/; m.traverse(o=>{ if(!hb && side.test(o.name || '')) hb = o; }); if(hb){ hb.getWorldPosition(c); h = 0.32; } }
    if(window.TRY.feet){ let a = null, b = null; m.traverse(o=>{ if(!a && /LeftFoot$/.test(o.name || '')) a = o; if(!b && /RightFoot$/.test(o.name || '')) b = o; }); if(a && b){ const pa = new THREE.Vector3(), pb = new THREE.Vector3(); a.getWorldPosition(pa); b.getWorldPosition(pb); c.copy(pa).add(pb).multiplyScalar(0.5); h = Math.max(0.45, pa.distanceTo(pb) + 0.25); } }
    if(window.TRY.chest){ let hb = null; m.traverse(o=>{ if(!hb && /Spine2$/.test(o.name || '')) hb = o; }); if(hb){ hb.getWorldPosition(c); c.y += 0.05; h = 0.6; } }
    [[0, 0, 1], [1, 0, 0], [0, 0, -1], [0.75, 0.25, 0.75]].forEach((d, i)=>{
      const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50), dist = h*2.25, n = new THREE.Vector3(...d).normalize();
      cam.position.copy(c).addScaledVector(n, dist); cam.lookAt(c);
      const x = (i % 2)*512, y = (1 - Math.floor(i/2))*512; R.setViewport(x, y, 512, 512); R.setScissor(x, y, 512, 512); R.render(S, cam);
    });
    S.remove(m);
    const where = {}; Object.entries(m.userData.wornBy || {}).forEach(([id, objs])=>{ where[id] = objs.map(o=>{ const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? 'empty' : [b.getCenter(new THREE.Vector3()).toArray().map(v=>+v.toFixed(2)), b.getSize(new THREE.Vector3()).toArray().map(v=>+v.toFixed(2))]; }); });
    return { shot:R.domElement.toDataURL('image/jpeg', 0.85), worn:Object.keys(m.userData.wornBy || {}), look:m.userData.look, where };
  };
  /* THE CHECK: everything on, through every clip that matters, frame by frame, measured.
       holes  skin that is not drawn (a garment said it covers it) with no garment over it now — see-through
       poke   skin that is drawn, right up against a garment, outside it — skin through the cloth
     Each in thousandths of the skin it could happen to; the worst frame of each, and its picture. */
  const CLIPS = ['idle', 'walk', 'sprint', 'jump', 'kneel', 'roll', 'flip', 'dance', 'salsa', 'climb_up', 'climb_top', 'ride', 'sprint_left', 'walk_back'];
  function posedOf(m){
    const P = m.geometry.attributes.position, out = new Float32Array(P.count*3), v = new THREE.Vector3();
    m.updateMatrixWorld(true); m.skeleton.update();
    for(let i=0;i<P.count;i++){ v.fromBufferAttribute(P, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); out[i*3] = v.x; out[i*3+1] = v.y; out[i*3+2] = v.z; }
    return out;
  }
  function drawn(m){                                       // the triangles a mesh is drawing now (its first group or its draw range)
    const I = m.geometry.index.array, g = m.geometry.groups.find(x=>x.materialIndex === 0);
    const start = g ? g.start : 0, count = g ? g.count : Math.min(I.length, m.geometry.drawRange.count);
    return { I, start, end:start + count };
  }
  function normalsOf(P, I, start, end){
    const N = new Float32Array(P.length), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for(let t=start;t<end;t+=3){ a.fromArray(P, I[t]*3); b.fromArray(P, I[t+1]*3); c.fromArray(P, I[t+2]*3); const f = b.sub(a).cross(c.sub(a)); for(const v of [I[t], I[t+1], I[t+2]]){ N[v*3] += f.x; N[v*3+1] += f.y; N[v*3+2] += f.z; } }
    for(let i=0;i<N.length;i+=3){ const l = Math.hypot(N[i], N[i+1], N[i+2]) || 1; N[i] /= l; N[i+1] /= l; N[i+2] /= l; }
    return N;
  }
  function gridOf(P, cell){
    const map = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
    for(let i=0;i<P.length/3;i++){ const k = key(Math.floor(P[i*3]/cell), Math.floor(P[i*3+1]/cell), Math.floor(P[i*3+2]/cell)); let a = map.get(k); if(!a) map.set(k, a = []); a.push(i); }
    return (x, y, z) => { const cx = Math.floor(x/cell), cy = Math.floor(y/cell), cz = Math.floor(z/cell); let best = -1, bd = Infinity;
      for(let dx=-1; dx<=1; dx++) for(let dy=-1; dy<=1; dy++) for(let dz=-1; dz<=1; dz++){ const a = map.get(key(cx+dx, cy+dy, cz+dz)); if(!a) continue;
        for(const i of a){ const ex = P[i*3]-x, ey = P[i*3+1]-y, ez = P[i*3+2]-z, d = ex*ex + ey*ey + ez*ez; if(d < bd){ bd = d; best = i; } } }
      return { i:best, d:Math.sqrt(bd) }; };
  }
  /* a mesh's colour at each vertex (its colour map at the vertex's UV) */
  function vertexColours(m){
    const mat = Array.isArray(m.material) ? m.material[0] : m.material, map = mat && mat.map, uv = m.geometry.attributes.uv, n = m.geometry.attributes.position.count, out = new Uint8Array(n*3);
    if(!map || !map.image || !uv) return null;
    const c = document.createElement('canvas'); c.width = map.image.width; c.height = map.image.height; const x = c.getContext('2d'); x.drawImage(map.image, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    for(let i=0;i<n;i++){ let u = uv.getX(i), v = uv.getY(i); if(map.flipY !== false) v = 1 - v; u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
      const k = (Math.min(c.height - 1, Math.floor(v*c.height))*c.width + Math.min(c.width - 1, Math.floor(u*c.width)))*4; out[i*3] = d[k]; out[i*3+1] = d[k+1]; out[i*3+2] = d[k+2]; }
    return out;
  }
  /* SKIN IN A GARMENT: how much of each garment is her skin colour — a hand moulded into a sleeve, a wrist cut out with the cuff */
  function skinIn(sm, gs){
    const BC = vertexColours(sm); if(!BC) return 0;
    const SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, names = sm.skeleton.bones.map(b=>b.name.replace(/^mixamorig:?/, ''));
    const sk = [0, 0, 0]; let c = 0;
    for(let i=0;i<SI.count;i++){ let b = 0, w = -1; for(let k=0;k<4;k++){ const x = SW.getComponent(i, k); if(x > w){ w = x; b = SI.getComponent(i, k); } } if(!/Hand$/.test(names[b])) continue; sk[0] += BC[i*3]; sk[1] += BC[i*3+1]; sk[2] += BC[i*3+2]; c++; }
    if(!c) return 0; sk.forEach((v, k)=>sk[k] = v/c);
    let hit = 0, all = 0;
    // skin, not just a mid tone: near her hands' colour AND as warm as skin is (red well over blue; a grey tee is neither)
    const warm = sk[0] - sk[2];
    gs.forEach(g=>{ const C = vertexColours(g); if(!C) return; const n = C.length/3; for(let i=0;i<n;i++){ all++; if(Math.abs(C[i*3]-sk[0]) + Math.abs(C[i*3+1]-sk[1]) + Math.abs(C[i*3+2]-sk[2]) < 75 && C[i*3] - C[i*3+2] > warm*0.6) hit++; } });
    return all ? Math.round(hit/all*1000) : 0;
  }
  window.TRY.check = async function(body, slots, o){
    o = o || {};
    // a garment being checked on a body it is not listed for yet (that is what the check decides): listed, here only
    String(slots || '').split(',').forEach(p=>{ const it = WARDROBE.ITEMS[p.split(':')[1]]; if(it && it.kind === 'garment' && !it.bodies.includes(body)) it.bodies.push(body); });
    const m = await AVATAR.load(body); S.add(m);
    AVATAR.animate(m, 0, 'idle'); AVATAR.animate(m, 0.3, 'idle'); m.updateMatrixWorld(true);
    await WARDROBE.put(m, body, slots || {});
    const wornIds = Object.keys(m.userData.wornBy || {}), asked = String(slots || '').split(',').filter(Boolean).map(p=>p.split(':')[1]);
    if(asked.some(id=>!wornIds.includes(id))) throw new Error('could not put on ' + asked.filter(id=>!wornIds.includes(id)).join(', ') + ' — nothing to check');
    let sm = null; const gs = []; m.traverse(x=>{ if(!x.isSkinnedMesh) return; if(x.userData.worn) gs.push(x); else if(!sm) sm = x; });
    const rig = m.userData.rig, clips = CLIPS.filter(c=>!rig.has || rig.has(c));
    const frames = [], H = 1.7, near = H*0.012, out = H*0.002, far = H*0.02;
    // garment edges: a garment's own boundary is where skin is meant to show beside it
    const edges = gs.map(g=>{ const { I, start, end } = drawn(g), cnt = new Map(), key = (a, b) => a < b ? a + '_' + b : b + '_' + a;
      for(let t=start;t<end;t+=3) for(let e=0;e<3;e++){ const k = key(I[t+e], I[t+(e+1)%3]); cnt.set(k, (cnt.get(k) || 0) + 1); }
      const nv = g.geometry.attributes.position.count, on = new Uint8Array(nv); cnt.forEach((c, k)=>{ if(c === 1) k.split('_').forEach(v=>on[+v] = 1); });
      // and two rings in from it, over welded positions (a UV seam is not an edge)
      const P = g.geometry.attributes.position, key3 = i => P.getX(i).toFixed(5) + ',' + P.getY(i).toFixed(5) + ',' + P.getZ(i).toFixed(5), rep = new Map(), r = new Int32Array(nv);
      for(let i=0;i<nv;i++){ const k = key3(i); if(!rep.has(k)) rep.set(k, i); r[i] = rep.get(k); }
      for(let ring=0; ring<2; ring++){ const next = on.slice(); for(let t=start;t<end;t+=3){ const a = I[t], b = I[t+1], c = I[t+2]; if(on[a] || on[b] || on[c]){ next[a] = next[b] = next[c] = 1; } }
        const byRep = new Uint8Array(nv); for(let i=0;i<nv;i++) if(next[i]) byRep[r[i]] = 1; for(let i=0;i<nv;i++) on[i] = byRep[r[i]]; }
      return on; });
    const T0 = performance.now();
    // AT REST (as near as a clip gets), the reference: which skin is under which garment (inside it), and how far it is from it.
    // A garment's normals are turned outward here if they came the other way.
    // (her first idle frame: skeleton.pose() would drop the scale the game puts on the model)
    AVATAR.animate(m, 0, 'idle'); AVATAR.animate(m, 0.05, 'idle'); m.updateMatrixWorld(true);
    const B0 = posedOf(sm), n = B0.length/3, under = new Int8Array(n).fill(-1), dist0 = new Float32Array(n).fill(Infinity), flip = gs.map(()=>1);
    { const G0 = gs.map((g, k)=>{ const P = posedOf(g), d = drawn(g); return { P, N:normalsOf(P, d.I, d.start, d.end), find:gridOf(P, near*2) }; });
      const bd0 = drawn(sm), sh0 = new Uint8Array(n); for(let t=bd0.start;t<bd0.end;t++) sh0[bd0.I[t]] = 1;
      G0.forEach((g, k)=>{ let vote = 0; for(let j=0;j<n;j++){ if(sh0[j]) continue; const r = g.find(B0[j*3], B0[j*3+1], B0[j*3+2]); if(r.i < 0) continue; const i = r.i;
          vote += Math.sign((B0[j*3]-g.P[i*3])*g.N[i*3] + (B0[j*3+1]-g.P[i*3+1])*g.N[i*3+1] + (B0[j*3+2]-g.P[i*3+2])*g.N[i*3+2]); }
        flip[k] = vote > 0 ? -1 : 1; });
      for(let j=0;j<n;j++){ const x = B0[j*3], y = B0[j*3+1], z = B0[j*3+2];
        G0.forEach((g, k)=>{ const r = g.find(x, y, z); if(r.i < 0) return; if(r.d < dist0[j]) dist0[j] = r.d;
          if(r.d > near || edges[k][r.i]) return; const i = r.i, d = flip[k]*((x - g.P[i*3])*g.N[i*3] + (y - g.P[i*3+1])*g.N[i*3+1] + (z - g.P[i*3+2])*g.N[i*3+2]); if(d < 0) under[j] = k; }); } }
    console.log('check: reference done', Math.round(performance.now() - T0) + 'ms', 'under', under.reduce((a, x)=>a + (x >= 0), 0), 'flip', flip.join(','));
    // BURIED: garment under her drawn surface at rest — a jacket inside a coat she already has on, jeans inside her own wider trousers
    let buried = 0, gcount = 0;
    { const bd0 = drawn(sm), sh0 = new Uint8Array(n); for(let t=bd0.start;t<bd0.end;t++) sh0[bd0.I[t]] = 1;
      const BN0 = normalsOf(B0, bd0.I, 0, bd0.I.length), shownIdx = []; for(let j=0;j<n;j++) if(sh0[j]) shownIdx.push(j);
      const SP = new Float32Array(shownIdx.length*3); shownIdx.forEach((j, k)=>{ SP[k*3] = B0[j*3]; SP[k*3+1] = B0[j*3+1]; SP[k*3+2] = B0[j*3+2]; });
      const findB = gridOf(SP, near*2);
      // (not at its edges: the lip of a cuff or a finger hole is meant to go in under the skin coming out of it)
      gs.forEach((g, k)=>{ const P = posedOf(g); for(let i=0;i<P.length/3;i++){ if(edges[k][i]) continue; gcount++; const r = findB(P[i*3], P[i*3+1], P[i*3+2]); if(r.i < 0 || r.d > near) continue; const j = shownIdx[r.i];
        const d = (P[i*3]-B0[j*3])*BN0[j*3] + (P[i*3+1]-B0[j*3+1])*BN0[j*3+1] + (P[i*3+2]-B0[j*3+2])*BN0[j*3+2]; if(d < -out) buried++; } }); }
    for(const clip of clips){
      AVATAR.animate(m, 0, clip);
      for(let f=0; f<(o.frames || 8); f++){
        AVATAR.animate(m, f ? 0.17 : 0.05, clip); m.updateMatrixWorld(true);
        const B = posedOf(sm), bd = drawn(sm), shown = new Uint8Array(n), any = new Uint8Array(n);
        for(let t=0;t<bd.I.length;t++) any[bd.I[t]] = 1; for(let t=bd.start;t<bd.end;t++) shown[bd.I[t]] = 1;
        const G = gs.map((g, k)=>{ const P = posedOf(g), d = drawn(g); return { P, N:normalsOf(P, d.I, d.start, d.end), find:gridOf(P, near*2), edge:edges[k], s:flip[k] }; });
        const BN = normalsOf(B, bd.I, 0, bd.I.length);
        let holes = 0, hidden = 0, poke = 0, close = 0, dbl = 0, bare = 0;
        for(let j=0;j<n;j++){
          const x = B[j*3], y = B[j*3+1], z = B[j*3+2];
          // a hole: skin not drawn that the garments have moved well away from (further than at rest, and far)
          if(any[j] && !shown[j]){ hidden++; let best = Infinity; G.forEach(g=>{ const r = g.find(x, y, z); if(r.i >= 0) best = Math.min(best, r.d); });
            if(best > far && best > dist0[j] + near){
              // far from cloth — but a wide trouser leg swings away from a shin and still hides it: only a hole if nothing lies out along its normal
              let over = false; for(let t=near; t<H*0.15 && !over; t+=near*0.75){ const px = x + BN[j*3]*t, py = y + BN[j*3+1]*t, pz = z + BN[j*3+2]*t; over = G.some(g=>{ const r = g.find(px, py, pz); return r.i >= 0 && r.d < near; }); }
              if(!over) holes++; }
            continue; }
          // doubled: drawn skin with garment lying right on it, facing the same way (a hand moulded into a sleeve, a second skin)
          if(shown[j] && under[j] < 0){ bare++; for(const g of G){ const r = g.find(x, y, z); if(r.i < 0 || r.d > H*0.004 || g.edge[r.i]) continue; const i = r.i;
              if(g.s*(g.N[i*3]*BN[j*3] + g.N[i*3+1]*BN[j*3+1] + g.N[i*3+2]*BN[j*3+2]) > 0.5){ dbl++; break; } } }
          // poke-through: drawn skin that was under a garment at rest and is outside it now
          if(!shown[j] || under[j] < 0) continue; close++;
          const g = G[under[j]], r = g.find(x, y, z); if(r.i < 0 || r.d > near || g.edge[r.i]) continue;   // a hem that rode up shows skin; that is not skin through cloth
          const i = r.i, d = g.s*((x - g.P[i*3])*g.N[i*3] + (y - g.P[i*3+1])*g.N[i*3+1] + (z - g.P[i*3+2])*g.N[i*3+2]); if(d > out) poke++;
        }
        // (poke-through is out of all the skin the garments cover, drawn or not: good covers leave almost none of it drawn)
        frames.push({ clip, f, holes, hidden, poke, close, dbl, holesK:hidden ? Math.round(holes/hidden*1000) : 0, pokeK:Math.round(poke/Math.max(1, hidden + close)*10000)/10, dblK:bare ? Math.round(dbl/bare*10000)/10 : 0 });
      }
    }
    const worst = k => frames.reduce((a, b)=>b[k] > a[k] ? b : a, frames[0]);
    const wh = worst('holesK'), wp = worst('pokeK'), wd = worst('dblK');
    // the picture of the worst frame for poke-through
    AVATAR.animate(m, 0, wp.clip); for(let f=0; f<=wp.f; f++) AVATAR.animate(m, f ? 0.17 : 0.05, wp.clip); m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), h = Math.max(1.9, box.max.y - box.min.y);
    S.background = new THREE.Color(window.TRY.bg || 0xff00ff);
    [[0, 0, 1], [1, 0, 0], [0, 0, -1], [0.75, 0.25, 0.75]].forEach((d, i)=>{ const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50), n = new THREE.Vector3(...d).normalize();
      cam.position.copy(c).addScaledVector(n, h*2.25); cam.lookAt(c); const x = (i % 2)*512, y = (1 - Math.floor(i/2))*512; R.setViewport(x, y, 512, 512); R.setScissor(x, y, 512, 512); R.render(S, cam); });
    S.remove(m);
    return { buried:gcount ? Math.round(buried/gcount*1000) : 0, skin:skinIn(sm, gs), shot:R.domElement.toDataURL('image/jpeg', 0.85), clips:clips.length, frames:frames.length, holes:{ worst:wh.holesK, at:wh.clip + '@' + wh.f }, poke:{ worst:wp.pokeK, at:wp.clip + '@' + wp.f, n:wp.poke + '/' + wp.close }, doubled:{ worst:wd.dblK, at:wd.clip + '@' + wd.f },
      mean:{ holes:+(frames.reduce((a, f)=>a + f.holesK, 0)/frames.length).toFixed(2), poke:+(frames.reduce((a, f)=>a + f.pokeK, 0)/frames.length).toFixed(2) } };
  };
  window.TRY.vertexColours = vertexColours;
  window.TRY.ready = true;
})();
