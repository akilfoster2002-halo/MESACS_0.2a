/* =====================================================================
   THE CABINETS, PART TWO — fifteen more games, so NEON has twenty across
   five floors, one genre a floor (neon.js):

     1 CLASSICS   BRICK BREAK · GHOST MAZE · ROAD HOP     (+ SNAKE, BLOCK DROP)
     2 SHOOTERS   ROCK BLASTER · SKY RAIDER · CITY SHIELD (+ STAR SWARM)
     3 PLATFORM   PIXEL PEAKS · NEON DASH · SKY CLIMB
     4 FIGHTING   DOJO FIGHTER · BLADE DUEL · SUMO PUSH   (+ TANK)
     5 RACING     NIGHT RACER · SLALOM · MINI GOLF        (+ VOLLEY)

   SAME SHAPE AS cabgames.js — start/key/tick/draw on one 320x240 buffer —
   and drawn entirely in code: no image is loaded by any of them. What
   makes them look like more than rectangles is a small kit shared below:
   glow (canvas shadowBlur in the colour of the thing), particles, screen
   shake, parallax backdrops, and the CRT pass neon.js lays over every
   screen. Each is a whole small game, not a demo: it gets harder, it ends,
   and it has a score the cabinet pays out on (`pay`).
   ===================================================================== */
(function(){
  const C = window.CABGAMES;
  const W = C.W, H = C.H, text = C.text, seeded = C.seeded;

  /* ================================================================ kit */
  function glow(x, col, blur, fn){
    x.save(); x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; fn(); x.restore();
  }
  function sky(x, top, bot){
    const g = x.createLinearGradient(0,0,0,H); g.addColorStop(0, top); g.addColorStop(1, bot);
    x.fillStyle = g; x.fillRect(0,0,W,H);
  }
  function stars(x, rnd0, n, off, speed){
    for(let i=0;i<n;i++){
      const sx = ((i*97.3 + off*speed*(1+(i%3))) % W + W) % W, sy = (i*53.7) % H;
      x.fillStyle = i%7===0 ? '#9fd8ff' : '#ffffff';
      x.globalAlpha = 0.3 + (i%5)*0.14; x.fillRect(sx|0, sy|0, 1, 1);
    }
    x.globalAlpha = 1;
  }
  function Particles(){
    const list = [];
    return {
      burst(px, py, col, n, sp){
        for(let i=0;i<(n||14);i++){
          const a = Math.random()*Math.PI*2, v = (sp||60)*(0.3+Math.random());
          list.push({ x:px, y:py, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:0.5+Math.random()*0.5, col });
        }
      },
      tick(dt, grav){
        for(let i=list.length-1;i>=0;i--){
          const p = list[i]; p.life -= dt;
          if(p.life<=0){ list.splice(i,1); continue; }
          p.x += p.vx*dt; p.y += p.vy*dt; p.vy += (grav||0)*dt; p.vx *= 0.98;
        }
      },
      draw(x){
        list.forEach(p=>{ x.globalAlpha = Math.min(1, p.life*2); x.fillStyle = p.col;
          x.fillRect(p.x|0, p.y|0, 2, 2); });
        x.globalAlpha = 1;
      },
      clear(){ list.length = 0; }
    };
  }
  function Shake(){
    let t = 0, k = 0;
    return { hit(a){ k = Math.max(k, a); t = 0.3; },
             tick(dt){ t = Math.max(0, t-dt); if(!t) k = 0; },
             apply(x){ if(t) x.translate((Math.random()-0.5)*k, (Math.random()-0.5)*k); } };
  }
  function hud(x, left, right, col){
    text(x, left, 6, 6, 1, col||'#fff');
    if(right!==undefined) text(x, right, W-6, 6, 1, '#fff', 1);
  }
  function gameOver(x, score, word){
    x.fillStyle = 'rgba(5,6,15,.8)'; x.fillRect(0, H/2-34, W, 62);
    glow(x, '#ff6a6a', 10, ()=>text(x, word||'GAME OVER', W/2, H/2-26, 2, '#ff6a6a', 0.5));
    text(x, 'SCORE '+score, W/2, H/2-2, 1, '#fff', 0.5);
    text(x, 'SPACE TO PLAY AGAIN', W/2, H/2+12, 1, '#8fd3ff', 0.5);
  }
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  const hitRect = (a,b)=> a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

  /* THE CRT PASS, laid over every screen by neon.js: scanlines, a soft
     vignette and a faint bloom off the brightest pixels. Cheap, and it is
     most of what makes a 320x240 buffer read as an arcade monitor. */
  let vig = null;
  C.post = function(x){
    if(!vig){
      vig = document.createElement('canvas'); vig.width = W; vig.height = H;
      const v = vig.getContext('2d');
      const g = v.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
      v.fillStyle = g; v.fillRect(0,0,W,H);
      v.fillStyle = 'rgba(0,0,0,.22)';
      for(let y=0;y<H;y+=2) v.fillRect(0, y, W, 1);
    }
    x.save();
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.18; x.filter = 'blur(3px)';
    x.drawImage(x.canvas, 0, 0);
    x.restore();
    x.drawImage(vig, 0, 0);
  };

  /* ====================================================== 1 CLASSICS */

  /* BRICK BREAK — a bat, a ball, and eight rows of glass bricks that
     burst. Clear the wall and a new one comes down faster. */
  function brickBreak(){
    let pad, ball, bricks, lives, score, dead, level, lft, rgt, stuck, fx, sh, rnd;
    function wall(){
      bricks = [];
      const cols = ['#ff3f6e','#ff8a3d','#ffd23d','#3ddc84','#27e8ff','#6b8bff','#c86bff','#ff6ad5'];
      for(let r=0;r<8;r++) for(let c=0;c<12;c++)
        if(level<2 || rnd()>0.08) bricks.push({ x:10+c*25, y:28+r*10, w:23, h:8, col:cols[r], hp: r<2 && level>1 ? 2 : 1, row:8-r });
    }
    function serve(){ stuck = true; ball = { x:pad.x+pad.w/2, y:pad.y-4, vx:0, vy:0, r:3 }; }
    return {
      id:'breakout', keys:'← → move · SPACE launch',
      start(seed){ rnd = seeded(seed); pad = { x:W/2-24, y:H-16, w:48, h:5 };
        lives = 3; score = 0; dead = false; level = 1; lft = rgt = false; fx = Particles(); sh = Shake(); wall(); serve(); },
      key(c, d){ if(c==='ArrowLeft') lft = d; if(c==='ArrowRight') rgt = d;
        if(c==='Space' && d && stuck && !dead){ stuck = false; ball.vx = (rnd()-0.5)*120; ball.vy = -170-level*15; } },
      tick(dt){
        fx.tick(dt, 120); sh.tick(dt);
        if(dead) return;
        pad.x = clamp(pad.x + ((rgt?1:0)-(lft?1:0))*230*dt, 4, W-4-pad.w);
        if(stuck){ ball.x = pad.x+pad.w/2; ball.y = pad.y-4; return; }
        ball.x += ball.vx*dt; ball.y += ball.vy*dt;
        if(ball.x<4){ ball.x=4; ball.vx=Math.abs(ball.vx); }
        if(ball.x>W-4){ ball.x=W-4; ball.vx=-Math.abs(ball.vx); }
        if(ball.y<20){ ball.y=20; ball.vy=Math.abs(ball.vy); }
        if(ball.vy>0 && ball.y>pad.y-3 && ball.y<pad.y+6 && ball.x>pad.x-3 && ball.x<pad.x+pad.w+3){
          const k = (ball.x-(pad.x+pad.w/2))/(pad.w/2);
          const sp = Math.hypot(ball.vx, ball.vy)*1.01;
          ball.vx = sp*Math.sin(k*1.05); ball.vy = -Math.abs(sp*Math.cos(k*1.05));
          fx.burst(ball.x, pad.y, '#8fd3ff', 6, 40);
        }
        for(let i=0;i<bricks.length;i++){
          const b = bricks[i];
          if(ball.x+3>b.x && ball.x-3<b.x+b.w && ball.y+3>b.y && ball.y-3<b.y+b.h){
            const fromSide = Math.min(Math.abs(ball.x-b.x), Math.abs(ball.x-b.x-b.w)) < Math.min(Math.abs(ball.y-b.y), Math.abs(ball.y-b.y-b.h));
            if(fromSide) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            if(--b.hp<=0){ bricks.splice(i,1); score += 10*b.row; fx.burst(b.x+b.w/2, b.y+4, b.col, 16, 70); sh.hit(2); }
            break;
          }
        }
        if(!bricks.length){ level++; score += 500; wall(); serve(); }
        if(ball.y>H+6){ lives--; sh.hit(6); if(lives<=0) dead = true; else serve(); }
      },
      draw(x){
        x.save(); sh.apply(x);
        sky(x, '#0b0620', '#1b0b2e');
        bricks.forEach(b=>{ glow(x, b.col, 6, ()=>x.fillRect(b.x, b.y, b.w, b.h));
          x.fillStyle='rgba(255,255,255,.35)'; x.fillRect(b.x, b.y, b.w, 2);
          if(b.hp>1){ x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(b.x+2, b.y+3, b.w-4, 3); } });
        glow(x, '#8fd3ff', 10, ()=>x.fillRect(pad.x, pad.y, pad.w, pad.h));
        glow(x, '#ffffff', 12, ()=>{ x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill(); });
        fx.draw(x);
        x.restore();
        hud(x, 'SCORE '+score, 'LIVES '+lives+'  L'+level);
        if(stuck && !dead) text(x, 'SPACE TO LAUNCH', W/2, H-40, 1, '#ffd23d', 0.5);
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* GHOST MAZE — eat every dot, and three ghosts who each hunt a different
     way. A big dot turns the tables for a few seconds. */
  function ghostMaze(){
    const MAP = [
      '###################',
      '#o.......#.......o#',
      '#.##.###.#.###.##.#',
      '#.................#',
      '#.##.#.#####.#.##.#',
      '#....#...#...#....#',
      '####.### # ###.####',
      '   #.#   G   #.#   ',
      '####.# ##-## #.####',
      '    .  #GGG#  .    ',
      '####.# ##### #.####',
      '   #.#       #.#   ',
      '####.# ##### #.####',
      '#........#........#',
      '#.##.###.#.###.##.#',
      '#o.#.....P.....#.o#',
      '##.#.#.#####.#.#.##',
      '#....#...#...#....#',
      '#.######.#.######.#',
      '#.................#',
      '###################'];
    const T = 11, OX = (W-19*T)/2, OY = 8;
    let grid, pac, ghosts, want, score, dead, lives, fright, dots, fx, t, rnd, level;
    const open = (c,r)=>{ if(r<0||r>=MAP.length) return false; c=(c+19)%19; const v=grid[r][c]; return v!=='#' && v!=='-'; };
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
    function reset(){
      ghosts = [ { c:9, r:7, col:'#ff4d6d', mode:'chase', d:[1,0], p:0 },
                 { c:8, r:9, col:'#ffb3ff', mode:'ambush', d:[0,-1], p:0, wait:2 },
                 { c:10,r:9, col:'#5de8ff', mode:'wander', d:[0,-1], p:0, wait:5 } ];
      for(let r=0;r<MAP.length;r++) for(let c=0;c<19;c++) if(MAP[r][c]==='P') pac = { c, r, d:[0,0], p:0 };
      want = [0,0]; fright = 0;
    }
    function build(){
      grid = MAP.map(row=>row.split('')); dots = 0;
      grid.forEach(row=>row.forEach(v=>{ if(v==='.'||v==='o') dots++; }));
    }
    function stepMover(m, speed, dt, choose){
      m.p += speed*dt;
      while(m.p >= 1){
        m.p -= 1;
        m.c = (m.c + m.d[0] + 19) % 19; m.r += m.d[1];
        choose(m);
      }
    }
    return {
      id:'maze', keys:'arrows steer · eat every dot',
      start(seed){ rnd = seeded(seed); score = 0; dead = false; lives = 3; level = 1; t = 0; fx = Particles(); build(); reset(); },
      key(c, d){ if(!d) return; const m = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] }[c]; if(m) want = m; },
      tick(dt){
        fx.tick(dt); t += dt;
        if(dead) return;
        fright = Math.max(0, fright-dt);
        stepMover(pac, 6.5, dt, m=>{
          const v = grid[m.r][m.c];
          if(v==='.'){ grid[m.r][m.c]=' '; score+=10; dots--; }
          if(v==='o'){ grid[m.r][m.c]=' '; score+=50; dots--; fright = 7; fx.burst(OX+m.c*T+5, OY+m.r*T+5, '#fff', 14, 60); }
          if(open(m.c+want[0], m.r+want[1])) m.d = want;
          if(!open(m.c+m.d[0], m.r+m.d[1])) m.d = [0,0];
        });
        if(pac.d[0]===0 && pac.d[1]===0 && open(pac.c+want[0], pac.r+want[1])){ pac.d = want; }
        ghosts.forEach(g=>{
          if(g.wait>0){ g.wait -= dt; return; }
          stepMover(g, fright ? 3.5 : 4.6 + level*0.3, dt, m=>{
            if(m.r===9 && m.c>=8 && m.c<=10){ m.d = [0,-1]; return; }
            if(m.r===8 && m.c===9){ m.d = [0,-1]; return; }
            let tx = pac.c, ty = pac.r;
            if(g.mode==='ambush'){ tx += pac.d[0]*4; ty += pac.d[1]*4; }
            if(g.mode==='wander' && rnd()<0.5){ tx = (rnd()*19)|0; ty = (rnd()*21)|0; }
            const opts = DIRS.filter(d=> !(d[0]===-m.d[0] && d[1]===-m.d[1]) && open(m.c+d[0], m.r+d[1]) && !(m.r+d[1]===8 && m.c+d[0]===9));
            if(!opts.length){ m.d = [-m.d[0], -m.d[1]]; return; }
            opts.sort((a,b)=>{ const da=Math.hypot(m.c+a[0]-tx, m.r+a[1]-ty), db=Math.hypot(m.c+b[0]-tx, m.r+b[1]-ty); return fright ? db-da : da-db; });
            m.d = opts[0];
          });
          if(g.c===pac.c && g.r===pac.r){
            if(fright){ score += 200; fx.burst(OX+g.c*T+5, OY+g.r*T+5, g.col, 20, 80); g.c=9; g.r=9; g.d=[0,-1]; g.wait=3; }
            else { lives--; fx.burst(OX+pac.c*T+5, OY+pac.r*T+5, '#ffd23d', 30, 90);
                   if(lives<=0) dead = true; else reset(); }
          }
        });
        if(dots<=0){ level++; score += 300; build(); reset(); }
      },
      draw(x){
        x.fillStyle = '#04030c'; x.fillRect(0,0,W,H);
        for(let r=0;r<MAP.length;r++) for(let c=0;c<19;c++){
          const v = grid[r][c], px = OX+c*T, py = OY+r*T;
          if(v==='#'){ x.fillStyle='#10164a'; x.fillRect(px, py, T, T);
            x.strokeStyle='#3f6bff'; x.lineWidth=1; x.strokeRect(px+1.5, py+1.5, T-3, T-3); }
          if(v==='-'){ x.fillStyle='#ffb3ff'; x.fillRect(px, py+4, T, 2); }
          if(v==='.'){ x.fillStyle='#ffe3b3'; x.fillRect(px+4, py+4, 2, 2); }
          if(v==='o' && Math.floor(t*4)%2) glow(x, '#fff', 8, ()=>{ x.beginPath(); x.arc(px+5, py+5, 3, 0, 7); x.fill(); });
        }
        const at = m => [OX+(m.c + m.d[0]*m.p)*T + 5, OY+(m.r + m.d[1]*m.p)*T + 5];
        const [px, py] = at(pac), mouth = Math.abs(Math.sin(t*14))*0.8;
        const ang = Math.atan2(pac.d[1], pac.d[0]||1);
        glow(x, '#ffd23d', 10, ()=>{ x.beginPath(); x.moveTo(px,py); x.arc(px, py, 5, ang+mouth/2, ang+Math.PI*2-mouth/2); x.fill(); });
        ghosts.forEach(g=>{
          const [gx, gy] = at(g), col = fright ? (fright<2 && Math.floor(t*6)%2 ? '#fff' : '#3048ff') : g.col;
          glow(x, col, 8, ()=>{ x.beginPath(); x.arc(gx, gy-1, 5, Math.PI, 0); x.lineTo(gx+5, gy+5);
            for(let i=0;i<3;i++) x.lineTo(gx+5-(i+0.5)*10/3, gy+(i%2?3:5)); x.lineTo(gx-5, gy+5); x.fill(); });
          x.fillStyle='#fff'; x.fillRect(gx-3, gy-2, 2, 2); x.fillRect(gx+1, gy-2, 2, 2);
        });
        fx.draw(x);
        text(x, score, 4, H-10, 1, '#fff');
        text(x, 'x'+lives, W-4, H-10, 1, '#ffd23d', 1);
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  /* ROAD HOP — get the frog over five lanes of traffic and a river of
     logs to one of the lily pads. Fill all five and the next round is
     faster. */
  function roadHop(){
    const S = 16, ROWS = 14, COLS = 20;
    let frog, lanes, pads, score, best, lives, dead, level, t, fx, sh, rnd, deathT;
    function build(){
      lanes = [];
      const road = [ ['#ff4d6d',1,1.6], ['#ffd23d',-1,2.2], ['#27e8ff',1,1.2], ['#c86bff',-1,2.8], ['#3ddc84',1,1.9] ];
      const river = [ [3,-1,1.2], [2,1,1.8], [4,-1,1.0], [3,1,2.2], [2,-1,1.5] ];
      road.forEach((l,i)=>{ const row = 12-i, n = 3;
        lanes.push({ row, kind:'car', col:l[0], dir:l[1], sp:l[2]*(1+level*0.18), items:Array.from({length:n},(_,k)=>({ x:k*COLS/n + rnd()*2, w: i===3 ? 2 : 1 })) }); });
      river.forEach((l,i)=>{ const row = 6-i;
        lanes.push({ row, kind:'log', dir:l[1], sp:l[2]*(1+level*0.12), items:Array.from({length:3},(_,k)=>({ x:k*7 + rnd()*2, w:l[0] })) }); });
    }
    function home(){ frog = { c:10, r:13, hop:0 }; }
    return {
      id:'hop', keys:'arrows hop · reach the lily pads',
      start(seed){ rnd = seeded(seed); score = 0; lives = 3; dead = false; level = 0; t = 0; deathT = 0;
        fx = Particles(); sh = Shake(); pads = [false,false,false,false,false]; build(); home(); best = 13; },
      key(c, d){ if(!d || dead || deathT>0) return;
        const m = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] }[c];
        if(!m) return;
        frog.c = clamp(Math.round(frog.c)+m[0], 0, COLS-1); frog.r = clamp(frog.r+m[1], 1, 13); frog.hop = 0.12;
        if(frog.r < best){ best = frog.r; score += 10; } },
      tick(dt){
        fx.tick(dt, 60); sh.tick(dt); t += dt;
        if(dead) return;
        frog.hop = Math.max(0, frog.hop-dt);
        lanes.forEach(l=> l.items.forEach(it=>{ it.x += l.dir*l.sp*dt; if(it.x > COLS+1) it.x -= COLS+it.w+2; if(it.x < -it.w-1) it.x += COLS+it.w+2; }));
        if(deathT>0){ deathT -= dt; if(deathT<=0){ if(lives<=0) dead = true; else { home(); best = 13; } } return; }
        const lane = lanes.find(l=>l.row===frog.r);
        const die = ()=>{ lives--; deathT = 0.8; sh.hit(5); fx.burst(frog.c*S+8, frog.r*S+8+16, '#3ddc84', 24, 80); };
        if(lane && lane.kind==='car'){
          if(lane.items.some(it=> frog.c+0.8 > it.x && frog.c+0.2 < it.x+it.w)) die();
        } else if(lane && lane.kind==='log'){
          const on = lane.items.find(it=> frog.c+0.5 > it.x && frog.c+0.5 < it.x+it.w);
          if(!on) die(); else { frog.c += lane.dir*lane.sp*dt; if(frog.c<0 || frog.c>COLS-1) die(); }
        } else if(frog.r===1){
          const slot = [2,6,10,14,18].findIndex(c=>Math.abs(frog.c-c)<1);
          if(slot<0 || pads[slot]) die();
          else { pads[slot] = true; score += 100; fx.burst(frog.c*S+8, 24+8, '#ffd23d', 24, 80); home(); best = 13;
            if(pads.every(Boolean)){ level++; score += 500; pads = pads.map(()=>false); build(); } }
        }
      },
      draw(x){
        x.save(); sh.apply(x);
        const Y = r => 16 + r*S;
        sky(x, '#050818', '#0a0f22');
        x.fillStyle='#0e3a6b'; x.fillRect(0, Y(2), W, S*5);
        for(let i=0;i<40;i++){ x.fillStyle='rgba(143,211,255,.18)'; x.fillRect((i*37+t*20*(i%2?1:-1))%W|0, Y(2)+(i*13)%(S*5), 6, 1); }
        x.fillStyle='#1b4d2a'; x.fillRect(0, Y(1), W, S); x.fillRect(0, Y(7), W, S); x.fillRect(0, Y(13), W, S);
        x.fillStyle='#16161f'; x.fillRect(0, Y(8), W, S*5);
        for(let r=8;r<13;r++) for(let c=0;c<W;c+=24){ x.fillStyle='#3a3a4a'; x.fillRect(c, Y(r)+S-1, 12, 1); }
        [2,6,10,14,18].forEach((c,i)=>{ glow(x, pads[i] ? '#ffd23d' : '#3ddc84', 6, ()=>{ x.beginPath(); x.arc(c*S+8, Y(1)+8, 6, 0, 7); x.fill(); }); });
        lanes.forEach(l=> l.items.forEach(it=>{
          const px = it.x*S, py = Y(l.row);
          if(l.kind==='car'){ glow(x, l.col, 8, ()=>x.fillRect(px+1, py+3, it.w*S-2, S-6));
            x.fillStyle='#fff'; x.fillRect(l.dir>0 ? px+it.w*S-3 : px+1, py+5, 2, 2); x.fillRect(l.dir>0 ? px+it.w*S-3 : px+1, py+S-7, 2, 2);
            x.fillStyle='rgba(0,0,0,.4)'; x.fillRect(px+4, py+5, it.w*S-8, S-10); }
          else { x.fillStyle='#6b4226'; x.fillRect(px, py+2, it.w*S, S-4); x.fillStyle='#8a5a34'; x.fillRect(px, py+3, it.w*S, 3); }
        }));
        if(deathT<=0 || Math.floor(t*10)%2){
          const px = frog.c*S, py = Y(frog.r) - (frog.hop>0 ? 3 : 0);
          glow(x, '#3ddc84', 8, ()=>{ x.fillRect(px+3, py+4, 10, 9); x.fillRect(px+1, py+10, 3, 4); x.fillRect(px+12, py+10, 3, 4); });
          x.fillStyle='#fff'; x.fillRect(px+4, py+3, 3, 3); x.fillRect(px+9, py+3, 3, 3);
        }
        fx.draw(x);
        x.restore();
        hud(x, 'SCORE '+score, 'LIVES '+lives);
        if(dead) gameOver(x, score);
      },
      get score(){ return score; }, get over(){ return dead; }
    };
  }

  C.EXTRA = { glow, sky, stars, Particles, Shake, hud, gameOver, clamp, hitRect };
  /* the first five get a floor too */
  const G0 = { snake:'classics', drop:'classics', swarm:'shooters', tank:'fighting', volley:'racing' };
  C.MACHINES.forEach(m=>{ if(G0[m.id]) m.genre = G0[m.id]; });
  C.add = list => list.forEach(m=>{ if(!C.byId(m.id)) C.MACHINES.push(m); });
  C.add([
    { id:'breakout', name:'BRICK BREAK', players:1, genre:'classics', a:'#ff8a3d',
      blurb:'Eight rows of glass. Break the lot.', make:brickBreak, pay:g=>Math.floor(g.score/80) },
    { id:'maze', name:'GHOST MAZE', players:1, genre:'classics', a:'#ffd23d',
      blurb:'Every dot, and three ghosts who hunt three ways.', make:ghostMaze, pay:g=>Math.floor(g.score/100) },
    { id:'hop', name:'ROAD HOP', players:1, genre:'classics', a:'#3ddc84',
      blurb:'Five lanes, one river, five lily pads.', make:roadHop, pay:g=>Math.floor(g.score/40) }
  ]);
})();
