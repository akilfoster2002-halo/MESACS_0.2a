/* Chat Rooms, end to end, on the real server over the in-memory database:
   a room is made, found, entered, shared, furnished, locked and deleted,
   and at every step the server — not the client — decides who may. */
const test = require('node:test');
const assert = require('node:assert');

test('chat rooms: create, permit, share, furnish, sync, lock, delete', async () => {
  process.env.PORT = '0';
  const memdb = require('../server/memdb');
  memdb.install();
  const people = { ana: 201, ben: 202, cy: 203 };
  for (const [u, id] of Object.entries(people))
    memdb.addUser({ id, username: u, display: u[0].toUpperCase() + u.slice(1), role: 'student',
                    salt: '', pass_hash: '', progress: {} });
  const auth = require('../server/auth');
  const srv = require('../server/index.js');
  const WebSocket = require('ws');
  await new Promise(r => { srv.server.once('listening', r); srv.start(); });
  // the schema runs before the server listens; give the stand-in a tick
  await new Promise(r => setTimeout(r, 50));
  const port = srv.server.address().port;
  const cookie = id => 'mq=' + auth.sign({ id, role: 'student', exp: Date.now() + 120000 });

  const api = async (who, method, path, body) => {
    const r = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', Cookie: cookie(people[who]) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  const open = who => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: cookie(people[who]) } });
    ws.heard = [];
    ws.on('message', raw => ws.heard.push(JSON.parse(raw)));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
  const until = async (ok, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end && !ok()) await new Promise(r => setTimeout(r, 40));
    return ok();
  };
  const socks = [];
  try {
    // 1. Ana makes a private bedroom
    const made = await api('ana', 'POST', '/rooms', { name: '  Ana\u0007s   Den  ', access: 'private', template: 'bedroom' });
    assert.strictEqual(made.ok, true, made.error);
    const room = made.room;
    assert.strictEqual(room.name, 'Anas Den', 'the name was not cleaned');
    assert.ok(room.mine && room.objects.length > 5, 'the bedroom template did not furnish it');
    assert.ok(room.objects.some(o => o.type === 'portal'), 'a room with no way out');
    const id = room.id;

    // 2. it is Ana's, and it is hers to find
    const lists = await api('ana', 'GET', '/rooms');
    assert.ok(lists.mine.some(r => r.id === id), 'not in MY ROOMS');

    // 3. private means Ben cannot see it, enter it, or join its socket room
    assert.strictEqual((await api('ben', 'GET', `/rooms/${id}`)).status, 404);
    assert.strictEqual((await api('ben', 'POST', `/rooms/${id}/enter`)).status, 403);
    assert.strictEqual((await api('ben', 'GET', `/rooms/search?q=den`)).rooms.length, 0, 'a private room showed up in search');
    const ben = await open('ben'); socks.push(ben);
    ben.send(JSON.stringify({ t: 'join', server: 'cr:' + id }));
    assert.ok(await until(() => ben.heard.some(m => m.t === 'crkick')), 'the socket let Ben into a private room');

    // 4. Ana invites Ben. Private is Ana alone, so he is on the list but not
    //    yet in; made Invited, the list opens the door
    const inv = await api('ana', 'POST', `/rooms/${id}/invite`, { username: 'ben' });
    assert.strictEqual(inv.ok, true, inv.error);
    assert.ok(inv.note, 'the owner was not told the room is still private');
    assert.ok(await until(() => ben.heard.some(m => m.t === 'crinvite' && m.id === id)), 'Ben was never told');
    assert.ok((await api('ben', 'GET', '/rooms')).invited.some(r => r.id === id));
    assert.strictEqual((await api('ben', 'POST', `/rooms/${id}/enter`)).status, 403, 'private let an invited player in');
    assert.strictEqual((await api('ana', 'POST', `/rooms/${id}/access`, { access: 'invited' })).ok, true);
    const entered = await api('ben', 'POST', `/rooms/${id}/enter`);
    assert.strictEqual(entered.server, 'cr:' + id);
    assert.ok((await api('ben', 'GET', '/rooms')).recent.some(r => r.id === id), 'not in RECENT');
    // and Ben cannot do the owner's things
    assert.strictEqual((await api('ben', 'POST', `/rooms/${id}/save`, { objects: [] })).status, 403);
    assert.strictEqual((await api('ben', 'POST', `/rooms/${id}/access`, { access: 'public' })).status, 403);
    assert.strictEqual((await api('ben', 'DELETE', `/rooms/${id}`)).status, 403);

    // 5. both inside, both seen, at the same place
    const ana = await open('ana'); socks.push(ana);
    for (const [ws, x] of [[ana, 0.1], [ben, 0.2]]) {
      // a chat room's door is checked against the database first: the game,
      // like this, speaks once it has been let in
      ws.send(JSON.stringify({ t: 'join', server: 'cr:' + id }));
      assert.ok(await until(() => ws.heard.some(m => m.t === 'room' && m.server === 'cr:' + id)), 'not let in');
      ws.send(JSON.stringify({ t: 'pos', x, z: 0, yaw: 0, y: 0, char: 'nia', at: 'chatroom' }));
    }
    const sees = (ws, other) => ws.heard.some(m => m.t === 'players' && m.players.some(p => p.id === other && p.at === 'chatroom'));
    assert.ok(await until(() => sees(ana, people.ben) && sees(ben, people.ana)), 'they cannot see each other');
    const benSeen = ana.heard.filter(m => m.t === 'players').pop().players.find(p => p.id === people.ben);
    assert.strictEqual(benSeen.char, 'nia', 'a named character was flattened to a letter');
    assert.strictEqual((await api('ana', 'GET', '/rooms')).mine.find(r => r.id === id).players, 2);

    // 6. saving: what the client sends is washed
    const saved = await api('ana', 'POST', `/rooms/${id}/save`, {
      env: { floor: 'lava', floorColor: 'red', light: 'neon', brightness: 99, sky: 'nebula' },
      objects: [
        { type: 'couch', p: [500, -3, 2], r: 725, s: 40, props: { color: '#ABCDEF', evil: 'x' } },
        { type: 'nuke', p: [0, 0, 0] },
        { type: 'neon_sign', p: [1, 2, 3], props: { text: 'x'.repeat(500) } },
        { type: 'robot', p: [0, 0, 0], props: { program: [['event.flag'], ['motion.move', 1e9], ['os.exec', 'rm'], ['motion.turn', 'q', 45]] } }
      ] });
    assert.strictEqual(saved.ok, true, saved.error);
    const env = saved.room.env, objs = saved.room.objects;
    assert.strictEqual(env.floor, 'wood', 'an unknown floor was kept');
    assert.strictEqual(env.light, 'neon');
    assert.strictEqual(env.brightness, 2);
    assert.strictEqual(objs.length, 3, 'an unknown object type was kept');
    const couch = objs.find(o => o.type === 'couch');
    assert.strictEqual(couch.p[0], 9.8); assert.strictEqual(couch.p[1], 0);
    assert.strictEqual(couch.r, 5); assert.strictEqual(couch.s, 4);
    assert.deepStrictEqual(couch.props, { color: '#abcdef' }, 'props outside the type were kept');
    assert.strictEqual(objs.find(o => o.type === 'neon_sign').props.text.length, 60);
    assert.deepStrictEqual(objs.find(o => o.type === 'robot').props.program,
      [['event.flag'], ['motion.move', 1000], ['motion.turn', 'z', 45]], 'the program was not washed');
    assert.ok(await until(() => ben.heard.some(m => m.t === 'crupdate' && m.id === id)), 'Ben never heard the room changed');
    // and it persists: read back later, it is what was saved
    const again = await api('ben', 'GET', `/rooms/${id}`);
    assert.strictEqual(again.room.objects.length, 3);

    // 7. live object state is shared; a robot run is stamped by the server
    ben.send(JSON.stringify({ t: 'cro', o: objs[0].id, s: { on: true } }));
    assert.ok(await until(() => ana.heard.some(m => m.t === 'cro' && m.o === objs[0].id && m.s.on === true)), 'a switch did not sync');
    ana.send(JSON.stringify({ t: 'cro', o: 'robot1', s: { run: 1 } }));
    assert.ok(await until(() => ben.heard.some(m => m.t === 'cro' && m.o === 'robot1' && m.s.run > 1e12)), 'a run was not stamped');

    // 8. public: Cy may come in and find it; made private again, out he goes
    await api('ana', 'POST', `/rooms/${id}/access`, { access: 'public' });
    assert.ok((await api('cy', 'GET', '/rooms/search?q=DEN')).rooms.some(r => r.id === id), 'public room not found');
    assert.strictEqual((await api('cy', 'POST', `/rooms/${id}/enter`)).ok, true);
    const cy = await open('cy'); socks.push(cy);
    cy.send(JSON.stringify({ t: 'join', server: 'cr:' + id }));
    assert.ok(await until(() => cy.heard.some(m => m.t === 'cro_all')), 'Cy was not handed the room as it is');
    assert.ok(cy.heard.find(m => m.t === 'cro_all').states.some(s => s.o === objs[0].id), 'the switch was not remembered');
    const kicks = ws => ws.heard.filter(m => m.t === 'crkick').length;
    const benBefore = kicks(ben);             // his refusal back in step 3
    await api('ana', 'POST', `/rooms/${id}/access`, { access: 'invited' });
    assert.ok(await until(() => kicks(cy) > 0), 'a stranger stayed in a room made invite-only');
    assert.strictEqual(kicks(ben), benBefore, 'an invited player was thrown out');
    // taken off the list, Ben goes too
    await api('ana', 'POST', `/rooms/${id}/remove`, { userId: people.ben });
    assert.ok(await until(() => kicks(ben) > benBefore), 'a removed player stayed in');
    // and private is Ana alone, list or no list
    await api('ana', 'POST', `/rooms/${id}/invite`, { username: 'ben' });
    await api('ana', 'POST', `/rooms/${id}/access`, { access: 'private' });
    assert.strictEqual((await api('ben', 'POST', `/rooms/${id}/enter`)).status, 403, 'private let a listed player in');
    assert.strictEqual((await api('ana', 'POST', `/rooms/${id}/enter`)).ok, true, 'the owner was shut out of her own room');

    // 9. deleted: gone for everybody
    assert.strictEqual((await api('ana', 'DELETE', `/rooms/${id}`)).ok, true);
    assert.strictEqual((await api('ana', 'GET', `/rooms/${id}`)).status, 404);
    assert.ok(!(await api('ana', 'GET', '/rooms')).mine.some(r => r.id === id));
  } finally {
    socks.forEach(s => s.close());
    srv.server.close();
    srv.wss.close();
    setTimeout(() => process.exit(0), 50).unref();
  }
});
