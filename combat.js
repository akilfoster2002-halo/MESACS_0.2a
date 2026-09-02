/* =====================================================================
   COMBAT + MISSION 1 — "THE LOOPER"
   Enemies are shaped so the concept is the shortest path to surviving:
   one drone teaches a command, five identical drones make a loop the
   obvious move, and the boss regrows his shield between programs, so
   clicking RUN over and over cannot win — only a repeat can.
   ===================================================================== */
window.COMBAT = (function(){
  let drones=[], boss=null, bolts=[], stage=0, busy=false, hitFx=0;
  const STEP_MS=520, ITER_MS=220;   // slow enough to sweep the crosshair mid-loop

  /* ------------------------------------------------------------ enemy */
  function droneMesh(color, size, face){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),
      new THREE.MeshLambertMaterial({color}));
    g.add(body);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(size*.8,size*.8),
      new THREE.MeshLambertMaterial({map:faceTex(face), transparent:true}));
    f.position.z=size/2+0.02; g.add(f);
    g.userData.body=body;
    return g;
  }
  const faceCache={};
  function faceTex(ch){
    if(faceCache[ch]) return faceCache[ch];
    const c=document.createElement('canvas'); c.width=c.height=128;
    const x=c.getContext('2d');
    x.clearRect(0,0,128,128);
    x.font='96px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
    x.textAlign='center'; x.fillText(ch,64,98);
    const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace;
    faceCache[ch]=tx; return tx;
  }

  function spawnDrone(x,z,hp){
    const d={hp:hp||1, mesh:droneMesh(0x35c07a,1.9,'🐛'), t:Math.random()*6, dead:false};
    d.mesh.position.set(x,2.2,z);
    G.roomGroup.add(d.mesh);
    G.hits.push(d.mesh.userData.body);
    d.mesh.userData.body.userData.drone=d;
    drones.push(d);
    return d;
  }
  function spawnBoss(shield){
    const b={shield:shield, max:shield, mesh:droneMesh(0x8b5cf6,5,'👾'), seg:[], t:0, dead:false};
    b.mesh.position.set(0,3.6,-16);
    G.roomGroup.add(b.mesh);
    G.hits.push(b.mesh.userData.body);
    b.mesh.userData.body.userData.boss=b;
    for(let i=0;i<shield;i++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9),
        new THREE.MeshLambertMaterial({color:0xffd54a}));
      b.mesh.add(s); b.seg.push(s);
    }
    layoutShield(b);
    boss=b; return b;
  }
  function layoutShield(b){
    b.seg.forEach((s,i)=>{
      s.visible = i < b.shield;
      const a=(i/b.max)*Math.PI*2;
      s.position.set(Math.cos(a)*4.2, Math.sin(a)*2.2, 0);
    });
  }

  /* ----------------------------------------------------------- shots */
  function fireShot(){
    const dir=new THREE.Vector3(0,0,-1).applyQuaternion(G.camera.quaternion);
    const ray=new THREE.Raycaster(G.camera.position.clone(), dir); ray.far=90;
    let hit=ray.intersectObjects(G.hits,false)[0];
    if(!hit) hit=assist(dir);   // forgiving cone: the lesson is the loop, not the aim
    const end = hit ? hit.point.clone()
                    : G.camera.position.clone().add(dir.multiplyScalar(60));
    bolt(G.camera.position.clone().add(new THREE.Vector3(0,-0.5,0)), end);
    if(!hit) { msg(t('Missed — put the crosshair on the target.')); return; }
    const d=hit.object.userData.drone, b=hit.object.userData.boss;
    if(d && !d.dead){
      d.hp--; flash(d.mesh);
      if(d.hp<=0) kill(d);
    } else if(b && !b.dead){
      b.shield--; layoutShield(b); flash(b.mesh);
      if(b.shield<=0) killBoss(b);
    }
  }
  // if the crosshair is close but not exactly on a target, count it — these are
  // eight-year-olds holding a mouse, and the skill being taught is the loop
  function assist(dir){
    const CONE=0.26, from=G.camera.position;
    let best=null, bestAng=CONE;
    const targets=[...drones.map(d=>d.mesh), ...(boss?[boss.mesh]:[])];
    for(const m of targets){
      const to=m.getWorldPosition(new THREE.Vector3()).sub(from);
      const dist=to.length();
      if(dist>90) continue;
      const ang=dir.angleTo(to.normalize());
      if(ang<bestAng){ bestAng=ang; best=m; }
    }
    if(!best) return null;
    return {point:best.getWorldPosition(new THREE.Vector3()), object:best.userData.body};
  }
  function bolt(from,to){
    const m=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    m.position.copy(from); G.scene.add(m);
    bolts.push({m, from, to, t:0});
    if(window.beep) beep('pop');
  }
  function flash(mesh){
    const mat=mesh.userData.body.material;
    const old=mat.color.getHex();
    mat.color.setHex(0xffffff);
    setTimeout(()=>mat.color.setHex(old),110);
  }
  function kill(d){
    d.dead=true;
    G.roomGroup.remove(d.mesh);
    G.hits=G.hits.filter(h=>h!==d.mesh.userData.body);
    drones=drones.filter(x=>x!==d);
    if(window.beep) beep('star');
  }
  function killBoss(b){
    b.dead=true;
    G.roomGroup.remove(b.mesh);
    G.hits=G.hits.filter(h=>h!==b.mesh.userData.body);
    boss=null;
    if(window.beep) beep('star');
  }

  /* ------------------------------------------------------ run a program */
  function runProgram(steps){
    if(busy) return;
    busy=true;
    let i=0;
    (function next(){
      if(i>=steps.length){
        busy=false;
        CODE.highlight(null);
        setTimeout(()=>{ CODE.hideTape(); afterProgram(); }, 500);
        return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId, s.i, s.n); setTimeout(next, ITER_MS); return; }
      CODE.highlight(s);
      if(s.name==='shoot') fireShot();
      setTimeout(next, STEP_MS);
    })();
  }
  function afterProgram(){
    if(boss && !boss.dead && boss.shield>0 && boss.shield<boss.max){
      // the whole point of the fight: one shot at a time can never finish him
      msg(t('THE LOOPER: “Not enough! My shield grows back!”'));
      setTimeout(()=>{ if(boss){ boss.shield=boss.max; layoutShield(boss); } }, 1200);
    }
    checkStage();
  }

  /* --------------------------------------------------------- mission */
  const STAGES=[
    { brief:'Your gun runs your <b>program</b>. Open the console with <b>C</b>, add one <b>shoot()</b> block, and press RUN.',
      obj:['Program one shot','Clear the drones','Beat THE LOOPER'],
      palette:['shoot'], setup(){ spawnDrone(0,-14,1); } },
    { brief:'Three of them. You could add three <b>shoot()</b> blocks… or use a <b>repeat</b> block and put one shoot inside it.',
      palette:['shoot','repeat'], setup(){ spawnDrone(-6,-15,1); spawnDrone(0,-17,1); spawnDrone(6,-15,1); } },
    { brief:'Five now. Set the <b>repeat</b> number to 5 and keep one <b>shoot()</b> inside it. Aim at a new drone each time.',
      palette:['shoot','repeat'], setup(){ for(let i=0;i<5;i++) spawnDrone(-8+i*4,-15-((i%2)*3),1); } },
    { brief:'<b>THE LOOPER</b> has an 8-part shield that grows back after every program. One shot at a time will never win — <b>repeat 8</b> in a single program will.',
      boss:true, palette:['shoot','repeat'], setup(){ spawnBoss(8); } }
  ];
  function startStage(n){
    stage=n;
    const s=STAGES[n];
    CODE.setPalette(s.palette);
    CODE.clear();
    s.setup();
    brief(s.brief);
    objectives();
  }
  function checkStage(){
    const s=STAGES[stage];
    if(s.boss){ if(!boss) return finish(); return; }
    if(!drones.length){
      if(stage+1<STAGES.length){
        msg(t('Clear! Next wave…'));
        setTimeout(()=>startStage(stage+1), 900);
      } else finish();
    }
  }
  function objectives(){
    const ol=document.querySelector('#objList');
    const names=['Program one shot','Clear three drones','Clear five drones','Beat THE LOOPER'];
    ol.innerHTML=names.map((n,i)=>
      `<li class="${i<stage?'done':(i===stage?'cur':'')}">${i<stage?'✔ ':'• '}${t(n)}</li>`).join('');
    document.querySelector('#missionName').textContent=t('Mission 1 — Loops');
  }
  function finish(){
    busy=false;
    brief('');
    const code=CODE.toText().join('\n');
    document.querySelector('#done').classList.remove('hidden');
    document.querySelector('#dTitle').textContent=t('MISSION 1 COMPLETE');
    document.querySelector('#dBody').innerHTML=t('You beat THE LOOPER with a <b>loop</b>. One block, written once, ran again and again — that is what a loop is for.');
    document.querySelector('#dStats').innerHTML=
      `<div style="grid-column:1/-1"><b>${t('The code you wrote')}</b><pre style="margin:6px 0 0;color:#8ff0ff">${code||'—'}</pre></div>`;
    document.querySelector('#dAgain').textContent=t('Play again');
    G.running=false;
  }

  /* ---------------------------------------------------------- update */
  function update(dt){
    // bolts
    bolts=bolts.filter(b=>{
      b.t+=dt/0.14;
      b.m.position.lerpVectors(b.from,b.to,Math.min(b.t,1));
      if(b.t>=1){ G.scene.remove(b.m); return false; }
      return true;
    });
    // drones drift toward the player and bob
    drones.forEach(d=>{
      d.t+=dt;
      d.mesh.position.y=2.2+Math.sin(d.t*2)*0.35;
      const to=new THREE.Vector3(G.pos.x,d.mesh.position.y,G.pos.z).sub(d.mesh.position);
      const dist=to.length();
      if(dist>6) d.mesh.position.add(to.normalize().multiplyScalar(1.5*dt));
      d.mesh.lookAt(G.pos.x,d.mesh.position.y,G.pos.z);
    });
    if(boss){
      boss.t+=dt;
      boss.mesh.position.y=3.6+Math.sin(boss.t*1.4)*0.5;
      boss.mesh.rotation.y=Math.sin(boss.t*0.5)*0.5;
      boss.seg.forEach((s,i)=>{ const a=(i/boss.max)*Math.PI*2 + boss.t*0.8;
        s.position.set(Math.cos(a)*4.2, Math.sin(a)*2.2, 0); });
    }
    if(hitFx>0) hitFx-=dt;
  }

  /* ----------------------------------------------------------- utils */
  function brief(html){
    const b=document.querySelector('#briefing');
    if(!html){ b.classList.add('hidden'); return; }
    b.classList.remove('hidden'); b.innerHTML=t(html);
  }
  let msgT=null;
  function msg(text){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=text;
    clearTimeout(msgT);
    msgT=setTimeout(()=>{ if(STAGES[stage]) brief(STAGES[stage].brief); },2200);
  }
  function reset(){ drones=[]; boss=null; bolts=[]; stage=0; busy=false; }

  return { start(){ reset(); startStage(0); }, update, runProgram, reset,
           get busy(){ return busy; } };
})();
