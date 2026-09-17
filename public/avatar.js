/* =====================================================================
   AVATAR — third-person character (Kenney Blocky Characters, CC0).
   The camera rides behind the player's shoulder like Roblox; the crosshair
   still aims from the camera, so shooting works exactly as before.

   Each character is parsed fresh from the same downloaded bytes instead of
   being cloned: this build of three has no SkeletonUtils, and a plain
   clone would share one skeleton, so every guard would walk the player's
   walk.  Parsing again is cheap — the file is only fetched once.
   ===================================================================== */
window.AVATAR = (function(){
  // order matters: chars.js unlocks the first FREE of these
  /* FOUR PEOPLE, ALL OF THEM PROPERLY MADE.

     There used to be twenty: Kyle, Mia, and eighteen out of the Kenney
     blocky kit. The kit characters were what this game had before it had
     anybody, and they are four bones and an idle — they cannot walk
     convincingly, cannot dance, and stand next to Kyle looking like a
     placeholder, because that is what they were. Nineteen choices of
     placeholder is not more choice than one good one.

     So the roster is the rigged characters — Kyle, Mia, Savannah and
     Carlos — all on the same skeleton, the same clips and the same scale
     (see "glb files"/README.md for how one gets here). Kyle leads: he is
     the character this game is about, and he is the one you are unless you
     say otherwise, which is now a keypress rather than a walk to the Mall. */
  /* ROBIN IS ON THE ROSTER NOW, and she is on it as a character rather
     than as a costume the game puts you in. See the paragraph below for
     what that used to mean and why it changed. */
  const IDS = 'stuvw'.split('');
  const NAMES = { s:'Kyle', t:'Mia', u:'Savannah', v:'Carlos', w:'Robin' };
  /* ?v= on the asset, not just on the script. Without it a changed model
     is invisible for a day behind the server's cache header. */
  const V = ()=> '?v='+(window.ASSETV||'1');
  const CHARS = IDS.map(c=>({ id:c, name:NAMES[c] || ('Character '+c.toUpperCase()),
    model:`characters/models/character-${c}.glb`+V(),
    preview:`characters/previews/character-${c}.png`+V() }));
  /* ------------------------------------------------- bodies off the roster
     ROBIN USED TO BE SOMEBODY YOU COULD NOT PICK. She was not a fifth
     shirt in the Mall, she was not for sale and nobody chose her: she was
     what RYU turned you into, and the only way to be her was to stand on
     it. The whole story was written for a girl called Robin and every
     mission on that ball quietly replaced whoever you had spent the game
     becoming.

     THAT IS THE WRONG TRADE. A student picks a character, wears it for
     six missions, walks onto the one ball where the story happens — and
     is somebody else, with somebody else's name in every line of
     dialogue. The character they chose is the one thing in this game that
     is theirs before they have earned anything, and a cutscene is a poor
     reason to take it off them.

     So Robin is on the roster like everybody else, and RYU no longer
     casts anybody. You arrive as who you are, Ion says YOUR name, and if
     you want to be Robin you can be — by choosing her, which is the only
     way anybody becomes anybody else in this game.

     BODIES STAYS. It is everything the game can stand up, which is the
     roster plus anything a place hands out, and a place may still hand
     one out; nothing does today. Keeping the two words costs a line and
     collapsing them would have to be undone by whoever next writes a
     scene that needs a body nobody owns. */
  const CAST_ONLY = [];
  const CAST_NAMES = {};
  /* ------------------------------------------------ people with names
     NOT EVERY BODY IS A LETTER. The roster is `character-<letter>.glb`
     because it is a roster — a numbered set of shirts somebody picks
     from. Ion is a robot on a kitchen floor and the Mechanic is a man in
     a tweed suit; neither is a shirt, neither is pickable, and giving
     them letters would put them in a sequence they are not part of.

     AND `load()` FALLS BACK SILENTLY, which is the right thing to do with
     a typo — a body that fails to resolve should be the wrong person,
     never a hole in the world — and a trap for a body that exists and is
     simply not listed. `AVATAR.load('ion')` fetched Kyle, and what lay on
     the Mechanic's cradle at the end of Mission 8 was Kyle, face up,
     being called Ion by everybody in the room.

     ION IS STILL NOT HERE, and that is deliberate. He is a PROP: a robot
     a room stands up and lays on a table, not a body anybody wears or is
     cast as, and he comes up to the chest of a person rather than being
     normalised to one's height. house.js loads him with its own loader
     for exactly that reason and planet.js now does the same. What belongs
     in this list is what the game may put a PERSON in. */
  const NAMED = [
    { id:'mechanic', name:'The Mechanic',
      model:'characters/models/mechanic.glb'+V(),
      preview:'characters/previews/mechanic.png'+V() }
  ];
  const BODIES = CHARS.concat(CAST_ONLY.map(c=>({
    id:c, name:CAST_NAMES[c] || ('Character '+c.toUpperCase()),
    model:`characters/models/character-${c}.glb`+V(),
    preview:`characters/previews/character-${c}.png`+V() })))
    .concat(NAMED);
  /* Anything the game may have to STAND UP, roster or not. load() asks
     this; the Mall asks CHARS. A miss still falls back to the first
     character rather than throwing — a body that fails to resolve should
     be the wrong person, never a hole in the world. */
  const bodyDef = id => BODIES.find(c=>c.id===id) || CHARS[0];

  const BASE = 'characters/models/';     // so the .glb finds its texture
  const TALL = 1.85;                     // how tall a person stands, in world units
  const HELD = 0.70;                     // and how long the blaster in their hand reads

  const BLASTER='blasters/blaster-g.glb';
  const bytes=new Map();
  let loader=null, gunProto=null;

  function file(id){
    const def = bodyDef(id);
    if(!bytes.has(def.id))
      bytes.set(def.id, fetch(def.model).then(r=>{
        if(!r.ok) throw new Error('missing '+def.model);
        return r.arrayBuffer();
      }));
    return bytes.get(def.id);
  }

  async function load(id){
    loader = loader || new THREE.GLTFLoader();
    const buf = await file(id);
    const g = await new Promise((res,rej)=>
      loader.parse(buf.slice(0), BASE, res, rej));
    const root = g.scene;
    root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; o.frustumCulled=false; }
      /* a model that carries its colour in the mesh rather than in a
         texture has to be told to use it */
      if(o.isMesh && o.geometry.attributes.color){ o.material.vertexColors=true;
                                                   o.material.needsUpdate=true; } });
    // the kit models at its own scale — stand everyone the same height
    /* MEASURE THE WORLD, NOT THE INTENTION. setFromObject reads each
       child's matrixWorld, and straight out of the loader those are all
       identity — so any scale sitting on the model's own root node is not
       counted and the height comes back wrong. The kit models happen to
       carry no root scale, which is why this never showed; a model that
       has been through FBX comes back a hundredth of its size with the
       correction on the root, and without this it is normalised from the
       wrong number. */
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y;
    /* Any positive height is a height. The old floor of 0.1 was there to
       dodge a divide by zero and instead became a silent way to fail: a
       model that arrives a hundredth of a unit tall — which is exactly
       what comes back from FBX — fell under it, was left unscaled, and
       rendered as an invisible speck with no error anywhere. */
    if(h > 1e-6) root.scale.setScalar(TALL / h);
    else console.warn('character has no height, cannot scale:', id);
    root.userData.rig = rig(root, g.animations||[]);
    return root;
  }

  /* The blaster the character is actually carrying.  The one in GUN hangs
     off the camera and only exists in first person, so in third person the
     player was holding nothing at all. */
  function blaster(){
    if(!gunProto){
      loader = loader || new THREE.GLTFLoader();
      gunProto = new Promise((res,rej)=>loader.load(BLASTER, g=>res(g.scene), undefined, rej));
    }
    return gunProto;
  }
  async function equip(root){
    const arm=root.getObjectByName('arm-right');
    if(!arm) return null;
    let src;
    try{ src=await blaster(); }catch(e){ return null; }
    const gun=src.clone(true);
    // the arm carries the whole body's normalising scale — divide it back out
    // so the blaster is sized in world units rather than character units
    const ws=new THREE.Vector3(); arm.getWorldScale(ws);
    const k=1/(ws.x||1);
    const box=new THREE.Box3().setFromObject(gun);
    const len=Math.max(0.001, box.max.z-box.min.z);
    gun.scale.setScalar((HELD/len)*k);
    gun.rotation.y = Math.PI;              // the model's muzzle is -Z, the body faces +Z

    /* Put it in the HAND.  Guessed offsets land wherever the rig happens to
       put its origin, so read the arm's own geometry and hang the blaster off
       the far end of it, on the outside of the body. */
    let limb=null; arm.traverse(o=>{ if(!limb && o.isMesh && o.geometry) limb=o; });
    if(limb){
      limb.geometry.computeBoundingBox();
      const b=limb.geometry.boundingBox;
      const midX=(b.min.x+b.max.x)/2;
      const outX=Math.abs(b.min.x)>Math.abs(b.max.x) ? b.min.x : b.max.x;
      gun.position.set(midX + (outX-midX)*0.45,       // outboard, clear of the hip
                       b.min.y + (b.max.y-b.min.y)*0.10,  // down at the hand
                       b.max.z + 0.04);               // just in front of the arm
    } else {
      gun.position.set(-0.28*k, -0.90*k, 0.24*k);
    }
    gun.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    arm.add(gun);
    return gun;
  }

  /* ----------------------------------------------------------- swimming
     THESE CHARACTERS HAVE NO SWIM ANIMATION. Six clips each — idle, walk,
     sprint, jump, dance, fly — and swimming is not one of them, so the first
     version of this borrowed `fly` and you could tell: the body was right,
     lying flat in the water, but the arms were pinned out in front of it in
     a superman pose and nothing moved. A person floating rigidly across a
     pool is not swimming, they are drowning politely.

     So the clip is BUILT, here, out of the rig the characters already carry.
     It is a plain Mixamo skeleton with names we can rely on, and an
     AnimationClip is only keyframes — there is nothing to import.

     THE FLY POSE IS THE STARTING POSITION AND NOTHING ELSE. What it is
     genuinely right about is the torso: face down, spine level, legs
     trailing. So every bone starts from fly's first frame and the limbs are
     then driven over the top of it — a front crawl, because at the distance
     you see a swimmer in this game an alternating overarm is legible and a
     breaststroke is a shrug.

     The whole stroke is one loop: arms opposed, legs fluttering at twice the
     rate, and a roll through the spine tied to the arms, because a crawl
     without the roll looks like somebody being dragged. */
  const SWIM_SECS=2.8, SWIM_KEYS=28;
  function buildSwim(clips){
    const fly=clips.find(c=>c.name==='fly');
    if(!fly || typeof THREE.QuaternionKeyframeTrack!=='function') return null;

    const base={}, keep=[];
    for(const tr of fly.tracks){
      const q=tr.name.match(/^(.*)\.quaternion$/);
      if(q){ base[q[1]]=[tr.values[0],tr.values[1],tr.values[2],tr.values[3]]; continue; }
      /* Position and scale are HELD at the first frame. Without them the
         hips drift wherever the fly clip was taking them and the swimmer
         slowly climbs out of the water. */
      const n=tr.values.length / (tr.times.length||1);
      keep.push(new tr.constructor(tr.name, [0, SWIM_SECS],
        [...tr.values.slice(0,n), ...tr.values.slice(0,n)]));
    }
    if(!Object.keys(base).length) return null;

    const times=[];
    for(let i=0;i<=SWIM_KEYS;i++) times.push(i/SWIM_KEYS*SWIM_SECS);
    const tracks=[...keep];
    const B=new THREE.Quaternion(), O=new THREE.Quaternion(), AX=new THREE.Vector3();
    const moved=new Set();

    /* `fn(u)` returns [axis x,y,z, angle] for that point in the stroke. */
    function drive(bone, fn){
      const bv=base[bone]; if(!bv) return;
      moved.add(bone);
      const vals=[];
      for(let i=0;i<=SWIM_KEYS;i++){
        const [ax,ay,az,ang]=fn(i/SWIM_KEYS);
        B.set(bv[0],bv[1],bv[2],bv[3]);
        O.setFromAxisAngle(AX.set(ax,ay,az).normalize(), ang);
        B.multiply(O);
        vals.push(B.x,B.y,B.z,B.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(bone+'.quaternion', times, vals));
    }
    const TAU=Math.PI*2;
    // the two arms, half a stroke apart
    [['Left',0],['Right',0.5]].forEach(([side,ph])=>{
      const sgn = side==='Left' ? 1 : -1;
      drive('mixamorig:'+side+'Arm', u=>{
        const a=(u+ph)%1;
        return [1,0,0, Math.sin(a*TAU)*1.15];        // the windmill
      });
      drive('mixamorig:'+side+'ForeArm', u=>{
        const a=(u+ph)%1;
        // the elbow bends on the recovery and straightens on the catch
        return [1,0,0, 0.45 + Math.max(0, Math.sin(a*TAU+1.2))*0.75];
      });
      drive('mixamorig:'+side+'Shoulder', u=>{
        const a=(u+ph)%1;
        return [0,0,1, sgn*Math.sin(a*TAU)*0.18];
      });
      // and the legs, fluttering at twice the rate and a quarter the size
      drive('mixamorig:'+side+'UpLeg', u=>{
        const a=(u+ph)%1;
        return [1,0,0, Math.sin(a*TAU*2)*0.30];
      });
      drive('mixamorig:'+side+'Leg', u=>{
        const a=(u+ph)%1;
        return [1,0,0, 0.18 + Math.max(0, Math.sin(a*TAU*2+0.9))*0.34];
      });
    });
    // the roll, spread down the spine so it reads as the body and not the chest
    [['mixamorig:Spine',0.10],['mixamorig:Spine1',0.10],['mixamorig:Spine2',0.08]]
      .forEach(([bone,amt])=>drive(bone, u=>[0,0,1, Math.sin(u*TAU)*amt]));
    // the head lifts for air on one side of the stroke
    drive('mixamorig:Head', u=>[0,1,0, Math.sin(u*TAU)*0.30]);

    /* Everything the stroke does NOT move is pinned to the fly pose, or the
       mixer leaves it wherever the last clip put it — which is a swimmer
       with a walking man's shoulders. */
    Object.keys(base).forEach(bone=>{
      if(moved.has(bone)) return;
      const v=base[bone];
      tracks.push(new THREE.QuaternionKeyframeTrack(bone+'.quaternion',
        [0, SWIM_SECS], [...v, ...v]));
    });
    const clip=new THREE.AnimationClip('swim', SWIM_SECS, tracks);
    return clip;
  }

  /* Only if the rig has nothing to build one from. */
  const ALIAS={ swim:'fly' };
  /* idle / walk / sprint, crossfaded so nobody pops between poses */
  function rig(root, clips){
    if(!clips.length) return null;
    /* The swim is authored per model, because it is built out of that
       model's own fly pose and its own bone names. */
    if(!clips.some(c=>c.name==='swim')){
      const sw=buildSwim(clips);
      if(sw) clips=clips.concat(sw);
    }
    const mixer=new THREE.AnimationMixer(root);
    let cur=null, curName=null;
    return {
      play(name, fade){
        /* A POSTURE MAY NAME A CLIP THE MODEL HAS NOT GOT. These four
           characters carry six animations and none of them is a swim, so
           swimming asks for 'swim' and is given 'fly' — which is the right
           substitute and not a lazy one: both are the body held HORIZONTAL
           with the legs trailing, which is the whole difference between a
           person in water and a person standing in it. The day a real swim
           clip is baked into the characters, this alias stops being used
           without anything else changing. */
        name = ALIAS[name] && !clips.some(c=>c.name===name) ? ALIAS[name] : name;
        if(curName===name) return;
        const clip=clips.find(c=>c.name===name);
        if(!clip) return;
        const next=mixer.clipAction(clip);
        next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
        if(cur) cur.fadeOut(fade===undefined?0.18:fade);
        cur=next; curName=name;
      },
      update(dt){ mixer.update(dt); },
      /* An emote can only be offered by a character who actually has one,
         and it has to know how long to hold before handing control back. */
      has(name){ return clips.some(c=>c.name===name); },
      seconds(name){ const c=clips.find(x=>x.name===name); return c?c.duration:0; }
    };
  }
  /* KEEP BREATHING WHILE THE WORLD IS HELD STILL. Whatever normally drives
     the player's body does it from inside the block a frozen world skips,
     so a panel that freezes the game to ask you something leaves a statue
     of yourself standing behind it. The quick change is exactly that panel,
     and what it is asking you to look at is a character. */
  function idle(dt){ if(model) animate(model, dt||0, 'idle'); }
  /* CAN THE BODY YOU ARE WEARING DO THIS? play() leaves the current clip
     alone when it cannot find the name — which is the right thing to do
     and is also completely silent, so asking for a clip a model has not
     got looks exactly like the clip playing and doing nothing. That cost
     an afternoon once: the flying animation was in the file, and the
     browser was serving yesterday's copy of the file from cache. */
  function can(name){
    const r = model && model.userData && model.userData.rig;
    return !!(r && r.has(name));
  }

  /* drive anything that came out of load() — the player, a guard, anyone */
  function animate(obj, dt, name){
    const r = obj && obj.userData && obj.userData.rig;
    if(!r) return;
    if(name) r.play(name);
    r.update(dt||0);
  }

  /* who the player is */
  /* Everybody starts as SOMEBODY. Nobody has to pick a character before they
     are allowed to play — the first time you arrive you are handed one of the
     free four at random and the Wardrobe is where you change it. A saved
     choice always wins, so this only ever fires once. */
  const FREE_AT_START = 4;
  let chosen = null;
  try{ chosen = localStorage.getItem('dq_char'); }catch(e){}
  if(!chosen || !CHARS.some(c=>c.id===chosen)){
    /* Not a random one of the free four any more. There is a main
       character now, and being handed somebody else on your first run
       made the Wardrobe a chore before it was a choice. */
    chosen = CHARS[0].id;
    try{ localStorage.setItem('dq_char', chosen); }catch(e){}
  }
  /* ------------------------------------------------------------- the cast
     A PLACE CAN DECIDE WHO EVERYBODY IS. Walk onto the world that sets one
     and you are Robin; walk off it and you are whoever you picked, still,
     because this never touches the choice — `chosen` is what you own and
     what the Mall and the roster talk about, and the cast is only what is
     standing in the room.

     Which is the whole reason it is a separate word. Forcing the body by
     calling pick() would have worked exactly once: it writes to the save
     bag, so the first visit would have quietly sold the player's own
     character and given them no way to notice, let alone refuse.

     It applies to PLAYERS — you, and everybody else out on the same ball,
     since paint() resolves their bodies through here too. The scenery
     keeps its own faces: a planet where the librarian and the guard and
     the three people on the dance floor are all the same character is not
     a cast, it is a bug that renders. */
  let cast = null;
  const bodyOf = id => cast || id;
  function setCast(id){
    /* Against BODIES and not the roster, or the one character this exists
       to put on nobody would be the one character it refuses. */
    const next = (id && BODIES.some(c=>c.id===id)) ? id : null;
    if(next===cast) return cast;
    cast=next;
    if(body) attach();          // change who is standing there, now, not next room
    return cast;
  }

  /* SOMEBODY WHO IS NOT YOU. The librarian, the guard on his beat and the
     resident behind the decks all want a body that is not the one the
     player is wearing — two of you in a room is a bug, not a cast. With a
     roster of two that is simply the other one; the modulo is there so it
     stays true if a third is ever added. */
  function other(offset){
    const i=CHARS.findIndex(c=>c.id===chosen);
    return CHARS[((i<0?0:i) + (offset||1) + CHARS.length) % CHARS.length].id;
  }
  function pick(id){
    chosen=id;
    try{ localStorage.setItem('dq_char',id); }catch(e){}
    /* PUT IT ON NOW. pick() used to do nothing but write the choice down,
       so the body already standing in the world went on being whoever it
       was until something else happened to rebuild the room — which in
       practice meant reloading the game. Every way of changing character
       ends up here: the Mall's grid, the mannequins you walk up to, and
       the shop when you buy one. So this is the one place it has to
       happen, and now it does. */
    if(body) attach();
    /* RECORD the choice; do not COMPLETE it. complete() is the mission
       payout path — it hands over coins and XP, at a quarter rate on a
       repeat — so changing your character paid you fifteen coins, every
       time, for ever. Nobody noticed while that meant walking to a menu and
       clicking a thumbnail. The Mall turns it into standing in one spot
       pressing E, which is a money printer with a shop attached. */
    if(window.PROGRESS) PROGRESS.set('char', id);
  }

  /* the player's own body, third person */
  let body=null, model=null;
  /* WHAT THE BODY IS DOING, worked out in one place because three callers
     want it: the two that draw us, and presence, which sends the name to
     everybody else's screen.  Their body used to guess from how fast it
     was crossing the ground, which can see a walk and a sprint and cannot
     ever see a jump — you go straight up, your speed over the ground does
     not change, and the classmate watching you sees you keep walking.

     ASK FOR A JUMP AND TAKE WHAT YOU GET. play() leaves the current clip
     alone when it cannot find the name, so a character with a jump plays
     it and one without carries on with whatever it was doing — which is
     exactly the clean held pose the kit characters have always used.
     Naming a clip nobody has was the old way of saying the same thing;
     naming the real one costs them nothing and pays whoever has it. */
  let acting='idle';
  /* A POSTURE OUTRANKS THE LEGS. Walk, sprint, jump and idle are all worked
     out from how fast the body is crossing the ground and whether it is
     touching it — which is the right question for somebody on their feet
     and the wrong one for somebody in the air, where every answer it can
     give is a person running on nothing.

     So a caller that owns the body's whole situation — flight, and one day
     swimming — says so once, and the legs stop being asked. An emote still
     wins: dancing in mid-air is a thing a nine-year-old will try in the
     first minute and there is no reason to stop them. */
  let posture=null;
  function setPosture(name){ posture = name || null; }
  /* A LINE OF DIALOGUE IS A THING THE BODY DOES. The player stood
     perfectly still through every line they had, because the only thing
     choosing a clip was whether they were walking — and nobody walks in a
     cutscene. SCENE knows whose line is on screen; this asks.

     UNDER WALKING, OVER STANDING. It sits exactly where a state that is
     not a state belongs: an emote still wins, a posture still wins, and
     moving still wins, because a character gesturing while they sprint is
     worse than one standing quietly. In practice a shot freezes them
     anyway, so `moving` is false and this is what is left.

     AND ONLY IF THE BODY HAS THE CLIP. Every roster character was rebuilt
     with these two, but a body that has not been — an old cached model,
     something a mission stands up on its own — falls back to idle rather
     than to nothing. `can()` is already the question for that. */
  function talkClip(){
    try{
      if(!window.SCENE || !SCENE.playerTalking) return null;
      const want=SCENE.talkClip;
      return can(want) ? want : (can('talk') ? 'talk' : null);
    }catch(e){ return null; }
  }
  function clipFor(dt, moving, running, onGround){
    return acting = emoteFrame(dt, moving)
                 || posture
                 || (onGround===false ? 'jump'
                 : moving ? (running ? 'sprint' : 'walk')
                 : (talkClip() || 'idle'));
  }
  /* AN EMOTE IS A CLIP THAT IS NOT A STATE. Every other clip answers a
     question about the body — is it moving, is it airborne — and is chosen
     fresh each frame from the answer. This one is chosen because somebody
     pressed a button, so it needs somewhere to live between frames: how
     long is left of it, and which one it was.

     Walking cancels it. Nobody wants to watch their character finish a
     dance they have changed their mind about halfway through. */
  let emoting=0, emoteClip=null;
  /* Which attach is the current one. Two characters clicked quickly are two
     loads in flight, and the slower one must not win by finishing last. */
  let attachSeq=0;
  const rigOf = m => (m && m.userData && m.userData.rig) || null;
  function emote(name){
    const r=rigOf(model);
    name=name||'dance';
    if(!r || !r.has(name)) return false;
    emoteClip=name; emoting=r.seconds(name) || 3;
    return true;
  }
  function canEmote(name){
    const r=rigOf(model);
    return !!(r && r.has(name||'dance'));
  }
  const emoting_ = ()=> emoting>0;
  /* Returns the clip to play, or null to carry on as normal. Shared by both
     drivers — the flat world's update() and the planet's orient() — because
     an emote that only worked on one of them would be a bug somebody found
     by walking through a door. */
  function emoteFrame(dt, moving){
    if(emoting<=0) return null;
    if(moving){ emoting=0; return null; }
    emoting-=dt;
    return emoting>0 ? emoteClip : null;
  }
  /* LOAD FIRST, SWAP AFTER. Detaching up front left the world with nobody
     standing in it for as long as the new character took to arrive — a
     visible hole every time somebody changed clothes. The one you are
     wearing stays until the one you asked for is ready. */
  async function attach(){
    const seq=++attachSeq;
    let m;
    try{ m=await load(bodyOf(chosen)); }
    catch(e){ console.warn('character failed to load',e); return; }
    if(seq!==attachSeq) return;            // they picked again while this loaded
    if(!G.roomGroup){ detach(); return; }  // nowhere to stand
    detach();
    model=m;
    body=new THREE.Group(); body.add(m);
    G.roomGroup.add(body);
    /* STAND THE NEW BODY WHERE THE OLD ONE WAS. A fresh Group is at the
       origin, and on a planet the origin is the middle of the ball — so
       swapping character while the world is held still put the new one
       three hundred metres underground and the player simply vanished.
       Nothing put it right afterwards either, because what normally moves
       the body is the walking code, and that is the very thing a frozen
       world is not running.

       The pose matters as much as the place: without it the new body
       stands in its bind pose, arms out, until something animates it. */
    if(placed){
      body.position.copy(placed.pos);
      body.quaternion.copy(placed.quat);
      body.visible=placed.vis;
    }
    /* IDLE, AT FULL WEIGHT, RIGHT NOW. play() normally crossfades over
       0.18s, and a crossfade that has not been stepped yet is weight zero
       — which is the bind pose. Asking for it with no fade and then
       stepping the mixer once is the difference between a character and a
       mannequin with its arms out. */
    const r=m.userData.rig;
    if(r){ r.play('idle', 0); r.update(0.05); }
    /* The hips, found once. Whatever the body is doing, that bone is the
       middle of it — see centre() below. */
    hipBone=null;
    m.traverse(o=>{ if(!hipBone && /Hips$/.test(o.name||'')) hipBone=o; });
    equip(m);                              // give them something to hold
  }
  function detach(){ if(body&&body.parent) body.parent.remove(body); body=null; model=null;
                     hipBone=null; emoting=0; emoteClip=null; }
  /* WHERE THE BODY ACTUALLY IS, which is not where it was put.

     Callers place the body at the ground under it and let the clip decide
     the rest — which is right, and means the group's own position is the
     character's FEET when they are standing and nowhere near them when
     they are not. The flying pose lies flat with the hips a metre up and
     the whole body a couple of metres along the nose, so anything that
     wants to draw at the character rather than at the spot they are
     standing on has to ask.

     The hips are the answer. It is the root of every Mixamo clip and it
     is the middle of a person in all of them. */
  let hipBone=null;
  function centre(out){
    const v=out||new THREE.Vector3();
    if(!body) return v;
    if(hipBone){ hipBone.getWorldPosition(v); return v; }
    return v.copy(body.position);
  }
  /* Where the body was last put, kept so a replacement can pick it up. Both
     of the things that place one write here — the flat rooms, which turn a
     body with a heading, and the planets, which stand it on a surface
     normal — so one record covers both. */
  let placed=null;
  function remember(){
    if(!body) return;
    if(!placed) placed={ pos:new THREE.Vector3(), quat:new THREE.Quaternion(), vis:true };
    placed.pos.copy(body.position);
    placed.quat.copy(body.quaternion);
    placed.vis=body.visible;
  }
  /* On a round world a body cannot be placed with a y-rotation — it has to
     stand along the surface normal, which points somewhere different at every
     step. A caller that owns its own gravity hands the basis in and this puts
     the model on it. The model faces +Z, so +Z is where the player is facing. */
  function orient(pos, up, fwd, dt, moving, running, onGround){
    if(!body) return;
    const u=up.clone().normalize();
    const f=fwd.clone().sub(u.clone().multiplyScalar(fwd.dot(u))).normalize();
    const r=new THREE.Vector3().crossVectors(u, f).normalize();   // right-handed: r × u = f
    body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    body.position.copy(pos);
    body.visible=!G.firstPerson;
    remember();
    animate(model, dt, clipFor(dt, moving, running, onGround));
  }
  /* JUST THE CLIP, for a room that poses the body itself.

     update() also places and turns the body, which is right for a flat
     room and wrong on a ball: planet.js builds the pose out of the surface
     normal and update() would flatten it back onto y. So the planet calls
     orient(), and orient() is reached through place(), and place() is
     reached through walk() — which does not run while the world is frozen.

     A CUTSCENE FREEZES THE WORLD. That is what a cutscene IS, and it meant
     the player's body held whatever clip it had when the scene started and
     played nothing for the whole conversation. This is the half of update()
     that a frozen room still wants: choose the clip, advance it, touch
     nothing else. */
  function tickClip(dt, moving, running, onGround){
    if(!model) return;
    animate(model, dt, clipFor(dt, moving, running, onGround));
  }

  function update(dt, moving, running, onGround){
    if(!body) return;
    body.position.set(G.pos.x, G.pos.y - EYE, G.pos.z);
    /* THE WHOLE ROTATION, not just the heading. A flat room's floor is flat,
       so a body in one only ever turns about y — but `rotation` is an Euler
       and writing one of its three numbers leaves the other two alone.

       On a ball the body does not stand on y at all: orient() builds its
       quaternion from the surface normal, and three.js decomposes that back
       into an Euler with real x and z in it — 70 degrees of them at Senio's
       front door. attach() then carries that pose into the new room so a
       character swapped in mid-air keeps it. So walking off a planet into
       any flat room left a body turning correctly about a y it was no longer
       standing on: lying on its back at seventy degrees, idling, for ever.

       set() writes all three. Nothing else here has an opinion about x or z,
       which is exactly why nobody noticed they were being inherited. */
    body.rotation.set(0, G.yaw + Math.PI, 0);   // the model faces +z, the camera looks -z
    body.visible = !G.firstPerson;
    remember();
    animate(model, dt, clipFor(dt, moving, running, onGround));
  }

  /* WHO THE ACCOUNT SAYS YOU ARE. pick() has always written the choice into
     the progress bag as well as into this browser, and nothing has ever read
     it back — so the character followed the machine rather than the child.
     Sit down at the other side of the lab and you were Kyle again.

     It cannot be done where `chosen` is first worked out, at the top of this
     file: the bag has not been fetched from the server yet when scripts run.
     So it is a second, later question, asked by whoever loads a bag —
     sign-in, sign-up and the resume on boot. A bag with no character in it
     leaves this browser's choice exactly as it is, which is what makes it
     safe to call whether anybody is signed in or not. */
  function restore(){
    if(!window.PROGRESS || !PROGRESS.get) return chosen;
    const want=PROGRESS.get('char', null);
    if(!want || want===chosen || !CHARS.some(c=>c.id===want)) return chosen;
    pick(want);
    return chosen;
  }

  /* ================================================== WHAT TO CALL YOU
     EVERY NPC IN THIS GAME USED TO SAY "ROBIN", because the story was
     written for her and she was who you were made into. Now that you
     arrive as yourself, they have to have something to call you, and the
     only honest answer is the name you signed in with.

     THE FALLBACKS ARE IN ORDER OF HOW MUCH THEY ARE YOURS. A signed-in
     display name is what you chose to be called. Without one — a lab
     machine with no account, a guest run, the server down — the next
     truest thing is the character you picked, because you picked it. Only
     if both are missing does anybody fall back to a word, and it is the
     roster's first name rather than "Guest", so a line of dialogue never
     reads "Good morning, Guest."

     ONE FUNCTION, AND EVERY SCENE ASKS IT. A second copy of this decision
     is a second answer, and the one place it would show up is halfway
     through a cutscene with two different names in it. */
  function myName(){
    try{ if(window.NET && NET.me && NET.me.display) return NET.me.display; }catch(e){}
    const c=bodyDef(chosen);
    return (c && c.name) || CHARS[0].name;
  }
  /* And the face beside the name: whoever you are actually wearing. */
  function myFace(){
    const c=bodyDef(cast || chosen);
    return (c && c.preview) || CHARS[0].preview;
  }

  return { CHARS, load, pick, restore, other, attach, detach, update, orient, animate, idle,
           tickClip, myName, myFace,
           setCast, bodyOf, bodyDef, BODIES, get cast(){ return cast; },
           posture:setPosture, can, centre, get wearing(){ return posture; },
           emote, canEmote, get emoting(){ return emoting>0; },
           get act(){ return acting; },
           get chosen(){ return chosen; }, set chosen(v){ chosen=v; } };
})();
