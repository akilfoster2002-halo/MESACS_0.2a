/* =====================================================================
   TSH — THE LAB (Room 120), drawn the way the film would draw it: a
   school robotics room somebody turned into a place where a few
   centimetres of Psi Energy are held in the air — dark, saturated,
   violet and magenta and cyan, inked, and busy with everything a real
   lab collects.

   THE FIELD. Not a glowing ball: a core of plasma (a shader — layered
   noise swirling through it, white-hot in the middle, magenta, violet,
   cyan at the rim, and the black blots of Kirby krackle boiling up in
   it), outlined in ink; a crystal lattice turning inside it; glow
   shells; a swarm of krackle dots orbiting it; lightning arcing to the
   coils, re-drawn twenty times a second; shockwave rings; a comic
   starburst behind it; a glass containment cylinder with a scan
   running up it; emitters above and below with beams into it; a focus
   ring hung from the ceiling; a tiered dais with vents. Its light is a
   real light, and it flickers with it.

   THE ROOM. Dark acoustic cladding with neon seams; an epoxy floor,
   painted (walkways, the hazard circle, stencils) and polished enough to
   mirror the field (TSHLOOK's wet floor); trusses, cable trays, ducts
   and cables overhead; the blinds down, light coming through them in
   shafts with dust in it; a hologram table turning the prototype's
   schematic; the window bench (printers, a microscope, parts, laptops,
   mugs); the tool wall; racks; the physics bench (scopes, a Tesla coil,
   canisters); signage, coats, an eyewash, an E-stop; cables everywhere.

   THE PROTOTYPE. Capsule limbs, glowing actuator rings, a visor.

   The look is finished by TSHLOOK's comic pass (ink lines, halftone,
   hatching, misregistered colour), which tshschool turns up while the
   camera is in here.

     const lab = TSHLAB.build(ctx)       // in tshschool's build()
     lab.tick(dt, robotUserData)         // every frame the school is shown
   ===================================================================== */
window.TSHLAB = (function(){
  const V3 = THREE.Vector3;
  const std = o => new THREE.MeshStandardMaterial(o);
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color:new THREE.Color(r, g, b) });   // brighter than white: it blooms
  const addv = (col, op) => new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:op === undefined ? 1 : op, blending:THREE.AdditiveBlending, depthWrite:false });
  const font = (px, w) => (w || 'bold ') + px + 'px ' + (window.uiFont ? uiFont() : 'sans-serif');
  function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, rep){ const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if(rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
  const rnd = (a, b) => a + Math.random()*(b - a);
  let seed = 7; const srnd = () => { seed = (seed*16807) % 2147483647; return (seed - 1)/2147483646; };

  /* ================================================================ SHADERS */
  const NOISE = `
    float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
    float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.03 + 1.7; a *= 0.5; } return s; }`;
  const VFRES = `varying vec3 vN, vV, vP; varying vec2 vUv;
    void main(){ vUv = uv; vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
  // the core: plasma swirling, banded the way a comic colours it, and the krackle's black blots boiling up through it
  function coreMat(){
    return new THREE.ShaderMaterial({ uniforms:{ uT:{ value:0 }, uPulse:{ value:0 } }, vertexShader:VFRES, fragmentShader:NOISE + `
      uniform float uT, uPulse; varying vec3 vN, vV, vP;
      void main(){
        float ndv = abs(dot(normalize(vN), normalize(vV))), rim = 1.0 - ndv;
        vec3 p = vP*4.2; float a = uT*0.9 + p.y*0.6; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a))*p.xz;
        float n = fbm(p + vec3(0.0, -uT*1.3, uT*0.4));
        float band = smoothstep(0.47, 0.5, fract(n*3.0 - uT*0.35));
        vec3 hot = vec3(1.25, 0.85, 1.3), mag = vec3(1.5, 0.12, 1.0), vio = vec3(0.45, 0.12, 1.4), cy = vec3(0.15, 1.2, 1.6);
        vec3 col = mix(hot, mag, smoothstep(0.0, 0.45, rim + n*0.5 - 0.15));
        col = mix(col, vio, smoothstep(0.55, 0.95, rim));
        col = mix(col, cy, band*0.45*(1.0 - rim));
        col *= 0.55 + uPulse*0.4;
        float blot = smoothstep(0.66, 0.7, fbm(p*1.6 + vec3(uT*0.7, 0.0, -uT*0.5)));
        col = mix(col, vec3(0.02, 0.0, 0.05), blot*0.92);
        gl_FragColor = vec4(col, 1.0);
      }` });
  }
  // a shell lit at its rim: glow round the core, the containment glass, the hologram
  function fresnelMat(col, k, pw, o){
    o = o || {};
    return new THREE.ShaderMaterial({ uniforms:{ uCol:{ value:new THREE.Color(col) }, uK:{ value:k }, uPow:{ value:pw }, uT:{ value:0 }, uHex:{ value:o.hex ? 1 : 0 }, uScan:{ value:o.scan ? 1 : 0 } },
      vertexShader:VFRES, fragmentShader:`
      uniform vec3 uCol; uniform float uK, uPow, uT, uHex, uScan; varying vec3 vN, vV, vP; varying vec2 vUv;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        float a = f;
        if(uHex > 0.5){ vec2 g = vUv*vec2(48.0, 22.0); vec2 r = vec2(1.0, 1.732); vec2 h = r*0.5;
          vec2 q1 = mod(g, r) - h, q2 = mod(g - h, r) - h; vec2 q = dot(q1, q1) < dot(q2, q2) ? q1 : q2;
          float edge = smoothstep(0.42, 0.47, max(abs(q.x)*0.866 + abs(q.y)*0.5, abs(q.y))); a += edge*0.22; }
        if(uScan > 0.5){ float s = fract(vUv.y - uT*0.25); a += smoothstep(0.0, 0.02, s)*smoothstep(0.06, 0.02, s)*1.6; a += step(0.5, fract(vUv.y*120.0))*0.04; }
        gl_FragColor = vec4(uCol*a*uK, 1.0);
      }`, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:o.side || THREE.FrontSide });
  }
  // a beam: light running along a cylinder
  function beamMat(col){
    return new THREE.ShaderMaterial({ uniforms:{ uCol:{ value:new THREE.Color(col) }, uT:{ value:0 }, uK:{ value:1 } }, vertexShader:VFRES, fragmentShader:`
      uniform vec3 uCol; uniform float uT, uK; varying vec3 vN, vV; varying vec2 vUv;
      void main(){ float c = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float s = 0.55 + 0.45*sin(vUv.y*46.0 - uT*24.0); float s2 = 0.5 + 0.5*sin(vUv.y*13.0 + uT*9.0);
        gl_FragColor = vec4(uCol*c*(s*0.7 + s2*0.5)*uK, 1.0); }`,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
  }
  // krackle: dots with black hearts, orbiting
  function krackleMat(rim){
    return new THREE.ShaderMaterial({ uniforms:{ uT:{ value:0 }, uRim:{ value:new THREE.Color(rim) }, uScale:{ value:420 } },
      vertexShader:`attribute vec4 aS; uniform float uT, uScale; varying float vP;
        void main(){ float a = aS.x + uT*aS.z, r = aS.y*(1.0 + 0.18*sin(uT*2.3 + aS.x*3.0));
          vec3 p = vec3(cos(a)*r, sin(a*1.31 + aS.x)*r*0.55, sin(a)*r); float t = aS.x*2.0; p.xy = mat2(cos(t), -sin(t), sin(t), cos(t))*p.xy;
          vec4 mv = modelViewMatrix*vec4(p, 1.0); vP = 0.55 + 0.45*sin(uT*6.0 + aS.x*7.0);
          gl_PointSize = aS.w*vP*uScale/max(0.2, -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform vec3 uRim; varying float vP;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if(d > 0.5) discard;
          float core = smoothstep(0.3, 0.24, d), ink = smoothstep(0.43, 0.47, d);
          vec3 col = mix(uRim*(2.0 + vP), vec3(0.03, 0.0, 0.07), core); col = mix(col, vec3(0.02, 0.0, 0.04), ink);
          gl_FragColor = vec4(col, 1.0); }` });
  }
  // the hologram: rim light, scanlines, a flicker
  function holoMat(col){ const m = fresnelMat(col, 2.6, 0.7, { scan:true, side:THREE.DoubleSide }); return m; }

  /* ================================================================ PAINT */
  function floorTex(o){
    const S = 128, W = o.w*S, H = o.d*S, c = cv(W, H), x = c.getContext('2d');
    // dark epoxy, mottled
    x.fillStyle = '#1a1d27'; x.fillRect(0, 0, W, H);
    for(let i = 0; i < 2600; i++){ const r = rnd(10, 90), g = x.createRadialGradient(0, 0, 0, 0, 0, r); const l = Math.random() < 0.5 ? 255 : 0;
      g.addColorStop(0, `rgba(${l},${l},${l},${rnd(0.012, 0.035)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(rnd(0, W), rnd(0, H)); x.fillStyle = g; x.fillRect(-r, -r, r*2, r*2); x.restore(); }
    // tile seams, a metre apart
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3; for(let i = 0; i <= o.w; i++){ x.beginPath(); x.moveTo(i*S, 0); x.lineTo(i*S, H); x.stroke(); } for(let j = 0; j <= o.d; j++){ x.beginPath(); x.moveTo(0, j*S); x.lineTo(W, j*S); x.stroke(); }
    x.strokeStyle = 'rgba(120,140,190,0.06)'; x.lineWidth = 1; for(let i = 0; i <= o.w; i++){ x.beginPath(); x.moveTo(i*S + 2, 0); x.lineTo(i*S + 2, H); x.stroke(); }
    const P = (px, pz) => [px*S, pz*S];
    // the hazard circle round the rig: yellow and black, and the words round it
    const [rx, ry] = P(o.rig[0], o.rig[1]);
    x.save(); x.translate(rx, ry);
    for(let k = 0; k < 72; k++){ x.fillStyle = k % 2 ? '#16181c' : '#f2c21a'; x.beginPath(); x.arc(0, 0, 2.55*S, k/72*Math.PI*2, (k + 1)/72*Math.PI*2); x.arc(0, 0, 2.3*S, (k + 1)/72*Math.PI*2, k/72*Math.PI*2, true); x.fill(); }
    x.strokeStyle = '#ff3fd0'; x.lineWidth = 6; x.setLineDash([30, 18]); x.beginPath(); x.arc(0, 0, 2.85*S, 0, 7); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#f2c21a'; x.font = font(44); x.textAlign = 'center';
    const words = '  Ψ CONTAINMENT · CLASS IV FIELD · DO NOT CROSS WHILE ENERGISED · ';
    for(let k = 0; k < words.length*2; k++){ const ch = words[k % words.length], a = k/(words.length*2)*Math.PI*2; x.save(); x.rotate(a); x.translate(0, -2.1*S); x.fillText(ch, 0, 0); x.restore(); }
    x.restore();
    // walkways: from the door to the rig, and round the room
    x.strokeStyle = '#f2c21a'; x.lineWidth = 9;
    const [dx, dy] = P(o.door[0], o.door[1]);
    [[-0.9, 0], [0.9, 0]].forEach(([a])=>{ x.beginPath(); x.moveTo(dx + a*S, dy); x.lineTo(dx + a*S, ry + 2.9*S); x.stroke(); });
    x.strokeStyle = 'rgba(242,194,26,0.9)'; x.lineWidth = 7; x.strokeRect(0.45*S, 0.45*S, W - 0.9*S, H - 0.9*S);
    // chevrons and arrows
    x.fillStyle = 'rgba(242,194,26,0.85)';
    for(let k = 0; k < 4; k++){ const y = dy - (0.8 + k*0.9)*S; x.beginPath(); x.moveTo(dx - 0.4*S, y + 0.25*S); x.lineTo(dx, y); x.lineTo(dx + 0.4*S, y + 0.25*S); x.lineTo(dx + 0.4*S, y + 0.38*S); x.lineTo(dx, y + 0.13*S); x.lineTo(dx - 0.4*S, y + 0.38*S); x.fill(); }
    // stencils
    const sten = (t, px, pz, sz, rot, col) => { x.save(); x.translate(px*S, pz*S); x.rotate(rot || 0); x.font = font(sz); x.fillStyle = col || 'rgba(232,236,245,0.55)'; x.textAlign = 'center'; x.fillText(t, 0, 0); x.restore(); };
    sten('Ψ-LAB  120', o.door[0], o.door[1] - 0.35, 70, 0, 'rgba(255,63,208,0.75)');
    sten('KEEP CLEAR', o.rig[0] + 3.4, o.rig[1], 46, -Math.PI/2);
    sten('BAY 01', 1.6, o.d - 1.0, 40); sten('BAY 02', 1.6, 2.0, 40); sten('SERVER', o.w - 1.6, 1.4, 40); sten('TEST STAND', o.stand[0], o.stand[1] + 0.95, 34);
    // cable channel covers: grated, from the rig to the monitors and the racks
    [[o.rig[0] + 0.5, o.rig[1] - 2.6, 0.32, 2.2], [o.rig[0] + 2.6, o.rig[1] - 0.2, o.w - o.rig[0] - 3.1, 0.32]].forEach(([a, b, w, d])=>{
      x.fillStyle = '#2a2e38'; x.fillRect(a*S, b*S, w*S, d*S); x.strokeStyle = '#0d0f14'; x.lineWidth = 2;
      for(let i = 0; i < (w > d ? w : d)*S; i += 10){ x.beginPath(); if(w > d){ x.moveTo(a*S + i, b*S); x.lineTo(a*S + i, (b + d)*S); } else { x.moveTo(a*S, b*S + i); x.lineTo((a + w)*S, b*S + i); } x.stroke(); } });
    // scuffs, tyre marks from the chairs, a spill
    for(let i = 0; i < 60; i++){ x.strokeStyle = `rgba(0,0,0,${rnd(0.08, 0.2)})`; x.lineWidth = rnd(2, 6); x.beginPath(); const sx = rnd(0, W), sy = rnd(0, H); x.moveTo(sx, sy); x.quadraticCurveTo(sx + rnd(-60, 60), sy + rnd(-60, 60), sx + rnd(-120, 120), sy + rnd(-120, 120)); x.stroke(); }
    return tex(c);
  }
  function panelTex(){
    const c = cv(256, 256), x = c.getContext('2d');
    x.fillStyle = '#1c2030'; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 4000; i++){ x.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},255,${rnd(0.01, 0.04)})`; x.fillRect(rnd(0, 256), rnd(0, 256), 2, 2); }
    // perforations in a grid: acoustic
    x.fillStyle = 'rgba(0,0,0,0.5)'; for(let i = 12; i < 256; i += 16) for(let j = 12; j < 256; j += 16){ x.beginPath(); x.arc(i, j, 2.2, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 6; x.strokeRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(160,180,255,0.08)'; x.lineWidth = 2; x.strokeRect(5, 5, 246, 246);
    return tex(c);
  }
  function blindsTex(){
    const c = cv(128, 512), x = c.getContext('2d');
    for(let y = 0; y < 512; y += 16){ const g = x.createLinearGradient(0, y, 0, y + 16); g.addColorStop(0, '#c9d6e6'); g.addColorStop(0.55, '#7f8ea4'); g.addColorStop(0.7, '#2a3040'); g.addColorStop(1, '#eaf2ff'); x.fillStyle = g; x.fillRect(0, y, 128, 16); }
    x.fillStyle = 'rgba(30,30,40,0.8)'; x.fillRect(20, 0, 3, 512); x.fillRect(105, 0, 3, 512);
    return tex(c);
  }
  function rayTex(){
    const c = cv(64, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(210,225,255,0.55)'); g.addColorStop(1, 'rgba(210,225,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.3, 'rgba(0,0,0,0)'); h.addColorStop(0.7, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
    return tex(c);
  }
  function burstTex(){
    const c = cv(512, 512), x = c.getContext('2d'); x.translate(256, 256);
    for(let k = 0; k < 40; k++){ const a = k/40*Math.PI*2, w = (k % 2 ? 0.035 : 0.06), l = k % 3 ? 250 : 200;
      const g = x.createLinearGradient(0, 0, Math.cos(a)*l, Math.sin(a)*l); g.addColorStop(0, 'rgba(255,90,230,0)'); g.addColorStop(0.35, k % 2 ? 'rgba(120,220,255,0.55)' : 'rgba(255,80,220,0.7)'); g.addColorStop(1, 'rgba(255,80,220,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - w)*l, Math.sin(a - w)*l); x.lineTo(Math.cos(a + w)*l, Math.sin(a + w)*l); x.closePath(); x.fill(); }
    return tex(c);
  }
  function stripeTex(){ const c = cv(64, 16), x = c.getContext('2d'); x.fillStyle = '#f2c21a'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#121418'; for(let i = -2; i < 6; i++){ x.beginPath(); x.moveTo(i*16, 16); x.lineTo(i*16 + 8, 16); x.lineTo(i*16 + 16, 0); x.lineTo(i*16 + 8, 0); x.fill(); } return tex(c, [4, 1]); }
  function signTex(lines, o){
    o = o || {}; const c = cv(o.w || 512, o.h || 256), x = c.getContext('2d');
    x.fillStyle = o.bg || '#f2c21a'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = o.ink || '#121418'; x.lineWidth = 12; x.strokeRect(10, 10, c.width - 20, c.height - 20);
    x.fillStyle = o.ink || '#121418'; x.textAlign = 'center';
    lines.forEach(([t, sz], i)=>{ x.font = font(sz); x.fillText(t, c.width/2, (o.top || 80) + i*(sz + 14)); });
    return tex(c);
  }
  function poster(kind){
    const c = cv(360, 512), x = c.getContext('2d');
    if(kind === 0){ // the robotics club, after a film poster: magenta and cyan, halftone
      const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#2a0a4a'); g.addColorStop(1, '#ff3fd0'); x.fillStyle = g; x.fillRect(0, 0, 360, 512);
      for(let i = 0; i < 360; i += 12) for(let j = 0; j < 512; j += 12){ x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(i, j, (j/512)*5, 0, 7); x.fill(); }
      x.fillStyle = '#38ffd0'; x.beginPath(); x.arc(180, 220, 110, 0, 7); x.fill(); x.fillStyle = '#121418'; x.fillRect(120, 170, 120, 40); x.fillStyle = '#ff3fd0'; x.fillRect(140, 180, 30, 20); x.fillRect(190, 180, 30, 20);
      x.fillStyle = '#fff'; x.font = font(46); x.textAlign = 'center'; x.fillText('HAWKS', 180, 400); x.font = font(26); x.fillText('ROBOTICS CLUB', 180, 438); x.font = font(16); x.fillText('TUES & THURS · ROOM 120', 180, 470);
    } else if(kind === 1){ // the safety poster
      x.fillStyle = '#f6f4ee'; x.fillRect(0, 0, 360, 512); x.fillStyle = '#d02040'; x.fillRect(0, 0, 360, 90); x.fillStyle = '#fff'; x.font = font(40); x.textAlign = 'center'; x.fillText('Ψ SAFETY', 180, 60);
      x.fillStyle = '#121418'; x.font = font(19, '600 '); ['1. Never cross the yellow line', '   while the field is up.', '2. No metal within 2 m.', '3. Goggles. Always.', '4. If it hums louder:', '   E-STOP, then leave.', '5. Do not name the field.'].forEach((t, i)=>{ x.textAlign = 'left'; x.fillText(t, 26, 140 + i*42); });
      x.fillStyle = '#7a2ac8'; x.beginPath(); x.arc(290, 450, 38, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = font(48); x.textAlign = 'center'; x.fillText('Ψ', 290, 467);
    } else { // a periodic table, dense
      x.fillStyle = '#0e1626'; x.fillRect(0, 0, 360, 512); x.fillStyle = '#9fd8ff'; x.font = font(18); x.textAlign = 'center'; x.fillText('PERIODIC TABLE', 180, 34);
      const cols = ['#ff6a8a', '#ffd23d', '#38ffd0', '#7aa8ff', '#c88aff'];
      for(let r = 0; r < 7; r++) for(let k = 0; k < 18; k++){ if(r < 3 && k > 1 && k < 12 && !(r === 0)) continue; if(r === 0 && k > 0 && k < 17) continue; x.fillStyle = cols[(k + r) % 5]; x.fillRect(8 + k*19.2, 60 + r*28, 17, 25); }
      for(let r = 0; r < 2; r++) for(let k = 0; k < 15; k++){ x.fillStyle = cols[(k + 3) % 5]; x.fillRect(40 + k*19.2, 280 + r*28, 17, 25); }
    }
    return tex(c);
  }
  function pegboardTex(){
    const c = cv(1024, 512), x = c.getContext('2d');
    x.fillStyle = '#2c3346'; x.fillRect(0, 0, 1024, 512); x.fillStyle = '#121624'; for(let i = 12; i < 1024; i += 24) for(let j = 12; j < 512; j += 24){ x.beginPath(); x.arc(i, j, 4, 0, 7); x.fill(); }
    // outlines of the tools, and the tools
    const tool = (draw, col) => { x.save(); x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 10; draw(); x.stroke(); x.strokeStyle = col; x.lineWidth = 6; draw(); x.stroke(); x.restore(); };
    for(let k = 0; k < 6; k++) tool(()=>{ x.beginPath(); x.moveTo(60 + k*40, 60); x.lineTo(60 + k*40, 200 + k*8); }, ['#e84a2a', '#e8c040', '#2a8ae8', '#e84a2a', '#3aaa5a', '#8a5ac8'][k]);   // screwdrivers
    tool(()=>{ x.beginPath(); x.moveTo(380, 60); x.lineTo(420, 240); x.moveTo(440, 60); x.lineTo(400, 240); }, '#c8ccd2');     // pliers
    tool(()=>{ x.beginPath(); x.arc(560, 120, 50, 0.4, 5.9); x.moveTo(600, 140); x.lineTo(680, 260); }, '#c8ccd2');            // a wrench
    tool(()=>{ x.beginPath(); x.rect(740, 70, 120, 70); x.moveTo(800, 140); x.lineTo(800, 260); }, '#e8c040');                  // a hammer
    for(let k = 0; k < 8; k++){ x.fillStyle = ['#ff3fd0', '#38ffd0', '#ffd23d', '#ff6a3a'][k % 4]; x.beginPath(); x.arc(80 + k*110, 380, 34, 0, 7); x.fill(); x.fillStyle = '#121624'; x.beginPath(); x.arc(80 + k*110, 380, 12, 0, 7); x.fill(); }   // spools of wire
    x.fillStyle = '#e8e6d8'; x.font = font(22); x.fillText('PUT IT BACK WHERE YOU FOUND IT — MGMT', 300, 490);
    return tex(c);
  }
  function rackTex(){
    const c = cv(128, 512), x = c.getContext('2d'); x.fillStyle = '#05070a'; x.fillRect(0, 0, 128, 512);
    for(let r = 0; r < 24; r++){ x.fillStyle = r % 5 === 0 ? '#1a1f2c' : '#10141c'; x.fillRect(6, 6 + r*21, 116, 17); x.fillStyle = '#05070a'; for(let k = 0; k < 9; k++) x.fillRect(12 + k*7, 10 + r*21, 4, 9); }
    return c;
  }
  function whiteboard(){
    const c = cv(1536, 640), x = c.getContext('2d');
    x.fillStyle = '#f4f6f2'; x.fillRect(0, 0, 1536, 640);
    x.strokeStyle = 'rgba(80,90,110,0.12)'; x.lineWidth = 30; for(let i = 0; i < 9; i++){ x.beginPath(); x.moveTo(rnd(0, 1536), rnd(0, 640)); x.lineTo(rnd(0, 1536), rnd(0, 640)); x.stroke(); }   // old erasings
    const t = (s, px, py, sz, col) => { x.font = font(sz, '600 '); x.fillStyle = col; x.fillText(s, px, py); };
    t('Ψ — CONTAINMENT TRIALS', 40, 64, 48, '#4a2a9a');
    ['trial 41: field held 3.2 s', 'trial 42: 11.8 s (!!)', 'trial 43: prototype seized — again', 'trial 44: ?'].forEach((s, i)=>t(s, 50, 130 + i*44, 30, '#1a1a1a'));
    t('output spikes when the field DIPS. why??', 50, 330, 32, '#c02040');
    t('Ψ(t) ≈ A·sin(ωt + φ) + B·sin(ω₂t) + ε(t)', 50, 400, 34, '#1a3a8a'); t('dE/dt = −k·∇Ψ · v', 50, 450, 30, '#1a3a8a'); t('|Ψ| < 0.42 μΨ  → stable?', 50, 500, 30, '#1a3a8a');
    t('DON\'T TOUCH THE RIG', 50, 590, 36, '#c02040');
    // the graph: the field, decaying, and the prototype, fighting it
    x.strokeStyle = '#333'; x.lineWidth = 2; x.beginPath(); x.moveTo(820, 80); x.lineTo(820, 380); x.lineTo(1480, 380); x.stroke();
    x.strokeStyle = '#6a3aaa'; x.lineWidth = 4; x.beginPath(); for(let i = 0; i < 640; i++){ const u = i/640; x.lineTo(830 + i, 230 - 110*Math.sin(u*22)*Math.exp(-u*1.2) - 25*Math.sin(u*67)); } x.stroke();
    x.strokeStyle = '#d02040'; x.lineWidth = 3; x.setLineDash([10, 8]); x.beginPath(); for(let i = 0; i < 640; i++){ const u = i/640; x.lineTo(830 + i, 230 + 110*Math.sin(u*22)*Math.exp(-u*1.2)); } x.stroke(); x.setLineDash([]);
    t('field', 1400, 120, 24, '#6a3aaa'); t('proto', 1400, 160, 24, '#d02040');
    // a sketch of the rig, circled
    x.strokeStyle = '#1a3a8a'; x.lineWidth = 3; x.beginPath(); x.arc(1100, 520, 70, 0, 7); x.stroke(); x.beginPath(); x.ellipse(1100, 520, 110, 30, 0.3, 0, 7); x.stroke(); x.beginPath(); x.ellipse(1100, 520, 110, 30, -0.5, 0, 7); x.stroke();
    x.strokeStyle = '#c02040'; x.beginPath(); x.ellipse(1100, 520, 160, 100, 0, 0, 7); x.stroke(); t('← it\'s alive??', 1280, 530, 26, '#c02040');
    // sticky notes
    [['#ffe96a', 'call facilities re: hum'], ['#ff9fd8', 'order more copper'], ['#9ff0ff', 'ROBIN — ask her']].forEach(([col, note], i)=>{ x.save(); x.translate(560 + i*90, 470 + (i % 2)*40); x.rotate(rnd(-0.12, 0.12));
      x.fillStyle = col; x.fillRect(0, 0, 150, 120); x.fillStyle = '#222'; x.font = font(18, '');
      const lines = []; note.split(' ').forEach(w=>{ const l = lines[lines.length - 1]; if(l !== undefined && (l + ' ' + w).length <= 12) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); });
      lines.forEach((l, k)=>x.fillText(l, 10, 32 + k*24)); x.restore(); });
    return tex(c);
  }
  function laptopTex(i){
    const c = cv(256, 160), x = c.getContext('2d'); x.fillStyle = '#0a0e18'; x.fillRect(0, 0, 256, 160);
    if(i % 2){ x.font = font(10, ''); for(let r = 0; r < 14; r++){ x.fillStyle = ['#38ffd0', '#ff3fd0', '#ffd23d', '#9fb4c0'][r % 4]; x.fillText(['def stabilise(field):', '  err = field.phase - out', '  out += Kp*err', '  if abs(err) > 0.4:', '    raise Seize()', 'for t in trial:', '  log(t, psi(t))'][r % 7], 8, 14 + r*10.5); } }
    else { x.strokeStyle = '#38ffd0'; x.lineWidth = 2; x.beginPath(); for(let k = 0; k < 256; k++) x.lineTo(k, 80 - 40*Math.sin(k*0.09)*Math.cos(k*0.021)); x.stroke(); x.fillStyle = '#ff3fd0'; x.fillRect(10, 130, 120, 14); }
    return tex(c);
  }

  /* ================================================================ BUILD */
  function build(ctx){
    const { g, X, solid, lights } = ctx;
    seed = 7;
    const L = { t:0, arcT:0, ring:[], arms:[], spin:[], blink:[], shaders:[], screens:[], waves:[], dust:null, flick:[], holo:null };
    const add = (m, x, y, z, ry) => { m.position.set(x, y, z); if(ry) m.rotation.y = ry; m.castShadow = false; m.receiveShadow = true; g.add(m); return m; };
    const mesh = (geo, mat, x, y, z, ry) => add(new THREE.Mesh(geo, mat), x, y, z, ry);
    const bx = (mat, x, y, z, w, h, d, ry) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry);
    const cyl = (mat, x, y, z, r1, r2, h, n) => mesh(new THREE.CylinderGeometry(r1, r2, h, n || 20), mat, x, y, z);
    const x0 = X(-5), x1 = X(11), z0 = -48, z1 = -34, H = ctx.H;
    const RX = ctx.rig[0], RZ = ctx.rig[1], FY = ctx.FY, TX = ctx.stand[0], TZ = ctx.stand[1];

    // ---- materials
    const M = {
      dark:std({ color:0x14161e, roughness:0.45, metalness:0.6 }), steel:std({ color:0x9aa2ae, roughness:0.28, metalness:0.92 }), gun:std({ color:0x3a3f4a, roughness:0.35, metalness:0.85 }),
      black:std({ color:0x0b0c10, roughness:0.6, metalness:0.2 }), copper:std({ color:0xc06a2a, roughness:0.28, metalness:0.95 }), brass:std({ color:0xc8a040, roughness:0.3, metalness:0.9 }),
      orange:std({ color:0xff6a1a, roughness:0.4, metalness:0.25 }), yellow:std({ color:0xf2c21a, roughness:0.5 }), white:std({ color:0xe8eaee, roughness:0.35, metalness:0.1 }),
      rubber:std({ color:0x15161a, roughness:0.85 }), wood:std({ color:0x6a4a32, roughness:0.6 }), glass:std({ color:0xbfe8ff, roughness:0.05, metalness:0.2, transparent:true, opacity:0.18, depthWrite:false }),
      panel:std({ map:panelTex(), roughness:0.7, metalness:0.15 }), stripe:std({ map:stripeTex(), roughness:0.6 }), red:std({ color:0xd02040, roughness:0.4 }),
      cable:[0x15161a, 0x1c1f28, 0x2a1a3a, 0x0e2a30].map(c=>std({ color:c, roughness:0.55, metalness:0.1 }))
    };
    const NEON = { cyan:glow(0.25, 2.2, 2.4), mag:glow(2.6, 0.35, 2.2), vio:glow(1.0, 0.5, 2.8), yel:glow(2.4, 1.8, 0.3), white:glow(2.2, 2.3, 2.6), red:glow(2.8, 0.25, 0.3) };

    /* ---------------------------------------------------- THE ROOM */
    // the floor: painted epoxy, polished — it mirrors the field
    const fm = std({ map:floorTex({ w:16, d:14, rig:[RX - x0, RZ - z0], door:[ctx.door[0] - x0, ctx.door[1] - z0], stand:[TX - x0, TZ - z0] }), roughness:0.22, metalness:0.2 });
    if(window.TSHLOOK && TSHLOOK.wet) TSHLOOK.wet(fm, 0.75);
    const floor = mesh(new THREE.PlaneGeometry(16, 14), fm, (x0 + x1)/2, 0.004, (z0 + z1)/2); floor.rotation.x = -Math.PI/2;
    // the ceiling: dark, so the room is lit by what is in it
    const ceil = mesh(new THREE.PlaneGeometry(16, 14), std({ color:0x0c0d12, roughness:0.9 }), (x0 + x1)/2, H - 0.02, (z0 + z1)/2); ceil.rotation.x = Math.PI/2;
    // the walls: acoustic panels, a neon seam at the top of them and a magenta one along the floor
    const clad = (ax, az, bx_, bz, face) => { const len = Math.hypot(bx_ - ax, bz - az), n = Math.round(len/1.2), ry = Math.atan2(bx_ - ax, bz - az) + Math.PI/2;
      for(let i = 0; i < n; i++) for(let j = 0; j < 3; j++){ const f = (i + 0.5)/n, px = ax + (bx_ - ax)*f + Math.cos(ry)*0, pz = az + (bz - az)*f;
        const p = bx(M.panel, px + face[0]*0.04, 0.3 + j*1.12 + 0.55, pz + face[1]*0.04, len/n - 0.03, 1.08, 0.05, ry); p.material = M.panel; }
      const s1 = bx(NEON.cyan, (ax + bx_)/2 + face[0]*0.07, 3.72, (az + bz)/2 + face[1]*0.07, len, 0.035, 0.02, ry);
      const s2 = bx(NEON.mag, (ax + bx_)/2 + face[0]*0.07, 0.16, (az + bz)/2 + face[1]*0.07, len, 0.03, 0.02, ry);
      bx(M.black, (ax + bx_)/2 + face[0]*0.03, (3.8 + H)/2, (az + bz)/2 + face[1]*0.03, len, H - 3.8, 0.02, ry); };
    clad(x0, z0, x1, z0, [0, 1]);                               // the back wall (the monitors go over it)
    clad(x1, z0, x1, z1, [-1, 0]);                              // the east wall
    clad(x0, z1, X(1), z1, [0, -1]); clad(X(3), z1, x1, z1, [0, -1]);   // the door wall, either side of the door
    // the west wall: the window wall. Blinds down, light through them in shafts, dust in the shafts
    const blinds = std({ map:blindsTex(), emissive:new THREE.Color(0.5, 0.58, 0.75), emissiveMap:null, roughness:0.6 });
    blinds.emissiveMap = blinds.map;
    const rays = addv(0xffffff, 0.07); rays.map = rayTex(); rays.side = THREE.DoubleSide;
    for(let k = 0; k < 5; k++){ const wz = -46.5 + k*2.6;
      bx(M.dark, x0 + 0.06, 2.9, wz, 0.1, 3.5, 2.1); const b = mesh(new THREE.PlaneGeometry(2.0, 3.4), blinds, x0 + 0.12, 2.9, wz, Math.PI/2);
      for(let s = 0; s < 2; s++){ const r = mesh(new THREE.PlaneGeometry(1.2, 4.2), rays, x0 + 1.5, 2.2, wz + (s - 0.5)*0.6, Math.PI/2); r.rotation.set(0, Math.PI/2, 0.9); r.rotateX(0.1*(s - 0.5)); r.renderOrder = 3; } }
    bx(M.panel, x0 + 0.04, 0.6, (z0 + z1)/2, 0.05, 1.2, 14); bx(NEON.mag, x0 + 0.07, 0.16, (z0 + z1)/2, 0.02, 0.03, 14);
    // dust in the light
    { const N = 700, p = new Float32Array(N*3); for(let i = 0; i < N; i++){ p[i*3] = rnd(x0 + 0.3, x1 - 0.3); p[i*3 + 1] = rnd(0.2, H - 0.3); p[i*3 + 2] = rnd(z0 + 0.3, z1 - 0.3); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(p, 3));
      L.dust = add(new THREE.Points(gg, new THREE.PointsMaterial({ color:0xd8d0ff, size:0.018, transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending })), 0, 0, 0); L.dust.userData.base = p.slice(); }

    // ---- overhead: trusses, trays, ducts, light strips
    for(let k = 0; k < 6; k++){ const tz = z0 + 1.2 + k*2.4;
      bx(M.gun, (x0 + x1)/2, H - 0.35, tz, 16, 0.12, 0.12); bx(M.gun, (x0 + x1)/2, H - 0.75, tz, 16, 0.08, 0.08);
      for(let i = 0; i < 20; i++){ const lx = x0 + 0.4 + i*0.8; const d = bx(M.gun, lx, H - 0.55, tz, 0.04, 0.42, 0.04); d.rotation.z = i % 2 ? 0.75 : -0.75; } }
    // cable trays, full of cable
    [[z0 + 3.2], [z0 + 8.4], [z0 + 12.4]].forEach(([tz])=>{ bx(M.steel, (x0 + x1)/2, H - 0.95, tz, 15.6, 0.04, 0.42); bx(M.steel, (x0 + x1)/2, H - 0.88, tz - 0.21, 15.6, 0.14, 0.02); bx(M.steel, (x0 + x1)/2, H - 0.88, tz + 0.21, 15.6, 0.14, 0.02);
      for(let c = 0; c < 6; c++){ const m = mesh(new THREE.CylinderGeometry(0.025 + (c % 3)*0.008, 0.025 + (c % 3)*0.008, 15.4, 8), M.cable[c % 4], (x0 + x1)/2, H - 0.9 + (c > 2 ? 0.05 : 0), tz - 0.15 + (c % 3)*0.15); m.rotation.z = Math.PI/2; }
      bx(NEON.white, (x0 + x1)/2, H - 1.0, tz, 15.4, 0.02, 0.06); });
    // a duct, along the window side
    { const d = mesh(new THREE.CylinderGeometry(0.32, 0.32, 14, 24), M.steel, x0 + 1.4, H - 0.6, (z0 + z1)/2); d.rotation.x = Math.PI/2;
      for(let k = 0; k < 8; k++){ const r = mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 24), M.gun, x0 + 1.4, H - 0.6, z0 + 0.6 + k*1.8); }
      for(let k = 0; k < 3; k++) bx(M.gun, x0 + 1.4, H - 0.97, z0 + 2.5 + k*4.5, 0.5, 0.06, 0.35); }

    /* ---------------------------------------------------- THE FIELD */
    const F = new THREE.Group(); F.position.set(RX, 0, RZ); g.add(F);
    const fmesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); F.add(m); return m; };
    // the dais: three tiers, vents round the top one, bolts
    fmesh(new THREE.CylinderGeometry(1.95, 2.05, 0.12, 64), M.dark, 0, 0.06, 0);
    fmesh(new THREE.CylinderGeometry(1.62, 1.7, 0.16, 64), M.gun, 0, 0.2, 0);
    fmesh(new THREE.CylinderGeometry(1.3, 1.34, 0.1, 64), M.dark, 0, 0.33, 0);
    for(let k = 0; k < 36; k++){ const a = k/36*Math.PI*2; const v = fmesh(new THREE.BoxGeometry(0.035, 0.02, 0.22), NEON.mag, Math.cos(a)*1.45, 0.285, Math.sin(a)*1.45); v.rotation.y = -a; }
    for(let k = 0; k < 24; k++){ const a = k/24*Math.PI*2; fmesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), M.steel, Math.cos(a)*1.86, 0.13, Math.sin(a)*1.86); }
    { const ring = fmesh(new THREE.TorusGeometry(1.3, 0.02, 6, 96), NEON.cyan, 0, 0.385, 0); ring.rotation.x = Math.PI/2; }
    // the lower emitter: a lens on a stalk, aimed up at it
    fmesh(new THREE.CylinderGeometry(0.28, 0.42, 0.35, 32), M.gun, 0, 0.55, 0); fmesh(new THREE.CylinderGeometry(0.14, 0.24, 0.22, 32), M.steel, 0, 0.83, 0);
    fmesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI*2, 0, Math.PI/2), NEON.vio, 0, 0.94, 0);
    // the coils: four pillars, wound in copper, a glowing tip on each — the lightning goes to these
    const tips = [];
    for(let k = 0; k < 4; k++){ const a = Math.PI/4 + k*Math.PI/2, px = Math.cos(a)*1.32, pz = Math.sin(a)*1.32;
      fmesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 20), M.gun, px, 0.5, pz); fmesh(new THREE.CylinderGeometry(0.075, 0.09, 2.5, 16), M.dark, px, 1.75, pz);
      for(let j = 0; j < 14; j++) { const r = fmesh(new THREE.TorusGeometry(0.11, 0.022, 6, 18), M.copper, px, 0.78 + j*0.065, pz); r.rotation.x = Math.PI/2; }
      for(let j = 0; j < 3; j++){ const r = fmesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18), NEON.mag, px, 1.95 + j*0.22, pz); r.rotation.x = Math.PI/2; }
      fmesh(new THREE.CylinderGeometry(0.06, 0.12, 0.18, 16), M.steel, px, 3.05, pz);
      const tip = fmesh(new THREE.SphereGeometry(0.075, 16, 10), NEON.vio, px, 3.18, pz); tips.push(new V3(px, 3.18, pz)); L.flick.push(tip); }
    // the containment glass: a cylinder with a hex grid and a scan running up it, ribs, top and bottom rings
    const glassM = fresnelMat(0x6fd8ff, 0.26, 2.8, { hex:true, scan:true, side:THREE.DoubleSide }); L.shaders.push(glassM);
    fmesh(new THREE.CylinderGeometry(0.95, 0.95, 2.3, 64, 1, true), glassM, 0, FY, 0);
    for(let k = 0; k < 8; k++){ const a = k/8*Math.PI*2; fmesh(new THREE.BoxGeometry(0.03, 2.3, 0.05), M.steel, Math.cos(a)*0.97, FY, Math.sin(a)*0.97).rotation.y = -a; }
    [FY - 1.15, FY + 1.15].forEach(y=>{ const r = fmesh(new THREE.TorusGeometry(0.97, 0.05, 10, 64), M.gun, 0, y, 0); r.rotation.x = Math.PI/2; const n = fmesh(new THREE.TorusGeometry(0.97, 0.012, 6, 64), NEON.cyan, 0, y + (y > FY ? -0.06 : 0.06), 0); n.rotation.x = Math.PI/2; });
    // the gimbals: three rings, nodes on them
    [[0.82, 0.03], [0.68, 0.026], [0.55, 0.022]].forEach(([r, w], i)=>{ const ring = new THREE.Group(); ring.position.set(0, FY, 0); F.add(ring);
      ring.add(new THREE.Mesh(new THREE.TorusGeometry(r, w, 10, 80), M.steel));
      const inner = new THREE.Mesh(new THREE.TorusGeometry(r - w*0.6, w*0.35, 6, 80), i === 1 ? NEON.mag : NEON.cyan); ring.add(inner);
      for(let k = 0; k < 6; k++){ const a = k/6*Math.PI*2, n = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), M.gun); n.position.set(Math.cos(a)*r, Math.sin(a)*r, 0); ring.add(n); }
      ring.rotation.set(i*0.9, i*0.6, 0); L.ring.push(ring); });
    // THE CORE
    const coreM = coreMat(); L.shaders.push(coreM);
    L.core = fmesh(new THREE.SphereGeometry(0.2, 64, 48), coreM, 0, FY, 0);
    // an ink outline round it (the hull trick: a black back face, a little bigger)
    L.ink = fmesh(new THREE.SphereGeometry(0.2, 48, 32), new THREE.MeshBasicMaterial({ color:0x07020c, side:THREE.BackSide }), 0, FY, 0); L.ink.scale.setScalar(1.09);
    // a lattice turning inside the glow
    L.lattice = fmesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.0, 0.5, 2.0), wireframe:true, transparent:true, opacity:0.3, blending:THREE.AdditiveBlending, depthWrite:false }), 0, FY, 0);
    L.lattice2 = fmesh(new THREE.OctahedronGeometry(0.46, 0), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.3, 1.6, 2.0), wireframe:true, transparent:true, opacity:0.35, blending:THREE.AdditiveBlending, depthWrite:false }), 0, FY, 0);
    // glow shells
    L.shells = [[0.3, 0xff3fd0, 1.1, 2.0], [0.5, 0x9a5aff, 0.55, 2.6], [0.85, 0x5ad8ff, 0.25, 3.4]].map(([r, c, k, p])=>{ const m = fresnelMat(c, k, p); m.side = THREE.BackSide; L.shaders.push(m); return fmesh(new THREE.SphereGeometry(r, 48, 32), m, 0, FY, 0); });
    // the krackle: dots with black hearts, orbiting
    { const N = 260, a = new Float32Array(N*4), pp = new Float32Array(N*3);
      for(let i = 0; i < N; i++){ a[i*4] = rnd(0, 6.28); a[i*4 + 1] = rnd(0.24, 1.05)*(Math.random() < 0.25 ? 1.5 : 1); a[i*4 + 2] = rnd(0.3, 1.4)*(Math.random() < 0.5 ? -1 : 1); a[i*4 + 3] = rnd(0.045, 0.13); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); gg.setAttribute('aS', new THREE.BufferAttribute(a, 4));
      const km = krackleMat(0xff4fe0); L.shaders.push(km); const pts = new THREE.Points(gg, km); pts.frustumCulled = false; pts.position.set(0, FY, 0); F.add(pts);
      const gg2 = gg.clone(), km2 = krackleMat(0x4fd8ff); L.shaders.push(km2); const p2 = new THREE.Points(gg2, km2); p2.frustumCulled = false; p2.position.set(0, FY, 0); p2.scale.setScalar(0.7); p2.rotation.z = 1.2; F.add(p2); L.krackle = [pts, p2]; }
    // the starburst behind it, comic-style
    { const sm = new THREE.SpriteMaterial({ map:burstTex(), transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false }); L.burst = new THREE.Sprite(sm); L.burst.position.set(0, FY, 0); L.burst.scale.setScalar(3.2); F.add(L.burst); }
    // shockwaves
    L.waves = [0, 1, 2].map(i=>{ const m = fmesh(new THREE.RingGeometry(0.9, 1.0, 80), addv(new THREE.Color(1.6, 0.5, 2.2), 0.8), 0, FY, 0); m.material.side = THREE.DoubleSide; m.rotation.x = i === 2 ? 0 : Math.PI/2; m.rotation.y = i === 1 ? Math.PI/2 : 0; m.userData.ph = i/3; return m; });
    // lightning: to the coil tips, and wild arcs off the rings
    { const NB = 7, SEG = 14, pos = new Float32Array(NB*SEG*2*3), gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const lm = new THREE.LineBasicMaterial({ color:new THREE.Color(2.4, 1.6, 3.2), transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false });
      L.bolts = new THREE.LineSegments(gg, lm); L.bolts.frustumCulled = false; F.add(L.bolts);
      const lm2 = lm.clone(); lm2.color = new THREE.Color(0.4, 1.8, 2.4); L.bolts2 = new THREE.LineSegments(gg, lm2); L.bolts2.position.set(0.006, 0.004, 0); L.bolts2.frustumCulled = false; F.add(L.bolts2);
      L.boltCfg = { NB, SEG, tips }; }
    // the focus ring, hung from the ceiling, and the upper emitter
    { const ry = H - 1.05; const ring = fmesh(new THREE.TorusGeometry(2.25, 0.09, 12, 96), M.gun, 0, ry, 0); ring.rotation.x = Math.PI/2;
      const n = fmesh(new THREE.TorusGeometry(2.25, 0.025, 6, 96), NEON.cyan, 0, ry - 0.09, 0); n.rotation.x = Math.PI/2;
      for(let k = 0; k < 8; k++){ const a = k/8*Math.PI*2, px = Math.cos(a)*2.25, pz = Math.sin(a)*2.25;
        fmesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), M.dark, px, ry - 0.12, pz); const lens = fmesh(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 16), NEON.mag, px, ry - 0.25, pz); L.flick.push(lens);
        if(k % 2 === 0) fmesh(new THREE.CylinderGeometry(0.015, 0.015, 1.05, 6), M.steel, px, ry + 0.52, pz); }
      fmesh(new THREE.CylinderGeometry(0.34, 0.2, 0.5, 32), M.gun, 0, ry - 0.1, 0); fmesh(new THREE.CylinderGeometry(0.22, 0.12, 0.35, 32), M.steel, 0, ry - 0.5, 0);
      for(let k = 0; k < 4; k++){ const a = k/4*Math.PI*2; const s = fmesh(new THREE.BoxGeometry(2.0, 0.05, 0.08), M.gun, Math.cos(a)*1.15, ry, Math.sin(a)*1.15); s.rotation.y = -a; }
      fmesh(new THREE.SphereGeometry(0.1, 24, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2), NEON.vio, 0, ry - 0.67, 0);
      // the beams: from both emitters into the core
      const bm1 = beamMat(0xc070ff), bm2 = beamMat(0xff50e0); L.shaders.push(bm1, bm2);
      const top = ry - 0.68, len1 = top - FY - 0.2; fmesh(new THREE.CylinderGeometry(0.035, 0.07, len1, 16, 1, true), bm1, 0, FY + 0.2 + len1/2, 0);
      const len2 = FY - 0.2 - 0.95; fmesh(new THREE.CylinderGeometry(0.07, 0.035, len2, 16, 1, true), bm2, 0, 0.95 + len2/2, 0);
      // a soft cone of light under the ring
      const cone = fmesh(new THREE.CylinderGeometry(0.25, 1.5, ry - 0.4, 48, 1, true), fresnelMat(0x8a5aff, 0.18, 1.0, { side:THREE.DoubleSide }), 0, (ry + 0.4)/2, 0); L.shaders.push(cone.material); }
    // the cables off it, across the floor, to the monitors, the racks, the stand and the table
    const floorCable = (pts, r, mat) => { const curve = new THREE.CatmullRomCurve3(pts.map(p=>new V3(p[0], p[1], p[2]))); return add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, r, 8, false), mat), 0, 0, 0); };
    [[ [RX + 1.6, 0.06, RZ - 0.8], [RX + 2.2, 0.04, RZ - 2.6], [X(6.0), 0.04, z0 + 0.6], [X(6.0), 1.0, z0 + 0.15] ],
     [ [RX + 1.7, 0.06, RZ + 0.3], [RX + 3.5, 0.04, RZ + 0.1], [X(9.6), 0.04, -45.0], [X(10.2), 0.2, -45.2] ],
     [ [RX + 1.4, 0.06, RZ + 1.0], [RX + 2.4, 0.04, RZ + 2.1], [TX - 0.6, 0.04, TZ - 0.1], [TX - 0.55, 0.76, TZ - 0.1] ],
     [ [RX - 1.6, 0.06, RZ + 0.6], [RX - 2.5, 0.04, RZ + 0.3], [X(-1.2), 0.04, RZ + 0.6] ]].forEach((p, i)=>{
      floorCable(p, 0.045, M.cable[i % 4]); floorCable(p.map(q=>[q[0] + 0.09, q[1], q[2] + 0.06]), 0.03, M.cable[(i + 1) % 4]); floorCable(p.map(q=>[q[0] - 0.08, q[1], q[2] - 0.07]), 0.022, M.cable[(i + 2) % 4]); });
    // and the droops from the ceiling ring up into the trays
    for(let k = 0; k < 5; k++){ const a = k/5*Math.PI*2 + 0.3, px = RX + Math.cos(a)*2.2, pz = RZ + Math.sin(a)*2.2;
      floorCable([[px, H - 1.0, pz], [(px + RX + Math.cos(a)*3)/2, H - 1.6, pz + 0.4], [RX + Math.cos(a)*3.6, H - 0.92, z0 + 3.2 + (k % 3)*5.2]], 0.025, M.cable[k % 4]); }
    solid(RX - 2.0, RX + 2.0, RZ - 2.0, RZ + 2.0, 3.4);
    lights.push(L.light = { x:RX, y:FY, z:RZ, col:new THREE.Color(0xa064ff), k:9, d:11, mul:1 });
    lights.push({ x:RX + 2, y:H - 1.2, z:RZ, col:new THREE.Color(0xff40d0), k:3, d:7 }, { x:RX - 2, y:H - 1.2, z:RZ, col:new THREE.Color(0xff40d0), k:3, d:7 });
    L.at = [RX, FY, RZ];

    /* ---------------------------------------------------- THE MONITOR WALL */
    const mon = cv(1024, 512), monT = new THREE.CanvasTexture(mon); monT.colorSpace = THREE.SRGBColorSpace; L.mon = { c:mon, t:monT, next:0 };
    bx(M.black, X(6.3), 1.95, z0 + 0.06, 4.5, 1.95, 0.12);
    mesh(new THREE.PlaneGeometry(4.2, 1.64), new THREE.MeshBasicMaterial({ map:monT, toneMapped:false, color:new THREE.Color(1.8, 1.8, 1.8) }), X(6.3), 1.95, z0 + 0.13).userData.flat = true;
    for(let k = 1; k < 3; k++) bx(M.black, X(6.3) - 2.1 + k*1.4, 1.95, z0 + 0.14, 0.05, 1.66, 0.02); bx(M.black, X(6.3), 1.95, z0 + 0.14, 4.22, 0.05, 0.02);
    bx(NEON.cyan, X(6.3), 0.95, z0 + 0.14, 4.4, 0.02, 0.02); bx(NEON.cyan, X(6.3), 2.95, z0 + 0.14, 4.4, 0.02, 0.02);
    // the second bank, above: the field drawn as a model, and a big status
    const mon2 = cv(1024, 256), monT2 = new THREE.CanvasTexture(mon2); monT2.colorSpace = THREE.SRGBColorSpace; L.mon2 = { c:mon2, t:monT2 };
    bx(M.black, X(6.3), 3.45, z0 + 0.06, 4.5, 0.95, 0.12); mesh(new THREE.PlaneGeometry(4.3, 0.85), new THREE.MeshBasicMaterial({ map:monT2, toneMapped:false, color:new THREE.Color(1.8, 1.8, 1.8) }), X(6.3), 3.45, z0 + 0.13).userData.flat = true;
    lights.push({ x:X(6.3), y:2.2, z:z0 + 1.2, col:new THREE.Color(0x40d8ff), k:3, d:6 });
    // the control desk under it: keyboards, a console with lit buttons, chairs, mugs
    bx(M.dark, X(6.3), 0.76, z0 + 0.85, 4.4, 0.06, 0.9); bx(M.gun, X(6.3), 0.38, z0 + 0.5, 4.4, 0.76, 0.08); [-2.1, 2.1].forEach(dx=>bx(M.gun, X(6.3) + dx, 0.38, z0 + 0.85, 0.08, 0.76, 0.9));
    solid(X(4.1), X(8.5), z0, z0 + 1.32, 0.82);
    for(let k = 0; k < 3; k++){ const kx = X(5.0) + k*1.3; bx(M.black, kx, 0.8, z0 + 0.95, 0.45, 0.02, 0.15); for(let b = 0; b < 8; b++) bx([NEON.cyan, NEON.mag, NEON.yel, NEON.red][(b + k) % 4], kx - 0.18 + b*0.05, 0.815, z0 + 0.62, 0.03, 0.012, 0.03); }
    [X(4.7), X(7.9)].forEach((mx, i)=>{ cyl(i ? M.red : M.white, mx, 0.84, z0 + 1.1, 0.045, 0.04, 0.1, 16); });
    // chairs
    const chair = (cx, cz, ry) => { const c = new THREE.Group(); c.position.set(cx, 0, cz); c.rotation.y = ry; g.add(c);
      const p = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); c.add(o); return o; };
      for(let k = 0; k < 5; k++){ const a = k/5*Math.PI*2; const l = p(new THREE.BoxGeometry(0.3, 0.03, 0.05), M.gun, Math.cos(a)*0.15, 0.06, Math.sin(a)*0.15); l.rotation.y = -a; p(new THREE.SphereGeometry(0.03, 8, 6), M.black, Math.cos(a)*0.3, 0.03, Math.sin(a)*0.3); }
      p(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 10), M.steel, 0, 0.27, 0); p(new THREE.BoxGeometry(0.5, 0.08, 0.48), M.black, 0, 0.5, 0); p(new THREE.BoxGeometry(0.46, 0.55, 0.06), M.black, 0, 0.85, -0.24).rotation.x = -0.1;
      p(new THREE.BoxGeometry(0.4, 0.02, 0.02), NEON.mag, 0, 1.0, -0.21); };
    chair(X(5.4), z0 + 1.7, 0.3); chair(X(7.4), z0 + 1.8, -0.4);

    /* ---------------------------------------------------- THE RACKS (east wall, at the back) */
    const rackC = rackTex(), rackT = new THREE.CanvasTexture(rackC); rackT.colorSpace = THREE.SRGBColorSpace;
    const ledM = new THREE.MeshBasicMaterial({ map:rackT, toneMapped:false }); L.rack = { c:rackC, t:rackT, next:0 };
    for(let k = 0; k < 4; k++){ const rz = z0 + 0.55 + k*0.7; bx(M.black, x1 - 0.5, 1.1, rz, 0.95, 2.2, 0.66);
      mesh(new THREE.PlaneGeometry(0.6, 2.0), ledM, x1 - 0.975, 1.1, rz, -Math.PI/2).userData.flat = true;
      bx(M.steel, x1 - 0.985, 1.1, rz - 0.31, 0.02, 2.1, 0.02); bx(M.steel, x1 - 0.985, 1.1, rz + 0.31, 0.02, 2.1, 0.02);
      for(let c = 0; c < 4; c++){ const m = mesh(new THREE.CylinderGeometry(0.02, 0.02, H - 2.2 - 0.9, 6), M.cable[c % 4], x1 - 0.5 + (c - 1.5)*0.12, 2.2 + (H - 2.2 - 0.9)/2, rz); } }
    solid(x1 - 1.0, x1, z0, z0 + 3.2, 2.3);
    lights.push({ x:x1 - 1.4, y:1.2, z:z0 + 1.6, col:new THREE.Color(0x38ffd0), k:1.6, d:4 });

    /* ---------------------------------------------------- THE PHYSICS BENCH (east wall, middle) */
    const bz0 = -41.8, bz1 = -38.2, bxx = x1 - 0.8;
    bx(M.dark, bxx, 0.88, (bz0 + bz1)/2, 1.2, 0.06, 3.6); [bz0 + 0.1, bz1 - 0.1].forEach(z=>bx(M.gun, bxx, 0.44, z, 1.1, 0.88, 0.06)); bx(M.gun, bxx + 0.3, 0.2, (bz0 + bz1)/2, 0.5, 0.05, 3.4);
    solid(bxx - 0.62, x1, bz0, bz1, 0.92);
    // three scopes, stacked
    const scopeC = cv(256, 192), scopeT = new THREE.CanvasTexture(scopeC); scopeT.colorSpace = THREE.SRGBColorSpace; L.scope = { c:scopeC, t:scopeT };
    for(let k = 0; k < 3; k++){ const sy = 1.08 + (k === 2 ? 0.36 : 0), sz = bz0 + 0.5 + (k === 2 ? 0.25 : k*0.55);
      bx(std({ color:[0x2a2e36, 0xc8ccd0, 0x2a2e36][k], roughness:0.4, metalness:0.4 }), bxx + 0.15, sy, sz, 0.42, 0.32, 0.5);
      mesh(new THREE.PlaneGeometry(0.28, 0.2), new THREE.MeshBasicMaterial({ map:scopeT, toneMapped:false }), bxx - 0.065, sy + 0.02, sz - 0.06, -Math.PI/2);
      for(let b = 0; b < 4; b++) cyl(M.black, bxx - 0.07, sy - 0.1, sz + 0.12 + b*0.05, 0.015, 0.015, 0.02, 8).rotation.z = Math.PI/2; }
    // the Tesla coil, with its own arcs
    cyl(M.gun, bxx, 0.98, bz0 + 2.1, 0.13, 0.15, 0.14); cyl(M.copper, bxx, 1.3, bz0 + 2.1, 0.06, 0.06, 0.5, 20);
    { const t = mesh(new THREE.TorusGeometry(0.13, 0.05, 12, 28), M.steel, bxx, 1.6, bz0 + 2.1); t.rotation.x = Math.PI/2; L.tesla = new V3(bxx, 1.6, bz0 + 2.1); }
    { const pos = new Float32Array(4*10*2*3), gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      L.tArcs = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color:new THREE.Color(1.6, 1.2, 3.0), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); L.tArcs.frustumCulled = false; g.add(L.tArcs); }
    lights.push(L.tLight = { x:bxx, y:1.7, z:bz0 + 2.1, col:new THREE.Color(0xb090ff), k:1.5, d:4, mul:1 });
    // canisters of something that glows, in a rack
    bx(M.gun, bxx, 0.95, bz1 - 0.55, 0.5, 0.05, 0.7);
    for(let k = 0; k < 6; k++){ const cx = bxx - 0.15 + (k % 2)*0.25, cz = bz1 - 0.8 + Math.floor(k/2)*0.24;
      cyl(M.glass, cx, 1.12, cz, 0.07, 0.07, 0.3, 18); const inner = cyl(k % 3 === 1 ? NEON.cyan : NEON.vio, cx, 1.1, cz, 0.045, 0.045, 0.22, 14); L.flick.push(inner);
      cyl(M.steel, cx, 1.29, cz, 0.075, 0.075, 0.04, 18); cyl(M.steel, cx, 0.98, cz, 0.075, 0.075, 0.03, 18); }
    // beakers and a flask on a stand
    [[bxx + 0.25, bz0 + 2.7, 0.05, 0.14], [bxx + 0.1, bz0 + 2.9, 0.04, 0.1]].forEach(([cx, cz, r, h])=>{ cyl(M.glass, cx, 0.91 + h/2, cz, r, r, h, 16); cyl(addv(new THREE.Color(0.3, 1.0, 0.8), 0.6), cx, 0.91 + h*0.3, cz, r*0.9, r*0.9, h*0.6, 16); });

    /* ---------------------------------------------------- THE TOOL WALL and shelves (east wall, near the door) */
    mesh(new THREE.PlaneGeometry(3.0, 1.5), std({ map:pegboardTex(), roughness:0.7 }), x1 - 0.06, 1.75, -36.0, -Math.PI/2);
    bx(M.dark, x1 - 0.35, 0.9, -36.0, 0.65, 0.05, 3.0); bx(M.gun, x1 - 0.35, 0.45, -36.0, 0.6, 0.9, 2.9);
    for(let k = 0; k < 12; k++) bx(std({ color:[0xd02040, 0x2a8ae8, 0xf2c21a, 0x3aaa5a][k % 4], roughness:0.5 }), x1 - 0.3, 0.98 + (k > 5 ? 0.18 : 0), -37.2 + (k % 6)*0.42, 0.3, 0.14, 0.36);
    solid(x1 - 0.7, x1, -37.6, -34.4, 0.95);
    // a 3D printer on it, its nozzle hot
    bx(M.black, x1 - 0.4, 1.3, -35.0, 0.45, 0.7, 0.45); bx(M.glass, x1 - 0.62, 1.3, -35.0, 0.02, 0.62, 0.4); cyl(NEON.yel, x1 - 0.4, 1.2, -35.0, 0.012, 0.004, 0.03, 8); bx(NEON.cyan, x1 - 0.63, 1.62, -35.0, 0.01, 0.03, 0.2);

    /* ---------------------------------------------------- THE WINDOW BENCH (west wall) */
    const wx = x0 + 0.55;
    bx(M.wood, wx, 0.9, (z0 + z1)/2 + 0.6, 0.8, 0.06, 11); bx(M.gun, wx + 0.05, 0.45, (z0 + z1)/2 + 0.6, 0.7, 0.88, 10.8);
    solid(x0, wx + 0.42, z0 + 1.6, z1 - 0.8, 0.95);
    // printers, a microscope, a soldering station, laptops, parts, mugs, a lamp
    [[-46.4], [-45.1]].forEach(([pz])=>{ bx(M.white, wx, 1.2, pz, 0.45, 0.55, 0.45); bx(M.black, wx, 1.2, pz, 0.38, 0.45, 0.4); cyl(NEON.yel, wx, 1.12, pz, 0.01, 0.004, 0.03, 8); bx(NEON.mag, wx + 0.23, 1.45, pz, 0.01, 0.02, 0.3); });
    { const mz = -43.6; cyl(M.white, wx, 0.95, mz, 0.12, 0.14, 0.04, 20); cyl(M.dark, wx - 0.05, 1.15, mz, 0.03, 0.03, 0.35); bx(M.white, wx, 1.32, mz, 0.08, 0.1, 0.22); cyl(M.black, wx + 0.05, 1.1, mz, 0.03, 0.02, 0.12, 12); }
    { const sz = -42.2; bx(M.red, wx, 0.98, sz, 0.25, 0.1, 0.18); const ir = cyl(M.dark, wx + 0.1, 1.08, sz + 0.15, 0.01, 0.016, 0.22, 8); ir.rotation.x = 1.0; cyl(NEON.yel, wx + 0.1, 0.99, sz + 0.25, 0.004, 0.004, 0.02, 6); }
    for(let k = 0; k < 3; k++){ const lz = -40.6 + k*1.5, lap = new THREE.Group(); lap.position.set(wx, 0.935, lz); lap.rotation.y = Math.PI/2 + rnd(-0.3, 0.3); g.add(lap);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.25), M.gun); lap.add(base);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.21), new THREE.MeshBasicMaterial({ map:laptopTex(k), toneMapped:false })); scr.position.set(0, 0.12, -0.13); scr.rotation.x = -0.25; lap.add(scr);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.23, 0.01), M.gun); back.position.set(0, 0.12, -0.135); back.rotation.x = -0.25; lap.add(back); }
    for(let k = 0; k < 14; k++){ const pz = -46 + srnd()*10; const kind = k % 4;
      if(kind === 0) cyl(std({ color:[0xd02040, 0x2a8ae8, 0xf6f4ee, 0x3aaa5a][k % 4], roughness:0.5 }), wx + rnd(-0.2, 0.2), 0.98, pz, 0.04, 0.035, 0.1, 14);      // mugs
      else if(kind === 1) bx(std({ color:0x1a5a3a, roughness:0.5, metalness:0.3 }), wx + rnd(-0.2, 0.2), 0.94, pz, 0.16, 0.012, 0.11, rnd(0, 3));          // boards
      else if(kind === 2) bx(M.gun, wx + rnd(-0.2, 0.2), 0.96, pz, 0.08, 0.06, 0.12, rnd(0, 3));                                                         // motors
      else { const s = mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 16), std({ color:0xff3fd0 }), wx + rnd(-0.2, 0.2), 0.95, pz); s.rotation.x = Math.PI/2; } }  // spools
    // a desk lamp, warm
    cyl(M.gun, wx, 0.95, -38.0, 0.08, 0.09, 0.03, 16); { const a = cyl(M.gun, wx, 1.2, -38.0, 0.012, 0.012, 0.5, 8); a.rotation.z = 0.3; const h = cyl(M.gun, wx + 0.18, 1.42, -38.0, 0.04, 0.09, 0.12, 16); h.rotation.z = -1.1; cyl(NEON.yel, wx + 0.22, 1.38, -38.0, 0.06, 0.06, 0.01, 16).rotation.z = -1.1; }
    lights.push({ x:wx + 0.3, y:1.3, z:-38.0, col:new THREE.Color(0xffb060), k:2, d:4 });
    lights.push({ x:x0 + 1.5, y:2.6, z:-41.3, col:new THREE.Color(0xb8c8ff), k:2.4, d:7 });
    // a robot head and an arm, prototypes past, on a shelf over the bench
    bx(M.dark, wx + 0.1, 2.3, -36.6, 0.4, 0.04, 2.6);
    for(let k = 0; k < 3; k++){ const hz = -37.6 + k*0.9; const head = mesh(new THREE.SphereGeometry(0.12, 20, 14), [M.white, M.orange, M.gun][k], wx + 0.1, 2.44, hz); head.scale.set(1, 0.85, 1.1); bx(NEON.cyan, wx + 0.22, 2.45, hz, 0.02, 0.03, 0.14); }

    /* ---------------------------------------------------- THE ARMS, the hologram table */
    [[X(-2.6), -38.6, 0.4], [X(-2.6), -45.2, 2.2]].forEach(([ax, az, ph])=>{
      cyl(M.dark, ax, 0.15, az, 0.5, 0.55, 0.3, 32); const st = cyl(M.stripe, ax, 0.31, az, 0.51, 0.51, 0.03, 32);
      const base = new THREE.Group(); base.position.set(ax, 0.32, az); g.add(base);
      const p = (par, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
      p(base, new THREE.CylinderGeometry(0.28, 0.32, 0.32, 24), M.orange, 0, 0.16, 0); p(base, new THREE.TorusGeometry(0.29, 0.02, 6, 24), NEON.cyan, 0, 0.3, 0).rotation.x = Math.PI/2;
      const sh = new THREE.Group(); sh.position.y = 0.42; base.add(sh); p(sh, new THREE.SphereGeometry(0.17, 20, 14), M.gun, 0, 0, 0); p(sh, new THREE.CylinderGeometry(0.12, 0.12, 0.38, 20), M.orange, 0, 0, 0).rotation.z = Math.PI/2;
      p(sh, new THREE.BoxGeometry(0.2, 1.0, 0.24), M.orange, 0, 0.5, 0); p(sh, new THREE.BoxGeometry(0.04, 0.8, 0.03), NEON.yel, 0.11, 0.5, 0.1);
      const el = new THREE.Group(); el.position.y = 1.0; sh.add(el); p(el, new THREE.SphereGeometry(0.13, 18, 12), M.gun, 0, 0, 0); p(el, new THREE.CylinderGeometry(0.1, 0.1, 0.3, 18), M.orange, 0, 0, 0).rotation.z = Math.PI/2;
      p(el, new THREE.BoxGeometry(0.15, 0.8, 0.17), M.orange, 0, 0.4, 0);
      const wr = new THREE.Group(); wr.position.y = 0.8; el.add(wr); p(wr, new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16), M.gun, 0, 0, 0);
      p(wr, new THREE.CylinderGeometry(0.06, 0.03, 0.1, 12), M.steel, 0, 0.11, 0); p(wr, new THREE.SphereGeometry(0.025, 8, 6), NEON.red, 0, 0.17, 0);
      [-1, 1].forEach(sd=>p(wr, new THREE.BoxGeometry(0.025, 0.16, 0.05), M.steel, sd*0.05, 0.2, 0));
      // its cable, along the arm
      const beacon = cyl(NEON.yel, ax + 0.4, 0.42, az + 0.3, 0.04, 0.04, 0.08, 12); L.flick.push(beacon);
      L.arms.push({ base, sh, el, wr, ph });
      solid(ax - 0.6, ax + 0.6, az - 0.6, az + 0.6, 2.4); });
    { const hx = X(-0.6), hz = -42.0;
      cyl(M.dark, hx, 0.45, hz, 0.55, 0.62, 0.9, 40); cyl(M.gun, hx, 0.92, hz, 0.7, 0.7, 0.05, 48); const r = mesh(new THREE.TorusGeometry(0.66, 0.02, 6, 48), NEON.cyan, hx, 0.95, hz); r.rotation.x = Math.PI/2;
      mesh(new THREE.CircleGeometry(0.6, 48), addv(new THREE.Color(0.2, 1.2, 1.6), 0.35), hx, 0.951, hz).rotation.x = -Math.PI/2;
      // the projection: a cone of light, and the prototype's schematic turning in it
      const cone = mesh(new THREE.CylinderGeometry(0.45, 0.12, 0.9, 32, 1, true), fresnelMat(0x38d8ff, 0.35, 0.6, { side:THREE.DoubleSide, scan:true }), hx, 1.42, hz); L.shaders.push(cone.material);
      const hm = holoMat(0x50e0ff); L.shaders.push(hm); L.holo = new THREE.Group(); L.holo.position.set(hx, 1.25, hz); g.add(L.holo);
      L.holoMat = hm; L.holoAt = [hx, hz];
      lights.push({ x:hx, y:1.4, z:hz, col:new THREE.Color(0x40d8ff), k:2, d:4 });
      solid(hx - 0.72, hx + 0.72, hz - 0.72, hz + 0.72, 1.0); }

    /* ---------------------------------------------------- THE DOOR WALL: coats, safety, signs */
    for(let k = 0; k < 3; k++){ const cx = X(-3.6) + k*0.55; cyl(M.steel, cx, 1.85, z1 - 0.05, 0.015, 0.015, 0.1, 8).rotation.x = Math.PI/2;
      const coat = mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.05, 12, 1, true), std({ color:0xf0f2f4, roughness:0.8, side:THREE.DoubleSide }), cx, 1.32, z1 - 0.14); coat.scale.z = 0.5; }
    bx(M.red, X(-0.5), 0.55, z1 - 0.1, 0.18, 0.5, 0.15); cyl(M.black, X(-0.5), 0.85, z1 - 0.1, 0.02, 0.02, 0.1, 8);              // the extinguisher
    bx(M.yellow, X(9.0), 1.9, z1 - 0.1, 0.5, 0.06, 0.06); cyl(M.yellow, X(9.0), 2.2, z1 - 0.3, 0.2, 0.15, 0.06, 20); bx(std({ color:0x2a9a4a }), X(9.0), 2.6, z1 - 0.06, 0.6, 0.3, 0.02);   // eyewash and shower
    // the E-stop on its post, by the door
    cyl(M.yellow, X(3.6), 0.6, z1 - 0.5, 0.06, 0.06, 1.2, 12); bx(M.yellow, X(3.6), 1.25, z1 - 0.5, 0.18, 0.18, 0.12); cyl(NEON.red, X(3.6), 1.25, z1 - 0.58, 0.06, 0.06, 0.04, 16).rotation.x = Math.PI/2;
    solid(X(3.5), X(3.7), z1 - 0.6, z1 - 0.4, 1.4);
    const sign = (lines, o, x, y, z, ry, w, h) => mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:signTex(lines, o) }), x, y, z, ry);
    sign([['Ψ CONTAINMENT', 64], ['AUTHORIZED PERSONNEL ONLY', 30]], { top:100 }, RX, 4.2, z0 + 0.13, 0, 1.6, 0.8);
    sign([['DANGER', 70], ['HIGH ENERGY FIELD', 34], ['NO METAL · NO PACEMAKERS', 24]], { bg:'#d02040', ink:'#ffffff', top:96 }, X(-0.5), 2.4, z1 - 0.08, Math.PI, 0.9, 0.45);
    sign([['E-STOP', 80], ['PRESS IN CASE OF HUM', 26]], { top:110 }, X(3.6), 1.75, z1 - 0.09, Math.PI, 0.5, 0.25);
    [[0, X(-2.2), 2.4, z1 - 0.08, Math.PI], [1, x1 - 0.08, 2.45, -38.6, -Math.PI/2], [2, X(10.0), 2.5, z0 + 0.13, 0]].forEach(([k, px, py, pz, ry])=>mesh(new THREE.PlaneGeometry(0.7, 1.0), std({ map:poster(k), roughness:0.8 }), px, py, pz, ry));
    // the whiteboard, back wall left
    mesh(new THREE.PlaneGeometry(4.8, 2.0), std({ map:whiteboard(), roughness:0.22 }), X(-1.6), 1.85, z0 + 0.13); bx(M.steel, X(-1.6), 0.82, z0 + 0.2, 5.0, 0.04, 0.12);
    for(let k = 0; k < 4; k++) cyl(std({ color:[0x1a3a8a, 0xd02040, 0x1a1a1a, 0x2a8a3a][k] }), X(-3.5) + k*0.12, 0.86, z0 + 0.22, 0.012, 0.012, 0.13, 8).rotation.z = Math.PI/2;
    // lights for the door end of the room (the walk in) and the teacher's desk
    lights.push({ x:X(2), y:H - 1.1, z:z1 - 1.6, col:new THREE.Color(0xcfe0ff), k:3.2, d:8 });
    lights.push({ x:X(9.4), y:1.3, z:-45.4, col:new THREE.Color(0xffb878), k:1.8, d:4 });

    /* ---------------------------------------------------- the moving parts */
    L.tick = (dt, u) => tick(L, dt, u);
    return L;
  }

  /* ================================================================ THE PROTOTYPE */
  function robot(){
    const r = new THREE.Group(), shell = std({ color:0xeef0f2, roughness:0.3, metalness:0.25 }), dark = std({ color:0x1c2028, roughness:0.4, metalness:0.7 });
    const eye = new THREE.MeshStandardMaterial({ color:0x080808, emissive:new THREE.Color(0.2, 0.9, 1.0), emissiveIntensity:0, roughness:0.1 });
    const ringM = new THREE.MeshStandardMaterial({ color:0x111111, emissive:new THREE.Color(1, 0.2, 0.2), emissiveIntensity:2 });
    const P = (par, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
    const body = new THREE.Group(); r.add(body);
    const rings = [];
    const joint = (par, x, y, z, rad, rot) => { const j = P(par, new THREE.TorusGeometry(rad, rad*0.28, 8, 20), ringM, x, y, z); if(rot) j.rotation.set(rot[0], rot[1], rot[2]); rings.push(j); return j; };
    // legs: thigh, a knee actuator, shin, a foot
    const legs = [-0.07, 0.07].map(x=>{ const leg = new THREE.Group(); leg.position.set(x, 0.24, 0); r.add(leg);
      P(leg, new THREE.CapsuleGeometry(0.03, 0.08, 6, 12), shell, 0, -0.05, 0); joint(leg, 0, -0.11, 0, 0.032, [0, Math.PI/2, 0]);
      P(leg, new THREE.CapsuleGeometry(0.026, 0.07, 6, 12), dark, 0, -0.17, 0); P(leg, new THREE.BoxGeometry(0.06, 0.025, 0.09), shell, 0, -0.225, 0.015);
      return leg; });
    // pelvis, a spine cable, the chest shell with its panel
    P(body, new THREE.BoxGeometry(0.17, 0.05, 0.1), dark, 0, 0.26, 0);
    P(body, new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), dark, 0, 0.3, -0.03);
    const chest = P(body, new THREE.SphereGeometry(0.12, 28, 20), shell, 0, 0.37, 0); chest.scale.set(1.1, 0.95, 0.8);
    for(let k = 0; k < 4; k++) P(body, new THREE.BoxGeometry(0.06, 0.006, 0.02), dark, -0.06, 0.34 + k*0.018, -0.09);
    const panel = P(body, new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshStandardMaterial({ color:0x0a0c10, emissive:new THREE.Color(1, 0.25, 0.15), emissiveIntensity:0.9 }), 0, 0.37, 0.097);
    joint(body, 0, 0.3, 0, 0.05, [Math.PI/2, 0, 0]);
    // head: a helmet, a visor, an antenna
    const head = new THREE.Group(); head.position.y = 0.5; body.add(head);
    joint(head, 0, -0.04, 0, 0.03, [Math.PI/2, 0, 0]);
    const hs = P(head, new THREE.SphereGeometry(0.075, 28, 20), shell, 0, 0.03, 0); hs.scale.set(1.15, 0.95, 1.05);
    const visor = P(head, new THREE.CapsuleGeometry(0.02, 0.09, 6, 12), eye, 0, 0.035, 0.07); visor.rotation.z = Math.PI/2;
    P(head, new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), dark, 0.05, 0.11, 0); P(head, new THREE.SphereGeometry(0.01, 8, 6), ringM, 0.05, 0.14, 0);
    // arms: a shoulder actuator, an elbow, a claw. The right one is `arm` (it waves)
    const mkArm = (sd) => { const a = new THREE.Group(); a.position.set(sd*0.15, 0.42, 0); body.add(a);
      joint(a, 0, 0, 0, 0.03, [0, Math.PI/2, 0]);
      P(a, new THREE.CapsuleGeometry(0.022, 0.07, 6, 10), shell, 0, -0.06, 0); joint(a, 0, -0.11, 0, 0.022, [0, Math.PI/2, 0]);
      P(a, new THREE.CapsuleGeometry(0.019, 0.06, 6, 10), dark, 0, -0.16, 0);
      [-1, 0, 1].forEach(f=>{ const c = P(a, new THREE.BoxGeometry(0.008, 0.035, 0.01), dark, f*0.012, -0.21, 0); c.rotation.z = f*0.3; });
      return a; };
    const arm = mkArm(1), arm2 = mkArm(-1); arm2.rotation.z = -0.15;
    r.userData = { on:false, t:0, body, head, arm, eye, panel, legs, rings };
    body.rotation.x = 0.5; head.rotation.x = 0.4; arm.rotation.z = 0.2;         // broken: slumped forward
    return r;
  }

  /* ================================================================ THE FRAME */
  function bolt(out, o, a, b, seg, amp){
    let px = a.x, py = a.y, pz = a.z;
    for(let i = 1; i <= seg; i++){ const f = i/seg, j = i === seg ? 0 : amp*Math.sin(f*Math.PI);
      const nx = a.x + (b.x - a.x)*f + rnd(-j, j), ny = a.y + (b.y - a.y)*f + rnd(-j, j), nz = a.z + (b.z - a.z)*f + rnd(-j, j);
      out[o++] = px; out[o++] = py; out[o++] = pz; out[o++] = nx; out[o++] = ny; out[o++] = nz; px = nx; py = ny; pz = nz; }
    return o;
  }
  function paintBig(c, t, sync){
    const x = c.getContext('2d'), W = c.width, H = c.height; x.fillStyle = '#04030a'; x.fillRect(0, 0, W, H);
    // the field as a model: rings in perspective, the core, the krackle
    const cx = 170, cy = H/2; x.lineWidth = 2;
    for(let k = 0; k < 5; k++){ x.strokeStyle = k % 2 ? 'rgba(80,220,255,0.8)' : 'rgba(255,80,220,0.8)'; x.beginPath(); x.ellipse(cx, cy, 40 + k*18, (40 + k*18)*Math.abs(Math.sin(t*0.6 + k)), t*0.3 + k, 0, 7); x.stroke(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 14 + 3*Math.sin(t*8), 0, 7); x.fill();
    x.fillStyle = '#ff4fe0'; x.font = font(16); x.fillText('Ψ-FIELD MODEL · LIVE', 20, 26);
    // a waterfall
    x.fillStyle = '#9fd8ff'; x.fillText('SPECTRAL WATERFALL', 360, 26);
    for(let r = 0; r < 18; r++) for(let k = 0; k < 40; k++){ const v = Math.abs(Math.sin(k*0.35 + r*0.4 - t*3))*(k === 9 || k === 23 ? 1 : 0.3); x.fillStyle = `rgba(${Math.round(255*v)},${Math.round(80 + 120*v)},255,${0.2 + v*0.8})`; x.fillRect(360 + k*8, 40 + r*11, 7, 10); }
    // the status
    const st = sync ? 'STABLE — LOCKED' : 'UNSTABLE', col = sync ? '#38ffd0' : (Math.sin(t*6) > 0 ? '#ff3f6a' : '#ffd23d');
    x.fillStyle = col; x.font = font(54); x.fillText(st, 720, 120); x.font = font(20); x.fillStyle = '#e8e6d8'; x.fillText('CONTAINMENT ' + (sync ? 98 : Math.round(55 + 30*Math.sin(t*0.9))) + '%', 720, 160);
    x.fillText('FIELD HELD ' + (t % 600).toFixed(1) + ' s', 720, 190); x.fillText('TRIAL 44', 720, 220);
  }
  function tick(L, dt, u){
    L.t += dt; const t = L.t;
    const pulse = 0.55 + 0.25*Math.sin(t*3.1) + 0.15*Math.sin(t*11.7) + (Math.random() < 0.03 ? 0.6 : 0);
    L.shaders.forEach(m=>{ if(m.uniforms.uT) m.uniforms.uT.value = t; if(m.uniforms.uPulse) m.uniforms.uPulse.value = pulse; });
    L.core.scale.setScalar(0.95 + pulse*0.12); L.ink.scale.setScalar((0.95 + pulse*0.12)*1.09);
    L.lattice.rotation.set(t*0.7, t*1.1, t*0.3); L.lattice2.rotation.set(-t*0.4, t*0.6, t*0.9);
    L.shells.forEach((s, i)=>s.scale.setScalar(1 + 0.08*Math.sin(t*2.2 + i) + pulse*0.05));
    L.ring.forEach((r, i)=>{ r.rotation.x += dt*(0.45 + i*0.25); r.rotation.y += dt*(0.6 - i*0.2); });
    L.burst.material.rotation = t*0.15; L.burst.material.opacity = 0.1 + 0.16*pulse;
    L.waves.forEach(w=>{ const k = (t*0.55 + w.userData.ph) % 1; w.scale.setScalar(0.2 + k*2.6); w.material.opacity = (1 - k)*0.9; });
    // lightning, re-drawn
    L.arcT -= dt;
    if(L.arcT <= 0){ L.arcT = 0.045 + Math.random()*0.04;
      const c = L.boltCfg, P = L.bolts.geometry.attributes.position, o0 = new V3(0, L.at[1], 0); let o = 0;
      for(let b = 0; b < c.NB; b++){
        // four to the coil tips; the rest wild, off the core to somewhere on the glass
        const end = b < 4 ? c.tips[b] : new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).setLength(0.9).add(o0);
        if(Math.random() < (b < 4 ? 0.7 : 0.5)) o = bolt(P.array, o, o0.clone().add(end.clone().sub(o0).setLength(0.18)), end, c.SEG, b < 4 ? 0.14 : 0.08);
        else for(let i = 0; i < c.SEG*2; i++){ P.array[o++] = 0; P.array[o++] = o0.y; P.array[o++] = 0; }          // this one is off: collapsed into the core
      }
      P.needsUpdate = true; L.bolts.material.opacity = 0.7 + Math.random()*0.3;
      // the Tesla coil
      const TP = L.tArcs.geometry.attributes.position; let q = 0;
      for(let b = 0; b < 4; b++){ const e = L.tesla.clone().add(new V3(rnd(-0.35, 0.35), rnd(-0.1, 0.35), rnd(-0.35, 0.35))); q = Math.random() < 0.6 ? bolt(TP.array, q, L.tesla, e, 10, 0.05) : (TP.array.fill(0, q, q + 60), q + 60); }
      TP.needsUpdate = true; L.tLight.mul = 0.5 + Math.random();
    }
    L.light.mul = 0.75 + pulse*0.55;
    L.flick.forEach((m, i)=>{ m.visible = Math.sin(t*(3 + i) + i*1.7) > -0.85; });
    // dust, drifting
    if(L.dust){ const P = L.dust.geometry.attributes.position, b = L.dust.userData.base; for(let i = 0; i < P.count; i++){ P.array[i*3] = b[i*3] + Math.sin(t*0.2 + i)*0.15; P.array[i*3 + 1] = b[i*3 + 1] + Math.sin(t*0.13 + i*0.7)*0.2; } P.needsUpdate = true; }
    L.arms.forEach(A=>{ const q = t*0.5 + A.ph; A.base.rotation.y = Math.sin(q)*0.9; A.sh.rotation.z = -0.35 + Math.sin(q*1.3)*0.3; A.el.rotation.z = 1.0 + Math.sin(q*0.9)*0.4; A.wr.rotation.y = q*2; });
    if(L.holo){ L.holo.rotation.y = t*0.6; L.holoMat.uniforms.uK.value = 2.6 + (Math.random() < 0.05 ? -1.8 : 0); }
    // screens
    if(t > L.mon.next){ L.mon.next = t + 0.1;
      if(L.paint) L.paint(L.mon.c, t, !!(u && u.on)); L.mon.t.needsUpdate = true;
      paintBig(L.mon2.c, t, !!(u && u.on)); L.mon2.t.needsUpdate = true;
      const s = L.scope.c, x = s.getContext('2d'); x.fillStyle = '#031208'; x.fillRect(0, 0, 256, 192); x.strokeStyle = 'rgba(56,255,140,0.15)'; for(let k = 0; k < 8; k++){ x.beginPath(); x.moveTo(k*32, 0); x.lineTo(k*32, 192); x.stroke(); }
      x.strokeStyle = '#38ff8c'; x.lineWidth = 3; x.beginPath(); for(let k = 0; k < 256; k++) x.lineTo(k, 96 - 60*Math.sin(k*0.08 + t*6)*(u && u.on ? 1 : (0.6 + 0.4*Math.sin(k*0.31)))); x.stroke(); L.scope.t.needsUpdate = true;
      const r = L.rack.c, rx = r.getContext('2d'); for(let k = 0; k < 40; k++){ const row = Math.floor(Math.random()*24), col = Math.floor(Math.random()*6); rx.fillStyle = Math.random() < 0.5 ? '#1a2026' : ['#38ffd0', '#b48aff', '#ffb030', '#ff3fd0'][k % 4]; rx.fillRect(80 + col*6, 12 + row*21, 4, 4); } L.rack.t.needsUpdate = true; }
  }
  /* the hologram: the prototype, schematic, turning over the table */
  function holoOf(L, model){
    if(!L.holo || L.holo.children.length) return;
    const c = model.clone(true); c.traverse(o=>{ if(o.isMesh) o.material = L.holoMat; }); c.scale.setScalar(1.25); c.position.set(0, -0.28, 0); c.rotation.set(0, 0, 0);
    c.userData = {}; L.holo.add(c);
  }
  return { build, robot, holoOf };
})();
