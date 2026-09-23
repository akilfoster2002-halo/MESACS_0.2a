/* Two people in a room can see each other — on a server that was STARTED,
   not one that happened to be the main module.

   The roster broadcast used to be switched on by `require.main === module`,
   which is only true for `npm start`. `npm run dev` and the Mac app both
   require server/index.js and call start(), and in both of them a room was
   a place where nobody ever heard where anybody else was: every socket
   joined, every `pos` was stored, and no `players` message ever went out.

   This runs the real server on a free port, over the in-memory database,
   and puts two students in the Meadow. */
const test = require('node:test');
const assert = require('node:assert');

test('two students in the same room hear where each other are', async ()=>{
  process.env.PORT = '0';
  const memdb = require('../server/memdb');
  memdb.install();
  memdb.addUser({ id: 101, username: 'ana', display: 'Ana', role: 'student',
                  salt: '', pass_hash: '', progress: {} });
  memdb.addUser({ id: 102, username: 'ben', display: 'Ben', role: 'student',
                  salt: '', pass_hash: '', progress: {} });
  const auth = require('../server/auth');
  const srv = require('../server/index.js');
  const WebSocket = require('ws');

  await new Promise(r => { srv.server.once('listening', r); srv.start(); });
  const port = srv.server.address().port;

  const open = id => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Cookie: 'mq=' + auth.sign({ id, role: 'student', exp: Date.now() + 60000 }) } });
    ws.heard = [];
    ws.on('message', raw => ws.heard.push(JSON.parse(raw)));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
  const a = await open(101), b = await open(102);
  try{
    for(const [ws, lon] of [[a, 10], [b, 20]]){
      ws.send(JSON.stringify({ t: 'join', server: 'meadow' }));
      ws.send(JSON.stringify({ t: 'pos', x: lon, z: 5, yaw: 0.5, y: 0, char: 's', at: 'hub' }));
    }
    const sees = (ws, other) => ws.heard.some(m => m.t === 'players' &&
      m.players.some(p => p.id === other && p.at === 'hub'));
    const until = Date.now() + 3000;
    while(Date.now() < until && !(sees(a, 102) && sees(b, 101)))
      await new Promise(r => setTimeout(r, 50));
    assert.ok(sees(a, 102), 'Ana never heard where Ben is');
    assert.ok(sees(b, 101), 'Ben never heard where Ana is');
    const ben = a.heard.filter(m => m.t === 'players').pop().players.find(p => p.id === 102);
    assert.strictEqual(ben.x, 20, 'Ben arrived somewhere other than where he said he was');
  } finally {
    a.close(); b.close();
    srv.server.close();
    srv.wss.close();
    setTimeout(() => process.exit(0), 50).unref();
  }
});
