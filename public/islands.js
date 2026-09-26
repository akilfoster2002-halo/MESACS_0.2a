/* =====================================================================
   THE SKY ISLANDS — somewhere to fly TO.

   Flight already worked: you press F, you go up, and the ceiling is a
   hundred and twenty metres over the hills. But there was nothing up
   there. The whole of the sky was a place you passed through on the way
   back down to the same field, which is why flying was a shortcut rather
   than somewhere to go.

   So: four islands hanging over Wano, inside the ceiling, each one big
   enough to land on and stand about on. They are ordinary ground as far
   as the game is concerned — floorAt() returns their deck when you are
   over one and above it, blocked() stops you flying into their rock — so
   everything that already works on the planet works on them.

   THE ISLAND SHAPE IS A LATHE, not a box and not a sphere. The profile is
   the whole read: a nearly flat top with a slight crown, a rim, and then
   an underside that tapers away to a point. That taper is the only thing
   that says "floating" rather than "cut out and pasted" — you believe a
   rock is hanging in the air when you can see the bottom of it.

   THE FALLS is the one that justifies the rest. It carries a lake, and
   the lake spills over a notch in its rim and falls the whole way down to
   Wano, where it lands in a pool that is not otherwise on this planet —
   there is no water anywhere on Wano, which is why the fish had nowhere
   to live until the waterfall gave them somewhere.

   IT IS CALLED ISLANDS, NOT SKY, and that is not taste: planet.js holds
   the world's sky COLOUR in a variable called SKY, which shadows any global
   of that name inside its own closure. The first version of this file was
   window.SKY and planet.js answered every call to it with a number.

   WHAT THIS FILE DOES NOT DO is reach for anything. planet.js owns the
   world, the radius, the frames and the terrain; all of it arrives through
   build(), so there is no second copy of the sphere maths in here and no
   load-order argument about who is ready first.
   ===================================================================== */
window.ISLANDS = (function(){

  /* ------------------------------------------------------------ the isles
     Placed in degrees like everything else on this ball, and at an altitude
     rather than a radius, because "sixty metres up" is a thing you can
     check against the flight ceiling and a raw radius is not. */
  const ISLES=[
    /* THE FALLS is placed by where its WATER lands, not by where the rock
       looks good. The pool is twenty-five metres across and the first
       position put it sixty metres from Mission Control — whose own half
       diagonal is thirty-nine — so the waterfall came down through the
       castle and you landed in the gate. Out here it is eighty-five metres
       clear, in open country you can walk right round, and still close
       enough to the door to be the first thing you look up at. */
    /* AND IT IS MODELLED NOW TOO, and Japanese, like the world under it:
       mossy terraces, a torii and a shrine, black pines and a cherry, and
       rock strata tapering to a point with roots hanging off it (Higgsfield:
       a painted picture, then Meshy made it a textured mesh). It has no
       baked height grid, so one is made from its triangles when it loads —
       see fieldFromMesh(). The water pours off its rim toward the pool. */
    { id:'falls',  lon:13,  lat:16,  r:34, alt:62, spin:0.35,
      fall:true, model:'islands/falls.glb', yaw:Math.PI },
    /* THE GARDEN IS MODELLED, not lathed: a Blender island with its own
       cliffs, terraces, ancient tree and hanging roots. Its ground comes
       with it as a height grid baked from the rock, so floorAt() and
       blocked() read the same surface you can see. */
    { id:'garden', lon:-16, lat:9,   r:26, alt:78, spin:-0.9,
      model:'islands/garden.glb' },
    { id:'spire',  lon:24,  lat:-12, r:19, alt:95, spin:2.1,  trees:2, tall:true },
    /* A stepping stone, deliberately small and low: it is the one you find
       first, and finding a small one is what tells you the big ones are
       worth looking for. */
    { id:'stone',  lon:-3,  lat:-9,  r:11, alt:48, spin:1.2,  trees:1 },
    /* NEON — the arcade, and the only island with a door in it.

       THE OTHER FOUR ARE PLACES YOU LAND ON. This is a place you go INTO,
       which is why it is the biggest and the flattest of them: an island
       you have to hunt for a footing on is a bad approach to a building,
       and the whole of the top is a landing apron with the pavilion in the
       middle of it.

       AND IT IS HIGH. Ninety-six metres, near the top of Wano's flight
       ceiling, because an arcade in the clouds has to be above the cloud
       deck for the clouds to read as clouds rather than as fog on a hill.
       You can see the glow of it from the ground at night, which is what
       makes a child press F and go and find out. */
    /* AND NOW IT IS A PAGODA on a floating rock (Higgsfield: a painted
       concept from two reference pictures, then Meshy made it a mesh) — five
       tiers of dark roof edged in pink-red neon, a golden spire, a red
       bonsai and a torii. The door is found at the foot of the pagoda once
       the model is in (placeDoor), facing `doorYaw`. */
    { id:'neon',   lon:-8,  lat:22,  r:36, alt:92, spin:0.55, arcade:true, clouds:true,
      model:'islands/neon.glb', doorYaw:0 }
  ];

  const GRASS=[0x4a7f3a, 0x5b9147, 0x6aa352];
  const ROCK =[0x6b6152, 0x574f43, 0x463f36];
  const WATER=0x2f7fb5;

  let W=null;                 // what planet.js handed us
  let group=null, isles=[], fall=null, riv=null, pool=null, fish=[], turtles=[], t=0;

  /* A stable hash, so an island is the same island every time the world is
     built. Math.random here would reshape the rock every time you flew home. */
  function rnd(seed){
    let h=Math.imul(seed^0x9e3779b9, 2654435761);
    h=Math.imul(h^(h>>>15), 2246822519);
    return ((h^(h>>>13))>>>0)/4294967295;
  }

  /* ----------------------------------------------------------- the rock
     The profile, revolved. x is how far out, y is how far up from the rim.
     Everything above 0 is the ground you stand on; everything below it is
     the part that makes it float. */
  /* THE CROWN IS NOT FLAT, and the ground you stand on has to agree with the
     ground you can see. The lathe domes from R*0.10 at the middle down to 0
     at the rim, and the first version of floorAt() answered with the peak
     everywhere inside the island — so walking out towards the edge left you
     hovering three metres over your own shadow with the rock visible beneath
     your feet. Both now read the same four numbers. */
  const CROWN=[[0,0.100],[0.42,0.085],[0.74,0.045],[0.93,0.012],[1,0]];
  function crownY(k, offFrac){
    const u=Math.max(0, Math.min(1, offFrac));
    for(let i=1;i<CROWN.length;i++){
      if(u<=CROWN[i][0]){
        const [a,ay]=CROWN[i-1], [b,by]=CROWN[i];
        const t=(u-a)/Math.max(1e-6,b-a);
        return k.r*(ay+(by-ay)*t);
      }
    }
    return 0;
  }
  function isleGeo(k, seed, LAKE){
    const R=k.r, deep=k.tall ? R*1.9 : R*1.15;
    const prof=[
      ...CROWN.map(([u,y])=>[R*u, R*y]),
      [R*0.97,    -R*0.10],
      [R*0.82,    -deep*0.26],
      [R*0.58,    -deep*0.52],
      [R*0.30,    -deep*0.76],
      [R*0.10,    -deep*0.93],
      [0.0,       -deep]
    ].map(([x,y])=>new THREE.Vector2(Math.max(0.001,x), y));
    const g=new THREE.LatheGeometry(prof, 44);

    /* NO ISLAND IS A CIRCLE. The lathe gives a turned bowl; pushing every
       ring in and out by a slow function of its angle turns it into a rock.
       The push is strongest at the rim and dies away towards the point, so
       the silhouette from below stays a taper rather than a star. */
    const p=g.attributes.position, col=new Float32Array(p.count*3);
    const c=new THREE.Color();
    for(let i=0;i<p.count;i++){
      const x=p.getX(i), z=p.getZ(i);
      let y=p.getY(i);        // the basin below moves it
      const a=Math.atan2(z,x), rad=Math.hypot(x,z);
      // (y is re-read below after the basin is cut)
      const lump = 1 + 0.13*Math.sin(a*3 + seed)
                     + 0.08*Math.sin(a*5 - seed*1.7)
                     + 0.05*Math.sin(a*8 + seed*0.6);
      const grip = Math.min(1, Math.max(0, (y + deep*0.5)/(deep*0.5+R*0.1)));
      const k2 = 1 + (lump-1)*grip;
      const nx=x*k2, nz=z*k2;

      /* THE LAKE SITS IN A BASIN, and the basin is cut here rather than
         faked by floating a blue disc over the grass. A crown that domes
         from the middle down to the rim cannot hold a flat sheet of water:
         the first version put the disc at one height and you could see
         under one half of it and through the other — a lake hovering over
         its own island. So the rock is pushed DOWN to a flat bed under the
         water and eased back up to the grass at the shore. */
      if(LAKE && y > -R*0.02){
        const dd=Math.hypot(nx-LAKE.x, nz-LAKE.z);
        if(dd < LAKE.r*1.15){
          const u=dd/(LAKE.r*1.15), sm=u*u*(3-2*u);
          y = Math.min(y, LAKE.bed + (y-LAKE.bed)*sm);
        }
      }
      p.setXYZ(i, nx, y, nz);

      /* Grass on the crown, rock everywhere the ground falls away. The
         change is at the rim because that is where the ground stops being
         something you could stand on. */
      let hex;
      const fy=p.getY(i);                 // after the basin, not before it
      if(LAKE && Math.hypot(p.getX(i)-LAKE.x, p.getZ(i)-LAKE.z) < LAKE.r*0.98
         && fy < LAKE.bed + R*0.02){
        hex = 0x5a4f3e;                   // the bed: wet sand, not grass
      } else if(fy > -R*0.02){
        hex = GRASS[(Math.floor(rad*0.35 + a*2 + seed)%GRASS.length+GRASS.length)%GRASS.length];
      } else {
        const d=Math.min(2, -fy/(deep*0.55));
        hex = ROCK[Math.min(ROCK.length-1, Math.floor(d*ROCK.length))];
      }
      c.setHex(hex);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col,3));
    g.computeVertexNormals();
    return g;
  }

  /* A tree, the same blocky kind that grows on the planet below. */
  function tree(scale){
    const g=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.32*scale,0.44*scale,3.4*scale,6),
      new THREE.MeshLambertMaterial({color:0x6b4a2f}));
    trunk.position.y=1.7*scale; g.add(trunk);
    const leaf=new THREE.MeshLambertMaterial({color:0x3f7a35});
    [[0,3.9,1.9],[0.9,4.9,1.35],[-0.8,4.7,1.2]].forEach(([x,y,r])=>{
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r*scale,0), leaf);
      m.position.set(x*scale,y*scale,0); g.add(m);
    });
    return g;
  }

  /* ------------------------------------------------------------- water
     A lake is a disc a little under the crown, and it is the only flat
     thing on the island — which is what makes it read as water before the
     colour does. */
  function lake(r){
    const m=new THREE.Mesh(new THREE.CircleGeometry(r, 40),
      new THREE.MeshLambertMaterial({color:WATER, transparent:true, opacity:0.86}));
    m.rotation.x=-Math.PI/2;
    return m;
  }

  /* ---------------------------------------------------------- creatures */
  function fishModel(tint){
    const g=new THREE.Group();
    const m=new THREE.MeshLambertMaterial({color:tint});
    const body=new THREE.Mesh(new THREE.ConeGeometry(0.26,1.0,6), m);
    body.rotation.x=Math.PI/2; g.add(body);
    const tail=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,4), m);
    tail.rotation.x=-Math.PI/2; tail.position.z=-0.64; g.add(tail);
    return g;
  }
  function turtleModel(){
    const g=new THREE.Group();
    /* Two metres of shell is a Galapagos tortoise standing next to a child.
       Scaled to something that reads as a turtle rather than as a rock with
       legs — the whole group, so the legs and the walk cycle come with it. */
    g.scale.setScalar(0.62);
    const shellM=new THREE.MeshLambertMaterial({color:0x4e7a43});
    const skinM =new THREE.MeshLambertMaterial({color:0x93a86a});
    const shell=new THREE.Mesh(new THREE.SphereGeometry(0.8,12,8,0,Math.PI*2,0,Math.PI/2), shellM);
    shell.scale.set(1,0.62,1.25); shell.position.y=0.42; g.add(shell);
    const belly=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.26,1.85), skinM);
    belly.position.y=0.30; g.add(belly);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.30,10,8), skinM);
    head.position.set(0,0.46,1.15); g.add(head);
    const legs=[];
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sz])=>{
      const l=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.22,0.62), skinM);
      l.position.set(sx*0.62, 0.20, sz*0.62); g.add(l); legs.push(l);
    });
    g.userData.legs=legs;
    return g;
  }

  /* ------------------------------------------------------- where water lands
     WHAT THE GROUND HAS TO KNOW, AND WHEN. A plunge pool laid on top of the
     terrain is a blue disc pasted on a hill: you can see its edge standing
     proud of the grass, and a tree the scatter planted before the pool
     existed grows straight up through the middle of it.

     The fix is the one the launch pad already uses — the ground is SHAPED
     for it. But the terrain mesh is built long before the islands are, so
     planet.js has to be able to ask where the water will land before there
     is any water. It can: a pool's position falls out of the island's own
     longitude, spin and radius and has nothing to do with the hills. */
  /* DEEP ENOUGH TO SWIM IN. Two metres was a paddling pool — you waded to
     the middle of a plunge pool fed by sixty metres of falling water and the
     surface was at your chest. Eight is over everybody's head, which is what
     lets the character leave the floor entirely and float. */
  const POOL_DEPTH=8.0;
  function spots(world){
    if(!world || world.id!=='hub') return [];
    return ISLES.filter(k=>k.fall).map(k=>{
      const dir=world.dirOf(k.lon,k.lat);
      const f=world.frameAt(dir, k.spin);
      const lip=dir.clone().multiplyScalar(world.PR + k.alt)
                  .addScaledVector(f.fwd, k.r*0.80)
                  .addScaledVector(f.right, -k.r*0.10);
      return { dir:lip.normalize(), r:k.r*0.86, depth:POOL_DEPTH };
    });
  }

  /* ------------------------------------------------------------- build */
  function build(world){
    W=world;
    clear();
    if(!W || W.id!=='hub') return;            // the sky islands are Wano's
    group=new THREE.Group(); W.group.add(group);

    ISLES.forEach((k,i)=>{
      const dir=W.dirOf(k.lon,k.lat);
      const f=W.frameAt(dir, k.spin);
      const g=new THREE.Group();
      /* Stood the way a building is stood: the island's own up IS the
         planet's normal under it, so walking about on one behaves exactly
         like walking about down below. */
      g.position.copy(dir).multiplyScalar(W.PR + k.alt);
      g.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f.right, f.up, f.fwd));
      group.add(g);

      /* The basin has to be known before the rock is made, because the rock
         is what holds it. The bed is a flat level a little under the crown
         at the lake's own spot. */
      /* SMALL, SHALLOW AND NEAR THE MIDDLE. A wide lake on a domed crown has
         to span a lot of slope: the first one reached two thirds of the way
         to the rim, where the ground has already fallen a metre and a half,
         so one shore was under water and the other was a cliff. Kept inside
         the flat part of the dome it is a lake you can walk round — and a
         metre deep, so walking INTO it is wading rather than drowning. */
      if(k.model){
        const rec={ k, dir, g, f, top:k.alt };
        isles.push(rec);
        if(k.clouds) clouds(g, k, i);
        if(k.fall) makePool(rec);           // the pool is dug already; fill it now
        loadModel(rec);
        return;
      }
      const LAKE = k.lake ? { x:-k.r*0.10, z:0, r:k.r*0.34,
                              bed: crownY(k, 0.10) - k.r*0.042 } : null;
      const rock=new THREE.Mesh(isleGeo(k, i*7+3, LAKE),
        new THREE.MeshLambertMaterial({vertexColors:true}));
      rock.userData.flat=true;                // it lights itself; no self-shadow
      g.add(rock);

      // a scatter of boulders round the crown, so the rim is not a clean arc
      for(let n=0;n<Math.round(k.r/3);n++){
        const a=rnd(i*31+n)*Math.PI*2, rr=k.r*(0.55+rnd(i*57+n)*0.38);
        const s=0.7+rnd(i*91+n)*1.5;
        const bo=new THREE.Mesh(new THREE.IcosahedronGeometry(s,0),
          new THREE.MeshLambertMaterial({color:ROCK[n%ROCK.length]}));
        /* ON THE CROWN, NOT AT ONE HEIGHT ABOVE IT. These sat at a flat
           k.r*0.06 while the ground domes from k.r*0.10 in the middle to
           nothing at the rim — so every boulder near the edge hung a metre
           or two in the air, which from the ground below reads as a cloud of
           rubble orbiting the island. */
        bo.position.set(Math.cos(a)*rr, crownY(k, rr/k.r)-s*0.25, Math.sin(a)*rr);
        bo.rotation.set(rnd(n+1)*3, rnd(n+2)*3, rnd(n+3)*3);
        g.add(bo);
      }
      for(let n=0;n<(k.trees||0);n++){
        const a=rnd(i*13+n*5)*Math.PI*2, rr=k.r*(0.25+rnd(i*17+n)*0.45);
        const tr=tree(0.8+rnd(i*23+n)*0.7);
        tr.position.set(Math.cos(a)*rr, crownY(k, rr/k.r)-0.15, Math.sin(a)*rr);
        g.add(tr);
      }

      const rec={ k, dir, g, f, top:k.alt + k.r*0.10 };
      /* THE ONE ISLAND WITH A DOOR IN IT. Its walls are boxes in the
         island's own frame, tested by blocked() below with the rock — the
         planet's building collision works in a building's frame and this is
         not one of its buildings. */
      if(k.arcade){ rec.boxes=[]; arcade(g, k, rec); }
      if(k.clouds) clouds(g, k, i);
      if(LAKE){
        const surface = LAKE.bed + k.r*0.024;      // held below the shore, or it spills
        const lk=lake(LAKE.r);
        lk.position.set(LAKE.x, surface, LAKE.z);
        g.add(lk);
        rec.lake={ x:LAKE.x, z:LAKE.z, r:LAKE.r, y:surface };
        rec.bed=LAKE.bed;
        stockLake(g, rec.lake, i);
      }
      isles.push(rec);
    });
    return isles.length;
  }

  /* ==================================================== NEON, from outside
     A low hexagonal pavilion in the middle of the apron: dark panels, a
     neon rim top and bottom, and an arch you walk into. What is inside is
     not here — it is a room of its own (neon.js), the way the house and the
     workshop are — so this is a door, a sign, and enough light spilling out
     of it to be worth flying to.

     THE SIGN IS THE POINT. From the ground, at night, the thing that makes
     a child press F is a magenta glow a hundred metres up with a word in
     it. So the marquee is emissive, the rim is emissive, and both of them
     are bright enough to read against Wano's black sky. */
  const NEON_PINK = 0xff2d95, NEON_CYAN = 0x27e8ff, NEON_GOLD = 0xffd766;
  function neonMat(hex, glow){
    const m = new THREE.MeshLambertMaterial({ color:hex });
    m.emissive = new THREE.Color(hex);
    m.emissiveIntensity = glow===undefined ? 1.6 : glow;
    return m;
  }
  /* A word, drawn, on a plate that glows. Not a sprite: the marquee belongs
     to the building and turns with it. */
  function sign(text, w, h, hex){
    const c=document.createElement('canvas');
    c.width=512; c.height=Math.round(512*h/w);
    const x=c.getContext('2d');
    x.fillStyle='#0b0410'; x.fillRect(0,0,c.width,c.height);
    const px=Math.round(c.height*0.62);
    x.font='bold '+px+'px '+uiFont();
    x.textAlign='center'; x.textBaseline='middle';
    x.shadowColor='#'+hex.toString(16).padStart(6,'0'); x.shadowBlur=px*0.55;
    x.fillStyle='#fff';
    x.fillText(text, c.width/2, c.height/2);
    x.fillStyle='#'+hex.toString(16).padStart(6,'0');
    x.globalAlpha=0.75; x.fillText(text, c.width/2, c.height/2);
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true }));
    mesh.userData.flat=true;
    return mesh;
  }
  function arcade(g, k, rec){
    const R = 11;                       // the pavilion's own radius
    const H = 7.2;
    const y0 = crownY(k, 0);            // the crown under the middle of it
    const hall = new THREE.Group();
    hall.position.y = y0;
    g.add(hall);

    /* the apron it stands on: a dark deck with a lit edge, so the island
       reads as somewhere built rather than somewhere landed on */
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(R+7, R+7, 0.5, 6),
      new THREE.MeshLambertMaterial({ color:0x1a1426 }));
    apron.position.y = -0.2;
    apron.rotation.y = Math.PI/6;
    hall.add(apron);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R+7, 0.16, 8, 6),
      neonMat(NEON_CYAN, 2.2));
    ring.rotation.set(Math.PI/2, 0, Math.PI/6);
    ring.position.y = 0.08;
    hall.add(ring);

    /* six walls, with the front one left open as the way in */
    const wall = new THREE.MeshLambertMaterial({ color:0x140d22 });
    for(let i=0;i<6;i++){
      const a = i*Math.PI/3 + Math.PI/6;
      if(i===0) continue;                       // the doorway
      const w = new THREE.Mesh(new THREE.BoxGeometry(R*1.06, H, 0.8), wall);
      w.position.set(Math.sin(a)*R, H/2, Math.cos(a)*R);
      w.rotation.y = a;
      hall.add(w);
      rec.boxes.push(box(w.position.x, w.position.z, R*1.06, 0.8, a, y0, y0+H));
      // a neon tube along the top of each panel, and one along the bottom
      [H-0.4, 0.5].forEach((yy,n)=>{
        const t = new THREE.Mesh(new THREE.BoxGeometry(R*1.0, 0.16, 0.16),
          neonMat(n ? NEON_CYAN : NEON_PINK, 2.0));
        t.position.set(Math.sin(a)*(R-0.5), yy, Math.cos(a)*(R-0.5));
        t.rotation.y = a;
        hall.add(t);
      });
    }
    /* the roof: a shallow hex cap, lifted off the walls on a lit gap */
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R+1.6, R+0.6, 1.4, 6),
      new THREE.MeshLambertMaterial({ color:0x0f0a1a }));
    cap.position.y = H + 0.9;
    cap.rotation.y = Math.PI/6;
    hall.add(cap);
    const capRim = new THREE.Mesh(new THREE.TorusGeometry(R+1.3, 0.2, 8, 6),
      neonMat(NEON_PINK, 2.4));
    capRim.rotation.set(Math.PI/2, 0, Math.PI/6);
    capRim.position.y = H + 0.25;
    hall.add(capRim);

    /* THE DOORWAY. Two lit posts, a lintel, and the sign over it — and the
       door itself is what the crosshair finds (planet.js use('neon')). */
    const front = Math.PI/6;                    // the panel that was skipped
    const fx = Math.sin(front), fz = Math.cos(front);
    [-1,1].forEach(side=>{
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.7), wall);
      const ox = Math.cos(front)*side*3.4, oz = -Math.sin(front)*side*3.4;
      post.position.set(fx*R + ox, H/2, fz*R + oz);
      hall.add(post);
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.2, H-0.6, 0.2),
        neonMat(NEON_CYAN, 2.2));
      tube.position.set(fx*(R-0.45) + ox, H/2, fz*(R-0.45) + oz);
      hall.add(tube);
      // and the walls either side of the arch, so the hex is closed
      const w = new THREE.Mesh(new THREE.BoxGeometry(R*1.06/2 - 3.0, H, 0.8), wall);
      w.position.set(fx*R + ox*1.85, H/2, fz*R + oz*1.85);
      w.rotation.y = front;
      hall.add(w);
      rec.boxes.push(box(w.position.x, w.position.z, R*1.06/2 - 3.0, 0.8, front, y0, y0+H));
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.4, 0.9), wall);
    lintel.position.set(fx*R, H-0.7, fz*R);
    lintel.rotation.y = front;
    hall.add(lintel);

    const marquee = sign('NEON', 7.2, 2.4, NEON_PINK);
    marquee.position.set(fx*(R+0.55), H + 1.9, fz*(R+0.55));
    marquee.rotation.y = front;
    hall.add(marquee);
    const sub = sign('\u25b6 PLAY \u25c0', 5.0, 0.9, NEON_CYAN);
    sub.position.set(fx*(R+0.55), H - 0.7, fz*(R+0.55));
    sub.rotation.y = front;
    hall.add(sub);

    /* the light that spills out of the doorway, and the glow that makes the
       whole island findable from the ground */
    const spill = new THREE.PointLight(NEON_PINK, 2.2, 34, 1.3);
    spill.position.set(fx*(R-1.5), 3, fz*(R-1.5));
    hall.add(spill);
    const halo = new THREE.PointLight(NEON_CYAN, 1.5, 46, 1.4);
    halo.position.set(0, H+2, 0);
    hall.add(halo);

    /* THE DOOR ITSELF: what the crosshair finds and E opens. Invisible —
       the arch is the door, and a pane of glass in it would be a door you
       cannot see through into a room that is not built yet. */
    const door = new THREE.Mesh(new THREE.BoxGeometry(6.6, H-1.4, 0.4),
      new THREE.MeshBasicMaterial({ visible:false }));
    door.position.set(fx*(R-0.1), (H-1.4)/2, fz*(R-0.1));
    door.rotation.y = front;
    hall.add(door);
    const hold = new THREE.Group();
    hold.userData = { kind:'door', label:'NEON \u2014 the arcade', enter:'neon',
                      verb:'E \u2014 go in' };
    door.userData.owner = hold;
    hall.add(hold);
    G.hits.push(door);
    rec.door = door;                            // doorOut() reads where it really is

    /* two pylons on the approach, so the way in reads from the air */
    [-1,1].forEach(side=>{
      const a = front + side*0.42;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 6),
        new THREE.MeshLambertMaterial({ color:0x140d22 }));
      p.position.set(Math.sin(a)*(R+6.4), 3, Math.cos(a)*(R+6.4));
      hall.add(p);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8),
        neonMat(NEON_GOLD, 2.6));
      lamp.position.set(Math.sin(a)*(R+6.4), 6.3, Math.cos(a)*(R+6.4));
      hall.add(lamp);
      rec.boxes.push(box(p.position.x, p.position.z, 1, 1, 0, y0, y0+6));
    });
  }
  /* A box in the island's own frame, from a centre, a size and a turn. */
  function box(x, z, w, d, rot, y1, y2){
    const ca=Math.abs(Math.cos(rot)), sa=Math.abs(Math.sin(rot));
    const ww=w*ca+d*sa, dd=w*sa+d*ca;
    return { x1:x-ww/2, x2:x+ww/2, z1:z-dd/2, z2:z+dd/2, y1, y2 };
  }

  /* ----------------------------------------------------------- the clouds
     A bank of them round the island and a thinner one drifting through it,
     so the arcade sits IN weather rather than on a rock that happens to be
     high up. They are soft round billboards — the cheapest thing that reads
     as cloud — turned to the camera each frame and drifting slowly round.

     NONE OF THEM IS SOLID and none of them casts a shadow: you fly through
     a cloud, and a shadow from one would land on the world a hundred metres
     below and follow you about. */
  let puffTex=null;
  function puff(){
    if(puffTex) return puffTex;
    const c=document.createElement('canvas');
    c.width=c.height=128;
    const x=c.getContext('2d');
    for(let i=0;i<14;i++){
      const px=20+Math.random()*88, py=30+Math.random()*68, r=14+Math.random()*26;
      const gr=x.createRadialGradient(px,py,0,px,py,r);
      gr.addColorStop(0,'rgba(255,255,255,.5)');
      gr.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=gr; x.beginPath(); x.arc(px,py,r,0,7); x.fill();
    }
    puffTex=new THREE.CanvasTexture(c);
    puffTex.colorSpace=THREE.SRGBColorSpace;
    return puffTex;
  }
  function clouds(g, k, seed){
    const bank=new THREE.Group();
    bank.name='clouds';
    g.add(bank);
    const tint=[0xffc8dd, 0xcdb4f6, 0x8fd3ff, 0xffffff];
    for(let i=0;i<34;i++){
      const a=rnd(seed*77+i)*Math.PI*2;
      const rr=k.r*(0.85+rnd(seed*31+i)*0.75);
      const yy=-k.r*(0.10+rnd(seed*13+i)*0.55);
      const s=k.r*(0.34+rnd(seed*53+i)*0.5);
      const m=new THREE.Sprite(new THREE.SpriteMaterial({
        map:puff(), transparent:true, depthWrite:false,
        color:tint[i%tint.length], opacity:0.34+rnd(seed*19+i)*0.3 }));
      m.scale.set(s*2.2, s, 1);
      m.position.set(Math.cos(a)*rr, yy, Math.sin(a)*rr);
      m.userData.a=a; m.userData.rr=rr; m.userData.spin=0.02+rnd(seed*7+i)*0.05;
      m.userData.sky=true;              // no shadows either way
      bank.add(m);
    }
    return bank;
  }

  /* ------------------------------------------------------ a modelled isle
     Every triangle of the Blender scene, not a cut-down copy. Scaled so
     its widest reach is the island's radius, and lowered so the middle of
     its meadow sits at k.alt — the same place the lathe's rim
     would be. Until it arrives the island is simply not there: no rock to
     see, and no floor or wall to meet. */
  let loader=null;
  function loadModel(rec){
    const k=rec.k, myGroup=group;
    if(!loader){
      loader=new THREE.GLTFLoader();
      /* the model is meshopt-packed: a quarter-million triangles is 20 MB
         as it leaves Blender and under 10 once packed */
      if(window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
    }
    /* KEPT ONCE LOADED, so building Wano again — walking out of NEON is
       the case — puts the island back in the same frame, not a moment later
       with you already fallen through where it should have been. */
    if(models[k.model]){ place(models[k.model].clone(true)); return; }
    loader.load(k.model+'?v='+(window.ASSETV||'1'), gl=>{
      models[k.model]=gl.scene;
      if(group!==myGroup) return;             // the world was rebuilt meanwhile
      place(gl.scene.clone(true));
    });
    function place(scene){
      let root=scene;
      let field=null;
      root.traverse(o=>{
        if(o.userData && o.userData.field) field=JSON.parse(o.userData.field);
        if(!o.isMesh) return;
        /* Rock and wood arrive with their Blender materials baked into a
           colour map and a normal map; leaves and grass carry theirs in the
           vertices. Lambert either way, so it is lit like the rest of Wano. */
        const src=o.material, thin=/leaves|grass/.test(o.name);
        /* THE ARCADE LIGHTS ITSELF: its own colours are its glow, so the
           neon on every eave and the lit windows read at night the way the
           reference picture has them, rather than as dark red paint. */
        o.material = src.map
          ? new THREE.MeshLambertMaterial({ map:src.map, normalMap:src.normalMap||null,
              emissive: k.arcade ? 0xffffff : 0x000000,
              emissiveMap: k.arcade ? src.map : null,
              emissiveIntensity: k.arcade ? 0.42 : 0 })
          : new THREE.MeshLambertMaterial({ vertexColors:true,
              side: thin ? THREE.DoubleSide : THREE.FrontSide });
        o.userData.flat=true;
      });
      /* A MODEL WITH NO GRID OF ITS OWN — the Higgsfield ones — is centred,
         turned to face the way the table says, and has its grid made here
         from its own triangles. */
      if(!field){
        const box=new THREE.Box3().setFromObject(root), c=box.getCenter(new THREE.Vector3());
        const inner=new THREE.Group(); inner.rotation.y=k.yaw||0;
        root.position.set(-c.x, -box.min.y, -c.z);
        inner.add(root);
        root=new THREE.Group(); root.add(inner);
        field=fieldFromMesh(root, 72);
      }
      if(!field) return;
      const tops=field.top.filter(v=>v!==null).sort((a,b)=>a-b);
      let deck=tops[Math.floor(tops.length/2)];
      /* A BUILDING COVERS HALF THE ISLAND, so the median surface is part way
         up its roofs. There the deck is the commonest height instead — the
         flat top of the rock, which is most of what is not pagoda. */
      if(k.arcade){
        const bin=field.cell*0.5, count=new Map();
        tops.forEach(v=>{ const b=Math.round(v/bin); count.set(b,(count.get(b)||0)+1); });
        let best=0, n=0; count.forEach((c,b)=>{ if(c>n){ n=c; best=b; } });
        deck=best*bin;
      }
      let reach=0;
      field.top.forEach((v,n)=>{
        if(v===null) return;
        const x=field.x0+(n%field.nx)*field.cell, z=field.z0+Math.floor(n/field.nx)*field.cell;
        reach=Math.max(reach, Math.hypot(x,z));
      });
      const s=k.r/Math.max(1, reach);
      root.scale.setScalar(s);
      root.position.y=-deck*s;
      rec.g.add(root);
      rec.field=field; rec.s=s; rec.deck=deck;
      rec.top=k.alt+(tops[tops.length-1]-deck)*s;
      if(k.fall) pourFrom(rec);
      if(k.arcade) placeDoor(rec, root);
    }
  }
  const models={};

  /* THE DOOR OF A MODELLED ARCADE. Walk out from the middle along doorYaw
     until the height grid drops to the deck: that is the foot of the
     pagoda's wall, and the door goes just outside it. Invisible — the
     model is the door you see; this is the thing the crosshair finds. */
  function placeDoor(rec, root){
    const k=rec.k, F=rec.field, s=rec.s, a=k.doorYaw||0;
    const dx=Math.sin(a), dz=Math.cos(a);
    const topAt=(x,z)=>{
      const i=Math.round((x/s-F.x0)/F.cell), j=Math.round((z/s-F.z0)/F.cell);
      if(i<0||j<0||i>=F.nx||j>=F.nz) return null;
      const v=F.top[j*F.nx+i]; return v===null ? null : (v-rec.deck)*s;
    };
    /* NOT FROM THE HEIGHT GRID, which keeps the highest surface over each
       spot and so sees the eaves, not the wall under them. A ray at head
       height, from outside the rock in toward the middle, meets the wall. */
    let wall=k.r*0.3;
    rec.g.updateMatrixWorld(true);
    const from=rec.g.localToWorld(new THREE.Vector3(dx*k.r*1.3, 1.6, dz*k.r*1.3));
    const to=rec.g.localToWorld(new THREE.Vector3(0, 1.6, 0));
    const ray=new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, k.r*1.3);
    const hit=ray.intersectObject(root, true)[0];
    if(hit) wall=Math.max(2, k.r*1.3 - hit.distance);
    const H=5.5;
    const door=new THREE.Mesh(new THREE.BoxGeometry(6, H, 1.2),
      new THREE.MeshBasicMaterial({ visible:false }));
    door.position.set(dx*(wall+0.8), topAt(dx*(wall+1.5), dz*(wall+1.5))+H/2 || H/2, dz*(wall+0.8));
    door.rotation.y=a;
    const hold=new THREE.Group();
    hold.userData={ kind:'door', label:'NEON \u2014 the arcade', enter:'neon', verb:'E \u2014 go in' };
    door.userData.owner=hold;
    rec.g.add(door); rec.g.add(hold);
    G.hits.push(door);
    rec.door=door;
    /* and the glow the whole thing sits in: pink up from under the rock
       onto the clouds round it, and a warm light high on the tiers */
    const under=new THREE.PointLight(0xff2f7a, 260, 90, 1.4);
    under.position.set(0, -18, 0); rec.g.add(under);
    const crown=new THREE.PointLight(0xff5a8a, 120, 60, 1.6);
    crown.position.set(0, 30, 6); rec.g.add(crown);
    // a warm pink spill at the doorway, so the way in reads from the air
    const glow=new THREE.PointLight(0xff3f8a, 40, 30, 1.5);
    glow.position.set(dx*(wall+3), door.position.y+2, dz*(wall+3));
    rec.g.add(glow);
  }
  /* THE GROUND OF A MODEL, FROM ITS TRIANGLES. Every triangle is laid flat
     onto an n-by-n grid over its footprint, and each grid point keeps the
     highest surface above it (the deck, a roof, a canopy) and the lowest
     (the underside). That is the same {top, bot} grid the Blender island
     bakes, made in a few milliseconds — rasterising forty thousand
     triangles is cheap where casting ten thousand rays at them is not. */
  function fieldFromMesh(root, n){
    root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(root);
    const span=Math.max(box.max.x-box.min.x, box.max.z-box.min.z);
    const cell=span/(n-1), nx=Math.ceil((box.max.x-box.min.x)/cell)+2,
          nz=Math.ceil((box.max.z-box.min.z)/cell)+2;
    const x0=box.min.x-cell*0.5, z0=box.min.z-cell*0.5;
    const top=new Array(nx*nz).fill(null), bot=new Array(nx*nz).fill(null);
    const a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3();
    root.traverse(o=>{
      if(!o.isMesh) return;
      const P=o.geometry.attributes.position, I=o.geometry.index, M=o.matrixWorld;
      const tri=I ? I.count/3 : P.count/3;
      for(let t=0;t<tri;t++){
        const ia=I?I.getX(t*3):t*3, ib=I?I.getX(t*3+1):t*3+1, ic=I?I.getX(t*3+2):t*3+2;
        a.fromBufferAttribute(P,ia).applyMatrix4(M);
        b.fromBufferAttribute(P,ib).applyMatrix4(M);
        c.fromBufferAttribute(P,ic).applyMatrix4(M);
        const det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
        if(Math.abs(det)<1e-12) continue;            // edge-on: a wall has no top
        const i0=Math.max(0,Math.ceil((Math.min(a.x,b.x,c.x)-x0)/cell)),
              i1=Math.min(nx-1,Math.floor((Math.max(a.x,b.x,c.x)-x0)/cell)),
              j0=Math.max(0,Math.ceil((Math.min(a.z,b.z,c.z)-z0)/cell)),
              j1=Math.min(nz-1,Math.floor((Math.max(a.z,b.z,c.z)-z0)/cell));
        for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
          const x=x0+i*cell, z=z0+j*cell;
          const l1=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/det;
          const l2=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/det;
          const l3=1-l1-l2;
          if(l1<-1e-6||l2<-1e-6||l3<-1e-6) continue;
          const y=l1*a.y+l2*b.y+l3*c.y, q=j*nx+i;
          if(top[q]===null || y>top[q]) top[q]=y;
          if(bot[q]===null || y<bot[q]) bot[q]=y;
        }
      }
    });
    return { x0, z0, cell, nx, nz, top, bot };
  }

  /* WHERE THE WATER LEAVES. Walk out from the middle of the island toward
     the pool until the rock runs out: that is the rim, and the lip is just
     over it, a little under the grass. Walking back in from there, while the
     ground stays ground (a tree or the shrine is a jump the stream will not
     make), is the stream's bed. */
  function pourFrom(rec){
    const P=rec.pool; if(!P) return;
    rec.g.updateWorldMatrix(true, true); P.g.updateWorldMatrix(true, false);
    const F=rec.field, s=rec.s;
    const topAt=(x,z)=>{
      const i=Math.round((x/s - F.x0)/F.cell), j=Math.round((z/s - F.z0)/F.cell);
      if(i<0||j<0||i>=F.nx||j>=F.nz) return null;
      const v=F.top[j*F.nx+i];
      return v===null ? null : (v-rec.deck)*s;
    };
    const aim=rec.g.worldToLocal(P.g.position.clone()); aim.y=0;
    const hd=aim.lengthSq()>1e-6 ? aim.normalize() : new THREE.Vector3(0,0,1);
    let rim=0;
    for(let r=0;r<rec.k.r*1.6;r+=0.5){ if(topAt(hd.x*r, hd.z*r)!==null) rim=r; }
    const lipY=(topAt(hd.x*(rim-1.5), hd.z*(rim-1.5)) ?? 0) - 0.25;
    const lipI=new THREE.Vector3(hd.x*(rim+0.4), lipY, hd.z*(rim+0.4));

    const bed=[];
    let last=lipY;
    for(let r=rim-0.5;r>Math.max(2, rim-16);r-=1){
      const y=topAt(hd.x*r, hd.z*r);
      if(y===null || Math.abs(y-last)>0.9) break;
      bed.push(new THREE.Vector3(hd.x*r, y+0.14, hd.z*r)); last=y;
    }
    bed.reverse(); bed.push(new THREE.Vector3(hd.x*(rim+0.4), lipY+0.14, hd.z*(rim+0.4)));
    const toPool=v=>P.g.worldToLocal(rec.g.localToWorld(v.clone()));
    makeFall(rec, toPool(lipI), bed.length>3 ? bed.map(toPool) : null);
  }

  /* The grid under a point on a modelled isle: the deck there and the
     underside, or null off the rock. Smooth between cells on a slope, but
     a cell whose corners disagree by more than a metre is a CLIFF and
     answers with its nearest corner — interpolated, a cliff becomes a ramp
     you can walk up a few centimetres a frame. */
  function fieldAt(is, dir){
    const F=is.field, k=is.k, R=W.PR+k.alt;
    if(dir.dot(is.dir)<=0) return null;
    const v=dir.clone().multiplyScalar(R).sub(is.dir.clone().multiplyScalar(R));
    const gx=(v.dot(is.f.right)/is.s - F.x0)/F.cell, gz=(v.dot(is.f.fwd)/is.s - F.z0)/F.cell;
    const i=Math.floor(gx), j=Math.floor(gz);
    if(i<0 || j<0 || i>=F.nx-1 || j>=F.nz-1) return null;
    const at=(a,b)=>F.top[b*F.nx+a];
    const ni=gx-i>0.5 ? i+1 : i, nj=gz-j>0.5 ? j+1 : j;
    const near=at(ni,nj);
    if(near===null) return null;
    const c=[at(i,j),at(i+1,j),at(i,j+1),at(i+1,j+1)];
    let top=near;
    if(c.every(x=>x!==null) && (Math.max(...c)-Math.min(...c))*is.s <= 1){
      const u=gx-i, t=gz-j;
      top=(c[0]*(1-u)+c[1]*u)*(1-t)+(c[2]*(1-u)+c[3]*u)*t;
    }
    const w=y=>k.alt+(y-is.deck)*is.s;
    return { top:w(top), bot:w(F.bot[nj*F.nx+ni]) };
  }

  /* Fish in the lake, turtles round its edge. */
  function stockLake(g, lk, seed){
    const TINT=[0xffa94d, 0xff6b6b, 0xffd93d, 0x74c0fc, 0xb197fc];
    for(let i=0;i<14;i++){
      const m=fishModel(TINT[i%TINT.length]);
      g.add(m);
      const f={ m, cx:lk.x, cz:lk.z, y:lk.y, rad:lk.r,
                x:0, z:0, a:rnd(seed*60+i)*Math.PI*2,
                spd:1.3+rnd(seed*80+i)*1.5, bob:rnd(seed*70+i)*6,
                tx:0, tz:0 };
      aim(f, 0.92);
      // start them spread out rather than all in the middle
      const sa=rnd(seed*61+i)*Math.PI*2, sr=lk.r*0.85*rnd(seed*62+i);
      f.x=Math.cos(sa)*sr; f.z=Math.sin(sa)*sr;
      fish.push(f);
    }
    for(let i=0;i<4;i++){
      const m=turtleModel();
      g.add(m);
      /* The turtles live in a band round the water's edge — half in the
         shallows, half on the grass — because that is where a turtle is. */
      const tt={ m, cx:lk.x, cz:lk.z, y:lk.y, rad:lk.r,
                 x:0, z:0, a:rnd(seed*44+i)*Math.PI*2,
                 spd:0.55+rnd(seed*55+i)*0.35, step:0,
                 rest:rnd(seed*45+i)*5, bob:rnd(seed*46+i)*6, tx:0, tz:0 };
      aim(tt, 1.16);
      const sa=rnd(seed*47+i)*Math.PI*2, sr=lk.r*(0.85+rnd(seed*48+i)*0.3);
      tt.x=Math.cos(sa)*sr; tt.z=Math.sin(sa)*sr;
      turtles.push(tt);
    }
  }

  /* ---------------------------------------------------------- the fall
     WATER THAT OBEYS GRAVITY. The first falls were four flat trapezoids
     hung straight down from a curl of cylinder floating off the rim, with a
     texture sliding down them at one speed. Nothing about that is falling:
     the sheet started in mid-air, dropped like a curtain rather than
     arcing, and the streaks moved at the same pace at the bottom as at the
     top — the thing every waterfall in the world does not do.

     So it is worked out now, not drawn. The water leaves the lip moving
     OUTWARD at whatever speed carries it to the middle of the pool, and
     from there it is a projectile:

         p(t) = lip + v·t − ½·g·t²·up

     The sheet is a ribbon along that arc, parameterised by TIME since
     leaving the lip rather than by distance. That one choice does the rest:
     the streak pattern scrolls at one second per second in t, so every
     streak rides with the water that carries it — slow and bunched at the
     lip, stretched and fast at the bottom, exactly as falling water is.
     The droplets, the splash and the mist are the same equation run on the
     graphics card, one seed per particle and no work per frame at all.

     Built in two halves. The POOL and the river do not depend on the rock
     and go down with the world; the COLUMN needs to know where the lip is,
     which is where the modelled island's rim turns out to be, so it waits
     for the model. */
  const GRAV=9.8;
  const NOISE=`
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
    float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`;
  /* Fog is joined in by hand: a ShaderMaterial is outside three's lighting
     and fog unless it asks, and white water with no fog on it glows through
     the haze from the other side of the planet. */
  function waterMat(frag, extra, opts){
    const o=opts||{};
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog,
                  Object.assign({ uT:{value:0} }, extra||{})]),
      vertexShader:`
        varying vec2 vUv; varying vec3 vP;
        #include <fog_pars_vertex>
        void main(){
          vUv=uv; vP=position;
          vec4 mvPosition=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`
        uniform float uT; varying vec2 vUv; varying vec3 vP;
        ${o.decl||''}
        #include <fog_pars_fragment>
        ${NOISE}
        void main(){
          ${frag}
          #include <fog_fragment>
        }`,
      transparent:true, depthWrite:false, side:THREE.DoubleSide, fog:true
    });
  }

  /* THE SHEET. u runs across it, v is SECONDS SINCE THE LIP. Coherent and
     glassy where it leaves, torn into ropes and holes further down, with
     ragged edges — which is the whole silhouette of a tall fall. */
  function sheetMat(seed, alpha, tf){
    return waterMat(`
      float t=vUv.y, k=clamp(t/uTf,0.,1.), u=vUv.x;
      float along=(t-uT)*2.4;                       // rides with the water
      float rope=fbm(vec2(u*7.+uSeed, along));
      float fine=vn(vec2(u*31.+uSeed*3., (t-uT)*9.));
      float frayed=u*(1.-u)*4.;                     // 1 in the middle, 0 at the edges
      float edge=smoothstep(0., .35+.35*k, frayed*(.55+.9*rope));
      float holes=mix(1., smoothstep(.28, .62, rope+fine*.25), .25+.6*k);
      float a=uA*edge*holes*mix(1., .75, k);
      vec3 col=mix(vec3(.58,.78,.9), vec3(.97,.99,1.), clamp(rope*.9+fine*.45+k*.35,0.,1.));
      gl_FragColor=vec4(col*uLight, a);`,
      { uSeed:{value:seed}, uA:{value:alpha}, uTf:{value:tf}, uLight:{value:0.9} },
      { decl:'uniform float uSeed, uA, uTf, uLight;' });
  }
  function arcRibbon(lip, vel, side, tf, w0, grow, lift, N){
    const pos=[], uv=[], idx=[];
    for(let i=0;i<=N;i++){
      /* Denser near the lip, where the arc is bending hardest. */
      const s=i/N, t=tf*s*s*0.35 + tf*s*0.65;
      const c=lip.clone().addScaledVector(vel, t);
      c.y += -0.5*GRAV*t*t + lift;
      const w=(w0 + grow*t)*0.5;
      pos.push(c.x-side.x*w, c.y, c.z-side.z*w,  c.x+side.x*w, c.y, c.z+side.z*w);
      uv.push(0,t, 1,t);
      if(i<N){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
    }
    const gm=new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    gm.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
    gm.setIndex(idx);
    return gm;
  }

  /* PARTICLES ON THE GRAPHICS CARD. Each point carries four random numbers
     and nothing else; its position is the projectile equation evaluated at
     its own age, which is the time modulo its own lifetime. So a thousand
     drops cost exactly what one does on the CPU: nothing. Three kinds share
     the program — drops off the lip, splash out of the pool, mist rising. */
  function particles(n, mode, u){
    const seed=new Float32Array(n*4);
    for(let i=0;i<n*4;i++) seed[i]=Math.random();
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3),3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed,4));
    const m=new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uT:{value:0}, uMode:{value:mode}, uLip:{value:u.lip||new THREE.Vector3()},
        uVel:{value:u.vel||new THREE.Vector3()}, uSide:{value:u.side||new THREE.Vector3(1,0,0)},
        uTf:{value:u.tf||1}, uHit:{value:u.hit||new THREE.Vector3()}, uSurf:{value:u.surf||0},
        uW:{value:u.w||1}, uSize:{value:u.size||1}, uA:{value:u.alpha||1} }]),
      vertexShader:`
        attribute vec4 aSeed;
        uniform float uT, uMode, uTf, uSurf, uW, uSize;
        uniform vec3 uLip, uVel, uSide, uHit;
        varying float vA;
        #include <fog_pars_vertex>
        const float G=${GRAV.toFixed(1)};
        void main(){
          vec3 p; float size=uSize; vA=1.;
          if(uMode<0.5){                       // DROPS off the lip, down the arc
            float life=uTf*(1.+.12*aSeed.w);
            float age=fract(uT/life+aSeed.x)*life;
            vec3 v=uVel*(.8+.4*aSeed.z) + uSide*(aSeed.w-.5)*1.6 + vec3(0.,(aSeed.z-.5)*1.2,0.);
            p=uLip + uSide*(aSeed.y-.5)*uW + v*age + vec3(0.,-.5*G*age*age,0.);
            vA=smoothstep(0.,.25,age)*step(uSurf,p.y);
            size*= .6+.8*aSeed.y;
          } else if(uMode<1.5){                // SPLASH thrown up where it lands
            float life=.7+1.1*aSeed.w;
            float age=fract(uT/life+aSeed.x)*life;
            float a=aSeed.y*6.2832;
            vec3 out3=vec3(cos(a),0.,sin(a));
            float hs=1.2+4.5*aSeed.z*aSeed.z, vy=3.5+8.*aSeed.w;
            p=uHit + out3*(aSeed.z*uW*.5) + out3*hs*age + vec3(0.,vy*age-.5*G*age*age,0.);
            vA=(1.-age/life)*step(uSurf-.2,p.y);
            size*= .5+1.1*aSeed.z;
          } else {                             // MIST, drifting up and out
            float life=4.+3.*aSeed.w;
            float age=fract(uT/life+aSeed.x)*life;
            float a=aSeed.y*6.2832;
            vec3 out3=vec3(cos(a),0.,sin(a));
            p=uHit + out3*(1.+aSeed.z*uW) + out3*age*(.8+aSeed.z) + vec3(0.,age*(1.+1.4*aSeed.w),0.);
            vA=sin(3.1416*age/life);
            size*= (.6+age/life*1.6)*(.7+.6*aSeed.z);
          }
          vec4 mvPosition=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mvPosition;
          gl_PointSize=size*(420./max(1.,-mvPosition.z));
          #include <fog_vertex>
        }`,
      fragmentShader:`
        uniform float uA; varying float vA;
        #include <fog_pars_fragment>
        void main(){
          float d=length(gl_PointCoord-.5);
          float a=smoothstep(.5,0.,d)*vA*uA;
          if(a<.01) discard;
          gl_FragColor=vec4(vec3(.93,.97,1.),a);
          #include <fog_fragment>
        }`,
      transparent:true, depthWrite:false, fog:true });
    const pts=new THREE.Points(g, m);
    pts.frustumCulled=false;                      // the positions are made on the card
    pts.userData.sky=true;
    return pts;
  }

  /* THE POOL. There is no other water on Wano, so this is the only place
     a fish could be — which is the right way round: the waterfall is why
     the pool is here, and the pool is why the fish are. */
  function makePool(rec){
    const k=rec.k;
    const f=W.frameAt(rec.dir, k.spin);
    const lip = rec.dir.clone().multiplyScalar(W.PR + k.alt)
                  .addScaledVector(f.fwd, k.r*0.80)
                  .addScaledVector(f.right, -k.r*0.10);
    const base = lip.clone().normalize();
    /* THE GROUND UNDER THE WATER, NOT UNDER THE ISLAND. Wano is not flat,
       and measuring from the terrain under the island's middle put the
       whole pool several metres out of the hillside it is sunk into. */
    const groundY = W.terrainH(base);
    const g=new THREE.Group(); group.add(g);
    g.position.copy(base.clone().multiplyScalar(W.PR + groundY));
    const bf=W.frameAt(base, k.spin);
    g.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(bf.right, bf.up, bf.fwd));

    const pr=k.r*0.72;
    /* THE WATER STANDS AT THE RIM, LESS A LITTLE — and the rim is the
       LOWEST ground planet.js found walking round the edge of the basin.
       Referenced to the middle instead, on a rise the lake stood proud of
       the field with daylight under it. */
    const rimY = (W.basinRim && W.basinRim(base));
    const surfY = (rimY===null || rimY===undefined)
                ? POOL_DEPTH-0.55
                : (rimY - 0.45) - groundY;
    /* A CAP, NOT A DISC, because the planet is a ball: every vertex at one
       ALTITUDE, which is what level means on a sphere, reaching a little
       past the waterline so there is no seam at the bank. */
    const R0=W.PR+groundY;
    const wgeo=new THREE.RingGeometry(0.001, pr*1.10, 72, 14);
    wgeo.rotateX(-Math.PI/2);
    const wp=wgeo.attributes.position;
    for(let i=0;i<wp.count;i++){
      const d=Math.hypot(wp.getX(i), wp.getZ(i));
      wp.setY(i, Math.sqrt(Math.max(0,(R0+surfY)*(R0+surfY) - d*d)) - R0);
    }
    /* Deep in the middle, clearer over the shelf, rings running out from
       where the column hits, and white water churned up round the impact.
       The hit point moves in once the column knows where it lands. */
    const poolMat=waterMat(`
      vec2 q=vP.xz-uHit;
      float r=length(q);
      float ring=sin(r*1.35-uT*4.2)*exp(-r*.07);
      float n=fbm(vP.xz*.22+vec2(uT*.05,-uT*.04));
      float chop=fbm(vP.xz*1.1+vec2(uT*.4,uT*.3));
      float foamN=fbm(q*.8+normalize(q+1e-4)*(-uT*1.6));
      float foam=smoothstep(uFoam,uFoam*.25,r)*smoothstep(.32,.62,foamN+.18*ring);
      foam=max(foam, smoothstep(uFoam*.4,0.,r)*(.75+.25*foamN));   // solid white under the column
      float shelf=smoothstep(uR*.45,uR*1.02,length(vP.xz));
      vec3 col=mix(vec3(.05,.22,.34), vec3(.16,.47,.56), shelf*.7+n*.35);
      col+=vec3(.20,.28,.30)*max(0.,ring)*smoothstep(uR,0.,r)*.55;
      col+=vec3(.06)*smoothstep(.55,.8,chop);
      col=mix(col, vec3(.9,.96,1.), clamp(foam,0.,1.));
      gl_FragColor=vec4(col, mix(.86,.97,foam));`,
      { uR:{value:pr}, uHit:{value:new THREE.Vector2(0,0)}, uFoam:{value:k.r*0.22} },
      { decl:'uniform float uR, uFoam; uniform vec2 uHit;' });
    poolMat.depthWrite=true; poolMat.side=THREE.FrontSide;
    const water=new THREE.Mesh(wgeo, poolMat);
    water.userData.flat=true;
    g.add(water);

    /* The rim is open on the downstream side, or the river would be running
       out through a wall of boulders. */
    for(let i=0;i<22;i++){
      const a=i/22*Math.PI*2;
      if(Math.cos(a)>0.72) continue;
      const sz=0.55+rnd(i*7)*1.1;
      const bo=new THREE.Mesh(new THREE.DodecahedronGeometry(sz,1),
        new THREE.MeshLambertMaterial({color:ROCK[i%ROCK.length]}));
      const br=pr*(1.0+rnd(i*5)*0.05);
      bo.scale.set(1, 0.55+rnd(i*3)*0.3, 1.1);
      bo.position.set(Math.cos(a)*br,
        Math.sqrt(Math.max(0,(R0+surfY)*(R0+surfY) - br*br)) - R0 - sz*0.25,
        Math.sin(a)*br);
      bo.rotation.set(rnd(i)*3, rnd(i+9)*3, rnd(i+4)*3);
      g.add(bo);
    }

    stockLake(g, { x:0, z:0, r:pr, y:surfY }, 900);
    rec.pool={ g, R0, surfY, groundY, base, pr, mat:poolMat };
    fall={ poolMat, parts:[], sheets:[], stream:null };
    pool={ dir:base, y:groundY, r:pr, surface:groundY+surfY };
    river(base, groundY+surfY, pr);
  }

  /* THE COLUMN, once the rock is there to pour it off. `lip` is where the
     island's rim actually is in the direction of the pool, in the pool's
     own frame; everything from there down is the projectile. */
  function makeFall(rec, lipLocal, streamPts){
    const P=rec.pool; if(!P) return;
    const g=P.g, surf=P.surfY;
    const lip=lipLocal.clone();
    const H=Math.max(4, lip.y - surf);
    const tf=Math.sqrt(2*H/GRAV);
    /* AIM FOR THE MIDDLE OF THE POOL. The horizontal speed is whatever
       carries the water from the lip to the centre in the time it takes to
       fall — so wherever the rim turns out to be, the water lands in the
       water. NEVER SLOWER THAN 3.2 m/s, though: this rock bulges out under
       its rim, and water that merely dribbled over the edge ran down behind
       the bulge and came out below it as a second, disconnected waterfall.
       A stream in spate clears its own cliff. That can carry it past the
       middle by ten metres or so, which a pool twenty-four across absorbs. */
    const out=lip.clone().sub(rec.pool.g.worldToLocal(rec.g.localToWorld(new THREE.Vector3())));
    const flat=new THREE.Vector3(-lip.x, 0, -lip.z);
    let dist=flat.length();
    /* Away from the island, not merely toward the pool's middle: if the lip
       is already past the centre, "toward the centre" is back into the rock. */
    const away=new THREE.Vector3(out.x, 0, out.z).normalize();
    let dirH = dist>0.01 ? flat.divideScalar(dist) : away.clone();
    if(dirH.dot(away)<0.2){ dirH=away.clone(); dist=0; }
    const speed=Math.min(9, Math.max(3.2, dist/tf));
    const vel=dirH.clone().multiplyScalar(speed);
    const side=new THREE.Vector3(-dirH.z, 0, dirH.x);
    const W0=3.6, GROW=1.9;                  // metres wide at the lip, and per second of fall
    const hit=lip.clone().addScaledVector(vel, tf); hit.y=surf;

    /* Three sheets: a bright core and two looser, wider veils, each with its
       own seed so their ropes do not line up — and the veils TURNED thirty
       degrees either way about the vertical. All three square to the flow,
       the falls seen from the side were a line drawn down the sky: a ribbon
       edge-on has no width at all. Crossed, the column has body from
       wherever you look at it. */
    [[0, 0.95, 1.00, 0.00, 0], [1, 0.55, 1.35, 0.35, 0.52], [2, 0.42, 1.6, -0.35, -0.52]].forEach(([i, a, wk, off, turn])=>{
      const m=sheetMat(i*7.3+1.1, a, tf);
      const sd=side.clone().applyAxisAngle(new THREE.Vector3(0,1,0), turn);
      const gm=arcRibbon(lip.clone().addScaledVector(dirH, off), vel, sd, tf,
                         W0*wk, GROW*wk, 0, 64);
      const sh=new THREE.Mesh(gm, m);
      sh.frustumCulled=false; sh.userData.sky=true; sh.renderOrder=2;
      g.add(sh);
      fall.sheets.push(m);
    });

    const common={ lip, vel, side, tf, hit, surf, w:W0 };
    const drops =particles(700, 0, Object.assign({ size:0.30, alpha:0.85 }, common));
    const splash=particles(900, 1, Object.assign({ size:0.55, alpha:0.75, w:W0+GROW*tf }, common));
    const mist  =particles(140, 2, Object.assign({ size:5.5,  alpha:0.20, w:W0+GROW*tf }, common));
    [drops, splash, mist].forEach(p=>{ g.add(p); fall.parts.push(p.material); });

    fall.poolMat.uniforms.uHit.value.set(hit.x, hit.z);

    /* THE STREAM ON THE ISLAND, from a spring on the meadow to the lip —
       the lake is visibly LEAVING, which is the sentence that joins the
       rock to the column under it. */
    if(streamPts && streamPts.length>1){
      const pos=[], uv=[], idx=[];
      let run=0;
      for(let i=0;i<streamPts.length;i++){
        const p=streamPts[i], nx=streamPts[Math.min(streamPts.length-1,i+1)],
              pv=streamPts[Math.max(0,i-1)];
        const tan=nx.clone().sub(pv); tan.y=0; tan.normalize();
        const sd=new THREE.Vector3(-tan.z,0,tan.x);
        const w=(1.2 + 2.4*(i/(streamPts.length-1)))*0.5;
        if(i) run+=p.distanceTo(streamPts[i-1]);
        pos.push(p.x-sd.x*w, p.y, p.z-sd.z*w, p.x+sd.x*w, p.y, p.z+sd.z*w);
        uv.push(0,run/6, 1,run/6);
        if(i<streamPts.length-1){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
      }
      const gm=new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      gm.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
      gm.setIndex(idx);
      const sm=new THREE.Mesh(gm, flowMat(1.6));
      sm.userData.flat=true; sm.renderOrder=1;
      g.add(sm);
      fall.stream=sm.material;
    }

    /* WHAT THE PLAYER MEETS: the arc in world space, so planet.js can ask
       whether somebody is standing — or flying — in the water. */
    const toW=v=>g.localToWorld(v.clone());
    g.updateMatrixWorld(true);
    const upW=g.position.clone().normalize();
    fall.hitW=toW(hit);
    fall.col={ lipW:toW(lip), velW:toW(lip.clone().add(vel)).sub(toW(lip)),
               sideW:toW(lip.clone().add(side)).sub(toW(lip)), upW, H, tf,
               w0:W0, grow:GROW, hitW:fall.hitW, surfW:P.R0+surf };
  }

  /* FLOWING WATER on a ribbon whose v is metres downstream: bands of foam
     and glints carried along at `speed`, white at the banks. The river and
     the stream on the island are both this. */
  function flowMat(speed){
    return waterMat(`
      float u=vUv.x, v=vUv.y;
      float flow=fbm(vec2(u*3.2, v*2.4-uT*uS));
      float glint=vn(vec2(u*14., v*9.-uT*uS*2.2));
      float bank=1.-smoothstep(0.,.16,u)*smoothstep(1.,.84,u);
      vec3 col=mix(vec3(.10,.36,.52), vec3(.22,.58,.70), flow);
      col=mix(col, vec3(.88,.95,1.), clamp(smoothstep(.62,.9,flow)*.6+bank*.55*flow+smoothstep(.8,.97,glint)*.5,0.,1.));
      gl_FragColor=vec4(col,.9);`,
      { uS:{value:speed} }, { decl:'uniform float uS;' });
  }

  /* IS THIS POINT IN THE FALLING WATER? For a point in world space: how
     hard the water is pushing on it (0 to 1) and which way is out of it.
     The column at a given depth below the lip is where the projectile was
     when it had fallen that far — t = sqrt(2d/g) — and its width is the
     sheet's at that t. */
  function fallPush(p){
    const C=fall && fall.col; if(!C) return null;
    const rel=p.clone().sub(C.lipW);
    const d=-rel.dot(C.upW);                      // metres below the lip
    if(d < -1 || d > C.H+1) return null;
    const t=Math.sqrt(2*Math.max(0,d)/GRAV);
    const centre=C.velW.clone().multiplyScalar(t).addScaledVector(C.upW, -d);
    const off=rel.sub(centre); off.addScaledVector(C.upW, -off.dot(C.upW));
    const half=(C.w0 + C.grow*t)*0.5*1.35;       // the veils reach wider than the core
    const across=Math.abs(off.dot(C.sideW)), thru=Math.abs(off.dot(C.velW.clone().normalize()));
    if(across > half+0.8 || thru > 2.2) return null;
    const s=(1-Math.min(1, across/(half+0.8)))*(1-Math.min(1,thru/2.2));
    const out = off.lengthSq()>1e-4 ? off.normalize() : C.sideW.clone();
    return { s, out, down:C.upW.clone().negate() };
  }

  /* ------------------------------------------------------------ the river
     WATER THAT ARRIVES HAS TO GO SOMEWHERE. A waterfall ending in a round
     pool is a bath: the whole point of sixty metres of falling water is that
     it is going somewhere, and a pool with no outflow quietly says it is not.

     So the river finds its own way, the way a river does — STEEPEST DESCENT
     over the terrain that is already there. At each step it looks at a fan
     of directions ahead, samples the real terrainH() at each, and takes the
     lowest; the heading is eased rather than snapped, so the course bends
     instead of zig-zagging one sample at a time. Nothing is carved: the
     ribbon is DRAPED on the ground it found, a hand's breadth above it,
     which is why it can follow hills the collision already knows about
     without the two ever disagreeing.

     It is a stream, not a canyon — ankle deep and laid on the grass. You
     walk through it rather than into it, which for a nine-year-old crossing
     it on the way to the Mall is the right answer. */
  function river(startDir, startY, poolR){
    /* FIVE METRES, NOT NINE. The ribbon is a flat quad between one sample
       and the next, and the ground between them is not flat — it bulges. At
       nine metres the hills cut straight through the water and the river
       came out as a row of disconnected puddles. Halving the step costs a
       hundred triangles and buys a river. */
    const STEP=5;
    const N=110;                  // still about five hundred metres of it
    const FAN=[-0.55,-0.32,-0.14,0,0.14,0.32,0.55];

    let dir=startDir.clone().normalize();
    let fr=W.frameAt(dir, 0);
    /* Leave the pool heading downhill, not in whatever direction the frame
       happened to point: the first segment sets the whole course. */
    let best=null;
    for(let a=0;a<Math.PI*2;a+=Math.PI/8){
      const cand=turn(dir, fr.fwd.clone().applyAxisAngle(dir, a), poolR+STEP);
      const h=W.terrainH(cand);
      if(!best || h<best.h) best={ h, head:fr.fwd.clone().applyAxisAngle(dir, a) };
    }
    let head=best.head;
    /* Start INSIDE the bank. Stepping out a full pool radius and then taking
       the first sample five metres further left a gap of dry grass between
       the water and the river that drains it. */
    dir=turn(dir, head, poolR-8);

    const path=[], up=[];
    for(let i=0;i<N;i++){
      fr=W.frameAt(dir, 0);
      head.sub(dir.clone().multiplyScalar(head.dot(dir)));
      if(head.lengthSq()<1e-9) head.copy(fr.fwd);
      head.normalize();

      let pick=null;
      for(const off of FAN){
        const h2=head.clone().applyAxisAngle(dir, off);
        const cand=turn(dir, h2, STEP);
        const h=W.terrainH(cand);
        /* A SMALL BIAS TOWARDS STRAIGHT ON. Pure steepest descent on noise
           this fine picks a different neighbour every step and the river
           comes out as a zig-zag; costing the turn a few centimetres buys a
           course that reads as one river. */
        const cost=h + Math.abs(off)*0.45;
        if(!pick || cost<pick.cost) pick={ cost, h2, cand, h };
      }
      head.copy(pick.h2);
      dir=pick.cand;
      path.push(dir.clone()); up.push(W.terrainH(dir));
      // once it has run out into flat country, stop rather than wander
      if(i>24 && Math.abs(up[i]-up[i-12])<0.05) break;
    }
    if(path.length<4) return;

    /* THE RIBBON. Two vertices a step, offset along the local right, laid a
       little over the ground. It widens downstream, because a river does. */
    const pos=[], uv=[], idx=[];
    const P=path.length;
    for(let i=0;i<P;i++){
      const d=path[i];
      const nx=path[Math.min(P-1,i+1)], pv=path[Math.max(0,i-1)];
      const t=nx.clone().sub(pv).normalize();
      const right=new THREE.Vector3().crossVectors(d, t).normalize();
      const wide=(4.0 + 5.4*(i/P)) * 0.5;
      const c=d.clone().multiplyScalar(W.PR + up[i] + 0.30);
      const L=c.clone().addScaledVector(right,  wide);
      const R=c.clone().addScaledVector(right, -wide);
      pos.push(L.x,L.y,L.z, R.x,R.y,R.z);
      const v=i*STEP/14;
      uv.push(0,v, 1,v);
      if(i<P-1){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const rmat=flowMat(0.9);
    const ribbon=new THREE.Mesh(geo, rmat);
    ribbon.userData.flat=true;
    group.add(ribbon);

    /* Stones along both banks, so the water has an edge rather than just
       stopping where the triangles do. */
    const rockM=ROCK.map(c=>new THREE.MeshLambertMaterial({color:c}));
    for(let i=3;i<P;i+=4){
      const d=path[i];
      const nx=path[Math.min(P-1,i+1)], pv=path[Math.max(0,i-1)];
      const t=nx.clone().sub(pv).normalize();
      const right=new THREE.Vector3().crossVectors(d, t).normalize();
      const wide=(4.0 + 5.4*(i/P))*0.5;
      [-1,1].forEach(sx=>{
        if(rnd(i*13+sx)<0.35) return;
        const sz=0.45+rnd(i*17+sx)*0.95;
        const bo=new THREE.Mesh(new THREE.IcosahedronGeometry(sz,0),
          rockM[(i+(sx>0?1:0))%rockM.length]);
        bo.position.copy(d.clone().multiplyScalar(W.PR + up[i] + sz*0.35)
                          .addScaledVector(right, sx*(wide+sz*0.7)));
        bo.rotation.set(rnd(i)*3, rnd(i+5)*3, rnd(i+9)*3);
        group.add(bo);
      });
    }
    riv={ mat:rmat };
  }
  /* Walk `m` metres from `dir` along the great circle in the `head`
     direction — the same rotate-about-(up × move) the player walks by. */
  function turn(dir, head, m){
    const axis=new THREE.Vector3().crossVectors(dir, head).normalize();
    if(!isFinite(axis.x)) return dir.clone();
    return dir.clone().applyAxisAngle(axis, -m/W.PR).normalize();
  }

  /* ------------------------------------------------------------- frame */
  function tick(dt){
    if(!group) return;
    t+=dt;
    /* The weather round the arcade, going slowly round it. A cloud that
       stands still is a rock painted white. */
    for(const is of isles){
      const bank = is.g && is.g.getObjectByName('clouds');
      if(!bank) continue;
      bank.children.forEach(m=>{
        const u=m.userData;
        u.a += u.spin*dt*0.12;
        m.position.x = Math.cos(u.a)*u.rr;
        m.position.z = Math.sin(u.a)*u.rr;
      });
    }
    /* All of the water is shaders now, and all a shader needs is the clock:
       every streak, drop, splash and ripple is a function of time. */
    if(fall){
      fall.sheets.forEach(m=>{ m.uniforms.uT.value=t; });
      fall.parts.forEach(m=>{ m.uniforms.uT.value=t; });
      if(fall.poolMat) fall.poolMat.uniforms.uT.value=t;
      if(fall.stream) fall.stream.uniforms.uT.value=t;
    }
    if(riv) riv.mat.uniforms.uT.value=t;

    /* --------------------------------------------------------- the fish
       A WANDER, NOT AN ORBIT. Each one has somewhere it is going and turns
       towards it; arriving picks somewhere else. The circle they used to
       swim was legible as a circle within about two seconds. */
    fish.forEach(f=>{
      const dx=f.tx-f.x, dz=f.tz-f.z;
      if(dx*dx+dz*dz < 0.6) aim(f, 0.92);
      const want=Math.atan2(dz,dx);
      f.a += wrap(want-f.a) * Math.min(1, dt*2.2);
      f.x += Math.cos(f.a)*f.spd*dt;
      f.z += Math.sin(f.a)*f.spd*dt;
      f.m.position.set(f.cx+f.x, f.y-0.30+Math.sin(t*1.7+f.bob)*0.14, f.cz+f.z);
      f.m.rotation.y = -f.a + Math.PI/2;
      f.m.rotation.z = Math.sin(t*7+f.bob)*0.20;     // the tail working
    });

    /* ------------------------------------------------------ the turtles
       THEY DO NOT GO ROUND IN A CIRCLE. A turtle picks a spot on the shore,
       walks to it slowly, and then stops for a while and does nothing, which
       is most of what a turtle does. The legs only move while it is walking —
       paddling on the spot was the other half of why the old ones read as
       clockwork. */
    turtles.forEach(tt=>{
      if(tt.rest>0){
        tt.rest-=dt;
        // a resting turtle still looks about
        tt.m.rotation.y = -tt.a + Math.PI/2 + Math.sin(t*0.6+tt.bob)*0.12;
        return;
      }
      const dx=tt.tx-tt.x, dz=tt.tz-tt.z;
      if(dx*dx+dz*dz < 0.5){ aim(tt, 1.16); tt.rest=2.5+rnd(tt.bob*97)*6; return; }
      const want=Math.atan2(dz,dx);
      tt.a += wrap(want-tt.a) * Math.min(1, dt*1.1);   // turtles turn slowly
      tt.x += Math.cos(tt.a)*tt.spd*dt;
      tt.z += Math.sin(tt.a)*tt.spd*dt;
      tt.step += tt.spd*dt*7;
      tt.m.position.set(tt.cx+tt.x, tt.y+0.02, tt.cz+tt.z);
      tt.m.rotation.y = -tt.a + Math.PI/2;
      (tt.m.userData.legs||[]).forEach((l,i)=>{
        l.position.y = 0.20 + Math.max(0, Math.sin(tt.step + (i%2?Math.PI:0)))*0.11;
      });
    });
  }
  /* Somewhere new to head for, inside the band this creature lives in. */
  function aim(c, band){
    const a=Math.random()*Math.PI*2;
    const r=c.rad*band*(0.25+Math.random()*0.75);
    c.tx=Math.cos(a)*r; c.tz=Math.sin(a)*r;
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /* --------------------------------------------------- standing on them
     The two questions planet.js asks the ground. An island answers for the
     column of air above its own crown and nowhere else, so everything off
     the edge falls past it exactly as it should. */
  /* WHERE THE WATER SURFACE IS, at a point, or null for dry land. planet.js
     asks this every step: it already knows where the GROUND is, so the two
     together are how deep the water is, and how deep the water is decides
     whether you are wading or swimming. */
  function waterAt(dir){
    if(pool){
      const off=Math.acos(Math.min(1, dir.dot(pool.dir)))*(W.PR);
      if(dir.dot(pool.dir)>0 && off < pool.r) return pool.surface;
    }
    for(const is of isles){
      if(is.bed===undefined) continue;
      const k=is.k, R=W.PR+k.alt;
      const off=Math.acos(Math.min(1, dir.dot(is.dir)))*R;
      if(dir.dot(is.dir)<0 || off > k.r) continue;
      const v=dir.clone().multiplyScalar(R).sub(is.dir.clone().multiplyScalar(R));
      const lx=v.dot(is.f.right), lz=v.dot(is.f.fwd);
      if(Math.hypot(lx-is.lake.x, lz-is.lake.z) < is.lake.r)
        return k.alt + is.lake.y;
    }
    return null;
  }

  function floorAt(dir, alt){
    if(!isles.length) return null;
    for(const is of isles){
      const k=is.k;
      if(k.model){
        if(!is.field || alt===undefined) continue;
        const h=fieldAt(is, dir);
        if(h && alt >= h.top-0.5) return h.top;
        continue;
      }
      /* How far off the island's centre line, measured along the surface —
         the same "degrees times radius" the buildings use. */
      const off = Math.acos(Math.min(1, Math.abs(dir.dot(is.dir)))) * (W.PR + k.alt);
      if(dir.dot(is.dir)<0 || off > k.r*0.93) continue;
      if(alt===undefined) continue;               // on foot below, it is not the floor
      // the deck at THIS point, not the deck at the middle
      let top = k.alt + crownY(k, off/k.r);
      /* AND THE LAKE IS A HOLE IN IT. Without this you walk across the water
         on the un-carved dome — the rock says one thing and the surface you
         can see says another, and the fish swim under your shoes. */
      if(is.bed!==undefined){
        const R=W.PR+k.alt;
        const v=dir.clone().multiplyScalar(R).sub(is.dir.clone().multiplyScalar(R));
        const lx=v.dot(is.f.right), lz=v.dot(is.f.fwd);
        if(Math.hypot(lx-is.lake.x, lz-is.lake.z) < is.lake.r*1.02)
          top = k.alt + is.bed;
      }
      if(alt >= top-0.5) return top;
    }
    return null;
  }
  /* The rock under the crown. You may fly past an island but not through
     it, and the underside is a cone, so what is blocked at a given height
     is a disc that shrinks as you go down. */
  function blocked(dir, alt){
    if(!isles.length) return false;
    for(const is of isles){
      /* THE ONE BUILDING UP HERE. The planet's own building collision works
         in a building's local frame and knows nothing about the sky, so the
         arcade's walls are boxes in the island's frame, tested here beside
         the rock they stand on. */
      if(is.boxes && is.boxes.length){
        const R = W.PR + is.k.alt;
        const v = dir.clone().multiplyScalar(R).sub(is.dir.clone().multiplyScalar(R));
        const lx = v.dot(is.f.right), lz = v.dot(is.f.fwd);
        const ly = alt - is.k.alt;
        for(const b of is.boxes)
          if(lx>b.x1 && lx<b.x2 && lz>b.z1 && lz<b.z2 && ly>b.y1-0.2 && ly<b.y2) return true;
      }
      if(is.k.model){
        if(!is.field) continue;
        const h=fieldAt(is, dir);
        if(!h || alt < h.bot-1.8) continue;
        if(alt < h.top-0.5) return true;       // inside the rock, or under a cliff
        continue;
      }
      const k=is.k, deep=k.tall ? k.r*1.9 : k.r*1.15;
      const below = k.alt - alt;                  // how far under the rim you are
      if(below < -0.6 || below > deep) continue;
      const shrink = 1 - Math.min(1, below/deep);
      const rad = k.r*Math.max(0.06, shrink);
      const off = Math.acos(Math.min(1, Math.abs(dir.dot(is.dir)))) * (W.PR + alt);
      if(dir.dot(is.dir)>0 && off < rad) return true;
    }
    return false;
  }

  /* WHERE NEON LETS YOU OUT: on the apron in front of the arch, facing away
     from it, with an altitude above the deck so floorAt() answers with the
     island rather than the grass underneath. Read off the arch mesh itself
     (arcade() keeps it on the record) rather than worked out again here,
     so the two can never disagree about where the door is. */
  function doorOut(id){
    const is = isles.find(r => r.k.id===(id||'neon'));
    if(!is || !is.door) return null;           // not loaded yet: planet.js uses its own spot
    is.g.updateMatrixWorld(true);
    const at = new THREE.Vector3(); is.door.getWorldPosition(at);
    const centre = is.dir.clone().multiplyScalar(W.PR + is.k.alt);
    const up = at.clone().normalize();
    const out = at.clone().sub(centre);
    out.addScaledVector(up, -out.dot(up)).normalize();
    /* clear of the chase camera, but never off the edge of the rock */
    let dir = null;
    for(let d=5.5; d>=2; d-=0.5){
      dir = at.clone().addScaledVector(out, d).normalize();
      if(floorAt(dir, is.k.alt+20)!==null) break;
    }
    /* FACING THE PAGODA: coming out, the first thing you see is the
       building you were just in, lit up, rather than the back of a gate. */
    const back = out.clone().negate();
    const fwd = back.addScaledVector(dir, -back.dot(dir)).normalize();
    return { dir, fwd, alt: is.k.alt + 20 };
  }

  function clear(){
    group=null; isles=[]; fall=null; riv=null; pool=null; fish=[]; turtles=[]; t=0;
  }

  return { build, tick, floorAt, blocked, clear, spots, waterAt, fallPush, ISLES, doorOut,
           get count(){ return isles.length; },
           get pool(){ return pool; },
           /* WHAT IS ALIVE UP THERE, and where one of each is right now —
              a swimming fish and a walking turtle are the kind of thing that
              can stop moving without anything erroring, so there has to be a
              way to ask rather than to squint. */
           get life(){
             return { fish:fish.length, turtles:turtles.length,
                      fishAt: fish[0] ? fish[0].m.position.toArray().map(n=>+n.toFixed(3)) : null,
                      turtleAt: turtles[0] ? turtles[0].m.position.toArray().map(n=>+n.toFixed(3)) : null };
           },
           /* what a test or a debug overlay wants to know */
           get decks(){ return isles.map(i=>({ id:i.k.id, alt:i.k.alt,
                                               top:+i.top.toFixed(2), r:i.k.r })); } };
})();
