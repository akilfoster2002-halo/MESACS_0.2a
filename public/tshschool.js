/* =====================================================================
   TSH — HARBOR LANE HIGH (The Other Robin). The inside of the school
   across the lane from B21: off the map at x = 400, like the flat, so the
   street is not drawn through its walls and its door is a fade.

       ┌─────── ROOM 120 (5 m) ───────┐                 z −48 … −34
       │ windows · desks · workbench  │
       └────────────┤door├────────────┘
         ┌GIRLS┐      │    │
         │ WC  ├──────┤ H  ├──────────────┐ 114      (west branch z −18…−14,
         └─────┘      │ A  │──────────────┘           east branch z −28…−24)
                      │ L  │ 7 m: lockers, the bulletin board, borrowed light
            ┌─────────┘ L  └───────────────┐
            │ galleries ×3      ░ lattice  │ THE ATRIUM, 20 m, after Cooper Union:
            │ OFFICE      LOBBY ░ ╱stair╲  │ a skylight, three floors of galleries,
            │ guard's desk     ░  stacked  │ the grand stair and its white lattice
            └────────(revolving door)──────┘ z −6 … 16

   THE SNEAK. She is late, her teacher is in the lobby, and Room 114 is up
   the hall and round the corner. Her teacher walks a round — the office,
   up the hall to her own classroom, back — and sees down a cone in front
   of her (drawn on the floor, so the player can see it too). Inside it,
   with nothing in the way, a meter fills, faster the closer she is.
   What is in the way: the walls; a student walking between them (walk
   behind somebody); the bulletin board (E: read it, back to the room —
   it does not fool her up close); the bathroom (E: in, wait, out — and
   she is right there). It is not a serious stealth game. Every way it can
   go ends the same: "Robin."

   tsh.js owns the films (the lobby, getting caught, detention); this owns
   the building, the people in it and the sneak, and tells tsh.js through
   the hooks it was handed (enter()).
   ===================================================================== */
window.TSHSCHOOL = (function(){
  const V3 = THREE.Vector3;
  const SX = 400, H = 20;
  let S = null;                  // what build() made
  let S_lab = null;              // the lab's moving parts (Room 120)
  let K = null;                  // tsh.js's hooks, while the sneak runs
  const std = o => new THREE.MeshStandardMaterial(o);
  const glowM = (col, k, map) => new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(col), emissiveIntensity:k||1, emissiveMap:map||null, map:map||null, roughness:0.6 });
  function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c){ const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const font = (px, w) => (w || 'bold ') + px + 'px ' + (window.uiFont ? uiFont() : 'sans-serif');

  /* ----------------------------------------------------------- the art */
  function sign_(text, o){
    o = Object.assign({ w:512, h:128, bg:'#1e3a56', ink:'#f2efe6' }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d');
    x.fillStyle = o.bg; x.fillRect(0, 0, o.w, o.h); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 6; x.strokeRect(8, 8, o.w - 16, o.h - 16);
    x.fillStyle = o.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(Math.round(o.h*0.42)); x.fillText(text, o.w/2, o.h/2 + 2);
    return tex(c);
  }
  /* the bulletin board: cork, and everything a school pins to it */
  function corkboard(){
    const c = cv(1024, 512), x = c.getContext('2d');
    x.fillStyle = '#b07a48'; x.fillRect(0, 0, 1024, 512);
    for(let i = 0; i < 4000; i++){ x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,30,10' : '230,190,140'},0.25)`; x.fillRect(Math.random()*1024, Math.random()*512, 2, 2); }
    x.fillStyle = '#3a2a1a'; x.fillRect(0, 0, 1024, 14); x.fillRect(0, 498, 1024, 14); x.fillRect(0, 0, 14, 512); x.fillRect(1010, 0, 14, 512);
    const notes = [
      ['ROBOTICS CLUB', 'Tues & Thurs · Room 120\nAll levels welcome', '#fff7d6', -0.03], ['SPRING FORMAL', 'Tickets on sale\nFriday in the caf', '#ffd6e8', 0.04],
      ['LOST: CALCULATOR', 'TI-84, sticker on back\nsee front office', '#e6f4ff', -0.05], ['SCIENCE FAIR', 'Projects due Mar 14\nNo exceptions.', '#e8ffe0', 0.02],
      ['HARBOR HAWKS', 'Home game Sat 2pm\nGo Hawks!', '#fff', -0.02], ['STUDY HALL', 'Library · 3:15–5:00\nQuiet please', '#f3e6ff', 0.05],
      ['WFC CAREER DAY', 'Meet the Director\'s team\nAuditorium · Fri', '#d9f2f6', -0.04], ['ATTENDANCE', 'Late arrivals sign in\nat the front office', '#fff0d0', 0.03]];
    notes.forEach(([t, b, col, r], i)=>{
      const px = 40 + (i % 4)*245, py = 40 + Math.floor(i/4)*235;
      x.save(); x.translate(px + 100, py + 95); x.rotate(r);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(-96, -86, 200, 190);
      x.fillStyle = col; x.fillRect(-100, -92, 200, 190);
      x.fillStyle = '#1a1a1a'; x.textAlign = 'center'; x.font = font(22); x.fillText(t, 0, -52);
      x.font = font(17, ''); b.split('\n').forEach((l, k)=>x.fillText(l, 0, -10 + k*26));
      x.fillStyle = ['#d33','#36c','#2a2','#e90'][i % 4]; x.beginPath(); x.arc(0, -82, 7, 0, 7); x.fill();
      x.restore();
    });
    return tex(c);
  }
  function lockerTex(col){
    const c = cv(256, 512), x = c.getContext('2d');
    x.fillStyle = col; x.fillRect(0, 0, 256, 512);
    for(let k = 0; k < 4; k++){ const lx = k*64; x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(lx, 0, 3, 512);
      x.fillStyle = 'rgba(0,0,0,0.3)'; for(let v = 0; v < 6; v++) x.fillRect(lx + 16, 40 + v*9, 32, 3);
      x.fillStyle = '#c8ccd0'; x.fillRect(lx + 46, 250, 6, 26); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(lx + 6, 0, 6, 512); }
    const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
  }
  /* the floor: school vinyl tiles, cream with a fleck, every so often a blue one */
  function tiles(){
    const c = cv(512, 512), x = c.getContext('2d'), n = 8, w = 512/n;
    for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){
      x.fillStyle = (i*3 + j*5) % 11 === 0 ? '#5d7fa6' : (i + j) % 2 ? '#d9d3c2' : '#cfc8b6'; x.fillRect(i*w, j*w, w, w);
      for(let k = 0; k < 40; k++){ x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,80,70' : '255,255,255'},0.25)`; x.fillRect(i*w + Math.random()*w, j*w + Math.random()*w, 2, 2); }
      x.strokeStyle = 'rgba(80,70,60,0.35)'; x.lineWidth = 2; x.strokeRect(i*w, j*w, w, w); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function whiteboard(){
    const c = cv(1024, 384), x = c.getContext('2d');
    x.fillStyle = '#f6f7f5'; x.fillRect(0, 0, 1024, 384);
    x.strokeStyle = '#1a3a8a'; x.lineWidth = 4; x.font = font(34, ''); x.fillStyle = '#1a3a8a';
    x.fillText('AP ENGINEERING — Unit 6: Feedback & Control', 40, 60);
    x.fillStyle = '#b22'; x.fillText('ASSIGNMENT 6.2 — DUE TODAY', 40, 120);
    x.fillStyle = '#1a1a1a'; x.font = font(28, ''); x.fillText('e(t) = r(t) − y(t)', 60, 190); x.fillText('u(t) = Kp·e + Ki∫e dt + Kd·de/dt', 60, 240);
    x.strokeStyle = '#2a6a2a'; x.beginPath(); x.moveTo(640, 320); for(let i = 0; i < 300; i++){ const t = i/300; x.lineTo(640 + i, 320 - 200*(1 - Math.exp(-t*5)*Math.cos(t*14))); } x.stroke();
    return tex(c);
  }

  /* the monitors: the field's trace, its spectrum, and how unstable it is */
  function paintMonitors(c, t, sync){
    const x = c.getContext('2d'), W = c.width, H = c.height, w = W/3, h = H/2;
    x.fillStyle = '#04060a'; x.fillRect(0, 0, W, H);
    const sc = (i, j, title, col) => { const ox = i*w, oy = j*h; x.strokeStyle = 'rgba(180,138,255,0.18)'; x.lineWidth = 1;
      for(let k = 1; k < 6; k++){ x.beginPath(); x.moveTo(ox + k*w/6, oy + 18); x.lineTo(ox + k*w/6, oy + h - 8); x.stroke(); }
      x.fillStyle = col; x.font = font(16); x.fillText(title, ox + 12, oy + 22); return [ox, oy]; };
    const tr = (ox, oy, f, col, amp, wob) => { x.strokeStyle = col; x.lineWidth = 3; x.shadowColor = col; x.shadowBlur = 10; x.beginPath();
      for(let i = 0; i <= 200; i++){ const u = i/200, y = Math.sin(u*f + t*3) + wob*Math.sin(u*f*3.3 + t*7.1)*Math.sin(t*1.7); x.lineTo(ox + 10 + u*(w - 20), oy + h/2 + 8 - y*amp); } x.stroke(); x.shadowBlur = 0; };
    let [ox, oy] = sc(0, 0, 'Ψ FIELD — RAW', '#c8a0ff'); tr(ox, oy, 18, '#b48aff', 60, 0.6);
    [ox, oy] = sc(1, 0, 'PROTOTYPE — ACTUATOR OUT', sync ? '#38ffd0' : '#ff5a7a');
    tr(ox, oy, 18, sync ? '#38ffd0' : '#ff3f6a', sync ? 60 : 40, sync ? 0.6 : 0); if(!sync){ x.fillStyle = '#ff3f6a'; x.fillText('▲ SPIKE', ox + w - 110, oy + 50 + 10*Math.sin(t*9)); }
    [ox, oy] = sc(2, 0, 'SPECTRUM', '#9fd8ff'); for(let k = 0; k < 28; k++){ const v = Math.abs(Math.sin(k*0.7 + t*2))*(k === 6 || k === 15 ? 1 : 0.35); x.fillStyle = k === 6 || k === 15 ? '#b48aff' : '#3a5a7a'; x.fillRect(ox + 14 + k*11, oy + h - 14 - v*170, 8, v*170); }
    [ox, oy] = sc(0, 1, 'CONTAINMENT', '#ffd23d'); const st = 0.55 + 0.4*Math.sin(t*0.9) + 0.08*Math.sin(t*7);
    x.fillStyle = '#1a1e24'; x.fillRect(ox + 20, oy + 60, w - 40, 36); x.fillStyle = st < 0.3 ? '#ff3f6a' : '#ffd23d'; x.fillRect(ox + 20, oy + 60, (w - 40)*Math.max(0.05, Math.min(1, st)), 36);
    x.fillStyle = '#e8e6d8'; x.font = font(22); x.fillText((st*100).toFixed(0) + '% · UNSTABLE', ox + 20, oy + 140); x.font = font(14); x.fillText('FIELD HELD ' + (t % 60).toFixed(1) + ' s', ox + 20, oy + 170);
    [ox, oy] = sc(1, 1, 'PHASE (Ψ vs PROTOTYPE)', '#9fd8ff'); x.strokeStyle = sync ? '#38ffd0' : '#ff5a7a'; x.lineWidth = 2; x.beginPath();
    for(let i = 0; i <= 120; i++){ const a = i/120*6.283, ph = sync ? 0 : 1.6 + 0.6*Math.sin(t); x.lineTo(ox + w/2 + Math.sin(a + t)*90, oy + h/2 + 10 + Math.sin(a + t + ph)*90); } x.stroke();
    [ox, oy] = sc(2, 1, 'LOG', '#9fb4c0'); x.font = font(13, ''); x.fillStyle = '#9fb4c0';
    const L = sync ? ['42:11 trial 44 · field on', '42:13 prototype OK', '42:13 actuators: FOLLOW', '42:14 output locked to Ψ', '42:20 stable'] : ['41:58 trial 43 · field on', '41:59 output spike', '41:59 actuator compensating', '42:00 OVERCURRENT', '42:00 prototype seized'];
    L.forEach((l, i)=>x.fillText(l, ox + 14, oy + 54 + i*24));
    for(let i = 1; i < 3; i++){ x.fillStyle = '#000'; x.fillRect(i*w - 3, 0, 6, H); } x.fillRect(0, h - 3, W, 6);
  }
  function trophyTex(){
    const c = cv(512, 256), x = c.getContext('2d');
    x.fillStyle = '#2a2018'; x.fillRect(0, 0, 512, 256);
    [[60, 120, '#e8c060'], [160, 90, '#d0d4d8'], [260, 130, '#e8c060'], [360, 100, '#c88a50'], [450, 120, '#e8c060']].forEach(([cx, hgt, col])=>{
      x.fillStyle = col; x.fillRect(cx - 14, 230 - hgt*0.4, 28, hgt*0.4); x.beginPath(); x.arc(cx, 230 - hgt*0.4, 24, Math.PI, 0); x.fill(); x.fillRect(cx - 26, 228, 52, 12); });
    x.fillStyle = '#f2e6c0'; x.font = font(18); x.fillText('HAWKS · ROBOTICS · STATE', 120, 30);
    return tex(c);
  }

  /* ========================================================== the build
     AFTER COOPER UNION (41 Cooper Square). The lobby is the bottom of an atrium twenty metres tall: a
     skylight at the top, galleries on three floors looking down into it, a grand stair climbing the east side
     a flight at a time, and wrapped round the stair a white lattice — a net of diagonal ribs, the building's
     "cloud" — that rises from above head height to the roof. Slanted concrete columns in pairs by the glass
     front, polished concrete underfoot. The hall off it is seven metres high, with borrowed light along the
     top of its walls and concrete beams across; the classrooms are five.

     EVERY WALL IS SOLID TO THE ROOF (sixty metres, in fact): the chase camera rides three metres above her
     head, and a wall that stopped below it was not a wall to it — it sat in them. */
  const ROOMS = { atrium:20, hall:7, room:5 };
  function concrete(){
    const c = cv(512, 512), x = c.getContext('2d');
    x.fillStyle = '#9a9c98'; x.fillRect(0, 0, 512, 512);
    for(let i = 0; i < 9000; i++){ const v = 120 + Math.random()*60 | 0; x.fillStyle = `rgba(${v},${v},${v - 4},${0.06 + Math.random()*0.1})`; x.fillRect(Math.random()*512, Math.random()*512, 2 + Math.random()*5, 2 + Math.random()*5); }
    for(let i = 0; i < 18; i++){ const g = x.createRadialGradient(Math.random()*512, Math.random()*512, 0, Math.random()*512, Math.random()*512, 80 + Math.random()*120); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
    x.strokeStyle = 'rgba(40,40,38,0.35)'; x.lineWidth = 2; x.strokeRect(1, 1, 510, 510);     // a saw-cut joint every two metres
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function build(root, out){
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const solids = [], plats = [], lights = [], spots = {};
    const white = std({ color:0xeceae4, roughness:0.85 }), conc = std({ color:0x8e908c, roughness:0.75 }), dark = std({ color:0x22262a, roughness:0.5, metalness:0.4 });
    const floorM = std({ map:concrete(), roughness:0.28, metalness:0.05 }), steel = std({ color:0xb8bcc0, roughness:0.3, metalness:0.85 });
    const glass = std({ color:0xcfe8f0, roughness:0.05, metalness:0.1, transparent:true, opacity:0.22, depthWrite:false, side:THREE.DoubleSide });
    const woodM = std({ color:0x7a5a3c, roughness:0.6 }), trimM = std({ color:0x2a2e32, roughness:0.6 });
    const panelM = glowM(0xfffaf0, 1.4), lockA = std({ map:lockerTex('#2f5f9a'), roughness:0.45, metalness:0.4 }), lockB = std({ map:lockerTex('#c9cdd2'), roughness:0.4, metalness:0.5 });
    const box = (m, x, y, z, w, h, d, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if(o && o.ry) b.rotation.y = o.ry; if(o && o.rz) b.rotation.z = o.rz; if(o && o.rx) b.rotation.x = o.rx; b.castShadow = !!(o && o.shadow); b.receiveShadow = true; g.add(b); return b; };
    const plane = (m, x, y, z, w, h, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry || 0; g.add(p); return p; };
    const solid = (x1, x2, z1, z2, y2, y1) => { const s = { x1, x2, z1, z2, y1:y1 === undefined ? -1 : y1, y2:y2 === undefined ? 60 : y2, tag:'school' }; solids.push(s); return s; };
    const floorAt = (x1, x2, z1, z2, top) => plats.push({ x1, x2, z1, z2, top, tag:'school' });
    // a glass rail she cannot walk through, at the level it guards
    const rail = (x1, x2, z1, z2, y) => solid(x1, x2, z1, z2, y + 1.15, y - 0.3);
    // a wall: white plaster over a concrete base, a dark skirting; solid all the way up
    const wall = (x1, x2, z1, z2, h) => { const cx = (x1 + x2)/2, cz = (z1 + z2)/2, w = x2 - x1, d = z2 - z1;
      box(white, cx, (h + 1.2)/2, cz, w, h - 1.2, d); box(conc, cx, 0.6, cz, w + 0.01, 1.2, d + 0.01); box(trimM, cx, 0.05, cz, w + 0.02, 0.1, d + 0.02); solid(x1, x2, z1, z2); };
    const room = (x1, x2, z1, z2, h) => { const f = box(floorM, (x1 + x2)/2, -0.05, (z1 + z2)/2, x2 - x1, 0.1, z2 - z1);
      const uv = f.geometry.attributes.uv; for(let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)*(x2 - x1)/2, uv.getY(i)*(z2 - z1)/2);
      box(white, (x1 + x2)/2, h + 0.1, (z1 + z2)/2, x2 - x1, 0.2, z2 - z1); plats.push({ x1, x2, z1, z2, top:0, tag:'school' }); };
    const lamp = (x, y, z, k, d, w) => { box(panelM, x, y, z, w || 1.2, 0.04, 0.5); lights.push({ x, y:y - 0.3, z, col:new THREE.Color(0xfff4e4), k, d }); };
    const X = v => SX + v, T = 0.3;
    const sign = (txt, x, y, z, ry, o) => { const p = plane(new THREE.MeshBasicMaterial({ map:signTex(txt, o) }), x, y, z, (o && o.w) || 0.7, (o && o.h) || 0.26, ry); p.userData.flat = true; return p; };

    /* ---- the plan: the atrium (lobby), the hall north off it, two branches, Room 120 at the end */
    room(X(-10), X(14), -6, 16, ROOMS.atrium);
    room(X(-1), X(5), -34, -6, ROOMS.hall);
    room(X(-14), X(-1), -18, -14, ROOMS.hall);
    room(X(5), X(20), -28, -24, ROOMS.hall);
    room(X(-5), X(11), -48, -34, ROOMS.room);
    // the atrium's walls, to the roof; its glass front with the revolving door in it
    const A = ROOMS.atrium;
    wall(X(-10) - T, X(-10), -6 - T, 16 + T, A); wall(X(14), X(14) + T, -6 - T, 16 + T, A);
    wall(X(-10), X(-1), -6 - T, -6, A); wall(X(5), X(14), -6 - T, -6, A);
    box(white, X(2), (ROOMS.hall + A)/2, -6 - T/2, 6, A - ROOMS.hall, T); solid(X(-1), X(5), -6 - T, -6, A, ROOMS.hall);   // over the hall's mouth
    box(glass, X(2), A/2, 16.1, 24, A, 0.06); solid(X(-10), X(14), 16, 16 + T);
    plane(glowM(0xe4eef6, 0.5), X(2), A/2, 16.45, 24, A, Math.PI);                            // the street's daylight beyond it
    for(let k = -10; k <= 14; k += 2) box(dark, X(k), A/2, 16.06, 0.1, A, 0.14);
    for(let y = 4; y < A; y += 4) box(dark, X(2), y, 16.06, 24, 0.1, 0.14);
    { const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 24, 1, true), std({ color:0xb8dce8, roughness:0.1, transparent:true, opacity:0.25, side:THREE.DoubleSide, depthWrite:false }));
      drum.position.set(X(2), 1.3, 15.4); g.add(drum); box(dark, X(2), 2.66, 15.4, 2.8, 0.12, 2.8); }
    spots.inside = [X(2), 13.6]; spots.door = [X(2), 15.0];
    // the skylight
    box(glowM(0xf4f8ff, 1.3), X(2), A - 0.02, 5, 16, 0.05, 14);
    for(let k = -6; k <= 10; k += 2) box(dark, X(k), A - 0.1, 5, 0.12, 0.2, 14);
    for(let z = -2; z <= 12; z += 2) box(dark, X(2), A - 0.1, z, 16, 0.2, 0.12);
    // light: the skylight down the whole atrium, and lamps on the gallery soffits
    [[-4, 0], [8, 0], [-4, 10], [8, 10]].forEach(([x, z])=>lights.push({ x:X(x), y:A - 3, z, col:new THREE.Color(0xf6f8ff), k:16, d:34 }));
    [[-2, 3.4, 8], [6, 3.4, 8], [2, 3.4, 12]].forEach(([x, y, z])=>lamp(X(x), y + 1.6, z, 3, 10));

    /* ---- slanted concrete columns, in pairs, by the glass (after the lobby of 41 Cooper Square) */
    [[-3.5, 13.2], [7.2, 13.2]].forEach(([x, z])=>{ [-1, 1].forEach(s=>box(conc, X(x + s*0.7), 3.2, z, 0.5, 6.8, 0.5, { rz:s*0.2, shadow:true })); solid(X(x - 1.6), X(x + 1.6), z - 0.35, z + 0.35, 7); });

    /* ---- the galleries: three floors looking down into the atrium, along its north and west walls */
    [5.5, 11, 16.5].forEach((y, fl)=>{
      box(conc, X(2), y, -4.5, 24, 0.45, 3); box(conc, X(-8.5), y, 6.5, 3, 0.45, 21);                    // the slabs
      floorAt(X(-10), X(14), -6, -3, y + 0.225); floorAt(X(-10), X(-7), -3, 16, y + 0.225);              // and you can walk them
      solid(X(-10), X(14), -6, -3, y + 0.225, y - 0.25); solid(X(-10), X(-7), -3, 16, y + 0.225, y - 0.25);   // (and the camera cannot sit inside them)
      rail(X(-7), X(9), -3.05, -2.95, y + 0.225); rail(X(-7.05), X(-6.95), -3, fl === 1 ? 13.6 : 16, y + 0.225);   // (the second floor's opens onto the sky bridge)
      box(white, X(2), y - 0.35, -3.0, 24, 0.3, 0.1); box(white, X(-7.0), y - 0.35, 6.5, 0.1, 0.3, 21);   // their edges
      box(glass, X(2.2), y + 0.75, -3.0, 21.6, 1.1, 0.04); box(glass, X(-7.0), y + 0.75, 6.8, 0.04, 1.1, 18.4);   // glass rails
      box(steel, X(2.2), y + 1.3, -3.0, 21.6, 0.05, 0.06); box(steel, X(-7.0), y + 1.3, 6.8, 0.06, 0.05, 18.4);
      // classroom doors along the back wall of each, with their numbers
      for(let k = -7; k <= 11; k += 4.5){ if(fl === 0 && k > -2 && k < 6) continue;
        box(woodM, X(k), y + 1.25, -5.98, 1.0, 2.1, 0.06); sign('ROOM ' + (2 + fl) + String(10 + Math.round(k + 8)).padStart(2, '0'), X(k), y + 2.6, -5.92, 0, { w:0.7, h:0.22 }); }
      [0, 7, 13].forEach(z=>box(woodM, X(-9.98), y + 1.25, z, 0.06, 2.1, 1.0));
      lamp(X(2), y - 0.25, -4.5, 2.5, 9, 3); lamp(X(-8.5), y - 0.25, 6.5, 2.5, 9, 3);
    });

    /* ---- the grand stair, a flight at a time up the east side (stacked, the way Cooper Union's climbs). You can
       climb it: every tread is a step to stand on (and, under it, a block, so the stair is walked up from its foot,
       not into from the side); the landings and the galleries are floors; a sky bridge along the glass crosses the
       atrium on the second floor, to the west gallery. */
    const flight = (x1, x2, zA, zB, yA, yB) => { const n = Math.round((yB - yA)/0.18), dz = (zB - zA)/n, dy = (yB - yA)/n, cx = (x1 + x2)/2;
      for(let i = 0; i < n; i++){ const top = yA + dy*(i + 1), z0 = zA + dz*i, z1 = zA + dz*(i + 1);
        box(i % 2 ? conc : white, cx, top - Math.abs(dy)/2, (z0 + z1)/2, x2 - x1, Math.abs(dy) + 0.02, Math.abs(dz) + 0.01);
        floorAt(x1, x2, Math.min(z0, z1), Math.max(z0, z1), top); solid(x1, x2, Math.min(z0, z1), Math.max(z0, z1), top, yA > 0.5 ? top - 0.45 : -1);
        // and its sides, rail-high: off a flight only at its top or its foot
        [[x1 - 0.12, x1], [x2, x2 + 0.12]].forEach(([a, b])=>rail(a, b, Math.min(z0, z1) - 0.02, Math.max(z0, z1) + 0.02, top)); }
      const len = Math.hypot(zB - zA, yB - yA), ang = Math.atan2(yB - yA, zB - zA), mid = [(zA + zB)/2, (yA + yB)/2];
      [x1 - 0.08, x2 + 0.08].forEach(xs=>{ const s_ = box(white, xs, mid[1] - 0.25, mid[0], 0.16, 0.9, len); s_.rotation.x = -ang;
        const r = box(glass, xs, mid[1] + 0.75, mid[0], 0.03, 1.0, len); r.rotation.x = -ang;
        const h = box(steel, xs, mid[1] + 1.25, mid[0], 0.05, 0.05, len); h.rotation.x = -ang; }); };
    const landing = (x1, x2, z1, z2, y) => { box(conc, (x1 + x2)/2, y - 0.2, (z1 + z2)/2, x2 - x1, 0.45, z2 - z1); floorAt(x1, x2, z1, z2, y); solid(x1, x2, z1, z2, y, y - 0.45); };
    flight(X(9), X(11.6), 13, 1, 0, 5.5);                       // up from the lobby, north, to the first gallery
    landing(X(9), X(14), -3, 1, 5.725);
    flight(X(11.6), X(14), -2.5, 9.5, 5.725, 11.225);           // back south, a floor up
    landing(X(9), X(14), 9.5, 16, 11.225);                     // (out to the glass, where the sky bridge meets it)
    flight(X(9), X(11.6), 13, 1.2, 11.225, 16.725);             // and north again, under the skylight
    landing(X(9), X(14), -3, 1.2, 16.725);
    rail(X(8.95), X(9.05), -3, 1, 5.725); rail(X(8.95), X(9.05), 9.5, 13.6, 11.225); rail(X(8.95), X(9.05), -3, 1.2, 16.725);
    rail(X(11.6), X(14), 1.15, 1.3, 16.725);                   // the top landing's open side, over the flights below
    box(glass, X(12.8), 17.3, 1.22, 2.4, 1.1, 0.04); box(steel, X(12.8), 17.85, 1.22, 2.4, 0.05, 0.06);
    // the sky bridge, second floor, along the glass: from the stair's landing to the west gallery
    box(conc, X(1), 11.0, 14.8, 16, 0.45, 2.4); floorAt(X(-7), X(9), 13.6, 16, 11.225);
    box(glass, X(1), 11.95, 13.6, 16, 1.1, 0.04); box(steel, X(1), 12.5, 13.6, 16, 0.05, 0.06); rail(X(-7), X(9), 13.55, 13.65, 11.225);
    spots.landing1 = [X(11.5), -1];
    /* ---- the lattice: a white net of diagonal ribs, curving up round the stair from above head height to the roof */
    { const ribs = [], U = 26, Vn = 30, surf = (u, v) => { const z = 12.6 - u*15, x = 7.6 - Math.sin(u*Math.PI)*2.6 + Math.sin(v*Math.PI)*0.9, y = 3.4 + v*(A - 4.2); return new V3(X(x), y, z); };
      for(let k = -Vn; k <= U + Vn; k += 1.2) for(const sgn of [1, -1]){ let prev = null;
        for(let j = 0; j <= Vn; j++){ const v = j/Vn, u = (k + sgn*j)/U; if(u < 0 || u > 1){ prev = null; continue; }
          const p = surf(u, v); if(prev) ribs.push([prev, p]); prev = p; } }
      const geo = new THREE.BoxGeometry(0.09, 0.14, 1), inst = new THREE.InstancedMesh(geo, std({ color:0xf4f2ee, roughness:0.6, emissive:new THREE.Color(0.08, 0.08, 0.08) }), ribs.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new V3(0, 0, 1);
      ribs.forEach(([a, b], i)=>{ const d = b.clone().sub(a), l = d.length(); q.setFromUnitVectors(zAxis, d.clone().normalize()); m.compose(a.clone().add(b).multiplyScalar(0.5), q, new V3(1, 1, l)); inst.setMatrixAt(i, m); });
      inst.castShadow = true; g.add(inst); }

    /* ---- the lobby: the guard's desk by the doors, the office, a bench, the trophy case, the school's name */
    box(woodM, X(-6), 0.5, 12.0, 3.2, 1.0, 0.6, { shadow:true }); box(woodM, X(-4.4), 0.5, 10.8, 0.6, 1.0, 2.4, { shadow:true });
    box(std({ color:0xe8e6e0, roughness:0.4 }), X(-6), 1.02, 12.0, 3.4, 0.04, 0.8);
    box(std({ color:0x111418, roughness:0.4, emissive:new THREE.Color(0.15, 0.3, 0.4) }), X(-6.4), 1.3, 11.8, 0.5, 0.35, 0.05);
    solid(X(-7.6), X(-4.1), 9.5, 12.4, 1.0);
    spots.guard = [X(-6.0), 10.9];
    box(woodM, X(-1), 0.25, 3.5, 3.0, 0.5, 0.6); solid(X(-2.5), X(0.5), 3.2, 3.8, 0.5);
    plane(std({ map:trophyTex(), roughness:0.3 }), X(-9.97), 1.6, 8.5, 3, 1.5, Math.PI/2);
    box(glass, X(-9.75), 1.6, 8.5, 0.45, 1.7, 3.1);
    box(woodM, X(-9.96), 1.05, 2, 0.06, 2.1, 1.0); sign('MAIN OFFICE', X(-9.92), 2.4, 2, Math.PI/2, { w:0.9, h:0.24 });
    spots.office = [X(-9), 2];
    { const b = plane(new THREE.MeshBasicMaterial({ map:sign_('HARBOR LANE HIGH · HOME OF THE HAWKS', { w:1024, h:128, bg:'#16324a', ink:'#f0c040' }) }), X(2), 8.6, -5.95, 9, 1.15, 0); b.userData.flat = true; }
    spots.lobbyStop = [X(1.2), 7.6]; spots.teacherLobby = [X(2.5), -4.2];

    /* ---- the hall: seven metres, lockers both sides, borrowed light along the top, beams across */
    const HH = ROOMS.hall;
    wall(X(-1) - T, X(-1), -34, -18, HH); wall(X(-1) - T, X(-1), -14, -6 - T, HH);
    wall(X(5), X(5) + T, -34, -28, HH); wall(X(5), X(5) + T, -24, -6 - T, HH);
    for(let z = -32; z < -6; z += 4){ box(conc, X(2), HH - 0.3, z, 6, 0.5, 0.4); lamp(X(2), HH - 0.6, z + 2, 5, 13); }
    [[-1.02, Math.PI/2], [5.02, -Math.PI/2]].forEach(([x, ry])=>{ for(let z = -32; z < -7; z += 3.2){ plane(glowM(0xdfeaf2, 0.55), X(x), 5.2, z, 2.6, 1.6, ry); } });
    // west branch, and the bathroom at its end
    wall(X(-14), X(-1) - T, -18 - T, -18, HH); wall(X(-14), X(-1) - T, -14, -14 + T, HH); wall(X(-14) - T, X(-14), -18 - T, -14 + T, HH);
    box(woodM, X(-14) + 0.04, 1.05, -16, 0.06, 2.1, 1.0); sign('GIRLS', X(-14) + 0.08, 2.4, -16, Math.PI/2, { bg:'#7a3a6a' });
    lamp(X(-7.5), HH - 0.6, -16, 4, 11);
    spots.bathroom = [X(-13.2), -16];
    // east branch, and 114 at its end
    wall(X(5) + T, X(20), -28 - T, -28, HH); wall(X(5) + T, X(20), -24, -24 + T, HH); wall(X(20), X(20) + T, -28 - T, -24 + T, HH);
    box(woodM, X(20) - 0.04, 1.05, -26, 0.06, 2.1, 1.0); box(glowM(0xdfe8ee, 0.6), X(20) - 0.07, 1.5, -25.75, 0.02, 0.5, 0.25);
    sign('ROOM 114', X(20) - 0.08, 2.4, -26, -Math.PI/2);
    lamp(X(12.5), HH - 0.6, -26, 4, 11);
    spots.room114 = [X(19), -26];
    // lockers, with the bulletin board in the run of them on the west wall
    const lockers = (x, z1, z2, face) => { for(let z = z1; z < z2 - 0.1; z += 2){ const len = Math.min(2, z2 - z); box((Math.floor(z/2) % 2) ? lockA : lockB, x + face*0.22, 1.0, z + len/2, 0.44, 2.0, len); } solid(Math.min(x, x + face*0.45), Math.max(x, x + face*0.45), z1, z2, 2.1); };
    lockers(X(-1), -33.6, -18, 1); lockers(X(-1), -14, -11.8, 1); lockers(X(-1), -8.2, -6.4, 1);
    lockers(X(5), -33.6, -28, -1); lockers(X(5), -24, -6.4, -1);
    plane(std({ map:corkboard(), roughness:0.9 }), X(-1) + 0.03, 1.55, -10, 3.2, 1.6, Math.PI/2);
    box(woodM, X(-1) + 0.04, 1.55, -10, 0.05, 1.72, 3.32);
    spots.board = [X(-0.1), -10];

    /* ---- Room 120, THE ROBOTICS LAB: five metres, a wall of windows — and not a school room. In the middle,
       on a dais, a containment rig: coils, three gimbal rings, and held in them a few centimetres of Psi
       energy, violet and never quite still. Monitors on the back wall reading it; server racks; two
       industrial arms; the physics bench; and on its own test stand, the prototype it keeps breaking. */
    const RH = ROOMS.room;
    wall(X(-5) - T, X(-5), -48 - T, -34 + T, RH); wall(X(11), X(11) + T, -48 - T, -34 + T, RH); wall(X(-5), X(11), -48 - T, -48, RH);
    wall(X(-5), X(1), -34, -34 + T, RH); wall(X(3), X(11), -34, -34 + T, RH);
    box(white, X(2), (2.4 + RH)/2, -34 + T/2, 2, RH - 2.4, T); box(trimM, X(2), 2.42, -34 + T/2, 2.04, 0.06, T + 0.02);
    sign('ROOM 120 · ROBOTICS', X(2), 2.75, -33.62, 0, { w:1.0 });
    const legM = std({ color:0x3a3a40, roughness:0.4, metalness:0.6 }), steelD = std({ color:0x2a2e36, roughness:0.35, metalness:0.75 });
    const copper = std({ color:0xb8692e, roughness:0.3, metalness:0.9 });
    const add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
    // everything else in here — the field, the room, the equipment, the light — is tshlab.js
    const RX = X(3), RZ = -42.4, FY = 1.55, TX = X(6.4), TZ = -40.0;
    const lab = TSHLAB.build({ g, X, solid, lights, H:RH, rig:[RX, RZ], FY, stand:[TX, TZ], door:[X(2), -34] });

    // the prototype's test stand, and her stool in front of it
    box(steelD, TX, 0.74, TZ, 1.5, 0.05, 0.85); [[-0.68, -0.36], [0.68, -0.36], [-0.68, 0.36], [0.68, 0.36]].forEach(([a, b])=>box(legM, TX + a, 0.37, TZ + b, 0.05, 0.74, 0.05));
    box(glowM(0x38ffd0, 2.2), TX, 0.765, TZ + 0.42, 1.5, 0.012, 0.012);
    solid(TX - 0.76, TX + 0.76, TZ - 0.44, TZ + 0.44, 0.8);
    // an emitter ring on the stand, so the field can be put on it
    const em = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 40), copper), TX + 0.05, 0.8, TZ - 0.05); em.rotation.x = Math.PI/2;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.008, 6, 40), glowM(0xb070ff, 2.5)), TX + 0.05, 0.8, TZ - 0.05).rotation.x = Math.PI/2;
    lab.beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.2, 0.6, 2.4), transparent:true, opacity:0.0, blending:THREE.AdditiveBlending, depthWrite:false })), 0, 0, 0);
    spots.seatDesk = [TX, TZ]; spots.seat = [TX, TZ + 0.62];
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), steelD), TX, 0.47, TZ + 0.66); add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), legM), TX, 0.23, TZ + 0.66);

    // her teacher's desk, by the monitors
    box(std({ color:0x2a2e38, roughness:0.4, metalness:0.3 }), X(9.4), 0.74, -45.6, 1.8, 0.05, 0.8, { shadow:true }); box(legM, X(9.4), 0.37, -45.9, 1.7, 0.74, 0.04);
    solid(X(8.5), X(10.3), -46, -45.2, 0.82);
    spots.teacherDesk = [X(9.4), -44.8];
    spots.bench = [X(9.0), -40]; spots.benchTop = [X(10.2), 0.91, -40];
    spots.room120Door = [X(2), -33.2]; spots.room120In = [X(2), -35.5];
    // the prototype on its stand, its schematic over the hologram table; the old sensor puck on the bench
    const robot = TSHLAB.robot(); robot.position.set(TX, 0.77, TZ - 0.05); robot.scale.setScalar(1.6); g.add(robot);
    TSHLAB.holoOf(lab, robot);
    lab.paint = paintMonitors;
    const gadget = makeGadget(); gadget.position.set(X(10.05), 0.95, -40.25); g.add(gadget);
    S_lab = lab;

    out.solids.push(...solids); out.plats.push(...plats);
    const ceilingAt = (x, z) => z > -6 ? ROOMS.atrium : z < -34 ? ROOMS.room : ROOMS.hall;
    S = { group:g, solids, lights, spots, robot, gadget, lab:S_lab, H:ROOMS.atrium, ceilingAt, people:[], X };
    return S;
  }
  function signTex(text, o){ const t = { w:256, h:96 }; if(o && o.bg) t.bg = o.bg; if(o && o.ink) t.ink = o.ink; return sign_(text, t); }
  /* THE PROTOTYPE (tshlab.js builds it). Broken and in the field it fights itself; fixed (robot.userData.on), it
     stands, looks about, and waves. Its actuator rings go from red to cyan as she fixes it. */
  function tickRobot(dt){
    if(!S) return;
    const u = S.robot.userData; u.t += dt;
    tickLab(dt);
    if(!u.on){
      // in the field, and not fixed: it fights itself — every joint jerking against the swing (less as she fixes it)
      if(u.field){ const k = Math.max(0, 1 - (u.fix || 0)/3), j = () => (Math.random() - 0.5)*k;
        u.body.rotation.x = 0.15 + j()*0.5; u.body.rotation.z = j()*0.4; u.head.rotation.set(j()*0.8, j()*1.2, 0); u.arm.rotation.z = 0.8 + j()*2.2;
        u.eye.emissive.setRGB(1, 0.2, 0.2); u.eye.emissiveIntensity = Math.random() < 0.5 ? 2.5*k : 0.2; u.panel.material.emissive.setRGB(1, 0.25 + (u.fix || 0)*0.2, 0.15);
        (u.rings || []).forEach(r=>{ r.material.emissive.setRGB(1, 0.2 + (u.fix || 0)*0.25, 0.2); r.material.emissiveIntensity = 1.5 + Math.random()*2.5*k; }); }
      return;
    }
    u.body.rotation.x += (0 - u.body.rotation.x)*Math.min(1, dt*4); u.body.rotation.z += (0 - u.body.rotation.z)*Math.min(1, dt*4);
    u.head.rotation.x += (0 - u.head.rotation.x)*Math.min(1, dt*4);
    u.head.rotation.y = Math.sin(u.t*1.3)*0.6;
    u.arm.rotation.z = u.t < 4 ? 2.4 + Math.sin(u.t*9)*0.4 : 0.2 + Math.sin(u.t*2)*0.1;      // a wave, then rest
    u.eye.emissive.setRGB(0.2, 0.9, 1.0); u.eye.emissiveIntensity = 2.2 + Math.sin(u.t*4)*0.4;
    u.panel.material.emissive.setRGB(0.2, 1, 0.5);
    (u.rings || []).forEach(r=>{ r.material.emissive.setRGB(0.2, 1, 1.1); r.material.emissiveIntensity = 2.2; });
  }
  /* THE LAB, alive: the rings turn, the field breathes and never quite holds still, the motes orbit it, the
     arms work, the monitors read it — and when the prototype is in it, a thread of it reaches the stand. */
  function tickLab(dt){
    const L = S && S.lab;
    if(!L || !S.group.visible){ labMood(0, dt); return; }
    const u = S.robot.userData;
    L.tick(dt, u);
    // the beam: from the field to the stand, while the prototype sits in it
    const b = L.beam, on = !!u.field;
    b.material.opacity = on ? (u.on ? 0.55 : 0.25 + Math.random()*0.65) : 0;
    if(on){ const a = new THREE.Vector3(...L.at), r = S.robot.position.clone(); r.y += 0.55; const m = a.clone().add(r).multiplyScalar(0.5);
      b.position.copy(m); b.scale.set(1, a.distanceTo(r), 1); b.lookAt(r); b.rotateX(Math.PI/2); }
    // in here, the room is the field's: dark, violet, and drawn like a comic
    const c = typeof G !== 'undefined' && G.camera && G.camera.position, X = S.X;
    labMood(c && c.x > X(-5) && c.x < X(11) && c.z > -48 && c.z < -34 && c.y < ROOMS.room ? 1 : 0, dt);
  }
  /* THE LAB'S LIGHT. The rest of the school is daylight through glass; in Room 120 the sky light and the
     sun go almost to nothing, what is left is violet, and the grade goes to the comic (TSHLOOK's ink,
     halftone and misregistered colour). What the day had is put back, exactly, on the way out. */
  let mood = 0, base = null;
  const LABC = { amb:new THREE.Color(0x3a2a6a), sky:new THREE.Color(0x5a3ab0), ground:new THREE.Color(0x0a0612) };
  function labMood(want, dt){
    if(typeof G === 'undefined' || !G.amb || !window.TSHLOOK) return;
    if(!base){ if(want === 0) return;
      base = { env:G.scene.environmentIntensity === undefined ? 1 : G.scene.environmentIntensity, amb:G.amb.intensity, ambC:G.amb.color.clone(), hemi:G.hemi.intensity, sky:G.hemi.color.clone(), ground:G.hemi.groundColor.clone(), sun:G.sun ? G.sun.intensity : 0,
               bloom:TSHLOOK.fx.bloom, vig:TSHLOOK.fx.vig, gain:TSHLOOK.fx.gain.clone() }; }
    mood += (want - mood)*Math.min(1, dt*4); if(Math.abs(mood - want) < 0.003) mood = want;
    const k = mood, B = base, l = (a, b_) => a + (b_ - a)*k;
    G.scene.environmentIntensity = l(B.env, 0.2);               // the day's reflections are what washed it out
    G.amb.intensity = l(B.amb, 0.12); G.amb.color.copy(B.ambC).lerp(LABC.amb, k);
    G.hemi.intensity = l(B.hemi, 0.26); G.hemi.color.copy(B.sky).lerp(LABC.sky, k); G.hemi.groundColor.copy(B.ground).lerp(LABC.ground, k);
    if(G.sun) G.sun.intensity = l(B.sun, 0.05);
    const F = TSHLOOK.fx; F.comic = k; F.bloom = l(B.bloom, 1.15); F.vig = l(B.vig, 0.7); F.gain.copy(B.gain).lerp(new THREE.Vector3(1.08, 0.96, 1.12), k);
    if(k === 0 && want === 0) base = null;                     // all of it back as it was
  }
  /* the second thing: a small sensor puck with a status light */
  function makeGadget(){
    const d = new THREE.Group();
    d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.06, 20), std({ color:0x2a2e34, roughness:0.4, metalness:0.6 })));
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color:0x111111, emissive:new THREE.Color(1, 0.2, 0.1), emissiveIntensity:1.5 }));
    led.position.set(0, 0.04, 0.08); d.add(led);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI*2, 0, Math.PI/2), std({ color:0x9fd8e0, roughness:0.05, transparent:true, opacity:0.6 }));
    dome.position.y = 0.03; d.add(dome);
    d.userData = { led, fix(){ led.material.emissive.setRGB(0.2, 1, 0.4); } };
    return d;
  }

  /* ======================================================= the people
     Spawned through tsh.js (so they are drawn, animated, and have faces like
     everybody else in TSH), as kind 'school': tsh.js's NPC loop hands each one
     back here (tickPerson) to be moved. */
  const STUDENTS = ['walk-s', 'walk-t', 'walk-u', 'walk-v', 'walk-x', 'nia', 'zuri'];        // not theo: he is Theo
  function populate(spawn){
    if(!S) return;
    const X = S.X, P = S.people; P.length = 0;
    const add = (char, x, z, o) => { const n = spawn('school', char, x, z, Object.assign({ inApt:true, group:S.group, state:'school', y:0 }, o)); P.push(n); return n; };
    S.guard = add('mechanic', S.spots.guard[0], S.spots.guard[1], { yaw:Math.PI*0.75, name:'guard', wear:{ head:'cap' } });
    const tl = S.spots.teacherLobby;
    S.teacher = add('sable', tl[0], tl[1], { yaw:0, name:'teacher', wear:{ face:'teacher-glasses' } });
    S.teacher.route = TEACHER_ROUTE.map(([x, z, w, look])=>({ x:X(x), z, w, look }));
    // students walking up and down the hall and across the atrium, in twos and threes, at their own pace
    [[0, 2.6, -10, 0.95, -32, -7], [1, 3.6, -26, 1.1, -32, -7], [2, 0.4, -18, 0.85, -32, -7], [3, 1.4, -8, 1.0, -32, -7], [4, -3, 6, 0.9, 1, 14], [5, 6.6, 2, 1.05, -4, 12]].forEach(([i, x, z, sp, a, b], k)=>{
      const n = add(STUDENTS[i], X(x), z, { name:'student' + k }); n.walk = { a, b, dir:k % 2 ? 1 : -1, sp, x:X(x) }; });
    // and a few standing about: at the lockers, under the stair, by 114
    [[6, -0.3, -22, Math.PI/2], [7, 4.3, -12, -Math.PI/2], [1, 5.6, 9, Math.PI*0.9], [2, 12, -25.2, Math.PI], [3, 13, -26.8, 0]].forEach(([i, x, z, yaw], k)=>{
      const n = add(STUDENTS[i], X(x), z, { yaw, name:'stand' + k }); n.chat = true; });
  }
  // her round: [x (plan), z, wait at it, which way she looks while she waits]
  const TEACHER_ROUTE = [[2.5, -4.2, 2.5, 0], [-8.6, 2, 3.5, -Math.PI/2], [-3, 6.5, 0.8, 0], [2, -5, 1.2, Math.PI], [2, -16, 2.2, -Math.PI/2],
                         [2, -26, 2.4, Math.PI/2], [2, -32.8, 0.6, Math.PI], [2, -36, 3.5, 0], [2, -31, 0.5, 0], [2, -20, 1.5, Math.PI/2], [2, -5, 1, 0]];
  function tickPerson(n, dt){
    if(!S) return;
    if(n === S.teacher) return tickTeacher(n, dt);
    if(n.walk){
      const w = n.walk, zt = w.dir > 0 ? w.b : w.a;
      if(n.hold){ n.clip = 'idle'; return; }
      const dz = zt - n.z;
      if(Math.abs(dz) < 0.2){ w.dir = -w.dir; return; }
      n.z += Math.sign(dz)*w.sp*dt; n.x += (w.x - n.x)*Math.min(1, dt*2);
      n.yaw = dz > 0 ? 0 : Math.PI; n.moving = true;
      return;
    }
    n.clip = n.chat ? (Math.sin(n.t*0.7 + n.x) > 0.6 ? 'talk' : 'idle') : 'idle';
  }

  /* ========================================================= the sneak */
  let sn = null;
  function tickTeacher(n, dt){
    if(!sn || n.hold){ n.clip = n.clip || 'idle'; return; }
    const R = n.route, p = R[n.ri || 0];
    if(n.wait > 0){ n.wait -= dt; if(p.look !== undefined) n.yaw += angD(p.look, n.yaw)*Math.min(1, dt*3); n.clip = 'idle';
      // now and then, while she waits, a look back over her shoulder
      if(n.wait < 1.2 && n.wait > 0.9) n.yaw += Math.sin(n.t*6)*dt*2;
      return; }
    const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz);
    if(d < 0.15){ n.wait = p.w; n.ri = ((n.ri || 0) + 1) % R.length; return; }
    const sp = 1.15, step = Math.min(d, sp*dt);
    n.x += dx/d*step; n.z += dz/d*step; n.yaw += angD(Math.atan2(dx, dz), n.yaw)*Math.min(1, dt*6); n.moving = true;
  }
  const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  /* her eyes: a cone 70° wide and nine metres long, walls in the way, a student in the way */
  const CONE = { half:0.62, range:9 };
  function sees(px, pz, py){
    const t = S.teacher; if(!t) return 0;
    if(py > 2.5) return 0;                               // up on a gallery: out of her eyeline
    const dx = px - t.x, dz = pz - t.z, d = Math.hypot(dx, dz);
    if(d > CONE.range) return 0;
    if(Math.abs(angD(Math.atan2(dx, dz), t.yaw)) > CONE.half && d > 1.2) return 0;
    if(K.los && !K.los(t.x, 1.6, t.z, px, 1.3, pz)) return 0;
    // somebody between them: walking behind a student
    for(const n of S.people){ if(n === t || n === S.guard || n.gone) continue;
      const k = ((n.x - t.x)*dx + (n.z - t.z)*dz)/(d*d); if(k <= 0.05 || k >= 0.95) continue;
      const qx = t.x + dx*k, qz = t.z + dz*k; if(Math.hypot(n.x - qx, n.z - qz) < 0.42) return 0; }
    return d < 2.2 ? 3 : 1 + (CONE.range - d)/CONE.range*1.5;
  }
  function coneMesh(){
    const seg = 24, pos = [0, 0.02, 0];
    for(let i = 0; i <= seg; i++){ const a = -CONE.half + i/seg*CONE.half*2; pos.push(Math.sin(a)*CONE.range, 0.02, Math.cos(a)*CONE.range); }
    const idx = []; for(let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0xffd060, transparent:true, opacity:0.18, depthWrite:false, side:THREE.DoubleSide }));
    m.renderOrder = 2; return m;
  }
  /* start: she is in the lobby with the teacher across it. K: { player(), los, feet, onCaught(how), note, cue, prompt } */
  function sneakStart(hooks){
    K = hooks;
    const t = S.teacher; t.ri = 1; t.wait = 0.6; t.hold = false;
    sn = { meter:0, hidden:null, board:false, done:false, cone:coneMesh(), t:0, pa:false };
    S.group.add(sn.cone);
  }
  function sneakStop(){ if(sn && sn.cone.parent) sn.cone.parent.remove(sn.cone); sn = null; }
  function tickSneak(dt){
    if(!S) return;
    tickRobot(dt);
    if(!sn || sn.done) return;
    const t = S.teacher, p = K.player();
    sn.cone.position.set(t.x, 0, t.z); sn.cone.rotation.y = t.yaw;
    if(sn.hidden){                                       // in the bathroom: she waits it out
      sn.hidden.t -= dt;
      if(sn.hidden.t <= 0){ const out = sn.hidden; sn.hidden = null; return caught('bathroom', out); }
      return;
    }
    sn.t += dt;
    // exploring long enough, or off where she cannot follow: the PA calls her in
    if(!sn.pa && sn.t > PA_AFTER) return pa();
    if(sn.pa) return;                                    // the PA's film is playing; it ends at Room 120
    let k = sees(p.x, p.z, p.y || 0);
    if(sn.board){ k *= Math.hypot(p.x - t.x, p.z - t.z) < 2.4 ? 1.4 : 0.2; }   // reading the board: a back like anybody's — until she is right behind you
    if(k > 0){ sn.meter = Math.min(1, sn.meter + k*dt*0.55); if(!sn.warned && sn.meter > 0.35){ sn.warned = true; K.cue('sus'); } }
    else sn.meter = Math.max(0, sn.meter - dt*0.25);
    sn.cone.material.color.setRGB(1, 0.82 - sn.meter*0.6, 0.38 - sn.meter*0.3); sn.cone.material.opacity = 0.16 + sn.meter*0.2;
    if(sn.meter >= 1) return caught('seen');
    // made it to 114: if she is right behind you, that is that; if she is nowhere near, the PA has your name
    const d114 = Math.hypot(p.x - S.spots.room114[0], p.z - S.spots.room114[1]);
    if(d114 < 1.3 && !sn.pa){ const near = Math.hypot(p.x - t.x, p.z - t.z) < 9 && K.los && K.los(t.x, 1.6, t.z, p.x, 1.3, p.z); return near ? caught('door') : pa(); }
  }
  /* THE PA: three notes, and her name. A film (tsh.js): she hears it — and then Room 120's doorway, her
     teacher waiting in it. */
  const PA_AFTER = 150;
  function pa(){
    if(!sn || sn.pa) return;
    sn.pa = true; sn.meter = 0;
    if(K.onPA) K.onPA(()=>caught('pa')); else caught('pa');
  }
  function caught(how, o){
    if(!sn || sn.done) return;
    sn.done = true;
    if(sn.cone.parent) sn.cone.parent.remove(sn.cone);
    const p = K.player(), t = S.teacher;
    // wherever it was, she is a couple of steps behind Robin when Robin turns round
    if(how === 'bathroom'){ t.x = S.spots.bathroom[0] + 2.2; t.z = S.spots.bathroom[1] + 0.4; }
    else if(how === 'door'){ t.x = p.x - 2.0; t.z = p.z + 0.3; }
    else if(how === 'pa'){ t.x = S.spots.room120In[0]; t.z = S.spots.room120In[1] - 0.4; }
    t.yaw = Math.atan2(p.x - t.x, p.z - t.z); t.hold = true;
    K.onCaught(how);
  }
  /* E at the board: read it (or stop) */
  function board(on){ if(sn) sn.board = on; }
  function bathroom(){ if(!sn || sn.hidden) return false; sn.hidden = { t:4.5 }; return true; }
  function meter(){ return sn ? sn.meter : 0; }

  return { build, populate, tickPerson, tickSneak, sneakStart, sneakStop, board, bathroom, meter, tickRobot, tickLab, 
           get S(){ return S; }, get on(){ return !!sn && !sn.done; }, get hiding(){ return !!(sn && sn.hidden); }, get reading(){ return !!(sn && sn.board); }, SX, H };
})();
