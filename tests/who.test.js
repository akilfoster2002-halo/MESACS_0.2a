/* WHO IS HERE.

   The multiplayer pitch of this game is that your class is in the world
   with you, and the only way to check used to be to walk around looking.
   The server has always known — `live` is every open socket, carrying the
   room it joined and the door it last walked through — and nothing showed
   it to anybody but a teacher. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('who is here is signed-in only, and needs no database', ()=>{
  const api = read('server/index.js');
  assert.match(api, /app\.get\('\/api\/who'/, 'there is no who endpoint');
  /* A public endpoint listing the display names of a room full of children
     is not a thing to ship. The cookie is HMAC-signed, so checking it
     costs no tables — which is why this can sit above the database gate. */
  assert.match(api, /app\.get\('\/api\/who'[\s\S]{0,160}auth\.fromReq\(req\)\) return bad\(res,401/,
    'the list of who is online is readable by anybody');
  const gate = api.match(/const NO_DB_NEEDED = \[([^\]]*)\]/);
  assert.ok(gate && gate[1].includes("'/who'"),
    'who is here goes down with Postgres, though it reads no tables');
  /* Students only, which is the convention the in-world roster already
     follows: a teacher is not drawn as a body in a room either. */
  assert.match(api, /if\(p\.role!=='student'\) continue;/,
    'teachers are listed as if they were another child to go and find');
});

test('the panel is a glance, and says which kind of empty it is', ()=>{
  const who = read('public/who.js');
  /* Polls only while open. Thirty browsers each holding a push feed for a
     list nobody is looking at is more machinery than the question needs. */
  assert.match(who, /timer=setInterval\(refresh, \d+\)/, 'the list never refreshes');
  assert.match(who, /clearInterval\(timer\)/, 'the poll outlives the panel');
  /* "Nobody is here" and "the server is not answering" are different
     facts, and a child who reads the second as the first concludes their
     class has gone home. */
  assert.match(who, /Cannot reach the server right now/, 'a dead server reads as an empty room');
  assert.match(who, /Nobody else is here yet/, 'an empty room has nothing to say');
  /* Names come from other children: textContent, never innerHTML. */
  assert.match(who, /el\.textContent = str==null \? '' : String\(str\)/,
    'the text helper no longer sets textContent');
  const html = [...who.matchAll(/innerHTML\s*=\s*([^;]+);/g)].map(m=>m[1].trim());
  for(const rhs of html)
    assert.ok(rhs === "''" || rhs === '""',
      `who.js builds markup from ${rhs} — a display name must not be innerHTML`);

  const game = read('public/game.js');
  assert.match(game, /e\.code==='KeyO'[\s\S]{0,80}WHO\.toggle\(\)/, 'O no longer opens it');
  assert.match(game, /WHO\.up && WHO\.key\(e\)/, 'it does not take Esc while it is up');
  assert.match(game, /function frozen\(\)[\s\S]{0,400}WHO\.up/,
    'you can walk off a cliff while reading the list');
  assert.match(game, /btnOnline/, 'the hotkey has no visible twin');
});
