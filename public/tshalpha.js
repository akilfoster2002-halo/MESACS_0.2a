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
  function monster(group, at, yaw){
    const root = new THREE.Group(); root.position.set(at[0], 0, at[2]); root.rotation.y = yaw || 0; group.add(root);
    const body = new THREE.Group(); root.add(body);
    // lit from both sides in the colours it is full of, so its shape shows against the dark: magenta one side, cyan the other
    const rims = [[0xff2aa8, -4, 3.2, 3.2], [0x22e8ff, 4, 2.6, 2.6], [0xb06aff, 0, 6, -2]].map(([c, x, y, z])=>{ const l = new THREE.PointLight(c, 18, 18, 1.4); l.position.set(x, y, z); body.add(l); return l; });
    // out of its mouth, at whoever is in front of it: a hard light that throws their shadows long across the wet floor behind them
    const spot = new THREE.SpotLight(0xffe8ff, 140, 40, 0.75, 0.45, 1.2); spot.position.set(0, 2.3, 2.4); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 40;
    const aim = new THREE.Object3D(); aim.position.set(0, 0.6, 12); body.add(aim); spot.target = aim; body.add(spot);
    // and now and then, from inside it, a strobe: everything white for a frame
    const strobe = new THREE.PointLight(0xffffff, 0, 30, 1.2); strobe.position.set(0, 3, 3.5); body.add(strobe);
    const U = { uT:{ value:0 }, uAmp:{ value:0.45 } };
    const skin = new THREE.MeshStandardMaterial({ color:0x030305, roughness:0.07, metalness:0.4 });
    skin.onBeforeCompile = sh=>{ Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uAmp;' + NOISE)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float nn = aNoise(position*1.7 + vec3(0.0, uT*1.1, uT*0.5)) + 0.6*aNoise(position*3.6 - vec3(uT*1.6));
          transformed += normal*(nn - 0.8)*uAmp;`); };
    skin.customProgramCacheKey = () => 'tshmonster';
    // the mass: a heaving body, shoulders, a hunch
    const lobes = [[0, 2.5, 0, 2.5, 2.8, 2.2], [-1.9, 3.3, -0.3, 1.5, 1.6, 1.4], [1.9, 3.1, -0.2, 1.6, 1.5, 1.4], [0, 4.3, -0.6, 1.4, 1.2, 1.3], [0, 0.9, 0.2, 2.6, 1.0, 2.2]];
    lobes.forEach(([x, y, z, sx, sy, sz])=>{ const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 5), skin); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; body.add(m); });
    // the pale lights in it
    const NN = 70, nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color:new THREE.Color(2.4, 2.5, 2.7) }), NN);
    const nodeAt = [], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3(), S1 = new THREE.Vector3();
    for(let i = 0; i < NN; i++){ const L = lobes[i % 4], d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random()*0.8 + 0.2).normalize();
      nodeAt.push({ p:new THREE.Vector3(L[0] + d.x*L[3]*0.92, L[1] + d.y*L[4]*0.92, L[2] + d.z*L[5]*0.92), ph:Math.random()*7, s:0.6 + Math.random()*1.2 }); }
    body.add(nodes);
    // the eye
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshBasicMaterial({ color:new THREE.Color(4, 4, 4.4) })); eye.position.set(0.5, 4.5, 0.75); body.add(eye);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:haloTex(), color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); halo.scale.setScalar(2.6); eye.add(halo);
    // the hole in its front, and the colours wound round it
    const vortex = new THREE.Group(); vortex.position.set(0, 2.3, 2.25); body.add(vortex);
    const swirl = new THREE.ShaderMaterial({ uniforms:{ uT:U.uT, uPull:{ value:1 } }, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader:`varying vec2 vP; uniform float uT, uPull;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){ float r = length(vP), a = atan(vP.y, vP.x);
          float arms = 0.5 + 0.5*sin(a*5.0 + log(max(r, 0.01))*10.0 + uT*7.0*uPull);
          float band = smoothstep(0.95, 1.25, r)*(1.0 - smoothstep(2.0, 2.9, r));
          vec3 c = hue(a/6.2831 + r*0.25 - uT*0.3)*pow(arms, 2.0)*band*2.2;
          c += vec3(1.6, 1.5, 1.8)*(smoothstep(0.92, 1.0, r) - smoothstep(1.0, 1.1, r));        // the edge of it: white
          gl_FragColor = vec4(c, max(max(c.r, c.g), c.b)); }` });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 2.9, 128, 4), swirl); vortex.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.MeshBasicMaterial({ color:0x000000 })); hole.position.z = 0.02; vortex.add(hole);
    // what it is pulling in: bright bits, spiralling down into the hole
    const NP = 700, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP*3), pc = new Float32Array(NP*3), pst = [];
    for(let i = 0; i < NP; i++){ pst.push({ r:1 + Math.random()*9, a:Math.random()*7, z:Math.random()*8 }); const c = new THREE.Color().setHSL(Math.random(), 1, 0.6); pc[i*3] = c.r*2; pc[i*3 + 1] = c.g*2; pc[i*3 + 2] = c.b*2; }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:0.09, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); vortex.add(pts);
    // the tendrils: chains of it, whipping out across the station
    const NT = 10, SEGS = 18, tend = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), skin, NT*SEGS);
    const T = []; for(let i = 0; i < NT; i++){ const a = (i/NT)*Math.PI*2 + Math.random()*0.4;
      T.push({ base:new THREE.Vector3(Math.sin(a)*1.8, 1.2 + Math.random()*2.6, Math.cos(a)*1.6), dir:new THREE.Vector3(Math.sin(a), 0.15 + Math.random()*0.5 - 0.2, Math.cos(a)).normalize(), len:4 + Math.random()*4, ph:Math.random()*7, reach:null, rk:0 }); }
    tend.castShadow = true; body.add(tend);
    const M = { root, grow:0, pull:1, t:0, mouth:new THREE.Vector3(),
      /* a tendril (the nearest free one) out to a point in the world, for a moment */
      reach(at, secs){ const w = root.worldToLocal(at.clone()); let best = null, bd = 1e9;
        T.forEach(tt=>{ if(tt.reach) return; const d = tt.base.distanceTo(w); if(d < bd){ bd = d; best = tt; } });
        if(best){ best.reach = w; best.rk = 0; best.hold = secs || 1.2; } },
      tick(dt){
        M.t += dt; U.uT.value = M.t;
        const g = M.grow, e = g*g*(3 - 2*g);
        body.scale.setScalar(Math.max(0.001, e)); body.position.y = Math.sin(M.t*1.3)*0.12*e;
        U.uAmp.value = 0.35 + 0.25*Math.sin(M.t*0.7) + (Math.random() < 0.05 ? 0.4 : 0);
        nodeAt.forEach((n, i)=>{ const k = Math.max(0, Math.sin(M.t*n.s*2 + n.ph)); S1.setScalar(0.3 + k*1.4); M4.compose(n.p, Q, S1); nodes.setMatrixAt(i, M4); }); nodes.instanceMatrix.needsUpdate = true;
        halo.material.opacity = 0.7 + 0.3*Math.sin(M.t*11);
        // the light in it: the rims breathe in colour, the mouth's light flickers with what it is eating, and the strobe
        rims.forEach((l, i)=>{ l.intensity = (14 + 10*Math.sin(M.t*(2.1 + i) + i*2))*e; l.color.setHSL((M.t*0.11 + i*0.33) % 1, 1, 0.55); });
        spot.intensity = (90 + 80*Math.random()*M.pull)*e; spot.color.setHSL((0.85 + Math.sin(M.t*3)*0.1 + 1) % 1, 0.6, 0.7);
        strobe.intensity = Math.random() < 0.035*M.pull ? 260*e : strobe.intensity*0.6;
        vortex.rotation.z -= dt*1.6*M.pull; swirl.uniforms.uPull.value = M.pull;
        // the bits, spiralling in
        for(let i = 0; i < NP; i++){ const s = pst[i]; s.a += dt*(1.5 + 6/s.r)*M.pull; s.r -= dt*(1.2 + 5/s.r)*M.pull; s.z -= dt*1.2*M.pull;
          if(s.r < 0.9 || s.z < 0){ s.r = 4 + Math.random()*8; s.z = 1 + Math.random()*8; }
          pp[i*3] = Math.cos(s.a)*s.r; pp[i*3 + 1] = Math.sin(s.a)*s.r; pp[i*3 + 2] = s.z*Math.min(1, s.r/3); }
        pg.attributes.position.needsUpdate = true;
        // the tendrils
        let k = 0;
        T.forEach((tt, ti)=>{
          if(tt.reach){ tt.rk = Math.min(1, tt.rk + dt*3); tt.hold -= dt; if(tt.hold <= 0){ tt.rk -= dt*6; if(tt.rk <= 0){ tt.reach = null; tt.rk = 0; } } }
          const tip = tt.base.clone().addScaledVector(tt.dir, tt.len*(0.75 + 0.25*Math.sin(M.t*0.9 + tt.ph)));
          if(tt.reach) tip.lerp(tt.reach, tt.rk);
          const side = new THREE.Vector3(0, 1, 0).cross(tt.dir).normalize();
          for(let j = 0; j < SEGS; j++){ const s = j/(SEGS - 1);
            V1.copy(tt.base).lerp(tip, s).addScaledVector(side, Math.sin(s*6 - M.t*3.4 + tt.ph)*0.7*s*(1 - tt.rk*0.7)).add(new THREE.Vector3(0, Math.sin(s*Math.PI)*0.6 + Math.cos(s*5 - M.t*2.6 + tt.ph)*0.4*s, 0));
            S1.setScalar(0.42*(1 - s) + 0.07); M4.compose(V1, Q, S1); tend.setMatrixAt(k++, M4); } });
        tend.instanceMatrix.needsUpdate = true;
        vortex.getWorldPosition(M.mouth);
      },
      dispose(){ if(root.parent) root.parent.remove(root); }
    };
    return M;
  }
  window.TSHMONSTER = { make:monster };
  return { apply };
})();
