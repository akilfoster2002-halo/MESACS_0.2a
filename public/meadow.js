/* =====================================================================
   THE MEADOW — grass that stands up, round wherever you are standing.

   planet.js says NO GRASS TUFTS, and it was right about what it tried: a
   half-metre cone is not a blade of grass, it is a small conifer, and nine
   thousand of them is a model railway. What was wrong was the shape, not
   the idea. These are PICTURES of grass — a clump generated with Higgsfield
   and cut out — on two panels crossed at right angles, so from any side
   you are looking at blades, not at a solid.

   AND ONLY NEAR YOU. A clump is a detail you can see from a few metres and
   not from forty, so the meadow is a disc round your feet that follows you
   about: out past DISC metres the clumps shrink into the ground, and the
   grain in the soil texture carries on where they stop. However big the
   world is, it is the same couple of thousand clumps.

   THE CLUMPS DO NOT FOLLOW YOU, THE DISC DOES. Every clump belongs to a cell
   of a latitude/longitude grid, and where in its cell it stands, how it is
   turned and how tall it is all come from a hash of the cell — so walking
   ten metres and back finds the same grass in the same places. A disc of
   random clumps redrawn as you move would boil.

   Walking through it bends it. The vertex shader knows where your feet are
   and pushes the tops of the blades away from them, which is most of what
   "walking through grass" is.

   WHAT THIS FILE DOES NOT DO is decide where the ground is grass. planet.js
   owns the terrain, the soil bands, the building plates and the pools; it
   hands over one function, lushAt(), that says how much grass a spot has
   (0 for none) and what colour the soil there is.
   ===================================================================== */
window.MEADOW = (function(){

  const CELL=0.75;          // metres between clumps, before the jitter
  const DISC=22;            // how far out from your feet there is any
  const FADE=7;             // and over how much of that they shrink away
  const MOVE=2.5;           // how far you walk before the disc is re-laid
  const MAX=4200;           // instances; a full disc is about 2700
  const LUSH=[0.20,0.38,0.18];   // the soil colour the picture is right for
  const ASPECT=446/512;          // the picture's own height over its width

  let W=null, mesh=null, uni=null, laidAt=null, t=0;
  /* WHAT EACH CELL HAS IN IT, kept. Asking the planet is terrain noise,
     soil noise and a walk over the buildings per cell, and walking a couple
     of metres moves the disc by a couple of metres: nine cells in ten are
     the ones it just asked about. */
  let known=new Map();

  function rnd(a, b, k){
    let h=Math.imul(a^0x9e3779b9, 2654435761) ^ Math.imul(b^0x85ebca6b, 2246822519) ^ Math.imul(k, 3266489917);
    h=Math.imul(h^(h>>>15), 2246822519);
    return ((h^(h>>>13))>>>0)/4294967295;
  }

  /* Two panels crossed, the base on the ground and the picture standing up
     off it. uv.y is the height up the blade, which is what the sway and the
     push both scale by — the roots stay put. */
  function clumpGeo(){
    const g=new THREE.BufferGeometry();
    const P=[], U=[], N=[], I=[];
    for(let k=0;k<2;k++){
      const a=k*Math.PI/2, cx=Math.cos(a)*0.5, cz=Math.sin(a)*0.5, b=P.length/3;
      P.push(-cx,0,-cz,  cx,0,cz,  cx,ASPECT,cz,  -cx,ASPECT,-cz);
      U.push(0,0, 1,0, 1,1, 0,1);
      for(let i=0;i<4;i++) N.push(0,1,0);   // lit like the ground it grows from
      I.push(b,b+1,b+2, b,b+2,b+3);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P,3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U,2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N,3));
    g.setIndex(I);
    return g;
  }

  function build(world){
    clear();
    W=world;
    if(!W || W.biome!=='green' || !W.lushAt) return;   // grass grows on green worlds
    const tex=new THREE.TextureLoader().load('ground/grass_clump.png?v='+(window.ASSETV||'1'));
    tex.colorSpace=THREE.SRGBColorSpace;
    const mat=new THREE.MeshLambertMaterial({ map:tex, alphaTest:0.45, side:THREE.DoubleSide });
    uni={ uFeet:{value:new THREE.Vector3()}, uTime:{value:0}, uDisc:{value:DISC}, uFade:{value:FADE} };
    mat.onBeforeCompile=sh=>{
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'uniform vec3 uFeet; uniform float uTime, uDisc, uFade;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', `
          vec3 transformed = vec3(position);
          vec4 root = modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
          float far = distance(root.xyz, uFeet);
          /* out at the edge of the disc the whole clump sinks and shrinks */
          float keep = clamp((uDisc - far)/uFade, 0.0, 1.0);
          transformed *= keep;
          float up = uv.y*uv.y;
          /* wind: each clump on its own phase, taken off where it stands */
          float ph = root.x*0.37 + root.z*0.23 + root.y*0.11;
          transformed.x += sin(uTime*1.7 + ph)*0.06*up;
          transformed.z += cos(uTime*1.3 + ph*1.3)*0.04*up;`)
        .replace('#include <project_vertex>', `
          vec4 mvPosition = vec4(transformed, 1.0);
          mvPosition = instanceMatrix * mvPosition;
          vec4 wp = modelMatrix * mvPosition;
          /* and your feet push it over: the blade tops lean away from you
             inside a metre and a bit, and lie nearly flat right under you */
          vec3 away = wp.xyz - uFeet;
          vec3 upDir = normalize(root.xyz);
          away -= upDir*dot(away, upDir);
          float d = length(away);
          float push = (1.0 - smoothstep(0.25, 1.3, d)) * up;
          wp.xyz += (d>0.001 ? away/d : vec3(0.0)) * push*0.55 - upDir*push*0.35;
          mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;`);
      /* BOTH SIDES OF A PANEL ARE THE FRONT. Its normal points up, like
         the ground it stands in; left to itself the back face flips that
         normal to point down, and half of every field went black. */
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace(
          'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'));
    };
    mesh=new THREE.InstancedMesh(clumpGeo(), mat, MAX);
    mesh.count=0;
    mesh.frustumCulled=false;           // the instances move; the box would not
    mesh.castShadow=false; mesh.receiveShadow=true;
    mesh.userData.flat=true;
    W.group.add(mesh);
  }

  /* Lay the disc round a point on the ground. Rows of latitude CELL apart,
     and along each row cells CELL apart at that latitude — so a cell is the
     same size everywhere but the poles, where there is not much to walk on. */
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(),
        p=new THREE.Vector3(), col=new THREE.Color();
  function lay(dir){
    const PR=W.PR, dLat=CELL/PR;
    const lat0=Math.asin(Math.max(-1,Math.min(1,dir.y)));
    const lon0=Math.atan2(dir.x, dir.z);
    const span=Math.ceil(DISC/CELL)+1;
    const j0=Math.round(lat0/dLat);
    let n=0;
    for(let j=j0-span;j<=j0+span && n<MAX;j++){
      const la=j*dLat, c=Math.cos(la);
      if(c<0.05) continue;
      const dLon=CELL/(PR*c);
      const i0=Math.round(lon0/dLon), iw=span;
      for(let i=i0-iw;i<=i0+iw && n<MAX;i++){
        const key=i+','+j;
        let cell=known.get(key);
        if(cell===undefined){
          const la2=la+(rnd(i,j,1)-0.5)*dLat, lo2=i*dLon+(rnd(i,j,2)-0.5)*dLon;
          const cl=Math.cos(la2);
          const d=new THREE.Vector3(cl*Math.sin(lo2), Math.sin(la2), cl*Math.cos(lo2));
          const g=W.lushAt(d);
          cell = (g && rnd(i,j,3) <= g.amount) ? { d, g, h:W.terrainH(d) } : null;
          if(known.size>60000) known.clear();
          known.set(key, cell);
        }
        if(!cell || cell.d.angleTo(dir)*PR > DISC) continue;
        const d=cell.d, g=cell.g;
        const f=W.frameAt(d, rnd(i,j,4)*Math.PI*2);
        m4.makeBasis(f.right, f.up, f.fwd); q.setFromRotationMatrix(m4);
        const w=0.6+rnd(i,j,5)*0.45, h=(0.55+rnd(i,j,6)*0.45)*(0.6+0.4*g.amount);   // ankle to knee
        p.copy(d).multiplyScalar(PR + cell.h - 0.04);
        m4.compose(p, q, s.set(w, h, w));
        mesh.setMatrixAt(n, m4);
        /* the picture is lush grass; the soil under it says how lush this
           field is, so a dry band gets straw-coloured clumps and not green */
        const k=0.92+rnd(i,j,7)*0.16;
        col.setRGB(Math.min(1.15,g.c[0]/LUSH[0])*k*0.8, Math.min(1.15,g.c[1]/LUSH[1])*k*0.8,
                   Math.min(1.15,g.c[2]/LUSH[2])*k*0.8);   // and the picture is paler than the field
        mesh.setColorAt(n, col);
        n++;
      }
    }
    mesh.count=n;
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    laidAt=dir.clone();
  }

  /* Every frame: the time for the wind, where your feet are for the push,
     and a new disc once you have walked far enough off the last one. High
     up it is all hidden — nobody flying at sixty metres is looking at a
     clump, and the shrink at the edge would be a ring of grass following
     the shadow of the plane. */
  function tick(dt, me){
    if(!mesh || !me || !me.dir) return;
    t+=dt; uni.uTime.value=t;
    const high = me.alt - W.terrainH(me.dir) > 6;   // alt is off the sphere, not off the hill
    mesh.visible=!high;
    if(high) return;
    uni.uFeet.value.copy(me.dir).multiplyScalar(W.PR + me.alt);
    if(!laidAt || laidAt.angleTo(me.dir)*W.PR > MOVE) lay(me.dir);
  }

  function clear(){
    if(mesh){ mesh.geometry.dispose(); mesh.material.dispose();
              if(mesh.material.map) mesh.material.map.dispose(); }
    W=null; mesh=null; uni=null; laidAt=null; t=0; known=new Map();
  }

  return { build, tick, clear, get count(){ return mesh ? mesh.count : 0; } };
})();
