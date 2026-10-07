/* =====================================================================
   TSH · ALPHA, IN MAYA. What Alpha is made of is in her too: a black,
   wet, living stuff under her skin. When Canon's tuned gizmo sings at the
   Psi in it, it comes up: out of her hands first, then up her arms, then
   over all of her — glossy black, with pale lights in it like eyes
   opening, and a white light where one eye was. While it takes her she
   GLITCHES: the stuff tears into bands of colour, her body jumps a few
   centimetres and back, she jerks.

   Done in her own material (onBeforeCompile), so it rides her skinning
   and her clips: `cover` 0..1 spreads it (from the arms in, by how far a
   point is from her middle, broken up with noise), `glitch` 0..1 is the
   tearing. Her face shapes and her animation keep working under it.

     const a = TSHALPHA.apply(model);  a.cover = 0.6;  a.glitch = 1;  a.tick(dt);  a.remove();
   ===================================================================== */
window.TSHALPHA = (function(){
  const NOISE = `
    float aHash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
    float aNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
      return mix(mix(mix(aHash(i), aHash(i + vec3(1,0,0)), f.x), mix(aHash(i + vec3(0,1,0)), aHash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(aHash(i + vec3(0,0,1)), aHash(i + vec3(1,0,1)), f.x), mix(aHash(i + vec3(0,1,1)), aHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
    vec3 aHue(float h){ return clamp(abs(mod(h*6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }`;
  function apply(model){
    const U = { uCover:{ value:0 }, uGlitch:{ value:0 }, uT:{ value:0 }, uMin:{ value:new THREE.Vector3() }, uMax:{ value:new THREE.Vector3(1, 1, 1) } };
    const mats = [], was = [];
    model.traverse(o=>{
      if(!o.isMesh || !o.material || o.userData.alphaSkip) return;
      const geo = o.geometry; if(!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox;
      // how far along the arm each of its bones is: the stuff comes out of the hands, up the arms, over her, and her head goes last
      const arm = new Float32Array(128);
      if(o.isSkinnedMesh && o.skeleton) o.skeleton.bones.forEach((b, i)=>{ if(i < 128) arm[i] = armness(b.name || ''); });
      const one = src => { if(!src || !src.clone) return src; const m = src.clone(); hook(m); mats.push(m); return m; };
      was.push([o, o.material]);
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
      function hook(m){
      m.onBeforeCompile = sh=>{
        Object.assign(sh.uniforms, U, { uMin:{ value:bb.min.clone() }, uMax:{ value:bb.max.clone() }, uArm:{ value:arm } });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAP;\nvarying float vArm;\nuniform vec3 uMin; uniform vec3 uMax; uniform float uArm[128];')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vAP = (position - uMin)/max(uMax - uMin, vec3(1e-4));
            #ifdef USE_SKINNING
              vArm = uArm[int(skinIndex.x)]*skinWeight.x + uArm[int(skinIndex.y)]*skinWeight.y + uArm[int(skinIndex.z)]*skinWeight.z + uArm[int(skinIndex.w)]*skinWeight.w;
            #else
              vArm = 0.05;
            #endif`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAP;\nvarying float vArm;\nuniform float uCover; uniform float uGlitch; uniform float uT;' + NOISE)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            // the stuff: from the hands in (far from her middle first), torn up by noise
            float aN = aNoise(vAP*vec3(9.0, 22.0, 9.0) + vec3(0.0, uT*0.35, 0.0));
            float aEdge = vArm*0.85 + aN*0.15 - (1.0 - uCover*1.15);       // 1 at her fingertips, 0 at the top of her head
            float aOn = smoothstep(0.0, 0.08, aEdge);
            float aRim = smoothstep(0.0, 0.05, aEdge) - smoothstep(0.05, 0.16, aEdge);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.012, 0.018), aOn);
            roughnessFactor = mix(roughnessFactor, 0.12, aOn);`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            {
              float aN2 = aNoise(vAP*vec3(9.0, 22.0, 9.0) + vec3(0.0, uT*0.35, 0.0));
              float aE = vArm*0.85 + aN2*0.15 - (1.0 - uCover*1.15);
              float aOn2 = smoothstep(0.0, 0.08, aE);
              float aR = smoothstep(0.0, 0.05, aE) - smoothstep(0.05, 0.16, aE);
              // the pale lights in it, opening and closing
              float node = smoothstep(0.74, 0.8, aNoise(vAP*vec3(20.0, 46.0, 20.0) + 3.1)) * (0.6 + 0.4*sin(uT*3.0 + vAP.y*40.0));
              totalEmissiveRadiance += vec3(0.85, 0.92, 1.0)*node*aOn2*4.0;
              // the creeping edge: a wet sheen
              totalEmissiveRadiance += vec3(0.35, 0.3, 0.55)*aR*0.6;
              // the tearing: bands of colour, while it glitches
              float band = step(0.965, fract(vAP.y*7.0 + uT*5.0 + aNoise(vec3(vAP.y*30.0, uT*9.0, 0.0))*2.0)) * step(0.45, aNoise(vec3(vAP.y*4.0, floor(uT*12.0), 1.0)));
              totalEmissiveRadiance += aHue(vAP.x*3.0 + vAP.y*2.0 + uT*0.7)*band*uGlitch*(0.4 + aOn2)*2.0;
            }`);
      };
      m.customProgramCacheKey = () => 'tshalpha';
      }
    });
    // the eye: a white light where her left eye is
    let head = null; model.traverse(o=>{ if(!head && /Head$/.test(o.name || '')) head = o; });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color:new THREE.Color(3, 3, 3.2) }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:haloTex(), color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    halo.scale.setScalar(0.28); eye.add(halo); eye.visible = false;
    if(head){ const s = new THREE.Vector3(); head.getWorldScale(s); const k = 1/(s.x || 1); eye.scale.setScalar(k); eye.position.set(0.032*k, 0.075*k, 0.085*k); head.add(eye); }
    const A = { cover:0, glitch:0, t:0, jump:0,
      tick(dt){
        A.t += dt; U.uT.value = A.t; U.uCover.value = A.cover; U.uGlitch.value = A.glitch;
        eye.visible = A.cover > 0.55; halo.material.opacity = 0.6 + 0.4*Math.sin(A.t*9) * (A.glitch > 0.3 ? Math.random() : 1);
        // she jumps a few centimetres and back while it tears
        if(A.glitch > 0 && Math.random() < A.glitch*0.25){ A.jump = 0.06; model.position.set((Math.random() - 0.5)*0.12*A.glitch, 0, (Math.random() - 0.5)*0.12*A.glitch); }
        else if(A.jump > 0){ A.jump -= dt; if(A.jump <= 0) model.position.set(0, 0, 0); }
      },
      remove(){ was.forEach(([o, m])=>{ o.material = m; }); mats.forEach(m=>m.dispose()); if(eye.parent) eye.parent.remove(eye); model.position.set(0, 0, 0); }
    };
    return A;
  }
  function armness(n){
    return /Hand|Thumb|Index|Middle|Ring|Pinky/.test(n) ? 1 : /ForeArm/.test(n) ? 0.86 : /Arm/.test(n) ? 0.72 : /Shoulder/.test(n) ? 0.58 : /Spine2/.test(n) ? 0.46
      : /Spine1/.test(n) ? 0.4 : /Spine/.test(n) ? 0.34 : /Hips/.test(n) ? 0.3 : /UpLeg/.test(n) ? 0.26 : /Leg/.test(n) ? 0.2 : /Foot|Toe/.test(n) ? 0.16 : /Neck/.test(n) ? 0.12 : 0.03;
  }
  let halo_ = null;
  /* white loops scrawled on a clear page: a scribbled eye */
  function scribbleTex(){
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.strokeStyle = '#fff'; x.lineCap = 'round';
    for(let i = 0; i < 16; i++){ x.lineWidth = 1.5 + Math.random()*3.5; x.globalAlpha = 0.6 + Math.random()*0.4; x.beginPath();
      const cx = 128 + (Math.random() - 0.5)*30, cy = 128 + (Math.random() - 0.5)*30, rx = 30 + Math.random()*80, ry = 30 + Math.random()*80, a0 = Math.random()*7, turns = 1 + Math.random()*1.5;
      for(let k = 0; k <= 60; k++){ const a = a0 + k/60*turns*6.283, j = 1 + (Math.random() - 0.5)*0.12; const px = cx + Math.cos(a)*rx*j, py = cy + Math.sin(a)*ry*j; k ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke(); }
    // a few strokes dragged out of it
    for(let i = 0; i < 5; i++){ x.lineWidth = 1 + Math.random()*2; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + (Math.random() - 0.5)*250, 128 + Math.random()*128); x.stroke(); }
    const t = new THREE.CanvasTexture(c); return t;
  }
  function haloTex(){
    if(halo_) return halo_;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(220,235,255,0.6)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); halo_ = new THREE.CanvasTexture(c); return halo_;
  }
  /* =====================================================================
     AND THEN SHE IS NOT MAYA. What came up out of her keeps coming: a mass of the black stuff as big as the
     platform, heaving (its skin pushed about by noise, every frame), pale lights opening and shutting all over it,
     one white eye high on it — tendrils of it whipping out across the station — and in its front a hole: a black
     disc with the colours of everything it is eating wound round it, turning, pulling. Things go into it.

       const m = TSHMONSTER.make(group, [x, 0, z], yaw);  m.grow = 0..1;  m.tick(dt);  m.mouth (world point);  m.reach(at)
     ===================================================================== */
  /* THE BODY IT COMES UP IN: the goose (tsh/monster/goose.glb, rigged from animations/mia/goose) — and nothing of
     its movement is its own. Two other animals move it from inside. A spider (tsh/monster/spider.glb: walk, run,
     attack) crawls, and its legs work the goose's blade arms and kneeling legs; a tyrannosaur (tsh/monster/trex.glb:
     idle, bite, roar, attack_tail) works its spine, neck and head. Neither is drawn: each plays out of sight, and
     every frame each goose bone turns (in the monster's own frame) by as much as its bone has turned since the
     first frame of its idle — so the goose crawls like the one and bites like the other, from its own kneel. */
  const loads = {};
  function glb(name){
    if(loads[name]) return loads[name];
    return loads[name] = new Promise(ok=>{
      if(!THREE.GLTFLoader) return ok(null);
      const L = new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
      L.load('tsh/monster/' + name + '.glb?v=3', g=>ok(g), undefined, ()=>ok(null));
    });
  }
  const preload = () => Promise.all([glb('goose'), glb('spider'), glb('trexhead')]);
  function cloneSkinned(src){
    if(THREE.SkeletonUtils && THREE.SkeletonUtils.clone) return THREE.SkeletonUtils.clone(src);
    const map = new Map(), copy = src.clone(true);
    const a = [], b = []; src.traverse(o=>a.push(o)); copy.traverse(o=>b.push(o)); a.forEach((o, i)=>map.set(o, b[i]));
    b.forEach((o, i)=>{ if(o.isSkinnedMesh){ o.bind(new THREE.Skeleton(a[i].skeleton.bones.map(bn=>map.get(bn)), a[i].skeleton.boneInverses), a[i].bindMatrix); } });
    return copy;
  }
  /* goose bone ← [rig, its bone, how much of its turn]; parents before children. (The loader takes the dots out.) */
  const MAP = [
    ['Hips',       'sp', 'Bone004',      0.6],
    ['Spine',      'tx', 'bn_Spine15',   1.0],
    ['Chest',      'tx', 'bn_Spine26',   1.1],
    ['Neck',       'tx', 'bn_Neck18',    1.2],
    ['Head',       'tx', 'bn_Head10',    1.3],
    ['Shoulder.L', 'sp', 'Bone002_L002', 0.8], ['UpperArm.L', 'sp', 'Bone002_L003', 1.2], ['Forearm.L', 'sp', 'Bone002_L005', 1.2],
    ['Shoulder.R', 'sp', 'Bone002_R002', 0.8], ['UpperArm.R', 'sp', 'Bone002_R003', 1.2], ['Forearm.R', 'sp', 'Bone002_R005', 1.2],
    ['Thigh.L',    'sp', 'Bone_L003',    1.0], ['Shin.L',     'sp', 'Bone_L004',    1.0], ['Foot.L',    'sp', 'Bone_L005',    1.0],
    ['Thigh.R',    'sp', 'Bone_R003',    1.0], ['Shin.R',     'sp', 'Bone_R004',    1.0], ['Foot.R',    'sp', 'Bone_R005',    1.0]
  ];
  function monster(group, at, yaw){
    const root = new THREE.Group(); root.position.set(at[0], 0, at[2]); root.rotation.y = yaw || 0; group.add(root);
    const body = new THREE.Group(); root.add(body);
    const U = { uT:{ value:0 }, uAmp:{ value:0.05 } };
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Q3 = new THREE.Quaternion(), QI = new THREE.Quaternion(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    /* ITS SKIN: Alpha's black — glossy, wet, alive: the surface crawls, pale lights open and shut in it, and torn
       streaks of colour flicker down it */
    const skin = new THREE.MeshStandardMaterial({ color:0x030305, roughness:0.07, metalness:0.4 });
    skin.onBeforeCompile = sh=>{ Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uAmp;\nvarying vec3 vSP;' + NOISE)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vSP = position;
          float nn = aNoise(position*4.0 + vec3(0.0, uT*1.1, uT*0.5)) + 0.6*aNoise(position*8.5 - vec3(uT*1.6));
          transformed += normal*(nn - 0.8)*uAmp;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;\nvarying vec3 vSP;' + NOISE)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            vec3 cell = floor(vSP*5.0); float h = aHash(cell + 7.1);
            vec3 f = fract(vSP*5.0) - 0.5; float d = length(f);
            float open = max(0.0, sin(uT*(0.6 + h*1.4) + h*40.0));
            totalEmissiveRadiance += vec3(2.4, 2.5, 2.7)*(1.0 - smoothstep(0.05, 0.12 + 0.04*open, d))*step(0.82, h)*open;
            float sn = aNoise(vec3(vSP.x*38.0, vSP.y*1.6 - uT*0.9, vSP.z*38.0) + floor(uT*7.0)*3.1);
            float st = smoothstep(0.78, 0.88, sn)*1.6;
            float which = aHash(floor(vec3(vSP.x*38.0, uT*3.0, vSP.z*38.0)));
            totalEmissiveRadiance += (which < 0.4 ? vec3(2.2, 0.15, 1.4) : which < 0.75 ? vec3(0.1, 1.8, 2.2) : vec3(2.4, 0.8, 0.1))*st;
          }`); };
    skin.customProgramCacheKey = () => 'tshgoose2';
    /* THE RIGS */
    const R = { ready:false, gb:{}, sb:{}, tb:{}, spMix:null, txMix:null, sa:{}, ta:{}, spNow:null, txNow:null, act:null, actT:0, bit:false, ref:{} };
    const play = (mix, acts, now, name, fade, once) => { const n = acts[name]; if(!n) return now; if(now === n && !once) return now;
      n.reset(); n.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); n.clampWhenFinished = !!once; n.enabled = true; n.setEffectiveWeight(1); n.play();
      if(now && now !== n) now.crossFadeTo(n, fade || 0.25, false); return n; };
    const rootQ = new THREE.Quaternion();
    const rel = (o, out) => { o.getWorldQuaternion(out); return out.premultiply(Q3.copy(rootQ).invert()); };   // a bone's turn in the monster's own frame
    preload().then(([gg, sg, tg])=>{
      if(!gg || !sg || !tg || !root.parent) return;
      const go = cloneSkinned(gg.scene); body.add(go);
      go.traverse(o=>{ if(o.isMesh){ o.material = skin; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } if(o.isBone) R.gb[o.name] = o; });
      // the two that move it: in the monster's frame, facing the way it faces, never drawn
      const sp = cloneSkinned(sg.scene), tx = cloneSkinned(tg.scene);
      sp.traverse(o=>{ if(o.isMesh) o.visible = false; }); body.add(sp);
      // the tyrannosaur's head (tsh/monster/trexhead.glb: only its head is left of its mesh) IS drawn — on the goose's neck
      tx.scale.setScalar(0.45); body.add(tx); R.tx = tx;
      tx.traverse(o=>{ if(o.isMesh){ o.material = skin; o.castShadow = true; o.frustumCulled = false; } });
      sp.traverse(o=>{ if(o.isBone) R.sb[o.name] = o; }); tx.traverse(o=>{ if(o.isBone) R.tb[o.name] = o; });
      R.spMix = new THREE.AnimationMixer(sp); R.txMix = new THREE.AnimationMixer(tx);
      sg.animations.forEach(c=>{ R.sa[c.name.replace(/^.*\|/, '')] = R.spMix.clipAction(c); });
      tg.animations.forEach(c=>{ R.ta[c.name] = R.txMix.clipAction(c); });
      // the reference: each animal at the first frame of its idle, the goose at rest
      R.spNow = play(R.spMix, R.sa, null, 'walk'); R.txNow = play(R.txMix, R.ta, null, 'idle');
      R.spMix.update(0); R.txMix.update(0); root.updateMatrixWorld(true); root.getWorldQuaternion(rootQ);
      MAP.forEach(([g, w, s_])=>{ const src = (w === 'sp' ? R.sb : R.tb)[s_], dst = R.gb[g]; if(!src || !dst) return;
        R.ref[g] = { src, dst, s:rel(src, new THREE.Quaternion()), d:rel(dst, new THREE.Quaternion()), rest:dst.quaternion.clone() }; });
      R.spNow = play(R.spMix, R.sa, R.spNow, 'walk tight');
      R.txMix.addEventListener('finished', ()=>{ R.act = null; R.txNow = play(R.txMix, R.ta, R.txNow, 'idle', 0.35); });
      R.ready = true;
    });
    const G_ = name => R.gb[name];
    /* ITS FACE: a white light where the eyes should be, scribbled over; the hole when it pulls */
    const head = new THREE.Group(); head.position.set(0, 4.7, 0.25); body.add(head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color:new THREE.Color(4, 4, 4.4) })); eye.position.set(0, 0.12, 0.3); head.add(eye);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:haloTex(), color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); halo.scale.setScalar(0.9); eye.add(halo);
    const scr = [0, 1, 2, 3, 4].map(()=>scribbleTex());
    const scribble = (parent, sz) => { const m = new THREE.SpriteMaterial({ map:scr[0], color:new THREE.Color(1.6, 1.6, 1.7), transparent:true, depthWrite:false });
      const sp = new THREE.Sprite(m); sp.scale.setScalar(sz); sp.userData.k = Math.random()*5; parent.add(sp); return sp; };
    const scribs = [];
    eye.visible = false;
    const bodyScr = [['Chest', 0.6, [-0.24, 0, 0.42]], ['Chest', 0.6, [0.26, 0.02, 0.42]], ['Spine', 0.5, [0.05, -0.2, 0.3]]].map(([bn, sz, off])=>{ const s_ = scribble(body, sz); s_.userData.bone = bn; s_.userData.off = new THREE.Vector3(...off); return s_; });
    const rims = [[0xff2aa8, -4.5, 3.6, 3.4], [0x22e8ff, 4.5, 3.0, 2.8], [0xb06aff, 0, 7, -2.5]].map(([c, x, y, z])=>{ const l = new THREE.PointLight(c, 18, 18, 1.4); l.position.set(x, y, z); body.add(l); return l; });
    const spot = new THREE.SpotLight(0xffe8ff, 140, 40, 0.8, 0.45, 1.2); spot.position.set(0, 0.0, 0.45); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 40;
    const aim = new THREE.Object3D(); aim.position.set(0, -4.2, 11); head.add(aim); spot.target = aim; head.add(spot);
    const strobe = new THREE.PointLight(0xffffff, 0, 30, 1.2); strobe.position.set(0, 0, 0.4); head.add(strobe);
    const vortex = new THREE.Group(); vortex.position.set(0, -0.2, 0.42); vortex.scale.setScalar(0.42); head.add(vortex);
    const swirl = new THREE.ShaderMaterial({ uniforms:{ uT:U.uT, uPull:{ value:1 } }, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader:`varying vec2 vP; uniform float uT, uPull;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){ float r = length(vP)/0.42, a = atan(vP.y, vP.x);
          float arms = 0.5 + 0.5*sin(a*5.0 + log(max(r, 0.01))*10.0 + uT*7.0*uPull);
          float band = smoothstep(0.95, 1.25, r)*(1.0 - smoothstep(2.0, 2.9, r));
          vec3 c = hue(a/6.2831 + r*0.25 - uT*0.3)*pow(arms, 2.0)*band*2.2;
          c += vec3(1.6, 1.5, 1.8)*(smoothstep(0.92, 1.0, r) - smoothstep(1.0, 1.1, r));
          gl_FragColor = vec4(c, max(max(c.r, c.g), c.b)*min(1.0, uPull)); }` });
    vortex.add(new THREE.Mesh(new THREE.RingGeometry(0.38, 1.2, 96, 3), swirl));
    const NP = 700, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP*3), pc = new Float32Array(NP*3), pst = [];
    for(let i = 0; i < NP; i++){ pst.push({ r:1 + Math.random()*9, a:Math.random()*7, z:Math.random()*8 }); const c = new THREE.Color().setHSL(Math.random(), 1, 0.6); pc[i*3] = c.r*2; pc[i*3 + 1] = c.g*2; pc[i*3 + 2] = c.b*2; }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:0.09, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); vortex.add(pts);
    /* THE LINES, AS STATIC: strands of black thrown off it but not held — they start off the body, wink in and out in
       pieces, jitter, jump. Mostly off its back, its head and its limbs, so its front stays readable */
    const ANCH = ['Head', 'Neck', 'Chest', 'Hips', 'Forearm.L', 'Forearm.R', 'UpperArm.L', 'UpperArm.R', 'Shin.L', 'Shin.R', 'Foot.L', 'Foot.R', 'Spine'];
    const NL = 0, NPt = 20, strands = [];                     // (the strands are off for now)
    const ink = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), new THREE.MeshBasicMaterial({ color:0x010102 }), NL*NPt);
    ink.frustumCulled = false; ink.count = 0; body.add(ink);
    for(let i = 0; i < NL; i++){ const th = Math.random()*Math.PI*2, ph = (Math.random() - 0.3)*Math.PI*0.9;
      const d = new THREE.Vector3(Math.cos(th)*Math.cos(ph), Math.sin(ph) + 0.25, Math.sin(th)*Math.cos(ph)); if(d.z > 0.3) d.z *= -0.6;    // not across its front
      strands.push({ th:0.012 + Math.random()*0.03, bone:ANCH[i % ANCH.length], dir:d.normalize(),
        len:2 + Math.random()*6, curl:2 + Math.random()*6, w:0.15 + Math.random()*0.6, sp:0.6 + Math.random()*2.2, ph:Math.random()*20, gap:0.2 + Math.random()*0.5, jump:new THREE.Vector3() }); }
    const UPv = new THREE.Vector3(0, 1, 0), SEG = new THREE.Vector3(), MID = new THREE.Vector3(), P0 = new THREE.Vector3(), AV = new THREE.Vector3(), PV = new THREE.Vector3(), SA = new THREE.Vector3(), SB = new THREE.Vector3();
    /* THE SWARM: black flakes boiling off its limbs, its head and its back — thin round its middle, so the shape of
       it shows — and a little dark smoke trailing off its edges */
    const FANCH = ['Forearm.L', 'Forearm.R', 'UpperArm.L', 'UpperArm.R', 'Shin.L', 'Shin.R', 'Foot.L', 'Foot.R', 'Head', 'Neck', 'Hips', 'Chest'];
    const NF = 1500, flakes = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color:0x000000 }), NF);
    flakes.frustumCulled = false; body.add(flakes);
    const FL = []; for(let i = 0; i < NF; i++){ const bn = FANCH[i % FANCH.length], torso = bn === 'Chest' || bn === 'Hips';
      FL.push({ bone:bn, r:(torso ? 0.5 : 0.12) + Math.pow(Math.random(), 2.2)*(torso ? 0.9 : 1.1), a:Math.random()*7, b:Math.random()*7, sp:(0.4 + Math.random()*1.6)*(Math.random() < 0.5 ? -1 : 1), s:0.015 + Math.random()*0.05, y:(Math.random() - 0.5)*1.2, back:torso }); }
    const smokeTex = (()=>{ const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const smoke = []; ['Forearm.L', 'Forearm.R', 'Shin.L', 'Shin.R', 'Head', 'Hips'].forEach(bn=>{ for(let i = 0; i < 5; i++){
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map:smokeTex, transparent:true, depthWrite:false, opacity:0.22 }));
      sm.userData = { bone:bn, a:Math.random()*7, r:0.3 + Math.random()*0.7, sp:0.2 + Math.random()*0.6, y:(Math.random() - 0.3)*0.8, s:0.7 + Math.random()*1.0 }; body.add(sm); smoke.push(sm); } });
    const anchorAt = (name, out) => { const b = name && G_(name); if(b){ b.getWorldPosition(out); body.worldToLocal(out); } else out.set(0, 2.5, 0); return out; };
    const lastPos = new THREE.Vector3(at[0], 0, at[2]); let speed = 0;
    /* the retarget: parents first, each goose bone set so that in the monster's frame it has turned as its source has */
    function drive(){
      root.updateMatrixWorld(true); root.getWorldQuaternion(rootQ);
      MAP.forEach(([g, w, s_, k])=>{ const r = R.ref[g]; if(!r) return;
        rel(r.src, Q);                                    // the source now
        Q.multiply(Q2.copy(r.s).invert());                // its turn since the reference
        if(k !== 1){ Q2.copy(QI).slerp(Q, Math.min(1, k)); if(k > 1) Q2.multiply(Q3.copy(QI).slerp(Q, k - 1)); Q.copy(Q2); }
        Q.multiply(r.d);                                  // onto the goose bone's own resting turn
        const par = r.dst.parent; rel(par, Q2);           // and into its parent's frame
        r.dst.quaternion.copy(Q2.invert().multiply(Q));
        r.dst.updateMatrixWorld(true); });
    }
    const M = { root, grow:0, pull:1, jaw:0, t:0, mouth:new THREE.Vector3(), eyeAt:new THREE.Vector3(), onSlam:null,
      act(name){ if(!R.ready) return; const clip = { roar:'roar', bite:'bite', tail:'attack_tail' }[name]; if(!clip) return;
        R.act = name; R.actT = 0; R.bit = false; R.txNow = play(R.txMix, R.ta, R.txNow, clip, 0.15, true);
        if(name !== 'roar'){ const a = R.sa.attack; if(a){ const was = R.spNow; R.spNow = play(R.spMix, R.sa, R.spNow, 'attack', 0.12, true);
          setTimeout(()=>{ if(R.spNow === a && was){ R.spNow = play(R.spMix, R.sa, a, was === a ? 'walk tight' : (was.getClip().name.replace(/^.*\|/, '')), 0.3); } }, 1100); } } },
      reach(at_){ const w = root.worldToLocal(at_.clone()); M.act(w.z < -1 ? 'tail' : 'bite'); },
      tick(dt){
        M.t += dt; U.uT.value = M.t;
        const g = M.grow, e = g*g*(3 - 2*g);
        body.scale.setScalar(Math.max(0.001, e));
        V1.copy(root.position); speed += ((V1.distanceTo(lastPos)/Math.max(dt, 1e-3)) - speed)*Math.min(1, dt*6); lastPos.copy(V1);
        if(R.ready){
          const want = speed > 4.5 ? 'run' : speed > 0.6 ? 'large walk' : 'walk tight';
          if(R.sa[want] && R.spNow !== R.sa[want] && R.spNow !== R.sa.attack) R.spNow = play(R.spMix, R.sa, R.spNow, want, 0.3);
          if(R.spNow && R.spNow !== R.sa.attack) R.spNow.timeScale = speed > 0.6 ? Math.min(2.2, 0.6 + speed*0.25) : 0.5 + M.pull*0.4;
          R.spMix.update(dt); R.txMix.update(dt*(R.act ? 1.2 : 1));
          drive();
          // the tyrannosaur's neck set on the goose's: the head goes where the goose's head was
          const gh = G_('Head'), tn = R.tb.bn_Neck29;
          if(gh && tn){ gh.getWorldPosition(V1); tn.getWorldPosition(V2); body.worldToLocal(V1); body.worldToLocal(V2); R.tx.position.add(V1.sub(V2)); R.tx.updateMatrixWorld(true);
            gh.scale.setScalar(0.001); }
          if(R.act === 'bite' || R.act === 'tail'){ R.actT += dt; if(!R.bit && R.actT > (R.act === 'bite' ? 0.55 : 0.7)){ R.bit = true; if(M.onSlam) M.onSlam(root.localToWorld(V2.set(0, 0, 2))); } }
          // it jerks: a bone snaps somewhere else for a frame
          if(Math.random() < 0.07){ const ks = Object.keys(R.gb), b = R.gb[ks[(Math.random()*ks.length)|0]];
            if(b) b.quaternion.multiply(Q.setFromEuler(new THREE.Euler((Math.random() - 0.5)*0.5, (Math.random() - 0.5)*0.5, (Math.random() - 0.5)*0.5))); }
          // the face and the hole ride the dinosaur's head: between its skull and its jaw, out at its teeth
          const th = R.tb.bn_Head10, tj = R.tb.bn_Jaw11;
          if(th && tj){ th.getWorldPosition(V1); tj.getWorldPosition(V2); body.worldToLocal(V1); body.worldToLocal(V2); head.position.copy(V1).lerp(V2, 0.5).add(V2.set(0, 0, 0.55)); }
          // the static
          let si = 0;
          strands.forEach(st=>{ anchorAt(st.bone, AV);
            if(Math.random() < 0.02) st.jump.set((Math.random() - 0.5)*1.2, (Math.random() - 0.5)*0.8, (Math.random() - 0.5)*1.2); else st.jump.multiplyScalar(0.85);
            const t = M.t*st.sp + st.ph, L = st.len*(0.75 + 0.25*Math.sin(t*0.7))*(1 + M.pull*0.3);
            SA.set(-st.dir.z, 0, st.dir.x).normalize(); SB.crossVectors(st.dir, SA);
            for(let j = 0; j < NPt; j++){ const u = st.gap + (1 - st.gap)*j/(NPt - 1), r = st.w*u*(1 + Math.sin(t*1.3 + u*4)), c = u*st.curl*6.283 + t*2.0;
              PV.copy(AV).add(st.jump).addScaledVector(st.dir, u*L).addScaledVector(SA, Math.cos(c)*r).addScaledVector(SB, Math.sin(c)*r*0.8);
              PV.y -= u*u*0.6; PV.x += (Math.random() - 0.5)*0.06; PV.y += (Math.random() - 0.5)*0.06; PV.z += (Math.random() - 0.5)*0.06;
              if(j && Math.random() > 0.3){ SEG.subVectors(PV, P0); const len = SEG.length(); MID.addVectors(PV, P0).multiplyScalar(0.5);
                Q.setFromUnitVectors(UPv, SEG.multiplyScalar(1/Math.max(len, 1e-4))); const w = st.th*(1 - u*0.6);
                M4.compose(MID, Q, S1.set(w, len, w)); ink.setMatrixAt(si++, M4); }
              P0.copy(PV); } });
          ink.count = si; ink.instanceMatrix.needsUpdate = true;
          FL.forEach((f, i)=>{ anchorAt(f.bone, AV); f.a += dt*f.sp*(1 + M.pull); f.b += dt*f.sp*0.7;
            const r = f.r*(1 + 0.25*Math.sin(M.t*2 + i));
            V1.set(AV.x + Math.cos(f.a)*Math.cos(f.b)*r, AV.y + f.y*0.5 + Math.sin(f.b)*r*0.6, AV.z + Math.sin(f.a)*Math.cos(f.b)*r);
            if(f.back && V1.z > AV.z) V1.z = AV.z - (V1.z - AV.z);     // round its middle, only behind it
            Q.setFromEuler(new THREE.Euler(f.a*3, f.b*2, 0)); const sc = f.s*(Math.random() < 0.04 ? 2.5 : 1);
            M4.compose(V1, Q, S1.set(sc, sc*1.6, sc)); flakes.setMatrixAt(i, M4); });
          flakes.instanceMatrix.needsUpdate = true;
          smoke.forEach(sm=>{ const d = sm.userData; anchorAt(d.bone, AV); d.a += dt*d.sp;
            sm.position.set(AV.x + Math.cos(d.a)*d.r, AV.y + d.y + Math.sin(M.t*0.7 + d.a)*0.3, AV.z - Math.abs(Math.sin(d.a))*d.r); sm.scale.setScalar(d.s*(0.9 + 0.2*Math.sin(M.t + d.a))); });
          bodyScr.forEach(sp=>{ anchorAt(sp.userData.bone, sp.position); sp.position.add(sp.userData.off); });
          scribs.concat(bodyScr).forEach((sp, i)=>{ sp.userData.k += dt*9; sp.material.map = scr[(sp.userData.k|0) % scr.length]; sp.material.rotation = Math.sin(M.t*0.5 + i)*0.4; });
        }
        U.uAmp.value = 0.045 + 0.025*Math.sin(M.t*0.7) + M.pull*0.02;
        halo.material.opacity = 0.35 + 0.15*Math.sin(M.t*7);
        rims.forEach((l, i)=>{ l.intensity = (14 + 10*Math.sin(M.t*(2.1 + i) + i*2))*e; l.color.setHSL((M.t*0.11 + i*0.33) % 1, 1, 0.55); });
        spot.intensity = (90 + 60*Math.random()*M.pull*0.5)*e*(M.key === undefined ? 1 : M.key);   // M.key: a close-up can take the hard front light down
        spot.color.setHSL((0.85 + Math.sin(M.t*3)*0.1 + 1) % 1, 0.6, 0.7);
        strobe.intensity = Math.random() < 0.02*M.pull ? 240*e : strobe.intensity*0.8;
        vortex.rotation.z -= dt*1.6*M.pull; swirl.uniforms.uPull.value = M.pull; pts.material.opacity = Math.min(1, M.pull*1.5); pts.visible = M.pull > 0.02;
        for(let i = 0; i < NP; i++){ const s_ = pst[i]; s_.a += dt*(1.5 + 6/s_.r)*M.pull; s_.r -= dt*(1.2 + 5/s_.r)*M.pull; s_.z -= dt*1.2*M.pull;
          if(s_.r < 0.4 || s_.z < 0){ s_.r = 4 + Math.random()*8; s_.z = 1 + Math.random()*8; }
          pp[i*3] = Math.cos(s_.a)*s_.r; pp[i*3 + 1] = Math.sin(s_.a)*s_.r; pp[i*3 + 2] = s_.z*Math.min(1, s_.r/3); }
        pg.attributes.position.needsUpdate = true;
        vortex.getWorldPosition(M.mouth); eye.getWorldPosition(M.eyeAt);
      },
      dispose(){ if(root.parent) root.parent.remove(root); }
    };
    return M;
  }
  window.TSHMONSTER = { make:monster, preload };
  return { apply };
})();
