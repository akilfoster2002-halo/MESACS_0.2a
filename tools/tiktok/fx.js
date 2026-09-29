/* What the rig adds on top of the game: its own camera for each shot, a
   flash and a lens punch on every cut, a small push on every beat after
   the drop, and the words at the end. All of it is DOM or a camera move;
   nothing in the game is changed. */
window.FX = (function () {
  let B = [], BEAT = 0.4546, last = -1, cutT = 0, cam = null;
  const DROP = 8;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const el = (tag, css, html = '') => { const e = document.createElement(tag); e.className = '__keep'; e.style.cssText = css; e.innerHTML = html; document.body.appendChild(e); return e; };
  let flash, card, view;

  function init({ beats, beat }) {
    B = beats; BEAT = beat;
    view = document.getElementById('view');
    view.style.transformOrigin = '50% 50%';
    flash = el('div', 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:99998;visibility:visible');
    card = el('div', `position:fixed;inset:0;background:radial-gradient(ellipse at center, rgba(8,4,30,.55), rgba(8,4,30,.15) 70%);z-index:99999;display:grid;place-content:center;justify-items:center;gap:2vh;pointer-events:none;visibility:visible;
      font-family:"Trebuchet MS",system-ui,sans-serif;color:#fff;text-align:center;text-shadow:0 4px 30px rgba(10,0,40,.7)`,
      `<div id="__k" style="font-size:25vw;font-weight:900;letter-spacing:.06em;line-height:1;opacity:0">KORO</div>
       <div id="__l1" style="font-size:6vw;font-weight:700;color:#ffe9a8;letter-spacing:.08em;opacity:0">FREE TO PLAY</div>
       <div id="__l2" style="font-size:5vw;font-weight:600;opacity:0">link in bio</div>`);
    // the camera: the game places its own, and a shot that wants another moves it just before the draw
    const r = G.renderer, render = r.render.bind(r);
    r.render = (scene, camera) => {
      if (cam) {
        camera.position.copy(cam.pos);
        camera.up.copy(cam.up || window.__P.me.dir.clone().normalize());
        camera.lookAt(cam.look);
        if (cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
      }
      render(scene, camera);
    };
  }

  function setup(i) { const s = SHOTS[i]; cam = null; s.setup && s.setup(); for (let k = 0; k < 20; k++) window.__step(1000 / 30); s.pre2 && s.pre2(); last = -1; }

  const beatIndex = (T) => { let i = 0; while (i + 1 < B.length && B[i + 1] <= T) i++; return i; };

  function frame(i, u, T) {
    const s = SHOTS[i];
    const first = last !== i;
    if (first) { last = i; cutT = T; }
    s.drive && s.drive(u, T, first);
    const baseFov = 60;
    const c = s.cam ? s.cam(u, T) : null;
    // on a new cut, a flash and a lens that snaps in
    const age = T - cutT;
    let fovPunch = (s.punch || 0) * 10 * (1 - clamp01(age / 0.22));
    // after the drop, every beat pushes a little
    const bi = beatIndex(T);
    const pulse = bi >= DROP ? Math.exp(-(T - B[bi]) / 0.11) * (bi % 4 === 0 ? 1 : 0.55) : 0;
    if (c) { c.fov = (c.fov || baseFov) - fovPunch - pulse * 3; }
    cam = c;
    // rooms that keep the game's own camera get the punch as a zoom on the canvas
    const zoom = 1 + (c ? 0 : fovPunch * 0.012 + pulse * 0.02);
    view.style.transform = `scale(${zoom})`;
    flash.style.opacity = String((s.flash || 0) * Math.max(0, 1 - age / 0.1) * 0.9);
    words(T);
    window.__step(1000 / 30);
  }

  function stamp(e, T, t0) {
    const k = clamp01((T - t0) / 0.14);
    e.style.opacity = String(k);
    e.style.transform = `scale(${1.5 - 0.5 * (1 - Math.pow(1 - k, 3))})`;
    e.style.filter = `blur(${(1 - k) * 10}px)`;
  }
  function words(T) {
    const t0 = B[28] ?? 12.7;
    if (T < t0) { card.style.opacity = '0'; return; }
    card.style.opacity = '1';
    stamp(document.getElementById('__k'), T, t0);
    stamp(document.getElementById('__l1'), T, B[30] ?? t0 + 0.9);
    stamp(document.getElementById('__l2'), T, B[31] ?? t0 + 1.4);
  }

  return { init, setup, frame };
})();
