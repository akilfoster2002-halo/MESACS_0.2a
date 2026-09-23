/* =====================================================================
   MISSION CONTROL, THE TEMPLE — the building, as made in Blender.

   The old Mission Control was boxes: a castle drawn in code. This one is a
   temple compound modelled and lit in Blender (glb files/temple/build.py):
   a three-roofed pavilion over the door, two long galleries hung with ink
   paintings, a back hall, and in the middle of it all a round concrete
   room with the sky cut out of its ceiling and a pool under the hole.

   WHAT COMES FROM BLENDER is everything you can see that does not move,
   with its light already in it. Cycles worked out the sun, the bounce off
   the floor, the dirt in the corners and the glow of every lantern, and
   baked the lot into the textures — so the building is drawn UNLIT, exactly
   as it was rendered, and costs the game nothing to light.

   WHAT LIVES HERE is everything that has to be now rather than then:
     - the walls you cannot walk through and the roofs you can land on,
       from layout.js, which the same build wrote from the same numbers —
       so they are there the moment the world is, before the model loads;
     - the two mission stations, which are the game's and not the model's;
     - the pool, which is a real mirror: the oculus, the blossom and the
       sky, rendered upside down into it from wherever you stand;
     - petals falling through the oculus, and doves over it.
   ===================================================================== */
window.TEMPLE = (function(){
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  let S=null;            // this visit's state; thrown away with the room

  /* ------------------------------------------------------------ build */
  function build(b, g, kit){
    const L=window.TEMPLE_LAYOUT;
    S={ b, g, t:0, petals:null, doves:[], water:null, model:null };

    for(const s of L.solids) b.solids.push({x1:s.x1, x2:s.x2, z1:s.z1, z2:s.z2, y1:s.y1, y2:s.y2});

    /* THE ROOF IS A HEIGHT PER METRE, measured off the model by casting
       straight down on to it. null is open sky — over the oculus, and off
       the edge of the eaves — so flying down through the hole in the
       atrium ceiling lands you by the pool, not on an invisible lid. */
    const R=L.roof;
    b.roofAt=(x,z)=>{
      const i=Math.round((x-R.x0)/R.cell), j=Math.round((z-R.z0)/R.cell);
      if(i<0 || j<0 || i>=R.nx || j>=R.nz) return null;
      const v=R.rows[j][i];
      return v===null || v===undefined ? null : v;
    };

    // the missions, at the far end of the view through the atrium
    L.stations.forEach(sp=>{
      const s=kit.STATIONS.find(x=>x.id===sp.id); if(!s) return;
      kit.panel(g, b, sp.x, sp.z, s.em, kit.t(s.name), s.id, '#1b2740', 0.8, sp.r);
      kit.statue(g, s.id, sp.x - Math.sin(sp.r)*4.6, sp.z - Math.cos(sp.r)*4.6, sp.r);
    });
    /* They are the game's, lit by the game's lights, in a hall whose light
       is baked — so they get a warm lamp of their own, or they would stand
       in the sun that the roof keeps off everything else. */
    const lamp=new THREE.PointLight(0xffd2a0, 70, 18, 1.6);
    lamp.position.set(0, 6.5, -17); g.add(lamp);

    // the name, painted on to the plaque over the door
    const P=L.plaque;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h),
      new THREE.MeshBasicMaterial({ map:kit.signTexture(b.em+'  '+kit.t(b.name), 0xe9c46a),
                                    transparent:true }));
    sign.position.set(P.x, P.y, P.z+0.02); g.add(sign);

    pool(L.pool);
    petals(L.oculus);
    doves(L.oculus);
    load(kit);
  }

  /* ----------------------------------------------------------- the model */
  let loader=null;
  function load(kit){
    const mine=S;
    if(!loader){
      loader=new THREE.GLTFLoader();
      if(window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
    }
    loader.load('temple/temple.glb?v='+(window.ASSETV||'1'), gl=>{
      if(S!==mine) return;                      // the world was rebuilt meanwhile
      gl.scene.traverse(o=>{
        if(!o.isMesh) return;
        const m=o.material, baked=/^T_/.test(o.name) || /^B_/.test(m.name||'');
        o.material = baked
          /* Unlit: the light is IN the picture. toneMapped stays on, so it
             goes through the same film as everything else on Senio. */
          ? new THREE.MeshBasicMaterial({ map:m.map })
          : new THREE.MeshLambertMaterial({ map:m.map, color:0xffffff });
        o.castShadow=false; o.receiveShadow=!baked;
        o.userData.flat=true;
      });
      S.g.add(gl.scene);
      S.model=gl.scene;
      /* The grey plate under every building is the floor the physics
         measures, and the temple covers every metre of it — its own
         podium, floors and moss. Drawn as well, it shows through. */
      S.g.children.forEach(c=>{ if(c.isMesh && c.userData.lid && c.geometry.type==='PlaneGeometry') c.visible=false; });
    }, undefined, err=>console.warn('TEMPLE: the model did not load', err));
  }

  /* ------------------------------------------------------------ the pool
     A MIRROR, the way three's own Reflector does it, without needing it:
     just before the water is drawn, the camera is flipped through the
     surface, the room is rendered from there into a texture, and the water
     samples that texture where its own pixels land. A little ripple moves
     the lookup about, and it darkens towards the middle, where a pool this
     deep stops reflecting and starts being dark.

     Half a thousand pixels square, and only when you are near enough to
     see it: from outside the building it is never on screen, and a second
     render of the whole world for a puddle nobody can see is a frame. */
  const RT_SIZE=512;
  function pool(P){
    const rt=new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, { colorSpace:THREE.SRGBColorSpace });
    const texMat=new THREE.Matrix4();
    const mat=new THREE.ShaderMaterial({
      uniforms:{ tMirror:{value:rt.texture}, texMat:{value:texMat}, uTime:{value:0},
                 uDeep:{value:new THREE.Color(0x0b1418)} },
      vertexShader:`
        uniform mat4 texMat; varying vec4 vUv; varying vec2 vXZ;
        void main(){
          vec4 wp = modelMatrix*vec4(position,1.0);
          vUv = texMat*wp; vXZ = position.xy;
          gl_Position = projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader:`
        uniform sampler2D tMirror; uniform float uTime; uniform vec3 uDeep;
        varying vec4 vUv; varying vec2 vXZ;
        void main(){
          vec2 rip = vec2(sin(vXZ.x*2.1+uTime*0.9)+sin(vXZ.y*1.7-uTime*0.7),
                          cos(vXZ.y*2.3+uTime*0.8)+cos(vXZ.x*1.3+uTime*0.6))*0.0035;
          vec4 uv = vUv; uv.xy += rip*uv.w;
          vec3 refl = texture2DProj(tMirror, uv).rgb;
          float r = length(vXZ)/${P.r.toFixed(2)};
          vec3 col = mix(refl*0.92, uDeep, 0.12 + 0.18*(1.0-r));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const water=new THREE.Mesh(new THREE.CircleGeometry(P.r, 64), mat);
    water.rotation.x=-Math.PI/2;
    water.position.set(P.x, P.y, P.z);
    S.g.add(water);

    const cam=new THREE.PerspectiveCamera();
    const n=new THREE.Vector3(), wp=new THREE.Vector3(), cp=new THREE.Vector3(),
          rot=new THREE.Matrix4(), look=new THREE.Vector3(), tgt=new THREE.Vector3(),
          view=new THREE.Vector3(), plane=new THREE.Plane(), clip=new THREE.Vector4(), q=new THREE.Vector4();
    let busy=false;
    water.onBeforeRender=(renderer, scene, camera)=>{
      if(busy) return;
      water.getWorldPosition(wp);
      camera.getWorldPosition(cp);
      if(cp.distanceTo(wp) > 45) return;                 // nowhere near it
      n.set(0,0,1).applyQuaternion(water.getWorldQuaternion(new THREE.Quaternion()));
      view.subVectors(wp, cp);
      if(view.dot(n) > 0) return;                        // looking at it from underneath
      view.reflect(n).negate().add(wp);
      rot.extractRotation(camera.matrixWorld);
      look.set(0,0,-1).applyMatrix4(rot).add(cp);
      tgt.subVectors(wp, look).reflect(n).negate().add(wp);
      cam.position.copy(view);
      cam.up.set(0,1,0).applyMatrix4(rot).reflect(n);
      cam.lookAt(tgt);
      cam.far=camera.far; cam.near=camera.near;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      texMat.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1);
      texMat.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      // an oblique near plane on the water, so nothing under it is reflected
      plane.setFromNormalAndCoplanarPoint(n, wp).applyMatrix4(cam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const pm=cam.projectionMatrix;
      q.x=(Math.sign(clip.x)+pm.elements[8])/pm.elements[0];
      q.y=(Math.sign(clip.y)+pm.elements[9])/pm.elements[5];
      q.z=-1.0; q.w=(1.0+pm.elements[10])/pm.elements[14];
      clip.multiplyScalar(2.0/clip.dot(q));
      pm.elements[2]=clip.x; pm.elements[6]=clip.y; pm.elements[10]=clip.z+1.0; pm.elements[14]=clip.w;
      busy=true; water.visible=false;
      const was=renderer.getRenderTarget(), xr=renderer.xr.enabled, sh=renderer.shadowMap.autoUpdate;
      renderer.xr.enabled=false; renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true);
      if(renderer.autoClear===false) renderer.clear();
      renderer.render(scene, cam);
      renderer.xr.enabled=xr; renderer.shadowMap.autoUpdate=sh;
      renderer.setRenderTarget(was);
      water.visible=true; busy=false;
    };
    S.water={ mesh:water, mat, rt };
  }

  /* ------------------------------------------------------------ petals
     Blossom off the trees round the oculus, drifting down through it and
     on to the water. One Points object: each petal is a pink speck with a
     fall speed, a sway and a spin of its own, and goes back to the top
     when it reaches the pool. */
  let petalTex=null;
  function petalTexture(){
    if(petalTex) return petalTex;
    const N=32, c=document.createElement('canvas'); c.width=c.height=N;
    const x=c.getContext('2d');
    x.fillStyle='#ffe1ea'; x.beginPath(); x.ellipse(N/2,N/2,N*0.42,N*0.26,0.6,0,Math.PI*2); x.fill();
    x.fillStyle='rgba(240,150,180,0.8)'; x.beginPath(); x.ellipse(N*0.42,N*0.5,N*0.18,N*0.1,0.6,0,Math.PI*2); x.fill();
    petalTex=new THREE.CanvasTexture(c); petalTex.colorSpace=THREE.SRGBColorSpace;
    return petalTex;
  }
  const PETALS=220;
  function petals(O){
    const pos=new Float32Array(PETALS*3), seed=new Float32Array(PETALS*4);
    for(let i=0;i<PETALS;i++){
      const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*O.r;
      pos[i*3]=O.x+Math.cos(a)*r; pos[i*3+1]=Math.random()*(O.y+5); pos[i*3+2]=O.z+Math.sin(a)*r;
      seed[i*4]=0.35+Math.random()*0.5; seed[i*4+1]=Math.random()*6.28;
      seed[i*4+2]=0.4+Math.random()*0.8; seed[i*4+3]=a;
    }
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const pts=new THREE.Points(geo, new THREE.PointsMaterial({ map:petalTexture(), size:0.16,
      transparent:true, alphaTest:0.3, depthWrite:false }));
    pts.frustumCulled=false;
    S.g.add(pts);
    S.petals={ pts, pos, seed, O };
  }

  /* ------------------------------------------------------------- doves
     Three of them, wheeling slowly over the hole in the roof, because the
     picture this room was made from has doves in it and it is the thing
     that makes the sky up there a sky. A body and two wings that flap. */
  function doves(O){
    const white=new THREE.MeshLambertMaterial({color:0xf4f4f0});
    for(let i=0;i<3;i++){
      const d=new THREE.Group();
      const body=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6), white);
      body.scale.set(1,0.8,2.2); d.add(body);
      const wings=[-1,1].map(s=>{
        const w=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.22), white);
        w.material.side=THREE.DoubleSide;
        const pivot=new THREE.Group(); pivot.add(w); w.position.x=s*0.3;
        pivot.userData.s=s; d.add(pivot); return pivot;
      });
      d.userData={ wings, a:i*2.1, r:4+i*1.6, h:O.y+3+i*1.4, sp:0.35+i*0.08 };
      S.g.add(d); S.doves.push(d);
    }
  }

  /* -------------------------------------------------------------- tick */
  function tick(dt){
    if(!S) return;
    S.t+=dt;
    if(S.water) S.water.mat.uniforms.uTime.value=S.t;
    const p=S.petals;
    if(p){
      const {pos, seed, O}=p;
      for(let i=0;i<PETALS;i++){
        let y=pos[i*3+1]-seed[i*4]*dt;
        const ph=seed[i*4+1]+S.t*seed[i*4+2];
        if(y < O.y*0.0 + 0.25){                 // on the water: back to the trees
          y=O.y+2+Math.random()*3;
          const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*O.r*0.95;
          pos[i*3]=O.x+Math.cos(a)*r; pos[i*3+2]=O.z+Math.sin(a)*r;
        }
        pos[i*3]+=Math.sin(ph)*0.35*dt; pos[i*3+2]+=Math.cos(ph*0.8)*0.3*dt;
        pos[i*3+1]=y;
      }
      p.pts.geometry.attributes.position.needsUpdate=true;
    }
    const O=window.TEMPLE_LAYOUT.oculus;
    for(const d of S.doves){
      const u=d.userData; u.a+=u.sp*dt;
      d.position.set(O.x+Math.cos(u.a)*u.r, u.h+Math.sin(S.t*0.7+u.a)*0.6, O.z+Math.sin(u.a)*u.r);
      d.rotation.y=-u.a;
      const f=Math.sin(S.t*9+u.a*3)*0.7;
      u.wings.forEach(w=>{ w.rotation.z=w.userData.s*f; });
    }
  }

  function clear(){
    if(S && S.water){ S.water.rt.dispose(); S.water.mat.dispose(); }
    S=null;
  }

  return { build, tick, clear, get ready(){ return !!(S && S.model); } };
})();
