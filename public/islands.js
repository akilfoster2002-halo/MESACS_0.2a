/* =====================================================================
   THE SKY ISLANDS — somewhere to fly TO.

   Flight already worked: you press F, you go up, and the ceiling is a
   hundred and twenty metres over the hills. But there was nothing up
   there. The whole of the sky was a place you passed through on the way
   back down to the same field, which is why flying was a shortcut rather
   than somewhere to go.

   So: four islands hanging over Senio, inside the ceiling, each one big
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
   Senio, where it lands in a pool that is not otherwise on this planet —
   there is no water anywhere on Senio, which is why the fish had nowhere
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
    { id:'falls',  lon:13,  lat:16,  r:34, alt:62, spin:0.35,
      lake:true, fall:true, trees:5 },
    { id:'garden', lon:-16, lat:9,   r:26, alt:78, spin:-0.9, trees:9 },
    { id:'spire',  lon:24,  lat:-12, r:19, alt:95, spin:2.1,  trees:2, tall:true },
    /* A stepping stone, deliberately small and low: it is the one you find
       first, and finding a small one is what tells you the big ones are
       worth looking for. */
    { id:'stone',  lon:-3,  lat:-9,  r:11, alt:48, spin:1.2,  trees:1 }
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

  /* THE FALL ITSELF. Three planes at slightly different depths and speeds,
     scrolling a painted texture downwards. Not particles: a hundred and
     forty metres of falling water would be thousands of them, and what you
     actually read at this distance is a moving SHEET with streaks in it. */
  function fallTexture(){
    const c=document.createElement('canvas'); c.width=64; c.height=256;
    const x=c.getContext('2d');
    x.fillStyle='rgba(210,238,255,0.30)'; x.fillRect(0,0,64,256);
    for(let i=0;i<70;i++){
      const w=1+Math.random()*3, h=18+Math.random()*80;
      x.fillStyle='rgba(255,255,255,'+(0.10+Math.random()*0.45).toFixed(2)+')';
      x.fillRect(Math.random()*64, Math.random()*256, w, h);
    }
    const tex=new THREE.CanvasTexture(c);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }

  /* A POINT WITH NO TEXTURE IS A SQUARE, and a cloud of one-metre white
     squares hanging off a waterfall is a printing error rather than mist.
     One soft round falloff, made once and shared by every spray. */
  let mistTex=null;
  function mistTexture(){
    if(mistTex) return mistTex;
    const c=document.createElement('canvas'); c.width=c.height=64;
    const x=c.getContext('2d');
    const gr=x.createRadialGradient(32,32,0, 32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,0.95)');
    gr.addColorStop(0.45,'rgba(226,244,255,0.45)');
    gr.addColorStop(1,'rgba(200,232,255,0)');
    x.fillStyle=gr; x.fillRect(0,0,64,64);
    mistTex=new THREE.CanvasTexture(c);
    mistTex.colorSpace=THREE.SRGBColorSpace;
    return mistTex;
  }
  function spray(n, spread, up){
    const p=new Float32Array(n*3), ph=new Float32Array(n);
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2, r=Math.random()*spread;
      p[i*3]=Math.cos(a)*r; p[i*3+1]=Math.random()*up; p[i*3+2]=Math.sin(a)*r;
      ph[i]=Math.random();
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    const pts=new THREE.Points(g, new THREE.PointsMaterial({
      map:mistTexture(), color:0xdfefff, size:0.85, transparent:true,
      opacity:0.32, depthWrite:false, blending:THREE.AdditiveBlending }));
    pts.userData.ph=ph; pts.userData.up=up;
    return pts;
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
    if(!W || W.id!=='hub') return;            // the sky islands are Senio's
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
      if(k.fall) makeFall(rec, g);
    });
    return isles.length;
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
     From a lip in the island's rim, down the radius, into a pool — and out
     of the pool along a river. Everything below the lip is built in the
     PLANET's frame rather than the island's: an island turned on its own
     spin would otherwise pour its water off at an angle and miss the ground
     it is supposed to be landing on. */
  function makeFall(rec, isleG){
    const k=rec.k;
    /* THE SPILLWAY, on the island itself. This began as one box standing
       proud of the rim to read as a notch, and standing next to it what you
       actually got was a ten-metre brown slab across the view — a wall, not
       a lip. Two low banks with a gap between them, and water running down
       the gap: the lake is visibly LEAVING, which is all it has to say. */
    const rockM=new THREE.MeshLambertMaterial({color:ROCK[1]});
    const cx=-k.r*0.10;
    [-1,1].forEach(sx=>{
      const bank=new THREE.Mesh(
        new THREE.BoxGeometry(k.r*0.11, k.r*0.055, k.r*0.30), rockM);
      bank.position.set(cx + sx*k.r*0.115, crownY(k,0.80)+k.r*0.02, k.r*0.80);
      isleG.add(bank);
    });
    /* THE RUN OUT. The lake sits well inside the crown and the lip is at the
       rim, so without something between them the water simply appears at the
       edge. A stream down the slope is the sentence that joins them. */
    const streamM=new THREE.MeshLambertMaterial({color:WATER, transparent:true,
                    opacity:0.78, side:THREE.DoubleSide});
    const stream=new THREE.Mesh(new THREE.PlaneGeometry(k.r*0.10, k.r*0.50), streamM);
    stream.rotation.x=-Math.PI/2 + 0.10;
    stream.position.set(cx, crownY(k,0.52)+k.r*0.012, k.r*0.52);
    isleG.add(stream);

    const tex=fallTexture();
    const f=W.frameAt(rec.dir, k.spin);
    const lip = rec.dir.clone().multiplyScalar(W.PR + k.alt)
                  .addScaledVector(f.fwd, k.r*0.80)
                  .addScaledVector(f.right, cx);
    const base = lip.clone().normalize();
    /* THE GROUND UNDER THE WATER, NOT UNDER THE ISLAND. The lip is twenty-
       seven metres out from the island's centre line, and Senio is not flat:
       measuring the drop from the terrain below the island's middle put the
       whole pool — its water, its rim stones, its ripples and its fish —
       several metres out of the hillside it is supposed to be sunk into. */
    const groundY = W.terrainH(base);
    const drop = k.alt - groundY;                 // how far the water falls

    const g=new THREE.Group(); group.add(g);
    g.position.copy(base.clone().multiplyScalar(W.PR + groundY));
    const bf=W.frameAt(base, k.spin);
    g.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(bf.right, bf.up, bf.fwd));

    /* ------------------------------------------------------ the column
       A FALLING SHEET IS NOT A RECTANGLE. Water leaving a lip is narrow and
       fast; sixty metres later it has spread and begun to come apart. Four
       trapezoids — narrow at the top, half again as wide at the bottom — say
       that for nothing, and it is the difference between a waterfall and a
       curtain hung off a rock. */
    const sheets=[];
    function sheetGeo(wTop, wBot, h){
      const gm=new THREE.BufferGeometry();
      const x0=wTop/2, x1=wBot/2;
      gm.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -x1,0,0,  x1,0,0,  x0,h,0,
        -x1,0,0,  x0,h,0, -x0,h,0 ]),3));
      // v is 0 at the BOTTOM and 1 at the top: see the sign note in tick()
      gm.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
        0,0, 1,0, 1,1,  0,0, 1,1, 0,1 ]),2));
      gm.computeVertexNormals();
      return gm;
    }
    for(let i=0;i<4;i++){
      const wTop=k.r*(0.30 - i*0.055), wBot=wTop*1.55;
      const mat=new THREE.MeshBasicMaterial({ map:tex.clone(), transparent:true,
        opacity:0.55-i*0.10, side:THREE.DoubleSide, depthWrite:false });
      mat.map.wrapS=mat.map.wrapT=THREE.RepeatWrapping;
      mat.map.repeat.set(1, Math.max(2, drop/16));
      const pl=new THREE.Mesh(sheetGeo(wTop,wBot,drop), mat);
      pl.position.set(0, 0, i*1.1-1.6);
      g.add(pl);
      /* THE OUTER SHEETS RUN SLOWER. One speed for everything reads as a
         printed pattern sliding past; a spread of speeds reads as water,
         because the eye picks up the shear between them. */
      sheets.push({ mat, speed:0.85+i*0.30 });
    }

    /* THE LIP. Water does not start falling in mid-air — it bends over the
       edge first, and the bend is what joins the stream on the island to the
       column under it. */
    const lipM=new THREE.Mesh(
      new THREE.CylinderGeometry(k.r*0.15, k.r*0.15, k.r*0.30, 14, 1, true,
                                 Math.PI*0.95, Math.PI*0.55),
      new THREE.MeshLambertMaterial({ color:0xdff0ff, transparent:true,
                                      opacity:0.72, side:THREE.DoubleSide }));
    lipM.rotation.z=Math.PI/2;
    lipM.position.set(0, drop-k.r*0.03, k.r*0.02);
    g.add(lipM);

    /* ----------------------------------------------------- the droplets
       THE THING THAT SETTLES WHICH WAY IT IS GOING. A scrolling texture
       reads as motion but its direction is a guess — the first build of this
       had it running backwards and it was genuinely hard to say why. A point
       you can follow all the way down is not ambiguous. */
    const DN=150;
    const dp=new Float32Array(DN*3), dph=new Float32Array(DN), dsp=new Float32Array(DN);
    for(let i=0;i<DN;i++){ dph[i]=rnd(i*7); dsp[i]=0.55+rnd(i*11)*0.75; }
    const dgeo=new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(dp,3));
    const drops=new THREE.Points(dgeo, new THREE.PointsMaterial({
      map:mistTexture(), color:0xeaf6ff, size:0.62, transparent:true,
      opacity:0.8, depthWrite:false, blending:THREE.AdditiveBlending }));
    drops.userData={ ph:dph, sp:dsp, drop, spread:k.r*0.20 };
    g.add(drops);

    /* THE POOL. There is no other water on Senio, so this is the only place
       a fish could be — which is the right way round: the waterfall is why
       the pool is here, and the pool is why the fish are. */
    const pr=k.r*0.72;
    /* The ground here has been dug out by POOL_DEPTH, so the water goes
       most of the way back up it — a basin with a hand's breadth of bank
       showing, rather than a puddle at the bottom of a crater. */
    const surfY=POOL_DEPTH-0.55;
    const water=new THREE.Mesh(new THREE.CircleGeometry(pr, 36),
      new THREE.MeshLambertMaterial({color:WATER, transparent:true, opacity:0.86}));
    water.rotation.x=-Math.PI/2; water.position.y=surfY; g.add(water);
    /* The rim is open on the downstream side, or the river would be running
       out through a wall of boulders. */
    for(let i=0;i<18;i++){
      const a=i/18*Math.PI*2;
      if(Math.cos(a)>0.72) continue;
      const sz=0.55+rnd(i*7)*0.95;   // knee to chest, not house-sized
      const bo=new THREE.Mesh(new THREE.IcosahedronGeometry(sz,0),
        new THREE.MeshLambertMaterial({color:ROCK[i%ROCK.length]}));
      bo.position.set(Math.cos(a)*pr*1.02, POOL_DEPTH*0.55, Math.sin(a)*pr*1.02);
      bo.rotation.set(rnd(i)*3, rnd(i+9)*3, rnd(i+4)*3);
      g.add(bo);
    }

    /* WHERE IT LANDS. Rings opening out from the impact and dying as they
       widen — the only part of a waterfall that says the water ARRIVED
       somewhere rather than simply stopping. */
    const rings=[];
    for(let i=0;i<4;i++){
      /* A UNIT RING, so the scale IS the radius in metres. The first one was
         RingGeometry(1, 1.5) scaled by up to twenty-two, which put a
         sixty-seven-metre band of grey across a pool forty-nine metres wide
         — out over the grass, five metres up in the air, reading as a huge
         dark halo hanging over the whole valley. */
      const rg=new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 44),
        new THREE.MeshBasicMaterial({color:0xdff0ff, transparent:true,
          opacity:0.45, side:THREE.DoubleSide, depthWrite:false }));
      rg.rotation.x=-Math.PI/2; rg.position.y=surfY+0.06;
      g.add(rg);
      rings.push({ m:rg, t:i/4 });
    }

    const mist=spray(80, pr*0.42, 7);  g.add(mist); mist.position.y=surfY;
    const top =spray(26, k.r*0.20, 5); top.position.y=drop-7; g.add(top);

    // and the same wildlife, because it is the same water
    stockLake(g, { x:0, z:0, r:pr, y:surfY }, 900);

    fall={ g, sheets, mist, top, drops, rings, drop, poolR:pr };
    pool={ dir:base, y:groundY, r:pr };

    // and then it has somewhere to go
    river(base, groundY+surfY, pr);
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

    const rtex=fallTexture();
    rtex.wrapS=rtex.wrapT=THREE.RepeatWrapping;
    const rmat=new THREE.MeshLambertMaterial({ color:0x3f96c8, map:rtex,
      transparent:true, opacity:0.86, side:THREE.DoubleSide, depthWrite:false });
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
    if(fall){
      /* DOWNWARDS, AND THIS IS THE SIGN THAT WAS WRONG. A texture is sampled
         at uv*repeat + offset, so a feature painted at v sits wherever
         uv = (v - offset)/repeat. Decrease the offset and that quotient goes
         UP the plane — which is exactly what the first build did, and why
         sixty metres of water appeared to be climbing back onto the island.
         Increasing it drags the streaks down. */
      fall.sheets.forEach(sh=>{ sh.mat.map.offset.y += sh.speed*dt; });

      /* The droplets, each falling at its own rate and starting again at the
         lip. Spread grows as they go, because falling water comes apart. */
      const D=fall.drops, u=D.userData, a2=D.geometry.attributes.position;
      for(let i=0;i<u.ph.length;i++){
        u.ph[i]+=dt*u.sp[i]*0.45;
        if(u.ph[i]>1) u.ph[i]-=1;
        const k=u.ph[i];
        a2.array[i*3+1]=u.drop*(1-k);                 // top to bottom
        const sp=u.spread*(0.45+k*0.85);
        a2.array[i*3  ]=Math.cos(i*2.399)*sp*(0.4+0.6*((i%7)/7));
        a2.array[i*3+2]=Math.sin(i*1.7)*1.6*(0.5+k);
      }
      a2.needsUpdate=true;

      // rings opening out from where it lands, and fading as they widen
      fall.rings.forEach(r=>{
        r.t+=dt*0.55; if(r.t>1) r.t-=1;
        /* The scale is the outer radius in metres, and it stops well inside
           the bank — a ripple that runs out over dry land is not a ripple. */
        const k=r.t, sc=2 + k*(fall.poolR*0.72);
        r.m.scale.setScalar(sc);
        r.m.material.opacity=0.5*(1-k)*(1-k);
      });

      [fall.mist, fall.top].forEach(p=>{
        if(!p) return;
        const at=p.geometry.attributes.position, ph=p.userData.ph, up=p.userData.up;
        for(let i=0;i<ph.length;i++){
          ph[i]=(ph[i]+dt*(0.25+0.4*((i%5)/5)))%1;
          at.array[i*3+1]=ph[i]*up;
        }
        at.needsUpdate=true;
        p.material.opacity=0.20+0.16*Math.abs(Math.sin(t*1.3));
      });
    }
    // the river runs the way it was laid: v climbs downstream, so does the offset
    if(riv) riv.mat.map.offset.y += dt*0.5;

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
      if(dir.dot(pool.dir)>0 && off < pool.r) return pool.y + POOL_DEPTH - 0.55;
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

  function clear(){
    group=null; isles=[]; fall=null; riv=null; pool=null; fish=[]; turtles=[]; t=0;
  }

  return { build, tick, floorAt, blocked, clear, spots, waterAt, ISLES,
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
