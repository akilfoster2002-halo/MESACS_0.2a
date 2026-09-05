/* =====================================================================
   THE PLANET — the hub, as a place instead of a menu.

   You do not pick a mission off a grid any more. You land on a small
   world, you can see your class walking about on it, and you get to a
   mission by walking into the building that holds it. A nine-year-old
   who cannot yet read a menu can still find a door.

   It is a SPHERICAL CAP, not a sphere. The ground is a dome you walk up
   and over, so the horizon falls away and it reads unmistakably as
   somewhere you are standing ON — but underneath it is still a height
   function of x and z, which means movement, gravity, the chase camera,
   the avatar and every box collision in the game keep working exactly as
   they already do. A real sphere would mean rewriting all of that, and
   the missions that already work would pay for it.

   Three buildings stand on it:
     Mission Control  every mission, as a station you walk up to
     The Workshop     the shared sandbox, where the objects live
     The Wardrobe     the character roster, on plinths

   The mission grid still exists behind P, because nobody should ever be
   stuck on a planet because they could not find a door.
   ===================================================================== */
window.PLANET = (function(){
  const R    = 82;                 // how far the ground reaches
  const DOME = 15;                 // and how high the middle stands above the rim
  /* the sphere this cap is cut from: solve for the radius whose cap is R
     across and DOME tall, so the rim lands exactly at y=0 */
  const RS   = (R*R + DOME*DOME) / (2*DOME);
  const BASE = RS - DOME;
  const SKY  = 0x070a1a;

  /* ------------------------------------------------------------ the ground */
  function dome(x,z){
    const d2=x*x+z*z;
    if(d2>=R*R) return 0;
    return Math.sqrt(RS*RS-d2)-BASE;
  }
  /* A building stands on a flat pad cut into the dome, or its floor would
     tilt under your feet and its walls would hang off the slope. */
  let pads=[];
  function ground(x,z){
    for(const p of pads)
      if(x>p.x1 && x<p.x2 && z>p.z1 && z<p.z2) return p.y;
    return dome(x,z);
  }

  /* ----------------------------------------------------------- what is here */
  const BUILDINGS=[
    { id:'missions', name:'MISSION CONTROL', em:'🚀', x:0,  z:-34, w:40, d:26,
      wall:0x3a4f8c, roof:0x8fd3ff,
      blurb:'Every mission, one station each' },
    { id:'workshop', name:'THE WORKSHOP',    em:'🔧', x:-46, z:24, w:22, d:20,
      wall:0x4a3f7a, roof:0xcdb4f6,
      blurb:'Build anything, with your class' },
    { id:'wardrobe', name:'THE WARDROBE',    em:'🙂', x:46,  z:24, w:20, d:18,
      wall:0x6b4a5e, roof:0xffb4a2,
      blurb:'Change who you are' }
  ];
  /* The stations, in the order the course runs. These are the same ids the
     old mission grid launched, so nothing about how a mission starts changes
     — only how you get to it. */
  const STATIONS=[
    { id:'tut',    em:'🎮', name:'Level 0 — Basics',        a:'#ffe9a8' },
    { id:'nav',    em:'🧟', name:'Escape — Corridors',      a:'#8fd3ff' },
    { id:'flight', em:'🚀', name:'Mission 1 — Space Explorer', a:'#8ff0ff' },
    { id:'m1',     em:'🧟', name:'Mission 2 — Loops',       a:'#a8e6cf' },
    { id:'m2',     em:'🔮', name:'Mission 3 — Choices',     a:'#cdb4f6' },
    { id:'m3',     em:'🧮', name:'Mission 4 — Functions',   a:'#ffb4a2' }
  ];

  let on=false, server=null, others=new Map(), crowd=null, spin=0;
  /* Where you were standing when you last left. Going into a mission, the
     Workshop or the Wardrobe and coming back should put you back at the door
     you went in by — being teleported to the landing site every time makes
     the planet feel like a menu again, which is the one thing it is not. */
  let back=null;

  /* ---------------------------------------------------------------- build */
  function enter(sv){
    server = sv || null;
    COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop();
    if(window.FLIGHT) FLIGHT.stop();
    if(window.MISSIONS) MISSIONS.stop();
    if(window.CODER) CODER.hide();
    CODE.close(); CODE.hideTape(); CODE.setGuide(null); CODE.setBudget(0);
    if(window.VM) VM.leave();

    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null; G.ceiling=null;
    G.vel.y=0; G.onGround=true;
    pads=[]; others.clear();
    G.room='planet'; G.hudOwner='planet'; G.missionId=null; G.running=true;
    G.scene.background=new THREE.Color(SKY);
    G.scene.fog=new THREE.Fog(SKY, 140, 420);
    G.ground=ground;
    on=true;

    sky(); surface(); rim();
    BUILDINGS.forEach(build);
    crowd=new THREE.Group(); G.roomGroup.add(crowd);

    /* Back where you left, if you have been here before. Otherwise you land
       at the front of the world looking up the hill at the doors — forward
       here is (-sin yaw, 0, -cos yaw), so yaw 0 faces -z, which is where
       Mission Control stands. */
    if(back){
      G.pos.set(back.x, ground(back.x, back.z)+EYE, back.z);
      G.yaw=back.yaw; G.pitch=back.pitch;
    } else {
      G.pos.set(0, dome(0,44)+EYE, 44); G.yaw=0; G.pitch=-0.04;
    }
    if(window.AVATAR) AVATAR.attach();
    G.scene.updateMatrixWorld(true);

    document.querySelector('#mapwrap').classList.add('hidden');
    ['#health','#skill','#trigger','#fbeat','#radar'].forEach(s=>{
      const e=document.querySelector(s); if(e) e.classList.add('hidden'); });
    hud();
    connect();
    if(!toured()){ markToured(); setTimeout(()=>{ if(on) tour(); }, 700); }
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.updateCodeBtn) updateCodeBtn();
    lockPointer(document.querySelector('#view'));
  }

  function sky(){
    const n=2200, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      // a shell of stars rather than a box, so there is no corner to see
      const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), rr=520+Math.random()*260;
      pos[i*3  ]=Math.sin(ph)*Math.cos(th)*rr;
      pos[i*3+1]=Math.abs(Math.cos(ph))*rr*0.7+30;
      pos[i*3+2]=Math.sin(ph)*Math.sin(th)*rr;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    G.roomGroup.add(new THREE.Points(g, new THREE.PointsMaterial({
      color:0xdfe8ff, size:1.5, sizeAttenuation:true })));

    // a big quiet neighbour on the horizon, and a sun to light the place
    const neighbour=new THREE.Mesh(new THREE.SphereGeometry(120,32,24),
      new THREE.MeshLambertMaterial({color:0x7c5cc4}));
    neighbour.position.set(-330,110,-430); G.roomGroup.add(neighbour);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(180,7,10,48),
      new THREE.MeshBasicMaterial({color:0xcdb4f6, transparent:true, opacity:.45}));
    ring.position.copy(neighbour.position); ring.rotation.set(1.15,0.3,0.2);
    G.roomGroup.add(ring);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(26,20,16),
      new THREE.MeshBasicMaterial({color:0xfff3d0}));
    sun.position.set(260,180,-300); G.roomGroup.add(sun);
  }

  function surface(){
    const th=Math.asin(Math.min(1,R/RS));
    const g=new THREE.SphereGeometry(RS, 96, 48, 0, Math.PI*2, 0, th);
    const m=new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color:0x6fae7a }));
    m.position.y=-BASE; G.roomGroup.add(m);
    /* The rock the soil sits on, so the edge of the world has a thickness you
       can see from the rim. OPEN ENDED and a shade narrower than the surface:
       a capped cone puts a full-radius disc across the world and you end up
       looking at the underside of your own planet. */
    const under=new THREE.Mesh(new THREE.ConeGeometry(R*0.985, 44, 64, 1, true),
      new THREE.MeshLambertMaterial({ color:0x4b3f5e, side:THREE.DoubleSide }));
    under.position.y=-22.4; under.rotation.x=Math.PI; G.roomGroup.add(under);

    scatter();
  }
  /* Trees and rocks, thinned out and kept off the doors, so the walk between
     buildings is somewhere rather than an empty green disc. */
  function scatter(){
    const trunk=new THREE.MeshLambertMaterial({color:0x6b4a34});
    const leaf =new THREE.MeshLambertMaterial({color:0x4f9457});
    const stone=new THREE.MeshLambertMaterial({color:0x7d7a86});
    for(let i=0;i<120;i++){
      const a=Math.random()*Math.PI*2, r=14+Math.random()*(R-22);
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      if(BUILDINGS.some(b=>Math.abs(x-b.x)<b.w*0.9 && Math.abs(z-b.z)<b.d*1.4)) continue;
      if(Math.abs(x)<7 && z>0) continue;                 // keep the landing path clear
      const y=dome(x,z);
      if(Math.random()<0.62){
        const h=3+Math.random()*3;
        const t1=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.4,h,6), trunk);
        t1.position.set(x,y+h/2,z); G.roomGroup.add(t1);
        const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5+Math.random(),0), leaf);
        c.position.set(x,y+h+0.9,z); G.roomGroup.add(c);
      } else {
        const s=new THREE.Mesh(new THREE.IcosahedronGeometry(0.7+Math.random()*1.1,0), stone);
        s.position.set(x,y+0.4,z); s.rotation.set(Math.random(),Math.random(),Math.random());
        G.roomGroup.add(s);
      }
    }
  }
  /* A ring of markers at the edge, and the solids that stop you walking off
     it. The collision system is axis-aligned boxes, so the circle is made of
     enough of them that you never find the gap. */
  function rim(){
    const n=44, mat=new THREE.MeshLambertMaterial({color:0x8fd3ff});
    for(let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2, x=Math.cos(a)*(R-2), z=Math.sin(a)*(R-2);
      const p=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.45,3.4,6), mat);
      p.position.set(x, dome(x,z)+1.7, z); G.roomGroup.add(p);
      const w=(2*Math.PI*R)/n*1.5;
      G.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-w/2, z2:z+w/2 });
    }
  }

  /* A wide sign wants a wide canvas. The shared textTexture() is 256 square,
     and stretching that across a forty-unit fascia turns the letters to
     toffee — so the buildings get their own. */
  function signTexture(text, tint){
    const c=document.createElement('canvas'); c.width=512; c.height=96;
    const x=c.getContext('2d');
    x.fillStyle='rgba(10,16,32,.92)';
    x.fillRect(0,0,512,96);
    x.strokeStyle='#'+tint.toString(16).padStart(6,'0');
    x.lineWidth=6; x.strokeRect(3,3,506,90);
    x.fillStyle='#eef3ff'; x.textAlign='center'; x.textBaseline='middle';
    x.font='bold 46px "Trebuchet MS",system-ui,sans-serif';
    x.fillText(text, 256, 52, 470);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }

  /* --------------------------------------------------------- the buildings */
  function build(b){
    const y=dome(b.x,b.z);
    const hw=b.w/2, hd=b.d/2, H=9;
    // the flat pad the building stands on, cut into the hill
    pads.push({ x1:b.x-hw-2, x2:b.x+hw+2, z1:b.z-hd-2, z2:b.z+hd+2, y });
    const pad=new THREE.Mesh(new THREE.BoxGeometry(b.w+4, 1, b.d+4),
      new THREE.MeshLambertMaterial({color:0x8b8f9e}));
    pad.position.set(b.x, y-0.5, b.z); G.roomGroup.add(pad);

    const wall=new THREE.MeshLambertMaterial({color:b.wall});
    /* `up` is how far off the pad the piece STARTS. Without it every box sits
       on the ground, which is fine for a wall and wrong for the bit over a
       door — and a lintel seated on the floor is just a wall across the
       doorway, which is exactly what it was. */
    const put=(x,z,w,d,h,up)=>{
      const hh=h||H, base=y+(up||0);
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d), wall);
      m.position.set(x, base+hh/2, z); G.roomGroup.add(m);
      G.solids.push({x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:base, y2:base+hh});
    };
    // back and sides solid; the front has a doorway cut out of the middle
    put(b.x, b.z-hd, b.w, 1);
    put(b.x-hw, b.z, 1, b.d);
    put(b.x+hw, b.z, 1, b.d);
    const gap=9, side=(b.w-gap)/2, DOOR=6;
    put(b.x-(gap/2+side/2), b.z+hd, side, 1);
    put(b.x+(gap/2+side/2), b.z+hd, side, 1);
    // the lintel starts at head height and goes up to the roof
    put(b.x, b.z+hd, gap, 1, H-DOOR, DOOR);

    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.w+2.4, 0.8, b.d+2.4),
      new THREE.MeshLambertMaterial({color:b.roof}));
    roof.position.set(b.x, y+H+0.4, b.z); G.roomGroup.add(roof);

    // the name, over the door, readable from across the planet
    const W=b.w*0.9, HH=W*(96/512);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(W, HH),
      new THREE.MeshBasicMaterial({map:signTexture(b.em+'  '+t(b.name), b.roof),
                                   transparent:true}));
    sign.position.set(b.x, y+H+1.2+HH/2, b.z+hd+0.25); G.roomGroup.add(sign);

    if(b.id==='missions') stations(b, y);
    else doorway(b, y);
  }
  /* The Workshop and the Wardrobe are one door each: a panel just inside,
     because a door you walk through and nothing happens is a broken door. */
  function doorway(b, y){
    const p=addPanel({ x:b.x, z:b.z-b.d/2+3.2, name:b.blurb, emoji:b.em,
                       kind:'door', id:b.id, opens:b.id, bg:'#22406b' });
    p.position.y=y;
    p.userData.enter=b.id;
  }
  /* Mission Control: one station per mission, in a row along the back wall,
     each wearing its own mission's face. Walk up, press E, you are in it. */
  function stations(b, y){
    const n=STATIONS.length;
    const span=b.w-8, step=span/(n-1);
    STATIONS.forEach((s,i)=>{
      const x=b.x-span/2+i*step;
      const p=addPanel({ x, z:b.z-b.d/2+3.4, name:s.name, emoji:s.em,
                         kind:'station', id:s.id, opens:s.id, bg:'#1b2740' });
      p.position.y=y;
      p.scale.setScalar(0.62);                 // six of them have to fit shoulder to shoulder
      p.userData.enter=s.id;
      p.userData.done=!!(window.PROGRESS && PROGRESS.isDone(s.id));
    });
  }

  /* ------------------------------------------------------- walking into one */
  function use(id){
    if(!id) return;
    if(id==='workshop'){ leave(); return FREE.enter(server||{id:null,name:'Workshop'}, null); }
    if(id==='wardrobe'){ leave(); return MENU.chars(); }
    // everything else is a mission, started exactly the way the grid started it
    if(!PROGRESS.unlocked(id)){
      say(t('🔒 Finish {m} first',{m:t(MENU.labelOf(PROGRESS.needs(id)))}));
      return;
    }
    leave();
    document.querySelector('#hud').classList.remove('hidden');
    startMissionRoom(id);
  }
  function say(msg){
    const b=document.querySelector('#briefing');
    if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
    clearTimeout(say._t);
    say._t=setTimeout(()=>{ if(on) b.innerHTML=t('Walk into a building. <b>E</b> to go in.'); }, 3200);
  }

  /* ------------------------------------------------------------- the class */
  function connect(){
    if(!server || !server.id || !window.NET) return;
    NET.connect(server.id, {
      players:list=>paint(list),
      objs:()=>{},                                  // objects live in the Workshop
      chat:(m)=>CHAT.line(m.from, m.text, m.id),
      sys:s=>CHAT.sys(s),
      clear:q=>CHAT.clear(q),
      unsay:id=>CHAT.remove(id)
    });
    CHAT.show();
  }
  /* The same easing FREE uses: what arrives is a target and the frame loop
     walks towards it, or twelve updates a second reads as twelve steps. */
  function paint(list){
    if(!crowd) return;
    const seen=new Set();
    list.forEach(p=>{
      if(window.NET && NET.me && p.id===NET.me.id) return;   // you are already here
      seen.add(p.id);
      let o=others.get(p.id);
      if(!o){
        const g=new THREE.Group();
        g.add(nameTag(p.display));
        g.position.set(p.x, dome(p.x,p.z), p.z);
        crowd.add(g);
        o={ g, char:null, model:null, tx:p.x, tz:p.z, tyaw:p.yaw+Math.PI, speed:0 };
        others.set(p.id,o);
      }
      if(p.char && o.char!==p.char){
        o.char=p.char;
        AVATAR.load(p.char).then(m=>{ if(o.model) o.g.remove(o.model); o.model=m; o.g.add(m); })
                           .catch(()=>{});
      }
      o.tx=p.x; o.tz=p.z; o.tyaw=p.yaw+Math.PI;
    });
    for(const [id,o] of others) if(!seen.has(id)){ crowd.remove(o.g); others.delete(id); }
  }
  function nameTag(name){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(29,23,48,.85)'; x.fillRect(0,14,256,36);
    x.fillStyle='#a8e6cf'; x.font='bold 26px "Trebuchet MS",sans-serif'; x.textAlign='center';
    x.fillText(String(name||'').slice(0,16),128,42);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
    s.scale.set(4,1,1); s.position.y=3.2; return s;
  }

  let sent=0;
  function tick(dt){
    if(!on) return;
    spin+=dt;
    tourTick(dt);
    const k=1-Math.pow(0.0008, Math.min(dt,0.1));
    for(const [,o] of others){
      const dx=o.tx-o.g.position.x, dz=o.tz-o.g.position.z;
      if(Math.hypot(dx,dz)>14){ o.g.position.set(o.tx, dome(o.tx,o.tz), o.tz); o.speed=0; }
      else {
        o.g.position.x+=dx*k; o.g.position.z+=dz*k;
        o.g.position.y=dome(o.g.position.x, o.g.position.z);   // they stand on the hill too
      }
      let d=o.tyaw-o.g.rotation.y;
      d=Math.atan2(Math.sin(d),Math.cos(d));
      o.g.rotation.y+=d*k;
      const v=Math.hypot(dx,dz)/Math.max(dt,0.001);
      o.speed += (v-o.speed)*Math.min(1,dt*8);
      if(o.model) AVATAR.animate(o.model, dt,
        o.speed>3.2?'sprint' : o.speed>0.35?'walk' : 'idle');
    }
    if(window.NET && NET.live){
      const now=performance.now();
      if(now-sent>90){ sent=now;
        NET.pos(+G.pos.x.toFixed(2), +G.pos.z.toFixed(2), +G.yaw.toFixed(2), AVATAR.chosen); }
    }
  }

  /* ------------------------------------------------------------ the tour

     Nobody is born knowing that W walks and E opens a door. The first time
     you land, the planet walks you through it: hold W, look with the mouse,
     go to that building, go in, look at a station, press E. Six steps, each
     one checked from the world rather than from what the coach thinks it
     just asked for — so a child who runs ahead is never told to do the thing
     they have already done, and one who ignores it entirely is never blocked.

     It runs once. After that the planet is yours, and the tour is on the
     pause menu if anybody wants it again. */
  const TOUR_KEY='dq_toured';
  function toured(){ try{ return !!localStorage.getItem(TOUR_KEY); }catch(e){ return false; } }
  function markToured(){ try{ localStorage.setItem(TOUR_KEY,'1'); }catch(e){} }

  const MC = () => BUILDINGS[0];
  const doorOf = b => ({ x:b.x, y:dome(b.x,b.z)+3, z:b.z+b.d/2+3, size:3.5 });
  const insideOf = b => Math.abs(G.pos.x-b.x)<b.w/2 && Math.abs(G.pos.z-b.z)<b.d/2;
  const nearTo = (p,d) => Math.hypot(G.pos.x-p.x, G.pos.z-p.z) < d;

  function tour(){
    if(!window.COACH) return;
    const spawn={x:G.pos.x, z:G.pos.z};
    const yaw0=G.yaw;
    const first=()=>{
      // where the leftmost station stands, so the beacon can point at it
      const b=MC(), span=b.w-8;
      return { x:b.x-span/2, y:dome(b.x,b.z)+2.5, z:b.z-b.d/2+3.4, size:2 };
    };
    COACH.start([
      { say:'Welcome to your planet. Hold <b>W</b> to walk forward.',
        done:()=>Math.hypot(G.pos.x-spawn.x, G.pos.z-spawn.z) > 9 },
      { say:'Move the <b>mouse</b> to look around, and <b>A</b> and <b>D</b> to step sideways.',
        done:()=>Math.abs(((G.yaw-yaw0+Math.PI*3)%(Math.PI*2))-Math.PI) > 0.5 },
      { say:'That building up the hill is <b>Mission Control</b>. Every mission is inside it. Walk to the door.',
        at:()=>doorOf(MC()),
        done:()=>nearTo(doorOf(MC()), 14) },
      { say:'Straight through the doorway.',
        at:()=>doorOf(MC()),
        done:()=>insideOf(MC()) },
      { say:'These are the missions, one station each. Look straight at one — the name comes up under your crosshair.',
        at:first,
        done:()=>!!(G.focused && G.focused.userData && G.focused.userData.enter) },
      { say:'Now press <b>E</b> to go in. That is the whole game: walk to a thing, press E.',
        at:first,
        done:()=>!on }        // you left the planet, which means it worked
    ], {});
  }
  /* the tour is a walkthrough of the world, so it ticks with the world */
  function tourTick(dt){ if(window.COACH) COACH.tick(dt); }
  function retour(){ COACH.stop(); tour(); }

  /* ---------------------------------------------------------------- HUD */
  function hud(){
    const n=document.querySelector('#missionName');
    if(n) n.textContent = server && server.id ? t(server.name) : t('Home Planet');
    const o=document.querySelector('#objList');
    if(o) o.innerHTML=
      `<li class="cur">🚀 ${t('Mission Control')} — ${t('every mission, one station each')}</li>
       <li>🔧 ${t('The Workshop')} — ${t('build anything, with your class')}</li>
       <li>🙂 ${t('The Wardrobe')} — ${t('change who you are')}</li>`;
    say(t('Walk into a building. <b>E</b> to go in.'));
  }

  function leave(){
    // remember the spot before anything else has a chance to move you
    if(on) back={ x:G.pos.x, z:G.pos.z, yaw:G.yaw, pitch:G.pitch };
    on=false;
    if(window.COACH) COACH.tick(0);      // let the last step notice it is done
    if(window.CHAT) CHAT.hide();
    const b=document.querySelector('#briefing'); if(b) b.classList.add('hidden');
    others.clear(); crowd=null; pads=[];
  }
  function stop(){ leave(); }

  return { enter, tick, use, stop, leave, ground, dome, tour:retour, STATIONS, BUILDINGS,
           /* a fresh landing, for anyone who wants the front door again */
           forget(){ back=null; },
           get active(){ return on; },
           get server(){ return server; } };
})();
