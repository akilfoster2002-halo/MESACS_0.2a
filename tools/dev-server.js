#!/usr/bin/env node
/* =====================================================================
   The whole game, locally, with no database.

   Without DATABASE_URL the server still serves KORO — but sign-in
   reports itself offline, and everything behind sign-in goes with it:
   the rooms, the roster, the chat, seeing anybody else on the planet.
   Which means the multiplayer half of this game cannot be looked at on
   a laptop with no Postgres on it, and that is most laptops.

   So this is the same server with the twenty rows it needs held in
   memory. It is not a database and it does not pretend to be one: it
   answers the eleven statements server/index.js actually sends, it
   forgets everything when you stop it, and it is not wired into
   anything that ships. `npm run dev`, two browser tabs, and the room
   works.

   Nothing under server/ is modified. The `pg` module is substituted at
   require time, which is the only honest way to do this — the server
   runs its own real code path, including the schema call, and cannot
   tell the difference.

   It also signs every request in as a local developer, because every
   feature worth testing is behind sign-in and there is no account to
   sign in with on a laptop. See the bottom of this file: it is a row in
   the array above and a swapped function, not an account, and nothing
   that ships ever loads it.
   ===================================================================== */
const path = require('path');
const memdb = require('../server/memdb');


/* The same .env the real server reads, so a key put in it works under
   `npm run dev` too — and before the fallbacks below, because a real
   DATABASE_URL in .env should beat the in-memory stand-in. */
require('../server/env').load();
/* the rows live in server/memdb.js now, shared with the Mac app; here
   they stay in memory only and go when you stop the server */
memdb.install();
process.env.PORT = process.env.PORT || '8799';
/* ------------------------------------------- signed in, as nobody
   EVERY FEATURE WORTH TESTING IS BEHIND SIGN-IN — the rooms, the chat,
   saved progress, the arcade, the tutor — and on a laptop there is no
   account to sign in with. Which meant `npm run dev` could serve the
   whole game and exercise none of it, and the only way to look at any of
   those was to deploy.

   So under `npm run dev` every request is already signed in, as a
   developer row that exists for as long as this process does. It is NOT
   an account: there is no password, nothing is registered, nothing is
   written anywhere, and it goes when you stop the server. It is the same
   trick this file already plays on `pg` — one function swapped at
   require time — and for the same reason: server/ is not modified and
   runs its own real code path.

   IT CANNOT REACH PRODUCTION. Nothing requires this file except
   `npm run dev`; the deployed server starts at server/index.js and never
   loads it. */
const DEV = { id: 1, username: 'dev', display: 'Local Dev', role: 'teacher' };
memdb.addUser({ id: DEV.id, username: DEV.username, display: DEV.display, role: DEV.role,
                salt: '', pass_hash: '', progress: {}, created_at: new Date().toISOString() });

/* AND IT CAN BE TURNED OFF, because being permanently signed in makes
   the signed-OUT half untestable — the 401s, the "not signed in"
   message, what a visitor sees. `DEV_SIGNED_IN=0 npm run dev` gives the
   real behaviour back. */
const SIGNED_IN = process.env.DEV_SIGNED_IN !== '0';
const auth = require('../server/auth');
const realFromReq = auth.fromReq;
/* A real cookie still wins either way, so signing in as somebody else in
   a second tab behaves the way it does in production. */
if(SIGNED_IN) auth.fromReq = req => realFromReq(req) || { id: DEV.id, role: DEV.role };

console.log('dev-server: accounts and rooms are IN MEMORY and vanish on exit');
console.log(SIGNED_IN
  ? 'dev-server: signed in as "'+DEV.display+'" — dev only, never ships (DEV_SIGNED_IN=0 to turn off)'
  : 'dev-server: signed OUT — sign-in behaves as it does in production');
/* START IT. server/index.js only listens when it is the main module or
   when it is asked, and here it is neither: this file is the main module
   and that one is a require. Without the call it loads, wires everything
   up, and exits with code 0. */
require(path.join(__dirname, '..', 'server', 'index.js')).start();
