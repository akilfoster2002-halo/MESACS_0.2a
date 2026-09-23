/* THE PHONE — texts between students, and the room chat, in one place.

   These are the rules that matter more than how it looks: texts are
   stored, so they need everything stored child-written words need — a
   teacher who can read and hide them, a mute that reaches them, a length
   cap, a rate limit and an expiry — and the old room chat must still work,
   because the rest of the game still talks to CHAT. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('texts are kept in their own table, and expire', ()=>{
  const db = read('server/db.js');
  assert.match(db, /CREATE TABLE IF NOT EXISTS phone_messages/, 'no table for texts');
  const srv = read('server/index.js');
  assert.match(srv, /DELETE FROM phone_messages WHERE created_at < now\(\) - interval/, 'texts are never deleted');
  assert.match(srv, /const PHONE_KEEP_DAYS = \d+;/, 'no stated retention');
});

test('texting follows the room chat rules', ()=>{
  const srv = read('server/index.js');
  const send = srv.slice(srv.indexOf("app.post('/api/phone/send'"), srv.indexOf("app.get('/api/phone/unread'"));
  assert.ok(send.length > 100, 'no send route');
  assert.match(send, /muted_until/, 'a muted student can still text');
  assert.match(send, /rateLimited\('phone:'/, 'texting is not rate limited');
  assert.match(send, /slice\(0, PHONE_MAX\)/, 'a text has no length cap');
  assert.match(send, /Nobody has that username/, 'a text to nobody is not refused');
  assert.match(send, /That is you!/, 'you can text yourself');
});

test('a teacher can read every text and hide any of them', ()=>{
  const srv = read('server/index.js');
  assert.match(srv, /app\.get\('\/api\/teacher\/texts', async \(req,res\)=>\{\s*const t = await requireTeacher/, 'texts are not teacher-only');
  assert.match(srv, /app\.post\('\/api\/teacher\/texts\/hide'/, 'a teacher cannot hide a text');
  assert.match(srv, /WHERE \(m\.from_id=\$1 OR m\.to_id=\$1\) AND m\.hidden=false/, 'hidden texts still reach the phone');
  assert.match(read('public/teacher.js'), /\/teacher\/texts/, 'the teacher panel does not show texts');
});

test('the phone is the room chat now, and the old box is gone', ()=>{
  const html = read('public/index.html');
  assert.ok(!/<div id="chat"/.test(html), 'the old chat box is still on the page');
  assert.ok(html.indexOf('phone.js') > html.indexOf('menu.js'), 'phone.js must load after menu.js');
  const ph = read('public/phone.js');
  for(const fn of ['show()', 'hide()', 'focus()', 'line(from, text, id)', 'sys(text)', 'clear(quiet)', 'remove(id)'])
    assert.ok(ph.includes(fn), 'CHAT.'+fn+' is missing — something in the game still calls it');
  assert.match(ph, /id="chatIn"/, 'Enter-to-chat in game.js looks for #chatIn');
  assert.match(ph, /Your teacher can see your messages/, 'the phone does not say who can read it');
  assert.match(ph, /typeof G!=='undefined'/, 'window.G is undefined: G is a top-level const');
});
