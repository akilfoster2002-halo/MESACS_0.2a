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

  /* Cars come out of the Kenney racing kit that is already in the repo.
     The first one is FREE and yours from the start — a shop where every
     shelf is locked is a shop nobody learns to use, and everybody should
     find out on day one that you can drive around your own planet. */
  const CARS=[
    { id:'car_red',    name:'Scarlet', price:0,   file:'racing/raceCarRed.glb',    a:'#ff9aa2',
      blurb:'Yours already. Twice walking pace.' },
    { id:'car_white',  name:'Chalk',   price:150, file:'racing/raceCarWhite.glb',  a:'#e8ecff',
      blurb:'The same car in a quieter coat.' },
    { id:'car_orange', name:'Ember',   price:260, file:'racing/raceCarOrange.glb', a:'#ffd8a8',
      blurb:'Louder than it needs to be.' },
    { id:'car_green',  name:'Clover',  price:340, file:'racing/raceCarGreen.glb',  a:'#a8e6cf',
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
  function model(k){
    const K=k||ship();
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
    // small, and tucked into the tail: a big one sits between the camera and
    // the ship and is the only thing you can see
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),
      new THREE.MeshBasicMaterial({color:0x8ff0ff, transparent:true, opacity:0.85}));
    glow.position.z=0.92; glow.scale.z=1.7; g.add(glow);
    g.userData.glow=glow;
    return g;
  }
  return { SHIPS, CARS, charItems, shipById, carById, ship, car, model,
           ownsShip, ownsCar, ownsChar, equip, buy, FREE_CHARS };
})();
