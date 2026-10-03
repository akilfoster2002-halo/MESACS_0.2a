/* =====================================================================
   ROBIN RYU, IN SOLID 3-D: the quest's title as real blocks of gold.

   1. THE LETTERS' OUTLINES. Each letter is drawn once in Dela Gothic One
      on a canvas, its edge traced (marching squares) and thinned to a
      polygon — holes and all — so no font file has to be converted.
   2. BLOCKS. Each outline is extruded nearly half a letter deep, with a
      bevel: a gold face, bronze sides.
   3. THE SHOW, the same beats as the flat title's CSS: the letters spin in
      one by one, rock back and forth into and out of the page, the word
      shakes, the slash streaks through, every letter is cut along it (two
      clipping planes per letter), the halves part, and at the end fly
      apart. RRTITLE.play(host) runs it over a host element whose
      `.rr-mark` says where the word sits and how big it is.
   ===================================================================== */
const RRTITLE = (() => {
  const FONT = "'Dela Gothic One'", GPX = 220;        // the size a letter is traced at
  const DEPTH = 0.44, BEVEL = 0.028;                   // in em
  const END = 5.6;                                     // seconds, the last of the halves gone
  const glyphs = {};
  let R = null, scene, cam, word, letters = [], slash, glint, t0 = 0, raf = 0, host = null, canvas = null, onEnd = null;

  /* ---------- 1. a letter's outline, from a canvas ---------- */
  function trace(ch){
    const c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = `400 ${GPX}px ${FONT}`;
    const adv = x.measureText(ch).width, pad = 12, W = Math.ceil(adv + pad*2 + GPX*0.2), H = Math.ceil(GPX*1.5), base = Math.round(GPX*1.15);
    c.width = W; c.height = H;
    x.font = `400 ${GPX}px ${FONT}`; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.fillText(ch, pad, base);
    const A = x.getImageData(0, 0, W, H).data, v = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 0 : A[(j*W + i)*4 + 3]/255;
    // marching squares on the 0.5 contour: segments between cell edges, linked into loops
    const pos = {}, adj = {};
    const pt = (id) => { if(pos[id]) return pos[id];
      const [k, a, b] = [id[0], ...id.slice(1).split(',').map(Number)];
      let p; if(k === 'h'){ const u = v(a, b), w = v(a + 1, b); p = [a + (0.5 - u)/((w - u) || 1e-6), b]; }
             else { const u = v(a, b), w = v(a, b + 1); p = [a, b + (0.5 - u)/((w - u) || 1e-6)]; }
      return (pos[id] = p); };
    const link = (p, q) => { (adj[p] = adj[p] || []).push(q); (adj[q] = adj[q] || []).push(p); };
    const CASES = { 1:[['L','B']], 2:[['B','R']], 3:[['L','R']], 4:[['T','R']], 5:[['T','R'],['L','B']], 6:[['T','B']], 7:[['T','L']],
                    8:[['T','L']], 9:[['T','B']], 10:[['T','L'],['B','R']], 11:[['T','R']], 12:[['L','R']], 13:[['R','B']], 14:[['L','B']] };
    for(let j = -1; j < H; j++) for(let i = -1; i < W; i++){
      const n = (v(i, j) > 0.5)*8 + (v(i + 1, j) > 0.5)*4 + (v(i + 1, j + 1) > 0.5)*2 + (v(i, j + 1) > 0.5);
      const segs = CASES[n]; if(!segs) continue;
      const E = { T:`h${i},${j}`, B:`h${i},${j + 1}`, L:`v${i},${j}`, R:`v${i + 1},${j}` };
      segs.forEach(([a, b]) => link(E[a], E[b]));
    }
    const seen = new Set(), loops = [];
    for(const s in adj){ if(seen.has(s)) continue;
      const loop = []; let prev = null, cur = s;
      while(cur && !seen.has(cur)){ seen.add(cur); loop.push(pt(cur)); const nx = adj[cur].find(q => q !== prev && !seen.has(q)); prev = cur; cur = nx; }
      if(loop.length > 8) loops.push(simplify(loop, 0.55));
    }
    // to em, y up, the baseline at 0 and the pen at 0
    const em = loops.map(L => L.map(([px, py]) => new THREE.Vector2((px - pad)/GPX, (base - py)/GPX)));
    const area = L => { let s = 0; for(let k = 0; k < L.length; k++){ const a = L[k], b = L[(k + 1)%L.length]; s += a.x*b.y - b.x*a.y; } return s/2; };
    const inside = (p, L) => { let c_ = false; for(let k = 0, m = L.length - 1; k < L.length; m = k++){ const a = L[k], b = L[m];
      if((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x)*(p.y - a.y)/(b.y - a.y) + a.x) c_ = !c_; } return c_; };
    const depth = em.map((L, k) => em.reduce((d, M, m) => d + (m !== k && inside(L[0], M) ? 1 : 0), 0));
    const shapes = [];
    em.forEach((L, k) => { if(depth[k] % 2) return;
      const outer = area(L) < 0 ? L.slice().reverse() : L, s = new THREE.Shape(outer);
      em.forEach((M, m) => { if(depth[m] === depth[k] + 1 && inside(M[0], L)) s.holes.push(new THREE.Path(area(M) > 0 ? M.slice().reverse() : M)); });
      shapes.push(s); });
    return { shapes, adv:adv/GPX };
  }
  function simplify(P, tol){            // Ramer–Douglas–Peucker, on a closed loop
    const keep = new Uint8Array(P.length); keep[0] = 1; let far = 0, fd = -1;
    P.forEach((p, k) => { const d = (p[0] - P[0][0])**2 + (p[1] - P[0][1])**2; if(d > fd){ fd = d; far = k; } }); keep[far] = 1;
    const rdp = (a, b) => { const [ax, ay] = P[a], [bx, by] = P[b % P.length], L = Math.hypot(bx - ax, by - ay) || 1e-6; let m = -1, md = tol;
      for(let k = a + 1; k < b; k++){ const [px, py] = P[k], d = Math.abs((bx - ax)*(ay - py) - (ax - px)*(by - ay))/L; if(d > md){ md = d; m = k; } }
      if(m > 0){ keep[m] = 1; rdp(a, m); rdp(m, b); } };
    rdp(0, far); rdp(far, P.length);
    return P.filter((_, k) => keep[k]);
  }
  function glyph(ch){
    if(glyphs[ch]) return glyphs[ch];
    const { shapes, adv } = trace(ch);
    const g = new THREE.ExtrudeGeometry(shapes, { depth:DEPTH, bevelEnabled:true, bevelThickness:BEVEL, bevelSize:BEVEL*0.8, bevelSegments:3, curveSegments:4 });
    g.computeBoundingBox(); const bb = g.boundingBox, c = new THREE.Vector3(); bb.getCenter(c);
    g.translate(-c.x, -c.y, -c.z);                 // about its own middle, so it can rock in place
    g.computeVertexNormals();
    return (glyphs[ch] = { g, adv, cx:c.x, cy:c.y });
  }

  /* ---------- 2. the stage ---------- */
  function gradTex(){
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fffbd0'); gr.addColorStop(0.3, '#ffe640'); gr.addColorStop(1, '#f2a400');
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  }
  function streakTex(){
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
    const h = x.createLinearGradient(0, 0, 256, 0); h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.12, '#fff'); h.addColorStop(0.9, '#fff'); h.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = h; x.fillRect(0, 10, 256, 12);
    x.globalCompositeOperation = 'source-in'; const v = x.createLinearGradient(0, 10, 0, 22); v.addColorStop(0, 'rgba(255,240,170,.4)'); v.addColorStop(0.5, '#fff'); v.addColorStop(1, 'rgba(255,240,170,.4)');
    x.fillStyle = v; x.fillRect(0, 0, 256, 32);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function setup(){
    if(R) return true;
    try { canvas = document.createElement('canvas'); R = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true }); } catch(e){ R = null; return false; }
    canvas.className = 'rr-gl';
    R.localClippingEnabled = true; R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NoToneMapping;
    R.setClearColor(0x000000, 0);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, 1, 1, 20000);
    // a little studio for the gold to reflect
    const env = new THREE.Scene(), box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color:0x221a10, side:THREE.BackSide }));
    env.add(box);
    [[0, 4.5, 2, 8, 1.2, 0xffffff, 6], [-4.5, 1, 1, 0.8, 5, 0xffe2a0, 4], [4.5, -1, -2, 0.8, 4, 0xa0c8ff, 2.5], [0, -4.5, 0, 6, 0.8, 0xff9a30, 1.5]].forEach(([x, y, z, w, h, c, k]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(c).multiplyScalar(k), side:THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); });
    const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
    const key = new THREE.DirectionalLight(0xfff0d0, 3.6); key.position.set(-2, 3, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.6); rim.position.set(5, 1, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    glint = new THREE.PointLight(0xffffff, 0, 0, 1.4); scene.add(glint);
    word = new THREE.Group(); scene.add(word);
    slash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ map:streakTex(), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false }));
    slash.renderOrder = 9; word.add(slash);
    return true;
  }

  /* ---------- 3. the show ---------- */
  const rnd = (a, b) => a + Math.random()*(b - a);
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const backOut = (t, s = 1.9) => 1 + (s + 1)*(t - 1)**3 + s*(t - 1)**2;
  const easeIn = t => t*t*t;
  const easeOut = t => 1 - (1 - t)**3;
  let cut = null, size = 1, n = 0, face, side;

  function build(text){
    letters.forEach(L => { word.remove(L.pivot); L.mats.forEach(m => m.dispose()); }); letters = [];
    const gt = face ? null : gradTex();
    face = face || new THREE.MeshStandardMaterial({ map:gt, emissiveMap:gt, emissive:0xffffff, emissiveIntensity:0.8, metalness:0.1, roughness:0.3 });
    side = side || new THREE.MeshStandardMaterial({ color:0xb86e08, metalness:0.55, roughness:0.34, side:THREE.DoubleSide });
    const chars = [...text], gap = 0.085; let x = 0;
    const lay = chars.map(ch => { if(ch === ' '){ const s = { sp:true, x }; x += 0.42; return s; }
      const G = glyph(ch), s = { ch, G, x }; x += G.adv + gap; return s; });
    const width = x - gap;
    // the cut: from a little left of the word and low to a little right and high — the flat title's line
    const yLo = -0.02, yHi = 0.74, a = new THREE.Vector2(-0.04*width, yLo + 0.12*(yHi - yLo)), b = new THREE.Vector2(1.04*width, yHi - 0.12*(yHi - yLo));
    const dir = b.clone().sub(a).normalize(), nrm = new THREE.Vector3(-dir.y, dir.x, 0);
    cut = { a, b, nrm, along:dir, width };
    n = 0;
    lay.forEach(s => { if(s.sp) return;
      const i = n++, sideSign = i % 2 ? 1 : -1;
      const pivot = new THREE.Group(), top = new THREE.Group(), bot = new THREE.Group();
      // the letter's middle in the word, the word centred on 0
      pivot.position.set(s.x + s.G.cx - width/2, s.G.cy - 0.36, 0);
      pivot.add(top, bot); word.add(pivot);
      const planes = [new THREE.Plane(), new THREE.Plane()], mats = [];
      [[top, 0], [bot, 1]].forEach(([grp, h]) => {
        const f = face.clone(), sd = side.clone(); f.clippingPlanes = [planes[h]]; sd.clippingPlanes = [planes[h]]; f.transparent = sd.transparent = true;
        mats.push(f, sd); grp.add(new THREE.Mesh(s.G.g, [f, sd])); });
      // the cut line in this letter's own frame (its middle at 0)
      const off = new THREE.Vector3(pivot.position.x, pivot.position.y, 0);
      const c0 = new THREE.Vector3(a.x - width/2, a.y - 0.36, 0).sub(off);
      letters.push({ i, pivot, top, bot, planes, mats, c0, phase:i*0.62,
        from:{ x:rnd(0.4, 1.4)*sideSign, y:rnd(0.3, 1.2), z:-6, rx:rnd(-3.5, 3.5), ry:sideSign*rnd(6.3, 12.6), rz:rnd(-0.5, 0.5) },
        rt:rnd(2, 5), rb:-rnd(2, 5) });
    });
    slash.position.set(a.x - width/2, a.y - 0.36, DEPTH/2 + 0.08);
    slash.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    slash.userData.len = a.distanceTo(b);
  }

  const _n = new THREE.Vector3(), _p = new THREE.Vector3(), _m3 = new THREE.Matrix3();
  function frame(t){
    const nT = n*0.11, tShake = nT + 0.72, tSlash = nT + 0.95, tCut = nT + 1.14, tGlint = nT + 1.6, tOut = 4.65;
    // the word: tilted so the blocks' tops and left sides show, and shaken by the slash
    const sh = t > tShake && t < tShake + 0.34 ? (1 - (t - tShake)/0.34) : 0;
    word.rotation.set(0.26 + sh*0.02*Math.sin(t*90), 0.34, -0.04 + sh*0.012*Math.sin(t*70));
    word.position.set(sh*0.03*Math.sin(t*110), sh*0.02*Math.cos(t*95), 0);
    letters.forEach(L => {
      const s = clamp01((t - L.i*0.11)/0.85), e = backOut(s), f = L.from;
      // in: from far behind and spinning; then, settled, rocking back and forth into and out of the page
      const rock = clamp01((t - L.i*0.11 - 0.7)/0.6), w = t*2.6 + L.phase;
      L.pivot.position.z = f.z*(1 - e);
      L.pivot.rotation.set(f.rx*(1 - e) + rock*0.16*Math.sin(w*0.7 + 1), f.ry*(1 - e) + rock*0.55*Math.sin(w), f.rz*(1 - e) + rock*0.05*Math.sin(w*0.9));
      L.pivot.position.x = L.base.x + f.x*(1 - e); L.pivot.position.y = L.base.y + f.y*(1 - e);
      // the cut: the halves part along the slash, then fly apart
      const c = t < tCut ? 0 : backOut(clamp01((t - tCut)/0.22), 3);
      const o = clamp01((t - tOut - L.i*0.05)/0.75), oe = easeIn(o);
      L.top.position.set(c*0.05 + oe*1.9, c*0.024 + oe*1.1, oe*2); L.top.rotation.set(oe*L.rt, 0, oe*0.44);
      L.bot.position.set(-c*0.05 - oe*1.9, -c*0.024 - oe*1.1, oe*2); L.bot.rotation.set(oe*L.rb, 0, -oe*0.44);
      const op = clamp01(s*3)*(1 - o);
      L.mats.forEach(m => { m.opacity = op; m.visible = op > 0.002; m.depthWrite = op > 0.98; });
      L.cutOn = t >= tSlash + 0.12;
    });
    // the slash: a streak drawn across, then burnt out
    const sl = clamp01((t - tSlash)/0.2), burn = clamp01((t - 4.6)/0.5);
    slash.visible = t >= tSlash && burn < 1;
    const thick = burn < 0.4 ? 1 + 1.2*burn/0.4 : 2.2*(1 - (burn - 0.4)/0.6);
    slash.scale.set(slash.userData.len*easeOut(sl) + 1e-4, 0.07*thick + 1e-4, 1);
    slash.material.opacity = 1 - burn;
    // a glint sweeping along the gold
    const g = clamp01((t - tGlint)/1.1);
    glint.intensity = g > 0 && g < 1 ? 60*Math.sin(g*Math.PI) : 0;
    glint.position.set((g*1.3 - 0.65)*cut.width, 0.5, 0.9);
    word.updateMatrixWorld(true);
    // each half keeps only its side of the cut, the line moving with its half
    letters.forEach(L => [[L.top, 0, 1], [L.bot, 1, -1]].forEach(([grp, h, sg]) => {
      const P = L.planes[h];
      if(!L.cutOn){ P.set(new THREE.Vector3(0, 0, 1), 1e5); return; }
      _n.copy(cut.nrm).multiplyScalar(sg); _p.copy(L.c0);
      P.setFromNormalAndCoplanarPoint(_n, _p);
      P.applyMatrix4(grp.matrixWorld, _m3.getNormalMatrix(grp.matrixWorld));
    }));
  }

  function layout(){
    const mark = host.querySelector('.rr-mark'), hr = host.getBoundingClientRect(), mr = mark.getBoundingClientRect();
    const W = Math.max(1, hr.width), H = Math.max(1, hr.height), dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.setPixelRatio(dpr); R.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    cam.aspect = W/H; cam.position.set(0, 0, (H/2)/Math.tan(cam.fov*Math.PI/360)); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    // the mark's size, but never wider than nine-tenths of the screen
    size = Math.min(parseFloat(getComputedStyle(mark).fontSize) || 100, 0.9*W/(cut.width + 0.4));
    word.scale.setScalar(size);
    scene.position.set(mr.left + mr.width/2 - hr.left - W/2, -(mr.top + mr.height/2 - hr.top - H/2), 0);
  }
  function render(t){ frame(t); R.render(scene, cam); }
  function loop(){
    const t = (performance.now() - t0)/1000;
    if(!host || t > END){ stop(); return; }
    render(t); raf = requestAnimationFrame(loop);
  }
  function stop(){
    cancelAnimationFrame(raf); raf = 0;
    if(canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if(host) host.classList.remove('rr3d');
    host = null; const f = onEnd; onEnd = null; if(f) f();
  }
  /* run the show over `host` (which holds a .rr-mark); false when there is no WebGL, and the flat title plays instead */
  function play(el, text, done){
    if(!window.THREE || !setup()) return false;
    if(host) stop();
    host = el; onEnd = done || null; t0 = performance.now();
    el.classList.add('rr3d'); el.appendChild(canvas);
    const go = () => { if(host !== el) return;
      build(text || 'ROBIN RYU');
      letters.forEach(L => { L.base = L.pivot.position.clone(); });
      layout(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
    (document.fonts && document.fonts.load ? document.fonts.load(`400 ${GPX}px ${FONT}`).catch(() => {}) : Promise.resolve()).then(go);
    return true;
  }
  return { play, stop, get playing(){ return !!host; },
           /* for tests and the console */
           _render:t => { if(host && letters.length){ layout(); render(t); } },
           _hold:t => { cancelAnimationFrame(raf); raf = 0; if(host && letters.length){ layout(); render(t); } }, _trace:trace, _glyph:glyph, get _scene(){ return scene; } };
})();
if(typeof module !== 'undefined') module.exports = RRTITLE;
