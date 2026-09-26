/* =====================================================================
   THE CABINETS, PART THREE — the SHOOTERS floor and the PLATFORM floor.
   The kit (glow, particles, shake, backdrops) is cabgames2.js's.
   ===================================================================== */
(function(){
  const C = window.CABGAMES, K = C.EXTRA;
  const W = C.W, H = C.H, text = C.text, seeded = C.seeded;
  const { glow, sky, stars, Particles, Shake, hud, gameOver, clamp, hitRect } = K;
  const wrap = (v, m) => ((v % m) + m) % m;

  /* ====================================================== 2 SHOOTERS */

  /* ROCK BLASTER — turn, thrust, fire. Big rocks break into small ones and
     small ones into dust; everything wraps round the screen. */
  function rockBlaster(){
    let ship, rocks, shots, score, lives, dead, wave, keys, cool, fx, sh, rnd, inv, t;
    function rock(x, y, size){
      const a = rnd()*Math.PI*2, v = (30 + rnd()*30) * (4-size) * 0.6;
      const pts = Array.from({length:10}, (_,i)=>{ const ang=i/10*Math.PI*2; return [Math.cos(ang), Math.sin(ang), 0.7+rnd()*0.4]; });
      return { x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, size, r:size*8, spin:(rnd()-0.5)*2, rot:0, pts };
    }
    function spawn(){ rocks = []; for(let i=0;i<3+wave;i++){ const edge = rnd()<0.5; rocks.push(rock(edge ? 0 : rnd()*W, edge ? rnd()*H : 0, 3)); } }
    return {
      id:'rocks', keys:'← → turn · ↑ thrust · SPACE fire',
      start(seed){ rnd = seeded(seed); ship = { x:W/2, y:H/2, vx:0, vy:0, a:-Math.PI/2 }; shots = []; score = 0; lives = 3;
        dead = false; wave = 1; keys = {}; cool = 0; inv = 2; t = 0; fx = Particles(); sh = Shake(); spawn(); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt); sh.tick(dt); t += dt;
        if(dead) return;
        inv = Math.max(0, inv-dt); cool -= dt;
        ship.a += ((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*4*dt;
        if(keys.ArrowUp){ ship.vx += Math.cos(ship.a)*160*dt; ship.vy += Math.sin(ship.a)*160*dt;
          if(Math.random()<0.6) fx.burst(ship.x-Math.cos(ship.a)*6, ship.y-Math.sin(ship.a)*6, '#ff8a3d', 1, 30); }
        ship.vx *= 0.99; ship.vy *= 0.99;
        ship.x = wrap(ship.x+ship.vx*dt, W); ship.y = wrap(ship.y+ship.vy*dt, H);
        if(keys.Space && cool<=0){ cool = 0.18; shots.push({ x:ship.x+Math.cos(ship.a)*7, y:ship.y+Math.sin(ship.a)*7, vx:Math.cos(ship.a)*300+ship.vx, vy:Math.sin(ship.a)*300+ship.vy, life:0.9 }); }
        shots.forEach(s=>{ s.x = wrap(s.x+s.vx*dt, W); s.y = wrap(s.y+s.vy*dt, H); s.life -= dt; });
        shots = shots.filter(s=>s.life>0);
        rocks.forEach(r=>{ r.x = wrap(r.x+r.vx*dt, W); r.y = wrap(r.y+r.vy*dt, H); r.rot += r.spin*dt; });
        for(let i=rocks.length-1;i>=0;i--){
          const r = rocks[i];
          const hit = shots.findIndex(s=>Math.hypot(s.x-r.x, s.y-r.y) < r.r);
          if(hit>=0){ shots.splice(hit,1); rocks.splice(i,1); score += [0,100,50,20][r.size];
            fx.burst(r.x, r.y, '#c8c0ff', 14+r.size*4, 70); sh.hit(r.size);
            if(r.size>1){ rocks.push(rock(r.x, r.y, r.size-1), rock(r.x, r.y, r.size-1)); } continue; }
          if(!inv && Math.hypot(ship.x-r.x, ship.y-r.y) < r.r+4){
            lives--; sh.hit(8); fx.burst(ship.x, ship.y, '#27e8ff', 40, 110);
            ship = { x:W/2, y:H/2, vx:0, vy:0, a:-Math.PI/2 }; inv = 2.5; if(lives<=0) dead = true;
          }
        }
        if(!rocks.length){ wave++; score += 250; spawn(); inv = 1.5; }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#02030b', '#0a0520'); stars(x, null, 70, t, 2);
        x.lineWidth = 1.5;
        rocks.forEach(r=>{ x.save(); x.translate(r.x, r.y); x.rotate(r.rot);
          x.shadowColor = '#9f8cff'; x.shadowBlur = 8; x.strokeStyle = '#c8c0ff'; x.fillStyle = '#1a1438';
          x.beginPath(); r.pts.forEach((p,i)=>{ const px=p[0]*r.r*p[2], py=p[1]*r.r*p[2]; i ? x.lineTo(px,py) : x.moveTo(px,py); });
          x.closePath(); x.fill(); x.stroke(); x.restore(); });
        shots.forEach(s=>glow(x, '#ffe066', 8, ()=>x.fillRect(s.x-1, s.y-1, 3, 3)));
        if(!dead && (!inv || Math.floor(t*10)%2)){
          x.save(); x.translate(ship.x, ship.y); x.rotate(ship.a);
          x.shadowColor = '#27e8ff'; x.shadowBlur = 10; x.strokeStyle = '#8ff4ff'; x.fillStyle = '#0a2a3a';
          x.beginPath(); x.moveTo(9,0); x.lineTo(-6,-6); x.lineTo(-3,0); x.lineTo(-6,6); x.closePath(); x.fill(); x.stroke(); x.restore();
        }
        fx.draw(x);
        x.restore();
        hud(x, 'SCORE '+score, 'SHIPS '+lives+'  W'+wave);
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* SKY RAIDER — a side-scroller over a city at night. Waves fly in in
     formation and shoot back; a gunship every fifth wave. */
  function skyRaider(){
    let ship, foes, shots, bolts, score, lives, dead, keys, cool, fx, sh, rnd, t, wave, next, inv;
    const city = Array.from({length:40}, (_,i)=>({ x:i*14, h:20+((i*37)%50), w:12 }));
    function spawnWave(){
      wave++; const boss = wave%5===0;
      if(boss){ foes.push({ x:W+40, y:H/2, hp:30+wave*3, max:30+wave*3, boss:true, t:0, w:40, h:26, cool:1 }); return; }
      const pattern = wave%3, n = 5 + Math.min(5, wave);
      for(let i=0;i<n;i++) foes.push({ x:W+20+i*22, y:40+ (pattern===0 ? i*14 : pattern===1 ? 60+Math.sin(i)*40 : (i%2?60:150)), hp:1+(wave>6?1:0),
        t:i*0.3, kind:pattern, w:14, h:10, cool:1+rnd()*2 });
    }
    return {
      id:'raider', keys:'arrows fly · SPACE fire',
      start(seed){ rnd = seeded(seed); ship = { x:40, y:H/2 }; foes = []; shots = []; bolts = []; score = 0; lives = 3; dead = false;
        keys = {}; cool = 0; t = 0; wave = 0; next = 1; inv = 2; fx = Particles(); sh = Shake(); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt); sh.tick(dt); t += dt;
        if(dead) return;
        inv = Math.max(0, inv-dt); cool -= dt;
        ship.x = clamp(ship.x + ((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*140*dt, 8, W-20);
        ship.y = clamp(ship.y + ((keys.ArrowDown?1:0)-(keys.ArrowUp?1:0))*140*dt, 20, H-30);
        if(keys.Space && cool<=0){ cool = 0.14; shots.push({ x:ship.x+14, y:ship.y }); if(wave>3) shots.push({ x:ship.x+10, y:ship.y+4, vy:40 }); }
        shots.forEach(s=>{ s.x += 360*dt; s.y += (s.vy||0)*dt; }); shots = shots.filter(s=>s.x<W+10);
        if(!foes.length){ next -= dt; if(next<=0){ spawnWave(); next = 1.2; } }
        foes.forEach(f=>{
          f.t += dt; f.cool -= dt;
          if(f.boss){ f.x = Math.max(W-60, f.x-40*dt); f.y = H/2 + Math.sin(f.t*0.9)*60;
            if(f.cool<=0){ f.cool = 0.8; for(let k=-2;k<=2;k++) bolts.push({ x:f.x-20, y:f.y, vx:-120, vy:k*35 }); } }
          else { f.x -= (70+wave*4)*dt; f.y += Math.sin(f.t*3)*(f.kind===1?60:20)*dt;
            if(f.cool<=0 && f.x<W-10){ f.cool = 2+rnd()*2; const a=Math.atan2(ship.y-f.y, ship.x-f.x); bolts.push({ x:f.x, y:f.y, vx:Math.cos(a)*110, vy:Math.sin(a)*110 }); } }
        });
        bolts.forEach(b=>{ b.x += b.vx*dt; b.y += b.vy*dt; }); bolts = bolts.filter(b=>b.x>-10 && b.x<W+10 && b.y>-10 && b.y<H+10);
        for(let i=foes.length-1;i>=0;i--){
          const f = foes[i], box = { x:f.x-f.w/2, y:f.y-f.h/2, w:f.w, h:f.h };
          for(let j=shots.length-1;j>=0;j--) if(hitRect({ x:shots[j].x, y:shots[j].y-1, w:6, h:2 }, box)){
            shots.splice(j,1); f.hp--; fx.burst(f.x-f.w/2, shots[j]?shots[j].y:f.y, '#ffe066', 3, 40);
            if(f.hp<=0){ foes.splice(i,1); score += f.boss ? 1000 : 25; fx.burst(f.x, f.y, f.boss?'#ff3fd0':'#ff8a3d', f.boss?60:16, f.boss?140:80); sh.hit(f.boss?10:2); break; }
          }
          if(foes[i]===f && f.x < -30) foes.splice(i,1);
        }
        const me = { x:ship.x-6, y:ship.y-4, w:14, h:8 };
        if(!inv && (bolts.some(b=>hitRect({ x:b.x-2, y:b.y-2, w:4, h:4 }, me)) || foes.some(f=>hitRect({ x:f.x-f.w/2, y:f.y-f.h/2, w:f.w, h:f.h }, me)))){
          lives--; inv = 2.5; sh.hit(8); fx.burst(ship.x, ship.y, '#27e8ff', 40, 110); bolts = []; if(lives<=0) dead = true;
        }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#0a0428', '#3a0d4a');
        glow(x, '#ff6ad5', 30, ()=>{ x.beginPath(); x.arc(250, 150, 34, 0, 7); x.fill(); });
        stars(x, null, 40, t, 6);
        for(let layer=0;layer<2;layer++){
          const sp = layer ? 50 : 20, col = layer ? '#12081f' : '#200d33';
          city.forEach(b=>{ const bx = wrap(b.x - t*sp, 560) - 20, bh = b.h*(layer?1.2:0.8);
            x.fillStyle = col; x.fillRect(bx, H-bh, b.w, bh);
            if(layer) for(let wy=H-bh+4; wy<H-4; wy+=6) if((b.x+wy)%3) { x.fillStyle = (b.x+wy)%5 ? '#ffcf5a33' : '#27e8ff55'; x.fillRect(bx+3, wy, 2, 2); x.fillRect(bx+7, wy, 2, 2); } });
        }
        shots.forEach(s=>glow(x, '#ffe066', 6, ()=>x.fillRect(s.x, s.y-1, 7, 2)));
        bolts.forEach(b=>glow(x, '#ff4d6d', 8, ()=>{ x.beginPath(); x.arc(b.x, b.y, 2.5, 0, 7); x.fill(); }));
        foes.forEach(f=>{
          if(f.boss){ glow(x, '#ff3fd0', 14, ()=>{ x.fillRect(f.x-20, f.y-8, 40, 16); x.fillRect(f.x-8, f.y-14, 24, 28); });
            x.fillStyle='#200d33'; x.fillRect(f.x-14, f.y-3, 30, 6); x.fillStyle='#ff4d6d'; x.fillRect(f.x-22, f.y-2, 4, 4);
            x.fillStyle='#300'; x.fillRect(W/2-60, H-12, 120, 4); x.fillStyle='#ff3fd0'; x.fillRect(W/2-60, H-12, 120*f.hp/f.max, 4); }
          else glow(x, '#ff8a3d', 8, ()=>{ x.beginPath(); x.moveTo(f.x-7, f.y); x.lineTo(f.x+7, f.y-5); x.lineTo(f.x+4, f.y); x.lineTo(f.x+7, f.y+5); x.fill(); });
        });
        if(!dead && (!inv || Math.floor(t*10)%2)){
          glow(x, '#27e8ff', 10, ()=>{ x.beginPath(); x.moveTo(ship.x+10, ship.y); x.lineTo(ship.x-8, ship.y-6); x.lineTo(ship.x-4, ship.y); x.lineTo(ship.x-8, ship.y+6); x.fill(); });
          glow(x, '#ff8a3d', 8, ()=>x.fillRect(ship.x-11-Math.random()*4, ship.y-1, 4, 2));
        }
        fx.draw(x);
        x.restore();
        hud(x, 'SCORE '+score, 'SHIPS '+lives+'  W'+wave);
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* CITY SHIELD — missiles rain on six cities; steer the sight and SPACE
     to set off a blast where it is. A blast catches anything that flies
     into it, so leading them is the whole skill. */
  function cityShield(){
    let cities, missiles, blasts, aim, keys, score, dead, wave, left, spawnT, ammo, fx, sh, rnd, t, between;
    function startWave(){ wave++; left = 8 + wave*3; ammo = left + 6; spawnT = 0.5; between = 0; }
    return {
      id:'shield', keys:'arrows aim · SPACE detonate',
      start(seed){ rnd = seeded(seed); cities = [30,70,110,210,250,290].map(x=>({ x, alive:true }));
        missiles = []; blasts = []; aim = { x:W/2, y:H/2 }; keys = {}; score = 0; dead = false; wave = 0; t = 0;
        fx = Particles(); sh = Shake(); startWave(); },
      key(c, d){ keys[c] = d;
        if(c==='Space' && d && !dead && ammo>0){ ammo--; blasts.push({ x:aim.x, y:aim.y, r:0, t:0, fromY:H-14, fromX:W/2, travel:0.25 }); } },
      tick(dt){
        fx.tick(dt, 30); sh.tick(dt); t += dt;
        if(dead) return;
        aim.x = clamp(aim.x + ((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*220*dt, 4, W-4);
        aim.y = clamp(aim.y + ((keys.ArrowDown?1:0)-(keys.ArrowUp?1:0))*220*dt, 10, H-40);
        spawnT -= dt;
        if(left>0 && spawnT<=0){ left--; spawnT = Math.max(0.35, 1.4 - wave*0.1)*(0.5+rnd());
          const alive = cities.filter(c=>c.alive); const tgt = alive.length ? alive[(rnd()*alive.length)|0] : { x:W/2 };
          const sx = rnd()*W, sp = 22 + wave*5 + rnd()*10, a = Math.atan2(H-16, tgt.x-sx);
          missiles.push({ sx, sy:0, x:sx, y:0, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, split: wave>2 && rnd()<0.2 }); }
        missiles.forEach(m=>{ m.x += m.vx*dt; m.y += m.vy*dt;
          if(m.split && m.y > 70){ m.split = false; for(const k of [-25,25]) missiles.push({ sx:m.x, sy:m.y, x:m.x, y:m.y, vx:m.vx+k, vy:m.vy, split:false }); } });
        blasts.forEach(b=>{ b.t += dt; if(b.t > b.travel){ const k = b.t - b.travel; b.r = k<0.6 ? k/0.6*22 : Math.max(0, 22 - (k-0.6)/0.5*22); } });
        blasts = blasts.filter(b=> b.t < b.travel + 1.1);
        for(let i=missiles.length-1;i>=0;i--){
          const m = missiles[i];
          if(blasts.some(b=>b.r>0 && Math.hypot(m.x-b.x, m.y-b.y) < b.r)){ missiles.splice(i,1); score += 25*wave; fx.burst(m.x, m.y, '#ffd23d', 10, 50); continue; }
          if(m.y >= H-16){ missiles.splice(i,1); sh.hit(7); fx.burst(m.x, H-16, '#ff4d6d', 30, 90);
            cities.forEach(c=>{ if(c.alive && Math.abs(c.x-m.x) < 14){ c.alive = false; } }); }
        }
        if(!cities.some(c=>c.alive)) dead = true;
        if(left<=0 && !missiles.length){ between += dt; if(between > 1.5){ score += cities.filter(c=>c.alive).length*100 + ammo*5; startWave(); } }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#050a24', '#241040'); stars(x, null, 50, 0, 0);
        x.fillStyle = '#1a1030'; x.fillRect(0, H-14, W, 14);
        glow(x, '#8a5cff', 6, ()=>{ x.beginPath(); x.moveTo(W/2-14, H-14); x.lineTo(W/2, H-26); x.lineTo(W/2+14, H-14); x.fill(); });
        cities.forEach(c=>{ if(!c.alive){ x.fillStyle='#3a2030'; x.fillRect(c.x-10, H-17, 20, 3); return; }
          glow(x, '#27e8ff', 6, ()=>{ x.fillRect(c.x-10, H-22, 5, 8); x.fillRect(c.x-4, H-28, 6, 14); x.fillRect(c.x+3, H-24, 6, 10); }); });
        x.lineWidth = 1;
        missiles.forEach(m=>{ const g = x.createLinearGradient(m.sx, m.sy, m.x, m.y); g.addColorStop(0, 'rgba(255,77,109,0)'); g.addColorStop(1, '#ff4d6d');
          x.strokeStyle = g; x.beginPath(); x.moveTo(m.sx, m.sy); x.lineTo(m.x, m.y); x.stroke();
          glow(x, '#fff', 6, ()=>x.fillRect(m.x-1, m.y-1, 2, 2)); });
        blasts.forEach(b=>{
          if(b.t <= b.travel){ const k = b.t/b.travel; x.strokeStyle = '#8fd3ff'; x.beginPath(); x.moveTo(W/2, H-26); x.lineTo(W/2+(b.x-W/2)*k, H-26+(b.y-H+26)*k); x.stroke(); }
          else { const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r+1); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ffd23d'); g.addColorStop(1, 'rgba(255,63,208,0)');
            x.fillStyle = g; x.beginPath(); x.arc(b.x, b.y, b.r+1, 0, 7); x.fill(); } });
        x.strokeStyle = '#3ddc84'; x.beginPath(); x.moveTo(aim.x-6, aim.y); x.lineTo(aim.x+6, aim.y); x.moveTo(aim.x, aim.y-6); x.lineTo(aim.x, aim.y+6); x.stroke();
        fx.draw(x);
        x.restore();
        hud(x, 'SCORE '+score, 'AMMO '+ammo+'  W'+wave);
        if(between>0 && !dead) text(x, 'WAVE '+(wave+1), W/2, H/2-10, 2, '#ffd23d', 0.5);
        if(dead) gameOver(x, score, 'THE END');
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* ====================================================== 3 PLATFORM */

  /* PIXEL PEAKS — one screen at a time: coins, spikes, a moving platform
     or two, and a flag. Every level is built from the seed, so the next
     one is always new. */
  function pixelPeaks(){
    let me, plats, coins, spikes, flag, keys, score, lives, dead, level, fx, sh, rnd, t, got, onGround, jumpHeld;
    function build(){
      plats = [{ x:0, y:H-16, w:W, h:16, ground:true }]; coins = []; spikes = [];
      let px = 10, py = H-16;
      const n = 7 + Math.min(4, level);
      for(let i=0;i<n;i++){
        const w = 30 + rnd()*30, nx = clamp(px + (rnd()*80 - 20), 10, W-w-10), ny = clamp(py - 22 - rnd()*14, 40, H-40);
        const mover = level>1 && rnd()<0.25;
        plats.push({ x:nx, y:ny, w, h:6, mover, ox:nx, ph:rnd()*6 });
        if(rnd()<0.8) coins.push({ x:nx+w/2, y:ny-10, got:false });
        px = nx; py = ny;
      }
      for(let i=0;i<3+level;i++){ const sx = 60 + rnd()*(W-90); spikes.push({ x:sx, y:H-22, w:12 }); }
      const top = plats[plats.length-1]; flag = { x:top.x+top.w-8, y:top.y-20 };
      me = { x:12, y:H-30, vx:0, vy:0, w:8, h:12, face:1 };
    }
    return {
      id:'peaks', keys:'← → run · SPACE / ↑ jump',
      start(seed){ rnd = seeded(seed); keys = {}; score = 0; lives = 3; dead = false; level = 1; t = 0; got = 0; fx = Particles(); sh = Shake(); build(); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt, 200); sh.tick(dt); t += dt;
        if(dead) return;
        plats.forEach(p=>{ if(p.mover){ const was = p.x; p.x = p.ox + Math.sin(t*1.4+p.ph)*30; p.dx = p.x-was; } else p.dx = 0; });
        const dir = (keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
        if(dir) me.face = dir;
        me.vx += (dir*120 - me.vx)*Math.min(1, dt*12);
        const jump = keys.Space || keys.ArrowUp;
        if(jump && onGround && !jumpHeld){ me.vy = -210; onGround = false; fx.burst(me.x+4, me.y+12, '#fff', 5, 30); }
        jumpHeld = jump;
        me.vy += (jump && me.vy<0 ? 420 : 700)*dt;
        me.x = clamp(me.x + me.vx*dt, 0, W-me.w);
        const wasBottom = me.y + me.h;
        me.y += me.vy*dt;
        onGround = false;
        plats.forEach(p=>{
          if(me.vy>=0 && me.x+me.w>p.x && me.x<p.x+p.w && wasBottom<=p.y+2 && me.y+me.h>=p.y){
            me.y = p.y-me.h; me.vy = 0; onGround = true; me.x += p.dx||0; }
        });
        coins.forEach(c=>{ if(!c.got && Math.abs(me.x+4-c.x)<8 && Math.abs(me.y+6-c.y)<9){ c.got = true; score += 10; fx.burst(c.x, c.y, '#ffd23d', 10, 50); } });
        const hurt = spikes.some(s=> me.x+me.w>s.x+2 && me.x<s.x+s.w-2 && me.y+me.h>s.y+2) || me.y > H+20;
        if(hurt){ lives--; sh.hit(6); fx.burst(me.x+4, me.y+6, '#ff4d6d', 24, 90); if(lives<=0) dead = true; else { me.x = 12; me.y = H-30; me.vy = 0; } }
        if(Math.abs(me.x+4-flag.x) < 10 && Math.abs(me.y-flag.y) < 20){ score += 100*level; level++; fx.burst(flag.x, flag.y, '#3ddc84', 40, 100); build(); }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#1a3b8f', '#f39ac8');
        for(let i=0;i<5;i++){ x.fillStyle = 'rgba(255,255,255,.25)'; const cx = wrap(i*80 + t*6*(i%2+1), W+60)-30; x.beginPath(); x.ellipse(cx, 30+i*14, 24, 7, 0, 0, 7); x.fill(); }
        x.fillStyle = '#6b5bb8'; x.beginPath(); x.moveTo(0,H); for(let i=0;i<=8;i++) x.lineTo(i*40, H-60-((i*53)%40)); x.lineTo(W,H); x.fill();
        plats.forEach(p=>{
          if(p.ground){ x.fillStyle = '#3b2a4a'; x.fillRect(p.x, p.y, p.w, p.h); x.fillStyle = '#3ddc84'; x.fillRect(p.x, p.y, p.w, 3); return; }
          glow(x, p.mover ? '#27e8ff' : '#c86bff', 6, ()=>x.fillRect(p.x, p.y, p.w, p.h));
          x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(p.x, p.y, p.w, 1); });
        spikes.forEach(s=>{ x.fillStyle = '#ff4d6d'; for(let k=0;k<3;k++){ x.beginPath(); x.moveTo(s.x+k*4, s.y+6); x.lineTo(s.x+k*4+2, s.y); x.lineTo(s.x+k*4+4, s.y+6); x.fill(); } });
        coins.forEach(c=>{ if(c.got) return; const sq = Math.abs(Math.cos(t*4+c.x)); glow(x, '#ffd23d', 8, ()=>{ x.beginPath(); x.ellipse(c.x, c.y, 3*sq+0.5, 4, 0, 0, 7); x.fill(); }); });
        x.fillStyle = '#ddd'; x.fillRect(flag.x, flag.y, 2, 20);
        glow(x, '#3ddc84', 8, ()=>{ x.beginPath(); x.moveTo(flag.x+2, flag.y); x.lineTo(flag.x+14, flag.y+4+Math.sin(t*6)); x.lineTo(flag.x+2, flag.y+8); x.fill(); });
        // the hero: a little robot with a visor
        const bob = onGround && Math.abs(me.vx)>10 ? Math.abs(Math.sin(t*16)) : 0;
        glow(x, '#ffb86b', 6, ()=>x.fillRect(me.x, me.y-bob, me.w, me.h-2));
        x.fillStyle = '#27e8ff'; x.fillRect(me.face>0 ? me.x+3 : me.x+1, me.y+2-bob, 4, 3);
        x.fillStyle = '#5a3a2a'; x.fillRect(me.x+1, me.y+me.h-2, 2, 2); x.fillRect(me.x+me.w-3, me.y+me.h-2, 2, 2);
        fx.draw(x);
        x.restore();
        hud(x, 'SCORE '+score, 'LIVES '+lives+'  L'+level);
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* NEON DASH — you run, the world comes at you faster and faster: jump
     the gaps and the barriers, duck the drones (↓). */
  function neonDash(){
    let me, obs, score, dead, speed, keys, fx, sh, rnd, t, spawnD, dist, jumpHeld;
    const GROUND = H-40;
    return {
      id:'dash', keys:'SPACE / ↑ jump · ↓ slide',
      start(seed){ rnd = seeded(seed); me = { x:50, y:GROUND, vy:0, slide:0 }; obs = []; score = 0; dead = false; speed = 150;
        keys = {}; t = 0; spawnD = 200; dist = 0; fx = Particles(); sh = Shake(); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt, 200); sh.tick(dt); t += dt;
        if(dead) return;
        speed = Math.min(420, speed + dt*6); dist += speed*dt; score = Math.floor(dist/10);
        const jump = keys.Space || keys.ArrowUp, grounded = me.y >= GROUND;
        if(jump && grounded && !jumpHeld){ me.vy = -300; fx.burst(me.x, GROUND+12, '#27e8ff', 6, 40); }
        jumpHeld = jump;
        me.slide = keys.ArrowDown && grounded;
        me.vy += (jump && me.vy<0 ? 700 : 1100)*dt; me.y = Math.min(GROUND, me.y + me.vy*dt); if(me.y>=GROUND) me.vy = 0;
        spawnD -= speed*dt;
        if(spawnD<=0){ const r = rnd(); spawnD = 140 + rnd()*160;
          obs.push(r<0.4 ? { kind:'gap', x:W+10, w:30+rnd()*25 } : r<0.75 ? { kind:'wall', x:W+10, w:10, h:14+rnd()*14 } : { kind:'drone', x:W+10, w:16, y:GROUND-20 }); }
        obs.forEach(o=>o.x -= speed*dt); obs = obs.filter(o=>o.x+o.w > -20);
        const bw = 10, bh = me.slide ? 8 : 16, box = { x:me.x-bw/2, y:me.y+12-bh, w:bw, h:bh };
        for(const o of obs){
          if(o.kind==='gap' && me.y>=GROUND && me.x>o.x+3 && me.x<o.x+o.w-3){ me.vy = 0; me.y += 1; dead = true; }
          if(o.kind==='wall' && hitRect(box, { x:o.x, y:GROUND+12-o.h, w:o.w, h:o.h })) dead = true;
          if(o.kind==='drone' && hitRect(box, { x:o.x, y:o.y, w:o.w, h:8 })) dead = true;
        }
        if(dead){ sh.hit(8); fx.burst(me.x, me.y, '#ff3fd0', 40, 120); }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#12002a', '#3d0a52');
        glow(x, '#ff6a3d', 30, ()=>{ x.beginPath(); x.arc(W/2, GROUND-10, 50, Math.PI, 0); x.fill(); });
        x.fillStyle = '#12002a'; for(let i=0;i<6;i++) x.fillRect(W/2-50, GROUND-20+i*5-50+40, 100, 2);
        // the synthwave floor
        x.fillStyle = '#0a0018'; x.fillRect(0, GROUND+12, W, H);
        x.strokeStyle = '#ff3fd0'; x.lineWidth = 1;
        for(let i=0;i<8;i++){ const y = GROUND+12 + Math.pow((i + (t*speed/80)%1)/8, 2)*(H-GROUND-12); x.globalAlpha = 0.5; x.beginPath(); x.moveTo(0,y); x.lineTo(W,y); x.stroke(); }
        for(let i=-8;i<=8;i++){ x.beginPath(); x.moveTo(W/2+i*20, GROUND+12); x.lineTo(W/2+i*80, H); x.stroke(); }
        x.globalAlpha = 1;
        glow(x, '#27e8ff', 8, ()=>x.fillRect(0, GROUND+11, W, 2));
        obs.forEach(o=>{
          if(o.kind==='gap'){ x.fillStyle = '#000'; x.fillRect(o.x, GROUND+10, o.w, H); }
          if(o.kind==='wall') glow(x, '#ffd23d', 10, ()=>x.fillRect(o.x, GROUND+12-o.h, o.w, o.h));
          if(o.kind==='drone'){ glow(x, '#ff4d6d', 10, ()=>x.fillRect(o.x, o.y, o.w, 6)); x.fillStyle = '#fff'; x.fillRect(o.x+(t*40%o.w), o.y-2, 3, 1); }
        });
        const legs = Math.sin(t*24)*3;
        x.save(); x.translate(me.x, me.y);
        if(me.slide) glow(x, '#27e8ff', 10, ()=>x.fillRect(-7, 4, 14, 8));
        else { glow(x, '#27e8ff', 10, ()=>{ x.fillRect(-4, -4, 8, 10); x.fillRect(-3, -9, 6, 5); });
          x.fillStyle = '#8ff4ff'; x.fillRect(-4+legs, 6, 3, 6); x.fillRect(1-legs, 6, 3, 6); }
        x.restore();
        fx.draw(x);
        x.restore();
        hud(x, 'DISTANCE '+score, 'SPEED '+Math.round(speed/10));
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* SKY CLIMB — bounce up forever. Blue pads spring, pink ones crumble,
     gold ones fling you; the camera only goes up, so falling off the
     bottom is the end. */
  function skyClimb(){
    let me, pads, camY, top, score, dead, keys, fx, sh, rnd, t;
    function add(y){ const r = rnd(), kind = r<0.12 && top<-400 ? 'crumble' : r<0.2 ? 'spring' : r<0.3 && top<-800 ? 'move' : 'plain';
      pads.push({ x:10+rnd()*(W-50), y, w:34, kind, gone:false, ph:rnd()*6 }); }
    return {
      id:'climb', keys:'← → steer · bounce up',
      start(seed){ rnd = seeded(seed); me = { x:W/2, y:H-40, vx:0, vy:-300 }; pads = []; camY = 0; top = H; score = 0; dead = false;
        keys = {}; t = 0; fx = Particles(); sh = Shake();
        for(let y=H-20; y>-H; y-=34){ add(y); top = y; } pads[0].x = W/2-17; },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt, 150); sh.tick(dt); t += dt;
        if(dead) return;
        const dir = (keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
        me.vx += (dir*170 - me.vx)*Math.min(1, dt*8);
        me.x = wrap(me.x + me.vx*dt, W);
        const was = me.y; me.vy += 520*dt; me.y += me.vy*dt;
        pads.forEach(p=>{
          if(p.kind==='move') p.x = clamp(p.x + Math.sin(t*1.5+p.ph)*50*dt, 0, W-p.w);
          if(!p.gone && me.vy>0 && me.x>p.x-4 && me.x<p.x+p.w+4 && was<=p.y && me.y>=p.y){
            if(p.kind==='crumble'){ p.gone = true; fx.burst(me.x, p.y, '#ff6ad5', 12, 50); }
            me.vy = p.kind==='spring' ? -560 : -330; fx.burst(me.x, p.y, p.kind==='spring' ? '#ffd23d' : '#8fd3ff', 6, 40);
            if(p.kind==='spring') sh.hit(2);
          }
        });
        if(me.y - camY < H*0.4) camY = me.y - H*0.4;
        score = Math.max(score, Math.floor((H-40-me.y)/10));
        while(top > camY - 40){ top -= 30 + rnd()*14 + Math.min(20, -camY/400); add(top); }
        pads = pads.filter(p=>p.y < camY + H + 20);
        if(me.y > camY + H + 10){ dead = true; sh.hit(6); }
      },
      draw(x){
        x.save(); sh.apply(x);
        const h = clamp(-camY/4000, 0, 1);
        sky(x, h>0.5 ? '#02030b' : '#1a2a6a', h>0.5 ? '#1a0b3a' : '#f39ac8');
        stars(x, null, Math.floor(60*h), -camY*0.05, 0);
        for(let i=0;i<6;i++){ const cy = wrap(i*60 - camY*0.3, H+40)-20; x.fillStyle = 'rgba(255,255,255,.15)'; x.beginPath(); x.ellipse((i*97)%W, cy, 40, 10, 0, 0, 7); x.fill(); }
        x.save(); x.translate(0, -camY);
        pads.forEach(p=>{ if(p.gone) return;
          const col = { plain:'#27e8ff', spring:'#ffd23d', crumble:'#ff6ad5', move:'#3ddc84' }[p.kind];
          glow(x, col, 8, ()=>x.fillRect(p.x, p.y, p.w, 5));
          if(p.kind==='spring'){ x.fillStyle='#fff'; x.fillRect(p.x+p.w/2-3, p.y-4, 6, 4); }
          if(p.kind==='crumble'){ x.fillStyle='rgba(0,0,0,.4)'; x.fillRect(p.x+10, p.y, 2, 5); x.fillRect(p.x+22, p.y, 2, 5); } });
        const squash = me.vy<0 ? 1.15 : 0.95;
        glow(x, '#ffb86b', 10, ()=>{ x.beginPath(); x.ellipse(me.x, me.y-6, 6/squash, 7*squash, 0, 0, 7); x.fill(); });
        x.fillStyle = '#2a1a4a'; x.fillRect(me.x-3+(me.vx>0?1:-1), me.y-9, 2, 2); x.fillRect(me.x+1+(me.vx>0?1:-1), me.y-9, 2, 2);
        fx.draw(x);
        x.restore();
        x.restore();
        hud(x, 'HEIGHT '+score);
        if(dead) gameOver(x, score, 'YOU FELL');
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  C.add([
    { id:'rocks', name:'ROCK BLASTER', players:1, genre:'shooters', a:'#c8c0ff',
      blurb:'Big rocks, small rocks, dust. Everything wraps.', make:rockBlaster, pay:g=>Math.floor(g.score/150) },
    { id:'raider', name:'SKY RAIDER', players:1, genre:'shooters', a:'#ff8a3d',
      blurb:'A city at night, waves in formation, a gunship every fifth.', make:skyRaider, pay:g=>Math.floor(g.score/120) },
    { id:'shield', name:'CITY SHIELD', players:1, genre:'shooters', a:'#8a5cff',
      blurb:'Six cities. Lead the missiles into your blasts.', make:cityShield, pay:g=>Math.floor(g.score/250) },
    { id:'peaks', name:'PIXEL PEAKS', players:1, genre:'platform', a:'#c86bff',
      blurb:'Coins, spikes, a flag, and a new mountain every level.', make:pixelPeaks, pay:g=>Math.floor(g.score/50) },
    { id:'dash', name:'NEON DASH', players:1, genre:'platform', a:'#27e8ff',
      blurb:'Run. Jump the gaps, slide the drones. Faster.', make:neonDash, pay:g=>Math.floor(g.score/60) },
    { id:'climb', name:'SKY CLIMB', players:1, genre:'platform', a:'#ffd23d',
      blurb:'Bounce up for ever. Do not look down.', make:skyClimb, pay:g=>Math.floor(g.score/40) }
  ]);
})();
