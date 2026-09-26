/* The README promises a teacher can take any game down: hidden rather than
   deleted, so hiding the wrong one is reversible — and republishing must not
   be a way for the author to undo it. */
const test = require('node:test');
const assert = require('node:assert');

test('a teacher takes a game down, PUBLISH cannot bring it back, and Unhide can', async () => {
  process.env.PORT = '0';
  const memdb = require('../server/memdb');
  memdb.install();
  memdb.addUser({ id: 401, username: 'ada', display: 'Ada', role: 'student', salt: '', pass_hash: '', progress: {} });
  memdb.addUser({ id: 402, username: 'bo', display: 'Bo', role: 'student', salt: '', pass_hash: '', progress: {} });
  memdb.addUser({ id: 403, username: 'mx', display: 'Ms X', role: 'teacher', salt: '', pass_hash: '', progress: {} });
  const auth = require('../server/auth');
  const srv = require('../server/index.js');
  await new Promise(r => { srv.server.once('listening', r); srv.start(); });
  const port = srv.server.address().port;
  const as = id => 'mq=' + auth.sign({ id, role: id === 403 ? 'teacher' : 'student', exp: Date.now() + 60000 });
  const call = async (path, c, body) => {
    const r = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: c, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  const game = { title: 'Dodge', blurb: 'dodge it', stage: 'flat', project: { actors: [{ name: 'a' }] } };
  const ada = as(401), bo = as(402), teacher = as(403);
  try {
    const pub = await call('/arcade', ada, game);
    assert.strictEqual(pub.ok, true);
    const id = pub.id;

    assert.strictEqual((await call('/teacher/arcade', bo)).status, 403, 'a student saw the teacher list');
    assert.strictEqual((await call('/teacher/arcade/hide', bo, { id })).status, 403, 'a student took a game down');

    const list = await call('/teacher/arcade', teacher);
    assert.ok(list.games.some(g => g.id === id && g.hidden === false));

    assert.strictEqual((await call('/teacher/arcade/hide', teacher, { id })).ok, true);
    assert.ok(!(await call('/arcade', bo)).games.some(g => g.id === id), 'still on the shelf');
    assert.strictEqual((await call('/arcade/' + id, bo)).status, 404, 'still playable');
    const mine = await call('/arcade/mine/list', ada);
    assert.ok(mine.games.some(g => g.id === id && g.hidden === true), 'the author was not told');

    await call('/arcade', ada, { ...game, blurb: 'back again' });
    assert.ok(!(await call('/arcade', bo)).games.some(g => g.id === id), 'republishing undid the takedown');

    assert.strictEqual((await call('/teacher/arcade/hide', teacher, { id, hidden: false })).ok, true);
    assert.ok((await call('/arcade', bo)).games.some(g => g.id === id), 'Unhide did not put it back');
    assert.strictEqual((await call('/teacher/arcade/hide', teacher, { id: 99999 })).status, 404);
  } finally {
    srv.server.close();
    srv.wss.close();
    setTimeout(() => process.exit(0), 50).unref();
  }
});
