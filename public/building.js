/* =====================================================================
   BUILDING — assembles a level out of the Kenney Building Kit from a
   plain text floor plan, so a new site is a few lines of ASCII, not code.

   One string per row.  Hand build() an array of plans instead and they
   stack into storeys, ground floor first, joined by whatever stairs the
   plans draw.

     #  wall           +  column         D  doorway        W  window wall
     .  floor          S  spawn          V  vault (goal)   T  terminal
     C  camera post    G  guard waypoint
     ^ v < >  a staircase climbing north / south / west / east.  It covers
              the tile you mark AND the one it points at, so leave both of
              those blank on the storey above — that hole is the stairwell,
              and it gets railed off automatically.
     (space)  nothing: outside the building, or the well of a stairwell.

   Everything the kit draws is measured at load time, so the plan lays out
   at the kit's own scale and the storeys stack exactly wall-height apart.
   ===================================================================== */
window.BUILDING = (function(){
  const UNIT = 4;                         // world units across one floor tile
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
  const STAIRS = { '^':[0,-1], 'v':[0,1], '<':[-1,0], '>':[1,0] };
  const WALK = '.SDTVCG^v<>';
  const walkable = c => WALK.includes(c);

  /* The kit ships near-white on purpose so you can tint it.  Colour says
     what a thing is for: the floor recedes, a door is a way through, and
     anything blue takes you to another storey. */
  const PAINT = { floor:0xb9c2e4, wall:0xffffff, door:0xa8e6cf,
                  stair:0x8fd3ff, rail:0x8fd3ff, post:0xffffff };

  const cache=new Map(), pending=new Map(), paints=new Map();
  let loader=null, kit=null;

  /* One material per colour, shared by every piece that asks for it, so a
     whole site still draws out of the kit's single texture. */
  function paint(obj, hex){
    if(hex===undefined) return;
    obj.traverse(o=>{
      if(!o.isMesh || !o.material || !o.material.map) return;
      const key=o.material.uuid+':'+hex;
      let mat=paints.get(key);
      if(!mat){ mat=o.material.clone(); mat.color=new THREE.Color(hex); paints.set(key,mat); }
      o.material=mat;
    });
  }

  /* One load per piece no matter how many times a plan asks for it. */
  function piece(name){
    if(cache.has(name)) return Promise.resolve(cache.get(name).clone(true));
    if(!pending.has(name)){
      loader = loader || new THREE.GLTFLoader();
      pending.set(name, new Promise((res,rej)=>{
        loader.load('kit/'+name+'.glb',
          g=>{ cache.set(name, g.scene); res(g.scene); },
          undefined,
          err=>{ pending.delete(name); rej(err); });
      }));
    }
    return pending.get(name).then(root=>root.clone(true));
  }

  /* The kit is modelled at its own scale: measure one floor tile and one
     wall once, and every plan after that lays out in real world units. */
  async function measure(){
    if(kit) return kit;
    const box = async n => new THREE.Box3().setFromObject(await piece(n));
    const f = await box('floor'), w = await box('wall');
    const tile = Math.max(f.max.x-f.min.x, f.max.z-f.min.z) || 2;
    const s    = UNIT/tile;
    const slab = (f.max.y - f.min.y) * s || 0.2;   // thickness of a floor
    const wall = (w.max.y - w.min.y) * s || 4.8;   // height of one wall
    kit = { s, slab, wall, storey: slab + wall };
    return kit;
  }

  async function build(plans, group){
    const K = await measure();
    const floors = (typeof plans[0] === 'string') ? [plans] : plans;

    const jobs=[], solids=[], runs=[], openEdge=new Set(), onStairs=new Set();
    const spots = { terminals:[], guards:[], cameras:[], stairs:[], vault:null,
                    spawn:{x:1, z:1, s:0, y:K.slab} };

    const at = (k,x,z)=>{
      const plan=floors[k];            if(!plan) return ' ';
      const row=plan[z];               if(row===undefined) return ' ';
      return row[x]===undefined ? ' ' : row[x];
    };
    /* world coords in, so edge pieces can sit on the half-tile line */
    const add = (name, wx, wz, y, ry, tint)=> jobs.push({name, wx, wz, y, ry:ry||0, tint});

    /* --- pass one: find the staircases -------------------------------
       The storey above has to know where its stairwell is before we can
       decide which of its edges get a railing and which stay open.     */
    for(let k=0;k<floors.length;k++)
      for(let z=0; z<floors[k].length; z++)
        for(let x=0; x<floors[k][z].length; x++){
          const d = STAIRS[at(k,x,z)];
          if(!d) continue;
          const base = k*K.storey + K.slab;
          runs.push({ k, x, z, dx:d[0], dz:d[1], base, top:base + K.storey });
          spots.stairs.push({ x, z, s:k, y:base, up:{ x:x+2*d[0], z:z+2*d[1], s:k+1 } });
          // both tiles of a flight belong to the treads, not to the flat floor
          onStairs.add(`${k}:${x},${z}`);
          onStairs.add(`${k}:${x+d[0]},${z+d[1]}`);
          openEdge.add(`${k+1}:${x+2*d[0]},${z+2*d[1]}:${-d[0]},${-d[1]}`);
        }

    /* --- pass two: lay out every storey ------------------------------ */
    for(let k=0;k<floors.length;k++){
      const plan=floors[k], base=k*K.storey, surf=base + K.slab;
      for(let z=0; z<plan.length; z++){
        for(let x=0; x<plan[z].length; x++){
          const c = at(k,x,z);
          if(c === ' ') continue;
          const wx = x*UNIT, wz = z*UNIT, stair = STAIRS[c];

          /* the stairs bring their own treads, so no slab under them */
          if(walkable(c) && !stair) add('floor', wx, wz, base, 0, PAINT.floor);

          if(c === '#' || c === 'W'){
            /* a wall tile shows a face on every edge that is not another
               wall: inward to the rooms, outward to give the building a
               skin you can actually see from the street. */
            let faced=false;
            for(const [dx,dz] of DIRS){
              const n = at(k, x+dx, z+dz);
              if(n !== ' ' && !walkable(n)) continue;
              add(c==='W' ? 'wall-window-square' : 'wall',
                  wx + dx*UNIT/2, wz + dz*UNIT/2, surf, dx ? 0 : Math.PI/2, PAINT.wall);
              faced=true;
            }
            if(!faced) add('column-wide', wx, wz, surf, 0, PAINT.post);
            solids.push(cell(wx, wz, base, K));
          }

          if(c === '+'){ add('column', wx, wz, surf, 0, PAINT.post); solids.push(cell(wx,wz,base,K)); }

          /* A doorway sits in the face of the wall it pierces, one frame
             per side, so a thick wall reads as a real door reveal. */
          if(c === 'D')
            for(const [dx,dz] of DIRS){
              if(!walkable(at(k, x+dx, z+dz))) continue;
              add('wall-doorway-square', wx + dx*UNIT/2, wz + dz*UNIT/2,
                  surf, dx ? 0 : Math.PI/2, PAINT.door);
            }

          if(stair){
            /* the model climbs toward +Z and spans two tiles, so drop it
               on the seam between the pair and turn it to face the climb */
            const [dx,dz]=stair;
            add('stairs-open', wx + dx*UNIT/2, wz + dz*UNIT/2, surf,
                Math.atan2(dx, dz), PAINT.stair);
          }

          /* Upstairs, anywhere the floor stops is a drop — rail it, except
             the one edge where the staircase arrives. */
          if(walkable(c) && k > 0)
            for(const [dx,dz] of DIRS){
              if(at(k, x+dx, z+dz) !== ' ') continue;
              if(openEdge.has(`${k}:${x},${z}:${dx},${dz}`)) continue;
              add('wall-low', wx + dx*UNIT/2, wz + dz*UNIT/2, surf, dx ? 0 : Math.PI/2, PAINT.rail);
            }

          const spot = { x, z, s:k, y:surf };
          if(c === 'S') spots.spawn = spot;
          if(c === 'V') spots.vault = spot;
          if(c === 'T') spots.terminals.push(spot);
          if(c === 'C') spots.cameras.push(spot);
          if(c === 'G') spots.guards.push(spot);
        }
      }
    }

    /* --- pass three: load each distinct piece once, then place them --- */
    const names=[...new Set(jobs.map(j=>j.name))];
    const stock=new Map();
    await Promise.all(names.map(n=> piece(n).then(m=>stock.set(n,m))
                                            .catch(()=>stock.set(n,null))));
    for(const j of jobs){
      const src=stock.get(j.name);
      if(!src) continue;
      const m=src.clone(true);
      paint(m, j.tint);
      m.scale.setScalar(K.s);
      m.position.set(j.wx, j.y, j.wz);
      m.rotation.y = j.ry;
      group.add(m);
    }

    /* --- a lamp over every room --------------------------------------
       Flood each storey's floor, treating a doorway as the edge of a room,
       and hang one light over the middle of each pocket that comes back.
       A building you cannot read is not atmosphere, it is a bug.         */
    const lit=new Set();
    for(let k=0;k<floors.length;k++)
      for(let z=0; z<floors[k].length; z++)
        for(let x=0; x<floors[k][z].length; x++){
          const room = c=>walkable(c) && c!=='D';
          if(lit.has(`${k}:${x},${z}`) || !room(at(k,x,z))) continue;
          const queue=[[x,z]], cells=[];
          lit.add(`${k}:${x},${z}`);
          while(queue.length){
            const [cx,cz]=queue.pop(); cells.push([cx,cz]);
            for(const [dx,dz] of DIRS){
              const nx=cx+dx, nz=cz+dz, key=`${k}:${nx},${nz}`;
              if(lit.has(key) || !room(at(k,nx,nz))) continue;
              lit.add(key); queue.push([nx,nz]);
            }
          }
          if(cells.length < 3) continue;                 // a nook, not a room
          const mx=cells.reduce((a,c)=>a+c[0],0)/cells.length;
          const mz=cells.reduce((a,c)=>a+c[1],0)/cells.length;
          const reach=Math.max(14, Math.sqrt(cells.length)*UNIT*1.6);
          const lamp=new THREE.PointLight(0xffeccf, 26, reach, 1.6);
          lamp.position.set(mx*UNIT, k*K.storey + K.storey*0.86, mz*UNIT);
          group.add(lamp);
        }

    /* --- the height field the player walks on ------------------------ */
    const surfaces=new Map();
    for(let k=0;k<floors.length;k++)
      for(let z=0; z<floors[k].length; z++)
        for(let x=0; x<floors[k][z].length; x++){
          const c=at(k,x,z);
          if(!walkable(c) || onStairs.has(`${k}:${x},${z}`)) continue;
          const key=x+','+z;
          if(!surfaces.has(key)) surfaces.set(key,[]);
          surfaces.get(key).push(k*K.storey + K.slab);
        }

    /* The underside of the next floor up, so a chase camera can duck under
       it instead of climbing into the storey above and hiding the player. */
    function ceilingAt(wx, wz, from){
      const x=Math.round(wx/UNIT), z=Math.round(wz/UNIT);
      let lid=Infinity;
      for(const y of (surfaces.get(x+','+z) || [])){
        const under = y - K.slab;
        if(under > from + 0.4 && under < lid) lid = under;
      }
      return lid;
    }
    function heightAt(wx, wz, from){
      const x=Math.round(wx/UNIT), z=Math.round(wz/UNIT);
      const cand=(surfaces.get(x+','+z) || []).slice();
      for(const r of runs){
        const inRun = (x===r.x && z===r.z) ||
                      (x===r.x+r.dx && z===r.z+r.dz);
        if(inRun) cand.push(rampY(r, wx, wz));
      }
      if(!cand.length) return from===undefined ? K.slab : from;
      const y0 = from===undefined ? -Infinity : from;
      const reach = K.storey*0.6;                 // one flight is too far to hop
      let best=null;
      for(const y of cand) if(y <= y0 + reach && (best===null || y > best)) best=y;
      if(best!==null) return best;
      // nothing within a step on this storey: hold the height you had rather
      // than snapping up to a floor you never climbed to
      return from===undefined ? Math.min(...cand) : from;
    }
    /* How high the treads are at this point of a two-tile flight.  The climb
       finishes a little short of the top step: the player is a cylinder, so
       they stop about a radius from the wall above and have to already be at
       landing height by then or they wedge against it. */
    function rampY(r, wx, wz){
      const d   = r.dx || r.dz;
      const w   = r.dx ? wx : wz;
      const t   = r.dx ? r.x : r.z;
      const low = t*UNIT - d*UNIT/2;              // outside edge of the bottom tile
      const p = Math.max(0, Math.min(1, ((w - low)*d) / (2*UNIT*0.8)));
      return r.base + p*(r.top - r.base);
    }

    return { solids, spots, unit:UNIT, storey:K.storey, slab:K.slab,
             heightAt, ceilingAt, at:(x,z)=>at(0,x,z), walkable, floors };
  }

  /* a wall tile blocks the storey it stands on, and only that storey */
  function cell(wx, wz, base, K){
    return { x1:wx-UNIT/2, x2:wx+UNIT/2, z1:wz-UNIT/2, z2:wz+UNIT/2,
             y1:base, y2:base + K.storey };
  }

  return { build, piece, UNIT };
})();
