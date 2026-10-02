/* =====================================================================
   TSH — ROBIN'S ROOM. Sixteen, punk, and unusually good at something.

   The flat in tshcity.js is the shell (walls, the bench, the bed, the
   door, the window). This is everything that makes it hers: band posters
   over the bed, string lights, a guitar against an amp, clothes on the
   floor, a speaker still playing at eleven at night — and, if you look,
   the things a sixteen-year-old should not have:
     · a corkboard over the bench: a map of the district with pins and
       red string, drone routes, and a clipping — WHO IS YU?
     · sketches for a costume and for the boots, under the bed and behind
       a poster that has come away at the corner
     · YU sprayed on the wall by the window
     · today's paper on the bench: THE CITY IS SAFE, says the Director
     · and by the door, an envelope from an admissions office, unopened.
   AND THE BUSINESS. She makes things and sells them, and the room is the
   workshop and the shipping desk at once: fashion sketches on the walls,
   a sewing machine and circuit boards on the bench, a jacket on a dress
   form with wiring in its seams, sneakers with coils in the soles, half-
   made gadgets, tonight's orders packed and labelled, burner phones,
   cash, the orders on index cards. And in the kitchen corner, dinner,
   still covered, with a note from her mother.

   ALL OF IT IS DRAWN HERE, on canvases: no image files to fetch, and it
   is all text a camera can read up close. The opening (tsh.js) films it
   from a dozen angles; out.room says where each thing is.
   ===================================================================== */
window.TSHROOM = (function(){
  const V3 = THREE.Vector3;
  const L = () => window.TSHLOOK;
  const UI = () => (window.uiFont ? uiFont() : 'monospace');
  let rnd = Math.random;
  function seeded(s){ return function(){ s = (s*16807) % 2147483647; return (s - 1)/2147483646; }; }
  const R = (a, b) => a + rnd()*(b - a);
  const pick = a => a[Math.floor(rnd()*a.length)];

  function canvas(w, h){ return L().cv(w, h); }
  function tex(c){ return L().tex(c); }
  /* a picture on a wall (or a floor): a plane with a canvas on it */
  function picture(group, c, w, h, pos, ry, o){
    o = o || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map:tex(c), roughness:o.rough === undefined ? 0.85 : o.rough,
      transparent:!!o.alpha, side:o.double ? THREE.DoubleSide : THREE.FrontSide, emissive:o.glow ? new THREE.Color(1,1,1) : new THREE.Color(0,0,0), emissiveMap:o.glow ? tex(c) : null, emissiveIntensity:o.glow || 0 }));
    m.position.copy(pos); m.rotation.set(o.rx || 0, ry || 0, o.rz || 0, 'YXZ');
    group.add(m); return m;
  }

  /* ============================================================ the art */
  /* grain, tape, staples: what makes paper look like paper */
  function grain(x, w, h, n, a){ for(let i=0;i<n;i++){ x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${R(0.02, a||0.06)})`; x.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3)); } }
  function tape(x, cx, cy, w, h, rot){ x.save(); x.translate(cx, cy); x.rotate(rot||0); x.fillStyle = 'rgba(235,225,190,0.72)'; x.fillRect(-w/2, -h/2, w, h); x.restore(); }
  function halftone(x, x0, y0, w, h, col, k){
    x.fillStyle = col;
    for(let yy=y0; yy<y0+h; yy+=8) for(let xx=x0; xx<x0+w; xx+=8){ const r = (Math.sin(xx*0.02*k + yy*0.013) + 1.2)*1.6; x.beginPath(); x.arc(xx, yy, r, 0, 7); x.fill(); }
  }

  /* BAND POSTERS: xeroxed, two colours, cut-and-paste letters */
  const BANDS = [
    { name:'STATIC GIRLS', sub:'LIVE AT PULSE · NO CURFEW · NO REFUNDS', bg:'#f2e94e', ink:'#111', acc:'#e8304a' },
    { name:'DEAD SIGNAL', sub:'+ THE HOODIES · ALL AGES · 21:00', bg:'#111', ink:'#f5f2e8', acc:'#38ffd0' },
    { name:'RIOT ON 9TH', sub:'"THEY CAN\'T BAN ALL OF US" TOUR', bg:'#e8304a', ink:'#111', acc:'#f5f2e8' },
    { name:'DRONE KILLERS', sub:'DEBUT EP · OUT NOW · TAPE ONLY', bg:'#f5f2e8', ink:'#111', acc:'#ff6a1a' },
    { name:'NEON TEETH', sub:'BASEMENT SHOW · ASK A PUNK', bg:'#2a1a4a', ink:'#ff8ad8', acc:'#f2e94e' }
  ];
  function poster(i){
    const b = BANDS[i % BANDS.length], c = canvas(512, 724), x = c.getContext('2d'), w = 512, h = 724;
    x.fillStyle = b.bg; x.fillRect(0, 0, w, h);
    halftone(x, 0, h*0.28, w, h*0.42, b.acc, 1 + i*0.3);
    // a figure: a silhouette screaming into a mic, or a skull, or a fist
    x.fillStyle = b.ink;
    if(i % 3 === 0){ x.beginPath(); x.arc(w*0.5, h*0.45, 90, 0, 7); x.fill(); x.fillStyle = b.bg; x.beginPath(); x.arc(w*0.42, h*0.43, 22, 0, 7); x.arc(w*0.58, h*0.43, 22, 0, 7); x.fill();
      x.fillRect(w*0.44, h*0.53, w*0.12, 14); }
    else if(i % 3 === 1){ x.fillRect(w*0.4, h*0.32, w*0.2, h*0.3); x.beginPath(); x.arc(w*0.5, h*0.3, 52, 0, 7); x.fill(); x.fillRect(w*0.62, h*0.36, 70, 14); x.beginPath(); x.arc(w*0.78, h*0.37, 16, 0, 7); x.fill(); }
    else { x.beginPath(); x.moveTo(w*0.36, h*0.62); x.lineTo(w*0.4, h*0.32); x.lineTo(w*0.62, h*0.3); x.lineTo(w*0.66, h*0.62); x.fill(); [0,1,2,3].forEach(k=>x.fillRect(w*0.4 + k*28, h*0.26, 22, 40)); }
    // the name, cut out of different papers
    const letters = b.name.split('');
    let px = 30, py = 110;
    letters.forEach((ch, k)=>{
      if(ch === ' '){ px += 26; if(px > w - 120){ px = 30; py += 96; } return; }
      const sz = 66 + ((k*37) % 22), bgc = k % 2 ? b.ink : b.acc, fg = k % 2 ? b.bg : b.ink;
      x.save(); x.translate(px, py); x.rotate(((k*53) % 20 - 10)/100);
      x.fillStyle = bgc; x.fillRect(-4, -sz + 8, sz*0.72, sz + 2);
      x.fillStyle = fg; x.font = `900 ${sz}px Impact, "Arial Black", ${UI()}`; x.fillText(ch, 0, 0);
      x.restore();
      px += sz*0.72 + 4; if(px > w - 70){ px = 30; py += 96; }
    });
    x.fillStyle = b.ink; x.fillRect(0, h - 120, w, 4);
    x.font = `bold 22px ${UI()}`; x.fillText(b.sub, 24, h - 80);
    x.font = `bold 18px ${UI()}`; x.fillText('★ HARBOR DISTRICT ★ BRING EARPLUGS ★', 24, h - 40);
    // a safety pin, a sticker, a fold
    x.strokeStyle = '#ccc'; x.lineWidth = 4; x.beginPath(); x.ellipse(w - 70, 60, 34, 9, -0.4, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, h/2); x.lineTo(w, h/2); x.stroke();
    grain(x, w, h, 1600, 0.09);
    tape(x, 60, 18, 90, 26, -0.2); tape(x, w - 60, h - 14, 90, 26, 0.3);
    return c;
  }
  /* the one that is not a band: an anti-WFC print */
  function wfcPoster(){
    const c = canvas(512, 724), x = c.getContext('2d'), w = 512, h = 724;
    x.fillStyle = '#0e1312'; x.fillRect(0, 0, w, h);
    // the eye, with a drone for a pupil
    x.strokeStyle = '#38ffd0'; x.lineWidth = 10;
    x.beginPath(); x.moveTo(60, 300); x.quadraticCurveTo(256, 120, 452, 300); x.quadraticCurveTo(256, 480, 60, 300); x.stroke();
    x.fillStyle = '#38ffd0'; x.beginPath(); x.arc(256, 300, 70, 0, 7); x.fill();
    x.fillStyle = '#0e1312'; x.fillRect(206, 292, 100, 16); [206, 306].forEach(xx=>{ x.beginPath(); x.arc(xx, 300, 18, 0, 7); x.fill(); });
    x.fillStyle = '#f5f2e8'; x.font = `900 76px Impact, "Arial Black", ${UI()}`; x.textAlign = 'center';
    x.fillText('THEY WATCH.', w/2, 110); x.fillStyle = '#ff4a4a'; x.fillText('WE WATCH', w/2, 570); x.fillText('BACK.', w/2, 650);
    x.strokeStyle = '#ff4a4a'; x.lineWidth = 12; x.beginPath(); x.moveTo(330, 470); x.lineTo(470, 400); x.stroke();
    grain(x, w, h, 1400, 0.1); tape(x, 256, 14, 120, 26, 0.05);
    return c;
  }

  /* THE PAPER: today's, on the bench. The Director on the front. */
  function newspaper(){
    const c = canvas(1024, 1320), x = c.getContext('2d'), w = 1024, h = 1320;
    x.fillStyle = '#ece6d6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#141414'; x.textAlign = 'center';
    x.font = `900 92px Georgia, "Times New Roman", serif`; x.fillText('THE HARBOR LEDGER', w/2, 108);
    x.fillRect(40, 128, w - 80, 5); x.fillRect(40, 176, w - 80, 2);
    x.font = `italic 22px Georgia, serif`; x.fillText('FRIDAY · LATE EDITION · 2 CREDITS · "ORDER IS FREEDOM"', w/2, 160);
    x.font = `bold 26px Georgia, serif`; x.fillText('WFC DIRECTOR DECLARES VICTORY OVER "WEARABLE CRIME"', w/2, 222);
    x.font = `900 118px Georgia, "Times New Roman", serif`; x.fillText('THE CITY IS SAFE', w/2, 342);
    x.font = `italic 30px Georgia, serif`;
    x.fillText('Illegal gear "off our streets," Director tells press; drone patrols to double', w/2, 392);
    // the photograph: the Director at a lectern, the hexagon behind her
    x.fillStyle = '#2a2d2c'; x.fillRect(60, 420, 560, 380);
    const g = x.createLinearGradient(60, 420, 60, 800); g.addColorStop(0, '#4a5150'); g.addColorStop(1, '#1d2120'); x.fillStyle = g; x.fillRect(66, 426, 548, 368);
    x.strokeStyle = '#8a9290'; x.lineWidth = 8; x.beginPath(); for(let k=0;k<6;k++){ const a = k*Math.PI/3 + Math.PI/6; x.lineTo(470 + Math.cos(a)*90, 560 + Math.sin(a)*90); } x.closePath(); x.stroke();
    x.fillStyle = '#9aa2a0'; x.font = `bold 40px ${UI()}`; x.fillText('WFC', 470, 574);
    x.fillStyle = '#0c0e0d'; x.beginPath(); x.arc(260, 560, 56, 0, 7); x.fill(); x.fillRect(190, 610, 140, 190);
    x.fillStyle = '#c8ccc8'; x.fillRect(206, 556, 108, 10);
    x.fillStyle = '#3a3e3c'; x.fillRect(170, 690, 180, 110);
    x.fillStyle = '#141414'; x.textAlign = 'left'; x.font = `italic 19px Georgia, serif`;
    x.fillText('The Director at yesterday\'s briefing. "Those who doubted us', 64, 830); x.fillText('have been proven wrong."  — Photo: WFC Press Office', 64, 854);
    // columns
    const col = (x0, y0, wid, lines, size) => { x.font = `${size||17}px Georgia, serif`; lines.forEach((l, i)=>x.fillText(l, x0, y0 + i*(size ? size + 7 : 24))); };
    const filler = n => Array.from({ length:n }, (_, i)=>['in the Neon District, where officers report', 'that the scanner arches installed last month', 'have already flagged hundreds of devices.', 'Residents are reminded that any wearable', 'capable of "altering force or perception" is', 'now subject to immediate confiscation.', 'Critics, including several council members,', 'have questioned the cost of the program.', 'A WFC spokesperson declined to comment on', 'reports of a masked figure seen on rooftops', 'above Dragon Alley in recent weeks, saying', 'only that "rumours are not intelligence."'][i % 12]);
    col(650, 446, 330, ['By the Ledger staff'].concat(filler(13)));
    col(64, 900, 440, ['Security operations conducted by WFC have'].concat(filler(14)));
    col(530, 900, 440, ['Continued from the front page, the Director'].concat(filler(14)));
    x.fillRect(40, 1250, w - 80, 2);
    // the sidebar of smaller stories
    x.fillStyle = '#141414';
    [['CURFEW EXTENDED TO MIDNIGHT IN NEON DISTRICT', 640, 760], ['312 ARRESTS FOR UNLICENSED GEAR', 640, 800]].forEach(([t, xx, yy])=>{ x.font = `bold 21px Georgia, serif`; x.fillText(t.slice(0, 32), xx, yy); });
    x.font = `bold 24px Georgia, serif`; x.fillText('OPINION: Who watches the drones?', 64, 1288);
    x.font = `bold 24px Georgia, serif`; x.fillText('Scanner arches for every metro by spring', 560, 1288);
    grain(x, w, h, 3000, 0.05);
    // a coffee ring, and a red circle round the bit she cares about
    x.strokeStyle = 'rgba(110,70,30,0.35)'; x.lineWidth = 9; x.beginPath(); x.arc(870, 1120, 70, 0.4, 5.9); x.stroke();
    x.strokeStyle = 'rgba(210,30,40,0.85)'; x.lineWidth = 5; x.beginPath(); x.ellipse(800, 680, 200, 46, -0.03, 0, 7); x.stroke();
    return c;
  }

  /* THE CORKBOARD: a map with pins, red string, drone routes, and her name in a headline */
  function corkboard(){
    const c = canvas(1024, 576), x = c.getContext('2d'), w = 1024, h = 576;
    x.fillStyle = '#9a6a3c'; x.fillRect(0, 0, w, h);
    for(let i=0;i<5000;i++){ x.fillStyle = `rgba(${rnd() < 0.5 ? '60,35,15' : '200,150,90'},${R(0.15, 0.5)})`; x.fillRect(R(0, w), R(0, h), 2, 2); }
    x.strokeStyle = '#3a2412'; x.lineWidth = 18; x.strokeRect(9, 9, w - 18, h - 18);
    // the map
    x.save(); x.translate(330, 60); x.rotate(-0.02);
    x.fillStyle = '#e8e4d6'; x.fillRect(0, 0, 380, 300);
    x.strokeStyle = '#9aa'; x.lineWidth = 10; x.beginPath(); x.moveTo(0, 150); x.lineTo(380, 150); x.moveTo(190, 0); x.lineTo(190, 300); x.stroke();
    x.lineWidth = 4; [[0, 70, 380, 70], [0, 235, 380, 235], [70, 0, 70, 300], [310, 0, 310, 300]].forEach(([a, b, c2, d])=>{ x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); });
    x.fillStyle = '#ff6a1a'; x.fillRect(82, 18, 10, 120);
    x.fillStyle = '#333'; x.font = `bold 13px ${UI()}`; x.fillText('DRAGON ALLEY', 96, 40); x.fillText('NEON AVE', 230, 144); x.fillText('HOME', 320, 270); x.fillText('MKT', 196, 40);
    // the drone routes, in dashed red
    x.setLineDash([8, 6]); x.strokeStyle = '#d02a2a'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(20, 150); x.lineTo(360, 150); x.stroke(); x.beginPath(); x.moveTo(190, 10); x.lineTo(190, 290); x.stroke(); x.beginPath(); x.rect(80, 20, 60, 120); x.stroke();
    x.setLineDash([]);
    x.fillStyle = '#d02a2a'; x.font = `italic bold 15px ${UI()}`; x.fillText('drone: 1 min loop', 150, 100); x.fillText('arch @ 23:00?', 240, 180);
    x.restore();
    // the clipping
    x.save(); x.translate(40, 60); x.rotate(0.04);
    x.fillStyle = '#ece6d6'; x.fillRect(0, 0, 250, 300);
    x.fillStyle = '#141414'; x.font = `900 38px Georgia, serif`; x.fillText('WHO IS YU?', 14, 50);
    x.font = `italic 15px Georgia, serif`; ['Masked figure seen on rooftops', 'above Dragon Alley "jumping', 'between buildings", say', 'witnesses. WFC: "rumours'].forEach((l, i)=>x.fillText(l, 14, 80 + i*20));
    x.fillStyle = '#333'; x.fillRect(14, 170, 222, 116); x.fillStyle = '#111'; x.beginPath(); x.arc(125, 215, 22, 0, 7); x.fill(); x.fillRect(110, 232, 30, 50);
    x.strokeStyle = '#8a8'; x.lineWidth = 2; for(let k=0;k<6;k++){ x.beginPath(); x.moveTo(30 + k*35, 280); x.lineTo(45 + k*35, 175); x.stroke(); }
    x.restore();
    // polaroids: a drone, an officer, the WFC post
    const polaroid = (px, py, rot, draw, label) => { x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, 150, 176); x.fillStyle = '#1c2524'; x.fillRect(10, 10, 130, 128); draw(); x.fillStyle = '#223'; x.font = `italic 15px "Bradley Hand", "Comic Sans MS", cursive`; x.fillText(label, 14, 162); x.restore(); };
    polaroid(760, 50, 0.08, ()=>{ x.fillStyle = '#9ad'; x.fillRect(45, 60, 60, 18); x.fillRect(30, 55, 22, 6); x.fillRect(98, 55, 22, 6); x.fillStyle = '#f33'; x.beginPath(); x.arc(75, 82, 5, 0, 7); x.fill(); }, 'D-7 · sees 15m');
    polaroid(780, 290, -0.06, ()=>{ x.fillStyle = '#8ab'; x.beginPath(); x.arc(75, 60, 18, 0, 7); x.fill(); x.fillRect(58, 78, 34, 50); }, 'beat cop · 9pm');
    polaroid(560, 380, 0.05, ()=>{ x.fillStyle = '#566'; x.fillRect(30, 50, 90, 70); x.strokeStyle = '#8ff'; x.lineWidth = 3; x.strokeRect(40, 60, 70, 30); }, 'post · back door?');
    // the string
    const pins = [[165, 90], [520, 200], [835, 70], [855, 310], [635, 400], [380, 150]];
    x.strokeStyle = '#c4161c'; x.lineWidth = 3;
    [[0, 1], [1, 2], [1, 3], [1, 4], [5, 1]].forEach(([a, b])=>{ x.beginPath(); x.moveTo(...pins[a]); x.quadraticCurveTo((pins[a][0] + pins[b][0])/2, (pins[a][1] + pins[b][1])/2 + 20, ...pins[b]); x.stroke(); });
    pins.forEach(([px, py], i)=>{ x.fillStyle = ['#e33', '#fd3', '#3df', '#e33', '#fff', '#e3e'][i]; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(px - 3, py - 3, 3, 0, 7); x.fill(); });
    // a sticky note in her handwriting
    x.save(); x.translate(80, 400); x.rotate(-0.05); x.fillStyle = '#ffe85a'; x.fillRect(0, 0, 200, 140);
    x.fillStyle = '#222'; x.font = `22px "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`; ['don\'t get seen', 'don\'t get greedy', 'don\'t tell mom'].forEach((l, i)=>x.fillText(l, 14, 38 + i*36)); x.restore();
    return c;
  }

  /* SKETCHES: pencil on paper. The boots, the costume, the jewelry. */
  function sketch(kind){
    const c = canvas(768, 1024), x = c.getContext('2d'), w = 768, h = 1024;
    x.fillStyle = '#f1ede2'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(80,140,200,0.18)'; x.lineWidth = 1; for(let y=40; y<h; y+=32){ x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    x.strokeStyle = 'rgba(200,60,60,0.25)'; x.beginPath(); x.moveTo(70, 0); x.lineTo(70, h); x.stroke();
    const pencil = (lw, a) => { x.strokeStyle = `rgba(40,40,48,${a||0.85})`; x.lineWidth = lw||2.5; x.lineCap = 'round'; x.lineJoin = 'round'; };
    const hand = (t, px, py, sz, col) => { x.fillStyle = col || '#2a2a34'; x.font = `${sz||26}px "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`; x.fillText(t, px, py); };
    const wobble = (pts) => { x.beginPath(); pts.forEach(([px, py], i)=>{ const j = () => R(-1.5, 1.5); i ? x.lineTo(px + j(), py + j()) : x.moveTo(px, py); }); x.stroke(); };
    if(kind === 'boots'){
      hand('SKYLINE BOOTS — v4', 100, 80, 40); hand('(v3 broke my ankle. don\'t do v3)', 110, 120, 22, '#a02020');
      pencil(4);
      // the boot, side view
      wobble([[180, 300], [180, 620], [150, 700], [170, 760], [560, 760], [600, 720], [560, 680], [380, 640], [330, 600], [330, 300], [180, 300]]);
      pencil(2.5); wobble([[180, 360], [330, 360]]); wobble([[180, 420], [330, 420]]); wobble([[180, 480], [330, 480]]);
      // the coils in the sole
      for(let k=0;k<5;k++){ x.beginPath(); x.ellipse(220 + k*70, 790, 26, 12, 0, 0, 7); x.stroke(); x.beginPath(); x.ellipse(220 + k*70, 820, 26, 12, 0, 0, 7); x.stroke(); }
      wobble([[150, 845], [600, 845]]);
      pencil(1.5, 0.6); for(let k=0;k<12;k++) wobble([[200 + k*30, 700], [180 + k*30, 740]]);
      hand('coil stack ×3', 470, 900, 26); x.beginPath(); x.moveTo(460, 890); x.lineTo(400, 830); x.stroke();
      hand('ankle lock!!', 400, 400, 26); x.beginPath(); x.moveTo(395, 395); x.lineTo(335, 450); x.stroke();
      hand('~220 kg thrust?', 420, 560, 26);
      hand('land on the BALL of the foot', 120, 960, 24, '#a02020');
      hand('dive → pull up = free height', 120, 995, 22);
      x.strokeStyle = '#2a8a7a'; x.lineWidth = 3; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(620, 300); x.quadraticCurveTo(700, 150, 740, 420); x.stroke(); x.setLineDash([]);
    }
    if(kind === 'costume'){
      hand('YU — night kit', 100, 80, 42); hand('nobody sees the face. EVER.', 110, 122, 24, '#a02020');
      pencil(4);
      // the figure: shades, jacket, the cuffs glowing
      x.beginPath(); x.arc(384, 260, 70, 0, 7); x.stroke();
      x.fillStyle = 'rgba(30,30,40,0.85)'; x.fillRect(330, 250, 108, 26);
      wobble([[300, 340], [250, 560], [290, 580], [330, 420]]); wobble([[468, 340], [518, 560], [478, 580], [438, 420]]);
      wobble([[320, 340], [448, 340], [470, 620], [298, 620], [320, 340]]);
      wobble([[320, 620], [300, 900]]); wobble([[448, 620], [468, 900]]); wobble([[384, 640], [384, 900]]);
      x.strokeStyle = '#2a8a7a'; x.lineWidth = 6; x.beginPath(); x.ellipse(270, 570, 24, 10, 0.3, 0, 7); x.stroke(); x.beginPath(); x.ellipse(498, 570, 24, 10, -0.3, 0, 7); x.stroke();
      hand('shades: polarised + IR cut', 470, 250, 22); hand('shades stay ON', 480, 200, 22);
      hand('gecko cuffs', 520, 600, 24); hand('jacket: pink lining (it\'s me)', 80, 700, 22);
      hand('the boots ↓', 330, 960, 26);
    }
    if(kind === 'gear'){
      hand('tonight\'s pieces', 100, 80, 40);
      pencil(3);
      [[200, 260, 'flash bangles — 3 claps'], [200, 520, 'static studs — 6 s'], [200, 780, 'shield rings (×2, the buyer\'s)']].forEach(([px, py, label], i)=>{
        if(i === 0){ for(let k=0;k<3;k++){ x.beginPath(); x.ellipse(px, py, 70 - k*10, 30 - k*4, 0, 0, 7); x.stroke(); } }
        if(i === 1){ [px - 40, px + 40].forEach(sx=>{ x.beginPath(); for(let k=0;k<6;k++){ const a = k*Math.PI/3; x.lineTo(sx + Math.cos(a)*24, py + Math.sin(a)*24); } x.closePath(); x.stroke(); }); }
        if(i === 2){ [px - 40, px + 40].forEach(sx=>{ x.beginPath(); x.ellipse(sx, py, 34, 22, 0, 0, 7); x.stroke(); }); }
        hand(label, px + 120, py + 10, 28);
      });
      hand('WFC calls this "wearable weaponry"', 100, 930, 24, '#a02020'); hand('i call it jewelry', 100, 965, 24);
    }
    grain(x, w, h, 1200, 0.05);
    return c;
  }

  /* THE LETTER: by the door, where it came under it */
  function envelope(){
    const c = canvas(640, 400), x = c.getContext('2d'), w = 640, h = 400;
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(w/2, h*0.55); x.lineTo(w, 0); x.stroke();
    x.fillStyle = '#1d3a6a'; x.beginPath(); x.arc(70, 70, 34, 0, 7); x.fill(); x.fillStyle = '#f4f1ea'; x.font = `bold 30px Georgia, serif`; x.textAlign = 'center'; x.fillText('H', 70, 81);
    x.textAlign = 'left'; x.fillStyle = '#1d3a6a'; x.font = `bold 22px Georgia, serif`; x.fillText('HARBOR INSTITUTE OF TECHNOLOGY', 120, 64);
    x.font = `italic 18px Georgia, serif`; x.fillText('Office of Undergraduate Admissions', 120, 90);
    x.fillStyle = '#222'; x.font = `24px Georgia, serif`; x.fillText('Robin Ryu', 250, 250); x.fillText('214 Harbor Lane, Apt 3', 250, 282);
    x.fillStyle = '#c8302a'; x.font = `bold 20px ${UI()}`; x.save(); x.translate(470, 160); x.rotate(-0.12); x.strokeStyle = '#c8302a'; x.lineWidth = 3; x.strokeRect(-10, -26, 170, 38); x.fillText('DECISION ENCLOSED', 0, 0); x.restore();
    grain(x, w, h, 500, 0.04);
    return c;
  }
  /* small art */
  function sticker(i){
    const c = canvas(128, 128), x = c.getContext('2d');
    const s = [['NO GODS', '#f2e94e', '#111'], ['☠', '#111', '#f5f2e8'], ['YU', '#38ffd0', '#0b1110'], ['ANTI-DRONE', '#e8304a', '#fff'], ['DIY', '#ff8ad8', '#111'], ['★', '#ff6a1a', '#111']][i % 6];
    x.fillStyle = s[1]; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.fillStyle = s[2]; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `900 ${s[0].length > 3 ? 22 : 54}px Impact, ${UI()}`; x.fillText(s[0], 64, 66); return c;
  }
  function grille(){
    const c = canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#181818'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#2a2a2a'; for(let yy=10; yy<246; yy+=10) for(let xx=10; xx<246; xx+=10){ x.beginPath(); x.arc(xx, yy, 3, 0, 7); x.fill(); }
    x.fillStyle = '#c8a24a'; x.font = `italic bold 30px Georgia, serif`; x.fillText('Marshal', 70, 236); return c;
  }
  function deck(){
    const c = canvas(128, 512), x = c.getContext('2d');
    x.fillStyle = '#e8304a'; x.fillRect(0, 0, 128, 512); x.fillStyle = '#111'; x.font = `900 40px Impact, ${UI()}`;
    x.save(); x.translate(84, 470); x.rotate(-Math.PI/2); x.fillText('NEON TEETH', 0, 0); x.restore();
    for(let k=0;k<8;k++){ x.fillStyle = k % 2 ? '#f2e94e' : '#111'; x.fillRect(0, 40 + k*12, 128, 6); }
    return c;
  }
  function tag(){
    const c = canvas(512, 256), x = c.getContext('2d');
    x.clearRect(0, 0, 512, 256);
    x.strokeStyle = 'rgba(56,255,208,0.9)'; x.lineWidth = 26; x.lineCap = 'round';
    x.beginPath(); x.moveTo(60, 50); x.lineTo(140, 140); x.lineTo(220, 50); x.moveTo(140, 140); x.lineTo(140, 220); x.stroke();
    x.beginPath(); x.moveTo(280, 50); x.lineTo(280, 170); x.quadraticCurveTo(340, 240, 400, 170); x.lineTo(400, 50); x.stroke();
    x.fillStyle = 'rgba(56,255,208,0.5)'; for(let k=0;k<9;k++) x.fillRect(R(60, 400), R(150, 250), 4, R(20, 60));
    return c;
  }

  /* FASHION SKETCHES: a croquis in pencil and marker, a jacket designed
     round what is hidden in it, and her notes in the margins */
  function fashion(i){
    const c = canvas(600, 860), x = c.getContext('2d'), w = 600, h = 860;
    x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, w, h); grain(x, w, h, 900, 0.05);
    const pencil = (lw, a) => { x.strokeStyle = `rgba(40,40,48,${a||0.8})`; x.lineWidth = lw||2.2; x.lineCap = 'round'; x.lineJoin = 'round'; };
    const hand = (t, px, py, sz, col) => { x.fillStyle = col || '#2a2a34'; x.font = `${sz||22}px "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`; x.fillText(t, px, py); };
    const cx = w*0.42;
    // the figure: long, thin, nine heads tall
    pencil(1.6, 0.45);
    x.beginPath(); x.ellipse(cx, 92, 26, 32, 0, 0, 7); x.stroke();
    [[cx, 124, cx, 150], [cx - 10, 560, cx - 30, 800], [cx + 10, 560, cx + 34, 800]].forEach(([a, b, c_, d])=>{ x.beginPath(); x.moveTo(a, b); x.lineTo(c_, d); x.stroke(); });
    // the jacket: cropped, a high collar, panels — and the seams marked in colour
    const coat = [['#1b2321', '#38ffd0'], ['#3a1a2a', '#ff3fd0'], ['#20242a', '#ffd23d']][i % 3];
    x.fillStyle = coat[0]; x.beginPath(); x.moveTo(cx - 70, 160); x.lineTo(cx + 70, 160); x.lineTo(cx + 92, 420); x.lineTo(cx - 92, 420); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx - 70, 162); x.lineTo(cx - 118, 380); x.lineTo(cx - 96, 392); x.lineTo(cx - 60, 230); x.fill();
    x.beginPath(); x.moveTo(cx + 70, 162); x.lineTo(cx + 118, 380); x.lineTo(cx + 96, 392); x.lineTo(cx + 60, 230); x.fill();
    x.strokeStyle = coat[1]; x.lineWidth = 4; x.setLineDash([10, 6]);
    [[cx - 20, 170, cx - 30, 418], [cx + 20, 170, cx + 30, 418], [cx - 70, 170, cx - 108, 384], [cx + 70, 170, cx + 108, 384]].forEach(([a, b, c_, d])=>{ x.beginPath(); x.moveTo(a, b); x.lineTo(c_, d); x.stroke(); });
    x.setLineDash([]);
    x.fillStyle = '#6a5a8a'; x.fillRect(cx - 80, 420, 160, 140);
    pencil(1.4, 0.6); x.strokeRect(cx - 80, 420, 160, 140);
    // the notes
    const notes = [['conductive thread —', 'seams = the antenna'], ['hidden pocket', 'for the rings'], ['LED piping, 3V', 'coin cell in the hem']][i % 3];
    hand(notes[0], cx + 110, 230, 22); hand(notes[1], cx + 110, 258, 22);
    pencil(1.6, 0.7); x.beginPath(); x.moveTo(cx + 104, 236); x.lineTo(cx + 40, 270); x.stroke();
    hand(['look 03 — "after hours"', 'look 07 — "rooftop"', 'look 11 — "no curfew"'][i % 3], 40, h - 70, 28, '#c03050');
    hand('R.R.', w - 90, h - 30, 22);
    // a swatch, stapled
    x.fillStyle = coat[0]; x.fillRect(w - 150, 60, 90, 70); x.strokeStyle = coat[1]; x.lineWidth = 3; x.strokeRect(w - 150, 60, 90, 70);
    x.fillStyle = '#999'; x.fillRect(w - 112, 56, 16, 6);
    return c;
  }
  /* A CIRCUIT BOARD: green, gold pads, a chip or two */
  function pcb(seed){
    const c = canvas(256, 192), x = c.getContext('2d');
    x.fillStyle = '#0d5a34'; x.fillRect(0, 0, 256, 192);
    x.strokeStyle = '#d8b04a'; x.lineWidth = 2.4;
    for(let i=0;i<22;i++){ const y = R(10, 182), x0 = R(5, 120); x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + R(30, 90), y); x.lineTo(x0 + R(90, 130), y + R(-30, 30)); x.stroke(); }
    x.fillStyle = '#d8b04a'; for(let i=0;i<40;i++){ x.beginPath(); x.arc(R(6, 250), R(6, 186), 3, 0, 7); x.fill(); }
    x.fillStyle = '#111'; x.fillRect(90, 60, 64, 64); x.fillRect(180, 30, 40, 24); x.fillRect(30, 130, 30, 40);
    x.fillStyle = '#ccc'; x.font = `bold 9px ${UI()}`; x.fillText('RR-' + (seed || 4), 96, 96);
    return c;
  }
  /* A SHIPPING LABEL for one of tonight's packages */
  function label(n, to, what){
    const c = canvas(320, 220), x = c.getContext('2d');
    x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, 320, 220);
    x.fillStyle = '#111'; x.font = `bold 26px ${UI()}`; x.fillText('ORDER #' + n, 16, 38);
    x.font = `bold 20px ${UI()}`; x.fillText('TO: ' + to, 16, 74);
    x.font = `16px ${UI()}`; x.fillText(what, 16, 104);
    for(let i=0;i<46;i++){ x.fillRect(16 + i*6, 130, (i*7) % 3 + 1, 56); }
    x.font = `bold 13px ${UI()}`; x.fillText('HANDLE WITH CARE · NO SCANS', 16, 206);
    return c;
  }
  /* AN ORDER on an index card, in her handwriting */
  function card(lines, tint){
    const c = canvas(300, 190), x = c.getContext('2d');
    x.fillStyle = tint || '#fbf8ee'; x.fillRect(0, 0, 300, 190);
    x.strokeStyle = 'rgba(80,140,200,0.35)'; for(let y=56; y<190; y+=26){ x.beginPath(); x.moveTo(0, y); x.lineTo(300, y); x.stroke(); }
    x.strokeStyle = 'rgba(200,60,60,0.5)'; x.beginPath(); x.moveTo(0, 34); x.lineTo(300, 34); x.stroke();
    lines.forEach((l, i)=>{ x.fillStyle = i ? '#2a2a34' : '#c03050'; x.font = `${i ? 22 : 26}px "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`; x.fillText(l, 12, 26 + i*28); });
    return c;
  }
  /* MOM'S NOTE, by the plate */
  function momNote(){
    const c = canvas(420, 300), x = c.getContext('2d');
    x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 420, 300); grain(x, 420, 300, 300, 0.04);
    x.fillStyle = '#1d2a5a'; x.font = `40px "Snell Roundhand", "Bradley Hand", "Segoe Script", cursive`;
    x.fillText('Dinner\'s in the fridge.', 24, 92); x.fillText('Love you.', 24, 166);
    x.font = `36px "Snell Roundhand", "Bradley Hand", "Segoe Script", cursive`; x.fillText('— Mom', 200, 238);
    x.fillStyle = '#c03050'; x.font = `34px ${UI()}`; x.fillText('♥', 330, 238);
    return c;
  }
  /* THE CITY THROUGH HER WINDOW: towers, lit windows, the WFC spire's red light */
  function cityView(){
    const c = canvas(512, 480), x = c.getContext('2d'), w = 512, h = 480;
    const sky = x.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#04161a'); sky.addColorStop(0.6, '#0e3a38'); sky.addColorStop(1, '#1a5048');
    x.fillStyle = sky; x.fillRect(0, 0, w, h);
    const tower = (x0, wd, top, col) => { x.fillStyle = col; x.fillRect(x0, top, wd, h - top);
      for(let yy=top + 8; yy<h; yy+=14) for(let xx=x0 + 5; xx<x0 + wd - 6; xx+=10) if(rnd() < 0.42){ x.fillStyle = rnd() < 0.8 ? 'rgba(255,214,140,0.9)' : 'rgba(80,255,220,0.9)'; x.fillRect(xx, yy, 5, 7); } };
    tower(230, 26, 40, '#071a1c'); x.fillStyle = '#ff3a3a'; x.beginPath(); x.arc(243, 34, 5, 0, 7); x.fill();
    [[0, 90, 180], [80, 70, 240], [150, 80, 150], [270, 90, 210], [350, 70, 130], [420, 92, 200]].forEach(([a, b, t])=>tower(a, b, t, '#0a2224'));
    [[10, 140, 320], [140, 120, 300], [300, 110, 330], [400, 112, 290]].forEach(([a, b, t])=>tower(a, b, t, '#061416'));
    x.fillStyle = '#ff3fd0'; x.fillRect(160, 318, 70, 14); x.fillStyle = '#38ffd0'; x.fillRect(318, 352, 54, 12);
    return c;
  }

  /* ======================================================= the business
     Everything the opening films while she gets up, and what it needs to
     move: the jacket comes off the form, the backpack off the floor, the
     note up into her hands and back down, the window up. */
  function workshop(group, B, M, room, A, std, glowM){
    const { x1, x2, z1, z2 } = A, cx = (x1 + x2)/2, cz = (z1 + z2)/2;
    const wallN = z1 + 0.012, wallW = x1 + 0.012, wallE = x2 - 0.012;
    const cream = std({ color:0xe8e0cc, roughness:0.5 }), steel = std({ color:0x9aa4a8, roughness:0.35, metalness:0.8 });
    let into = null;                                    // while set, every box made is also listed here (so a model can replace them)
    const box = (m, x, y, z, w, h, d, ry) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry || 0; group.add(o); if(into) into.push(o); return o; };
    const keep = (list, f) => { into = list; f(); into = null; return list; };
    const add = o => { group.add(o); if(into) into.push(o); return o; };
    const top = 0.94;                                   // the bench's top (tshcity.js)

    // ---- the bench: a sewing machine, circuit boards, a soldering iron, a bracelet in pieces
    const sx = cx - 3.85, sz = z1 + 0.5;
    const sewing = keep([], ()=>{
    box(cream, sx, top + 0.03, sz, 0.42, 0.06, 0.2); box(cream, sx + 0.15, top + 0.14, sz, 0.08, 0.2, 0.15); box(cream, sx, top + 0.25, sz, 0.42, 0.07, 0.13);
    box(cream, sx - 0.17, top + 0.16, sz, 0.08, 0.15, 0.11); box(std({ color:0xc03050, roughness:0.5 }), sx, top + 0.25, sz + 0.067, 0.36, 0.02, 0.005);
    box(steel, sx - 0.17, top + 0.07, sz, 0.006, 0.06, 0.006);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), steel); wheel.rotation.z = Math.PI/2; wheel.position.set(sx + 0.21, top + 0.2, sz); add(wheel);
    picture(group, fashion(1), 0.3, 0.22, new V3(sx - 0.1, top + 0.062, sz + 0.12), 0, { rx:-Math.PI/2, rz:0.3 });    // fabric under the needle, a pattern on it
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), std({ color:0x38ffd0, roughness:0.6 })); spool.position.set(sx + 0.05, top + 0.31, sz); add(spool);
    });
    swap('sewing', group, sewing, { x:sx, y:top, z:sz, w:0.46, ry:-Math.PI/2 });
    [[cx - 3.2, sz + 0.05, 0.2, 7], [cx - 3.0, sz + 0.3, -0.35, 9]].forEach(([px, pz, r, k])=>picture(group, pcb(k), 0.2, 0.15, new V3(px, top + 0.006, pz), 0, { rx:-Math.PI/2, rz:r }));
    const iron = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.2, 8), std({ color:0x202020, roughness:0.5 })); iron.rotation.z = 1.2; iron.position.set(cx - 2.85, top + 0.05, sz - 0.05); group.add(iron);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), glowM(0xff6a1a, 3)); tip.position.set(cx - 2.95, top + 0.02, sz - 0.05); group.add(tip);
    const half = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 20, Math.PI*1.4), std({ color:0xe8eef0, roughness:0.25, metalness:0.9 })); half.rotation.x = -Math.PI/2; half.position.set(cx - 1.85, top + 0.012, sz + 0.3); group.add(half);
    [0, 1, 2].forEach(k=>{ const wire = box(std({ color:[0xe8304a, 0x38ffd0, 0xffd23d][k], roughness:0.6 }), cx - 1.75 + k*0.02, top + 0.006, sz + 0.37, 0.004, 0.004, 0.12); wire.rotation.y = 0.4 + k*0.2; });
    room.sewing = { at:[sx, top + 0.15, sz] };
    room.bench = { at:[cx - 2.5, top, z1 + 0.55] };

    // ---- fashion sketches, pinned up: over the dress form, and either side of the corkboard
    picture(group, fashion(0), 0.42, 0.6, new V3(wallW, 1.72, z1 + 1.55), Math.PI/2, { rz:0.04 });
    picture(group, fashion(2), 0.36, 0.52, new V3(wallW, 1.82, z1 + 2.1), Math.PI/2, { rz:-0.05 });
    picture(group, fashion(1), 0.36, 0.52, new V3(cx - 4.85, 1.6, wallN), 0, { rz:-0.04 });
    picture(group, fashion(2), 0.34, 0.48, new V3(cx - 1.0, 1.72, wallN), 0, { rz:0.06 });

    // ---- the dress form, and the jacket on it: wiring in the seams
    const fx = x1 + 0.7, fz = z1 + 1.7;
    const form = keep([], ()=>{
    box(M.darkMetal, fx, 0.02, fz, 0.4, 0.03, 0.06); box(M.darkMetal, fx, 0.02, fz, 0.06, 0.03, 0.4);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 8), M.darkMetal); pole.position.set(fx, 0.52, fz); add(pole);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.55, 16), std({ color:0xd8ccb4, roughness:0.8 })); torso.position.set(fx, 1.32, fz); torso.scale.z = 0.7; add(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), std({ color:0xd8ccb4, roughness:0.8 })); neck.position.set(fx, 1.65, fz); add(neck);
    });
    swap('form', group, form, { x:fx, y:0, z:fz, h:1.72, ry:Math.PI/4, done:m=>{
      // the jacket hangs on the torso, which is not the middle of the whole form (the tripod's legs are not even)
      const c = upperCentre(m, 1.05); if(c){ jacket.position.x = c.x; jacket.position.z = c.z; } } });
    const jacket = new THREE.Group(); jacket.position.set(fx, 1.3, fz); jacket.rotation.y = Math.PI/4; group.add(jacket);
    const cloth = std({ color:0x1b2321, roughness:0.9 }), seam = glowM(0x38ffd0, 2.4);
    const body_ = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.5, 16, 1, true), cloth); body_.scale.z = 0.72; jacket.add(body_);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 14, 1, true), cloth); collar.position.y = 0.3; jacket.add(collar);
    [-1, 1].forEach(sd=>{ const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.5, 10), cloth); sl.position.set(sd*0.23, -0.02, 0); sl.rotation.z = sd*0.12; jacket.add(sl);
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.46, 0.01), seam); ln.position.set(sd*0.07, 0, 0.142); jacket.add(ln);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.01), seam); sh.position.set(sd*0.12, 0.22, 0.09); jacket.add(sh); });
    swap('jacket', jacket, jacket.children.slice(), { x:0, y:-0.33, z:0, h:0.72 });     // inside the jacket's own group: it goes when she takes it
    room.form = { at:[fx, 0, fz], jacket };

    // ---- the packing table along the east wall: tonight's orders
    const px = x2 - 0.35, pz = cz - 0.5, ptop = 0.78;
    box(M.wood, px, ptop - 0.02, pz, 0.6, 0.04, 2.0); [[-0.25, -0.92], [0.25, -0.92], [-0.25, 0.92], [0.25, 0.92]].forEach(([a, b])=>box(M.darkMetal, px + a, (ptop - 0.04)/2, pz + b, 0.04, ptop - 0.04, 0.04));
    const kraft = std({ color:0xb08a5a, roughness:0.95 });
    const parcel = (x, y, z, w, h, d, ry, n, to, what) => { box(kraft, x, y + h/2, z, w, h, d, ry); const tp = box(std({ color:0xc8a878, roughness:0.4 }), x, y + h + 0.002, z, w + 0.002, 0.003, 0.05, ry);
      if(n){ const lb = picture(group, label(n, to, what), Math.min(w, d)*0.8*1.45, Math.min(w, d)*0.8, new V3(x, y + h + 0.004, z), ry || 0, { rx:-Math.PI/2, rz:0.0 }); if(into) into.push(lb); } };
    parcel(px - 0.05, ptop, pz - 0.7, 0.32, 0.18, 0.24, 0.2, '0414', 'K. / DRAGON ALLEY', '2 x rings (shield) — tonight');
    parcel(px, ptop, pz - 0.3, 0.26, 0.14, 0.2, -0.15, '0415', '"MAGS"', 'grip gloves, size S');
    parcel(px - 0.02, ptop + 0.14, pz - 0.3, 0.2, 0.1, 0.16, 0.1, '0416', 'P.O. 91 — KILN ST', 'flash cuff x2 — PAID');
    const stack = keep([], ()=>{
      parcel(px - 0.1, 0, pz + 1.3, 0.4, 0.26, 0.3, 0.3, '0412', 'L. CHEN', 'jacket mod (LED piping)');
      parcel(px - 0.12, 0.26, pz + 1.28, 0.3, 0.18, 0.24, -0.2, '0413', 'NO NAME — CASH', 'static studs');
    });
    swap('packages', group, stack, { x:px - 0.12, y:0, z:pz + 1.3, h:0.62, ry:-Math.PI/2 + 0.3 });
    const tape = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.02, 8, 18), std({ color:0xc8a878, roughness:0.4 })); tape.rotation.x = Math.PI/2; tape.position.set(px + 0.12, ptop + 0.02, pz + 0.05); group.add(tape);
    // burner phones, fanned out; cash, banded; the orders on cards
    [[0, 0], [0.07, 0.4], [0.14, 0.75]].forEach(([dx, r], i)=>{ const ph = box(std({ color:0x16181a, roughness:0.4, metalness:0.4 }), px - 0.15 + dx, ptop + 0.006 + i*0.004, pz + 0.25 + dx*0.4, 0.05, 0.012, 0.1, r);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.07), new THREE.MeshBasicMaterial({ color:i === 1 ? 0x1a4a40 : 0x050708 })); scr.rotation.set(-Math.PI/2, 0, r); scr.position.set(px - 0.15 + dx, ptop + 0.013 + i*0.004, pz + 0.25 + dx*0.4); scr.userData.flat = true; group.add(scr); });
    const bills = std({ color:0x7a9a7a, roughness:0.9 }), band = std({ color:0xe8e4da, roughness:0.8 });
    [[0.1, 0.42, 0], [0.12, 0.55, 0.035], [0.02, 0.6, 0.3]].forEach(([dx, dz, r])=>{ box(bills, px + dx, ptop + 0.016 + (r ? 0 : 0), pz + dz, 0.07, 0.03, 0.15, r); box(band, px + dx, ptop + 0.017, pz + dz, 0.074, 0.032, 0.03, r); });
    picture(group, card(['#0414 — tonight', '2 rings (shield)', 'K. — Dragon Alley', '¥3,000 on delivery']), 0.15, 0.095, new V3(px + 0.05, ptop + 0.003, pz + 0.85), 0, { rx:-Math.PI/2, rz:-0.2 });
    picture(group, card(['#0415', 'grip gloves (S)', '"Mags" — Fri']), 0.15, 0.095, new V3(px - 0.12, ptop + 0.003, pz + 0.7), 0, { rx:-Math.PI/2, rz:0.35 });
    picture(group, card(['#0417 — deposit', 'jacket, the works', 'call after 11', '— NOT ON THIS #'], '#fff3a8'), 0.16, 0.1, new V3(wallE, 1.22, pz + 0.55), -Math.PI/2, { rz:0.05 });
    picture(group, card(['ORDERS', '0412 ✓  0413 ✓', '0414  0415  0416', '0417 ?'], '#d8f6ff'), 0.16, 0.1, new V3(wallE, 1.14, pz - 0.15), -Math.PI/2, { rz:-0.06 });
    room.packing = { at:[px, ptop, pz] };

    // ---- the backpack, against the foot of the bed
    const pack = new THREE.Group(); pack.position.set(cx + 0.3, 0, z2 - 2.55); pack.rotation.set(-0.25, 0.4, 0); pack.userData.pack = true; group.add(pack);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.14), std({ color:0x15181b, roughness:0.85 })); bag.position.y = 0.19; pack.add(bag);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.12, 0.15), std({ color:0x22282c, roughness:0.8 })); flap.position.y = 0.33; pack.add(flap);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.005), glowM(0x38ffd0, 2.2)); st.position.set(0.1, 0.18, 0.072); pack.add(st);
    swap('backpack', pack, [bag, flap, st], { x:0, y:0, z:0, h:0.44 });
    room.pack = { at:[cx + 0.3, 0, z2 - 2.55] };

    // ---- the kitchen corner: a small table, dinner under a cover, and the note
    const kx = cx + 3.1, kz = z1 + 1.8, ktop = 0.76;
    const table = keep([], ()=>{ box(M.wood, kx, ktop - 0.02, kz, 0.9, 0.04, 0.65); [[-0.4, -0.28], [0.4, -0.28], [-0.4, 0.28], [0.4, 0.28]].forEach(([a, b])=>box(M.darkMetal, kx + a, (ktop - 0.04)/2, kz + b, 0.035, ktop - 0.04, 0.035)); });
    swap('table', group, table, { x:kx, y:0, z:kz, h:ktop });
    box(M.darkMetal, kx + 0.15, 0.45, kz + 0.62, 0.36, 0.04, 0.36); box(M.darkMetal, kx + 0.15, 0.22, kz + 0.62, 0.04, 0.44, 0.04);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.015, 24), std({ color:0xf4f2ec, roughness:0.3 })); plate.position.set(kx - 0.1, ktop + 0.008, kz - 0.05); group.add(plate);
    const cover = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 10, 0, Math.PI*2, 0, Math.PI/2), std({ color:0xcfd6da, roughness:0.2, metalness:0.9 })); cover.scale.y = 0.7; cover.position.set(kx - 0.1, ktop + 0.015, kz - 0.05); group.add(cover);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), std({ color:0x202020, roughness:0.4 })); knob.position.set(kx - 0.1, ktop + 0.1, kz - 0.05); group.add(knob);
    box(steel, kx + 0.08, ktop + 0.004, kz - 0.05, 0.012, 0.004, 0.17, 0); box(steel, kx - 0.28, ktop + 0.004, kz - 0.05, 0.012, 0.004, 0.17, 0);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.1, 12), new THREE.MeshStandardMaterial({ color:0xbfe8f0, roughness:0.05, metalness:0.1, transparent:true, opacity:0.4 })); glass.position.set(kx + 0.25, ktop + 0.05, kz - 0.18); group.add(glass);
    const nat = new V3(kx + 0.22, ktop + 0.003, kz + 0.12);
    const noteMesh = picture(group, momNote(), 0.16, 0.115, nat.clone(), 0, { rx:-Math.PI/2, rz:-0.25, double:true });
    const noteRot = noteMesh.rotation.clone();
    room.kitchen = { at:[kx, ktop, kz] };
    room.note = { at:[nat.x, nat.y, nat.z], mesh:noteMesh,
      home(){ noteMesh.position.copy(nat); noteMesh.rotation.copy(noteRot); },
      hold(at, head){ noteMesh.position.copy(at).add(new V3(0, 0.03, 0)); noteMesh.lookAt(head); } };

    // ---- her mother's door, in the north wall, ajar on the dark
    const dx = cx + 0.65, dw = 0.86, dh = 2.05;
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color:0x000000 })); dark.position.set(dx, dh/2, wallN + 0.002); dark.userData.flat = true; group.add(dark);
    [[dx - dw/2 - 0.03, dh/2, 0.06, dh], [dx + dw/2 + 0.03, dh/2, 0.06, dh], [dx, dh + 0.03, dw + 0.12, 0.06]].forEach(([x, y, w, h])=>box(M.wood, x, y, wallN + 0.02, w, h, 0.04));
    const leaf = new THREE.Group(); leaf.position.set(dx - dw/2, 0, wallN + 0.03); leaf.rotation.y = -0.5; group.add(leaf);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.02, dh - 0.02, 0.04), std({ color:0x4a3a2c, roughness:0.7 })); slab.position.set((dw - 0.02)/2, dh/2, 0); leaf.add(slab);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), steel); handle.position.set(dw - 0.1, 1.0, 0.03); leaf.add(handle);
    room.momDoor = { at:[dx, 1.0, z1] };

    // ---- the window: the city in it, a sash that goes up, a sill to climb onto
    const wz = cz + 2.4, view = picture(group, cityView(), 1.5, 1.4, new V3(x1 + 0.08, 1.7, wz), Math.PI/2, { glow:1.1 });
    const sash = new THREE.Group(); sash.position.set(x1 + 0.12, 1.35, wz); group.add(sash);
    const frame = std({ color:0x202628, roughness:0.6 });
    [[0, 0.33, 0.04, 0.05, 1.52], [0, -0.33, 0.04, 0.05, 1.52], [0, 0, 0.04, 0.7, 0.05], [0, 0, 0.04, 0.7, 0.05]].forEach(([y_, yy, w, h, d], i)=>{
      const b_ = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frame); b_.position.set(0, yy, i === 2 ? -0.74 : i === 3 ? 0.74 : 0); sash.add(b_); });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.64), new THREE.MeshStandardMaterial({ color:0x9fd8e0, roughness:0.05, metalness:0.2, transparent:true, opacity:0.22 })); pane.rotation.y = Math.PI/2; sash.add(pane);
    box(std({ color:0xd8d4c8, roughness:0.6 }), x1 + 0.12, 0.97, wz, 0.24, 0.05, 1.62);
    room.window = { at:[x1, 1.7, wz], open(v){ sash.position.y = v ? 1.95 : 1.35; view.material.emissiveIntensity = v ? 1.6 : 1.1; } };
  }

  /* ========================================================= the models
     THE THINGS IN HER ROOM ARE HIGGSFIELD MODELS (tsh/room/*.glb): a product
     shot of each (gpt_image_2_5), lifted into 3D by SAM 3D, welded, thinned,
     the texture cut to 1024 px WebP. The room is built first out of boxes,
     so all of it is there the moment the door opens; when a model has come
     down it takes the place of the boxes it stands for — the same spot, the
     same size, the same way round — and they are hidden. Every model comes
     out of SAM facing +z; `ry` turns that front to face where the box did. */
  const MODELS = {};
  function model(id){
    if(!MODELS[id]) MODELS[id] = new Promise(ok=>{
      if(!THREE.GLTFLoader) return ok(null);
      const L = new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
      L.load('tsh/room/' + id + '.glb?v=' + (window.ASSETV || '1'), g=>ok(g.scene), undefined, ()=>ok(null));
    });
    return MODELS[id];
  }
  /* model `id` into `parent` at (x, y, z) — its feet at y, centred on x z —
     scaled so its height is h (or its width w, its depth d), turned by ry;
     then `old` is hidden. A model that does not load leaves the boxes. */
  function swap(id, parent, old, o){
    return model(id).then(sc=>{
      if(!sc || !parent) return null;
      const m = sc.clone(true);
      m.rotation.y = o.ry || 0; m.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(m).getSize(new V3());
      m.scale.setScalar(o.h ? o.h/size.y : o.w ? o.w/size.x : o.d/size.z); m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new V3());
      m.position.set((o.x || 0) - c.x, (o.y || 0) - b.min.y, (o.z || 0) - c.z);
      // SAM leaves the glTF default of a fully metal surface, which with nothing to reflect is black: these are cloth, wood, paint and plastic
      m.traverse(n=>{ if(!n.isMesh) return; n.castShadow = n.receiveShadow = true;
        const mt = n.material; if(mt){ mt.metalness = o.metal || 0; mt.roughness = 0.75; if(mt.map) mt.map.colorSpace = THREE.SRGBColorSpace; mt.needsUpdate = true; } });
      parent.add(m);
      (old || []).forEach(x=>{ if(x) x.visible = false; });
      if(o.done) o.done(m);
      return m;
    });
  }
  /* the middle of a model above height y0 (a dress form's torso, not its tripod) */
  function upperCentre(m, y0){
    const v = new V3(), b = new THREE.Box3(); m.updateMatrixWorld(true);
    m.traverse(n=>{ if(!n.isMesh) return; const P = n.geometry.attributes.position;
      for(let i=0;i<P.count;i+=2){ v.fromBufferAttribute(P, i).applyMatrix4(n.matrixWorld); if(v.y > y0) b.expandByPoint(v); } });
    return b.isEmpty() ? null : b.getCenter(new V3());
  }
  /* the height of the first surface under (x, z) on a model, from above */
  function topOf(m, x, z){
    m.updateMatrixWorld(true);
    const hit = new THREE.Raycaster(new V3(x, 5, z), new V3(0, -1, 0)).intersectObject(m, true)[0];
    return hit ? hit.point.y : null;
  }

  /* =========================================================== the room */
  function dress(group, B, out, M, A){
    rnd = seeded(2016);
    const { x1, x2, z1, z2, h } = A, cx = (x1 + x2)/2, cz = (z1 + z2)/2;
    const std = o => M.std(o), glowM = (hex, k) => M.glow(hex, k);
    const room = out.room = {};
    const wallN = z1 + 0.012, wallS = z2 - 0.012, wallW = x1 + 0.012, wallE = x2 - 0.012;

    // ---- the walls: posters, the anti-WFC print, stickers, the tag
    room.posters = [];
    room.posters.push(picture(group, poster(0), 0.75, 1.06, new V3(cx - 2.2, 1.95, wallS), Math.PI));      // over the bed
    room.posters.push(picture(group, poster(1), 0.62, 0.88, new V3(cx - 1.2, 2.15, wallS), Math.PI, { rz:0.05 }));
    room.posters.push(picture(group, poster(2), 0.8, 1.13, new V3(wallE, 1.85, cz - 1.0), -Math.PI/2));
    room.posters.push(picture(group, wfcPoster(), 0.7, 0.99, new V3(wallE, 1.8, cz + 0.6), -Math.PI/2, { rz:-0.03 }));
    room.posters.push(picture(group, poster(4), 0.6, 0.85, new V3(wallW, 2.1, cz - 2.2), Math.PI/2));
    // the poster that has come away at one corner — and what is under it
    const pX = cx + 2.2, pY = 1.75;
    picture(group, sketch('costume'), 0.68, 0.9, new V3(pX + 0.2, pY - 0.18, wallN - 0.003), 0);
    const pc = poster(3), pm = new THREE.Mesh(peeled(0.72, 1.02), new THREE.MeshStandardMaterial({ map:tex(pc), roughness:0.85, side:THREE.DoubleSide }));
    pm.position.set(pX, pY, wallN + 0.004); group.add(pm);
    room.posterPeel = { at:[pX + 0.3, pY - 0.3, wallN], look:[pX + 0.24, pY - 0.26, wallN] };
    // stickers on the door, the amp, the window frame
    for(let i=0;i<9;i++){ picture(group, sticker(i), 0.16, 0.16, new V3(x2 - 1.4 + R(-0.45, 0.45), R(1.0, 2.0), wallS), Math.PI, { alpha:true, rz:R(-0.4, 0.4) }); }
    // YU, sprayed by the window
    picture(group, tag(), 1.1, 0.55, new V3(wallW, 2.45, cz + 0.9), Math.PI/2, { alpha:true });

    // ---- the corkboard over the bench, and today's paper on it
    const cork = picture(group, corkboard(), 1.7, 0.96, new V3(cx - 2.6, 2.48, wallN), 0, { rough:1 });
    room.cork = { at:[cx - 2.6, 2.48, wallN] };
    room.paper = { at:[cx - 0.4, 0.012, z2 - 2.9] };
    // a second copy, folded on the floor by the bed, so it is in more than one shot
    picture(group, newspaper(), 0.36, 0.47, new V3(cx - 0.4, 0.012, z2 - 2.9), 0, { rx:-Math.PI/2, rz:-0.6 });

    // ---- under the bed: the boot sketches and a shoebox of more
    const bedX = cx - 1.4, bedZ = z2 - 1.3;
    [[bedX + 0.75, bedZ - 0.2, 0.35, 'boots'], [bedX + 0.3, bedZ + 0.3, -0.5, 'gear'], [bedX + 0.95, bedZ + 0.5, 0.9, 'boots']].forEach(([sx, sz, r, k])=>{
      picture(group, sketch(k), 0.42, 0.56, new V3(sx, 0.008 + rnd()*0.004, sz), 0, { rx:-Math.PI/2, rz:r });
    });
    B.box(std({ color:0x1a1a1a, roughness:0.8 }), bedX + 0.5, 0.09, bedZ - 0.6, 0.55, 0.18, 0.32);
    room.underBed = { at:[bedX + 0.7, 0.02, bedZ], cam:[bedX + 1.9, 0.2, bedZ - 0.5] };
    // the bed made into hers: a black duvet, rumpled, a skull pillow, a plush on the floor
    const mesh = (m, x, y, z, w, h, d) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); group.add(o); return o; };
    const bedding = [mesh(std({ color:0x15151a, roughness:0.95 }), bedX - 0.1, 0.78, bedZ + 0.2, 1.9, 0.12, 1.7),
                     mesh(std({ color:0x15151a, roughness:0.95 }), bedX + 0.4, 0.84, bedZ - 0.3, 0.9, 0.1, 0.7),
                     mesh(std({ color:0xe8e4da, roughness:0.9 }), bedX - 0.75, 0.8, bedZ + 0.05, 0.45, 0.14, 0.95)];
    room.bed = { x:bedX, z:bedZ, top:0.72, seat:0.76, head:[bedX - 0.8, bedZ], foot:[bedX + 0.9, bedZ] };
    room.pillow = [bedX - 0.75, 0.9, bedZ + 0.05];

    // ---- the boots, by the window, glowing faintly
    room.boots = { at:[x1 + 0.75, 0, cz + 1.3] };
    const pair = bootPair(group, B, M, x1 + 0.75, cz + 1.3);
    const shoes = new THREE.Group(); shoes.userData.boot = true; group.add(shoes);
    swap('sneakers', shoes, [], { x:x1 + 0.78, y:0, z:cz + 1.3, w:0.32, ry:Math.PI/2, done:()=>pair.forEach(g=>{ g.visible = false; delete g.userData.boot; }) });
    // ---- the business: the bench, the sketches, the jacket on its form, tonight's orders, the kitchen, the window
    workshop(group, B, M, room, A, std, glowM);

    // ---- the letter, under the door
    const env = picture(group, envelope(), 0.3, 0.19, new V3(x2 - 1.35, 0.009, z2 - 0.55), 0, { rx:-Math.PI/2, rz:0.25 });
    room.letter = { at:[x2 - 1.35, 0.01, z2 - 0.55], mesh:env };

    // ---- music: a guitar against an amp, and the speaker that is playing
    const ampX = cx + 2.6, ampZ = z1 + 0.45;
    const amp = [mesh(std({ color:0x141414, roughness:0.6 }), ampX, 0.38, ampZ, 0.75, 0.76, 0.4), picture(group, grille(), 0.66, 0.6, new V3(ampX, 0.38, ampZ + 0.205), 0)];
    swap('amp', group, amp, { x:ampX, y:0, z:ampZ, h:0.66 });
    const gtr = guitar(group, ampX - 0.6, ampZ + 0.15, M);
    swap('guitar', gtr, gtr.children.slice(), { x:0, y:0, z:0, h:1.02 });
    const spk = new THREE.Group(); spk.position.set(bedX + 1.3, 0, bedZ - 1.0); group.add(spk);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.22), std({ color:0x202326, roughness:0.5, metalness:0.3 })); sb.position.y = 0.16; spk.add(sb);
    [-0.15, 0.15].forEach(dx=>{ const cone = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), std({ color:0x0a0a0a, roughness:0.9 })); cone.position.set(dx, 0.16, 0.111); spk.add(cone); });
    room.eq = [];
    for(let k=0;k<7;k++){ const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.005), glowM(k < 5 ? 0x38ffd0 : 0xff3fd0, 2.4)); bar.position.set(-0.12 + k*0.04, 0.28, 0.112); spk.add(bar); room.eq.push(bar); }
    room.speaker = { at:[bedX + 1.3, 0.2, bedZ - 1.0], group:spk };

    // ---- clothes on the floor, a skateboard, cans, a pizza box, the chair with the hoodie on it
    [[cx + 1.4, z2 - 2.6, 0x6a1a3a], [cx + 1.8, z2 - 2.3, 0x1a1a1a], [cx + 0.9, z2 - 2.1, 0x2a3a5a], [cx - 0.2, cz + 0.4, 0x3a3a3a]].forEach(([px, pz, col])=>{
      B.box(std({ color:col, roughness:1 }), px, 0.04, pz, R(0.45, 0.7), 0.08, R(0.3, 0.5)); });
    const sk = picture(group, deck(), 0.22, 0.82, new V3(wallE - 0.06, 0.45, cz + 2.3), -Math.PI/2, { rx:-0.12 });
    [[cx + 0.1, cz - 0.6], [cx + 0.25, cz - 0.5], [cx - 2.9, z1 + 1.3]].forEach(([px, pz])=>{
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10), std({ color:pick([0x38ffd0, 0xff3fd0, 0xf2e94e]), roughness:0.3, metalness:0.7 })); can.position.set(px, 0.06, pz); group.add(can); });
    B.box(std({ color:0xc8a070, roughness:0.9 }), cx + 0.6, 0.03, cz - 1.2, 0.42, 0.05, 0.42);
    // the chair at the bench, the hoodie over it
    const chair = [mesh(M.darkMetal, cx - 2.5, 0.48, z1 + 1.35, 0.5, 0.05, 0.5), mesh(M.darkMetal, cx - 2.5, 0.8, z1 + 1.58, 0.5, 0.6, 0.05),
                   mesh(std({ color:0xd86a9a, roughness:0.95 }), cx - 2.5, 0.85, z1 + 1.6, 0.56, 0.5, 0.1)];
    swap('chair', group, chair, { x:cx - 2.5, y:0, z:z1 + 1.4, h:0.92, ry:Math.PI });
    // a laptop on the bed, covered in stickers
    const onBed = [mesh(std({ color:0x2a2a2e, roughness:0.4, metalness:0.5 }), bedX + 0.25, 0.86, bedZ + 0.5, 0.38, 0.02, 0.27),
      picture(group, sticker(2), 0.08, 0.08, new V3(bedX + 0.2, 0.875, bedZ + 0.48), 0, { rx:-Math.PI/2, alpha:true }),
      picture(group, sticker(3), 0.08, 0.08, new V3(bedX + 0.32, 0.875, bedZ + 0.55), 0, { rx:-Math.PI/2, alpha:true })];

    // ---- string lights along the top of the walls and over the bed
    room.fairy = [];
    const run = (ax, az, bx, bz, n, sag) => { for(let i=0;i<=n;i++){ const k = i/n, px = ax + (bx - ax)*k, pz = az + (bz - az)*k, py = h - 0.18 - Math.sin(k*Math.PI)*sag;
      const col = [0xff7ac8, 0xffc070, 0x7affe0, 0xfff0a0][i % 4];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), glowM(col, 3.2)); b.position.set(px, py, pz); group.add(b); room.fairy.push(b); } };
    run(x1 + 0.1, z1 + 0.1, x2 - 1.4, z1 + 0.1, 26, 0.12);
    run(x1 + 0.1, z1 + 0.1, x1 + 0.1, z2 - 0.1, 20, 0.1);
    run(bedX - 1.0, z2 - 0.1, bedX + 1.2, z2 - 0.1, 12, 0.25);

    // ---- the phone, on the pillow
    const ph = new THREE.Group(); ph.position.set(bedX - 0.55, 0.88, bedZ - 0.25); ph.rotation.set(-Math.PI/2, 0, 0.4); group.add(ph);
    ph.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.008), std({ color:0x111111, roughness:0.3, metalness:0.5 })));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.14), new THREE.MeshBasicMaterial({ color:0x05080a })); scr.position.z = 0.0045; scr.userData.flat = true; ph.add(scr);
    room.phone = { group:ph, screen:scr, at:[bedX - 0.55, 0.9, bedZ - 0.25] };
    onBed.push(ph);
    // the bed model: the head at -x, as the boxes had it (SAM's has its head at -z); what was on the duvet goes onto its mattress
    swap('bed', group, (out.bedParts || []).concat(bedding), { x:bedX, y:0, z:bedZ, w:2.15, ry:Math.PI/2, done:m=>{
      const t = topOf(m, bedX + 0.2, bedZ); if(t === null) return;
      const dy = t + 0.02 - 0.86;
      onBed.forEach(o=>{ o.position.y += dy; });
      room.bed.top = t; room.bed.seat = t - 0.06; room.phone.at[1] += dy; room.pillow[1] += dy;
    } });

    // ---- where the shots stand
    room.door = { at:[x2 - 0.9, 1.1, z2] };
    out.aptLights.fairy = [cx - 1.4, 2.6, z2 - 0.6, 0xff6ab8, 4, 5];
    out.aptLights.fairyN = [cx - 1.0, 2.8, z1 + 0.4, 0xffb070, 3.5, 6];
    // a clip lamp over the orders, and a pendant over the kitchen table
    const P = room.packing.at, K = room.kitchen.at;
    out.aptLights.desk = [P[0] - 0.25, 1.55, P[2] - 0.2, 0xffd6a0, 4, 3.5];
    out.aptLights.kitchen = [K[0], 1.9, K[2], 0xffcf9a, 4.5, 3.5];
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 14, 1, true), std({ color:0x1a1d20, roughness:0.5, metalness:0.4, side:THREE.DoubleSide }));
    shade.position.set(P[0] + 0.18, 1.32, P[2] - 0.2); shade.rotation.z = -0.6; group.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glowM(0xffd6a0, 3)); bulb.position.set(P[0] + 0.15, 1.29, P[2] - 0.2); group.add(bulb);
    B.box(M.darkMetal, P[0] + 0.24, 1.06, P[2] - 0.2, 0.02, 0.56, 0.02);
    B.box(M.darkMetal, K[0], (h + 1.95)/2, K[2], 0.01, h - 1.95, 0.01);
    const pend = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 18, 1, true), std({ color:0xc8b8a0, roughness:0.6, side:THREE.DoubleSide })); pend.position.set(K[0], 1.9, K[2]); group.add(pend);
    const pb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glowM(0xffcf9a, 3)); pb.position.set(K[0], 1.85, K[2]); group.add(pb);
    return room;
  }
  /* a poster with its bottom-right corner peeled back off the wall */
  function peeled(w, h){
    const g = new THREE.BufferGeometry(), c = 0.32;
    // the flat part (five corners), then the flap folded forward
    const P = [ -w/2,-h/2+h*c,0,  -w/2,-h/2,0,  w/2-w*c,-h/2,0,  w/2,h/2,0,  -w/2,h/2,0,  w/2,-h/2+h*c,0,
                w/2-w*c,-h/2,0, w/2,-h/2+h*c,0, w/2-w*c*0.95,-h/2+h*c*0.95,0.09 ];
    const U = [ 0,c, 0,0, 1-c,0, 1,1, 0,1, 1,c, 1-c,0, 1,c, 1-c*0.95+0.0,c*0.95 ];
    const I = [ 0,1,2, 0,2,5, 0,5,3, 0,3,4, 6,7,8 ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  /* the shoes: her own high-top sneakers, rebuilt — a thick sole with coils in the heel, a teal seam that glows */
  function bootPair(group, B, M, x, z){
    const pair = [];
    const white = M.std({ color:0xeceae4, roughness:0.6 }), grey = M.std({ color:0x5a6066, roughness:0.5 }), sole = M.std({ color:0x16191c, roughness:0.4, metalness:0.3 }), seam = M.glow(0x38ffd0, 2.2);
    [-0.13, 0.13].forEach((dz, i)=>{
      const g = new THREE.Group(); g.position.set(x + (i ? 0.05 : 0), 0, z + dz); g.rotation.y = i ? 0.15 : -0.1; g.userData.boot = true; group.add(g); pair.push(g);
      const s_ = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.11), sole); s_.position.set(0.02, 0.05, 0); g.add(s_);
      const heel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.105), white); heel.position.set(-0.06, 0.165, 0); g.add(heel);
      const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.08, 0.1), white); vamp.position.set(0.075, 0.12, 0); g.add(vamp);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.102), grey); cap.position.set(0.15, 0.1, 0); g.add(cap);
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.03), grey); lace.position.set(0.04, 0.165, 0); lace.rotation.z = -0.35; g.add(lace);
      for(let k=0;k<3;k++){ const coil = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 14), seam); coil.rotation.x = Math.PI/2; coil.position.set(-0.07, 0.01 + k*0.014, 0); g.add(coil); }
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.008, 0.113), seam); line.position.set(0.02, 0.08, 0); g.add(line);
    });
    return pair;
  }
  function guitar(group, x, z, M){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, 0.3, 0.32); group.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), M.std({ color:0xe8304a, roughness:0.25, metalness:0.2 })); body.rotation.x = Math.PI/2; body.scale.set(1, 1, 1.35); body.position.set(0, 0.32, 0); g.add(body);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.052, 16), M.std({ color:0xf5f2e8, roughness:0.4 })); guard.rotation.x = Math.PI/2; guard.position.set(0.04, 0.3, 0); g.add(guard);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.03), M.std({ color:0x6a4a2a, roughness:0.6 })); neck.position.set(0, 0.82, 0); g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.03), M.std({ color:0x111111, roughness:0.4 })); head.position.set(0, 1.2, 0); g.add(head);
    return g;
  }

  return { dress, swap, model, newspaper, sketch, corkboard, envelope, poster };
})();
