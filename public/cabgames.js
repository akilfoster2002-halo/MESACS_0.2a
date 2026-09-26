/* =====================================================================
   THE CABINETS — five games you PLAY.

   Everything else in KORO that looks like a game is a game you WRITE: the
   ring, Pong, the swarm and the circuit are all programs, and the pleasure
   in them is the program. That is the whole point of the place and it is
   not what an arcade is. An arcade is a room where you put your hands on a
   machine and it is hard, and the reason it belongs in this game is that a
   child who has spent an hour writing `repeat` deserves somewhere to go and
   just play — and, standing at the next cabinet, somebody to play against.

   SO THESE ARE HANDS-ON. No blocks, no console: four directions and a
   button, which is what every one of these games was built around in 1978.

   ONE SHAPE FOR ALL FIVE. A game is an object with `start`, `key`, `tick`
   and `draw`, drawing into a 320x240 buffer that is scaled up with the
   pixels left square. That buffer is the cabinet's screen while nobody is
   playing (the attract loop) and the whole window while somebody is, which
   is why there is one of it and not two.

   TWO OF THEM ARE AGAINST SOMEBODY ELSE. VOLLEY and TANK take a `side` and
   a `seed` and talk over the socket; see net() on each and neon.js for the
   matchmaking. The rule they both follow is that ONE SIDE IS THE HOST and
   its word is final — the guest sends what it is pressing and draws what it
   is told. That is a decision with a cost (the host has the truth and the
   guest is a frame behind it) and the alternative — both sides simulating
   and hoping they agree — is a desync nobody in a classroom can debug.
   ===================================================================== */
window.CABGAMES = (function(){
  const W = 320, H = 240;                 // the screen, in its own pixels

  /* ARCADE TYPE, drawn rather than loaded: three pixels across and five
     down, which is the shape the words on these machines were in before
     anybody had a font to load. Written out as pixels so that what it looks
     like and what it says are the same thing on the page. */
  const FONT = {
    '0':'###|#.#|#.#|#.#|###', '1':'.#.|##.|.#.|.#.|###',
    '2':'###|..#|###|#..|###', '3':'###|..#|###|..#|###',
    '4':'#.#|#.#|###|..#|..#', '5':'###|#..|###|..#|###',
    '6':'###|#..|###|#.#|###', '7':'###|..#|..#|..#|..#',
    '8':'###|#.#|###|#.#|###', '9':'###|#.#|###|..#|###',
    'A':'###|#.#|###|#.#|#.#', 'B':'##.|#.#|##.|#.#|##.',
    'C':'###|#..|#..|#..|###', 'D':'##.|#.#|#.#|#.#|##.',
    'E':'###|#..|###|#..|###', 'F':'###|#..|###|#..|#..',
    'G':'###|#..|#.#|#.#|###', 'H':'#.#|#.#|###|#.#|#.#',
    'I':'###|.#.|.#.|.#.|###', 'J':'..#|..#|..#|#.#|###',
    'K':'#.#|#.#|##.|#.#|#.#', 'L':'#..|#..|#..|#..|###',
    'M':'#.#|###|###|#.#|#.#', 'N':'##.|#.#|#.#|#.#|#.#',
    'O':'###|#.#|#.#|#.#|###', 'P':'###|#.#|###|#..|#..',
    'Q':'###|#.#|#.#|###|..#', 'R':'###|#.#|##.|#.#|#.#',
    'S':'###|#..|###|..#|###', 'T':'###|.#.|.#.|.#.|.#.',
    'U':'#.#|#.#|#.#|#.#|###', 'V':'#.#|#.#|#.#|#.#|.#.',
    'W':'#.#|#.#|###|###|#.#', 'X':'#.#|#.#|.#.|#.#|#.#',
    'Y':'#.#|#.#|.#.|.#.|.#.', 'Z':'###|..#|.#.|#..|###',
    ' ':'...|...|...|...|...', '-':'...|...|###|...|...',
    '.':'...|...|...|...|.#.', ':':'...|.#.|...|.#.|...',
    '!':'.#.|.#.|.#.|...|.#.', '?':'###|..#|.#.|...|.#.',
    '/':'..#|..#|.#.|#..|#..', '<':'..#|.#.|#..|.#.|..#',
    '>':'#..|.#.|..#|.#.|#..', '*':'#.#|.#.|###|.#.|#.#',
    '+':'...|.#.|###|.#.|...', '=':'...|###|...|###|...'
  };
  function glyph(x, ch, px, py, s){
    const rows = (FONT[ch] || FONT['?']).split('|');
    for(let r=0;r<5;r++){
      const row = rows[r];
      for(let i=0;i<3;i++) if(row[i]==='#') x.fillRect(px+i*s, py+r*s, s, s);
    }
  }
  /* Write a word. `a` is 0 left, 0.5 centred, 1 right. */
  function text(x, str, px, py, s, col, a){
    str = String(str).toUpperCase();
    const w = str.length*4*s - s;
    const at = Math.round(px - w*(a||0));
    x.fillStyle = col || '#fff';
    for(let i=0;i<str.length;i++) glyph(x, str[i], at+i*4*s, py, s);
    return w;
  }

  /* ================================================================ 1/5
     BLOCK DROP — seven pieces, ten across, and a line goes when it is full.
     The speed is the level and the level is the lines: the game gets faster
     because you are good at it, which is the whole engine of the thing. */
  const PIECES = [
    { c:'#27e8ff', b:[[1,1,1,1]] },                       // I
    { c:'#ffd766', b:[[1,1],[1,1]] },                     // O
    { c:'#c86bff', b:[[0,1,0],[1,1,1]] },                 // T
    { c:'#6bff8f', b:[[0,1,1],[1,1,0]] },                 // S
    { c:'#ff6a6a', b:[[1,1,0],[0,1,1]] },                 // Z
    { c:'#5b8bff', b:[[1,0,0],[1,1,1]] },                 // J
    { c:'#ff9f43', b:[[0,0,1],[1,1,1]] }                  // L
  ];
  function blockDrop(){
    const CW = 10, CH = 18, S = 11, OX = (W-CW*S)/2, OY = 8;
    let grid, piece, px, py, rot, next, score, lines, level, fall, dead, rnd;
    const spin = (b,n)=>{ let o=b; for(let k=0;k<n;k++){
      const h=o.length, w=o[0].length, r=[];
      for(let i=0;i<w;i++){ r.push([]); for(let j=0;j<h;j++) r[i].push(o[h-1-j][i]); }
      o=r; } return o; };
    const shape = ()=> spin(PIECES[piece].b, rot);
    function fits(nx, ny, nr){
      const b = spin(PIECES[piece].b, nr);
      for(let r=0;r<b.length;r++) for(let c=0;c<b[r].length;c++){
        if(!b[r][c]) continue;
        const gx = nx+c, gy = ny+r;
        if(gx<0 || gx>=CW || gy>=CH) return false;
        if(gy>=0 && grid[gy][gx]) return false;
      }
      return true;
    }
    function spawn(){
      piece = next; next = Math.floor(rnd()*7); rot = 0;
      px = Math.floor(CW/2)-1; py = -2;
      if(!fits(px, py, rot)) dead = true;
    }
    function lock(){
      const b = shape();
      for(let r=0;r<b.length;r++) for(let c=0;c<b[r].length;c++)
        if(b[r][c] && py+r >= 0) grid[py+r][px+c] = PIECES[piece].c;
      let got = 0;
      for(let r=CH-1;r>=0;r--){
        if(grid[r].every(v=>v)){
          grid.splice(r,1); grid.unshift(new Array(CW).fill(0));
          got++; r++;
        }
      }
      if(got){
        lines += got;
        score += [0,40,100,300,1200][got]*(level+1);
        level = Math.floor(lines/10);
      }
      spawn();
    }
    return {
      id:'drop',
      start(seed){
        rnd = seeded(seed);
        grid = Array.from({length:CH}, ()=>new Array(CW).fill(0));
        score = 0; lines = 0; level = 0; fall = 0; dead = false;
        next = Math.floor(rnd()*7); spawn();
      },
      key(code, down){
        if(!down || dead) return;
        if(code==='ArrowLeft'  && fits(px-1,py,rot)) px--;
        if(code==='ArrowRight' && fits(px+1,py,rot)) px++;
        if(code==='ArrowUp'){ const r=(rot+1)%4; if(fits(px,py,r)) rot=r; }
        if(code==='ArrowDown'){ if(fits(px,py+1,rot)){ py++; score++; } else lock(); }
        if(code==='Space'){ while(fits(px,py+1,rot)){ py++; score+=2; } lock(); }
      },
      tick(dt){
        if(dead) return;
        fall += dt;
        const step = Math.max(0.06, 0.62 - level*0.055);
        if(fall >= step){
          fall = 0;
          if(fits(px,py+1,rot)) py++; else lock();
        }
      },
      draw(x){
        x.fillStyle = '#05060f'; x.fillRect(0,0,W,H);
        x.fillStyle = '#10142a'; x.fillRect(OX-2, OY-2, CW*S+4, CH*S+4);
        for(let r=0;r<CH;r++) for(let c=0;c<CW;c++){
          if(!grid[r][c]) continue;
          cell(x, OX+c*S, OY+r*S, grid[r][c]);
        }
        if(!dead){
          const b = shape();
          for(let r=0;r<b.length;r++) for(let c=0;c<b[r].length;c++)
            if(b[r][c] && py+r>=0) cell(x, OX+(px+c)*S, OY+(py+r)*S, PIECES[piece].c);
        }
        text(x, 'SCORE', 6, 10, 1, '#8fd3ff');
        text(x, score, 6, 20, 1, '#fff');
        text(x, 'LINES', 6, 40, 1, '#8fd3ff');
        text(x, lines, 6, 50, 1, '#fff');
        text(x, 'LEVEL', 6, 70, 1, '#8fd3ff');
        text(x, level, 6, 80, 1, '#fff');
        text(x, 'NEXT', W-40, 10, 1, '#8fd3ff');
        const nb = PIECES[next].b;
        for(let r=0;r<nb.length;r++) for(let c=0;c<nb[r].length;c++)
          if(nb[r][c]) cell(x, W-42+c*8, 22+r*8, PIECES[next].c, 8);
        if(dead) over(x, score);
      },
      get score(){ return score; },
      get over(){ return dead; },
      keys:'← → move  ↑ turn  ↓ drop  SPACE slam'
    };
  }
  function cell(x, px, py, col, s){
    s = s || 11;
    x.fillStyle = col; x.fillRect(px, py, s-1, s-1);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(px, py, s-1, 2);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(px, py+s-3, s-1, 2);
  }

  /* ================================================================ 2/5
     SNAKE — the whole game is one rule you already know, which is why it is
     the one everybody tries first. */
  function snake(){
    const CW = 32, CH = 22, S = 9, OX = (W-CW*S)/2, OY = 22;
    let body, dir, want, food, score, dead, step, rnd;
    const put = ()=>{
      for(let i=0;i<200;i++){
        const f = { x:Math.floor(rnd()*CW), y:Math.floor(rnd()*CH) };
        if(!body.some(b=>b.x===f.x&&b.y===f.y)) return f;
      }
      return { x:0, y:0 };
    };
    return {
      id:'snake',
      start(seed){
        rnd = seeded(seed);
        body = [{x:8,y:11},{x:7,y:11},{x:6,y:11}];
        dir = {x:1,y:0}; want = dir; score = 0; dead = false; step = 0;
        food = put();
      },
      key(code, down){
        if(!down) return;
        const d = { ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0},
                    ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1} }[code];
        if(d && (d.x !== -dir.x || d.y !== -dir.y)) want = d;
      },
      tick(dt){
        if(dead) return;
        step += dt;
        const rate = Math.max(0.055, 0.14 - score*0.0015);
        if(step < rate) return;
        step = 0;
        dir = want;
        const h = { x:body[0].x+dir.x, y:body[0].y+dir.y };
        if(h.x<0||h.y<0||h.x>=CW||h.y>=CH||body.some(b=>b.x===h.x&&b.y===h.y)){
          dead = true; return;
        }
        body.unshift(h);
        if(h.x===food.x && h.y===food.y){ score += 10; food = put(); }
        else body.pop();
      },
      draw(x){
        x.fillStyle = '#05060f'; x.fillRect(0,0,W,H);
        x.fillStyle = '#0d1b16'; x.fillRect(OX-2, OY-2, CW*S+4, CH*S+4);
        x.strokeStyle = '#1f7a4a'; x.lineWidth = 1;
        x.strokeRect(OX-2.5, OY-2.5, CW*S+5, CH*S+5);
        x.fillStyle = '#ff4d6d';
        x.fillRect(OX+food.x*S+1, OY+food.y*S+1, S-2, S-2);
        body.forEach((b,i)=>{
          x.fillStyle = i ? '#3ddc84' : '#a8ffcf';
          x.fillRect(OX+b.x*S, OY+b.y*S, S-1, S-1);
        });
        text(x, 'SNAKE', 6, 7, 1, '#3ddc84');
        text(x, 'SCORE '+score, W-6, 7, 1, '#fff', 1);
        if(dead) over(x, score);
      },
      get score(){ return score; },
      get over(){ return dead; },
      keys:'← ↑ ↓ → turn'
    };
  }

  /* ================================================================ 3/5
     STAR SWARM — the formation comes down a row every time it touches the
     side, and it comes faster the fewer of them are left, so the last one
     is the hardest one. Four shelters that wear away when you shoot through
     them and when they shoot through them. */
  function swarm(){
    const ROWS = 5, COLS = 9;
    let army, dirX, ship, shots, bombs, shelters, score, lives, dead,
        walk, fireT, wave, rnd;
    function fleet(){
      army = [];
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
        army.push({ x:34+c*28, y:30+r*18, r, alive:true });
      dirX = 1;
    }
    function shelterRow(){
      shelters = [];
      for(let s=0;s<4;s++){
        const bx = 34+s*72;
        for(let r=0;r<3;r++) for(let c=0;c<7;c++){
          if(r===2 && c>1 && c<5) continue;
          shelters.push({ x:bx+c*5, y:180+r*5, hp:2 });
        }
      }
    }
    return {
      id:'swarm',
      start(seed){
        rnd = seeded(seed);
        fleet(); shelterRow();
        ship = { x:W/2, l:false, r:false };
        shots = []; bombs = []; score = 0; lives = 3; dead = false;
        walk = 0; fireT = 0; wave = 1;
      },
      key(code, down){
        if(code==='ArrowLeft') ship.l = down;
        if(code==='ArrowRight') ship.r = down;
        if(code==='Space' && down && !dead && shots.length < 2)
          shots.push({ x:ship.x, y:206 });
      },
      tick(dt){
        if(dead) return;
        ship.x = Math.max(12, Math.min(W-12, ship.x + (ship.r-ship.l)*130*dt));
        const left = army.filter(a=>a.alive).length;
        if(!left){ wave++; fleet(); shelterRow(); score += 100; }
        walk += dt*(0.5 + (ROWS*COLS-left)/(ROWS*COLS)*3.2 + wave*0.25);
        if(walk >= 1){
          walk = 0;
          let edge = false;
          army.forEach(a=>{ if(!a.alive) return;
            a.x += dirX*6;
            if(a.x < 12 || a.x > W-12) edge = true; });
          if(edge){ dirX *= -1; army.forEach(a=>{ if(a.alive) a.y += 9; }); }
          army.forEach(a=>{ if(a.alive && a.y > 190) dead = true; });
        }
        fireT -= dt;
        if(fireT <= 0){
          fireT = 0.45 + rnd()*0.9;
          const live = army.filter(a=>a.alive);
          if(live.length){
            const a = live[Math.floor(rnd()*live.length)];
            bombs.push({ x:a.x, y:a.y+8 });
          }
        }
        shots.forEach(s=>s.y -= 300*dt);
        bombs.forEach(b=>b.y += 130*dt);
        // shots meet the army, the shelters, and the roof
        shots = shots.filter(s=>{
          if(s.y < 8) return false;
          for(const a of army){
            if(a.alive && Math.abs(a.x-s.x) < 10 && Math.abs(a.y-s.y) < 8){
              a.alive = false; score += (ROWS-a.r)*10; return false;
            }
          }
          for(const b of shelters)
            if(b.hp > 0 && s.x > b.x && s.x < b.x+5 && s.y > b.y && s.y < b.y+5){
              b.hp--; return false; }
          return true;
        });
        bombs = bombs.filter(b=>{
          for(const s of shelters)
            if(s.hp > 0 && b.x > s.x && b.x < s.x+5 && b.y > s.y && b.y < s.y+5){
              s.hp--; return false; }
          if(Math.abs(b.x-ship.x) < 10 && b.y > 202 && b.y < 218){
            lives--; if(lives <= 0) dead = true; return false; }
          return b.y < H;
        });
      },
      draw(x){
        x.fillStyle = '#05060f'; x.fillRect(0,0,W,H);
        const cols = ['#ff6ad5','#c86bff','#8fd3ff','#6bff8f','#ffd766'];
        army.forEach(a=>{
          if(!a.alive) return;
          x.fillStyle = cols[a.r];
          const wob = Math.floor(walk*2)%2;
          x.fillRect(a.x-7, a.y-4, 14, 8);
          x.fillRect(a.x-9, a.y-1+wob, 3, 4);
          x.fillRect(a.x+6, a.y-1+wob, 3, 4);
          x.fillStyle = '#05060f';
          x.fillRect(a.x-4, a.y-2, 2, 2); x.fillRect(a.x+2, a.y-2, 2, 2);
        });
        shelters.forEach(s=>{
          if(s.hp <= 0) return;
          x.fillStyle = s.hp > 1 ? '#3ddc84' : '#1f7a4a';
          x.fillRect(s.x, s.y, 5, 5);
        });
        x.fillStyle = '#8fd3ff';
        x.fillRect(ship.x-10, 210, 20, 6); x.fillRect(ship.x-2, 204, 4, 6);
        x.fillStyle = '#ffe9a8'; shots.forEach(s=>x.fillRect(s.x-1, s.y, 2, 7));
        x.fillStyle = '#ff6a6a'; bombs.forEach(b=>x.fillRect(b.x-1, b.y, 2, 6));
        text(x, 'SCORE '+score, 6, 6, 1, '#fff');
        text(x, 'WAVE '+wave, W/2, 6, 1, '#c86bff', 0.5);
        text(x, 'SHIPS '+Math.max(0,lives), W-6, 6, 1, '#8fd3ff', 1);
        if(dead) over(x, score);
      },
      get score(){ return score; },
      get over(){ return dead; },
      keys:'← → move  SPACE fire'
    };
  }

  /* ================================================================ 4/5
     VOLLEY — two bats and a ball, first to seven.

     THE HOST OWNS THE BALL. It simulates both bats and the ball and sends
     the lot twenty times a second; the guest sends which way it is holding
     and draws what it is told, easing between the packets so a bat that
     arrives twenty times a second still moves at sixty. Against the
     machine there is no host and no socket, and the same code runs. */
  function volley(){
    const PH = 44, PW = 5, SPEED = 190;
    let ly, ry, bx, by, vx, vy, sa, sb, up, dn, side, host, solo, done, rnd, tgt;
    function serve(dir){
      bx = W/2; by = H/2;
      vx = SPEED*dir; vy = (rnd()*2-1)*110;
    }
    return {
      id:'volley', two:true,
      start(seed, mySide){
        rnd = seeded(seed);
        side = mySide || 'A';               // A is the left bat, and the host
        host = side === 'A';
        solo = !mySide;
        ly = ry = H/2 - PH/2;
        sa = sb = 0; up = dn = false; done = false; tgt = null;
        serve(1);
      },
      key(code, down){
        if(code==='ArrowUp' || code==='KeyW') up = down;
        if(code==='ArrowDown' || code==='KeyS') dn = down;
      },
      /* what the guest sends, and what the host does with it */
      net(m){
        if(host){ if(m.u!==undefined){ this._gu = m.u; this._gd = m.d; } return; }
        if(m.s){ tgt = m.s; if(m.s.a!==undefined){ sa = m.s.a; sb = m.s.b; } }
        if(m.over) done = true;
      },
      out(){                                 // what we send, each network tick
        if(host) return { s:{ l:Math.round(ly), r:Math.round(ry),
                              x:Math.round(bx), y:Math.round(by), a:sa, b:sb } };
        return { u:up, d:dn };
      },
      tick(dt){
        if(done) return;
        const me = (v)=> Math.max(0, Math.min(H-PH, v + ((dn?1:0)-(up?1:0))*SPEED*dt));
        if(!host){
          /* the guest drives its own bat for the feel of it and eases the
             rest onto whatever the host last said */
          ry = me(ry);
          if(tgt){
            const k = Math.min(1, dt*14);
            ly += (tgt.l - ly)*k;
            bx += (tgt.x - bx)*k; by += (tgt.y - by)*k;
            if(Math.hypot(tgt.x-bx, tgt.y-by) > 60){ bx = tgt.x; by = tgt.y; }
          }
          return;
        }
        ly = me(ly);
        if(solo){
          const want = by - PH/2;             // the machine, and it is beatable
          ry += Math.max(-150*dt, Math.min(150*dt, (want-ry)*0.09));
          ry = Math.max(0, Math.min(H-PH, ry));
        } else {
          ry = Math.max(0, Math.min(H-PH,
            ry + ((this._gd?1:0)-(this._gu?1:0))*SPEED*dt));
        }
        bx += vx*dt; by += vy*dt;
        if(by < 4){ by = 4; vy = Math.abs(vy); }
        if(by > H-4){ by = H-4; vy = -Math.abs(vy); }
        const hit = (py)=> by > py-3 && by < py+PH+3;
        if(bx < 14 && vx < 0){
          if(hit(ly)){ bx = 14; vx = Math.abs(vx)*1.06; vy += ((by-(ly+PH/2))/PH)*160; }
          else { sb++; if(sb >= 7) done = true; else serve(1); }
        }
        if(bx > W-14 && vx > 0){
          if(hit(ry)){ bx = W-14; vx = -Math.abs(vx)*1.06; vy += ((by-(ry+PH/2))/PH)*160; }
          else { sa++; if(sa >= 7) done = true; else serve(-1); }
        }
        vy = Math.max(-260, Math.min(260, vy));
      },
      draw(x){
        x.fillStyle = '#05060f'; x.fillRect(0,0,W,H);
        x.fillStyle = '#233';
        for(let y=6;y<H;y+=16) x.fillRect(W/2-1, y, 2, 9);
        x.fillStyle = side==='A' ? '#8fd3ff' : '#4a5a7a';
        x.fillRect(8, ly, PW, PH);
        x.fillStyle = side==='B' ? '#8fd3ff' : '#ff6ad5';
        x.fillRect(W-8-PW, ry, PW, PH);
        x.fillStyle = '#fff'; x.fillRect(bx-3, by-3, 6, 6);
        text(x, sa, W/2-24, 8, 2, '#8fd3ff', 1);
        text(x, sb, W/2+24, 8, 2, '#ff6ad5', 0);
        if(done){
          const iWon = (sa >= 7) === (side==='A');
          banner(x, solo ? (sa>=7 ? 'YOU WIN' : 'MACHINE WINS')
                         : (iWon ? 'YOU WIN' : 'YOU LOSE'));
        }
      },
      get score(){ return side==='A' ? sa : sb; },
      get over(){ return done; },
      get winner(){ return sa >= 7 ? 'A' : sb >= 7 ? 'B' : null; },
      keys:'↑ ↓ move the bat'
    };
  }

  /* ================================================================ 5/5
     TANK — two tanks in a walled yard, shells that bounce off the walls
     twice before they die, and five hits wins it. The same host rule as
     VOLLEY: one side owns the shells.

     The blocks are the whole game. An open field is two tanks shooting
     straight at each other; a field with four blocks in it is a game about
     angles, and a shell that bounces is a game about the angles you cannot
     see yet. */
  function tank(){
    const R = 7, SP = 62, TURN = 2.6, SHELL = 150;
    const BLOCKS = [ {x:70,y:60,w:26,h:26}, {x:224,y:60,w:26,h:26},
                     {x:70,y:154,w:26,h:26}, {x:224,y:154,w:26,h:26},
                     {x:147,y:104,w:26,h:32} ];
    let A, B, shells, side, host, solo, done, rnd, tgt, keys;
    const wall = (x,y)=> x<R+4 || x>W-R-4 || y<R+4 || y>H-R-4
      || BLOCKS.some(b=>x>b.x-R && x<b.x+b.w+R && y>b.y-R && y<b.y+b.h+R);
    function tanks(){
      A = { x:40, y:H/2, a:0, hp:5, cool:0 };
      B = { x:W-40, y:H/2, a:Math.PI, hp:5, cool:0 };
    }
    function drive(t, k, dt){
      t.a += ((k.r?1:0)-(k.l?1:0))*TURN*dt;
      const mv = ((k.f?1:0)-(k.b?1:0))*SP*dt;
      const nx = t.x + Math.cos(t.a)*mv, ny = t.y + Math.sin(t.a)*mv;
      if(!wall(nx, t.y)) t.x = nx;
      if(!wall(t.x, ny)) t.y = ny;
      t.cool -= dt;
      if(k.s && t.cool <= 0){
        t.cool = 0.85;
        shells.push({ x:t.x+Math.cos(t.a)*(R+3), y:t.y+Math.sin(t.a)*(R+3),
                      vx:Math.cos(t.a)*SHELL, vy:Math.sin(t.a)*SHELL,
                      by:t===A?'A':'B', life:3.2, bounce:2 });
      }
    }
    return {
      id:'tank', two:true,
      start(seed, mySide){
        rnd = seeded(seed);
        side = mySide || 'A'; host = side === 'A'; solo = !mySide;
        tanks(); shells = []; done = false; tgt = null;
        keys = { l:false, r:false, f:false, b:false, s:false };
        this._g = { l:false, r:false, f:false, b:false, s:false };
      },
      key(code, down){
        const map = { ArrowLeft:'l', ArrowRight:'r', ArrowUp:'f', ArrowDown:'b',
                      Space:'s', KeyA:'l', KeyD:'r', KeyW:'f', KeyS:'b' };
        if(map[code]) keys[map[code]] = down;
      },
      net(m){
        if(host){ if(m.k) this._g = m.k; return; }
        if(m.s) tgt = m.s;
        if(m.over) done = true;
      },
      out(){
        if(host) return { s:{ ax:Math.round(A.x), ay:Math.round(A.y), aa:+A.a.toFixed(2),
                              bx:Math.round(B.x), by:Math.round(B.y), ba:+B.a.toFixed(2),
                              ha:A.hp, hb:B.hp,
                              sh:shells.map(s=>[Math.round(s.x), Math.round(s.y)]) } };
        return { k:keys };
      },
      tick(dt){
        if(done) return;
        if(!host){
          if(tgt){
            const k = Math.min(1, dt*16);
            A.x += (tgt.ax-A.x)*k; A.y += (tgt.ay-A.y)*k; A.a = tgt.aa;
            B.x += (tgt.bx-B.x)*k; B.y += (tgt.by-B.y)*k; B.a = tgt.ba;
            A.hp = tgt.ha; B.hp = tgt.hb;
            shells = (tgt.sh||[]).map(p=>({ x:p[0], y:p[1] }));
          }
          return;
        }
        drive(A, keys, dt);
        if(solo){
          /* the machine: turn towards you, close, and shoot when it is
             pointed near enough to mean it */
          const want = Math.atan2(A.y-B.y, A.x-B.x);
          let d = want - B.a;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          drive(B, { l:d<-0.06, r:d>0.06, f:Math.hypot(A.x-B.x,A.y-B.y)>70,
                     b:false, s:Math.abs(d)<0.18 && rnd()<0.5 }, dt);
        } else drive(B, this._g, dt);
        shells.forEach(s=>{
          s.life -= dt;
          let nx = s.x + s.vx*dt, ny = s.y + s.vy*dt;
          const bounceX = nx<4 || nx>W-4 || BLOCKS.some(b=>ny>b.y&&ny<b.y+b.h&&nx>b.x-2&&nx<b.x+b.w+2);
          const bounceY = ny<4 || ny>H-4 || BLOCKS.some(b=>nx>b.x&&nx<b.x+b.w&&ny>b.y-2&&ny<b.y+b.h+2);
          if(bounceX){ s.vx*=-1; nx = s.x; s.bounce--; }
          if(bounceY){ s.vy*=-1; ny = s.y; s.bounce--; }
          s.x = nx; s.y = ny;
          [A,B].forEach(t=>{
            const who = t===A ? 'A' : 'B';
            if(s.dead || s.by===who) return;
            if(Math.hypot(t.x-s.x, t.y-s.y) < R+2){ t.hp--; s.dead = true; }
          });
        });
        shells = shells.filter(s=>!s.dead && s.life>0 && s.bounce>=0);
        if(A.hp<=0 || B.hp<=0) done = true;
      },
      draw(x){
        x.fillStyle = '#0b1020'; x.fillRect(0,0,W,H);
        x.fillStyle = '#1b2440';
        x.fillRect(0,0,W,4); x.fillRect(0,H-4,W,4);
        x.fillRect(0,0,4,H); x.fillRect(W-4,0,4,H);
        BLOCKS.forEach(b=>{ x.fillStyle='#2a3558'; x.fillRect(b.x,b.y,b.w,b.h);
                            x.fillStyle='#3b4a78'; x.fillRect(b.x,b.y,b.w,3); });
        const body=(t,col,me)=>{
          x.save(); x.translate(t.x,t.y); x.rotate(t.a);
          x.fillStyle = col; x.fillRect(-R,-R+1,R*2,R*2-2);
          x.fillStyle = me ? '#fff' : 'rgba(255,255,255,.55)';
          x.fillRect(R-2,-1.5,8,3);
          x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-R,-R+1,R*2,2);
          x.restore();
        };
        body(A, '#8fd3ff', side==='A');
        body(B, '#ff6ad5', side==='B');
        x.fillStyle = '#ffe9a8';
        shells.forEach(s=>x.fillRect(s.x-2, s.y-2, 4, 4));
        for(let i=0;i<5;i++){
          x.fillStyle = i < A.hp ? '#8fd3ff' : '#22304f';
          x.fillRect(8+i*9, 8, 7, 5);
          x.fillStyle = i < B.hp ? '#ff6ad5' : '#22304f';
          x.fillRect(W-15-i*9, 8, 7, 5);
        }
        if(done){
          const iWon = (B.hp<=0) === (side==='A');
          banner(x, solo ? (B.hp<=0 ? 'YOU WIN' : 'MACHINE WINS')
                         : (iWon ? 'YOU WIN' : 'YOU LOSE'));
        }
      },
      get score(){ return (side==='A' ? 5-B.hp : 5-A.hp)*100; },
      get over(){ return done; },
      get winner(){ return B.hp<=0 ? 'A' : A.hp<=0 ? 'B' : null; },
      keys:'← → turn  ↑ ↓ drive  SPACE fire'
    };
  }

  /* --------------------------------------------------------------- bits */
  /* The same numbers on both machines: a multiplayer game whose ball serves
     one way here and the other way there is two different games. */
  function seeded(seed){
    let s = (seed>>>0) || 1;
    return ()=>{
      s ^= s<<13; s>>>=0; s ^= s>>17; s ^= s<<5; s>>>=0;
      return s/4294967296;
    };
  }
  function over(x, score){
    x.fillStyle = 'rgba(5,6,15,.82)'; x.fillRect(0, H/2-34, W, 62);
    text(x, 'GAME OVER', W/2, H/2-26, 2, '#ff6a6a', 0.5);
    text(x, 'SCORE '+score, W/2, H/2-2, 1, '#fff', 0.5);
    text(x, 'SPACE TO PLAY AGAIN', W/2, H/2+12, 1, '#8fd3ff', 0.5);
  }
  function banner(x, word){
    x.fillStyle = 'rgba(5,6,15,.82)'; x.fillRect(0, H/2-24, W, 44);
    text(x, word, W/2, H/2-14, 2, word==='YOU WIN' ? '#3ddc84' : '#ff6a6a', 0.5);
    text(x, 'SPACE TO PLAY AGAIN', W/2, H/2+8, 1, '#8fd3ff', 0.5);
  }

  /* --------------------------------------------------------- the machines
     What the room stands up. `players:2` is the whole of what makes a
     cabinet look for somebody to play against. */
  const MACHINES = [
    { id:'drop',   name:'BLOCK DROP', players:1, a:'#27e8ff',
      blurb:'Seven shapes, ten across. A full line goes.', make:blockDrop },
    { id:'snake',  name:'SNAKE',      players:1, a:'#3ddc84',
      blurb:'Eat, grow, and do not bite yourself.', make:snake },
    { id:'swarm',  name:'STAR SWARM', players:1, a:'#c86bff',
      blurb:'Forty-five of them, coming down a row at a time.', make:swarm },
    { id:'volley', name:'VOLLEY',     players:2, a:'#8fd3ff',
      blurb:'Two bats, one ball, first to seven.', make:volley },
    { id:'tank',   name:'TANK',       players:2, a:'#ff6ad5',
      blurb:'Two tanks, a walled yard, and shells that bounce.', make:tank }
  ];
  const byId = id => MACHINES.find(m=>m.id===id) || null;

  return { MACHINES, byId, W, H, text, seeded,
           make(id){ const m = byId(id); return m ? m.make() : null; } };
})();
