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

    { id:'people', name:'People', dir:'characters/models/', thumbs:'characters/previews/',
      items:'abndcefghijklmopqr'.split('').map(c=>
        it('character-'+c, PEOPLE_NAMES[c]||('Character '+c.toUpperCase()))) },

    { id:'cars', name:'Cars', dir:'racing/', thumbs:'racing/previews/', items:[
        it('raceCarRed','Scarlet'), it('raceCarWhite','Chalk'),
        it('raceCarOrange','Ember'), it('raceCarGreen','Clover') ] },

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
    return (s && x && s.thumbs) ? s.thumbs+x.file+'.png' : null;
  }

  /* ---------------------------------------------------------- loading
     One fetch per costume, shared by every object wearing it, cloned per
     object. The .glb is parsed with its own folder as the base so the
     kit's shared texture resolves; and each model is scaled to stand one
     world unit tall and centred on the object's position, so swapping a
     cube for a person does not move anything. */
  const bytes=new Map(), protos=new Map();
  let loader=null;

  function file(id){
    const s=shelfOf(id); if(!s||!s.dir) return null;
    return s.dir + String(id).split('/').slice(1).join('/') + '.glb';
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
      const root=g.scene;
      root.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
      const box=new THREE.Box3().setFromObject(root);
      const h=Math.max(box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z);
      const k = h>0.001 ? 1/h : 1;
      const c=box.getCenter(new THREE.Vector3());
      const holder=new THREE.Group();
      root.scale.setScalar(k);
      root.position.set(-c.x*k, -c.y*k, -c.z*k);
      holder.add(root);
      return holder;
    })();
    protos.set(id,p);
    return p;
  }
  const load = id => proto(id).then(o=>o.clone(true));

  /* every costume there is, as flat ids — for the dropdown on `become a` */
  function all(){
    const out=[];
    SHELVES.forEach(s=>s.items.forEach(x=>out.push(s.dir? s.id+'/'+x.file : x.file)));
    return out;
  }
  const id = (shelf,f) => shelf==='shapes' ? f : shelf+'/'+f;

  return { SHELVES, SHAPES, isModel, load, nameOf, thumbOf, all, id, find };
})();
