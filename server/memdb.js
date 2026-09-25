/* =====================================================================
   A POSTGRES THAT IS AN ARRAY — for running the game with no database.

   server/index.js talks to Postgres through `pg`. This substitutes `pg` at
   require time with a Pool that answers the statements the server actually
   sends from arrays in memory, so the server runs its own real code path
   and cannot tell the difference.

   Two users of it:
     - `npm run dev` (tools/dev-server.js): in memory, gone when you stop it.
     - the Mac app (desktop/main.js): the same rows SAVED TO A FILE after
       every change and read back at start, so accounts, progress, the
       Arcade and texts survive quitting the app.

   install({ file }) must be called BEFORE server/index.js is required.
   ===================================================================== */
const Module = require('module');
const fs = require('fs');

/* --------------------------------------------------------- the rows */
const users = [];
const games = [];
const votes = [];          // {game_id,user_id,stars,note,hidden,created_at}
let nextId = 1;
let nextGameId = 1;
const texts = [];          // the phone: {id,from_id,to_id,text,read_at,hidden,created_at}
let nextTextId = 1;
const chatRooms = [];      // {id,owner_id,name,access,template,env,objects,created_at,updated_at}
const chatMembers = [];    // {room_id,user_id,added_at}
const chatVisits = [];     // {user_id,room_id,at}
let nextRoomId = 1;

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
  /* ------------------------------------------------------- the phone
     Texts, in an array. Same shapes the Postgres queries hand back, so the
     phone in the browser cannot tell which one it is talking to. */
  const userById = id => users.find(u => u.id===id) || {};
  if(like(sql, 'SELECT id,username,display FROM users WHERE username=$1')){
    const u = users.find(x => x.username === p[0]);
    return Promise.resolve(rows(u ? [{ id:u.id, username:u.username, display:u.display }] : []));
  }
  if(like(sql, 'FROM users WHERE username LIKE $1')){
    const pre = String(p[0]).replace(/%$/,'');
    return Promise.resolve(rows(users.filter(u => u.username.startsWith(pre) && u.id!==p[1])
      .sort((a,b)=>a.username.localeCompare(b.username)).slice(0,8)
      .map(u => ({ username:u.username, display:u.display }))));
  }
  if(like(sql, 'DELETE FROM phone_messages')){
    const cut = Date.now() - 14*864e5;
    for(let i=texts.length-1;i>=0;i--) if(new Date(texts[i].created_at).getTime()<cut) texts.splice(i,1);
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'INSERT INTO phone_messages')){
    const m = { id:nextTextId++, from_id:p[0], to_id:p[1], text:p[2], read_at:null,
                hidden:false, created_at:new Date().toISOString() };
    texts.push(m);
    return Promise.resolve(rows([{ id:m.id, created_at:m.created_at }]));
  }
  if(like(sql, 'UPDATE phone_messages SET read_at=now()')){
    texts.forEach(m => { if(m.to_id===p[0] && m.from_id===p[1] && !m.read_at) m.read_at=new Date().toISOString(); });
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'UPDATE phone_messages SET hidden=$2')){
    const m = texts.find(x => x.id===p[0]); if(m) m.hidden=p[1];
    return Promise.resolve(rows([]));
  }
  const newestText = (a,b) => b.id - a.id;
  if(like(sql, 'FROM phone_messages m', 'CASE WHEN m.from_id=$1')){
    const me=p[0];
    return Promise.resolve(rows(texts.filter(m => !m.hidden && (m.from_id===me || m.to_id===me))
      .sort(newestText).slice(0,400).map(m => {
        const o = userById(m.from_id===me ? m.to_id : m.from_id);
        return { ...m, username:o.username, display:o.display };
      })));
  }
  if(like(sql, 'FROM phone_messages', '(from_id=$1 AND to_id=$2)')){
    return Promise.resolve(rows(texts.filter(m => !m.hidden &&
        ((m.from_id===p[0] && m.to_id===p[1]) || (m.from_id===p[1] && m.to_id===p[0])))
      .sort(newestText).slice(0,100)
      .map(m => ({ id:m.id, from_id:m.from_id, text:m.text, created_at:m.created_at }))));
  }
  if(like(sql, 'FROM phone_messages m', 'read_at IS NULL')){
    return Promise.resolve(rows(texts.filter(m => m.to_id===p[0] && !m.read_at && !m.hidden)
      .sort(newestText).slice(0,20).map(m => {
        const o = userById(m.from_id);
        return { id:m.id, username:o.username, display:o.display, text:m.text };
      })));
  }
  if(like(sql, 'FROM phone_messages m JOIN users f')){
    return Promise.resolve(rows(texts.slice().sort(newestText).slice(0,200).map(m => {
      const f=userById(m.from_id), o=userById(m.to_id);
      return { id:m.id, text:m.text, hidden:m.hidden, created_at:m.created_at,
               from_user:f.username, from_display:f.display, to_user:o.username, to_display:o.display };
    })));
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

  /* ---------------------------------------------------- chat rooms
     The statements in server/chatrooms.js, one for one. */
  const now = () => new Date().toISOString();
  const byNewest = k => (a, b) => String(b[k]).localeCompare(String(a[k]));
  const card = r => { const u = userById(r.owner_id);
    return { id:r.id, name:r.name, access:r.access, owner_id:r.owner_id, owner_display:u.display }; };
  const jsonOf = v => typeof v === 'string' ? JSON.parse(v) : v;
  if(like(sql, 'INSERT INTO chat_rooms')){
    const r = { id:nextRoomId++, owner_id:p[0], name:p[1], access:p[2], template:p[3],
                env:jsonOf(p[4]), objects:jsonOf(p[5]), created_at:now(), updated_at:now() };
    chatRooms.push(r);
    return Promise.resolve(rows([{ id:r.id }]));
  }
  if(like(sql, 'FROM chat_rooms r JOIN users u ON u.id=r.owner_id WHERE r.id=$1')){
    const r = chatRooms.find(x => x.id === p[0]);
    if(!r) return Promise.resolve(rows([]));
    const u = userById(r.owner_id);
    return Promise.resolve(rows([{ ...r, owner_display:u.display, owner_username:u.username }]));
  }
  if(like(sql, 'SELECT count(*)::int AS n FROM chat_rooms WHERE owner_id=$1'))
    return Promise.resolve(rows([{ n:chatRooms.filter(r => r.owner_id === p[0]).length }]));
  if(like(sql, 'FROM chat_rooms r JOIN users u', 'WHERE r.owner_id=$1'))
    return Promise.resolve(rows(chatRooms.filter(r => r.owner_id === p[0]).sort(byNewest('updated_at')).slice(0, 30).map(card)));
  if(like(sql, 'FROM chat_room_members m JOIN chat_rooms r'))
    return Promise.resolve(rows(chatMembers.filter(m => m.user_id === p[0]).sort(byNewest('added_at'))
      .map(m => chatRooms.find(r => r.id === m.room_id)).filter(Boolean).slice(0, 30).map(card)));
  if(like(sql, 'FROM chat_room_visits v JOIN chat_rooms r'))
    return Promise.resolve(rows(chatVisits.filter(v => v.user_id === p[0]).sort(byNewest('at'))
      .map(v => chatRooms.find(r => r.id === v.room_id)).filter(Boolean).slice(0, 12).map(card)));
  if(like(sql, 'FROM chat_rooms r JOIN users u', 'lower(r.name) LIKE $1')){
    const q = String(p[0]).replace(/%/g, '');
    return Promise.resolve(rows(chatRooms.filter(r => (r.access !== 'private' || r.owner_id === p[1]) && r.name.toLowerCase().includes(q))
      .sort(byNewest('updated_at')).slice(0, 20).map(card)));
  }
  if(like(sql, 'SELECT 1 AS yes FROM chat_room_members'))
    return Promise.resolve(rows(chatMembers.some(m => m.room_id === p[0] && m.user_id === p[1]) ? [{ yes:1 }] : []));
  if(like(sql, 'FROM chat_room_members m JOIN users u'))
    return Promise.resolve(rows(chatMembers.filter(m => m.room_id === p[0]).map(m => userById(m.user_id))
      .filter(u => u.id).map(u => ({ id:u.id, username:u.username, display:u.display }))
      .sort((a, b) => String(a.display).localeCompare(String(b.display)))));
  if(like(sql, 'INSERT INTO chat_room_members')){
    if(!chatMembers.some(m => m.room_id === p[0] && m.user_id === p[1]))
      chatMembers.push({ room_id:p[0], user_id:p[1], added_at:now() });
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'DELETE FROM chat_room_members')){
    for(let i = chatMembers.length - 1; i >= 0; i--)
      if(chatMembers[i].room_id === p[0] && chatMembers[i].user_id === p[1]) chatMembers.splice(i, 1);
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'INSERT INTO chat_room_visits')){
    const v = chatVisits.find(x => x.user_id === p[0] && x.room_id === p[1]);
    if(v) v.at = now(); else chatVisits.push({ user_id:p[0], room_id:p[1], at:now() });
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'UPDATE chat_rooms SET env=$2,objects=$3')){
    const r = chatRooms.find(x => x.id === p[0]);
    if(r){ r.env = jsonOf(p[1]); r.objects = jsonOf(p[2]); r.updated_at = now(); }
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'UPDATE chat_rooms SET name=$2')){
    const r = chatRooms.find(x => x.id === p[0]); if(r){ r.name = p[1]; r.updated_at = now(); }
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'UPDATE chat_rooms SET access=$2')){
    const r = chatRooms.find(x => x.id === p[0]); if(r){ r.access = p[1]; r.updated_at = now(); }
    return Promise.resolve(rows([]));
  }
  if(like(sql, 'DELETE FROM chat_rooms WHERE id=$1')){
    const i = chatRooms.findIndex(x => x.id === p[0]);
    if(i >= 0) chatRooms.splice(i, 1);
    for(const list of [chatMembers, chatVisits])
      for(let j = list.length - 1; j >= 0; j--) if(list[j].room_id === p[0]) list.splice(j, 1);
    return Promise.resolve(rows([]));
  }

  /* Anything else is a statement this shim has never been shown. Fail
     loudly: a dev database that silently answers "no rows" to a query it
     does not understand is a debugging session about the wrong thing. */
  return Promise.reject(
    new Error('dev-server has no answer for: ' + sql.slice(0, 110)));
}

class Pool {
  query(text, params){ return saving(text, params); }
  end(){ return Promise.resolve(); }
  on(){ return this; }
}


/* ------------------------------------------------------- saving to disk */
let saveFile = null, saveT = null;
function snapshot(){
  return { users, games, votes, texts, nextId, nextGameId, nextTextId,
           chatRooms, chatMembers, chatVisits, nextRoomId };
}
function save(){
  if(!saveFile) return;
  try{
    const tmp = saveFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(snapshot()));
    fs.renameSync(tmp, saveFile);          // never a half-written file
  }catch(e){ console.error('memdb: could not save', e.message); }
}
function restore(file){
  try{
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    users.push(...(d.users||[])); games.push(...(d.games||[]));
    votes.push(...(d.votes||[])); texts.push(...(d.texts||[]));
    nextId = d.nextId || nextId; nextGameId = d.nextGameId || nextGameId;
    nextTextId = d.nextTextId || nextTextId;
    chatRooms.push(...(d.chatRooms||[])); chatMembers.push(...(d.chatMembers||[]));
    chatVisits.push(...(d.chatVisits||[])); nextRoomId = d.nextRoomId || nextRoomId;
  }catch(e){ if(e.code!=='ENOENT') console.error('memdb: could not read', e.message); }
}
const WRITES = /^\s*(INSERT|UPDATE|DELETE)/i;
function saving(text, params){
  const out = query(text, params);
  if(saveFile && WRITES.test(String(text))){
    clearTimeout(saveT); saveT = setTimeout(save, 150);
  }
  return out;
}

let installed = false;
function install(opts){
  const o = opts || {};
  if(o.file){ saveFile = o.file; restore(o.file); }
  if(installed) return;
  installed = true;
  const load = Module._load;
  Module._load = function(request, parent, isMain){
    if(request === 'pg') return { Pool };
    return load.apply(this, arguments);
  };
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'memory://koro';
}
module.exports = { install, save, rows:{ get users(){ return users; } },
                   addUser(u){ users.push(u); nextId = Math.max(nextId, u.id + 1); } };
