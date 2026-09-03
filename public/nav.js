/* =====================================================================
   ESCAPE — corridor navigation, on a clock, with something behind you.

   The rule that makes this a puzzle and not a reflex test:
   THE WORLD MOVES ONE BEAT PER INSTRUCTION.  The zombie steps once for
   every block your program runs, so a wasteful program is what gets you
   caught — you cannot outrun it by mashing, only by writing less.

   The clock is the other half: it runs while you are writing.  Let it hit
   zero and the zombie is on you.  Fast AND short, which is the whole
   lesson behind a loop.
   ===================================================================== */
window.NAV = (function(){
  const T=4;                                   // world units per grid tile
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];      // N E S W
  const PAL={floor:0x8d93b4, wall:0x4a4570, exit:0xa8e6cf, safe:0xd8ecff};

  let L=null, busy=false, clockT=null, left=0;

  /* ------------------------------------------------------------ levels */
  const STAGES=[
    { name:'Straight Shot', secs:45, budget:6,
      learn:{ name:'Commands', text:'A command is one instruction. The computer does it once, exactly as written.', code:'forward()' },
      brief:'A zombie is behind you. <b>forward()</b> moves one tile. Count the tiles to the green door and write that many.',
      pal:['forward','left','right'],
      grid:['##########',
            '#Z.S....X#',
            '##########'] },

    { name:'Round the Corner', secs:55, budget:9,
      learn:{ name:'Turning', text:'left() and right() turn you a quarter turn on the spot. They do not move you.', code:'forward()\nright()\nforward()' },
      brief:'The way out is round a corner. <b>right()</b> and <b>left()</b> turn you without moving. Every block you run, it steps too.',
      pal:['forward','left','right'],
      grid:['########',
            '#Z.S...#',
            '#####.##',
            '#####.##',
            '#####X##',
            '########'] },

    { name:'The Long Hall', secs:60, budget:7,
      learn:{ name:'Loops', text:'A loop runs the blocks inside it again and again, so you write the move once instead of ten times.', code:'repeat 10\n  forward()\nend' },
      brief:'Ten tiles, and only <b>7 blocks</b> allowed. Writing forward() ten times will not fit — <b>repeat</b> it instead.',
      pal:['forward','left','right','repeat'],
      grid:['###############',
            '#Z.S.........X#',
            '###############'] }
  ];

  /* ------------------------------------------------------------- build */
  function tile(x,y,color,h,yOff){
    const m=new THREE.Mesh(new THREE.BoxGeometry(T*0.96,h||0.4,T*0.96),
      new THREE.MeshLambertMaterial({color}));
    m.position.set(x*T,(yOff!==undefined?yOff:0),y*T);
    G.roomGroup.add(m); return m;
  }
  async function start(n){
    const idx=Math.max(0, Math.min(STAGES.length-1, n||0));
    const S=STAGES[idx];
    busy=false;
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null;
    G.ground=()=>0.2;                      // the tiles are 0.4 thick, so their top is 0.2
    G.scene.background=new THREE.Color(0x150f28);
    G.scene.fog=new THREE.Fog(0x150f28, 60, 190);
    G.hudOwner='nav'; G.missionId='nav'; G.running=true;
    if(window.updateLeaveBtn) updateLeaveBtn();
    document.querySelector('#mapwrap').classList.remove('hidden');

    L={ idx, S, grid:S.grid, w:S.grid[0].length, h:S.grid.length,
        x:0, y:0, dir:1, start:null, zom:{x:0,y:0,mesh:null}, zomStart:null,
        exit:null, beat:0, done:false, caught:false };

    S.grid.forEach((row,y)=>[...row].forEach((c,x)=>{
      if(c==='#'){ tile(x,y,PAL.wall,5.5,2.75);
        G.solids.push({x1:x*T-T/2,x2:x*T+T/2,z1:y*T-T/2,z2:y*T+T/2}); return; }
      tile(x,y,PAL.floor,0.4,0);
      if(c==='S'){ L.x=x; L.y=y; L.start={x,y}; tile(x,y,PAL.safe,0.45,0.03); }
      if(c==='X'){ L.exit={x,y}; tile(x,y,PAL.exit,0.5,0.05); }
      if(c==='Z'){ L.zom.x=x; L.zom.y=y; L.zomStart={x,y}; }
    }));

    // you
    G.pos.set(L.x*T, 1.9, L.y*T);
    G.yaw=Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]); G.pitch=-0.12;
    G.vel.y=0; G.onGround=true;
    if(window.AVATAR) AVATAR.attach();

    // and it
    try{
      const z=await ZOMBIE.make({skin:'zombieA', height:2.2});
      z.position.set(L.zom.x*T, 0, L.zom.y*T);
      G.roomGroup.add(z); L.zom.mesh=z;
      ZOMBIE.animate(z,0,'idle');
    }catch(e){ console.warn('chaser failed to load',e); }

    CODE.setPalette(S.pal); CODE.setBudget(S.budget); CODE.clear();
    CODE.setGuide({ brief:S.brief, name:S.learn.name, text:S.learn.text, code:S.learn.code });
    face(); hud(); brief(S.brief);
    startClock(S.secs);
    teach();
  }

  /* --------------------------------------------------------- the world */
  function cell(x,y){
    if(y<0||y>=L.h||x<0||x>=L.grid[y].length) return '#';
    return L.grid[y][x];
  }
  function face(){
    if(!L.zom.mesh) return;
    const m=L.zom.mesh;
    m.position.set(L.zom.x*T, 0, L.zom.y*T);
    m.lookAt(G.pos.x, 0, G.pos.z);
  }
  /* one beat: the zombie takes a step toward you, then we see if it has you */
  function beat(){
    L.beat++;
    const z=L.zom;
    const dx=L.x-z.x, dy=L.y-z.y;
    // greedy, but it will not walk into a wall — the long axis first
    const tries = Math.abs(dx)>=Math.abs(dy)
      ? [[Math.sign(dx),0],[0,Math.sign(dy)]]
      : [[0,Math.sign(dy)],[Math.sign(dx),0]];
    for(const [sx,sy] of tries){
      if(!sx && !sy) continue;
      if(cell(z.x+sx, z.y+sy)!=='#'){ z.x+=sx; z.y+=sy; break; }
    }
    face();
    return (z.x===L.x && z.y===L.y);
  }

  /* ------------------------------------------------------ run a program */
  function run(steps){
    if(busy || !L || L.done) return;
    busy=true;
    let i=0;
    (function next(){
      if(!L || L.done){ busy=false; return; }
      if(i>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        if(!won()) msg(t('Program finished — but you are not out yet.'));
        return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,110); }
      if(s.name==='__if'||s.name==='__call'){ CODE.highlight(s); return setTimeout(next,110); }
      CODE.highlight(s);
      act(s.name, ()=>{
        if(beat()){ caught(); busy=false; return; }
        if(won()){ busy=false; return; }
        setTimeout(next,60);
      });
    })();
  }
  function act(name, done){
    if(name==='left')    return turn(-1,done);
    if(name==='right')   return turn( 1,done);
    if(name==='forward') return stepFwd(done);
    if(name==='wait')    return setTimeout(done,240);
    done();
  }
  function turn(d,done){
    L.dir=(L.dir+d+4)%4;
    ease(G.yaw, Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]), 200, v=>G.yaw=v, done);
  }
  function stepFwd(done){
    const nx=L.x+DIRS[L.dir][0], ny=L.y+DIRS[L.dir][1];
    if(cell(nx,ny)==='#'){
      msg(t('You walked into a wall. Count the tiles again.'));
      hurt(); busy=false; CODE.hideTape(); return;
    }
    const fx=G.pos.x, fz=G.pos.z, tx=nx*T, tz=ny*T;
    L.x=nx; L.y=ny;
    ease(0,1,260,k=>{ G.pos.x=fx+(tx-fx)*k; G.pos.z=fz+(tz-fz)*k; }, done);
  }

  /* ------------------------------------------------------- win and lose */
  function won(){
    if(!L || !L.exit) return false;
    if(L.x!==L.exit.x || L.y!==L.exit.y) return false;
    L.done=true; stopClock(); CODE.hideTape();
    if(window.beep) beep('star');
    if(L.idx+1 < STAGES.length){
      msg(t('Out! Next corridor…'));
      setTimeout(()=>start(L.idx+1), 1100);
    } else {
      if(window.PROGRESS) PROGRESS.complete('nav');
      showResults({
        title:t('YOU GOT OUT'),
        body:t('You wrote your way out of three corridors with something chasing you.'),
        stats:`<div style="grid-column:1/-1"><b>${t('Your program')}</b><pre style="margin:6px 0 0;color:#8fd3ff">${CODE.toText().join('\n')||'—'}</pre></div>`,
        btnText:t('Back to the menu')
      });
      G.running=false;
    }
    return true;
  }
  function caught(){
    if(!L || L.done || L.caught) return;
    L.caught=true; stopClock(); hurt(); CODE.hideTape();
    msg(t('🧟 It caught you. Shorter program — every block lets it step.'));
    setTimeout(()=>reset(), 1300);
  }
  function reset(){
    if(!L) return;
    L.x=L.start.x; L.y=L.start.y; L.dir=1; L.beat=0; L.caught=false;
    L.zom.x=L.zomStart.x; L.zom.y=L.zomStart.y;
    G.pos.set(L.x*T,1.9,L.y*T);
    G.yaw=Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]);
    face(); busy=false; hud();
    startClock(L.S.secs);
    brief(L.S.brief);
  }

  /* ------------------------------------------------------------- clock */
  function startClock(secs){
    stopClock(); left=secs; paintClock();
    clockT=setInterval(()=>{
      if(!L || L.done){ stopClock(); return; }
      left--; paintClock();
      if(left<=0){ stopClock(); caught(); }
    }, 1000);
  }
  function stopClock(){ clearInterval(clockT); clockT=null; }
  function paintClock(){
    const el=document.querySelector('#navClock');
    if(!el) return;
    el.classList.remove('hidden');
    el.textContent='⏱ '+Math.max(0,left)+'s';
    el.classList.toggle('low', left<=10);
  }

  /* --------------------------------------------------------------- HUD */
  function hud(){
    document.querySelector('#missionName').textContent =
      t('Escape {n} — {name}',{n:L.idx+1, name:t(L.S.name)});
    document.querySelector('#objList').innerHTML=STAGES.map((s,i)=>
      `<li class="${i<L.idx?'done':(i===L.idx?'cur':'')}">${i<L.idx?'✔ ':'• '}${t(s.name)}</li>`).join('');
  }
  function teach(){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t('ESCAPE {n}',{n:L.idx+1})} · ${t(L.S.learn.name)}</div>
      <h2>${t(L.S.name)}</h2>
      <p>${t(L.S.brief)}</p>
      <div class="why">${t('It steps once for every block you run — and the clock is already going.')}</div>
      <button class="btn good" id="teachGo">${t('Run for it ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    el.querySelector('#teachGo').onclick=()=>{ el.classList.add('hidden'); CODE.show(); };
  }
  let mt=null;
  function brief(html){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(html);
    clearTimeout(mt); mt=setTimeout(()=>{ if(L&&!L.done) b.innerHTML=t(L.S.brief); }, 4200);
  }
  function msg(text){ brief(text); }
  function hurt(){
    const h=document.querySelector('#hurt');
    h.classList.add('on'); setTimeout(()=>h.classList.remove('on'),380);
    if(window.beep) beep('bad');
  }
  /* Timer-driven, not requestAnimationFrame: rAF stops when the tab is not
     visible, and a student who alt-tabs mid-program would come back to a
     program that never finished and a console that would not run again. */
  function ease(a,b,ms,set,done){
    const t0=performance.now();
    (function f(){
      const k=Math.min(1,(performance.now()-t0)/ms);
      set(a+(b-a)*(k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2));
      if(k<1) setTimeout(f,16); else if(done) done();
    })();
  }

  /* the corner map, drawn from the grid */
  function map(){
    if(!L) return;
    const c=document.querySelector('#map'); if(!c) return;
    const x=c.getContext('2d');
    const sc=Math.min((c.width-8)/L.w, (c.height-8)/L.h);
    const ox=(c.width-L.w*sc)/2, oy=(c.height-L.h*sc)/2;
    const px=tx=>ox+(tx+0.5)*sc, pz=tz=>oy+(tz+0.5)*sc;
    x.fillStyle='#0d1626'; x.fillRect(0,0,c.width,c.height);
    for(let y=0;y<L.h;y++) for(let tx=0;tx<L.grid[y].length;tx++){
      const ch=L.grid[y][tx];
      x.fillStyle = ch==='#' ? '#151e33' : '#33456b';
      x.fillRect(ox+tx*sc, oy+y*sc, sc-0.7, sc-0.7);
    }
    if(L.exit){
      const beat=(performance.now()%1200)/1200;
      x.beginPath(); x.arc(px(L.exit.x),pz(L.exit.y), 3+beat*6, 0, 7);
      x.strokeStyle=`rgba(168,230,207,${(1-beat)*0.8})`; x.lineWidth=2; x.stroke();
      x.fillStyle='#a8e6cf'; x.beginPath(); x.arc(px(L.exit.x),pz(L.exit.y),3.6,0,7); x.fill();
    }
    x.fillStyle='#ff6b81';
    x.beginPath(); x.arc(px(L.zom.x),pz(L.zom.y),3.6,0,7); x.fill();
    const cx=px(L.x), cy=pz(L.y);
    x.strokeStyle='#fff'; x.lineWidth=2;
    x.beginPath(); x.moveTo(cx,cy);
    x.lineTo(cx-Math.sin(G.yaw)*sc*1.2, cy-Math.cos(G.yaw)*sc*1.2); x.stroke();
    x.beginPath(); x.arc(cx,cy,3.4,0,7); x.fillStyle='#fff'; x.fill();
    const title=document.querySelector('#mapTitle');
    if(title) title.textContent=t('THE CORRIDOR');
    const leg=document.querySelector('#maplegend');
    if(leg) leg.textContent=t('Green door = out. Red = it.');
  }

  function update(dt){
    if(!L) return;
    if(L.zom.mesh) ZOMBIE.animate(L.zom.mesh, dt, 'idle');
    if(window.AVATAR) AVATAR.update(dt, false, false, true);
    map();
  }
  function stop(){
    stopClock(); L=null; busy=false;
    const el=document.querySelector('#navClock'); if(el) el.classList.add('hidden');
    CODE.setBudget(0); CODE.setGuide(null);
  }

  return { start, run, update, stop, map,
           get active(){ return !!L; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length };
})();
