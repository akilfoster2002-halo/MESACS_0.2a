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
const games = [];
const votes = [];          // {game_id,user_id,stars,note,hidden,created_at}
let nextId = 1;
let nextGameId = 1;

const like = (sql, ...bits) => bits.every(b => sql.includes(b));
const rows = r => ({ rows:r, rowCount:r.length });

function query(text, params){
  const sql = String(text).replace(/\s+/g, ' ').trim();
  const p = params || [];

  if(/^CREATE TABLE/i.test(sql) || /^ALTER TABLE/i.test(sql) || /^DO \$\$/i.test(sql)
     || /^CREATE INDEX/i.test(sql))
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

  /* ------------------------------------------------------- the arcade
     The shelf query is a join and two aggregates in Postgres and a map
     here. What matters is that the SHAPE matches — the browser reads
     stars, votes, author and plays off every row — because a shim that
     answers with the right rows and the wrong columns is a bug hunt in
     the browser for something that is wrong in this file. */
  const shelf = g => {
    const mine = votes.filter(v => v.game_id===g.id && !v.hidden);
    const author = users.find(u => u.id===g.author_id);
    return { id:g.id, title:g.title, blurb:g.blurb, stage:g.stage, plays:g.plays,
             author_id:g.author_id, author: author ? author.display : '?',
             updated_at:g.updated_at, votes:mine.length,
             stars: mine.length
               ? Math.round(mine.reduce((a,v)=>a+v.stars,0)/mine.length*10)/10 : 0 };
  };
  const newest = (a,b) => new Date(b.updated_at) - new Date(a.updated_at);

  if(like(sql, 'FROM games g', 'WHERE g.hidden=false ORDER BY'))
    return Promise.resolve(rows(games.filter(g=>!g.hidden).sort(newest).slice(0,60).map(shelf)));

  if(like(sql, 'FROM games g', 'WHERE g.author_id=$1'))
    return Promise.resolve(rows(games.filter(g=>g.author_id===p[0]).sort(newest).map(shelf)));

  if(like(sql, 'g.project', 'FROM games g', 'WHERE g.id=$1')){
    const g = games.find(x => x.id===p[0] && !x.hidden);
    return Promise.resolve(rows(g ? [Object.assign(shelf(g), { project:g.project })] : []));
  }
  if(like(sql, 'FROM game_votes v', 'WHERE v.game_id=$1')){
    const out = votes.filter(v => v.game_id===p[0] && !v.hidden && v.note)
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,20)
      .map(v => ({ stars:v.stars, note:v.note,
                   display:(users.find(u=>u.id===v.user_id)||{}).display || '?' }));
    return Promise.resolve(rows(out));
  }
  if(like(sql, 'SELECT id FROM games WHERE author_id=$1')){
    const g = games.find(x => x.author_id===p[0] &&
      String(x.title).toLowerCase()===String(p[1]).toLowerCase());
    return Promise.resolve(rows(g ? [{ id:g.id }] : []));
  }
  if(like(sql, 'UPDATE games SET blurb=$1')){
    const g = games.find(x => x.id===p[3]);
    if(g){ g.blurb=p[0]; g.stage=p[1];
           g.project = typeof p[2]==='string' ? JSON.parse(p[2]) : p[2];
           g.hidden=false; g.updated_at=new Date().toISOString(); }
    return Promise.resolve(rows(g ? [{ id:g.id }] : []));
  }
  if(like(sql, 'INSERT INTO games')){
    const now=new Date().toISOString();
    const g = { id:nextGameId++, author_id:p[0], title:p[1], blurb:p[2], stage:p[3],
                project: typeof p[4]==='string' ? JSON.parse(p[4]) : p[4],
                plays:0, hidden:false, created_at:now, updated_at:now };
    games.push(g);
    return Promise.resolve(rows([{ id:g.id }]));
  }
  if(like(sql, 'UPDATE games SET plays=plays+1')){
    const g = games.find(x => x.id===p[0] && !x.hidden);
    if(g) g.plays++;
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'SELECT author_id FROM games WHERE id=$1')){
    const g = games.find(x => x.id===p[0] && !x.hidden);
    return Promise.resolve(rows(g ? [{ author_id:g.author_id }] : []));
  }
  if(like(sql, 'INSERT INTO game_votes')){
    /* the real table has a primary key doing this; here it is a find */
    let v = votes.find(x => x.game_id===p[0] && x.user_id===p[1]);
    if(!v){ v={ game_id:p[0], user_id:p[1], hidden:false }; votes.push(v); }
    v.stars=p[2]; v.note=p[3]; v.created_at=new Date().toISOString();
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'UPDATE games SET hidden=$2')){
    const g = games.find(x => x.id===p[0] &&
      (p.length<3 || x.author_id===p[2]));
    if(g) g.hidden = p[1];
    return Promise.resolve(rows(g ? [{ id:g.id }] : []));
  }

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
