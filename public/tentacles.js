/* =====================================================================
   TENTACLES — four mechanical arms out of somebody's back, and they do the
   walking (TSH: Maya, on the roof at the end of the prologue; after Doctor
   Octopus).

   AN ARM IS A SNAKE. Each one is a chain of short metal segments, ringed at
   the joints, a three-fingered claw at the end. Every frame its joints are
   solved from the socket on her back to where its claw wants to be (FABRIK:
   pull the chain to the target, then back to the socket, a few times), and a
   ripple runs down it — a wave across the chain that is zero at both ends, so
   the socket and the claw stay put while everything between them moves like
   something alive.

   THE ARMS CARRY HER. She does not walk: her feet hang off the roof. The two
   lower arms are legs — each claw is planted on the floor until her body has
   moved far enough from it, then it lifts, swings over in an arc and plants
   again ahead of her, one at a time. The two upper arms coil and reach
   about her (or plant too, when she moves fast). Whoever owns the scene says
   where she should be (to()), and reads back where the arms have her (body).

     const oc = TENTACLES.make(group, { floor:12, at:[x, y, z] });
     oc.socket(()=>matrix4)   // her back, each frame (her Spine2 bone's world matrix)
     oc.to(x, z)              // where to carry her
     oc.update(dt)            // then: her root = oc.body

   THEY CAN BE KEPT IN. hide() puts all four away inside her back (she stands
   on her own feet); burst(k, at, o) throws arm k out of her — fast, past its
   length and back, whipping — to a point (in her frame: x right, y up from her
   hips, z ahead; or o.world), where it holds, twitching like an insect, for
   o.hold seconds before it goes back to carrying her. A leg's burst stabs the
   roof (o.floor) and stays planted there.

   THE ARMS THEMSELVES (tsh/maya/mecharm.glb): Doctor Octopus's mechanical arm, from a Maya rig — nineteen
   linked segments and a three-fingered claw, skinned to a chain of joints. The solve above places the joints:
   each link follows the curve the arm is bent into (carried along it, so the links never twist round), the claw
   sits on the end and its fingers open and close. Until it has loaded, an arm is drawn as plain rings.
   ===================================================================== */
window.TENTACLES = (function(){
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SEG = 19;                                       // the Doc Ock arm has nineteen joints along it
  const MODEL = 'tsh/maya/mecharm.glb';
  const CHAIN = Array.from({ length:19 }, (_, i)=>'MechArm' + (i ? i : ''));
  const FINGERS = ['Claw1', 'Claw7', 'Claw4'];

  function material(){
    return {
      shell: new THREE.MeshStandardMaterial({ color:0x15171b, roughness:0.32, metalness:0.85 }),
      ring:  new THREE.MeshStandardMaterial({ color:0x2b2f36, roughness:0.25, metalness:0.95 }),
      eye:   new THREE.MeshBasicMaterial({ color:new THREE.Color(2.4, 0.5, 0.4) })      // a red light in each claw's palm (flares as an arm comes out)
    };
  }

  /* one arm: segments that taper from the socket to the claw */
  function arm(group, M, len, r0, r1){
    const segs = [], L = len/SEG;
    for(let i = 0; i < SEG; i++){
      const r = r0 + (r1 - r0)*i/(SEG - 1);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r*0.92, r, L*0.92, 10), M.shell); body.position.y = L/2; g.add(body);
      if(i % 2 === 0){ const ring = new THREE.Mesh(new THREE.TorusGeometry(r*1.05, r*0.22, 6, 14), M.ring); ring.rotation.x = Math.PI/2; g.add(ring); }
      body.castShadow = true; group.add(g); segs.push(g);
    }
    // the claw: a palm with a light in it and three fingers that open and close
    const claw = new THREE.Group(), fingers = [];
    const palm = new THREE.Mesh(new THREE.CylinderGeometry(r1*1.5, r1*1.1, r1*2.2, 10), M.ring); palm.position.y = r1*1.1; claw.add(palm);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r1*0.55, 8, 6), M.eye); eye.position.y = r1*2.25; claw.add(eye);
    for(let k = 0; k < 3; k++){
      const f = new THREE.Group(); f.rotation.y = k*Math.PI*2/3; f.position.y = r1*2;
      const pivot = new THREE.Group(); pivot.position.x = r1*1.2; f.add(pivot);
      const a = new THREE.Mesh(new THREE.BoxGeometry(r1*0.5, r1*3.2, r1*0.6), M.shell); a.position.y = r1*1.5; pivot.add(a);
      const b = new THREE.Mesh(new THREE.BoxGeometry(r1*0.4, r1*2.4, r1*0.5), M.ring); b.position.set(-r1*0.35, r1*3.6, 0); b.rotation.z = 0.5; pivot.add(b);
      claw.add(f); fingers.push(pivot);
    }
    group.add(claw);
    const pts = []; for(let i = 0; i <= SEG; i++) pts.push(V(0, 0, 0));
    return { segs, claw, fingers, pts, L, len, open:0.6, ext:1, out:null };
  }

  /* the modelled arm, loaded into an arm (each its own copy: this build of three cannot clone a skinned mesh) */
  function dress(A, root){
    if(!THREE.GLTFLoader) return;
    const ld = new THREE.GLTFLoader(); if(window.MeshoptDecoder && ld.setMeshoptDecoder) ld.setMeshoptDecoder(window.MeshoptDecoder);
    ld.load(MODEL + '?v=' + (window.ASSETV || '1'), g=>{
      if(A.dead) return;
      const sc = g.scene, by = {};
      sc.traverse(o=>{ if(o.isBone) by[o.name] = o; if(o.isMesh){ o.frustumCulled = false; o.castShadow = true;
        [].concat(o.material).forEach(m=>{ if(m.emissive) m.emissiveIntensity = 1.6; }); } });
      const chain = CHAIN.map(n=>by[n]), claw = by.ClawBase, fingers = FINGERS.map(n=>by[n]);
      if(chain.some(b=>!b) || !claw) return;
      sc.updateMatrixWorld(true);
      const head = b => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
      const H = chain.map(head).concat([head(claw)]);
      let rest = 0; for(let i = 0; i < 19; i++) rest += H[i + 1].distanceTo(H[i]);
      const restQ = new THREE.Quaternion(); chain[0].getWorldQuaternion(restQ);
      const restDir = H[1].clone().sub(H[0]).normalize();
      // each finger opens about the line across its root, away from the claw's axis: which way is out is where
      // the finger's own metal is (its joints all start at the middle of the claw)
      let skin = null; sc.traverse(o=>{ if(o.isSkinnedMesh) skin = o; });
      const out = fingers.map(()=>V(0, 0, 0));
      if(skin){ const G = skin.geometry, P = G.attributes.position, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, bones = skin.skeleton.bones;
        const inv = skin.skeleton.boneInverses[bones.indexOf(claw)], v = V(0, 0, 0);
        fingers.forEach((f, k)=>{ if(!f) return; const mine = [bones.indexOf(f)].concat(f.children.filter(c=>c.isBone).map(c=>bones.indexOf(c)));
          for(let i = 0; i < P.count; i++){ let w = 0; for(let j = 0; j < 4; j++) if(mine.includes(SI.getComponent(i, j))) w += SW.getComponent(i, j);
            if(w > 0.5){ v.fromBufferAttribute(P, i).applyMatrix4(skin.bindMatrix).applyMatrix4(inv); out[k].add(V(v.x, 0, v.z)); } } }); }
      const fin = fingers.map((f, k)=>{ if(!f) return null; const o = out[k].lengthSq() > 1e-10 ? out[k].normalize() : V(Math.cos(k*2.09), 0, Math.sin(k*2.09));
        // the hinge, in the finger's own frame (its rest turn relative to the claw)
        const axis = V(0, 1, 0).cross(o).normalize().applyQuaternion(f.quaternion.clone().invert());
        return { b:f, q0:f.quaternion.clone(), axis }; }).filter(Boolean);
      // the armature's own place in the file, so bones can be set from where they should be in the arm's space
      const rigM = chain[0].parent.matrixWorld.clone();
      root.add(sc); sc.matrixAutoUpdate = false; sc.matrix.identity(); sc.updateMatrixWorld(true);
      A.model = { sc, chain, claw, fin, rest, restQ, restDir, rigM };
      A.segs.forEach(x=>x.visible = false); A.claw.visible = false;
    }, undefined, ()=>{});
  }
  const _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), _s = V(1, 1, 1), _q = new THREE.Quaternion(), _d = V(0, 0, 0), _t = new THREE.Quaternion();
  /* the joints onto the solved points: q[0..19], the last the claw */
  function poseModel(A, q){
    const M = A.model; let len = 0; for(let i = 0; i < 19; i++) len += q[i + 1].distanceTo(q[i]);
    const s = len/M.rest; _s.set(s, s, s);
    let parent = M.rigM, prevD = null;
    for(let i = 0; i <= 19; i++){
      const b = i < 19 ? M.chain[i] : M.claw;
      if(i < 19){ _d.copy(q[i + 1]).sub(q[i]); const l = _d.length() || 1e-6; _d.divideScalar(l);
        if(!prevD) _q.setFromUnitVectors(M.restDir, _d).multiply(M.restQ);       // the first link: turned from how it lay
        else { _t.setFromUnitVectors(prevD, _d); _q.premultiply(_t); }           // each next: carried on from the one before
        prevD = (prevD || V(0, 0, 0)).copy(_d); }
      _m.compose(q[i], _q, _s);
      _p.copy(parent).invert().multiply(_m);
      _p.decompose(b.position, b.quaternion, b.scale);
      parent = _m.clone();
    }
    // the claw's fingers: open, closed
    M.fin.forEach(f=>{ _t.setFromAxisAngle(f.axis, A.open*0.8); f.b.quaternion.copy(f.q0).multiply(_t); });
  }

  /* FABRIK: the chain from base to target, segment lengths kept */
  function solve(pts, base, target, L){
    const n = pts.length - 1, total = L*n;
    if(base.distanceTo(target) >= total*0.995){
      const dir = target.clone().sub(base).normalize();
      for(let i = 0; i <= n; i++) pts[i].copy(base).addScaledVector(dir, L*i);
      return;
    }
    for(let it = 0; it < 6; it++){
      pts[n].copy(target);
      for(let i = n - 1; i >= 0; i--){ const d = pts[i].clone().sub(pts[i + 1]).normalize(); pts[i].copy(pts[i + 1]).addScaledVector(d, L); }
      pts[0].copy(base);
      for(let i = 1; i <= n; i++){ const d = pts[i].clone().sub(pts[i - 1]).normalize(); pts[i].copy(pts[i - 1]).addScaledVector(d, L); }
    }
  }

  const UP = V(0, 1, 0);
  function pose(A, wave, t, phase){
    const p = A.pts, n = p.length - 1;
    // the ripple: across the chain, zero at the socket and at the claw
    const along = p[n].clone().sub(p[0]); const len = along.length() || 1; along.divideScalar(len);
    let side = along.clone().cross(UP); if(side.lengthSq() < 1e-4) side = V(1, 0, 0); side.normalize();
    const lift = side.clone().cross(along).normalize();
    const q = p.map((v, i)=>{ const k = i/n, env = Math.sin(k*Math.PI);
      const w = Math.sin(k*Math.PI*2.2 - t*3.1 + phase)*wave*env, w2 = Math.cos(k*Math.PI*1.6 - t*2.3 + phase)*wave*0.6*env;
      return v.clone().addScaledVector(side, w).addScaledVector(lift, w2); });
    for(let i = 0; i < n && !A.model; i++){
      const s = A.segs[i], a = q[i], b = q[i + 1], d = b.clone().sub(a), l = d.length() || 1e-6;
      s.position.copy(a); s.quaternion.setFromUnitVectors(UP, d.divideScalar(l)); s.scale.set(1, Math.max(1e-3, l/A.L), 1);
    }
    if(A.model) return poseModel(A, q);
    const tip = q[n], last = q[n].clone().sub(q[n - 1]).normalize();
    A.claw.position.copy(tip); A.claw.quaternion.setFromUnitVectors(UP, last);
    A.fingers.forEach(f=>{ f.rotation.z = -0.25 - A.open*0.7; });
  }

  function make(group, o){
    o = o || {};
    const M = material(), floor = o.floor || 0;
    const root = new THREE.Group(); group.add(root);
    // sockets on her back: two high (between the shoulder blades), two low (above the hips), in her back's own frame
    const SOCK = [V(-0.09, 0.12, -0.13), V(0.09, 0.12, -0.13), V(-0.08, -0.12, -0.12), V(0.08, -0.12, -0.12)];
    const arms = [arm(root, M, 2.9, 0.075, 0.04), arm(root, M, 2.9, 0.075, 0.04), arm(root, M, 2.6, 0.085, 0.045), arm(root, M, 2.6, 0.085, 0.045)];
    arms.forEach(A=>dress(A, root));
    const at = o.at || [0, floor, 0];
    const st = {
      body:V(at[0], floor + (o.lift === undefined ? 1.15 : o.lift), at[2]),   // her hips, held up off the roof
      goal:V(at[0], 0, at[2]), yaw:o.yaw || 0, speed:1.3, lift:o.lift === undefined ? 1.15 : o.lift,
      socketM:null, t:0, moving:false, flare:0
    };
    // where the legs stand when she is still: out to her sides and a little behind
    const stance = (k, yaw) => { const side = k === 2 ? -1 : 1, a = yaw + side*1.9; return V(st.body.x + Math.sin(a)*1.25, floor, st.body.z + Math.cos(a)*1.25); };
    const legs = [2, 3].map(k=>({ k, at:stance(k, st.yaw), from:null, to:null, t:0 }));
    // the upper arms, free: each drifts between points around her, now and then reaching out and opening its claw
    const free = [0, 1].map(k=>({ k, at:V(0, 0, 0), want:V(0, 0, 0), next:0 }));
    let socketFn = null;

    function sockets(){
      const m = socketFn && socketFn();
      if(m){ return SOCK.map(s=>s.clone().applyMatrix4(m)); }
      return SOCK.map(s=>V(st.body.x + s.x, st.body.y + 0.35 + s.y, st.body.z + s.z));
    }
    function update(dt){
      st.t += dt;
      // carried: her body goes toward the goal at the arms' pace, bobbing with each step
      const to = V(st.goal.x - st.body.x, 0, st.goal.z - st.body.z), dist = to.length();
      st.moving = dist > 0.08;
      if(st.moving){ const step = Math.min(dist, st.speed*dt); st.body.addScaledVector(to.normalize(), step); st.yaw += Math.atan2(Math.sin(Math.atan2(to.x, to.z) - st.yaw), Math.cos(Math.atan2(to.x, to.z) - st.yaw))*Math.min(1, dt*3); }
      const swinging = legs.some(l=>l.to), held = arms.some(A=>A.ext > 0.5);
      st.body.y += ((floor + st.lift + (held ? (swinging ? 0.06 : 0) + Math.sin(st.t*1.3)*0.025 : 0)) - st.body.y)*Math.min(1, dt*(held ? 4 : 8));
      if(st.flare > 0){ st.flare = Math.max(0, st.flare - dt*1.6); M.eye.color.setRGB(2.4 + st.flare*5, 0.5 + st.flare*0.6, 0.4 + st.flare*0.4); }
      // the legs: a claw planted until her body is a stride from where it would stand, then one step, one leg at a time
      legs.forEach(l=>{
        const home = stance(l.k, st.yaw);
        if(l.to){ l.t += dt/0.42; const k = Math.min(1, l.t); l.at.lerpVectors(l.from, l.to, k); l.at.y = floor + Math.sin(k*Math.PI)*0.55;
          if(k >= 1){ l.at.copy(l.to); l.to = null; } }
        else if(home.distanceTo(l.at) > (st.moving ? 0.55 : 0.9) && !legs.some(m=>m !== l && m.to)){
          l.from = l.at.clone(); l.to = home.clone().add(to.lengthSq() > 0 ? to.clone().normalize().multiplyScalar(0.35) : V(0, 0, 0)); l.t = 0; }
      });
      // the upper arms: drift, reach
      free.forEach((f, i)=>{
        f.next -= dt;
        if(f.next <= 0){ const side = i === 0 ? -1 : 1, a = st.yaw + side*(1.1 + Math.random()*0.9);
          f.want = V(st.body.x + Math.sin(a)*(1.1 + Math.random()*0.7), st.body.y + 0.6 + Math.random()*1.1, st.body.z + Math.cos(a)*(1.1 + Math.random()*0.7));
          f.next = 1.6 + Math.random()*2.2; }
        if(!f.at.lengthSq()) f.at.copy(f.want);
        f.at.lerp(f.want, Math.min(1, dt*1.6));
        arms[f.k].open = 0.35 + 0.35*Math.sin(st.t*1.7 + i*2);
      });
      // solve and draw every arm from its socket
      const S = sockets();
      arms.forEach((A, k)=>{
        let target = k >= 2 ? legs[k - 2].at.clone().add(V(0, 0.04, 0)) : free[k].at, wave = k >= 2 ? 0.05 : 0.11;
        const B = A.out;
        if(B){
          // coming out: past its full length in a sixth of a second, then ringing back to it
          B.t += dt; const u = B.t - B.wait;
          if(u < 0) A.ext = B.from;
          else A.ext = u < 0.16 ? B.from + (1.14 - B.from)*(1 - Math.pow(1 - u/0.16, 3)) : 1 + 0.14*Math.exp(-(u - 0.16)*7)*Math.cos((u - 0.16)*24);
          if(u >= 0 && !B.lit){ B.lit = true; st.flare = 1; }
          // where it strikes, and it holds there — never quite still
          const at = B.world ? B.world.clone() : place(B.at, B.floor);
          if(!B.floor){ B.jt -= dt; if(B.jt <= 0){ B.jt = 0.05 + Math.random()*0.09; B.jit.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.16); } at.add(B.jit); }
          target = at; wave += 0.32*Math.exp(-Math.max(0, u)*2.4);
          A.open = u < 0 ? 0 : u < B.hold - 0.12 ? 1 : 0.05;
          if(u >= B.hold){ A.out = null; A.ext = 1;
            if(k >= 2){ const l = legs[k - 2]; l.at.copy(at); l.at.y = floor; l.to = null; } else free[k].at.copy(at); }
        }
        if(A.ext < 0.02){ A.segs.forEach(s=>s.visible = false); A.claw.visible = false; if(A.model) A.model.sc.visible = false; return; }
        if(A.model) A.model.sc.visible = true; else { A.segs.forEach(s=>s.visible = true); A.claw.visible = true; }
        // the chain bows outward from her back before it turns down to the claw: start the solve from a bent guess
        const out = S[k].clone().sub(st.body).setY(0).normalize();
        A.pts.forEach((p, i)=>{ const kk = i/(A.pts.length - 1); p.copy(S[k]).lerp(target, kk).addScaledVector(out, Math.sin(kk*Math.PI)*0.9).add(V(0, Math.sin(kk*Math.PI)*0.5, 0)); });
        solve(A.pts, S[k], target, A.L*A.ext);
        if(k >= 2 && !B) A.open = legs[k - 2].to ? 0.9 : 0.15;
        pose(A, wave*Math.min(1, A.ext), st.t, k*1.7);
      });
    }
    // a point in her frame (x right, y up from her hips, z ahead) in the world; on the floor if it is a stab
    function place(p, onFloor){
      const s = Math.sin(st.yaw), c = Math.cos(st.yaw);
      return V(st.body.x + p[0]*-c + p[2]*s, onFloor ? floor : st.body.y + p[1], st.body.z + p[0]*s + p[2]*c);
    }
    return {
      root, arms,
      socket(fn){ socketFn = fn; },
      to(x, z, speed){ st.goal.set(x, 0, z); if(speed) st.speed = speed; },
      place(x, z, yaw){ st.body.set(x, floor + st.lift, z); st.goal.set(x, 0, z); if(yaw !== undefined) st.yaw = yaw; legs.forEach(l=>{ l.at.copy(stance(l.k, st.yaw)); l.to = null; }); free.forEach(f=>f.at.set(0, 0, 0)); },
      lift(h){ st.lift = h; },
      hide(){ arms.forEach(A=>{ A.ext = 0; A.out = null; }); },
      burst(k, at, o){ o = o || {}; const A = arms[k];
        A.out = { t:0, wait:o.wait || 0, from:A.ext, at, world:o.world ? V(o.world[0], o.world[1], o.world[2]) : null, floor:!!o.floor, hold:o.hold || 1.2, jit:V(0, 0, 0), jt:0, lit:false }; },
      out(k){ return arms[k].ext > 0.02; },
      get body(){ return st.body; }, get yaw(){ return st.yaw; }, get moving(){ return st.moving; },
      update,
      dispose(){ arms.forEach(A=>{ A.dead = true; }); if(root.parent) root.parent.remove(root); }
    };
  }
  return { make };
})();
