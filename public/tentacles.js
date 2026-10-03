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
   ===================================================================== */
window.TENTACLES = (function(){
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SEG = 16;

  function material(){
    return {
      shell: new THREE.MeshStandardMaterial({ color:0x15171b, roughness:0.32, metalness:0.85 }),
      ring:  new THREE.MeshStandardMaterial({ color:0x2b2f36, roughness:0.25, metalness:0.95 }),
      eye:   new THREE.MeshBasicMaterial({ color:new THREE.Color(2.4, 0.5, 0.4) })      // a red light in each claw's palm
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
    return { segs, claw, fingers, pts, L, len, open:0.6 };
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
    for(let i = 0; i < n; i++){
      const s = A.segs[i], a = q[i], b = q[i + 1], d = b.clone().sub(a), l = d.length() || 1e-6;
      s.position.copy(a); s.quaternion.setFromUnitVectors(UP, d.divideScalar(l)); s.scale.set(1, l/A.L, 1);
    }
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
    const at = o.at || [0, floor, 0];
    const st = {
      body:V(at[0], floor + (o.lift === undefined ? 1.15 : o.lift), at[2]),   // her hips, held up off the roof
      goal:V(at[0], 0, at[2]), yaw:o.yaw || 0, speed:1.3, lift:o.lift === undefined ? 1.15 : o.lift,
      socketM:null, t:0, moving:false
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
      const swinging = legs.some(l=>l.to);
      st.body.y += ((floor + st.lift + (swinging ? 0.06 : 0) + Math.sin(st.t*1.3)*0.025) - st.body.y)*Math.min(1, dt*4);
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
        const target = k >= 2 ? legs[k - 2].at.clone().add(V(0, 0.04, 0)) : free[k].at;
        // the chain bows outward from her back before it turns down to the claw: start the solve from a bent guess
        const out = S[k].clone().sub(st.body).setY(0).normalize();
        A.pts.forEach((p, i)=>{ const kk = i/(A.pts.length - 1); p.copy(S[k]).lerp(target, kk).addScaledVector(out, Math.sin(kk*Math.PI)*0.9).add(V(0, Math.sin(kk*Math.PI)*0.5, 0)); });
        solve(A.pts, S[k], target, A.L);
        if(k >= 2) A.open = legs[k - 2].to ? 0.9 : 0.15;
        pose(A, k >= 2 ? 0.05 : 0.11, st.t, k*1.7);
      });
    }
    return {
      root, arms,
      socket(fn){ socketFn = fn; },
      to(x, z, speed){ st.goal.set(x, 0, z); if(speed) st.speed = speed; },
      place(x, z, yaw){ st.body.set(x, floor + st.lift, z); st.goal.set(x, 0, z); if(yaw !== undefined) st.yaw = yaw; legs.forEach(l=>{ l.at.copy(stance(l.k, st.yaw)); l.to = null; }); free.forEach(f=>f.at.set(0, 0, 0)); },
      lift(h){ st.lift = h; },
      get body(){ return st.body; }, get yaw(){ return st.yaw; }, get moving(){ return st.moving; },
      update,
      dispose(){ if(root.parent) root.parent.remove(root); }
    };
  }
  return { make };
})();
