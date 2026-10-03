/* =====================================================================
   TSH — HARBOR LANE HIGH (The Other Robin). The inside of the school
   across the lane from B21: off the map at x = 400, like the flat, so the
   street is not drawn through its walls and its door is a fade.

       ┌──── ROOM 120 (her teacher's) ────┐          z −42 … −30
       │  desks · whiteboard · workbench  │
       └───────────────┤door├─────────────┘
          ┌─GIRLS┐      │    │
          │ WC   ├──────┤ H  ├──────────────┐ 114   (west branch z −12…−8,
          └──────┘      │ A  │──────────────┘        east branch z −24…−20)
                        │ L  │  lockers both sides
                        │ L  │  bulletin board
          ┌─────────────┘    └─────────────┐
          │ OFFICE   LOBBY   (guard's desk)│        z 4 … 16
          └──────────(revolving door)──────┘

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
  const SX = 400, H = 3.6;
  let S = null;                  // what build() made
  let K = null;                  // tsh.js's hooks, while the sneak runs
  const std = o => new THREE.MeshStandardMaterial(o);
  const glowM = (col, k, map) => new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(col), emissiveIntensity:k||1, emissiveMap:map||null, map:map||null, roughness:0.6 });
  function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c){ const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const font = (px, w) => (w || 'bold ') + px + 'px ' + (window.uiFont ? uiFont() : 'sans-serif');

  /* ----------------------------------------------------------- the art */
  function sign(text, o){
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
  function trophyTex(){
    const c = cv(512, 256), x = c.getContext('2d');
    x.fillStyle = '#2a2018'; x.fillRect(0, 0, 512, 256);
    [[60, 120, '#e8c060'], [160, 90, '#d0d4d8'], [260, 130, '#e8c060'], [360, 100, '#c88a50'], [450, 120, '#e8c060']].forEach(([cx, hgt, col])=>{
      x.fillStyle = col; x.fillRect(cx - 14, 230 - hgt*0.4, 28, hgt*0.4); x.beginPath(); x.arc(cx, 230 - hgt*0.4, 24, Math.PI, 0); x.fill(); x.fillRect(cx - 26, 228, 52, 12); });
    x.fillStyle = '#f2e6c0'; x.font = font(18); x.fillText('HAWKS · ROBOTICS · STATE', 120, 30);
    return tex(c);
  }

  /* ========================================================== the build */
  function build(root, out){
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const solids = [], plats = [], lights = [], spots = {};
    const wallM = std({ color:0xd9d2bf, roughness:0.85 }), lowM = std({ color:0x4f7a8c, roughness:0.7 });
    const floorT = tiles(), floorM = std({ map:floorT, roughness:0.32, metalness:0.05 });
    const ceilM = std({ color:0xf2f2ee, roughness:0.9 }), trimM = std({ color:0x2a4a6a, roughness:0.6 }), woodM = std({ color:0x8a6a48, roughness:0.6 });
    const panelM = glowM(0xfffaf0, 1.6), lockA = std({ map:lockerTex('#2f5f9a'), roughness:0.45, metalness:0.4 }), lockB = std({ map:lockerTex('#7a2a2a'), roughness:0.45, metalness:0.4 });
    const box = (m, x, y, z, w, h, d, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if(o && o.ry) b.rotation.y = o.ry; b.castShadow = !!(o && o.shadow); b.receiveShadow = true; g.add(b); return b; };
    const plane = (m, x, y, z, w, h, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry || 0; g.add(p); return p; };
    const solid = (x1, x2, z1, z2, y2) => { const s = { x1, x2, z1, z2, y1:-1, y2:y2 === undefined ? H + 1 : y2, tag:'school' }; solids.push(s); return s; };
    // a wall: cream over a painted dado, a rail between them, a dark skirting
    const wall = (x1, x2, z1, z2) => { const cx = (x1 + x2)/2, cz = (z1 + z2)/2, w = x2 - x1, d = z2 - z1;
      box(wallM, cx, (H + 1.1)/2, cz, w, H - 1.1, d); box(lowM, cx, 0.55, cz, w + 0.01, 1.1, d + 0.01);
      box(trimM, cx, 1.12, cz, w + 0.03, 0.06, d + 0.03); box(trimM, cx, 0.06, cz, w + 0.02, 0.12, d + 0.02); solid(x1, x2, z1, z2); };
    const room = (x1, x2, z1, z2) => { const f = box(floorM, (x1 + x2)/2, -0.05, (z1 + z2)/2, x2 - x1, 0.1, z2 - z1);
      const uv = f.geometry.attributes.uv; for(let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)*(x2 - x1)/4, uv.getY(i)*(z2 - z1)/4);
      box(ceilM, (x1 + x2)/2, H + 0.05, (z1 + z2)/2, x2 - x1, 0.1, z2 - z1); plats.push({ x1, x2, z1, z2, top:0, tag:'school' }); };
    const lamp = (x, z, k) => { box(panelM, x, H - 0.02, z, 1.2, 0.04, 0.6); lights.push({ x, y:H - 0.3, z, col:new THREE.Color(0xfff4e4), k:(k || 7)*0.5, d:8 }); };
    const X = v => SX + v;                                // plan coordinates are relative to x = 400

    // ---- the rooms' floors and ceilings
    room(X(-8), X(10), 4, 16);                            // lobby
    room(X(-1), X(4), -30, 4);                            // the hall
    room(X(-14), X(-1), -12, -8);                         // west branch, to the bathroom
    room(X(4), X(20), -24, -20);                          // east branch, to 114
    room(X(-5), X(9), -42, -30);                          // Room 120
    // ---- walls
    const T = 0.3;
    // lobby
    wall(X(-8) - T, X(-8), 4 - T, 16 + T); wall(X(10), X(10) + T, 4 - T, 16 + T);
    wall(X(-8), X(-1), 4 - T, 4); wall(X(4), X(10), 4 - T, 4);
    // the glass front, with the revolving door in it (it only turns: the way out is E)
    box(std({ color:0xa8d4e4, roughness:0.05, metalness:0.1, transparent:true, opacity:0.35 }), X(1), 1.9, 16.1, 18, 3.8, 0.06); solid(X(-8), X(10), 16, 16 + T);
    const daylight = glowM(0xdceaf6, 0.55); plane(daylight, X(1), 1.9, 16.4, 18, 3.8, Math.PI);
    for(let k = -8; k <= 10; k += 3) box(trimM, X(k), 1.9, 16.05, 0.12, 3.8, 0.12);
    { const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 24, 1, true), std({ color:0xb8dce8, roughness:0.1, transparent:true, opacity:0.25, side:THREE.DoubleSide, depthWrite:false }));
      drum.position.set(X(1), 1.3, 15.4); g.add(drum); }
    spots.inside = [X(1), 13.6]; spots.door = [X(1), 14.6];
    // the hall (gaps for the branches)
    wall(X(-1) - T, X(-1), -30, -12); wall(X(-1) - T, X(-1), -8, 4 - T);
    wall(X(4), X(4) + T, -30, -24); wall(X(4), X(4) + T, -20, 4 - T);
    // west branch, and the bathroom door at its end
    wall(X(-14), X(-1) - T, -12 - T, -12); wall(X(-14), X(-1) - T, -8, -8 + T); wall(X(-14) - T, X(-14), -12 - T, -8 + T);
    box(woodM, X(-14) + 0.04, 1.05, -10, 0.06, 2.1, 1.0);
    { const s = plane(new THREE.MeshBasicMaterial({ map:sign('GIRLS', { w:256, h:96, bg:'#7a3a6a' }) }), X(-14) + 0.08, 2.4, -10, 0.7, 0.26, Math.PI/2); s.userData.flat = true; }
    spots.bathroom = [X(-13.2), -10];
    // east branch, and 114 at its end
    wall(X(4) + T, X(20), -24 - T, -24); wall(X(4) + T, X(20), -20, -20 + T); wall(X(20), X(20) + T, -24 - T, -20 + T);
    box(woodM, X(20) - 0.04, 1.05, -22, 0.06, 2.1, 1.0);
    box(glowM(0xdfe8ee, 0.6), X(20) - 0.07, 1.5, -21.75, 0.02, 0.5, 0.25);
    plane(new THREE.MeshBasicMaterial({ map:sign('ROOM 114', { w:256, h:96 }) }), X(20) - 0.08, 2.4, -22, 0.7, 0.26, -Math.PI/2);
    spots.room114 = [X(19), -22];
    // Room 120, and its door off the end of the hall
    wall(X(-5) - T, X(-5), -42 - T, -30 + T); wall(X(9), X(9) + T, -42 - T, -30 + T); wall(X(-5), X(9), -42 - T, -42);
    wall(X(-5), X(1), -30, -30 + T); wall(X(3), X(9), -30, -30 + T); wall(X(-1) - T, X(-1), -30, -30 + T); wall(X(4), X(4) + T, -30, -30 + T);
    box(trimM, X(2), 2.25, -30 + T/2, 2, 0.1, T); box(wallM, X(2), H - 0.65, -30 + T/2, 2, 1.3, T);
    plane(new THREE.MeshBasicMaterial({ map:sign('ROOM 120', { w:256, h:96 }) }), X(2), 2.5, -29.62, 0.7, 0.26, 0);
    spots.room120Door = [X(2), -29.2]; spots.room120In = [X(2), -31.4];

    // ---- lockers, both sides of the hall and along the east branch; a bulletin board in the run of them
    const lockers = (x, z1, z2, face) => { for(let z = z1; z < z2 - 0.1; z += 2){ const len = Math.min(2, z2 - z); const m = (Math.floor(z/2) % 2) ? lockA : lockB;
      box(m, x + face*0.22, 1.0, z + len/2, 0.44, 2.0, len); } solid(Math.min(x, x + face*0.45), Math.max(x, x + face*0.45), z1, z2, 2.1); };
    lockers(X(-1), -29.6, -13, 1); lockers(X(-1), -7, -2, 1); lockers(X(-1), 1.6, 3.6, 1);
    lockers(X(4), -29.6, -25, -1); lockers(X(4), -19, -4, -1);
    // the board: between the lockers on the west wall
    plane(std({ map:corkboard(), roughness:0.9 }), X(-1) + 0.03, 1.55, -0.2, 3.2, 1.6, Math.PI/2);
    box(woodM, X(-1) + 0.04, 1.55, -0.2, 0.05, 1.72, 3.32).material = woodM;
    spots.board = [X(-0.1), -0.2];
    // ---- the lobby: the guard's desk, a bench, the trophy case, the office door, a banner
    box(woodM, X(-4.5), 0.5, 9, 0.6, 1.0, 3.2, { shadow:true }); box(woodM, X(-3.4), 0.5, 10.4, 2.2, 1.0, 0.6, { shadow:true });
    box(std({ color:0xe8e6e0, roughness:0.4 }), X(-4.3), 1.02, 9, 0.9, 0.04, 3.4); solid(X(-4.8), X(-2.3), 7.4, 10.7, 1.0);
    box(std({ color:0x111418, roughness:0.4 }), X(-4.6), 1.35, 8.6, 0.05, 0.35, 0.5, {}).material.emissive = new THREE.Color(0.15, 0.3, 0.4);
    spots.guard = [X(-5.5), 9.6];
    box(woodM, X(7.5), 0.25, 12.5, 2.6, 0.5, 0.6); solid(X(6.2), X(8.8), 12.2, 12.8, 0.5);
    plane(std({ map:trophyTex(), roughness:0.3 }), X(10) - 0.03, 1.4, 8, 3, 1.5, -Math.PI/2);
    box(std({ color:0xcfe8f0, transparent:true, opacity:0.2, roughness:0.05 }), X(10) - 0.25, 1.4, 8, 0.45, 1.6, 3.1);
    box(woodM, X(-8) + 0.04, 1.05, 6.2, 0.06, 2.1, 1.0);
    plane(new THREE.MeshBasicMaterial({ map:sign('MAIN OFFICE', { w:384, h:96 }) }), X(-8) + 0.08, 2.4, 6.2, 0.9, 0.24, Math.PI/2);
    spots.office = [X(-7), 6.2];
    { const b = plane(new THREE.MeshBasicMaterial({ map:sign('HARBOR LANE HIGH · HOME OF THE HAWKS', { w:1024, h:128, bg:'#16324a', ink:'#f0c040' }) }), X(1), 3.1, 4.05, 7, 0.9, 0); b.userData.flat = true; }
    // ---- Room 120: desks in rows, the whiteboard, her desk, and the workbench with the robot on it
    plane(std({ map:whiteboard(), roughness:0.25 }), X(2), 1.7, -41.68, 6, 2.25, 0);
    box(trimM, X(2), 0.56, -41.6, 6.2, 0.06, 0.18);
    const deskM = std({ color:0xd8c8a8, roughness:0.5 }), legM = std({ color:0x3a3a40, roughness:0.4, metalness:0.6 });
    const desk = (x, z) => { box(deskM, x, 0.74, z, 1.1, 0.05, 0.62); [[-0.5, -0.26], [0.5, -0.26], [-0.5, 0.26], [0.5, 0.26]].forEach(([a, b])=>box(legM, x + a, 0.37, z + b, 0.04, 0.74, 0.04));
      box(std({ color:0x2a4a6a, roughness:0.6 }), x, 0.45, z + 0.62, 0.45, 0.05, 0.42); solid(x - 0.56, x + 0.56, z - 0.32, z + 0.32, 0.78); };
    for(let r = 0; r < 3; r++) for(let c = 0; c < 4; c++) desk(X(-3 + c*2.3), -38.6 + r*2.2);
    spots.seat = [X(1.6), -34.2 + 0.62];                     // the desk she is sat at (front row of the back)
    spots.seatDesk = [X(1.6), -34.2];
    box(woodM, X(5.4), 0.4, -39.4, 1.8, 0.8, 0.8, { shadow:true }); solid(X(4.5), X(6.3), -39.8, -39, 0.82);  // her desk
    spots.teacherDesk = [X(5.4), -38.6];
    // the workbench along the east wall
    box(std({ color:0x5a5f66, roughness:0.4, metalness:0.6 }), X(8.2), 0.88, -35, 1.2, 0.06, 3.4); [-1.6, 1.6].forEach(dz=>box(legM, X(8.2), 0.44, -35 + dz, 1.1, 0.88, 0.06));
    solid(X(7.5), X(9), -36.8, -33.2, 0.92);
    spots.bench = [X(7.0), -35];
    for(let k = 0; k < 5; k++) box(std({ color:[0xc84a2a, 0x2a8ac8, 0xe8c040, 0x3aaa5a, 0x8a5ac8][k], roughness:0.5 }), X(8.5), 1.0, -36.4 + k*0.25, 0.25, 0.18, 0.18);
    // ---- the lights: panels down the hall and over the rooms
    for(let z = 1; z > -30; z -= 5) lamp(X(1.5), z, 6);
    lamp(X(-2), 8); lamp(X(4), 8); lamp(X(-2), 13); lamp(X(4), 13);
    lamp(X(-7), -10, 5); lamp(X(12), -22, 5);
    lamp(X(0), -34, 8); lamp(X(5), -34, 8); lamp(X(0), -39, 8); lamp(X(5), -39, 8);
    // and the robot on the bench (tsh.js lifts it and puts it down; it moves when it is fixed)
    const robot = makeRobot(); robot.position.set(X(8.2), 0.91, -35); robot.rotation.y = -Math.PI/2; g.add(robot);
    const gadget = makeGadget(); gadget.position.set(X(5.2), 0.83, -39.3); g.add(gadget);

    out.solids.push(...solids); out.plats.push(...plats);
    S = { group:g, solids, lights, spots, robot, gadget, H, people:[], X };
    return S;
  }
  /* THE ROBOT: a little two-legged thing with a camera head and an arm, made of boxes. Broken, it slumps;
     fixed (robot.userData.on), it stands, looks about, and waves. */
  function makeRobot(){
    const r = new THREE.Group(), shell = std({ color:0xe8eaec, roughness:0.35, metalness:0.3 }), dark = std({ color:0x22262c, roughness:0.4, metalness:0.6 });
    const eye = new THREE.MeshStandardMaterial({ color:0x111111, emissive:new THREE.Color(0.2, 0.9, 1.0), emissiveIntensity:0 });
    const body = new THREE.Group(); r.add(body);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.18), shell); torso.position.y = 0.3; body.add(torso);
    const head = new THREE.Group(); head.position.y = 0.46; body.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), shell));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), eye); lens.rotation.x = Math.PI/2; lens.position.set(0, 0, 0.08); head.add(lens);
    const legs = [-0.08, 0.08].map(x=>{ const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), dark); l.position.set(x, 0.1, 0); r.add(l); return l; });
    const arm = new THREE.Group(); arm.position.set(0.16, 0.36, 0); body.add(arm);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), dark); a.position.y = -0.09; arm.add(a);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshStandardMaterial({ color:0x0a0c10, emissive:new THREE.Color(1, 0.25, 0.15), emissiveIntensity:0.6 }));
    panel.position.set(0, 0.3, 0.091); body.add(panel);
    r.userData = { on:false, t:0, body, head, arm, eye, panel, legs };
    body.rotation.x = 0.5; head.rotation.x = 0.4; arm.rotation.z = 0.2;        // broken: slumped forward
    return r;
  }
  function tickRobot(dt){
    if(!S) return;
    const u = S.robot.userData; u.t += dt;
    if(!u.on) return;
    u.body.rotation.x += (0 - u.body.rotation.x)*Math.min(1, dt*4);
    u.head.rotation.x += (0 - u.head.rotation.x)*Math.min(1, dt*4);
    u.head.rotation.y = Math.sin(u.t*1.3)*0.6;
    u.arm.rotation.z = u.t < 4 ? 2.4 + Math.sin(u.t*9)*0.4 : 0.2 + Math.sin(u.t*2)*0.1;      // a wave, then rest
    u.eye.emissiveIntensity = 2.2 + Math.sin(u.t*4)*0.4;
    u.panel.material.emissive.setRGB(0.2, 1, 0.5);
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
  const STUDENTS = ['walk-s', 'walk-t', 'walk-u', 'walk-v', 'walk-x', 'theo', 'nia', 'zuri'];
  function populate(spawn){
    if(!S) return;
    const X = S.X, P = S.people; P.length = 0;
    const add = (char, x, z, o) => { const n = spawn('school', char, x, z, Object.assign({ inApt:true, group:S.group, state:'school', y:0 }, o)); P.push(n); return n; };
    S.guard = add('mechanic', S.spots.guard[0], S.spots.guard[1], { yaw:Math.PI*0.75, name:'guard', wear:{ head:'cap' } });
    S.teacher = add('sable', X(2), 5.0, { yaw:Math.PI, name:'teacher', wear:{ face:'teacher-glasses' } });
    S.teacher.route = TEACHER_ROUTE.map(([x, z, w, look])=>({ x:X(x), z, w, look }));
    // students walking the hall in twos and threes, up and down, at their own pace
    [[0, 2.2, -2, 0.95], [1, 3.0, -26, 1.1], [2, 0.4, -14, 0.85], [3, 1.4, -6, 1.0], [4, 2.6, 1.5, 0.9]].forEach(([i, x, z, sp], k)=>{
      const n = add(STUDENTS[i], X(x), z, { name:'student' + k }); n.walk = { a:-28, b:3, dir:k % 2 ? 1 : -1, sp, x:X(x) }; });
    // and a few standing about: at the lockers, in the lobby, by 114
    [[5, -0.3, -18, Math.PI/2], [6, 3.3, -9, -Math.PI/2], [7, 6, 12, Math.PI*0.9], [1, 12, -21.2, Math.PI], [2, 13, -22.8, 0]].forEach(([i, x, z, yaw], k)=>{
      const n = add(STUDENTS[i], X(x), z, { yaw, name:'stand' + k }); n.chat = true; });
  }
  // her round: [x (plan), z, wait at it, which way she looks while she waits]
  const TEACHER_ROUTE = [[2, 5, 2.5, Math.PI], [-6.4, 6.4, 3.5, -Math.PI/2], [-2, 9, 0.8, 0], [1.5, 2, 1.2, 0], [1.5, -10, 2.2, -Math.PI/2],
                         [1.5, -22, 2.4, Math.PI/2], [2, -29, 0.6, Math.PI], [2, -32, 3.5, 0], [2, -28, 0.5, 0], [1.5, -16, 1.5, Math.PI/2], [1.5, 1, 1, 0]];
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
  function sees(px, pz){
    const t = S.teacher; if(!t) return 0;
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
    sn = { meter:0, hidden:null, board:false, done:false, cone:coneMesh() };
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
    let k = sees(p.x, p.z);
    if(sn.board){ k *= Math.hypot(p.x - t.x, p.z - t.z) < 2.4 ? 1.4 : 0.2; }   // reading the board: a back like anybody's — until she is right behind you
    if(k > 0){ sn.meter = Math.min(1, sn.meter + k*dt*0.55); if(!sn.warned && sn.meter > 0.35){ sn.warned = true; K.cue('sus'); } }
    else sn.meter = Math.max(0, sn.meter - dt*0.25);
    sn.cone.material.color.setRGB(1, 0.82 - sn.meter*0.6, 0.38 - sn.meter*0.3); sn.cone.material.opacity = 0.16 + sn.meter*0.2;
    if(sn.meter >= 1) return caught('seen');
    // made it to 114: and she is right behind you
    const d114 = Math.hypot(p.x - S.spots.room114[0], p.z - S.spots.room114[1]);
    if(d114 < 1.3) return caught('door');
  }
  function caught(how, o){
    if(!sn || sn.done) return;
    sn.done = true;
    if(sn.cone.parent) sn.cone.parent.remove(sn.cone);
    const p = K.player(), t = S.teacher;
    // wherever it was, she is a couple of steps behind Robin when Robin turns round
    if(how === 'bathroom'){ t.x = S.spots.bathroom[0] + 2.2; t.z = S.spots.bathroom[1] + 0.4; }
    else if(how === 'door'){ t.x = p.x - 2.0; t.z = p.z + 0.3; }
    t.yaw = Math.atan2(p.x - t.x, p.z - t.z); t.hold = true;
    K.onCaught(how);
  }
  /* E at the board: read it (or stop) */
  function board(on){ if(sn) sn.board = on; }
  function bathroom(){ if(!sn || sn.hidden) return false; sn.hidden = { t:4.5 }; return true; }
  function meter(){ return sn ? sn.meter : 0; }

  return { build, populate, tickPerson, tickSneak, sneakStart, sneakStop, board, bathroom, meter, tickRobot,
           get S(){ return S; }, get on(){ return !!sn && !sn.done; }, get hiding(){ return !!(sn && sn.hidden); }, get reading(){ return !!(sn && sn.board); }, SX, H };
})();
