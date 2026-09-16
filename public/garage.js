/* =====================================================================
   THE GARAGE — the rover as a thing you can look at, and the bench you
   build it on.

   rover.js is the economy and has no screen in it. This is the screen:
   the machine itself, bolted together out of the parts that were actually
   chosen, and a console for choosing them.

   THE MODEL IS BUILT FROM THE SPEC, not picked from a shelf of finished
   ones. Treads and wheels are different shapes, a second cell is a second
   box on the back, and a sensor is a thing on a mast — so the rover parked
   outside the house IS the build, and a student who swaps the wheels
   watches the wheels change. A build stage whose result you cannot see is
   a form.

   THE COUNTER IS THE WHOLE INTERFACE. Twelve cells, what the parts have
   taken and what is left to drive on, updated as each part is picked —
   because the decision is arithmetic and the arithmetic should be in front
   of them while they make it, which is what the Swarm does with its block
   budget and what Ion's console does with 4 x 10.
   ===================================================================== */
window.GARAGE = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say = (s,p) => (typeof window.t==='function' ? window.t(s,p) : s);
  const V = () => window.ROVER;

  /* Where a finished build is kept, so the rover outside the door is the
     one that was built and not a fresh one every time the world loads. */
  const KEY='rover_build';
  function saved(){
    try{ const raw=window.PROGRESS && PROGRESS.get(KEY,null);
         return raw ? V().tidy(JSON.parse(raw)) : null; }catch(e){ return null; }
  }
  function keep(s){
    try{ if(window.PROGRESS) PROGRESS.set(KEY, JSON.stringify(V().tidy(s))); }catch(e){}
  }

  const COL = { body:0xd8d2c4, dark:0x2e3444, tread:0x22262f,
                cell:0x8ff0ff, mast:0x7b87a4, eye:0xff9aa2 };
  const lam = c => new THREE.MeshLambertMaterial({color:c});

  /* ------------------------------------------------------------- the model
     Two and a half metres of rover, built nose to +Z so it can be turned
     with the same frame every other thing on this planet stands in. */
  function model(spec){
    const s = V().tidy(spec || V().bare());
    const g = new THREE.Group();

    const hull=new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.3), lam(COL.body));
    hull.position.y=0.78; g.add(hull);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 1.5), lam(COL.dark));
    deck.position.y=1.09; g.add(deck);

    if(s.drive==='treads'){
      /* A tread is a long box with a roller at each end — at this size a
         real track is four hundred triangles nobody will ever see. */
      [-1,1].forEach(sx=>{
        const t=new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 2.5), lam(COL.tread));
        t.position.set(sx*0.82, 0.5, 0); g.add(t);
        [-1,1].forEach(sz=>{
          const r=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.44,14), lam(COL.dark));
          r.rotation.z=Math.PI/2; r.position.set(sx*0.82, 0.5, sz*1.1); g.add(r);
        });
      });
    } else {
      [-1,1].forEach(sx=>[-1,1].forEach(sz=>{
        const w=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.26,16), lam(COL.tread));
        w.rotation.z=Math.PI/2; w.position.set(sx*0.80, 0.42, sz*0.86); g.add(w);
      }));
    }

    /* THE CELLS ARE ON TOP, SIDE BY SIDE, AND YOU CAN COUNT THEM. What the
       rover is carrying is the whole subject of this stage, so they sit up
       on the deck rather than bolted to the tail where the first version
       put them — from every angle a player actually sees the rover from,
       the tail is the one part hidden by the rest of it, and "is there a
       second cell?" was a question you had to walk round the back to
       answer. */
    const cell=(x)=>{
      const c=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.42,0.62), lam(COL.cell));
      c.position.set(x, 1.38, -0.42); g.add(c);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.06,0.66), lam(COL.dark));
      cap.position.set(x, 1.62, -0.42); g.add(cap);
    };
    cell(s.battery==='spare' ? -0.29 : 0);
    if(s.battery==='spare') cell(0.29);

    if(s.sensor==='eye'){
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.75,8), lam(COL.mast));
      mast.position.set(0, 1.5, 0.78); g.add(mast);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10), lam(COL.eye));
      eye.position.set(0, 1.92, 0.84); g.add(eye);
    }
    return g;
  }

  /* =================================================================== */
  let ui=null, state=null, opts=null, open=false;

  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #garage{position:fixed;inset:0;z-index:70;display:flex;align-items:center;
              justify-content:center;background:#0a0710e8;
              font:400 15px/1.5 system-ui,sans-serif;color:#efe9ff}
      #garage.hidden{display:none}
      .gwrap{width:min(840px,calc(100vw - 40px));max-height:calc(100vh - 56px);
             background:#171225;border:2px solid #6b5f8f;border-radius:18px;
             box-shadow:0 24px 70px #000b;display:flex;flex-direction:column;overflow:hidden}
      .ghead{padding:14px 18px;background:#1f1833;border-bottom:2px solid #372c56}
      .ghead b{font:700 15px/1 ui-monospace,monospace;letter-spacing:.1em;
               text-transform:uppercase;color:#8ff0ff}
      .ghead span{display:block;color:#9b8fc4;font-size:13px;margin-top:4px}
      .gbody{padding:18px;overflow:auto}
      /* THE COUNTER, and it is the biggest thing in the panel because it is
         the thing being decided. */
      .gcells{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
              background:#241d33;border:2px solid #7a6ab0;border-radius:12px;
              padding:12px 14px;margin-bottom:14px}
      .gpips{display:flex;gap:4px}
      .gpip{width:16px;height:26px;border-radius:4px;background:#3a3150;
            border:1px solid #544a75}
      .gpip.spent{background:#ffb4a2;border-color:#ffb4a2}
      .gpip.left{background:#8ff0ff;border-color:#8ff0ff}
      .gnum{font:700 14px/1.3 ui-monospace,monospace;color:#cfc6ea}
      .gnum b{color:#8ff0ff}
      .gnum i{color:#ffb4a2;font-style:normal}
      .gslot{margin-bottom:14px}
      .gslot h4{margin:0 0 7px;font:700 11px/1 ui-monospace,monospace;
                letter-spacing:.12em;text-transform:uppercase;color:#9b8fc4}
      .gopts{display:flex;gap:10px;flex-wrap:wrap}
      .gopt{flex:1 1 220px;text-align:left;cursor:pointer;
            background:#1e1830;border:2px solid #3f3560;border-radius:12px;
            padding:10px 12px;color:#e8e2f6;font:inherit}
      .gopt:hover{border-color:#6b5f8f}
      .gopt.on{border-color:#8ff0ff;background:#1b2a33}
      .gopt .gn{display:flex;justify-content:space-between;gap:10px;
                font-weight:700;margin-bottom:3px}
      .gopt .gc{font:700 12px ui-monospace,monospace;color:#ffb4a2}
      .gopt .gc.free{color:#a8e6cf}
      .gopt .gb{font-size:13px;color:#b4a9d4;line-height:1.45}
      .gverd{border-radius:12px;padding:12px 14px;margin-top:4px;font-size:14px;
             border:2px solid #7a6ab0;background:#241d33}
      .gverd.ok{border-color:#a8e6cf;color:#cdf3e2}
      .gverd.no{border-color:#ff9aa2;color:#ffd3d8}
      .gverd b{color:#ffd8a8}
      .gfoot{display:flex;gap:10px;align-items:center;padding:12px 18px;
             background:#1b1428;border-top:2px solid #372c56}
      .gbtn{border:0;border-radius:11px;padding:11px 20px;cursor:pointer;
            font:700 14px/1 ui-monospace,monospace;letter-spacing:.08em}
      .ggo{background:#8ff0ff;color:#0b2027}
      .gout{background:#2a2340;color:#cfc6ea}
      .gbtn:disabled{opacity:.45;cursor:default}`;
    document.head.appendChild(css);
    const el=document.createElement('div');
    el.id='garage'; el.className='hidden';
    el.innerHTML=`<div class="gwrap">
      <div class="ghead"><b>${say('THE ROVER · bench')}</b>
        <span>${say('Twelve cells. Every part you bolt on is a cell you cannot drive with.')}</span></div>
      <div class="gbody">
        <div class="gcells" id="gcells"></div>
        <div id="gslots"></div>
        <div class="gverd" id="gverd"></div>
      </div>
      <div class="gfoot">
        <button class="gbtn ggo" id="ggo">${say('BOLT IT ON')}</button>
        <button class="gbtn gout" id="gshut">${say('CLOSE')}</button>
      </div></div>`;
    document.body.appendChild(el);
    ui={ el, cells:$('#gcells',el), slots:$('#gslots',el), verd:$('#gverd',el),
         go:$('#ggo',el), shut:$('#gshut',el) };
    ui.shut.onclick=()=>close();
    ui.go.onclick=()=>bolt();
    return ui;
  }

  /* ------------------------------------------------------------- drawing */
  function pips(){
    const R=V(), sp=R.spent(state), left=R.power(state);
    /* Spent pips first, then what is left to drive on. They do not add up
       to twelve when a second cell is fitted, and that is the point of
       drawing it rather than printing a number. */
    let html='<div class="gpips">';
    for(let i=0;i<sp;i++)   html+='<span class="gpip spent"></span>';
    for(let i=0;i<left;i++) html+='<span class="gpip left"></span>';
    html+='</div>';
    return html + `<div class="gnum">${say('bolted on')} <i>${sp}</i> · `
                + `${say('left to drive on')} <b>${left}</b></div>`;
  }

  function draw(){
    const u=dom(), R=V();
    u.cells.innerHTML = pips();
    u.slots.innerHTML = R.SLOTS.map(slot=>{
      const group=R.PARTS[slot];
      return `<div class="gslot"><h4>${say(group.name)}</h4><div class="gopts">` +
        group.options.map(o=>`
          <button class="gopt${state[slot]===o.id?' on':''}" data-slot="${slot}" data-id="${o.id}">
            <span class="gn">${say(o.name)}
              <span class="gc${o.cost?'':' free'}">${o.cost ? '−'+o.cost : say('free')}${
                o.spare ? ' / +'+o.spare : ''}</span></span>
            <span class="gb">${say(o.blurb)}</span>
          </button>`).join('') +
        `</div></div>`;
    }).join('');
    u.slots.querySelectorAll('.gopt').forEach(b=>{
      b.onclick=()=>{ state[b.dataset.slot]=b.dataset.id;
                      state=R.tidy(state); draw(); };
    });

    const v=R.verdict(state);
    u.verd.className='gverd '+(v.ok?'ok':'no');
    u.verd.innerHTML = v.ok
      ? say('It can make it — <b>{s}</b>, which is {n} spans, on {p} cells. Bolt it on.',
            { s:say(v.route.name), n:v.route.spans, p:v.power })
      : R.why(state);
    u.go.disabled = !v.ok;
  }

  function bolt(){
    const R=V();
    if(!R.verdict(state).ok) return;
    keep(state);
    const fn = opts && opts.onBuilt;
    const built = R.tidy(state);
    close();
    if(fn) fn(built);
  }

  /* ---------------------------------------------------------------- open */
  function openIt(o){
    if(open) return;
    if(!V()){ console.warn('GARAGE: rover.js is not loaded'); return; }
    opts=o||{}; open=true;
    state = saved() || V().bare();
    const u=dom();
    u.el.classList.remove('hidden');
    draw();
    if(document.pointerLockElement) document.exitPointerLock();
    G.running=false;
  }
  function close(){
    if(!open) return;
    open=false;
    if(ui) ui.el.classList.add('hidden');
    G.running=true;
  }

  return { model, open:openIt, close, saved, keep,
           get active(){ return open; }, get state(){ return state; } };
})();
