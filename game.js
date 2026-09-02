/* =====================================================================
   Desktop Quest 0.2a — "Mission: Linux"
   A first-person campaign where the map IS the Linux desktop:
   icons top-left, App Launcher gate at the bottom, system menu tower
   top-right. Every mission ends by flipping to the flat desktop and
   asking for the same thing with a normal mouse.
   Runs from a plain folder — no server, no modules, no network.
   ===================================================================== */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const G = {
  renderer:null, scene:null, camera:null,
  room:'plaza', roomGroup:null,
  solids:[], hits:[],                 // collision boxes / raycast targets
  selected:null, focused:null,
  keys:{}, locked:false, running:false,
  yaw:0, pitch:0,
  pos:new THREE.Vector3(0,1.7,14),
  vel:new THREE.Vector3(),
  stats:{clicks:0, dbl:0, steps:0, t0:0},
  battery: 60+Math.floor(Math.random()*35),
  volume: 40+Math.floor(Math.random()*50)
};
const PLAYER_R = 0.9, EYE = 1.7;

/* ---------------------------------------------------------------- boot */
function init(){
  const canvas = $('#view');
  G.renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));   // lab-machine budget
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);
  resize(); window.addEventListener('resize', resize);

  G.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x24303f, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(12, 26, 8);
  G.scene.add(sun);

  wireInput();
  wireUI();
  setLang(window.LANG);
}
function resize(){
  const w=window.innerWidth, h=window.innerHeight;
  G.renderer.setSize(w,h,false);
  G.camera.aspect=w/h; G.camera.updateProjectionMatrix();
}

/* ------------------------------------------------------- canvas labels */
const texCache = {};
function panelTexture(emoji, label, bg, fg){
  const key = emoji+'|'+label+'|'+bg;
  if(texCache[key]) return texCache[key];
  const c=document.createElement('canvas'); c.width=c.height=256;
  const x=c.getContext('2d');
  x.fillStyle=bg; roundRect(x,6,6,244,244,26); x.fill();
  x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=6; roundRect(x,6,6,244,244,26); x.stroke();
  x.textAlign='center';
  x.font='120px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
  x.fillText(emoji, 128, 150);
  x.fillStyle=fg||'#ffffff';
  x.font='bold 30px "Trebuchet MS",system-ui,sans-serif';
  x.fillText(label, 128, 210);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  texCache[key]=tex; return tex;
}
function textTexture(lines, bg, size){
  const c=document.createElement('canvas'); c.width=256; c.height=256;
  const x=c.getContext('2d');
  x.fillStyle=bg; x.fillRect(0,0,256,256);
  x.strokeStyle='rgba(255,255,255,.25)'; x.lineWidth=5; x.strokeRect(4,4,248,248);
  x.fillStyle='#eef3ff'; x.textAlign='center';
  x.font='bold '+(size||30)+'px "Trebuchet MS",system-ui,sans-serif';
  lines.forEach((l,i)=>x.fillText(l, 128, 70 + i*44));
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}
function groundTexture(base, accent){
  const c=document.createElement('canvas'); c.width=c.height=512;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,512,512);
  g.addColorStop(0,accent); g.addColorStop(1,base);
  x.fillStyle=g; x.fillRect(0,0,512,512);
  x.strokeStyle='rgba(255,255,255,.06)'; x.lineWidth=2;
  for(let i=0;i<=512;i+=64){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,512); x.stroke();
                             x.beginPath(); x.moveTo(0,i); x.lineTo(512,i); x.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4,4);
  return tex;
}
function roundRect(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r);
  x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }

/* ------------------------------------------------------ world building */
function addSolid(x,z,w,d){ G.solids.push({x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2}); }

function addPanel(opt){
  // a standing door-panel: this is what an "icon" looks like when you can walk up to it
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(4.4,5.6,0.7),
    new THREE.MeshLambertMaterial({color:opt.frame||0x2a3b5c}));
  body.position.y=2.8; g.add(body);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),
    new THREE.MeshLambertMaterial({map:panelTexture(opt.emoji,t(opt.name),opt.bg||'#22406b')}));
  face.position.set(0,3.3,0.37); g.add(face);
  const base=new THREE.Mesh(new THREE.BoxGeometry(5,0.5,1.4),
    new THREE.MeshLambertMaterial({color:0x1b2740}));
  base.position.y=0.25; g.add(base);
  g.position.set(opt.x,0,opt.z);
  g.userData={kind:opt.kind||'icon', id:opt.id, label:t(opt.name), sub:opt.sub, opens:opt.opens, glow:face};
  G.roomGroup.add(g);
  G.hits.push(body); G.hits.push(face);
  body.userData.owner=g; face.userData.owner=g;
  addSolid(opt.x,opt.z,4.4,1.2);
  return g;
}

function buildRoom(name){
  if(G.roomGroup){ G.scene.remove(G.roomGroup); }
  G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
  G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
  G.room=name;
  clearTimeout(briefTimer);
  const L=window.LEVELS[name];
  G.scene.background=new THREE.Color(0x0c1524);
  G.scene.fog=new THREE.Fog(0x0c1524, 55, 170);

  // floor
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(L.w,L.d),
    new THREE.MeshLambertMaterial({map:groundTexture(L.ground,L.accent)}));
  floor.rotation.x=-Math.PI/2; G.roomGroup.add(floor);

  // walls
  const wallMat=new THREE.MeshLambertMaterial({color:0x16243a});
  const mk=(x,z,w,d)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,7,d), wallMat);
    m.position.set(x,3.5,z); G.roomGroup.add(m); addSolid(x,z,w,d); };
  mk(0,-L.d/2,L.w,1); mk(0,L.d/2,L.w,1); mk(-L.w/2,0,1,L.d); mk(L.w/2,0,1,L.d);

  if(name==='plaza') buildPlaza(L);
  else if(L.arena) buildArena(L);
  else buildAppRoom(L);
  G.scene.updateMatrixWorld(true);   // so the crosshair can hit things before the first render
  updateMapLegend();
}

function buildPlaza(L){
  // icons in the top-left grid — same corner as the real desktop
  L.icons.forEach(ic=>{
    addPanel({id:ic.id, name:ic.name, emoji:ic.emoji, opens:ic.opens,
      x:L.iconOrigin.x+ic.col*L.iconGap.x, z:L.iconOrigin.z+ic.row*L.iconGap.z, bg:'#22406b'});
  });
  // mission portals — the doors into the campaign levels
  (L.portals||[]).forEach(pt=>{
    addPanel({id:pt.id, name:pt.name, emoji:pt.emoji, opens:pt.opens, kind:'portal',
      x:pt.x, z:pt.z, bg:'#7a2740', frame:0x5a1b2e});
  });
  // App Launcher gate along the bottom edge
  const gate=new THREE.Group();
  const pill=new THREE.MeshLambertMaterial({color:0x2b7fd0});
  [-4,4].forEach(dx=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(1.6,8,1.6),pill);
    p.position.set(dx,4,0); gate.add(p); });
  const lint=new THREE.Mesh(new THREE.BoxGeometry(10,1.6,1.6),pill); lint.position.set(0,8.4,0); gate.add(lint);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(8,2.4),
    new THREE.MeshLambertMaterial({map:panelTexture('🚀',t('App Launcher'),'#1d4f86')}));
  sign.position.set(0,5.6,0.9); gate.add(sign);
  gate.position.set(L.gate.x,0,L.gate.z);
  gate.userData={kind:'gate', id:'launcher', label:t('App Launcher'), sub:t('walk in')};
  G.roomGroup.add(gate);
  G.hits.push(sign); sign.userData.owner=gate;
  addSolid(L.gate.x-4,L.gate.z,1.6,1.6); addSolid(L.gate.x+4,L.gate.z,1.6,1.6);
  G.gatePos=new THREE.Vector3(L.gate.x,0,L.gate.z);

  // system menu tower in the top-right corner
  const tw=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(5,13,5),
    new THREE.MeshLambertMaterial({color:0x28405f}));
  body.position.y=6.5; tw.add(body);
  const clock=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const face=new THREE.Mesh(new THREE.PlaneGeometry(4.4,4.4),
    new THREE.MeshLambertMaterial({map:textTexture(
      [t('Wi-Fi: connected'), t('Volume: {n}%',{n:G.volume}), t('Battery: {n}%',{n:G.battery}), t('Clock: {t}',{t:clock})],
      '#16273f', 26)}));
  face.position.set(0,7.5,2.55); tw.add(face);
  tw.position.set(L.tower.x,0,L.tower.z);
  tw.userData={kind:'tower', id:'sysmenu', label:t('System Menu'), sub:t('double-click to open'), glow:face};
  G.roomGroup.add(tw);
  G.hits.push(body); G.hits.push(face);
  body.userData.owner=tw; face.userData.owner=tw;
  addSolid(L.tower.x,L.tower.z,5,5);
  G.towerPos=new THREE.Vector3(L.tower.x,0,L.tower.z);

  G.pos.set(0,EYE,16); G.yaw=0; G.pitch=0;   // yaw 0 looks -z: north, into the desktop
}

function buildAppRoom(L){
  (L.folders||[]).forEach(f=>{
    addPanel({id:f.id, name:f.name, emoji:f.emoji, opens:f.opens, kind:'folder',
      x:f.x, z:f.z, bg:'#2b4a3a'});
  });
  // the red ✕ — the only way out, so they learn where "close" lives
  const x=addPanel({id:'exit', name:'Close (✕)', emoji:'✕', kind:'exit',
    x:L.exit.x, z:L.exit.z, bg:'#8d2b2b', frame:0x5e1f1f});
  x.userData.back=L.exit.back;
  // room title on the back wall
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.2),
    new THREE.MeshLambertMaterial({map:textTexture(['📁 '+t(L.title)],'#16273f',34)}));
  sign.position.set(0,5.4,-L.d/2+0.6); G.roomGroup.add(sign);
  G.pos.set(0,EYE,L.d/2-4); G.yaw=0; G.pitch=0;
}

function buildArena(L){
  G.pos.set(0,EYE,L.d/2-6); G.yaw=0; G.pitch=0;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(14,3),
    new THREE.MeshLambertMaterial({map:textTexture(['🐛 '+t(L.title)],'#2b1038',34)}));
  sign.position.set(0,7.5,-L.d/2+0.6); G.roomGroup.add(sign);
  setTimeout(()=>COMBAT.start(), 60);
}

/* ------------------------------------------------------------- input */
function lockPointer(el){
  // some setups refuse pointer lock (embedded frames, kiosk policies) — the arrow keys still turn,
  // so a refusal must stay silent instead of throwing
  if(document.pointerLockElement || !el.requestPointerLock) return;
  try{ const p=el.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
}
function wireInput(){
  addEventListener('keydown',e=>{
    G.keys[e.code]=true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if(e.code==='Escape' && document.pointerLockElement) document.exitPointerLock();
    if((e.code==='KeyC'||e.code==='Tab') && G.room==='arena' && G.running && !COMBAT.busy){
      e.preventDefault();
      CODE.isOpen() ? CODE.close() : CODE.show();
    }
  });
  addEventListener('keyup',e=>{ G.keys[e.code]=false; });

  const canvas=$('#view');
  canvas.addEventListener('mousedown',()=>{
    if(!G.running) return;
    lockPointer(canvas);
  });
  document.addEventListener('pointerlockchange',()=>{ G.locked=!!document.pointerLockElement; });
  document.addEventListener('mousemove',e=>{
    if(!G.locked) return;
    G.yaw   -= e.movementX*0.0022;
    G.pitch  = clamp(G.pitch - e.movementY*0.0022, -1.2, 1.2);
  });
  canvas.addEventListener('click',()=>{ if(G.running) select(); });
  canvas.addEventListener('dblclick',()=>{ if(G.running) open(); });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
}

function select(){
  G.stats.clicks++;
  const f=G.focused;
  if(!f) return;
  if(G.selected && G.selected!==f) setGlow(G.selected,false);
  G.selected=f; setGlow(f,true);
  fire('select',{id:f.userData.id});
}
function open(){
  G.stats.dbl++;
  const f=G.focused;
  if(!f) return;
  const u=f.userData;
  fire('open',{id:u.id, kind:u.kind});
  if(u.kind==='exit'){ buildRoom(u.back); return; }
  if(u.opens){ buildRoom(u.opens); return; }
  if(u.kind==='tower'){ brief(t('Battery: {n}%',{n:G.battery})+' · '+t('Wi-Fi: connected')); return; }
  brief(t(u.label)+' — '+t('double-click to open'));
}
function setGlow(g,on){
  const m=g.userData.glow; if(!m) return;
  m.material.emissive = m.material.emissive || new THREE.Color();
  m.material.emissive.setHex(on?0x2a5fa8:0x000000);
}

/* -------------------------------------------------------------- loop */
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-last)/1000, 0.05); last=now;
  if(G.running && !CODE.isOpen()){ step(dt); focusScan(); drawMap(); if(G.room==='arena') COMBAT.update(dt); }
  G.renderer.render(G.scene,G.camera);
}
function step(dt){
  // turn with arrows too, so a student who cannot manage mouse-look can still play
  if(G.keys.ArrowLeft)  G.yaw += 2.0*dt;
  if(G.keys.ArrowRight) G.yaw -= 2.0*dt;
  const fwd = (G.keys.KeyW||G.keys.ArrowUp?1:0) - (G.keys.KeyS||G.keys.ArrowDown?1:0);
  const str = (G.keys.KeyD?1:0) - (G.keys.KeyA?1:0);
  const spd = (G.keys.ShiftLeft||G.keys.ShiftRight)?11:6.5;
  const sin=Math.sin(G.yaw), cos=Math.cos(G.yaw);
  let dx = (-sin*fwd + cos*str)*spd*dt;
  let dz = (-cos*fwd - sin*str)*spd*dt;
  if(dx||dz) G.stats.steps += Math.abs(dx)+Math.abs(dz);
  moveAxis('x',dx); moveAxis('z',dz);

  G.camera.position.copy(G.pos);
  G.camera.rotation.set(0,0,0,'YXZ');
  G.camera.rotation.order='YXZ';
  G.camera.rotation.y=G.yaw; G.camera.rotation.x=G.pitch;

  if(G.room==='plaza'){
    if(G.gatePos && G.pos.distanceTo(new THREE.Vector3(G.gatePos.x,EYE,G.gatePos.z))<6) fire('reach',{id:'launcher'});
    if(G.towerPos && G.pos.distanceTo(new THREE.Vector3(G.towerPos.x,EYE,G.towerPos.z))<9) fire('near',{id:'sysmenu'});
  }
}
function moveAxis(axis,d){
  if(!d) return;
  const p=G.pos.clone(); p[axis]+=d;
  for(const s of G.solids){
    if(p.x+PLAYER_R>s.x1 && p.x-PLAYER_R<s.x2 && p.z+PLAYER_R>s.z1 && p.z-PLAYER_R<s.z2) return;
  }
  G.pos[axis]+=d;
}

const ray=new THREE.Raycaster(); ray.far=34;
function focusScan(){
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(G.camera.quaternion);
  ray.set(G.camera.position, dir);
  const hit=ray.intersectObjects(G.hits,false)[0];
  const owner = hit ? (hit.object.userData.owner||null) : null;
  G.focused=owner;
  const box=$('#focus'), cross=$('#crosshair');
  const onEnemy = hit && (hit.object.userData.drone || hit.object.userData.boss);
  if(onEnemy){ cross.classList.add('on'); box.classList.add('hidden'); return; }
  if(owner){
    cross.classList.add('on'); box.classList.remove('hidden');
    const u=owner.userData;
    box.innerHTML = t(u.label) + '<small>' + (u.kind==='gate'? t('walk in')
      : (G.selected===owner ? t('SELECTED')+' · '+t('double-click to open') : t('one click')+' → '+t('double-click'))) + '</small>';
    fire('look',{id:u.id});
  } else { cross.classList.remove('on'); box.classList.add('hidden'); }
}

/* ---------------------------------------------------------- minimap */
function drawMap(){
  const c=$('#map'), x=c.getContext('2d');
  const L=window.LEVELS[G.room];
  const sx=c.width/L.w, sz=c.height/L.d;
  const px=v=>(v+L.w/2)*sx, pz=v=>(v+L.d/2)*sz;
  x.clearRect(0,0,c.width,c.height);
  x.fillStyle='#0d1626'; x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='#33456b'; x.lineWidth=2; x.strokeRect(2,2,c.width-4,c.height-4);
  if(G.room==='plaza'){
    const L2=window.LEVELS.plaza;
    x.fillStyle='#3ea6ff';
    L2.icons.forEach(ic=>{
      x.fillRect(px(L2.iconOrigin.x+ic.col*L2.iconGap.x)-4, pz(L2.iconOrigin.z+ic.row*L2.iconGap.z)-4, 8, 8);
    });
    x.fillStyle='#7c5cff'; x.fillRect(px(L2.gate.x)-10, pz(L2.gate.z)-4, 20, 7);
    x.fillStyle='#ffd54a'; x.fillRect(px(L2.tower.x)-5, pz(L2.tower.z)-5, 10, 10);
  } else {
    (L.folders||[]).forEach(f=>{ x.fillStyle='#3ddc84'; x.fillRect(px(f.x)-4,pz(f.z)-4,8,8); });
    if(L.exit){ x.fillStyle='#ff6b6b'; x.fillRect(px(L.exit.x)-4,pz(L.exit.z)-4,8,8); }
  }
  // player
  const cx=px(G.pos.x), cy=pz(G.pos.z);
  x.fillStyle='#fff'; x.beginPath(); x.arc(cx,cy,3.5,0,7); x.fill();
  x.strokeStyle='#fff'; x.lineWidth=2; x.beginPath(); x.moveTo(cx,cy);
  x.lineTo(cx - Math.sin(G.yaw)*11, cy - Math.cos(G.yaw)*11); x.stroke();
}
function updateMapLegend(){
  $('#maplegend').textContent = G.room==='plaza' ? t('icons ▪ launcher ▪ system menu') : t(window.LEVELS[G.room].title||'');
}

/* ------------------------------------------------------- missions */
const MISSION = [
  {id:'look',  short:'Find the icons',            on:'look',   match:d=>d.id==='files'||d.id==='paint'||d.id==='textedit',
   brief:'Look to your <b>left</b> — those tall panels are the <b>icons</b>, in the same top-left corner they sit in on your real desktop.'},
  {id:'sel',   short:'Select the Files icon',      on:'select', match:d=>d.id==='files',
   brief:'Put the crosshair on the <b>Files</b> door and press the left button <b>one time</b>. One click only <b>chooses</b> it.'},
  {id:'open',  short:'Open Files with a double-click', on:'open', match:d=>d.id==='files',
   brief:'Now <b>two fast clicks</b> on the same door to <b>open</b> the app and walk inside.'},
  {id:'pics',  short:'Open the Pictures folder',   on:'open',   match:d=>d.id==='pictures',
   brief:'You are inside <b>Files</b>. Folders are doors. <b>Double-click</b> the <b>Pictures</b> folder.'},
  {id:'exit',  short:'Leave through the red ✕',    on:'open',   match:d=>d.id==='exit',
   brief:'To close an app you use the red <b>✕</b>. Find it and double-click it to get back to the desktop.'},
  {id:'gate',  short:'Reach the App Launcher',     on:'reach',  match:d=>d.id==='launcher',
   brief:'Walk to the big gate at the <b>bottom</b> of the desktop. That is the <b>App Launcher</b> — every app lives behind it.'},
  {id:'tower', short:'Read the system menu',       on:'open',   match:d=>d.id==='sysmenu',
   brief:'Go to the tower in the <b>top-right</b> and read the <b>battery</b> number out loud. That corner holds Wi-Fi, volume, battery and the clock.'}
];
let quests=[], qi=0;

function startMission(){
  quests=MISSION.map(q=>({...q,done:false})); qi=0;
  renderObjectives(); brief(quests[0].brief);
}
function fire(ev,data={}){
  if(G.room==='arena') return;         // the arena runs its own mission script
  const q=quests[qi];
  if(!q||q.done) return;
  if(q.on!==ev) return;
  if(q.match && !q.match(data)) return;
  q.done=true; qi++;
  renderObjectives();
  if(qi<quests.length) brief(quests[qi].brief);
  else setTimeout(flatCheck, 600);
}
function renderObjectives(){
  const ol=$('#objList'); ol.innerHTML='';
  quests.forEach((q,i)=>{
    const li=document.createElement('li');
    li.textContent=(q.done?'✔ ':'• ')+t(q.short);
    li.className = q.done?'done':(i===qi?'cur':'');
    ol.appendChild(li);
  });
}
let briefTimer=null;
function brief(html){
  const b=$('#briefing'); b.innerHTML=t(html); b.classList.remove('hidden');
  clearTimeout(briefTimer);
  briefTimer=setTimeout(()=>{
    // only restore a DESKTOP objective, and only while the desktop still owns the HUD —
    // otherwise this stamps "look at the icons" over a mission in another room
    if(G.room!=='arena' && quests[qi]) b.innerHTML=t(quests[qi].brief);
  }, 6000);
}

/* --------------------------------------------- flip to the flat desktop
   The 3D world teaches where things live. This is where we check that it
   transferred to the screen the student actually uses.                  */
function flatCheck(){
  G.running=false;
  if(document.pointerLockElement) document.exitPointerLock();
  $('#hud').classList.add('hidden');
  const flat=$('#flat'); flat.classList.remove('hidden');
  $('#flatTopL').textContent='🐧 '+t('Linux Lab — Desktop');
  $('#flatTopR').textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  $('#flatDock').innerHTML='🚀 '+t('App Launcher');
  const icons=[['files','📁','Files'],['textedit','📝','Text Editor'],['paint','🎨','Paint'],['trash','🗑️','Trash']];
  $('#flatDesk').innerHTML=icons.map(([id,em,nm])=>
    `<div class="fi" data-id="${id}"><div class="em">${em}</div><div class="nm">${t(nm)}</div></div>`).join('');
  $('#flatMsg').innerHTML='<b>'+t('Now do it for real')+'</b><br>'+
    t('This is the flat desktop — the one on your screen. Same job: <b>double-click</b> Files, then close it with the red <b>✕</b>.');
  $$('#flatDesk .fi').forEach(el=>{
    el.onclick=()=>{ $$('#flatDesk .fi').forEach(o=>o.classList.remove('sel')); el.classList.add('sel');
      if(el.dataset.id==='files') $('#flatMsg').innerHTML=t('One click chooses. Two fast clicks open.'); };
    el.ondblclick=()=>{ if(el.dataset.id==='files') openFlatWindow(); };
  });
}
function openFlatWindow(){
  if($('#fwin')) return;
  const w=document.createElement('div');
  w.className='fwin'; w.id='fwin';
  w.innerHTML=`<div class="fwin-bar"><b>📁 ${t('Files')}</b><button class="fwin-x">✕</button></div>
    <div class="fwin-body">📁 ${t('Pictures')}<br>📁 ${t('Documents')}<br>📁 ${t('Music')}</div>`;
  $('#flatDesk').appendChild(w);
  $('#flatMsg').innerHTML=t('Now close it with the red ✕.');
  w.querySelector('.fwin-x').onclick=()=>{ w.remove(); finish(); };
}
function finish(){
  $('#flat').classList.add('hidden');
  const secs=Math.round((performance.now()-G.stats.t0)/1000);
  $('#dTitle').textContent=t('Mission complete!');
  $('#dBody').innerHTML=t('You walked the desktop, opened an app, went into a folder, closed a window with the ✕, found the App Launcher and read the system menu — then did it again on the flat desktop.');
  $('#dStats').innerHTML=
    `<div><b>${t('Clicks')}</b> ${G.stats.clicks}</div>
     <div><b>${t('Double-clicks')}</b> ${G.stats.dbl}</div>
     <div><b>${t('Time')}</b> ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}</div>
     <div><b>${t('Steps walked')}</b> ${Math.round(G.stats.steps)}</div>`;
  $('#dAgain').textContent=t('Play again');
  $('#done').classList.remove('hidden');
}

/* ----------------------------------------------------------- UI glue */
function wireUI(){
  $$('.langbtn').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
  $('#btnLang').onclick=()=>setLang(window.LANG==='en'?'es':'en');
  $('#sGo').onclick=begin;
  $('#dAgain').onclick=()=>location.reload();
  $('#btnHelp').onclick=()=>brief(quests[qi]?quests[qi].brief:'—');
}
function setLang(l){
  window.LANG=l;
  document.documentElement.lang=l;
  $$('.langbtn').forEach(b=>b.classList.toggle('on',b.dataset.lang===l));
  $('#btnLang').textContent = l==='en' ? '🌐 Español' : '🌐 English';
  $('#sTitle').textContent=t('Mission: Linux');
  $('#sSub').textContent=t('Desktop Quest 0.2a — walk inside the Linux desktop');
  $('#sBody').innerHTML=t('This world is built like your real screen. The <b>icons</b> are up in the top-left, the <b>App Launcher</b> gate is at the bottom, and the <b>system menu</b> tower is in the top-right — exactly where they are on the computer in front of you.');
  $('#sGo').textContent=t('Start the mission ▶');
  $('#sNote').textContent=t('Click the screen to look around with the mouse. Press Esc to let the mouse go.');
  $('#sCtrl').innerHTML=[
    ['Move','W A S D or ↑ ↓'],['Turn','← → or mouse'],['Look','move the mouse'],
    ['Select','one click'],['Open','double-click'],['Run','hold Shift']
  ].map(([k,v])=>`<div><b>${t(k)}</b> ${t(v)}</div>`).join('');
  $('#objTitle').textContent=t('MISSION');
  $('#mapTitle').textContent=t('DESKTOP MAP');
  $('#missionName').textContent=t('Basic Training — The Desktop');
  $('#keys').innerHTML=`<b>W A S D</b> / <b>↑ ↓</b> ${t('Move')} &nbsp; <b>← →</b> ${t('Turn')}<br>
    <b>${t('one click')}</b> ${t('Select')} &nbsp; <b>${t('double-click')}</b> ${t('Open')} &nbsp; <b>Shift</b> ${t('Run')}<br>
    <b>C</b> ${t('open the code console')}`;
  if(G.running){ buildRoom(G.room); renderObjectives(); brief(quests[qi]?quests[qi].brief:''); }
  else updateMapLegend();
}
CODE.onRun=(steps)=>{ COMBAT.runProgram(steps); lockPointer($('#view')); };

function begin(){
  $('#start').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  G.running=true; G.stats.t0=performance.now();
  buildRoom('plaza');
  startMission();
  lockPointer($('#view'));
}

init();
requestAnimationFrame(loop);
