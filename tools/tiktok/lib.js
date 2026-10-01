/* THE SHOT LIBRARY. Loaded into the running game by make.mjs.

   Every shot is the real game being played: the rig holds keys, puts the
   player at the start of the shot and says where the camera stands. A shot
   is made by a factory, LIB[name](opts), and is
     { room, pre, setup(), drive(u, T, first), cam(u, T) -> {pos, look, fov} | null }
   `room` is 'planet' or 'neon'; setup() gets the player into the right one.
   opts.angle (0..n) picks one of a few camera set-ups, so the same scene can
   be filmed several ways across the day's posts. */
(function () {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const P = () => window.__P;
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  function frame() {
    const me = P().me, up = me.dir.clone().normalize();
    const pos = up.clone().multiplyScalar(P().PR + me.alt);
    const fwd = me.fwd.clone().sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    return { pos, up, fwd, right };
  }
  const rel = (F, f, s, h) => F.pos.clone().addScaledVector(F.fwd, f).addScaledVector(F.right, s).addScaledVector(F.up, h);
  function face(bearing) {
    const me = P().me, up = me.dir.clone().normalize();
    const north = V(0, 1, 0).sub(up.clone().multiplyScalar(up.y)).normalize();
    const east = new THREE.Vector3().crossVectors(north, up).normalize();
    const b = (bearing * Math.PI) / 180;
    me.fwd.copy(north.multiplyScalar(Math.cos(b)).addScaledVector(east, -Math.sin(b))).normalize();
  }
  function place(lon, lat, bearing = 0) {
    const d = P().dirOf(lon, lat), me = P().me;
    me.dir.copy(d); me.alt = P().floorAt(d, 200); me.vy = 0; face(bearing);
  }
  const keys = (o) => { for (const k in o) G.keys[k] = o[k]; };
  const none = () => Object.keys(G.keys).forEach((k) => (G.keys[k] = false));

  /* Into the right room, and out of anything the last shot left us in. */
  function onPlanet() {
    none();
    EX.clear();
    if (window.TSH && TSH.active) { TSH.leave(); if (window.__who) AVATAR.setCast(window.__who); }
    if (window.NEON && NEON.active) { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); NEON.leave(); }
    if (P().piloting) { if (P().mecha) P().mecha.onGround = true; PLANET.exitMech(); }
    if (P().flying) P().land();
    if (window.AVATAR) AVATAR.posture(null);
  }
  function inNeon() {
    none();
    EX.clear();
    if (!NEON.active) { onPlanet(); P().use('neon'); }
  }

  // open grass on Wano where nothing gets in the way of a run: [lon, lat, bearing]
  const OPEN = [[10, 10, 20], [6, 14, 60], [18, 4, 250]];   // (14, 6) runs into a building
  const pick = (a, i) => a[((i | 0) % a.length + a.length) % a.length];


  /* ============================================================ OTHER PLAYERS
     KORO is multiplayer, and a clip of one person alone in a world does not
     say so. These are other bodies from the game's own roster (AVATAR.load,
     the same loader that stands up everybody else), standing, following or
     dancing in the player's frame, with a name tag and, when they talk, a
     speech bubble. They are the rig's, not the server's: the dev server has
     one account in it. Updated from the render hook, just before each draw. */
  const EX = (() => {
    let list = [], layer = null;
    const WHO = ['nia', 'sable', 'kofi', 'theo', 'zuri', 'robin', 'walk-s', 'walk-t', 'walk-u', 'walk-v'];
    const TAGS = ['@sk8r_mika', '@zuri.exe', '@kofi_builds', '@theo2k', '@nia.moon', '@lilrobin', '@dev_ari', '@mechmom', '@jaylen.fly', '@quietkid'];
    function dom() {
      if (layer) return layer;
      layer = document.createElement('div'); layer.className = '__keep';
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99990;visibility:visible';
      document.body.appendChild(layer); return layer;
    }
    function label(text, bubble) {
      const e = document.createElement('div');
      e.style.cssText = bubble
        ? "position:absolute;transform:translate(-50%,-100%);max-width:230px;padding:8px 13px;border-radius:14px;background:#fff;color:#141024;font:700 17px/1.2 'Trebuchet MS',system-ui;box-shadow:0 4px 14px rgba(0,0,0,.35);opacity:0"
        : "position:absolute;transform:translate(-50%,-100%);padding:2px 8px;border-radius:8px;background:rgba(10,8,28,.62);color:#bfe9ff;font:700 12px/1.3 'Trebuchet MS',system-ui;white-space:nowrap";
      e.textContent = text; dom().appendChild(e); return e;
    }
    /* one more person: id from WHO (or any body id), placed by `at` each frame */
    async function add(id, o = {}) {
      const root = await AVATAR.load(id);
      G.roomGroup.add(root);
      const x = { id, root, rig: root.userData.rig, anim: o.anim || 'idle', at: o.at, tag: label(o.tag || TAGS[list.length % TAGS.length]), bubble: null, say: [], mixer: null, clip: null };
      if (x.rig) x.rig.play(x.anim, 0);
      list.push(x); return x;
    }
    /* a model that is not a person: a mecha, at its own height */
    function model(url, height) {
      return new Promise((res, rej) => {
        const L = new THREE.GLTFLoader(); if (window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
        L.load(url + '?v=' + (window.ASSETV || '1'), (g) => {
          const root = g.scene; root.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(root), h = b.max.y - b.min.y;
          const inner = new THREE.Group(); inner.add(root); if (h > 0) root.scale.multiplyScalar(height / h);
          const holder = new THREE.Group(); holder.add(inner); G.roomGroup.add(holder);
          const mixer = new THREE.AnimationMixer(root), acts = {};
          for (const c of g.animations) acts[c.name] = mixer.clipAction(c);
          let cur = null;
          const x = { root: holder, inner, mixer, tag: null, bubble: null, say: [], at: null,
            play(n, fade = 0.2) { const a = acts[n]; if (!a || a === cur) return; a.reset().fadeIn(fade).play(); if (cur) cur.fadeOut(fade); cur = a; } };
          x.play('idle', 0); list.push(x); res(x);
        }, undefined, rej);
      });
    }
    /* stand a body on the ball: position, and its +Z along `fwd` */
    function stand(root, pos, up, fwd) {
      const f = fwd.clone().sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
      const r = new THREE.Vector3().crossVectors(up, f).normalize();
      root.position.copy(pos);
      root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, f));
    }
    const tmp = new THREE.Vector3();
    function place2d(el, world, lift) {
      tmp.copy(world).project(G.camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      el.style.display = vis ? '' : 'none';
      el.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px';
      el.style.top = ((1 - tmp.y) / 2 * innerHeight - lift) + 'px';
    }
    function tick(dt, T) {
      for (const x of list) {
        if (x.at) x.at(x, T);
        if (x.rig) x.rig.update(dt);
        if (x.mixer) x.mixer.update(dt);
        const up = x.up || (G.room === 'planet' ? x.root.position.clone().normalize() : new THREE.Vector3(0, 1, 0));
        const head = x.root.position.clone().addScaledVector(up, x.h || 1.95);
        if (x.tag) place2d(x.tag, head, 0);
        const line = x.say.find((l) => T >= l.t0 && T < l.t1);
        if (line && !x.bubble) x.bubble = label('', true);
        if (x.bubble) {
          if (line) { if (x.bubble.textContent !== line.text) x.bubble.textContent = line.text; x.bubble.style.opacity = String(Math.min(1, (T - line.t0) / 0.12)); }
          else x.bubble.style.opacity = '0';
          place2d(x.bubble, head, 26);
        }
      }
    }
    /* a Mixamo dance on somebody: its own mixer, and the body's own clips stop */
    let menu = null;
    async function dances() { if (!menu) menu = await (await fetch('/__tiktok/dances/dances.json')).json(); return menu; }
    function clipFile(file) {
      return new Promise((res, rej) => new THREE.GLTFLoader().load('/__tiktok/dances/' + file, (g) => res(g.animations[0]), undefined, rej));
    }
    async function dance(x, file) {
      const clip = await clipFile(file);
      if (!clip) return false;
      if (x.mixer && x.mixer !== x.ownMixer) x.mixer.stopAllAction();
      x.rig = null;
      x.mixer = x.mixer || new THREE.AnimationMixer(x.root);
      x.mixer.stopAllAction();
      const a = x.mixer.clipAction(clip); a.reset().play();
      x.danceName = file;
      return true;
    }
    function clear() {
      for (const x of list) { if (x.root.parent) x.root.parent.remove(x.root); for (const e of [x.tag, x.bubble]) if (e) e.remove(); }
      list = [];
    }
    return { add, model, stand, tick, clear, dance, dances, WHO, get list() { return list; } };
  })();
  window.EX = EX;

  /* In the player's frame: f ahead, s to the right, on the ground (or at h). */
  function atRel(f, s, faceBack, h) {
    return (x) => {
      const F = frame();
      const pos = rel(F, f, s, 0);
      const up = pos.clone().normalize();
      const alt = h === undefined ? P().floorAt(up, P().me.alt + 3) : P().me.alt + h;
      pos.copy(up).multiplyScalar(P().PR + alt);
      EX.stand(x.root, pos, up, faceBack ? F.fwd.clone().negate() : F.fwd);
    };
  }
  /* facing a point on the ball */
  function atFacing(pos, target) {
    return (x) => {
      const up = pos.clone().normalize();
      EX.stand(x.root, pos, up, target.clone().sub(pos));
    };
  }
  const others = (n, not) => shuffleWith(EX.WHO.filter((w) => w !== not), n);
  function shuffleWith(a, n) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }
  /* n friends in your frame, doing what you do: [ahead, right, up] each */
  async function friends(n, anim, slots) {
    const w = others(n, AVATAR.cast || window.__who);
    await Promise.all(w.map((id, i) => EX.add(id, { anim, at: atRel(slots[i][0], slots[i][1], false, slots[i][2]) })));
  }
  const CHEERS = [
    ['GET HIM 😤', 'seraph diff', 'run it back'],
    ['oh he SLAMMED it', 'lmaooo', 'my turn next'],
    ['vanguard is cooked', 'clip that', 'again again again'],
  ];
  const HANG = [
    ['who is coming to neon', 'me!!', 'bring coins', 'i got 400'],
    ['race u to the spire', 'ur on', 'no flying', 'ok... maybe a little flying'],
    ['the reef has a whale shark', 'NO WAY', 'come on', 'everybody dive'],
    ['yo who wants to race to the falls', 'loser buys skins', 'bet 😤', 'im already flying'],
    ['did u see the arcade in the clouds??', 'my snake score is 212', 'thats not real', 'come look then'],
    ['mech fight at kit\'s in 5', 'vanguard or seraph?', 'seraph obviously', 'ur going down'],
    ['new here, what do i do', 'literally anything', 'go dive the reef first', 'theres sharks btw'],
    ['this planet is mine now', 'no its OURS', 'we can share 🌸', 'fine but i get the waterfall'],
  ];


  /* TSH through its own door, with the kit on and out on the street. The
     door and the flat use real-time fades, so this waits in real time. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function inTSH(who) {
    none(); EX.clear();
    if (window.NEON && NEON.active) onPlanet();
    if (!TSH.active) { if (P().piloting) PLANET.exitMech(); if (P().flying) P().land(); P().use('tsh'); for (let i = 0; i < 6; i++) { window.__step(33); await sleep(250); } }
    const S = TSH._S(); S.kit = { cuffs: true, bangles: true, studs: true, rings: true };
    if (TSH.inside) { TSH._dbg.aptExit(); for (let i = 0; i < 12; i++) { window.__step(33); await sleep(250); } }
    // TSH casts Robin on the way in; anybody else can be put back on the street
    AVATAR.setCast(who || 'robin');
    for (let i = 0; i < 20; i++) { window.__step(33); await sleep(60); }
  }
  // [x, z, yaw]: a few steps off a building's face, facing it (the west faces of B1..B4)
  const TSH_WALLS = [[-61, -18, -Math.PI / 2], [-61, -35, -Math.PI / 2], [-44, -18, -Math.PI / 2], [-44, -35, -Math.PI / 2]];
  // [x, z, yaw, roof height]: on a roof, running its length
  // running toward -z off B2 (16 m) drops onto B1 (10 m); off B4 (12 m) onto B3 (9 m)
  const TSH_ROOFS = [[-50, -11, 0, 16], [-31, -11, 0, 12], [-47, -11, 0, 16]];

  const LIB = {
    /* underwater: swimming down the reef wall */
    dive: (o = {}) => ({
      room: 'planet', pre: 40,
      async setup() { onPlanet(); const s = pick([[-18, -52, 80], [10, -70, 200], [-40, -30, 20]], o.spot); const d = OCEAN.toDir(s[0], s[1]); P().me.dir.copy(d); P().me.alt = 0.2; P().me.vy = 0; face(s[2]); keys({ KeyW: true }); await friends(2, 'swim', [[-1.8, -2.2, 0.4], [-3.2, 2.0, -0.6]]); },
      drive(u) { keys({ KeyW: true, ShiftLeft: u > 0.02 && u < 0.5 }); },
      cam: pick([
        (u) => { const F = frame(); return { pos: rel(F, 0.6 - u * 0.6, 3.0, 0.1 + u * 0.3), look: rel(F, 0.3, 0, 0), fov: 60 }; },
        (u) => { const F = frame(); return { pos: rel(F, -3.2, 0.4, 1.4), look: rel(F, 2, 0, -0.5), fov: 62 }; },
        (u) => { const F = frame(); return { pos: rel(F, 3.4, -0.6, -0.6), look: rel(F, 0, 0, 0.1), fov: 58 }; },
      ], o.angle),
    }),
    /* on the surface of the sea, swimming */
    swim: (o = {}) => ({
      room: 'planet', pre: 40,
      async setup() { onPlanet(); const d = OCEAN.toDir(pick([0, 30, -25], o.spot), -60); P().me.dir.copy(d); P().me.alt = P().floorAt(d, 50) + 0.5; P().me.vy = 0; face(pick([90, 200, 0], o.spot)); keys({ KeyW: true }); await friends(3, 'swim', [[-1.5, -2.0, 0], [-1.5, 2.0, 0], [-3.4, 0, 0]]); },
      drive() { keys({ KeyW: true }); },
      cam: pick([
        (u) => { const F = frame(); return { pos: rel(F, 2.6, 1.6, 0.9), look: rel(F, 0, 0, 0.1), fov: 58 }; },
        (u) => { const F = frame(); return { pos: rel(F, -4, 0, 2.2), look: rel(F, 4, 0, 0), fov: 60 }; },
      ], o.angle),
    }),
    /* sprinting across the grass, a jump late on */
    sprint: (o = {}) => ({
      room: 'planet', pre: 30,
      setup() { onPlanet(); place(...pick(OPEN, o.spot)); keys({ KeyW: true, ShiftLeft: true }); },
      drive(u) { keys({ KeyW: true, ShiftLeft: true, Space: o.jump !== false && u > 0.8 && u < 0.86 }); },
      cam: pick([
        (u) => { const F = frame(); return { pos: rel(F, 3.6 - u * 0.6, -0.9, 0.35), look: rel(F, 0, 0, 0.9 + u * 0.3), fov: 64 }; },
        (u) => { const F = frame(); return { pos: rel(F, 0.5, 4.2, 1.0), look: rel(F, 0.5, 0, 0.9), fov: 50 }; },
        (u) => { const F = frame(); return { pos: rel(F, -3.5, 0.8, 2.2), look: rel(F, 4, 0, 0.8), fov: 62 }; },
      ], o.angle),
    }),
    /* dancing (or salsa, or a flip) on the spot */
    dance: (o = {}) => ({
      room: 'planet', pre: 20,
      setup() { onPlanet(); place(...pick(OPEN, o.spot)); AVATAR.emote(o.move || 'dance'); },
      drive(u, T, first) { if (first || !AVATAR.emoting) AVATAR.emote(o.move || 'dance'); },
      cam: pick([
        (u) => { const F = frame(), a = -0.8 + ease(u) * 1.6; return { pos: rel(F, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 1.3), look: rel(F, 0, 0, 1.0), fov: 50 }; },
        (u) => { const F = frame(); return { pos: rel(F, 2.6 - u * 0.8, 0.3, 0.4), look: rel(F, 0, 0, 1.2), fov: 55 }; },
        (u) => { const F = frame(); return { pos: rel(F, 5, -1.5, 3.5 - u), look: rel(F, 0, 0, 0.8), fov: 48 }; },
      ], o.angle),
    }),
    /* the Seraph, running */
    seraph: (o = {}) => ({
      room: 'planet', pre: 45,
      setup() { onPlanet(); WALLET.has = () => true; GARAGE.chosen = () => 'seraph'; place(10, 10, pick([20, 40, 0], o.spot)); PLANET.summonMech(); keys({ KeyW: true, ShiftLeft: true }); },
      drive() { keys({ KeyW: true, ShiftLeft: true }); },
      cam: pick([
        (u) => { const F = frame(); return { pos: rel(F, 16 - u * 3, 3.5, 1.2), look: rel(F, 0, 0, 7), fov: 58 + u * 6 }; },
        (u) => { const F = frame(); return { pos: rel(F, 2 - u * 4, 20, 7), look: rel(F, 2, 0, 5.5), fov: 56 }; },
        (u) => { const F = frame(); return { pos: rel(F, -22, -6, 13), look: rel(F, 6, 0, 5), fov: 58 }; },
      ], o.angle),
    }),
    /* flying low and fast */
    fly: (o = {}) => ({
      room: 'planet', pre: 20,
      setup() { onPlanet(); place(...pick(OPEN, o.spot)); P().takeOff(); P().me.alt += 8; G.pitch = o.climb ? 0.5 : 0.18; keys({ KeyW: true }); },
      drive() { keys({ KeyW: true }); },
      cam: pick([
        (u) => { const F = frame(); return { pos: rel(F, -2.5, 6.5, 1.8), look: rel(F, 0.8, 0, 0), fov: 56 }; },
        (u) => { const F = frame(); return { pos: rel(F, -4.5, 0.6, 1.4), look: rel(F, 4, 0, 0.2), fov: 62 }; },
        (u) => { const F = frame(); return { pos: rel(F, 6, -1.8, -0.4), look: rel(F, 0, 0, 0.2), fov: 55 }; },
      ], o.angle),
    }),
    /* standing on a sky island: falls, garden, spire or stone */
    island: (o = {}) => ({
      room: 'planet', pre: 40,
      setup() {
        onPlanet();
        const d = ISLANDS.isle(o.id || 'falls').dir;
        P().me.dir.copy(d); const top = ISLANDS.decks.find((k) => k.id === (o.id || 'falls')).top; P().me.alt = Math.max(P().floorAt(d, 400), top) + 0.05; P().me.vy = 0; P().me.onGround = true; face(o.bearing ?? 90);
        if (o.run) keys({ KeyW: true, ShiftLeft: true });
      },
      drive() { if (o.run) keys({ KeyW: true, ShiftLeft: true }); },
      cam: pick([
        (u) => { const F = frame(), a = -0.6 + ease(u) * 1.4; return { pos: rel(F, Math.cos(a) * 5, Math.sin(a) * 5, 6), look: rel(F, 0, 0, 0.9), fov: 54 }; },
        (u) => { const F = frame(); return { pos: rel(F, -7 - u * 3, 2, 7 + u * 3), look: rel(F, 0, 0, 0.5), fov: 58 }; },
        (u) => { const F = frame(); return { pos: rel(F, 3, 2, 9 - u * 2), look: rel(F, 0, 0, 0.5), fov: 50 }; },
      ], o.angle),
    }),
    /* inside Neon, walking the hall */
    neon: (o = {}) => ({
      room: 'neon', pre: 90,
      setup() { inNeon(); },
      drive(u, T, first) {
        if (first) { const f = NEON.cabFront(o.cab || 'breakout') || NEON.cabFront('drop'); if (f) { G.pos.x = f.x; G.pos.z = f.z + 9; G.yaw = 0; } }
        keys({ KeyW: true });
      },
      cam: null,
    }),
    /* at a cabinet, playing: drop, snake, breakout, maze, hop */
    arcade: (o = {}) => ({
      room: 'neon', pre: 30, arcade: true, start: 'KeyE',
      setup() { inNeon(); WALLET.award('rig', 0, 200); const f = NEON.cabFront(o.cab || 'breakout'); G.pos.x = f.x; G.pos.z = f.z; G.yaw = 0; },
      drive() {},
      cam: null,
    }),

    /* ---------------------------------------------------- other people */
    /* running (or flying) with a crew: three more players on your wings */
    squad: (o = {}) => ({
      room: 'planet', pre: 30,
      async setup() {
        onPlanet(); place(...pick(OPEN, o.spot));
        const fly = !!o.fly;
        if (fly) { P().takeOff(); P().me.alt += 6; G.pitch = 0.12; }
        const w = others(3, AVATAR.cast || AVATAR.chosen);
        const slots = [[-2.2, -2.4], [-2.2, 2.4], [-4.6, 0]];
        await Promise.all(w.map((id, i) => EX.add(id, { anim: fly ? 'fly' : 'sprint', at: atRel(slots[i][0], slots[i][1], false, fly ? 0 : undefined) })));
        keys({ KeyW: true, ShiftLeft: !fly });
      },
      drive() { keys({ KeyW: true, ShiftLeft: !o.fly }); },
      cam: pick([
        (u) => { const F = frame(); return { pos: rel(F, 5.5 - u, 1.5, 1.1), look: rel(F, -2, 0, 0.9), fov: 60 }; },
        (u) => { const F = frame(); return { pos: rel(F, -9, 0.5, 4.5), look: rel(F, 2, 0, 0.5), fov: 58 }; },
        (u) => { const F = frame(); return { pos: rel(F, -1, 7, 1.4), look: rel(F, -1.5, 0, 0.9), fov: 56 }; },
      ], o.angle),
    }),
    /* hanging out: four players in a circle, talking, with tags and bubbles */
    hangout: (o = {}) => ({
      room: 'planet', pre: 20,
      async setup() {
        onPlanet(); place(...pick([[-30, 2, 200], [2, 12, 180], [12, 8, 90]], o.spot));
        const F = frame(), c = rel(F, 1.25, 0, 0);
        const lines = pick(HANG, o.talk ?? Math.floor(Math.random() * HANG.length));
        const w = others(3, AVATAR.cast || AVATAR.chosen);
        await Promise.all(w.map((id, i) => {
          const a = (i + 1) * Math.PI / 2, p = c.clone().addScaledVector(F.fwd, -Math.cos(a) * 1.25).addScaledVector(F.right, Math.sin(a) * 1.25);
          const up = p.clone().normalize(); p.copy(up).multiplyScalar(P().PR + P().floorAt(up, P().me.alt + 3));
          return EX.add(id, { anim: i % 2 ? 'talk' : 'talk2', at: atFacing(p, c) });
        }));
        // who says what, spread over the shot (seconds from its start, filled in at the first frame)
        this.lines = lines;
      },
      drive(u, T, first) {
        if (first) {
          const t0 = T, span = this.span || 3.6, n = this.lines.length;
          EX.list.forEach((x, i) => { x.say = []; });
          this.lines.forEach((text, i) => { const x = EX.list[i % EX.list.length]; x.say.push({ text, t0: t0 + (i * span) / n, t1: t0 + ((i + 1.6) * span) / n }); });
        }
      },
      cam: pick([
        (u) => { const F = frame(), a = -0.9 + ease(u) * 1.2; const c = rel(F, 1.25, 0, 0); return { pos: c.clone().addScaledVector(F.fwd, -Math.cos(a) * 4.4).addScaledVector(F.right, Math.sin(a) * 4.4).addScaledVector(F.up, 3.0), look: c.clone().addScaledVector(F.up, 1.0), fov: 54 }; },
        (u) => { const F = frame(); const c = rel(F, 1.25, 0, 0); return { pos: rel(F, -2.6 + u * 0.6, 0.9, 2.3), look: c.clone().addScaledVector(F.up, 1.1), fov: 58 }; },
      ], o.angle),
    }),
    /* a dance-off: everybody on a different dance */
    crew: (o = {}) => ({
      room: 'planet', pre: 20,
      async setup() {
        onPlanet(); place(...pick(OPEN, o.spot));
        AVATAR.emote(o.move || 'dance');
        const F = frame(), w = others(4, AVATAR.cast || AVATAR.chosen), moves = ['salsa', 'flip', 'dance', 'salsa'];
        const spots = [[1.6, -2.2], [1.6, 2.2], [3.4, -1.1], [3.4, 1.1]];
        await Promise.all(w.map((id, i) => EX.add(id, { anim: moves[i], at: atRel(spots[i][0], spots[i][1], true) })));
        // the whole Mixamo dance library, a different one each
        const menu = await EX.dances().catch(() => []);
        if (menu.length) {
          const mine = shuffleWith(menu, menu.length);
          await Promise.all(EX.list.map((x, i) => EX.dance(x, mine[i % mine.length].file).catch(() => false)));
          this.mixamo = true;
        }
      },
      drive(u, T, first) { if (first || !AVATAR.emoting) AVATAR.emote(o.move || 'dance'); for (const x of EX.list) if (!this.mixamo && x.rig && u > 0.5 && !x.swapped) { x.swapped = true; x.rig.play(pick(['dance', 'salsa', 'flip'], Math.floor(Math.random() * 3))); } },
      cam: pick([
        (u) => { const F = frame(), a = 2.6 + ease(u) * 1.1; const c = rel(F, 1.6, 0, 0); return { pos: c.clone().addScaledVector(F.fwd, Math.cos(a) * 7).addScaledVector(F.right, Math.sin(a) * 7).addScaledVector(F.up, 2.4), look: c.clone().addScaledVector(F.up, 1), fov: 54 }; },
        (u) => { const F = frame(); return { pos: rel(F, 7.5 - u, 0, 1.0), look: rel(F, 1.5, 0, 1.1), fov: 58 }; },
      ], o.angle),
    }),

    /* ---------------------------------------------------- mechas at Kit's */
    /* the Seraph against a Vanguard, outside the Mechanic: it charges,
       mega-jumps, and slams down; the Vanguard takes the shockwave */
    mechfight: (o = {}) => ({
      room: 'planet', pre: 40,
      async setup() {
        onPlanet();
        WALLET.has = () => true; GARAGE.chosen = () => 'seraph';
        place(...pick([[10, 10, 20], [6, 14, 60]], o.spot));   // the garage's mechas, out on open grass where they have room
        PLANET.summonMech();
        const F = frame();
        const foe = await EX.model(pick(['wano/mecha.glb', 'wano/mecha.glb', 'wano/seraph.glb'], o.foe), 10);
        foe.h = 11; foe.tag = null;
        const start = rel(F, 34, 0, 0);
        this.foe = foe; this.base = start;
        foe.at = (x, T) => {
          const F2 = frame(), up = x.pos0 ? x.pos0.clone().normalize() : start.clone().normalize();
          if (!x.pos0) { x.pos0 = start.clone(); x.v = 0; x.back = 0; }
          const toMe = F2.pos.clone().sub(x.pos0); toMe.sub(up.clone().multiplyScalar(toMe.dot(up)));
          const d = toMe.length(), dir = toMe.normalize();
          if (!x.hit && d > 14) { x.pos0.addScaledVector(dir, 0.55); x.play('sprint'); }
          else if (!x.hit) x.play('idle');
          if (x.hit) { x.back += 1 / 30; x.pos0.addScaledVector(dir, -Math.max(0, 1.2 - x.back) * 0.9); x.play('fly', 0.1); x.inner.rotation.x = -Math.min(1.1, x.back * 2.5); }
          const p = x.pos0.clone(), u2 = p.clone().normalize(); p.copy(u2).multiplyScalar(P().PR + P().floorAt(u2, 200) + (x.hit ? Math.sin(Math.min(Math.PI, x.back * 4)) * 5 : 0));
          EX.stand(x.root, p, u2, dir);
        };
        // friends watching from the side, out of the way, shouting at the screen
        const side = rel(F, 50, -4.5, 0), up2 = side.clone().normalize(), ring = rel(F, 16, 0, 0);   // just past the Vanguard, a little aside: in shot from behind the Seraph and from in front
        const w = others(3, AVATAR.cast || window.__who), cheer = pick(CHEERS, Math.floor(Math.random() * CHEERS.length));
        await Promise.all(w.map((id, i) => {
          const p = side.clone().addScaledVector(F.fwd, (i - 1) * 1.6), u2 = p.clone().normalize();
          p.copy(u2).multiplyScalar(P().PR + P().floorAt(u2, P().me.alt + 20));
          return EX.add(id, { anim: i === 1 ? 'dance' : 'talk', at: atFacing(p, ring) });
        }));
        this.cheer = cheer;
        keys({ KeyW: true, ShiftLeft: true });
      },
      drive(u, T, first) {
        if (first && this.cheer) { const xs = EX.list.filter((x) => x.tag); this.cheer.forEach((text, i) => { const x = xs[i % xs.length]; if (x) x.say.push({ text, t0: T + i * 0.55, t1: T + i * 0.55 + 1.3 }); }); }
        keys({ KeyW: u < 0.55, ShiftLeft: u < 0.4, Space: u > 0.3 && u < 0.36, KeyQ: u > 0.5 && u < 0.56 });
        if (u > 0.62 && this.foe && !this.foe.hit) this.foe.hit = true;
      },
      cam: pick([
        // a portrait frame is ~36 degrees across: film along the line between the two mechs, not across it
        (u) => { const F = frame(); return { pos: rel(F, -22, 5, 11), look: rel(F, 16, 0, 5), fov: 55 }; },
        (u) => { const F = frame(); return { pos: rel(F, 9, 46, 9), look: rel(F, 9, 0, 6), fov: 50 }; },
        (u) => { const F = frame(); return { pos: rel(F, 58, -7, 4), look: rel(F, 6, 0, 7), fov: 48 }; },
      ], o.angle),
    }),

    /* ---------------------------------------------------- TSH, the city */
    /* Robin on the Gecko cuffs: sprinting at a building and up it */
    climb: (o = {}) => ({
      room: 'tsh', pre: 10,
      async setup() { await inTSH('robin'); const b = pick(TSH_WALLS, o.spot); TSH._place(b[0], b[1], b[2]); keys({ KeyW: true, ShiftLeft: true }); this.g = false; },
      drive(u) {
        if (!this.g && u > 0.06) { this.g = true; TSH.key({ code: 'KeyG' }); }
        keys({ KeyW: true, ShiftLeft: u < 0.06 });
      },
      cam: null,
    }),
    /* on the roofs: running along them, the city lit below */
    rooftop: (o = {}) => ({
      room: 'tsh', pre: 10,
      async setup() { await inTSH(window.__who); const r = pick(TSH_ROOFS, o.spot); TSH._place(r[0], r[1], r[2], r[3] + 1.7); keys({ KeyW: true, ShiftLeft: true }); },
      drive(u) { keys({ KeyW: true, ShiftLeft: true, Space: u > 0.7 && u < 0.75 }); },
      cam: null,
    }),

    /* the name, over the night sky */
    card: (o = {}) => ({
      room: 'planet', pre: 60, card: true,
      setup() { onPlanet(); },
      pre2() { place(20, 18, 300); },
      drive() {},
      cam(u) { const F = frame(); return { pos: rel(F, -3 - u * 1.5, 0.6, 0.5), look: rel(F, 20, 0, 22 + u * 4), fov: 70 }; },
    }),
  };

  window.LIB = LIB;
  window.SHOTS = [];
  /* make.mjs hands over the plan: [{ shot:'dive', opts:{...}, b0, b1, flash, punch }] */
  window.PLAN = function (plan) {
    window.SHOTS = plan.map((p) => Object.assign(LIB[p.shot](p.opts || {}), { name: p.shot, b0: p.b0, b1: p.b1, flash: p.flash ?? 0.5, punch: p.punch ?? 0.5 }));
    return window.SHOTS.map((s) => ({ name: s.name, b0: s.b0, b1: s.b1, pre: s.pre, start: s.start || null, arcade: !!s.arcade }));
  };
})();
