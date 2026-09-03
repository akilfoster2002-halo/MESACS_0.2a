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
  const CHASE = 1.6;     // world units per second — a walk, but it never stops
  const GRACE = 5;       // and how long it stands and looks at you first

  let L=null, busy=false;

  /* ------------------------------------------------------------ levels */
  const STAGES=[
    /* Speeds are world units per second, and the whole ramp runs at half the
       pace it used to: a tile is 4 units, so 0.5 is eight seconds of thinking
       time per tile and 1.05 is under four. It still climbs stage to stage —
       that is the pressure the mission is built on — it just starts somewhere
       a student reading the console for the first time can survive. */
    { name:'Straight Shot', budget:6, speed:0.5,
      learn:{ name:'Commands', text:'A command is one instruction. The computer does it once, exactly as written.', code:'forward()' },
      brief:'It is behind you and it does not stop. <b>forward()</b> moves one tile — count the tiles to the green door and write that many.',
      pal:['forward','left','right'],
      grid:['############',
            '#Z...S....X#',
            '############'] },

    { name:'Round the Corner', budget:9, speed:0.6,
      learn:{ name:'Turning', text:'left() and right() turn you a quarter turn on the spot. They do not move you.', code:'forward()\nright()\nforward()' },
      brief:'The way out bends. <b>right()</b> and <b>left()</b> turn you without moving — so a turn costs you time and no ground.',
      pal:['forward','left','right'],
      grid:['##########',
            '#Z...S...#',
            '#######.##',
            '#######.##',
            '#######X##',
            '##########'] },

    { name:'Zig Zag', budget:12, speed:0.8,
      learn:{ name:'Order', text:'The computer does your blocks strictly top to bottom. Turn in the wrong place and the rest of the program is walking into a wall.', code:'forward()\nright()\nforward()\nleft()' },
      brief:'Three turns this time. Work out the whole route <b>before</b> you write it — you have no time to find it by trying.',
      pal:['forward','left','right'],
      grid:['#########',
            '#Z...S..#',
            '#######.#',
            '#####...#',
            '#####X###',
            '#########'] },

    { name:'The Long Hall', budget:7, speed:0.85,
      learn:{ name:'Loops', text:'A loop runs the blocks inside it again and again, so you write the move once instead of ten times.', code:'repeat 10\n  forward()\nend' },
      brief:'Ten tiles, and only <b>7 blocks</b> allowed. Ten forward() blocks will not fit — <b>repeat</b> one instead.',
      pal:['forward','left','right','repeat'],
      grid:['#################',
            '#Z...S.........X#',
            '#################'] },

    { name:'Switchback', budget:12, speed:0.95,
      learn:{ name:'Loops and turns', text:'Each straight run is its own repeat. Count the tiles in one leg, loop that, then turn and count the next.', code:'repeat 7\n  forward()\nend\nright()' },
      brief:'Long legs with turns between them. One <b>repeat</b> per straight — count each leg on its own.',
      pal:['forward','left','right','repeat'],
      grid:['##############',
            '#Z...S.......#',
            '############.#',
            '#............#',
            '#X############',
            '##############'] },

    { name:'The Long Way Round', budget:11, speed:1.05,
      learn:{ name:'All of it', text:'Commands, turns and loops together. The exit is close by, but the only way there is the long way — and it is right behind you.', code:'repeat 8\n  forward()\nend\nright()\nrepeat 4\n  forward()\nend' },
      brief:'The door is four tiles away and there is no way through. Go the whole way round, in <b>11 blocks</b>, before it reaches you.',
      pal:['forward','left','right','repeat'],
      grid:['###############',
            '#Z...S........#',
            '#############.#',
            '#############.#',
            '#############.#',
            '#####.........#',
            '#####X#########',
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
    document.querySelector('#mapwrap').classList.add('hidden');   // no map here

    L={ idx, S, grid:S.grid, w:S.grid[0].length, h:S.grid.length,
        x:0, y:0, dir:1, start:null, exit:null, done:false, caught:false, grace:GRACE,
        zom:{ cx:0, cy:0, tx:0, ty:0, wx:0, wz:0, mesh:null }, zomStart:null };

    S.grid.forEach((row,y)=>[...row].forEach((c,x)=>{
      if(c==='#'){ tile(x,y,PAL.wall,5.5,2.75);
        G.solids.push({x1:x*T-T/2,x2:x*T+T/2,z1:y*T-T/2,z2:y*T+T/2}); return; }
      tile(x,y,PAL.floor,0.4,0);
      if(c==='S'){ L.x=x; L.y=y; L.start={x,y}; tile(x,y,PAL.safe,0.45,0.03); }
      if(c==='X'){ L.exit={x,y}; tile(x,y,PAL.exit,0.5,0.05); }
      if(c==='Z'){ L.zomStart={x,y}; placeZombie(x,y); }
    }));

    // you
    G.pos.set(L.x*T, 1.9, L.y*T);
    G.yaw=Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]); G.pitch=-0.12;
    G.vel.y=0; G.onGround=true;
    if(window.AVATAR) AVATAR.attach();

    // and it
    try{
      const z=await ZOMBIE.make({skin:'zombieA', height:2.2});
      G.roomGroup.add(z); L.zom.mesh=z;
      placeZombie(L.zomStart.x, L.zomStart.y);   // now that there is a body to place
      ZOMBIE.animate(z,0,'idle');
    }catch(e){ console.warn('chaser failed to load',e); }

    CODE.setPalette(S.pal); CODE.setBudget(S.budget); CODE.clear();
    CODE.setGuide({ brief:S.brief, name:S.learn.name, text:S.learn.text, code:S.learn.code });
    hud(); brief(S.brief);
    teach();
  }

  /* --------------------------------------------------------- the world */
  function cell(x,y){
    if(y<0||y>=L.h||x<0||x>=L.grid[y].length) return '#';
    return L.grid[y][x];
  }
  function placeZombie(x,y){
    const z=L.zom;
    z.cx=z.tx=x; z.cy=z.ty=y;
    z.wx=x*T; z.wz=y*T;
    if(z.mesh) z.mesh.position.set(z.wx, 0, z.wz);
  }
  /* The next tile it should walk to: the first step of the shortest route
     to you.  Chasing greedily works down a straight corridor and stalls at
     the first bend that leads away from you, and these bend a lot. */
  function aim(){
    const z=L.zom;
    z.cx=z.tx; z.cy=z.ty;
    if(z.cx===L.x && z.cy===L.y) return;
    const key=(x,y)=>y*1000+x;
    const from=new Map();
    const seen=new Set([key(z.cx,z.cy)]);
    let edge=[[z.cx,z.cy]];
    while(edge.length){
      const nextEdge=[];
      for(const [x,y] of edge){
        for(const [dx,dy] of DIRS){
          const nx=x+dx, ny=y+dy, k=key(nx,ny);
          if(cell(nx,ny)==='#' || seen.has(k)) continue;
          seen.add(k); from.set(k,[x,y]);
          if(nx===L.x && ny===L.y){
            // walk the trail back until the step that leaves its own tile
            let cur=[nx,ny], p=from.get(k);
            while(p && !(p[0]===z.cx && p[1]===z.cy)){ cur=p; p=from.get(key(p[0],p[1])); }
            z.tx=cur[0]; z.ty=cur[1]; return;
          }
          nextEdge.push([nx,ny]);
        }
      }
      edge=nextEdge;
    }
    z.tx=z.cx; z.ty=z.cy;                 // walled off from you entirely
  }
  /* It never stops and it never takes turns.  That is the whole clock:
     the longer you spend writing, the closer it is when you press RUN. */
  function chase(dt){
    if(!L || L.done || L.caught || !L.zom.mesh) return;
    if(!document.querySelector('#teach').classList.contains('hidden')) return;
    if(!document.querySelector('#pause').classList.contains('hidden')) return;
    const z=L.zom, spd=(L.S.speed||CHASE);
    // it stands and looks at you first, so you get a beat to read the corridor
    if(L.grace>0){
      L.grace-=dt;
      z.mesh.lookAt(G.pos.x, 0, G.pos.z);
      ZOMBIE.animate(z.mesh, dt, 'idle');
      return;
    }
    let step=spd*dt;
    while(step>0){
      const dx=z.tx*T-z.wx, dz=z.ty*T-z.wz;
      const d=Math.hypot(dx,dz);
      if(d<0.001){ aim(); if(z.tx===z.cx && z.ty===z.cy) break; continue; }
      const go=Math.min(step, d);
      z.wx += dx/d*go; z.wz += dz/d*go;
      step -= go;
    }
    z.mesh.position.set(z.wx, 0, z.wz);
    z.mesh.lookAt(G.pos.x, 0, G.pos.z);
    ZOMBIE.animate(z.mesh, dt, 'run');
    if(Math.hypot(G.pos.x-z.wx, G.pos.z-z.wz) < T*0.6) eaten();
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
        if(!L || L.caught){ busy=false; return; }
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
    L.done=true; CODE.hideTape();
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
        btnText:t('Take the quiz ▶'),
        onBtn:()=>{ document.querySelector('#done').classList.add('hidden'); if(window.QUIZ) QUIZ.start('nav'); }
      });
      G.running=false;
    }
    return true;
  }
  function eaten(){
    if(!L || L.done || L.caught) return;
    L.caught=true; busy=false; hurt(); CODE.hideTape(); CODE.close();
    msg(t('🧟 YOU HAVE BEEN EATEN. It never stops — write it faster.'));
    setTimeout(()=>reset(), 1600);
  }
  function reset(){
    if(!L) return;
    L.x=L.start.x; L.y=L.start.y; L.dir=1; L.caught=false; L.grace=GRACE;
    placeZombie(L.zomStart.x, L.zomStart.y);
    G.pos.set(L.x*T,1.9,L.y*T);
    G.yaw=Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]);
    busy=false; hud(); brief(L.S.brief);
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

  /* Called every frame, console open or not — that is the point of it. */
  function tick(dt){
    if(!L) return;
    chase(dt);
    if(window.AVATAR) AVATAR.update(dt, false, false, true);
  }
  function stop(){
    L=null; busy=false;
    document.querySelector('#mapwrap').classList.remove('hidden');
    CODE.setBudget(0); CODE.setGuide(null);
  }

  return { start, run, tick, update:tick, stop,
           get active(){ return !!L; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length };
})();
