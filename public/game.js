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
  keys:{}, locked:false, running:false, firstPerson:false,
  ground:null, ceiling:null,          // level's floor / ceiling probes, if it has them
  onGround:true,
  yaw:0, pitch:0,
  pos:new THREE.Vector3(0,1.7,14),
  vel:new THREE.Vector3(),
  stats:{clicks:0, dbl:0, steps:0, t0:0},
  battery: 60+Math.floor(Math.random()*35),
  volume: 40+Math.floor(Math.random()*50)
};
const PLAYER_R = 0.9, EYE = 1.7;
const GRAV = 26, JUMP = 9.0;        // a jump clears about 1.5 units, up in a third of a second
/* Roblox-style chase camera: sits behind and above the shoulder and pulls in
   if a wall would get between it and the player. */
const CAM = { back:5.6, up:2.9, side:0.55, lerp:0.18 };
/* A solid only blocks the storey it stands on; older rooms hand us boxes
   with no height at all, and those block everywhere. */
function spans(sd, y){ return sd.y1===undefined || (y > sd.y1 && y < sd.y2); }
function thirdPerson(){
  const head=new THREE.Vector3(G.pos.x, G.pos.y, G.pos.z);
  const dir=new THREE.Vector3(-Math.sin(G.yaw), 0, -Math.cos(G.yaw));
  const rightV=new THREE.Vector3(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
  const pitchDrop=Math.sin(G.pitch)*3.2;
  let want=head.clone()
    .add(dir.clone().multiplyScalar(-CAM.back))
    .add(rightV.clone().multiplyScalar(CAM.side));
  want.y = G.pos.y + CAM.up - pitchDrop;
  // keep the camera out of walls
  for(const sd of G.solids){
    if(!spans(sd, want.y)) continue;
    const steps=8;
    for(let i=1;i<=steps;i++){
      const k=i/steps, px=head.x+(want.x-head.x)*k, pz=head.z+(want.z-head.z)*k;
      if(px>sd.x1&&px<sd.x2&&pz>sd.z1&&pz<sd.z2){
        want.x=head.x+(want.x-head.x)*(k-0.15);
        want.z=head.z+(want.z-head.z)*(k-0.15);
        i=steps+1;
      }
    }
  }
  // and out of the floor above: indoors it would otherwise sit in the ceiling
  // and put a slab between you and your own character
  if(G.ceiling){
    const lid = G.ceiling(want.x, want.z, G.pos.y - EYE);
    if(lid < Infinity) want.y = Math.min(want.y, lid - 0.5);
    want.y = Math.max(want.y, G.pos.y + 0.25);
  }
  G.camera.position.lerp(want, CAM.lerp);
  const look=head.clone().add(dir.clone().multiplyScalar(6)).setY(G.pos.y + Math.sin(G.pitch)*5);
  G.camera.lookAt(look);
}

/* ---------------------------------------------------------------- boot */
function init(){
  const canvas = $('#view');
  G.renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));   // lab-machine budget
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);
  resize(); window.addEventListener('resize', resize);

  // sky bounce, a warm key, and a cool fill: enough that two walls meeting
  // at a corner are visibly two walls
  // The sky lights the tops, the ground bounce keeps ceilings off black,
  // and the two directionals stop a corner reading as one flat surface.
  G.scene.add(new THREE.AmbientLight(0xdfe6ff, 0.95));
  G.scene.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 0.90));
  const sun = new THREE.DirectionalLight(0xfff3f8, 1.15);
  sun.position.set(12, 26, 8);
  G.scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.50);
  fill.position.set(-16, 12, -14);
  G.scene.add(fill);
  G.scene.add(G.camera);            // so the gun can hang off the camera
  GUN.build();

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

/* ------------------------------------------------------------- the gun
   A Kenney blaster in the corner of the eye: it bobs when you walk, kicks
   when it fires, and the muzzle glows on every shot.  The models point
   down -Z, which is exactly where the camera looks, so nothing to turn.  */
const GUN=(function(){
  const MODELS = { a:'blaster-a', b:'blaster-c', c:'blaster-g', d:'blaster-k', e:'blaster-p' };
  const BARREL = 0.94;                       // how long the blaster should read
  const HOME   = new THREE.Vector3(0.66,-0.48,-1.20);
  let g=null, kick=0, bob=0, flash=null, model=null;

  function box(w,h,d,color,x,y,z){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color}));
    m.position.set(x,y,z); return m;
  }
  /* if the kit is missing, fall back to the old blocks rather than nothing */
  function blocks(){
    const b=new THREE.Group();
    b.add(box(0.24,0.24,1.30,0xdfe7ff, 0,0,-0.5));
    b.add(box(0.38,0.36,0.62,0xcdb4f6, 0,-0.05,0.18));
    b.add(box(0.18,0.42,0.22,0xa8e6cf, 0,-0.36,0.30));
    b.add(box(0.13,0.13,0.24,0xffb4a2, 0,0.18,-0.08));
    return b;
  }
  let chosen='c';
  try{ chosen = localStorage.getItem('dq_blaster') || 'c'; }catch(e){}

  function fit(m){
    // scale the kit to the length we want and hang it off the grip
    const b=new THREE.Box3().setFromObject(m);
    const len=Math.max(0.001, b.max.z-b.min.z);
    const s=BARREL/len;
    m.scale.setScalar(s);
    m.position.set(0, -b.min.y*s - 0.30, -(b.min.z+b.max.z)/2*s);
    if(flash) flash.position.z = b.min.z*s - (b.min.z+b.max.z)/2*s - 0.10;
  }
  function swap(id){
    const name=MODELS[id]||MODELS.c;
    new THREE.GLTFLoader().load('blasters/'+name+'.glb', gl=>{
      if(!g) return;
      if(model) g.remove(model);
      model=gl.scene;
      model.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
      fit(model); g.add(model);
    }, undefined, ()=>{
      if(!g || model) return;
      model=blocks(); g.add(model);
    });
  }

  return {
    build(){
      if(g) return;
      g=new THREE.Group();
      flash=box(0.26,0.26,0.26,0xfff2a8, 0,0,-1.15);
      flash.visible=false; g.add(flash);
      g.position.copy(HOME);
      g.rotation.y=-0.10;
      G.camera.add(g);
      swap(chosen);
    },
    pick(id){
      chosen=id;
      try{ localStorage.setItem('dq_blaster',id); }catch(e){}
      if(g) swap(id);
    },
    get chosen(){ return chosen; },
    get models(){ return MODELS; },
    kick(){ kick=1; if(flash){ flash.visible=true; setTimeout(()=>flash.visible=false,70); } },
    update(dt, moving){
      if(!g) return;
      kick=Math.max(0, kick-dt*7);
      bob+= moving? dt*9 : 0;
      g.visible=!!G.firstPerson;
      g.position.set(HOME.x + Math.sin(bob)*0.02,
                     HOME.y + Math.abs(Math.cos(bob))*0.018 - kick*0.05,
                     HOME.z + kick*0.20);
      g.rotation.x = kick*0.30;
    }
  };
})();

window.GUN=GUN;

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

window.updateLeaveBtn=updateLeaveBtn;
window.updateCodeBtn=updateCodeBtn;
let codeBtnState=null;
function updateCodeBtn(){
  const btn=$('#codeBtn'); if(!btn) return;
  // the flight runs with G.running off — it drives its own camera — so it
  // has to be its own reason for the button to be there
  const flying = !!(window.FLIGHT && FLIGHT.active);
  const usable = (G.running || flying) && !CODE.isOpen() &&
    (PUZZLE.active || NAV.active || flying || (G.hudOwner==='mission' && G.missionId));
  if(usable===codeBtnState) return;
  codeBtnState=usable;
  btn.classList.toggle('hidden',!usable);
  btn.classList.toggle('nudge',usable);
  $('#codeBtnTxt').textContent=t('Code Console');
  btn.onclick=()=>{ CODE.show(); updateCodeBtn(); };
  const esc=$('#escHint');
  if(esc){ esc.classList.toggle('hidden',!(G.running||flying));
           esc.innerHTML=t('<kbd>Esc</kbd> frees the mouse · <kbd>P</kbd> pause &amp; hint'); }
}
function updateLeaveBtn(){
  const b=$('#btnLeave'); if(!b) return;
  b.classList.toggle('hidden', G.hudOwner==='desktop');
}
function buildRoom(name){
  if(G.roomGroup){ G.scene.remove(G.roomGroup); }
  G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
  G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
  G.ground=null; G.ceiling=null; G.vel.y=0; G.onGround=true;
  G.room=name;
  const L=window.LEVELS[name];
  G.scene.background=new THREE.Color(0xf3e8ff);
  G.scene.fog=new THREE.Fog(0xf3e8ff, 60, 190);

  // floor
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(L.w,L.d),
    new THREE.MeshLambertMaterial({map:groundTexture(L.ground,L.accent)}));
  floor.rotation.x=-Math.PI/2; G.roomGroup.add(floor);

  // walls
  const wallMat=new THREE.MeshLambertMaterial({color:0xbfa8e8});
  const mk=(x,z,w,d)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,7,d), wallMat);
    m.position.set(x,3.5,z); G.roomGroup.add(m); addSolid(x,z,w,d); };
  mk(0,-L.d/2,L.w,1); mk(0,L.d/2,L.w,1); mk(-L.w/2,0,1,L.d); mk(L.w/2,0,1,L.d);

  G.hudOwner = (name==='free') ? 'free' : 'mission';
  if(L.free) buildFree(L);
  else buildArena(L);
  AVATAR.attach();                   // the player's body belongs to the room
  G.scene.updateMatrixWorld(true);   // so the crosshair can hit things before the first render
  updateMapLegend(); updateLeaveBtn(); codeBtnState=null; updateCodeBtn();
}

/* Free Play is the sandbox. The floor is left deliberately clear — the only
   things standing in it are the ones somebody built. */
function buildFree(L){
  G.pos.set(0,EYE,20); G.yaw=0; G.pitch=0;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(16,3.2),
    new THREE.MeshLambertMaterial({map:textTexture(['🔧 '+t('Workshop')],'#5aa8d6',32)}));
  sign.position.set(0,8,-L.d/2+0.7); G.roomGroup.add(sign);
  document.querySelector('#mapwrap').classList.add('hidden');
  if(window.VM) VM.enter(G.roomGroup);
}
function buildArena(L){
  G.pos.set(0,EYE,L.d/2-6); G.yaw=0; G.pitch=0;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(16,3.2),
    new THREE.MeshLambertMaterial({map:textTexture([t(G.arenaTitle||L.title)],'#6b4d9e',32)}));
  sign.position.set(0,8.5,-L.d/2+0.7); G.roomGroup.add(sign);
  setTimeout(()=>{
    if(G.missionId==='range') COMBAT.startRange();
    else COMBAT.startMission(G.missionId);
  }, 60);
}
function startMissionRoom(id){
  COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop(); if(window.FLIGHT) FLIGHT.stop();
  if(id==='tut'){ TUTOR.start(); return; }       // level 0 builds its own plaza
  if(id==='race'){ RACE.start(0); return; }      // and the circuit its own track
  if(id==='nav'){ NAV.start(0); return; }        // the corridor is its own room
  if(id==='flight'){ FLIGHT.start(0); return; }  // and the asteroid field its own sky
  G.hudOwner='mission';
  G.missionId=id;
  G.arenaTitle = id==='m1'?'The Loop Chamber'
    : id==='m2'?'The Prism Vault':'The Off-By-One Foundry';
  buildRoom('arena');
}

/* ------------------------------------------------------- progression */
const PROGRESS=(function(){
  const ORDER=['nav','m1','m2','m3'];
  let done={};
  try{ done=JSON.parse(localStorage.getItem('dq_progress')||'{}'); }catch(e){ done={}; }
  function save(){
    try{ localStorage.setItem('dq_progress',JSON.stringify(done)); }catch(e){}
    if(window.NET && NET.signedIn) NET.saveProgress(done);   // follows the student to any machine
  }
  return {
    load(p){ done=p||{}; },
    all(){ return done; },
    complete(id){ if(!id) return; done[id]=true; save(); if(window.MENU) MENU.render(); },
    isDone(id){ return !!done[id]; },
    // the quiz score rides in the same bag but never gates a mission unlock —
    // only complete() does that, so a checkpoint quiz can't skip the boss fight
    recordQuiz(id,pct){ if(!id) return; done['quiz_'+id]=pct; save(); },
    quizScore(id){ return done['quiz_'+id]; },
    unlocked(id){
      if(id==='free') return true;
      const i=ORDER.indexOf(id);
      return i<=0 ? true : !!done[ORDER[i-1]];
    },
    needs(id){ const i=ORDER.indexOf(id); return i>0?ORDER[i-1]:null; },
    reset(){ done={}; save(); }
  };
})();

window.PROGRESS=PROGRESS;

/* ------------------------------------------------------------- input */
function lockPointer(el){
  // some setups refuse pointer lock (embedded frames, kiosk policies) — the arrow keys still turn,
  // so a refusal must stay silent instead of throwing
  if(document.pointerLockElement || !el.requestPointerLock) return;
  try{ const p=el.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
}
/* a keystroke aimed at a text field belongs to the field, not the game */
function typingInField(e){
  const el = (e.target && e.target.tagName) ? e.target : document.activeElement;
  if(!el) return false;
  const tag=(el.tagName||'').toLowerCase();
  return tag==='input' || tag==='select' || tag==='textarea' || !!el.isContentEditable;
}
function wireInput(){
  addEventListener('keydown',e=>{
    /* A keystroke aimed at a text field belongs to the field. Swallowing SPACE
       unconditionally — to stop the page scrolling and to make jump work — also
       swallowed every space anybody tried to type into the chat or into a `say`
       block, and holding WASD to type walked the player around behind the panel. */
    if(typingInField(e)){
      G.keys[e.code]=false;
      if(e.code==='Escape' && document.pointerLockElement) document.exitPointerLock();
      return;
    }
    G.keys[e.code]=true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if(e.code==='Escape' && document.pointerLockElement) document.exitPointerLock();
    if(e.code==='KeyR' && PUZZLE.active && !PUZZLE.busy){ e.preventDefault(); PUZZLE.retry(); }
    if(e.code==='KeyR' && NAV.active && !NAV.busy){ e.preventDefault(); NAV.retry(); }
    if(e.code==='KeyR' && RACE.active && !RACE.busy){ e.preventDefault(); RACE.retry(); }
    if(e.code==='KeyE' && PUZZLE.active && G.running){ e.preventDefault(); PUZZLE.use(); return; }
    // results and knock-out screens advance on SPACE - no Esc, no hunting for the button
    if(!$('#done').classList.contains('hidden')){
      if(e.code==='Space'||e.code==='Enter'||e.code==='NumpadEnter'){
        e.preventDefault(); const b=$('#dAgain'); if(b) b.click();
      }
      return;
    }
    if(!$('#downed').classList.contains('hidden')){
      if(e.code==='Space'||e.code==='Enter'||e.code==='NumpadEnter'){
        e.preventDefault(); const b=$('#respawn'); if(b) b.click();
      }
      return;
    }
    // instructions close on a key, so nobody has to release the mouse first
    if(!$('#teach').classList.contains('hidden')){
      if(e.code==='Space'||e.code==='Enter'||e.code==='NumpadEnter'){
        e.preventDefault(); const b=$('#teachGo'); if(b) b.click();
      }
      return;
    }
    // C opens the block editor in Free Play, the same key that opens the code
    // console everywhere else — one key for "write the code", whatever room
    // you are standing in. Letter keys never fire while the caret is in a
    // field: typing "c" into a number slot must not close the editor around
    // it, and typing "p" into the chat must not pause the game.
    if(!typingInField(e)){
      /* Find object → select object → program object. Looking at a thing and
         pressing the key opens ITS code, not whatever was open last. */
      /* On the planet E is the door key: look at a station or a building
         panel and it takes you in. Nothing else on the planet uses E. */
      if(e.code==='KeyE' && G.running && G.room==='planet'){
        const u=G.focused && G.focused.userData;
        if(u && u.enter){ e.preventDefault(); PLANET.use(u.enter); return; }
      }
      if((e.code==='KeyC'||e.code==='KeyE') && G.running && G.room==='free'){
        const on = G.focused && G.focused.userData && G.focused.userData.actor;
        if(on && !CODER.open){ e.preventDefault(); CODER.openOn(on); return; }
        if(e.code==='KeyC'){ e.preventDefault(); CODER.toggle(); return; }
      }
      if(e.code==='KeyP' && G.running){ e.preventDefault(); togglePause(); return; }
      if(e.code==='KeyV' && G.running){ e.preventDefault(); G.firstPerson=!G.firstPerson; return; }
    }
    if(G.room==='free' && CHAT.open && (e.code==='Enter'||e.code==='NumpadEnter')){
      e.preventDefault();
      if(document.activeElement===$('#chatIn')) $('#chatForm').requestSubmit();
      else CHAT.focus();
      return;
    }
    if((e.code==='KeyC'||e.code==='Tab') && G.running && !typingInField(e)
       && (PUZZLE.active || NAV.active || TUTOR.active || RACE.active
           || (window.FLIGHT && FLIGHT.active) || G.room==='arena')
       && !COMBAT.busy && !COMBAT.dead && !PUZZLE.busy && !NAV.busy && !TUTOR.busy && !RACE.busy){
      e.preventDefault();
      CODE.isOpen() ? CODE.close() : CODE.show();
    }
  });
  addEventListener('keyup',e=>{ G.keys[e.code]=false; });

  const canvas=$('#view');
  canvas.addEventListener('mousedown',()=>{
    if(!G.running) return;
    if(window.CODER && CODER.open) return;   // the editor needs the mouse
    lockPointer(canvas);
  });
  document.addEventListener('pointerlockchange',()=>{ G.locked=!!document.pointerLockElement; });
  document.addEventListener('mousemove',e=>{
    if(!G.locked) return;
    G.yaw   -= e.movementX*0.0022;
    G.pitch  = clamp(G.pitch - e.movementY*0.0022, -1.2, 1.2);
  });
  canvas.addEventListener('click',e=>{
    if(!G.running) return;
    if(COMBAT.inRange){ COMBAT.rangeShot(); return; }   // the range is pure aiming
    if(G.hudOwner==='mission') COMBAT.manualShot();             // in a fight, the trigger fires
  });
  canvas.addEventListener('dblclick',()=>{ if(G.running) open(); });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
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
  updateCodeBtn();
  if(NAV.active) NAV.tick(dt);      // it keeps coming while you write
  if(RACE.active) RACE.tick(dt);   // and the clock keeps running while you write
  if(window.FLIGHT && FLIGHT.active) FLIGHT.tick(dt);   // and the field keeps arriving
  if(window.PLANET && PLANET.active) PLANET.tick(dt);  // and the class keeps walking about
  /* Free play keeps thinking while the world is frozen: scripts step on, and
     what our objects look like has to keep going out — otherwise a paused or
     typing player leaves the room holding a stale picture of them. */
  if(G.room==='free'){ VM.step(dt); CODER.tick(dt); if(window.MISSIONS) MISSIONS.tick(dt);
                       if(window.OWN) OWN.update(dt);      // whose object is whose
                       if(window.FREE) FREE.share(); }
  if(G.running && !frozen()){
    step(dt);
    if(TUTOR.active) TUTOR.tick(dt);
    if(PUZZLE.active) PUZZLE.update(dt);
    focusScan();
    if(PUZZLE.active) PUZZLE.map();
    else if(!NAV.active && G.room) drawMap();   // the corridors have no map
    if(G.room==='arena'&&!PUZZLE.active&&!NAV.active) COMBAT.update(dt);
    if(G.room==='free') FREE.tick(dt);
  }
  G.renderer.render(G.scene,G.camera);
}
function frozen(){
  return CODE.isOpen()
      || !$('#teach').classList.contains('hidden')     // reading instructions pauses the world
      || !$('#pause').classList.contains('hidden')
      || !$('#downed').classList.contains('hidden')
      || document.activeElement===$('#chatIn');
}
function togglePause(){
  const p=$('#pause');
  if(!p.classList.contains('hidden')){ p.classList.add('hidden'); lockPointer($('#view')); return; }
  if(document.pointerLockElement) document.exitPointerLock();
  const sk=$('#skill').classList.contains('hidden') ? '' :
    `<div class="p-lbl">${t('SKILL YOU ARE USING')}</div>
     <div class="p-hint"><b>${$('#skName').textContent}</b><br>${$('#skText').textContent}
     <pre>${$('#skCode').textContent}</pre></div>`;
  p.innerHTML=`<div class="card" style="max-width:640px;text-align:left">
      <h1 style="text-align:center;margin-top:0">⏸ ${t('Paused')}</h1>
      <div class="p-lbl">${t('MISSION')}</div>
      <div style="font-size:17px">${$('#missionName').textContent}</div>
      <ol class="p-objs">${$('#objList').innerHTML}</ol>
      <div class="p-lbl">${t('YOUR HINT')}</div>
      <div class="p-hint">${$('#briefing').innerHTML||'—'}</div>
      ${sk}
      <div class="p-lbl">${t('DIFFICULTY')}</div>
      <div class="diffrow" id="pDiff"></div>
      <div class="p-lbl">${t('KEYS')}</div>
      <div class="p-hint">${$('#keys').innerHTML}</div>
      <div class="p-lbl">${t('JUMP TO A MISSION')}</div>
      <div class="jumprow" id="pJump"></div>
      <div style="text-align:center;margin-top:14px">
        <button class="btn good" id="pClose">${t('Back to the game ▶')}</button>
        <button class="btn ghost small" id="pHome">${t('Back to the planet')}</button>
        <button class="btn ghost small" id="pQuit">${t('Leave to the menu')}</button>
      </div>
    </div>`;
  p.classList.remove('hidden');
  pauseDiff();
  pauseJump();
  $('#pClose').onclick=()=>togglePause();
  const ph=$('#pHome');
  if(ph) ph.onclick=()=>{ p.classList.add('hidden'); MENU.homeworld(); };
  $('#pQuit').onclick=()=>{ p.classList.add('hidden'); MENU.open(); };
}
/* The planet is how you are meant to get to a mission, but a walk across it
   should never be the only way — this is the old grid, folded into the pause
   menu, so nobody is ever stuck because they could not find a door. */
function pauseJump(){
  const row=$('#pJump'); if(!row || !window.PLANET) return;
  row.innerHTML='';
  PLANET.STATIONS.forEach(st=>{
    const open_=PROGRESS.unlocked(st.id);
    const b=document.createElement('button');
    b.className='jumpbtn'+(open_?'':' lock')+(PROGRESS.isDone(st.id)?' done':'');
    b.style.setProperty('--a', st.a);
    b.disabled=!open_;
    b.innerHTML=`<span class="jem">${open_?st.em:'🔒'}</span><b>${t(st.name)}</b>`;
    b.onclick=()=>{ $('#pause').classList.add('hidden');
                    $('#hud').classList.remove('hidden');
                    if(window.PLANET) PLANET.leave();
                    startMissionRoom(st.id); };
    row.appendChild(b);
  });
}

/* Difficulty is read live by the chase and the guns, so switching it here
   lands on the next step and the next shot — no restart, and the program the
   student has already written stays exactly where it is. */
function pauseDiff(){
  const row=$('#pDiff'); if(!row || !window.DIFF) return;
  row.innerHTML='';
  DIFF.LEVELS.forEach(d=>{
    const b=document.createElement('button');
    b.className='diffbtn'+(d.id===DIFF.current?' on':'');
    b.style.setProperty('--a', d.a);
    b.innerHTML=`<span class="dem">${d.em}</span><b>${t(d.name)}</b>`;
    b.onclick=()=>{ DIFF.set(d.id); pauseDiff(); if(window.beep) beep('pop');
                    if(window.MENU) MENU.render(); };
    row.appendChild(b);
  });
}
function step(dt){
  // In the corridor the program drives — the keys do nothing, but the camera
  // still has to follow the body the program is moving.
  const driven = NAV.active || RACE.active || (window.FLIGHT && FLIGHT.active);
  // turn with arrows too, so a student who cannot manage mouse-look can still play
  if(!driven && G.keys.ArrowLeft)  G.yaw += 2.0*dt;
  if(!driven && G.keys.ArrowRight) G.yaw -= 2.0*dt;
  const fwd = driven ? 0 : (G.keys.KeyW||G.keys.ArrowUp?1:0) - (G.keys.KeyS||G.keys.ArrowDown?1:0);
  const str = driven ? 0 : (G.keys.KeyD?1:0) - (G.keys.KeyA?1:0);
  const spd = (G.keys.ShiftLeft||G.keys.ShiftRight)?11:6.5;
  const sin=Math.sin(G.yaw), cos=Math.cos(G.yaw);
  let dx = (-sin*fwd + cos*str)*spd*dt;
  let dz = (-cos*fwd - sin*str)*spd*dt;
  if(dx||dz) G.stats.steps += Math.abs(dx)+Math.abs(dz);
  moveAxis('x',dx); moveAxis('z',dz);
  // stand on whatever the level calls the floor here, and jump off it
  const floor = (G.ground ? G.ground(G.pos.x, G.pos.z, G.pos.y-EYE) : 0) + EYE;
  if(G.onGround && G.keys.Space && !driven){ G.vel.y = JUMP; G.onGround = false; }
  if(G.onGround){
    if(floor < G.pos.y - 0.6){ G.onGround=false; G.vel.y=0; }   // walked off an edge
    else G.pos.y += (floor - G.pos.y) * Math.min(1, dt*14);     // ease over treads
  } else {
    G.vel.y -= GRAV*dt;
    G.pos.y += G.vel.y*dt;
    if(G.pos.y <= floor){ G.pos.y=floor; G.vel.y=0; G.onGround=true; }
  }
  GUN.update(dt, !!(dx||dz));

  if(G.firstPerson){
    G.camera.position.copy(G.pos);
    G.camera.rotation.set(0,0,0,'YXZ');
    G.camera.rotation.order='YXZ';
    G.camera.rotation.y=G.yaw; G.camera.rotation.x=G.pitch;
  } else thirdPerson();
  AVATAR.update(dt, !!(dx||dz), !!(G.keys.ShiftLeft||G.keys.ShiftRight), G.onGround);

  if(G.room==='plaza'){
    /* the old desktop mission listened here; it is gone, and so is fire() */
  }
}
function moveAxis(axis,d){
  if(!d) return;
  const p=G.pos.clone(); p[axis]+=d;
  const feet=G.pos.y-EYE;
  for(const s of G.solids){
    if(s.y1!==undefined && (feet+2.2 < s.y1 || feet > s.y2-0.6)) continue;
    if(p.x+PLAYER_R>s.x1 && p.x-PLAYER_R<s.x2 && p.z+PLAYER_R>s.z1 && p.z-PLAYER_R<s.z2) return;
  }
  G.pos[axis]+=d;
}

const ray=new THREE.Raycaster(); ray.far=34;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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
    if(u.actor){                                  // a coded object names itself
      box.innerHTML = esc(u.actor.name) + '<small>' + t('E — program this') + '</small>';
    } else if(u.enter){
      // a door on the planet: say so, and say when it is not open to you yet
      const locked = u.kind==='station' && window.PROGRESS && !PROGRESS.unlocked(u.enter);
      box.innerHTML = t(u.label) + '<small>' +
        (locked ? '🔒 '+t('Locked') : t('E — go in')) + '</small>';
    } else {
      box.innerHTML = t(u.label) + '<small>' + (u.kind==='gate'? t('walk in')
        : (G.selected===owner ? t('SELECTED')+' · '+t('double-click to open')
                              : t('one click')+' → '+t('double-click'))) + '</small>';
    }
  } else { cross.classList.remove('on'); box.classList.add('hidden'); }
}

/* ---------------------------------------------------------- minimap */
function drawMap(){
  const c=$('#map'), x=c.getContext('2d');
  const L=window.LEVELS[G.room]; if(!L) return;
  const sx=c.width/L.w, sz=c.height/L.d;
  const px=v=>(v+L.w/2)*sx, pz=v=>(v+L.d/2)*sz;
  x.clearRect(0,0,c.width,c.height);
  x.fillStyle='#0d1626'; x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='#33456b'; x.lineWidth=2; x.strokeRect(2,2,c.width-4,c.height-4);
  {
    (L.folders||[]).forEach(f=>{ x.fillStyle='#3ddc84'; x.fillRect(px(f.x)-4,pz(f.z)-4,8,8); });
    if(L.exit){ x.fillStyle='#ff6b6b'; x.fillRect(px(L.exit.x)-4,pz(L.exit.z)-4,8,8); }
  }
  /* The fight, from above: the cover you can duck behind, every drone that
     can shoot you, and the boss ringed so you can find him in a crowd. */
  if(G.room==='arena' && window.COMBAT){
    (COMBAT.cover||[]).forEach(o=>{
      x.fillStyle='#33456b';
      x.fillRect(px(o.x1), pz(o.z1), (o.x2-o.x1)*sx, (o.z2-o.z1)*sz);
    });
    (COMBAT.targets||[]).forEach(m=>{
      if(!m.parent) return;                       // already shot off the field
      x.strokeStyle='#ffe9a8'; x.lineWidth=2;
      x.beginPath(); x.arc(px(m.position.x), pz(m.position.z), 3.5, 0, 7); x.stroke();
    });
    (COMBAT.enemies||[]).forEach(e=>{
      if(e.dead) return;
      // a shielded drone is drawn in the colour you have to shoot it with
      x.fillStyle = e.shield==='red' ? '#ff6b81' : e.shield==='blue' ? '#5ec8ff' : '#ff9aa2';
      x.beginPath(); x.arc(px(e.mesh.position.x), pz(e.mesh.position.z), 3.4, 0, 7); x.fill();
      x.strokeStyle='#0d1626'; x.lineWidth=1.4; x.stroke();
    });
    const b=COMBAT.boss;
    if(b && !b.dead){
      const bx=px(b.mesh.position.x), bz=pz(b.mesh.position.z);
      const beat=(performance.now()%1400)/1400;
      x.beginPath(); x.arc(bx,bz, 6+beat*8, 0, 7);
      x.strokeStyle=`rgba(255,233,168,${(1-beat)*0.7})`; x.lineWidth=2; x.stroke();
      x.fillStyle = b.color==='red' ? '#ff9aa2' : b.color==='blue' ? '#8fd3ff' : '#ffe9a8';
      x.beginPath();
      x.moveTo(bx,bz-6); x.lineTo(bx+6,bz); x.lineTo(bx,bz+6); x.lineTo(bx-6,bz);
      x.closePath(); x.fill();
      x.strokeStyle='#0d1626'; x.lineWidth=1.5; x.stroke();
    }
  }
  // player
  const cx=px(G.pos.x), cy=pz(G.pos.z);
  x.fillStyle='#fff'; x.beginPath(); x.arc(cx,cy,3.5,0,7); x.fill();
  x.strokeStyle='#fff'; x.lineWidth=2; x.beginPath(); x.moveTo(cx,cy);
  x.lineTo(cx - Math.sin(G.yaw)*11, cy - Math.cos(G.yaw)*11); x.stroke();
}
function updateMapLegend(){
  const L=window.LEVELS[G.room];
  $('#mapTitle').textContent = G.room==='arena' ? t('THE FIELD') : t('DESKTOP MAP');
  $('#maplegend').textContent = t(G.arenaTitle || (L&&L.title) || '');
}

/* ------------------------------------------------------- missions */
// every wiring here is optional: the sign-in screen and the menu own
// different parts of the page, and one missing button must not kill boot
function on(sel,fn){ const el=$(sel); if(el) el.onclick=fn; }
function txt(sel,v){ const el=$(sel); if(el) el.textContent=v; }
function html(sel,v){ const el=$(sel); if(el) el.innerHTML=v; }
function wireUI(){
  $$('.langbtn').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
  on('#btnLang',()=>setLang(window.LANG==='en'?'es':'en'));
  on('#btnLeave',()=>returnToDesktop());
  on('#btnHelp',()=>togglePause());
}
function setLang(l){
  window.LANG=l;
  document.documentElement.lang=l;
  $$('.langbtn').forEach(b=>b.classList.toggle('on',b.dataset.lang===l));
  $('#btnLang').textContent = l==='en' ? '🌐 Español' : '🌐 English';
  txt('#sTitle',t('Mission: Linux'));
  txt('#sSub',t('Sign in to save your progress and play with your class'));
  txt('#btnIn',t('Sign in ▶'));
  txt('#btnUp',t('Create my account ▶'));
  txt('#btnGuest',t('Play as a guest'));
  txt('#tabIn',t('I have an account'));
  txt('#tabUp',t('New student'));
  txt('#sNote',t('Ask your teacher for the class code.'));
  $('#objTitle').textContent=t('MISSION');
  $('#mapTitle').textContent=t('DESKTOP MAP');
  $('#missionName').textContent=t('Basic Training — The Desktop');
  $('#keys').innerHTML=`<b>W A S D</b> / <b>↑ ↓</b> ${t('Move')} &nbsp; <b>← →</b> ${t('Turn')} &nbsp; <b>SPACE</b> ${t('Jump')}<br>
    <b>${t('one click')}</b> ${t('Select')} &nbsp; <b>${t('double-click')}</b> ${t('Open')} &nbsp; <b>Shift</b> ${t('Run')}<br>
    <b>C</b> ${t('write code')} &nbsp; <b>${t('left click')}</b> ${t('one shot')}`;
  if(G.running && G.room) buildRoom(G.room);
  if(window.MENU) MENU.render();
}
CODE.onRun=(steps)=>{
  if(window.FLIGHT && FLIGHT.active) FLIGHT.run(steps);
  else if(RACE.active) RACE.run(steps);
  else if(TUTOR.active) TUTOR.run(steps);
  else if(NAV.active) NAV.run(steps);
  else if(PUZZLE.active) PUZZLE.run(steps);
  else { COMBAT.runProgram(steps); lockPointer($('#view')); }
};

function showResults(o){
  $('#dTitle').innerHTML = o.title||'';
  $('#dBody').innerHTML  = o.body||'';
  $('#dStats').innerHTML = o.stats||'';
  const b=$('#dAgain');
  b.textContent = o.btnText || t('Back to the menu');
  b.onclick = o.onBtn || (()=>returnToDesktop());   // reset every single time
  const k=$('#dKey'); if(k) k.innerHTML=t('or press <kbd>SPACE</kbd>');
  $('#done').classList.remove('hidden');
}
window.showResults=showResults;
/* Every results screen lands here. Home is the planet now — the mission grid
   is a shortcut behind P, not the place you live. */
function returnToDesktop(){
  if(window.PLANET && MENU.homeworld) MENU.homeworld();
  else MENU.open();
}
function begin(){ MENU.open(); }

init();
requestAnimationFrame(loop);
(async function boot(){
  // straight into KORO — accounts still work underneath, they are just not
  // the first thing a student has to get past
  MENU.wireAuth();
  try{ const u = await NET.resume(); if(u && u.progress) PROGRESS.load(u.progress); }catch(e){}
  MENU.start();
})();
