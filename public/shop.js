/* =====================================================================
   SHOP — what your coins are for.

   Three shelves, and everything on them is something you can SEE:

     CHARACTERS  who you are, everywhere in the game
     SHIPS       what you fly in Space Explorer
     CARS        what you drive around the planet

   Nothing here changes how hard anything is. A bought ship is a paint
   job and a bought car is a faster walk on a world with nothing to race
   — so a student who never spends a coin is never behind one who does.
   That is deliberate: the shop is a reason to look at what you earned,
   not a second way to win.

   The four starting characters stay free. Everything else has a price,
   and the price is roughly what one mission pays, so the first thing you
   buy is always in reach and the last one is worth saving for.
   ===================================================================== */
window.SHOP = (function(){

  /* Ships are built from primitives rather than loaded, because there is no
     space kit in the assets — so a "skin" here is a shape and two colours,
     and flight.js builds whichever one you own. */
  const SHIPS=[
    { id:'ship_dart',   name:'Dart',    price:0,   hull:0xe8ecff, trim:0x8fd3ff, wing:1.25, nose:1.5,
      blurb:'The one you start with. Light, plain, quick.' },
    { id:'ship_ember',  name:'Ember',   price:120, hull:0xffb4a2, trim:0xff9aa2, wing:1.5,  nose:1.8,
      blurb:'Longer nose, wider wings, the colour of a re-entry.' },
    { id:'ship_mint',   name:'Sprig',   price:160, hull:0xa8e6cf, trim:0x6fae7a, wing:1.1,  nose:2.1,
      blurb:'A needle. Narrow wings and a very long nose.' },
    { id:'ship_violet', name:'Vesper',  price:220, hull:0xcdb4f6, trim:0x7c5cc4, wing:1.75, nose:1.3,
      blurb:'Broad and heavy looking, though it flies the same.' },
    { id:'ship_gold',   name:'Sovereign',price:400, hull:0xffe9a8, trim:0xd9a600, wing:1.6, nose:2.4,
      blurb:'Gold. Entirely unnecessary, which is the point.' }
  ];

  /* Cars are ONE MODEL IN FOUR COLOURS, the way the ships are — the paint
     lives on a single material in the file and `paint` is what gets put on
     it.  They used to be four separate models out of the Kenney racing kit;
     those files are still in the repo because the Workshop's catalogue
     offers them as props a student can place, and pulling them would empty
     that shelf out of saved builds.  They are just no longer what you
     drive.

     The first one is FREE and yours from the start — a shop where every
     shelf is locked is a shop nobody learns to use, and everybody should
     find out on day one that you can drive around your own planet. */
  const CARS=[
    { id:'car_red',    name:'Scarlet', price:0,   paint:0xd42a35, a:'#ff9aa2',
      blurb:'Yours already. Twice walking pace.' },
    { id:'car_white',  name:'Chalk',   price:150, paint:0xe9edf5, a:'#e8ecff',
      blurb:'The same car in a quieter coat.' },
    { id:'car_orange', name:'Ember',   price:260, paint:0xf0761c, a:'#ffd8a8',
      blurb:'Louder than it needs to be.' },
    { id:'car_green',  name:'Clover',  price:340, paint:0x2f9d55, a:'#a8e6cf',
      blurb:'The one everybody wants and nobody has yet.' }
  ];

  /* Characters: the first four are yours, the rest are for sale. They used
     to be locked with no way to earn them, which is a promise the game never
     kept — now the ??? has a price on it. */
  const FREE_CHARS=4;
  function charItems(){
    if(!window.AVATAR) return [];
    return AVATAR.CHARS.map((c,i)=>({
      id:'char_'+c.id, charId:c.id, name:c.name, preview:c.preview,
      price: i<FREE_CHARS ? 0 : 90 + Math.floor((i-FREE_CHARS)/3)*40,
      blurb:'' }));
  }

  const shipById = id => SHIPS.find(s=>s.id===id) || SHIPS[0];
  const carById  = id => CARS.find(c=>c.id===id) || null;

  /* what you have equipped, per shelf */
  const EQ_SHIP='w_ship', EQ_CAR='w_car';
  const ship = () => shipById(PROGRESS.get(EQ_SHIP,'ship_dart'));
  const car  = () => carById(PROGRESS.get(EQ_CAR,null));

  const ownsShip = s => s.price===0 || WALLET.has(s.id);
  const ownsCar  = c => !!c && (c.price===0 || WALLET.has(c.id));
  const ownsChar = it => it.price===0 || WALLET.has(it.id);

  function equip(id){
    if(id && id.indexOf('ship_')===0) PROGRESS.set(EQ_SHIP, id);
    else if(id && id.indexOf('car_')===0) PROGRESS.set(EQ_CAR, PROGRESS.get(EQ_CAR)===id ? null : id);
    else if(id && id.indexOf('char_')===0){
      const it=charItems().find(x=>x.id===id);
      if(it && window.AVATAR) AVATAR.pick(it.charId);
    }
  }
  /* buy, if you can afford it. Returns why not, so the shelf can say so. */
  function buy(id, price){
    if(WALLET.has(id)) return 'owned';
    if(WALLET.coins() < price) return 'poor';
    if(!WALLET.spend(price)) return 'poor';
    WALLET.give(id);
    return 'bought';
  }

  /* The ship, as an object. It used to be built inside flight.js and nowhere
     else, which was fine while the only place you ever saw your ship was
     from behind it — but a showroom that sold you a different shape from the
     one you flew would be a lie told in three dimensions. */
  /* THE SHIP IS A MODEL NOW, not five boxes. One file, tinted per hull —
     glTF multiplies the vertex colours by the material colour, so the gold
     and the blue canopy survive and each ship in the shop still reads as
     its own. The Dart's hull is nearly white, so the one you start with is
     the ship exactly as it was painted.

     It is loaded ONCE and cloned, and the group comes back empty and fills
     in when the file lands — every caller here adds the result to a scene
     immediately and none of them can wait. The primitives are still below
     as the fallback: a lab machine that cannot fetch the model gets the
     old blocky ship rather than an invisible one. */
  const SHIP_FILE='ships/ship.glb';
  const SHIP_LEN=2.8;                 // about as long as the boxes it replaces
  let shipReq=null;
  function shipProto(){
    if(shipReq) return shipReq;
    shipReq=new Promise((res,rej)=>{
      new THREE.GLTFLoader().load(SHIP_FILE+'?v='+(window.ASSETV||'1'),
        g=>res(g.scene), undefined, rej);
    });
    return shipReq;
  }
  function model(k){
    const K=k||ship();
    const g=new THREE.Group();
    /* The engine flare belongs to the group, not to the model: flight.js
       reaches for userData.glow the moment it has a ship, and it cannot be
       waiting on a download to find it. */
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),
      new THREE.MeshBasicMaterial({color:0x8ff0ff, transparent:true, opacity:0.85}));
    glow.position.z=0.92; glow.scale.z=1.7; g.add(glow);
    g.userData.glow=glow;
    /* `glow` alone does not mean "ship" — the planet's doors and panels
       carry one too, for the look-at highlight. This says what it is. */
    g.userData.isShip=true;
    shipProto().then(proto=>{
      const o=proto.clone(true);
      o.traverse(m=>{ if(!m.isMesh) return;
        m.material=m.material.clone();
        m.material.vertexColors=true;
        m.material.color.setHex(K.hull);         // the shop's tint, over the paint
        m.frustumCulled=false;
      });
      /* The file was authored nose-forward down +Z; every ship in this game
         flies down -Z, so it is turned here rather than in the asset. */
      const spin=new THREE.Group(); spin.add(o); spin.rotation.y=Math.PI;
      spin.updateMatrixWorld(true);
      const b=new THREE.Box3().setFromObject(spin);
      const len=(b.max.z-b.min.z)||1;
      const c=b.getCenter(new THREE.Vector3());
      o.position.sub(c.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -Math.PI));
      spin.scale.setScalar(SHIP_LEN/len);
      g.add(spin);
    }).catch(()=>{ g.add(boxes(K)); });
    return g;
  }
  /* ------------------------------------------------------------- THE CAR
     One builder for every car in the game: the showroom's plinths, the one
     you drive round the planet, the one you take round the Circuit and the
     one your classmates see you in.  They used to be three separate loads
     in two files at two different scales, which is three chances for a car
     to look like a different car depending on where you met it.

     The model is parsed ONCE and cloned per car.  Cloning shares the
     geometry, which is the whole point at seventy-five thousand triangles
     — only the paint material is cloned, because that is the only thing
     that differs between a Scarlet and a Clover. */
  const CAR_FILE='racing/mclaren.glb';
  /* How long a car reads, in world units.  A character stands 1.85 units
     tall, so a unit is about a metre and this is roughly the 4.5 m the real
     car is — it used to be 3.4, which is a metre and a half short and read
     as a toy parked next to somebody. */
  const CAR_LEN=4.6;
  const CAR_BODY='body';          // car-build.js folds the five paint materials into this one
  const CAR_WHEELS=['wheelFrontLeft','wheelFrontRight','wheelBackLeft','wheelBackRight'];
  let carReq=null;
  function carProto(){
    if(carReq) return carReq;
    carReq=new Promise((res,rej)=>{
      new THREE.GLTFLoader().load(CAR_FILE+'?v='+(window.ASSETV||'1'),
        g=>res(g.scene), undefined, rej);
    });
    return carReq;
  }
  /* `paint` is a colour rather than a car id: the Circuit keeps its own
     garage with its own ids and its own way of unlocking them, and neither
     list should have to know about the other to ask for a red car. */
  function carModel(paint, len){
    return carProto().then(proto=>{
      const o=proto.clone(true);
      o.traverse(m=>{ if(!m.isMesh) return;
        m.frustumCulled=false;
        if(m.material && m.material.name===CAR_BODY){
          m.material=m.material.clone();
          m.material.color.setHex(paint===undefined ? CARS[0].paint : paint);
        }
      });
      const holder=new THREE.Group();
      holder.add(o);
      /* Sized by its length, so a car is the same size in the showroom and
         on the road however long the model happens to be. */
      holder.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(holder);
      const l=Math.max(0.001, box.max.z-box.min.z);
      o.scale.multiplyScalar((len||CAR_LEN)/l);
      /* AND THEN STOOD ON THE FLOOR.  A model's origin is wherever its
         author left it — this one sits a little under the sills rather than
         at the tyres — so every caller was adding a hand-picked lift to get
         the wheels down, and every one of them was picked for a different
         car.  Measure the bottom and drop it to zero here instead, and then
         holder y=0 IS the contact patch: put the holder on the ground and
         the wheels are on the ground. */
      holder.updateMatrixWorld(true);
      o.position.y -= new THREE.Box3().setFromObject(holder).min.y;
      /* The Circuit turns these. The asset carries the names the game has
         always looked for, so this is a lookup and not a translation. */
      holder.userData.wheels=CAR_WHEELS.map(n=>o.getObjectByName(n)).filter(Boolean);
      return holder;
    });
  }

  /* The old ship, kept as the fallback. */
  function boxes(K){
    const g=new THREE.Group();
    const hull=new THREE.MeshLambertMaterial({color:K.hull});
    const trim=new THREE.MeshLambertMaterial({color:K.trim});
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.42,K.nose,10), hull);
    nose.rotation.x=-Math.PI/2; nose.position.z=-(0.25+K.nose/2); g.add(nose);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.86,0.5,1.7), hull));
    [-1,1].forEach(s=>{
      const w=new THREE.Mesh(new THREE.BoxGeometry(K.wing,0.14,0.8), trim);
      w.position.set(s*(K.wing*0.72), -0.06, 0.3); w.rotation.z=s*0.12; g.add(w);
      const f=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.5,0.5), trim);
      f.position.set(s*(K.wing*1.12), 0.2, 0.5); g.add(f);
    });
    return g;
  }
  return { SHIPS, CARS, charItems, shipById, carById, ship, car, model, carModel,
           ownsShip, ownsCar, ownsChar, equip, buy, FREE_CHARS };
})();
