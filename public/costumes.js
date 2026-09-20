/* =====================================================================
   COSTUMES — what an object can look like.

   The kits that shipped with the game, sorted into shelves a student can
   shop from: People and Cars first, because those are what anybody asks
   for, then the scenery. Nothing here is new art — it is the same models
   the missions and the race already use, finally reachable from Free Play.

   A costume id is "shelf/file": the shelf names the folder its .glb lives
   in and the picker it appears under. The four primitives are the
   exception — 'cube', 'ball', 'cylinder' and 'cone' are drawn by the VM
   out of geometry and have no file at all, which is why an old project
   that only ever knew those still loads.
   ===================================================================== */
window.COSTUMES = (function(){

  /* people are the avatars, so they arrive already named and already
     drawn — AVATAR has the previews the character picker uses */
  const PEOPLE_NAMES = { a:'Ash', b:'Bex', c:'Cato', d:'Dot', e:'Enzo', f:'Fin',
    g:'Gus', h:'Hana', i:'Iris', j:'Jax', k:'Kit', l:'Lex',
    m:'Mo', n:'Nia', o:'Ozzy', p:'Pip', q:'Quinn', r:'Rae' };

  const it=(file,name)=>({ file, name });

  const SHELVES=[
    { id:'shapes', name:'Shapes', dir:null, thumbs:null, items:[
        it('cube','Cube'), it('ball','Ball'), it('cylinder','Cylinder'), it('cone','Cone') ] },

    /* THE RING'S TWO, on their own shelf rather than among the people.
       They live in the same folder because that is where the .glb files
       already were — but a shelf is what a student browses, and a
       four-metre fighting robot is not a person.

       These are the only RIGGED costumes in the game, which is why the
       skeleton-aware clone below exists: without it every object wearing
       one is drawn by a shared set of bones and ignores its own position
       and scale. The people are six plain meshes apiece and never had
       the problem. */
    { id:'robots', name:'Robots', dir:'characters/models/', thumbs:null, items:[
        it('noisyboy','Noisy Boy'), it('ambush','Ambush') ] },

    { id:'people', name:'People', dir:'characters/models/', thumbs:'characters/previews/',
      items:'abndcefghijklmopqr'.split('').map(c=>
        it('character-'+c, PEOPLE_NAMES[c]||('Character '+c.toUpperCase()))) },

    /* One car, because there is one car in the game now. This shelf used
       to hold the four Kenney kit cars in four colours; those were what
       you drove as well, and when the McLaren replaced them on the road
       there was no reason to keep four of them standing here. A project
       saved with one of the old ids gets a cube, which is what any costume
       that will not load has always fallen back to. */
    { id:'cars', name:'Cars', dir:'racing/', thumbs:'racing/previews/', items:[
        it('mclaren','McLaren') ] },

    { id:'outdoors', name:'Outdoors', dir:'racing/', thumbs:'racing/previews/', items:[
        it('treeLarge','Tall tree'), it('treeSmall','Small tree'), it('pylon','Cone marker'),
        it('barrierWall','Barrier'), it('fenceStraight','Fence'), it('tent','Tent'),
        it('billboard','Billboard'), it('flagCheckers','Chequered flag'),
        it('lightPostLarge','Lamp post'), it('grandStand','Stand') ] },

    { id:'building', name:'Building', dir:'kit/', thumbs:'kit/previews/', items:[
        it('wall','Wall'), it('wall-window-square','Window wall'),
        it('wall-doorway-square','Doorway'), it('floor','Floor'), it('column','Column'),
        it('column-wide','Wide column'), it('stairs-open','Stairs'),
        it('roof-flat-center','Roof'), it('door-rotate-square-a','Door'),
        it('border','Kerb'), it('plating','Plating'), it('barricade-window-a','Barricade') ] },

    { id:'gear', name:'Gear', dir:'blasters/', thumbs:'blasters/previews/', items:[
        it('blaster-a','Blaster'), it('blaster-g','Big blaster'),
        it('crate-medium','Crate'), it('crate-small','Small crate'), it('crate-wide','Wide crate'),
        it('target-large','Target'), it('target-small','Small target'),
        it('grenade-a','Canister'), it('bullet-foam','Dart'), it('clip-large','Clip') ] }
  ];

  const SHAPES=['cube','ball','cylinder','cone'];
  const shelfOf = id => SHELVES.find(s=>s.id===String(id).split('/')[0]) || null;

  const isModel = id => SHAPES.indexOf(String(id))<0 && String(id).indexOf('/')>0;
  function find(id){
    const s=shelfOf(id); if(!s) return null;
    const f=String(id).split('/').slice(1).join('/');
    return s.items.find(x=>x.file===f) || null;
  }
  function nameOf(id){
    const x=find(id); if(x) return x.name;
    const s=String(id||'cube');
    return s.charAt(0).toUpperCase()+s.slice(1);
  }
  function thumbOf(id){
    const s=shelfOf(id), x=find(id);
    return (s && x && s.thumbs) ? s.thumbs+x.file+'.png?v='+(window.ASSETV||'1') : null;
  }

  /* ---------------------------------------------------------- loading
     RIGGED COSTUMES DO NOT INSTANCE CORRECTLY HERE, and the Ring found
     it out the hard way. Object3D.clone() copies a SkinnedMesh and its
     bones but does not re-point the copy at the copied bones: every
     clone keeps the PROTOTYPE's skeleton, so what is drawn is driven by
     bones that are not inside the clone and ignores the clone's own
     transform. A Box3 still measures the right numbers, which is what
     makes it so confusing — the object is the right size and in the
     right place, and what appears on screen is neither. The fix is a
     skeleton-aware clone (three's SkeletonUtils does this by walking the
     copy and remapping skeleton.bones). It is fixed: see cloneRig below.

     ONLY THE ROBOTS ARE RIGGED. The people are six plain meshes apiece
     with no bones at all, so `become a [Ash]` never had this problem —
     worth saying because the opposite was assumed for a while.

     One fetch per costume, shared by every object wearing it, cloned per
     object. The .glb is parsed with its own folder as the base so the
     kit's shared texture resolves; and each model is scaled to stand one
     world unit tall and centred on the object's position, so swapping a
     cube for a person does not move anything. */
  const bytes=new Map(), protos=new Map(), reels=new Map();
  let loader=null;

  function file(id){
    const s=shelfOf(id); if(!s||!s.dir) return null;
    // same reason as avatar.js: the server caches these for a day
    return s.dir + String(id).split('/').slice(1).join('/') + '.glb'
           + '?v=' + (window.ASSETV||'1');
  }
  function proto(id){
    if(protos.has(id)) return protos.get(id);
    const url=file(id);
    if(!url) return Promise.reject(new Error('no such costume: '+id));
    const p=(async()=>{
      if(!bytes.has(url)) bytes.set(url, fetch(url).then(r=>{
        if(!r.ok) throw new Error('missing '+url);
        return r.arrayBuffer();
      }));
      loader = loader || new THREE.GLTFLoader();
      const base=url.slice(0, url.lastIndexOf('/')+1);
      const buf=await bytes.get(url);
      const g=await new Promise((res,rej)=>loader.parse(buf.slice(0), base, res, rej));
      /* THE CLIPS COME TOO. A .glb can carry animation and this used to
         drop it on the floor, which meant anything wanting a costume to
         MOVE had to bypass the whole costume system and load the file a
         second time. They are shared, immutable and keyed by costume, so
         one copy serves every object wearing it — an AnimationMixer is
         per-object, an AnimationClip is not. */
      reels.set(id, g.animations||[]);
      const root=g.scene;
      root.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
      const holder=new THREE.Group();
      holder.add(root);

      /* MEASURE, SCALE, MEASURE AGAIN, THEN CENTRE — and every step of
         that is load-bearing.

         MULTIPLY, NEVER SET. Some of these exports carry a scale of
         their own: the robots are authored in centimetres and arrive at
         a hundredth. The box below is measured AFTER that transform, in
         world units, so `setScalar(k)` threw the hundredth away and left
         the model a hundred times too big — a four-metre robot came out
         four hundred and sixty, which from the floor looks exactly like
         a model that failed to load.

         AND CENTRE AFTER SCALING, not by scaling the old centre. Once
         the root can arrive with a transform of its own, `-c * k` is no
         longer where the middle ends up; the only honest answer is to
         scale it, look again, and subtract what you find. For a root
         with no transform of its own the two agree exactly, which is why
         every costume that already worked still does. */
      root.updateMatrixWorld(true);
      let box=new THREE.Box3().setFromObject(root);
      const h=Math.max(box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z);
      if(h>0.001) root.scale.multiplyScalar(1/h);
      root.updateMatrixWorld(true);
      box=new THREE.Box3().setFromObject(root);
      root.position.sub(box.getCenter(new THREE.Vector3()));
      return holder;
    })();
    protos.set(id,p);
    return p;
  }
  /* ---------------------------------------------- cloning a rigged one
     THIS IS WHAT Object3D.clone() DOES NOT DO. It copies a SkinnedMesh
     and it copies the bones, but it never re-points the copy at the
     COPIED bones — `clone.skeleton` is still the prototype's Skeleton
     object. So every object wearing the same costume is drawn by one
     shared set of bones living outside all of them, and what you see
     ignores each clone's own position and scale entirely.

     WHAT MAKES IT SO HARD TO SPOT is that nothing looks wrong from the
     outside. A Box3 measures every clone at the right size in the right
     place the whole time, because the box is computed from the matrices
     and the matrices are fine. Only the pixels are wrong.

     The fix is what three ships as SkeletonUtils.clone, which this
     bundle does not include: walk the original and the copy in step,
     build a map from each source bone to its counterpart, and rebind
     every cloned SkinnedMesh to a new Skeleton made of ITS OWN bones —
     keeping the original boneInverses, which are bind-pose data and
     belong to the geometry rather than to any one instance.

     A costume with no skin in it takes the plain path, which is every
     shape, every vehicle and most of the scenery. */
  function cloneRig(source){
    const clone=source.clone(true);

    let skinned=false;
    source.traverse(o=>{ if(o.isSkinnedMesh) skinned=true; });
    if(!skinned) return clone;

    /* The two trees have the same shape, so walking them together pairs
       every node with its copy. Done by position rather than by name
       because bone names are not guaranteed unique. */
    const twin=new Map();
    (function pair(a,b){
      twin.set(a,b);
      for(let i=0;i<a.children.length && i<b.children.length;i++)
        pair(a.children[i], b.children[i]);
    })(source, clone);

    const sources=[]; source.traverse(o=>{ if(o.isSkinnedMesh) sources.push(o); });
    let i=0;
    clone.traverse(o=>{
      if(!o.isSkinnedMesh) return;
      const src=sources[i++];
      if(!src || !src.skeleton) return;
      const bones=src.skeleton.bones.map(b=>twin.get(b) || b);
      /* boneInverses are bind-pose data — they belong to the geometry,
         not to this instance, so the new Skeleton reuses them. */
      o.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
    });
    return clone;
  }

  const load = id => proto(id).then(cloneRig);
  /* What a costume can be animated with, once it has been loaded at
     least once. Empty for everything that is not rigged. */
  const clips = id => reels.get(id) || [];

  /* every costume there is, as flat ids — for the dropdown on `become a` */
  function all(){
    const out=[];
    SHELVES.forEach(s=>s.items.forEach(x=>out.push(s.dir? s.id+'/'+x.file : x.file)));
    return out;
  }
  const id = (shelf,f) => shelf==='shapes' ? f : shelf+'/'+f;

  return { SHELVES, SHAPES, isModel, load, clips, nameOf, thumbOf, all, id, find };
})();
