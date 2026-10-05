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
  return { apply };
})();
