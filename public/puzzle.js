/* =====================================================================
   COVERT OPS — real-time infiltration.  (global stays PUZZLE)

   You walk the building yourself with WASD. Code is not how you move —
   it is how you take control of the building: cameras, keypads, drones.
   Walk to a terminal, press E, and write the program that breaks it.
   ===================================================================== */
window.PUZZLE = (function(){
  const U = 4;
  let L=null, busy=false, alarmT=0;

  /* ------------------------------------------------------ operations */
  const OPS=[
    { id:'cam', name:'Blind the Camera', learn:'Loops and counting',
      brief:'A camera sweeps the hall between you and the stairs. Get to the <b>terminal</b> in the side office, reprogram the camera to stare at the wall, then cross the hall and climb to the <b>vault</b> on the floor above.',
      device:'camera',
      task:'The camera starts facing the hall. Each <b>turn()</b> swings it a quarter turn. Point it at the <b>back wall</b> and <b>hold()</b> it there.',
      pal:['turn','hold','repeat'],
      need:{ turns:2, holds:3 },
      /* ground floor, then the vault floor stacked on top of it */
      plan:[[
        '#############',
        '#S....#T....#',
        '#.....D.....#',
        '#.....#.....#',
        '###D#####D###',
        '#...........#',
        '#....C......#',
        '#...........#',
        '#########D###',
        '#...........#',
        '#....^......#',
        '#############'
      ],[
        '             ',
        '             ',
        '             ',
        '             ',
        '   ########  ',
        '   #......#  ',
        '   #......#  ',
        '   #..V...#  ',
        '   #......#  ',
        '   #. ....#  ',
        '   #. ....#  ',
        '   ########  '
      ]],
      guards:[ {route:[[1,7],[10,7],[10,5],[1,5]], speed:2.2, char:'p'} ] }
  ];

  /* ------------------------------------------------------------ build */
  async function start(n){
    const O=OPS[n||0];
    busy=false;
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[];
    G.scene.background=new THREE.Color(0x141024);
    G.scene.fog=new THREE.Fog(0x141024, 40, 150);
    G.hudOwner='puzzle'; G.missionId='puzzles';
    if(window.updateLeaveBtn) updateLeaveBtn();
    document.querySelector('#mapwrap').classList.add('hidden');

    const built = await BUILDING.build(O.plan, G.roomGroup);
    L = { O, built, guards:[], camera:null, terminal:null, vault:null,
          blinded:false, alarm:false, done:false, near:null };
    G.solids = built.solids.slice();
    G.ground = built.heightAt;              // stairs: the floor is not flat any more

    // player
    const sp=built.spots.spawn;
    G.pos.set(sp.x*U, sp.y+1.7, sp.z*U); G.yaw=0; G.pitch=0;
    if(window.AVATAR) AVATAR.attach();

    // guards, as real characters walking their beat
    for(const g of (O.guards||[])){
      const mesh = await loadChar(g.char||'p');
      const gy = built.heightAt(g.route[0][0]*U, g.route[0][1]*U);
      mesh.position.set(g.route[0][0]*U, gy, g.route[0][1]*U);
      G.roomGroup.add(mesh);
      L.guards.push({ ...g, mesh, i:0, t:0, cone:cone(mesh) });
    }
    // camera on its post
    const cs=built.spots.cameras[0];
    if(cs){
      const grp=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.8),
        new THREE.MeshLambertMaterial({color:0xcdb4f6}));
      body.position.y=3.4; grp.add(body);
      const beam=new THREE.Mesh(new THREE.ConeGeometry(2.4,7,12,1,true),
        new THREE.MeshBasicMaterial({color:0xff9aa2,transparent:true,opacity:.25,side:THREE.DoubleSide}));
      beam.rotation.x=Math.PI/2; beam.position.set(0,3.4,-3.6); grp.add(beam);
      grp.position.set(cs.x*U, cs.y, cs.z*U);
      G.roomGroup.add(grp);
      L.camera={ grp, beam, angle:0, sweep:0, dir:1, x:cs.x, z:cs.z };
    }
    // terminal + vault
    const ts=built.spots.terminals[0];
    if(ts){
      const m=new THREE.Mesh(new THREE.BoxGeometry(1.6,2.2,1.2),
        new THREE.MeshLambertMaterial({color:0x8fd3ff}));
      m.position.set(ts.x*U, ts.y+1.1, ts.z*U); G.roomGroup.add(m);
      L.terminal={ x:ts.x, z:ts.z, y:ts.y, mesh:m };
    }
    const vs=built.spots.vault;
    if(vs){
      const m=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.2,2.2),
        new THREE.MeshLambertMaterial({color:0xffe9a8}));
      m.position.set(vs.x*U, vs.y+1.2, vs.z*U); G.roomGroup.add(m);
      L.vault={ x:vs.x, z:vs.z, y:vs.y, mesh:m };
    }
    CODE.setPalette(O.pal); CODE.setBudget(0); CODE.clear();
    hud(); brief(O.brief);
    briefCard();
  }
  /* Wrap the character so the view cone hangs off an unscaled parent —
     the kit is normalised to human height when it loads. */
  async function loadChar(id){
    const g=new THREE.Group();
    if(window.AVATAR){
      try{
        const m=await AVATAR.load(id);
        g.add(m); g.userData.rig=m.userData.rig;
        return g;
      }catch(e){ console.warn('guard failed to load',e); }
    }
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2,2,1.2),
      new THREE.MeshLambertMaterial({color:0xff9aa2})));
    return g;
  }
  function cone(mesh){
    const c=new THREE.Mesh(new THREE.ConeGeometry(2.2,8,12,1,true),
      new THREE.MeshBasicMaterial({color:0xff9aa2,transparent:true,opacity:.2,side:THREE.DoubleSide}));
    c.rotation.x=Math.PI/2; c.position.set(0,1.4,-4.2);
    mesh.add(c); return c;
  }

  /* ------------------------------------------------------- the world */
  function update(dt){
    if(!L||L.done) return;
    // guards walk their route in real time
    L.guards.forEach(g=>{
      const [tx,tz]=g.route[g.i];
      const dx=tx*U-g.mesh.position.x, dz=tz*U-g.mesh.position.z;
      const d=Math.hypot(dx,dz);
      if(d<0.25){ g.i=(g.i+1)%g.route.length; }
      else {
        g.mesh.position.x += dx/d*g.speed*dt;
        g.mesh.position.z += dz/d*g.speed*dt;
        g.mesh.position.y  = L.built.heightAt(g.mesh.position.x, g.mesh.position.z,
                                              g.mesh.position.y);
        g.mesh.rotation.y = Math.atan2(-dx,-dz)+Math.PI;
      }
      if(window.AVATAR) AVATAR.animate(g.mesh, dt, d<0.25 ? 'idle' : 'walk');
      if(sees(g.mesh.position, g.mesh.rotation.y+Math.PI, 9, 0.6)) caught(t('A guard spotted you!'));
    });
    // camera sweeps unless a program has parked it
    if(L.camera && !L.blinded){
      L.camera.sweep += dt*0.7*L.camera.dir;
      if(Math.abs(L.camera.sweep)>0.9) L.camera.dir*=-1;
      L.camera.grp.rotation.y = L.camera.angle + L.camera.sweep;
      if(sees(L.camera.grp.position, L.camera.grp.rotation.y, 11, 0.5)) caught(t('The camera saw you!'));
    }
    // prompt when you can use something
    const nearT = L.terminal && dist(L.terminal)<3.2;
    const nearV = L.vault && dist(L.vault)<3.2;
    L.near = nearT ? 'terminal' : (nearV ? 'vault' : null);
    const p=document.querySelector('#usePrompt');
    if(p){
      p.classList.toggle('hidden', !L.near);
      if(L.near==='terminal') p.innerHTML=t('<kbd>E</kbd> use the terminal');
      if(L.near==='vault')    p.innerHTML= L.blinded ? t('<kbd>E</kbd> open the vault')
                                                     : t('The camera is still sweeping — it will call this in.');
    }
  }
  /* the building has storeys now, so reaching something means being on the
     same floor as it, not just standing above or below it */
  function feet(){ return G.pos.y - 1.7; }
  function dist(o){
    if(o.y!==undefined && Math.abs(o.y - feet()) > 2.6) return Infinity;
    return Math.hypot(o.x*U-G.pos.x, o.z*U-G.pos.z);
  }
  function sees(from, yaw, range, halfAngle){
    if(Math.abs(from.y - feet()) > 2.6) return false;   // a floor is in the way
    const dx=G.pos.x-from.x, dz=G.pos.z-from.z;
    const d=Math.hypot(dx,dz);
    if(d>range || d<0.001) return false;
    const facing=new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
    const to=new THREE.Vector2(dx/d, dz/d);
    if(facing.dot(to) < Math.cos(halfAngle)) return false;
    return !blocked(from.x,from.z,G.pos.x,G.pos.z);
  }
  function blocked(ax,az,bx,bz){
    const eye=feet()+1.2;
    for(const s of G.solids){
      if(s.y1!==undefined && (eye<=s.y1 || eye>=s.y2)) continue;
      for(let i=1;i<12;i++){
        const k=i/12, px=ax+(bx-ax)*k, pz=az+(bz-az)*k;
        if(px>s.x1&&px<s.x2&&pz>s.z1&&pz<s.z2) return true;
      }
    }
    return false;
  }
  function caught(why){
    if(!L || L.alarm || L.done) return;
    L.alarm=true;
    document.querySelector('#hurt').classList.add('on');
    if(window.beep) beep('bad');
    brief('🚨 '+why+' '+t('Back to the entrance.'));
    setTimeout(()=>{
      document.querySelector('#hurt').classList.remove('on');
      const sp=L.built.spots.spawn;
      G.pos.set(sp.x*U, sp.y+1.7, sp.z*U);
      L.alarm=false; brief(L.O.brief);
    }, 1200);
  }

  /* -------------------------------------------------------- using it */
  function use(){
    if(!L||busy) return;
    if(L.near==='terminal'){ CODE.show(); taskCard(); return; }
    if(L.near==='vault'){
      if(!L.blinded){ brief(t('Not while the camera is sweeping — it saw you come up.')); return; }
      win();
    }
  }
  /* a program here drives the DEVICE, not the player */
  function run(steps){
    if(!L||busy) return;
    busy=true;
    let turns=0, holds=0, i=0;
    (function next(){
      if(i>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        judge(turns,holds); return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,140); }
      if(s.name==='__if'||s.name==='__call'){ CODE.highlight(s); return setTimeout(next,140); }
      CODE.highlight(s);
      if(s.name==='turn'){ turns++; if(L.camera){ L.camera.angle += Math.PI/2; L.camera.sweep=0;
        L.camera.grp.rotation.y=L.camera.angle; } }
      if(s.name==='hold'){ holds++; }
      setTimeout(next, 420);
    })();
  }
  function judge(turns,holds){
    const need=L.O.need;
    if(turns===need.turns && holds>=need.holds){
      L.blinded=true;
      if(L.camera){ L.camera.beam.material.color.setHex(0xa8e6cf); L.camera.beam.material.opacity=.12; }
      if(window.beep) beep('star');
      brief(t('✅ Camera parked facing the wall. The hall is yours — get to the vault.'));
      hud();
    } else if(turns!==need.turns){
      brief(t('The camera is still pointing at the hall. It needs <b>{n}</b> quarter turns — count them.',{n:need.turns}));
      if(window.beep) beep('bad');
    } else {
      brief(t('It swung back. <b>hold()</b> it there at least <b>{n}</b> times.',{n:need.holds}));
      if(window.beep) beep('bad');
    }
  }
  function win(){
    L.done=true;
    if(window.PROGRESS) PROGRESS.complete('puzzles');
    showResults({
      title:t('OPERATION COMPLETE'),
      body:t('You blinded the camera with a program and walked out with the data.'),
      stats:`<div style="grid-column:1/-1"><b>${t('Your program')}</b><pre style="margin:6px 0 0;color:#8fd3ff">${CODE.toText().join('\n')||'—'}</pre></div>`,
      btnText:t('Back to the menu')
    });
    G.running=false;
  }

  /* ------------------------------------------------------------ HUD */
  function briefCard(){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t('OPERATION 1')} · ${t(L.O.learn)}</div>
      <h2>${t(L.O.name)}</h2>
      <p>${t(L.O.brief)}</p>
      <div class="why">${t('You walk with W A S D. Code is for the building, not your legs.')}</div>
      <button class="btn good" id="teachGo">${t('Move out ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    el.querySelector('#teachGo').onclick=()=>{ el.classList.add('hidden'); lockPointer(document.querySelector('#view')); };
  }
  function taskCard(){
    const b=document.querySelector('#conHint');
    if(b) b.textContent=t(L.O.task).replace(/<[^>]+>/g,'');
    brief(L.O.task);
  }
  function hud(){
    document.querySelector('#missionName').textContent=t('Operation 1 — {n}',{n:t(L.O.name)});
    document.querySelector('#objList').innerHTML=
      `<li class="${L.blinded?'done':'cur'}">📷 ${t('Blind the camera from the terminal')}</li>
       <li class="${L.done?'done':''}">💾 ${t('Cross the hall and climb to the vault')}</li>
       <li>🚶 ${t('Walk with W A S D — guards patrol in real time')}</li>`;
  }
  let mt=null;
  function brief(html){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(html);
    clearTimeout(mt); mt=setTimeout(()=>{ if(L&&!L.done) b.innerHTML=t(L.O.brief); }, 4200);
  }

  return {
    start, run, update, use,
    get active(){ return !!L; },
    get busy(){ return busy; },
    stop(){ L=null; busy=false; G.ground=null;
      document.querySelector('#mapwrap').classList.remove('hidden');
      const p=document.querySelector('#usePrompt'); if(p) p.classList.add('hidden');
      CODE.setBudget(0); CODE.setConditions(['red','blue']); },
    retry(){ if(L) start(0); },
    count: OPS.length
  };
})();
