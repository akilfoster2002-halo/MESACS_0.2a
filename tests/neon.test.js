/* NEON, the arcade in the clouds (NEON.md). Two real sockets queue at the
   same cabinet and are paired, what one says reaches the other, walking
   away tells the other side — and the class's high scores only go up. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pub = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');

test('the page loads the cabinets and the room, and the door has somewhere to go', () => {
  const html = pub('index.html');
  const at = f => html.indexOf('src="' + f + '?');
  assert.ok(at('cabgames.js') > 0 && at('neon.js') > at('cabgames.js'), 'neon.js must load after cabgames.js');
  assert.ok(at('neon.js') > at('planet.js') && at('neon.js') < at('wallet.js'));
  assert.match(pub('planet.js'), /NEON\.enter\(server\)/);
  assert.match(pub('neon.js'), /window\.NEON\s*=/);
  assert.match(pub('net.js'), /arc\(msg\)/);
  assert.match(pub('islands.js'), /doorOut/);
});

test('two players at VOLLEY are paired, relayed, and told when the other walks away', async () => {
  process.env.PORT = '0';
  const memdb = require('../server/memdb');
  memdb.install();
  memdb.addUser({ id: 501, username: 'kai', display: 'Kai', role: 'student', salt: '', pass_hash: '', progress: {} });
  memdb.addUser({ id: 502, username: 'lu', display: 'Lu', role: 'student', salt: '', pass_hash: '', progress: {} });
  const auth = require('../server/auth');
  const srv = require('../server/index.js');
  const WebSocket = require('ws');
  await new Promise(r => { srv.server.once('listening', r); srv.start(); });
  const port = srv.server.address().port;
  const cookie = id => 'mq=' + auth.sign({ id, role: 'student', exp: Date.now() + 60000 });
  const sock = id => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: cookie(id) } });
    ws.heard = [];
    ws.on('message', raw => ws.heard.push(JSON.parse(raw)));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
  const until = async (ok, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end && !ok()) await new Promise(r => setTimeout(r, 25));
    return ok();
  };
  const arc = ws => ws.heard.filter(m => m.t === 'arc');
  const call = async (p, id, body) => {
    const r = await fetch(`http://127.0.0.1:${port}/api${p}`, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie(id), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  const a = await sock(501), b = await sock(502);
  try {
    for (const ws of [a, b]) ws.send(JSON.stringify({ t: 'join', server: 'meadow' }));
    assert.ok(await until(() => [a, b].every(ws => ws.heard.some(m => m.t === 'room'))), 'could not join');

    a.send(JSON.stringify({ t: 'arc', op: 'queue', game: 'volley' }));
    assert.ok(await until(() => arc(a).some(m => m.op === 'waiting')), 'not told it was waiting');
    assert.ok(await until(() => arc(b).some(m => m.op === 'open' && m.game === 'volley')), 'the room was not told');

    b.send(JSON.stringify({ t: 'arc', op: 'queue', game: 'volley' }));
    assert.ok(await until(() => arc(a).some(m => m.op === 'match') && arc(b).some(m => m.op === 'match')));
    const ma = arc(a).find(m => m.op === 'match'), mb = arc(b).find(m => m.op === 'match');
    assert.strictEqual(ma.you, 'A'); assert.strictEqual(mb.you, 'B');
    assert.strictEqual(ma.seed, mb.seed, 'the two machines must share a seed');
    assert.strictEqual(ma.foe, 'Lu'); assert.strictEqual(mb.foe, 'Kai');

    // the host's state reaches the guest, the guest's keys reach the host
    a.send(JSON.stringify({ t: 'arc', op: 'st', d: { s: { x: 10 }, over: false } }));
    b.send(JSON.stringify({ t: 'arc', op: 'in', d: { u: true, d: false } }));
    assert.ok(await until(() => arc(b).some(m => m.op === 'st' && m.d.s.x === 10)), 'state was not relayed');
    assert.ok(await until(() => arc(a).some(m => m.op === 'in' && m.d.u === true)), 'input was not relayed');

    // and the games themselves talk that way: the host's packet drives the guest's copy
    global.window = {};
    new Function(pub('cabgames.js'))();
    const G = global.window.CABGAMES;
    const h = G.make('volley'), g = G.make('volley');
    h.start(ma.seed, 'A'); g.start(mb.seed, 'B');
    for (let i = 0; i < 40; i++) { h.tick(1/60); g.net(h.out()); g.tick(1/60); h.net(g.out()); }
    const st = h.out().s;
    assert.ok(Number.isFinite(st.x) && Number.isFinite(st.y), 'the host sends where the ball is');
    assert.deepStrictEqual(Object.keys(g.out()).sort(), ['d', 'u'], 'the guest sends only its keys');
    assert.ok(!h.over && !g.over);

    b.close();
    assert.ok(await until(() => arc(a).some(m => m.op === 'gone')), 'the host was not told the guest left');

    // the class board: only solo cabinets, only real numbers, only ever up
    assert.strictEqual((await call('/neon/score', 501, { game: 'snake', score: 120 })).ok, true);
    await call('/neon/score', 501, { game: 'snake', score: 40 });
    assert.strictEqual((await call('/neon/score', 501, { game: 'volley', score: 7 })).status, 400);
    assert.strictEqual((await call('/neon/score', 501, { game: 'snake', score: 5e9 })).status, 400);
    const board = await call('/neon/scores', 501);
    assert.deepStrictEqual(board.scores.snake, [{ display: 'Kai', best: 120 }]);
    assert.deepStrictEqual(board.scores.drop, []);
  } finally {
    a.close(); b.close();
    srv.server.close();
    srv.wss.close();
    setTimeout(() => process.exit(0), 50).unref();
  }
});
