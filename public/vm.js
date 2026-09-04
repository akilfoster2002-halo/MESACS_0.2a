/* =====================================================================
   VM — the interpreter, and the 3D stage it acts on.

   This is a small language, not a machine simulator. Scripts belong to
   objects, objects live in the world, and the code is the thing the
   student is actually making.

   HOW IT RUNS. Every script is a JavaScript generator. A loop yields
   once per pass and `wait` yields a duration, so the scheduler can hold
   dozens of scripts in flight at once and none of them can lock the
   frame — `forever` is safe to write, which is the whole reason Scratch
   feels the way it does.

   WHAT MAKES IT ADVANCED. Variables with real scope (a call's parameters
   beat an object's own, which beat the project's), lists, custom blocks
   that take arguments and can recurse, clones that each run their own
   copy of the script, and broadcasts that other objects answer.
   ===================================================================== */
window.VM = (function(){
  const KEY='dq_code_project';
  const MAXTHREADS=400;

  let P = blank();
  let group=null, threads=[], running=false, t0=0, uid=1;

  function blank(){
    return { actors:[], vars:{}, lists:{}, procs:[], msgs:['message1'] };
  }

  /* ------------------------------------------------------------ actors */
  function geo(shape,size){
    const r=Math.max(0.1,size);
    if(shape==='ball')     return new THREE.SphereGeometry(0.5*r,18,12);
    if(shape==='cylinder') return new THREE.CylinderGeometry(0.4*r,0.4*r,r,18);
    if(shape==='cone')     return new THREE.ConeGeometry(0.5*r,r,18);
    return new THREE.BoxGeometry(r,r,r);
  }
  /* An object is either a primitive, built here and now, or a costume out
     of the kits, which has to be fetched. A costume's object goes into the
     world immediately as an empty group at the right spot — so the program
     can move it, and the picker can select it, before the model lands —
     and the model is added underneath when it arrives. */
  function build(a){
    if(a.mesh && a.mesh.parent) a.mesh.parent.remove(a.mesh);
    const dressed = window.COSTUMES && COSTUMES.isModel(a.shape);
    const m = dressed ? new THREE.Group()
      : new THREE.Mesh(geo(a.shape,a.size),
          new THREE.MeshLambertMaterial({color:new THREE.Color(a.colour)}));
    m.userData.actor=a; m.userData.owner=m;
    a.mesh=m; if(group) group.add(m);
    if(a.bubble){ m.add(a.bubble); }
    sync(a);
    if(dressed){
      const want=a.shape;
      COSTUMES.load(want).then(o=>{
        if(a.mesh!==m || a.shape!==want) return;      // rebuilt while we waited
        o.scale.multiplyScalar(Math.max(0.1,a.size));
        m.add(o);
      }).catch(()=>{
        // a costume that will not load leaves a cube behind, not an
        // invisible object the student cannot find or click
        if(a.mesh!==m || a.shape!==want) return;
        m.add(new THREE.Mesh(geo('cube',a.size),
          new THREE.MeshLambertMaterial({color:new THREE.Color(a.colour)})));
      });
    }
  }
  function sync(a){
    if(!a.mesh) return;
    a.mesh.position.set(a.x,a.y,a.z);
    a.mesh.rotation.set(a.tilt*Math.PI/180, a.dir*Math.PI/180, 0);
    a.mesh.visible=!!a.visible;
  }
  /* A read-only copy of somebody else's object, for this room to look at. It
     is built exactly the way ours are, but it carries no actor and runs no
     code: the machine that owns an object is the one running its scripts. */
  function ghostMesh(spec){
    const shape=String((spec&&spec.shape)||'cube');
    const size=Math.max(0.1, +(spec&&spec.size) || 1);
    const colour=(spec&&spec.colour)||'#8fd3ff';
    const plain=()=>new THREE.Mesh(geo(shape==='cube'?'cube':shape,size),
      new THREE.MeshLambertMaterial({color:new THREE.Color(colour)}));
    if(window.COSTUMES && COSTUMES.isModel(shape)){
      const g=new THREE.Group();
      COSTUMES.load(shape)
        .then(o=>{ o.scale.multiplyScalar(size); g.add(o); })
        .catch(()=>{ g.add(new THREE.Mesh(geo('cube',size),
          new THREE.MeshLambertMaterial({color:new THREE.Color(colour)}))); });
      return g;
    }
    return plain();
  }

  /* HOME is everything a running program can change about an object. It is
     snapshotted the moment the object is made, so "put it back" is a plain
     copy rather than a re-run of whatever moved it. */
  const HOME=['x','y','z','dir','tilt','size','shape','colour','visible'];
  const snapshot = a => { const o={}; HOME.forEach(k=>o[k]=a[k]); return o; };
  function addActor(o){
    const a=Object.assign({
      id:uid++, name:'object'+uid, shape:'cube', colour:'#8fd3ff',
      x:0,y:1,z:0, dir:0, tilt:0, size:1, visible:true,
      scripts:[], vars:{}, isClone:false, mesh:null, bubble:null, saying:''
    }, o||{});
    if(!a.home) a.home=snapshot(a);
    P.actors.push(a); build(a); save();
    return a;
  }
  function delActor(a){
    threads=threads.filter(t=>t.actor!==a);
    if(a.mesh && a.mesh.parent) a.mesh.parent.remove(a.mesh);
    P.actors=P.actors.filter(x=>x!==a);
    save();
  }
  /* Put one object back to how it was made: where it stood, which way it
     faced, its shape, size and colour. Its own scripts stop and the copies
     it left behind go with them, because a half-reset room is worse than
     none. Takes effect at once — there is nothing to run. */
  function resetActor(a){
    if(!a) return;
    P.actors.filter(c=>c!==a && c.isClone && c.name===a.name).slice().forEach(delActor);
    threads=threads.filter(t=>t.actor!==a);
    bubble(a,'');
    Object.assign(a, a.home || snapshot(a));
    build(a); save();
  }
  /* Put a costume on by hand. It becomes the object's home look too — the
     student has just said this is what the thing IS, so a reset that
     undressed it again would be wrong. */
  function dress(a,costume){
    if(!a) return;
    a.shape=String(costume);
    if(a.home) a.home.shape=a.shape;
    build(a); save();
  }
  const actorByName = nm => P.actors.find(a=>a.name===nm) || null;

  /* say-bubbles are canvas sprites so the text can be anything */
  function bubble(a,text){
    if(a.bubble && a.bubble.parent) a.bubble.parent.remove(a.bubble);
    a.bubble=null; a.saying=text||'';
    if(!text) return;
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(255,255,255,.94)';
    x.beginPath(); x.roundRect(2,2,252,60,14); x.fill();
    x.fillStyle='#241d38'; x.font='bold 26px "Trebuchet MS",sans-serif'; x.textAlign='center';
    x.fillText(String(text).slice(0,20),128,42);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
    sp.scale.set(3,0.75,1); sp.position.y=1.4;
    a.bubble=sp; if(a.mesh) a.mesh.add(sp);
  }

  /* ------------------------------------------------------------- scope
     A name is looked up in the call's parameters first, then the object's
     own variables, then the project's. That ordering is what lets a custom
     block take an argument called `n` without trampling a global `n`. */
  function lookup(ctx,name){
    if(ctx.locals && name in ctx.locals) return ctx.locals[name];
    if(ctx.actor && name in ctx.actor.vars) return ctx.actor.vars[name];
    if(name in P.vars) return P.vars[name];
    return 0;
  }
  function assign(ctx,name,v){
    if(ctx.locals && name in ctx.locals){ ctx.locals[name]=v; return; }
    if(ctx.actor && name in ctx.actor.vars){ ctx.actor.vars[name]=v; return; }
    P.vars[name]=v;
  }
  const num = v => { const x=parseFloat(v); return isFinite(x)?x:0; };
  const truthy = v => v===true || (typeof v==='string' ? v!=='' && v!=='false' : num(v)!==0);

  /* -------------------------------------------------------- expressions */
  function val(a,ctx){
    if(a && typeof a==='object' && a.op) return evalBlock(a,ctx);
    return a;
  }
  function evalBlock(bk,ctx){
    const A=bk.args||{}, g=k=>val(A[k],ctx);
    switch(bk.op){
      case 'op.add': return num(g('a'))+num(g('b'));
      case 'op.sub': return num(g('a'))-num(g('b'));
      case 'op.mul': return num(g('a'))*num(g('b'));
      case 'op.div': { const d=num(g('b')); return d===0?0:num(g('a'))/d; }
      case 'op.mod': { const d=num(g('b')); return d===0?0:num(g('a'))%d; }
      case 'op.round': return Math.round(num(g('a')));
      case 'op.math': {
        const v=num(g('a')), f=g('f');
        return f==='abs'?Math.abs(v) : f==='sqrt'?Math.sqrt(Math.max(0,v))
             : f==='sin'?Math.sin(v*Math.PI/180) : f==='cos'?Math.cos(v*Math.PI/180)
             : f==='floor'?Math.floor(v) : Math.ceil(v);
      }
      case 'op.random': { const a=num(g('a')), b=num(g('b'));
        const lo=Math.min(a,b), hi=Math.max(a,b);
        return (Number.isInteger(a)&&Number.isInteger(b))
          ? lo+Math.floor(Math.random()*(hi-lo+1)) : lo+Math.random()*(hi-lo); }
      case 'op.lt': return num(g('a')) <  num(g('b'));
      case 'op.gt': return num(g('a')) >  num(g('b'));
      case 'op.eq': return String(g('a')).toLowerCase() === String(g('b')).toLowerCase();
      case 'op.and': return truthy(g('c')) && truthy(g('d'));
      case 'op.or':  return truthy(g('c')) || truthy(g('d'));
      case 'op.not': return !truthy(g('c'));
      case 'op.join': return String(g('a'))+String(g('b'));

      case 'data.get': return lookup(ctx, A.v);
      case 'list.item': { const L=P.lists[A.l]||[]; const i=Math.round(num(g('n')));
                          return (i>=1 && i<=L.length) ? L[i-1] : ''; }
      case 'list.len': return (P.lists[A.l]||[]).length;

      case 'motion.pos': return +(ctx.actor?ctx.actor[g('a')]:0).toFixed(3);
      case 'motion.dir': return ctx.actor?ctx.actor.dir:0;
      case 'sense.dist': { const o=target(g('o'),ctx); if(!o||!ctx.actor) return 0;
        return +Math.hypot(o.x-ctx.actor.x,o.y-ctx.actor.y,o.z-ctx.actor.z).toFixed(2); }
      case 'sense.touch': {
        if(g('o')==='edge') return atEdge(ctx.actor);
        const o=target(g('o'),ctx); if(!o||!ctx.actor) return false;
        const r=(ctx.actor.size+(o.size||1))*0.6;
        return Math.hypot(o.x-ctx.actor.x,o.y-ctx.actor.y,o.z-ctx.actor.z) < r; }
      case 'sense.key': return !!G.keys[keyCode(g('k'))];
      case 'sense.posOf': { const o=target(g('o'),ctx); return o?+(o[g('a')]).toFixed(3):0; }
      case 'sense.timer': return +((performance.now()-t0)/1000).toFixed(2);
      case 'sense.count': { const w=g('o');
        if(w==='clones') return P.actors.filter(a=>a.isClone).length;
        return P.actors.filter(a=>a.name===w).length; }
      default: return 0;
    }
  }
  function keyCode(k){
    k=String(k||'').toLowerCase();
    if(k==='space') return 'Space';
    if(k==='up') return 'ArrowUp'; if(k==='down') return 'ArrowDown';
    if(k==='left') return 'ArrowLeft'; if(k==='right') return 'ArrowRight';
    return 'Key'+k.toUpperCase().slice(0,1);
  }
  /* The room's four walls. An object touches the edge once its own skin
     reaches one — and it STAYS touching if it has already gone past, so a
     fast mover cannot step over the test in one go and escape the room. */
  function atEdge(a){
    if(!a) return false;
    const L=(window.LEVELS||{})[G.room] || { w:70, d:70 };
    const r=(a.size||1)*0.5;                    // walls are 1 thick, centred on w/2
    return Math.abs(a.x) >= L.w/2-0.5-r || Math.abs(a.z) >= L.d/2-0.5-r;
  }
  /* `player` is the person standing in the world; anything else is an object */
  function target(nameOrObj,ctx){
    if(nameOrObj==='player') return { x:G.pos.x, y:G.pos.y-1.7, z:G.pos.z, size:1 };
    if(nameOrObj==='myself') return ctx.actor;
    return actorByName(nameOrObj);
  }

  /* --------------------------------------------------------- statements */
  function* run(list,ctx){
    for(const bk of (list||[])){
      const r = yield* exec(bk,ctx);
      if(r==='stopAll' || r==='stopScript' || r==='killed') return r;
    }
  }
  function* exec(bk,ctx){
    const A=bk.args||{}, g=k=>val(A[k],ctx), a=ctx.actor;
    switch(bk.op){
      /* --- control ------------------------------------------------- */
      case 'ctrl.wait': { yield { wait: Math.max(0,num(g('n'))) }; break; }
      case 'ctrl.repeat': {
        const n=Math.max(0,Math.round(num(g('n'))));
        for(let i=0;i<n;i++){
          const r=yield* run(bk.body,ctx); if(r) return r;
          yield 'tick';
        }
        break;
      }
      case 'ctrl.forever': {
        while(true){
          const r=yield* run(bk.body,ctx); if(r) return r;
          yield 'tick';
        }
      }
      case 'ctrl.repeatUntil': {
        let guard=0;
        while(!truthy(g('c'))){
          const r=yield* run(bk.body,ctx); if(r) return r;
          yield 'tick';
          if(++guard>100000) break;
        }
        break;
      }
      case 'ctrl.waitUntil': {
        while(!truthy(g('c'))) yield 'tick';
        break;
      }
      case 'ctrl.if': { if(truthy(g('c'))){ const r=yield* run(bk.body,ctx); if(r) return r; } break; }
      case 'ctrl.ifelse': {
        const r = truthy(g('c')) ? yield* run(bk.body,ctx) : yield* run(bk.body2,ctx);
        if(r) return r; break;
      }
      case 'ctrl.stop': return g('w')==='all' ? 'stopAll' : 'stopScript';
      case 'ctrl.clone': {
        if(a && P.actors.length<MAXTHREADS){
          const c=addActor({ name:a.name, shape:a.shape, colour:a.colour,
            x:a.x,y:a.y,z:a.z, dir:a.dir, tilt:a.tilt, size:a.size,
            visible:a.visible, scripts:a.scripts, vars:Object.assign({},a.vars), isClone:true });
          startHats('event.clone', null, c);
        }
        break;
      }
      case 'ctrl.delclone': { if(a && a.isClone){ delActor(a); return 'killed'; } break; }

      /* --- events -------------------------------------------------- */
      case 'event.send': { startHats('event.recv', A.m); break; }
      case 'event.sendWait': {
        const made=startHats('event.recv', A.m);
        while(made.some(t=>threads.includes(t))) yield 'tick';
        break;
      }

      /* --- motion -------------------------------------------------- */
      case 'motion.move': {
        if(a){ const d=num(g('n')), r=a.dir*Math.PI/180;
               a.x += Math.sin(r)*d*0.1; a.z += Math.cos(r)*d*0.1; sync(a); }
        break;
      }
      case 'motion.turn': { if(a){ a.dir=(a.dir+num(g('n')))%360; sync(a);} break; }
      case 'motion.tilt': { if(a){ a.tilt=(a.tilt+num(g('n')))%360; sync(a);} break; }
      case 'motion.goto': { if(a){ a.x=num(g('x')); a.y=num(g('y')); a.z=num(g('z')); sync(a);} break; }
      case 'motion.changeBy': { if(a){ a[g('a')] = num(a[g('a')])+num(g('n')); sync(a);} break; }
      case 'motion.setTo': { if(a){ a[g('a')] = num(g('n')); sync(a);} break; }
      case 'motion.point': {
        const o=target(g('o'),ctx);
        if(a&&o){ a.dir = Math.atan2(o.x-a.x, o.z-a.z)*180/Math.PI; sync(a); }
        break;
      }
      case 'motion.glide': {
        if(!a) break;
        const secs=Math.max(0.01,num(g('t')));
        const sx=a.x, sy=a.y, sz=a.z;
        const tx=num(g('x')), ty=num(g('y')), tz=num(g('z'));
        const start=performance.now();
        while(true){
          const k=Math.min(1,(performance.now()-start)/(secs*1000));
          a.x=sx+(tx-sx)*k; a.y=sy+(ty-sy)*k; a.z=sz+(tz-sz)*k; sync(a);
          if(k>=1) break;
          yield 'tick';
        }
        break;
      }

      /* --- looks --------------------------------------------------- */
      case 'looks.say': { if(a) bubble(a, g('s')); break; }
      case 'looks.sayFor': {
        if(a){ bubble(a,g('s')); yield { wait: Math.max(0,num(g('n'))) }; bubble(a,''); }
        break;
      }
      case 'looks.colour': { if(a){ a.colour=String(g('s'));
        // a costume carries the kit's own texture; only a primitive takes a colour
        if(a.mesh && a.mesh.material) a.mesh.material.color.set(a.colour);} break; }
      case 'looks.size': { if(a){ a.size=Math.max(0.1,num(g('n'))); build(a);} break; }
      case 'looks.changeSize': { if(a){ a.size=Math.max(0.1,a.size+num(g('n'))); build(a);} break; }
      case 'looks.show': { if(a){ a.visible=true; sync(a);} break; }
      case 'looks.hide': { if(a){ a.visible=false; sync(a);} break; }
      case 'looks.shape': { if(a){ a.shape=String(g('s')); build(a);} break; }

      /* --- sensing ------------------------------------------------- */
      case 'sense.resetTimer': t0=performance.now(); break;

      /* --- data ---------------------------------------------------- */
      case 'data.set': { assign(ctx, A.v, g('n')); break; }
      case 'data.change': { assign(ctx, A.v, num(lookup(ctx,A.v))+num(g('n'))); break; }
      case 'list.add': { (P.lists[A.l]=P.lists[A.l]||[]).push(g('n')); break; }
      case 'list.del': { const L=P.lists[A.l]||[]; const i=Math.round(num(g('n')));
                         if(i>=1&&i<=L.length) L.splice(i-1,1); break; }
      case 'list.clear': { P.lists[A.l]=[]; break; }

      /* --- my blocks ----------------------------------------------- */
      case 'my.call': {
        const proc=P.procs.find(p=>p.name===A.p);
        if(proc){
          if((ctx.depth||0) > 40) break;                 // recursion has a floor
          const locals={};
          (proc.params||[]).forEach(pm=>{ locals[pm]= val((A.vals||{})[pm], ctx); });
          const r = yield* run(proc.body, { actor:ctx.actor, locals, depth:(ctx.depth||0)+1 });
          if(r==='stopAll') return r;
        }
        break;
      }
      default: break;
    }
  }

  /* One block, run on its own, the way clicking a block in Scratch's palette
     tries it out. A reporter is answered rather than run — the value comes
     straight back for the editor to show. Anything else joins the scheduler,
     which is why this also switches the VM on: trying a block out is running
     the project, just a very small piece of it. */
  function runBlock(bk, actor){
    if(!bk || !actor) return null;
    const bd = window.BLOCKS && BLOCKS.of(bk.op);
    const ctx = { actor, locals:null, depth:0 };
    if(bd && (bd.kind==='report' || bd.kind==='bool')){
      try{ return { value: val(bk,ctx) }; }
      catch(e){ return { value:'' }; }
    }
    if(threads.length>=MAXTHREADS) return null;
    running=true;
    threads.push({ actor, script:null, gen:run([bk],ctx), wait:0 });
    return { started:true };
  }

  /* -------------------------------------------------------- scheduling */
  function startScript(actor, script){
    if(threads.length>=MAXTHREADS) return null;
    const ctx={ actor, locals:null, depth:0 };
    const th={ actor, script, gen:run(script.body,ctx), wait:0 };
    threads.push(th);
    return th;
  }
  function startHats(hatOp, msg, onlyActor){
    const made=[];
    P.actors.forEach(a=>{
      if(onlyActor && a!==onlyActor) return;
      (a.scripts||[]).forEach(sc=>{
        if(!sc.hat || sc.hat.op!==hatOp) return;
        if(msg!=null && (sc.hat.args||{}).m !== msg) return;
        threads=threads.filter(t=>!(t.actor===a && t.script===sc));   // restart, Scratch-style
        const th=startScript(a,sc); if(th) made.push(th);
      });
    });
    return made;
  }
  function greenFlag(){
    threads=[]; t0=performance.now(); running=true;
    P.actors.filter(a=>a.isClone).slice().forEach(delActor);   // clones do not survive a restart
    startHats('event.flag');
  }
  function stopAll(){ running=false; threads=[]; P.actors.forEach(a=>bubble(a,'')); }

  let keyWas={};
  function step(dt){
    if(!group) return;
    if(running){
      // key hats fire on the press, not every frame it is held
      P.actors.forEach(a=>(a.scripts||[]).forEach(sc=>{
        if(!sc.hat || sc.hat.op!=='event.key') return;
        const code=keyCode((sc.hat.args||{}).k);
        const down=!!G.keys[code];
        if(down && !keyWas[code+sc.id]) startScript(a,sc);
        keyWas[code+sc.id]=down;
      }));
      advance(dt);
    }
  }
  function advance(dt){
    /* Iterate a snapshot and remove only what finished. Rebuilding the list
       from the survivors would silently drop every thread STARTED during the
       pass — which is exactly what a clone or a broadcast does, so neither
       used to run. */
    const snapshot = threads.slice();
    const dead = new Set();
    for(const th of snapshot){
      if(th.wait>0){ th.wait-=dt; continue; }
      let guard=0;
      while(true){
        let r;
        try{ r=th.gen.next(); }
        catch(e){ console.warn('script error',e); dead.add(th); break; }
        if(r.done){
          dead.add(th);
          if(r.value==='stopAll'){ threads=[]; running=false; return; }
          break;
        }
        const y=r.value;
        if(y && typeof y==='object' && 'wait' in y){ th.wait=y.wait; break; }
        if(y==='tick') break;
        if(++guard>2000) break;              // a runaway block still yields the frame
      }
    }
    if(dead.size) threads = threads.filter(t=>!dead.has(t));
  }

  /* -------------------------------------------------------- persistence */
  function save(){
    try{
      localStorage.setItem(KEY, JSON.stringify({
        actors:P.actors.map(a=>({ id:a.id,name:a.name,shape:a.shape,colour:a.colour,
          x:a.x,y:a.y,z:a.z,dir:a.dir,tilt:a.tilt,size:a.size,visible:a.visible,
          scripts:a.scripts, vars:a.vars, isClone:a.isClone, home:a.home })).filter(a=>!a.isClone),
        vars:P.vars, lists:P.lists, procs:P.procs, msgs:P.msgs, uid
      }));
    }catch(e){}
  }
  function load(){
    let raw=null;
    try{ raw=JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){}
    reset();
    if(raw && Array.isArray(raw.actors)){
      Object.assign(P.vars, raw.vars||{});
      Object.assign(P.lists, raw.lists||{});
      (raw.procs||[]).forEach(x=>P.procs.push(x));
      if(raw.msgs&&raw.msgs.length){ P.msgs.length=0; raw.msgs.forEach(m=>P.msgs.push(m)); }
      uid=raw.uid||1;
      raw.actors.forEach(a=>{ a.mesh=null; a.bubble=null;
        if(!a.home) a.home=snapshot(a);   // saved before objects remembered a home
        P.actors.push(a); });
    }
  }

  /* ------------------------------------------------------------- mount */
  function enter(parent){
    load();
    group=new THREE.Group(); parent.add(group);
    P.actors.forEach(build);
    if(!P.actors.length) addActor({ name:'Blocky', x:0, y:1, z:0 });
    threads=[]; running=false; t0=performance.now();
  }
  function leave(){ group=null; threads=[]; running=false; }
  function reset(){
    P.actors.slice().forEach(delActor);
    P.actors.length=0; P.procs.length=0; P.msgs.length=0; P.msgs.push('message1');
    Object.keys(P.vars).forEach(k=>delete P.vars[k]);
    Object.keys(P.lists).forEach(k=>delete P.lists[k]);
    threads=[]; running=false;
  }
  function wipe(){ reset(); uid=1; addActor({name:'Blocky',x:0,y:1,z:0}); save(); }

  return {
    get project(){ return P; },
    get running(){ return running; },
    get threadCount(){ return threads.length; },
    enter, leave, step, save, load, wipe, resetActor, dress, runBlock, ghostMesh,
    addActor, delActor, build, sync, actorByName,
    greenFlag, stopAll, startHats,
    evalBlock, lookup, num, truthy
  };
})();
