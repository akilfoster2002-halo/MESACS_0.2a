/* =====================================================================
   COMBAT — enemies, cover, health, the firing range and Missions 1-3.
   Enemies are shaped so the concept is the shortest path to surviving:
   identical drones make a loop obvious, colour-shielded drones make an
   if necessary, and a boss with a repeating pattern makes a function
   worth writing. They shoot back, so standing still is not a plan.
   ===================================================================== */
window.COMBAT = (function(){

  const PAL={ mint:0xa8e6cf, peach:0xffb4a2, lav:0xcdb4f6, blush:0xffc8dd,
              sky:0x8fd3ff, butter:0xffe9a8, rose:0xff9aa2, sand:0xffd8a8 };

  /* enemy kinds — different jobs, different damage */
  const KIND={
    buzzer :{hp:1, size:1.9, color:PAL.mint,  face:'🐛', dmg:6,  fire:2600, speed:1.6, range:52, bolt:PAL.mint},
    slugger:{hp:2, size:2.6, color:PAL.sand,  face:'🐌', dmg:12, fire:3400, speed:0.9, range:46, bolt:PAL.peach},
    sniper :{hp:1, size:2.1, color:PAL.lav,   face:'👁️', dmg:20, fire:4200, speed:0.5, range:95, bolt:PAL.rose, tell:900},
    swarm  :{hp:1, size:1.5, color:PAL.blush, face:'🦟', dmg:4,  fire:2000, speed:2.4, range:40, bolt:PAL.blush}
  };

  let enemies=[], boss=null, bolts=[], foeBolts=[], obstacles=[];
  let runToken=0;                       // bumped whenever the field is torn down
  let stage=0, busy=false, mission=null, hp=100, lastHurt=0, dead=false, targetCol=null;
  let stageDone=false, checkT=null;
  const MAXHP=100, STEP_MS=520, ITER_MS=210;
  // INVARIANT: ARMOUR_RESEAL < MANUAL_CD. Armour must always be back to full
  // before the trigger can fire again, so no amount of clicking wears a wave
  // down - only shots fired close together, which means a program.
  const MANUAL_CD=2400, ARMOUR_RESEAL=1500;
  let lastManual=-9999;

  /* ------------------------------------------------------------ art */
  const faceCache={};
  function faceTex(ch){
    if(faceCache[ch]) return faceCache[ch];
    const c=document.createElement('canvas'); c.width=c.height=128;
    const x=c.getContext('2d');
    x.font='96px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
    x.textAlign='center'; x.fillText(ch,64,98);
    const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace;
    faceCache[ch]=tx; return tx;
  }
  function shell(color,size,face){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),
      new THREE.MeshLambertMaterial({color}));
    g.add(body);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(size*.8,size*.8),
      new THREE.MeshLambertMaterial({map:faceTex(face),transparent:true}));
    f.position.z=size/2+0.02; g.add(f);
    g.userData.body=body;
    return g;
  }

  /* ------------------------------------------------ health bars ------
     Without these, resealing armour just looks like a gun that does
     nothing. The bar shows the damage landing - and the reseal.        */
  function roundRectC(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b);
    x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r);
    x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
  function makeBar(o, height){
    const c=document.createElement('canvas'); c.width=160; c.height=34;
    o.barCtx=c.getContext('2d');
    o.barTex=new THREE.CanvasTexture(c); o.barTex.colorSpace=THREE.SRGBColorSpace;
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:o.barTex, transparent:true}));
    spr.scale.set(3.2,0.68,1); spr.position.y=height;
    o.mesh.add(spr); o.bar=spr; drawBar(o);
  }
  function drawBar(o, mode){
    const x=o.barCtx; if(!x) return;
    const isBoss = !!o.seg;
    const cur = isBoss ? o.shield : o.hp;
    const max = o.max || 1;
    x.clearRect(0,0,160,34);
    x.fillStyle = mode==='reseal' ? 'rgba(255,255,255,.92)' : 'rgba(29,23,48,.88)';
    roundRectC(x,3,7,154,20,9); x.fill();
    x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=2; roundRectC(x,3,7,154,20,9); x.stroke();
    const pad=7, w=(154-pad*2)/max;
    for(let i=0;i<max;i++){
      x.fillStyle = i<cur ? (cur/max>0.5?'#a8e6cf':'#ffd8a8') : '#4b3f70';
      x.fillRect(3+pad+i*w+1, 12, Math.max(3,w-3), 10);
    }
    o.barTex.needsUpdate=true;
  }
  function pulseBar(o,mode){ drawBar(o,mode); setTimeout(()=>drawBar(o),240); }

  /* -------------------------------------------------------- spawning */
  function spawn(kind,x,z,shieldColor,armour){
    const K=KIND[kind];
    const e={kind, K, hp:armour||K.hp, max:armour||K.hp, armour:!!armour, hurtAt:0, dmg:K.dmg, shield:shieldColor||null,
             mesh:shell(shieldColor? (shieldColor==='red'?PAL.rose:PAL.sky) : K.color, K.size, K.face),
             t:Math.random()*4, next:performance.now()+K.fire+Math.random()*1200, dead:false};
    e.mesh.position.set(x, 2.2, z);
    if(shieldColor){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(K.size*0.95,0.14,6,18),
        new THREE.MeshLambertMaterial({color: shieldColor==='red'?0xff6b81:0x5ec8ff}));
      ring.rotation.x=Math.PI/2; e.mesh.add(ring); e.ring=ring;
    }
    G.roomGroup.add(e.mesh);
    G.hits.push(e.mesh.userData.body);
    e.mesh.userData.body.userData.enemy=e;
    makeBar(e, K.size/2+0.95);
    enemies.push(e);
    return e;
  }
  function spawnBoss(cfg){
    const b={name:cfg.name, shield:cfg.shield, max:cfg.shield, dmg:cfg.dmg||15,
             mesh:shell(cfg.color||PAL.lav, cfg.size||5, cfg.face||'👾'),
             seg:[], t:0, dead:false, cycle:cfg.cycle||null, color:cfg.startColor||null,
             next:performance.now()+2200, regrow:cfg.regrow!==false, hidden:cfg.hidden||0};
    b.mesh.position.set(0,4,-18);
    G.roomGroup.add(b.mesh);
    G.hits.push(b.mesh.userData.body);
    b.mesh.userData.body.userData.boss=b;
    for(let i=0;i<b.max;i++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(.95,.95,.95),
        new THREE.MeshLambertMaterial({color:PAL.butter}));
      b.mesh.add(s); b.seg.push(s);
    }
    makeBar(b,(cfg.size||5)/2+1.4);
    layout(b); boss=b; return b;
  }
  function layout(b){
    b.seg.forEach((s,i)=>{ s.visible=i<b.shield;
      s.material.color.setHex(b.color==='red'?0xff9aa2 : b.color==='blue'?0x8fd3ff : PAL.butter); });
    if(b.ringColor) b.mesh.userData.body.material.color.setHex(b.ringColor);
  }

  /* ------------------------------------------------------- obstacles */
  function addObstacle(x,z,w,d,h,color){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h||4.5,d),
      new THREE.MeshLambertMaterial({color:color||PAL.lav}));
    m.position.set(x,(h||4.5)/2,z);
    G.roomGroup.add(m);
    G.solids.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2});
    obstacles.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2});
    return m;
  }
  // does a wall sit between these two points? (2-D segment vs box)
  function blocked(ax,az,bx,bz){
    for(const o of obstacles){
      const steps=14;
      for(let i=1;i<steps;i++){
        const t=i/steps, px=ax+(bx-ax)*t, pz=az+(bz-az)*t;
        if(px>o.x1&&px<o.x2&&pz>o.z1&&pz<o.z2) return true;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------- player */
  function damage(n){
    if(dead||hp<=0) return;
    hp=Math.max(0,hp-n); lastHurt=performance.now();
    drawHP(); hurtFlash(); dmgNum(n);
    if(window.beep) beep('bad');
    if(hp<=0) down();
  }
  function drawHP(){
    const f=document.querySelector('#hpFill'), n=document.querySelector('#hpNum');
    if(!f) return;
    f.style.width=hp+'%'; f.classList.toggle('low',hp<=35);
    n.textContent=Math.round(hp);
  }
  function hurtFlash(){
    const h=document.querySelector('#hurt');
    h.classList.add('on'); setTimeout(()=>h.classList.remove('on'),220);
  }
  function dmgNum(n){
    const d=document.createElement('div'); d.className='dmg'; d.textContent='-'+n;
    d.style.left=(46+Math.random()*8)+'%'; d.style.top=(52+Math.random()*6)+'%';
    document.querySelector('#dmgNums').appendChild(d);
    setTimeout(()=>d.remove(),820);
  }
  function down(){
    dead=true; busy=false;
    CODE.hideTape();
    const el=document.querySelector('#downed');
    el.classList.remove('hidden');
    el.innerHTML=`<div style="font-size:60px">💥</div>
      <div>${t('You were knocked out!')}</div>
      <div style="font-size:17px;color:var(--muted);max-width:460px">${t('Nothing is lost — the wave starts again. Try using cover: put a block between you and them.')}</div>
      <button class="btn good" id="respawn">${t('Try again ▶')}</button>`;
    el.querySelector('#respawn').onclick=()=>{
      el.classList.add('hidden'); dead=false; hp=MAXHP; drawHP();
      startStage(stage);
    };
  }

  /* ----------------------------------------------------------- shots */
  function playerShot(color, manual){
    const dir=new THREE.Vector3(0,0,-1).applyQuaternion(G.camera.quaternion);
    const ray=new THREE.Raycaster(G.camera.position.clone(), dir); ray.far=110;
    let hit=ray.intersectObjects(G.hits,false)[0];
    if(!hit || (!hit.object.userData.enemy && !hit.object.userData.boss)) hit=assist(dir)||hit;
    const muzzle=G.camera.position.clone()
      .add(dir.clone().multiplyScalar(1.4)).add(new THREE.Vector3(0,-0.42,0));
    const end=hit? hit.point.clone() : G.camera.position.clone().add(dir.multiplyScalar(70));
    bolt(muzzle,end, color==='red'?0xff9aa2 : color==='blue'?0x8fd3ff : 0x7fe6ff);
    if(window.GUN) GUN.kick();
    if(!hit){ msg(t('Missed — put the crosshair on the target.')); return; }
    const e=hit.object.userData.enemy, b=hit.object.userData.boss;
    if(e && !e.dead){
      if(e.shield && e.shield!==color){
        spark(e.mesh.position, e.shield==='red'?0xff6b81:0x5ec8ff);
        msg(t('That shield is {c} — use the {c} bolt!',{c:t(e.shield)}));
        return;
      }
      e.hp--; e.hurtAt=performance.now(); flash(e.mesh); hitMark(); drawBar(e);
      if(e.hp<=0) kill(e);
      else if(e.armour) msg(t('Its armour is resealing — hit it again <b>fast</b>.'));
    } else if(b && !b.dead){
      if(manual){
        // one-at-a-time trigger pulls must not beat a boss, or the loop lesson
        // evaporates - so say why instead of just doing nothing
        spark(b.mesh.position,0xffffff);
        msg(t('{n}: “Your trigger finger is too slow! Only a program can break my shield.”',{n:t(b.name)}));
        return;
      }
      if(b.cycle && b.color && b.color!==color){
        spark(b.mesh.position, 0xffffff);
        msg(t('PRISM is {c} right now — check the colour first!',{c:t(b.color)}));
        return;
      }
      b.shield--; layout(b); flash(b.mesh); hitMark(); drawBar(b);
      if(b.shield<=0) killBoss(b);
    }
  }
  function assist(dir){
    const CONE=0.26, from=G.camera.position;
    let best=null,bestAng=CONE;
    const targets=[...enemies.map(e=>e.mesh), ...(boss?[boss.mesh]:[])];
    for(const m of targets){
      const to=m.getWorldPosition(new THREE.Vector3()).sub(from);
      if(to.length()>110) continue;
      const ang=dir.angleTo(to.clone().normalize());
      if(ang<bestAng){ bestAng=ang; best=m; }
    }
    return best? {point:best.getWorldPosition(new THREE.Vector3()), object:best.userData.body} : null;
  }
  function bolt(from,to,color){
    const m=new THREE.Mesh(new THREE.SphereGeometry(.24,8,8),
      new THREE.MeshBasicMaterial({color:color||0x7fe6ff}));
    m.position.copy(from); G.scene.add(m);
    bolts.push({m,from,to,t:0});
    if(window.beep) beep('pop');
  }
  function foeShot(e){
    const from=e.mesh.position.clone();
    const to=new THREE.Vector3(G.pos.x,G.pos.y-0.2,G.pos.z);
    const m=new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),
      new THREE.MeshBasicMaterial({color:e.K.bolt}));
    m.position.copy(from); G.scene.add(m);
    foeBolts.push({m, from, to, t:0, speed:0.55+Math.random()*0.15, dmg:e.dmg});
  }
  function spark(pos,color){
    const m=new THREE.Mesh(new THREE.SphereGeometry(.7,8,8),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}));
    m.position.copy(pos); G.scene.add(m);
    let k=0; (function f(){ k+=0.08; m.scale.setScalar(1+k*2); m.material.opacity=.9-k;
      if(k<0.9) requestAnimationFrame(f); else G.scene.remove(m); })();
  }
  function hitMark(){
    const c=document.querySelector('#crosshair');
    c.classList.add('hit'); setTimeout(()=>c.classList.remove('hit'),220);
  }
  function flash(mesh){
    const mat=mesh.userData.body.material, old=mat.color.getHex();
    mat.color.setHex(0xffffff); setTimeout(()=>mat.color.setHex(old),110);
  }
  function kill(e){
    e.dead=true; spark(e.mesh.position, e.K.color);
    G.roomGroup.remove(e.mesh);
    G.hits=G.hits.filter(h=>h!==e.mesh.userData.body);
    enemies=enemies.filter(x=>x!==e);
    if(window.beep) beep('star');
    // a wave cleared with the trigger has to advance too - only programs
    // used to reach checkStage(), which left the room empty and the mission stuck
    scheduleCheck();
  }
  function killBoss(b){
    b.dead=true; spark(b.mesh.position,0xffffff);
    G.roomGroup.remove(b.mesh);
    G.hits=G.hits.filter(h=>h!==b.mesh.userData.body);
    boss=null;
    if(window.beep) beep('star');
    scheduleCheck();
  }
  // whichever path emptied the room - a program, the trigger, anything - the
  // stage check happens. checkStage() is idempotent so double calls are safe.
  function scheduleCheck(){
    clearTimeout(checkT);
    checkT=setTimeout(()=>{ if(!busy) checkStage(); }, 650);
  }

  /* -------------------------------------------------- run a program */
  function currentTargetColor(){
    const dir=new THREE.Vector3(0,0,-1).applyQuaternion(G.camera.quaternion);
    const h=assist(dir);
    if(h){
      const e=h.object.userData.enemy, b=h.object.userData.boss;
      if(e&&e.shield) return e.shield;
      if(b&&b.color) return b.color;
    }
    return null;
  }
  function runProgram(steps){
    if(busy||dead) return;
    busy=true;
    const token=runToken;
    let i=0;
    (function next(){
      if(dead || token!==runToken){ busy=false; CODE.hideTape(); return; }
      if(i>=steps.length){
        busy=false; CODE.highlight(null);
        setTimeout(()=>{ CODE.hideTape(); afterProgram(); },500);
        return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); setTimeout(next,ITER_MS); return; }
      if(s.name==='__if'){
        CODE.highlight(s);
        const now=currentTargetColor();
        if(now!==s.cond) i=s.jump;                 // condition false: skip the body
        setTimeout(next,ITER_MS); return;
      }
      if(s.name==='__call'){ CODE.highlight(s); setTimeout(next,ITER_MS); return; }
      CODE.highlight(s);
      if(s.name==='shoot')      playerShot(null);
      if(s.name==='shootRed')   playerShot('red');
      if(s.name==='shootBlue')  playerShot('blue');
      setTimeout(next, s.name==='wait'? 700 : STEP_MS);
    })();
  }
  function afterProgram(){
    if(boss && !boss.dead && boss.regrow && boss.shield>0 && boss.shield<boss.max){
      msg(t('{n}: “Not enough! My shield grows back!”',{n:t(boss.name)}));
      setTimeout(()=>{ if(boss){ boss.shield=boss.max; layout(boss); } },1200);
    }
    checkStage();
  }

  /* --------------------------------------------------------- update */
  function update(dt){
    const now=performance.now();
    bolts=bolts.filter(b=>{ b.t+=dt/0.13;
      b.m.position.lerpVectors(b.from,b.to,Math.min(b.t,1));
      if(b.t>=1){ G.scene.remove(b.m); return false; } return true; });

    foeBolts=foeBolts.filter(b=>{ b.t+=dt*b.speed;
      b.m.position.lerpVectors(b.from,b.to,Math.min(b.t,1));
      if(b.t>=1){
        G.scene.remove(b.m);
        const d=Math.hypot(b.to.x-G.pos.x, b.to.z-G.pos.z);
        if(d<2.2) damage(b.dmg);                 // dodging actually works
        return false;
      }
      return true; });

    enemies.forEach(e=>{
      e.t+=dt;
      // armour reseals: a shot every couple of seconds can never wear it down,
      // but two shots half a second apart - a loop - will
      if(e.armour && e.hp<e.max && e.hurtAt && now-e.hurtAt>ARMOUR_RESEAL){
        e.hp=e.max; e.hurtAt=0; flash(e.mesh); pulseBar(e,'reseal');
      }
      e.mesh.position.y=2.2+Math.sin(e.t*2)*0.32;
      const dx=G.pos.x-e.mesh.position.x, dz=G.pos.z-e.mesh.position.z;
      const dist=Math.hypot(dx,dz);
      if(dist>7) { e.mesh.position.x+=dx/dist*e.K.speed*dt; e.mesh.position.z+=dz/dist*e.K.speed*dt; }
      e.mesh.lookAt(G.pos.x, e.mesh.position.y, G.pos.z);
      if(e.ring) e.ring.rotation.z+=dt*2;
      if(now>e.next && dist<e.K.range && !blocked(e.mesh.position.x,e.mesh.position.z,G.pos.x,G.pos.z)){
        e.next=now+e.K.fire; foeShot(e);
      }
    });

    if(boss){
      boss.t+=dt;
      boss.mesh.position.y=4+Math.sin(boss.t*1.3)*0.55;
      boss.seg.forEach((s,i)=>{ const a=(i/boss.max)*Math.PI*2 + boss.t*0.8;
        s.position.set(Math.cos(a)*4.4, Math.sin(a)*2.3, 0); });
      if(boss.cycle && boss.t> (boss.lastCycle||0)+boss.cycle){
        boss.lastCycle=boss.t;
        boss.color = boss.color==='red' ? 'blue' : 'red';
        layout(boss);
      }
      if(now>boss.next){
        boss.next=now+2400;
        foeShot({mesh:boss.mesh, dmg:boss.dmg, K:{bolt:PAL.rose}});
      }
    }

    if(hp<MAXHP && now-lastHurt>5000){ hp=Math.min(MAXHP,hp+8*dt); drawHP(); }
    const tr=document.querySelector('#trigger');
    if(mission && !range){
      tr.classList.remove('hidden');
      const ready=triggerReady();
      tr.textContent = ready ? t('TRIGGER READY') : t('TRIGGER RECHARGING…');
      tr.classList.toggle('cool',!ready);
      document.querySelector('#crosshair').classList.toggle('cool',!ready);
    } else tr.classList.add('hidden');
  }

  /* -------------------------------------------------------- missions */
  const MISSIONS={
    m1:{ name:'Mission 1 — Loops', title:'The Loop Chamber',
      objectives:['Program one shot','Clear three drones','Clear five drones','Beat THE LOOPER'],
      stages:[
        {palette:['shoot'],
         skill:{name:'Commands', text:'A command is one instruction. The computer does it once, exactly as written.', code:'shoot()'},
         teach:{kicker:'SKILL 1 OF 2', title:'A command', body:'Your <b>left click</b> fires one shot — try it. But your gun can also be <b>programmed</b>. A <b>command</b> is one instruction, and <code>shoot()</code> is a command: it fires once.',
                code:'shoot()', why:'Press RUN and the gun does exactly what you wrote — no more, no less.'},
         brief:'<b>Left click</b> fires one shot. Now do the same thing with code: press <b>C</b>, add a <b>shoot()</b> block, press RUN.',
         build(){ spawn('buzzer',0,-14); }},
        {palette:['shoot','repeat'],
         skill:{name:'Loops', text:'A loop runs the blocks inside it again and again, so you write the action once instead of copying it.', code:'repeat 3\n  shoot()\nend'},
         teach:{kicker:'SKILL 2 OF 2', title:'A loop', body:'These three have <b>armour that reseals</b>. Your trigger is too slow — one shot every couple of seconds and it heals before you land the next. You need <b>two fast shots</b>, so put <code>shoot()</code> inside a <b>repeat</b>.',
                code:'repeat 3\n  shoot()\nend', why:'Written once. Run three times. That is a loop.'},
         brief:'Their armour reseals, so single shots will not do it. Put <b>shoot()</b> inside a <b>repeat</b> and fire a volley.',
         build(){ cover(); spawn('buzzer',-7,-15,null,2); spawn('buzzer',0,-18,null,2); spawn('buzzer',7,-15,null,2); }},
        {palette:['shoot','repeat'],
         skill:{name:'Loops', text:'Change the number on the repeat block and the same code does more work. That is why loops beat copy-paste.', code:'repeat 8\n  shoot()\nend'},
         brief:'Five now, and the <b>slugger</b> takes three hits. Raise the number on your <b>repeat</b> — same program, more shots — and sweep your aim.',
         build(){ cover(); for(let i=0;i<4;i++) spawn('buzzer',-8+i*5.5,-15-((i%2)*4),null,2); spawn('slugger',2,-22,null,3); }},
        {palette:['shoot','repeat'], boss:true,
         skill:{name:'Loops', text:'One program, eight shots. The loop is the only thing that fires fast enough.', code:'repeat 8\n  shoot()\nend'},
         teach:{kicker:'BOSS', title:'THE LOOPER', body:'His shield has <b>8 parts</b> and it grows back after every program. Trigger pulls bounce off. You need <b>8 shots inside one program</b>.',
                code:'repeat 8\n  shoot()\nend', why:'Count the shield parts, then set the repeat number to match.'},
         brief:'<b>THE LOOPER</b>: 8 shield parts, regrown after every program. <b>repeat 8</b> in one program.',
         build(){ cover(); spawnBoss({name:'THE LOOPER',shield:8,color:PAL.lav,face:'👾',dmg:15}); }}
      ]},
    m2:{ name:'Mission 2 — Choices', title:'The Prism Vault',
      objectives:['Break a red shield','Break both colours','Survive the mixed wave','Beat PRISM'],
      stages:[
        {palette:['shootRed','shootBlue'],
         brief:'These drones carry <b>coloured shields</b>. A red shield only breaks to a <b>red bolt</b>. Look at the ring, then pick the matching block.',
         build(){ spawn('buzzer',-4,-15,'red'); spawn('buzzer',5,-16,'red'); }},
        {palette:['shootRed','shootBlue','repeat','ifc'],
         brief:'Now both colours are here. Guessing wastes shots — use an <b>if</b> block: <i>if target is red → shootRed()</i>, and another for blue.',
         build(){ cover(); spawn('buzzer',-6,-15,'red'); spawn('buzzer',0,-18,'blue'); spawn('buzzer',6,-15,'blue'); }},
        {palette:['shootRed','shootBlue','repeat','ifc'],
         brief:'A mixed wave with snipers watching from the back. Put your <b>if</b> blocks inside a <b>repeat</b> so every shot checks the colour first.',
         build(){ cover(); spawn('buzzer',-8,-14,'red'); spawn('buzzer',-2,-17,'blue'); spawn('buzzer',4,-15,'red');
                  spawn('sniper',9,-24,'blue'); spawn('slugger',-9,-22,'red'); }},
        {palette:['shootRed','shootBlue','repeat','ifc'], boss:true,
         brief:'<b>PRISM</b> changes colour every two seconds. A fixed program cannot beat that — only <b>if</b> inside a <b>repeat</b> checks the colour every single shot.',
         build(){ cover(); spawnBoss({name:'PRISM',shield:10,color:PAL.blush,face:'🔮',dmg:14,cycle:2,startColor:'red',regrow:false}); }}
      ]},
    m3:{ name:'Mission 3 — Functions', title:'The Off-By-One Foundry',
      objectives:['Teach the gun a combo','Use the combo on a wave','Clear the corridor','Beat OFF-BY-ONE'],
      stages:[
        {palette:['shootRed','shootBlue','define','call'],
         brief:'Put <b>shootRed()</b> and <b>shootBlue()</b> inside <b>define combo</b>. Then drop one <b>combo()</b> block to run both at once. Write it once, use it forever.',
         build(){ spawn('buzzer',-3,-15,'red'); spawn('buzzer',3,-16,'blue'); }},
        {palette:['shootRed','shootBlue','define','call','repeat'],
         brief:'Six of them, in pairs. Keep your <b>combo</b> and call it inside a <b>repeat</b> — three calls, six shots.',
         build(){ cover(); for(let i=0;i<3;i++){ spawn('buzzer',-7+i*7,-15,'red'); spawn('buzzer',-4+i*7,-19,'blue'); } }},
        {palette:['shootRed','shootBlue','define','call','repeat','ifc'],
         brief:'A corridor with cover on both sides and swarmers that rush you. Move through it — you cannot hit what you cannot see.',
         build(){ corridor(); spawn('swarm',-6,-12); spawn('swarm',6,-12); spawn('sniper',0,-30,'red');
                  spawn('slugger',-8,-26,'blue'); spawn('swarm',0,-20); }},
        {palette:['shootRed','shootBlue','define','call','repeat','ifc'], boss:true,
         brief:'<b>OFF-BY-ONE</b> shows <b>7</b> shield parts but always has <b>one more</b> than he shows. Count carefully — programmers start counting at zero.',
         build(){ cover(); spawnBoss({name:'OFF-BY-ONE',shield:8,color:PAL.peach,face:'🧮',dmg:16,regrow:true}); }}
      ]}
  };

  /* obstacle layouts */
  function cover(){
    addObstacle(-9,-8,4,4,4.6,PAL.lav);
    addObstacle( 9,-8,4,4,4.6,PAL.lav);
    addObstacle( 0,-4,7,2.4,3.2,PAL.blush);
    addObstacle(-15,-18,3,9,5.4,PAL.sky);
    addObstacle( 15,-18,3,9,5.4,PAL.sky);
  }
  function corridor(){
    for(let i=0;i<4;i++){
      addObstacle(-7, -6-i*7, 3.4, 4.6, 5.2, i%2?PAL.lav:PAL.sky);
      addObstacle( 7, -9-i*7, 3.4, 4.6, 5.2, i%2?PAL.sky:PAL.lav);
    }
    addObstacle(0,-16,4.5,2.4,3.0,PAL.blush);
  }

  /* ---------------------------------------------------- flow control */
  function clearField(){
    runToken++;                         // any program still running is now void
    enemies.forEach(e=>G.roomGroup.remove(e.mesh));
    if(boss) G.roomGroup.remove(boss.mesh);
    bolts.forEach(b=>G.scene.remove(b.m)); foeBolts.forEach(b=>G.scene.remove(b.m));
    // and drop their hitboxes: leaving these behind put invisible ghosts in the
    // raycast list that swallowed shots, which reads exactly like a broken gun
    G.hits=G.hits.filter(h=>!h.userData.enemy && !h.userData.boss && !h.userData.range);
    enemies=[]; boss=null; bolts=[]; foeBolts=[];
  }
  function startMission(id){
    mission=MISSIONS[id];
    hp=MAXHP; dead=false; drawHP();
    document.querySelector('#health').classList.remove('hidden');
    startStage(0);
  }
  function startStage(n){
    stage=n; busy=false; stageDone=false; clearTimeout(checkT);
    clearField();
    const st=mission.stages[n];
    CODE.setPalette(st.palette); CODE.clear();
    st.build();
    G.pos.set(0,1.7,18); G.vel.set(0,0,0);
    brief(st.brief); objectives(); showSkill(st.skill);
    // the console opens over both the briefing and the skill panel, so it
    // gets its own copy — the instruction first, the skill behind it
    if(window.CODE) CODE.setGuide({ brief: st.brief,
                                    name: st.skill && st.skill.name,
                                    text: st.skill && st.skill.text,
                                    code: st.skill && st.skill.code });
    if(st.teach) teachCard(st.teach);
  }
  function showSkill(sk){
    const el=document.querySelector('#skill');
    if(!sk){ el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    document.querySelector('#skLbl').textContent=t('SKILL YOU ARE USING');
    document.querySelector('#skName').textContent=t(sk.name);
    document.querySelector('#skText').textContent=t(sk.text);
    document.querySelector('#skCode').textContent=sk.code;
  }
  // a one-screen card that names the concept before the fight that needs it
  function teachCard(tc){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t(tc.kicker)}</div>
      <h2>${t(tc.title)}</h2>
      <p>${t(tc.body)}</p>
      <pre>${tc.code}</pre>
      <div class="why">${t(tc.why)}</div>
      <button class="btn good" id="teachGo">${t('Open the console ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    el.querySelector('#teachGo').onclick=()=>{ el.classList.add('hidden'); CODE.show(); };
  }
  function checkStage(){
    if(!mission || stageDone) return;
    const st=mission.stages[stage];
    if(st.boss){ if(!boss){ stageDone=true; finish(); } return; }
    if(!enemies.length){
      stageDone=true;
      if(stage+1<mission.stages.length){ msg(t('Clear! Next wave…')); setTimeout(()=>startStage(stage+1),950); }
      else finish();
    }
  }
  function objectives(){
    document.querySelector('#objList').innerHTML=mission.objectives.map((n,i)=>
      `<li class="${i<stage?'done':(i===stage?'cur':'')}">${i<stage?'✔ ':'• '}${t(n)}</li>`).join('');
    document.querySelector('#missionName').textContent=t(mission.name);
  }
  function finish(){
    busy=false; brief('');
    document.querySelector('#health').classList.add('hidden');
    document.querySelector('#skill').classList.add('hidden');
    document.querySelector('#trigger').classList.add('hidden');
    CODE.setGuide(null);
    const code=CODE.toText().join('\n');
    if(window.PROGRESS) PROGRESS.complete(mission.id||G.missionId);
    showResults({
      title:t(mission.name)+' — '+t('COMPLETE'),
      body:t(mission.win||'Nice work, coder.'),
      stats:`<div style="grid-column:1/-1"><b>${t('The code you wrote')}</b><pre style="margin:6px 0 0;color:#8fd3ff">${code||'—'}</pre></div>`
    });
    G.running=false;
  }
  MISSIONS.m1.win='You beat THE LOOPER with a <b>loop</b>. One block, written once, ran again and again — that is what a loop is for.';
  MISSIONS.m2.win='You beat PRISM with an <b>if</b>. A program that checks before it acts can handle something that keeps changing.';
  MISSIONS.m3.win='You beat OFF-BY-ONE with a <b>function</b>. You taught the gun a move once and called it whenever you needed it — and you counted carefully.';

  /* ------------------------------------------------- the firing range */
  let range=null;
  function startRange(){
    clearField();
    hp=MAXHP; dead=false; drawHP();
    document.querySelector('#health').classList.add('hidden');
    range={hits:0, shots:0, t0:performance.now(), left:12, targets:[]};
    document.querySelector('#missionName').textContent=t('Firing Range');
    objectivesRange();
    brief('Click the targets as fast as you can. This is pure aiming — no code. <b>Left click</b> to shoot.');
    nextTarget();
  }
  function nextTarget(){
    if(!range) return;
    if(range.left<=0) return rangeDone();
    range.left--;
    const x=-14+Math.random()*28, z=-10-Math.random()*20, y=1.6+Math.random()*4.5;
    const m=new THREE.Mesh(new THREE.SphereGeometry(1.15,16,12),
      new THREE.MeshLambertMaterial({color:PAL.blush}));
    m.position.set(x,y,z);
    G.roomGroup.add(m); G.hits.push(m);
    m.userData.range=true;
    range.targets.push(m);
  }
  function rangeShot(){
    if(!range) return false;
    range.shots++;
    const dir=new THREE.Vector3(0,0,-1).applyQuaternion(G.camera.quaternion);
    const ray=new THREE.Raycaster(G.camera.position.clone(),dir); ray.far=110;
    const h=ray.intersectObjects(G.hits,false)[0];
    const end=h? h.point.clone() : G.camera.position.clone().add(dir.multiplyScalar(70));
    bolt(G.camera.position.clone().add(new THREE.Vector3(0,-0.4,0)), end, 0x7fe6ff);
    if(window.GUN) GUN.kick();
    if(h && h.object.userData.range){
      range.hits++; hitMark(); spark(h.object.position,PAL.blush);
      G.roomGroup.remove(h.object);
      G.hits=G.hits.filter(x=>x!==h.object);
      range.targets=range.targets.filter(x=>x!==h.object);
      if(window.beep) beep('star');
      objectivesRange(); nextTarget();
    }
    return true;
  }
  function objectivesRange(){
    const acc=range.shots? Math.round(range.hits/range.shots*100):100;
    document.querySelector('#objList').innerHTML=
      `<li class="cur">🎯 ${t('Targets hit')}: <b>${range.hits}/12</b></li>
       <li>${t('Accuracy')}: <b>${acc}%</b></li>
       <li>${t('Shots')}: <b>${range.shots}</b></li>`;
  }
  function rangeDone(){
    const secs=((performance.now()-range.t0)/1000).toFixed(1);
    const acc=range.shots? Math.round(range.hits/range.shots*100):100;
    let best=0; try{ best=+localStorage.getItem('dq_range_best')||0; }catch(e){}
    const score=Math.round(range.hits*100*(acc/100) - secs*2);
    if(score>best){ try{ localStorage.setItem('dq_range_best',score); }catch(e){} }
    showResults({
      title:t('Firing Range'),
      body:t('Warm-up done. Faster hands, fewer wasted shots.'),
      stats:`<div><b>${t('Targets hit')}</b> ${range.hits}/12</div>
       <div><b>${t('Accuracy')}</b> ${acc}%</div>
       <div><b>${t('Time')}</b> ${secs}s</div>
       <div><b>${t('Score')}</b> ${score} ${score>best?'🏆':''}</div>`
    });
    range=null; G.running=false;
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
    msgT=setTimeout(()=>{ if(mission&&mission.stages[stage]) brief(mission.stages[stage].brief); },2400);
  }
  function reset(){ clearField(); obstacles=[]; stage=0; busy=false; mission=null; range=null;
                    hp=MAXHP; dead=false;
                    if(window.CODE) CODE.setGuide(null);
                    document.querySelector('#health').classList.add('hidden');
                    document.querySelector('#skill').classList.add('hidden');
                    document.querySelector('#teach').classList.add('hidden');
                    document.querySelector('#trigger').classList.add('hidden'); }

  function manualShot(){
    if(busy||dead||!mission) return;
    const now=performance.now();
    if(now-lastManual < MANUAL_CD){
      msg(t('Trigger still recharging — a <b>program</b> fires as fast as you can write it.'));
      return;
    }
    lastManual=now;
    playerShot(null, true);
  }
  function triggerReady(){ return performance.now()-lastManual >= MANUAL_CD; }
  return { startMission, startRange, rangeShot, manualShot, triggerReady, update, runProgram, reset, damage,
           get busy(){ return busy; }, get dead(){ return dead; }, get inRange(){ return !!range; },
           get hp(){ return hp; },
           // read-only, for the corner map: what is on the field right now
           get enemies(){ return enemies; }, get boss(){ return boss; },
           get cover(){ return obstacles; },
           get targets(){ return range ? range.targets : []; } };
})();
