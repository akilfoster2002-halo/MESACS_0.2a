/* =====================================================================
   BUILDING — assembles a level out of the Kenney Building Kit from a
   plain text floor plan, so a new site is a few lines of ASCII, not code.

     #  wall        +  wall corner      D  doorway
     .  floor       S  spawn            V  vault (goal)
     T  terminal    C  camera post      G  guard waypoint
   ===================================================================== */
window.BUILDING = (function(){
  const UNIT = 4;                     // world units per floor tile
  const cache = new Map();
  let loader=null;

  function piece(name){
    if(cache.has(name)) return Promise.resolve(cache.get(name).clone(true));
    loader = loader || new THREE.GLTFLoader();
    return new Promise((res,rej)=>{
      loader.load('kit/'+name+'.glb', g=>{
        const root=g.scene;
        cache.set(name, root);
        res(root.clone(true));
      }, undefined, rej);
    });
  }

  /* measure a piece once so the plan can be laid out at the kit's true scale */
  async function unitSize(){
    const f=await piece('floor');
    const box=new THREE.Box3().setFromObject(f);
    return Math.max(box.max.x-box.min.x, box.max.z-box.min.z) || 1;
  }

  async function build(plan, group){
    const raw=await unitSize();
    const s = UNIT / raw;                     // scale the kit to our tile size
    const put = async (name,x,z,ry,y)=>{
      const m=await piece(name);
      m.scale.setScalar(s);
      m.position.set(x*UNIT, y||0, z*UNIT);
      m.rotation.y = ry||0;
      group.add(m);
      return m;
    };
    const solids=[], spots={terminals:[], guards:[], vault:null, spawn:{x:1,z:1}, cameras:[]};
    const H=plan.length, W=Math.max(...plan.map(r=>r.length));
    const at=(x,z)=> (z<0||z>=H||x<0||x>=plan[z].length) ? '#' : plan[z][x];
    const walkable=c=>'.SDTVCG'.includes(c);

    for(let z=0; z<H; z++){
      for(let x=0; x<plan[z].length; x++){
        const c=at(x,z);
        if(c===' ') continue;
        if(walkable(c)) await put('floor',x,z);

        if(c==='#'){
          // a wall tile: show a wall face toward each open neighbour
          const n=[[0,-1,0],[1,0,-Math.PI/2],[0,1,Math.PI],[-1,0,Math.PI/2]];
          let placed=false;
          for(const [dx,dz,ry] of n){
            if(walkable(at(x+dx,z+dz))){ await put('wall',x,z,ry); placed=true; }
          }
          if(!placed) await put('column-wide',x,z);
          solids.push({x1:x*UNIT-UNIT/2, x2:x*UNIT+UNIT/2, z1:z*UNIT-UNIT/2, z2:z*UNIT+UNIT/2});
        }
        if(c==='D'){
          const horizontal = walkable(at(x-1,z)) && walkable(at(x+1,z));
          await put('wall-doorway-square', x, z, horizontal ? Math.PI/2 : 0);
        }
        if(c==='S') spots.spawn={x,z};
        if(c==='V'){ spots.vault={x,z}; }
        if(c==='T') spots.terminals.push({x,z});
        if(c==='C') spots.cameras.push({x,z});
        if(c==='G') spots.guards.push({x,z});
      }
    }
    return { solids, spots, unit:UNIT, W, H, at, walkable };
  }

  return { build, piece, UNIT };
})();
