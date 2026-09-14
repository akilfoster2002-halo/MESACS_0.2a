/* =====================================================================
   THE TITLE SCREEN — the game's own world, turning, instead of a picture
   of one.

   What was here before was a JPEG: seven blocky figures standing in a
   meadow under a blue sky. Nothing in this game looks like that. The
   worlds are BALLS — three hundred metres across, dark sky, buildings
   that go over the horizon because the ground curves away under your feet
   — and the single most surprising thing about walking into Senio for the
   first time is exactly the thing a flat photograph cannot say.

   So the first screen is the planet, and it is the REAL one: the same
   value noise, the same soil ramp, the same buildings at the same
   longitudes as the world you land on when you press START. Turn it far
   enough and Mission Control comes round the limb.

   IT IS NOT planet.js. That file owns a world you can walk on, with
   collision, a player, rooms, weather and a save file; this one wants a
   sphere, a light and sixty seconds of rotation. Sharing the code would
   mean dragging all of that onto a screen that has no player on it yet.
   What IS shared is the arithmetic — the hash, the noise, the height
   curve and the colour ramp are copied deliberately and marked, because
   if the two ever disagree the title screen is advertising a planet the
   game does not have.

   ONE GL CONTEXT, and it is given back on the way out. A browser hands
   out about sixteen and then starts dropping the oldest, which on a lab
   Chromebook is how the planet you actually play on loses its canvas to
   the menu you opened twice.
   ===================================================================== */
window.TITLE = (function(){

  /* The green biome, straight off BIOMES[0] in planet.js — low ground, two
     greens, a dry gold, brown earth and grey rock. */
  const SOIL=[[0.13,0.28,0.15],[0.20,0.38,0.18],[0.29,0.44,0.19],
              [0.40,0.40,0.20],[0.30,0.22,0.14],[0.31,0.30,0.32]];
  const SKY=0x070a1a;                       // Senio's sky, and space is darker still
  const RELIEF=0.058;                       // as a fraction of the radius, not metres
  const PR=1.9;                             // the ball, in screen units

  /* The hub's buildings, at the longitudes and latitudes they really stand
     at, so the skyline that comes round the limb is the one you land in. */
  const TOWNS=[
    { lon:0,   lat:7,   w:0.145, d:0.105, h:0.052, wall:0x3a4f8c, roof:0x8fd3ff },  // Mission Control
    { lon:-19, lat:-6,  w:0.070, d:0.054, h:0.034, wall:0x4a3f7a, roof:0xcdb4f6 },  // the Workshop
    { lon:19,  lat:-6,  w:0.165, d:0.115, h:0.044, wall:0x6b4a5e, roof:0xffb4a2 },  // the Mall
    { lon:0,   lat:-21, w:0.070, d:0.054, h:0.034, wall:0x4d6b4a, roof:0xa8e6cf },  // the Library
    { lon:-34, lat:6,   w:0.098, d:0.075, h:0.040, wall:0x5c4636, roof:0xffd8a8 }   // the Mechanic
  ];

  let el=null, renderer=null, scene=null, camera=null;
  let globe=null, sky=null, halo=null, moon=null, stars=null, raf=0, last=0, t=0;
  let ro=null;

  /* ------------------------------------------------------- the landscape
     COPIED FROM planet.js ON PURPOSE. Same hash, same octaves, same curve —
     a title screen showing a different planet from the one behind START is
     worse than a title screen showing nothing. */
  function hash3(i,j,k){
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177);
    h = Math.imul(h ^ (h>>>13), 1274126177);
    h = Math.imul(h ^ (h>>>16), 2246822519);
    return ((h ^ (h>>>13)) >>> 0) / 4294967295;
  }
  const fade = t => t*t*(3-2*t);
  function vnoise(x,y,z){
    const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
    const xf=fade(x-xi), yf=fade(y-yi), zf=fade(z-zi);
    let n=0;
    for(let dz=0;dz<2;dz++) for(let dy=0;dy<2;dy++) for(let dx=0;dx<2;dx++){
      const w=(dx?xf:1-xf)*(dy?yf:1-yf)*(dz?zf:1-zf);
      n += w*hash3(xi+dx, yi+dy, zi+dz);
    }
    return n*2-1;
  }
  function fbm(x,y,z,freq,oct){
    let a=1, f=freq, sum=0, norm=0;
    for(let i=0;i<oct;i++){
      sum += a*vnoise(x*f, y*f, z*f);
      norm += a; a*=0.5; f*=2.07;
    }
    return sum/norm;
  }
  /* Squared going up and linear coming down, so hills stand on a plain
     rather than the whole ball rolling like a swell. */
  function height(x,y,z){
    const h=fbm(x,y,z,5.5,4);
    return (h>0 ? h*h*2.2 : h*0.7)*RELIEF;
  }

  function planetMesh(){
    const g=new THREE.SphereGeometry(PR, 150, 96);
    const p=g.attributes.position, n=p.count;
    const col=new Float32Array(n*3);
    const v=new THREE.Vector3();
    for(let i=0;i<n;i++){
      v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const h=height(v.x, v.y, v.z);
      const r=PR*(1+h);
      p.setXYZ(i, v.x*r, v.y*r, v.z*r);
      /* COLOUR COMES OFF A SECOND NOISE FIELD as well as the height, which
         is what stops a planet reading as a set of contour bands: patches
         of dry gold and bare earth sit across the greens instead of only
         above them. */
      const patch=fbm(v.x, v.y, v.z, 2.9, 2);
      const k=Math.max(0, Math.min(0.999,
        (h/RELIEF)*0.40 + 0.42 + patch*0.18));
      const band=k*(SOIL.length-1);
      const a=SOIL[Math.floor(band)], b=SOIL[Math.min(SOIL.length-1, Math.floor(band)+1)];
      const f=band-Math.floor(band);
      col[i*3  ]=a[0]+(b[0]-a[0])*f;
      col[i*3+1]=a[1]+(b[1]-a[1])*f;
      col[i*3+2]=a[2]+(b[2]-a[2])*f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col,3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors:true }));
  }

  /* Where a longitude and latitude land on the ball, and which way is up
     there — the same tangent frame the real planet stands its buildings on. */
  function dirOf(lonDeg, latDeg){
    const lo=lonDeg*Math.PI/180, la=latDeg*Math.PI/180;
    return new THREE.Vector3(Math.cos(la)*Math.sin(lo), Math.sin(la), Math.cos(la)*Math.cos(lo));
  }
  /* A TOWN, NOT A BUILDING. One box per site is about twenty pixels by seven
     at this range, and a twenty-by-seven box is a dash — five of them round
     the ball read as scratches on the lens rather than as anything standing
     on a surface. What reads at this size is a CLUSTER with height in it: a
     few blocks of different heights, close together, catching the light on
     their tops. It is the same trick the real world uses to make a town
     legible from the air, and the colours are still the building's own. */
  function town(b){
    const g=new THREE.Group();
    const wall=new THREE.MeshLambertMaterial({color:b.wall});
    const lid =new THREE.MeshLambertMaterial({color:b.roof});
    /* Fixed offsets rather than Math.random: the skyline that comes round the
       limb should be the same skyline every time the screen is opened. */
    const PLAN=[[0,0,1.00],[0.62,0.30,0.72],[-0.58,0.38,0.64],
                [0.24,-0.66,0.58],[-0.34,-0.58,0.46]];
    PLAN.forEach(([ox,oz,k],i)=>{
      const w=b.w*(0.30+k*0.26), d=b.d*(0.32+k*0.26), h=b.h*(0.55+k*1.15);
      const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wall);
      box.position.set(ox*b.w*0.46, h/2, oz*b.d*0.46);
      g.add(box);
      /* The pastel lid is how you pick a building out from the air in the
         game itself, so it is how you pick one out from orbit here. */
      const roof=new THREE.Mesh(new THREE.BoxGeometry(w*1.18, h*0.20, d*1.18), lid);
      roof.position.set(box.position.x, h+h*0.09, box.position.z);
      g.add(roof);
    });

    const dir=dirOf(b.lon, b.lat);
    const up=dir.clone();
    const ref=Math.abs(up.y)>0.94 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
    const right=new THREE.Vector3().crossVectors(ref, up).normalize();
    const fwd=new THREE.Vector3().crossVectors(up, right).normalize();
    const m=new THREE.Matrix4().makeBasis(right, up, fwd);
    g.quaternion.setFromRotationMatrix(m);
    const h=height(dir.x, dir.y, dir.z);
    /* SUNK A LITTLE. A box sitting exactly on a displaced sphere shows
       daylight under one corner wherever the triangle beneath it happens to
       tilt, and a building with a gap under it is floating. */
    g.position.copy(dir).multiplyScalar(PR*(1+h)-b.h*0.16);
    return g;
  }

  /* -------------------------------------------------------- the weather
     A THIN SHELL OF CLOUD, and it is the single cheapest thing that turns a
     textured ball into a world. Without it the eye reads the surface as a
     painted object; with a layer drifting over it at its own speed, and
     casting nothing, it reads as atmosphere — which is also the honest
     picture, because the game's worlds do have weather in them.

     Equirectangular, painted once into a canvas: the same fbm as the ground,
     thresholded so most of the sphere is clear and the rest is soft-edged
     banks. The poles are squeezed by the projection, which is what gives the
     high latitudes their streaked look for free. */
  function cloudTexture(){
    const W=1024, H=512;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const x=c.getContext('2d');
    const img=x.createImageData(W,H), d=img.data;
    for(let j=0;j<H;j++){
      const lat=(j/H)*Math.PI - Math.PI/2;
      const cy=Math.sin(lat), r=Math.cos(lat);
      for(let i=0;i<W;i++){
        const lon=(i/W)*Math.PI*2;
        const n=fbm(Math.cos(lat)*Math.sin(lon)*1, cy, r*Math.cos(lon), 2.6, 4);
        /* A THRESHOLD, not a fade. Clouds everywhere at half opacity is
           haze; clouds in some places and none in others is weather. */
        /* THE THRESHOLD IS THE WHOLE DIAL. At 0.015 the banks joined up and
           the planet went white — a grey marble with a green edge, which is a
           weather system rather than a world. Higher, and the cloud breaks
           into islands with land between them, which is what lets the place
           you are about to land on actually be seen. */
        let a=(n-0.075)/0.30;
        a=Math.max(0, Math.min(1, a));
        a=a*a*(3-2*a);
        // thinner over the poles, where the projection would smear it worst
        a *= 0.35+0.65*Math.pow(Math.max(0,Math.cos(lat)), 0.6);
        const k=(j*W+i)*4;
        d[k]=255; d[k+1]=255; d[k+2]=255; d[k+3]=Math.round(a*242);
      }
    }
    x.putImageData(img,0,0);
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=THREE.RepeatWrapping;
    return tex;
  }
  /* JUST CLEAR OF THE HIGHEST PEAK, which is a measured number and not a
     guess: sampling height() over the sphere puts the tallest ground at
     1.072 radii, so the shell goes a little above that. The first attempt
     sat at 1.016 and was BURIED — the entire cloud layer was inside the
     hills, surfacing in the flat places as a few pale smears. Overcorrecting
     to 1.165 was worse in the other direction: a detached halo hanging off
     the planet with a gap of sky under it. */
  function cloudShell(){
    return new THREE.Mesh(new THREE.SphereGeometry(PR*1.085, 96, 64),
      new THREE.MeshLambertMaterial({ map:cloudTexture(), transparent:true,
                                      depthWrite:false, opacity:0.86 }));
  }

  /* --------------------------------------------------------- the glow
     No shaders. A sprite with a radial gradient painted so that the planet's
     own edge sits at 0.62 of it: transparent inside (the ball is drawn
     there), brightest just outside the limb, gone by the rim. That is an
     atmosphere from any angle, it costs one quad, and it survives every
     driver in the lab. */
  function haloTexture(){
    const c=document.createElement('canvas'); c.width=c.height=512;
    const x=c.getContext('2d');
    const g=x.createRadialGradient(256,256,0, 256,256,256);
    g.addColorStop(0.00,'rgba(90,170,255,0)');
    g.addColorStop(0.575,'rgba(90,170,255,0)');
    g.addColorStop(0.625,'rgba(126,200,255,0.55)');
    g.addColorStop(0.700,'rgba(96,170,255,0.26)');
    g.addColorStop(0.840,'rgba(60,120,220,0.08)');
    g.addColorStop(1.00,'rgba(40,90,190,0)');
    x.fillStyle=g; x.fillRect(0,0,512,512);
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }
  function starField(){
    const N=1400, p=new Float32Array(N*3), s=new Float32Array(N);
    for(let i=0;i<N;i++){
      /* On a shell rather than in a box: stars at the corners of a cube are
         denser along the diagonals, and the eye picks that up as a pattern. */
      const u=Math.random()*2-1, th=Math.random()*Math.PI*2, r=26+Math.random()*10;
      const k=Math.sqrt(1-u*u);
      p[i*3]=Math.cos(th)*k*r; p[i*3+1]=u*r; p[i*3+2]=Math.sin(th)*k*r;
      s[i]=Math.random();
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('tw', new THREE.BufferAttribute(s,1));
    return new THREE.Points(g, new THREE.PointsMaterial({
      color:0xcfe0ff, size:0.11, sizeAttenuation:true,
      transparent:true, opacity:0.9, depthWrite:false }));
  }
  /* VOLTA, which is a real place in this game and not set dressing: the
     night world, small and violet, a long way off. */
  function moonMesh(){
    const g=new THREE.SphereGeometry(0.30, 32, 24);
    const p=g.attributes.position, v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      v.set(p.getX(i),p.getY(i),p.getZ(i));
      const d=v.clone().normalize();
      const h=1+fbm(d.x*3,d.y*3,d.z*3,4,2)*0.05;
      p.setXYZ(i, v.x*h, v.y*h, v.z*h);
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({color:0x6b6180}));
  }

  /* ------------------------------------------------------------- build */
  function build(){
    el=document.querySelector('#titleView');
    if(!el || renderer) return !!renderer;
    renderer=new THREE.WebGLRenderer({ canvas:el, antialias:true, alpha:false,
                                       powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.6));
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.06;

    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x03050e);
    camera=new THREE.PerspectiveCamera(38, 1, 0.1, 120);

    stars=starField(); scene.add(stars);

    globe=new THREE.Group(); scene.add(globe);
    globe.add(planetMesh());
    TOWNS.forEach(b=>globe.add(town(b)));
    /* The weather is NOT a child of the globe: it turns at its own rate, a
       little faster than the ground, which is the whole reason it reads as
       something moving over a surface rather than something painted on it. */
    sky=cloudShell(); scene.add(sky);
    /* Tipped, because a ball spinning about a vertical axis dead-on reads as
       a circle with a moving texture. An axis you can see is what tells you
       it is a sphere. */
    globe.rotation.z=0.30;

    halo=new THREE.Sprite(new THREE.SpriteMaterial({
      map:haloTexture(), transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending }));
    halo.scale.set(PR*3.22, PR*3.22, 1);
    scene.add(halo);

    moon=moonMesh(); scene.add(moon);

    /* THE SUN IS OFF TO ONE SIDE, not behind the camera. A ball lit from
       where you are standing is a flat disc; a ball with a terminator across
       it is a world, and the towns near the shadow line are the ones whose
       windows you can see. */
    /* THE AMBIENT WAS DOING THE SUN'S JOB. At 0.55 it lifted the night side
       to within a shade of the day side, the terminator vanished, and what
       was left was a flat green disc — a picture of a planet rather than a
       lit ball. It is a quarter of that now, and blue, so the dark half
       reads as night rather than as unpainted. */
    scene.add(new THREE.AmbientLight(0x1a2547, 0.30));
    const sun=new THREE.DirectionalLight(0xfff3e2, 2.1);
    sun.position.set(-7.0, 2.2, 3.4); scene.add(sun);
    // a cold rim off the far side, so the night edge is drawn rather than lost
    const bounce=new THREE.DirectionalLight(0x4a6ab0, 0.34);
    bounce.position.set(5.6, -1.2, -3.2); scene.add(bounce);

    layout();
    /* The canvas is sized off its own box, which the browser can change
       without a window resize ever firing — a sidebar opening, the pane
       being dragged. */
    if(window.ResizeObserver){ ro=new ResizeObserver(layout); ro.observe(el); }
    window.addEventListener('resize', layout);
    return true;
  }

  /* WHERE THE PLANET SITS depends on the shape of the window, because the
     words have to go somewhere. On a wide screen there is room beside it,
     so the ball drops low and the title sits in the sky above it; on a tall
     narrow one it drops further still and shrinks, or the title lands in
     the middle of the ocean. */
  function layout(){
    if(!renderer || !el) return;
    const w=el.clientWidth||window.innerWidth, h=el.clientHeight||window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect=w/h; camera.updateProjectionMatrix();
    const a=w/h;
    /* FAR ENOUGH BACK TO BE A BALL. The first numbers here put the planet
       across nine tenths of the frame, and a sphere that big has no visible
       curve left in it — it was a green wall with a logo on it. Backed off
       to about a third of the height and sunk below the middle, the limb
       curves right across the picture and there is sky above it for the
       words, which is the whole composition. */
    /* BIG, AND LOW. The words take the top of the frame and the world takes
       the bottom, which is the only arrangement where neither is standing on
       the other — a centred planet puts START through its equator, and a
       small one in the corner is a decoration rather than the subject. The
       limb crosses the whole picture, so what you read is a curve too big to
       be a hill. */
    /* LOW ENOUGH TO CLEAR THE STACK. There is a lot of screen furniture on
       this page — a logo, a tagline, START, a sign-in link and two language
       buttons — and together they run most of the way down the frame. A ball
       centred behind all that is a ball with buttons punched through it, so
       the planet sits below them and what shows is the crown: a limb curving
       right across the foot of the picture, which at this size is a horizon
       you could not mistake for a hill. */
    const dist = a<0.85 ? 10.6 : a<1.35 ? 9.2 : 8.4;
    const drop = a<0.85 ? -3.85 : a<1.35 ? -3.35 : -3.05;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, drop*0.34, 0);
    globe.position.set(0, drop, 0);
    sky.position.copy(globe.position);
    sky.rotation.z=globe.rotation.z;
    halo.position.copy(globe.position);
    moon.position.set(a<0.85 ? 1.75 : 2.95, drop+4.05, -2.4);
  }

  /* -------------------------------------------------------------- loop */
  function frame(now){
    raf=requestAnimationFrame(frame);
    const dt=Math.min((now-last)/1000, 0.05); last=now; t+=dt;
    /* A LITTLE UNDER TWO MINUTES A TURN. Fast enough that the skyline has
       visibly moved while somebody reads the button, slow enough that it is
       never the thing you are looking at. */
    globe.rotation.y += dt*0.055;
    sky.rotation.y   += dt*0.071;     // the weather runs ahead of the ground
    moon.rotation.y  += dt*0.02;
    stars.rotation.y += dt*0.004;
    // the camera breathes, so the picture is never quite still
    camera.position.x = Math.sin(t*0.13)*0.22;
    camera.position.y = Math.sin(t*0.09)*0.14;
    camera.lookAt(0, globe.position.y*0.42, 0);
    renderer.render(scene, camera);
  }

  function open(){
    if(!build()) return;
    layout();
    if(!raf){ last=performance.now(); raf=requestAnimationFrame(frame); }
  }
  function close(){
    if(raf){ cancelAnimationFrame(raf); raf=0; }
  }
  /* Handing the context back. close() only stops drawing — the canvas keeps
     its GL context, which is right for a screen you come back to between
     every mission. This is for when the page is genuinely done with it. */
  function dispose(){
    close();
    if(ro){ ro.disconnect(); ro=null; }
    window.removeEventListener('resize', layout);
    if(renderer){ renderer.dispose(); renderer=null; }
    scene=null; camera=null; globe=null; sky=null; halo=null; moon=null; stars=null; el=null;
  }

  return { open, close, dispose, get running(){ return !!raf; } };
})();
