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
  /* Flat out and pointed straight at it, the crossing is the two minutes it
     was always meant to be — but that is now a thing you can do rather than
     a thing that happens to you. Boost gets you there in about seventy
     seconds; dawdling takes as long as you like. */
  const SHIP={ top:300, reverse:-80, accel:130, brake:240, drag:30, boost:1.8 };
  const TRIP_SECONDS = 120;
  const TRIP = SHIP.top * TRIP_SECONDS;       // so: how far apart the planets are

  /* ONE FRAME FOR EVERYBODY. The planets are at fixed points in a space both
     ships share, rather than each pilot flying in their own coordinates from
     wherever they happened to take off. Two people cannot see each other in
     two different frames — and this is also what lets one of you fly out
     while the other flies back, and pass. */
  const KORO_AT  = new THREE.Vector3(0, 0, 0);
  const VOLTA_AT = new THREE.Vector3(0, 0, -TRIP);
  const spotOf = id => id==='arena' ? VOLTA_AT : KORO_AT;

  const ARRIVE = 780;                    // how close counts as orbit
  /* Something thirty-six kilometres away is past the far plane, and drawing
     it there would cost the depth buffer everything. So a far planet is
     drawn NEARER and SMALLER by the same factor: the angle it covers on
     screen is exactly right, and it grows honestly as you close. */
  const DRAW_MAX = 15000;

  /* The field is a sphere around the ship. Everything is placed inside it and
     recycled when it leaves, so what it costs does not depend on how far you
     have come. */
  const FIELD = 4200;

  let on=false, server=null, dest='arena', from='hub';
  let field=null, ship=null, shipHull=null, cam=null;
  let vel=new THREE.Vector3(), speed=0, throttle=0, boost=0;
  let pitch=0, yaw=0, roll=0, rollV=0;
  let clock=0, done=false;
  /* Where the ship actually is, in the shared frame. The ship itself never
     moves — see the note at the top — so this is the only thing that knows
     the difference between setting off and arriving. */
  const where=new THREE.Vector3(), destAbs=new THREE.Vector3(), homeAbs=new THREE.Vector3();
  const toDest=new THREE.Vector3(), toHome=new THREE.Vector3();
  let startDist=TRIP, realDist=TRIP;
  let keys={}, look={x:0,y:0}, exposureWas=1.05, hudWas=[];
  let phen=[], comets=[], rocks=null, destGlobe=null, homeGlobe=null, sun=null;
  let crowd=null, mates=new Map(), sent=0;
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

    crowd=new THREE.Group(); G.roomGroup.add(crowd);

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

  /* --------------------------------------------------------- your friends
     EVERYBODY IS IN THE SAME SPACE. Presence on the ground is two numbers
     and a heading, because the ground supplies the third — you are standing
     on it. Out here there is nothing to stand on, so height and pitch go up
     with the rest, and `at` says 'space' so nobody on a planet tries to
     draw a classmate who is forty kilometres above their head.

     What travels is the position in the SHARED frame, not the position
     relative to anybody. What is drawn is that minus your own, which keeps
     the numbers small on the way in exactly as it does for the sky. */
  function nameTag(name){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(10,16,34,.82)'; x.fillRect(0,14,256,36);
    x.fillStyle='#8ff0ff'; x.font='bold 26px "Trebuchet MS",sans-serif'; x.textAlign='center';
    x.fillText(String(name||'').slice(0,16),128,42);
    const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx, transparent:true,
      depthWrite:false, depthTest:false}));
    sp.scale.set(26,6.5,1); sp.position.y=9; return sp;
  }
  function seePlayers(list){
    if(!crowd) return;
    const seen=new Set();
    list.forEach(p=>{
      if(window.NET && NET.me && p.id===NET.me.id) return;
      if(p.at!=='space') return;            // they are on a planet, not out here
      seen.add(p.id);
      let m=mates.get(p.id);
      if(!m){
        const g=new THREE.Group();
        g.add(nameTag(p.display));
        const hull=(window.SHOP && SHOP.model) ? SHOP.model() : null;
        if(hull){ hull.scale.setScalar(3.2); g.add(hull); }
        crowd.add(g);
        m={ g, at:new THREE.Vector3(p.x,p.y,p.z), to:new THREE.Vector3(p.x,p.y,p.z),
            yaw:p.yaw||0, tyaw:p.yaw||0, pit:p.pit||0, tpit:p.pit||0 };
        mates.set(p.id, m);
      }
      m.to.set(p.x, p.y, p.z);
      m.tyaw=p.yaw||0; m.tpit=p.pit||0;
    });
    for(const [id,m] of mates) if(!seen.has(id)){ crowd.remove(m.g); mates.delete(id); }
  }
  /* Presence lands about eleven times a second, which is nowhere near a
     frame rate — so what arrives is a TARGET and the frame eases onto it,
     the same way the planet does with people walking. */
  function mateTick(dt){
    if(!crowd) return;
    const k=1-Math.pow(0.0009, Math.min(dt,0.1));
    for(const [,m] of mates){
      m.at.lerp(m.to, k);
      m.g.position.copy(m.at).sub(where);     // their place, from where you are
      let dy=m.tyaw-m.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
      m.yaw+=dy*k; m.pit+=(m.tpit-m.pit)*k;
      m.g.quaternion.setFromEuler(new THREE.Euler(m.pit, m.yaw, 0, 'YXZ'));
      /* A ship forty kilometres off is a pixel, and a name tag on a pixel is
         unreadable — so the tag holds a legible size however far away they
         are, which is what makes "where is my friend" answerable at all. */
      const d=m.g.position.length();
      const tag=m.g.children[0];
      if(tag && tag.isSprite){ const s=Math.max(1, d/90);
        tag.scale.set(26*s, 6.5*s, 1); tag.position.y=9*s; }
    }
    if(!window.NET || !NET.live) return;
    const now=performance.now();
    if(now-sent<90) return;
    sent=now;
    NET.pos({ x:+where.x.toFixed(1), y:+where.y.toFixed(1), z:+where.z.toFixed(1),
              yaw:+yaw.toFixed(3), pit:+pitch.toFixed(3),
              char: window.AVATAR ? AVATAR.chosen : 's', at:'space' });
  }

  /* ----------------------------------------------------------- the flight */
  function launch(sv, to, fromId){
    stop();
    server=sv||null; dest=to||'arena'; from=fromId||'hub';
    on=true; done=false; clock=0;
    speed=0; throttle=0; boost=0;          // stopped on the pad, engines cold
    roll=0; rollV=0; keys={}; look.x=look.y=0;

    where.copy(spotOf(from));
    destAbs.copy(spotOf(dest));
    homeAbs.copy(spotOf(from));
    toDest.copy(destAbs).sub(where);
    startDist=realDist=Math.max(1, toDest.length());
    /* Pointed at it on the way out, and no further help than that. The nose
       starts on the course; keeping it there is the flying. */
    const d=toDest.clone().normalize();
    yaw=Math.atan2(-d.x, -d.z);
    pitch=Math.asin(Math.max(-1,Math.min(1,d.y)));

    G.running=false;
    /* HIDE THE HUD'S PIECES, NOT THE HUD.

       The chat lives inside #hud, so hiding the container took the one
       part of it this ride wants to keep with it — which is why the
       CHAT.show() below has never put anything on the screen. Out between
       the planets is the longest stretch in the game with nothing to do
       but hold W, and it is the one place a class most wants to talk.

       Each child is put back exactly as it was found, because several of
       them were already hidden before the launch and turning them all on
       at the end would hand the planet a health bar it is not using. */
    hudWas=[];
    const hudEl=document.querySelector('#hud');
    if(hudEl){
      hudEl.classList.remove('hidden');
      [...hudEl.children].forEach(el=>{
        if(el.id==='chat') return;
        hudWas.push([el, el.classList.contains('hidden')]);
        el.classList.add('hidden');
      });
    }
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
    /* Take the socket's presence over for the duration. The planet put its
       own handlers on it and is not listening any more; chat stays where it
       was, so you can still talk to whoever is out here with you. */
    if(server && server.id && window.NET && NET.connect){
      NET.connect(server.id, {
        players:list=>seePlayers(list),
        objs:()=>{},
        chat:m=>{ if(window.CHAT) CHAT.line(m.from, m.text, m.id); },
        sys:x=>{ if(window.CHAT) CHAT.sys(x); },
        clear:qq=>{ if(window.CHAT) CHAT.clear(qq); },
        unsay:id=>{ if(window.CHAT) CHAT.remove(id); }
      });
      if(window.CHAT) CHAT.show();
    }
    const c=document.querySelector('#view');
    if(c && c.requestPointerLock) c.requestPointerLock();
    /* A ship sitting still is indistinguishable from a ship that has not
       loaded, so the one instruction that matters gets said out loud. */
    say(t('Clear of the pad. <b>W</b> to fire the engines.'), true);
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
    hudWas.forEach(([el,was])=>el.classList.toggle('hidden', was));
    hudWas=[];
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.remove('hidden');
    mates.clear(); crowd=null;
    field=null; ship=null; shipHull=null; phen=[]; comets=[]; rocks=null;
    destGlobe=null; homeGlobe=null; sun=null; starA=null; starB=null; streaks=null;
  }

  /* ------------------------------------------------------------ controls */
  function onKey(e){
    if(!on) return;
    /* A KEYSTROKE AIMED AT THE CHAT BELONGS TO THE CHAT.

       This listener is on the CAPTURE phase, so it sees every key before
       anything else does. Without this guard, typing a message also flies
       the ship — and worse, the letters that fly it are exactly the ones
       preventDefault() swallows below, so the input never receives them.
       A chat box you cannot type the word "wait" into is not a chat box.

       Nothing stays held while you type, either: a W pressed as the first
       letter of a word would otherwise be stuck down until you pressed and
       released it again outside the field, with the engines on.

       And Escape gets you out of the BOX rather than out of the flight.
       Aborting a trip between planets because somebody finished a sentence
       is not what that key should mean while a caret is blinking. */
    if(window.typingInField && typingInField(e)){
      for(const k in keys) keys[k]=false;
      if(e.type==='keydown' && e.code==='Escape' && document.activeElement
         && document.activeElement.blur) document.activeElement.blur();
      return;
    }
    if(e.type==='keydown' && e.code==='Escape'){ abort(); return; }
    keys[e.code]= e.type==='keydown';
    if(['KeyW','KeyS','KeyA','KeyD','Space','ShiftLeft','ShiftRight','KeyQ','KeyE',
        'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code)>=0) e.preventDefault();
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
         <div class="cbar"><i id="cprog"></i></div>
         <em id="cdist"></em></div>
       <div class="cthr"><span id="cspd">—</span>
         <div class="cbar sm"><i id="cthrb"></i></div></div>
       <div class="ckeys">
         <b>W</b> ${t('engines')} &nbsp; <b>S</b> ${t('brake / reverse')}
         &nbsp; <b>MOUSE</b> ${t('or')} <b>↑↓←→</b> ${t('steer')}
         &nbsp; <b>SHIFT</b> ${t('boost')} &nbsp; <b>A D</b> ${t('roll')}
         &nbsp; <b>ESC</b> ${t('turn back')}</div>
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
    mateTick(dt);
    paint();
    if(!done && realDist<=ARRIVE) land();
  }

  function fly(dt){
    /* Steering. The mouse turns the nose; the roll follows the turn rather
       than being flown separately, because a ship that banks into its own
       turns flies itself and one that does not looks like a brick. A and D
       still roll it by hand for anyone who wants to. */
    /* THE ARROWS STEER TOO, and not only as a courtesy. All of this used to
       be on the mouse, which means it was all on pointer lock — and a
       browser that refuses the lock, or a pupil who pressed Escape out of
       habit, had a ship with a throttle and no way to turn it. */
    let kx=0, ky=0;
    if(keys.ArrowLeft)  kx-=1;
    if(keys.ArrowRight) kx+=1;
    if(keys.ArrowUp)    ky-=1;
    if(keys.ArrowDown)  ky+=1;
    const mx=look.x*0.0016 + kx*dt*1.15;
    const my=look.y*0.0016 + ky*dt*0.95;
    yaw   -= mx;
    pitch -= my;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
    const turn=-mx;
    look.x=look.y=0;

    let hand=0;
    if(keys.KeyA) hand+=1; if(keys.KeyD) hand-=1;
    rollV += (turn*9 + hand*1.6 - rollV)*Math.min(1, dt*3.2);
    roll += rollV*dt;
    roll *= Math.pow(0.06, dt);          // it always comes back level

    /* THE SAME MODEL THE CAR USES, because it is the same question: press to
       go, press the other one to slow, let go and it runs down. It used to
       be a throttle NOTCH that started pinned wide open — so the ship left
       the pad already doing three hundred and flew itself until you
       interfered, which is a cutscene with a steering wheel attached.

       You start stopped now. Nothing happens until you fire the engines. */
    const wantBoost=(keys.ShiftLeft||keys.ShiftRight)?1:0;
    boost += (wantBoost-boost)*Math.min(1, dt*2.6);
    const top=SHIP.top*(1+boost*(SHIP.boost-1));
    const th=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    if(th>0)      speed += SHIP.accel*(1+boost*0.8)*dt;
    else if(th<0) speed -= (speed>2 ? SHIP.brake : SHIP.accel*0.7)*dt;
    else {
      const d=Math.min(Math.abs(speed), SHIP.drag*dt);   // coasting down
      speed -= Math.sign(speed)*d;
    }
    speed=Math.max(SHIP.reverse, Math.min(top, speed));
    throttle=Math.max(0, speed)/SHIP.top;          // what the readout shows

    qy.setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
    qp.setFromAxisAngle(new THREE.Vector3(1,0,0), pitch);
    qr.setFromAxisAngle(new THREE.Vector3(0,0,1), roll);
    q.copy(qy).multiply(qp).multiply(qr);
    ship.quaternion.copy(q);
    fwd.set(0,0,-1).applyQuaternion(q);

    /* The sky moves, not the ship — see the note at the top. */
    vel.copy(fwd).multiplyScalar(speed);
    field.position.addScaledVector(vel, -dt);
    /* And this is the only thing that actually travels. There used to be a
       `travelled` counter that crept up whichever way you were pointing, so
       the trip finished on its own whatever you did with the controls —
       which made the whole flight a corridor with a progress bar on it.
       Now you arrive because you flew there. */
    where.addScaledVector(vel, dt);

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
        const k=0.28+Math.max(0,speed/SHIP.top)*0.9+boost*0.8;
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

    /* THE TWO PLANETS, at where they really are. Each is drawn along its
       true bearing, pulled in to the far plane if it is past it, and shrunk
       by the same factor — so it covers exactly the angle it should and
       grows because you are closing on it, not because a timer says so. */
    toDest.copy(destAbs).sub(where);
    realDist=Math.max(1, toDest.length());
    show(destGlobe, toDest, realDist);
    destGlobe.rotation.y += dt*0.03;
    toHome.copy(homeAbs).sub(where);
    show(homeGlobe, toHome, Math.max(1, toHome.length()));

    // and the streaks, which only show up when you are really moving
    const fast=Math.max(0, (speed/SHIP.top)-0.92)/1.4;
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

  function show(g, to, dist){
    const draw=Math.min(dist, DRAW_MAX), k=draw/dist;
    g.position.copy(to).multiplyScalar(k);
    g.scale.setScalar(k);
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
    const p=Math.max(0, Math.min(1, 1-(realDist-ARRIVE)/Math.max(1,startDist-ARRIVE)));
    const bar=document.querySelector('#cprog'); if(bar) bar.style.width=(p*100).toFixed(1)+'%';
    const eta=document.querySelector('#ceta');
    if(eta){
      /* CLOSING SPEED, not speed. Pointed at it this is the time to arrival;
         pointed away it goes to dashes, which is the honest answer and the
         one that tells you to turn. */
      const closing=vel.dot(tmp.copy(toDest).normalize());
      if(realDist<=ARRIVE) eta.textContent=t('ARRIVING');
      else if(closing<8) eta.textContent='— · —';
      else { const left=realDist/closing;
             eta.textContent=Math.floor(left/60)+':'+String(Math.floor(left%60)).padStart(2,'0'); }
    }
    const dst=document.querySelector('#cdist');
    if(dst) dst.textContent=(realDist/1000).toFixed(1)+' km';
    const spd=document.querySelector('#cspd');
    if(spd) spd.textContent=Math.round(speed)+' u/s';
    const tb=document.querySelector('#cthrb');
    if(tb) tb.style.width=Math.max(0,Math.min(100,(speed/SHIP.top)*100)).toFixed(0)+'%';

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
           get progress(){ return Math.max(0, Math.min(1,
             1-(realDist-ARRIVE)/Math.max(1,startDist-ARRIVE))); },
           get km(){ return realDist/1000; },
           TRIP_SECONDS };
})();
