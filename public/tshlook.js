/* =====================================================================
   TSH — THE LOOK. Everything that makes the quest's city look like the
   reference Akil chose: a wet alley at night, teal haze, fluorescent
   tubes, paper lanterns burning orange, and every light doubled in the
   puddles under it.

   Three things do most of that work, and none of them is geometry:

   BLOOM. A neon sign is a sign whose light spills past its own edges.
     Without that spill an emissive plane is a flat sticker, and the whole
     city reads as a diagram of a city. The scene is drawn into a
     half-float target (so a lantern can be brighter than white), the
     brightest part of it is taken down a chain of smaller and smaller
     targets and back up again (Jimenez's downsample/upsample, the one
     that does not shimmer), and added back over the picture.

   THE WET GROUND. The street is a mirror where it is puddled and a matte
     road where it is not. A second, half-size camera looks up at the
     city from under the road (the planar reflector: a camera mirrored in
     the ground plane, with its near plane tilted onto the ground so
     nothing under the street leaks in), and the road's own material reads
     that picture back through its roughness — sharp in a puddle, blurred
     to a smear where the tarmac is only damp.

   THE GRADE. Filmic tone mapping, a vignette, a whisper of chromatic
     fringe at the corners and a little grain, done in one full-screen
     pass at the end. The teal is not painted on: it is the fog, the
     moonlight and the tubes; the grade only keeps the blacks from going
     dead grey.

   IT STEPS DOWN BY ITSELF. A lab machine that cannot draw the city twice
   a frame is not told so; it is measured. Three slow seconds in a row and
   the reflection goes, three more and the bloom goes, and the city is
   drawn the plain way the rest of the game is drawn. The ground still
   shines — it keeps the environment map — it just stops mirroring.

   And the textures: every surface is painted into a canvas here, at
   load, because the game ships as a folder with no network. That
   includes the signs, whose lettering is DRAWN rather than typed: a
   lab machine with no Korean or Japanese font would letter every sign in
   the alley in empty boxes, so the glyphs are strokes — circles, bars
   and hooks laid out the way hangul and kanji are — which at the
   distance you read a shop sign from are signage, not words.
   ===================================================================== */
window.TSHLOOK = (function(){
  const V3 = THREE.Vector3;

  /* =============================================================== paint
     Canvas helpers. Every texture is made once per visit and thrown away
     on the way out (dispose()). */
  const made = [];                         // every texture, so leave() can free them
  const rnd = (a, b) => a + Math.random()*(b-a);
  function cv(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h||w; return c; }
  function tex(c, o){
    o = o||{};
    const t = new THREE.CanvasTexture(c);
    if(o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if(o.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
    t.anisotropy = 4;
    made.push(t);
    return t;
  }
  /* soft blob: a radial gradient from a colour to nothing */
  function blob(x, px, py, r, col, a){
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  function speckle(x, w, h, n, dark, light){
    for(let i=0;i<n;i++){
      const v = Math.random();
      x.fillStyle = v < 0.5 ? `rgba(0,0,0,${rnd(0.05, dark)})` : `rgba(255,255,255,${rnd(0.02, light)})`;
      const s = rnd(1, 3); x.fillRect(Math.random()*w, Math.random()*h, s, s);
    }
  }
  /* A normal map out of a height canvas (grey = height). Sobel, wrapped. */
  function normalFrom(hc, k){
    const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0,0,w,h).data;
    const out = cv(w, h), ox = out.getContext('2d'), img = ox.createImageData(w, h), d = img.data;
    const H = (x, y) => src[(((y+h)%h)*w + ((x+w)%w))*4]/255;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const dx = (H(x+1,y)-H(x-1,y))*k, dy = (H(x,y+1)-H(x,y-1))*k;
      const l = Math.hypot(dx, dy, 1), i = (y*w+x)*4;
      d[i] = (-dx/l*0.5+0.5)*255; d[i+1] = (dy/l*0.5+0.5)*255; d[i+2] = (1/l*0.5+0.5)*255; d[i+3] = 255;
    }
    ox.putImageData(img, 0, 0);
    return out;
  }

  /* ---------------------------------------------------------- the glyphs
     Signage without a font. A glyph is laid out in a square the way a
     hangul syllable is: an initial, a vowel bar, sometimes a final
     underneath — each one a circle, a bar or a hook. Seeded, so the same
     sign says the same thing every visit. */
  function seeded(s){ return ()=>{ s = (s*16807) % 2147483647; return (s-1)/2147483646; }; }
  function glyph(x, cx, cy, sz, r, lw){
    const u = sz/10; x.lineWidth = lw || u*1.25; x.lineCap = 'square'; x.beginPath();
    const part = (px, py, pw, ph) => {
      const k = Math.floor(r()*6);
      if(k===0){ x.moveTo(px+pw/2+pw/2.4, py+ph/2); x.arc(px+pw/2, py+ph/2, Math.min(pw,ph)/2.4, 0, 7); }
      else if(k===1){ x.moveTo(px, py+ph*0.2); x.lineTo(px+pw, py+ph*0.2); x.moveTo(px+pw*0.8, py+ph*0.2); x.lineTo(px+pw*0.8, py+ph); }
      else if(k===2){ x.moveTo(px+pw*0.1, py); x.lineTo(px+pw*0.1, py+ph); x.lineTo(px+pw, py+ph); }
      else if(k===3){ x.rect(px+pw*0.1, py+ph*0.1, pw*0.8, ph*0.8); }
      else if(k===4){ x.moveTo(px+pw/2, py); x.lineTo(px+pw*0.1, py+ph); x.moveTo(px+pw/2, py+ph*0.4); x.lineTo(px+pw*0.9, py+ph); }
      else { x.moveTo(px, py+ph*0.3); x.lineTo(px+pw, py+ph*0.3); x.moveTo(px, py+ph*0.75); x.lineTo(px+pw, py+ph*0.75); }
    };
    const s = sz*0.84, ox = cx - s/2, oy = cy - s/2, fin = r() < 0.5;
    const top = fin ? s*0.55 : s;
    if(r() < 0.5){                                   // initial left, vowel right
      part(ox, oy, s*0.55, top);
      x.moveTo(ox+s*0.78, oy); x.lineTo(ox+s*0.78, oy+top);
      if(r()<0.6){ x.moveTo(ox+s*0.78, oy+top*0.5); x.lineTo(ox+s, oy+top*0.5); }
    } else {                                         // initial above, vowel below
      part(ox+s*0.15, oy, s*0.7, top*0.55);
      x.moveTo(ox, oy+top*0.78); x.lineTo(ox+s, oy+top*0.78);
      if(r()<0.6){ x.moveTo(ox+s/2, oy+top*0.62); x.lineTo(ox+s/2, oy+top*0.78); }
    }
    if(fin) part(ox+s*0.1, oy+s*0.64, s*0.8, s*0.34);
    x.stroke();
  }
  function glyphs(x, n, cx, cy, sz, vertical, seed, col, lw){
    const r = seeded(seed||1); x.strokeStyle = col;
    for(let i=0;i<n;i++){
      const gx = vertical ? cx : cx + (i-(n-1)/2)*sz*1.08, gy = vertical ? cy + (i-(n-1)/2)*sz*1.08 : cy;
      glyph(x, gx, gy, sz, r, lw);
    }
  }

  /* ============================================================ surfaces */
  /* THE ROAD. A tile of wet tarmac: the colour, and a roughness map that
     is the puddles — dark (smooth) where water stands, light where it
     does not. The same map is the reflection's mask: the road mirrors the
     city only where it is smooth enough to. */
  function asphalt(o){
    o = Object.assign({ size:1024, base:'#1b2322', puddles:14, lines:false, rough:0.78 }, o||{});
    const S = o.size, c = cv(S), x = c.getContext('2d');
    x.fillStyle = o.base; x.fillRect(0,0,S,S);
    // aggregate: thousands of tiny stones, some lighter
    speckle(x, S, S, 26000, 0.35, 0.10);
    // repair patches and stains
    for(let i=0;i<7;i++){ x.fillStyle = `rgba(${rnd(10,30)|0},${rnd(18,34)|0},${rnd(18,30)|0},0.55)`;
      x.fillRect(rnd(0,S), rnd(0,S), rnd(60,260), rnd(40,200)); }
    for(let i=0;i<10;i++) blob(x, rnd(0,S), rnd(0,S), rnd(30,90), 'rgba(0,0,0,A)', 0.45);
    // cracks
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1.5;
    for(let i=0;i<14;i++){ let px = rnd(0,S), py = rnd(0,S); x.beginPath(); x.moveTo(px, py);
      for(let k=0;k<8;k++){ px += rnd(-30,30); py += rnd(-30,30); x.lineTo(px, py); } x.stroke(); }
    // the roughness: puddles are smooth
    const rc = cv(S), r = rc.getContext('2d');
    const base = Math.round(o.rough*255);
    r.fillStyle = `rgb(${base},${base},${base})`; r.fillRect(0,0,S,S);
    speckle(r, S, S, 9000, 0.18, 0.12);
    for(let i=0;i<o.puddles;i++){
      const px = rnd(0,S), py = rnd(0,S), rr = rnd(40, 170);
      // a puddle is several overlapping pools, so it has a ragged edge
      for(let k=0;k<5;k++) blob(r, px+rnd(-rr,rr)*0.6, py+rnd(-rr,rr)*0.4, rr*rnd(0.5,1), 'rgba(8,8,8,A)', 0.95);
      // and the water darkens the tarmac under it
      blob(x, px, py, rr*1.1, 'rgba(0,8,8,A)', 0.35);
    }
    const hc = cv(256), h = hc.getContext('2d'); h.fillStyle = '#808080'; h.fillRect(0,0,256,256); speckle(h, 256, 256, 6000, 0.5, 0.5);
    return { map:tex(c), rough:tex(rc, { srgb:false }), normal:tex(normalFrom(hc, 1.6), { srgb:false }) };
  }
  /* Pavement: square slabs, grime in the joints, a few puddles. */
  function paving(o){
    o = Object.assign({ size:512, base:'#39423f', slab:64 }, o||{});
    const S = o.size, c = cv(S), x = c.getContext('2d');
    x.fillStyle = o.base; x.fillRect(0,0,S,S);
    for(let py=0;py<S;py+=o.slab) for(let px=0;px<S;px+=o.slab){
      const v = rnd(-10, 10)|0; x.fillStyle = `rgba(${60+v},${70+v},${66+v},0.5)`; x.fillRect(px+2, py+2, o.slab-4, o.slab-4); }
    speckle(x, S, S, 7000, 0.3, 0.08);
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3;
    for(let i=0;i<=S;i+=o.slab){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,S); x.stroke(); x.beginPath(); x.moveTo(0,i); x.lineTo(S,i); x.stroke(); }
    const rc = cv(S), r = rc.getContext('2d'); r.fillStyle = '#b4b4b4'; r.fillRect(0,0,S,S);
    for(let i=0;i<5;i++) blob(r, rnd(0,S), rnd(0,S), rnd(30,90), 'rgba(20,20,20,A)', 0.9);
    r.strokeStyle = '#3a3a3a'; r.lineWidth = 3;             // water sits in the joints
    for(let i=0;i<=S;i+=o.slab){ r.beginPath(); r.moveTo(i,0); r.lineTo(i,S); r.stroke(); r.beginPath(); r.moveTo(0,i); r.lineTo(S,i); r.stroke(); }
    return { map:tex(c), rough:tex(rc, { srgb:false }) };
  }
  /* A plaster wall that has been rained on for thirty years: streaks
     running down from every sill, darker at the foot, posters half torn. */
  function plaster(base, o){
    o = Object.assign({ w:512, h:512, posters:true, streaks:40 }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0,0,o.w,o.h);
    speckle(x, o.w, o.h, 9000, 0.22, 0.08);
    for(let i=0;i<o.streaks;i++){
      const px = rnd(0,o.w), len = rnd(40, o.h*0.8), g = x.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px, rnd(0, o.h*0.4), rnd(2, 9), len);
    }
    const foot = x.createLinearGradient(0, o.h*0.6, 0, o.h); foot.addColorStop(0, 'rgba(0,0,0,0)'); foot.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = foot; x.fillRect(0, 0, o.w, o.h);
    if(o.posters) for(let i=0;i<4;i++){
      const pw = rnd(40,80), ph = pw*1.4, px = rnd(0, o.w-pw), py = rnd(o.h*0.45, o.h*0.8-ph);
      x.fillStyle = ['#d8d2c0','#c23a30','#2a4a8a','#e8c040','#e8e8e8'][i%5]; x.globalAlpha = 0.8; x.fillRect(px, py, pw, ph);
      x.fillStyle = '#111'; x.globalAlpha = 0.7; for(let k=0;k<4;k++) x.fillRect(px+6, py+10+k*10, pw*rnd(0.4,0.85), 4);
      x.globalAlpha = 1; x.fillStyle = base; x.beginPath(); x.moveTo(px+pw, py+ph*rnd(0.5,0.9)); x.lineTo(px+pw*rnd(0.3,0.7), py+ph); x.lineTo(px+pw, py+ph); x.fill();
    }
    return tex(c, { repeat:[1,1] });
  }
  /* THE ROLLER SHUTTER — half the ground floor of the alley. Slats, a
     bottom rail, rust, and graffiti: big loose red letters and white
     tags, sprayed after dark by somebody in a hurry. A normal map out of
     the slats, so the fluorescent tube above lights every ridge. */
  function shutter(seed, o){
    o = Object.assign({ base:'#667570', tag:'#c8322a' }, o||{});
    const S = 512, c = cv(S), x = c.getContext('2d'), r = seeded(seed||3);
    x.fillStyle = o.base; x.fillRect(0,0,S,S);
    const hc = cv(S), h = hc.getContext('2d'); h.fillStyle = '#000'; h.fillRect(0,0,S,S);
    for(let y=0;y<S;y+=14){
      const g = x.createLinearGradient(0, y, 0, y+14);
      g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
      x.fillStyle = g; x.fillRect(0, y, S, 14);
      const hg = h.createLinearGradient(0, y, 0, y+14); hg.addColorStop(0,'#fff'); hg.addColorStop(0.6,'#999'); hg.addColorStop(1,'#000');
      h.fillStyle = hg; h.fillRect(0, y, S, 14);
    }
    speckle(x, S, S, 6000, 0.25, 0.1);
    for(let i=0;i<14;i++){ const px = r()*S, py = r()*S; blob(x, px, py, 20+r()*50, 'rgba(110,60,30,A)', 0.35); }
    // the tags
    x.lineCap = 'round'; x.lineJoin = 'round';
    const scrawl = (col, w, n, big) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath();
      let px = S*(0.1+r()*0.3), py = S*(0.35+r()*0.35); x.moveTo(px, py);
      for(let k=0;k<n;k++){ const dx = (r()*2-0.5)*big, dy = (r()*2-1)*big; x.quadraticCurveTo(px+dx*0.5, py-dy, px+dx, py+dy*0.6); px += dx; py += dy*0.3; if(px > S*0.95) break; }
      x.stroke(); };
    x.globalAlpha = 0.85; scrawl(o.tag, 14, 9, 70);
    x.globalAlpha = 0.9;  scrawl('#f2f2ea', 4, 14, 30);
    if(r()<0.6){ x.globalAlpha = 0.8; scrawl('#1d1d1d', 6, 10, 40); }
    x.globalAlpha = 1;
    // the bottom rail and the handle
    x.fillStyle = '#2a302e'; x.fillRect(0, S-26, S, 26); x.fillStyle = '#8a8f8a'; x.fillRect(S/2-30, S-22, 60, 8);
    return { map:tex(c), normal:tex(normalFrom(hc, 2.2), { srgb:false }) };
  }
  /* UPPER FLOORS. A wall with rows of windows, some lit, some with the
     blinds down, a few with a TV glowing blue — and a second canvas with
     only the lit panes on it, for the emissive map, so they glow whatever
     the light is doing. `floors` × `bays` windows. */
  function windows(o){
    o = Object.assign({ w:512, h:1024, bays:4, floors:6, wall:'#3a4441', lit:0.35, seed:7, frame:'#1a1f1e' }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d'), e = cv(o.w, o.h), y = e.getContext('2d'), r = seeded(o.seed);
    x.fillStyle = o.wall; x.fillRect(0,0,o.w,o.h); y.fillStyle = '#000'; y.fillRect(0,0,o.w,o.h);
    speckle(x, o.w, o.h, 8000, 0.2, 0.06);
    const bw = o.w/o.bays, fh = o.h/o.floors;
    for(let f=0; f<o.floors; f++) for(let b=0; b<o.bays; b++){
      const px = b*bw + bw*0.18, py = f*fh + fh*0.22, pw = bw*0.64, ph = fh*0.5;
      x.fillStyle = o.frame; x.fillRect(px-4, py-4, pw+8, ph+8);
      const v = r(), lit = v < o.lit;
      const col = !lit ? '#0d1413' : v < o.lit*0.2 ? '#6fb0ff' : v < o.lit*0.45 ? '#9ff5d8' : '#ffc27a';
      x.fillStyle = col; x.fillRect(px, py, pw, ph);
      if(lit){ y.fillStyle = col; y.fillRect(px, py, pw, ph);
        if(r()<0.5){ y.fillStyle = 'rgba(0,0,0,0.55)'; for(let k=0;k<6;k++) y.fillRect(px, py+k*ph/6, pw, ph/12); x.fillStyle = 'rgba(0,0,0,0.4)'; for(let k=0;k<6;k++) x.fillRect(px, py+k*ph/6, pw, ph/12); }
      } else { x.fillStyle = 'rgba(120,160,150,0.08)'; x.fillRect(px, py, pw*0.4, ph); }
      x.fillStyle = o.frame; x.fillRect(px+pw/2-2, py, 4, ph);                  // mullion
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px-6, py+ph+4, pw+12, 6);     // sill
      const g = x.createLinearGradient(0, py+ph+10, 0, py+ph+10+fh*0.5); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px+r()*pw, py+ph+10, 5, fh*0.5);                // a streak under the sill
    }
    return { map:tex(c), glow:tex(e) };
  }
  /* A lit shop front: glass, a warm interior, a counter's worth of shapes
     and a name over it. */
  function shopfront(name, o){
    o = Object.assign({ inside:'#ffcf8f', w:512, h:256, seed:5, sign:'#e8fff4' }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d'), r = seeded(o.seed);
    const g = x.createLinearGradient(0, 0, 0, o.h); g.addColorStop(0, o.inside); g.addColorStop(1, '#3a2a20');
    x.fillStyle = g; x.fillRect(0, 0, o.w, o.h);
    for(let i=0;i<12;i++){ x.fillStyle = `rgba(0,0,0,${0.2+r()*0.35})`; x.fillRect(r()*o.w, o.h*(0.35+r()*0.4), 20+r()*60, 30+r()*80); }
    x.fillStyle = 'rgba(255,255,255,0.06)'; for(let i=0;i<4;i++) x.fillRect(r()*o.w, 0, 8+r()*20, o.h);
    x.fillStyle = '#141a18'; x.fillRect(0, 0, o.w, 10); x.fillRect(0, o.h-10, o.w, 10); for(let i=0;i<=4;i++) x.fillRect(i*o.w/4-4, 0, 8, o.h);
    return tex(c);
  }

  /* ============================================================== signs */
  /* A vertical signboard: a light box with a frame, glyphs down it. Two
     colourways, both from the reference — cream with dark ink, and black
     with lit ink. */
  function vsign(seed, o){
    o = Object.assign({ n:4, bg:'#f3d27a', ink:'#3a1a10', frame:'#2a1a12' }, o||{});
    const c = cv(128, 512), x = c.getContext('2d');
    x.fillStyle = o.frame; x.fillRect(0,0,128,512);
    const g = x.createLinearGradient(0,0,128,0); g.addColorStop(0, o.bg); g.addColorStop(0.5, '#fff8e0'); g.addColorStop(1, o.bg);
    x.fillStyle = o.bg; x.fillRect(12,12,104,488); x.globalAlpha = 0.35; x.fillStyle = g; x.fillRect(12,12,104,488); x.globalAlpha = 1;
    glyphs(x, o.n, 64, 256, 88, true, seed, o.ink);
    return tex(c);
  }
  /* a horizontal board: latin name plus glyphs, the way half the shops in
     the reference are signed */
  function hsign(text, seed, o){
    o = Object.assign({ bg:'#10201c', ink:'#9ff5d8', glyphs:3, w:512, h:128, frame:'#0a0f0e' }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d');
    if(o.bg){ x.fillStyle = o.frame; x.fillRect(0,0,o.w,o.h); x.fillStyle = o.bg; x.fillRect(6,6,o.w-12,o.h-12); }
    x.fillStyle = o.ink; x.textAlign = 'left'; x.textBaseline = 'middle';
    const f = window.fitFont ? fitFont(x, text, o.h*0.52, o.w*0.62) : 40;
    x.font = 'bold '+f+'px '+(window.uiFont ? uiFont() : 'monospace');
    x.fillText(text, 18, o.h/2+2);
    if(o.glyphs) glyphs(x, o.glyphs, o.w*0.82, o.h/2, o.h*0.5, false, seed, o.ink);
    return tex(c);
  }
  /* NEON: text or a drawn shape on black, meant for an additive plane —
     the tube itself near white, its colour in the halo. The bloom does
     the rest. */
  function neon(draw, o){
    o = Object.assign({ w:512, h:256, col:'#27ffd0' }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0,0,o.w,o.h);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const pass = (w, col, blur) => { x.shadowColor = o.col; x.shadowBlur = blur; x.strokeStyle = col; x.fillStyle = col; x.lineWidth = w; draw(x, o.w, o.h); };
    pass(14, o.col, 30); pass(5, '#ffffff', 8);
    return tex(c);
  }
  function neonText(text, col, o){
    o = Object.assign({ w:512, h:160 }, o||{});
    return neon((x, w, h)=>{
      const f = window.fitFont ? fitFont(x, text, h*0.62, w*0.9) : 60;
      x.font = 'bold '+f+'px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.strokeText(text, w/2, h/2+2);
    }, { w:o.w, h:o.h, col });
  }
  /* the dragon on the corner, from the reference */
  function dragon(col){
    return neon((x, w, h)=>{
      x.beginPath();
      const cx = w/2, cy = h/2;
      x.moveTo(cx-60, cy-150);                         // head
      x.quadraticCurveTo(cx+30, cy-190, cx+70, cy-140);
      x.quadraticCurveTo(cx+40, cy-120, cx+20, cy-110);
      x.moveTo(cx+10, cy-120);                          // body: an S coiled down
      x.bezierCurveTo(cx+130, cy-80, cx+120, cy+10, cx+10, cy+10);
      x.bezierCurveTo(cx-110, cy+10, cx-120, cy+110, cx+10, cy+120);
      x.bezierCurveTo(cx+90, cy+125, cx+100, cy+170, cx+40, cy+180);
      x.moveTo(cx-60, cy-150); x.lineTo(cx-80, cy-175); // horns
      x.moveTo(cx-40, cy-160); x.lineTo(cx-45, cy-190);
      x.moveTo(cx+60, cy-60); x.lineTo(cx+95, cy-70);   // a claw
      x.moveTo(cx-60, cy+60); x.lineTo(cx-95, cy+55);
      x.stroke();
    }, { w:320, h:420, col });
  }
  /* FASHION. The avenue is lit by adverts for clothes nobody on this
     street can afford: a gradient, a figure in a coat, a name. */
  const BRANDS = [['NOCTIS','WEAR THE NIGHT','#1a0a3a','#ff3fd0'], ['VEYRA','SEASON ZERO','#081a24','#27e8ff'],
                  ['LUMEN','LIGHT IS A FABRIC','#1f0a14','#ff8a3d'], ['KAZE','BY WFC APPROVED ATELIERS','#0a1f16','#3ddc84'],
                  ['ORRA','SMART SILK','#200818','#ffd23d'], ['MIRAI','THE CITY IS WATCHING','#0b0f22','#c86bff']];
  function fashionAd(i){
    const [name, line, bg, acc] = BRANDS[i % BRANDS.length];
    const W = 512, H = 1024, c = cv(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, bg); g.addColorStop(1, acc);
    x.fillStyle = g; x.fillRect(0,0,W,H);
    x.globalAlpha = 0.25; for(let k=0;k<5;k++) blob(x, rnd(0,W), rnd(0,H), rnd(150,400), 'rgba(255,255,255,A)', 0.4); x.globalAlpha = 1;
    // the figure: head, long neck, a coat that falls to the knee
    x.fillStyle = 'rgba(8,6,14,0.92)';
    const cx = W*0.5, top = H*0.18;
    x.beginPath(); x.ellipse(cx, top, 42, 54, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(cx-18, top+40); x.lineTo(cx+18, top+40); x.lineTo(cx+22, top+90); x.lineTo(cx-22, top+90); x.fill();
    x.beginPath(); x.moveTo(cx-40, top+90); x.bezierCurveTo(cx-160, top+120, cx-170, top+420, cx-150, top+640);
    x.lineTo(cx+150, top+640); x.bezierCurveTo(cx+170, top+420, cx+160, top+120, cx+40, top+90); x.fill();
    x.strokeStyle = acc; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, top+95); x.lineTo(cx, top+640); x.stroke();
    x.fillStyle = '#fff';
    const f = window.fitFont ? fitFont(x, name, 140, W*0.86) : 110;
    x.font = 'bold '+f+'px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'center';
    x.fillText(name, W/2, H*0.9);
    x.font = 'bold 26px '+(window.uiFont ? uiFont() : 'monospace'); x.fillStyle = acc; x.fillText(line, W/2, H*0.95);
    return tex(c);
  }
  /* The WFC mark: a hexagon cut by a bar. It is on the tower, on the
     drones, on the checkpoint and behind the Director on every screen. */
  function wfcMark(x, cx, cy, r, col){
    x.strokeStyle = col; x.lineWidth = r*0.14; x.beginPath();
    for(let i=0;i<=6;i++){ const a = i/6*Math.PI*2 + Math.PI/6; x.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); } x.stroke();
    x.fillStyle = col; x.fillRect(cx-r*0.62, cy-r*0.1, r*1.24, r*0.2);
    x.font = 'bold '+(r*0.5)+'px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('WFC', cx, cy-r*0.42);
  }
  function wfcSign(o){
    o = Object.assign({ w:512, h:512, col:'#8ff0ff', bg:'#000' }, o||{});
    const c = cv(o.w, o.h), x = c.getContext('2d'); x.fillStyle = o.bg; x.fillRect(0,0,o.w,o.h);
    x.shadowColor = o.col; x.shadowBlur = 24; wfcMark(x, o.w/2, o.h/2, Math.min(o.w,o.h)*0.36, o.col);
    return tex(c);
  }
  /* A paper lantern: ribs, a black character, darker top and bottom. */
  function lanternTex(seed){
    const c = cv(256, 256), x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,0,256); g.addColorStop(0,'#5a0c04'); g.addColorStop(0.18,'#ff5a1a'); g.addColorStop(0.5,'#ffb060'); g.addColorStop(0.82,'#ff5a1a'); g.addColorStop(1,'#5a0c04');
    x.fillStyle = g; x.fillRect(0,0,256,256);
    x.strokeStyle = 'rgba(80,10,0,0.35)'; x.lineWidth = 2; for(let i=0;i<256;i+=16){ x.beginPath(); x.moveTo(0,i); x.lineTo(256,i); x.stroke(); }
    glyphs(x, 1, 64, 128, 74, false, seed, 'rgba(30,5,0,0.85)'); glyphs(x, 1, 192, 128, 74, false, seed+1, 'rgba(30,5,0,0.85)');
    return tex(c);
  }
  /* sky: the city's own glow on the underside of the cloud, teal above */
  function skyTex(){
    const c = cv(16, 512), x = c.getContext('2d'), g = x.createLinearGradient(0,0,0,512);
    g.addColorStop(0, '#020807'); g.addColorStop(0.35, '#06201c'); g.addColorStop(0.52, '#1d5a50'); g.addColorStop(0.58, '#0c2b27'); g.addColorStop(1, '#030807');
    x.fillStyle = g; x.fillRect(0,0,16,512);
    return tex(c);
  }

  /* ============================================================ the post */
  let R = null;                    // renderer
  let P = null;                    // everything the pipeline owns
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  function fsMat(frag, uniforms, o){
    return new THREE.ShaderMaterial(Object.assign({ vertexShader:VERT, fragmentShader:frag, uniforms,
      depthTest:false, depthWrite:false, toneMapped:false }, o||{}));
  }
  const DOWN = `
    uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst, uThreshold, uKnee; varying vec2 vUv;
    vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
    void main(){
      vec3 a=s(vec2(-2.,2.)), b=s(vec2(0.,2.)), c=s(vec2(2.,2.)), d=s(vec2(-2.,0.)), e=s(vec2(0.)), f=s(vec2(2.,0.));
      vec3 g=s(vec2(-2.,-2.)), h=s(vec2(0.,-2.)), i=s(vec2(2.,-2.)), j=s(vec2(-1.,1.)), k=s(vec2(1.,1.)), l=s(vec2(-1.,-1.)), m=s(vec2(1.,-1.));
      vec3 col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
      if(uFirst > 0.5){
        float br = max(col.r, max(col.g, col.b));
        float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0*uKnee); soft = soft*soft/(4.0*uKnee + 1e-4);
        col *= max(soft, br - uThreshold) / max(br, 1e-4);
        col = min(col, vec3(60.0));                       // one blown pixel is not allowed to flare the screen
      }
      gl_FragColor = vec4(col, 1.0);
    }`;
  const UP = `
    uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
    vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel*uRadius).rgb; }
    void main(){
      vec3 col = s(vec2(0.))*4.0 + (s(vec2(-1.,0.))+s(vec2(1.,0.))+s(vec2(0.,1.))+s(vec2(0.,-1.)))*2.0
               + s(vec2(-1.,-1.))+s(vec2(1.,-1.))+s(vec2(-1.,1.))+s(vec2(1.,1.));
      gl_FragColor = vec4(col/16.0, 1.0);
    }`;
  const COMP = `
    #include <packing>
    uniform sampler2D tDepth; uniform float uVerse, uNear, uFar;
    uniform sampler2D tScene, tBloom, tAO, tDof, tStreak; uniform float uAO, uDof, uStreak, uSat, uSharp, uSplit; uniform vec3 uStreakCol, uShadowTint, uHighTint;
    uniform float uBloom, uTime, uVig, uGrain, uCA, uFlash, uLetter, uFade, uComic, uGlitch, uHue, uContrast;
    uniform vec3 uLift, uGain, uFlashCol; uniform vec2 uRes; varying vec2 vUv;
    float lumOf(vec2 p){ vec3 c = texture2D(tScene, p).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); return l/(1.0 + l); }
    /* PAINTED (Kuwahara): of the four little squares around a pixel, the one whose colour varies least gives it its
       colour — flat patches with their edges kept, like gouache, not a blur */
    vec3 kuwahara(vec2 uv, float rad){
      vec2 px = rad/uRes; vec3 best = texture2D(tScene, uv).rgb; float bv = 1e9;
      for(int q = 0; q < 4; q++){
        vec2 dir = vec2(q == 0 || q == 3 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
        vec3 m = vec3(0.0), m2 = vec3(0.0);
        for(int i = 0; i < 3; i++) for(int j = 0; j < 3; j++){
          vec3 c = texture2D(tScene, uv + dir*vec2(float(i), float(j))*px*0.5).rgb; c = c/(1.0 + c);
          m += c; m2 += c*c; }
        m /= 9.0; vec3 v = m2/9.0 - m*m; float vv = v.r + v.g + v.b;
        if(vv < bv){ bv = vv; best = m/(1.0 - min(m, vec3(0.999))); }
      }
      return best;
    }
    void main(){
      vec2 uv = vUv, d = uv - 0.5; float r2 = dot(d, d);
      // INTO THE SPIDER-VERSE, the lens: a whisper of barrel distortion, the picture bowed out at the corners
      if(uVerse > 0.001){ uv = 0.5 + d*(1.0 - 0.02*uVerse*r2*4.0); d = uv - 0.5; r2 = dot(d, d); }
      // HAYWIRE: the picture tears — bands of it shoved sideways, a frame at a time — and the plates slip further
      if(uGlitch > 0.001){
        float fr = floor(uTime*14.0), band = floor(uv.y*(10.0 + 30.0*fract(fr*0.37)));
        float h1 = fract(sin(band*12.9898 + fr*78.233)*43758.5453), h2 = fract(sin(band*39.346 + fr*11.135)*24634.6345);
        if(h1 > 1.0 - uGlitch*0.45) uv.x += (h2 - 0.5)*0.18*uGlitch;
        float bl = fract(sin(floor(uv.x*8.0)*7.13 + floor(uv.y*6.0)*3.7 + fr)*9137.13);
        if(bl > 1.0 - uGlitch*0.12) uv = floor(uv*vec2(40.0, 24.0))/vec2(40.0, 24.0);
      }
      // the comic: the plates printed a little off register — red one way, blue the other, more towards the edges
      vec2 mis = vec2(2.2, -1.4)/uRes*(uComic + uGlitch*9.0*(0.6 + 0.4*sin(uTime*23.0)))*(1.0 + r2*6.0);
      vec3 col = vec3(texture2D(tScene, uv - d*uCA*r2 + mis).r, texture2D(tScene, uv).g, texture2D(tScene, uv + d*uCA*r2 - mis).b);
      if(uVerse > 0.001){
        // painted, and printed off register: the colour plates slip apart, more the further away a thing is —
        // whoever is close stays crisp, the city behind them fringes
        // painted, lightly: half the picture from the brush, so surfaces flatten but small things stay readable
        vec3 paint = kuwahara(uv, 1.4 + uVerse*0.6);
        float vz = -perspectiveDepthToViewZ(texture2D(tDepth, uv).r, uNear, uFar);
        float far = smoothstep(4.0, 40.0, vz);
        vec2 off = vec2(1.0, 0.35)/uRes*(0.8 + 2.7*far)*uVerse;
        vec3 c0 = texture2D(tScene, uv).rgb;
        vec3 fr = vec3(texture2D(tScene, uv + off).r - c0.r, 0.0, texture2D(tScene, uv - off).b - c0.b);
        col = mix(col, paint, 0.45*uVerse) + fr*uVerse*0.8;
        // then crisp again: the edges the brush softened are sharpened back (after it, not before)
        vec2 px1 = 1.0/uRes; vec3 nb = texture2D(tScene, uv + vec2(px1.x, 0.0)).rgb + texture2D(tScene, uv - vec2(px1.x, 0.0)).rgb
          + texture2D(tScene, uv + vec2(0.0, px1.y)).rgb + texture2D(tScene, uv - vec2(0.0, px1.y)).rgb;
        col = max(col + (c0 - nb*0.25)*0.6*uVerse, 0.0);
        /* INK. A comic is drawn before it is coloured: a thin dark line wherever one thing stands in front of another
           (a jump in the depth), so a figure reads against the city however busy the colour behind her is */
        float zc = vz, zl = -perspectiveDepthToViewZ(texture2D(tDepth, uv - vec2(px1.x, 0.0)).r, uNear, uFar),
              zr = -perspectiveDepthToViewZ(texture2D(tDepth, uv + vec2(px1.x, 0.0)).r, uNear, uFar),
              zu = -perspectiveDepthToViewZ(texture2D(tDepth, uv + vec2(0.0, px1.y)).r, uNear, uFar),
              zd = -perspectiveDepthToViewZ(texture2D(tDepth, uv - vec2(0.0, px1.y)).r, uNear, uFar);
        float jump = (abs(zl + zr - 2.0*zc) + abs(zu + zd - 2.0*zc))/max(zc, 0.5);
        float ink = smoothstep(0.06, 0.2, jump)*(1.0 - smoothstep(25.0, 60.0, zc));      // far away, no ink: it would only be noise
        col = mix(col, col*0.12, ink*0.85*uVerse);
      }
      // sharpen: contrast-adaptive, a touch — the MSAA and the bloom soften everything a little
      if(uSharp > 0.001){ vec2 px = 1.0/uRes; vec3 nb = texture2D(tScene, uv + vec2(px.x, 0.0)).rgb + texture2D(tScene, uv - vec2(px.x, 0.0)).rgb + texture2D(tScene, uv + vec2(0.0, px.y)).rgb + texture2D(tScene, uv - vec2(0.0, px.y)).rgb;
        col = max(col + (col - nb*0.25)*uSharp, 0.0); }
      // contact shadow
      if(uAO > 0.001){ float ao = texture2D(tAO, uv).r; col *= mix(1.0, ao, uAO); }
      // out of focus
      if(uDof > 0.001){ vec4 df = texture2D(tDof, uv); col = mix(col, df.rgb, clamp(df.a*1.4, 0.0, 1.0)*uDof); }
      vec3 bloomC = texture2D(tBloom, uv).rgb * uBloom;
      if(uVerse > 0.001){
        /* the glow printed as dots: a Ben-Day grid at 15 degrees, each dot as big as the glow is bright there, so a
           lamp's spill reads as a printed halo — solid at the light, breaking into dots as it falls off */
        float bl = dot(bloomC, vec3(0.333)); bl = bl/(1.0 + bl);
        vec2 g = mat2(0.966, -0.259, 0.259, 0.966)*(gl_FragCoord.xy/4.0);
        float rad = sqrt(clamp(bl*1.6, 0.0, 1.0))*0.62, dt = length(fract(g) - 0.5);
        float dotM = 1.0 - smoothstep(rad - 0.06, rad + 0.06, dt);
        bloomC = mix(bloomC, bloomC*dotM*1.8, uVerse);
      }
      col += bloomC;
      if(uStreak > 0.001) col += texture2D(tStreak, uv).rgb*uStreakCol*uStreak;
      col = col*uGain + uLift;
      if(abs(uHue) > 0.001){                       // the whole picture's colour turned round the wheel
        const vec3 k = vec3(0.57735); float cs = cos(uHue), sn = sin(uHue);
        col = col*cs + cross(k, col)*sn + k*dot(k, col)*(1.0 - cs);
      }
      col *= 1.0 - uVig*r2*1.8;
      col += uFlashCol*uFlash;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      // high contrast: the blacks crushed, the lights pushed, an S through the middle
      if(uContrast > 0.001){ vec3 cc = gl_FragColor.rgb; gl_FragColor.rgb = mix(cc, smoothstep(0.07, 0.82, cc)*1.08, uContrast); }
      // the film grade: cool in the shadows, warm in the highlights, a little more colour
      { vec3 g0 = gl_FragColor.rgb; float L = dot(g0, vec3(0.2126, 0.7152, 0.0722));
        g0 += uShadowTint*(1.0 - smoothstep(0.0, 0.45, L))*uSplit + uHighTint*smoothstep(0.5, 1.0, L)*uSplit;
        g0 = mix(vec3(L), g0, uSat);
        gl_FragColor.rgb = clamp(g0, 0.0, 1.0); }
      if(uComic > 0.001){
        /* INTO THE SPIDER-VERSE. Ink where the picture changes (an edge filter on the scene's light),
           Ben-Day dots where it is in half shadow, hatching where it is dark, the colour a little
           posterised — printed, not rendered. */
        vec3 c0 = gl_FragColor.rgb; vec2 px = 1.0/uRes;
        float tl = lumOf(uv + px*vec2(-1.0, 1.0)), t_ = lumOf(uv + px*vec2(0.0, 1.0)), tr = lumOf(uv + px*vec2(1.0, 1.0));
        float l_ = lumOf(uv + px*vec2(-1.0, 0.0)), r_ = lumOf(uv + px*vec2(1.0, 0.0));
        float bl = lumOf(uv + px*vec2(-1.0, -1.0)), b_ = lumOf(uv + px*vec2(0.0, -1.0)), br = lumOf(uv + px*vec2(1.0, -1.0));
        float gx = -tl - 2.0*l_ - bl + tr + 2.0*r_ + br, gy = -bl - 2.0*b_ - br + tl + 2.0*t_ + tr;
        float edge = smoothstep(0.13, 0.3, length(vec2(gx, gy)));
        float lum = dot(c0, vec3(0.299, 0.587, 0.114));
        vec3 ink = vec3(0.05, 0.015, 0.1);
        // halftone: a dot grid at 45 degrees, the dots bigger the darker it is
        vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071)*(gl_FragCoord.xy/5.5);
        float dd = length(fract(g) - 0.5), rad = sqrt(clamp(1.0 - lum*1.7, 0.0, 1.0))*0.6;
        float dots = 1.0 - smoothstep(rad - 0.07, rad + 0.07, dd);
        vec3 c1 = mix(c0, c0*0.35 + ink*0.4, dots*smoothstep(0.62, 0.18, lum)*0.85);
        // and in the brightest colour, magenta dots in it like a printed highlight
        vec2 g2 = mat2(0.966, -0.259, 0.259, 0.966)*(gl_FragCoord.xy/4.0);
        float hd = 1.0 - smoothstep(0.18, 0.26, length(fract(g2) - 0.5));
        float sat = max(c0.r, max(c0.g, c0.b)) - min(c0.r, min(c0.g, c0.b));
        c1 = mix(c1, c1*vec3(1.08, 0.82, 1.12), hd*smoothstep(0.55, 0.9, lum)*sat);
        // hatching in the darks
        float hatch = step(0.62, fract((gl_FragCoord.x + gl_FragCoord.y)/5.0));
        c1 = mix(c1, ink, hatch*smoothstep(0.14, 0.03, lum)*0.75);
        // posterise a little, push the colour
        c1 = mix(c1, floor(c1*7.0 + 0.5)/7.0, 0.3);
        float m = dot(c1, vec3(0.333)); c1 = mix(vec3(m), c1, 1.25);
        c1 = mix(c1, ink, edge*0.92);
        gl_FragColor.rgb = mix(c0, clamp(c1, 0.0, 1.0), uComic);
      }
      float n = fract(sin(dot(uv*vec2(12.9898, 78.233) + uTime, vec2(1.0, 1.7)))*43758.5453);
      gl_FragColor.rgb += (n - 0.5)*uGrain;
      if(abs(uv.y - 0.5) > 0.5 - uLetter) gl_FragColor.rgb = vec3(0.0);
      gl_FragColor.rgb *= 1.0 - uFade;
    }`;
  /* AMBIENT OCCLUSION. Where two surfaces meet, light can't get in: a body on a floor, a box against a wall, the
     inside of a doorway. Without it everything floats. Half resolution, from depth alone: the view-space position
     of each pixel, its normal from how that position changes across the screen, and a dozen samples in the
     hemisphere above it — how many land behind something nearer is how shut in that pixel is. */
  const AO = `
    #include <packing>
    uniform sampler2D tDepth; uniform mat4 uProj, uInvProj; uniform vec2 uRes; uniform float uRadius, uNear, uFar;
    varying vec2 vUv;
    vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = vec4(uv*2.0 - 1.0, d*2.0 - 1.0, 1.0); vec4 v = uInvProj*c; return v.xyz/v.w; }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
    void main(){
      float d0 = texture2D(tDepth, vUv).x;
      if(d0 >= 0.9999){ gl_FragColor = vec4(1.0); return; }
      vec3 p = viewPos(vUv);
      vec3 n = normalize(cross(dFdx(p), dFdy(p)));
      float r = uRadius*clamp(-p.z*0.06, 0.35, 2.5), occ = 0.0, a0 = hash(vUv*uRes)*6.2831;
      for(int i = 0; i < 12; i++){
        float fi = float(i), a = a0 + fi*2.39996, h = (fi + 0.5)/12.0;
        vec3 dir = normalize(vec3(cos(a)*sqrt(1.0 - h*h), sin(a)*sqrt(1.0 - h*h), h));
        vec3 t = normalize(cross(abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n)), b = cross(n, t);
        vec3 sp = p + (t*dir.x + b*dir.y + n*dir.z)*r*(0.25 + 0.75*h*h);
        vec4 q = uProj*vec4(sp, 1.0); vec2 suv = q.xy/q.w*0.5 + 0.5;
        if(suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
        float sz = viewPos(suv).z;
        float range = smoothstep(0.0, 1.0, r/abs(p.z - sz));
        occ += (sz >= sp.z + 0.03*r ? 1.0 : 0.0)*range;
      }
      gl_FragColor = vec4(vec3(pow(clamp(1.0 - occ/12.0, 0.0, 1.0), 1.6)), 1.0);
    }`;
  /* DEPTH OF FIELD. A film lens is only sharp at one distance; everything nearer and further goes soft — which is
     most of why a still from a film looks like a film. The circle of confusion of each pixel from its depth and
     the focus distance, and a gather of the scene round it, wider the further out of focus it is. */
  const DOF = `
    #include <packing>
    uniform sampler2D tScene, tDepth; uniform vec2 uTexel; uniform float uFocus, uAperture, uMaxR, uNear, uFar; varying vec2 vUv;
    float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
    float coc(float z){ return clamp(abs(z - uFocus)/max(uFocus*uAperture, 0.01), 0.0, 1.0); }
    void main(){
      float c0 = coc(viewZ(vUv));
      vec3 acc = texture2D(tScene, vUv).rgb; float w = 1.0;
      for(int i = 1; i < 24; i++){
        float fi = float(i), a = fi*2.39996, rr = sqrt(fi/24.0);
        vec2 o = vec2(cos(a), sin(a))*rr*uMaxR*uTexel;
        vec2 uv = vUv + o*max(c0, 0.0);
        float ci = coc(viewZ(uv));
        float wi = smoothstep(0.0, 1.0, ci + 0.2);
        acc += texture2D(tScene, uv).rgb*wi; w += wi;
      }
      gl_FragColor = vec4(acc/w, c0);
    }`;
  /* ANAMORPHIC STREAK. A film lens with a squeezed element smears every bright light into a long horizontal line —
     the blue streak across a headlight in every night chase ever filmed. The bloom's small, bright mip, blurred far
     sideways and nowhere vertically. */
  const STREAK = `
    uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    void main(){
      vec3 acc = vec3(0.0); float w = 0.0;
      for(int i = -24; i <= 24; i++){ float fi = float(i), k = exp(-abs(fi)/9.0); acc += texture2D(tSrc, vUv + vec2(fi*uTexel.x*2.0, 0.0)).rgb*k; w += k; }
      gl_FragColor = vec4(acc/w, 1.0);
    }`;
  const LEVELS = 5;
  function rt(w, h, o){
    return new THREE.WebGLRenderTarget(Math.max(1, w|0), Math.max(1, h|0), Object.assign({
      type:THREE.HalfFloatType, format:THREE.RGBAFormat, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter,
      depthBuffer:false, generateMipmaps:false }, o||{}));
  }
  function build(){
    const size = R.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x, h = size.y;
    const depth = new THREE.DepthTexture(w, h); depth.type = THREE.UnsignedIntType;
    const scene = rt(w, h, { depthBuffer:true, samples:4, depthTexture:depth });
    const aoT = rt(w/2, h/2), dofT = rt(w/2, h/2), streakT = rt(w/8, h/8);
    const mips = [];
    for(let i=0;i<LEVELS;i++) mips.push(rt(w/Math.pow(2, i+1), h/Math.pow(2, i+1)));
    const refl = rt(w/2, h/2, { depthBuffer:true, generateMipmaps:true, minFilter:THREE.LinearMipmapLinearFilter });
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(quadGeo); quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad);
    const down = fsMat(DOWN, { tSrc:{value:null}, uTexel:{value:new THREE.Vector2()}, uFirst:{value:0}, uThreshold:{value:1.15}, uKnee:{value:0.5} });
    const up = fsMat(UP, { tSrc:{value:null}, uTexel:{value:new THREE.Vector2()}, uRadius:{value:1} },
                     { blending:THREE.AdditiveBlending, transparent:true });
    const ao = fsMat(AO, { tDepth:{value:depth}, uProj:{value:new THREE.Matrix4()}, uInvProj:{value:new THREE.Matrix4()}, uRes:{value:new THREE.Vector2(w/2, h/2)}, uRadius:{value:0.6}, uNear:{value:0.1}, uFar:{value:1000} });
    const dof = fsMat(DOF, { tScene:{value:null}, tDepth:{value:depth}, uTexel:{value:new THREE.Vector2(1/w, 1/h)}, uFocus:{value:5}, uAperture:{value:0.5}, uMaxR:{value:10}, uNear:{value:0.1}, uFar:{value:1000} });
    const streak = fsMat(STREAK, { tSrc:{value:null}, uTexel:{value:new THREE.Vector2(8/w, 8/h)} });
    const comp = fsMat(COMP, { tScene:{value:null}, tBloom:{value:null}, tAO:{value:aoT.texture}, tDof:{value:dofT.texture}, tStreak:{value:streakT.texture},
      uAO:{value:0}, uDof:{value:0}, uStreak:{value:0}, uSat:{value:1.12}, uSharp:{value:0.35}, uSplit:{value:1}, uStreakCol:{value:new THREE.Vector3(0.45, 0.75, 1.0)},
      uShadowTint:{value:new THREE.Vector3(-0.012, 0.004, 0.022)}, uHighTint:{value:new THREE.Vector3(0.03, 0.012, -0.02)}, uBloom:{value:0.9}, uTime:{value:0},
      uVig:{value:0.55}, uGrain:{value:0.035}, uCA:{value:0.012}, uGlitch:{value:0}, uHue:{value:0}, uContrast:{value:0}, uLift:{value:new THREE.Vector3(0.0015, 0.004, 0.0038)},
      uGain:{value:new THREE.Vector3(0.93, 1.03, 1.0)}, uFlash:{value:0}, uFlashCol:{value:new THREE.Vector3(1,1,1)},
      uLetter:{value:0}, uFade:{value:0}, uComic:{value:0}, uRes:{value:new THREE.Vector2(w, h)}, tDepth:{value:depth}, uVerse:{value:0}, uNear:{value:0.1}, uFar:{value:1000} }, { toneMapped:true });
    P = { w, h, scene, depth, aoT, dofT, streakT, mips, refl, cam, quad, qs, down, up, comp, ao, dof, streak, t:0 };
  }
  function freeP(){
    if(!P) return;
    [P.scene, P.refl, P.aoT, P.dofT, P.streakT, ...P.mips].forEach(t=>t.dispose()); if(P.depth) P.depth.dispose();
    [P.down, P.up, P.comp, P.ao, P.dof, P.streak].forEach(m=>m.dispose());
    P = null;
  }
  function pass(mat, target){
    P.quad.material = mat;
    R.setRenderTarget(target);
    R.render(P.qs, P.cam);
  }

  /* --------------------------------------------------------- the mirror
     three.js's Reflector, cut down to one plane (the street, y = 0) and
     one texture that every wet material reads. */
  const refl = { cam:new THREE.PerspectiveCamera(), matrix:new THREE.Matrix4(), y:0, on:false };
  const _n = new V3(0,1,0), _rp = new V3(), _cp = new V3(), _rot = new THREE.Matrix4(), _look = new V3(), _view = new V3(), _tgt = new V3();
  const _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q = new THREE.Vector4();
  const wetMats = [];               // their `uReflK` goes to 0 when the mirror is off
  const hideInMirror = [];          // the wet surfaces themselves, and anything flagged
  function mirror(scene, camera){
    _rp.set(0, refl.y, 0); _cp.setFromMatrixPosition(camera.matrixWorld);
    _view.subVectors(_rp, _cp);
    if(_view.dot(_n) > 0) return false;              // under the street: nothing to mirror
    _view.reflect(_n).negate(); _view.add(_rp);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_cp);
    _tgt.subVectors(_rp, _look); _tgt.reflect(_n).negate(); _tgt.add(_rp);
    const vc = refl.cam;
    vc.position.copy(_view); vc.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n); vc.lookAt(_tgt);
    vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    refl.matrix.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1);
    refl.matrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // tilt the near plane onto the street, so nothing below it is drawn
    _plane.setFromNormalAndCoplanarPoint(_n, _rp); _plane.applyMatrix4(vc.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = vc.projectionMatrix, e = pm.elements;
    _q.x = (Math.sign(_clip.x) + e[8]) / e[0]; _q.y = (Math.sign(_clip.y) + e[9]) / e[5]; _q.z = -1.0; _q.w = (1.0 + e[10]) / e[14];
    _clip.multiplyScalar(2.0 / _clip.dot(_q));
    e[2] = _clip.x; e[6] = _clip.y; e[10] = _clip.z + 1.0 - 0.003; e[14] = _clip.w;
    const was = hideInMirror.map(o=>o.visible); hideInMirror.forEach(o=>o.visible = false);
    const fog = scene.fog; if(fog && fog.density !== undefined){ refl.fogD = fog.density; fog.density *= 1.25; }
    R.setRenderTarget(P.refl); R.clear(); R.render(scene, vc);
    if(fog && refl.fogD !== undefined){ fog.density = refl.fogD; refl.fogD = undefined; }
    hideInMirror.forEach((o, i)=>o.visible = was[i]);
    return true;
  }
  /* THE WET MATERIAL. An ordinary MeshStandardMaterial — so it is lit by
     every lamp, fogged and shadowed like everything else — with the
     mirror added to its light where it is smooth: sharp in a puddle,
     blurred through the mip chain where it is only damp, and weighted by
     Fresnel, so the street reflects more the flatter you look along it. */
  const blank = new THREE.DataTexture(new Uint8Array([0,0,0,255]), 1, 1); blank.needsUpdate = true;
  const sharedRefl = { tRefl:{ value:blank }, uReflMatrix:{ value:refl.matrix } };
  function wet(mat, k){
    mat.userData.reflK = k===undefined ? 1 : k;
    const u = { uReflK:{ value:mat.userData.reflK } };
    mat.onBeforeCompile = sh=>{
      sh.uniforms.tRefl = sharedRefl.tRefl; sh.uniforms.uReflMatrix = sharedRefl.uReflMatrix; sh.uniforms.uReflK = u.uReflK;
      sh.vertexShader = 'uniform mat4 uReflMatrix;\nvarying vec4 vReflUv;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n vReflUv = uReflMatrix * modelMatrix * vec4( transformed, 1.0 );');
      sh.fragmentShader = 'uniform sampler2D tRefl;\nuniform float uReflK;\nvarying vec4 vReflUv;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        ` if(uReflK > 0.0){
            vec2 ruv = vReflUv.xy / vReflUv.w + normal.xy*0.035;
            float smoothness = clamp(1.0 - roughnessFactor, 0.0, 1.0);
            vec3 vdir = normalize(vViewPosition);
            float fres = 0.12 + 0.88*pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 4.0);
            vec3 mirror = textureLod(tRefl, ruv, roughnessFactor*7.0).rgb;
            outgoingLight += mirror * uReflK * fres * smoothness * smoothness * 1.6;
          }
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = ()=>'tshwet';
    mat.userData.reflU = u;
    wetMats.push(mat);
    return mat;
  }

  /* --------------------------------------------------------- quality
     2: mirror + bloom · 1: bloom · 0: the plain render. Measured, not
     guessed: the average frame over three seconds decides. It only ever
     steps down during a visit; a new visit starts at the top again. */
  /* The REAL time between frames, not the engine's dt: the loop clamps dt
     to a twentieth of a second, so a machine drawing four frames a second
     looks, through dt, like one drawing twenty. */
  let quality = 2, qT = 0, qN = 0, qSum = 0, slow = 0, pinned = null, lastNow = 0, warm = 0;
  function measure(){
    const now = performance.now(), dt = lastNow ? (now - lastNow)/1000 : 0; lastNow = now;
    if(pinned !== null || !dt || dt > 0.25 || document.hidden) return;   // a hidden tab or a loading hitch says nothing about the machine
    if(warm < 1.5){ warm += dt; return; }            // the first second is shader compiles
    qT += dt; qN++; qSum += dt;
    if(qT < 2.5) return;
    const avg = qSum/qN; qT = 0; qN = 0; qSum = 0;
    if(avg > 1/26 && quality > 0){ quality--; applyQuality(); }
  }
  function applyQuality(){
    wetMats.forEach(m=>{ m.userData.reflU.uReflK.value = quality >= 2 ? m.userData.reflK*fx.wet : 0; });
  }

  /* --------------------------------------------------------- the frame */
  /* verse (0 to 1): INTO THE SPIDER-VERSE, the way it is done in Blender's compositor — glow printed as halftone dots,
     the colour plates off register more with distance (the depth pass), a painted (Kuwahara) finish, a touch of lens.
     On for the whole story; a machine too slow for the cinema passes loses it with them */
  const fx = { verse:1, flash:0, flashCol:new V3(1,1,1), letter:0, fade:0, bloom:0.75, exposure:1.0, wet:1, comic:0, glitch:0, hue:0, ca:0, contrast:0.22,
                ao:0.85, dof:0, focus:5, aperture:0.45, streak:0.35, sat:1.12, sharp:0.35, split:1,
                gain:new V3(0.93, 1.03, 1.0), vig:0.55 };      // the night's grade: a little green in it; the morning's is warm
  /* how wet the street is, 0 to 1: a morning after the rain has stopped is only damp in the gutters */
  function setWet(k){ fx.wet = k; applyQuality(); }
  function render(scene, camera, dt){
    if(!R) return;
    measure();
    if(quality === 0 || !P){
      R.setRenderTarget(null); R.render(scene, camera); return;
    }
    const size = R.getDrawingBufferSize(new THREE.Vector2());
    if(size.x !== P.w || size.y !== P.h){ freeP(); build(); }
    P.t += dt||0.016;
    camera.updateMatrixWorld();
    // 1. the street's mirror — drawn with the wet surfaces reading a
    //    blank, so nothing samples the target it is being drawn into
    sharedRefl.tRefl.value = blank;
    if(quality >= 2) mirror(scene, camera);
    sharedRefl.tRefl.value = P.refl.texture;
    // 2. the city, in linear light, brighter than white where it is
    R.setRenderTarget(P.scene); R.clear(); R.render(scene, camera);
    // 3. bloom: down the chain with the threshold on the first step, then back up adding
    let src = P.scene.texture, sw = P.w, sh = P.h;
    P.down.uniforms.uFirst.value = 1;
    for(let i=0;i<LEVELS;i++){
      P.down.uniforms.tSrc.value = src; P.down.uniforms.uTexel.value.set(1/sw, 1/sh);
      pass(P.down, P.mips[i]);
      P.down.uniforms.uFirst.value = 0;
      src = P.mips[i].texture; sw = P.mips[i].width; sh = P.mips[i].height;
    }
    for(let i=LEVELS-1;i>0;i--){
      P.up.uniforms.tSrc.value = P.mips[i].texture; P.up.uniforms.uTexel.value.set(1/P.mips[i].width, 1/P.mips[i].height);
      R.autoClear = false; pass(P.up, P.mips[i-1]); R.autoClear = true;
    }
    // 3b. the cinema passes (only at full quality): contact shadows, the lens, the streak
    const cine = quality >= 2;
    if(cine && fx.ao > 0){ const a = P.ao.uniforms; a.uProj.value.copy(camera.projectionMatrix); a.uInvProj.value.copy(camera.projectionMatrixInverse); a.uNear.value = camera.near; a.uFar.value = camera.far; pass(P.ao, P.aoT); }
    if(cine && fx.dof > 0){ const u = P.dof.uniforms; u.tScene.value = P.scene.texture; u.uFocus.value = fx.focus; u.uAperture.value = fx.aperture; u.uNear.value = camera.near; u.uFar.value = camera.far; pass(P.dof, P.dofT); }
    if(cine && fx.streak > 0){ P.streak.uniforms.tSrc.value = P.mips[2].texture; pass(P.streak, P.streakT); }
    // 4. put it together, tone map it, grade it
    const c = P.comp.uniforms;
    c.uAO.value = cine ? fx.ao : 0; c.uDof.value = cine ? fx.dof : 0; c.uStreak.value = cine ? fx.streak : 0; c.uSat.value = fx.sat; c.uSharp.value = fx.sharp; c.uSplit.value = fx.split;
    c.tScene.value = P.scene.texture; c.tBloom.value = P.mips[0].texture;
    c.uBloom.value = fx.bloom; c.uTime.value = (P.t%10); c.uGain.value.copy(fx.gain); c.uVig.value = fx.vig;
    c.uFlash.value = fx.flash; c.uFlashCol.value.copy(fx.flashCol);
    c.uLetter.value = fx.letter; c.uFade.value = fx.fade;
    c.uComic.value = fx.comic; c.uRes.value.set(P.w, P.h);
    c.uVerse.value = cine ? (fx.verse || 0) : 0; c.uNear.value = camera.near; c.uFar.value = camera.far;
    c.uGlitch.value = fx.glitch || 0; c.uContrast.value = fx.contrast || 0; c.uHue.value = fx.hue || 0; c.uCA.value = 0.012 + (fx.ca || 0);
    pass(P.comp, null);
  }
  function init(renderer){
    R = renderer;
    quality = 2; pinned = null; slow = 0; qT = qN = qSum = 0; lastNow = 0; warm = 0;
    try{ build(); }catch(e){ console.warn('TSH post failed, plain render', e); quality = 0; }
    applyQuality();
  }
  function dispose(){
    freeP();
    made.splice(0).forEach(t=>t.dispose());
    wetMats.length = 0; hideInMirror.length = 0;
    R = null;
  }

  return { init, render, dispose, wet, setWet, hideInMirror, fx,
           asphalt, paving, plaster, shutter, windows, shopfront, vsign, hsign, neonText, neon, dragon,
           fashionAd, wfcSign, wfcMark, lanternTex, skyTex, glyphs, cv, tex, seeded, normalFrom,
           get quality(){ return quality; }, set quality(q){ pinned = q; quality = q; applyQuality(); },
           BRANDS };
})();
