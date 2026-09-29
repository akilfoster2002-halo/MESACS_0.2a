/* THE SHOTS — fifteen seconds of KORO on 2audio (26.4 s to 41.4 s of it).
   Loaded into the running game by film.mjs. Every shot is the real game
   being played: the rig only holds keys, puts the player at the start of
   the shot, and says where the camera stands.

   A shot is { b0, b1 } in beats (beat 8 is the drop), setup() once before
   its pre-roll, drive(u, t) every frame (keys, facing), and cam(u, t) which
   returns { pos, look, fov } or null for the game's own camera. */
(function () {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const P = () => window.__P;
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  /* The player's own frame on the ball: where they are, which way is up,
     which way they face, and their right hand. */
  function frame() {
    const me = P().me, up = me.dir.clone().normalize();
    const pos = up.clone().multiplyScalar(P().PR + me.alt);
    const fwd = me.fwd.clone().sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    return { pos, up, fwd, right };
  }
  // a point in the player's frame: f metres ahead, s to the right, h up
  const rel = (F, f, s, h) => F.pos.clone().addScaledVector(F.fwd, f).addScaledVector(F.right, s).addScaledVector(F.up, h);

  /* Stand somewhere on Wano, facing a compass bearing (degrees from north). */
  function place(lon, lat, bearing = 0, lift = 0) {
    const d = P().dirOf(lon, lat), me = P().me;
    me.dir.copy(d);
    me.alt = P().floorAt(d, 200) + lift;
    me.vy = 0;
    face(bearing);
  }
  function face(bearing) {
    const me = P().me, up = me.dir.clone().normalize();
    const north = V(0, 1, 0).sub(up.clone().multiplyScalar(up.y)).normalize();
    const east = new THREE.Vector3().crossVectors(north, up).normalize();
    const b = (bearing * Math.PI) / 180;
    me.fwd.copy(north.multiplyScalar(Math.cos(b)).addScaledVector(east, -Math.sin(b))).normalize();
  }
  const keys = (o) => { for (const k in o) G.keys[k] = o[k]; };
  const none = () => Object.keys(G.keys).forEach((k) => (G.keys[k] = false));

  window.SHOTS = [
    // 1 — UNDER THE SEA. She dives off the reef wall, past the fish.
    {
      name: 'dive', b0: 0, b1: 4, pre: 40,
      setup() {
        none();
        if (P().piloting) PLANET.exitMech();
        const d = OCEAN.toDir(-18, -52); P().me.dir.copy(d); P().me.alt = 0.2; P().me.vy = 0; face(80);
        keys({ KeyW: true });
      },
      drive(u) { keys({ KeyW: true, ShiftLeft: u > 0.02 }); },
      cam(u) { const F = frame(); return { pos: rel(F, 0.6 - u * 0.6, 3.0, 0.1 + u * 0.3), look: rel(F, 0.3, 0, 0), fov: 60 }; },
    },
    // 2 — THE BUILD. Sprinting across the grass at night, fireflies up, a jump on the last beat.
    {
      name: 'sprint', b0: 4, b1: 8, pre: 30,
      setup() { none(); place(14, 6, 200); keys({ KeyW: true, ShiftLeft: true }); },
      drive(u) { keys({ KeyW: true, ShiftLeft: true, Space: u > 0.8 && u < 0.86 }); },
      cam(u) { const F = frame(); return { pos: rel(F, 3.6 - u * 0.6, -0.9, 0.35), look: rel(F, 0, 0, 0.9 + u * 0.3), fov: 64 }; },
    },
    // 3 — THE DROP. In the Seraph, running at the lens.
    {
      name: 'seraph', b0: 8, b1: 12, pre: 45, flash: 1, punch: 1,
      setup() {
        none();
        WALLET.has = () => true; GARAGE.chosen = () => 'seraph';
        place(10, 10, 20);
        PLANET.summonMech();
        keys({ KeyW: true, ShiftLeft: true });
      },
      drive() { keys({ KeyW: true, ShiftLeft: true }); },
      cam(u) { const F = frame(); return { pos: rel(F, 16 - u * 3, 3.5, 1.2), look: rel(F, 0, 0, 7), fov: 58 + u * 6 }; },
    },
    // 4 — TAKE OFF. Out of the mech, up toward the Falls island.
    {
      name: 'fly', b0: 12, b1: 16, pre: 20, flash: 0.6, punch: 0.7,
      setup() {
        none();
        if (P().piloting) { P().mecha.onGround = true; PLANET.exitMech(); }
        place(10, 10, 20);
        P().takeOff();
        G.pitch = 0.18;
        keys({ KeyW: true });
      },
      drive() { keys({ KeyW: true }); },
      cam(u) { const F = frame(); return { pos: rel(F, -2.5, 6.5, 1.8), look: rel(F, 0.8, 0, 0), fov: 56 }; },
    },
    // 5 — A SKY ISLAND. Landed on the Garden, running its edge.
    {
      name: 'island', b0: 16, b1: 20, pre: 40, flash: 0.5, punch: 0.5,
      setup() {
        none();
        if (P().flying) P().land();
        const d = ISLANDS.isle('falls').dir; P().me.dir.copy(d); P().me.alt = P().floorAt(d, 400) + 0.05; P().me.vy = 0; P().me.onGround = true; face(90);
        keys({ KeyW: true, ShiftLeft: true });
      },
      drive() { keys({ KeyW: true, ShiftLeft: true }); },
      cam(u) {
        const F = frame(), a = -0.6 + ease(u) * 1.4;
        return { pos: rel(F, Math.cos(a) * 6, Math.sin(a) * 6, 2.2), look: rel(F, 0, 0, 0.9), fov: 56 };
      },
    },
    // 6 — NEON. Into the arcade in the clouds.
    {
      name: 'neon', b0: 20, b1: 24, pre: 90, flash: 0.8, punch: 0.8, room: 'neon',
      setup() { none(); if (P().flying) P().land(); P().use('neon'); },
      drive(u, t, first) {
        if (first) { const f = NEON.cabFront('breakout') || NEON.cabFront('drop'); if (f) { G.pos.x = f.x; G.pos.z = f.z + 9; G.yaw = 0; } }
        keys({ KeyW: true });
      },
      cam: null,
    },
    // 7 — PLAYING. At the cabinet, and then the cabinet is the screen.
    {
      name: 'arcade', b0: 24, b1: 28, pre: 30, flash: 0.4, room: 'neon',
      setup() {
        none();
        WALLET.award('rig', 0, 200);
        const f = NEON.cabFront('breakout') || NEON.cabFront('drop');
        G.pos.x = f.x; G.pos.z = f.z; G.yaw = 0;
      },
      start: 'KeyE',
      cam: null,
    },
    // 8 — THE CARD. Back out on the arcade's apron, Wano far below, and the name.
    {
      name: 'card', b0: 28, b1: 33, pre: 60, flash: 0.7, punch: 0.6,
      setup() { none(); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); if (NEON.active) NEON.leave(); },
      pre2() { place(20, 18, 300); },
      drive() {},
      cam(u) {
        if (G.room !== 'planet') return null;
        const F = frame();
        return { pos: rel(F, -3 - u * 1.5, 0.6, 0.5), look: rel(F, 20, 0, 22 + u * 4), fov: 70 };
      },
    },
  ];
  window.SHOTS.frame = frame;
})();
