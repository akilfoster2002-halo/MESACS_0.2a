/* =====================================================================
   SANDBOX — the Free Play world, and the machine that runs inside it.

   There is no objective here and nothing to finish. You place parts,
   join them, write behaviour, press RUN, and watch what happens.

   Three ideas hold the whole thing up:

   1. A MACHINE IS NOT A THING. Nothing in this file knows what a robot,
      a drone or a door is. A machine is whatever set of parts happen to
      be joined together — worked out by walking the link graph. Wire a
      sensor to a motor to a wheel and you have built a robot; the code
      never learns the word.

   2. THE CIRCUIT IS REAL. Power floods out from batteries through the
      things that conduct, and a switch that is off genuinely stops it.
      A light with no path back to a charged battery does not light,
      whatever the program says.

   3. THE PROGRAM IS THE POINT. Everything above exists so that
      WHEN / IF / THEN has something true to act on. Programs run as
      little coroutines so WAIT can mean wait, and REPEAT can mean
      repeat, without freezing the world.
   ===================================================================== */
window.SANDBOX = (function(){
  const KEY='dq_sandbox';
  const GRID=1;                       // parts snap to a one-unit grid
  const TICK=1/20;                    // the simulation settles 20 times a second

  let W = blank();
  let group=null, linkGroup=null, acc=0, running=true, uid=1;

  function blank(){ return { parts:[], links:[], progs:[], funcs:[] }; }
  const byUid = u => W.parts.find(p=>p.uid===u) || null;
  const def   = p => PARTS.of(p.type);
  const hasPort=(p,port)=>!!(def(p) && def(p).ports[port]);

  /* ------------------------------------------------------------- build */
  function mesh(d){
    const s=d.shape, mat=new THREE.MeshLambertMaterial({color:d.color});
    let g;
    if(s.k==='cyl'){ g=new THREE.CylinderGeometry(s.r,s.r,s.h,16); }
    else if(s.k==='sph'){ g=new THREE.SphereGeometry(s.r,14,10); }
    else { g=new THREE.BoxGeometry(s.w,s.h,s.d); }
    const m=new THREE.Mesh(g,mat);
    if(s.lay) m.rotation.z=Math.PI/2;          // a wheel stands on its edge
    const holder=new THREE.Group();
    holder.add(m);
    holder.userData.core=m;
    return holder;
  }
  function height(d){
    const s=d.shape;
    return s.k==='sph' ? s.r*2 : (s.k==='cyl' ? (s.lay ? s.r*2 : s.h) : s.h);
  }

  function place(type, x, z, y){
    const d=PARTS.of(type); if(!d) return null;
    const p = { uid:uid++, type, name:d.name,
                x:Math.round(x/GRID)*GRID, z:Math.round(z/GRID)*GRID,
                y: y===undefined ? height(d)/2 : y,
                rot:0, props:Object.assign({},d.props),
                powered:false, sig:0 };
    spawn(p);
    W.parts.push(p);
    save();
    return p;
  }
  function spawn(p){
    const d=def(p); if(!d || !group) return;
    const m=mesh(d);
    m.position.set(p.x,p.y,p.z);
    m.rotation.y=p.rot;
    m.userData.owner=m; m.userData.part=p; m.userData.label=p.name;
    const core=m.userData.core;
    core.userData.owner=m; core.userData.part=p;
    group.add(m); G.hits.push(core);
    p.mesh=m;
  }
  function despawn(p){
    if(!p.mesh) return;
    if(p.mesh.parent) p.mesh.parent.remove(p.mesh);
    G.hits = G.hits.filter(h=>h.userData.part!==p);
    p.mesh=null;
  }
  function remove(p){
    if(!p) return;
    W.links = W.links.filter(l=>l.a!==p.uid && l.b!==p.uid);
    W.progs = W.progs.filter(pr=>!usesPart(pr,p.uid));
    despawn(p);
    W.parts = W.parts.filter(x=>x!==p);
    drawLinks(); save();
  }
  function rotate(p, by){ if(!p) return; p.rot=(p.rot+(by||Math.PI/2))%(Math.PI*2);
                          if(p.mesh) p.mesh.rotation.y=p.rot; save(); }
  function rename(p,n){ if(!p) return; p.name=String(n||'').slice(0,20)||def(p).name;
                        if(p.mesh) p.mesh.userData.label=p.name; save(); }
  function setProp(p,k,v){ if(!p) return; p.props[k]=v; save(); }

  /* duplicating a part is dull; duplicating the machine it belongs to is
     the thing you actually want at 2pm on a Tuesday */
  function duplicate(p, dx, dz){
    const ids=machineOf(p), map={};
    ids.forEach(u=>{
      const s=byUid(u); if(!s) return;
      const c=place(s.type, s.x+(dx||3), s.z+(dz||0), s.y);
      if(!c) return;
      c.rot=s.rot; if(c.mesh) c.mesh.rotation.y=c.rot;
      c.props=Object.assign({},s.props);
      c.name=s.name;
      map[u]=c.uid;
    });
    W.links.filter(l=>ids.includes(l.a)&&ids.includes(l.b))
      .forEach(l=>{ if(map[l.a]&&map[l.b]) W.links.push({a:map[l.a],b:map[l.b],kind:l.kind}); });
    drawLinks(); save();
    return map;
  }

  /* --------------------------------------------------------- the links */
  function canLink(a,b){
    if(!a||!b||a===b) return null;
    const A=def(a), B=def(b); if(!A||!B) return null;
    if((A.ports.pout&&B.ports.pin)||(A.ports.pin&&B.ports.pout)) return 'power';
    if((A.ports.sout&&B.ports.sin)||(A.ports.sin&&B.ports.sout)) return 'signal';
    return null;
  }
  function link(a,b){
    const kind=canLink(a,b); if(!kind) return null;
    if(W.links.some(l=>(l.a===a.uid&&l.b===b.uid)||(l.a===b.uid&&l.b===a.uid))) return null;
    const l={a:a.uid,b:b.uid,kind};
    W.links.push(l); drawLinks(); save();
    return l;
  }
  function unlinkAll(p){
    if(!p) return;
    W.links=W.links.filter(l=>l.a!==p.uid&&l.b!==p.uid);
    drawLinks(); save();
  }
  function linksOf(u){ return W.links.filter(l=>l.a===u||l.b===u); }
  const other = (l,u) => l.a===u ? l.b : l.a;

  function drawLinks(){
    if(!linkGroup) return;
    while(linkGroup.children.length) linkGroup.remove(linkGroup.children[0]);
    W.links.forEach(l=>{
      const a=byUid(l.a), b=byUid(l.b); if(!a||!b) return;
      const g=new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x,a.y+0.2,a.z), new THREE.Vector3(b.x,b.y+0.2,b.z)]);
      linkGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({
        color: l.kind==='power' ? 0xffd8a8 : 0x8fd3ff })));
    });
  }

  /* A machine is an emergent thing: everything reachable from here by any
     link. Nothing declares it, nothing names it, and two students can build
     completely different devices out of the same five parts. */
  function machineOf(p){
    if(!p) return [];
    const seen=new Set([p.uid]), q=[p.uid];
    while(q.length){
      const u=q.shift();
      linksOf(u).forEach(l=>{ const o=other(l,u); if(!seen.has(o)){ seen.add(o); q.push(o); } });
    }
    return [...seen];
  }

  /* -------------------------------------------------------- the circuit */
  const isSource = p => (p.type==='battery' && p.props.charge>0) ||
                        (p.type==='generator' && p.props.on);
  function conducts(p){
    if(isSource(p)) return true;
    if(p.type==='switch') return !!p.props.on;
    if(p.type==='button') return !!p.props.on;
    return hasPort(p,'pin') && hasPort(p,'pout');       // wire and friends
  }
  function solvePower(){
    W.parts.forEach(p=>p.powered=false);
    const q=[];
    W.parts.forEach(p=>{ if(isSource(p)){ p.powered=true; q.push(p); } });
    const seen=new Set(q.map(p=>p.uid));
    while(q.length){
      const p=q.shift();
      if(!conducts(p)) continue;                        // the circuit stops here
      linksOf(p.uid).filter(l=>l.kind==='power').forEach(l=>{
        const n=byUid(other(l,p.uid));
        if(!n || seen.has(n.uid) || !hasPort(n,'pin')) return;
        n.powered=true; seen.add(n.uid); q.push(n);
      });
    }
  }

  /* ------------------------------------------------------- the senses */
  function nearestPlayer(p){
    return Math.hypot(G.pos.x-p.x, G.pos.z-p.z);
  }
  function readSensors(dt){
    W.parts.forEach(p=>{
      if(p.type==='motion')     p.props.reads = nearestPlayer(p) <= p.props.range ? 1 : 0;
      else if(p.type==='distance') p.props.reads = +Math.min(nearestPlayer(p), p.props.range).toFixed(1);
      else if(p.type==='pressure') p.props.reads = (nearestPlayer(p) < 1.4 && G.pos.y < p.y+2.6) ? 1 : 0;
      else if(p.type==='lightsense'){
        let lit=0;
        W.parts.forEach(q=>{ if(q.type==='light' && effectiveOn(q) && q.powered){
          const d=Math.hypot(q.x-p.x,q.z-p.z); if(d<12) lit += (12-d)/12*q.props.bright; } });
        p.props.reads=+lit.toFixed(1);
      }
      else if(p.type==='temp'){
        let heat=20;
        W.parts.forEach(q=>{ if((q.type==='motor'||q.type==='rotor') && effectiveOn(q) && q.powered){
          const d=Math.hypot(q.x-p.x,q.z-p.z); if(d<8) heat += (8-d); } });
        p.props.reads = +heat.toFixed(1);
      }
    });
  }

  /* signal in = the strongest thing feeding this part down a signal link */
  function signalInto(p){
    let v=0;
    linksOf(p.uid).filter(l=>l.kind==='signal').forEach(l=>{
      const o=byUid(other(l,p.uid)); if(!o) return;
      if(!hasPort(o,'sout')) return;
      v=Math.max(v, outputOf(o));
    });
    return v;
  }
  function inputsOf(p){
    const out=[];
    linksOf(p.uid).filter(l=>l.kind==='signal').forEach(l=>{
      const o=byUid(other(l,p.uid));
      if(o && hasPort(o,'sout')) out.push(outputOf(o));
    });
    return out;
  }
  function outputOf(p){
    switch(p.type){
      case 'battery':  return p.props.charge;
      case 'button':
      case 'switch':   return p.props.on ? 1 : 0;
      case 'motion': case 'distance': case 'lightsense':
      case 'pressure': case 'temp':   return p.props.reads;
      case 'and': case 'or': case 'not': case 'timer':
      case 'counter': case 'compare':  return p.props.reads;
      case 'wire':     return p.sig||0;
      default:         return p.props.on ? 1 : 0;
    }
  }
  /* Gates settle over a few passes rather than a topological sort: cheap,
     and a loop of gates then oscillates the way real ones do instead of
     hanging the frame. */
  function solveLogic(dt){
    for(let pass=0; pass<4; pass++){
      W.parts.forEach(p=>{
        const ins=inputsOf(p);
        if(p.type==='and')  p.props.reads = (ins.length && ins.every(v=>v>0)) ? 1 : 0;
        if(p.type==='or')   p.props.reads = ins.some(v=>v>0) ? 1 : 0;
        if(p.type==='not')  p.props.reads = (ins.length && ins[0]>0) ? 0 : 1;
        if(p.type==='compare'){
          const v=ins.length?ins[0]:0, t=+p.props.value||0, op=p.props.op||'>';
          p.props.reads = (op==='>'?v>t : op==='<'?v<t : Math.abs(v-t)<0.001) ? 1 : 0;
        }
        if(p.type==='wire') p.sig = ins.length ? Math.max(...ins) : 0;
      });
    }
    // the two with a memory of their own
    W.parts.forEach(p=>{
      if(p.type==='timer'){
        p._t=(p._t||0)+dt;
        const half=Math.max(0.1,(+p.props.every||2))/2;
        if(p._t>=half){ p._t=0; p.props.reads = p.props.reads>0?0:1; }
      }
      if(p.type==='counter'){
        const hot=inputsOf(p).some(v=>v>0);
        if(hot && !p._hot) p.props.count=(+p.props.count||0)+1;
        p._hot=hot;
        p.props.reads = p.props.count >= (+p.props.target||1) ? 1 : 0;
      }
    });
  }

  /* A thing is on if its own switch says so OR something is signalling it.
     That is what lets a student wire a sensor straight to a motor and have
     it simply work, before they have written a line of anything. */
  function effectiveOn(p){
    if(p.props.on) return true;
    return signalInto(p) > 0;
  }

  /* ------------------------------------------------------- the movement */
  function actuate(dt){
    let draw=0;
    W.parts.forEach(p=>{
      const d=def(p); if(!d || !d.live) return;
      const on = p.powered && effectiveOn(p);
      const core = p.mesh && p.mesh.userData.core;

      if(p.type==='motor'||p.type==='gear'||p.type==='rotor'){
        if(on && core){
          const sp = (+p.props.speed||60) * (p.type==='gear' ? (+p.props.ratio||1) : 1);
          core.rotation.y += sp*Math.PI/180*dt;
          draw += p.type==='rotor' ? 3 : 1.5;
        }
      }
      if(p.type==='light'){
        if(core){
          core.material.emissive = core.material.emissive || new THREE.Color();
          core.material.emissive.setHex(on ? 0xffe9a8 : 0x000000);
        }
        if(on) draw += 0.4;
      }
      if(p.type==='piston'){
        const want = on ? (+p.props.reach||1.6) : 0;
        p._ext = (p._ext||0) + (want-(p._ext||0))*Math.min(1,dt*4);
        if(core) core.position.y = p._ext;
        if(on) draw += 1;
      }
      if(p.type==='hinge'){
        const want = on ? (+p.props.angle||95)*Math.PI/180 : 0;
        p._a = (p._a||0) + (want-(p._a||0))*Math.min(1,dt*4);
        if(p.mesh) p.mesh.rotation.y = p.rot + p._a;
        if(on) draw += 0.6;
      }
      /* a driven wheel moves the whole machine it belongs to — which is how
         a pile of parts becomes a vehicle without anybody calling it one */
      if(p.type==='wheel' && on){
        const sp=(+p.props.speed||40)/40 * 1.4 * dt;
        const dx=-Math.sin(p.rot)*sp, dz=-Math.cos(p.rot)*sp;
        machineOf(p).forEach(u=>{
          const q=byUid(u); if(!q) return;
          q.x+=dx; q.z+=dz;
          if(q.mesh) q.mesh.position.set(q.x,q.y,q.z);
        });
        if(core) core.rotation.x -= sp*3;
        draw += 1.2;
        p._moved=true;
      }
    });
    if(draw>0) drawLinks();                      // wires follow what they join

    // batteries pay for all of it, generators put some back
    const gens = W.parts.filter(p=>p.type==='generator' && p.props.on).length;
    W.parts.filter(p=>p.type==='battery').forEach(b=>{
      const share = draw / Math.max(1, W.parts.filter(x=>x.type==='battery').length);
      b.props.charge = Math.max(0, Math.min(+b.props.capacity||100,
        (+b.props.charge||0) - share*dt*0.8 + gens*(6)*dt*0.25));
      b.props.charge = +b.props.charge.toFixed(2);
    });
  }

  /* ------------------------------------------------------- the programs
     A program is WHEN something happens, IF some things are true, THEN do
     a list of steps. Steps run as a coroutine so WAIT genuinely waits and
     REPEAT genuinely loops, without stopping the world while it does. */
  let jobs=[];
  function newProgram(){
    const pr={ id:uid++, name:'Behaviour '+(W.progs.length+1), enabled:true,
               when:{ part:null, event:'on' }, ifs:[], then:[] };
    W.progs.push(pr); save(); return pr;
  }
  function usesPart(pr,u){
    if(pr.when.part===u) return true;
    if(pr.ifs.some(c=>c.part===u)) return true;
    const walk=st=>st.some(s=>s.part===u || (s.steps&&walk(s.steps)));
    return walk(pr.then);
  }
  function whenTrue(pr){
    const p=byUid(pr.when.part); if(!p) return false;
    const v=outputOf(p);
    switch(pr.when.event){
      case 'on':      return v>0;
      case 'off':     return !(v>0);
      case 'above':   return v > (+pr.when.value||0);
      case 'below':   return v < (+pr.when.value||0);
      default:        return v>0;
    }
  }
  function ifsPass(pr){
    return pr.ifs.every(c=>{
      const p=byUid(c.part); if(!p) return false;
      const v=outputOf(p), t=+c.value||0;
      if(c.op==='>') return v>t;
      if(c.op==='<') return v<t;
      if(c.op==='=') return Math.abs(v-t)<0.001;
      if(c.op==='on') return v>0;
      if(c.op==='off') return !(v>0);
      return false;
    });
  }
  /* flatten REPEAT and CALL into a plain list the runner can walk */
  function expand(steps, depth){
    if((depth||0)>6) return [];
    const out=[];
    (steps||[]).forEach(s=>{
      if(s.do==='repeat'){
        const n=Math.max(0,Math.min(50,+s.times||1));
        for(let i=0;i<n;i++) out.push(...expand(s.steps,(depth||0)+1));
      } else if(s.do==='call'){
        const f=W.funcs.find(f=>f.name===s.name);
        if(f) out.push(...expand(f.steps,(depth||0)+1));
      } else out.push(s);
    });
    return out;
  }
  function fire(pr){
    if(jobs.some(j=>j.pr===pr)) return;          // already running
    jobs.push({ pr, steps:expand(pr.then), i:0, wait:0 });
  }
  function runJobs(dt){
    jobs = jobs.filter(j=>{
      if(j.wait>0){ j.wait-=dt; return true; }
      while(j.i < j.steps.length){
        const s=j.steps[j.i++];
        if(s.do==='wait'){ j.wait=Math.max(0,(+s.ms||1000))/1000; return true; }
        if(s.do==='set'){
          const p=byUid(s.part);
          if(p){
            let v=s.value;
            if(v==='true') v=true; else if(v==='false') v=false;
            else if(v!=='' && !isNaN(+v)) v=+v;
            p.props[s.prop]=v;
          }
        }
      }
      return false;                              // finished
    });
  }
  function runPrograms(dt){
    W.progs.forEach(pr=>{
      if(!pr.enabled || !pr.when.part) return;
      const now=whenTrue(pr);
      if(now && !pr._was && ifsPass(pr)) fire(pr);   // edge triggered
      pr._was=now;
    });
    runJobs(dt);
  }

  /* ------------------------------------------------------------- clock */
  function tick(dt){
    if(!group) return;
    acc+=Math.min(dt,0.25);
    while(acc>=TICK){
      acc-=TICK;
      if(running){
        solvePower();
        readSensors(TICK);
        solveLogic(TICK);
        runPrograms(TICK);
        actuate(TICK);
      }
    }
  }
  function setRunning(v){
    running=!!v;
    if(!running){ jobs=[]; W.progs.forEach(p=>p._was=false); }
  }

  /* -------------------------------------------------------- persistence */
  function save(){
    try{
      localStorage.setItem(KEY, JSON.stringify({
        parts:W.parts.map(p=>({uid:p.uid,type:p.type,name:p.name,x:p.x,y:p.y,z:p.z,rot:p.rot,props:p.props})),
        links:W.links, progs:W.progs.map(p=>({...p,_was:undefined})), funcs:W.funcs, uid
      }));
    }catch(e){}
  }
  function load(){
    let raw=null;
    try{ raw=JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){}
    W=blank();
    if(raw && Array.isArray(raw.parts)){
      W.parts = raw.parts.map(p=>({ ...p, powered:false, sig:0, mesh:null }));
      W.links = raw.links||[];
      W.progs = (raw.progs||[]).map(p=>({ ...p, ifs:p.ifs||[], then:p.then||[] }));
      W.funcs = raw.funcs||[];
      uid = raw.uid || (W.parts.reduce((m,p)=>Math.max(m,p.uid),0)+1);
    }
  }
  function wipe(){ W=blank(); uid=1; rebuild(); save(); }

  /* ------------------------------------------------------------- mount */
  function enter(parent){
    load();
    group=new THREE.Group(); parent.add(group);
    linkGroup=new THREE.Group(); parent.add(linkGroup);
    rebuild();
    running=true; jobs=[];
  }
  function rebuild(){
    if(!group) return;
    while(group.children.length) group.remove(group.children[0]);
    G.hits = G.hits.filter(h=>!h.userData.part);
    W.parts.forEach(p=>{ p.mesh=null; spawn(p); });
    drawLinks();
  }
  function leave(){ group=null; linkGroup=null; jobs=[]; }

  return {
    get world(){ return W; },
    get running(){ return running; },
    setRunning, enter, leave, tick, save, load, wipe, rebuild,
    place, remove, rotate, rename, setProp, duplicate,
    link, unlinkAll, canLink, linksOf, machineOf, byUid, def, outputOf,
    effectiveOn, newProgram, expand,
    hasPort
  };
})();
