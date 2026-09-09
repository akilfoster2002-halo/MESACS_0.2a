/* =====================================================================
   CRUISE — flying there yourself.

   The Pad used to be a teleport: two consoles, press one, and you were
   standing on another planet. It worked, and it made the other planets
   feel like tabs rather than places. A world you can reach by pressing a
   button is not somewhere you went.

   So the ship is a real ship now. You collect it from the Mechanic, you
   board it on the Pad, and you fly the two minutes to VOLTA yourself,
   through the only part of this game that is purely worth looking at.

   HOW THE FLYING WORKS. The ship never moves. It sits at the origin
   pointing wherever you point it, and the sky moves past it — every
   nebula, comet and rock lives in one group that slides the other way at
   the ship's own speed. That is not a trick to save arithmetic; it is
   what keeps the numbers small. A thirty-six kilometre journey flown
   honestly would have the ship out at coordinates where a float has
   metres between the values it can hold, and the whole sky would start
   to jitter about an hour before you arrived.

   WHAT IS OUT THERE. Nine kinds of thing, and they are all recycled: when
   one falls behind you it is put back in front, somewhere new, with new
   colours. You never see the same arrangement twice and you never pay
   for more than is around you.
   ===================================================================== */
window.CRUISE = (function(){
  /* --------------------------------------------------------- the journey */
  const CRUISE_SPEED = 300;              // units a second at a normal throttle
  const TRIP_SECONDS = 120;              // how long the ride is meant to take
  const TOTAL = CRUISE_SPEED * TRIP_SECONDS;
  const COURSE = new THREE.Vector3(0,0,-1);   // the way to the other planet
  const FAR_PLANET = 9000, NEAR_PLANET = 620; // how far off it sits, start and end

  /* The field is a sphere around the ship. Everything is placed inside it and
     recycled when it leaves, so what it costs does not depend on how far you
     have come. */
  const FIELD = 4200;

  let on=false, server=null, dest='arena', from='hub';
  let field=null, ship=null, shipHull=null, cam=null;
  let vel=new THREE.Vector3(), speed=CRUISE_SPEED, throttle=1, boost=0;
  let pitch=0, yaw=0, roll=0, rollV=0;
  let travelled=0, clock=0, arriving=0, done=false;
  let keys={}, look={x:0,y:0}, exposureWas=1.05;
  let phen=[], comets=[], rocks=null, destGlobe=null, homeGlobe=null, sun=null;
  let starA=null, starB=null, streaks=null;
  const q=new THREE.Quaternion(), qy=new THREE.Quaternion(), qp=new THREE.Quaternion();
  const qr=new THREE.Quaternion(), fwd=new THREE.Vector3(), tmp=new THREE.Vector3();
  // scratch for the rock field, so tumbling 240 of them allocates nothing
  const rm=new THREE.Matrix4(), rp=new THREE.Vector3(), rs=new THREE.Vector3();
  const rq=new THREE.Quaternion(), rq2=new THREE.Quaternion(), re=new THREE.Euler();

  /* ------------------------------------------------------------ textures
     All of it drawn here rather than downloaded: a nebula is a soft blob and
     a star is a dot, and a canvas makes those in a millisecond apiece. */
  const cache={};
  function tex(name, draw, size){
    if(cache[name]) return cache[name];
    const N=size||256, c=document.createElement('canvas'); c.width=c.height=N;
    draw(c.getContext('2d'), N);
    const T=new THREE.CanvasTexture(c);
    T.colorSpace=THREE.SRGBColorSpace;
    return cache[name]=T;
  }
  /* A cloud: soft in the middle, ragged at the edge. The rag is what stops
     twenty of them reading as twenty circles. */
  const cloudTex = ()=> tex('cloud',(x,N)=>{
    const g=x.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
    g.addColorStop(0,'rgba(255,255,255,0.95)');
    g.addColorStop(0.35,'rgba(255,255,255,0.42)');
    g.addColorStop(0.72,'rgba(255,255,255,0.10)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g; x.fillRect(0,0,N,N);
    x.globalCompositeOperation='destination-out';
    for(let i=0;i<90;i++){
      const a=Math.random()*Math.PI*2, r=N*(0.24+Math.random()*0.27);
      const px=N/2+Math.cos(a)*r, py=N/2+Math.sin(a)*r, rr=N*(0.04+Math.random()*0.13);
      const h=x.createRadialGradient(px,py,0,px,py,rr);
      h.addColorStop(0,'rgba(0,0,0,'+(0.20+Math.random()*0.45)+')');
      h.addColorStop(1,'rgba(0,0,0,0)');
      x.fillStyle=h; x.beginPath(); x.arc(px,py,rr,0,7); x.fill();
    }
  }, 256);
  const dotTex = ()=> tex('dot',(x,N)=>{
    const g=x.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(0.25,'rgba(255,255,255,0.75)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g; x.fillRect(0,0,N,N);
  }, 64);
  /* A comet tail: bright at the head, gone by the end, and narrower as it
     goes — drawn along the strip so one quad carries the whole thing. */
  const tailTex = ()=> tex('tail',(x,N)=>{
    for(let i=0;i<N;i++){
      const f=i/(N-1);                       // 0 head, 1 tail
      const a=Math.pow(1-f, 1.7);
      const half=N*0.5*Math.pow(1-f,0.55)*0.5;
      const g=x.createLinearGradient(0,N/2-half,0,N/2+half);
      g.addColorStop(0,'rgba(255,255,255,0)');
      g.addColorStop(0.5,'rgba(255,255,255,'+a.toFixed(3)+')');
      g.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=g; x.fillRect(i,0,1,N);
    }
  }, 256);
  /* A ring seen edge on, for the arches you fly through */
  const bandTex = ()=> tex('band',(x,N)=>{
    const g=x.createLinearGradient(0,0,0,N);
    g.addColorStop(0,'rgba(255,255,255,0)');
    g.addColorStop(0.42,'rgba(255,255,255,0.85)');
    g.addColorStop(0.5,'rgba(255,255,255,1)');
    g.addColorStop(0.58,'rgba(255,255,255,0.85)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g; x.fillRect(0,0,N,N);
  }, 64);

  /* ------------------------------------------------------------ palettes
     Bright, and never only one at a time. The colours are picked in PAIRS
     that sit apart on the wheel, so where two clouds overlap the additive
     blend lands somewhere that is in neither of them — which is the whole
     reason the sky out here looks like it is burning rather than painted. */
  const PAIRS=[
    [0xff2f8e, 0x18d7ff],   // magenta into cyan
    [0x7b4bff, 0xff8a2b],   // violet into amber
    [0x00ffc8, 0xff3b6b],   // mint into rose
    [0x3a6bff, 0xffd23f],   // blue into gold
    [0xff5ce1, 0x38ff9e],   // orchid into jade
    [0x00b3ff, 0xb96bff]    // sky into lilac
  ];
  const pick = a => a[(Math.random()*a.length)|0];

  /* --------------------------------------------------------------- build */
  function sprite(colour, size, opacity, texture){
    const m=new THREE.Sprite(new THREE.SpriteMaterial({
      map:texture, color:colour, transparent:true, opacity:opacity,
      blending:THREE.AdditiveBlending, depthWrite:false, depthTest:true }));
    m.scale.set(size,size,1);
    return m;
  }

  /* A NEBULA. Not one sprite — a dozen of them in two colours, scattered
     through a volume and turning at their own rates. One sprite is a decal
     you fly past; a dozen overlapping is a thing you fly INTO, and the
     colour changes as you go through it because different parts of it are
     in front of you at different moments. */
  function nebula(){
    const g=new THREE.Group();
    const [c1,c2]=pick(PAIRS);
    const R=520+Math.random()*760;
    const n=13+(Math.random()*9|0);
    for(let i=0;i<n;i++){
      const s=sprite(i%2?c2:c1, R*(0.60+Math.random()*0.95),
                     0.30+Math.random()*0.32, cloudTex());
      s.position.set((Math.random()-0.5)*R*1.5,
                     (Math.random()-0.5)*R*1.1,
                     (Math.random()-0.5)*R*1.5);
      s.material.rotation=Math.random()*6.283;
      s.userData.spin=(Math.random()-0.5)*0.10;
      g.add(s);
    }
    /* A core, so it has somewhere to look brightest — but tinted rather
       than white. Pure white at any strength wins against everything around
       it, and a nebula whose middle is white is a nebula with the colour
       washed out of exactly the part you fly through. */
    const core=sprite(c1, R*0.46, 0.30, cloudTex());
    g.add(core);
    g.userData.kind='nebula'; g.userData.r=R;
    return g;
  }

  /* AN ARCH. A ring of light hanging in space, big enough to fly through
     and lit in two colours that meet on the far side. */
  function arch(){
    const g=new THREE.Group();
    const [c1,c2]=pick(PAIRS);
    const R=300+Math.random()*420;
    for(let k=0;k<2;k++){
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(R, R*(0.012+k*0.02), 8, 96),
        new THREE.MeshBasicMaterial({ color:k?c2:c1, transparent:true,
          opacity:k?0.30:0.85, blending:THREE.AdditiveBlending, depthWrite:false }));
      g.add(ring);
    }
    // the disc of haze inside it, so flying through is a moment and not a hoop
    const haze=sprite(c2, R*1.9, 0.16, cloudTex());
    g.add(haze);
    g.rotation.set(Math.random()*6.283, Math.random()*6.283, Math.random()*6.283);
    g.userData.kind='arch'; g.userData.r=R;
    g.userData.spin=(Math.random()-0.5)*0.16;
    return g;
  }

  /* A COMET. A hot head and a tail that always points away from the sun,
     which is the one piece of real astronomy in here and the reason they
     all lean the same way. */
  function comet(){
    const g=new THREE.Group();
    const [c1,c2]=pick(PAIRS);
    const len=420+Math.random()*900, wide=len*0.13;
    const tail=new THREE.Mesh(new THREE.PlaneGeometry(len, wide),
      new THREE.MeshBasicMaterial({ map:tailTex(), color:c1, transparent:true,
        opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false,
        side:THREE.DoubleSide }));
    tail.position.x=len/2;                 // the head sits at the group's origin
    g.add(tail);
    const head=sprite(0xffffff, wide*1.5, 0.95, dotTex());
    const halo=sprite(c2, wide*3.4, 0.5, dotTex());
    g.add(halo, head);
    g.userData.kind='comet';
    g.userData.drift=new THREE.Vector3((Math.random()-0.5)*70,
                                       (Math.random()-0.5)*44,
                                       (Math.random()-0.5)*70);
    return g;
  }

  /* AN ION STORM: a curtain of long thin streaks, all leaning one way. */
  /* First pass at this put fifty hard bright streaks in a box a kilometre
     across, and flying into one was like flying into a bundle of drawn
     lines — the eye read them as scratches on the lens rather than as
     anything out there. Fewer, fainter, longer and much thinner: a curtain
     should be something you notice you are inside, not something that
     arrives. */
  function curtain(){
    const g=new THREE.Group();
    const [c1,c2]=pick(PAIRS);
    const n=13+(Math.random()*10|0);
    for(let i=0;i<n;i++){
      const len=700+Math.random()*1100;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(len, len*0.006),
        new THREE.MeshBasicMaterial({ map:bandTex(), color:i%2?c1:c2,
          transparent:true, opacity:0.10+Math.random()*0.16,
          blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
      m.position.set((Math.random()-0.5)*2200,(Math.random()-0.5)*1300,(Math.random()-0.5)*2200);
      m.rotation.set(0,0,(Math.random()-0.5)*0.5);
      g.add(m);
    }
    g.userData.kind='curtain';
    return g;
  }

  function phenomenon(){
    const r=Math.random();
    return r<0.62 ? nebula() : r<0.86 ? arch() : curtain();
  }

  /* ------------------------------------------------------------- the sky */
  function stars(count, radius, size, bright){
    const p=new Float32Array(count*3), c=new Float32Array(count*3);
    const col=new THREE.Color();
    for(let i=0;i<count;i++){
      // an even scatter on the sphere, not a clump at the poles
      const z=Math.random()*2-1, a=Math.random()*6.283, s=Math.sqrt(1-z*z);
      const r=radius*(0.75+Math.random()*0.25);
      p[i*3]=Math.cos(a)*s*r; p[i*3+1]=z*r; p[i*3+2]=Math.sin(a)*s*r;
      /* Stars are not white. A field of pure white dots reads as noise on
         the lens; a spread from cold blue through to warm amber reads as
         distance. */
      const h=Math.random()<0.7 ? 0.55+Math.random()*0.12 : 0.06+Math.random()*0.10;
      col.setHSL(h, 0.55, bright*(0.55+Math.random()*0.45));
      c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('color', new THREE.BufferAttribute(c,3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      size:size, map:dotTex(), vertexColors:true, transparent:true,
      alphaTest:0.02, depthWrite:false, blending:THREE.AdditiveBlending,
      sizeAttenuation:false }));
  }

  /* A planet: a lit ball with a rim of atmosphere, which is the cheapest
     thing that reads as air rather than as paint. */
  function globe(radius, colour, air){
    const g=new THREE.Group();
    const ball=new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32),
      new THREE.MeshLambertMaterial({ color:colour }));
    g.add(ball);
    const rim=sprite(air, radius*3.1, 0.55, dotTex());
    g.add(rim);
    g.userData.ball=ball;
    return g;
  }

  function build(){
    field=new THREE.Group(); G.roomGroup.add(field);

    starA=stars(4200, 9000, 2.2, 0.85);
    starB=stars(2600, 6000, 1.4, 0.55);
    G.roomGroup.add(starA, starB);

    /* THE FAR SKY. Six enormous clouds hung out past the stars and never
       recycled — the deep colour that is simply always there, so that even
       between one nebula and the next you are inside something rather than
       in a black room with props in it. They ride with the ship, so they
       never come closer however long you fly. */
    const far=new THREE.Group();
    for(let i=0;i<10;i++){
      const [c1,c2]=pick(PAIRS);
      const z=Math.random()*2-1, a=Math.random()*6.283, ss=Math.sqrt(1-z*z);
      const R=7200;
      const s1=sprite(i%2?c2:c1, 5200+Math.random()*4200, 0.22+Math.random()*0.17, cloudTex());
      s1.position.set(Math.cos(a)*ss*R, z*R*0.55, Math.sin(a)*ss*R);
      s1.material.rotation=Math.random()*6.283;
      far.add(s1);
    }
    G.roomGroup.add(far);

    /* The sun of this system, off the shoulder rather than ahead: something
       to cast the light everything else is lit by, and a reason the comet
       tails all lean the same way. */
    sun=new THREE.Group();
    sun.add(sprite(0xfff0c0, 900, 0.95, dotTex()));
    sun.add(sprite(0xffb44d, 2100, 0.42, dotTex()));
    sun.add(sprite(0xff5a2b, 4200, 0.16, cloudTex()));
    sun.position.set(5200, 1800, -2400);
    G.roomGroup.add(sun);
    const key=new THREE.DirectionalLight(0xfff1d6, 2.1);
    key.position.copy(sun.position).normalize().multiplyScalar(100);
    G.roomGroup.add(key);
    G.roomGroup.add(new THREE.AmbientLight(0x66407f, 0.9));
    const rimLight=new THREE.DirectionalLight(0x7fd4ff, 0.8);
    rimLight.position.set(-60,-20,80);
    G.roomGroup.add(rimLight);

    // where you are going, and where you came from
    destGlobe=globe(340, 0x8a5fb0, 0xcdb4f6); G.roomGroup.add(destGlobe);
    homeGlobe=globe(300, 0x2f6f4a, 0x8ff0ff); G.roomGroup.add(homeGlobe);

    // the sky you fly through
    phen=[];
    for(let i=0;i<13;i++){ const p=phenomenon(); place(p, true); field.add(p); phen.push(p); }
    comets=[];
    for(let i=0;i<5;i++){ const c=comet(); place(c, true); field.add(c); comets.push(c); }
    rockField();
    ionStreaks();

    // and the ship, at the middle of all of it
    ship=new THREE.Group();
    shipHull=(window.SHOP && SHOP.model) ? SHOP.model() : null;
    if(shipHull){ shipHull.scale.setScalar(3.2); ship.add(shipHull); }
    G.roomGroup.add(ship);
  }

  /* A drift of rocks, out of the asteroid the game already has. */
  function rockField(){
    if(!window.THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load('rocks/asteroid.glb?v='+(window.ASSETV||'1'), g=>{
      if(!on) return;
      let geo=null; g.scene.traverse(o=>{ if(!geo && o.isMesh) geo=o.geometry; });
      if(!geo) return;
      const mat=new THREE.MeshLambertMaterial({ vertexColors:true });
      rocks=new THREE.InstancedMesh(geo, mat, 110);
      rocks.frustumCulled=false;
      const m=new THREE.Matrix4(), qq=new THREE.Quaternion(), sc=new THREE.Vector3();
      rocks.userData.spin=[];
      for(let i=0;i<110;i++){
        const s=6+Math.random()*34;
        sc.set(s,s,s);
        qq.setFromEuler(new THREE.Euler(Math.random()*6.3,Math.random()*6.3,Math.random()*6.3));
        m.compose(scatter(new THREE.Vector3(), true), qq, sc);
        rocks.setMatrixAt(i, m);
        rocks.userData.spin.push(new THREE.Vector3(
          (Math.random()-0.5)*0.5,(Math.random()-0.5)*0.5,(Math.random()-0.5)*0.5));
      }
      rocks.instanceMatrix.needsUpdate=true;
      field.add(rocks);
    }, undefined, ()=>{});
  }

  /* The streaks that stretch past the canopy when you open the throttle.
     They are drawn ON the ship's own frame rather than out in the field, so
     they always run the way you are pointing. */
  function ionStreaks(){
    const n=140, g=new THREE.BufferGeometry();
    const p=new Float32Array(n*6);
    for(let i=0;i<n;i++) resetStreak(p, i);
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    streaks=new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      color:0x9fe8ff, transparent:true, opacity:0, blending:THREE.AdditiveBlending,
      depthWrite:false }));
    streaks.frustumCulled=false;
    G.roomGroup.add(streaks);
  }
  function resetStreak(p, i){
    const a=Math.random()*6.283, r=14+Math.random()*90;
    const x=Math.cos(a)*r, y=Math.sin(a)*r, z=-40-Math.random()*300;
    p[i*6]=x;   p[i*6+1]=y;   p[i*6+2]=z;
    p[i*6+3]=x; p[i*6+4]=y;   p[i*6+5]=z+18;
  }

  /* Somewhere in the field, and the two cases are genuinely different.

     The FIRST FILL scatters through the whole sphere so you start inside a
     sky rather than in front of one — but weighted forward, because half a
     sky behind you on the first frame is half a sky you paid for and never
     saw.

     A RE-SOWING goes out in front, in a cone about the way the ship is
     actually pointing. It used to go out along a fixed axis, which is fine
     until you turn — and then everything new appears off your shoulder. */
  const CONE=new THREE.Vector3();
  function scatter(out, all){
    const a=Math.random()*6.283;
    if(all){
      const r=FIELD*Math.cbrt(Math.random());
      const z=Math.random()*2-1, s=Math.sqrt(Math.max(0,1-z*z));
      out.set(Math.cos(a)*s*r, Math.sin(a)*s*r*0.55, z*r);
      if(out.z>0 && Math.random()<0.72) out.z=-out.z;      // mostly ahead
      return out;
    }
    const r=FIELD*(0.74+Math.random()*0.26);
    CONE.set(Math.cos(a)*(0.15+Math.random()*0.62),
             Math.sin(a)*(0.15+Math.random()*0.45), -1).normalize();
    return out.copy(CONE).applyQuaternion(q).multiplyScalar(r);
  }
  function place(o, all){
    scatter(tmp, all);
    o.position.copy(tmp).sub(field.position);
  }

  /* ----------------------------------------------------------- the flight */
  function launch(sv, to, fromId){
    stop();
    server=sv||null; dest=to||'arena'; from=fromId||'hub';
    on=true; done=false; arriving=0; travelled=0; clock=0;
    speed=CRUISE_SPEED; throttle=1; boost=0;
    pitch=0; yaw=0; roll=0; rollV=0; keys={}; look.x=look.y=0;

    G.running=false;
    if(window.CHAT) CHAT.hide();
    document.querySelector('#hud').classList.add('hidden');
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.add('hidden');

    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.room='cruise'; G.hudOwner='cruise';
    G.scene.background=new THREE.Color(0x03040c);
    G.scene.fog=null;
    /* Space is big and the near clip has to come out to match, or the depth
       buffer spends all its precision on the first metre of a nine-kilometre
       view and the far planets z-fight with the stars behind them. */
    G.camera.near=1; G.camera.far=24000; G.camera.up.set(0,1,0);
    G.camera.updateProjectionMatrix();
    /* The tone curve is set for a planet lit by one sun. Out here the whole
       sky IS the light, and the curve that keeps a hillside from blowing out
       buries a nebula. Opened for the ride and handed back on the way out. */
    exposureWas=G.renderer.toneMappingExposure;
    G.renderer.toneMappingExposure=1.45;

    build();
    hud();
    bind();
    const c=document.querySelector('#view');
    if(c && c.requestPointerLock) c.requestPointerLock();
  }

  function stop(){
    if(!on) return;
    on=false;
    unbind();
    const p=document.querySelector('#cruise'); if(p) p.remove();
    /* Give the world its panels back. The planet does not put them up on
       arrival — it assumes whoever took them down knows to. */
    G.renderer.toneMappingExposure=exposureWas;
    const h=document.querySelector('#hud'); if(h) h.classList.remove('hidden');
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.remove('hidden');
    field=null; ship=null; shipHull=null; phen=[]; comets=[]; rocks=null;
    destGlobe=null; homeGlobe=null; sun=null; starA=null; starB=null; streaks=null;
  }

  /* ------------------------------------------------------------ controls */
  function onKey(e){
    if(!on) return;
    if(e.type==='keydown' && e.code==='Escape'){ abort(); return; }
    keys[e.code]= e.type==='keydown';
    if(['KeyW','KeyS','KeyA','KeyD','Space','ShiftLeft','ShiftRight','KeyQ','KeyE']
       .indexOf(e.code)>=0) e.preventDefault();
  }
  function onMove(e){
    if(!on || !document.pointerLockElement) return;
    look.x += e.movementX; look.y += e.movementY;
  }
  function onClick(){
    const c=document.querySelector('#view');
    if(on && c && !document.pointerLockElement && c.requestPointerLock) c.requestPointerLock();
  }
  function bind(){
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onClick);
  }
  function unbind(){
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mousedown', onClick);
  }

  /* --------------------------------------------------------------- the HUD */
  function hud(){
    const el=document.createElement('div');
    el.id='cruise';
    el.innerHTML=
      `<div class="cnav"><b id="cdest">—</b><span id="ceta"></span>
         <div class="cbar"><i id="cprog"></i></div></div>
       <div class="cthr"><span id="cspd">—</span>
         <div class="cbar sm"><i id="cthrb"></i></div></div>
       <div class="ckeys">
         <b>MOUSE</b> ${t('steer')} &nbsp; <b>W S</b> ${t('throttle')}
         &nbsp; <b>SHIFT</b> ${t('boost')} &nbsp; <b>SPACE</b> ${t('brake')}
         &nbsp; <b>A D</b> ${t('roll')} &nbsp; <b>ESC</b> ${t('turn back')}</div>
       <div class="cmark" id="cmark"><i></i></div>`;
    document.body.appendChild(el);
    document.querySelector('#cdest').textContent=
      t('COURSE: {n}',{n: dest==='arena' ? 'VOLTA' : 'KORO'});
  }
  function say(msg, big){
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.remove('hidden');
    b.innerHTML = big ? '<b>'+msg+'</b>' : msg;
    clearTimeout(say._t);
    say._t=setTimeout(()=>{ b.classList.add('hidden'); }, 3600);
  }

  /* ---------------------------------------------------------------- frame */
  function tick(dt){
    if(!on) return;
    clock+=dt;
    fly(dt);
    sky(dt);
    paint();
    if(!done && travelled>=TOTAL) land();
  }

  function fly(dt){
    /* Steering. The mouse turns the nose; the roll follows the turn rather
       than being flown separately, because a ship that banks into its own
       turns flies itself and one that does not looks like a brick. A and D
       still roll it by hand for anyone who wants to. */
    yaw   -= look.x*0.0016;
    pitch -= look.y*0.0016;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
    const turn=-look.x*0.0016;
    look.x=look.y=0;

    let hand=0;
    if(keys.KeyA) hand+=1; if(keys.KeyD) hand-=1;
    rollV += (turn*9 + hand*1.6 - rollV)*Math.min(1, dt*3.2);
    roll += rollV*dt;
    roll *= Math.pow(0.06, dt);          // it always comes back level

    if(keys.KeyW) throttle=Math.min(1.25, throttle+dt*0.55);
    if(keys.KeyS) throttle=Math.max(0.06, throttle-dt*0.55);
    const wantBoost=(keys.ShiftLeft||keys.ShiftRight)?1:0;
    boost += (wantBoost-boost)*Math.min(1, dt*2.4);
    let want=CRUISE_SPEED*throttle*(1+boost*1.35);
    if(keys.Space) want*=0.18;
    speed += (want-speed)*Math.min(1, dt*1.6);

    qy.setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
    qp.setFromAxisAngle(new THREE.Vector3(1,0,0), pitch);
    qr.setFromAxisAngle(new THREE.Vector3(0,0,1), roll);
    q.copy(qy).multiply(qp).multiply(qr);
    ship.quaternion.copy(q);
    fwd.set(0,0,-1).applyQuaternion(q);

    /* The sky moves, not the ship — see the note at the top. */
    vel.copy(fwd).multiplyScalar(speed);
    field.position.addScaledVector(vel, -dt);

    /* PROGRESS IS ALONG THE COURSE, not just distance flown. Fly at the
       planet and you get there in two minutes; wander off and you still
       close on it, slowly, because a ride nobody can finish is not a ride.
       That floor is what makes exploring safe rather than punishing. */
    const align=Math.max(0.30, fwd.dot(COURSE));
    travelled += speed*align*dt;

    // the chase camera, hung back and above, easing rather than welded on
    const back=tmp.set(0,0,1).applyQuaternion(q).multiplyScalar(26+boost*10);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(q).multiplyScalar(7.5);
    G.camera.position.lerp(back.add(up), Math.min(1, dt*6));
    G.camera.up.set(0,1,0).applyQuaternion(q);
    // along the nose, not down world -Z: the ship turns and the camera with it
    G.camera.lookAt(fwd.x*60, fwd.y*60, fwd.z*60);

    if(shipHull){
      // the engine glow answers the throttle, so the ship looks like it is trying
      const glow=shipHull.userData && shipHull.userData.glow;
      if(glow){
        const k=0.5+throttle*0.7+boost*0.8;
        glow.scale.set(k, k, k*(1.7+boost*2.6));
        glow.material.opacity=0.55+boost*0.4;
      }
      shipHull.position.y=Math.sin(clock*1.7)*0.25;   // a little life at rest
    }
  }

  function sky(dt){
    // everything turns, slowly, so nothing in the sky is ever quite still
    phen.forEach(p=>{
      if(p.userData.spin) p.rotation.z += p.userData.spin*dt;
      p.children.forEach(c=>{ if(c.isSprite && c.userData.spin)
        c.material.rotation += c.userData.spin*dt; });
      recycle(p, p.userData.r||600);
    });
    comets.forEach(c=>{
      c.position.addScaledVector(c.userData.drift, dt);
      // the tail points away from the sun, always
      tmp.copy(sun.position).sub(c.position).sub(field.position).normalize();
      c.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), tmp.negate());
      recycle(c, 500);
    });
    if(rocks){
      for(let i=0;i<rocks.count;i++){
        rocks.getMatrixAt(i,rm); rm.decompose(rp,rq,rs);
        const s=rocks.userData.spin[i];
        re.set(s.x*dt, s.y*dt, s.z*dt);
        rq.multiply(rq2.setFromEuler(re));
        if(rp.clone().add(field.position).length()>FIELD){ scatter(rp,false); rp.sub(field.position); }
        rm.compose(rp,rq,rs); rocks.setMatrixAt(i,rm);
      }
      rocks.instanceMatrix.needsUpdate=true;
    }

    // the stars sit on the ship, so they never get closer however far you fly
    starA.rotation.y += dt*0.004; starB.rotation.y -= dt*0.006;

    /* The two planets. The one ahead grows the whole way in, which is the
       only clock this ride needs — you can see how far there is to go by
       how big it is. */
    const p=Math.min(1, travelled/TOTAL);
    destGlobe.position.copy(COURSE).multiplyScalar(NEAR_PLANET+(FAR_PLANET-NEAR_PLANET)*(1-p));
    destGlobe.position.y += 40;
    destGlobe.rotation.y += dt*0.03;
    homeGlobe.position.copy(COURSE).multiplyScalar(-(NEAR_PLANET+(FAR_PLANET-NEAR_PLANET)*p));
    homeGlobe.position.y -= 30;

    // and the streaks, which only show up when you are really moving
    const fast=Math.max(0, (speed/CRUISE_SPEED)-0.95)/1.6;
    streaks.material.opacity=Math.min(0.65, fast*0.9);
    streaks.quaternion.copy(q);
    if(fast>0.02){
      const a=streaks.geometry.attributes.position, arr=a.array;
      for(let i=0;i<arr.length/6;i++){
        arr[i*6+2] += speed*dt*1.6; arr[i*6+5] += speed*dt*1.6;
        if(arr[i*6+2]>40) resetStreak(arr, i);
      }
      a.needsUpdate=true;
    }
  }

  /* Anything you have gone past is put back out in front. `pad` keeps a
     thing that is merely large from being recycled while part of it is
     still on screen.

     TWO TESTS, NOT ONE. Distance alone leaves a nebula sitting three
     kilometres behind you for a minute, because a four-kilometre sphere
     takes a long time to fly out of — so the sky you have already been
     through stays spent, and the sky ahead thins out. Anything genuinely
     behind the nose and clear of the ship comes round to the front. */
  function recycle(o, pad){
    tmp.copy(o.position).add(field.position);
    const d=tmp.length();
    if(d > FIELD+pad){ place(o, false); return; }
    if(d > pad*1.5 + 300 && tmp.dot(fwd) < -pad*0.35) place(o, false);
  }

  function paint(){
    const p=Math.min(1, travelled/TOTAL);
    const bar=document.querySelector('#cprog'); if(bar) bar.style.width=(p*100).toFixed(1)+'%';
    const eta=document.querySelector('#ceta');
    if(eta){
      const align=Math.max(0.30, fwd.dot(COURSE));
      const left=Math.max(0, (TOTAL-travelled)/Math.max(1, speed*align));
      eta.textContent = p>=1 ? t('ARRIVING')
        : Math.floor(left/60)+':'+String(Math.floor(left%60)).padStart(2,'0');
    }
    const spd=document.querySelector('#cspd');
    if(spd) spd.textContent=Math.round(speed)+' u/s';
    const tb=document.querySelector('#cthrb');
    if(tb) tb.style.width=((throttle/1.25)*100).toFixed(0)+'%';

    /* THE COURSE MARKER. It sits on the destination when the destination is
       in front of you and clamps to the edge of the screen when it is not,
       so "which way is VOLTA" is answered by looking rather than guessing. */
    const mark=document.querySelector('#cmark'); if(!mark) return;
    const v=tmp.copy(destGlobe.position).project(G.camera);
    const ahead=destGlobe.position.clone().normalize().dot(fwd)>0;
    let x=v.x, y=v.y;
    if(!ahead || Math.abs(x)>1 || Math.abs(y)>1){
      const k=Math.max(Math.abs(x), Math.abs(y))||1;
      x/=k; y/=k; if(!ahead){ x=-x; y=-y; }
      x*=0.92; y*=0.92;
      mark.classList.add('edge');
    } else mark.classList.remove('edge');
    mark.style.left=((x*0.5+0.5)*100).toFixed(2)+'%';
    mark.style.top=((-y*0.5+0.5)*100).toFixed(2)+'%';
  }

  /* ------------------------------------------------------------- arriving */
  function land(){
    done=true;
    say(t('Entering orbit over {n}…',{n: dest==='arena'?'VOLTA':'KORO'}), true);
    if(document.pointerLockElement) document.exitPointerLock();
    setTimeout(()=>{
      if(!on) return;
      const to=dest;
      stop();
      if(window.PLANET) PLANET.enter(server, to);
    }, 1700);
  }
  /* Turning back. The trip is two minutes and somebody will want out of it. */
  function abort(){
    if(!on || done) return;
    done=true;
    say(t('Turning back.'));
    if(document.pointerLockElement) document.exitPointerLock();
    setTimeout(()=>{
      if(!on) return;
      const back=from;
      stop();
      if(window.PLANET) PLANET.enter(server, back);
    }, 900);
  }

  return { launch, tick, stop, abort,
           get active(){ return on; },
           get progress(){ return Math.min(1, travelled/TOTAL); },
           TRIP_SECONDS };
})();
