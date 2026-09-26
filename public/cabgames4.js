/* =====================================================================
   THE CABINETS, PART FOUR — the FIGHTING floor and the RACING floor.
   Every fighter here is against the machine, which reads you: it blocks
   more when you attack a lot and comes in when you turtle.
   ===================================================================== */
(function(){
  const C = window.CABGAMES, K = C.EXTRA;
  const W = C.W, H = C.H, text = C.text, seeded = C.seeded;
  const { glow, sky, stars, Particles, Shake, hud, gameOver, clamp } = K;

  function banner(x, big, small, col){
    x.fillStyle = 'rgba(5,6,15,.78)'; x.fillRect(0, H/2-30, W, 54);
    glow(x, col||'#ffd23d', 12, ()=>text(x, big, W/2, H/2-22, 3, col||'#ffd23d', 0.5));
    if(small) text(x, small, W/2, H/2+8, 1, '#fff', 0.5);
  }

  /* ====================================================== 4 FIGHTING */

  /* DOJO FIGHTER — best of three rounds against KAGE. Punch is quick and
     short, kick is slow and long, ↓ blocks, ↑ jumps over a kick. */
  function dojoFighter(){
    const FLOOR = H-44;
    let P, E, keys, round, wins, lost, over_, score, pause, msg, fx, sh, rnd, t, won;
    function fighter(x, face, col){ return { x, y:FLOOR, vy:0, face, hp:100, act:null, at:0, block:false, col, stun:0, hit:false }; }
    function newRound(){ P = fighter(90, 1, '#27e8ff'); E = fighter(230, -1, '#ff4d6d'); pause = 1.4; msg = 'ROUND '+round; }
    const MOVES = { punch:{ time:0.28, hitAt:0.1, reach:30, dmg:7 }, kick:{ time:0.5, hitAt:0.25, reach:44, dmg:12 } };
    function attack(f, kind){ if(f.act || f.stun>0) return; f.act = kind; f.at = 0; f.hit = false; }
    function resolve(a, b){
      if(!a.act) return;
      const m = MOVES[a.act]; a.at += 0; if(a.hit || a.at < m.hitAt) return;
      a.hit = true;
      const dist = Math.abs(a.x-b.x), facing = Math.sign(b.x-a.x) === a.face;
      if(!facing || dist > m.reach) return;
      if(a.act==='kick' && b.y < FLOOR-12) return;             // jumped it
      if(b.block){ b.hp -= 1; fx.burst(b.x - b.face*6, FLOOR-28, '#8fd3ff', 6, 40); b.x += a.face*6; return; }
      b.hp -= m.dmg; b.stun = 0.25; b.x += a.face*(a.act==='kick'?16:8);
      fx.burst(b.x - b.face*4, FLOOR-(a.act==='kick'?20:32), '#ffd23d', 14, 80); sh.hit(a.act==='kick'?6:3);
      if(a===P) score += m.dmg*10;
    }
    function drive(f, dt, dir, wantBlock, wantJump){
      f.stun = Math.max(0, f.stun-dt);
      f.block = wantBlock && !f.act && f.y>=FLOOR;
      if(!f.block && !f.stun && (!f.act || f.y<FLOOR)) f.x += dir*90*dt;
      if(wantJump && f.y>=FLOOR && !f.act){ f.vy = -260; }
      f.vy += 800*dt; f.y = Math.min(FLOOR, f.y+f.vy*dt);
      if(f.act){ f.at += dt; if(f.at > MOVES[f.act].time) f.act = null; }
      f.x = clamp(f.x, 16, W-16);
    }
    let brain = 0, plan = 'close', pressure = 0;
    return {
      id:'fighter', keys:'← → move · ↑ jump · ↓ block · SPACE punch · Z kick',
      start(seed){ rnd = seeded(seed); keys = {}; round = 1; wins = 0; lost = 0; over_ = false; score = 0; t = 0; won = false;
        fx = Particles(); sh = Shake(); newRound(); },
      key(c, d){ keys[c] = d;
        if(d && !pause && !over_){ if(c==='Space') attack(P, 'punch'); if(c==='KeyZ' || c==='KeyX') attack(P, 'kick'); if(P.act) pressure += 1; } },
      tick(dt){
        fx.tick(dt, 200); sh.tick(dt); t += dt;
        if(over_) return;
        if(pause>0){ pause -= dt; if(pause<=0) msg = ''; return; }
        pressure = Math.max(0, pressure - dt*0.8);
        P.face = Math.sign(E.x-P.x)||1; E.face = -P.face;
        drive(P, dt, (keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0), keys.ArrowDown, keys.ArrowUp);
        // KAGE
        brain -= dt;
        const dist = Math.abs(E.x-P.x);
        if(brain<=0){ brain = 0.25 + rnd()*0.35;
          plan = pressure>2.5 && rnd()<0.6 ? 'block' : dist>50 ? 'close' : rnd()<0.2 ? 'back' : 'fight'; }
        const toward = Math.sign(P.x-E.x);
        const eDir = plan==='close' ? toward : plan==='back' ? -toward : 0;
        drive(E, dt, eDir, plan==='block' && P.act, P.act==='kick' && dist<40 && rnd()<0.02+round*0.01);
        if(plan==='fight' && !E.act && rnd()<dt*(2+round)) attack(E, dist<32 ? 'punch' : 'kick');
        resolve(P, E); resolve(E, P);
        if(Math.abs(P.x-E.x) < 14){ const push = (14-Math.abs(P.x-E.x))/2*Math.sign(P.x-E.x||1); P.x += push; E.x -= push; }
        if(P.hp<=0 || E.hp<=0){
          if(E.hp<=0){ wins++; score += 500 + Math.max(0,P.hp)*5; msg = 'YOU WIN THE ROUND'; }
          else { lost++; msg = 'KAGE WINS THE ROUND'; }
          if(wins===2 || lost===2){ over_ = true; won = wins===2; if(won) score += 1000; msg = won ? 'VICTORY' : 'DEFEAT'; }
          else { round++; setTimeout(()=>{}, 0); pause = 2.2; const m = msg; newRound(); msg = m; }
        }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#1a0612', '#4a1428');
        glow(x, '#ff6a3d', 24, ()=>{ x.beginPath(); x.arc(W/2, 70, 30, 0, 7); x.fill(); });
        // the dojo: pillars, lanterns, a wooden floor
        x.fillStyle = '#2a0c14'; [20, 90, 230, 300].forEach(px=>x.fillRect(px-5, 30, 10, FLOOR-18));
        [55, 265].forEach(px=>{ glow(x, '#ff4d6d', 12, ()=>{ x.beginPath(); x.ellipse(px, 50, 7, 10, 0, 0, 7); x.fill(); }); });
        x.fillStyle = '#3a1a10'; x.fillRect(0, FLOOR+12, W, H);
        for(let i=0;i<12;i++){ x.fillStyle = i%2 ? '#4a2414' : '#42200f'; x.fillRect(i*28, FLOOR+12, 28, H); }
        [P, E].forEach(f=>{
          x.save(); x.translate(f.x, f.y); x.scale(f.face, 1);
          const flash = f.stun>0 && Math.floor(t*30)%2;
          const col = flash ? '#fff' : f.col;
          x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(0, FLOOR-f.y+12, 12, 3, 0, 0, 7); x.fill();
          glow(x, col, 8, ()=>{
            x.fillRect(-5, -26, 10, 18);                       // body
            x.fillRect(-4, -36, 8, 9);                         // head
            if(f.act==='punch' && f.at>0.06 && f.at<0.22) x.fillRect(5, -24, 18, 4);
            else x.fillRect(3, -24, 6, 4);
            if(f.act==='kick' && f.at>0.15 && f.at<0.4){ x.fillRect(3, -12, 26, 5); x.fillRect(-5, -8, 4, 20); }
            else { x.fillRect(-5, -8, 4, 20); x.fillRect(2, -8, 4, 20); }
          });
          x.fillStyle = '#fff'; x.fillRect(-1, -34, 8, 2);        // headband
          if(f.block){ x.strokeStyle = '#8fd3ff'; x.lineWidth = 2; x.beginPath(); x.arc(8, -20, 14, -1.2, 1.2); x.stroke(); }
          x.restore();
        });
        fx.draw(x);
        x.restore();
        const bar = (px, hp, col, right)=>{ x.fillStyle = '#300'; x.fillRect(px, 8, 120, 7);
          glow(x, col, 6, ()=>x.fillRect(right ? px+120-120*Math.max(0,hp)/100 : px, 8, 120*Math.max(0,hp)/100, 7)); };
        bar(8, P.hp, '#27e8ff', false); bar(W-128, E.hp, '#ff4d6d', true);
        text(x, 'YOU', 8, 18, 1, '#8ff4ff'); text(x, 'KAGE', W-8, 18, 1, '#ff9aaa', 1);
        text(x, 'R'+round+'  '+wins+'-'+lost, W/2, 8, 1, '#ffd23d', 0.5);
        if(msg && !over_) banner(x, msg);
        if(over_){ banner(x, msg, 'SCORE '+score+' - SPACE TO PLAY AGAIN', won ? '#3ddc84' : '#ff6a6a'); }
      },
      get score(){ return score; }, get over(){ return over_; }, get won(){ return won; }
    };
  }

  /* BLADE DUEL — two samurai, one strike each. Hold ↑ or ↓ to guard high
     or low; SPACE strikes where you are guarding. A strike lands if the
     other one is guarding the other way. First to five. */
  function bladeDuel(){
    let me, foe, score, mine, theirs, over_, won, phase, pt, fx, sh, rnd, t, keys, flash, lastWord;
    function reset(){ me = { stance:'mid', strike:0, x:90 }; foe = { stance:'mid', strike:0, x:230, next:1+rnd()*1.2 }; phase = 'ready'; pt = 1.2; }
    function clash(att, def, attIsMe){
      const high = att.stance==='high';
      const guarded = (high && def.stance==='high') || (!high && def.stance==='low');
      if(guarded){ fx.burst(W/2, high?110:150, '#fff', 20, 100); sh.hit(3); lastWord = 'PARRY'; return; }
      flash = 0.3; sh.hit(8); fx.burst(attIsMe ? foe.x : me.x, high?110:150, '#ff3040', 36, 120);
      if(attIsMe){ mine++; score += 200; lastWord = 'CUT!'; } else { theirs++; lastWord = 'CUT...'; }
      phase = 'point'; pt = 1.4;
    }
    return {
      id:'blade', keys:'↑ ↓ guard high / low · SPACE strike',
      start(seed){ rnd = seeded(seed); score = 0; mine = 0; theirs = 0; over_ = false; won = false; t = 0; keys = {}; flash = 0; lastWord = '';
        fx = Particles(); sh = Shake(); reset(); },
      key(c, d){ keys[c] = d;
        if(c==='Space' && d && phase==='fight' && !me.strike){ me.strike = 0.25; me.stance = keys.ArrowUp ? 'high' : 'low'; clash(me, foe, true); } },
      tick(dt){
        fx.tick(dt, 100); sh.tick(dt); t += dt; flash = Math.max(0, flash-dt);
        if(over_) return;
        me.strike = Math.max(0, me.strike-dt); foe.strike = Math.max(0, foe.strike-dt);
        if(!me.strike) me.stance = keys.ArrowUp ? 'high' : keys.ArrowDown ? 'low' : 'mid';
        if(phase==='ready'){ pt -= dt; if(pt<=0) phase = 'fight'; return; }
        if(phase==='point'){ pt -= dt; if(pt<=0){ if(mine>=5 || theirs>=5){ over_ = true; won = mine>=5; if(won) score += 500; } else reset(); } return; }
        // the foe watches your guard and changes its own
        foe.next -= dt;
        if(!foe.strike && rnd() < dt*2) foe.stance = rnd()<0.5 ? 'high' : 'low';
        if(foe.next<=0){ foe.next = Math.max(0.5, 1.6 - (mine+theirs)*0.08) + rnd();
          foe.strike = 0.25; foe.stance = me.stance==='high' ? 'low' : me.stance==='low' ? 'high' : (rnd()<0.5?'high':'low');
          if(rnd() < 0.25) foe.stance = foe.stance==='high' ? 'low' : 'high';     // it can be wrong
          clash(foe, me, false); }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#f39ac8', '#1a2a6a');
        glow(x, '#fff3d0', 30, ()=>{ x.beginPath(); x.arc(W/2, 60, 36, 0, 7); x.fill(); });
        x.fillStyle = '#12081f'; x.beginPath(); x.moveTo(0,H-70); for(let i=0;i<=10;i++) x.lineTo(i*32, H-90-((i*71)%30)); x.lineTo(W,H); x.lineTo(0,H); x.fill();
        for(let i=0;i<30;i++){ const px = (i*53 + t*30) % W, py = (i*37 + t*20*(1+i%3)) % H; x.fillStyle = '#ffb3d9'; x.fillRect(px, py, 2, 1); }
        x.fillStyle = '#0a0412'; x.fillRect(0, H-44, W, 44);
        const sam = (s, col, face)=>{
          x.save(); x.translate(s.x, H-44); x.scale(face, 1);
          glow(x, col, 6, ()=>{ x.fillRect(-6, -40, 12, 26); x.fillRect(-5, -52, 10, 11); x.fillRect(-9, -14, 18, 14); });
          x.fillStyle = '#000'; x.fillRect(-7, -54, 14, 4);
          const ang = s.strike ? (s.stance==='high' ? -0.1 : 0.5) : s.stance==='high' ? -1.1 : s.stance==='low' ? 0.9 : -0.3;
          x.save(); x.translate(4, -32); x.rotate(ang);
          glow(x, '#e8f4ff', s.strike ? 16 : 6, ()=>x.fillRect(0, -1, s.strike ? 40 : 28, 2)); x.fillStyle = '#5a3a1a'; x.fillRect(-6, -2, 6, 4);
          x.restore(); x.restore(); };
        sam(me, '#27e8ff', 1); sam(foe, '#ff4d6d', -1);
        fx.draw(x);
        x.restore();
        if(flash){ x.fillStyle = 'rgba(255,255,255,'+flash*2+')'; x.fillRect(0,0,W,H); }
        hud(x, 'YOU '+mine, 'FOE '+theirs);
        text(x, 'FIRST TO 5', W/2, 6, 1, '#fff', 0.5);
        if(phase==='ready' && !over_) banner(x, 'READY', 'HOLD UP OR DOWN TO GUARD', '#fff');
        else if(phase==='point' && !over_) banner(x, lastWord, null, lastWord==='CUT!' ? '#3ddc84' : '#ff6a6a');
        else if(lastWord==='PARRY' && phase==='fight') text(x, 'PARRY', W/2, 40, 2, '#fff', 0.5);
        if(over_) banner(x, won ? 'VICTORY' : 'DEFEAT', 'SCORE '+score+' - SPACE TO PLAY AGAIN', won ? '#3ddc84' : '#ff6a6a');
      },
      get score(){ return score; }, get over(){ return over_; }, get won(){ return won; }
    };
  }

  /* SUMO PUSH — a ring seen from above; shove the other wrestler out.
     SPACE is a charge: a burst of speed, then a moment of tiredness. */
  function sumoPush(){
    const R = 90, CX = W/2, CY = H/2+8;
    let A, B, keys, mine, theirs, over_, won, score, pause, fx, sh, rnd, t, msg;
    function body(x, y, col){ return { x, y, vx:0, vy:0, col, charge:0, tired:0 }; }
    function reset(){ A = body(CX-40, CY, '#27e8ff'); B = body(CX+40, CY, '#ff4d6d'); pause = 1.2; }
    function move(b, ax, ay, dt, wantCharge){
      b.charge = Math.max(0, b.charge-dt); b.tired = Math.max(0, b.tired-dt);
      if(wantCharge && !b.charge && !b.tired){ b.charge = 0.35; b.tired = 1.2; }
      const f = b.charge ? 520 : b.tired > 0.8 ? 60 : 220;
      const l = Math.hypot(ax, ay) || 1;
      b.vx += ax/l*f*dt; b.vy += ay/l*f*dt;
      b.vx *= Math.pow(0.08, dt); b.vy *= Math.pow(0.08, dt);
      b.x += b.vx*dt; b.y += b.vy*dt;
    }
    return {
      id:'sumo', keys:'arrows move · SPACE charge',
      start(seed){ rnd = seeded(seed); keys = {}; mine = 0; theirs = 0; over_ = false; won = false; score = 0; t = 0; msg = '';
        fx = Particles(); sh = Shake(); reset(); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt); sh.tick(dt); t += dt;
        if(over_) return;
        if(pause>0){ pause -= dt; return; }
        move(A, (keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0), (keys.ArrowDown?1:0)-(keys.ArrowUp?1:0), dt, keys.Space);
        // the other: get between you and the middle, then push
        const toC = [CX-B.x, CY-B.y], toA = [A.x-B.x, A.y-B.y];
        const edge = Math.hypot(B.x-CX, B.y-CY) > R*0.6;
        const ax = edge ? toC[0]*0.7+toA[0]*0.3 : toA[0], ay = edge ? toC[1]*0.7+toA[1]*0.3 : toA[1];
        move(B, ax, ay, dt, Math.hypot(toA[0], toA[1]) < 40 && rnd() < dt*(1.2+ (mine+theirs)*0.3));
        const dx = B.x-A.x, dy = B.y-A.y, d = Math.hypot(dx, dy)||1;
        if(d < 28){
          const nx = dx/d, ny = dy/d, over = 28-d;
          A.x -= nx*over/2; A.y -= ny*over/2; B.x += nx*over/2; B.y += ny*over/2;
          const rel = (A.vx-B.vx)*nx + (A.vy-B.vy)*ny;
          if(rel > 0){ const ma = A.charge ? 1 : 1.4, mb = B.charge ? 1 : 1.4, k = rel*1.1;
            A.vx -= nx*k/ma; A.vy -= ny*k/ma; B.vx += nx*k/mb; B.vy += ny*k/mb;
            if(rel > 60){ sh.hit(rel/30); fx.burst((A.x+B.x)/2, (A.y+B.y)/2, '#fff3d0', 8, 60); } }
        }
        const outA = Math.hypot(A.x-CX, A.y-CY) > R, outB = Math.hypot(B.x-CX, B.y-CY) > R;
        if(outA || outB){
          if(outB && !outA){ mine++; score += 300; msg = 'OUT! YOUR POINT'; fx.burst(B.x, B.y, '#ffd23d', 30, 90); }
          else { theirs++; msg = 'OUT! THEIR POINT'; fx.burst(A.x, A.y, '#ff4d6d', 30, 90); }
          sh.hit(8);
          if(mine>=3 || theirs>=3){ over_ = true; won = mine>=3; if(won) score += 600; }
          else reset();
        }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#1a0f08', '#2a1a0c');
        const g = x.createRadialGradient(CX, CY, 10, CX, CY, R+20); g.addColorStop(0, '#e8d4a8'); g.addColorStop(0.85, '#c8a878'); g.addColorStop(1, '#6b4a2a');
        x.fillStyle = g; x.beginPath(); x.arc(CX, CY, R+16, 0, 7); x.fill();
        x.strokeStyle = '#f4f0e0'; x.lineWidth = 3; x.beginPath(); x.arc(CX, CY, R, 0, 7); x.stroke();
        x.fillStyle = '#5a3a1a'; x.fillRect(CX-18, CY-4, 4, 8); x.fillRect(CX+14, CY-4, 4, 8);
        [A, B].forEach(b=>{
          x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.arc(b.x+3, b.y+4, 15, 0, 7); x.fill();
          glow(x, b.charge ? '#fff' : b.col, b.charge ? 16 : 6, ()=>{ x.beginPath(); x.arc(b.x, b.y, 14, 0, 7); x.fill(); });
          x.fillStyle = '#1a1030'; x.beginPath(); x.arc(b.x, b.y, 5, 0, 7); x.fill();
          if(b.tired > 0.8){ x.fillStyle = '#fff'; text(x, 'Z', b.x+10, b.y-20, 1, '#fff'); }
        });
        fx.draw(x);
        x.restore();
        hud(x, 'YOU '+mine, 'CPU '+theirs); text(x, 'FIRST TO 3', W/2, 6, 1, '#fff', 0.5);
        if(pause>0 && !over_) banner(x, msg || 'HAKKEYOI!', msg ? 'HAKKEYOI!' : null);
        if(over_) banner(x, won ? 'YOKOZUNA!' : 'DEFEAT', 'SCORE '+score+' - SPACE TO PLAY AGAIN', won ? '#3ddc84' : '#ff6a6a');
      },
      get score(){ return score; }, get over(){ return over_; }, get won(){ return won; }
    };
  }

  /* ======================================================= 5 RACING */

  /* NIGHT RACER — the road drawn the way the 1986 arcade did it: a strip
     per segment, projected, with hills and bends. Beat the clock to each
     checkpoint and pass the traffic without touching it. */
  function nightRacer(){
    const SEG = 200, LANES = 3, ROADW = 2000, DRAW = 110, CAM_H = 1000, DEPTH = 0.84;
    let segs, pos, speed, px, keys, score, over_, time, cars, fx, sh, rnd, t, next, crash;
    function build(){
      segs = [];
      const add = (n, curve, hill)=>{ for(let i=0;i<n;i++){ const k = i/n; segs.push({ curve: curve*Math.sin(k*Math.PI), y: 0, hill: hill*Math.sin(k*Math.PI*2) }); } };
      for(let b=0;b<40;b++){ const r = rnd(); add(40+((rnd()*60)|0), r<0.3 ? 0 : (rnd()-0.5)*8, rnd()<0.5 ? 0 : (rnd()-0.5)*60); }
      let y = 0; segs.forEach(s=>{ y += s.hill; s.y = y; });
      cars = []; for(let i=0;i<60;i++) cars.push({ z: (i*SEG*25 + rnd()*SEG*20), x: (rnd()*2-1)*0.7, sp: 60+rnd()*80, col: ['#ff4d6d','#ffd23d','#3ddc84','#c86bff'][i%4] });
    }
    const L = () => segs.length*SEG;
    return {
      id:'racer', keys:'← → steer · ↑ accelerate · ↓ brake',
      start(seed){ rnd = seeded(seed); build(); pos = 0; speed = 0; px = 0; keys = {}; score = 0; over_ = false; time = 40; t = 0; next = SEG*1200; crash = 0;
        fx = Particles(); sh = Shake(); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt); sh.tick(dt); t += dt;
        if(over_) return;
        time -= dt; if(time<=0){ time = 0; over_ = true; }
        crash = Math.max(0, crash-dt);
        const max = 240*SEG/30;
        if(crash) speed *= Math.pow(0.2, dt);
        else if(keys.ArrowUp) speed += max*0.45*dt; else if(keys.ArrowDown) speed -= max*1.2*dt; else speed -= max*0.15*dt;
        const off = Math.abs(px) > 1;
        if(off) speed -= max*0.8*dt*(speed>max*0.3?1:0);
        speed = clamp(speed, 0, max);
        const seg = segs[Math.floor(pos/SEG) % segs.length];
        px += ((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0)) * 2.2*dt * (speed/max) - seg.curve*0.0045*(speed/max);
        px = clamp(px, -2.2, 2.2);
        pos += speed*dt; score = Math.floor(pos/100);
        if(pos > next){ next += SEG*1200; time += 25; fx.burst(W/2, H/2, '#3ddc84', 40, 120); }
        cars.forEach(c=>{ c.z = (c.z + c.sp*SEG/30*dt*0.35) % L();
          const dz = (c.z - pos + L()) % L();
          if(!crash && dz < SEG*0.6 && Math.abs(c.x - px) < 0.35){ crash = 1; sh.hit(10); fx.burst(W/2, H-30, '#ffd23d', 40, 120); } });
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#050418', '#3a0d4a');
        stars(x, null, 50, 0, 0);
        const baseI = Math.floor(pos/SEG), frac = (pos%SEG)/SEG;
        const bend = segs[baseI % segs.length].curve;
        glow(x, '#ff6ad5', 24, ()=>{ x.beginPath(); x.arc(W/2 - bend*8, 100, 36, Math.PI, 0); x.fill(); });
        x.fillStyle = '#1a0830'; x.beginPath(); x.moveTo(0, 110); for(let i=0;i<=16;i++) x.lineTo(i*20, 96-((i*37+Math.floor(pos/2000))%18)); x.lineTo(W, 110); x.fill();
        x.fillStyle = '#0a0418'; x.fillRect(0, 110, W, H);
        const camY = segs[baseI % segs.length].y + CAM_H;
        let dx = -bend*frac, xOff = 0, maxY = H;
        const proj = [];
        for(let n=0;n<DRAW;n++){
          const s = segs[(baseI+n) % segs.length];
          const z = (n - frac + 1)*SEG, scale = DEPTH/z*300;
          const sx = W/2 + (xOff - px*ROADW) * scale * 0.5 / 1, sy = 110 + (camY - s.y) * scale * 0.05, sw = ROADW*scale*0.5;
          proj.push({ sx, sy, sw, s, n, scale });
          xOff += dx*60; dx += s.curve;
        }
        for(let n=DRAW-1;n>0;n--){
          const a = proj[n], b = proj[n-1];
          if(b.sy <= a.sy) continue;
          const alt = Math.floor((baseI+n)/3)%2;
          x.fillStyle = alt ? '#120828' : '#0e0620'; x.fillRect(0, a.sy, W, b.sy-a.sy+1);
          const quad = (x1,w1,x2,w2,col)=>{ x.fillStyle = col; x.beginPath(); x.moveTo(x1-w1, a.sy); x.lineTo(x1+w1, a.sy); x.lineTo(x2+w2, b.sy); x.lineTo(x2-w2, b.sy); x.fill(); };
          quad(a.sx, a.sw*1.15, b.sx, b.sw*1.15, alt ? '#ff3fd0' : '#27e8ff');
          quad(a.sx, a.sw, b.sx, b.sw, alt ? '#3a3656' : '#46426a');
          if(alt) for(let l=1;l<LANES;l++){ const k = -1 + 2*l/LANES; quad(a.sx+a.sw*k, a.sw*0.02, b.sx+b.sw*k, b.sw*0.02, '#e8e0ff'); }
        }
        // traffic, far to near
        cars.map(c=>({ c, dz:(c.z - pos + L()) % L() })).filter(o=>o.dz < SEG*DRAW*0.6 && o.dz > SEG*0.3)
          .sort((a,b)=>b.dz-a.dz).forEach(o=>{
            const n = Math.floor(o.dz/SEG), p = proj[Math.min(n, DRAW-1)];
            if(!p) return;
            const w = p.sw*0.35, h = w*0.5, cx = p.sx + o.c.x*p.sw;
            glow(x, o.c.col, 8, ()=>x.fillRect(cx-w/2, p.sy-h, w, h));
            x.fillStyle = '#ff2030'; x.fillRect(cx-w/2+1, p.sy-h*0.5, w*0.2, h*0.2); x.fillRect(cx+w/2-1-w*0.2, p.sy-h*0.5, w*0.2, h*0.2);
          });
        // your car
        const wob = crash ? Math.sin(t*40)*4 : 0, lean = ((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*3;
        x.save(); x.translate(W/2+wob, H-26);
        glow(x, '#27e8ff', 12, ()=>{ x.fillRect(-26+lean, -14, 52, 16); x.fillRect(-18+lean, -24, 36, 11); });
        x.fillStyle = '#0a1a2a'; x.fillRect(-15+lean, -22, 30, 8);
        glow(x, '#ff2030', 10, ()=>{ x.fillRect(-24+lean, -8, 10, 4); x.fillRect(14+lean, -8, 10, 4); });
        x.fillStyle = '#111'; x.fillRect(-28, 0, 12, 6); x.fillRect(16, 0, 12, 6);
        x.restore();
        fx.draw(x);
        x.restore();
        text(x, 'TIME '+Math.ceil(time), W/2, 8, 2, time<10 ? '#ff4d6d' : '#ffd23d', 0.5);
        text(x, Math.round(speed/(240*SEG/30)*260)+' KMH', W-6, 8, 1, '#fff', 1);
        text(x, 'DIST '+score, 6, 8, 1, '#fff');
        if(over_) gameOver(x, score, 'TIME UP');
      },
      get score(){ return score; }, get over(){ return over_; }
    };
  }

  /* SLALOM — down the mountain between the flags: blue gates on the left
     of you, red on the right. Miss one and lose time; hit a tree and lose
     more. */
  function slalom(){
    let sk, gates, trees, scroll, speed, keys, score, missed, over_, fx, sh, rnd, t, time, nextGate, gateCount;
    return {
      id:'slalom', keys:'← → carve · ↓ tuck for speed',
      start(seed){ rnd = seeded(seed); sk = { x:W/2, a:0 }; gates = []; trees = []; scroll = 0; speed = 70; keys = {}; score = 0; missed = 0;
        over_ = false; t = 0; time = 60; nextGate = 60; gateCount = 0; fx = Particles(); sh = Shake();
        for(let i=0;i<30;i++) trees.push({ x: rnd()<0.5 ? rnd()*50 : W-rnd()*50, y: rnd()*H*2 }); },
      key(c, d){ keys[c] = d; },
      tick(dt){
        fx.tick(dt, 40); sh.tick(dt); t += dt;
        if(over_) return;
        time -= dt; if(time<=0){ time = 0; over_ = true; }
        const turn = (keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
        sk.a = clamp(sk.a + turn*3*dt - sk.a*(turn?0:2)*dt, -1.1, 1.1);
        const target = (keys.ArrowDown ? 210 : 150) * Math.cos(sk.a);
        speed += (target - speed)*dt*0.8;
        sk.x = clamp(sk.x + Math.sin(sk.a)*speed*dt*1.3, 6, W-6);
        const dy = speed*dt; scroll += dy; score = Math.floor(scroll/10) + gateCount*50;
        if(Math.random()<0.5) fx.burst(sk.x, 70, '#ffffff', 1, 15);
        nextGate -= dy;
        if(nextGate<=0){ nextGate = 90 + rnd()*40; const gx = 60 + rnd()*(W-120); gates.push({ x:gx, y:H+10, w:44 - Math.min(16, gateCount*0.4), done:false }); }
        gates.forEach(g=>{ g.y -= dy;
          if(!g.done && g.y < 70){ g.done = true;
            if(sk.x > g.x-g.w/2 && sk.x < g.x+g.w/2){ gateCount++; time += 1.2; fx.burst(g.x, 70, '#3ddc84', 14, 60); }
            else { missed++; time -= 3; sh.hit(3); } } });
        gates = gates.filter(g=>g.y > -20);
        trees.forEach(tr=>{ tr.y -= dy; if(tr.y < -20){ tr.y += H+40; tr.x = rnd()<0.5 ? rnd()*50 : W-rnd()*50;
            if(gateCount>5 && rnd()<0.2) tr.x = 60 + rnd()*(W-120); }
          if(Math.abs(tr.x-sk.x) < 7 && Math.abs(tr.y-70) < 8){ speed = 20; sh.hit(8); time -= 2; fx.burst(sk.x, 70, '#3ddc84', 20, 70); tr.y -= 30; } });
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#e8f0ff', '#c8d8f4');
        for(let i=0;i<60;i++){ x.fillStyle = 'rgba(150,170,210,.35)'; x.fillRect((i*47)%W, ((i*29) - scroll*1) % H + (((i*29) - scroll) % H < 0 ? H : 0), 8, 1); }
        gates.forEach(g=>{ [[-1,'#2f6bff'],[1,'#ff3040']].forEach(([s,col])=>{
          x.fillStyle = '#333'; x.fillRect(g.x+s*g.w/2-1, g.y-14, 2, 14);
          glow(x, col, 6, ()=>{ x.beginPath(); x.moveTo(g.x+s*g.w/2, g.y-14); x.lineTo(g.x+s*g.w/2 - s*10, g.y-10); x.lineTo(g.x+s*g.w/2, g.y-6); x.fill(); }); });
          if(g.done) text(x, '', g.x, g.y, 1); });
        trees.forEach(tr=>{ x.fillStyle = 'rgba(0,0,0,.12)'; x.beginPath(); x.ellipse(tr.x+3, tr.y+2, 7, 3, 0, 0, 7); x.fill();
          x.fillStyle = '#1f5a3a'; x.beginPath(); x.moveTo(tr.x, tr.y-18); x.lineTo(tr.x+8, tr.y); x.lineTo(tr.x-8, tr.y); x.fill();
          x.fillStyle = '#fff'; x.beginPath(); x.moveTo(tr.x, tr.y-18); x.lineTo(tr.x+3, tr.y-12); x.lineTo(tr.x-3, tr.y-12); x.fill(); });
        x.save(); x.translate(sk.x, 70); x.rotate(-sk.a*0.6);
        x.fillStyle = '#222'; x.fillRect(-5, 4, 2, 10); x.fillRect(3, 4, 2, 10);
        glow(x, '#ff6ad5', 6, ()=>{ x.fillRect(-4, -6, 8, 10); });
        x.fillStyle = '#ffd23d'; x.fillRect(-3, -11, 6, 5);
        x.restore();
        fx.draw(x);
        x.restore();
        text(x, 'TIME '+Math.ceil(time), W/2, 6, 2, time<10 ? '#ff3040' : '#2a2a6a', 0.5);
        text(x, 'SCORE '+score, 6, 6, 1, '#2a2a6a'); text(x, 'GATES '+gateCount, W-6, 6, 1, '#2a2a6a', 1);
        if(over_) gameOver(x, score, 'FINISH');
      },
      get score(){ return score; }, get over(){ return over_; }
    };
  }

  /* MINI GOLF — six holes. ← → aim, hold SPACE to charge and let go to
     putt. Walls bounce, sand drags, water sends you back. Under par pays. */
  function miniGolf(){
    const HOLES = [
      { par:2, start:[40,120], cup:[280,120], walls:[[150,40,10,70],[150,130,10,70]], sand:[], water:[] },
      { par:3, start:[40,200], cup:[280,40], walls:[[100,60,10,180],[200,20,10,160]], sand:[[230,180,60,40]], water:[] },
      { par:3, start:[160,210], cup:[160,40], walls:[[60,110,200,10]], sand:[], water:[[120,70,80,30]] },
      { par:2, start:[40,40], cup:[280,200], walls:[], sand:[[110,90,100,60]], water:[] },
      { par:4, start:[40,120], cup:[290,120], walls:[[90,20,10,150],[160,90,10,150],[230,20,10,150]], sand:[], water:[] },
      { par:3, start:[160,200], cup:[160,50], walls:[[100,130,40,10],[180,130,40,10]], sand:[[130,80,60,30]], water:[[20,90,70,40],[230,90,70,40]] }
    ];
    let hole, ball, aim, power, charging, strokes, total, parTotal, over_, keys, fx, sh, rnd, t, sunk, last, score;
    function load(){ const h = HOLES[hole]; ball = { x:h.start[0], y:h.start[1], vx:0, vy:0 }; last = { x:ball.x, y:ball.y }; strokes = 0; sunk = 0;
      aim = Math.atan2(h.cup[1]-ball.y, h.cup[0]-ball.x); }
    const moving = () => Math.hypot(ball.vx, ball.vy) > 3;
    const inRect = (r, px, py) => px>r[0] && px<r[0]+r[2] && py>r[1] && py<r[1]+r[3];
    return {
      id:'golf', keys:'← → aim · hold SPACE, let go to putt',
      start(seed){ rnd = seeded(seed); hole = 0; total = 0; parTotal = 0; over_ = false; keys = {}; t = 0; power = 0; charging = false; score = 0;
        fx = Particles(); sh = Shake(); load(); },
      key(c, d){ keys[c] = d;
        if(c==='Space' && !over_ && !sunk && !moving()){
          if(d && !charging){ charging = true; power = 0; }
          if(!d && charging){ charging = false; const sp = 40 + power*330; ball.vx = Math.cos(aim)*sp; ball.vy = Math.sin(aim)*sp; last = { x:ball.x, y:ball.y }; strokes++; } } },
      tick(dt){
        fx.tick(dt, 40); sh.tick(dt); t += dt;
        if(over_) return;
        const h = HOLES[hole];
        if(sunk){ sunk -= dt; if(sunk<=0){ total += strokes; parTotal += h.par; score += Math.max(0, (h.par - strokes + 2))*100;
            hole++; if(hole>=HOLES.length){ over_ = true; hole--; } else load(); } return; }
        if(!moving()) aim += ((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*2*dt;
        if(charging){ power = (Math.sin(t*3 - Math.PI/2)+1)/2; }
        const drag = h.sand.some(r=>inRect(r, ball.x, ball.y)) ? 0.08 : 0.55;
        ball.vx *= Math.pow(drag, dt); ball.vy *= Math.pow(drag, dt);
        if(!moving()){ ball.vx = ball.vy = 0; }
        const nx = ball.x + ball.vx*dt, ny = ball.y + ball.vy*dt;
        const walls = h.walls.concat([[0,0,W,14],[0,H-6,W,6],[0,0,6,H],[W-6,0,6,H]]);
        let bx = nx, by = ny;
        walls.forEach(w=>{ if(inRect([w[0]-3,w[1]-3,w[2]+6,w[3]+6], bx, ball.y)){ ball.vx = -ball.vx*0.8; bx = ball.x; }
                           if(inRect([w[0]-3,w[1]-3,w[2]+6,w[3]+6], bx, by)){ ball.vy = -ball.vy*0.8; by = ball.y; } });
        ball.x = bx; ball.y = by;
        if(h.water.some(r=>inRect(r, ball.x, ball.y))){ fx.burst(ball.x, ball.y, '#27e8ff', 16, 50); ball.x = last.x; ball.y = last.y; ball.vx = ball.vy = 0; strokes++; sh.hit(2); }
        const dc = Math.hypot(ball.x-h.cup[0], ball.y-h.cup[1]);
        if(dc < 5 && Math.hypot(ball.vx, ball.vy) < 170){ sunk = 1.4; ball.vx = ball.vy = 0; ball.x = h.cup[0]; ball.y = h.cup[1]; fx.burst(ball.x, ball.y, '#ffd23d', 30, 90); }
        else if(dc < 14){ ball.vx += (h.cup[0]-ball.x)*dt*6; ball.vy += (h.cup[1]-ball.y)*dt*6; }
      },
      draw(x){
        x.save(); sh.apply(x);
        const h = HOLES[hole];
        x.fillStyle = '#0a1a10'; x.fillRect(0,0,W,H);
        for(let i=0;i<12;i++) for(let j=0;j<9;j++){ x.fillStyle = (i+j)%2 ? '#1f7a3a' : '#23873f'; x.fillRect(i*28-2, 14+j*28-6, 28, 28); }
        h.sand.forEach(r=>{ x.fillStyle = '#e8cf8a'; x.beginPath(); x.roundRect ? x.roundRect(r[0], r[1], r[2], r[3], 10) : x.rect(r[0], r[1], r[2], r[3]); x.fill(); });
        h.water.forEach(r=>{ x.fillStyle = '#1a6bb5'; x.fillRect(r[0], r[1], r[2], r[3]); x.fillStyle = 'rgba(255,255,255,.3)';
          for(let k=0;k<4;k++) x.fillRect(r[0]+((k*23+t*12)%r[2]), r[1]+6+k*7%r[3], 6, 1); });
        x.fillStyle = '#5a3a1a'; x.fillRect(0, 0, W, 14);
        h.walls.concat([[0,H-6,W,6],[0,14,6,H],[W-6,14,6,H]]).forEach(w=>{ glow(x, '#ffb86b', 4, ()=>x.fillRect(w[0], w[1], w[2], w[3])); });
        x.fillStyle = '#000'; x.beginPath(); x.arc(h.cup[0], h.cup[1], 5, 0, 7); x.fill();
        x.fillStyle = '#ddd'; x.fillRect(h.cup[0], h.cup[1]-22, 1, 22);
        glow(x, '#ff3040', 6, ()=>{ x.beginPath(); x.moveTo(h.cup[0]+1, h.cup[1]-22); x.lineTo(h.cup[0]+11, h.cup[1]-18+Math.sin(t*5)); x.lineTo(h.cup[0]+1, h.cup[1]-14); x.fill(); });
        if(!moving() && !sunk && !over_){
          x.strokeStyle = 'rgba(255,255,255,.8)'; x.setLineDash([3,3]); x.beginPath(); x.moveTo(ball.x, ball.y);
          x.lineTo(ball.x+Math.cos(aim)*(24+power*40), ball.y+Math.sin(aim)*(24+power*40)); x.stroke(); x.setLineDash([]);
          if(charging){ x.fillStyle = '#300'; x.fillRect(W/2-50, H-18, 100, 6); x.fillStyle = power>0.8 ? '#ff3040' : '#ffd23d'; x.fillRect(W/2-50, H-18, 100*power, 6); }
        }
        if(!sunk || sunk > 1.2){ x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.arc(ball.x+1.5, ball.y+1.5, 3, 0, 7); x.fill();
          glow(x, '#fff', 6, ()=>{ x.beginPath(); x.arc(ball.x, ball.y, 3, 0, 7); x.fill(); }); }
        fx.draw(x);
        x.restore();
        text(x, 'HOLE '+(hole+1)+'/'+HOLES.length+'  PAR '+h.par, 6, 4, 1, '#fff');
        text(x, 'STROKES '+strokes+'  TOTAL '+(total)+'/'+parTotal, W-6, 4, 1, '#ffd23d', 1);
        if(sunk && !over_){ const d = strokes - h.par; banner(x, strokes===1 ? 'HOLE IN ONE!' : d<=-2 ? 'EAGLE!' : d===-1 ? 'BIRDIE!' : d===0 ? 'PAR' : d===1 ? 'BOGEY' : '+'+d, null, d<0 ? '#3ddc84' : '#ffd23d'); }
        if(over_) banner(x, (total-parTotal<=0 ? '' : '+')+(total-parTotal)+' ON THE COURSE', 'SCORE '+score+' - SPACE TO PLAY AGAIN');
      },
      get score(){ return score; }, get over(){ return over_; }
    };
  }

  C.add([
    { id:'fighter', name:'DOJO FIGHTER', players:1, genre:'fighting', a:'#ff4d6d',
      blurb:'Best of three against KAGE. Punch, kick, block, jump.', make:dojoFighter, pay:g=>g.won ? 15 : Math.floor(g.score/400) },
    { id:'blade', name:'BLADE DUEL', players:1, genre:'fighting', a:'#e8f4ff',
      blurb:'Guard high or low. One cut is a point. First to five.', make:bladeDuel, pay:g=>g.won ? 14 : Math.floor(g.score/400) },
    { id:'sumo', name:'SUMO PUSH', players:1, genre:'fighting', a:'#ffb86b',
      blurb:'Shove them out of the ring. First to three.', make:sumoPush, pay:g=>g.won ? 12 : Math.floor(g.score/300) },
    { id:'racer', name:'NIGHT RACER', players:1, genre:'racing', a:'#ff3fd0',
      blurb:'Hills, bends and traffic. Beat the clock to each checkpoint.', make:nightRacer, pay:g=>Math.floor(g.score/150) },
    { id:'slalom', name:'SLALOM', players:1, genre:'racing', a:'#2f6bff',
      blurb:'Between the flags, round the trees, down the mountain.', make:slalom, pay:g=>Math.floor(g.score/120) },
    { id:'golf', name:'MINI GOLF', players:1, genre:'racing', a:'#3ddc84',
      blurb:'Six holes. Walls bounce, sand drags, water bites.', make:miniGolf, pay:g=>Math.floor(g.score/100) }
  ]);
})();
