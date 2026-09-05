/* =====================================================================
   OWN — whose object is whose.

   Everybody's objects stand in everybody's room, and a mission hands the
   whole class the SAME ball.  So four people walk into the Workshop and
   there are four identical balls on the floor — and "walk up to the ball
   and press E" stops being an instruction and becomes a guess.

   This is the answer: a ring on the floor and a plate over the head of
   every object YOU own, and the owner's name over everybody else's.  Your
   own mark is mint — the same green "you" wears everywhere in this game —
   and theirs is sky blue, so the difference reads at a glance and from
   across the room, before you are close enough to read either name.

   The marks are not children of the objects they mark.  An object that
   turns, tilts or grows would drag its own label around with it, and a
   plate that swings under the floor when a ball rolls is worse than none.
   They live in the room and are placed from the object every frame.
   ===================================================================== */
window.OWN = (function(){
  const MINE   = 0xa8e6cf;      // --mint
  const THEIRS = 0x8fd3ff;      // --sky
  const NEAR   = 34;            // past this a plate is a smudge, so hide it
  const LOUD   = 4;             // plates on every object up to this many

  let marks=new Map();          // actor id -> { g, ring, plate, key }
  let holder=null;              // the room group the marks were built into

  /* ------------------------------------------------------------- drawing */
  /* One canvas per label, made once and kept — a sprite that redraws its own
     texture every frame is how you turn twenty objects into a slideshow. */
  function plate(text, hex){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    const s=String(text||'').slice(0,16);
    x.font='bold 25px "Trebuchet MS",sans-serif'; x.textAlign='center';
    const w=Math.min(248, x.measureText(s).width+30);
    x.fillStyle='rgba(14,20,34,.82)';
    x.beginPath();
    if(x.roundRect) x.roundRect(128-w/2, 16, w, 34, 9);
    else x.rect(128-w/2, 16, w, 34);        // older canvas: a square plate still reads
    x.fill();
    x.strokeStyle='#'+hex.toString(16).padStart(6,'0'); x.lineWidth=2.5; x.stroke();
    x.fillStyle='#'+hex.toString(16).padStart(6,'0');
    x.fillText(s, 128, 42);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true,
                                                         depthTest:false }));
    sp.scale.set(4.4,1.1,1);
    sp.renderOrder=6;                      // over the object, not inside it
    return sp;
  }
  /* A flat ring on the floor — TWO rings, in fact.  The Workshop floor is a
     pale mint green and so is the mark, which made the first version of this
     invisible on the one floor it had to work on.  A dark ring under it means
     the bright one always lands on something dark, whatever it is standing on.
     depthWrite off so it lies on the ground instead of fighting it for the
     same pixels. */
  function ring(hex, r){
    const g=new THREE.Group();
    const flat=(rad,tube,col,op)=>{
      const m=new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 44),
        new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:op,
                                      depthWrite:false }));
      m.rotation.x=-Math.PI/2; m.position.y=0.06;
      return m;
    };
    g.add(flat(r, 0.23, 0x1a1430, .62));       // the shadow it reads against
    g.add(flat(r, 0.13, hex, 1));              // and the mark itself
    return g;
  }

  /* ------------------------------------------------------ your own objects */
  /* Signed in, the plate says your name — which is what tells your ball from
     the four identical ones beside it.  A guest has no name to say, so it
     just says whose it is and leaves it at that. */
  const idOf = () => (window.NET && NET.me && NET.me.display) ? NET.me.display : null;
  /* the coach's own beacon is louder and points at the same thing — two
     markers on one ball reads as two balls */
  const coached = () => (window.COACH && COACH.pointingAt) ? COACH.pointingAt : null;

  function clear(){
    for(const [,mk] of marks) if(mk.g.parent) mk.g.parent.remove(mk.g);
    marks.clear(); holder=null;
  }

  /* NAV builds the corridors without clearing G.room, so "the free room" on
     its own is not enough to go on — ask the modes that take the screen over
     whether one of them is running, or a mark turns up in the Escape maze. */
  const elsewhere = () =>
       (window.NAV && NAV.active) || (window.PUZZLE && PUZZLE.active)
    || (window.TUTOR && TUTOR.active) || (window.RACE && RACE.active);

  function update(dt){
    if(typeof G==='undefined' || G.room!=='free' || !G.roomGroup || !window.VM
       || elsewhere())
      return clear();
    // a rebuilt room threw the old marks away with it
    if(holder!==G.roomGroup){ marks.clear(); holder=G.roomGroup; }

    const mission = window.MISSIONS ? MISSIONS.active : null;
    const shared  = !!(window.NET && NET.live);
    // Mark ownership wherever ownership is in question: always during a
    // mission, and always in a room somebody else is standing in.
    if(!mission && !shared) return clear();

    const mine=VM.project.actors.filter(a=>!a.isClone && a.visible!==false);
    const who=idOf();
    const named = mission ? (who ? who+' · '+t('YOURS') : t('YOURS'))
                          : (who || t('YOURS'));
    // a sandbox with forty objects does not want forty name plates
    const wantPlate = !!mission || mine.length<=LOUD;
    const skip=coached();
    const live=new Set();

    mine.forEach(a=>{
      if(a===skip) return;                       // the coach has this one
      live.add(a.id);
      const size=Math.max(0.6, a.size||1);
      const key=named+'|'+wantPlate+'|'+size.toFixed(2);
      let mk=marks.get(a.id);
      if(mk && mk.key!==key){ if(mk.g.parent) mk.g.parent.remove(mk.g); mk=null; }
      if(!mk){
        const g=new THREE.Group();
        const rg=ring(MINE, size*1.15+0.35);
        g.add(rg);
        let pl=null;
        if(wantPlate){ pl=plate(named, MINE); g.add(pl); }
        G.roomGroup.add(g);
        mk={ g, ring:rg, plate:pl, key };
        marks.set(a.id, mk);
      }
      place(mk, a.x, a.y, a.z, size);
    });
    for(const [id,mk] of marks) if(!live.has(id)){
      if(mk.g.parent) mk.g.parent.remove(mk.g);
      marks.delete(id);
    }
    spin(dt);
  }
  /* the ring sits on the floor under the object; the plate rides above it */
  function place(mk, x, y, z, size){
    mk.g.position.set(x, 0, z);
    if(mk.plate){
      mk.plate.position.set(0, (y||1)+size*0.6+1.05, 0);
      mk.plate.visible = dist(x,z) < NEAR;
    }
  }
  /* A torus is symmetric about its own axis, so spinning one is invisible
     work.  A slow breath in and out is not, and it is what makes the mark
     read as a marker rather than as a shape somebody painted on the floor. */
  let beat=0;
  function spin(dt){
    beat += (dt||0.016);
    const k=1+Math.sin(beat*2)*0.045;
    for(const [,mk] of marks){ mk.ring.scale.set(k,1,k); }
  }
  const dist=(x,z)=> (typeof G==='undefined') ? 0
        : Math.hypot(G.pos.x-x, G.pos.z-z);

  return { update, clear, plate, dist,
           MINE, THEIRS, NEAR,
           get owner(){ return idOf(); } };
})();
