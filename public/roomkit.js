/* =====================================================================
   ROOMKIT — what a chat room is made of.

   The shell (floor, four walls, a ceiling or the sky, the lights) and the
   things that stand in it: every type data/chatrooms.json lists, built out
   of boxes and cylinders because a room may hold a hundred and fifty of
   them and a chair does not need a model.

   THIS IS THE GODOT GAME'S KIT, IN THREE. koro-godot/scripts/room_things.gd
   builds the same list to the same measurements, so a room somebody built
   in one game is recognisably the same room in the other — the same couch,
   the same colour, in the same place. What a thing DOES is not here: that
   is its behaviour, in chatroom.js.

   EVERY BUILDER RETURNS ONE GROUP standing on its own floor spot with its
   front towards +z, about the size the catalog's `solid` box says. Colour
   and text come from the object's props.
   ===================================================================== */
window.ROOMKIT = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);

  /* ------------------------------------------------------------ the kit */
  /* Materials are shared between things that look alike — a room of school
     desks is one material, not thirty. Anything a behaviour CHANGES is given
     a copy of its own when the behaviour is set up (chatroom.js), or turning
     one TV off would turn them all off. */
  const mats = new Map();
  function mat(hex, rough, metal, glow){
    const key = hex+'|'+(rough||0)+'|'+(metal||0)+'|'+(glow||0);
    let m = mats.get(key);
    if(!m){
      m = new THREE.MeshLambertMaterial({ color:hex });
      if(glow){ m.emissive = new THREE.Color(hex); m.emissiveIntensity = glow; }
      mats.set(key, m);
    }
    return m;
  }
  /* Lambert has no roughness or metalness, so the two numbers the Godot kit
     passes are read as what they are FOR: a shinier thing is a lighter one
     under the same lamp. Keeping the arguments in the same order and place
     as room_things.gd is deliberate — the two files are read side by side. */
  const box = (p, size, at, m, rot)=>{
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), m);
    mesh.position.copy(at);
    if(rot) mesh.rotation.set(rot.x, rot.y, rot.z);
    p.add(mesh);
    return mesh;
  };
  const cyl = (p, r0, r1, h, at, m, segs)=>{
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, segs||20), m);
    mesh.position.copy(at);
    p.add(mesh);
    return mesh;
  };
  const ball = (p, r, at, m)=>{
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m);
    mesh.position.copy(at);
    p.add(mesh);
    return mesh;
  };
  /* A LABEL IS A PLANE WITH WRITING ON IT, not a sprite: a neon sign on a
     wall and the word over a portal both belong to the room and turn with
     it. The canvas is sized to the text so letters keep their shape. */
  function label(p, text, at, height, color, glow, wide){
    const lines = String(text==null?'':text).split('\n');
    const cols = Math.max(1, ...lines.map(l=>l.length));
    const c = document.createElement('canvas');
    const px = 72;
    c.width  = Math.max(64, Math.min(2048, Math.ceil(cols*px*0.62/64)*64));
    c.height = Math.max(64, Math.ceil(lines.length*px*1.25/64)*64);
    const x = c.getContext('2d');
    x.clearRect(0,0,c.width,c.height);
    x.font = 'bold '+px+'px '+uiFont();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if(!glow){ x.lineWidth = px*0.16; x.strokeStyle = 'rgba(11,13,24,.85)'; }
    x.fillStyle = color;
    if(glow){ x.shadowColor = color; x.shadowBlur = px*0.5; }
    lines.forEach((l,i)=>{
      const y = c.height*(i+0.5)/lines.length;
      if(!glow) x.strokeText(l, c.width/2, y);
      x.fillText(l, c.width/2, y);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const h = height, w = wide!==undefined ? wide : h*c.width/c.height;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false,
                                    side:THREE.DoubleSide }));
    mesh.position.copy(at);
    mesh.userData.flat = true;
    mesh.userData.label = true;
    p.add(mesh);
    return mesh;
  }
  /* Re-draw a label that already exists, in place — a TV's word, a robot's
     speech, the number on a cabinet. The plane keeps its height and takes
     the new canvas's shape. */
  function relabel(mesh, text, color, glow){
    if(!mesh || !mesh.userData.label) return;
    const h = mesh.userData.h || (mesh.userData.h = mesh.geometry.parameters.height);
    const fresh = label(new THREE.Group(), text, V(0,0,0), h, color||'#ffffff', glow);
    if(mesh.material.map) mesh.material.map.dispose();
    mesh.material.map = fresh.material.map;
    mesh.material.needsUpdate = true;
    mesh.geometry.dispose();
    mesh.geometry = fresh.geometry;
  }
  const legs = (n, w, d, h, m)=>{
    [-1,1].forEach(sx=>[-1,1].forEach(sz=>
      box(n, V(0.07,h,0.07), V(sx*(w/2-0.06), h/2, sz*(d/2-0.06)), m)));
  };

  const WOOD = 0x8a5a3b, DARK_WOOD = 0x5b3a29, STEEL = 0x9aa3b5;
  const hex = (props, dflt)=>{
    const s = String((props && props.color) || dflt || '#ffffff');
    return parseInt(s.replace('#',''), 16) || 0;
  };
  const lighten = (c,k)=>new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHex();
  const darken  = (c,k)=>new THREE.Color(c).lerp(new THREE.Color(0x000000), k).getHex();

  /* ---------------------------------------------------------- furniture */
  function table(n){
    box(n, V(2.0,0.08,1.2), V(0,0.86,0), mat(WOOD));
    legs(n, 2.0, 1.2, 0.82, mat(DARK_WOOD));
  }
  function chair(n){
    const m = mat(0xb58a5f);
    box(n, V(0.6,0.08,0.6), V(0,0.46,0), m);
    legs(n, 0.6, 0.6, 0.44, mat(DARK_WOOD));
    box(n, V(0.6,0.62,0.06), V(0,0.8,-0.28), m);
    n.userData.sit = 0.5;
  }
  function couch(n, c){
    const m = mat(c);
    box(n, V(2.4,0.4,0.95), V(0,0.22,0), mat(darken(c,0.35)));
    box(n, V(2.1,0.16,0.8), V(0,0.5,0.06), m);
    box(n, V(2.4,0.6,0.26), V(0,0.72,-0.36), m);
    [-1,1].forEach(sx=>box(n, V(0.24,0.36,0.95), V(sx*1.08,0.58,0), m));
    n.userData.sit = 0.58;
  }
  function bed(n, c){
    box(n, V(1.8,0.35,2.4), V(0,0.18,0), mat(DARK_WOOD));
    box(n, V(1.7,0.25,2.3), V(0,0.47,0), mat(0xf4efe6));
    box(n, V(1.74,0.07,1.45), V(0,0.62,0.4), mat(c));
    box(n, V(1.2,0.16,0.42), V(0,0.68,-0.85), mat(0xffffff));
    box(n, V(1.8,1.05,0.12), V(0,0.75,-1.18), mat(DARK_WOOD));
    n.userData.sit = 0.62;
  }
  function desk(n){
    box(n, V(1.8,0.06,0.9), V(0,0.77,0), mat(WOOD));
    box(n, V(0.5,0.72,0.84), V(0.62,0.37,0), mat(DARK_WOOD));
    [-1,1].forEach(sz=>box(n, V(0.06,0.74,0.06), V(-0.84,0.37,sz*0.4), mat(DARK_WOOD)));
    box(n, V(0.42,0.02,0.3), V(-0.25,0.81,0.05), mat(0x2e2a33));
    box(n, V(0.42,0.28,0.02), V(-0.25,0.95,-0.11), mat(0x8ff0ff,0,0,1.2), V(-0.25,0,0));
  }
  /* The books are random but the SAME random every time: a bookshelf that
     re-shuffled itself whenever the room reloaded would be a room that never
     quite settled. */
  function bookshelf(n){
    const m = mat(DARK_WOOD);
    [-1,1].forEach(sx=>box(n, V(0.06,2.2,0.45), V(sx*0.87,1.1,0), m));
    box(n, V(1.8,2.2,0.03), V(0,1.1,-0.21), m);
    let seed = 7;
    const rnd = ()=>((seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff);
    const cols = [0xd42a35,0x27a3b3,0xffd766,0x9b6bff,0x3f7a35,0xff9f43,0xf4efe6];
    for(let i=0;i<5;i++){
      const y = 0.05 + i*0.52;
      box(n, V(1.74,0.04,0.42), V(0,y,0), m);
      if(i===4) continue;
      let x = -0.8;
      while(x < 0.75){
        const w = 0.05 + rnd()*0.06, h = 0.28 + rnd()*0.14;
        box(n, V(w,h,0.3), V(x+w/2, y+0.02+h/2, 0.02),
            mat(cols[Math.floor(rnd()*cols.length)%cols.length]));
        x += w + 0.01;
      }
    }
  }
  function rug(n, c){
    const flat = m=>{ m.side = THREE.DoubleSide; return m; };
    cyl(n, 1.4, 1.4, 0.02, V(0,0.012,0), flat(mat(c)), 40);
    cyl(n, 1.05, 1.05, 0.022, V(0,0.014,0), flat(mat(lighten(c,0.3))), 40);
    cyl(n, 0.6, 0.6, 0.024, V(0,0.016,0), flat(mat(darken(c,0.2))), 40);
  }
  /* front towards +z, like everything else: you sit on the -z side, facing it */
  function schoolDesk(n){
    box(n, V(1.0,0.05,0.6), V(0,0.74,0.1), mat(0xd9c3a5));
    [-1,1].forEach(sx=>box(n, V(0.05,0.72,0.5), V(sx*0.45,0.36,0.1), mat(STEEL)));
    box(n, V(0.45,0.05,0.4), V(0,0.44,-0.45), mat(0x27a3b3));
    box(n, V(0.45,0.35,0.04), V(0,0.66,-0.66), mat(0x27a3b3));
  }

  /* -------------------------------------------------------------- decor */
  function plant(n){
    cyl(n, 0.28, 0.22, 0.45, V(0,0.225,0), mat(0xc1683c));
    const leaf = mat(0x3f7a35);
    ball(n, 0.42, V(0,0.85,0), leaf);
    ball(n, 0.3,  V(0.22,1.15,0.05), mat(0x4f9457));
    ball(n, 0.26, V(-0.2,1.1,-0.08), leaf);
  }
  function floorLamp(n, c){
    cyl(n, 0.22, 0.26, 0.05, V(0,0.025,0), mat(0x2e2a33));
    cyl(n, 0.025, 0.025, 1.55, V(0,0.8,0), mat(0x2e2a33));
    cyl(n, 0.16, 0.3, 0.32, V(0,1.62,0), mat(c,0,0,1.0));
    const l = new THREE.PointLight(c, 0.9, 7);
    l.position.set(0,1.5,0);
    n.add(l);
    n.userData.lamp = l;
  }
  /* A POSTER IS ITS OWN PICTURE. The Godot game hangs one of the shop's
     three printed sheets; the browser has no such file to hand, so the three
     are drawn here — and being drawn rather than loaded is why they can be
     lit from behind without a second texture. */
  function posterArt(art){
    const c = document.createElement('canvas');
    c.width = 320; c.height = 480;
    const x = c.getContext('2d');
    if(art===2){                                   // a planet over a horizon
      const g = x.createLinearGradient(0,0,0,480);
      g.addColorStop(0,'#150a2e'); g.addColorStop(0.6,'#3a1f5c'); g.addColorStop(1,'#ff9f43');
      x.fillStyle=g; x.fillRect(0,0,320,480);
      x.fillStyle='#ffe9a8'; x.beginPath(); x.arc(160,300,92,0,7); x.fill();
      x.fillStyle='#16161d'; x.fillRect(0,392,320,88);
    } else if(art===3){                            // a grid running to a sun
      x.fillStyle='#0b0d18'; x.fillRect(0,0,320,480);
      const g = x.createLinearGradient(0,60,0,240);
      g.addColorStop(0,'#ff6ad5'); g.addColorStop(1,'#ffd766');
      x.fillStyle=g; x.beginPath(); x.arc(160,210,80,0,7); x.fill();
      x.fillStyle='#0b0d18';
      for(let i=0;i<5;i++) x.fillRect(80,168+i*22,160,8);
      x.strokeStyle='#8ff0ff'; x.lineWidth=2;
      for(let i=-8;i<=8;i++){ x.beginPath(); x.moveTo(160+i*18,300); x.lineTo(160+i*150,480); x.stroke(); }
      for(let i=1;i<9;i++){ const y=300+i*i*2.6; x.beginPath(); x.moveTo(0,y); x.lineTo(320,y); x.stroke(); }
    } else {                                       // bands of the game's colours
      x.fillStyle='#f4efe6'; x.fillRect(0,0,320,480);
      ['#ff6a6a','#ffd766','#a8e6cf','#8ff0ff','#9b6bff'].forEach((col,i)=>{
        x.fillStyle=col; x.fillRect(28, 40+i*84, 264, 64);
      });
      x.fillStyle='#16161d'; x.font='bold 40px '+uiFont(); x.textAlign='center';
      x.fillText('KORO', 160, 452);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function poster(n, art){
    box(n, V(1.7,2.5,0.03), V(0,0,-0.02), mat(0x16161d));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.4),
      new THREE.MeshLambertMaterial({ map:posterArt(art) }));
    m.position.set(0,0,0.001);
    m.userData.flat = true;
    n.add(m);
  }
  function neon(n, text, c){
    const css = '#'+(c>>>0).toString(16).padStart(6,'0');
    const l = label(n, String(text||'MY ROOM'), V(0,0,0.02), 0.9, css, true);
    l.userData.neon = true;
    const g = new THREE.PointLight(c, 0.8, 6);
    g.position.set(0,0,0.8);
    n.add(g);
    n.userData.lamp = g;
  }
  /* A STATUE OF SOMEBODY ON THE ROSTER, on a plinth. The body is the same
     .glb the player wears, held still at its idle pose. */
  function statue(n, who){
    cyl(n, 0.4, 0.45, 0.3, V(0,0.15,0), mat(0xe8e4f0));
    if(!window.AVATAR) return;
    const holder = new THREE.Group();
    holder.position.y = 0.3;
    n.add(holder);
    AVATAR.load(AVATAR.bodyOf ? AVATAR.bodyOf(who) : who).then(m=>{
      fit(m, 1.6);
      holder.add(m);
      const r = m.userData && m.userData.rig;
      if(r){ r.play('idle', 0); r.update(0.05); }
    }).catch(()=>{});
  }
  /* Stand a model on the floor at the height the catalog asks for, whatever
     size it was authored at. */
  function fit(m, height){
    const b = new THREE.Box3().setFromObject(m);
    const h = Math.max(0.01, b.max.y - b.min.y);
    const k = height / h;
    m.scale.multiplyScalar(k);
    b.setFromObject(m);
    m.position.y -= b.min.y;
  }
  function globe(n){
    cyl(n, 0.3, 0.35, 0.08, V(0,0.04,0), mat(0x5b3a29));
    cyl(n, 0.03, 0.03, 0.8, V(0,0.44,0), mat(0xc9a86a));
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#1f3b5c'; x.fillRect(0,0,256,128);
    let seed = 3;
    const rnd = ()=>((seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff);
    x.fillStyle = '#4f9457';
    for(let i=0;i<16;i++){
      x.beginPath();
      x.ellipse(rnd()*256, 20+rnd()*88, 8+rnd()*26, 6+rnd()*16, rnd()*3, 0, 7);
      x.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16),
      new THREE.MeshLambertMaterial({ map:tex, emissive:0x223344, emissiveIntensity:0.35 }));
    s.position.set(0,1.0,0);
    s.name = 'spin';
    n.add(s);
  }
  function crate(n){
    box(n, V(1,1,1), V(0,0.5,0), mat(0xa57a4a));
    const edge = mat(0x6b4a2a);
    [0.06,0.94].forEach(y=>box(n, V(1.02,0.1,1.02), V(0,y,0), edge));
    box(n, V(1.02,1.0,0.1), V(0,0.5,0), edge, V(0,Math.PI/4,0));
  }

  /* -------------------------------------------------------- interactive */
  /* A PORTAL'S SWIRL IS DRAWN, ONE FRAME AT A TIME. Godot's is a shader;
     here it is a small canvas the room's tick turns over, which costs a
     64×64 fill a frame and reads the same from three metres away. */
  function portal(n, to){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 10, 40),
      new THREE.MeshLambertMaterial({ color:0x8ff0ff, emissive:0x8ff0ff,
                                      emissiveIntensity:1.6, transparent:true }));
    ring.position.set(0,1.5,0);
    ring.name = 'ring';
    n.add(ring);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const tex = new THREE.CanvasTexture(c);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false,
                                    blending:THREE.AdditiveBlending, side:THREE.DoubleSide }));
    disc.position.set(0,1.5,0);
    disc.name = 'disc';
    disc.userData.flat = true;
    disc.userData.swirl = { c, tex, x:c.getContext('2d') };
    n.add(disc);
    const tag = label(n, to==='' ? 'EXIT TO KORO' : 'TO ROOM '+to, V(0,3.2,0), 0.36, '#ffe9a8');
    tag.name = 'tag';
    const l = new THREE.PointLight(0x8ff0ff, 0.9, 6);
    l.position.set(0,1.5,0.6);
    n.add(l);
    n.userData.lamp = l;
  }
  function swirl(disc, t){
    const s = disc.userData.swirl;
    if(!s) return;
    const x = s.x, N = 64, img = x.createImageData(N,N);
    for(let j=0;j<N;j++) for(let i=0;i<N;i++){
      const px = i/N*2-1, py = j/N*2-1;
      const r = Math.hypot(px,py), a = Math.atan2(py,px);
      const sw = 0.5 + 0.5*Math.sin(a*3 + r*9 - t*3);
      const k = Math.max(0, Math.min(1, (1-r)/0.8));
      const o = (j*N+i)*4;
      img.data[o  ] = (0.2 + 0.4*sw)*255*1.4;
      img.data[o+1] = (0.5 + 0.5*sw)*255*1.4;
      img.data[o+2] = 255;
      img.data[o+3] = k*k*(0.35 + 0.4*sw)*255;
    }
    x.putImageData(img,0,0);
    s.tex.needsUpdate = true;
  }
  function lightSwitch(n){
    box(n, V(0.18,0.28,0.03), V(0,0,0.015), mat(0xf4efe6));
    const nub = box(n, V(0.05,0.1,0.04), V(0,0.03,0.045), mat(0xffd766,0,0,0.6));
    nub.name = 'nub';
  }
  function jukebox(n){
    box(n, V(1.0,1.3,0.62), V(0,0.65,0), mat(0x5b3a29));
    const dome = cyl(n, 0.5, 0.5, 0.62, V(0,1.3,0), mat(0x5b3a29), 32);
    dome.rotation.x = Math.PI/2;
    const panel = box(n, V(0.78,0.9,0.04), V(0,0.95,0.32), mat(0xff9f43,0,0,1.4));
    panel.name = 'panel';
    box(n, V(0.7,0.3,0.04), V(0,0.32,0.32), mat(0x2e2a33));
    label(n, 'JUKEBOX', V(0,1.62,0.33), 0.2, '#ffe9a8').name = 'tag';
  }
  function tv(n){
    box(n, V(1.2,0.5,0.45), V(0,0.25,0), mat(DARK_WOOD));
    box(n, V(2.2,1.3,0.08), V(0,1.2,0), mat(0x16161d));
    const screen = box(n, V(2.04,1.14,0.02), V(0,1.2,0.05), mat(0x1f3b5c,0,0,1.0));
    screen.name = 'screen';
    const l = label(n, ' ', V(0,1.2,0.07), 0.3, '#ffffff', false, 1.9);
    l.name = 'text';
  }
  function arcadeBox(n){
    const body = mat(0x9b6bff);
    box(n, V(0.9,1.9,0.8), V(0,0.95,0), body);
    const screen = box(n, V(0.72,0.56,0.04), V(0,1.38,0.39), mat(0x0b0d18,0,0,1.0), V(-0.2,0,0));
    screen.name = 'screen';
    box(n, V(0.9,0.12,0.3), V(0,0.98,0.5), mat(0x2e2a33));
    cyl(n, 0.025, 0.025, 0.14, V(-0.2,1.1,0.5), mat(0xd42a35));
    [0xff6a6a,0xffd766,0x8ff0ff].forEach((c,i)=>
      cyl(n, 0.035, 0.035, 0.03, V(0.05+i*0.1,1.05,0.5), mat(c,0,0,0.8)));
    label(n, 'ARCADE', V(0,1.8,0.41), 0.16, '#ffd766', true);
    const l = label(n, 'PRESS E', V(0,1.37,0.43), 0.12, '#a8e6cf', false, 0.66);
    l.name = 'text';
    l.rotation.x = -0.2;
  }
  function robot(n){
    const body = new THREE.Group();
    body.name = 'body';
    n.add(body);
    const teal = mat(0x27a3b3), dark = mat(0x2e2a33);
    cyl(body, 0.12, 0.12, 0.7, V(-0.3,0.14,0), dark).rotation.z = Math.PI/2;
    box(body, V(0.7,0.55,0.5), V(0,0.55,0), teal);
    box(body, V(0.5,0.34,0.42), V(0,1.0,0), mat(0xe8e4f0));
    [-1,1].forEach(sx=>{
      ball(body, 0.06, V(sx*0.11,1.02,0.21), mat(0x8ff0ff,0,0,3.0));
      [0.15,-0.15].forEach(z=>{
        cyl(body, 0.1, 0.1, 0.12, V(sx*0.37,0.12,z), dark).rotation.z = Math.PI/2;
      });
    });
    cyl(body, 0.012, 0.012, 0.3, V(0,1.3,0), dark);
    ball(body, 0.05, V(0,1.46,0), mat(0xff6a6a,0,0,2.0));
    const say = label(body, ' ', V(0,1.8,0), 0.26, '#ffffff');
    say.name = 'say';
    say.userData.billboard = true;
  }
  /* THE FOUR THAT ARE MODELS IN GODOT. koro-godot loads a .glb for the tool
     chest, the workbench, the panda and the Seraph; the browser does not
     carry those files, and a room may hold a hundred and fifty things. So
     they are built the way everything else here is — which is also why they
     cost nothing to stand up and never arrive a second late.

     They are the same OBJECT either way: the same size, in the same spot,
     doing the same nothing. Somebody who built a room in Godot and opens it
     here finds their panda where they left it. */
  function toolChest(n){
    box(n, V(1.0,1.2,0.7), V(0,0.72,0), mat(0xd42a35));
    for(let i=0;i<3;i++){
      box(n, V(0.9,0.3,0.04), V(0,0.35+i*0.36,0.36), mat(0xb01e28));
      box(n, V(0.3,0.04,0.05), V(0,0.35+i*0.36,0.38), mat(STEEL));
    }
    box(n, V(1.04,0.08,0.74), V(0,1.36,0), mat(STEEL));
    [-1,1].forEach(sx=>[-1,1].forEach(sz=>
      cyl(n, 0.09, 0.09, 0.08, V(sx*0.4,0.06,sz*0.26), mat(0x2e2a33))));
  }
  function workbench(n){
    box(n, V(2.2,0.12,1.0), V(0,0.94,0), mat(WOOD));
    [-1,1].forEach(sx=>{
      box(n, V(0.12,0.9,0.9), V(sx*1.0,0.45,0), mat(DARK_WOOD));
      box(n, V(0.12,0.06,0.9), V(sx*1.0,0.24,0), mat(DARK_WOOD));
    });
    box(n, V(2.0,0.06,0.85), V(0,0.3,0), mat(DARK_WOOD));
    box(n, V(0.3,0.22,0.3), V(-0.82,1.09,0.2), mat(STEEL));
    box(n, V(0.06,0.3,0.06), V(0.9,1.13,0), mat(0x2e2a33));
    [0x8ff0ff,0xffd766,0xff6a6a].forEach((c,i)=>
      box(n, V(0.1,0.1,0.02), V(0.2+i*0.18,1.05,-0.4), mat(c,0,0,0.5)));
  }
  function panda(n){
    const white = mat(0xf4efe6), black = mat(0x2e2a33);
    ball(n, 0.52, V(0,0.72,0), white).scale.set(1.0,0.86,1.5);
    ball(n, 0.36, V(0,1.02,0.78), white);
    [-1,1].forEach(sx=>{
      ball(n, 0.12, V(sx*0.24,1.3,0.72), black);               // ears
      ball(n, 0.1,  V(sx*0.14,1.06,1.06), black).scale.set(1,1.2,0.6);  // eye patches
      [0.5,-0.42].forEach(z=>cyl(n, 0.16, 0.15, 0.5, V(sx*0.34,0.25,z), black));
    });
    ball(n, 0.08, V(0,0.98,1.1), black);
    box(n, V(0.9,0.42,0.5), V(0,0.78,-0.1), black);            // the shoulder band
  }
  function mechaModel(n){
    const plate = mat(0xe8e4f0), dark = mat(0x3a4a63), lit = mat(0x8ff0ff,0,0,2.2);
    cyl(n, 0.55, 0.62, 0.1, V(0,0.05,0), mat(0x2e2a33), 24);   // display base
    [-1,1].forEach(sx=>{
      box(n, V(0.2,0.8,0.24), V(sx*0.22,0.5,0), dark);         // legs
      box(n, V(0.26,0.12,0.42), V(sx*0.22,0.16,0.06), dark);   // feet
      box(n, V(0.16,0.62,0.2), V(sx*0.52,1.32,0), plate);      // arms
      box(n, V(0.3,0.26,0.3), V(sx*0.5,1.66,0), plate);        // shoulders
    });
    box(n, V(0.82,0.66,0.44), V(0,1.5,0), plate);              // chest
    box(n, V(0.5,0.3,0.36), V(0,1.08,0), dark);                // waist
    box(n, V(0.34,0.3,0.34), V(0,1.98,0), dark);               // head
    box(n, V(0.3,0.07,0.04), V(0,2.0,0.19), lit);              // visor
    [-1,1].forEach(sx=>box(n, V(0.06,0.3,0.06), V(sx*0.14,2.22,0), plate));
    box(n, V(0.2,0.1,0.06), V(0,1.5,0.24), lit);               // chest light
  }

  /* ------------------------------------------------------------- build */
  function build(type, props, spec){
    const n = new THREE.Group();
    props = props || {};
    switch(type){
      case 'table':       table(n); break;
      case 'chair':       chair(n); break;
      case 'couch':       couch(n, hex(props,'#9b6bff')); break;
      case 'bed':         bed(n, hex(props,'#27a3b3')); break;
      case 'desk':        desk(n); break;
      case 'bookshelf':   bookshelf(n); break;
      case 'rug':         rug(n, hex(props,'#ff6ad5')); break;
      case 'school_desk': schoolDesk(n); break;
      case 'plant':       plant(n); break;
      case 'floor_lamp':  floorLamp(n, hex(props,'#ffd766')); break;
      case 'poster':      poster(n, Math.round(Number(props.art)||1)); break;
      case 'neon_sign':   neon(n, props.text, hex(props,'#ff6ad5')); break;
      case 'statue':      statue(n, String(props.who||'nia')); break;
      case 'globe':       globe(n); break;
      case 'crate':       crate(n); break;
      case 'portal':      portal(n, String(props.to||'')); break;
      case 'light_switch':lightSwitch(n); break;
      case 'jukebox':     jukebox(n); break;
      case 'tv':          tv(n); break;
      case 'arcade':      arcadeBox(n); break;
      case 'robot':       robot(n); break;
      case 'tool_chest':  toolChest(n); break;
      case 'workbench':   workbench(n); break;
      case 'panda':       panda(n); break;
      case 'mecha_model': mechaModel(n); break;
      /* A type the catalog grew that this kit has not learned yet: a plain
         block the size the catalog says, rather than a hole in the room. */
      default: {
        const sd = (spec && spec.solid) || [1,1,1];
        box(n, V(sd[0]*0.8, sd[1]*0.8, sd[2]*0.8), V(0, sd[1]*0.4, 0), mat(0x5c5470));
      }
    }
    return n;
  }

  /* ======================================================== the shell
     A floor, four walls, a ceiling or the sky above, and the lights. The
     Godot game draws its floors with a shader; here each is a canvas, which
     is the same picture arrived at the same way the rest of this browser
     draws ground (game.js groundTexture). */
  const FLOORS = ['wood','tile','carpet','concrete','grid','grass','metal'];
  function floorTexture(kind, tint, glow){
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    const base = new THREE.Color(tint);
    const css = (col,k)=>'#'+col.clone().multiplyScalar(k===undefined?1:k).getHexString();
    let seed = 11;
    const rnd = ()=>((seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff);
    x.fillStyle = css(base); x.fillRect(0,0,512,512);
    if(kind==='wood'){
      const h = 512/8;
      for(let row=0; row<8; row++){
        const off = rnd()*180;
        for(let x0=-180; x0<512; x0+=170){
          const w = 170;
          x.fillStyle = css(base, 0.8 + rnd()*0.34);
          x.fillRect(x0+off, row*h, w-3, h-3);
          x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1;
          for(let g=0; g<5; g++){
            x.beginPath();
            x.moveTo(x0+off, row*h + 6 + g*h/5.5);
            x.bezierCurveTo(x0+off+60, row*h + 4 + g*h/5.5, x0+off+110, row*h + 9 + g*h/5.5,
                            x0+off+w, row*h + 6 + g*h/5.5);
            x.stroke();
          }
        }
      }
    } else if(kind==='tile'){
      for(let j=0;j<4;j++) for(let i=0;i<4;i++){
        x.fillStyle = css(base, 0.9 + rnd()*0.16);
        x.fillRect(i*128+3, j*128+3, 122, 122);
      }
    } else if(kind==='carpet'){
      for(let i=0;i<24000;i++){
        x.fillStyle = css(base, 0.78 + rnd()*0.34);
        x.fillRect(rnd()*512, rnd()*512, 3, 3);
      }
    } else if(kind==='concrete'){
      for(let i=0;i<9000;i++){
        x.fillStyle = css(base, 0.88 + rnd()*0.2);
        x.fillRect(rnd()*512, rnd()*512, 5, 5);
      }
    } else if(kind==='grid'){
      x.fillStyle = css(base, 0.45); x.fillRect(0,0,512,512);
      x.strokeStyle = glow; x.lineWidth = 4;
      x.shadowColor = glow; x.shadowBlur = 10;
      for(let i=0;i<=512;i+=128){
        x.beginPath(); x.moveTo(i,0); x.lineTo(i,512); x.stroke();
        x.beginPath(); x.moveTo(0,i); x.lineTo(512,i); x.stroke();
      }
    } else if(kind==='grass'){
      for(let i=0;i<16000;i++){
        x.fillStyle = css(base, 0.7 + rnd()*0.5);
        x.fillRect(rnd()*512, rnd()*512, 2, 6);
      }
    } else {                                        // metal: checker plate
      for(let j=0;j<16;j++) for(let i=0;i<16;i++){
        x.fillStyle = css(base, 0.85 + ((i+j)%2)*0.25);
        x.fillRect(i*32, j*32, 32, 32);
        x.fillStyle = css(base, 1.3);
        x.fillRect(i*32+8, j*32+8, 16, 5);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  function wallTexture(style, c){
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    const base = new THREE.Color(c);
    const css = k=>'#'+base.clone().multiplyScalar(k).getHexString();
    x.fillStyle = css(1); x.fillRect(0,0,256,256);
    let seed = 5;
    const rnd = ()=>((seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff);
    if(style==='brick'){
      const h = 32;
      for(let row=0; row<8; row++){
        const off = (row%2)*32;
        for(let i=-1;i<5;i++){
          x.fillStyle = css(0.82 + rnd()*0.3);
          x.fillRect(i*64+off+2, row*h+2, 60, h-4);
        }
      }
    } else if(style==='panel'){
      for(let i=0;i<4;i++){
        x.fillStyle = css(0.92 + (i%2)*0.14);
        x.fillRect(i*64, 0, 62, 256);
      }
    } else return null;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* THE LIGHT PRESETS — the Godot game's, number for number, so a room set
     to "dim" is as dim in both. */
  const LIGHTS = {
    warm:    { energy:1.5, ambient:0x8c7359, amb:0.5 },
    cool:    { energy:1.4, ambient:0x66809e, amb:0.5 },
    neon:    { energy:1.6, ambient:0x4d336b, amb:0.45 },
    daylight:{ energy:1.7, ambient:0x999ea8, amb:0.75 },
    dim:     { energy:0.55, ambient:0x4d4752, amb:0.25 },
    party:   { energy:1.8, ambient:0x4d3366, amb:0.35 }
  };

  /* Build the shell into `g` and hand back the handles the room needs to
     work it: which lamps to dim, which surfaces stop glowing, and the walls
     the editor lifts away. */
  function shell(g, env, size){
    const W = size.w, D = size.d, H = size.h;
    const col = (k,d)=>parseInt(String(env[k]||d).replace('#',''),16) || 0;
    const out = { lamps:[], glow:[], walls:[], lid:null, solids:[], W, D, H };

    /* floor */
    const fk = FLOORS.indexOf(String(env.floor||'concrete'))<0 ? 'concrete' : String(env.floor);
    const ftex = floorTexture(fk, col('floorColor','#9aa3b5'), String(env.lightColor||'#8ff0ff'));
    ftex.repeat.set(W/4, D/4);
    const fm = new THREE.MeshLambertMaterial({ map:ftex });
    if(fk==='grid'){ fm.emissive = new THREE.Color(0xffffff); fm.emissiveMap = ftex; fm.emissiveIntensity = 0.8; }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W+0.6, D+0.6), fm);
    floor.rotation.x = -Math.PI/2;
    floor.userData.flat = true;
    g.add(floor);
    if(fk==='grid') out.glow.push([fm, 0.8]);

    /* walls — each one a group, so the editor can lift away the ones
       between its camera and the room, the way a doll's house opens */
    const style = String(env.walls||'plain');
    const wc = col('wallColor','#e8e4f0');
    const sides = [
      { at:V(0, H/2, -D/2-0.15), size:V(W+0.6, H, 0.3), out:V(0,0,-1) },
      { at:V(0, H/2,  D/2+0.15), size:V(W+0.6, H, 0.3), out:V(0,0, 1) },
      { at:V(-W/2-0.15, H/2, 0), size:V(0.3, H, D),     out:V(-1,0,0) },
      { at:V( W/2+0.15, H/2, 0), size:V(0.3, H, D),     out:V( 1,0,0) }
    ];
    const trim = mat(style==='glass' ? 0x9aa3b5 : 0x16161d);
    if(style==='none'){
      sides.forEach(s=>{
        const lit = mat(col('lightColor','#8ff0ff'), 0, 0, 1.6);
        box(g, V(s.size.x, 0.06, s.size.z), V(s.at.x, 0.03, s.at.z), lit);
      });
    } else {
      const wtex = wallTexture(style, wc);
      const wm = style==='glass'
        ? new THREE.MeshLambertMaterial({ color:wc, transparent:true, opacity:0.16,
                                          side:THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ color:wtex ? 0xffffff : wc, map:wtex||null });
      if(wtex) wtex.repeat.set(Math.max(1,Math.round(W/3)), Math.max(1,Math.round(H/3)));
      sides.forEach(s=>{
        const wall = new THREE.Group();
        wall.userData.out = s.out;
        g.add(wall);
        out.walls.push(wall);
        box(wall, s.size, s.at, wm);
        const inward = s.out.clone().multiplyScalar(-1);
        const long = V(s.size.x>1 ? s.size.x : 0.08, 0.16, s.size.z>1 ? s.size.z : 0.08);
        box(wall, long, V(s.at.x,0.08,s.at.z).add(inward.clone().multiplyScalar(0.17)), trim);
        if(style==='glass'){
          box(wall, long, V(s.at.x,H-0.08,s.at.z).add(inward.clone().multiplyScalar(0.1)), trim);
          const along = s.size.x>1 ? V(1,0,0) : V(0,0,1);
          [-2,-1,0,1,2].forEach(k=>box(wall, V(0.14,H,0.14),
            s.at.clone().add(along.clone().multiplyScalar(k*W/4.2))
                        .add(inward.clone().multiplyScalar(0.05)), trim));
        }
        if(style==='panel'){
          const strip = new THREE.MeshLambertMaterial({ color:col('lightColor','#8ff0ff'),
            emissive:col('lightColor','#8ff0ff'), emissiveIntensity:2.0 });
          out.glow.push([strip, 2.0]);
          box(wall, V(long.x,0.06,long.z),
              V(s.at.x,2.6,s.at.z).add(inward.clone().multiplyScalar(0.17)), strip);
        }
      });
    }
    /* SOLID WHATEVER THEY LOOK LIKE: glass and "none" still keep you in.

       AND THICK, far thicker than they look. The chase camera is kept out of
       walls by sampling eight points along the line from your head to where
       it wants to sit (game.js thirdPerson) — which over five metres is a
       step of seventy centimetres, and a wall thirty centimetres thick fits
       between two samples. The camera went straight through it and the room
       became a flat green wall filling the screen. Nothing stands outside a
       room, so the block simply runs outward until no sample can miss it. */
    const THICK = 3;
    sides.forEach(s=>{
      const w = Math.max(0.5, s.size.x)/2, d = Math.max(0.5, s.size.z)/2;
      out.solids.push({
        x1:s.at.x - w - (s.out.x > 0 ? 0 : THICK*Math.abs(s.out.x)),
        x2:s.at.x + w + (s.out.x < 0 ? 0 : THICK*Math.abs(s.out.x)),
        z1:s.at.z - d - (s.out.z > 0 ? 0 : THICK*Math.abs(s.out.z)),
        z2:s.at.z + d + (s.out.z < 0 ? 0 : THICK*Math.abs(s.out.z)) });
    });

    /* ceiling */
    if(env.ceiling!==false){
      const lid = new THREE.Group();
      g.add(lid);
      out.lid = lid;
      box(lid, V(W+0.6,0.3,D+0.6), V(0,H+0.15,0), mat(col('ceilingColor','#f4efe6')));
      const panel = new THREE.MeshLambertMaterial({
        color:lighten(col('lightColor','#ffffff'),0.5),
        emissive:lighten(col('lightColor','#ffffff'),0.5), emissiveIntensity:1.6 });
      out.glow.push([panel, 1.6]);
      [-W/4,W/4].forEach(x=>[-D/4,D/4].forEach(z=>
        box(lid, V(2.6,0.05,2.6), V(x,H-0.01,z), panel)));
    }

    /* the lamps: four under the ceiling and one in the middle */
    const P = LIGHTS[String(env.light||'daylight')] || LIGHTS.daylight;
    const lc = col('lightColor','#ffffff');
    const bright = Math.max(0.2, Math.min(2, Number(env.brightness)||1));
    const q = W/4;
    [[-q,-q],[q,-q],[-q,q],[q,q]].forEach((s,i)=>{
      let c = lc;
      if(env.light==='neon' && i%2) c = 0x8ff0ff;
      else if(env.light==='daylight') c = lighten(lc, 0.6);
      const l = new THREE.PointLight(c, 1, 16, 1.4);
      l.position.set(s[0], H-1.0, s[1]);
      g.add(l);
      out.lamps.push([l, P.energy*bright*0.6]);
    });
    const mid = new THREE.PointLight(lighten(lc,0.5), 1, 24, 1.4);
    mid.position.set(0, H-0.8, 0);
    g.add(mid);
    out.lamps.push([mid, P.energy*0.8*bright*0.6]);
    out.preset = P;
    out.bright = bright;
    return out;
  }

  /* THE SKY OVER A ROOM WITH NO LID — six pictures, drawn once. */
  const SKIES = ['stars','nebula','sunset','day','void','wano'];
  function skyTexture(mode){
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    let seed = 19;
    const rnd = ()=>((seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff);
    const stars = (n, max)=>{
      for(let i=0;i<n;i++){
        const r = rnd()*max;
        x.globalAlpha = 0.25 + rnd()*0.75;
        x.fillStyle = '#ffffff';
        x.beginPath(); x.arc(rnd()*1024, rnd()*512, r, 0, 7); x.fill();
      }
      x.globalAlpha = 1;
    };
    const wash = (a,b)=>{
      const g = x.createLinearGradient(0,0,0,512);
      g.addColorStop(0,a); g.addColorStop(1,b);
      x.fillStyle = g; x.fillRect(0,0,1024,512);
    };
    if(mode==='nebula'){
      wash('#0a0618','#1b0a2e');
      for(let i=0;i<40;i++){
        const g = x.createRadialGradient(rnd()*1024, rnd()*512, 0, rnd()*1024, rnd()*512, 90+rnd()*220);
        const col = ['#ff6ad5','#8ff0ff','#9b6bff','#ff9f43'][Math.floor(rnd()*4)];
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.globalAlpha = 0.16; x.fillStyle = g; x.fillRect(0,0,1024,512);
      }
      x.globalAlpha = 1; stars(500, 1.4);
    } else if(mode==='sunset'){
      wash('#1f2b5c','#ff9f43');
      const g = x.createRadialGradient(512,470,10,512,470,300);
      g.addColorStop(0,'#fff0c2'); g.addColorStop(1,'rgba(255,159,67,0)');
      x.fillStyle = g; x.fillRect(0,200,1024,312);
    } else if(mode==='day'){
      wash('#3f7fd6','#bfe3ff');
      x.fillStyle = 'rgba(255,255,255,.9)';
      for(let i=0;i<16;i++){
        const cx = rnd()*1024, cy = 40+rnd()*220, s = 30+rnd()*70;
        for(let k=0;k<5;k++){
          x.beginPath();
          x.ellipse(cx+k*s*0.5-s, cy+(rnd()-0.5)*s*0.3, s*(0.5+rnd()*0.5), s*0.35, 0, 0, 7);
          x.fill();
        }
      }
    } else if(mode==='void'){
      x.fillStyle = '#05060b'; x.fillRect(0,0,1024,512);
    } else if(mode==='wano'){
      wash('#070a1a','#121a3a');
      stars(700, 1.2);
      const g = x.createRadialGradient(760,150,10,760,150,120);
      g.addColorStop(0,'#a8e6cf'); g.addColorStop(1,'rgba(79,148,87,0)');
      x.fillStyle = g; x.beginPath(); x.arc(760,150,110,0,7); x.fill();
    } else {                                        // stars
      wash('#04060f','#0b1020');
      stars(900, 1.5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  return { build, shell, swirl, relabel, label, mat, box, cyl, ball, fit,
           floorTexture, skyTexture, LIGHTS, FLOORS, SKIES, hex, lighten, darken };
})();
