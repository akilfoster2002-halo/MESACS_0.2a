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
  /* THE CAST IS NIA, SABLE, KOFI, THEO AND ZURI — the same five as the
     Godot game (koro-godot/scripts/walker.gd), made in one style, rigged on
     the same Mixamo skeleton with the same clips, and named by NAME rather
     than by a letter, so a player in the browser and a player in Godot
     each see the other as who they chose. Nia leads.

     Kyle, Mia, Savannah, Carlos and Robin are retired. A save, or a player
     still on an old page, that says s..x gets a fixed new body (RETIRED,
     the same table the Godot game uses) rather than everybody becoming
     the first one. Their files stay: a walk-on still wears one. */
  const IDS = ['nia', 'sable', 'kofi', 'theo', 'zuri'];
  const NAMES = { nia:'Nia', sable:'Sable', kofi:'Kofi', theo:'Theo', zuri:'Zuri' };
  const RETIRED = { s:'theo', t:'zuri', u:'sable', v:'kofi', w:'nia', x:'nia' };
  const castOf = id => RETIRED[id] || id;
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
      preview:'characters/previews/mechanic.png'+V() },
    /* ROBIN, BY NAME, FOR THE ONE STORY THAT IS HERS. TSH (tsh.js) is
       George Wang's script, and it is about Robin's face and Robin's
       name — so that quest casts her with setCast('robin'), the way this
       file says a place may, and hands you back whoever you picked on the
       way out. She is `character-robin.glb`: rebuilt from reference photos
       of the real person she is based on (glb files/wardrobe/README.md),
       standing in the wardrobe's plain base outfit, with every clip the
       story needs — her look for the night is put on by WARDROBE. The old
       `x` in the pink jacket is a passer-by now. The letters still mean the
       new cast to every old save, which is why she needs a name of her own. */
    { id:'robin', name:'Robin',
      model:'characters/models/character-robin.glb'+V(),
      preview:'characters/previews/character-robin.png'+V() },
    /* MAYA (TSH): rebuilt from her reference art like Robin — a body in the
       wardrobe's base layer (black crop top and shorts), her face shapes on it
       (glb files/face), and what she wears put on by WARDROBE, a piece at a time:
       the turtleneck, the trousers, the boots, the lab coat, the glasses. */
    { id:'maya', name:'Maya', tall:1.68,
      model:'characters/models/character-maya.glb'+V(),
      preview:'characters/previews/character-maya.png'+V() },
    /* And the retired roster as walk-ons: the people on TSH's pavements.
       Same reason — their letters resolve to the new cast. */
    ...['s','t','u','v','x'].map(c=>({ id:'walk-'+c, name:'Passer-by',
      model:`characters/models/character-${c}.glb`+V(),
      preview:`characters/previews/character-${c}.png`+V() })),
    /* THE BUYER AND HIS CREW, in Dragon Alley (TSH's fight, tshfight.js): extras,
       never on the roster, each with his own height — a big man is bigger. */
    { id:'thug-buyer', name:'The buyer', tall:1.84,
      model:'characters/models/character-thug-buyer.glb'+V(), preview:'characters/previews/character-thug-buyer.png'+V() },
    { id:'thug-a', name:'Thug', tall:1.97,
      model:'characters/models/character-thug-a.glb'+V(), preview:'characters/previews/character-thug-a.png'+V() },
    { id:'thug-b', name:'Thug', tall:1.81,
      model:'characters/models/character-thug-b.glb'+V(), preview:'characters/previews/character-thug-b.png'+V() }
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
  const bodyDef = id => BODIES.find(c=>c.id===castOf(id)) || CHARS[0];

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
    loader = loader || new THREE.GLTFLoader(); if(window.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
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
    if(h > 1e-6) root.scale.setScalar((bodyDef(id).tall || TALL) / h);     // (a body may have its own height: a big man is bigger)
    else console.warn('character has no height, cannot scale:', id);
    root.userData.rig = rig(root, g.animations||[]);
    return root;
  }

  /* The blaster the character is actually carrying.  The one in GUN hangs
     off the camera and only exists in first person, so in third person the
     player was holding nothing at all. */
  function blaster(){
    if(!gunProto){
      loader = loader || new THREE.GLTFLoader(); if(window.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); if(window.MeshoptDecoder && loader.setMeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
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
    /* MOVES, NOT STATES. A punch is played once and holds its last frame
       (`once`), at its own speed (`speed`); clips added at run time — a
       fight's moves, loaded only by the scene that fights — go in with them. */
    const once=new Set(), speed={};

    /* EIGHT DIRECTIONS FROM FOUR CLIPS A GAIT. The keys move you forward,
       back and sideways, and a body that only knows how to walk forward
       used to do all four in its forward walk — striding ahead while it
       slid off to the left. So a character that carries the side-steps and
       the back-steps plays the four of them AT ONCE, each weighted by how
       much of the move goes its way: straight left is all strafe-left,
       forward-and-left is half of each, and the blend follows the keys.

       IN STEP. The four clips are different lengths, and four walks each at
       their own speed blended together is a body tripping over itself. So
       none of them keeps its own time: one phase runs round the cycle at the
       blend's average length, and every clip is posed at that same fraction
       of its own — left foot down in all of them together.

       A character without the extra clips walks exactly as it always did. */
    const LOCO={ walk:['walk','walk_back','walk_left','walk_right'],
                 sprint:['sprint','sprint_back','sprint_left','sprint_right'] };
    const byName=n=>clips.find(c=>c.name===n);
    const hasLoco=LOCO.walk.every(byName);
    const loco={ on:false, act:{}, w:{}, phase:0, run:0 };
    function locoActs(){
      if(Object.keys(loco.act).length) return;
      [...LOCO.walk, ...LOCO.sprint].forEach(n=>{
        const c=byName(n); if(!c) return;
        const a=mixer.clipAction(c); a.timeScale=0; a.setEffectiveWeight(0); a.play();
        loco.act[n]=a; loco.w[n]=0;
      });
    }
    /* weights toward their targets, and every clip posed at the one phase.

       NOT THE ONE play() HAS. three.js hands out ONE action per clip, so the
       walk this blend drives and the walk play('walk') starts are the same
       object — and a cutscene that walks her (posture 'walk') after she has
       walked about herself got its walk faded straight back to nothing here,
       every frame: no clip with any weight is the bind pose, arms out. So the
       action that is playing on its own is left alone; the blend is only the
       blend's. */
    function locoStep(dt, target){
      const k=1-Math.exp(-12*dt);
      let sum=0, dur=0;
      for(const n in loco.act){
        if(!loco.on && loco.act[n]===cur){ loco.w[n]=0; continue; }
        loco.w[n]+=((target[n]||0)-loco.w[n])*k;
        if(loco.w[n]<0.002) loco.w[n]=0;
        sum+=loco.w[n]; dur+=loco.w[n]*loco.act[n].getClip().duration;
      }
      const D = sum>0 ? dur/sum : 1;
      loco.phase=(loco.phase + dt/Math.max(0.2, D)) % 1;
      for(const n in loco.act){
        const a=loco.act[n];
        if(!loco.on && a===cur) continue;
        a.time=loco.phase*a.getClip().duration;
        a.setEffectiveWeight(loco.w[n]);
      }
      return sum;
    }
    return {
      /* x is right, z is forward, in the body's own frame; running picks the
         gait. Returns false when this character has no side-steps to blend,
         and the caller plays the plain walk as it always did. */
      locomote(x, z, running, dt){
        if(!hasLoco) return false;
        locoActs();
        if(!loco.on){
          if(cur) cur.fadeOut(0.18);
          cur=null; curName='__loco'; loco.on=true;
          /* the blend sets each clip's time itself: one play() ran at its own speed must not run on top of that.
             AND EACH ONE BACK ON. A cutscene that walked her and then cut to a stand faded its walk to nothing,
             and three.js switches off an action whose fade-out finishes — the same action this blend drives —
             so the blend set weights on a walk that was off, and she slid about in the bind pose. */
          for(const n in loco.act){ const a=loco.act[n]; a.stopFading(); a.enabled=true; a.timeScale=0; if(!a.isRunning()) a.play(); }
        }
        let len=Math.hypot(x,z);
        if(len<1e-6){ x=0; z=1; len=1; }             // moved by something other than the keys
        const fx=x/len, fz=z/len;
        const d={ '':Math.max(0,fz), _back:Math.max(0,-fz), _right:Math.max(0,fx), _left:Math.max(0,-fx) };
        const tot=d['']+d._back+d._right+d._left;
        loco.run+=((running?1:0)-loco.run)*(1-Math.exp(-8*dt));
        const target={};
        for(const suf in d){
          const w=d[suf]/tot;
          const wn='walk'+suf, sn='sprint'+suf;
          if(loco.act[sn]){ target[wn]=w*(1-loco.run); target[sn]=w*loco.run; }
          else target[wn]=w;                          // no running side-step: walk it
        }
        locoStep(dt, target);
        return true;
      },
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
        /* AND A NAME OFF THE WIRE MAY BE A CLIP NOBODY HERE HAS.

           What another player's body is doing arrives as the NAME of the
           clip they are playing, and the name comes from whichever game
           they are playing in. The Godot game sends its side-steps spelled
           out ('walk_left', 'sprint_back') and a mech pilot as 'ride';
           there will be more of them, because a clip added to one game is
           not a deploy of the other.

           Returning on a miss left the body in whatever pose it was last
           in — frozen mid-stride, sliding across the field — which is the
           one outcome worse than the wrong animation. So a name that
           misses falls back to the gait it is a variant of, and then to
           idle, which is what Godot does with a clip it does not know
           (koro-godot/scripts/others.gd). */
        if(!clips.some(c=>c.name===name)) name=String(name||'').split('_')[0];
        if(!clips.some(c=>c.name===name)) name='idle';
        if(curName===name) return;
        loco.on=false;                                  // the blend fades itself out in update()
        const clip=clips.find(c=>c.name===name);
        if(!clip) return;
        const next=mixer.clipAction(clip);
        if(once.has(name)){ next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished=true; }
        next.timeScale=speed[name]||1;
        next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
        if(cur) cur.fadeOut(fade===undefined?0.18:fade);
        cur=next; curName=name;
      },
      /* what the eight-way walk is doing right now, clip by clip */
      get blend(){ const o={}; for(const n in loco.w) if(loco.w[n]>0.01) o[n]=+loco.w[n].toFixed(2); return o; },
      update(dt){
        if(!loco.on && Object.keys(loco.act).length) locoStep(dt, {});
        mixer.update(dt);
      },
      /* An emote can only be offered by a character who actually has one,
         and it has to know how long to hold before handing control back. */
      has(name){ return clips.some(c=>c.name===name); },
      clip(name){ return clips.find(c=>c.name===name) || null; },
      /* the clip now playing held at a moment of it: the web swing is posed by where she is on the arc, not by the clock */
      at(name, time){ if(curName!==name || !cur) return false; cur.timeScale=0; cur.time=Math.max(0, Math.min(time, cur.getClip().duration-0.001)); return true; },
      seconds(name){ const c=clips.find(x=>x.name===name); return c?c.duration/(speed[name]||1):0; },
      /* more clips, from another file on the same skeleton; `o.once` the ones that are moves, `o.speed` their rates */
      add(list, o){
        (list||[]).forEach(c=>{ if(!clips.some(x=>x.name===c.name)) clips.push(c); });
        ((o&&o.once)||[]).forEach(n=>once.add(n));
        Object.assign(speed, (o&&o.speed)||{});
      },
      /* THE BODY HELD STANDING while `fn` measures it, then put back exactly as it was. What is hung on
         a bone (shades on the head, a pack on the back) is fitted against where that bone is NOW; fitted
         mid-clip — her head bowed over her hands, a fall, a kneel — the shades go on square to a bowed
         head and sit on her forehead once she looks up. So they are fitted in the first frame of `name`
         (idle: standing, looking ahead), the frame the wardrobe's own checks use. */
      posed(name, fn){
        const clip=clips.find(c=>c.name===name); if(!clip) return fn();
        const saved=[]; root.traverse(o=>{ if(o.isBone) saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
        const m=new THREE.AnimationMixer(root), a=m.clipAction(clip);
        a.play(); m.update(0); root.updateMatrixWorld(true);
        try{ return fn(); }
        finally{ a.stop(); m.uncacheRoot(root);
          saved.forEach(([o, p, q, sc])=>{ o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); }); root.updateMatrixWorld(true); }
      },
      /* the same move again from its first frame (a second jab is not the first one held) */
      restart(name, fade){
        const clip=clips.find(c=>c.name===name); if(!clip) return 0;
        loco.on=false;
        const a=mixer.clipAction(clip);
        if(once.has(name)){ a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished=true; }
        a.timeScale=speed[name]||1;
        a.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.08:fade).play();
        if(cur && cur!==a) cur.fadeOut(fade===undefined?0.08:fade);
        cur=a; curName=name;
        return clip.duration/(a.timeScale||1);
      },
      /* how far through the clip now playing, 0..1 */
      get progress(){ if(!cur) return 0; const d=cur.getClip().duration||1; return Math.min(1, cur.time/d); },
      get current(){ return curName; }
    };
  }
  /* KEEP BREATHING WHILE THE WORLD IS HELD STILL. Whatever normally drives
     the player's body does it from inside the block a frozen world skips,
     so a panel that freezes the game to ask you something leaves a statue
     of yourself standing behind it. The quick change is exactly that panel,
     and what it is asking you to look at is a character. */
  function idle(dt){ if(model){ faceTick(dt||0); animate(model, dt||0, 'idle'); faceHead(); } }
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
  /* WHICH WAY THE KEYS ARE PUSHING, in the body's own frame: x to the
     right, z forward. Whoever moves the player — the planet, a flat room —
     says so each frame, and the walk is chosen to match. */
  let gx=0, gz=1;
  function gait(x, z){ gx=x||0; gz=z||0; }
  /* the player's own clip: the eight-way walk when there is one to blend */
  /* A FACE, on a body that has one: morph targets on the skin (Robin's, made from a facial rig by
     glb files/face/morphs.js) — jawOpen, smile, mouthO, frown, browUp, browDown, blink. She blinks on her
     own, every few seconds and now and then twice; whoever runs the scene sets how open her mouth is
     (mouth(), from her voice) and asks for an expression (expr(name, amount, seconds)). A body without
     the shapes ignores all of it.

     A FACE WITH EVERY MUSCLE (the 52 ARKit shapes and the visemes — the MPFB Robin) is driven muscle by
     muscle instead: a smile pulls the cheeks up and narrows the eyes with it, raised brows widen the eyes,
     a scowl narrows them, and nothing is ever quite the same on both sides. Her lines are shaped by the
     words (say(), visemes over the line's length, as open as the voice is loud), her brows lift on the
     stressed syllables, and her eyes do what eyes do: quick jumps between places they rest, tiny drifts
     while they rest, a look away to think when she starts to speak, lids that follow them down, a blink on
     the big jumps, and her head turning a little after them. lookAt(point) gives them something to rest on. */
  const face = { model:null, mesh:null, meshes:[], blinkIn:2.5, blinkT:0, mouth:0, expr:{}, cur:{} };
  /* a face can be in several pieces (skin, teeth, brows, lashes, each with the same shapes by name): all of them move */
  function faceMesh(){
    if(face.model !== model){ face.model = model; face.mesh = null; face.meshes = []; face.cur = {}; face.set = {}; face.head = null; face.heads = [];
      face.arkit = false; face.vis = null; face.look = null;
      if(model) model.traverse(o=>{ if(o.morphTargetDictionary && Object.keys(o.morphTargetDictionary).length){ face.meshes.push(o);
        if(o.morphTargetDictionary.jawOpen !== undefined && (!face.mesh || o.morphTargetInfluences.length > face.mesh.morphTargetInfluences.length)) face.mesh = o; }
        if(o.isBone && /(^|:|mixamorig)Head$/.test(o.name)){ face.heads.push(o); if(!face.head) face.head = o; } });   // a garment can carry its own copy of the skeleton
      face.arkit = !!(face.mesh && face.mesh.morphTargetDictionary.mouthSmileLeft !== undefined && face.mesh.morphTargetDictionary.eyeSquintLeft !== undefined);
      /* HOW SHE STOOD WHEN SHE WAS DRAWN. Mid-frame her body can be anywhere on its way to its final turn (a room places
         her after the avatar has moved her, and anything asking for a world matrix in between bakes the half-done one),
         so what she looks at is measured from her pose as it was last drawn */
      if(face.mesh && !face.mesh.userData.gazeHook){ const ms = face.mesh, mdl = model, prev = ms.onBeforeRender;
        ms.userData.gazeHook = true;
        ms.onBeforeRender = function(){ if(prev) prev.apply(this, arguments); if(face.model !== mdl) return;
          const sc = new THREE.Vector3(); face.drawnQ = face.drawnQ || new THREE.Quaternion(); face.drawnHead = face.drawnHead || new THREE.Vector3();
          mdl.matrixWorld.decompose(sc, face.drawnQ, sc); face.drawnHead.setFromMatrixPosition((face.head || mdl).matrixWorld);
          (face.drawnM = face.drawnM || new THREE.Matrix4()).copy(mdl.matrixWorld); }; } }
    return face.mesh;
  }
  function faceSet(m, name, v){ for(const o of face.meshes){ const i = o.morphTargetDictionary[name]; if(i !== undefined) o.morphTargetInfluences[i] = v; } }
  const CHANNELS = ['smile', 'frown', 'browUp', 'browDown', 'mouthO', 'jawOpen', 'blink'];
  function faceTick(dt){
    const m = faceMesh(); if(!m || !(dt >= 0)) return;
    if(face.arkit) return faceTickFull(m, dt);
    // the blink: about a sixth of a second, closed in the middle of it
    face.blinkIn -= dt;
    if(face.blinkIn <= 0){ face.blinkT = 0.17; face.blinkIn = Math.random() < 0.15 ? 0.25 : 2 + Math.random()*4; }
    let blink = 0; if(face.blinkT > 0){ face.blinkT = Math.max(0, face.blinkT - dt); blink = Math.min(1, 1.4*(1 - Math.abs(face.blinkT/0.17*2 - 1))); }
    // the mouth: as open as the voice is loud (a little round on the way)
    const k = 1 - Math.exp(-dt*22);
    // expressions ease in, hold for their time, and ease back out (a held-open mouth — surprise — under the talking)
    const ke = 1 - Math.exp(-dt*7), held = {};
    CHANNELS.forEach(n=>{ const e = face.expr[n]; let want = 0;
      if(e){ e.t -= dt; if(e.t > 0) want = e.v; else delete face.expr[n]; }
      held[n] = (face.cur['_' + n] || 0) + (want - (face.cur['_' + n] || 0))*ke; face.cur['_' + n] = held[n]; });
    ['smile', 'frown', 'browUp', 'browDown'].forEach(n=>{ face.cur[n] = held[n]; });
    // no further than about half: past that the lips stretch over a mouth with no inside to it
    face.cur.jawOpen = (face.cur.jawOpen || 0) + (Math.min(0.5, face.mouth*0.5 + held.jawOpen) - (face.cur.jawOpen || 0))*k;
    face.cur.mouthO = (face.cur.mouthO || 0) + (Math.min(1, face.mouth*0.2 + held.mouthO) - (face.cur.mouthO || 0))*k;
    faceSet(m, 'blink', Math.max(blink, held.blink));                 // heavy lids (sleepy) under the blinks
    for(const n in face.cur) if(n[0] !== '_') faceSet(m, n, face.cur[n]);
    headGaze(dt);
  }
  /* A FACE WHOSE EYES CANNOT MOVE (painted on): what she looks at, she turns her head to — most of the way */
  function headGaze(dt){
    const L = face.look || (face.look = { x:0, y:0, tx:0, ty:0, rest:0.5, micro:0.2, mx:0, my:0, hx:0, hy:0, htx:0, hty:0 });
    const tp = gazePoint(dt); let ax = 0, ay = face.gmood === 'down' ? -0.25 : 0;
    if(tp && model){
      const q = new THREE.Quaternion(), hp = new THREE.Vector3(), sc = new THREE.Vector3();
      if(face.drawnQ){ q.copy(face.drawnQ); hp.copy(face.drawnHead); }
      else { model.matrixWorld.decompose(sc, q, sc); hp.setFromMatrixPosition((face.head || model).matrixWorld); }
      const d = tp.clone().sub(hp).applyQuaternion(q.invert());
      const yaw = Math.atan2(d.x, d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      if(Math.abs(yaw) < 1.75){ ax = clamp(yaw*0.85, -0.9, 0.9); ay = clamp(pitch*0.8, -0.7, 0.4); }
    }
    const kh = 1 - Math.exp(-dt*4);
    L.hx += (ax - L.hx)*kh; L.hy += (ay - L.hy)*kh;
  }

  /* ---- the whole face ---- */
  // a feeling reads smaller on a face across a room than it was written: everything she feels goes this much further.
  // Her shapes (MPFB's) are gentle at full strength, so the muscles that carry a feeling are driven past 1 (a shape
  // scales on past its end cleanly); the ones round the eyes are not, or a smile shuts them
  const GAIN = 1.4;
  const PAST = /^(mouthSmile|mouthFrown|brow|noseSneer|cheekSquint|mouthDimple|mouthStretch|mouthPress|mouthUpperUp|mouthShrug|mouthRoll)/;
  const capOf = n => /^eyeSquint/.test(n) ? 0.4 : /^eyeWide/.test(n) ? 1.2 : /^(eyeBlink|eyeLook)/.test(n) ? 1 : /^viseme/.test(n) ? 1.1 : n === 'jawOpen' ? 0.55 : /^mouth(Funnel|Pucker)/.test(n) ? 0.7
    : /^brow/.test(n) ? 1.4 : /^(noseSneer|mouthSmile|mouthDimple)/.test(n) ? 1.15 : 1.7;   // brows past this push the lids shut, a smile past it shows the teeth through the corners
  // each of the old names, spread over the muscles that really make it
  const SPREAD = {
    smile:    { mouthSmileLeft:1, mouthSmileRight:1, cheekSquintLeft:0.6, cheekSquintRight:0.6, eyeSquintLeft:0.4, eyeSquintRight:0.4, mouthDimpleLeft:0.3, mouthDimpleRight:0.3 },
    smirk:    { mouthSmileLeft:0.9, cheekSquintLeft:0.45, mouthDimpleLeft:0.5, eyeSquintLeft:0.25, mouthPressRight:0.3 },
    frown:    { mouthFrownLeft:1, mouthFrownRight:1, mouthPressLeft:0.35, mouthPressRight:0.35, mouthShrugLower:0.4, mouthStretchLeft:0.15, mouthStretchRight:0.15 },
    browUp:   { browInnerUp:1, browOuterUpLeft:0.85, browOuterUpRight:0.85, eyeWideLeft:0.4, eyeWideRight:0.4 },
    worry:    { browInnerUp:1, browDownLeft:0.25, browDownRight:0.25, mouthStretchLeft:0.25, mouthStretchRight:0.25 },
    browDown: { browDownLeft:1, browDownRight:1, eyeSquintLeft:0.45, eyeSquintRight:0.45, noseSneerLeft:0.2, noseSneerRight:0.2 },
    sneer:    { noseSneerLeft:1, noseSneerRight:0.7, mouthUpperUpLeft:0.6, mouthUpperUpRight:0.35, cheekSquintLeft:0.3 },
    squint:   { eyeSquintLeft:1, eyeSquintRight:1, cheekSquintLeft:0.3, cheekSquintRight:0.3 },
    wide:     { eyeWideLeft:1, eyeWideRight:1 },
    press:    { mouthPressLeft:1, mouthPressRight:1, mouthRollLower:0.3, mouthShrugUpper:0.3 },
    mouthO:   { mouthFunnel:0.6, mouthPucker:0.2, jawOpen:0.15, mouthLowerDownLeft:0.2, mouthLowerDownRight:0.2 },
    jawOpen:  { jawOpen:1, mouthLowerDownLeft:0.35, mouthLowerDownRight:0.35 },
    blink:    { eyeBlinkLeft:1, eyeBlinkRight:1 }
  };
  // which shapes are her left (the slight lean of a real face to one side)
  const sideOf = n => /Left$/.test(n) ? 1 : /Right$/.test(n) ? -1 : 0;
  // the words, as mouth shapes: a letter (or two) → a viseme
  function visemes(text){
    const s = String(text || '').toLowerCase().replace(/\([^)]*\)/g, ' '), out = [];
    for(let i = 0; i < s.length; i++){
      const c = s[i], d = s.slice(i, i + 2);
      if(d === 'th'){ out.push('TH'); i++; continue; }
      if(d === 'sh' || d === 'ch'){ out.push('CH'); i++; continue; }
      if(d === 'oo' || d === 'ou'){ out.push('U'); i++; continue; }
      if(d === 'ee' || d === 'ea'){ out.push('I'); i++; continue; }
      const v = 'a'===c ? 'aa' : 'e'===c ? 'E' : 'iy'.includes(c) ? 'I' : 'o'===c ? 'O' : 'uw'.includes(c) ? 'U'
        : 'bmp'.includes(c) ? 'PP' : 'fv'.includes(c) ? 'FF' : 'dtl'.includes(c) ? 'DD' : 'n'===c ? 'nn'
        : 'kgcq'.includes(c) ? 'kk' : 'szx'.includes(c) ? 'SS' : 'j'===c ? 'CH' : 'r'===c ? 'RR'
        : /[\s,.!?;:—–-]/.test(c) ? (/[,.!?;:—–]/.test(c) ? 'pause' : 'sil') : null;
      if(!v || (v === 'sil' && out[out.length - 1] === 'sil')) continue;
      out.push(v);
    }
    return out;
  }
  // a line to speak: its mouth shapes spread over how long it takes (pauses and gaps a little longer than a letter)
  function say(text, secs){
    const seq = visemes(text); if(!seq.length) return;
    const len = seq.reduce((a, v)=>a + (v === 'pause' ? 3 : v === 'sil' ? 1.4 : 1), 0), unit = Math.max(0.3, secs || seq.length*0.07)/len;
    let t = 0; face.vis = { t:0, track:seq.map(v=>{ const d = (v === 'pause' ? 3 : v === 'sil' ? 1.4 : 1)*unit, k = { v:v === 'pause' ? 'sil' : v, at:t, d }; t += d; return k; }) };
    // starting to speak, people often look away to find the words
    if(Math.random() < 0.55){ const s = Math.random() < 0.5 ? 1 : -1; face.avert = { t:0.5 + Math.random()*0.7, to:[s*(0.35 + Math.random()*0.25), 0.15 + Math.random()*0.25] }; }
  }
  /* WHAT SHE LOOKS AT. lookAt(point) — a Vector3, [x, y, z], or a function giving one each frame (something that
     moves); null gives her eyes back to themselves. glanceSelf(slot) has her look down at a piece she has just put
     on, for a couple of seconds; gazeMood('down' | 'dart' | null) is how a feeling carries the eyes. */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function lookAt(p){ face.target = p || null; }
  function gazeMood(m){ face.gmood = m || null; }
  // where each slot is on her, and how far in front of the bone to look (a point inside her body has no direction)
  const SELF = { outer:[/Spine2$/, 0.16, -0.05], top:[/Spine2$/, 0.16, -0.05], bottom:[/LeftLeg$/, 0.08, 0], shoes:[/LeftFoot$/, 0.12, 0],
                 hands:[/LeftHand$/, 0.03, 0], wrist:[/LeftForeArm$/, 0.05, -0.1], back:[/RightShoulder$/, 0.02, 0] };
  function glanceSelf(slot, secs){ const s = SELF[slot]; if(s) face.self = { s, t:secs || 2.4 }; }
  const _gp = new THREE.Vector3();
  function gazePoint(dt){
    if(face.self){ face.self.t -= dt;
      if(face.self.t > 0 && model){ const [re, ahead, up] = face.self.s; let b = null;
        model.traverse(o=>{ if(!b && o.isBone && re.test(o.name)) b = o; });
        if(b){ const q = new THREE.Quaternion(), sc = new THREE.Vector3();
          b.getWorldPosition(_gp);                                         // where the bone is on her body (in her own frame)...
          if(face.drawnM){ _gp.applyMatrix4(model.matrixWorld.clone().invert()).applyMatrix4(face.drawnM); q.copy(face.drawnQ); }   // ...put where she was drawn
          else model.matrixWorld.decompose(sc, q, sc);
          return _gp.add(new THREE.Vector3(0, up, ahead).applyQuaternion(q)); } }
      else face.self = null; }
    let t = face.target; if(!t) return null;
    if(typeof t === 'function'){ try{ t = t(); }catch(e){ t = null; } if(!t) return null; }
    return t.isVector3 ? _gp.copy(t) : _gp.set(t[0], t[1], t[2]);
  }
  function faceTickFull(m, dt){
    const w = {}, add = (n, v)=>{ if(v > 0) w[n] = (w[n] || 0) + v; };
    // feelings: ease in, hold, ease out; any channel by its old name, a spread name, or a single muscle
    const ke = 1 - Math.exp(-dt*8), live = new Set(Object.keys(face.expr));
    for(const n in face.cur) if(n[0] === '_') live.add(n.slice(1));
    if(face.sideFor !== face.exprGen){ face.sideFor = face.exprGen; face.side = (Math.random()*2 - 1)*0.1; }
    for(const n of live){ const e = face.expr[n]; let want = 0;
      if(e){ e.t -= dt; if(e.t > 0) want = e.v; else delete face.expr[n]; }
      const h = (face.cur['_' + n] || 0) + (want - (face.cur['_' + n] || 0))*ke;
      if(h < 0.002 && !want){ delete face.cur['_' + n]; continue; }
      face.cur['_' + n] = h;
      const v = h*GAIN, sp = SPREAD[n];
      if(sp) for(const p in sp) add(p, v*sp[p]*(1 + face.side*sideOf(p))*(PAST.test(p) ? 1.3 : 1));
      else add(n, v*(PAST.test(n) ? 1.3 : 1));
    }
    // between feelings the face is never quite blank: a brow that flickers, a mouth that sets a little
    face.tic = (face.tic === undefined ? 3 : face.tic) - dt;
    if(face.tic <= 0){ face.tic = 2.5 + Math.random()*5; const r = Math.random();
      face.ticE = { n:r < 0.35 ? 'browInnerUp' : r < 0.6 ? 'mouthPressLeft' : r < 0.8 ? 'browOuterUpRight' : 'mouthDimpleRight', v:0.15 + Math.random()*0.2, t:0.6 + Math.random()*0.9, a:0 }; }
    if(face.ticE){ const e = face.ticE; e.a += dt; const f = Math.sin(Math.min(1, e.a/e.t)*Math.PI); add(e.n, e.v*f); if(e.a >= e.t) face.ticE = null; }

    // speaking: the shape of the word under the voice, the jaw as wide as the voice is loud
    const k = 1 - Math.exp(-dt*24), mo = face.mouth, vis = face.vis;
    face.vw = face.vw || {};
    let cur = null;
    if(vis){ vis.t += dt; const tr = vis.track;
      while(tr.length > 1 && vis.t > tr[0].at + tr[0].d) tr.shift();
      if(vis.t > tr[0].at + tr[0].d + 0.3) face.vis = null; else cur = tr[0].v; }
    const open = Math.min(1, mo*1.6);
    for(const v of ['aa', 'E', 'I', 'O', 'U', 'PP', 'FF', 'DD', 'nn', 'kk', 'SS', 'CH', 'RR', 'TH']){
      const want = cur === v ? (v === 'PP' || v === 'FF' ? 0.85 : 0.35 + open*0.65) : 0;
      face.vw[v] = (face.vw[v] || 0) + (want - (face.vw[v] || 0))*k;
      add('viseme_' + v, Math.min(1, face.vw[v]));
    }
    // the jaw from the voice (less when the word is already shaping the mouth), and no further than about half
    face.jaw = (face.jaw || 0) + ((cur ? mo*0.3 : Math.min(0.5, mo*0.5)) - (face.jaw || 0))*k; add('jawOpen', face.jaw);
    if(!cur) add('mouthFunnel', mo*0.15);
    // the stressed syllables: a loud jump in the voice lifts the brows a little
    if(mo > 0.55 && (face.lastMo || 0) < 0.4 && Math.random() < 0.45) face.stress = 0.28;
    face.lastMo = mo;
    if(face.stress > 0){ face.stress = Math.max(0, face.stress - dt); const f = Math.sin(face.stress/0.28*Math.PI)*0.35; add('browInnerUp', f); add('browOuterUpLeft', f*0.8); add('browOuterUpRight', f*0.6); }

    // the eyes: they rest, jump, and rest again — on what she is looking at, when there is something
    const L = face.look || (face.look = { x:0, y:0, tx:0, ty:0, rest:0.5, micro:0.2, mx:0, my:0, hx:0, hy:0, htx:0, hty:0 });
    let home = [0, 0], aim = null;
    const tp = gazePoint(dt);
    if(tp && model){
      // where she stood and faced when last drawn (a room can still turn her after this, so not where she is mid-frame)
      const q = new THREE.Quaternion(), hp = new THREE.Vector3(), sc = new THREE.Vector3();
      if(face.drawnQ){ q.copy(face.drawnQ); hp.copy(face.drawnHead); }
      else { model.matrixWorld.decompose(sc, q, sc); hp.setFromMatrixPosition((face.head || model).matrixWorld); }
      const d = tp.clone().sub(hp).applyQuaternion(q.invert());
      const yaw = Math.atan2(d.x, d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      // the head takes a share of the turn (most of it, for something well to the side or below), the eyes the rest
      if(Math.abs(yaw) < 1.75){
        const hy = clamp(yaw*0.6, -0.8, 0.8), hpch = clamp(pitch*0.55, -0.6, 0.35);
        aim = [hy, hpch]; home = [clamp((yaw - hy)/0.55, -1, 1), clamp((pitch - hpch)/0.45, -0.85, 0.85)];
      }
    }
    const mood = face.gmood;
    if(mood === 'down') home = [home[0]*0.5, Math.min(home[1], 0) - 0.45];        // sad, tired, ashamed: the eyes drop
    L.rest -= dt;
    if(face.avert){ face.avert.t -= dt; if(face.avert.t <= 0) face.avert = null; }
    // something new to look at: the eyes are there a moment later (a reaction, not a slide)
    if(aim && !face.avert && L.rest > 0.15 && Math.hypot(home[0] - L.tx, home[1] - L.ty) > 0.3) L.rest = 0.12;
    if(L.rest <= 0){
      const r = Math.random(), held = aim ? (mood === 'down' ? 0.55 : mood === 'dart' ? 0.5 : 0.85) : 0.55, spread = aim ? 0.22 : 0.5;
      const to = face.avert ? face.avert.to : r < held ? home : [home[0] + (Math.random()*2 - 1)*spread, home[1] + (Math.random()*2 - 1)*spread*0.65];
      L.rest = face.avert ? face.avert.t : mood === 'dart' ? 0.25 + Math.random()*0.6 : aim ? 0.6 + Math.random()*1.9 : 0.5 + Math.random()*2.2;
      // a big jump takes a blink with it as often as not
      if(Math.hypot(to[0] - L.tx, to[1] - L.ty) > 0.35 && Math.random() < 0.4 && face.blinkT <= 0) face.blinkIn = 0.02;
      L.tx = to[0]; L.ty = to[1];
    } else if(aim && L.rest > 0.3 && Math.hypot(home[0] - L.tx, home[1] - L.ty) < 0.25){ L.tx = home[0]; L.ty = home[1]; }   // following what she is looking at
    // the head: where the target needs it, or a little after wherever the eyes went
    L.htx = aim ? aim[0] : L.tx*0.17; L.hty = aim ? aim[1] : L.ty*0.12 + (mood === 'down' ? -0.18 : 0);
    // while resting, the tiny jumps that keep a living eye from ever being still
    L.micro -= dt;
    if(L.micro <= 0){ L.micro = 0.2 + Math.random()*0.5; L.mx = (Math.random()*2 - 1)*0.03; L.my = (Math.random()*2 - 1)*0.025; }
    const ks = 1 - Math.exp(-dt*38);                                   // a jump is over in a few hundredths of a second
    L.x += (L.tx + L.mx - L.x)*ks; L.y += (L.ty + L.my - L.y)*ks;
    const x = L.x, y = L.y;                                            // + is her left, + is up
    add('eyeLookOutLeft', Math.max(0, x)); add('eyeLookInRight', Math.max(0, x));
    add('eyeLookInLeft', Math.max(0, -x)); add('eyeLookOutRight', Math.max(0, -x));
    add('eyeLookUpLeft', Math.max(0, y)); add('eyeLookUpRight', Math.max(0, y));
    add('eyeLookDownLeft', Math.max(0, -y)); add('eyeLookDownRight', Math.max(0, -y));
    // the lids go with them: down a little when she looks down, open a little when she looks up
    const lid = Math.max(0, -y)*0.35;
    add('eyeWideLeft', Math.max(0, y)*0.2); add('eyeWideRight', Math.max(0, y)*0.2);

    // the blink: quick to close, slower to open, now and then twice; the lids a hair apart in time
    face.blinkIn -= dt;
    if(face.blinkIn <= 0){ face.blinkT = 0.2; face.blinkIn = Math.random() < 0.15 ? 0.3 : 1.8 + Math.random()*4; }
    let bl = 0, br = 0;
    if(face.blinkT > 0){ face.blinkT = Math.max(0, face.blinkT - dt);
      const shape = u=>{ u = Math.max(0, Math.min(1, u)); return u < 0.35 ? u/0.35 : 1 - (u - 0.35)/0.65; };
      bl = Math.min(1, 1.15*shape(1 - face.blinkT/0.2)); br = Math.min(1, 1.15*shape(1 - (face.blinkT + 0.012)/0.2)); }
    const lids = w.eyeBlinkLeft || 0;
    w.eyeBlinkLeft = Math.min(1, Math.max(bl, lids + lid)); w.eyeBlinkRight = Math.min(1, Math.max(br, (w.eyeBlinkRight || 0) + lid));
    // a blink pulls the brows down a touch
    add('browDownLeft', bl*0.12); add('browDownRight', br*0.12);

    // write it: every shape set this frame, and the ones set last frame that nobody wants now go back to rest
    const was = face.set || {}; face.set = {};
    for(const n in w){ faceSet(m, n, Math.min(capOf(n), w[n])); face.set[n] = 1; }
    for(const n in was) if(!face.set[n]) faceSet(m, n, 0);
    // the head goes after the eyes: later (eyes lead, the neck follows)
    const kh = 1 - Math.exp(-dt*4);
    L.hx += (L.htx - L.hx)*kh; L.hy += (L.hty - L.hy)*kh;
  }
  /* AFTER THE CLIP: the head turned a little towards where she is looking. The clip sets the head bone
     each frame; one that does not animate it would keep the last frame's turn, so that is taken back off first. */
  const _hq = new THREE.Quaternion(), _he = new THREE.Euler();
  function faceHead(){
    const L = face.look; if(!L || !face.heads.length) return;
    _he.set(-L.hy, L.hx, 0); _hq.setFromEuler(_he);                    // radians: + turns her to her left, + lifts her chin
    for(const h of face.heads){ const u = h.userData;
      if(u.lookLast && h.quaternion.equals(u.lookLast)) h.quaternion.multiply(u.lookOff.clone().invert());
      h.quaternion.multiply(_hq); u.lookOff = _hq.clone(); u.lookLast = h.quaternion.clone(); }
  }
  function mouth(v){ face.mouth = Math.max(0, Math.min(1, v || 0)); }
  function expr(name, v, secs){ face.expr[name] = { v:v === undefined ? 1 : v, t:secs || 1.5 }; }
  /* a whole feeling at once: { smile:.7, browDown:.3 } for `secs`; the shapes it does not name let go */
  function feel(f, secs){
    for(const n of new Set([...CHANNELS, ...Object.keys(face.expr)])) if(!(f && f[n])) delete face.expr[n];
    if(f) for(const n in f) if(f[n]) expr(n, f[n], secs);
    face.exprGen = (face.exprGen || 0) + 1;
  }
  const hasFace = () => !!faceMesh();
  function stride(dt, moving, running, onGround){
    faceTick(dt);
    const name=clipFor(dt, moving, running, onGround);
    const r=rigOf(model);
    if((name==='walk' || name==='sprint') && r && r.locomote &&
       r.locomote(gx, gz, name==='sprint', dt)){ r.update(dt||0); faceHead(); return; }
    animate(model, dt, name);
    faceHead();
  }
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
  try{ chosen = castOf(localStorage.getItem('dq_char')); }catch(e){}
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
  let body=null, model=null, dressHooked=false;
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
    /* WHAT THEY HAVE ON (wardrobe.js): put on over the body that has just
       arrived, and put on again whenever the closet changes — only the
       difference, on the same body, so a try-on never reloads anybody. */
    if(window.WARDROBE){
      WARDROBE.put(m, bodyOf(chosen));
      if(!dressHooked){ dressHooked=true; WARDROBE.onChange(who=>{ if(model && (!who || who===bodyOf(chosen))) WARDROBE.put(model, bodyOf(chosen)); }); }
    }
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
    stride(dt, moving, running, onGround);
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
    faceTick(dt);
    animate(model, dt, clipFor(dt, moving, running, onGround));
    faceHead();
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
    stride(dt, moving, running, onGround);
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
    const want=castOf(PROGRESS.get('char', null));
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

  return { CHARS, load, pick, restore, other, attach, detach, update, orient, animate, idle, gait,
           tickClip, myName, myFace, mouth, expr, feel, hasFace, say, lookAt, glanceSelf, gazeMood,
           setCast, bodyOf, bodyDef, BODIES, get cast(){ return cast; },
           posture:setPosture, can, centre, get wearing(){ return posture; },
           get body(){ return body; }, get model(){ return model; },
           emote, canEmote, get emoting(){ return emoting>0; },
           get act(){ return acting; },
           get chosen(){ return chosen; }, set chosen(v){ chosen=v; } };
})();
