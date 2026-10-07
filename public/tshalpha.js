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
  /* THE BODY IT COMES UP IN: the goose (tsh/monster/goose.glb, rigged from animations/mia/goose) — pale, starved,
     kneeling, with arms that end in long red blades and shins that do too. Loaded once; each monster gets a copy. */
  let gooseP = null;
  function goose(){
    if(gooseP) return gooseP;
    gooseP = new Promise(ok=>{
      if(!THREE.GLTFLoader) return ok(null);
      const L = new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
      L.load('tsh/monster/goose.glb?v=1', g=>ok(g.scene), undefined, ()=>ok(null));
    });
    return gooseP;
  }
  function cloneSkinned(src){
    if(THREE.SkeletonUtils && THREE.SkeletonUtils.clone) return THREE.SkeletonUtils.clone(src);
    // the scene graph, then each skinned mesh bound to the copy's own bones
    const map = new Map(), copy = src.clone(true);
    const a = [], b = []; src.traverse(o=>a.push(o)); copy.traverse(o=>b.push(o)); a.forEach((o, i)=>map.set(o, b[i]));
    b.forEach((o, i)=>{ if(o.isSkinnedMesh){ const so = a[i]; const bones = so.skeleton.bones.map(bn=>map.get(bn));
      o.bind(new THREE.Skeleton(bones, so.skeleton.boneInverses), so.bindMatrix); } });
    return copy;
  }
  function monster(group, at, yaw){
    const root = new THREE.Group(); root.position.set(at[0], 0, at[2]); root.rotation.y = yaw || 0; group.add(root);
    const body = new THREE.Group(); root.add(body);
    const U = { uT:{ value:0 } };
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), X = new THREE.Vector3(1, 0, 0), Zv = new THREE.Vector3(0, 0, 1);
    /* ITS BODY: the goose, kneeling over the platform, its blades on the floor in front of it. Its bones are moved
       here: it breathes through its spine, its head hunts, and a blade comes up — and slams down */
    /* ITS SKIN: the goose is only the shape. What covers it is Alpha's black — glossy, wet, alive: the surface
       crawls (pushed in and out along itself by moving noise) and pale lights open and close in it like eyes */
    const skin = new THREE.MeshStandardMaterial({ color:0x030305, roughness:0.07, metalness:0.4 });
    skin.onBeforeCompile = sh=>{ Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uAmp;\nvarying vec3 vSP;' + NOISE)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vSP = position;
          float nn = aNoise(position*4.0 + vec3(0.0, uT*1.1, uT*0.5)) + 0.6*aNoise(position*8.5 - vec3(uT*1.6));
          transformed += normal*(nn - 0.8)*uAmp;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;\nvarying vec3 vSP;' + NOISE)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {  // the pale lights: small, scattered, each opening and shutting on its own time
            vec3 cell = floor(vSP*5.0); float h = aHash(cell + 7.1);
            vec3 f = fract(vSP*5.0) - 0.5; float d = length(f);
            float open = max(0.0, sin(uT*(0.6 + h*1.4) + h*40.0));
            float dot_ = (1.0 - smoothstep(0.05, 0.12 + 0.04*open, d))*step(0.82, h)*open;
            totalEmissiveRadiance += vec3(2.4, 2.5, 2.7)*dot_;
            // and torn streaks of colour down it — magenta, cyan, orange — flickering, never where they were
            float sn = aNoise(vec3(vSP.x*38.0, vSP.y*1.6 - uT*0.9, vSP.z*38.0) + floor(uT*7.0)*3.1);
            float st = smoothstep(0.78, 0.88, sn)*1.6;
            float which = aHash(floor(vec3(vSP.x*38.0, uT*3.0, vSP.z*38.0)));
            vec3 sc = which < 0.4 ? vec3(2.2, 0.15, 1.4) : which < 0.75 ? vec3(0.1, 1.8, 2.2) : vec3(2.4, 0.8, 0.1);
            totalEmissiveRadiance += sc*st;
          }`); };
    skin.customProgramCacheKey = () => 'tshgoose';
    U.uAmp = { value:0.05 };
    const rig = { ready:false, bones:{}, rest:{} };
    goose().then(src=>{
      if(!src || !root.parent) return;
      const g = cloneSkinned(src); body.add(g);
      g.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = skin; }
        if(o.isBone){ rig.bones[o.name] = o; rig.rest[o.name] = o.quaternion.clone(); } });
      rig.ready = true;
    });
    const pose = (name, ax, ang) => { const b = rig.bones[name]; if(!b) return; b.quaternion.copy(rig.rest[name]).multiply(Q.setFromAxisAngle(ax, ang)); };
    /* ITS FACE: no features at all — just one white light where they should be (Alpha's), and below it, when it
       pulls, the hole */
    const head = new THREE.Group(); head.position.set(0, 4.7, 0.25); body.add(head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color:new THREE.Color(4, 4, 4.4) })); eye.position.set(0.0, 0.12, 0.3); head.add(eye);
    /* THE SCRIBBLES: where a face should be, and on its chest and its belly — white loops scrawled over and over,
       redrawn a few times a second so they boil like something drawn by a hand that will not stop */
    const scr = [0, 1, 2, 3, 4].map(()=>scribbleTex());
    const scribble = (parent, x, y, z, sz) => { const m = new THREE.SpriteMaterial({ map:scr[0], color:new THREE.Color(1.6, 1.6, 1.7), transparent:true, depthWrite:false });
      const sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.setScalar(sz); sp.userData.k = Math.random()*5; parent.add(sp); return sp; };
    const scribs = [scribble(head, 0, 0.1, 0.36, 1.05)];
    const torsoScr = [[-0.24, 0, 0.42], [0.26, 0.02, 0.42], [0.05, -0.75, 0.3]];
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:haloTex(), color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); halo.scale.setScalar(0.9); eye.add(halo);
    // lit in the colours it is full of, from both sides, so its shape shows against the dark: and nothing else in the station
    const rims = [[0xff2aa8, -4.5, 3.6, 3.4], [0x22e8ff, 4.5, 3.0, 2.8], [0xb06aff, 0, 7, -2.5]].map(([c, x, y, z])=>{ const l = new THREE.PointLight(c, 18, 18, 1.4); l.position.set(x, y, z); body.add(l); return l; });
    // out of its face, at whoever is in front of it: a hard light that throws their shadows long across the wet floor
    const spot = new THREE.SpotLight(0xffe8ff, 140, 40, 0.8, 0.45, 1.2); spot.position.set(0, 0.0, 0.45); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 40;
    const aim = new THREE.Object3D(); aim.position.set(0, -4.2, 11); head.add(aim); spot.target = aim; head.add(spot);
    const strobe = new THREE.PointLight(0xffffff, 0, 30, 1.2); strobe.position.set(0, 0, 0.4); head.add(strobe);
    // where its mouth would be, the hole — the colours of everything it is eating, wound round it, turning
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
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 1.2, 96, 3), swirl); vortex.add(ring);
    // what it is pulling in: bright bits, spiralling down into its mouth
    const NP = 700, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP*3), pc = new Float32Array(NP*3), pst = [];
    for(let i = 0; i < NP; i++){ pst.push({ r:1 + Math.random()*9, a:Math.random()*7, z:Math.random()*8 }); const c = new THREE.Color().setHSL(Math.random(), 1, 0.6); pc[i*3] = c.r*2; pc[i*3 + 1] = c.g*2; pc[i*3 + 2] = c.b*2; }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:0.09, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); vortex.add(pts);
    /* ITS ARMS: the blades rest on the floor in front of it; now and then one comes up and slams down, and a reach
       (at Robin, at Canon) lifts the nearer one at them and holds it there */
    /* THE LINES: black strands thrown out of it in every direction — out of its back, its arms, its head — curling,
       tangling, whipping, like the drawing is coming apart */
    const NL = 110, NPt = 22, strands = [];
    const ink = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), new THREE.MeshBasicMaterial({ color:0x010102 }), NL*(NPt - 1));
    ink.frustumCulled = false; ink.count = 0; body.add(ink);
    const UPv = new THREE.Vector3(0, 1, 0), SEG = new THREE.Vector3(), MID = new THREE.Vector3(), P0 = new THREE.Vector3();
    const ANCH = ['Chest', 'Chest', 'Spine', 'Spine', 'Head', 'Neck', 'UpperArm.L', 'UpperArm.R', 'Forearm.L', 'Forearm.R', 'Hips', 'Thigh.L', 'Thigh.R'];
    for(let i = 0; i < NL; i++){
      const th = Math.random()*Math.PI*2, ph = (Math.random() - 0.3)*Math.PI*0.9;
      strands.push({ th:0.012 + Math.random()*0.03, bone:ANCH[i % ANCH.length], dir:new THREE.Vector3(Math.cos(th)*Math.cos(ph), Math.sin(ph) + 0.25, Math.sin(th)*Math.cos(ph)).normalize(),
        len:2 + Math.random()*7, curl:2 + Math.random()*6, w:0.15 + Math.random()*0.6, sp:0.6 + Math.random()*2.2, ph:Math.random()*20 });
    }
    const AV = new THREE.Vector3(), PV = new THREE.Vector3(), SA = new THREE.Vector3(), SB = new THREE.Vector3();
    const arms = [-1, 1].map((s, i)=>({ s, side: s > 0 ? 'L' : 'R', tip:new THREE.Vector3(s*1.41, 0, 1.01), t:i*1.3 + 0.8, lift:0, slammed:false, reach:null, rk:0, hold:0 }));
    const M = { root, grow:0, pull:1, jaw:0, t:0, mouth:new THREE.Vector3(), eyeAt:new THREE.Vector3(), onSlam:null,
      /* the nearer blade, up at a point in the world */
      reach(at, secs){ const w = root.worldToLocal(at.clone());
        const arm = arms.find(a=>!a.reach && Math.sign(w.x || 1) === a.s) || arms.find(a=>!a.reach); if(!arm) return;
        arm.reach = w; arm.rk = 0; arm.hold = secs || 1.0; },
      tick(dt){
        M.t += dt; U.uT.value = M.t;
        const g = M.grow, e = g*g*(3 - 2*g);
        body.scale.setScalar(Math.max(0.001, e));
        body.position.y = Math.sin(M.t*1.1)*0.08*e;
        if(rig.ready){
          for(const n in rig.bones) rig.bones[n].quaternion.copy(rig.rest[n]);     // every frame from rest, so a jerk never sticks
          // it breathes: the spine rolling, the chest heaving; the head hunting side to side, pushed forward as it pulls
          const br = Math.sin(M.t*1.1);
          pose('Spine', X, br*0.05); pose('Chest', X, br*0.07 - M.pull*0.05);
          const hb = rig.bones.Head; if(hb){ hb.quaternion.copy(rig.rest.Head).multiply(Q.setFromEuler(new THREE.Euler(Math.sin(M.t*0.9)*0.12 - M.pull*0.15, 0, Math.sin(M.t*0.6)*0.35))); }
          pose('Neck', X, -0.1 - M.pull*0.12);
          arms.forEach(a=>{
            a.t -= dt;
            if(a.t <= 0 && !a.lift && !a.reach){ a.lift = 0.001; a.t = 2.2 + Math.random()*1.8; }
            let up = 0;
            if(a.lift){ a.lift += dt; const u = a.lift;
              up = u < 0.55 ? Math.sin(u/0.55*Math.PI/2) : u < 0.75 ? Math.cos((u - 0.55)/0.2*Math.PI/2) : 0;
              if(u >= 0.75 && !a.slammed){ a.slammed = true; if(M.onSlam) M.onSlam(root.localToWorld(a.tip.clone())); }
              if(u > 1.0){ a.lift = 0; a.slammed = false; } }
            if(a.reach){ a.rk = Math.min(1, a.rk + dt*4); a.hold -= dt; if(a.hold <= 0){ a.rk -= dt*8; if(a.rk <= 0){ a.reach = null; a.rk = 0; } } }
            // a reach: as high as the point is, out to it
            const rUp = a.reach ? Math.min(1.2, 0.35 + Math.max(0, a.reach.y)/4) : 0, rOut = a.reach ? Math.atan2(a.reach.x - a.s*1.4, Math.max(1, a.reach.z))*0.6 : 0;
            const lift = Math.max(up, a.rk*rUp);
            pose('UpperArm.' + a.side, X, -lift*1.25);
            const ub = rig.bones['UpperArm.' + a.side]; if(ub && a.rk) ub.quaternion.multiply(Q.setFromAxisAngle(Zv, rOut*a.rk));
            pose('Forearm.' + a.side, X, -lift*0.7);
            pose('Shoulder.' + a.side, Zv, a.s*lift*0.15);
          });
        }
        U.uAmp.value = 0.045 + 0.025*Math.sin(M.t*0.7) + M.pull*0.02;
        halo.material.opacity = 0.35 + 0.15*Math.sin(M.t*7);
        rims.forEach((l, i)=>{ l.intensity = (14 + 10*Math.sin(M.t*(2.1 + i) + i*2))*e; l.color.setHSL((M.t*0.11 + i*0.33) % 1, 1, 0.55); });
        spot.intensity = (90 + 60*Math.random()*M.pull*0.5)*e*(M.key === undefined ? 1 : M.key);   // M.key: a close-up can take the hard front light down
        spot.color.setHSL((0.85 + Math.sin(M.t*3)*0.1 + 1) % 1, 0.6, 0.7);
        strobe.intensity = Math.random() < 0.02*M.pull ? 240*e : strobe.intensity*0.8;
        vortex.rotation.z -= dt*1.6*M.pull; swirl.uniforms.uPull.value = M.pull; pts.material.opacity = Math.min(1, M.pull*1.5); pts.visible = M.pull > 0.02;
        for(let i = 0; i < NP; i++){ const s = pst[i]; s.a += dt*(1.5 + 6/s.r)*M.pull; s.r -= dt*(1.2 + 5/s.r)*M.pull; s.z -= dt*1.2*M.pull;
          if(s.r < 0.4 || s.z < 0){ s.r = 4 + Math.random()*8; s.z = 1 + Math.random()*8; }
          pp[i*3] = Math.cos(s.a)*s.r; pp[i*3 + 1] = Math.sin(s.a)*s.r; pp[i*3 + 2] = s.z*Math.min(1, s.r/3); }
        pg.attributes.position.needsUpdate = true;
        // it jerks: now and then a bone snaps somewhere else for a frame, and the whole of it skips
        if(rig.ready && Math.random() < 0.07){ const names = Object.keys(rig.bones), b = rig.bones[names[(Math.random()*names.length)|0]];
          if(b) b.quaternion.multiply(Q.setFromEuler(new THREE.Euler((Math.random() - 0.5)*0.5, (Math.random() - 0.5)*0.5, (Math.random() - 0.5)*0.5))); }
        body.position.x = Math.random() < 0.05 ? (Math.random() - 0.5)*0.12 : body.position.x*0.6;
        // the lines
        if(rig.ready){
          let si = 0;
          strands.forEach(st=>{ const b = rig.bones[st.bone]; if(!b) return;
            b.getWorldPosition(AV); body.worldToLocal(AV);
            const t = M.t*st.sp + st.ph, L = st.len*(0.75 + 0.25*Math.sin(t*0.7))*(1 + M.pull*0.3);
            SA.set(-st.dir.z, 0, st.dir.x).normalize(); SB.crossVectors(st.dir, SA);
            for(let j = 0; j < NPt; j++){ const u = j/(NPt - 1), r = st.w*u*(1 + Math.sin(t*1.3 + u*4));
              const c = u*st.curl*6.283 + t*2.0;
              PV.copy(AV).addScaledVector(st.dir, u*L).addScaledVector(SA, Math.cos(c)*r).addScaledVector(SB, Math.sin(c)*r*0.8);
              PV.y -= u*u*0.6;                                  // the long ones droop
              if(j){ SEG.subVectors(PV, P0); const len = SEG.length(); MID.addVectors(PV, P0).multiplyScalar(0.5);
                Q.setFromUnitVectors(UPv, SEG.multiplyScalar(1/Math.max(len, 1e-4))); const w = st.th*(1 - u*0.7);
                M4.compose(MID, Q, S1.set(w, len, w)); ink.setMatrixAt(si++, M4); }
              P0.copy(PV); } });
          ink.count = si; ink.instanceMatrix.needsUpdate = true;
          // the scribbles on its body ride the chest and the belly
          if(scribs.length === 1){ const ch = rig.bones.Chest, sp = rig.bones.Spine;
            torsoScr.forEach(([x, y, z], i)=>{ const s_ = scribble(body, 0, 0, 0, i === 2 ? 0.75 : 0.9); s_.userData.at = [x, y, z]; s_.userData.bone = i === 2 ? 'Spine' : 'Chest'; scribs.push(s_); }); }
          scribs.forEach((sp, i)=>{ if(i){ const b = rig.bones[sp.userData.bone]; b.getWorldPosition(V1); body.worldToLocal(V1); sp.position.copy(V1).add(SA.set(...sp.userData.at)); }
            sp.userData.k += dt*9; sp.material.map = scr[(sp.userData.k|0) % scr.length]; sp.material.rotation = Math.sin(M.t*0.5 + i)*0.4; });
        }
        // the face rides its head
        const hb = rig.bones.Head;
        if(hb){ hb.getWorldPosition(V1); body.worldToLocal(V1); head.position.lerp(V1.add(new THREE.Vector3(0, 0.22, -0.02)), 1); hb.getWorldQuaternion(Q); }
        vortex.getWorldPosition(M.mouth); eye.getWorldPosition(M.eyeAt);
      },
      dispose(){ if(root.parent) root.parent.remove(root); }
    };
    return M;
  }
  window.TSHMONSTER = { make:monster, preload:goose };
  return { apply };
})();
