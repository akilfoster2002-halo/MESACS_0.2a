/* THE FITTING ROOM: the game's own avatar.js and wardrobe.js, a body, what it
   has on, a clip at a moment, four views. lab.mjs `try` drives it. */
(function(){
  const R = new THREE.WebGLRenderer({ canvas:document.getElementById('c'), antialias:true, preserveDrawingBuffer:true });
  R.outputColorSpace = THREE.SRGBColorSpace; R.setScissorTest(true);
  const S = new THREE.Scene(); S.background = new THREE.Color(0xc8ccd0);
  S.add(new THREE.HemisphereLight(0xffffff, 0x8a8580, 1.7)); const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(1.5, 3, 2.5); S.add(k);
  const b = new THREE.DirectionalLight(0xcfe0ff, 0.7); b.position.set(-2, 2, -3); S.add(b);
  window.TRY = async function(body, slots, clip, at){
    const m = await AVATAR.load(body); S.add(m);
    AVATAR.animate(m, 0, 'idle'); AVATAR.animate(m, 0.3, 'idle'); m.updateMatrixWorld(true);
    await WARDROBE.put(m, body, slots || {});
    if(clip && clip !== 'idle'){ AVATAR.animate(m, 0, clip); AVATAR.animate(m, at || 0, clip); }
    m.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), h = Math.max(1.9, box.max.y - box.min.y);
    if(window.TRY.head){ let hb = null; m.traverse(o=>{ if(!hb && /Head$/.test(o.name || '')) hb = o; }); if(hb){ hb.getWorldPosition(c); c.y += 0.08; h = 0.42; } }
    if(window.TRY.chest){ let hb = null; m.traverse(o=>{ if(!hb && /Spine2$/.test(o.name || '')) hb = o; }); if(hb){ hb.getWorldPosition(c); c.y += 0.05; h = 0.6; } }
    [[0, 0, 1], [1, 0, 0], [0, 0, -1], [0.75, 0.25, 0.75]].forEach((d, i)=>{
      const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50), dist = h*2.25, n = new THREE.Vector3(...d).normalize();
      cam.position.copy(c).addScaledVector(n, dist); cam.lookAt(c);
      const x = (i % 2)*512, y = (1 - Math.floor(i/2))*512; R.setViewport(x, y, 512, 512); R.setScissor(x, y, 512, 512); R.render(S, cam);
    });
    S.remove(m);
    const where = {}; Object.entries(m.userData.wornBy || {}).forEach(([id, objs])=>{ where[id] = objs.map(o=>{ const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? 'empty' : [b.getCenter(new THREE.Vector3()).toArray().map(v=>+v.toFixed(2)), b.getSize(new THREE.Vector3()).toArray().map(v=>+v.toFixed(2))]; }); });
    return { worn:Object.keys(m.userData.wornBy || {}), look:m.userData.look, where };
  };
  window.TRY.ready = true;
})();
