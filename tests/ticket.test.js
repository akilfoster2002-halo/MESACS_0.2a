/* The website on Vercel has no server of its own: its /api reaches the game's
   server through a rewrite, and its socket goes to that server directly with
   a one-minute ticket, because the cookie does not travel to another
   address. A ticket opens a socket; it is not a session; a bad one is shut. */
const test = require('node:test');
const assert = require('node:assert');

test('a socket ticket lets a page on another address in, and nothing more', async () => {
  process.env.PORT = '0';
  process.env.RENDER_EXTERNAL_URL = 'https://koro-server.example';
  const memdb = require('../server/memdb');
  memdb.install();
  memdb.addUser({ id: 301, username: 'tia', display: 'Tia', role: 'student', salt: '', pass_hash: '', progress: {} });
  const auth = require('../server/auth');
  const srv = require('../server/index.js');
  const WebSocket = require('ws');
  await new Promise(r => { srv.server.once('listening', r); srv.start(); });
  await new Promise(r => setTimeout(r, 50));
  const port = srv.server.address().port;
  const cookie = 'mq=' + auth.sign({ id: 301, role: 'student', exp: Date.now() + 60000 });
  const get = async (path, c) => {
    const r = await fetch(`http://127.0.0.1:${port}/api${path}`, { headers: c ? { Cookie: c } : {} });
    return { status: r.status, ...(await r.json()) };
  };
  const socket = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);   // no cookie, as from another site
    ws.heard = [];
    ws.on('message', raw => ws.heard.push(JSON.parse(raw)));
    ws.on('close', code => { ws.closedWith = code; });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
  const until = async (ok, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end && !ok()) await new Promise(r => setTimeout(r, 30));
    return ok();
  };
  const socks = [];
  try {
    assert.strictEqual((await get('/ticket')).status, 401, 'a ticket without signing in');
    const t = await get('/ticket', cookie);
    assert.strictEqual(t.ok, true);
    assert.strictEqual(t.live, 'https://koro-server.example', 'the page was not told where the socket lives');

    // the ticket as the first word: let in, and able to join a room
    const ws = await socket(); socks.push(ws);
    ws.send(JSON.stringify({ t: 'hello', ticket: t.ticket }));
    assert.ok(await until(() => ws.heard.some(m => m.t === 'welcome' && m.you.id === 301)), 'the ticket was not accepted');
    ws.send(JSON.stringify({ t: 'join', server: 'meadow' }));
    assert.ok(await until(() => ws.heard.some(m => m.t === 'room' && m.server === 'meadow')), 'could not join after the ticket');

    // a forged ticket, or none: shut with "sign in first"
    const bad = await socket(); socks.push(bad);
    bad.send(JSON.stringify({ t: 'hello', ticket: t.ticket.slice(0, -2) + 'xx' }));
    assert.ok(await until(() => bad.closedWith === 4001), 'a forged ticket was let in');
    const rude = await socket(); socks.push(rude);
    rude.send(JSON.stringify({ t: 'join', server: 'meadow' }));
    assert.ok(await until(() => rude.closedWith === 4001), 'a socket that never said who it was stayed open');

    // a ticket is not a session
    assert.strictEqual((await get('/me', 'mq=' + t.ticket)).ok, false, 'a socket ticket worked as a sign-in');
    // and a session is not a ticket
    const s2 = await socket(); socks.push(s2);
    s2.send(JSON.stringify({ t: 'hello', ticket: cookie.slice(3) }));
    assert.ok(await until(() => s2.closedWith === 4001), 'a session cookie was taken as a ticket');
  } finally {
    socks.forEach(s => s.close());
    srv.server.close();
    srv.wss.close();
    setTimeout(() => process.exit(0), 50).unref();
  }
});
