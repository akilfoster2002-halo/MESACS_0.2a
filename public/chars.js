/* =====================================================================
   CHARS — the "choose your character" screen.

   Three are yours from the start and the rest unlock as missions fall, so
   the grid has something to grow into.  Whoever you are looking at stands
   in a little turntable above the grid and plays their idle, because a
   still PNG tells you nothing about who you are about to be.
   ===================================================================== */
window.CHARS = (function(){
  const FREE = 3;                       // unlocked before you have played anything
  const PER_MISSION = 5;                // and how many each finished mission adds

  let view=null, previewing=null, raf=0, last=0;

  function unlockedCount(){
    let done=0;
    try{ ['m1','m2','m3'].forEach(id=>{ if(PROGRESS.isDone(id)) done++; }); }catch(e){}
    return Math.min(AVATAR.CHARS.length, FREE + done*PER_MISSION);
  }
  function isUnlocked(i){ return i < unlockedCount(); }

  /* ---------------------------------------------- the little turntable */
  function stage(){
    if(view) return view;
    const canvas=document.querySelector('#charView');
    if(!canvas) return null;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    const scene=new THREE.Scene();
    // framed so a 1.85-tall character just fills the panel with a little air
    const camera=new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 0.12, 3.7);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 1.5));
    const key=new THREE.DirectionalLight(0xfff3f8, 1.5); key.position.set(3,6,5);
    const rim=new THREE.DirectionalLight(0x9fb4ff, 0.8);  rim.position.set(-4,3,-4);
    scene.add(key, rim);
    const turntable=new THREE.Group(); scene.add(turntable);
    view={renderer, scene, camera, turntable, current:null};
    return view;
  }
  function size(){
    if(!view) return;
    const c=view.renderer.domElement;
    const w=c.clientWidth||360, h=c.clientHeight||240;
    view.renderer.setSize(w,h,false);
    view.camera.aspect=w/h; view.camera.updateProjectionMatrix();
  }

  async function preview(id){
    const v=stage(); if(!v) return;
    previewing=id;
    let m;
    try{ m=await AVATAR.load(id); }catch(e){ return; }
    if(previewing!==id) return;                 // they moved on while it loaded
    if(v.current) v.turntable.remove(v.current);
    m.position.y=-0.92;                         // stand them on the middle of the frame
    v.turntable.add(m); v.current=m;
    AVATAR.animate(m, 0, 'idle');
    const def=AVATAR.CHARS.find(c=>c.id===id);
    const nm=document.querySelector('#charName');
    if(nm) nm.textContent = def ? t(def.name) : '';
  }
  function loop(now){
    raf=requestAnimationFrame(loop);
    const dt=Math.min((now-last)/1000, 0.05); last=now;
    if(!view) return;
    size();
    view.turntable.rotation.y += dt*0.55;        // slow spin, so you see all of them
    if(view.current) AVATAR.animate(view.current, dt, 'idle');
    view.renderer.render(view.scene, view.camera);
  }
  function play(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(loop); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=0; } }

  /* --------------------------------------------------------- the grid */
  function render(){
    const grid=document.querySelector('#charGrid'); if(!grid) return;
    const open=unlockedCount();
    document.querySelector('#cTitle').textContent=t('CHOOSE YOUR CHARACTER');
    document.querySelector('#cHint').textContent = open < AVATAR.CHARS.length
      ? t('{a} of {b} unlocked — finish a mission to open more.',{a:open,b:AVATAR.CHARS.length})
      : t('Everyone is unlocked. Pick your favourite.');
    document.querySelector('#cGo').textContent=t('Continue ▶');

    grid.innerHTML=AVATAR.CHARS.map((c,i)=>{
      const lock=!isUnlocked(i);
      return `<button class="chrtile${c.id===AVATAR.chosen?' on':''}${lock?' lock':''}"
        data-c="${c.id}" ${lock?'disabled':''} title="${lock?t('Locked'):c.name}">
        <img src="${c.preview}" alt="" loading="lazy"></button>`;
    }).join('');

    grid.querySelectorAll('[data-c]').forEach(b=>{
      // looking at one is enough to bring it to life; clicking makes it yours
      b.onmouseenter=()=>preview(b.dataset.c);
      b.onfocus=()=>preview(b.dataset.c);
      b.onclick=()=>{
        AVATAR.pick(b.dataset.c);
        grid.querySelectorAll('.chrtile').forEach(x=>x.classList.toggle('on',x===b));
        preview(b.dataset.c);
        if(window.beep) beep('pop');
      };
    });
    preview(AVATAR.chosen);
  }

  function open(){ render(); play(); }
  function close(){ stop(); }

  return { open, close, render, unlockedCount, isUnlocked };
})();
