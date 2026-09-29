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
    if (window.NEON && NEON.active) { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); NEON.leave(); }
    if (P().piloting) { if (P().mecha) P().mecha.onGround = true; PLANET.exitMech(); }
    if (P().flying) P().land();
    if (window.AVATAR) AVATAR.posture(null);
  }
  function inNeon() {
    none();
    if (!NEON.active) { onPlanet(); P().use('neon'); }
  }

  // open grass on Wano where nothing gets in the way of a run: [lon, lat, bearing]
  const OPEN = [[10, 10, 20], [14, 6, 200], [6, 14, 60], [18, 4, 250]];
  const pick = (a, i) => a[((i | 0) % a.length + a.length) % a.length];

  const LIB = {
    /* underwater: swimming down the reef wall */
    dive: (o = {}) => ({
      room: 'planet', pre: 40,
      setup() { onPlanet(); const s = pick([[-18, -52, 80], [10, -70, 200], [-40, -30, 20]], o.spot); const d = OCEAN.toDir(s[0], s[1]); P().me.dir.copy(d); P().me.alt = 0.2; P().me.vy = 0; face(s[2]); keys({ KeyW: true }); },
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
      setup() { onPlanet(); const d = OCEAN.toDir(pick([0, 30, -25], o.spot), -60); P().me.dir.copy(d); P().me.alt = P().floorAt(d, 50) + 0.5; P().me.vy = 0; face(pick([90, 200, 0], o.spot)); keys({ KeyW: true }); },
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
