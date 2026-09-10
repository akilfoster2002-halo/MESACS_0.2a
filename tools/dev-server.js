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
   ===================================================================== */
const Module = require('module');
const path = require('path');

/* --------------------------------------------------------- the rows */
const users = [];
let nextId = 1;

const like = (sql, ...bits) => bits.every(b => sql.includes(b));
const rows = r => ({ rows:r, rowCount:r.length });

function query(text, params){
  const sql = String(text).replace(/\s+/g, ' ').trim();
  const p = params || [];

  if(/^CREATE TABLE/i.test(sql) || /^ALTER TABLE/i.test(sql) || /^DO \$\$/i.test(sql))
    return Promise.resolve(rows([]));

  if(like(sql, 'INSERT INTO users')){
    const [username, pass_hash, salt, display] = p;
    const role = sql.includes("'teacher'") ? 'teacher' : 'student';
    const u = { id:nextId++, username, pass_hash, salt, role, display,
                progress:{}, muted_until:null, class_id:null };
    users.push(u);
    return Promise.resolve(rows([{ id:u.id, username:u.username, display:u.display,
                                   role:u.role, progress:u.progress }]));
  }
  if(like(sql, 'SELECT', 'FROM users', 'WHERE username=$1')){
    const u = users.find(x => x.username === p[0]);
    if(!u) return Promise.resolve(rows([]));
    return Promise.resolve(rows([sql.startsWith('SELECT *') ? u : { '?column?':1 }]));
  }
  if(like(sql, 'SELECT', 'FROM users', 'WHERE id=$1')){
    const u = users.find(x => x.id === p[0]);
    return Promise.resolve(rows(u ? [u] : []));
  }
  if(like(sql, 'UPDATE users SET progress=$1')){
    const u = users.find(x => x.id === p[1]);
    if(u) u.progress = typeof p[0]==='string' ? JSON.parse(p[0]) : p[0];
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'UPDATE users SET muted_until=$1')){
    const u = users.find(x => x.id === p[1]);
    if(u) u.muted_until = p[0];
    return Promise.resolve(rows([]));
  }
  if(like(sql, "WHERE role='student'"))
    return Promise.resolve(rows(users.filter(u => u.role==='student')
      .sort((a,b)=>String(a.display).localeCompare(b.display))));

  /* Anything else is a statement this shim has never been shown. Fail
     loudly: a dev database that silently answers "no rows" to a query it
     does not understand is a debugging session about the wrong thing. */
  return Promise.reject(
    new Error('dev-server has no answer for: ' + sql.slice(0, 110)));
}

class Pool {
  query(text, params){ return query(text, params); }
  end(){ return Promise.resolve(); }
  on(){ return this; }
}

const load = Module._load;
Module._load = function(request, parent, isMain){
  if(request === 'pg') return { Pool };
  return load.apply(this, arguments);
};

process.env.DATABASE_URL = process.env.DATABASE_URL || 'memory://koro';
process.env.PORT = process.env.PORT || '8799';
console.log('dev-server: accounts and rooms are IN MEMORY and vanish on exit');
require(path.join(__dirname, '..', 'server', 'index.js'));
