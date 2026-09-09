/* =====================================================================
   The ship, and nothing else that comes with it.

   public/shop.js owns the ship model in the full game, but it also owns
   five hulls, four cars, the wardrobe and a wallet, and it reaches for
   all of them. Flight School wants one ship in one colour and has no
   money in it, so this is the four lines of that file it actually uses,
   under the name school.js already asks for.

   The group comes back EMPTY and fills in when the file lands, exactly
   as it does in the game — the board is drawn the moment the level
   starts and cannot wait on a download. A lab machine that fails to
   fetch it gets the little cone school.js falls back to.
   ===================================================================== */
window.SHOP = (function(){
  const FILE='vendor/ships/ship.glb';
  const HULL=0xe8ecff;                // the Dart: the ship you start with
  const LEN=2.8;
  let req=null;

  function proto(){
    if(req) return req;
    req=new Promise((res,rej)=>{
      new THREE.GLTFLoader().load(FILE+'?v='+(window.ASSETV||'1'),
        g=>res(g.scene), undefined, rej);
    });
    return req;
  }

  function model(){
    const g=new THREE.Group();
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),
      new THREE.MeshBasicMaterial({color:0x8ff0ff, transparent:true, opacity:0.85}));
    glow.position.z=0.92; glow.scale.z=1.7; g.add(glow);
    g.userData.glow=glow; g.userData.isShip=true;

    proto().then(p=>{
      const o=p.clone(true);
      o.traverse(m=>{ if(!m.isMesh) return;
        m.material=m.material.clone();
        m.material.vertexColors=true;      // glTF multiplies the paint by this
        m.material.color.setHex(HULL);
        m.frustumCulled=false;
      });
      /* Authored nose-forward down +Z; every ship in this game flies down
         -Z, so it is turned here rather than in the file. */
      const spin=new THREE.Group(); spin.add(o); spin.rotation.y=Math.PI;
      spin.updateMatrixWorld(true);
      const b=new THREE.Box3().setFromObject(spin);
      const len=(b.max.z-b.min.z)||1;
      const c=b.getCenter(new THREE.Vector3());
      o.position.sub(c.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -Math.PI));
      spin.scale.setScalar(LEN/len);
      g.add(spin);
    }).catch(()=>{});                    // school.js has its own fallback shape

    return g;
  }

  return { model };
})();
