/* What the rig adds on top of the game: its own camera for each shot, a
   flash and a lens punch on every cut, a push on the beat, a caption across
   the top, and the card at the end. All DOM or a camera move; nothing in
   the game is changed.

   FX.init({ beats, loud, look }) where look = {
     captions: [{ text, b0, b1 }],       // the hook, top of frame, in beats
     card: { b0, big, line1, line2 },    // the end card, or null
     pulse: 0..1 }                       // how hard the beat pushes */
window.FX = (function () {
  let B = [], LOUD = [], look = {}, last = -1, cutT = 0, cam = null;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const el = (tag, css, html = '') => { const e = document.createElement(tag); e.className = '__keep'; e.style.cssText = css; e.innerHTML = html; document.body.appendChild(e); return e; };
  let flash, card, cap, view;
  const FONT = "'Trebuchet MS',system-ui,sans-serif";

  function init(o) {
    B = o.beats; LOUD = o.loud || []; look = o.look || {};
    view = document.getElementById('view');
    view.style.transformOrigin = '50% 50%';
    flash = el('div', 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:99998;visibility:visible');
    // the hook: white on a dark pill, the way TikTok captions read, clear of the top bar
    cap = el('div', `position:fixed;left:7vw;right:7vw;top:15vh;z-index:99997;display:flex;justify-content:center;pointer-events:none;visibility:visible;opacity:0`,
      `<div id="__c" style="font-family:${FONT} !important;font-size:40px !important;font-weight:800 !important;line-height:1.18 !important;color:#fff !important;text-align:center;padding:9px 22px;border-radius:16px;background:rgba(12,8,30,.72);max-width:100%"></div>`);
    const c = look.card || {};
    card = el('div', `position:fixed;inset:0;background:radial-gradient(ellipse at center, rgba(8,4,30,.55), rgba(8,4,30,.15) 70%);z-index:99999;display:grid;place-content:center;justify-items:center;gap:2vh;pointer-events:none;visibility:visible;opacity:0;
      font-family:${FONT};color:#fff;text-align:center;text-shadow:0 4px 30px rgba(10,0,40,.7)`,
      `<div id="__k" style="font-size:25vw;font-weight:900;letter-spacing:.06em;line-height:1;opacity:0">${c.big || 'KORO'}</div>
       <div id="__l1" style="font-size:6vw;font-weight:700;color:#ffe9a8;letter-spacing:.08em;opacity:0">${c.line1 || 'FREE TO PLAY'}</div>
       <div id="__l2" style="font-size:5vw;font-weight:600;opacity:0">${c.line2 || 'link in bio'}</div>`);
    const r = G.renderer, render = r.render.bind(r);
    r.render = (scene, camera) => {
      if (cam && G.room === 'planet') {
        camera.position.copy(cam.pos);
        camera.up.copy(window.__P.me.dir.clone().normalize());
        camera.lookAt(cam.look);
        if (cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
      }
      render(scene, camera);
    };
  }

  function setup(i) {
    const s = SHOTS[i]; cam = null;
    s.setup && s.setup();
    for (let k = 0; k < 20; k++) window.__step(1000 / 30);
    s.pre2 && s.pre2();
    last = -1;
  }

  const beatIndex = (T) => { let i = 0; while (i + 1 < B.length && B[i + 1] <= T) i++; return i; };
  const bt = (i) => B[Math.min(B.length - 1, i)] ?? i * 0.5;

  function frame(i, u, T) {
    const s = SHOTS[i];
    const first = last !== i;
    if (first) { last = i; cutT = T; }
    s.drive && s.drive(u, T, first);
    const c = s.cam ? s.cam(u, T) : null;
    const age = T - cutT;
    const punch = (s.punch || 0) * 10 * (1 - clamp01(age / 0.22));
    // the beat: harder on the bar, and only as hard as the music is loud there
    const bi = beatIndex(T);
    const loud = LOUD[bi] ?? 1;
    const pulse = (look.pulse ?? 0.8) * clamp01((loud - 0.45) * 2.2) * Math.exp(-(T - bt(bi)) / 0.11) * (bi % 4 === 0 ? 1 : 0.55);
    if (c) c.fov = (c.fov || 60) - punch - pulse * 3;
    cam = c;
    view.style.transform = `scale(${1 + (c ? 0 : punch * 0.012 + pulse * 0.02)})`;
    flash.style.opacity = String((s.flash || 0) * Math.max(0, 1 - age / 0.1) * 0.9);
    words(T);
    window.__step(1000 / 30);
  }

  function stamp(e, T, t0, t1 = 1e9) {
    const k = clamp01((T - t0) / 0.14), o = clamp01((t1 - T) / 0.12);
    e.style.opacity = String(k * o);
    e.style.transform = `scale(${1.5 - 0.5 * (1 - Math.pow(1 - k, 3))})`;
    e.style.filter = `blur(${(1 - k) * 10}px)`;
  }
  function words(T) {
    const now = (look.captions || []).find((c) => T >= bt(c.b0) && T < bt(c.b1));
    const span = document.getElementById('__c');
    if (now) { if (span.textContent !== now.text) span.textContent = now.text; cap.style.opacity = '1'; stamp(span, T, bt(now.b0), bt(now.b1)); }
    else cap.style.opacity = '0';
    if (!look.card || T < bt(look.card.b0)) { card.style.opacity = '0'; return; }
    card.style.opacity = '1';
    stamp(document.getElementById('__k'), T, bt(look.card.b0));
    stamp(document.getElementById('__l1'), T, bt(look.card.b0 + 2));
    stamp(document.getElementById('__l2'), T, bt(look.card.b0 + 3));
  }

  return { init, setup, frame };
})();
