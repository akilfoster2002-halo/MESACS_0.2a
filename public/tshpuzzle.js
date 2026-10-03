/* =====================================================================
   TSH — ROBIN'S BENCH (The Other Robin). The robot in Room 120 is a lot
   more machine than anybody in the building should be able to fix, and
   these are how she fixes it: not engineering menus, but the inside of
   the thing turned into something you can touch.

     ROUTE    circuit tiles: turn them until power runs from the cell to
              the processor. One way through at first; then the board
              fills with pieces and there is more than one.
     SIGNAL   matching signals on a grid: join each pair, no two crossing.
              Every level is generated from a filled solution, so every
              level has one.
     GEARS    rings of gears, each one turning its neighbour: line every
              notch up and the drive runs, centre to rim.
     DIAGNOSE the second thing: examine it — the light, the battery, the
              motor, the sensor, the log — and say what is actually wrong.
     FREQ     the Psi field's oscillation, live: tune the robot to it —
              frequency, then phase, then a second harmonic — until it locks.
   With { psi:true }, ROUTE carries the field's energy to the robot's core
   and GEARS are its actuators, lined up to move with the field.

   Drawn on one canvas in a panel over the room, in her colours: black
   glass, teal power, a pink for what is wrong.

     TSHPUZZLE.open('route', { levels:3 }, done)   // done() when solved
   ===================================================================== */
window.TSHPUZZLE = (function(){
  const TEAL = '#38ffd0', PINK = '#ff3fd0', DIM = '#1f3a36', INK = '#e8fff8';
  let P = null;                                   // the open puzzle
  const font = (px, w) => (w || 'bold ') + px + 'px ' + (window.uiFont ? uiFont() : 'sans-serif');

  /* ------------------------------------------------------------ panel */
  function panel(title, sub){
    const host = document.getElementById('tsh') || document.body;
    const el = document.createElement('div'); el.className = 'tsh-puz';
    el.innerHTML = `<div class="tsh-puz-card"><div class="tsh-puz-h"><b>${title}</b><span class="tsh-puz-lv"></span></div>
      <p class="tsh-puz-sub">${sub}</p><canvas width="640" height="520"></canvas><div class="tsh-puz-side"></div><p class="tsh-puz-msg"></p></div>`;
    host.appendChild(el);
    if(document.pointerLockElement) document.exitPointerLock();
    const c = el.querySelector('canvas');
    return { el, c, x:c.getContext('2d'), lv:el.querySelector('.tsh-puz-lv'), msg:el.querySelector('.tsh-puz-msg'), side:el.querySelector('.tsh-puz-side') };
  }
  function close(){ if(P){ P.ui.el.remove(); cancelAnimationFrame(P.raf); P = null; } }
  function pt(e, c){ const r = c.getBoundingClientRect(); return [(e.clientX - r.left)*c.width/r.width, (e.clientY - r.top)*c.height/r.height]; }
  function glowLine(x, pts, col, w, glow){
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = col; x.lineWidth = w; if(glow){ x.shadowColor = col; x.shadowBlur = glow; }
    x.beginPath(); pts.forEach(([a, b], i)=>i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); x.restore();
  }
  function rr(x, a, b, w, h, r){ x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function rand(s){ return ()=>{ s = (s*16807) % 2147483647; return (s - 1)/2147483646; }; }

  /* ============================================================ ROUTE
     A tile is a mask of the sides it connects: N 1, E 2, S 4, W 8. */
  const rot = m => ((m << 1) | (m >> 3)) & 15;
  const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];     // dx, dy, my side, its side
  function routeLevel(n, seed){
    const r = rand(seed), g = Array.from({ length:n }, ()=>Array(n).fill(0));
    const sy = Math.floor(r()*n), ey = Math.floor(r()*n);
    // a wandering path from the cell (west edge, row sy) to the processor (east edge, row ey)
    let x = 0, y = sy, seen = new Set(['0,' + sy]), path = [[0, sy]];
    while(!(x === n - 1 && y === ey)){
      const opts = DIRS.map(([dx, dy])=>[x + dx, y + dy]).filter(([a, b])=>a >= 0 && b >= 0 && a < n && b < n && !seen.has(a + ',' + b));
      if(!opts.length){ return routeLevel(n, seed + 7); }
      opts.sort((p, q)=>(Math.abs(p[0] - (n - 1)) + Math.abs(p[1] - ey) + r()*2.2) - (Math.abs(q[0] - (n - 1)) + Math.abs(q[1] - ey) + r()*2.2));
      [x, y] = opts[0]; seen.add(x + ',' + y); path.push([x, y]);
    }
    path.forEach(([a, b], i)=>{
      const link = (c, d) => { const k = DIRS.findIndex(([dx, dy])=>a + dx === c && b + dy === d); return k < 0 ? 0 : DIRS[k][2]; };
      let m = 0;
      if(i === 0) m |= 8; else m |= link(...path[i - 1]);
      if(i === path.length - 1) m |= 2; else m |= link(...path[i + 1]);
      g[b][a] = m;
    });
    // the rest of the board: pieces that might be part of another way through (later levels: a lot of them)
    const pieces = [5, 3, 7, 5, 3, 11, 15];
    for(let b = 0; b < n; b++) for(let a = 0; a < n; a++) if(!g[b][a]) g[b][a] = r() < 0.15 + n*0.06 ? pieces[Math.floor(r()*pieces.length)] : 0;
    const sol = g.map(row=>row.slice());               // (kept: the console can solve a board, for testing)
    // and every piece turned some way it was not
    for(let b = 0; b < n; b++) for(let a = 0; a < n; a++){ let k = 1 + Math.floor(r()*3); while(k--) g[b][a] = rot(g[b][a]); }
    return { n, g, sy, ey, sol };
  }
  /* THE NETWORK (boards 2 and 3): the whole board is one circuit — a tree through every tile, no loops — and
     every tile is turned wrong. Power has to reach every tile, and no tile may leave a connection hanging:
     a loose end is a short. (The classic network puzzle: far more turning than a single route, and the pink
     loose ends tell you where you are wrong.) A random tree grown out from the cell, a tile at a time. */
  function netLevel(n, seed){
    const r = rand(seed), g = Array.from({ length:n }, ()=>Array(n).fill(0));
    const sy = Math.floor(r()*n), ey = Math.floor(r()*n), inT = new Set(['0,' + sy]), edges = [];
    const addEdges = (a, b) => DIRS.forEach(([dx, dy, me, it])=>{ const c = a + dx, d = b + dy; if(c >= 0 && d >= 0 && c < n && d < n) edges.push([a, b, c, d, me, it]); });
    addEdges(0, sy);
    while(inT.size < n*n){
      const i = Math.floor(r()*edges.length), [a, b, c, d, me, it] = edges.splice(i, 1)[0];
      if(inT.has(c + ',' + d)) continue;
      // keep it from branching into a star: a tile that already has three ways out takes a fourth only rarely
      const bits = m => (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1);
      if(bits(g[b][a]) >= 3 && r() < 0.8){ edges.push([a, b, c, d, me, it]); if(edges.length > 4*n*n) edges.length = 0; continue; }
      g[b][a] |= me; g[d][c] |= it; inT.add(c + ',' + d); addEdges(c, d);
    }
    g[sy][0] |= 8; g[ey][n - 1] |= 2;
    const sol = g.map(row=>row.slice());
    for(let b = 0; b < n; b++) for(let a = 0; a < n; a++){ let k = 1 + Math.floor(r()*3); while(k--) g[b][a] = rot(g[b][a]); }
    return { n, g, sy, ey, sol, net:true };
  }
  function powered(L){
    const on = new Set(), q = [];
    if(L.g[L.sy][0] & 8){ on.add('0,' + L.sy); q.push([0, L.sy]); }
    while(q.length){ const [a, b] = q.shift(), m = L.g[b][a];
      DIRS.forEach(([dx, dy, me, it])=>{ const c = a + dx, d = b + dy; if(!(m & me) || c < 0 || d < 0 || c >= L.n || d >= L.n) return;
        if((L.g[d][c] & it) && !on.has(c + ',' + d)){ on.add(c + ',' + d); q.push([c, d]); } }); }
    const reach = on.has((L.n - 1) + ',' + L.ey) && !!(L.g[L.ey][L.n - 1] & 2);
    if(!L.net) return { on, done:reach, loose:new Set() };
    // the network: every tile lit, and no connection left hanging (the cell's and the processor's ports excepted)
    const loose = new Set();
    for(let b = 0; b < L.n; b++) for(let a = 0; a < L.n; a++){ const m = L.g[b][a];
      DIRS.forEach(([dx, dy, me, it])=>{ if(!(m & me)) return; const c = a + dx, d = b + dy;
        if(c < 0 && b === L.sy && me === 8) return; if(c >= L.n && b === L.ey && me === 2) return;
        if(c < 0 || d < 0 || c >= L.n || d >= L.n || !(L.g[d][c] & it)) loose.add(a + ',' + b + ',' + me); }); }
    return { on, loose, done:reach && on.size === L.n*L.n && !loose.size };
  }
  function route(o, done){
    const psi = !!o.psi, SRC = psi ? 'FIELD' : 'CELL', DST = psi ? 'CORE' : 'CPU';
    const ui = psi ? panel('ROUTE THE PSI ENERGY', 'Tap a conduit to turn it. Carry the field\'s energy to the robot\'s core — and nowhere else.')
                   : panel('ROUTE THE POWER', 'Click a tile to turn it. Get power from the cell to the processor.');
    // a single route to warm up; then the network, twice, bigger
    const BOARDS = [[4, 'route'], [5, 'net'], [6, 'net']].slice(0, o.levels || 3), sizes = BOARDS;
    const make = i => BOARDS[i][1] === 'net' ? netLevel(BOARDS[i][0], 211 + i*53) : routeLevel(BOARDS[i][0], 101 + i*37);
    let lv = 0, L = make(0), solved = 0, spin = {};
    const geo = () => { const n = L.n, s = Math.min(400/n, 84), w = s*n; return { n, s, ox:(640 - w)/2, oy:(520 - w)/2 + 6 }; };
    function draw(t){
      const x = ui.x, G = geo(), pw = powered(L);
      x.clearRect(0, 0, 640, 520);
      // the cell and the processor
      const cy = G.oy + (L.sy + 0.5)*G.s, py = G.oy + (L.ey + 0.5)*G.s;
      x.fillStyle = '#0b1513'; rr(x, G.ox - 70, cy - 26, 52, 52, 8); x.fill(); x.strokeStyle = TEAL; x.lineWidth = 2; x.stroke();
      x.fillStyle = TEAL; x.font = font(12); x.textAlign = 'center'; x.fillText(SRC, G.ox - 44, cy + 4);
      glowLine(x, [[G.ox - 18, cy], [G.ox, cy]], TEAL, 6, 12);
      x.fillStyle = '#0b1513'; rr(x, G.ox + G.n*G.s + 18, py - 30, 60, 60, 6); x.fill(); x.strokeStyle = pw.done ? TEAL : '#556'; x.stroke();
      for(let k = 0; k < 4; k++){ x.fillStyle = pw.done ? TEAL : '#556'; x.fillRect(G.ox + G.n*G.s + 26 + k*12, py - 36, 4, 6); x.fillRect(G.ox + G.n*G.s + 26 + k*12, py + 30, 4, 6); }
      x.fillStyle = pw.done ? TEAL : '#889'; x.fillText(DST, G.ox + G.n*G.s + 48, py + 4);
      glowLine(x, [[G.ox + G.n*G.s, py], [G.ox + G.n*G.s + 18, py]], pw.done ? TEAL : '#334', 6, pw.done ? 12 : 0);
      // the tiles
      for(let b = 0; b < L.n; b++) for(let a = 0; a < L.n; a++){
        const X0 = G.ox + a*G.s, Y0 = G.oy + b*G.s, m = L.g[b][a], cx = X0 + G.s/2, cyy = Y0 + G.s/2, lit = pw.on.has(a + ',' + b);
        x.fillStyle = '#0d1715'; rr(x, X0 + 3, Y0 + 3, G.s - 6, G.s - 6, 10); x.fill();
        x.strokeStyle = 'rgba(56,255,208,0.12)'; x.lineWidth = 1; x.stroke();
        if(!m) continue;
        const sp = spin[a + ',' + b] || 0;
        x.save(); x.translate(cx, cyy); x.rotate(-sp*Math.PI/2);
        DIRS.forEach(([dx, dy, me])=>{ if(!(m & me)) return; const bad = lit && pw.loose.has(a + ',' + b + ',' + me);
          glowLine(x, [[0, 0], [dx*G.s/2, dy*G.s/2]], bad ? PINK : lit ? TEAL : DIM, G.s*0.16, lit ? 14 : 0); });
        x.fillStyle = lit ? TEAL : '#2a4a46'; x.beginPath(); x.arc(0, 0, G.s*0.11, 0, 7); x.fill();
        x.restore();
      }
      ui.lv.textContent = 'BOARD ' + (lv + 1) + ' / ' + sizes.length;
      if(pw.done && !solved){ solved = t; ui.msg.textContent = psi ? 'The field reaches the core.' : 'Power to the processor.'; window.TSH && TSH._cue && TSH._cue('win'); }
      if(solved && t - solved > 1100){ solved = 0; lv++; if(lv >= sizes.length){ close(); done && done(); return false; } L = make(lv); spin = {};
        ui.msg.className = 'tsh-puz-msg'; ui.msg.textContent = lv === 1 ? (psi ? 'Unstable energy leaks out of any open end. Every conduit lit, no loose ends (pink).' : 'The whole board is the circuit now. Every tile lit, no loose ends (pink).')
                                       : (psi ? 'The main manifold. Same rules, bigger.' : 'The main board. Same rules, bigger.'); }
      if(!solved && L.net){ const lit = pw.on.size, n2 = L.n*L.n, lo = [...pw.loose].filter(k=>pw.on.has(k.split(',').slice(0, 2).join(','))).length;
        ui.lv.textContent += ' · ' + lit + ' / ' + n2 + ' lit' + (lo ? ' · ' + lo + ' loose' : ''); }
      for(const k in spin){ spin[k] *= 0.75; if(spin[k] < 0.01) delete spin[k]; }
      return true;
    }
    ui.c.onpointerdown = e=>{ if(solved) return; const [px, py] = pt(e, ui.c), G = geo(), a = Math.floor((px - G.ox)/G.s), b = Math.floor((py - G.oy)/G.s);
      if(a < 0 || b < 0 || a >= L.n || b >= L.n || !L.g[b][a]) return; L.g[b][a] = rot(L.g[b][a]); spin[a + ',' + b] = 1; window.TSH && TSH._cue && TSH._cue('ui'); };
    run(ui, draw);
    P.solve = ()=>{ L.g = L.sol.map(r=>r.slice()); };
  }

  /* ============================================================ SIGNAL */
  const SIGNALS = [
    { n:5, ends:[[[1,1],[3,0]],[[4,0],[0,4]],[[3,2],[2,0]],[[0,3],[3,3]]], sol:['22201','20001','22221','33331','11111'] },
    { n:6, ends:[[[1,1],[0,0]],[[2,3],[1,0]],[[5,2],[3,0]],[[2,2],[4,1]],[[0,2],[5,3]]], sol:['011222','001132','433132','431134','433334','444444'] },
    { n:7, ends:[[[3,0],[1,5]],[[5,0],[6,2]],[[0,6],[3,4]],[[0,3],[3,1]],[[4,4],[1,1]],[[5,4],[2,4]]], sol:['3330011','3433001','3444401','3222400','2252450','2055550','2000000'] }
  ];
  /* a level's own solution, walked end to end: the path of colour c (for tests, and the console) */
  function solPath(L, c){
    const [s, e] = L.ends[c], path = [s], seen = new Set([s + '']);
    let cur = s;
    while(cur[0] !== e[0] || cur[1] !== e[1]){
      const nx = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx, dy])=>[cur[0] + dx, cur[1] + dy]).find(([a, b])=>a >= 0 && b >= 0 && a < L.n && b < L.n && +L.sol[b][a] === c && !seen.has(a + ',' + b));
      if(!nx) break; seen.add(nx + ''); path.push(nx); cur = nx;
    }
    return path;
  }
  const SCOL = ['#38ffd0', '#ff3fd0', '#ffd23d', '#3aaaff', '#ff6a3a', '#b48aff'];
  const SHAPE = ['circle', 'diamond', 'square', 'tri', 'hex', 'star'];
  function signal(o, done){
    const ui = panel('MATCH THE SIGNALS', 'Drag from a signal to its twin. Paths cannot cross.');
    const list = SIGNALS.slice(0, o.levels || 3);
    let lv = 0, L, paths, drag = null, solved = 0;
    const load = () => { L = list[lv]; paths = L.ends.map(()=>[]); };
    load();
    const geo = () => { const s = Math.min(420/L.n, 76), w = s*L.n; return { s, ox:(640 - w)/2, oy:(520 - w)/2 + 6 }; };
    const endAt = (a, b) => { for(let c = 0; c < L.ends.length; c++) for(const e of L.ends[c]) if(e[0] === a && e[1] === b) return c; return -1; };
    const owner = (a, b) => { for(let c = 0; c < paths.length; c++) if(paths[c].some(p=>p[0] === a && p[1] === b)) return c; return -1; };
    const linked = c => { const p = paths[c], [e0, e1] = L.ends[c]; if(p.length < 2) return false; const f = p[0], l = p[p.length - 1];
      return (f[0] === e0[0] && f[1] === e0[1] && l[0] === e1[0] && l[1] === e1[1]) || (f[0] === e1[0] && f[1] === e1[1] && l[0] === e0[0] && l[1] === e0[1]); };
    function shape(x, k, cx, cy, r){
      x.beginPath();
      if(SHAPE[k] === 'circle') x.arc(cx, cy, r, 0, 7);
      else if(SHAPE[k] === 'square') x.rect(cx - r*0.85, cy - r*0.85, r*1.7, r*1.7);
      else { const n = SHAPE[k] === 'diamond' ? 4 : SHAPE[k] === 'tri' ? 3 : SHAPE[k] === 'hex' ? 6 : 10;
        for(let i = 0; i < n; i++){ const a = -Math.PI/2 + i/n*Math.PI*2, rr_ = SHAPE[k] === 'star' && i % 2 ? r*0.5 : r; i ? x.lineTo(cx + Math.cos(a)*rr_, cy + Math.sin(a)*rr_) : x.moveTo(cx + Math.cos(a)*rr_, cy + Math.sin(a)*rr_); } x.closePath(); }
      x.fill();
    }
    function draw(t){
      const x = ui.x, G = geo(); x.clearRect(0, 0, 640, 520);
      for(let b = 0; b < L.n; b++) for(let a = 0; a < L.n; a++){ x.fillStyle = '#0d1715'; rr(x, G.ox + a*G.s + 2, G.oy + b*G.s + 2, G.s - 4, G.s - 4, 8); x.fill();
        const o_ = owner(a, b); if(o_ >= 0){ x.fillStyle = SCOL[o_] + '22'; x.fill(); } }
      paths.forEach((p, c)=>{ if(p.length > 1) glowLine(x, p.map(([a, b])=>[G.ox + (a + 0.5)*G.s, G.oy + (b + 0.5)*G.s]), SCOL[c], G.s*0.26, linked(c) ? 16 : 4);
        // a pulse running along a linked signal
        if(linked(c)){ const k = ((t/600) % 1)*(p.length - 1), i = Math.floor(k), f = k - i, A = p[i], B = p[Math.min(p.length - 1, i + 1)];
          x.fillStyle = '#fff'; x.beginPath(); x.arc(G.ox + (A[0] + (B[0] - A[0])*f + 0.5)*G.s, G.oy + (A[1] + (B[1] - A[1])*f + 0.5)*G.s, G.s*0.07, 0, 7); x.fill(); } });
      L.ends.forEach((pr, c)=>pr.forEach(([a, b])=>{ x.save(); x.shadowColor = SCOL[c]; x.shadowBlur = 14; x.fillStyle = SCOL[c]; shape(x, c, G.ox + (a + 0.5)*G.s, G.oy + (b + 0.5)*G.s, G.s*0.3); x.restore();
        x.fillStyle = '#0a0f0e'; shape(x, c, G.ox + (a + 0.5)*G.s, G.oy + (b + 0.5)*G.s, G.s*0.12); }));
      const n = paths.filter((p, c)=>linked(c)).length;
      ui.lv.textContent = 'BUS ' + (lv + 1) + ' / ' + list.length + ' · ' + n + ' / ' + L.ends.length + ' linked';
      if(n === L.ends.length && !solved){ solved = t; ui.msg.textContent = 'Every signal home.'; window.TSH && TSH._cue && TSH._cue('win'); }
      if(solved && t - solved > 1100){ solved = 0; lv++; if(lv >= list.length){ close(); done && done(); return false; } load(); ui.msg.textContent = lv === 1 ? 'More of them.' : 'The main bus.'; }
      return true;
    }
    const cell = e => { const [px, py] = pt(e, ui.c), G = geo(); return [Math.floor((px - G.ox)/G.s), Math.floor((py - G.oy)/G.s)]; };
    const inside = (a, b) => a >= 0 && b >= 0 && a < L.n && b < L.n;
    ui.c.onpointerdown = e=>{ if(solved) return; const [a, b] = cell(e); if(!inside(a, b)) return;
      const c = endAt(a, b);
      if(c >= 0){ paths[c] = [[a, b]]; drag = c; }
      else { const o_ = owner(a, b); if(o_ < 0) return; const i = paths[o_].findIndex(p=>p[0] === a && p[1] === b); paths[o_] = paths[o_].slice(0, i + 1); drag = o_; }
      ui.c.setPointerCapture(e.pointerId); };
    ui.c.onpointermove = e=>{ if(drag === null) return; const [a, b] = cell(e); if(!inside(a, b)) return;
      const p = paths[drag], l = p[p.length - 1]; if(l[0] === a && l[1] === b) return;
      if(Math.abs(l[0] - a) + Math.abs(l[1] - b) !== 1) return;
      if(linked(drag)) return;
      const back = p.findIndex(q=>q[0] === a && q[1] === b); if(back >= 0){ paths[drag] = p.slice(0, back + 1); return; }
      const e_ = endAt(a, b); if(e_ >= 0 && e_ !== drag) return;                         // nobody runs through another signal's terminal
      const o_ = owner(a, b); if(o_ >= 0 && o_ !== drag){ const i = paths[o_].findIndex(q=>q[0] === a && q[1] === b); paths[o_] = paths[o_].slice(0, i); }   // and cuts what was in its way
      p.push([a, b]); window.TSH && TSH._cue && TSH._cue('step'); };
    ui.c.onpointerup = ()=>{ drag = null; };
    run(ui, draw);
    P.solve = ()=>{ paths = L.ends.map((e, c)=>solPath(L, c)); };
  }

  /* ============================================================ GEARS
     Rings of teeth round one axle. Each ring has a notch; turning a ring
     turns the one inside it the other way. All notches at the top and the
     drive runs straight out from the hub to the rim. */
  function gears(o, done){
    const psi = !!o.psi;
    const ui = psi ? panel('STABILISE THE ACTUATORS', 'Tap a ring to turn it (right-click or shift: the other way). Each actuator drags the one inside it. Line every one up with the field\'s swing, so none of them fights it.')
                   : panel('ALIGN THE DRIVE', 'Click a ring to turn it (right-click: the other way). Each ring drags the one inside it. Line every notch up with the shaft.');
    const LV = [{ n:3, seed:5 }, { n:4, seed:9 }].slice(0, o.levels || 2), STEPS = 8;
    let lv = 0, R, ang, solved = 0;
    const load = () => { const L = LV[lv], r = rand(L.seed*101); R = Array(L.n).fill(0); ang = Array(L.n).fill(0);
      for(let k = 0; k < 6 + L.n*3; k++){ const i = Math.floor(r()*L.n); turn(i, r() < 0.5 ? 1 : -1, true); }
      if(R.every(v=>v === 0)) turn(L.n - 1, 1, true); };
    function turn(i, d, quiet){ R[i] = (R[i] + d + STEPS) % STEPS; if(i > 0) R[i - 1] = (R[i - 1] - d + STEPS) % STEPS;
      if(!quiet && window.TSH && TSH._cue) TSH._cue('gear'); }
    load();
    const cx = 320, cy = 268, rad = i => 52 + i*54;
    function draw(t){
      const x = ui.x; x.clearRect(0, 0, 640, 520);
      const n = R.length, aligned = R.map(v=>v === 0);
      // the shaft line the notches have to meet
      x.strokeStyle = 'rgba(255,255,255,0.08)'; x.setLineDash([6, 8]); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy - rad(n - 1) - 40); x.stroke(); x.setLineDash([]);
      for(let i = n - 1; i >= 0; i--){
        ang[i] += ((R[i]/STEPS)*Math.PI*2 - ang[i])*0.25;
        const r0 = rad(i), teeth = 12 + i*6;
        x.save(); x.translate(cx, cy); x.rotate(ang[i]);
        x.fillStyle = '#121c1a'; x.beginPath();
        for(let k = 0; k < teeth*2; k++){ const a = k/(teeth*2)*Math.PI*2, rr_ = r0 + (k % 2 ? 0 : 7); k ? x.lineTo(Math.cos(a)*rr_, Math.sin(a)*rr_) : x.moveTo(Math.cos(a)*rr_, Math.sin(a)*rr_); }
        x.closePath(); x.fill(); x.strokeStyle = aligned[i] ? TEAL : '#2c4a46'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#0a0f0e'; x.beginPath(); x.arc(0, 0, r0 - 18, 0, 7); x.fill();
        // spokes
        x.strokeStyle = '#1a2a28'; x.lineWidth = 3; for(let k = 0; k < 4; k++){ x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(k*Math.PI/2 + 0.4)*(r0 - 20), Math.sin(k*Math.PI/2 + 0.4)*(r0 - 20)); x.stroke(); }
        // its notch (the link in the chain), at its own angle
        x.fillStyle = aligned[i] ? TEAL : PINK; x.shadowColor = x.fillStyle; x.shadowBlur = 12;
        x.fillRect(-6, -r0 - 6, 12, 22);
        x.restore();
      }
      x.fillStyle = '#2a3a38'; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.fill();
      const all = aligned.every(Boolean);
      if(all){ glowLine(x, [[cx, cy], [cx, cy - rad(n - 1) - 40]], TEAL, 8, 18); x.fillStyle = TEAL; x.beginPath(); x.arc(cx, cy, 12, 0, 7); x.fill(); }
      ui.lv.textContent = (psi ? 'JOINT ' : 'DRIVE ') + (lv + 1) + ' / ' + LV.length + ' · ' + aligned.filter(Boolean).length + ' / ' + n + (psi ? ' with the field' : ' aligned');
      if(all && !solved){ solved = t; ui.msg.textContent = psi ? 'It moves with the field now, not against it.' : 'The drive runs.'; window.TSH && TSH._cue && TSH._cue('win'); }
      if(solved && t - solved > 1200){ solved = 0; lv++; if(lv >= LV.length){ close(); done && done(); return false; } load(); ui.msg.textContent = psi ? 'The legs: four actuators.' : 'The leg joint: four rings.'; }
      return true;
    }
    const ringAt = e => { const [px, py] = pt(e, ui.c), d = Math.hypot(px - cx, py - cy); for(let i = 0; i < R.length; i++) if(d < rad(i) + 10) return i; return -1; };
    ui.c.onpointerdown = e=>{ if(solved) return; const i = ringAt(e); if(i < 0) return; turn(i, e.button === 2 || e.shiftKey ? -1 : 1); };
    ui.c.oncontextmenu = e=>e.preventDefault();
    run(ui, draw);
    P.solve = ()=>{ R = R.map(()=>0); };
  }

  /* ========================================================== DIAGNOSE
     The second thing: it will not turn on. Look at it, piece by piece, and
     name what is wrong. A wrong answer is told why it is wrong. */
  const CASE = {
    checks:[
      ['light', 'Status light', 'Blinking red, steady: two short, one long. Something is getting power.'],
      ['battery', 'Battery', '3.9 V under load. Fine.'],
      ['motor', 'Motor (bench test)', 'Driven straight off the bench supply it spins clean both ways. Nothing caught in it.'],
      ['log', 'Firmware log', 'boot OK · checksum OK · v2.3 · calibrating… waiting for SENSOR_1… timeout. retry. timeout.'],
      ['sensor', 'Sensor feed (raw)', '0.000 0.000 0.000 0.000 — covered, uncovered, in the light, in the dark. Flat.']],
    causes:[
      ['power', 'Power failure', 'It has power: the light is blinking and the battery reads 3.9 V.'],
      ['sensor', 'Sensor malfunction', null],
      ['software', 'Software error', 'The firmware boots and checks out. It is waiting on something.'],
      ['blockage', 'Mechanical blockage', 'The motor spins clean on the bench.']]
  };
  function diagnose(o, done){
    const ui = panel('WHAT IS ACTUALLY WRONG', 'It will not start. Examine it, then say what is wrong with it.');
    ui.c.style.display = 'none';
    const seen = new Set();
    function paint(){
      ui.side.innerHTML = '<div class="tsh-puz-checks">' + CASE.checks.map(([k, n, r])=>`<button data-c="${k}" class="${seen.has(k) ? 'seen' : ''}"><b>${n}</b>${seen.has(k) ? '<span>' + r + '</span>' : '<span>examine</span>'}</button>`).join('') + '</div>'
        + `<div class="tsh-puz-ans"><small>${seen.size >= 2 ? 'WHAT IS WRONG?' : 'Examine at least two things first.'}</small>` + CASE.causes.map(([k, n])=>`<button data-a="${k}" ${seen.size >= 2 ? '' : 'disabled'}>${n}</button>`).join('') + '</div>';
      ui.side.querySelectorAll('[data-c]').forEach(b=>b.onclick = ()=>{ seen.add(b.dataset.c); window.TSH && TSH._cue && TSH._cue('ui'); paint(); });
      ui.side.querySelectorAll('[data-a]').forEach(b=>b.onclick = ()=>{
        const c = CASE.causes.find(x=>x[0] === b.dataset.a);
        if(c[2]){ ui.msg.textContent = 'No. ' + c[2]; ui.msg.className = 'tsh-puz-msg bad'; window.TSH && TSH._cue && TSH._cue('fail'); return; }
        ui.msg.textContent = 'The sensor. Its connector has backed out of the socket: pushed home, the feed comes alive.'; ui.msg.className = 'tsh-puz-msg';
        window.TSH && TSH._cue && TSH._cue('win');
        ui.side.querySelectorAll('button').forEach(x=>x.disabled = true);
        setTimeout(()=>{ close(); done && done(); }, 1800);
      });
    }
    paint();
    P = { ui, raf:0 };
  }

  /* ============================================================ FREQ
     The Psi field's oscillation, drawn live; the robot's, drawn over it.
     Tune the robot's frequency (then its phase, then a second harmonic) —
     tap the arrows — until the two are one line and it locks. Every value
     moves in steps, so every level has an exact answer. */
  const FREQS = [
    { keys:['f'],                 target:{ f:3, p:0, f2:0, p2:0 }, start:{ f:1.5, p:0, f2:0, p2:0 } },
    { keys:['f', 'p'],            target:{ f:2.5, p:90, f2:0, p2:0 }, start:{ f:4.5, p:270, f2:0, p2:0 } },
    { keys:['f', 'p', 'f2'],      target:{ f:2, p:60, f2:5, p2:0 }, start:{ f:3.5, p:180, f2:2, p2:0 } }
  ];
  const FSTEP = { f:0.5, p:30, f2:0.5 }, FMIN = { f:0.5, p:0, f2:0.5 }, FMAX = { f:6, p:330, f2:8 };
  const FNAME = { f:'FREQUENCY', p:'PHASE', f2:'HARMONIC' }, FUNIT = { f:' Hz', p:'°', f2:' Hz' };
  function wave(v, x, t){ const a = 2*Math.PI*(v.f*x + v.p/360) + t; let y = Math.sin(a); if(v.f2) y = y*0.7 + 0.45*Math.sin(2*Math.PI*v.f2*x + t*1.6); return y; }
  function freq(o, done){
    const ui = panel('MATCH THE FREQUENCY', 'The Psi field oscillates. Tap the arrows to tune the robot to it, until the two waves are one.');
    const LV = FREQS.slice(0, o.levels || 3);
    let lv = 0, L, v, solved = 0, held = 0, last = 0;
    const load = () => { L = LV[lv]; v = Object.assign({}, L.start); paint(); };
    const err = () => L.keys.reduce((e, k)=>e + Math.abs(v[k] - L.target[k])/(k === 'p' ? 180 : 2), 0);
    const match = () => L.keys.every(k=>v[k] === L.target[k]);
    function paint(){
      ui.side.innerHTML = '<div class="tsh-puz-dials">' + L.keys.map(k=>`<div class="tsh-puz-dial"><small>${FNAME[k]}</small><button data-k="${k}" data-d="-1">◀</button><b>${v[k]}${FUNIT[k]}</b><button data-k="${k}" data-d="1">▶</button></div>`).join('') + '</div>';
      ui.side.querySelectorAll('button').forEach(b=>b.onclick = ()=>{ if(solved) return; const k = b.dataset.k, d = +b.dataset.d;
        let n = v[k] + d*FSTEP[k]; if(k === 'p') n = (n + 360) % 360; else n = Math.max(FMIN[k], Math.min(FMAX[k], n));
        v[k] = Math.round(n*2)/2; window.TSH && TSH._cue && TSH._cue('ui'); paint(); });
    }
    load();
    function draw(t){
      const x = ui.x, dt = Math.min(0.05, (t - last)/1000); last = t; x.clearRect(0, 0, 640, 520);
      const T = t/1000*1.4, ox = 30, w = 580, cy = 250, amp = 120, e = err(), m = match();
      // the grid
      x.strokeStyle = 'rgba(56,255,208,0.07)'; x.lineWidth = 1;
      for(let k = 0; k <= 10; k++){ x.beginPath(); x.moveTo(ox + k*w/10, cy - 160); x.lineTo(ox + k*w/10, cy + 160); x.stroke(); }
      for(let k = -4; k <= 4; k++){ x.beginPath(); x.moveTo(ox, cy + k*40); x.lineTo(ox + w, cy + k*40); x.stroke(); }
      const line = (vv, col, wd, glow) => { const pts = []; for(let i = 0; i <= 160; i++){ const u = i/160; pts.push([ox + u*w, cy - wave(vv, u, T)*amp]); } glowLine(x, pts, col, wd, glow); };
      line(L.target, '#b48aff', 7, 18);                                      // the field
      line(v, m ? TEAL : PINK, 3, m ? 14 : 6);                               // the robot
      x.font = font(13); x.textAlign = 'left'; x.fillStyle = '#b48aff'; x.fillText('Ψ FIELD', ox, 40); x.fillStyle = m ? TEAL : PINK; x.fillText('ROBOT', ox + 90, 40);
      const sync = Math.max(0, Math.round(100 - e*55));
      x.textAlign = 'right'; x.fillStyle = m ? TEAL : INK; x.fillText('SYNC ' + (m ? 100 : Math.min(99, sync)) + '%', ox + w, 40);
      held = m ? held + dt : 0;
      ui.lv.textContent = 'STAGE ' + (lv + 1) + ' / ' + LV.length;
      if(held > 0.6 && !solved){ solved = t; ui.msg.textContent = 'Locked to the field.'; window.TSH && TSH._cue && TSH._cue('win'); }
      if(solved && t - solved > 1200){ solved = 0; held = 0; lv++; if(lv >= LV.length){ close(); done && done(); return false; } load();
        ui.msg.textContent = lv === 1 ? 'Same frequency isn\'t enough: it has to swing at the same moment. Phase.' : 'The field has a second voice in it. Find both.'; }
      return true;
    }
    run(ui, draw);
    P.solve = ()=>{ L.keys.forEach(k=>{ v[k] = L.target[k]; }); paint(); };
  }

  function run(ui, draw){
    const t0 = performance.now();
    P = { ui, raf:0 };
    const loop = () => { if(!P || P.ui !== ui) return; if(draw(performance.now() - t0) === false) return; P.raf = requestAnimationFrame(loop); };
    loop();
  }
  function open(kind, o, done){
    close();
    ({ route, signal, gears, diagnose, freq })[kind](o || {}, done);
  }
  return { open, close, get on(){ return !!P; }, solve(){ if(P && P.solve) P.solve(); }, _route:routeLevel, _net:netLevel, _powered:powered, _solPath:solPath, SIGNALS, CASE, FREQS, _wave:wave };
})();
